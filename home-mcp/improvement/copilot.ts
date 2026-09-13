import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { CopilotClient, ToolSet, defineTool, type SessionConfig } from '@github/copilot-sdk'
import type { LightAction, LightContext } from '../light-skill'
import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS } from '../lights-config'
import { validateLightPlanForExecution } from '../app'
import { improvementTextNeedsRedaction } from './scope'
import type { ImprovementAnalysis, ImprovementJob } from './types'

const ALLOWED_EDIT_PATHS = new Set([
  'home-mcp/light-skill.ts',
])
const ALLOWED_READ_PREFIXES = ['home-mcp/', '.github/skills/home-mcp-capability-authoring/']
const MAX_READ_LINES = 350
const MAX_REPLACEMENT_CHARS = 20_000
const LIGHT_ACTIONS = new Set<LightAction>([
  'on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on',
  'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules',
])
const CONTROL_KINDS = new Set(['room-picker', 'color-picker', 'brightness-slider', 'suggestions'])
const UNSAFE_SUMMARY = /(?:https?:\/\/|[a-z0-9_]+\.[a-z0-9_]+|gh[opsu]_|github_pat_)/i
const PRIVATE_DETAIL = /\b(?:medical|health|diagnosis|appointment|address|email|phone number|social security|ssn|credit card|bank account|wi-?fi|wireless network|password|passcode)\b/i
const REGRESSION_WORDS = new Set([
  ...`a about across active adjust again all and any are arent as at been before both brighter brighten brightness by cancel change check choose color colour configured could currently decrease default did dim dimmer do does dont down each explain for from had has have higher home house how i if in inactive increase is it its k kelvin lamp lamps latest left light lighting lights lower make many me mean never no now of off on one or overview percent pick please presence quick raise respectively rgb room rooms same set should show state status switch switched than that the their them these they those three throughout to turn two up was we were what whats when whether which white whole why would you`.split(' '),
  ...HOUSE_LIGHT_ROOMS.flatMap((room) => [
    room.id, room.name, ...room.aliases,
    ...room.lights.flatMap((light) => [light.name, ...(light.aliases ?? [])]),
  ]).flatMap((value) => value.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/)),
  ...Object.keys({ ...RGB_COLORS, ...WHITE_COLORS }).flatMap((value) => value.split(/\s+/)),
])

export interface CopilotImprovementOptions {
  baseDirectory: string
  cliPath?: string
  model: string
  reasoningEffort: NonNullable<SessionConfig['reasoningEffort']>
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function strictJson(content: string) {
  const trimmed = content.trim()
  const unwrapped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed
  return JSON.parse(unwrapped) as unknown
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems || !value.every((item) => typeof item === 'string' && item.trim() && item.length <= maxLength)) return null
  return value.map((item) => item.trim())
}

function safeAnalysisText(value: string) {
  return !UNSAFE_SUMMARY.test(value) && !PRIVATE_DETAIL.test(value) && !improvementTextNeedsRedaction(value)
}

