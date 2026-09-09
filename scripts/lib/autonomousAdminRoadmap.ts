import { createHash } from 'node:crypto'

export const AUTONOMOUS_ADMIN_MODEL = 'gpt-5.6-sol'
export const AUTONOMOUS_ADMIN_REASONING_EFFORT = 'medium'
export const AUTONOMOUS_ADMIN_CONTEXT_TIER = 'default'
export const AUTONOMOUS_ADMIN_CRITICAL_MODEL = 'gpt-5.6-sol'
export const AUTONOMOUS_ADMIN_CRITICAL_REASONING_EFFORT = 'max'
export const AUTONOMOUS_ADMIN_CRITICAL_CONTEXT_TIER = 'long_context'
export const AUTONOMOUS_ADMIN_CRITICAL_TRIGGER_IDS = [
  'ha-physical-action-conflict',
  'ha-credential-exposure-conflict',
  'ha-release-rollback-or-host-conflict',
] as const
export const AUTONOMOUS_ADMIN_SKILL = 'autonomous-hass-admin-executor'

export const autonomousAdminStatuses = [
  'pending',
  'in_progress',
  'accepted',
  'rejected',
  'hard_blocked',
  'superseded',
] as const

export type AutonomousAdminStatus = (typeof autonomousAdminStatuses)[number]

export interface AutonomousAdminExecutionProfile {
  criticalContextTier: string
  criticalModel: string
  criticalReasoningEffort: string
  criticalTriggerIds: string[]
  completionReceiptEntityId: string
  completionScript: string
  contextTier: string
  finalTaskId: string
  model: string
  planId: string
  reasoningEffort: string
  requiredSkills: string[]
  todoEntityId: string
}

export interface AutonomousAdminDependency {
  id: string
  requirement: 'accepted' | 'processed'
}

export interface AutonomousAdminTask {
  acceptanceGate: string
  adminTask: string
  dependsOn: AutonomousAdminDependency[]
  id: string
  phase: string
  row: number
  status: AutonomousAdminStatus
  todoUid: string
  work: string
}

export interface AutonomousAdminRoadmapAudit {
  counts: Record<AutonomousAdminStatus, number>
  errors: string[]
  nextTask?: AutonomousAdminTask
  planHash: string
  profile?: AutonomousAdminExecutionProfile
  tasks: AutonomousAdminTask[]
}

export interface HomeAssistantTodoItem {
  description?: string
  status?: string
  summary?: string
  uid?: string
}

const PROFILE_MARKER = 'autonomous-execution-profile'
const QUEUE_START_MARKER = '<!-- autonomous-queue:start -->'
const QUEUE_END_MARKER = '<!-- autonomous-queue:end -->'
const TERMINAL_STATUSES = new Set<AutonomousAdminStatus>(['accepted', 'rejected', 'hard_blocked', 'superseded'])

export function auditAutonomousAdminRoadmap(markdown: string): AutonomousAdminRoadmapAudit {
  const errors: string[] = []
  const planHash = hashAutonomousAdminMarkdown(markdown)
  const profile = parseProfile(markdown, errors)
  const tasks = parseQueue(markdown, errors)

  validateProfile(profile, errors)
  validateTasks(tasks, profile, errors)

  const counts = Object.fromEntries(
    autonomousAdminStatuses.map((status) => [status, tasks.filter((task) => task.status === status).length]),
  ) as Record<AutonomousAdminStatus, number>
  const inProgress = tasks.filter((task) => task.status === 'in_progress')
  const nextTask = errors.length === 0
    ? inProgress[0] ?? tasks.find((task) => task.status === 'pending' && dependenciesSatisfied(task, tasks))
    : undefined

  if (tasks.some((task) => task.status === 'pending') && !nextTask && errors.length === 0) {
    errors.push('The roadmap has pending tasks but none is dependency-ready.')
  }

  return { counts, errors, nextTask, planHash, profile, tasks }
}

