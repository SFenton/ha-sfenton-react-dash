import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { randomUUID } from 'node:crypto'
import metadataJson from './metadata.json' with { type: 'json' }
import { ConversationImprovementStore } from './improvement/store'
import type { HomeMcpMetadata, ImprovementConversationTurn } from './improvement/types'
import { createHassUserAuthenticator, HassAuthenticationError, type AuthenticatedHassUser } from './hass-auth'
import { canonicalizeLightContext } from './light-context'
import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS, type HouseLightRoom } from './lights-config'
import {
  HOME_CHAT_USER_LIMIT,
  buildLightPlan,
  formatNames,
  parseLightUtterance,
  SINGLE_ROOM_DETAIL_RESPONSE,
  type LightAction,
  type LightContext,
  type LightOperation,
  type LightSkillResponse,
} from './light-skill'

const MAX_BODY_BYTES = 1_000_000
const MAX_STATE_ENTITIES = 50
const MAX_HISTORY_ENTITIES = 20
const MAX_HISTORY_HOURS = 168

interface JsonRpcRequest {
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

interface HomeMcpOptions {
  hassUrl: string
  agentId?: string
  allowedOrigins?: string[]
  chatModel?: string
  fetchImpl?: typeof fetch
  improvementStore?: ConversationImprovementStore
  authenticateUser?: (token: string) => Promise<AuthenticatedHassUser>
  tls?: { cert: Buffer; key: Buffer }
}

interface ToolArguments {
  text?: unknown
  conversation_id?: unknown
  context?: unknown
  entity_ids?: unknown
  hours?: unknown
  action?: unknown
  room?: unknown
  rooms?: unknown
  light_names?: unknown
  brightness_pct?: unknown
  color_name?: unknown
  rgb_color?: unknown
  color_temperature_kelvin?: unknown
  operations?: unknown
  history_before?: unknown
  target_state?: unknown
  thread_id?: unknown
  turn_id?: unknown
  control_id?: unknown
  conversation?: unknown
}

const metadata = metadataJson as HomeMcpMetadata
const json = (value: unknown) => JSON.stringify(value)
const isEntityId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(value)
const isIdentifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)

function corsOrigin(request: IncomingMessage, allowedOrigins: ReadonlySet<string>) {
  const origin = request.headers.origin
  if (!origin) return null
  return allowedOrigins.has(origin) ? origin : undefined
}

function send(response: ServerResponse, status: number, value: unknown, origin: string | null = null) {
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  }
  if (origin) {
    headers['access-control-allow-origin'] = origin
    headers.vary = 'Origin'
  }
  response.writeHead(status, headers)
  response.end(json(value))
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > MAX_BODY_BYTES) throw new Error('request-too-large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRpcRequest
}

function bearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

function entityIds(value: unknown, limit: number) {
  if (!Array.isArray(value) || !value.length || value.length > limit || !value.every(isEntityId)) return null
  return [...new Set(value)]
}

async function hassRequest(fetchImpl: typeof fetch, hassUrl: string, token: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('authorization', `Bearer ${token}`)
  if (init?.body) headers.set('content-type', 'application/json')
  const response = await fetchImpl(`${hassUrl}${path}`, { ...init, headers })
  if (!response.ok) throw new Error(`Home Assistant returned ${response.status}`)
  return response.json() as Promise<unknown>
}

interface HassState {
  entity_id: string
  state: string
  last_changed?: string
  attributes?: Record<string, unknown>
}

interface LightOperationResult {
  operation: LightOperation
  states: HassState[]
  succeeded: string[]
  failed: string[]
  unsupported?: boolean
  history?: unknown
  logbook?: unknown
  logbookUnavailable?: boolean
  resultingBrightness?: number[]
}

const LIGHT_ACTIONS = new Set<LightAction>([
  'on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on',
  'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules',
])
const READ_LIGHT_ACTIONS = new Set<LightAction>([
  'state', 'count', 'list', 'rooms-on', 'lights-on', 'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules',
])
const EXECUTION_LIGHT_ROOMS = Object.freeze(HOUSE_LIGHT_ROOMS.map((room) => Object.freeze({
  ...room,
  aliases: Object.freeze([...room.aliases]),
  lights: Object.freeze(room.lights.map((light) => Object.freeze({
    ...light,
    ...(light.aliases ? { aliases: Object.freeze([...light.aliases]) } : {}),
  }))),
}))) as readonly HouseLightRoom[]

function findExecutionLightRoom(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, ' ')
  if (!normalized) return null
  return EXECUTION_LIGHT_ROOMS.find((room) => room.id.replace(/-/g, ' ') === normalized
    || room.name.toLowerCase() === normalized
    || room.aliases.some((alias) => alias === normalized)) ?? null
}

function readableState(state: HassState) {
  return state.state === 'on' || state.state === 'off'
}

function supportedColorModes(state: HassState) {
  const modes = state.attributes?.supported_color_modes
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === 'string') : []
}

function supportsRgb(state: HassState) {
  return supportedColorModes(state).some((mode) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode))
}

function temperatureBounds(state: HassState) {
  if (!supportedColorModes(state).includes('color_temp')) return null
  const min = state.attributes?.min_color_temp_kelvin
  const max = state.attributes?.max_color_temp_kelvin
  return typeof min === 'number' && Number.isFinite(min)
    && typeof max === 'number' && Number.isFinite(max) && min <= max
    ? { min: Math.round(min), max: Math.round(max) }
    : null
}

function canonicalOperation(value: unknown): LightOperation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const operation = value as Partial<LightOperation>
  if (typeof operation.action !== 'string' || !LIGHT_ACTIONS.has(operation.action as LightAction)
    || !operation.room || typeof operation.room !== 'object') return null
  const roomId = (operation.room as { id?: unknown }).id
  const room = findExecutionLightRoom(roomId)
  if (!room || !Array.isArray(operation.entityIds) || !operation.entityIds.every((id) => typeof id === 'string')
    || new Set(operation.entityIds).size !== operation.entityIds.length
    || !Array.isArray(operation.lightNames) || !operation.lightNames.every((name) => typeof name === 'string')) return null
  const lights = operation.entityIds.map((id) => room.lights.find((light) => light.entityId === id))
  if (lights.some((light) => !light)) return null
  const lightNames = lights.map((light) => light!.name)
  if (operation.lightNames.length !== lightNames.length
    || operation.lightNames.some((name, index) => name !== lightNames[index])) return null

  const rawBrightness = operation.brightnessPct
  const brightnessPct = Array.isArray(rawBrightness)
    ? rawBrightness.every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= 100)
      ? [...rawBrightness]
      : null
    : rawBrightness === null
      ? null
      : typeof rawBrightness === 'number' && Number.isFinite(rawBrightness) && rawBrightness >= 0 && rawBrightness <= 100
        ? rawBrightness
        : undefined
  if (brightnessPct === undefined || (Array.isArray(rawBrightness) && (
    rawBrightness.length === 0 || (rawBrightness.length > 1 && rawBrightness.length !== operation.entityIds.length)
  ))) return null
  if (room.dimmable === false && ['set', 'up', 'down'].includes(operation.action)) return null
  if (operation.action === 'set' && brightnessPct === null) return null

  const rgbColor = operation.rgbColor === null
    ? null
    : Array.isArray(operation.rgbColor) && operation.rgbColor.length === 3
      && operation.rgbColor.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
      ? [operation.rgbColor[0], operation.rgbColor[1], operation.rgbColor[2]] as [number, number, number]
      : undefined
  const colorTemperatureKelvin = operation.colorTemperatureKelvin === null
    ? null
    : typeof operation.colorTemperatureKelvin === 'number' && Number.isFinite(operation.colorTemperatureKelvin)
      && operation.colorTemperatureKelvin >= 2000 && operation.colorTemperatureKelvin <= 6500
      ? Math.round(operation.colorTemperatureKelvin)
      : undefined
  if (rgbColor === undefined || colorTemperatureKelvin === undefined
    || (rgbColor && room.color !== 'rgb')
    || (colorTemperatureKelvin !== null && room.color === 'none')
    || (operation.action === 'color' && rgbColor === null && colorTemperatureKelvin === null)) return null
  const colorName = operation.colorName === null || typeof operation.colorName === 'string' ? operation.colorName : null
  const historyBefore = operation.historyBefore === null
    ? null
    : typeof operation.historyBefore === 'string' && !Number.isNaN(Date.parse(operation.historyBefore))
      ? operation.historyBefore
      : undefined
  if (historyBefore === undefined) return null
  const targetState = operation.targetState === null || operation.targetState === 'on' || operation.targetState === 'off'
    ? operation.targetState
    : undefined
  if (targetState === undefined) return null
  const hasBrightness = brightnessPct !== null
  const hasRgb = rgbColor !== null
  const hasKelvin = colorTemperatureKelvin !== null
  const hasColorName = colorName !== null
  const hasHistory = historyBefore !== null
  const hasTargetState = targetState !== null
  if ((operation.action === 'on' || operation.action === 'off')
    && (hasBrightness || hasRgb || hasKelvin || hasColorName || hasHistory || hasTargetState)) return null
  if (operation.action === 'set'
    && (!hasBrightness || hasRgb || hasKelvin || hasColorName || hasHistory || hasTargetState)) return null
  if ((operation.action === 'up' || operation.action === 'down')
    && (hasRgb || hasKelvin || hasColorName || hasHistory || hasTargetState)) return null
  if (operation.action === 'color'
    && (hasBrightness || hasHistory || hasTargetState || hasRgb === hasKelvin || !hasColorName)) return null
  if (operation.action === 'state' && (hasBrightness || hasRgb || hasKelvin || hasColorName || hasHistory)) return null
  if (['count', 'list', 'color-state', 'brightness-state', 'pbl', 'pbl-rules'].includes(operation.action)
    && (hasBrightness || hasRgb || hasKelvin || hasColorName || hasHistory || hasTargetState)) return null
  if ((operation.action === 'history' || operation.action === 'reason')
    && (hasBrightness || hasRgb || hasKelvin || hasColorName)) return null
  return {
    action: operation.action as LightAction,
    room,
    entityIds: [...operation.entityIds],
    lightNames,
    brightnessPct,
    rgbColor,
    colorName,
    colorTemperatureKelvin,
    historyBefore,
    targetState,
  }
}