function safeRegressionInput(value: string) {
  if (!safeAnalysisText(value) || !/^[\x20-\x7e]+$/.test(value)) return false
  const words = value.toLowerCase().replace(/[’']/g, '').match(/[a-z]+|\d+/g) ?? []
  return words.length > 0 && words.every((word) => /^\d+$/.test(word)
    ? word.length <= 4 && Number(word) <= 6500
    : REGRESSION_WORDS.has(word))
}

function hostAnalysisText(outcome: ImprovementAnalysis['outcome'], regressions: ImprovementAnalysis['regressions']) {
  if (outcome === 'met-needs') {
    return {
      inferredIntent: 'The supported light conversation met the requested need.',
      issues: [],
      summary: [],
    }
  }
  const actions = [...new Set(regressions.flatMap((regression) => regression.operations.map((operation) => operation.action)))]
  const actionText = actions.length ? actions.join(', ') : 'clarification'
  return {
    inferredIntent: `Handle a supported light request involving ${actionText}.`,
    issues: ['The stored light response did not match the expected supported behavior.'],
    summary: [`Understands more ways to request ${actionText} for supported lights.`],
  }
}

function analysisContext(value: unknown): LightContext | null {
  if (value === null) return null
  if (!object(value) || value.domain !== 'lights'
    || !(value.roomId === null || typeof value.roomId === 'string')
    || !Array.isArray(value.entityIds) || value.entityIds.length !== 0
    || !Array.isArray(value.lightNames) || !value.lightNames.every((item) => typeof item === 'string')) {
    throw new Error('Copilot returned an invalid light context')
  }
  const room = value.roomId === null ? null : HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === value.roomId)
  if (value.roomId !== null && !room) throw new Error('Copilot returned an unknown light context room')
  const lightNames = value.lightNames.map(String)
  if (lightNames.length && (!room || lightNames.some((name) => !room.lights.some((light) => light.name === name)))) {
    throw new Error('Copilot returned unknown light context targets')
  }
  if (value.lastAction !== undefined && (typeof value.lastAction !== 'string' || !LIGHT_ACTIONS.has(value.lastAction as LightAction))) {
    throw new Error('Copilot returned an invalid light context action')
  }
  if (value.lastState !== undefined && !['on', 'off', 'mixed', 'unavailable'].includes(String(value.lastState))) {
    throw new Error('Copilot returned an invalid light context state')
  }
  if (value.targetState !== undefined && value.targetState !== 'on' && value.targetState !== 'off') {
    throw new Error('Copilot returned an invalid light context target state')
  }
  if (value.historyBefore !== undefined && (
    typeof value.historyBefore !== 'string'
    || Number.isNaN(Date.parse(value.historyBefore))
    || !safeAnalysisText(value.historyBefore)
  )) throw new Error('Copilot returned an invalid light history boundary')
  return {
    domain: 'lights',
    roomId: value.roomId,
    entityIds: [],
    lightNames,
    ...(typeof value.lastAction === 'string' ? { lastAction: value.lastAction as LightAction } : {}),
    ...(value.lastState === 'on' || value.lastState === 'off' || value.lastState === 'mixed' || value.lastState === 'unavailable'
      ? { lastState: value.lastState } : {}),
    ...(value.targetState === 'on' || value.targetState === 'off' ? { targetState: value.targetState } : {}),
    ...(typeof value.historyBefore === 'string' ? { historyBefore: value.historyBefore } : {}),
  }
}

export function parseImprovementAnalysis(content: string, job: ImprovementJob): ImprovementAnalysis {
  if (!job.conversation) throw new Error('Improvement analysis requires a conversation')
  const conversation = job.conversation
  const value = strictJson(content)
  if (!object(value) || value.version !== 1 || !['met-needs', 'needs-improvement'].includes(String(value.outcome))
    || typeof value.inferredIntent !== 'string' || !value.inferredIntent.trim() || value.inferredIntent.length > 500) {
    throw new Error('Copilot returned an invalid improvement analysis')
  }
  const issues = stringList(value.issues, 8, 300)
  const summary = stringList(value.summary, 3, 140)
  if (!issues || !summary) throw new Error('Copilot returned invalid improvement summary fields')
  if ([...issues, ...summary].some((item) => !safeAnalysisText(item))) throw new Error('Copilot returned unsafe improvement summary content')
  const privateTexts = job.conversation.turns.flatMap((turn) => [turn.userText, turn.assistantText ?? ''])
    .map((text) => text.trim().toLowerCase()).filter((text) => text.length >= 20)
  const inferredIntent = value.inferredIntent.trim().toLowerCase()
  if (!safeAnalysisText(inferredIntent)
    || privateTexts.some((text) => text.includes(inferredIntent) || inferredIntent.includes(text))) {
    throw new Error('Copilot inferred intent must not quote private conversation text')
  }
  if ([...issues, ...summary].some((item) => {
    const normalized = item.toLowerCase()
    return privateTexts.some((text) => text.includes(normalized) || normalized.includes(text))
  })) throw new Error('Copilot improvement summaries must not quote private conversation text')
  if (!Array.isArray(value.regressions) || value.regressions.length > 5) throw new Error('Copilot returned invalid regression fixtures')
  const regressions = value.regressions.map((item) => {
    if (!object(item) || !Number.isInteger(item.turnIndex) || Number(item.turnIndex) < 0 || Number(item.turnIndex) >= conversation.turns.length
      || !['ready', 'clarify', 'unsupported'].includes(String(item.status))
      || typeof item.input !== 'string' || !item.input.trim() || item.input.length > 180 || !safeRegressionInput(item.input.trim())
      || !Array.isArray(item.operations) || !Array.isArray(item.controlKinds) || !Array.isArray(item.textIncludes)) {
      throw new Error('Copilot returned an invalid regression turn')
    }
    const regressionInput = item.input.trim().toLowerCase()
    if (conversation.turns.some((turn) => turn.userText.trim().toLowerCase() === regressionInput)) {
      throw new Error('Copilot regression input must generalize rather than copy a private user message')
    }
    const operations = item.operations.map((operation) => {
      if (!object(operation) || typeof operation.action !== 'string' || !LIGHT_ACTIONS.has(operation.action as LightAction)
        || typeof operation.roomId !== 'string'
        || !Array.isArray(operation.lightNames) || !operation.lightNames.every((name) => typeof name === 'string')
        || !Object.hasOwn(operation, 'brightnessPct')
        || !Object.hasOwn(operation, 'rgbColor')
        || !Object.hasOwn(operation, 'colorName')
        || !Object.hasOwn(operation, 'colorTemperatureKelvin')
        || !Object.hasOwn(operation, 'historyBefore')
        || !Object.hasOwn(operation, 'targetState')) {
        throw new Error(`Copilot returned an invalid expected light operation: ${JSON.stringify(operation).slice(0, 300)}`)
      }
      const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === operation.roomId)
      const lightNames = operation.lightNames.map(String)
      if (!room || lightNames?.some((name) => !room.lights.some((light) => light.name === name))) {
        throw new Error(`Copilot returned an unknown expected light target: ${JSON.stringify(operation).slice(0, 300)}`)
      }
      const brightness = operation.brightnessPct
      if (brightness !== undefined && brightness !== null
        && !(typeof brightness === 'number' && Number.isFinite(brightness) && brightness >= 0 && brightness <= 100)
        && !(Array.isArray(brightness) && brightness.length > 0 && brightness.length <= 12
          && brightness.every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= 100)
          && (!lightNames || brightness.length === 1 || brightness.length === lightNames.length))) {
        throw new Error('Copilot returned invalid expected brightness values')
      }
      const kelvin = operation.colorTemperatureKelvin
      if (kelvin !== undefined && kelvin !== null && (
        typeof kelvin !== 'number' || !Number.isFinite(kelvin) || kelvin < 2000 || kelvin > 6500 || room.color === 'none'
      )) throw new Error('Copilot returned an invalid expected color temperature')
      const rgbColor = operation.rgbColor
      if (rgbColor !== null && (
        !Array.isArray(rgbColor) || rgbColor.length !== 3
        || !rgbColor.every((channel) => typeof channel === 'number' && Number.isInteger(channel) && channel >= 0 && channel <= 255)
        || room.color !== 'rgb'
      )) throw new Error('Copilot returned an invalid expected RGB color')
      const colorName = operation.colorName
      if (colorName !== null && typeof colorName !== 'string') throw new Error('Copilot returned an invalid expected color')
      if (typeof colorName === 'string') {
        const namedWhite = colorName in WHITE_COLORS && kelvin === WHITE_COLORS[colorName]
        const namedRgb = colorName in RGB_COLORS && room.color === 'rgb'
          && JSON.stringify(rgbColor) === JSON.stringify(RGB_COLORS[colorName])
        const customRgb = rgbColor !== null && colorName === `rgb(${rgbColor.join(', ')})`
        const customKelvin = kelvin !== null && colorName === `${kelvin}K`
        if (room.color === 'none' || (!namedWhite && !namedRgb && !customRgb && !customKelvin)) {
          throw new Error('Copilot returned an invalid expected color')
        }
      }
      const historyBefore = operation.historyBefore
      if (historyBefore !== null && (
        typeof historyBefore !== 'string' || Number.isNaN(Date.parse(historyBefore)) || !safeAnalysisText(historyBefore)
      )) throw new Error('Copilot returned an invalid expected history boundary')
      const targetState = operation.targetState
      if (targetState !== null && targetState !== 'on' && targetState !== 'off') {
        throw new Error('Copilot returned an invalid expected target state')
      }
      return {
        action: operation.action as LightAction,
        roomId: operation.roomId,
        lightNames,
        brightnessPct: brightness as number | number[] | null,
        rgbColor: rgbColor === null ? null : [Number(rgbColor[0]), Number(rgbColor[1]), Number(rgbColor[2])] as [number, number, number],
        colorName: colorName === null ? null : String(colorName),
        colorTemperatureKelvin: kelvin === null ? null : Number(kelvin),
        historyBefore,
        targetState,
      }
    })
    const aggregateAction = operations[0]?.action
    const completeWholeHomeRead = Boolean(aggregateAction && (aggregateAction === 'rooms-on' || aggregateAction === 'lights-on')
      && operations.length === HOUSE_LIGHT_ROOMS.length
      && operations.every((operation, index) => operation.action === aggregateAction
        && operation.roomId === HOUSE_LIGHT_ROOMS[index].id
        && operation.lightNames.length === 0
        && operation.brightnessPct === null
        && operation.rgbColor === null
        && operation.colorName === null
        && operation.colorTemperatureKelvin === null
        && operation.historyBefore === null
        && operation.targetState === null))
    if (operations.some((operation) => operation.action === 'rooms-on' || operation.action === 'lights-on')
      && !completeWholeHomeRead) {
      throw new Error('Copilot whole-home regressions must include every configured room exactly once without fixture targets')
    }
    const controlKinds = item.controlKinds.map(String)
    if (!controlKinds.every((kind) => CONTROL_KINDS.has(kind))) {
      throw new Error(`Copilot returned an invalid control kind: ${JSON.stringify(controlKinds).slice(0, 300)}`)
    }
    if (item.textIncludes.length) throw new Error('Copilot regression textIncludes must remain empty')
    if ((item.status === 'ready') !== (operations.length > 0)) {
      throw new Error('Copilot ready regressions require operations and non-ready regressions must not include them')
    }
    if (item.status === 'ready') {
      const plan = validateLightPlanForExecution({
        status: 'ready',
        text: 'Ready.',
        response: 'Ready.',
        controls: [],
        context: null,
        operations: operations.map((operation) => {
          const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === operation.roomId)!
          return {
            action: operation.action,
            room,
            entityIds: operation.lightNames.map((name) => room.lights.find((light) => light.name === name)!.entityId),
            lightNames: operation.lightNames,
            brightnessPct: operation.brightnessPct,
            rgbColor: operation.rgbColor,
            colorName: operation.colorName,
            colorTemperatureKelvin: operation.colorTemperatureKelvin,
            historyBefore: operation.historyBefore,
            targetState: operation.targetState as 'on' | 'off' | null,
          }
        }),
      })
      if (plan.status !== 'ready') throw new Error(`Copilot regression is rejected by runtime execution policy: ${plan.text}`)
    }
    return {
      turnIndex: Number(item.turnIndex),
      input: item.input.trim(),
      context: analysisContext(item.context),
      status: item.status as ImprovementAnalysis['regressions'][number]['status'],
      operations: operations as ImprovementAnalysis['regressions'][number]['operations'],
      controlKinds: controlKinds as ImprovementAnalysis['regressions'][number]['controlKinds'],
      textIncludes: [],
    }
  })
  if (value.outcome === 'needs-improvement' && regressions.length === 0) throw new Error('An unmet conversation requires a regression fixture')
  if (value.outcome === 'met-needs' && regressions.length !== 0) throw new Error('A successful conversation cannot add regression fixtures')
  const hostText = hostAnalysisText(value.outcome as ImprovementAnalysis['outcome'], regressions as ImprovementAnalysis['regressions'])
  return {
    version: 1,
    outcome: value.outcome as ImprovementAnalysis['outcome'],
    ...hostText,
    regressions,
  }
}

