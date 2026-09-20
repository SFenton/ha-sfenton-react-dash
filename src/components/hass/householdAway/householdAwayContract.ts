import { HOUSEHOLD_RESIDENT, type HouseholdResident } from '../../../constants/householdResidents'

export { HOUSEHOLD_RESIDENT }
export type { HouseholdResident }
export const HOUSEHOLD_AWAY_MODE = {
  NONE: 'none',
  SOLO_TRIP: 'solo_trip',
  VACATION: 'vacation',
} as const
export type HouseholdAwayMode = (typeof HOUSEHOLD_AWAY_MODE)[keyof typeof HOUSEHOLD_AWAY_MODE]
export const HOUSEHOLD_AWAY_STATE = {
  ACTIVATING: 'activating',
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  ENDING: 'ending',
  IDLE: 'idle',
  RESTORE_REQUIRED: 'restore_required',
  SCHEDULED: 'scheduled',
} as const
export type HouseholdAwayState = (typeof HOUSEHOLD_AWAY_STATE)[keyof typeof HOUSEHOLD_AWAY_STATE]
export type HouseholdAwayTraveler = 'none' | HouseholdResident
export type SleepypodSide = 'left' | 'right'
export type SleepypodSchedulePayload = Record<string, unknown>
export const HOUSEHOLD_AWAY_RESOLVE_ACTION = {
  KEEP_CURRENT: 'keep_current',
  RESTORE_SAVED: 'restore_saved',
} as const
export type HouseholdAwayResolveAction = (typeof HOUSEHOLD_AWAY_RESOLVE_ACTION)[keyof typeof HOUSEHOLD_AWAY_RESOLVE_ACTION]

export interface HouseholdAwayEffects {
  sleepypodLiveFollow: boolean
  sleepypodSchedule: boolean
  wakeLightSource: boolean
}

export interface HouseholdAwaySnapshot {
  available: boolean
  blockers: string[]
  commandAvailable: boolean
  compatible: boolean
  contractVersion: number
  effects: HouseholdAwayEffects
  endsAt: string | null
  homeResident: HouseholdAwayTraveler
  mode: HouseholdAwayMode
  revision: number
  startsAt: string | null
  state: HouseholdAwayState
  traveler: HouseholdAwayTraveler
}

export interface HouseholdAwayEntityLike {
  attributes?: Record<string, unknown>
  state?: string
}

export type HouseholdAwayCommandOperation =
  | { operation: 'cancel' }
  | { operation: 'end_now' }
  | { operation: 'resolve_restore'; resolveAction: HouseholdAwayResolveAction }
  | { operation: 'schedule'; mode: 'solo_trip'; traveler: HouseholdResident; startDate: string; startTime: string; endDate: string; endTime: string }
  | { operation: 'schedule'; mode: 'vacation'; startDate: string; startTime: string; endDate: string; endTime: string }
  | { operation: 'sleepypod_command'; action: 'set_power'; side: SleepypodSide; enabled: boolean }
  | { operation: 'sleepypod_command'; action: 'set_outside_level' | 'set_tonight_level'; side: SleepypodSide; level: number }
  | { operation: 'sleepypod_command'; action: 'set_stage_level'; side: SleepypodSide; level: number; phase: 'asleep' | 'bedtime' | 'dawn' }
  | { operation: 'sleepypod_command'; action: 'set_schedule'; side?: SleepypodSide; schedule: SleepypodSchedulePayload }
  | { operation: 'sleepypod_command'; action: 'replace_alarms'; side: SleepypodSide; alarmRows: SleepypodAlarmRow[] }
  | { operation: 'sleepypod_command'; action: 'snooze_alarm' | 'stop_alarm'; side: SleepypodSide }
  | { operation: 'update_end'; endDate: string; endTime: string }

export interface SleepypodAlarmRow {
  alarmTemperature: number
  day: string
  duration: number
  enabled: boolean
  time: string
  vibrationIntensity: number
  vibrationPattern: string
}

