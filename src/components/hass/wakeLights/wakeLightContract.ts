import type { WakeLightConfig } from '../../../constants/wakeLights'

export const WAKE_LIGHT_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
export type WakeLightWeekday = (typeof WAKE_LIGHT_WEEKDAYS)[number]

export const WAKE_LIGHT_ALARM_KIND = {
  ONCE: 'once',
  WEEKLY: 'weekly',
} as const
export type WakeLightAlarmKind = (typeof WAKE_LIGHT_ALARM_KIND)[keyof typeof WAKE_LIGHT_ALARM_KIND]
export type WakeLightAlarmSource = 'native' | 'sleepypod'
export type WakeLightPhase = 'blocked_vacation' | 'degraded' | 'holding' | 'idle' | 'ramping' | 'recovering' | 'scheduled' | 'snoozed' | 'unavailable'
export const WAKE_LIGHT_PHASE = {
  RAMPING: 'ramping',
  RECOVERING: 'recovering',
  SNOOZED: 'snoozed',
} as const
export const WAKE_LIGHT_SOURCE = { NATIVE: 'native', SLEEPYPOD: 'sleepypod' } as const
export const WAKE_LIGHT_SOURCE_FAILURE_PREFIX = 'source'
export const WAKE_LIGHT_FAILURE_KIND = { TRANSPORT: 'transport', UNAVAILABLE: 'unavailable' } as const
export const WAKE_LIGHT_ACTIVE_PHASES: readonly WakeLightPhase[] = ['ramping', 'holding', 'snoozed']
export const WAKE_LIGHT_MODAL_TAB = {
  ALARMS: 'wake-alarms',
  DEFAULTS: 'wake-defaults',
} as const
export type WakeLightModalTab = (typeof WAKE_LIGHT_MODAL_TAB)[keyof typeof WAKE_LIGHT_MODAL_TAB]
export const WAKE_LIGHT_SAFETY_EXPECTED = {
  LIGHT: 'ready',
  OCCUPANCY: 'on',
  OCCUPANCY_CLEAR: 'off',
  PBL: 'ready',
  VACATION: 'off',
} as const
export const WAKE_LIGHT_WEEKDAY_GROUPS = {
  WEEKDAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  WEEKENDS: ['sunday', 'saturday'],
} as const satisfies Record<string, readonly WakeLightWeekday[]>
export const WAKE_LIGHT_WEEKDAY_WIDTH = {
  LONG: 'long',
  SHORT: 'short',
} as const
export const WAKE_LIGHT_RAMP_MINUTES = [0, 5, 10, 15, 30] as const
export const WAKE_LIGHT_HOLD_MINUTES = [5, 10, 15, 30] as const

export type WakeLightBedSide = 'left' | 'right'

export interface WakeLightAlarm {
  bedSides: WakeLightBedSide[]
  date: string | null
  enabled: boolean
  id: string
  kind: WakeLightAlarmKind
  label: string
  localTime: string
  rampMinutes: number
  revision: number
  source: WakeLightAlarmSource
  sourceLabel: string | null
  sourceRef: string | null
  weekdays: WakeLightWeekday[]
}

export interface WakeLightDefaults {
  postWakeHoldMinutes: number
  rampMinutes: number
}

export interface WakeLightSafetyState {
  lightState: string
  lightTargetName: string | null
  occupancyState: string
  pblState: string
  vacationState: string
}

export interface WakeLightActiveOccurrence {
  alarmId: string
  id: string
  phase: WakeLightPhase
  progress: number
  snoozedUntil: string | null
  sourceRef: string | null
  wakeAt: string
}

export interface WakeLightCancellation {
  at: string | null
  occurrenceCount: number
  outcome: string | null
  suppressedUntil: string | null
}

export interface WakeLightSnapshot {
  activeOccurrences: WakeLightActiveOccurrence[]
  contractVersion: number
  alarms: WakeLightAlarm[]
  autoRelightBlockedUntil: string | null
  available: boolean
  compatible: boolean
  commandedBrightnessPct: number
  defaults: WakeLightDefaults
  currentBlockers: string[]
  episodeRef: string | null
  failures: string[]
  lastCancellation: WakeLightCancellation | null
  lastOutcome: string | null
  lastFailure: { at: string | null; code: string } | null
  nextWakeAt: string | null
  nextRampMinutes: number | null
  phase: WakeLightPhase
  profileId: string
  progress: number
  revision: number
  alarmLinks: Record<string, boolean>
  safety: WakeLightSafetyState
}

export interface WakeLightEntityLike {
  attributes?: Record<string, unknown>
  state?: string
}

