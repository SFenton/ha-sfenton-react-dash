#!/usr/bin/env tsx
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import {
  AUTONOMOUS_ADMIN_CONTEXT_TIER,
  AUTONOMOUS_ADMIN_MODEL,
  AUTONOMOUS_ADMIN_REASONING_EFFORT,
  AUTONOMOUS_ADMIN_SKILL,
  auditAutonomousAdminRoadmap,
  exactAutonomousAdminTaskTransition,
  isAutonomousAdminTerminalStatus,
  transitionAutonomousAdminTask,
  validateAutonomousAdminTodoCoverage,
  type AutonomousAdminRoadmapAudit,
  type AutonomousAdminTask,
} from './lib/autonomousAdminRoadmap'
import { sendAgentReportEmail } from './lib/agentReportEmail'
import { buildCopilotChildEnvironment } from './lib/copilotEnvironment'
import { getEmailSendReadiness } from './lib/email'
import { adminCompletionBoundarySatisfied, HassAdminTodoClient } from './lib/hassAdminTodo'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'

interface PhaseRunState {
  email?: {
    claimedAt: string
    delivery?: 'sent'
    messageId?: string
    reportHash: string
    sentAt?: string
    subject: string
  }
  hass?: {
    alreadyCompleted: boolean
    completedAt: string
    notified: boolean
  }
  reportHash?: string
  reportPath?: string
  sessionName: string
  startedAt: string
}

interface AdminRunState {
  createdAt: string
  lastPlanHash: string
  phases: Record<string, PhaseRunState>
  roadmapPath: string
  runId: string
  updatedAt: string
  version: 1
}

interface RunLock {
  ownerPath: string
  path: string
  token: string
}

const args = parseArgs(process.argv.slice(2))
const repository = process.cwd()
const roadmapPath = resolve(repository, args.values.roadmap ?? 'docs/autonomous-admin-roadmap.md')
const statePath = resolve(repository, args.values.state ?? '.autonomous/admin-run-state.json')
const maxPhases = numberValue(args.values['max-phases'])
const runLock = await acquireRunLock(resolve(repository, '.autonomous/admin-run.lock'))
const releaseLock = () => releaseRunLock(runLock)
const stopForSignal = (code: number) => {
  releaseLock()
  process.exit(code)
}
const handleSigint = () => stopForSignal(130)
const handleSigterm = () => stopForSignal(143)
process.once('exit', releaseLock)
process.once('SIGINT', handleSigint)
process.once('SIGTERM', handleSigterm)

loadRuntimeEnvironment({ emailEnvPath: args.values['email-env'] })

const readiness = getEmailSendReadiness({}, { dryRun: false, enabled: true })
if (!readiness.readyToSend) {
  throw new Error(`Autonomous Admin email is not ready: ${readiness.missing.join(', ')}.`)
}

let audit = await readAudit(roadmapPath)
const client = new HassAdminTodoClient()
const items = await client.getItems(audit.profile!.todoEntityId)
const coverageErrors = validateAutonomousAdminTodoCoverage(
  audit,
  items.filter((item) => item.status === 'needs_action'),
)
if (coverageErrors.length > 0) {
  throw new Error(`HASS Admin todo coverage failed:\n- ${coverageErrors.join('\n- ')}`)
}

let state = await readOrCreateState(statePath, roadmapPath, audit.planHash)
let phasesExecuted = 0

