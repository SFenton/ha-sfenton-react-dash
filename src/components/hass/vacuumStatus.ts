export type VacuumAvailabilityStatus = 'available' | 'missing' | 'unavailable' | 'unknown'
export type VacuumCommandPolicyMode = 'none' | 'normal' | 'restricted'
export type VacuumConditionSource = 'automation' | 'coordinator' | 'derived'
export type VacuumIssueStatus = 'clear' | 'present' | 'unknown'
export type VacuumIssueProvenance = 'observed' | 'recorder_backfill'

export const VACUUM_AVAILABILITY_AVAILABLE = 'available' as const
export const VACUUM_AVAILABILITY_MISSING = 'missing' as const
export const VACUUM_AVAILABILITY_UNAVAILABLE = 'unavailable' as const
export const VACUUM_AVAILABILITY_UNKNOWN = 'unknown' as const
export const VACUUM_COMMAND_NONE = 'none' as const
export const VACUUM_COMMAND_NORMAL = 'normal' as const
export const VACUUM_COMMAND_RESTRICTED = 'restricted' as const
export const VACUUM_CONDITION_DERIVED = 'derived' as const
export const VACUUM_CONTRACT_TYPED = 'typed' as const
export const VACUUM_ISSUE_CLEAR = 'clear' as const
export const VACUUM_ISSUE_PRESENT = 'present' as const
export const VACUUM_ISSUE_UNKNOWN = 'unknown' as const

export interface VacuumAvailability {
  since: string | null
  status: VacuumAvailabilityStatus
}

export interface VacuumCurrentIssue {
  code: string | null
  raw: string | null
  reported_at: string | null
  status: VacuumIssueStatus
}

export interface VacuumActiveCondition {
  code: string
  since: string
  source: VacuumConditionSource
}

export interface VacuumLastIssue {
  cleared_at?: string | null
  code: string
  provenance: VacuumIssueProvenance
  raw: string
  reported_at: string
}

export interface VacuumCommandPolicy {
  mode: VacuumCommandPolicyMode
  reason: string | null
}

export interface VacuumStatusContract {
  active_conditions: VacuumActiveCondition[]
  availability: VacuumAvailability
  command_policy: VacuumCommandPolicy
  current_issue: VacuumCurrentIssue
  last_issue: VacuumLastIssue | null
  observed_vacuum_state: string | null
  vacuum_entity_id: string
  version: 1
}

export type VacuumStatusContractResolution =
  | { contract: VacuumStatusContract; kind: 'typed' }
  | { kind: 'legacy'; reason: 'invalid' | 'missing' | 'stale' }

const AVAILABILITY_STATUSES = new Set<VacuumAvailabilityStatus>(['available', 'missing', 'unavailable', 'unknown'])
const COMMAND_POLICY_MODES = new Set<VacuumCommandPolicyMode>(['none', 'normal', 'restricted'])
const CONDITION_SOURCES = new Set<VacuumConditionSource>(['automation', 'coordinator', 'derived'])
const ISSUE_PROVENANCE = new Set<VacuumIssueProvenance>(['observed', 'recorder_backfill'])
const ISSUE_STATUSES = new Set<VacuumIssueStatus>(['clear', 'present', 'unknown'])
const CLEAR_ERROR_STATES = new Set(['', 'no error', 'none', 'ok'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value)
}

function isAvailability(value: unknown): value is VacuumAvailability {
  return isRecord(value)
    && AVAILABILITY_STATUSES.has(value.status as VacuumAvailabilityStatus)
    && isNullableTimestamp(value.since)
}

function isCurrentIssue(value: unknown): value is VacuumCurrentIssue {
  if (!isRecord(value) || !ISSUE_STATUSES.has(value.status as VacuumIssueStatus)) return false
  if (value.status === 'present') {
    return isNonEmptyString(value.code)
      && isNonEmptyString(value.raw)
      && isTimestamp(value.reported_at)
  }
  return (value.code === undefined || value.code === null)
    && (value.raw === undefined || value.raw === null)
    && (value.reported_at === undefined || value.reported_at === null)
}

function isActiveCondition(value: unknown): value is VacuumActiveCondition {
  return isRecord(value)
    && isNonEmptyString(value.code)
    && CONDITION_SOURCES.has(value.source as VacuumConditionSource)
    && isTimestamp(value.since)
}