export function transitionAutonomousAdminTask(
  markdown: string,
  taskId: string,
  to: AutonomousAdminStatus,
  expectedPlanHash: string,
): string {
  const audit = auditAutonomousAdminRoadmap(markdown)
  if (audit.errors.length > 0) {
    throw new Error(`Cannot transition an invalid roadmap:\n- ${audit.errors.join('\n- ')}`)
  }
  if (audit.planHash !== expectedPlanHash) {
    throw new Error(`Roadmap hash changed: expected ${expectedPlanHash}, found ${audit.planHash}.`)
  }

  const task = audit.tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new Error(`Unknown autonomous Admin task "${taskId}".`)
  if (!allowedTransition(task.status, to)) {
    throw new Error(`Invalid autonomous Admin transition ${task.status} -> ${to} for ${taskId}.`)
  }
  if (to === 'in_progress' && task.status === 'pending' && !dependenciesSatisfied(task, audit.tasks)) {
    throw new Error(`Task ${taskId} is not dependency-ready.`)
  }

  const queueStart = markdown.indexOf(QUEUE_START_MARKER) + QUEUE_START_MARKER.length
  const queueEnd = markdown.indexOf(QUEUE_END_MARKER)
  let queueBody = markdown.slice(queueStart, queueEnd)
  const taskPattern = escapeRegExp(taskId)
  const statusPattern = autonomousAdminStatuses.join('|')
  const rowPattern = new RegExp(
    `^(\\|\\s*[^|\\n]+\\s*\\|\\s*\`?${taskPattern}\`?\\s*\\|\\s*[^|\\n]+\\s*\\|\\s*)(${statusPattern})(\\s*\\|.*)$`,
    'gm',
  )
  let replacements = 0
  queueBody = queueBody.replace(rowPattern, (_row, prefix: string, _status: string, suffix: string) => {
    replacements += 1
    return `${prefix}${to}${suffix}`
  })
  if (replacements !== 1) {
    throw new Error(`Expected one queue row for ${taskId}, found ${replacements}.`)
  }

  const updated = `${markdown.slice(0, queueStart)}${queueBody}${markdown.slice(queueEnd)}`
  const updatedAudit = auditAutonomousAdminRoadmap(updated)
  if (updatedAudit.errors.length > 0) {
    throw new Error(`Transition produced an invalid roadmap:\n- ${updatedAudit.errors.join('\n- ')}`)
  }
  return updated
}

export function exactAutonomousAdminTaskTransition(
  beforeMarkdown: string,
  afterMarkdown: string,
  taskId: string,
  expectedPlanHash: string,
) {
  for (const status of ['accepted', 'rejected', 'hard_blocked'] as const) {
    if (transitionAutonomousAdminTask(beforeMarkdown, taskId, status, expectedPlanHash) === afterMarkdown) {
      return status
    }
  }
  throw new Error(`Roadmap changes for ${taskId} were not exactly one allowed selected-task terminal transition.`)
}

export function validateAutonomousAdminTodoCoverage(
  audit: AutonomousAdminRoadmapAudit,
  openItems: HomeAssistantTodoItem[],
): string[] {
  if (audit.errors.length > 0) return [...audit.errors]

  const errors: string[] = []
  const tasksByUid = new Map(audit.tasks.map((task) => [task.todoUid, task]))
  const openByUid = new Map(openItems.flatMap((item) => item.uid ? [[item.uid, item] as const] : []))

  for (const item of openItems) {
    if (!item.uid) {
      errors.push(`Open HA item "${item.summary ?? 'Untitled task'}" has no UID.`)
      continue
    }
    if (!tasksByUid.has(item.uid)) {
      errors.push(`Open HA item "${item.summary ?? item.uid}" (${item.uid}) has no roadmap phase.`)
    }
  }

  for (const task of audit.tasks) {
    if ((task.status === 'pending' || task.status === 'in_progress') && !openByUid.has(task.todoUid)) {
      errors.push(`Nonterminal roadmap task ${task.id} references HA item ${task.todoUid}, which is not open.`)
    }
  }

  return errors
}

export function hashAutonomousAdminMarkdown(markdown: string): string {
  return createHash('sha256').update(markdown).digest('hex')
}