while (maxPhases === undefined || phasesExecuted < maxPhases) {
  audit = await readAudit(roadmapPath)
  state.lastPlanHash = audit.planHash
  state.updatedAt = new Date().toISOString()
  await writeState(statePath, state)

  const unfinishedBoundary = audit.tasks.find((task) => {
    const phase = state.phases[task.id]
    if (!phase || !isAutonomousAdminTerminalStatus(task.status)) return false
    if (!phase.reportPath || !phase.email?.sentAt) return true
    return task.status === 'accepted' && !phase.hass?.completedAt
  })
  if (unfinishedBoundary) {
    const phase = state.phases[unfinishedBoundary.id]
    if (!phase.reportPath) {
      throw new Error(`Task ${unfinishedBoundary.id} is terminal but its phase report was not captured; resume its Copilot session before continuing.`)
    }
    state = await finalizePhaseBoundary(statePath, state, audit, unfinishedBoundary, client)
    continue
  }

  const task = audit.nextTask
  if (!task) break

  const phase = state.phases[task.id]
  const sessionName = phase?.sessionName ?? sessionNameFor(state.runId, task.id)
  if (!phase) {
    state.phases[task.id] = {
      sessionName,
      startedAt: new Date().toISOString(),
    }
    await writeState(statePath, state)
  }

  if (task.status === 'pending') {
    const markdown = await readFile(roadmapPath, 'utf8')
    await writeFile(
      roadmapPath,
      transitionAutonomousAdminTask(markdown, task.id, 'in_progress', audit.planHash),
      'utf8',
    )
    audit = await readAudit(roadmapPath)
  }

  const phaseRoadmapMarkdown = await readFile(roadmapPath, 'utf8')
  const phasePlanHash = audit.planHash
  const report = await runCopilotPhase({
    audit,
    repository,
    resume: task.status === 'in_progress' && Boolean(phase),
    roadmapPath,
    sessionName,
    task: audit.tasks.find((candidate) => candidate.id === task.id)!,
  })
  const completedRoadmapMarkdown = await readFile(roadmapPath, 'utf8')
  const terminalStatus = exactAutonomousAdminTaskTransition(
    phaseRoadmapMarkdown,
    completedRoadmapMarkdown,
    task.id,
    phasePlanHash,
  )
  audit = await readAudit(roadmapPath)
  const completedTask = audit.tasks.find((candidate) => candidate.id === task.id)
  if (!completedTask || completedTask.status !== terminalStatus) {
    throw new Error(`Copilot exited without the exact terminal decision recorded for ${task.id}.`)
  }

  const reportPath = resolve(repository, '.autonomous/reports', `${task.id}.md`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, report, 'utf8')

  state.phases[task.id] = {
    ...state.phases[task.id],
    reportHash: sha256(report),
    reportPath,
  }
  await writeState(statePath, state)

  state = await finalizePhaseBoundary(statePath, state, audit, completedTask, client)
  phasesExecuted += 1
}

audit = await readAudit(roadmapPath)
process.removeListener('exit', releaseLock)
process.removeListener('SIGINT', handleSigint)
process.removeListener('SIGTERM', handleSigterm)
releaseLock()
console.log(JSON.stringify({
  counts: audit.counts,
  nextTask: audit.nextTask?.id ?? null,
  phasesExecuted,
  planHash: audit.planHash,
  runId: state.runId,
}, null, 2))

async function finalizePhaseBoundary(
  path: string,
  currentState: AdminRunState,
  currentAudit: AutonomousAdminRoadmapAudit,
  task: AutonomousAdminTask,
  hassClient: HassAdminTodoClient,
) {
  const phase = currentState.phases[task.id]
  if (!phase?.reportPath || !phase.reportHash) throw new Error(`Missing report receipt for ${task.id}.`)

  if (phase.email?.claimedAt && !phase.email.sentAt) {
    throw new Error(`Email delivery for ${task.id} was claimed but not receipted; inspect before retrying to avoid a duplicate.`)
  }

  if (!phase.email?.sentAt) {
    const subject = `HASS Admin Autonomous Agent: Phase ${task.phase} - ${task.adminTask} · ${statusLabel(task.status)}`
    const markdown = phaseReportMetadata(currentState, currentAudit, task) + await readFile(phase.reportPath, 'utf8')
    currentState.phases[task.id] = {
      ...phase,
      email: {
        claimedAt: new Date().toISOString(),
        reportHash: sha256(markdown),
        subject,
      },
    }
    await writeState(path, currentState)

    const result = await sendAgentReportEmail(
      { markdown, subject },
      { dryRun: false, enabled: true },
    )
    if (!result.sent) throw new Error(`SMTP delivery did not confirm sent=true for ${task.id}.`)
    currentState.phases[task.id].email = {
      ...currentState.phases[task.id].email!,
      delivery: 'sent',
      messageId: result.messageId,
      sentAt: new Date().toISOString(),
    }
    await writeState(path, currentState)
  }

  if (task.status === 'accepted' && !currentState.phases[task.id].hass?.completedAt) {
    const items = await hassClient.getItems(currentAudit.profile!.todoEntityId)
    const item = items.find((candidate) => candidate.uid === task.todoUid)
    if (!item) throw new Error(`HASS todo item ${task.todoUid} for ${task.id} no longer exists.`)

    const alreadyCompleted = item.status === 'completed'
    const receipt = await hassClient.getState(currentAudit.profile!.completionReceiptEntityId)
    if (!adminCompletionBoundarySatisfied(item.status, receipt.state, task.todoUid)) {
      await hassClient.completeItem(currentAudit.profile!.completionScript, task.todoUid, task.adminTask)
      await waitForCompletionReceipt(
        hassClient,
        currentAudit.profile!.todoEntityId,
        currentAudit.profile!.completionReceiptEntityId,
        task.todoUid,
      )
    }
    currentState.phases[task.id].hass = {
      alreadyCompleted,
      completedAt: new Date().toISOString(),
      notified: true,
    }
    await writeState(path, currentState)
  }

  return currentState
}

