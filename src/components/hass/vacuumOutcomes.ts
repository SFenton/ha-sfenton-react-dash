export type VacuumOutcomeAttemptMode = 'fallback_vacuum' | 'vacuum' | 'vacuum_mop'
export type VacuumOutcomeAttemptResult = 'completed' | 'failed' | 'interrupted' | 'partial' | 'uncertain'
export type VacuumOutcomeCreditStatus = 'full' | 'none' | 'partial'
export type VacuumOutcomeEventType = 'attempt' | 'deferral'
export type VacuumOutcomeOperation = 'mop' | 'vacuum' | 'vacuum_mop'
export type VacuumOutcomeStatus = 'completed' | 'deferred' | 'failed' | 'interrupted' | 'partial' | 'uncertain'
export type VacuumOutcomeContractVersion = 1 | 2
export type VacuumOutcomePhysicalWorkStatus = 'not_observed' | 'observed' | 'substantial'
export type VacuumOutcomeMeasurementStatus = 'not_required' | 'passed_lower_bound' | 'unknown' | 'passed' | 'failed'
export type VacuumOutcomeIterationStatus = 'verified' | 'unverified'
export type VacuumOutcomeCompletionStatus = 'completed' | 'incomplete' | 'uncertain'
export type VacuumOutcomeTelemetryStatus = 'recovered' | 'unresolved'

export interface VacuumOutcomePhysicalWorkEvidence {
  cleaning_observed: boolean
  segment_cleaning_observed: boolean
  status: VacuumOutcomePhysicalWorkStatus
  target_room_dwell_seconds: number
}

export interface VacuumOutcomeMeasurementEvidence {
  attribution_uncertain: boolean
  lower_bound?: number
  minimum: number
  observed: number | null
  reset_count: number
  status: VacuumOutcomeMeasurementStatus
  unit: 'seconds' | 'square_inches'
}

export interface VacuumOutcomeIterationEvidence {
  observed: number
  requested: number
  status: VacuumOutcomeIterationStatus
}

export interface VacuumOutcomeCompletionEvidence {
  reason: string | null
  status: VacuumOutcomeCompletionStatus
}

export interface VacuumOutcomeTelemetryEvidence {
  source_outage_count: number
  source_outage_seconds: number
  status: VacuumOutcomeTelemetryStatus
}

export interface VacuumOutcomeEvidence {
  area: VacuumOutcomeMeasurementEvidence
  completion: VacuumOutcomeCompletionEvidence
  duration: VacuumOutcomeMeasurementEvidence
  iterations: VacuumOutcomeIterationEvidence
  physical_work: VacuumOutcomePhysicalWorkEvidence
  telemetry?: VacuumOutcomeTelemetryEvidence
}

export type VacuumOutcomeEvidenceResult =
  | { data: VacuumOutcomeEvidence; kind: 'available' }
  | { kind: 'malformed' }

export interface VacuumOutcomeReason {
  category: string
  code: string
  data: Record<string, unknown>
  raw: string
}

export interface VacuumOutcomeAttempt {
  evidence?: VacuumOutcomeEvidenceResult
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
  evidence?: VacuumOutcomeEvidenceResult
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
  version: VacuumOutcomeContractVersion
}

export interface VacuumOutcomeLegacyData {
  cleaned: string[]
  issues: string[]
}

export type VacuumOutcomeParseResult =
  | { kind: 'absent' }
  | { contract: VacuumOutcomeContract; kind: 'valid' }
  | { kind: 'incomplete'; version: VacuumOutcomeContractVersion }
  | { kind: 'malformed'; version?: VacuumOutcomeContractVersion }
  | { kind: 'unsupported'; version: number }

export type VacuumWhileAwayPresentation =
  | { contract: VacuumOutcomeContract; kind: 'typed' }
  | ({ kind: 'legacy' } & VacuumOutcomeLegacyData)
  | ({ kind: 'incomplete'; version: VacuumOutcomeContractVersion } & VacuumOutcomeLegacyData)
  | ({ kind: 'malformed'; version?: VacuumOutcomeContractVersion } & VacuumOutcomeLegacyData)
  | ({ kind: 'incompatible'; version: number } & VacuumOutcomeLegacyData)
  | { kind: 'empty' }