export function isAutonomousAdminTerminalStatus(status: AutonomousAdminStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

function parseProfile(markdown: string, errors: string[]): AutonomousAdminExecutionProfile | undefined {
  const matches = [...markdown.matchAll(new RegExp(`<!--\\s*${PROFILE_MARKER}\\s*([\\s\\S]*?)-->`, 'g'))]
  if (matches.length !== 1) {
    errors.push(`Expected exactly one ${PROFILE_MARKER} block, found ${matches.length}.`)
    return undefined
  }

  const values = new Map<string, string>()
  for (const line of matches[0][1].split(/\r?\n/)) {
    const match = line.trim().match(/^([a-z_]+)\s*:\s*(.*)$/i)
    if (!match) continue
    const key = match[1].toLowerCase()
    if (values.has(key)) errors.push(`Execution profile contains duplicate key "${key}".`)
    else values.set(key, match[2].trim())
  }

  const planId = values.get('plan_id')
  const finalTaskId = values.get('final_task_id')
  const model = values.get('model')
  const reasoningEffort = values.get('reasoning_effort')
  const contextTier = values.get('context_tier')
  const criticalModel = values.get('critical_model')
  const criticalReasoningEffort = values.get('critical_reasoning_effort')
  const criticalContextTier = values.get('critical_context_tier')
  const criticalTriggerIds = splitList(values.get('critical_trigger_ids'))
  const requiredSkills = splitList(values.get('required_skills'))
  const todoEntityId = values.get('todo_entity_id')
  const completionScript = values.get('completion_script')
  const completionReceiptEntityId = values.get('completion_receipt_entity_id')

  const requiredValues = {
    completion_receipt_entity_id: completionReceiptEntityId,
    completion_script: completionScript,
    context_tier: contextTier,
    critical_context_tier: criticalContextTier,
    critical_model: criticalModel,
    critical_reasoning_effort: criticalReasoningEffort,
    critical_trigger_ids: criticalTriggerIds.length > 0 ? criticalTriggerIds.join(',') : undefined,
    final_task_id: finalTaskId,
    model,
    plan_id: planId,
    reasoning_effort: reasoningEffort,
    required_skills: requiredSkills.length > 0 ? requiredSkills.join(',') : undefined,
    todo_entity_id: todoEntityId,
  }
  for (const [key, value] of Object.entries(requiredValues)) {
    if (!value) errors.push(`Execution profile is missing ${key}.`)
  }
  if (!planId || !finalTaskId || !model || !reasoningEffort || !contextTier ||
    !criticalModel || !criticalReasoningEffort || !criticalContextTier ||
    criticalTriggerIds.length === 0 || requiredSkills.length === 0 ||
    !todoEntityId || !completionScript || !completionReceiptEntityId) {
    return undefined
  }

  return {
    completionReceiptEntityId,
    completionScript,
    contextTier,
    criticalContextTier,
    criticalModel,
    criticalReasoningEffort,
    criticalTriggerIds,
    finalTaskId,
    model,
    planId,
    reasoningEffort,
    requiredSkills,
    todoEntityId,
  }
}

function parseQueue(markdown: string, errors: string[]): AutonomousAdminTask[] {
  const startCount = countOccurrences(markdown, QUEUE_START_MARKER)
  const endCount = countOccurrences(markdown, QUEUE_END_MARKER)
  if (startCount !== 1 || endCount !== 1) {
    errors.push(`Expected one autonomous queue marker pair, found start=${startCount} and end=${endCount}.`)
    return []
  }

  const start = markdown.indexOf(QUEUE_START_MARKER) + QUEUE_START_MARKER.length
  const end = markdown.indexOf(QUEUE_END_MARKER)
  if (end <= start) {
    errors.push('Autonomous queue end marker appears before its start marker.')
    return []
  }

  const rows = markdown
    .slice(start, end)
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), row: index + 1 }))
    .filter(({ line }) => line.length > 0)
  const malformed = rows.filter(({ line }) => !line.startsWith('|') || !line.endsWith('|'))
  for (const row of malformed) errors.push(`Queue row ${row.row} is not a complete Markdown table row.`)

  const tableRows = rows.filter(({ line }) => line.startsWith('|') && line.endsWith('|'))
  if (tableRows.length < 3) {
    errors.push('Autonomous queue requires a header, separator, and at least one task row.')
    return []
  }

  const headers = splitMarkdownRow(tableRows[0].line).map(normalizeHeader)
  const requiredHeaders = [
    'phase',
    'task id',
    'todo uid',
    'status',
    'depends on',
    'admin task',
    'work',
    'acceptance / stop gate',
  ]
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) errors.push(`Autonomous queue is missing "${header}".`)
  }
  if (new Set(headers).size !== headers.length) errors.push('Autonomous queue has duplicate columns.')
  if (errors.length > 0) return []

  const separator = splitMarkdownRow(tableRows[1].line)
  if (separator.length !== headers.length || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    errors.push('Autonomous queue has an invalid Markdown separator row.')
    return []
  }

  return tableRows.slice(2).flatMap(({ line, row }) => {
    const cells = splitMarkdownRow(line)
    if (cells.length !== headers.length) {
      errors.push(`Queue row ${row} has ${cells.length} cells; expected ${headers.length}.`)
      return []
    }

    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
    const status = stripMarkdown(record.status).toLowerCase()
    if (!autonomousAdminStatuses.includes(status as AutonomousAdminStatus)) {
      errors.push(`Queue row ${row} has invalid status "${record.status}".`)
      return []
    }

    return [{
      acceptanceGate: record['acceptance / stop gate'].trim(),
      adminTask: stripMarkdown(record['admin task']),
      dependsOn: parseDependencies(record['depends on'], row, errors),
      id: stripMarkdown(record['task id']),
      phase: stripMarkdown(record.phase),
      row,
      status: status as AutonomousAdminStatus,
      todoUid: stripMarkdown(record['todo uid']),
      work: record.work.trim(),
    }]
  })
}