async function runCopilotPhase(input: {
  audit: AutonomousAdminRoadmapAudit
  repository: string
  resume: boolean
  roadmapPath: string
  sessionName: string
  task: AutonomousAdminTask
}) {
  const prompt = phasePrompt(input)
  const copilotArgs = [
    '-C', input.repository,
    '--autopilot',
    '--max-autopilot-continues', '100',
    '--model', AUTONOMOUS_ADMIN_MODEL,
    '--effort', AUTONOMOUS_ADMIN_REASONING_EFFORT,
    '--context', AUTONOMOUS_ADMIN_CONTEXT_TIER,
    '--allow-all-tools',
    '--no-ask-user',
    '--no-color',
    '--silent',
    '--output-format', 'text',
    '--secret-env-vars=VITE_HA_TOKEN,HASS_AUTONOMY_EMAIL_SMTP_PASSWORD,DAY_TRADER_EMAIL_SMTP_PASSWORD',
    input.resume ? `--resume=${input.sessionName}` : '--name',
  ]
  if (!input.resume) copilotArgs.push(input.sessionName)
  copilotArgs.push('--prompt', prompt)

  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn('copilot', copilotArgs, {
      cwd: input.repository,
      env: buildCopilotChildEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let errors = ''
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      errors += text
      process.stderr.write(text)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Copilot phase ${input.task.id} exited with code ${code}: ${errors.slice(-1000)}`))
        return
      }
      if (!output.trim()) {
        reject(new Error(`Copilot phase ${input.task.id} returned no report output.`))
        return
      }
      resolvePromise(output.trim())
    })
  })
}

function phasePrompt(input: {
  audit: AutonomousAdminRoadmapAudit
  roadmapPath: string
  resume: boolean
  task: AutonomousAdminTask
}) {
  const roadmap = relative(process.cwd(), input.roadmapPath)
  return `Use the ${AUTONOMOUS_ADMIN_SKILL} skill and execute exactly one phase.

Execution profile is pinned and already enforced by the launcher:
- model: ${AUTONOMOUS_ADMIN_MODEL}
- reasoning effort: ${AUTONOMOUS_ADMIN_REASONING_EFFORT}
- context tier: ${AUTONOMOUS_ADMIN_CONTEXT_TIER}

Roadmap: ${roadmap}
Plan hash after the task entered in_progress: ${input.audit.planHash}
Phase: ${input.task.phase}
Canonical task id: ${input.task.id}
Home Assistant todo UID: ${input.task.todoUid}
Admin task: ${input.task.adminTask}
Work: ${input.task.work}
Acceptance / stop gate: ${input.task.acceptanceGate}
Session mode: ${input.resume ? 'resume the existing in-progress phase' : 'new phase execution'}

Requirements:
1. Read the whole roadmap and all repository instructions that apply to files you edit.
2. Work only this phase. Diagnose first, then implement the complete safe solution.
3. Home Assistant owns state and side effects. Use HA MCP and its best-practices skill before editing HA config.
4. For React UX work, perform the required live HASS and React Playwright comparison before acceptance; if browser comparison is blocked, do not mark visual parity accepted.
5. Do not commit, push, deploy, complete the HA todo item, send email, or notify the phone. The parent runner owns those phase boundaries.
6. Before exiting, transition ${input.task.id} from in_progress to exactly one of accepted, rejected, or hard_blocked:
   npm run autonomous:admin:transition -- --roadmap "${roadmap}" --task-id "${input.task.id}" --status <accepted|rejected|hard_blocked> --expect-plan-hash "${input.audit.planHash}" --reason "<evidence-based decision>"
7. Your final response is the phase email body. Use these Markdown sections: Outcome, Work Completed, Home Assistant Changes, React Dashboard Changes, Validation Evidence, Files and Artifacts, Remaining Risks, Up Next. Be concrete and human-readable.`
}

function phaseReportMetadata(state: AdminRunState, audit: AutonomousAdminRoadmapAudit, task: AutonomousAdminTask) {
  return `- **Run ID:** ${state.runId}
- **Task ID:** ${task.id}
- **HASS Todo UID:** ${task.todoUid}
- **Model:** ${audit.profile!.model}
- **Reasoning effort:** ${audit.profile!.reasoningEffort}
- **Context tier:** ${audit.profile!.contextTier}
- **Plan hash:** ${audit.planHash}
- **Outcome:** ${task.status}

`
}

async function waitForCompletionReceipt(
  client: HassAdminTodoClient,
  entityId: string,
  receiptEntityId: string,
  uid: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const [items, receipt] = await Promise.all([
      client.getItems(entityId),
      client.getState(receiptEntityId),
    ])
    if (items.find((item) => item.uid === uid)?.status === 'completed' && receipt.state === uid) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750))
  }
  throw new Error(`HASS did not confirm completion and notification receipt for ${uid}.`)
}

async function readAudit(path: string) {
  const audit = auditAutonomousAdminRoadmap(await readFile(path, 'utf8'))
  if (!audit.profile || audit.errors.length > 0) {
    throw new Error(`Autonomous Admin roadmap audit failed:\n- ${audit.errors.join('\n- ')}`)
  }
  return audit
}

async function readOrCreateState(path: string, roadmapPathValue: string, planHash: string): Promise<AdminRunState> {
  try {
    await access(path)
    const state = JSON.parse(await readFile(path, 'utf8')) as AdminRunState
    if (state.version !== 1) throw new Error(`Unsupported autonomous Admin state version ${state.version}.`)
    if (resolve(state.roadmapPath) !== roadmapPathValue) throw new Error('Run state roadmap path does not match.')
    return state
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  }

  const now = new Date().toISOString()
  const state: AdminRunState = {
    createdAt: now,
    lastPlanHash: planHash,
    phases: {},
    roadmapPath: roadmapPathValue,
    runId: `hass-admin-${now.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    updatedAt: now,
    version: 1,
  }
  await writeState(path, state)
  return state
}

async function writeState(path: string, state: AdminRunState) {
  state.updatedAt = new Date().toISOString()
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8')
  await rename(temporaryPath, path)
}

function statusLabel(status: AutonomousAdminTask['status']) {
  if (status === 'accepted') return 'Accepted'
  if (status === 'rejected') return 'Rejected'
  if (status === 'hard_blocked') return 'Blocked'
  return 'Needs Attention'
}

function sessionNameFor(runId: string, taskId: string) {
  return `${runId}-${taskId}`.slice(0, 100)
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function numberValue(value: string | undefined) {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('--max-phases must be a non-negative integer.')
  return parsed
}

function parseArgs(argv: string[]) {
  const values: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument "${token}".`)
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}.`)
    values[key] = value
    index += 1
  }
  return { values }
}

async function acquireRunLock(path: string): Promise<RunLock> {
  await mkdir(dirname(path), { recursive: true })
  const token = randomUUID()
  const ownerPath = join(path, 'owner.json')

  try {
    await mkdir(path)
  } catch (error) {
    if (!isFileExistsError(error)) throw error
    const existing = await readExistingLock(ownerPath)
    const owner = existing ? `pid ${existing.pid}${processIsAlive(existing.pid) ? ' (active)' : ' (possibly stale)'}` : 'unknown owner'
    throw new Error(`Autonomous Admin run lock ${path} already exists with ${owner}. Remove it only after confirming no runner is active.`, { cause: error })
  }

  try {
    await writeFile(ownerPath, JSON.stringify({
      acquiredAt: new Date().toISOString(),
      pid: process.pid,
      token,
    }))
  } catch (error) {
    await rm(path, { force: true, recursive: true })
    throw error
  }
  return { ownerPath, path, token }
}

async function readExistingLock(ownerPath: string): Promise<{ pid: number; token: string } | null> {
  try {
    const parsed = JSON.parse(await readFile(ownerPath, 'utf8')) as { pid?: unknown; token?: unknown }
    if (typeof parsed.pid !== 'number' || typeof parsed.token !== 'string') return null
    return { pid: parsed.pid, token: parsed.token }
  } catch {
    return null
  }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return !(error instanceof Error && 'code' in error && error.code === 'ESRCH')
  }
}

function releaseRunLock(lock: RunLock) {
  try {
    const parsed = JSON.parse(readFileSync(lock.ownerPath, 'utf8')) as { token?: unknown }
    if (parsed.token === lock.token) rmSync(lock.path, { force: true, recursive: true })
  } catch {
    // The lock may already be released or replaced after a stale-owner recovery.
  }
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}