export type WakeLightCommandOperation =
  | { operation: 'link_alarm'; enabled: boolean; linkKeys: string[] }
  | { operation: 'cancel_occurrence'; occurrenceId: string }
  | { operation: 'delete_alarm'; alarmId: string }
  | { operation: 'dismiss'; occurrenceId: string }
  | { operation: 'end_episode' }
  | { operation: 'update_defaults'; defaults: WakeLightDefaults }
  | { operation: 'upsert_alarm'; alarm: WakeLightAlarm }

export interface WakeLightServiceCall extends Record<string, unknown> {
  domain: 'wake_light'
  returnResponse: true
  service: 'command'
  serviceData: Record<string, unknown>
}

export interface WakeLightAlarmValidation {
  dateValid: boolean
  daysValid: boolean
  nameValid: boolean
  rampValid: boolean
  timeValid: boolean
  valid: boolean
}

const WAKE_LIGHT_PHASES = new Set<WakeLightPhase>([
  'blocked_vacation',
  'degraded',
  'holding',
  'idle',
  'ramping',
  'recovering',
  'scheduled',
  'snoozed',
  'unavailable',
])

const DEFAULTS: WakeLightDefaults = {
  postWakeHoldMinutes: 5,
  rampMinutes: 30,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function clampedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function integerValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function parseWeekdays(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((day): day is WakeLightWeekday => WAKE_LIGHT_WEEKDAYS.includes(day as WakeLightWeekday))
}

function parseBedSides(value: unknown): WakeLightBedSide[] {
  if (!Array.isArray(value)) return []
  return ['left', 'right'].filter((side): side is WakeLightBedSide => value.includes(side))
}

function parseAlarm(value: unknown): WakeLightAlarm | null {
  if (!isRecord(value)) return null
  const id = nullableString(value.id)
  const label = nullableString(value.label)
  const localTime = stringValue(value.local_time ?? value.localTime)
  const kind = value.kind === WAKE_LIGHT_ALARM_KIND.ONCE
    ? WAKE_LIGHT_ALARM_KIND.ONCE
    : value.kind === WAKE_LIGHT_ALARM_KIND.WEEKLY ? WAKE_LIGHT_ALARM_KIND.WEEKLY : null
  if (!id || !label || !kind || !isValidWakeLightTime(localTime)) return null

  const weekdays = parseWeekdays(value.weekdays)
  const date = nullableString(value.date)
  if (kind === WAKE_LIGHT_ALARM_KIND.WEEKLY && weekdays.length === 0) return null
  if (kind === WAKE_LIGHT_ALARM_KIND.ONCE && !date) return null

  return {
    bedSides: parseBedSides(value.bed_sides ?? value.bedSides),
    date,
    enabled: value.enabled !== false,
    id,
    kind,
    label,
    localTime,
    rampMinutes: clampedNumber(value.ramp_minutes ?? value.rampMinutes, 0, 60, DEFAULTS.rampMinutes),
    revision: integerValue(value.revision),
    source: value.source === 'sleepypod' ? 'sleepypod' : 'native',
    sourceLabel: nullableString(value.source_label ?? value.sourceLabel),
    sourceRef: nullableString(value.source_ref ?? value.sourceRef),
    weekdays,
  }
}

function parseDefaults(attributes: Record<string, unknown>): WakeLightDefaults {
  const raw = isRecord(attributes.defaults) ? attributes.defaults : attributes
  return {
    postWakeHoldMinutes: clampedNumber(raw.post_wake_hold_minutes ?? raw.postWakeHoldMinutes, 5, 30, DEFAULTS.postWakeHoldMinutes),
    rampMinutes: clampedNumber(raw.ramp_minutes ?? raw.rampMinutes, 0, 60, DEFAULTS.rampMinutes),
  }
}

function parseSafety(attributes: Record<string, unknown>): WakeLightSafetyState {
  const raw = isRecord(attributes.safety) ? attributes.safety : attributes
  return {
    lightState: stringValue(raw.light_state ?? raw.lightState, 'unknown'),
    lightTargetName: nullableString(raw.light_target_name ?? raw.lightTargetName),
    occupancyState: stringValue(raw.occupancy_state ?? raw.occupancyState, 'unknown'),
    pblState: stringValue(raw.pbl_state ?? raw.pblState, 'unknown'),
    vacationState: stringValue(raw.vacation_state ?? raw.vacationState, 'unknown'),
  }
}

function parseAlarmLinks(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .filter(([, enabled]) => enabled === false).map(([key]) => [key, false]))
}

function parseFailures(value: unknown) {
  return Array.isArray(value) ? value.filter((failure): failure is string => typeof failure === 'string' && Boolean(failure.trim())) : []
}