function validateProfile(profile: AutonomousAdminExecutionProfile | undefined, errors: string[]) {
  if (!profile) return
  if (profile.model !== AUTONOMOUS_ADMIN_MODEL) {
    errors.push(`Execution profile model is "${profile.model}", expected "${AUTONOMOUS_ADMIN_MODEL}".`)
  }
  if (profile.reasoningEffort !== AUTONOMOUS_ADMIN_REASONING_EFFORT) {
    errors.push(`Execution profile reasoning effort is "${profile.reasoningEffort}", expected "${AUTONOMOUS_ADMIN_REASONING_EFFORT}".`)
  }
  if (profile.contextTier !== AUTONOMOUS_ADMIN_CONTEXT_TIER) {
    errors.push(`Execution profile context tier is "${profile.contextTier}", expected "${AUTONOMOUS_ADMIN_CONTEXT_TIER}".`)
  }
  if (profile.criticalModel !== AUTONOMOUS_ADMIN_CRITICAL_MODEL) {
    errors.push(`Critical profile model is "${profile.criticalModel}", expected "${AUTONOMOUS_ADMIN_CRITICAL_MODEL}".`)
  }
  if (profile.criticalReasoningEffort !== AUTONOMOUS_ADMIN_CRITICAL_REASONING_EFFORT) {
    errors.push(`Critical profile reasoning effort is "${profile.criticalReasoningEffort}", expected "${AUTONOMOUS_ADMIN_CRITICAL_REASONING_EFFORT}".`)
  }
  if (profile.criticalContextTier !== AUTONOMOUS_ADMIN_CRITICAL_CONTEXT_TIER) {
    errors.push(`Critical profile context tier is "${profile.criticalContextTier}", expected "${AUTONOMOUS_ADMIN_CRITICAL_CONTEXT_TIER}".`)
  }
  if (JSON.stringify(profile.criticalTriggerIds) !==
    JSON.stringify(AUTONOMOUS_ADMIN_CRITICAL_TRIGGER_IDS)) {
    errors.push(`Critical profile trigger ids must be exactly "${AUTONOMOUS_ADMIN_CRITICAL_TRIGGER_IDS.join(',')}".`)
  }
  if (profile.requiredSkills.length !== 1 || profile.requiredSkills[0] !== AUTONOMOUS_ADMIN_SKILL) {
    errors.push(`Execution profile required skills must be exactly "${AUTONOMOUS_ADMIN_SKILL}".`)
  }
}

