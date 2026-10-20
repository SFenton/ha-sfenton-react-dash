import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_BRANCHES, ELIGIBILITY_STATE_TEMPLATE, MASTER_BEDROOM_PBL as M,
  bedPauseEvidenceAutomation, eligibilityOptions, patchDaytimeRecovery, type HaRecord,
} from './masterBedroomPblRecoveryConfig'

const fixtures = resolve('scripts/fixtures/master-bedroom-pbl-recovery')
const harness = resolve(fixtures, 'ha_conditions.py')
const preChange = JSON.parse(readFileSync(resolve(fixtures, 'pre-change.json'), 'utf8')) as {
  daytimeRecovery: HaRecord
  eligibilityOptions: HaRecord
}
const original = preChange.daytimeRecovery
const patched = patchDaytimeRecovery(original)
const ORIGINAL_ELIGIBILITY = String(preChange.eligibilityOptions.state)

type Entity = { state: string; last_changed: string; attributes?: HaRecord }
type Case = { template: string } | { conditions: HaRecord[] }

function evaluate(now: string, states: Record<string, Entity>, cases: Case[], trigger: HaRecord = { id: 'periodic' }) {
  const result = spawnSync('python', ['-B', harness], {
    input: JSON.stringify({ now, states, cases, trigger }),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return JSON.parse(result.stdout) as Array<string | boolean>
}

const LONG_AGO = '2026-10-01T00:00:00-07:00'
const at = (time: string) => `${time}-07:00`

type Scenario = {
  pauseAt: string
  source: string
  left: [string, string]
  right: [string, string]
  stephenHome?: [string, string]
  stephHome?: [string, string]
  light?: [string, string]
  leaseState?: string
  wakeCancelledAt?: string
}

function states(scenario: Scenario, extra: Record<string, Entity> = {}): Record<string, Entity> {
  const entity = (state: string, since = LONG_AGO, attributes: HaRecord = {}): Entity => ({ state, last_changed: since, attributes })
  const pair = ([state, since]: [string, string]) => entity(state, since)
  return {
    [M.pbl]: entity('on', LONG_AGO, {
      automation_paused: true,
      external_override_policy: 'pause',
      external_override_at: new Date(scenario.pauseAt).toISOString().replace('Z', '+00:00'),
      external_override_source: scenario.source,
      control_lease_state: scenario.leaseState ?? 'inactive',
    }),
    [M.wakeLight]: entity('idle', LONG_AGO, scenario.wakeCancelledAt
      ? { last_cancellation: { at: scenario.wakeCancelledAt, outcome: 'cancelled_by_user' } }
      : { last_cancellation: null }),
    [M.leftSide]: pair(scenario.left),
    [M.rightSide]: pair(scenario.right),
    [M.stephenHome]: pair(scenario.stephenHome ?? ['on', LONG_AGO]),
    [M.stephHome]: pair(scenario.stephHome ?? ['on', LONG_AGO]),
    [M.light]: pair(scenario.light ?? ['off', scenario.pauseAt]),
    [M.manualOffAt]: entity('1970-01-01 00:00:00'),
    'input_select.master_bedroom_pbl_daytime_recovery_mode': entity('Live'),
    'input_boolean.vacation_mode': entity('off'),
    'input_boolean.guests_staying_in_guest_room': entity('off'),
    'input_boolean.guests_staying_in_music_room': entity('off'),
    'input_boolean.guests_staying_in_theater_room': entity('off'),
    'input_select.master_suite_lighting_mode': entity('normal'),
    'input_boolean.household_journey_startup_quarantine': entity('off'),
    'input_boolean.is_master_bedroom_presence_sensor_off': entity('on'),
    'input_boolean.is_master_bedroom_presence_sensor_on': entity('off'),
    'binary_sensor.nightcanvasrestful_left_presence': entity('unavailable'),
    'binary_sensor.nightcanvasrestful_right_presence': entity('unavailable'),
    'input_text.master_bedroom_pbl_recovery_last_decision': entity('Not evaluated'),
    'input_boolean.master_bedroom_pbl_adaptive_bed_fast_path_enabled': entity('on'),
    'input_boolean.master_bedroom_pbl_main_floor_vacuum_clear_stable': entity('on'),
    'group.household_presence': entity('home'),
    'alarm_control_panel.aqara_hub_m3_0056_security_system_2': entity('armed_home'),
    'binary_sensor.front_door_contact_sensor_contact': entity('off'),
    'binary_sensor.kitchen_door_contact_sensor_contact': entity('off'),
    'binary_sensor.dining_room_door_contact_sensor_contact': entity('off'),
    'binary_sensor.back_deck_doors': entity('off'),
    'cover.garage_left_door': entity('closed'),
    'cover.garage_right_door': entity('closed'),
    ...extra,
  }
}

const evidenceConditions = bedPauseEvidenceAutomation().conditions as HaRecord[]

function recordsEvidence(scenario: Scenario, trigger = 'pause') {
  return evaluate(scenario.pauseAt, states(scenario), [{ conditions: evidenceConditions }], { id: trigger })[0] === true
}

function recovers(config: HaRecord, template: string, scenario: Scenario, now: string, evidence: boolean) {
  const override = String((states(scenario)[M.pbl].attributes as HaRecord).external_override_at)
  const bedPause = { [M.bedPause]: { state: evidence ? override : '', last_changed: scenario.pauseAt } }
  const [eligible] = evaluate(now, states(scenario, bedPause), [{ template }])
  const choose = ((config.actions as HaRecord[])[0].choose as HaRecord[])
  const withEligibility = states(scenario, { ...bedPause, [M.eligible]: { state: eligible === 'True' ? 'on' : 'off', last_changed: now } })
  const results = evaluate(now, withEligibility, choose.map((branch) => ({
    conditions: [...(config.conditions as HaRecord[]), ...(branch.conditions as HaRecord[])],
  })))
  const branch = results.findIndex(Boolean)
  return { eligible: eligible === 'True', branch: branch < 0 ? null : String(choose[branch].alias) }
}

const fixed = (scenario: Scenario, now: string, evidence: boolean) => recovers(patched, ELIGIBILITY_STATE_TEMPLATE, scenario, now, evidence)
const before = (scenario: Scenario, now: string) => recovers(original, ORIGINAL_ELIGIBILITY, scenario, now, false)

describe('master-bedroom PBL bed-clear recovery', () => {
  it.each([
    {
      name: 'Oct 12: HomeKit all-off at wake while both residents were in bed',
      scenario: { pauseAt: at('2026-10-12T05:55:10'), source: 'homekit_batch', left: ['on', at('2026-10-11T22:40:00')], right: ['on', at('2026-10-11T22:40:00')] },
      clearAt: at('2026-10-12T08:19:00'), clear: { left: ['off', at('2026-10-12T08:18:30')], right: ['off', at('2026-10-12T08:18:30')] },
      branch: ADAPTIVE_BRANCHES.bothHome,
    },
    {
      name: 'Oct 14: HomeKit single-off at 06:39 while the right side was occupied',
      scenario: { pauseAt: at('2026-10-14T06:39:10'), source: 'homekit_single', left: ['off', at('2026-10-14T06:20:00')], right: ['on', at('2026-10-13T22:40:00')] },
      clearAt: at('2026-10-14T07:45:00'), clear: { left: ['off', at('2026-10-14T06:20:00')], right: ['off', at('2026-10-14T07:44:30')] },
      branch: ADAPTIVE_BRANCHES.bothHome,
    },
    {
      name: 'Oct 18: dashboard off at 00:17 with an unknown source while both were in bed',
      scenario: { pauseAt: at('2026-10-18T00:17:10'), source: 'unknown', left: ['on', at('2026-10-17T23:50:00')], right: ['on', at('2026-10-17T23:50:00')] },
      clearAt: at('2026-10-18T09:20:00'), clear: { left: ['off', at('2026-10-18T09:19:30')], right: ['off', at('2026-10-18T09:19:30')] },
      branch: ADAPTIVE_BRANCHES.bothHome,
    },
    {
      name: 'Oct 19: dashboard off at 05:53 while the right side was occupied',
      scenario: { pauseAt: at('2026-10-19T05:53:10'), source: 'unknown', left: ['off', at('2026-10-19T05:40:00')], right: ['on', at('2026-10-18T22:30:00')] },
      clearAt: at('2026-10-19T07:45:00'), clear: { left: ['off', at('2026-10-19T05:40:00')], right: ['off', at('2026-10-19T07:44:30')] },
      branch: ADAPTIVE_BRANCHES.bothHome,
    },
    {
      name: 'Oct 20: wake end_episode turned lights off after leaving bed; away resident side stuck on',
      scenario: {
        pauseAt: at('2026-10-20T06:03:58'), source: 'unknown', left: ['off', at('2026-10-20T06:01:00')], right: ['on', at('2026-10-19T22:48:00')],
        stephHome: ['off', at('2026-10-20T05:22:00')], wakeCancelledAt: '2026-10-20T13:03:56.641863+00:00',
      },
      clearAt: at('2026-10-20T06:10:00'), clear: {},
      branch: ADAPTIVE_BRANCHES.oneHome,
    },
  ] as Array<{ name: string; scenario: Scenario; clearAt: string; clear: Partial<Scenario>; branch: string }>)('$name', ({ scenario, clearAt, clear, branch }) => {
    const evidence = recordsEvidence(scenario)
    expect(evidence).toBe(true)
    const cleared = { ...scenario, ...clear }
    expect(before(cleared, clearAt)).toEqual({ eligible: false, branch: null })
    expect(fixed(cleared, clearAt, evidence)).toEqual({ eligible: true, branch })
  })

  it('Oct 15: recovers an eligible overnight pause even though the lights came back on after a failed wake', () => {
    const scenario: Scenario = {
      pauseAt: at('2026-10-14T22:25:10'), source: 'homekit_batch',
      left: ['off', at('2026-10-15T08:01:50')], right: ['off', at('2026-10-15T08:01:50')], light: ['on', at('2026-10-15T06:45:00')],
    }
    expect(before(scenario, at('2026-10-15T08:02:30'))).toEqual({ eligible: true, branch: null })
    expect(fixed(scenario, at('2026-10-15T08:02:30'), false)).toEqual({ eligible: true, branch: ADAPTIVE_BRANCHES.bothHome })
    expect(fixed({ ...scenario, leaseState: 'active' }, at('2026-10-15T08:02:30'), false).branch).toBeNull()
    expect(fixed({ ...scenario, light: ['on', at('2026-10-15T08:02:00')] }, at('2026-10-15T08:02:30'), false).branch).toBeNull()
  })

  it('records evidence when the wake cancellation attribute lands after the pause', () => {
    const scenario: Scenario = {
      pauseAt: at('2026-10-20T06:03:58'), source: 'unknown', left: ['off', LONG_AGO], right: ['off', LONG_AGO], wakeCancelledAt: '2026-10-20T13:04:20+00:00',
    }
    expect(recordsEvidence(scenario, 'wake_cancelled')).toBe(true)
    expect(recordsEvidence({ ...scenario, wakeCancelledAt: '2026-10-20T13:02:30+00:00' })).toBe(false)
  })

  it('keeps a deliberate lights-off paused when no home resident is in bed', () => {
    const outOfBed: Scenario = { pauseAt: at('2026-10-20T10:00:00'), source: 'homekit_single', left: ['off', LONG_AGO], right: ['off', LONG_AGO] }
    expect(recordsEvidence(outOfBed)).toBe(false)
    expect(fixed(outOfBed, at('2026-10-20T10:30:00'), false)).toEqual({ eligible: false, branch: null })
    const awaySideStuck: Scenario = { ...outOfBed, right: ['on', LONG_AGO], stephHome: ['off', LONG_AGO] }
    expect(recordsEvidence(awaySideStuck)).toBe(false)
  })

  it('does not resume from stale evidence, at night, or while a home resident is still in bed', () => {
    const scenario: Scenario = {
      pauseAt: at('2026-10-19T05:53:10'), source: 'unknown', left: ['off', at('2026-10-19T05:40:00')], right: ['on', at('2026-10-18T22:30:00')],
    }
    expect(recordsEvidence(scenario)).toBe(true)
    const cleared: Scenario = { ...scenario, right: ['off', at('2026-10-19T07:44:30')] }
    expect(fixed(cleared, at('2026-10-19T08:00:00'), true).branch).toBe(ADAPTIVE_BRANCHES.bothHome)
    expect(fixed(cleared, at('2026-10-20T00:30:00'), true).eligible).toBe(false)
    expect(fixed(cleared, at('2026-10-19T20:30:00'), true)).toEqual({ eligible: true, branch: null })
    expect(fixed(scenario, at('2026-10-19T08:00:00'), true).branch).toBeNull()
  })

  it('is idempotent and refuses drifted configurations', () => {
    expect(patchDaytimeRecovery(patched)).toEqual(patched)
    const drifted = structuredClone(original)
    drifted.conditions = (drifted.conditions as HaRecord[]).filter((condition) => condition.entity_id !== M.light)
    expect(() => patchDaytimeRecovery(drifted)).toThrow('light gate drifted')
    expect(eligibilityOptions(preChange.eligibilityOptions).state).toBe(ELIGIBILITY_STATE_TEMPLATE)
    expect(() => eligibilityOptions({ ...preChange.eligibilityOptions, state: '{{ true }}' })).toThrow('drifted')
  })
})