function parseActiveOccurrences(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): WakeLightActiveOccurrence[] => {
    if (!isRecord(item)) return []
    const id = nullableString(item.occurrence_id ?? item.id)
    const alarmId = nullableString(item.alarm_id ?? item.alarmId)
    const wakeAt = nullableString(item.wake_at ?? item.wakeAt)
    if (!id || !alarmId || !wakeAt) return []
    return [{
      alarmId,
      id,
      phase: WAKE_LIGHT_PHASES.has(item.phase as WakeLightPhase) ? item.phase as WakeLightPhase : 'idle',
      progress: clampedNumber(item.progress, 0, 100, 0),
      snoozedUntil: nullableString(item.snoozed_until ?? item.snoozedUntil),
      sourceRef: nullableString(item.source_ref ?? item.sourceRef),
      wakeAt,
    }]
  })
}

function parseCancellation(value: unknown): WakeLightCancellation | null {
  if (!isRecord(value)) return null
  return {
    at: nullableString(value.at),
    occurrenceCount: integerValue(value.occurrence_count ?? value.occurrenceCount),
    outcome: nullableString(value.outcome),
    suppressedUntil: nullableString(value.suppressed_until ?? value.suppressedUntil),
  }
}

export function wakeLightSnapshotFromEntity(config: WakeLightConfig, entity: WakeLightEntityLike | null | undefined): WakeLightSnapshot {
  const attributes = entity?.attributes ?? {}
  const state = stringValue(entity?.state, 'unavailable')
  const contractVersion = integerValue(attributes.contract_version)
  const compatible = contractVersion >= 4 && contractVersion <= 6
  const available = Boolean(entity && state !== 'unknown' && state !== 'unavailable'
    && compatible && attributes.command_available === true)
  const phase = WAKE_LIGHT_PHASES.has(state as WakeLightPhase) ? state as WakeLightPhase : 'unavailable'
  const alarms = Array.isArray(attributes.alarms)
    ? attributes.alarms.map(parseAlarm).filter((alarm): alarm is WakeLightAlarm => Boolean(alarm))
    : []

  return {
    alarmLinks: parseAlarmLinks(attributes.alarm_links ?? attributes.alarmLinks),
    activeOccurrences: parseActiveOccurrences(attributes.active_occurrences ?? attributes.activeOccurrences),
    alarms,
    contractVersion,
    autoRelightBlockedUntil: nullableString(attributes.auto_relight_blocked_until ?? attributes.autoRelightBlockedUntil),
    available,
    compatible,
    commandedBrightnessPct: clampedNumber(attributes.commanded_brightness_pct ?? attributes.commandedBrightnessPct, 0, 100, 0),
    defaults: parseDefaults(attributes),
    currentBlockers: parseFailures(attributes.current_blockers),
    episodeRef: nullableString(attributes.episode_ref),
    failures: parseFailures(attributes.failures),
    lastCancellation: parseCancellation(attributes.last_cancellation ?? attributes.lastCancellation),
    lastOutcome: nullableString(attributes.last_outcome ?? attributes.lastOutcome),
    lastFailure: isRecord(attributes.last_failure) && typeof attributes.last_failure.code === 'string'
      ? { code: attributes.last_failure.code, at: nullableString(attributes.last_failure.at) }
      : null,
    nextWakeAt: nullableString(attributes.next_wake_at ?? attributes.nextWakeAt),
    nextRampMinutes: attributes.next_ramp_minutes == null ? null : clampedNumber(attributes.next_ramp_minutes, 0, 60, 30),
    phase,
    profileId: stringValue(attributes.profile_id ?? attributes.profileId, config.id),
    progress: clampedNumber(attributes.progress, 0, 100, 0),
    revision: integerValue(attributes.revision),
    safety: parseSafety(attributes),
  }
}

export function wakeLightAlarmLinkKey(sourceRef: string, weekday: WakeLightWeekday, localTime: string) {
  return `${sourceRef}#${weekday}#${localTime}`
}

