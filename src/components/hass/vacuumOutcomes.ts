export type VacuumOutcomeAttemptMode = 'fallback_vacuum' | 'vacuum' | 'vacuum_mop'
export type VacuumOutcomeAttemptResult = 'completed' | 'failed' | 'interrupted'
export type VacuumOutcomeCreditStatus = 'full' | 'none' | 'partial'
export type VacuumOutcomeEventType = 'attempt' | 'deferral'
export type VacuumOutcomeOperation = 'mop' | 'vacuum' | 'vacuum_mop'
export type VacuumOutcomeStatus = 'completed' | 'deferred' | 'failed' | 'interrupted' | 'partial'

export interface VacuumOutcomeReason {
  category: string
  code: string
  data: Record<string, unknown>
  raw: string
}

export interface VacuumOutcomeAttempt {
  event_id: string
  mode: VacuumOutcomeAttemptMode
  reason: VacuumOutcomeReason | null
  result: VacuumOutcomeAttemptResult
}

export interface VacuumOutcomeCredit {
  operation: Extract<VacuumOutcomeOperation, 'vacuum' | 'vacuum_mop'> | null
  status: VacuumOutcomeCreditStatus
}

export interface VacuumOutcomeOutstanding {
  operation: VacuumOutcomeOperation
  reason: VacuumOutcomeReason | null
}

export interface VacuumOutcomeRoom {
  credit: VacuumOutcomeCredit
  event_ids: string[]
  first_occurred_at: string
  last_occurred_at: string
  last_sequence: number
  latest_attempt: VacuumOutcomeAttempt | null
  occurrence_count: number
  outstanding: VacuumOutcomeOutstanding | null
  reasons_coincide: boolean
  required_operation: Extract<VacuumOutcomeOperation, 'vacuum' | 'vacuum_mop'>
  room_id: string
  room_name: string
  status: VacuumOutcomeStatus
}

interface VacuumOutcomeEventBase {
  day: string
  id: string
  kind: 'cleaned' | 'failed' | 'fallback' | 'skipped'
  occurred_at: string
  reason: VacuumOutcomeReason | null
  room_id: string
  room_name: string | null
  sequence: number
  session_id: string
}

export interface VacuumOutcomeAttemptEvent extends VacuumOutcomeEventBase {
  attempt_mode: VacuumOutcomeAttemptMode
  attempt_result: VacuumOutcomeAttemptResult
  type: 'attempt'
}

export interface VacuumOutcomeDeferralEvent extends VacuumOutcomeEventBase {
  outstanding_operation: VacuumOutcomeOperation
  reason: VacuumOutcomeReason
  type: 'deferral'
}

export type VacuumOutcomeEvent = VacuumOutcomeAttemptEvent | VacuumOutcomeDeferralEvent

export interface VacuumOutcomeContract {
  complete: true
  day: string
  events: VacuumOutcomeEvent[]
  rooms: VacuumOutcomeRoom[]
  version: 1
}

export type VacuumWhileAwayPresentation =
  | { cleaned: string[]; contract: VacuumOutcomeContract; issues: string[]; kind: 'typed' }
  | { cleaned: string[]; issues: string[]; kind: 'legacy' }
  | { kind: 'empty' }