export function validateLightPlanForExecution(plan: LightSkillResponse) {
  if (plan.status !== 'ready') return plan
  if (!Array.isArray(plan.operations) || plan.operations.length < 1
    || plan.operations.length > Math.max(12, EXECUTION_LIGHT_ROOMS.length)) {
    const text = 'That light request did not match the configured controls.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  const operations = plan.operations.map(canonicalOperation)
  if (operations.some((operation) => operation === null)) {
    const text = 'That light request did not match the configured controls.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  const canonicalOperations = operations as LightOperation[]
  const globalAction = canonicalOperations[0]?.action
  const globalRead = Boolean(globalAction && (globalAction === 'rooms-on' || globalAction === 'lights-on')
    && canonicalOperations.length === EXECUTION_LIGHT_ROOMS.length
    && canonicalOperations.every((operation, index) => operation.action === globalAction
      && operation.room.id === EXECUTION_LIGHT_ROOMS[index].id
      && operation.entityIds.length === 0
      && operation.lightNames.length === 0
      && operation.brightnessPct === null
      && operation.rgbColor === null
      && operation.colorName === null
      && operation.colorTemperatureKelvin === null
      && operation.historyBefore === null
      && operation.targetState === null))
  if (canonicalOperations.some((operation) => operation.action === 'rooms-on' || operation.action === 'lights-on')
    && !globalRead) {
    const text = 'Whole-home light reads must include every configured room exactly once without fixture targets.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  if (canonicalOperations.length > 12 && !globalRead) {
    const text = 'That light request did not match the configured controls.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  const operationKinds = new Set(canonicalOperations.map((operation) => READ_LIGHT_ACTIONS.has(operation.action) ? 'read' : 'write'))
  const readActions = new Set(canonicalOperations.filter((operation) => READ_LIGHT_ACTIONS.has(operation.action)).map((operation) => operation.action))
  if (operationKinds.size > 1 || readActions.size > 1) {
    const text = 'Read and control requests must be sent as separate light requests.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  if (canonicalOperations.length > 1
    && readActions.size === 1
    && !['state', 'list', 'rooms-on', 'lights-on'].includes(canonicalOperations[0].action)) {
    return responseWithContext({
      status: 'unsupported',
      text: SINGLE_ROOM_DETAIL_RESPONSE,
      controls: [],
      context: null,
    })
  }
  if (canonicalOperations.length > 1
    && readActions.size === 1
    && new Set(canonicalOperations.map((operation) => operation.room.id)).size !== canonicalOperations.length) {
    return responseWithContext({
      status: 'unsupported',
      text: 'Combine fixtures from the same room into one light query.',
      controls: [],
      context: null,
    })
  }
  const requestedContext = canonicalizeLightContext(plan.context)
  const last = canonicalOperations.at(-1)!
  const contextAction = globalRead ? last.action : null
  const selectedRoomIds = requestedContext?.roomLightNames
    ? Object.keys(requestedContext.roomLightNames)
    : []
  const preserveMultiContext = Boolean(requestedContext?.roomIds?.length && requestedContext.roomLightNames
    && canonicalOperations.length === selectedRoomIds.length
    && new Set(canonicalOperations.map((operation) => operation.room.id)).size === selectedRoomIds.length
    && canonicalOperations.every((operation) => {
      const expectedNames = requestedContext.roomLightNames?.[operation.room.id]
      const actualNames = operation.lightNames.length
        ? operation.lightNames
        : operation.room.lights.map((light) => light.name)
      return expectedNames && expectedNames.length === actualNames.length
        && expectedNames.every((name) => actualNames.includes(name))
    })
    && selectedRoomIds.every((roomId) => canonicalOperations.some((operation) => operation.room.id === roomId)))
  const context: LightContext = preserveMultiContext
    ? {
        ...requestedContext!,
        lastAction: last.action,
      }
    : {
        domain: 'lights',
        roomId: contextAction ? null : last.room.id,
        entityIds: contextAction ? [] : last.entityIds,
        lightNames: contextAction ? [] : last.lightNames,
        lastAction: contextAction ?? last.action,
        ...(!contextAction && last.targetState ? { targetState: last.targetState } : {}),
      }
  if (!READ_LIGHT_ACTIONS.has(last.action)) {
    delete context.targetState
    delete context.historyBefore
  }
  return {
    ...plan,
    operations: canonicalOperations,
    context,
  }
}

function operationTargets(operation: LightOperation) {
  if (operation.entityIds.length) return operation.entityIds
  if (['up', 'down', 'count', 'list', 'rooms-on', 'lights-on', 'color-state', 'brightness-state'].includes(operation.action)) return operation.room.lights.map((light) => light.entityId)
  return [operation.room.groupEntityId]
}

function brightnessFromState(state: HassState) {
  const brightness = state.attributes?.brightness
  if (state.state === 'off') return 0
  return state.state === 'on' && typeof brightness === 'number' && Number.isFinite(brightness)
    ? Math.max(0, Math.min(100, Math.round(brightness / 255 * 100))) : null
}

async function readStates(fetchImpl: typeof fetch, hassUrl: string, token: string, ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => hassRequest(fetchImpl, hassUrl, token, `/api/states/${encodeURIComponent(id)}`)))
  return results.map((result, index) => result.status === 'fulfilled'
    ? result.value as HassState
    : { entity_id: ids[index], state: 'unavailable', attributes: {} } satisfies HassState)
}

function responseWithContext(response: Omit<LightSkillResponse, 'response'> & { response?: string }) {
  return { ...response, response: response.response ?? response.text }
}

async function executeLightOperation(fetchImpl: typeof fetch, hassUrl: string, token: string, operation: LightOperation): Promise<LightOperationResult> {
  const targets = operationTargets(operation)
  if (['state', 'count', 'list', 'rooms-on', 'lights-on', 'color-state', 'brightness-state'].includes(operation.action)) {
    const states = await readStates(fetchImpl, hassUrl, token, targets)
    return { operation, states, succeeded: states.filter(readableState).map((state) => state.entity_id), failed: states.filter((state) => !readableState(state)).map((state) => state.entity_id) }
  }
  if (operation.action === 'pbl' || operation.action === 'pbl-rules') {
    if (!operation.room.pblEntityId) return { operation, states: [], succeeded: [], failed: targets, unsupported: true }
    const states = await readStates(fetchImpl, hassUrl, token, [operation.room.pblEntityId])
    const readable = Boolean(states[0] && readableState(states[0]))
    return { operation, states, succeeded: readable ? [operation.room.pblEntityId] : [], failed: readable ? [] : [operation.room.pblEntityId] }
  }
  if (operation.action === 'history' || operation.action === 'reason') {
    const end = operation.historyBefore ? new Date(Date.parse(operation.historyBefore) - 1).toISOString() : new Date().toISOString()
    const start = new Date(Date.parse(end) - MAX_HISTORY_HOURS * 60 * 60 * 1000).toISOString()
    const query = new URLSearchParams({ filter_entity_id: targets.join(','), minimal_response: '', no_attributes: '', end_time: end })
    const history = await hassRequest(fetchImpl, hassUrl, token, `/api/history/period/${encodeURIComponent(start)}?${query}`)
    let logbook: unknown = null
    let logbookUnavailable = false
    if (operation.action === 'reason') {
      const logQuery = new URLSearchParams({ entity: targets.join(','), end_time: end })
      try { logbook = await hassRequest(fetchImpl, hassUrl, token, `/api/logbook/${encodeURIComponent(start)}?${logQuery}`) } catch { logbookUnavailable = true }
    }
    return { operation, states: [], succeeded: targets, failed: [], history, logbook, logbookUnavailable }
  }

  const before = await readStates(fetchImpl, hassUrl, token, targets)
  let available = before.filter(readableState).map((state) => state.entity_id)
  const failed = targets.filter((id) => !available.includes(id))
  if (operation.action === 'up' || operation.action === 'down') {
    const relative = before.filter((state) => available.includes(state.entity_id) && brightnessFromState(state) !== null)
    const relativeIds = relative.map((state) => state.entity_id)
    failed.push(...available.filter((id) => !relativeIds.includes(id)))
    available = relativeIds
  }
  if (operation.action === 'color') {
    const colorStates = before.filter((state) => available.includes(state.entity_id))
    const compatible = colorStates.filter((state) => operation.rgbColor
      ? supportsRgb(state)
      : operation.colorTemperatureKelvin !== null
        ? (() => {
            const bounds = temperatureBounds(state)
            return Boolean(bounds && operation.colorTemperatureKelvin! >= bounds.min && operation.colorTemperatureKelvin! <= bounds.max)
          })()
        : false)
    const compatibleIds = compatible.map((state) => state.entity_id)
    failed.push(...available.filter((id) => !compatibleIds.includes(id)))
    available = compatibleIds
  }
  if (!available.length) return { operation, states: before, succeeded: [], failed }

  const calls: Array<{ domain: string; ids: string[]; service: 'turn_on' | 'turn_off'; data: Record<string, unknown> }> = []
  let resultingBrightness: number[] | undefined
  const grouped = (ids: string[]) => [...new Set(ids.map((id) => id.split('.')[0]))].map((domain) => ({ domain, ids: ids.filter((id) => id.startsWith(`${domain}.`)) }))
  if (operation.action === 'off') grouped(available).forEach((target) => calls.push({ ...target, service: 'turn_off', data: {} }))
  else if (operation.action === 'on') grouped(available).forEach((target) => calls.push({ ...target, service: 'turn_on', data: {} }))
  else if (operation.action === 'up' || operation.action === 'down') {
    const deltas = Array.isArray(operation.brightnessPct)
      ? operation.brightnessPct
      : [operation.brightnessPct ?? 10]
    const values: number[] = []
    available.forEach((id) => {
      const targetIndex = Math.max(0, targets.indexOf(id))
      const delta = deltas[Math.min(targetIndex, deltas.length - 1)]
      const current = brightnessFromState(before.find((state) => state.entity_id === id)!)!
      const brightness = Math.max(0, Math.min(100, current + (operation.action === 'up' ? delta : -delta)))
      values.push(brightness)
      calls.push({ domain: id.split('.')[0], ids: [id], service: 'turn_on', data: { brightness_pct: brightness } })
    })
    resultingBrightness = values
  }
  else if (Array.isArray(operation.brightnessPct) && operation.brightnessPct.length > 1) {
    const values = operation.brightnessPct
    available.forEach((id) => {
      const targetIndex = Math.max(0, targets.indexOf(id))
      calls.push({ domain: id.split('.')[0], ids: [id], service: 'turn_on', data: { brightness_pct: values[Math.min(targetIndex, values.length - 1)] } })
    })
  } else {
    const brightness = Array.isArray(operation.brightnessPct) ? operation.brightnessPct[0] : operation.brightnessPct
    const data: Record<string, unknown> = {}
    if (brightness !== null && brightness !== undefined) data.brightness_pct = brightness
    if (operation.rgbColor) data.rgb_color = operation.rgbColor
    if (operation.colorTemperatureKelvin) data.color_temp_kelvin = operation.colorTemperatureKelvin
    grouped(available).forEach((target) => calls.push({ ...target, service: 'turn_on', data }))
  }
  const succeeded: string[] = []
  for (const call of calls) {
    try {
      await hassRequest(fetchImpl, hassUrl, token, `/api/services/${call.domain}/${call.service}`, {
        method: 'POST', body: JSON.stringify({ entity_id: call.ids.length === 1 ? call.ids[0] : call.ids, ...call.data }),
      })
      succeeded.push(...call.ids)
    } catch { failed.push(...call.ids) }
  }
  return { operation, states: before, succeeded: [...new Set(succeeded)], failed: [...new Set(failed)], resultingBrightness }
}

function operationSuccessText(operation: LightOperation, resultingBrightness?: number[]) {
  const selected = operation.lightNames.length ? formatNames(operation.lightNames) : `${operation.room.name} lights`
  const roomSuffix = operation.lightNames.length ? ` in the ${operation.room.name}` : ''
  if (operation.action === 'on') return `I turned on the ${selected}${roomSuffix}.`
  if (operation.action === 'off') return `I turned off the ${selected}${roomSuffix}.`
  if (operation.action === 'up' || operation.action === 'down') {
    const values = resultingBrightness?.length
      ? resultingBrightness
      : Array.isArray(operation.brightnessPct) ? operation.brightnessPct : [operation.brightnessPct]
    const distinct = new Set(values)
    const result = values.length > 1 && operation.lightNames.length === values.length
      ? operation.lightNames.map((name, index) => `${name} ${operation.action} to ${values[index]}%`)
        .join(', ').replace(/, ([^,]+)$/, ', and $1')
      : distinct.size === 1
        ? `${selected} ${operation.action} to ${values[0]}%`
        : `${selected} ${operation.action}`
    return `I turned the ${result}. You can ask me to set specific brightness and I can set them there as well.`
  }
  if (operation.action === 'color') return `I turned the ${selected}${roomSuffix} to ${operation.colorName}.`
  const values = Array.isArray(operation.brightnessPct) ? operation.brightnessPct : [operation.brightnessPct]
  if (values.filter((value) => value !== null).length > 1 && operation.lightNames.length === values.length) {
    return operation.lightNames.map((name, index) => `${name} to ${values[index]}%`).join(', ').replace(/, ([^,]+)$/, ', and $1').replace(/^/, 'I turned the ') + '.'
  }
  return `I turned the ${selected}${roomSuffix} to ${values[0]}%.`
}

function roomStateText(summaries: Array<{
  room: string
  lightNames: string[]
  fixtureStates: Array<{ name: string; state: 'on' | 'off' | 'unavailable' }>
  state: 'on' | 'off' | 'mixed' | 'unavailable'
}>) {
  if (summaries.some((summary) => summary.lightNames.length)) {
    return `${summaries.flatMap((summary) => summary.fixtureStates.length
      ? summary.fixtureStates.map((fixture) => `${fixture.name} in the ${summary.room} is ${fixture.state}`)
      : [`${summary.room} lights are ${summary.state === 'mixed' ? 'partly on' : summary.state}`]).join('; ')}.`
  }
  const groups = new Map<string, string[]>()
  for (const summary of summaries) {
    const label = summary.state === 'mixed' ? 'partly on' : summary.state
    const rooms = groups.get(label) ?? []
    rooms.push(`${summary.room} lights`)
    groups.set(label, rooms)
  }

  const clauses = [...groups.entries()].map(([state, rooms]) => {
    const qualifier = groups.size === 1 && rooms.length === 2 && (state === 'on' || state === 'off') ? 'both ' : groups.size === 1 && rooms.length > 2 && (state === 'on' || state === 'off') ? 'all ' : ''
    return `${formatNames(rooms)} are ${qualifier}${state}`
  })
  return `${clauses.join(', ').replace(/, ([^,]+)$/, ', and $1')}.`
}

function unavailableText(room: string, subject = 'lights') {
  return `I could not read the ${room} ${subject} from Home Assistant.`
}

function roomOverviewText(activeRooms: string[], uncertainRooms: string[]) {
  const activeText = activeRooms.length === 1
    ? `The ${activeRooms[0]} lights are on.`
    : activeRooms.length > 1
      ? `These rooms have lights on:\n${activeRooms.map((room) => `• ${room}`).join('\n')}`
      : 'No readable configured rooms have lights on.'
  const uncertainty = uncertainRooms.length
    ? `\n\n${formatNames(uncertainRooms)} could not be fully checked because some light states could not be read.`
    : ''
  const followUp = activeRooms.length === 1
    ? `\n\nWould you like to know more about the ${activeRooms[0]}?`
    : activeRooms.length > 1
      ? '\n\nWould you like to know more about a particular room?'
      : ''
  return `${activeText}${uncertainty}${followUp}`
}

function roomDetailFollowUpText(canChangeColor: boolean) {
  const actions = canChangeColor
    ? 'when these lights last turned on, change their color, turn them off, or tell you why they are on'
    : 'when these lights last turned on, turn them off, or tell you why they are on'
  return `I can tell you ${actions}. What would you like to do next?`
}

function operationRetryMessage(operation: LightOperation) {
  const selected = operation.lightNames.length
    ? `${formatNames(operation.lightNames)} in the ${operation.room.name}`
    : `${operation.room.name} lights`
  if (operation.action === 'on') return `Turn on the ${selected}.`
  if (operation.action === 'off') return `Turn off the ${selected}.`
  if (operation.action === 'up' || operation.action === 'down') {
    const values = Array.isArray(operation.brightnessPct) ? operation.brightnessPct : [operation.brightnessPct]
    if (values.length > 1 && operation.lightNames.length === values.length) {
      return operation.lightNames
        .map((name, index) => `Turn the ${name} in the ${operation.room.name} ${operation.action} by ${values[index]}%`)
        .join(' and ') + '.'
    }
    const delta = values[0] ?? 10
    return `Turn the ${selected} ${operation.action} by ${delta}%.`
  }
  if (operation.action === 'color') {
    if (operation.rgbColor) return `Turn the ${selected} to rgb(${operation.rgbColor.join(', ')}).`
    if (operation.colorTemperatureKelvin) return `Turn the ${selected} to ${operation.colorTemperatureKelvin}K.`
    if (operation.colorName) return `Turn the ${selected} to ${operation.colorName}.`
  }
  const values = Array.isArray(operation.brightnessPct) ? operation.brightnessPct : [operation.brightnessPct]
  if (values.filter((value) => value !== null).length > 1 && operation.lightNames.length === values.length) {
    return operation.lightNames
      .map((name, index) => `Turn the ${name} in the ${operation.room.name} to ${values[index]}%`)
      .join(' and ') + '.'
  }
  const brightness = values[0]
  return brightness === null ? `Update the ${selected}.` : `Turn the ${selected} to ${brightness}%.`
}

function retryOperation(result: { operation: LightOperation; failed: string[] }) {
  const brightness = result.operation.brightnessPct
  return {
    ...result.operation,
    entityIds: result.failed,
    brightnessPct: Array.isArray(brightness)
      ? result.failed.map((id) => {
          const index = operationTargets(result.operation).indexOf(id)
          return brightness[Math.max(0, index)]
        })
      : brightness,
    lightNames: result.failed.flatMap((id) => {
      const name = result.operation.room.lights.find((light) => light.entityId === id)?.name
      return name ? [name] : []
    }),
  }
}

function retryControls(results: Array<{ operation: LightOperation; failed: string[] }>) {
  const messages = results.filter((result) => result.failed.length)
    .flatMap((result) => {
      const message = operationRetryMessage(retryOperation(result))
      return message.endsWith('.') ? [message.slice(0, -1)] : [message]
    })
  if (!messages.length) return []
  const message = `${messages.join(' and ')}.`
  return message.length <= HOME_CHAT_USER_LIMIT
    ? [{ id: `retry-${Date.now()}`, kind: 'suggestions' as const, options: [{ label: 'Try Again', message }] }]
    : []
}

async function enrichColorPicker(fetchImpl: typeof fetch, hassUrl: string, token: string, plan: LightSkillResponse) {
  const control = plan.controls.find((candidate) => candidate.kind === 'color-picker')
  if (!control || !control.entityIds.length) return plan
  const rooms = control.rooms.map(findExecutionLightRoom)
  const allowedIds = new Set(rooms.flatMap((room) => room?.lights.map((light) => light.entityId) ?? []))
  if (rooms.some((room) => !room) || control.room !== rooms[0]?.name || control.entityIds.some((id) => !allowedIds.has(id))) {
    const text = 'That light request did not match the configured controls.'
    return responseWithContext({ status: 'unsupported', text, controls: [], context: null })
  }
  const states = await readStates(fetchImpl, hassUrl, token, control.entityIds)
  if (states.some((state) => !readableState(state))) {
    const text = `I could not read the ${control.room} light color capabilities from Home Assistant.`
    return responseWithContext({ status: 'answer', text, controls: [], context: plan.context })
  }
  const rgbSupported = states.every(supportsRgb)
  const bounds = states.map(temperatureBounds)
  const temperatureSupported = bounds.every((value) => value !== null)
  if (!rgbSupported && !temperatureSupported) {
    const text = `${control.room} lights do not share a supported color control.`
    return responseWithContext({ status: 'unsupported', text, controls: [], context: plan.context })
  }
  control.supportsCustomRgb = rgbSupported
  control.colorMode = rgbSupported ? 'rgb' : 'temperature'
  if (temperatureSupported) {
    control.minTemperatureKelvin = Math.max(...bounds.map((value) => value!.min))
    control.maxTemperatureKelvin = Math.min(...bounds.map((value) => value!.max))
    if (control.minTemperatureKelvin > control.maxTemperatureKelvin) {
      const text = `${control.room} lights do not share a supported white-temperature range.`
      return responseWithContext({ status: 'unsupported', text, controls: [], context: plan.context })
    }
  }
  control.palette = [
    ...(temperatureSupported
      ? Object.entries(WHITE_COLORS)
          .filter(([, kelvin]) => kelvin >= control.minTemperatureKelvin && kelvin <= control.maxTemperatureKelvin)
          .map(([name]) => name)
      : []),
    ...(rgbSupported ? Object.keys(RGB_COLORS).filter((name) => !(name in WHITE_COLORS)) : []),
  ]
  if (rgbSupported) {
    const rgb = states.map((state) => state.attributes?.rgb_color).find((value): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((channel) => typeof channel === 'number'))
    if (rgb) control.currentRgb = [rgb[0], rgb[1], rgb[2]]
  }
  const kelvin = states.map((state) => state.attributes?.color_temp_kelvin).find((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (kelvin) control.currentTemperatureKelvin = Math.max(control.minTemperatureKelvin, Math.min(control.maxTemperatureKelvin, Math.round(kelvin)))
  return plan
}

async function executeLightPlan(fetchImpl: typeof fetch, hassUrl: string, token: string, plan: LightSkillResponse) {
  const trustedPlan = validateLightPlanForExecution(plan)
  if (trustedPlan.status !== 'ready' || !trustedPlan.operations) return trustedPlan
  const results = []
  for (const operation of trustedPlan.operations) results.push(await executeLightOperation(fetchImpl, hassUrl, token, operation))
  plan = trustedPlan
  const failures = results.flatMap((result) => result.failed)
  const successes = results.flatMap((result) => result.succeeded)
  const first = results[0]
  if (first.operation.action === 'lights-on' || first.operation.action === 'rooms-on') {
    const active = results.flatMap((result) => {
      const onStates = result.states.filter((state) => state.state === 'on')
      const names = onStates.map((state) =>
        result.operation.room.lights.find((light) => light.entityId === state.entity_id)?.name ?? state.entity_id)
      return names.length ? [{
        roomId: result.operation.room.id,
        room: result.operation.room.name,
        names,
        entityIds: onStates.map((state) => state.entity_id),
      }] : []
    })
    const uncertainRooms = results.filter((result) =>
      !result.states.some((state) => state.state === 'on')
      && result.states.some((state) => !readableState(state))).map((result) => result.operation.room.name)
    const activeRoomNames = active.map((room) => room.room)
    return responseWithContext({
      status: 'answer',
      text: roomOverviewText(activeRoomNames, uncertainRooms),
      controls: [],
      context: {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        ...(active.length ? {
          roomIds: active.map((room) => room.roomId),
        } : {}),
        lastAction: first.operation.action,
      },
      data: {
        rooms: active,
        uncertainRooms,
        ...(first.operation.action === 'lights-on' ? { lights: active } : {}),
      },
    })
  }
  if (first.operation.action === 'state') {
    const summaries = results.map((result) => {
      const on = result.states.filter((state) => state.state === 'on').length
      const available = result.states.filter(readableState).length
      return {
        operation: result.operation,
        room: result.operation.room.name,
        lightNames: result.operation.lightNames,
        fixtureStates: result.operation.lightNames.map((name, index) => {
          const state = result.states.find((candidate) => candidate.entity_id === result.operation.entityIds[index])
          const fixtureState: 'on' | 'off' | 'unavailable' =
            state && readableState(state) && (state.state === 'on' || state.state === 'off')
              ? state.state
              : 'unavailable'
          return {
            name,
            state: fixtureState,
          }
        }),
        state: available < result.states.length ? 'unavailable' as const : on === 0 ? 'off' as const : on === available ? 'on' as const : 'mixed' as const,
      }
    })
    const single = summaries[0]
    const text = summaries.length === 1
      ? single.lightNames.length && (single.state === 'mixed' || single.state === 'unavailable')
        ? roomStateText([single])
        : single.state === 'unavailable' ? unavailableText(single.room)
        : single.state === 'mixed' ? `Some ${single.room} lights are on and some are off.`
          : (() => {
              const subject = single.operation.lightNames.length
                ? `${formatNames(single.operation.lightNames)} in the ${single.room}`
                : `${single.room} lights`
              const verb = single.operation.lightNames.length === 1 ? 'is' : 'are'
              const expected = single.operation.targetState ?? 'on'
              return `${single.state === expected ? 'Yes' : 'No'}, the ${subject} ${verb} ${single.state}.`
            })()
      : roomStateText(summaries)
    const context = summaries.length === 1
      ? { ...plan.context!, lastAction: 'state' as const, lastState: summaries[0].state }
      : (() => {
          const targetStates = new Set(summaries.map((summary) => summary.operation.targetState).filter(Boolean))
          const observedState = summaries.some((summary) => summary.state === 'unavailable')
            ? 'unavailable' as const
            : summaries.every((summary) => summary.state === 'on')
              ? 'on' as const
              : summaries.every((summary) => summary.state === 'off')
                ? 'off' as const
                : 'mixed' as const
          const allFixtureScoped = summaries.every((summary) => summary.lightNames.length)
          return {
            domain: 'lights' as const,
            roomId: null,
            entityIds: [],
            lightNames: [],
            roomIds: summaries.map((summary) => summary.operation.room.id),
            ...(allFixtureScoped ? {
              roomLightNames: Object.fromEntries(summaries
                .map((summary) => [summary.operation.room.id, summary.lightNames])),
            } : {}),
            lastAction: 'state' as const,
            lastState: observedState,
            ...(targetStates.size === 1 ? { targetState: [...targetStates][0] as 'on' | 'off' } : {}),
          }
        })()
    return responseWithContext({ status: 'answer', text, controls: [], context, data: { states: results.map((result) => result.states) } })
  }
  if (first.operation.action === 'count' || first.operation.action === 'list') {
    if (first.operation.action === 'list' && plan.data?.queryMode === 'lights-on-detail') {
      const summaries = results.map((result, index) => {
        const available = result.states.filter(readableState)
        const onStates = available.filter((state) => state.state === 'on')
        const names = onStates.map((state) =>
          result.operation.room.lights.find((light) => light.entityId === state.entity_id)?.name ?? state.entity_id)
        const unavailableCount = result.states.length - available.length
        const heading = results.length > 1 && index === results.length - 1 ? 'And these' : 'These'
        const base = names.length
          ? `${heading} lights are on in the ${result.operation.room.name}:\n${names.map((name) => `• ${name}`).join('\n')}`
          : unavailableCount
            ? `I could not fully check the ${result.operation.room.name} lights.`
            : `No ${result.operation.room.name} lights are on.`
        const text = names.length && unavailableCount
          ? `${base}\nI could not read ${unavailableCount} other ${unavailableCount === 1 ? 'light' : 'lights'} in the ${result.operation.room.name}. This list may be incomplete.`
          : base
        return {
          roomId: result.operation.room.id,
          room: result.operation.room.name,
          names,
          entityIds: onStates.map((state) => state.entity_id),
          text,
          unavailableCount,
        }
      })
      const active = summaries.filter((summary) => summary.names.length)
      const context = {
        domain: 'lights' as const,
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: summaries.map((summary) => summary.roomId),
        ...(active.length ? {
          roomLightNames: Object.fromEntries(active.map((summary) => [summary.roomId, summary.names])),
        } : {}),
        lastAction: 'list' as const,
        lastState: active.length
          ? 'on' as const
          : summaries.some((summary) => summary.unavailableCount) ? 'unavailable' as const : 'off' as const,
      }
      return responseWithContext({
        status: 'answer',
        text: `${summaries.map((summary) => summary.text).join('\n\n')}${active.length ? `\n\n${roomDetailFollowUpText(active.every((summary) =>
          HOUSE_LIGHT_ROOMS.find((room) => room.id === summary.roomId)?.color !== 'none'))}` : ''}`,
        controls: [],
        context,
        data: { queryMode: 'lights-on-detail', rooms: summaries },
      })
    }
    if (first.operation.action === 'list' && results.length > 1) {
      const summaries = results.map((result) => {
        const available = result.states.filter(readableState)
        if (!available.length) return {
          roomId: result.operation.room.id,
          room: result.operation.room.name,
          names: [] as string[],
          text: unavailableText(result.operation.room.name),
          unavailableCount: result.states.length,
        }
        const onStates = available.filter((state) => state.state === 'on')
        const names = onStates.map((state) =>
          result.operation.room.lights.find((light) => light.entityId === state.entity_id)?.name ?? state.entity_id)
        const unavailableCount = result.states.length - available.length
        const base = names.length
          ? `${formatNames(names)} ${names.length === 1 ? 'is' : 'are'} on in the ${result.operation.room.name}.`
          : result.operation.lightNames.length
            ? unavailableCount
              ? `No readable selected lights in the ${result.operation.room.name} are on.`
              : result.operation.lightNames.length === 1
                ? `The ${result.operation.lightNames[0]} in the ${result.operation.room.name} is off.`
                : `${formatNames(result.operation.lightNames)} in the ${result.operation.room.name} are off.`
            : unavailableCount
              ? `No readable ${result.operation.room.name} lights are on.`
              : `No ${result.operation.room.name} lights are on.`
        return {
          roomId: result.operation.room.id,
          room: result.operation.room.name,
          names,
          text: unavailableCount
            ? `${base} I could not read ${unavailableCount} other ${unavailableCount === 1 ? 'light' : 'lights'}.`
            : base,
          unavailableCount,
        }
      })
      const allFixtureScoped = results.every((result) => result.operation.lightNames.length)
      const totalAvailable = results.reduce((total, result) => total + result.states.filter(readableState).length, 0)
      const totalOn = summaries.reduce((total, summary) => total + summary.names.length, 0)
      return responseWithContext({
        status: 'answer',
        text: summaries.map((summary) => summary.text).join(' '),
        controls: [],
        context: {
          domain: 'lights',
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: summaries.map((summary) => summary.roomId),
          ...(allFixtureScoped ? {
            roomLightNames: Object.fromEntries(results.map((result) => [
              result.operation.room.id,
              result.operation.lightNames,
            ])),
          } : {}),
          lastAction: 'list',
          lastState: summaries.some((summary) => summary.unavailableCount)
            ? 'unavailable'
            : totalOn === 0 ? 'off' : totalOn === totalAvailable ? 'on' : 'mixed',
        },
        data: { rooms: summaries },
      })
    }
    const available = first.states.filter(readableState)
    if (!available.length) {
      const selectedSubject = first.operation.lightNames.length
        ? `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name}`
        : `${first.operation.room.name} lights`
      const context = first.operation.action === 'list'
        ? {
            domain: 'lights' as const,
            roomId: null,
            entityIds: [],
            lightNames: [],
            roomIds: [first.operation.room.id],
            ...(first.operation.lightNames.length ? {
              roomLightNames: { [first.operation.room.id]: first.operation.lightNames },
            } : {}),
            lastAction: 'list' as const,
            lastState: 'unavailable' as const,
          }
        : { ...plan.context!, lastAction: first.operation.action, lastState: 'unavailable' as const }
      return responseWithContext({ status: 'answer', text: `I could not read the ${selectedSubject} from Home Assistant.`, controls: [], context, data: { states: first.states } })
    }
    const onStates = available.filter((state) => state.state === 'on')
    const names = onStates.map((state) => first.operation.room.lights.find((light) => light.entityId === state.entity_id)?.name ?? state.entity_id)
    const unavailableCount = first.states.length - available.length
    const listText = names.length
      ? `${formatNames(names)} ${names.length === 1 ? 'is' : 'are'} on in the ${first.operation.room.name}.`
      : first.operation.lightNames.length
        ? unavailableCount
          ? `No readable selected lights in the ${first.operation.room.name} are on.`
          : first.operation.lightNames.length === 1
            ? `The ${first.operation.lightNames[0]} in the ${first.operation.room.name} is off.`
            : `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name} are off.`
        : unavailableCount
          ? `No readable ${first.operation.room.name} lights are on.`
          : `No ${first.operation.room.name} lights are on.`
    const text = first.operation.action === 'count'
      ? `${onStates.length} of ${available.length} ${first.operation.lightNames.length ? `selected ${first.operation.room.name}` : first.operation.room.name} lights ${onStates.length === 1 ? 'is' : 'are'} on.`
      : listText
    const completeText = unavailableCount ? `${text} I could not read ${unavailableCount} other ${unavailableCount === 1 ? 'light' : 'lights'}.` : text
    const lastState = unavailableCount ? 'unavailable' as const : onStates.length === 0 ? 'off' as const : onStates.length === available.length ? 'on' as const : 'mixed' as const
    const retainedState = first.operation.action === 'list' && !first.operation.lightNames.length && names.length
      ? 'on' as const
      : lastState
    const context = first.operation.action === 'list'
      ? {
          domain: 'lights' as const,
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: [first.operation.room.id],
          ...((first.operation.lightNames.length || names.length) ? {
            roomLightNames: {
              [first.operation.room.id]: first.operation.lightNames.length ? first.operation.lightNames : names,
            },
          } : {}),
          lastAction: 'list' as const,
          lastState: retainedState,
        }
      : { ...plan.context!, lastAction: first.operation.action, lastState: retainedState }
    return responseWithContext({ status: 'answer', text: completeText, controls: [], context, data: { states: first.states, on: names } })
  }
  if (first.operation.action === 'brightness-state') {
    const states = first.states.filter((state) => brightnessFromState(state) !== null)
    const descriptions = states.map((state) => {
      const name = first.operation.room.lights.find((light) => light.entityId === state.entity_id)?.name ?? state.entity_id
      const brightness = brightnessFromState(state)!
      return `${name} is at ${brightness}%`
    })
    const subject = first.operation.lightNames.length
      ? `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name}`
      : `${first.operation.room.name} lights`
    const text = descriptions.length ? `${descriptions.join('; ')}.` : `I could not read the brightness of the ${subject}.`
    return responseWithContext({ status: 'answer', text, controls: [], context: { ...plan.context!, lastAction: 'brightness-state' }, data: { states: first.states } })
  }
  if (first.operation.action === 'color-state') {
    const available = first.states.filter(readableState)
    const subject = first.operation.lightNames.length
      ? `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name}`
      : `${first.operation.room.name} lights`
    if (!available.length) {
      return responseWithContext({ status: 'answer', text: `I could not read the colors of the ${subject}.`, controls: [], context: { ...plan.context!, lastAction: 'color-state', lastState: 'unavailable' }, data: { states: first.states } })
    }
    const onStates = first.states.filter((state) => state.state === 'on')
    const describe = (state: HassState) => {
      const light = first.operation.room.lights.find((candidate) => candidate.entityId === state.entity_id)?.name ?? state.entity_id
      const rgb = state.attributes?.rgb_color
      const kelvin = state.attributes?.color_temp_kelvin
      const color = Array.isArray(rgb) && rgb.length === 3 ? `rgb(${rgb.join(', ')})` : typeof kelvin === 'number' ? `${kelvin}K white` : 'its current white setting'
      return `${light} is ${color}`
    }
    const unavailableCount = first.states.length - available.length
    const text = !onStates.length
      ? unavailableCount
        ? `The available ${subject} ${first.operation.lightNames.length === 1 ? 'is' : 'are'} off.`
        : `The ${subject} ${first.operation.lightNames.length === 1 ? 'is' : 'are'} off.`
      : `${onStates.map(describe).join('; ')}.`
    const completeText = unavailableCount ? `${text} I could not read ${unavailableCount} other ${unavailableCount === 1 ? 'light' : 'lights'}.` : text
    return responseWithContext({ status: 'answer', text: completeText, controls: [], context: { ...plan.context!, lastAction: 'color-state' }, data: { states: first.states } })
  }
  if (first.operation.action === 'pbl' || first.operation.action === 'pbl-rules') {
    if (first.unsupported) return responseWithContext({ status: 'unsupported', text: `Presence-Based Lighting is not configured for the ${first.operation.room.name}.`, controls: [], context: plan.context })
    if (!first.states[0] || !readableState(first.states[0])) {
      return responseWithContext({ status: 'answer', text: unavailableText(first.operation.room.name, 'Presence-Based Lighting state'), controls: [], context: { ...plan.context!, lastAction: first.operation.action, lastState: 'unavailable' }, data: { state: first.states[0] } })
    }
    if (first.operation.action === 'pbl-rules') {
      const text = `I can tell whether Presence-Based Lighting is allowed in the ${first.operation.room.name}, but its detailed room rules are not exposed to Home MCP yet.`
      return responseWithContext({ status: 'answer', text, controls: [], context: { ...plan.context!, lastAction: 'pbl-rules' }, data: { state: first.states[0], ruleDetailsAvailable: false } })
    }
    const active = first.states[0]?.state === 'on'
    const text = `Presence-Based Lighting is ${active ? 'active' : 'inactive'} in the ${first.operation.room.name}.`
    return responseWithContext({ status: 'answer', text, controls: [], context: { ...plan.context!, lastAction: 'pbl', lastState: active ? 'on' : 'off' }, data: { state: first.states[0] } })
  }
  if (first.operation.action === 'history') {
    const groups = Array.isArray(first.history) ? first.history as Array<Array<{ entity_id?: string; state?: string; last_changed?: string }>> : []
    const desiredState = first.operation.targetState ?? 'off'
    const targets = operationTargets(first.operation)
    const events = targets.map((entityId, index) => {
      const group = groups.find((candidate) => candidate.some((state) => state.entity_id === entityId))
        ?? (groups.length === targets.length ? groups[index] : targets.length === 1 ? groups[0] : [])
      const latest = group.filter((state) => state.state === desiredState && state.last_changed)
        .sort((a, b) => String(b.last_changed).localeCompare(String(a.last_changed)))[0]
      const name = first.operation.room.lights.find((light) => light.entityId === entityId)?.name
        ?? first.operation.lightNames[index] ?? entityId
      return { name, lastChanged: latest?.last_changed }
    })
    const subject = first.operation.lightNames.length
      ? `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name}`
      : `${first.operation.room.name} lights`
    const text = events.length === 1
      ? events[0].lastChanged
        ? `The ${subject} last turned ${desiredState} at ${new Date(events[0].lastChanged).toLocaleString('en-US')}.`
        : `I couldn’t find a ${desiredState} event for the ${subject} in that history window.`
      : `The selected ${first.operation.room.name} lights last turned ${desiredState} at:\n${events.map((event) =>
          `• ${event.name}: ${event.lastChanged ? new Date(event.lastChanged).toLocaleString('en-US') : `no ${desiredState} event found`}`).join('\n')}`
    const historyContext = { ...plan.context! }
    delete historyContext.historyBefore
    return responseWithContext({
      status: 'answer',
      text,
      controls: [],
      context: {
        ...historyContext,
        lastAction: 'history',
        targetState: desiredState,
        ...(events.length === 1 && events[0].lastChanged ? { historyBefore: events[0].lastChanged } : {}),
      },
      data: { history: first.history },
    })
  }
  if (first.operation.action === 'reason') {
    const desiredState = first.operation.targetState ?? 'on'
    const entries = Array.isArray(first.logbook) ? first.logbook as Array<Record<string, unknown>> : []
    const targets = operationTargets(first.operation)
    const logbookTime = (entry: Record<string, unknown>) => typeof entry.when === 'number'
      ? entry.when
      : typeof entry.when === 'string' && !Number.isNaN(Date.parse(entry.when))
        ? Date.parse(entry.when)
        : 0
    const logbookSource = (entry: Record<string, unknown>) => typeof entry.context_name === 'string'
      ? entry.context_name
      : typeof entry.context_domain === 'string' && typeof entry.context_service === 'string'
        ? `${entry.context_domain}.${entry.context_service}`
        : typeof entry.context_user_id === 'string'
          ? 'a Home Assistant user'
          : typeof entry.context_entity_id === 'string'
            ? entry.context_entity_id.startsWith('automation.')
              ? 'a Home Assistant automation'
              : entry.context_entity_id.startsWith('script.')
                ? 'a Home Assistant script'
                : 'another Home Assistant entity'
            : null
    const evidence = targets.map((entityId, index) => {
      const matching = entries
        .filter((entry) =>
          (targets.length === 1 || entry.entity_id === entityId)
          && (entry.state === desiredState || String(entry.message ?? '').toLowerCase().includes(`turned ${desiredState}`)))
        .map((entry) => ({ entry, source: logbookSource(entry) }))
        .filter((candidate): candidate is { entry: Record<string, unknown>; source: string } => candidate.source !== null)
        .sort((left, right) => logbookTime(right.entry) - logbookTime(left.entry))[0]
      const name = first.operation.room.lights.find((light) => light.entityId === entityId)?.name
        ?? first.operation.lightNames[index] ?? entityId
      return { name, source: matching?.source ?? null }
    })
    const subject = first.operation.lightNames.length
      ? `${formatNames(first.operation.lightNames)} in the ${first.operation.room.name}`
      : `${first.operation.room.name} lights`
    if (first.logbookUnavailable) {
      const text = `I could read the ${subject} history, but I could not check Home Assistant’s cause records.`
      return responseWithContext({
        status: 'answer',
        text,
        controls: [],
        context: { ...plan.context!, lastAction: 'reason', lastState: desiredState, targetState: desiredState },
        data: { history: first.history, logbookAvailable: false, causalClaim: false },
      })
    }
    const text = evidence.length === 1
      ? evidence[0].source
        ? `A Home Assistant record links the ${subject} turning ${desiredState} to ${evidence[0].source}.`
        : `I can see the ${subject} history, but Home Assistant did not record a reliable cause for turning ${desiredState}.`
      : `Home Assistant records for the selected ${first.operation.room.name} lights:\n${evidence.map((item) =>
          `• ${item.name}: ${item.source ?? 'no reliable cause recorded'}`).join('\n')}`
    return responseWithContext({ status: 'answer', text, controls: [], context: { ...plan.context!, lastAction: 'reason', lastState: desiredState, targetState: desiredState }, data: { history: first.history, logbook: first.logbook, causalClaim: false } })
  }
  if (!successes.length) {
    const text = 'I was unable to complete the requested light changes. Would you like me to try again?'
    const context = plan.context ? { ...plan.context } : null
    if (context) delete context.lastState
    return responseWithContext({ status: 'failed', text, controls: retryControls(results), context, data: { failures } })
  }
  if (failures.length) {
    const text = 'Some requested light changes completed, but others did not. Would you like me to try again?'
    const context = plan.context ? { ...plan.context } : null
    if (context) delete context.lastState
    return responseWithContext({ status: 'partial', text, controls: retryControls(results), context, data: { successes, failures } })
  }
  const text = results.map((result) => operationSuccessText(result.operation, result.resultingBrightness)).join(' ')
  const lastResult = results.at(-1)!
  const last = lastResult.operation
  const brightnessValues = lastResult.resultingBrightness?.length
    ? lastResult.resultingBrightness
    : Array.isArray(last.brightnessPct) ? last.brightnessPct : [last.brightnessPct]
  const brightness = new Set(brightnessValues).size === 1 ? brightnessValues[0] : null
  const controls = brightness !== null && brightness !== undefined
    ? [{
        id: `brightness-${last.room.id}-${Date.now()}`,
        kind: 'brightness-slider' as const,
        room: last.room.name,
        value: brightness,
        min: 0 as const,
        max: 100 as const,
        step: 1 as const,
        ...(last.lightNames.length ? { subject: `${formatNames(last.lightNames)} in the ${last.room.name}` } : {}),
      }]
    : []
  const context = plan.context ? { ...plan.context } : null
  if (context) {
    delete context.lastState
    const multiContext = context.roomId === null && Boolean(context.roomIds?.length)
    const completedStates = new Set(results.map((result) => result.operation.action))
    if (multiContext && completedStates.size === 1 && [...completedStates].every((action) => action === 'on' || action === 'off')) {
      context.lastState = [...completedStates][0] as 'on' | 'off'
    } else if (!multiContext && (last.action === 'on' || last.action === 'off')) {
      context.lastState = last.action
    }
  }
  return responseWithContext({ status: 'success', text, controls, context, data: { successes } })
}

function assistantText(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const response = value as Record<string, unknown>
  if (typeof response.text === 'string') return response.text
  if (!response.response || typeof response.response !== 'object' || Array.isArray(response.response)) return null
  const native = response.response as Record<string, unknown>
  if (!native.speech || typeof native.speech !== 'object' || Array.isArray(native.speech)) return null
  const speech = native.speech as Record<string, unknown>
  if (!speech.plain || typeof speech.plain !== 'object' || Array.isArray(speech.plain)) return null
  const plain = speech.plain as Record<string, unknown>
  return typeof plain.speech === 'string' ? plain.speech : null
}

function turnOutcome(value: unknown): ImprovementConversationTurn['outcome'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'empty'
  const response = value as Record<string, unknown>
  if (response.status === 'failed' || response.status === 'partial') return 'failed'
  if (response.response && typeof response.response === 'object' && !Array.isArray(response.response)
    && (response.response as Record<string, unknown>).response_type === 'error') return 'error'
  return assistantText(value) ? 'answer' : 'empty'
}

async function callTool(
  fetchImpl: typeof fetch,
  hassUrl: string,
  token: string,
  agentId: string | undefined,
  name: unknown,
  args: ToolArguments,
  improvementStore: ConversationImprovementStore,
  chatModel: string,
  user: AuthenticatedHassUser,
) {
  const userScope = user.id
  if (name === 'home_chat') {
    if (typeof args.text !== 'string' || !args.text.trim()) throw new Error('home_chat requires non-empty text')
    if (args.text.length > HOME_CHAT_USER_LIMIT) throw new Error(`home_chat text must be at most ${HOME_CHAT_USER_LIMIT} characters`)
    if (args.conversation_id !== undefined && args.conversation_id !== null && typeof args.conversation_id !== 'string') {
      throw new Error('home_chat conversation_id must be a string or null')
    }
    if (args.thread_id !== undefined && !isIdentifier(args.thread_id)) throw new Error('home_chat thread_id must be a valid identifier')
    if (args.turn_id !== undefined && !isIdentifier(args.turn_id)) throw new Error('home_chat turn_id must be a valid identifier')
    if (args.control_id !== undefined && !isIdentifier(args.control_id)) throw new Error('home_chat control_id must be a valid identifier')
    let activity: Awaited<ReturnType<ConversationImprovementStore['beginConversationActivity']>> | null = null
    if (args.thread_id) {
      try {
        activity = await improvementStore.beginConversationActivity(userScope, args.thread_id)
      } catch (error) {
        console.error('Home MCP could not initialize conversation improvement recording:', error instanceof Error ? error.message : error)
      }
    }
    try {
      const context = canonicalizeLightContext(args.context)
      const invalidContext = args.context !== undefined && args.context !== null && !context
      const lightPlan = invalidContext ? null : parseLightUtterance(args.text, context)
      let result: unknown
      let handledByHomeMcp = false
      if (invalidContext) {
        const text = 'The earlier light context is no longer valid. Name the light or room again.'
        result = responseWithContext({ status: 'unsupported', text, controls: [], context: null })
        handledByHomeMcp = true
      } else if (lightPlan) {
        const prepared = lightPlan.status === 'clarify' ? await enrichColorPicker(fetchImpl, hassUrl, token, lightPlan) : lightPlan
        const executed = await executeLightPlan(fetchImpl, hassUrl, token, prepared)
        result = { ...executed, conversation_id: args.conversation_id ?? `home-mcp-lights:${args.thread_id ?? randomUUID()}` }
        handledByHomeMcp = true
      } else if (args.control_id) {
        const text = 'That follow-up is not a supported light request.'
        result = responseWithContext({
          status: 'unsupported',
          text,
          controls: [],
          context,
        })
        handledByHomeMcp = true
      } else {
        const response = await hassRequest(fetchImpl, hassUrl, token, '/api/conversation/process', {
          method: 'POST',
          body: JSON.stringify({
            text: args.text,
            ...(agentId ? { agent_id: agentId } : {}),
            ...(args.conversation_id ? { conversation_id: args.conversation_id } : {}),
          }),
        })
        result = context && response && typeof response === 'object'
          ? {
              ...(response as Record<string, unknown>),
              context: context.lastAction === 'lights-on' || context.lastAction === 'rooms-on'
                ? (() => {
                    const next = { ...context }
                    delete next.lastAction
                    return next
                  })()
                : context,
            }
          : response
      }
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        result = { ...(result as Record<string, unknown>), handled_by_home_mcp: handledByHomeMcp }
      }
      if (activity) {
        const resultContext = result && typeof result === 'object' && !Array.isArray(result)
          ? canonicalizeLightContext((result as Record<string, unknown>).context) ?? context
          : context
        await activity.recordTurn({
          id: args.turn_id ?? `turn-${Date.now()}`,
          createdAt: Date.now(),
          userText: args.text,
          assistantText: assistantText(result),
          outcome: turnOutcome(result),
          parsedAsLights: Boolean(lightPlan) || invalidContext,
          handledByHomeMcp,
          contextBefore: context,
          contextAfter: resultContext,
        }).catch((error) => {
          console.error('Home MCP could not record the conversation improvement turn:', error instanceof Error ? error.message : error)
        })
      }
      return result
    } finally {
      activity?.release()
    }
  }

  if (name === 'home_chat_end') {
    if (!isIdentifier(args.thread_id)) throw new Error('home_chat_end requires a valid thread_id')
    return improvementStore.queueConversation(userScope, args.thread_id, 'runtime')
  }

  if (name === 'home_chat_review') {
    if (!user.isAdmin) throw new Error('home_chat_review requires a Home Assistant administrator')
    if (!args.conversation || typeof args.conversation !== 'object' || Array.isArray(args.conversation)) {
      throw new Error('home_chat_review requires a conversation object')
    }
    return improvementStore.reviewConversation(args.conversation, userScope)
  }

  if (name === 'home_info') {
    return improvementStore.info(chatModel)
  }

  if (name === 'home_state') {
    const ids = entityIds(args.entity_ids, MAX_STATE_ENTITIES)
    if (!ids) throw new Error(`home_state requires 1-${MAX_STATE_ENTITIES} valid entity_ids`)
    return Promise.all(ids.map((id) => hassRequest(fetchImpl, hassUrl, token, `/api/states/${encodeURIComponent(id)}`)))
  }

  if (name === 'home_history') {
    const ids = entityIds(args.entity_ids, MAX_HISTORY_ENTITIES)
    if (!ids) throw new Error(`home_history requires 1-${MAX_HISTORY_ENTITIES} valid entity_ids`)
    const hours = args.hours === undefined ? 24 : Number(args.hours)
    if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HISTORY_HOURS) {
      throw new Error(`home_history hours must be between 0 and ${MAX_HISTORY_HOURS}`)
    }
    const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const query = new URLSearchParams({
      filter_entity_id: ids.join(','),
      minimal_response: '',
      no_attributes: '',
    })
    return hassRequest(fetchImpl, hassUrl, token, `/api/history/period/${encodeURIComponent(start)}?${query}`)
  }

  if (name === 'home_lights') {
    const plan = buildLightPlan(args)
    return executeLightPlan(fetchImpl, hassUrl, token, plan)
  }

  throw new Error('Unknown Home MCP tool')
}

const schemaRequires = (field: string) => ({ required: [field] })
const schemaForbids = (fields: string[]) => ({ not: { anyOf: fields.map(schemaRequires) } })
const LIGHT_OPERATION_CONSTRAINTS = [
  {
    if: { properties: { action: { enum: ['on', 'off'] } }, required: ['action'] },
    then: schemaForbids(['brightness_pct', 'color_name', 'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state']),
  },
  {
    if: { properties: { action: { const: 'set' } }, required: ['action'] },
    then: { required: ['brightness_pct'], ...schemaForbids(['color_name', 'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state']) },
  },
  {
    if: { properties: { action: { enum: ['up', 'down'] } }, required: ['action'] },
    then: schemaForbids(['color_name', 'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state']),
  },
  {
    if: { properties: { action: { const: 'color' } }, required: ['action'] },
    then: {
      ...schemaForbids(['brightness_pct', 'history_before', 'target_state']),
      allOf: [
        { not: { required: ['color_name', 'rgb_color'] } },
        { not: { required: ['color_name', 'color_temperature_kelvin'] } },
        { not: { required: ['rgb_color', 'color_temperature_kelvin'] } },
      ],
    },
  },
  {
    if: { properties: { action: { enum: ['count', 'list', 'color-state', 'brightness-state'] } }, required: ['action'] },
    then: schemaForbids(['brightness_pct', 'color_name', 'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state']),
  },
  {
    if: { properties: { action: { const: 'state' } }, required: ['action'] },
    then: schemaForbids(['brightness_pct', 'color_name', 'rgb_color', 'color_temperature_kelvin', 'history_before']),
  },
  {
    if: { properties: { action: { enum: ['history', 'reason'] } }, required: ['action'] },
    then: schemaForbids(['brightness_pct', 'color_name', 'rgb_color', 'color_temperature_kelvin']),
  },
  {
    if: { properties: { action: { enum: ['pbl', 'pbl-rules', 'rooms-on', 'lights-on'] } }, required: ['action'] },
    then: schemaForbids([
      'entity_ids', 'light_names', 'brightness_pct', 'color_name', 'rgb_color',
      'color_temperature_kelvin', 'history_before', 'target_state',
    ]),
  },
]

const tools = [
  {
    name: 'home_chat',
    description: 'Ask the household Home Assistant conversation agent to query or control the home.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1, maxLength: HOME_CHAT_USER_LIMIT },
        conversation_id: { type: ['string', 'null'] },
        context: { type: ['object', 'null'] },
        thread_id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,100}$' },
        turn_id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,100}$' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'home_chat_end',
    description: 'Mark a completed dashboard chat for queued supported-tool improvement review.',
    inputSchema: {
      type: 'object',
      properties: { thread_id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,100}$' } },
      required: ['thread_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'home_chat_review',
    description: 'Queue a retained dashboard chat for supported-tool improvement review.',
    inputSchema: {
      type: 'object',
      properties: { conversation: { type: 'object' } },
      required: ['conversation'],
      additionalProperties: false,
    },
  },
  {
    name: 'home_info',
    description: 'Read the configured chat model, Home MCP version, improvement queue state, and recent published improvements.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'home_state',
    description: 'Read the current Home Assistant state for a bounded list of entities.',
    inputSchema: {
      type: 'object',
      properties: { entity_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_STATE_ENTITIES } },
      required: ['entity_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'home_history',
    description: 'Read recorder history for a bounded list of entities over the previous number of hours.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_HISTORY_ENTITIES },
        hours: { type: 'number', exclusiveMinimum: 0, maximum: MAX_HISTORY_HOURS, default: 24 },
      },
      required: ['entity_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'home_lights',
    description: 'Control or inspect household lights by room and named fixture, including compound operations, brightness, supported colors, whole-home reads, history, cause evidence, and Presence-Based Lighting status. Whole-home reads cover every configured room exactly once.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on', 'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules'] },
        room: { type: 'string' },
        entity_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
        light_names: { type: 'array', items: { type: 'string' }, minItems: 1 },
        brightness_pct: { oneOf: [{ type: 'number', minimum: 0, maximum: 100 }, { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, minItems: 1 }] },
        color_name: { type: 'string' },
        rgb_color: { type: 'array', items: { type: 'number', minimum: 0, maximum: 255 }, minItems: 3, maxItems: 3 },
        color_temperature_kelvin: { type: 'number', minimum: 2000, maximum: 6500 },
        history_before: { type: 'string' },
        target_state: { type: 'string', enum: ['on', 'off'] },
        operations: {
          type: 'array', minItems: 1, maxItems: Math.max(12, HOUSE_LIGHT_ROOMS.length),
          items: { type: 'object', additionalProperties: false, properties: {
            action: { type: 'string', enum: ['on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on', 'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules'] },
            room: { type: 'string' }, entity_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
            light_names: { type: 'array', items: { type: 'string' }, minItems: 1 },
            brightness_pct: { oneOf: [{ type: 'number', minimum: 0, maximum: 100 }, { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, minItems: 1 }] },
            color_name: { type: 'string' }, rgb_color: { type: 'array', items: { type: 'number', minimum: 0, maximum: 255 }, minItems: 3, maxItems: 3 },
            color_temperature_kelvin: { type: 'number', minimum: 2000, maximum: 6500 }, history_before: { type: 'string' }, target_state: { type: 'string', enum: ['on', 'off'] },
          }, required: ['action', 'room'], allOf: LIGHT_OPERATION_CONSTRAINTS },
        },
      },
      allOf: LIGHT_OPERATION_CONSTRAINTS,
      oneOf: [
        {
          required: ['operations'],
          not: {
            anyOf: [
              'action', 'room', 'entity_ids', 'light_names', 'brightness_pct', 'color_name',
              'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state',
            ].map((property) => ({ required: [property] })),
          },
        },
        { required: ['action'], not: { required: ['operations'] } },
      ],
      additionalProperties: false,
    },
  },
]

