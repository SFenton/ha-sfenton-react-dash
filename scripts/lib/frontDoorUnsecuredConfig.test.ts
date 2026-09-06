import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  FRONT_DOOR as F, UNSECURED_HELPERS as H, frontDoorUnsecuredController,
  frontDoorUnsecuredHelpers, frontDoorUnsecuredReconciler, type HaRecord,
} from './frontDoorUnsecuredConfig'

const NOW = 1788660000
const OWNER = 'synthetic-recipient'
const harness = resolve('scripts/fixtures/front-door-unsecured/ha_runtime.py')
interface Call { action: string; target?: string; data: HaRecord; at: number }
interface Result { calls: Call[]; states: Record<string, string>; coverage: string[] }
type Step = HaRecord & { at: number }

function run(steps: Step[], overrides: HaRecord = {}): Result {
  const state = (value: string, attributes = {}) => ({ state: value, last_changed: NOW - 10000, attributes })
  const states: HaRecord = {
    [F.lock]: state('unlocked'), [F.contact]: state('off'), [F.presence]: state('not_home'),
    [F.alarm]: state('disarmed'), [F.person]: state('not_home', { user_id: OWNER }),
    ...Object.fromEntries(F.guests.map((entity) => [entity, state('off')])),
    [H.phase]: state('idle'), [H.incident]: state(''), [H.opened]: state('0'),
    [H.wake]: state('1970-01-01 00:00:00', { timestamp: 0 }),
    [H.attention]: state('off'), [H.notice]: state(''), [H.retired]: state(''),
    ...overrides,
  }
  const result = spawnSync('python', ['-B', harness], {
    input: JSON.stringify({
      config: frontDoorUnsecuredController(), now: NOW, states, steps,
      actionPrefix: F.actionPrefix, incidentHelper: H.incident,
    }),
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return JSON.parse(result.stdout) as Result
}

const event = (at: number, entity: string, value: string, id: string): Step => ({ at, entity, state: value, id })
const qualify: Step[] = [
  { at: NOW, id: 'away_stable', platform: 'state', entity: F.presence, state: 'not_home' },
  { at: NOW + 35, id: 'deadline' },
]
const action = (at: number, user: string | null = OWNER, identifier = '$current', extra: HaRecord = {}): Step => ({
  at, id: 'notification_action',
  event: { event_type: 'mobile_app_notification_action', data: { action: identifier }, context: { user_id: user } },
  ...extra,
})
const notices = (result: Result) => result.calls.filter((call) => call.action === F.recipient && call.data.message !== 'clear_notification')
const clears = (result: Result) => result.calls.filter((call) => call.action === F.recipient && call.data.message === 'clear_notification')
const locks = (result: Result) => result.calls.filter((call) => call.action === 'lock.lock')
const payload = (call: Call) => call.data.data as HaRecord
const attention = (result: Result) => notices(result).filter((call) => (payload(call).push as HaRecord)['interruption-level'] === 'time-sensitive')

describe('emitted native front-door lifecycle', () => {
  it('uses restoring helpers, serialized short runs, and no camera/motion ownership', () => {
    const config = frontDoorUnsecuredController()
    expect(config.mode).toBe('queued')
    expect(config.conditions).toEqual([])
    expect(JSON.stringify(config)).not.toMatch(/critical|camera-front-door|camera_proxy|is_front_door_auto_locking|wait_for_trigger|wait_template|"delay"/)
    expect(config.triggers.some((trigger) => trigger.entity_id === F.lock && trigger.to === null)).toBe(true)
    expect(frontDoorUnsecuredHelpers).toHaveLength(7)
    frontDoorUnsecuredHelpers.forEach((helper) => expect(helper.config).not.toHaveProperty('initial'))
    expect(frontDoorUnsecuredReconciler().mode).toBe('restart')
  })

  it.each(Array.from({ length: 8 }, (_, bits) => bits))('honors guest truth table %i', (bits) => {
    const states = Object.fromEntries(F.guests.map((id, index) => [id, { state: bits & (1 << index) ? 'on' : 'off', last_changed: NOW - 100 }]))
    const result = run(qualify, states)
    expect(notices(result)).toHaveLength(1)
    expect(attention(result)).toHaveLength(bits === 0 ? 1 : 0)
    expect((payload(notices(result)[0]).push as HaRecord).sound).toBe(bits === 0 ? 'default' : 'none')
    expect(notices(result)[0].data.message).not.toMatch(/nobody|everyone/i)
  })

  it('handles uncertain guest state quietly and explicit armed Away as a carve-out', () => {
    const result = run(qualify, { [F.guests[0]]: { state: 'unavailable' } })
    expect(attention(result)).toHaveLength(0)
    expect(notices(result)[0].data.message).toContain('Guest mode could not be confirmed')
    const armed = run(qualify, { [F.guests[0]]: { state: 'on' }, [F.alarm]: { state: 'armed_away' } })
    expect(attention(armed)).toHaveLength(1)
    expect(notices(armed)[0].data.message).toContain('armed Away')
  })

  it('leaves a triggered alarm to its existing owner', () => {
    expect(notices(run(qualify, { [F.alarm]: { state: 'triggered' } }))).toHaveLength(0)
  })

  it.each(['unknown', 'unavailable', 'locking', 'unlocking', 'jammed', 'locked'])('does not label %s as an unlocked exposure', (value) => {
    expect(notices(run(qualify, { [F.lock]: { state: value } }))).toHaveLength(0)
  })

  it('waits for stable away and a fresh continuous closed-unlocked interval', () => {
    const result = run([
      event(NOW, F.presence, 'not_home', 'presence'),
      { at: NOW + 29, id: 'deadline' },
      event(NOW + 30, F.presence, 'not_home', 'away_stable'),
      { at: NOW + 64, id: 'deadline' },
      { at: NOW + 65, id: 'deadline' },
    ], { [F.presence]: { state: 'home', last_changed: NOW - 100 } })
    expect(notices(result).map((call) => call.at)).toEqual([NOW + 65])
  })

  it('replays the September 5 sequence without journey-window duplicates', () => {
    const result = run([
      event(NOW + 21.757, F.lock, 'unlocked', 'lock'),
      event(NOW + 23.244, F.contact, 'on', 'contact'),
      event(NOW + 30.891, F.contact, 'off', 'contact'),
      { at: NOW + 56.944, id: 'deadline' },
      { at: NOW + 64.303, id: 'deadline' },
      { at: NOW + 66, id: 'deadline' },
      { at: NOW + 91.514, id: 'deadline' },
      { at: NOW + 180, id: 'deadline' },
      { at: NOW + 181, restart: true },
    ], { [F.lock]: { state: 'locked', last_changed: NOW - 100 } })
    expect(attention(result)).toHaveLength(1)
    expect(notices(result)).toHaveLength(1)
  })

  it('keeps guest changes within one tag and spends attention only once', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.guests[0], 'off', 'policy'),
      event(NOW + 45, F.guests[0], 'on', 'policy'),
      event(NOW + 50, F.guests[0], 'off', 'policy'),
    ], { [F.guests[0]]: { state: 'on', last_changed: NOW - 100 } })
    expect(attention(result)).toHaveLength(1)
    expect(new Set(notices(result).map((call) => payload(call).tag)).size).toBe(1)
    expect(clears(result)).toHaveLength(0)
    expect((payload(notices(result).at(-1)!).push as HaRecord).sound).toBe('none')
  })

  it('does not issue new away wording while resident presence is unknown', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.presence, 'unknown', 'presence'),
      event(NOW + 45, F.guests[0], 'off', 'policy'),
    ], { [F.guests[0]]: { state: 'on', last_changed: NOW - 100 } })
    expect(notices(result)).toHaveLength(1)
    expect(attention(result)).toHaveLength(0)
  })

  it('recalls the exact tag on confirmed lock, not on locking', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.lock, 'locking', 'lock'),
      event(NOW + 41, F.lock, 'locked', 'lock'),
    ])
    expect(clears(result)).toHaveLength(1)
    expect(clears(result)[0].at).toBe(NOW + 41)
    expect(payload(clears(result)[0]).tag).toBe(payload(notices(result)[0]).tag)
    expect(result.states[H.phase]).toBe('idle')
  })

  it('does not rearm on contact reopening or unavailable lock recovery', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.contact, 'on', 'contact'),
      event(NOW + 45, F.contact, 'off', 'contact'),
      event(NOW + 50, F.lock, 'unavailable', 'lock'),
      event(NOW + 55, F.lock, 'unlocked', 'lock'),
      { at: NOW + 200, id: 'deadline' },
    ])
    expect(attention(result)).toHaveLength(1)
    expect(new Set(notices(result).map((call) => payload(call).tag)).size).toBe(1)
    expect(clears(result)).toHaveLength(0)
  })

  it('creates a new incident after residents return and leave with the lock still unlocked', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.presence, 'home', 'presence'),
      event(NOW + 70, F.presence, 'home', 'home_stable'),
      event(NOW + 80, F.presence, 'not_home', 'presence'),
      event(NOW + 110, F.presence, 'not_home', 'away_stable'),
      { at: NOW + 145, id: 'deadline' },
    ])
    expect(attention(result)).toHaveLength(2)
    expect(new Set(notices(result).map((call) => payload(call).tag)).size).toBe(2)
    expect(clears(result)).toHaveLength(1)
  })

  it('creates a new incident for a later confirmed lock/unlock cycle', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.lock, 'locked', 'lock'),
      event(NOW + 41, F.lock, 'unlocked', 'lock'),
      { at: NOW + 76, id: 'deadline' },
    ])
    expect(attention(result)).toHaveLength(2)
    expect(payload(attention(result)[0]).tag).not.toBe(payload(attention(result)[1]).tag)
  })

  it('uses only Security URLs and an authenticated incident-bound lock action', () => {
    const result = run(qualify)
    const data = payload(notices(result)[0])
    expect(data.url).toBe(F.url)
    expect(data.clickAction).toBe(F.url)
    expect(data).not.toHaveProperty('image')
    expect(data.actions).toEqual([
      expect.objectContaining({ action: F.actionPrefix + result.states[H.incident], authenticationRequired: true }),
      expect.objectContaining({ action: 'URI', uri: F.url, title: 'Open Security' }),
    ])
  })

  it.each([null, '', 'different-user'])('rejects missing or wrong authenticated user %s', (user) => {
    expect(locks(run([...qualify, action(NOW + 40, user)]))).toHaveLength(0)
  })

  it('rejects stale actions and consumes a valid command before a repeat tap', () => {
    const result = run([
      ...qualify, action(NOW + 40, OWNER, 'FRONT_DOOR_LOCK_old'),
      action(NOW + 41), action(NOW + 42),
    ])
    expect(locks(result)).toHaveLength(1)
    expect(locks(result)[0].target).toBe(F.lock)
    expect(result.states[H.phase]).toBe('lock_pending')
    const index = result.calls.findIndex((call) => call.action === 'lock.lock')
    expect(result.calls.slice(0, index).at(-1)?.action).toBe('homeassistant.save_persistent_states')
  })

  it('rejects open-contact actions without operating later when the door closes', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.contact, 'on', 'contact'),
      action(NOW + 41),
      event(NOW + 42, F.contact, 'off', 'contact'),
    ])
    expect(locks(result)).toHaveLength(0)
  })

  it('rechecks contact safety after durable action consumption and never retries a cancelled command', () => {
    const result = run([
      ...qualify,
      action(NOW + 40, OWNER, '$current', { duringService: { action: 'homeassistant.save_persistent_states', entity: F.contact, state: 'on' } }),
      event(NOW + 41, F.contact, 'off', 'contact'),
      action(NOW + 42),
      { at: NOW + 70, restart: true },
    ])
    expect(locks(result)).toHaveLength(0)
    expect(result.states[H.phase]).toBe('lock_cancelled')
    expect(notices(result).filter((call) => String(call.data.message).includes('command was not sent'))).toHaveLength(1)
    expect(clears(result)).toHaveLength(0)
  })

  it('retires a stable return home before executing a queued notification action', () => {
    const result = run([
      ...qualify,
      { at: NOW + 40, entity: F.presence, state: 'home', run: false },
      action(NOW + 71),
    ])
    expect(locks(result)).toHaveLength(0)
    expect(clears(result)).toHaveLength(1)
  })

  it('rechecks the original action expiry and recipient identity after persistence', () => {
    const expired = run([
      ...qualify,
      action(NOW + 1834, OWNER, '$current', { duringService: { action: 'homeassistant.save_persistent_states', advanceSeconds: 2 } }),
    ])
    expect(locks(expired)).toHaveLength(0)
    expect(expired.states[H.phase]).toBe('lock_cancelled')
    const changedOwner = run([
      ...qualify,
      action(NOW + 40, OWNER, '$current', {
        duringService: { action: 'homeassistant.save_persistent_states', entity: F.person, state: { state: 'not_home', attributes: { user_id: 'changed-recipient' } } },
      }),
    ])
    expect(locks(changedOwner)).toHaveLength(0)
    expect(changedOwner.states[H.phase]).toBe('lock_cancelled')
  })

  it('does not shorten sequential away and door qualification after delayed presence events', () => {
    const result = run([
      event(NOW, F.presence, 'not_home', 'presence'),
      event(NOW + 30, F.presence, 'not_home', 'away_stable'),
      { at: NOW + 32, entity: F.presence, state: 'unknown', run: false },
      { at: NOW + 33, entity: F.presence, state: 'not_home', run: false },
      { at: NOW + 64, id: 'presence', trigger: {
        platform: 'state', entity_id: F.presence,
        from_state: { state: 'not_home', last_changed: NOW },
        to_state: { state: 'unknown', last_changed: NOW + 32 },
      } },
      { at: NOW + 65, id: 'deadline' },
      { at: NOW + 98, id: 'deadline' },
      { at: NOW + 100, id: 'deadline' },
    ], { [F.presence]: { state: 'home', last_changed: NOW - 100 } })
    expect(attention(result)).toHaveLength(1)
    expect(attention(result)[0].at).toBe(NOW + 100)
  })

  it('reports one passive failure after the command deadline and never retries on restart', () => {
    const result = run([
      ...qualify,
      action(NOW + 40, OWNER, '$current', { failService: 'lock.lock' }),
      { at: NOW + 50, restart: true },
      { at: NOW + 60, id: 'deadline' },
      { at: NOW + 61, id: 'deadline' },
      action(NOW + 62),
    ])
    expect(locks(result)).toHaveLength(1)
    expect(result.states[H.phase]).toBe('lock_failed')
    expect(notices(result).filter((call) => call.data.title === 'Front Door · Lock Not Confirmed')).toHaveLength(1)
    expect(clears(result)).toHaveLength(0)
  })

  it('clears a fast confirmed lock and handles already-locked action races without another command', () => {
    const confirmed = run([...qualify, action(NOW + 40, OWNER, '$current', { confirmLock: true })])
    expect(locks(confirmed)).toHaveLength(1)
    expect(clears(confirmed)).toHaveLength(1)
    const already = run([...qualify, { at: NOW + 40, entity: F.lock, state: 'locked', run: false }, action(NOW + 41)])
    expect(locks(already)).toHaveLength(0)
    expect(clears(already)).toHaveLength(1)
  })

  it('expires the action after 30 minutes without resolving the incident', () => {
    const result = run([...qualify, { at: NOW + 1835, id: 'deadline' }, action(NOW + 1840)])
    expect(locks(result)).toHaveLength(0)
    expect(result.states[H.phase]).toBe('expired')
    expect(payload(notices(result).at(-1)!).actions).toEqual([expect.objectContaining({ action: 'URI', uri: F.url })])
    expect(clears(result)).toHaveLength(0)
  })

  it('makes recovery passive and never repeats a reserved submission after a crash', () => {
    expect(attention(run([{ at: NOW }, { at: NOW + 35, id: 'deadline' }]))).toHaveLength(0)
    const result = run([
      qualify[0],
      { ...qualify[1], crashAfterService: F.recipient },
      { at: NOW + 36, restart: true },
    ])
    expect(notices(result)).toHaveLength(1)
  })

  it('recalls a lock that arrives while notification submission is in progress', () => {
    const result = run([
      qualify[0],
      { ...qualify[1], duringService: { action: F.recipient, entity: F.lock, state: 'locked' } },
    ])
    expect(clears(result)).toHaveLength(1)
    expect(payload(clears(result)[0]).tag).toBe(payload(notices(result)[0]).tag)
  })

  it('requalifies an unissued notice if the lock becomes unavailable before submission', () => {
    const result = run([
      qualify[0],
      { ...qualify[1], duringService: { action: 'homeassistant.save_persistent_states', entity: F.lock, state: 'unavailable' } },
      event(NOW + 40, F.lock, 'unlocked', 'lock'),
      { at: NOW + 75, id: 'deadline' },
    ])
    expect(notices(result)).toHaveLength(1)
    expect(notices(result)[0].at).toBe(NOW + 75)
    expect(attention(result)).toHaveLength(1)
  })

  it('honors a queued lock proof but never lets it retire a newer exposure', () => {
    const delayedLock = {
      platform: 'state', entity_id: F.lock,
      to_state: { state: 'locked', last_changed: NOW + 40 },
      from_state: { state: 'unlocked', last_changed: NOW - 100 },
    }
    const result = run([
      ...qualify,
      { at: NOW + 40, entity: F.lock, state: 'locked', run: false },
      { at: NOW + 41, entity: F.lock, state: 'unlocked', run: false },
      { at: NOW + 42, id: 'lock', trigger: delayedLock },
      { at: NOW + 77, id: 'deadline' },
      { at: NOW + 80, id: 'lock', trigger: delayedLock },
    ])
    expect(clears(result)).toHaveLength(1)
    expect(attention(result)).toHaveLength(2)
    expect(result.states[H.phase]).toBe('active')
    expect(payload(clears(result)[0]).tag).toBe(payload(attention(result)[0]).tag)
    expect(payload(attention(result)[1]).tag).not.toBe(payload(clears(result)[0]).tag)
  })

  it('preserves a newer tag when startup retries the previous retired clear', () => {
    const result = run([
      ...qualify,
      event(NOW + 40, F.lock, 'locked', 'lock'),
      event(NOW + 41, F.lock, 'unlocked', 'lock'),
      { at: NOW + 76, id: 'deadline' },
      { at: NOW + 80, restart: true },
    ])
    expect(attention(result)).toHaveLength(2)
    expect(notices(result)).toHaveLength(2)
    expect(clears(result)).toHaveLength(2)
    expect(payload(clears(result)[1]).tag).toBe(payload(attention(result)[0]).tag)
    expect(payload(clears(result)[1]).tag).not.toBe(payload(attention(result)[1]).tag)
  })
})