function responseContent(response: unknown) {
  if (!object(response) || !object(response.data) || typeof response.data.content !== 'string') return ''
  return response.data.content
}

async function withClient<T>(options: CopilotImprovementOptions, action: (client: CopilotClient) => Promise<T>) {
  const client = new CopilotClient({
    ...(options.cliPath ? { cliPath: options.cliPath } : {}),
    baseDirectory: options.baseDirectory,
    logLevel: 'error',
    mode: 'empty',
  })
  try {
    await client.start()
    return await action(client)
  } finally {
    await client.stop()
  }
}

export async function analyzeImprovementJob(job: ImprovementJob, options: CopilotImprovementOptions) {
  if (!job.conversation) throw new Error('Improvement analysis requires a conversation')
  return withClient(options, async (client) => {
    const sessionId = `home-mcp-analysis-${job.id.slice(0, 24)}`
    const session = await client.createSession({
      sessionId,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      availableTools: [],
      enableSessionStore: false,
      enableSkills: false,
      skipCustomInstructions: true,
      systemMessage: {
        mode: 'append',
        content: 'You evaluate a private household light-assistant transcript. Return strict JSON only. Never include secrets, raw entity IDs, links, or personal details in summaries.',
      },
    })
    try {
      const response = await session.sendAndWait({
        prompt: improvementAnalysisPrompt(job),
      }, 180_000)
      return parseImprovementAnalysis(responseContent(response), job)
    } finally {
      await session.disconnect()
      await client.deleteSession(sessionId).catch(() => undefined)
    }
  })
}