export function wakeLightAlarmLinkDays(alarm: WakeLightAlarm): WakeLightWeekday[] {
  if (alarm.source === WAKE_LIGHT_SOURCE.NATIVE || !alarm.sourceRef) return []
  if (alarm.kind === WAKE_LIGHT_ALARM_KIND.WEEKLY) return alarm.weekdays
  if (!alarm.date) return []
  const parsed = new Date(`${alarm.date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return []
  return [WAKE_LIGHT_WEEKDAYS[parsed.getDay()]]
}

export function wakeLightAlarmLinkEnabled(
  alarmLinks: Record<string, boolean>, sourceRef: string, weekday: WakeLightWeekday, localTime: string,
) {
  return alarmLinks[wakeLightAlarmLinkKey(sourceRef, weekday, localTime)] !== false
}

export function wakeLightAlarmLinked(alarmLinks: Record<string, boolean>, alarm: WakeLightAlarm) {
  const days = wakeLightAlarmLinkDays(alarm)
  if (!days.length || !alarm.sourceRef) return true
  return days.some(day => wakeLightAlarmLinkEnabled(alarmLinks, alarm.sourceRef as string, day, alarm.localTime))
}

export function isValidWakeLightTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function alarmDateTime(alarm: WakeLightAlarm) {
  if (!alarm.date || !isValidWakeLightTime(alarm.localTime)) return null
  const [year, month, day] = alarm.date.split('-').map(Number)
  const [hour, minute] = alarm.localTime.split(':').map(Number)
  if (!year || !month || !day) return null
  const result = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(result.getTime()) ? null : result
}

export function createWakeLightAlarm(id: string, label: string, now = new Date(), defaults: WakeLightDefaults = DEFAULTS): WakeLightAlarm {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return {
    bedSides: [],
    date: localDateValue(tomorrow),
    enabled: true,
    id,
    kind: WAKE_LIGHT_ALARM_KIND.ONCE,
    label,
    localTime: '07:00',
    rampMinutes: defaults.rampMinutes,
    revision: 0,
    source: 'native',
    sourceLabel: null,
    sourceRef: null,
    weekdays: [],
  }
}

export function validateWakeLightAlarm(alarm: WakeLightAlarm, now = new Date()): WakeLightAlarmValidation {
  const nameValid = Boolean(alarm.label.trim())
  const timeValid = isValidWakeLightTime(alarm.localTime)
  const rampValid = WAKE_LIGHT_RAMP_MINUTES.includes(alarm.rampMinutes as (typeof WAKE_LIGHT_RAMP_MINUTES)[number])
  const daysValid = alarm.kind !== WAKE_LIGHT_ALARM_KIND.WEEKLY || alarm.weekdays.length > 0
  const oneTimeAt = alarmDateTime(alarm)
  const dateValid = alarm.kind !== WAKE_LIGHT_ALARM_KIND.ONCE || !alarm.enabled || Boolean(oneTimeAt && oneTimeAt > now)
  return {
    dateValid,
    daysValid,
    nameValid,
    rampValid,
    timeValid,
    valid: nameValid && rampValid && timeValid && daysValid && dateValid,
  }
}

export function vacationPermitsWakeLightRun(state: string) {
  return state === 'off'
}

export function formatWakeLightTime(value: string, locale?: string) {
  const timestamp = Date.parse(value)
  const date = Number.isNaN(timestamp)
    ? (() => {
        if (!isValidWakeLightTime(value)) return null
        const [hour, minute] = value.split(':').map(Number)
        const local = new Date(2000, 0, 1, hour, minute)
        return local
      })()
    : new Date(timestamp)
  return date ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date) : value
}

export function formatWakeLightDate(value: string, locale?: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `wake-light-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function alarmPayload(alarm: WakeLightAlarm) {
  return {
    bed_sides: alarm.kind === WAKE_LIGHT_ALARM_KIND.ONCE ? alarm.bedSides : [],
    date: alarm.kind === WAKE_LIGHT_ALARM_KIND.ONCE ? alarm.date : null,
    enabled: alarm.enabled,
    id: alarm.id,
    kind: alarm.kind,
    label: alarm.label,
    local_time: alarm.localTime,
    ramp_minutes: alarm.rampMinutes,
    revision: alarm.revision,
    source: alarm.source,
    source_ref: alarm.sourceRef,
    weekdays: alarm.kind === WAKE_LIGHT_ALARM_KIND.WEEKLY ? alarm.weekdays : [],
  }
}

export function wakeLightServiceCall(snapshot: WakeLightSnapshot, command: WakeLightCommandOperation, commandRequestId = requestId()): WakeLightServiceCall {
  const serviceData: Record<string, unknown> = {
    expected_revision: snapshot.revision,
    operation: command.operation,
    profile_id: snapshot.profileId,
    request_id: commandRequestId,
  }
  if (snapshot.episodeRef && ['end_episode', 'dismiss', 'cancel_occurrence'].includes(command.operation)) {
    serviceData.episode_ref = snapshot.episodeRef
  }

  if (command.operation === 'link_alarm') {
    serviceData.enabled = command.enabled
    serviceData.link_keys = command.linkKeys
  } else if (command.operation === 'delete_alarm') {
    serviceData.alarm_id = command.alarmId
  } else if (command.operation === 'update_defaults') {
    serviceData.defaults = {
      post_wake_hold_minutes: command.defaults.postWakeHoldMinutes,
      ramp_minutes: command.defaults.rampMinutes,
    }
  } else if (command.operation === 'upsert_alarm') {
    serviceData.alarm = alarmPayload(command.alarm)
  } else if (command.operation !== 'end_episode') {
    serviceData.occurrence_id = command.occurrenceId
  }

  return {
    domain: 'wake_light',
    returnResponse: true,
    service: 'command',
    serviceData,
  }
}