function validateTasks(
  tasks: AutonomousAdminTask[],
  profile: AutonomousAdminExecutionProfile | undefined,
  errors: string[],
) {
  if (tasks.length === 0) return

  const taskIds = tasks.map((task) => task.id)
  const todoUids = tasks.map((task) => task.todoUid)
  for (const duplicate of duplicates(taskIds)) errors.push(`Duplicate task id "${duplicate}".`)
  for (const duplicate of duplicates(todoUids)) errors.push(`Duplicate todo UID "${duplicate}".`)
  if (tasks.filter((task) => task.status === 'in_progress').length > 1) {
    errors.push('Only one autonomous Admin task may be in progress.')
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  for (const task of tasks) {
    if (!task.id) errors.push(`Queue row ${task.row} has no task id.`)
    if (!task.todoUid) errors.push(`Queue row ${task.row} has no todo UID.`)
    if (!task.adminTask) errors.push(`Queue row ${task.row} has no Admin task title.`)
    if (!task.work) errors.push(`Queue row ${task.row} has no work definition.`)
    if (!task.acceptanceGate) errors.push(`Queue row ${task.row} has no acceptance gate.`)
    for (const dependency of task.dependsOn) {
      if (!taskById.has(dependency.id)) errors.push(`Task ${task.id} depends on unknown task "${dependency.id}".`)
      if (dependency.id === task.id) errors.push(`Task ${task.id} depends on itself.`)
    }
  }

  detectCycles(tasks, errors)
  if (profile) {
    const finalTask = tasks.find((task) => task.id === profile.finalTaskId)
    if (!finalTask) errors.push(`final_task_id "${profile.finalTaskId}" is not in the queue.`)
    else if (tasks.at(-1)?.id !== profile.finalTaskId) errors.push('final_task_id must be the last queue row.')
  }
}

function detectCycles(tasks: AutonomousAdminTask[], errors: string[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (taskId: string, path: string[]) => {
    if (visiting.has(taskId)) {
      errors.push(`Dependency cycle detected: ${[...path, taskId].join(' -> ')}.`)
      return
    }
    if (visited.has(taskId)) return
    visiting.add(taskId)
    const task = taskById.get(taskId)
    for (const dependency of task?.dependsOn ?? []) visit(dependency.id, [...path, taskId])
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) visit(task.id, [])
}

function dependenciesSatisfied(task: AutonomousAdminTask, tasks: AutonomousAdminTask[]) {
  return task.dependsOn.every((dependency) => {
    const dependencyTask = tasks.find((candidate) => candidate.id === dependency.id)
    if (!dependencyTask) return false
    return dependency.requirement === 'accepted'
      ? dependencyTask.status === 'accepted'
      : TERMINAL_STATUSES.has(dependencyTask.status)
  })
}

function allowedTransition(from: AutonomousAdminStatus, to: AutonomousAdminStatus) {
  if (from === to) return false
  if (from === 'pending') return to === 'in_progress' || to === 'hard_blocked' || to === 'superseded'
  if (from === 'in_progress') return to === 'accepted' || to === 'rejected' || to === 'hard_blocked' || to === 'pending'
  return false
}

function parseDependencies(value: string, row: number, errors: string[]): AutonomousAdminDependency[] {
  const normalized = stripMarkdown(value)
  if (!normalized || normalized.toLowerCase() === 'none') return []

  return normalized.split(',').flatMap((item) => {
    const [id, requirementValue, ...extra] = item.trim().split(':')
    if (!id || extra.length > 0 || (requirementValue && requirementValue !== 'accepted')) {
      errors.push(`Queue row ${row} has invalid dependency "${item.trim()}".`)
      return []
    }
    return [{ id, requirement: requirementValue === 'accepted' ? 'accepted' : 'processed' }]
  })
}

function splitMarkdownRow(row: string) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function normalizeHeader(value: string) {
  return stripMarkdown(value).toLowerCase().replace(/\s+/g, ' ')
}

function stripMarkdown(value: string) {
  return value.trim().replace(/^`|`$/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
}

function splitList(value: string | undefined) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1
}

function duplicates(values: string[]) {
  return [...new Set(values.filter((value, index) => value && values.indexOf(value) !== index))]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