export function improvementAnalysisPrompt(job: ImprovementJob) {
  if (!job.conversation) throw new Error('Improvement analysis requires a conversation')
  const inventory = HOUSE_LIGHT_ROOMS.map((room) => ({
    roomId: room.id,
    room: room.name,
    lights: room.lights.map((light) => light.name),
  }))
  return `Determine whether the assistant met the user's light-control or light-query needs. Infer the intended behavior when it did not. Use only the supplied transcript, routing provenance, light context, and configured inventory.

Return exactly:
{"version":1,"outcome":"met-needs"|"needs-improvement","inferredIntent":"plain English","issues":["plain English"],"summary":["one to three nontechnical release bullets"],"regressions":[{"turnIndex":0,"input":"new generalized regression utterance","context":null|{"domain":"lights","roomId":string|null,"entityIds":[],"lightNames":string[],"lastAction"?:string,"lastState"?:string,"targetState"?:"on"|"off","historyBefore"?:string},"status":"ready"|"clarify"|"unsupported","operations":[{"action":string,"roomId":string,"lightNames":string[],"brightnessPct":number|number[]|null,"rgbColor":[number,number,number]|null,"colorName":string|null,"colorTemperatureKelvin":number|null,"historyBefore":string|null,"targetState":"on"|"off"|null}],"controlKinds":string[],"textIncludes":[]}]}

Rules:
- If every user request was satisfied clearly and consistently, use outcome "met-needs" and an empty regressions array.
- handledByHomeMcp=false means the response bypassed the current curated light capability. Do not accept unrelated devices, indicators, decorative entities, or names absent from the configured inventory as a correct light answer.
- For an unmet need, include one regression entry for each failed user turn, using its zero-based turnIndex.
- Each regression input must be a new generalized utterance that reproduces the language pattern without copying the private user message.
- Expected operations describe the deterministic parser result before Home Assistant execution.
- Every expected operation field is required, including empty arrays and null values.
- Operation action must be one of: ${[...LIGHT_ACTIONS].join(', ')}.
- Operation roomId must be one of: ${HOUSE_LIGHT_ROOMS.map((room) => room.id).join(', ')}.
- rooms-on and lights-on regressions must include every configured room exactly once in inventory order, with empty lightNames and all value fields null.
- controlKinds must be empty or contain only: ${[...CONTROL_KINDS].join(', ')}.
- Regression inputs may contain only generalized light-control language, configured room/fixture names, colors, and numbers.
- textIncludes must always be an empty array; the host validates structured parser results instead of model-authored response excerpts.
- Summaries must be nontechnical, under 140 characters each, and must not quote the user.

Configured light inventory:
${JSON.stringify(inventory)}

Transcript:
${JSON.stringify(job.conversation)}`
}