const ATTEMPT_MODES = new Set<VacuumOutcomeAttemptMode>(['fallback_vacuum', 'vacuum', 'vacuum_mop'])
const V1_ATTEMPT_RESULTS = new Set<VacuumOutcomeAttemptResult>(['completed', 'failed', 'interrupted'])
const V2_ATTEMPT_RESULTS = new Set<VacuumOutcomeAttemptResult>(['completed', 'failed', 'interrupted', 'partial', 'uncertain'])
const CREDIT_STATUSES = new Set<VacuumOutcomeCreditStatus>(['full', 'none', 'partial'])
const OPERATIONS = new Set<VacuumOutcomeOperation>(['mop', 'vacuum', 'vacuum_mop'])
const REQUIRED_OPERATIONS = new Set<VacuumOutcomeRoom['required_operation']>(['vacuum', 'vacuum_mop'])
const V1_STATUSES = new Set<VacuumOutcomeStatus>(['completed', 'deferred', 'failed', 'interrupted', 'partial'])
const V2_STATUSES = new Set<VacuumOutcomeStatus>(['completed', 'deferred', 'failed', 'interrupted', 'partial', 'uncertain'])
const KINDS = new Set(['cleaned', 'failed', 'fallback', 'skipped'])
const PHYSICAL_WORK_STATUSES = new Set<VacuumOutcomePhysicalWorkStatus>(['not_observed', 'observed', 'substantial'])
const MEASUREMENT_STATUSES = new Set<VacuumOutcomeMeasurementStatus>(['not_required', 'passed_lower_bound', 'unknown', 'passed', 'failed'])
const ITERATION_STATUSES = new Set<VacuumOutcomeIterationStatus>(['verified', 'unverified'])
const COMPLETION_STATUSES = new Set<VacuumOutcomeCompletionStatus>(['completed', 'incomplete', 'uncertain'])
const TELEMETRY_STATUSES = new Set<VacuumOutcomeTelemetryStatus>(['recovered', 'unresolved'])

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

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
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

function attemptResults(version: VacuumOutcomeContractVersion) {
  return version === 1 ? V1_ATTEMPT_RESULTS : V2_ATTEMPT_RESULTS
}

function roomStatuses(version: VacuumOutcomeContractVersion) {
  return version === 1 ? V1_STATUSES : V2_STATUSES
}