const ATTEMPT_MODES = new Set<VacuumOutcomeAttemptMode>(['fallback_vacuum', 'vacuum', 'vacuum_mop'])
const ATTEMPT_RESULTS = new Set<VacuumOutcomeAttemptResult>(['completed', 'failed', 'interrupted'])
const CREDIT_STATUSES = new Set<VacuumOutcomeCreditStatus>(['full', 'none', 'partial'])
const OPERATIONS = new Set<VacuumOutcomeOperation>(['mop', 'vacuum', 'vacuum_mop'])
const REQUIRED_OPERATIONS = new Set<VacuumOutcomeRoom['required_operation']>(['vacuum', 'vacuum_mop'])
const STATUSES = new Set<VacuumOutcomeStatus>(['completed', 'deferred', 'failed', 'interrupted', 'partial'])
const KINDS = new Set(['cleaned', 'failed', 'fallback', 'skipped'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isValidTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function isReason(value: unknown): value is VacuumOutcomeReason {
  return isRecord(value)
    && isNonEmptyString(value.code)
    && isNonEmptyString(value.category)
    && isNonEmptyString(value.raw)
    && isRecord(value.data)
}

function isNullableReason(value: unknown): value is VacuumOutcomeReason | null {
  return value === null || isReason(value)
}

function isAttempt(value: unknown): value is VacuumOutcomeAttempt {
  return isRecord(value)
    && isNonEmptyString(value.event_id)
    && ATTEMPT_MODES.has(value.mode as VacuumOutcomeAttemptMode)
    && ATTEMPT_RESULTS.has(value.result as VacuumOutcomeAttemptResult)
    && isNullableReason(value.reason)
}

function isCredit(value: unknown): value is VacuumOutcomeCredit {
  if (!isRecord(value) || !CREDIT_STATUSES.has(value.status as VacuumOutcomeCreditStatus)) return false
  if (value.operation !== null && !REQUIRED_OPERATIONS.has(value.operation as VacuumOutcomeRoom['required_operation'])) return false
  if (value.status === 'none') return value.operation === null
  return value.operation !== null
}

function isOutstanding(value: unknown): value is VacuumOutcomeOutstanding {
  return isRecord(value)
    && OPERATIONS.has(value.operation as VacuumOutcomeOperation)
    && isNullableReason(value.reason)
}

function isRoom(value: unknown): value is VacuumOutcomeRoom {
  return isRecord(value)
    && isNonEmptyString(value.room_id)
    && isNonEmptyString(value.room_name)
    && REQUIRED_OPERATIONS.has(value.required_operation as VacuumOutcomeRoom['required_operation'])
    && STATUSES.has(value.status as VacuumOutcomeStatus)
    && (value.latest_attempt === null || isAttempt(value.latest_attempt))
    && isCredit(value.credit)
    && (value.outstanding === null || isOutstanding(value.outstanding))
    && typeof value.reasons_coincide === 'boolean'
    && isNonNegativeInteger(value.occurrence_count)
    && isValidTimestamp(value.first_occurred_at)
    && isValidTimestamp(value.last_occurred_at)
    && isPositiveInteger(value.last_sequence)
    && Array.isArray(value.event_ids)
    && value.event_ids.length > 0
    && value.event_ids.every(isNonEmptyString)
    && new Set(value.event_ids).size === value.event_ids.length
}

function isEvent(value: unknown, contractDay: string): value is VacuumOutcomeEvent {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.session_id)
    || !isPositiveInteger(value.sequence)
    || !isValidTimestamp(value.occurred_at)
    || value.day !== contractDay
    || !isNonEmptyString(value.room_id)
    || !isNullableString(value.room_name)
    || !KINDS.has(value.kind as string)
    || !isNullableReason(value.reason)
  ) {
    return false
  }

  if (value.type === 'attempt') {
    return ATTEMPT_MODES.has(value.attempt_mode as VacuumOutcomeAttemptMode)
      && ATTEMPT_RESULTS.has(value.attempt_result as VacuumOutcomeAttemptResult)
  }

  return value.type === 'deferral'
    && OPERATIONS.has(value.outstanding_operation as VacuumOutcomeOperation)
    && isReason(value.reason)
}

export function parseVacuumOutcomeContract(value: unknown): VacuumOutcomeContract | null {
  if (
    !isRecord(value)
    || value.version !== 1
    || value.complete !== true
    || !isValidDay(value.day)
    || !Array.isArray(value.rooms)
    || !Array.isArray(value.events)
    || !value.rooms.every(isRoom)
    || !value.events.every((event) => isEvent(event, value.day as string))
  ) {
    return null
  }

  const rooms = value.rooms as VacuumOutcomeRoom[]
  const events = value.events as VacuumOutcomeEvent[]
  if (new Set(rooms.map((room) => room.room_id)).size !== rooms.length) return null
  if (new Set(events.map((event) => event.id)).size !== events.length) return null

  const eventsById = new Map(events.map((event) => [event.id, event]))
  const referencedEventIds = new Set<string>()
  for (const room of rooms) {
    for (const eventId of room.event_ids) {
      const event = eventsById.get(eventId)
      if (!event || event.room_id !== room.room_id || referencedEventIds.has(eventId)) return null
      referencedEventIds.add(eventId)
    }
    if (room.latest_attempt) {
      const latestEvent = eventsById.get(room.latest_attempt.event_id)
      if (
        !latestEvent
        || latestEvent.type !== 'attempt'
        || !room.event_ids.includes(latestEvent.id)
        || latestEvent.attempt_mode !== room.latest_attempt.mode
        || latestEvent.attempt_result !== room.latest_attempt.result
      ) {
        return null
      }
    }
  }
  if (referencedEventIds.size !== events.length) return null

  return value as unknown as VacuumOutcomeContract
}

function stringListAttribute(attributes: Record<string, unknown>, name: string) {
  const value = attributes[name]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

export function vacuumWhileAwayPresentation(attributes: Record<string, unknown> | null | undefined): VacuumWhileAwayPresentation {
  if (!attributes) return { kind: 'empty' }
  const cleaned = stringListAttribute(attributes, 'while_away_cleaned')
  const issues = stringListAttribute(attributes, 'while_away_issues')
  const typed = parseVacuumOutcomeContract(attributes.while_away_outcomes)
  if (typed) return typed.rooms.length > 0 ? { cleaned, contract: typed, issues, kind: 'typed' } : { kind: 'empty' }

  return cleaned.length || issues.length
    ? { cleaned, issues, kind: 'legacy' }
    : { kind: 'empty' }
}

export function vacuumOutcomeEventsForRoom(contract: VacuumOutcomeContract, room: VacuumOutcomeRoom) {
  const eventsById = new Map(contract.events.map((event) => [event.id, event]))
  return room.event_ids.map((eventId) => eventsById.get(eventId) as VacuumOutcomeEvent)
}

export function vacuumOutcomeDayDate(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}