function repositoryPath(root: string, requested: string, mode: 'read' | 'edit') {
  if (!requested || isAbsolute(requested)) throw new Error('Path must be repository-relative')
  const normalized = requested.replaceAll('\\', '/').replace(/^\.\//, '')
  if (normalized.split('/').some((part) => part === '.' || part === '..')) throw new Error('Path contains unsafe traversal segments')
  const allowed = mode === 'edit'
    ? ALLOWED_EDIT_PATHS.has(normalized)
    : ALLOWED_READ_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  if (!allowed) throw new Error(`Path is outside the allowed ${mode} scope`)
  const path = resolve(root, normalized)
  if (relative(root, path).startsWith(`..${sep}`) || relative(root, path) === '..') throw new Error('Path escapes the worktree')
  return path
}

function runCapture(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => code === 0 || code === 1 ? resolvePromise(stdout || stderr) : reject(new Error(`${command} exited ${code}: ${stderr}`)))
  })
}

function implementationTools(root: string) {
  return [
    defineTool('read_allowed_file', {
      description: 'Read an allowed Home MCP source file by repository-relative path and bounded line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          startLine: { type: 'integer', minimum: 1 },
          endLine: { type: 'integer', minimum: 1 },
        },
        required: ['path'],
        additionalProperties: false,
      },
      skipPermission: true,
      handler: async (args: unknown) => {
        if (!object(args) || typeof args.path !== 'string') throw new Error('path is required')
        const lines = (await readFile(repositoryPath(root, args.path, 'read'), 'utf8')).split('\n')
        const start = typeof args.startLine === 'number' ? Math.max(1, Math.floor(args.startLine)) : 1
        const requestedEnd = typeof args.endLine === 'number' ? Math.floor(args.endLine) : start + MAX_READ_LINES - 1
        const end = Math.min(lines.length, requestedEnd, start + MAX_READ_LINES - 1)
        return lines.slice(start - 1, end).map((line, index) => `${start + index}:${line}`).join('\n')
      },
    }),
    defineTool('search_allowed_files', {
      description: 'Search allowed Home MCP source files for an exact text string.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', minLength: 1, maxLength: 200 } },
        required: ['text'],
        additionalProperties: false,
      },
      skipPermission: true,
      handler: async (args: unknown) => {
        if (!object(args) || typeof args.text !== 'string' || !args.text) throw new Error('text is required')
        return (await runCapture('rg', ['--fixed-strings', '--line-number', '--max-count', '100', '--', args.text, ...ALLOWED_READ_PREFIXES], root)).slice(0, 20_000)
      },
    }),
    defineTool('replace_allowed_text', {
      description: 'Replace one exact, unique text block in an allowed Home MCP source file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          oldText: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['path', 'oldText', 'newText'],
        additionalProperties: false,
      },
      skipPermission: true,
      handler: async (args: unknown) => {
        if (!object(args) || typeof args.path !== 'string' || typeof args.oldText !== 'string' || typeof args.newText !== 'string'
          || !args.oldText || args.oldText.length > MAX_REPLACEMENT_CHARS || args.newText.length > MAX_REPLACEMENT_CHARS) {
          throw new Error('A bounded path, oldText, and newText are required')
        }
        const path = repositoryPath(root, args.path, 'edit')
        const source = await readFile(path, 'utf8')
        const first = source.indexOf(args.oldText)
        if (first < 0 || source.indexOf(args.oldText, first + args.oldText.length) >= 0) throw new Error('oldText must match exactly once')
        await writeFile(path, source.slice(0, first) + args.newText + source.slice(first + args.oldText.length), 'utf8')
        return { changed: args.path }
      },
    }),
  ]
}

