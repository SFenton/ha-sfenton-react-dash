type RecordValue = Record<string, unknown>
interface MockWakeEntity { state: string; attributes: RecordValue }
const requests = new Map<string, { payload: string; response: RecordValue }>()
let forcedOutcome: string | null = null
const WEEKDAYS = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
const RAMP_MINUTES = new Set([0, 5, 10, 15, 30])

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function resetMockWakeCommands() {
  requests.clear()
  forcedOutcome = null
}

export function setMockWakeResponse(outcome: string | null) {
  forcedOutcome = outcome
}

export function applyMockWakeCommand(entity: MockWakeEntity, data: RecordValue): RecordValue {
  const attributes = entity.attributes
  const revision = Number(attributes.revision ?? 0)
  const response = (outcome: string, extra: RecordValue = {}): RecordValue => ({
    outcome, profile_id: attributes.profile_id, request_id: data.request_id, revision, ...extra,
  })
  if (typeof data.request_id !== 'string') return response('invalid_request')
  const payload = canonical(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'request_id')))
  const prior = requests.get(data.request_id)
  if (prior) return prior.payload === payload ? { ...prior.response, idempotent: true } : response('request_id_conflict')
  const finish = (result: RecordValue) => {
    requests.set(data.request_id as string, { payload, response: result })
    while (requests.size > 128) requests.delete(requests.keys().next().value!)
    return result
  }
  if (forcedOutcome) {
    const outcome = forcedOutcome
    forcedOutcome = null
    return finish(response(outcome))
  }
  if (data.profile_id !== attributes.profile_id) return finish(response('invalid_request', { error: 'unknown_profile' }))
  const active = Array.isArray(attributes.active_occurrences) ? attributes.active_occurrences.filter(record) : []
  const anchored = Boolean(active.length && data.episode_ref && data.episode_ref === attributes.episode_ref)
  if (data.episode_ref && !anchored) return finish(response('no_active_occurrence'))
  if (data.expected_revision !== revision && !anchored) return finish(response('revision_conflict'))
  const alarms = Array.isArray(attributes.alarms) ? attributes.alarms.filter(record) : []
  const defaults = record(attributes.defaults) ? attributes.defaults : {}
  const next = structuredClone(attributes)
  let nextState = entity.state
  switch (data.operation) {
    case 'upsert_alarm': {
      if (!record(data.alarm)) return finish(response('invalid_request'))
      const alarm = data.alarm
      const current = alarms.find(item => item.id === alarm.id)
      if (alarm.source !== 'native' || (current && current.source !== 'native')) return finish(response('read_only_source'))
      if (alarm.revision !== (current?.revision ?? 0)) return finish(response('revision_conflict', { conflict: 'alarm_revision' }))
      if (typeof alarm.label !== 'string' || !alarm.label.trim()) return finish(response('invalid_request', { error: 'invalid_alarm_label' }))
      if (typeof alarm.local_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(alarm.local_time)) return finish(response('invalid_request', { error: 'invalid_local_time' }))
      if (!RAMP_MINUTES.has(Number(alarm.ramp_minutes))) return finish(response('invalid_request', { error: 'unsupported_ramp_minutes' }))
      const normalized = { ...alarm, label: alarm.label.trim(), source_label: null }
      if (current && canonical(normalized) === canonical(current)) return finish(response('no_change'))
      const saved = { ...normalized, revision: Number(current?.revision ?? 0) + 1 }
      next.alarms = current ? alarms.map(item => item.id === alarm.id ? saved : item) : [...alarms, saved]
      break
    }
    case 'delete_alarm': {
      const current = alarms.find(item => item.id === data.alarm_id)
      if (!current) return finish(response('not_found'))
      if (current.source !== 'native') return finish(response('read_only_source'))
      next.alarms = alarms.filter(item => item.id !== data.alarm_id)
      break
    }
    case 'update_defaults':
      if (!record(data.defaults) || Number(data.defaults.post_wake_hold_minutes) !== 5
        || !RAMP_MINUTES.has(Number(data.defaults.ramp_minutes))) return finish(response('invalid_request'))
      if (canonical(defaults) === canonical(data.defaults)) return finish(response('no_change'))
      next.defaults = data.defaults
      next.alarms = alarms.map(alarm => alarm.source === 'sleepypod' ? { ...alarm, ramp_minutes: (data.defaults as RecordValue).ramp_minutes } : alarm)
      break
    case 'link_alarm': {
      const linkKeys = Array.isArray(data.link_keys) ? data.link_keys.map(String) : []
      const pattern = /^(?:sleepypod:(?:left|right))#([a-z]+)#(?:[01]\d|2[0-3]):[0-5]\d$/
      if (!linkKeys.length || linkKeys.length > 7 || typeof data.enabled !== 'boolean') return finish(response('invalid_request'))
      if (linkKeys.some(key => { const match = pattern.exec(key); return !match || !WEEKDAYS.has(match[1]) })) return finish(response('invalid_request'))
      const links = record(attributes.alarm_links) ? attributes.alarm_links : {}
      if (linkKeys.every(key => (links[key] !== false) === data.enabled)) return finish(response('no_change'))
      const nextLinks = { ...links }
      for (const key of linkKeys) {
        if (data.enabled) delete nextLinks[key]
        else nextLinks[key] = false
      }
      next.alarm_links = nextLinks
      break
    }
    case 'end_episode': {
      if (!active.length) return finish(response('no_active_occurrence'))
      const now = Date.now()
      const until = new Date(Math.max(now, ...active.map(item => (Date.parse(String(item.wake_at)) || now) + 300_000))).toISOString()
      const firedAlarmIds = new Set(active
        .filter(item => (Date.parse(String(item.wake_at)) || Number.POSITIVE_INFINITY) <= now)
        .map(item => item.alarm_id))
      next.alarms = alarms.filter(alarm => !(
        alarm.source === 'native'
        && alarm.kind === 'once'
        && firedAlarmIds.has(alarm.id)
      ))
      next.active_occurrences = []
      next.episode_ref = null
      next.auto_relight_blocked_until = until
      next.commanded_brightness_pct = 0
      next.last_cancellation = { at: new Date().toISOString(), occurrence_count: active.length, outcome: 'cancelled_by_user', suppressed_until: until }
      next.last_outcome = 'cancelled_by_user'
      nextState = 'idle'
      break
    }
    case 'dismiss':
    case 'cancel_occurrence':
      if (!active.some(item => item.occurrence_id === data.occurrence_id)) return finish(response('no_active_occurrence'))
      next.active_occurrences = active.filter(item => item.occurrence_id !== data.occurrence_id)
      break
    default:
      return finish(response('invalid_request'))
  }
  next.revision = revision + 1
  entity.attributes = next
  entity.state = nextState
  return finish(response('accepted', { revision: revision + 1 }))
}