function isAttemptCore(value: unknown, version: VacuumOutcomeContractVersion): value is Record<string, unknown> {
  return isRecord(value)
    && isNonEmptyString(value.event_id)
    && ATTEMPT_MODES.has(value.mode as VacuumOutcomeAttemptMode)
    && attemptResults(version).has(value.result as VacuumOutcomeAttemptResult)
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

function isRoomCore(value: unknown, version: VacuumOutcomeContractVersion): value is Record<string, unknown> {
  return isRecord(value)
    && isNonEmptyString(value.room_id)
    && isNonEmptyString(value.room_name)
    && REQUIRED_OPERATIONS.has(value.required_operation as VacuumOutcomeRoom['required_operation'])
    && roomStatuses(version).has(value.status as VacuumOutcomeStatus)
    && (value.latest_attempt === null || isAttemptCore(value.latest_attempt, version))
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

function isEventCore(
  value: unknown,
  contractDay: string,
  version: VacuumOutcomeContractVersion,
): value is Record<string, unknown> {
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
      && attemptResults(version).has(value.attempt_result as VacuumOutcomeAttemptResult)
  }

  return value.type === 'deferral'
    && OPERATIONS.has(value.outstanding_operation as VacuumOutcomeOperation)
    && isReason(value.reason)
}

function parsePhysicalWorkEvidence(value: unknown): VacuumOutcomePhysicalWorkEvidence | null {
  if (
    !isRecord(value)
    || !PHYSICAL_WORK_STATUSES.has(value.status as VacuumOutcomePhysicalWorkStatus)
    || typeof value.cleaning_observed !== 'boolean'
    || typeof value.segment_cleaning_observed !== 'boolean'
    || !isNonNegativeNumber(value.target_room_dwell_seconds)
  ) {
    return null
  }

  return {
    cleaning_observed: value.cleaning_observed,
    segment_cleaning_observed: value.segment_cleaning_observed,
    status: value.status as VacuumOutcomePhysicalWorkStatus,
    target_room_dwell_seconds: value.target_room_dwell_seconds,
  }
}

function parseMeasurementEvidence(
  value: unknown,
  unit: VacuumOutcomeMeasurementEvidence['unit'],
): VacuumOutcomeMeasurementEvidence | null {
  if (
    !isRecord(value)
    || !MEASUREMENT_STATUSES.has(value.status as VacuumOutcomeMeasurementStatus)
    || (value.observed !== null && !isNonNegativeNumber(value.observed))
    || !isNonNegativeNumber(value.minimum)
    || value.unit !== unit
    || !isNonNegativeInteger(value.reset_count)
    || typeof value.attribution_uncertain !== 'boolean'
    || (value.lower_bound !== undefined && !isNonNegativeNumber(value.lower_bound))
  ) {
    return null
  }

  return {
    attribution_uncertain: value.attribution_uncertain,
    ...(value.lower_bound === undefined ? {} : { lower_bound: value.lower_bound }),
    minimum: value.minimum,
    observed: value.observed as number | null,
    reset_count: value.reset_count,
    status: value.status as VacuumOutcomeMeasurementStatus,
    unit,
  }
}

function parseIterationEvidence(value: unknown): VacuumOutcomeIterationEvidence | null {
  if (
    !isRecord(value)
    || !ITERATION_STATUSES.has(value.status as VacuumOutcomeIterationStatus)
    || !isPositiveInteger(value.requested)
    || !isNonNegativeInteger(value.observed)
  ) {
    return null
  }

  return {
    observed: value.observed,
    requested: value.requested,
    status: value.status as VacuumOutcomeIterationStatus,
  }
}

function parseCompletionEvidence(value: unknown): VacuumOutcomeCompletionEvidence | null {
  if (
    !isRecord(value)
    || !COMPLETION_STATUSES.has(value.status as VacuumOutcomeCompletionStatus)
    || !isNullableString(value.reason)
  ) {
    return null
  }

  return {
    reason: value.reason,
    status: value.status as VacuumOutcomeCompletionStatus,
  }
}

function parseTelemetryEvidence(value: unknown): VacuumOutcomeTelemetryEvidence | null {
  if (
    !isRecord(value)
    || !TELEMETRY_STATUSES.has(value.status as VacuumOutcomeTelemetryStatus)
    || !isNonNegativeInteger(value.source_outage_count)
    || !isNonNegativeNumber(value.source_outage_seconds)
  ) {
    return null
  }

  return {
    source_outage_count: value.source_outage_count,
    source_outage_seconds: value.source_outage_seconds,
    status: value.status as VacuumOutcomeTelemetryStatus,
  }
}

function parseEvidence(value: unknown): VacuumOutcomeEvidence | null {
  if (!isRecord(value)) return null
  const physicalWork = parsePhysicalWorkEvidence(value.physical_work)
  const duration = parseMeasurementEvidence(value.duration, 'seconds')
  const area = parseMeasurementEvidence(value.area, 'square_inches')
  const iterations = parseIterationEvidence(value.iterations)
  const completion = parseCompletionEvidence(value.completion)
  const telemetry = value.telemetry === undefined ? undefined : parseTelemetryEvidence(value.telemetry)
  if (!physicalWork || !duration || !area || !iterations || !completion || (value.telemetry !== undefined && !telemetry)) {
    return null
  }

  return {
    area,
    completion,
    duration,
    iterations,
    physical_work: physicalWork,
    ...(telemetry ? { telemetry } : {}),
  }
}

function parseEvidenceResult(
  value: Record<string, unknown>,
  version: VacuumOutcomeContractVersion,
): VacuumOutcomeEvidenceResult | undefined {
  if (version !== 2 || !Object.prototype.hasOwnProperty.call(value, 'evidence')) return undefined
  const evidence = parseEvidence(value.evidence)
  return evidence
    ? { data: evidence, kind: 'available' }
    : { kind: 'malformed' }
}

function normalizeAttempt(
  value: Record<string, unknown>,
  version: VacuumOutcomeContractVersion,
): VacuumOutcomeAttempt {
  const evidence = parseEvidenceResult(value, version)
  return {
    ...(evidence ? { evidence } : {}),
    event_id: value.event_id as string,
    mode: value.mode as VacuumOutcomeAttemptMode,
    reason: value.reason as VacuumOutcomeReason | null,
    result: value.result as VacuumOutcomeAttemptResult,
  }
}

function normalizeRoom(
  value: Record<string, unknown>,
  version: VacuumOutcomeContractVersion,
): VacuumOutcomeRoom {
  return {
    credit: value.credit as VacuumOutcomeCredit,
    event_ids: [...value.event_ids as string[]],
    first_occurred_at: value.first_occurred_at as string,
    last_occurred_at: value.last_occurred_at as string,
    last_sequence: value.last_sequence as number,
    latest_attempt: value.latest_attempt === null
      ? null
      : normalizeAttempt(value.latest_attempt as Record<string, unknown>, version),
    occurrence_count: value.occurrence_count as number,
    outstanding: value.outstanding as VacuumOutcomeOutstanding | null,
    reasons_coincide: value.reasons_coincide as boolean,
    required_operation: value.required_operation as VacuumOutcomeRoom['required_operation'],
    room_id: value.room_id as string,
    room_name: value.room_name as string,
    status: value.status as VacuumOutcomeStatus,
  }
}

function normalizeEvent(
  value: Record<string, unknown>,
  version: VacuumOutcomeContractVersion,
): VacuumOutcomeEvent {
  const base = {
    day: value.day as string,
    id: value.id as string,
    kind: value.kind as VacuumOutcomeEvent['kind'],
    occurred_at: value.occurred_at as string,
    reason: value.reason as VacuumOutcomeReason | null,
    room_id: value.room_id as string,
    room_name: value.room_name as string | null,
    sequence: value.sequence as number,
    session_id: value.session_id as string,
  }
  if (value.type === 'attempt') {
    const evidence = parseEvidenceResult(value, version)
    return {
      ...base,
      attempt_mode: value.attempt_mode as VacuumOutcomeAttemptMode,
      attempt_result: value.attempt_result as VacuumOutcomeAttemptResult,
      ...(evidence ? { evidence } : {}),
      type: 'attempt',
    }
  }
  return {
    ...base,
    outstanding_operation: value.outstanding_operation as VacuumOutcomeOperation,
    reason: value.reason as VacuumOutcomeReason,
    type: 'deferral',
  }
}

function parseSupportedContract(
  value: Record<string, unknown>,
  version: VacuumOutcomeContractVersion,
): VacuumOutcomeContract | null {
  if (
    value.complete !== true
    || !isValidDay(value.day)
    || !Array.isArray(value.rooms)
    || !Array.isArray(value.events)
    || !value.rooms.every((room) => isRoomCore(room, version))
    || !value.events.every((event) => isEventCore(event, value.day as string, version))
  ) {
    return null
  }

  const rooms = value.rooms.map((room) => normalizeRoom(room as Record<string, unknown>, version))
  const events = value.events.map((event) => normalizeEvent(event as Record<string, unknown>, version))
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

  return {
    complete: true,
    day: value.day as string,
    events,
    rooms,
    version,
  }
}

export function parseVacuumOutcomeReport(value: unknown): VacuumOutcomeParseResult {
  if (value === null || value === undefined) return { kind: 'absent' }
  if (!isRecord(value)) return { kind: 'malformed' }
  if (!isPositiveInteger(value.version)) return { kind: 'malformed' }
  if (value.version !== 1 && value.version !== 2) {
    return { kind: 'unsupported', version: value.version }
  }
  const version = value.version
  if (value.complete === false) return { kind: 'incomplete', version }
  if (value.complete !== true) return { kind: 'malformed', version }
  const contract = parseSupportedContract(value, version)
  return contract
    ? { contract, kind: 'valid' }
    : { kind: 'malformed', version }
}

export function parseVacuumOutcomeContract(value: unknown): VacuumOutcomeContract | null {
  const parsed = parseVacuumOutcomeReport(value)
  return parsed.kind === 'valid' ? parsed.contract : null
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
  const legacy = { cleaned, issues }
  const parsed = parseVacuumOutcomeReport(attributes.while_away_outcomes)
  if (parsed.kind === 'valid') {
    return parsed.contract.rooms.length > 0
      ? { contract: parsed.contract, kind: 'typed' }
      : { kind: 'empty' }
  }
  if (parsed.kind === 'incomplete') return { ...legacy, kind: 'incomplete', version: parsed.version }
  if (parsed.kind === 'malformed') return { ...legacy, kind: 'malformed', ...(parsed.version ? { version: parsed.version } : {}) }
  if (parsed.kind === 'unsupported') return { ...legacy, kind: 'incompatible', version: parsed.version }
  return cleaned.length || issues.length ? { ...legacy, kind: 'legacy' } : { kind: 'empty' }
}

export function vacuumOutcomeEventsForRoom(contract: VacuumOutcomeContract, room: VacuumOutcomeRoom) {
  const eventsById = new Map(contract.events.map((event) => [event.id, event]))
  return room.event_ids.map((eventId) => eventsById.get(eventId) as VacuumOutcomeEvent)
}

export function vacuumOutcomeDayDate(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}