export async function implementImprovement(job: ImprovementJob, analysis: ImprovementAnalysis, worktree: string, options: CopilotImprovementOptions) {
  return withClient(options, async (client) => {
    const sessionId = `home-mcp-implementation-${job.id.slice(0, 24)}`
    const session = await client.createSession({
      sessionId,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      workingDirectory: worktree,
      tools: implementationTools(worktree),
      availableTools: new ToolSet().addCustom('*'),
      enableSessionStore: false,
      enableSkills: false,
      skipCustomInstructions: true,
      systemMessage: {
        mode: 'append',
        content: `You maintain the deterministic Home MCP lights parser. Use only the supplied read/search/replace tools. Do not use shell, Git, network, deployment, Home Assistant, or files outside the allowed light capability scope. Only home-mcp/light-skill.ts is writable. Make the smallest parser change that satisfies the frozen host-owned regression fixture without weakening existing coverage.`,
      },
    })
    try {
      const response = await session.sendAndWait({
        prompt: `Implement this reviewed light-conversation improvement in the current worktree.

Analysis:
${JSON.stringify(analysis)}

The host already wrote a frozen regression fixture under home-mcp/improvement/regressions/. Do not edit or delete that fixture. Tests, corpus generators, policies, skills, release code, and deployment code are host-owned and read-only. Preserve all existing semantics and generated corpus coverage. Finish with a short summary only after the code change is complete.`,
      }, 600_000)
      return responseContent(response)
    } finally {
      await session.disconnect()
      await client.deleteSession(sessionId).catch(() => undefined)
    }
  })
}