async function handleRpc(
  request: JsonRpcRequest,
  fetchImpl: typeof fetch,
  hassUrl: string,
  token: string,
  agentId: string | undefined,
  improvementStore: ConversationImprovementStore,
  chatModel: string,
  user: AuthenticatedHassUser,
) {
  const id = request.id ?? null
  if (request.method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'sfenton-home-mcp', version: metadata.serverVersion }, capabilities: { tools: {} } } }
  }
  if (request.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools } }
  if (request.method !== 'tools/call') return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }

  const args = request.params?.arguments
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Tool arguments must be an object' } }
  }
  try {
    const result = await callTool(fetchImpl, hassUrl, token, agentId, request.params?.name, args as ToolArguments, improvementStore, chatModel, user)
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } }
  } catch (error) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: error instanceof Error ? error.message : 'Home MCP tool failed' } }
  }
}

export function createHomeMcpServer(options: HomeMcpOptions): Server {
  const hassUrl = options.hassUrl.replace(/\/$/, '')
  const allowedOrigins = new Set(options.allowedOrigins ?? [])
  const fetchImpl = options.fetchImpl ?? fetch
  const improvementStore = options.improvementStore ?? new ConversationImprovementStore({ enabled: false })
  const chatModel = options.chatModel ?? 'Gemini 3.1 Flash Lite'
  const authenticateUser = options.authenticateUser ?? createHassUserAuthenticator({ hassUrl })

  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    const origin = corsOrigin(request, allowedOrigins)
    if (origin === undefined) return send(response, 403, { error: 'origin-not-allowed' })

    if (request.method === 'OPTIONS' && request.url === '/mcp') {
      if (!origin) return send(response, 403, { error: 'origin-required' })
      response.writeHead(204, {
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-origin': origin,
        'access-control-max-age': '600',
        vary: 'Origin',
      })
      return response.end()
    }
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, name: 'sfenton-home-mcp', version: metadata.serverVersion, tools: tools.map((tool) => tool.name) }, origin)
    }
    if (request.method !== 'POST' || request.url !== '/mcp') return send(response, 404, { error: 'not-found' }, origin)

    const token = bearerToken(request)
    if (!token) return send(response, 401, { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Home Assistant authorization is required' } }, origin)

    try {
      const user = await authenticateUser(token)
      const rpc = await readBody(request)
      send(response, 200, await handleRpc(rpc, fetchImpl, hassUrl, token, options.agentId, improvementStore, chatModel, user), origin)
    } catch (error) {
      if (error instanceof HassAuthenticationError) {
        const status = error.kind === 'invalid' ? 401 : 502
        return send(response, status, { jsonrpc: '2.0', id: null, error: { code: -32001, message: error.message } }, origin)
      }
      send(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: error instanceof Error ? error.message : 'Invalid request' } }, origin)
    }
  }
  return options.tls
    ? createHttpsServer(options.tls, handler)
    : createServer(handler)
}