export interface HouseholdAwayServiceCall extends Record<string, unknown> {
  domain: 'script'
  returnResponse: true
  service: 'household_away_command'
  serviceData: Record<string, unknown>
}

const HOUSEHOLD_AWAY_STATES = new Set<HouseholdAwayState>(Object.values(HOUSEHOLD_AWAY_STATE))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function integerValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function parseTraveler(value: unknown): HouseholdAwayTraveler {
  return value === HOUSEHOLD_RESIDENT.STEPH || value === HOUSEHOLD_RESIDENT.STEPHEN ? value : 'none'
}

function parseBlockers(value: unknown) {
  return Array.isArray(value) ? value.filter((blocker): blocker is string => typeof blocker === 'string' && Boolean(blocker.trim())) : []
}

function parseEffects(value: unknown): HouseholdAwayEffects {
  const raw = isRecord(value) ? value : {}
  return {
    sleepypodLiveFollow: raw.sleepypod_live_follow === true,
    sleepypodSchedule: raw.sleepypod_schedule === true,
    wakeLightSource: raw.wake_light_source === true,
  }
}

export function householdAwaySnapshotFromEntity(entity: HouseholdAwayEntityLike | null | undefined): HouseholdAwaySnapshot {
  const attributes = entity?.attributes ?? {}
  const state = stringValue(entity?.state, 'unavailable')
  const contractVersion = integerValue(attributes.contract_version)
  const compatible = contractVersion === 1
  const resolvedState = HOUSEHOLD_AWAY_STATES.has(state as HouseholdAwayState) ? state as HouseholdAwayState : 'idle'
  const available = Boolean(entity && state !== 'unknown' && state !== 'unavailable' && compatible)

  return {
    available,
    blockers: parseBlockers(attributes.blockers),
    commandAvailable: attributes.command_available === true,
    compatible,
    contractVersion,
    effects: parseEffects(attributes.effects),
    endsAt: nullableString(attributes.ends_at),
    homeResident: parseTraveler(attributes.home_resident),
    mode: attributes.mode === HOUSEHOLD_AWAY_MODE.SOLO_TRIP || attributes.mode === HOUSEHOLD_AWAY_MODE.VACATION
      ? attributes.mode
      : HOUSEHOLD_AWAY_MODE.NONE,
    revision: integerValue(attributes.revision),
    startsAt: nullableString(attributes.starts_at),
    state: resolvedState,
    traveler: parseTraveler(attributes.traveler),
  }
}

/** All required Solo Trip effects confirmed active — the only condition permitting the green InfoBox. */
export function householdAwayFullyActive(snapshot: HouseholdAwaySnapshot) {
  return snapshot.mode === HOUSEHOLD_AWAY_MODE.SOLO_TRIP && snapshot.state === HOUSEHOLD_AWAY_STATE.ACTIVE
    && snapshot.effects.wakeLightSource && snapshot.effects.sleepypodSchedule && snapshot.effects.sleepypodLiveFollow
}