export async function reviewImprovement(diff: string, analysis: ImprovementAnalysis, options: CopilotImprovementOptions) {
  return withClient(options, async (client) => {
    const sessionId = `home-mcp-review-${Date.now()}`
    const session = await client.createSession({
      sessionId,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      availableTools: [],
      enableSessionStore: false,
      enableSkills: false,
      skipCustomInstructions: true,
      systemMessage: {
        mode: 'append',
        content: 'Review a deterministic household-light parser change. Return strict JSON only. Reject behavior regressions, broadened device scope, unsafe service behavior, deleted coverage, or a change that does not satisfy the supplied intent.',
      },
    })
    try {
      const response = await session.sendAndWait({
        prompt: `Return exactly {"approved":boolean,"concerns":["plain English"]}.

Intended improvement:
${JSON.stringify(analysis)}

Validated candidate diff:
${diff.slice(0, 80_000)}`,
      }, 180_000)
      const value = strictJson(responseContent(response))
      if (!object(value) || typeof value.approved !== 'boolean') throw new Error('Copilot returned an invalid review')
      const concerns = stringList(value.concerns, 8, 300)
      if (!concerns) throw new Error('Copilot returned invalid review concerns')
      return { approved: value.approved, concerns }
    } finally {
      await session.disconnect()
      await client.deleteSession(sessionId).catch(() => undefined)
    }
  })
}