function isLastIssue(value: unknown): value is VacuumLastIssue {
  return isRecord(value)
    && isNonEmptyString(value.code)
    && isNonEmptyString(value.raw)
    && isTimestamp(value.reported_at)
    && ISSUE_PROVENANCE.has(value.provenance as VacuumIssueProvenance)
    && (value.cleared_at === undefined || isNullableTimestamp(value.cleared_at))
}

function isCommandPolicy(value: unknown): value is VacuumCommandPolicy {
  return isRecord(value)
    && COMMAND_POLICY_MODES.has(value.mode as VacuumCommandPolicyMode)
    && isNullableString(value.reason)
}

export function parseVacuumStatusContract(value: unknown): VacuumStatusContract | null {
  if (
    !isRecord(value)
    || value.version !== 1
    || !isNonEmptyString(value.vacuum_entity_id)
    || (value.observed_vacuum_state !== null && !isNonEmptyString(value.observed_vacuum_state))
    || !isAvailability(value.availability)
    || !isCurrentIssue(value.current_issue)
    || !Array.isArray(value.active_conditions)
    || !value.active_conditions.every(isActiveCondition)
    || (value.last_issue !== null && !isLastIssue(value.last_issue))
    || !isCommandPolicy(value.command_policy)
  ) {
    return null
  }

  const availability = value.availability as VacuumAvailability
  const currentIssue = value.current_issue as VacuumCurrentIssue
  const commandPolicy = value.command_policy as VacuumCommandPolicy
  const activeConditions = value.active_conditions as VacuumActiveCondition[]
  const observedAvailability = vacuumAvailabilityStatus(
    value.observed_vacuum_state as string | null,
    value.observed_vacuum_state !== null,
  )
  if (availability.status !== observedAvailability) return null
  if (availability.status !== VACUUM_AVAILABILITY_AVAILABLE && currentIssue.status === VACUUM_ISSUE_PRESENT) return null
  if (availability.status !== VACUUM_AVAILABILITY_AVAILABLE && commandPolicy.mode !== VACUUM_COMMAND_NONE) return null
  if (currentIssue.status !== VACUUM_ISSUE_CLEAR && commandPolicy.mode === VACUUM_COMMAND_NORMAL) return null
  if (activeConditions.length > 0 && commandPolicy.mode === VACUUM_COMMAND_NORMAL) return null

  return value as unknown as VacuumStatusContract
}

export function resolveVacuumStatusContract(
  attributes: Record<string, unknown> | null | undefined,
  expectedVacuumEntityId: string,
  liveVacuumState: string | undefined,
): VacuumStatusContractResolution {
  if (!attributes) return { kind: 'legacy', reason: 'missing' }
  const contract = parseVacuumStatusContract(attributes)
  if (!contract || contract.vacuum_entity_id !== expectedVacuumEntityId) {
    return { kind: 'legacy', reason: 'invalid' }
  }
  if (contract.observed_vacuum_state !== (liveVacuumState ?? null)) {
    return { kind: 'legacy', reason: 'stale' }
  }
  return { contract, kind: 'typed' }
}

export function vacuumAvailabilityStatus(state: string | null | undefined, entityExists = true): VacuumAvailabilityStatus {
  if (!entityExists) return VACUUM_AVAILABILITY_MISSING
  if (!state || state === VACUUM_AVAILABILITY_UNKNOWN) return VACUUM_AVAILABILITY_UNKNOWN
  if (state === VACUUM_AVAILABILITY_UNAVAILABLE) return VACUUM_AVAILABILITY_UNAVAILABLE
  return VACUUM_AVAILABILITY_AVAILABLE
}

export function nativeVacuumIssue(state: string | undefined): VacuumCurrentIssue {
  if (state === undefined) {
    return { code: null, raw: null, reported_at: null, status: VACUUM_ISSUE_UNKNOWN }
  }
  const raw = state.trim()
  const normalized = raw.toLowerCase()
  if (normalized === VACUUM_AVAILABILITY_UNKNOWN || normalized === VACUUM_AVAILABILITY_UNAVAILABLE) {
    return { code: null, raw: null, reported_at: null, status: VACUUM_ISSUE_UNKNOWN }
  }
  if (CLEAR_ERROR_STATES.has(normalized)) {
    return { code: null, raw: null, reported_at: null, status: VACUUM_ISSUE_CLEAR }
  }
  return {
    code: normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    raw,
    reported_at: null,
    status: VACUUM_ISSUE_PRESENT,
  }
}