function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `household-away-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function householdAwayServiceCall(
  snapshot: HouseholdAwaySnapshot, command: HouseholdAwayCommandOperation, commandRequestId = requestId(),
): HouseholdAwayServiceCall {
  const serviceData: Record<string, unknown> = {
    expected_revision: snapshot.revision,
    operation: command.operation,
    request_id: commandRequestId,
  }
  if (command.operation === 'schedule') {
    serviceData.mode = command.mode
    if (command.mode === 'solo_trip') serviceData.traveler = command.traveler
    serviceData.start_date = command.startDate
    serviceData.start_time = command.startTime
    serviceData.end_date = command.endDate
    serviceData.end_time = command.endTime
  } else if (command.operation === 'update_end') {
    serviceData.end_date = command.endDate
    serviceData.end_time = command.endTime
  } else if (command.operation === 'resolve_restore') {
    serviceData.resolve_action = command.resolveAction
  } else if (command.operation === 'sleepypod_command') {
    serviceData.action = command.action
    serviceData.side = command.side
    if ('enabled' in command) serviceData.enabled = command.enabled
    if ('level' in command) serviceData.level = command.level
    if ('phase' in command) serviceData.phase = command.phase
    if ('alarmRows' in command) serviceData.alarm_rows = command.alarmRows
    if ('schedule' in command) serviceData.schedule = command.schedule
  }

  return {
    domain: 'script',
    returnResponse: true,
    service: 'household_away_command',
    serviceData,
  }
}

export interface SoloTripDraft {
  endDate: string
  endTime: string
  startDate: string
  startTime: string
  traveler: HouseholdResident | null
}

export interface SoloTripDraftValidation {
  endAfterStart: boolean
  startInFuture: boolean
  travelerValid: boolean
  valid: boolean
}

export interface SoloTripEndDraftValidation {
  endAfterStart: boolean
  valid: boolean
}

export interface HouseholdAwayWallClockParts {
  date: string
  time: string
}

function localDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null
  const parsed = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function householdAwayWallClockParts(value: string | null | undefined): HouseholdAwayWallClockParts | null {
  if (typeof value !== 'string') return null
  const [datePart, timeWithZone] = value.trim().split(/[T ]/, 2)
  const timePart = timeWithZone?.slice(0, 5) ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}$/.test(timePart)) return null
  return { date: datePart, time: timePart }
}

export function validateSoloTripDraft(draft: SoloTripDraft, now = new Date()): SoloTripDraftValidation {
  const travelerValid = draft.traveler === HOUSEHOLD_RESIDENT.STEPH || draft.traveler === HOUSEHOLD_RESIDENT.STEPHEN
  const start = localDateTime(draft.startDate, draft.startTime)
  const end = localDateTime(draft.endDate, draft.endTime)
  const currentMinute = new Date(now)
  currentMinute.setSeconds(0, 0)
  const startInFuture = Boolean(start && start >= currentMinute)
  const endAfterStart = Boolean(start && end && end > start)
  return {
    endAfterStart,
    startInFuture,
    travelerValid,
    valid: travelerValid && startInFuture && endAfterStart,
  }
}

export function validateSoloTripEndDraft(endDate: string, endTime: string, startsAt: string | null): SoloTripEndDraftValidation {
  const start = householdAwayWallClockParts(startsAt)
  const startDateTime = start ? localDateTime(start.date, start.time) : null
  const endDateTime = localDateTime(endDate, endTime)
  const endAfterStart = Boolean(startDateTime && endDateTime && endDateTime > startDateTime)
  return {
    endAfterStart,
    valid: endAfterStart,
  }
}

export function soloTripHomeResident(traveler: HouseholdResident): HouseholdResident {
  return traveler === HOUSEHOLD_RESIDENT.STEPHEN
    ? HOUSEHOLD_RESIDENT.STEPH
    : HOUSEHOLD_RESIDENT.STEPHEN
}

function defaultDatePart(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultSoloTripDraft(now = new Date()): SoloTripDraft {
  const start = new Date(now)
  start.setSeconds(0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 3)
  return {
    endDate: defaultDatePart(end),
    endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
    startDate: defaultDatePart(start),
    startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    traveler: null,
  }
}

export interface HouseholdAwayBedScope {
  controlsWholeBed: boolean
  engaged: boolean
  homeResident: HouseholdAwayTraveler
  readOnly: boolean
  traveler: HouseholdAwayTraveler
}

export function householdAwayBedScope(
  snapshot: HouseholdAwaySnapshot,
  resident: HouseholdResident,
): HouseholdAwayBedScope {
  const engaged = snapshot.mode === HOUSEHOLD_AWAY_MODE.SOLO_TRIP
    && snapshot.state !== HOUSEHOLD_AWAY_STATE.IDLE
    && snapshot.state !== HOUSEHOLD_AWAY_STATE.SCHEDULED
  const controlsWholeBed = engaged
    && householdAwayFullyActive(snapshot)
    && snapshot.homeResident === resident
  return {
    controlsWholeBed,
    engaged,
    homeResident: snapshot.homeResident,
    readOnly: engaged && !controlsWholeBed,
    traveler: snapshot.traveler,
  }
}
