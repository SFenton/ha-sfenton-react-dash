import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HOT_FLASH,
  hotFlashRecoveryConfig,
  type HaRecord,
  type HotFlashAction,
  type HotFlashSide,
} from './hotFlashRecoveryConfig'

// @covers scripts/fixtures/front-door-unsecured/ha_runtime.py
const runtime = resolve('scripts/fixtures/front-door-unsecured/ha_runtime.py')
const NOW = 1_800_000_000
const generated = hotFlashRecoveryConfig({
  left: 'sanitized-left-requester',
  right: 'sanitized-right-requester',
})
const scripts = {
  [HOT_FLASH.broker]: generated.broker,
  ...Object.fromEntries(Object.entries(generated.scripts).map(([id, config]) => [`script.${id}`, config])),
}

interface RuntimeCall {
  action: string
  at: number
  data: Record<string, unknown>
  target?: string
}

interface RuntimeResult {
  calls: RuntimeCall[]
  coverage: string[]
  states: Record<string, string>
}

function run(states: Record<string, unknown>, steps: Record<string, unknown>[]): RuntimeResult {
  const result = spawnSync('python', ['-B', runtime], {
    input: JSON.stringify({
      config: { actions: [] },
      scripts,
      now: NOW,
      states,
      steps,
    }),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return JSON.parse(result.stdout) as RuntimeResult
}

const state = (value: string, attributes: Record<string, unknown> = {}) => ({
  state: value,
  attributes,
  last_changed: NOW - 1000,
})

function baseStates() {
  return {
    [HOT_FLASH.sides.left.alarmState]: state('idle'),
    [HOT_FLASH.sides.right.alarmState]: state('idle'),
    [HOT_FLASH.sides.left.climate]: state('off', { current_temperature: 70 }),
    [HOT_FLASH.sides.right.climate]: state('off', { current_temperature: 70 }),
    [HOT_FLASH.sides.left.currentTemperature]: state('70'),
    [HOT_FLASH.sides.right.currentTemperature]: state('70'),
    [HOT_FLASH.sides.left.target]: state('2'),
    [HOT_FLASH.sides.right.target]: state('1'),
    [HOT_FLASH.sides.left.schedulePhase]: state('bedtime'),
    [HOT_FLASH.sides.right.schedulePhase]: state('bedtime'),
    [HOT_FLASH.helpers.leftPhase]: state('idle'),
    [HOT_FLASH.helpers.leftTargetPayload]: state('0'),
    [HOT_FLASH.helpers.leftRestoreAt]: state('1970-01-01 00:00:00', { timestamp: 0 }),
    [HOT_FLASH.helpers.leftTimer]: state('idle'),
    [HOT_FLASH.helpers.rightPhase]: state('idle'),
    [HOT_FLASH.helpers.rightTargetPayload]: state('0'),
    [HOT_FLASH.helpers.rightRestoreAt]: state('1970-01-01 00:00:00', { timestamp: 0 }),
    [HOT_FLASH.helpers.rightTimer]: state('idle'),
    [HOT_FLASH.helpers.sharedPhase]: state('idle'),
    [HOT_FLASH.helpers.baselineMode]: state('off'),
    [HOT_FLASH.helpers.desiredMode]: state('off'),
    [HOT_FLASH.legacy.leftActive]: state('off'),
    [HOT_FLASH.legacy.rightActive]: state('off'),
    [HOT_FLASH.legacy.leftRequestedBy]: state(''),
    [HOT_FLASH.legacy.rightRequestedBy]: state(''),
    'input_number.eight_sleep_stephen_bedtime_level': state('2'),
    'input_number.eight_sleep_stephen_asleep_level': state('1'),
    'input_number.eight_sleep_stephen_dawn_level': state('0'),
    'input_number.eight_sleep_steph_bedtime_level': state('1'),
    'input_number.eight_sleep_steph_asleep_level': state('0'),
    'input_number.eight_sleep_steph_dawn_level': state('-1'),
  }
}

function brokerAction(action: HotFlashAction, side: HotFlashSide | 'shared' = 'left', extra: HaRecord = {}) {
  return [{
    action: HOT_FLASH.broker,
    data: { action, side, ...extra },
  }]
}

function brokerStep(
  action: HotFlashAction,
  side: HotFlashSide | 'shared' = 'left',
  extra: HaRecord = {},
  step: HaRecord = {},
) {
  return { at: NOW, ...step, actions: brokerAction(action, side, extra) }
}

const targetCalls = (result: RuntimeResult, sideName: HotFlashSide) => result.calls.filter(
  (call) => call.action === 'number.set_value' && call.target === HOT_FLASH.sides[sideName].target,
)
const modeCalls = (result: RuntimeResult) => result.calls.filter((call) => call.action === 'climate.set_hvac_mode')
const feedbackCalls = (result: RuntimeResult) => result.calls.filter(
  (call) => call.action === 'mqtt.publish'
    && call.data.topic === 'sleepypod/eight-pod/cmd/set-alarm',
)

describe('generated Hot Flash graph in the network-disabled HA interpreter', () => {
  it('admits the first side atomically, captures the shared baseline once, and persists before device I/O', () => {
    const result = run(baseStates(), [
      brokerStep('activate', 'left', { requested_by: 'sanitized-left-requester' }),
    ])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('cooling')
    expect(Number(result.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(2)
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('leased')
    expect(result.states[HOT_FLASH.helpers.baselineMode]).toBe('off')
    expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('heat')
    expect(result.states[HOT_FLASH.legacy.leftActive]).toBe('on')
    expect(result.states[HOT_FLASH.legacy.leftRequestedBy]).toBe('sanitized-left-requester')
    const save = result.calls.findIndex((call) => call.action === 'homeassistant.save_persistent_states')
    const firstMode = result.calls.findIndex((call) => call.action === 'climate.set_hvac_mode')
    const target = result.calls.findIndex((call) => call.action === 'number.set_value')
    expect(save).toBeGreaterThanOrEqual(0)
    expect(save).toBeLessThan(firstMode)
    expect(firstMode).toBeLessThan(target)
    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([-10])
    expect(modeCalls(result).map((call) => call.data.hvac_mode)).toEqual(['heat', 'heat'])
  })

  it('fails closed on incoherent admission and makes no partial helper or device changes', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('off'),
    }
    const result = run(states, [brokerStep('activate', 'left')])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('idle')
    expect(result.calls.filter((call) => call.action.startsWith('input_'))).toEqual([])
    expect(targetCalls(result, 'left')).toEqual([])
    expect(modeCalls(result)).toEqual([])
  })

  it('keeps duplicate activation idempotent without extending deadlines or reissuing commands', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.helpers.leftPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:45:00', { timestamp: NOW + 2700 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
    }
    const result = run(states, [brokerStep('activate', 'left')])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('cooling')
    expect(result.calls.filter((call) => call.action === 'input_datetime.set_datetime')).toEqual([])
    expect(result.calls.filter((call) => call.action === 'timer.start')).toEqual([])
    expect(targetCalls(result, 'left')).toEqual([])
    expect(modeCalls(result)).toEqual([])
  })

  it('supports simultaneous or staggered sides without recapturing the first shared baseline', () => {
    const result = run(baseStates(), [
      brokerStep('activate', 'left', { requested_by: 'left' }),
      brokerStep('activate', 'right', { requested_by: 'right' }, { at: NOW + 1 }),
    ])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('cooling')
    expect(result.states[HOT_FLASH.helpers.rightPhase]).toBe('cooling')
    expect(Number(result.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(2)
    expect(Number(result.states[HOT_FLASH.helpers.rightTargetPayload])).toBe(1)
    expect(result.states[HOT_FLASH.helpers.baselineMode]).toBe('off')
    expect(result.calls.filter((call) => (
      call.action === 'input_select.select_option'
      && call.target === HOT_FLASH.helpers.baselineMode
    ))).toHaveLength(1)
    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([-10])
    expect(targetCalls(result, 'right').map((call) => call.data.value)).toEqual([-10])
  })

  it('starts one non-extending hold only below both strict threshold edges', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat', { current_temperature: 55 }),
      [HOT_FLASH.sides.right.climate]: state('heat', { current_temperature: 70 }),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:45:00', { timestamp: NOW + 2700 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
    }
    const result = run(states, [
      brokerStep('reconcile', 'left', { report_kind: 'temperature' }),
      brokerStep('reconcile', 'left', { report_kind: 'temperature' }, {
        at: NOW + 60,
        states: {
          [HOT_FLASH.sides.left.climate]: state('heat', { current_temperature: 54 }),
        },
      }),
    ])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('holding')
    expect(result.calls.filter((call) => call.action === 'timer.start')).toHaveLength(1)
    expect(result.calls.find((call) => call.action === 'timer.start')?.data.duration).toBe(900)
    expect(result.calls.filter((call) => call.action === 'input_datetime.set_datetime').map((call) => call.data.timestamp)).toEqual([NOW + 900])
  })

  it.each([
    ['target equality', '-9.5', 55],
    ['temperature equality', '-10', 56],
  ])('does not start the hold at the %s edge', (_label, target, temperature) => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat', { current_temperature: temperature }),
      [HOT_FLASH.sides.left.target]: state(target),
      [HOT_FLASH.helpers.leftPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:45:00', { timestamp: NOW + 2700 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
    }
    const result = run(states, [brokerStep('reconcile')])
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('cooling')
    expect(result.calls.filter((call) => call.action === 'timer.start')).toEqual([])
  })

  it('processes a due ceiling before a qualifying report and never restarts the hold', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat', { current_temperature: 55 }),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:00:00', { timestamp: NOW }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
    }
    const result = run(states, [brokerStep('reconcile', 'left', { report_kind: 'deadline' })])
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('restore_pending')
    expect(result.calls.filter((call) => call.action === 'timer.start')).toEqual([])
    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([2])
  })

  it('keeps restore obligations durable through failure and restart, then finalizes only on target and mode confirmation', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('holding'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:00:00', { timestamp: NOW }),
      [HOT_FLASH.helpers.leftTimer]: state('active'),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.baselineMode]: state('off'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
    }
    const result = run(states, [
      brokerStep('reconcile', 'left', { report_kind: 'deadline' }, { failService: 'number.set_value' }),
      brokerStep('reconcile', 'shared', { report_kind: 'startup' }, { at: NOW + 30, restart: true }),
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-10', to_state: '2' }, {
        at: NOW + 31,
        entity: HOT_FLASH.sides.left.target,
        state: '2',
      }),
      brokerStep('reconcile', 'left', { report_kind: 'climate', from_state: 'heat', to_state: 'off' }, {
        at: NOW + 32,
        states: {
          [HOT_FLASH.sides.left.climate]: state('off'),
          [HOT_FLASH.sides.right.climate]: state('off'),
        },
      }),
    ])

    expect(targetCalls(result, 'left')).toHaveLength(2)
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.legacy.leftActive]).toBe('off')
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('off')
  })

  it('protects a newer owned target from stale echoes and buzzes only the accepted manual command', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('holding'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:10:00', { timestamp: NOW + 600 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.baselineMode]: state('off'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
    }
    const result = run(states, [
      brokerStep('target', 'left', { level: 3 }),
      { at: NOW + 1, entity: HOT_FLASH.sides.left.target, state: '-9', run: false },
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-9', to_state: '-10' }, {
        at: NOW + 2,
        entity: HOT_FLASH.sides.left.target,
        state: '-10',
      }),
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-10', to_state: '3' }, {
        at: NOW + 3,
        entity: HOT_FLASH.sides.left.target,
        state: '3',
      }),
    ])

    expect(Number(result.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(3)
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('idle')
    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([3, 3])
    expect(feedbackCalls(result)).toHaveLength(1)
    expect(feedbackCalls(result)[0].data.payload).toContain('"side":"left"')
  })

  it('treats available-to-different target reports as external intent but reconnect reports as retry evidence', () => {
    const active = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('holding'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:10:00', { timestamp: NOW + 600 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
    }
    const external = run(active, [
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-10', to_state: '4' }, {
        entity: HOT_FLASH.sides.left.target,
        state: '4',
      }),
    ])
    expect(external.states[HOT_FLASH.helpers.leftPhase]).toBe('idle')
    expect(Number(external.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(4)
    expect(targetCalls(external, 'left')).toEqual([])

    const reconnect = run({
      ...active,
      [HOT_FLASH.sides.left.target]: state('unavailable'),
    }, [
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: 'unavailable', to_state: '-4' }, {
        entity: HOT_FLASH.sides.left.target,
        state: '-4',
      }),
    ])
    expect(reconnect.states[HOT_FLASH.helpers.leftPhase]).toBe('holding')
    expect(Number(reconnect.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(2)
    expect(targetCalls(reconnect, 'left').map((call) => call.data.value)).toEqual([-10])
  })

  it('reasserts the first side when a newly admitted second side causes a settled target echo', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.sides.right.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('cooling'),
      [HOT_FLASH.helpers.rightPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('-3'),
      [HOT_FLASH.helpers.rightTargetPayload]: state('-3'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:40:00', { timestamp: NOW + 1800 }),
      [HOT_FLASH.helpers.rightRestoreAt]: state('2027-01-15 09:54:50', { timestamp: NOW + 2690 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
      [HOT_FLASH.legacy.rightActive]: state('on'),
    }
    const result = run(states, [
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-10', to_state: '-3' }, {
        entity: HOT_FLASH.sides.left.target,
        state: '-3',
      }),
    ])

    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('cooling')
    expect(Number(result.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(-3)
    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([-10])
  })

  it('restores both independent side targets before applying one explicit bed-wide off intent', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.sides.left.target]: state('-10'),
      [HOT_FLASH.sides.right.target]: state('-10'),
      [HOT_FLASH.helpers.leftPhase]: state('holding'),
      [HOT_FLASH.helpers.rightPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.rightTargetPayload]: state('1'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:10:00', { timestamp: NOW + 600 }),
      [HOT_FLASH.helpers.rightRestoreAt]: state('2027-01-15 09:20:00', { timestamp: NOW + 1200 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.baselineMode]: state('heat'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
      [HOT_FLASH.legacy.leftActive]: state('on'),
      [HOT_FLASH.legacy.rightActive]: state('on'),
    }
    const result = run(states, [
      brokerStep('power_off', 'left'),
      brokerStep('reconcile', 'left', { report_kind: 'target', from_state: '-10', to_state: '2' }, {
        at: NOW + 1,
        entity: HOT_FLASH.sides.left.target,
        state: '2',
      }),
      brokerStep('reconcile', 'right', { report_kind: 'target', from_state: '-10', to_state: '1' }, {
        at: NOW + 2,
        entity: HOT_FLASH.sides.right.target,
        state: '1',
      }),
      brokerStep('reconcile', 'left', { report_kind: 'climate', from_state: 'heat', to_state: 'heat' }, {
        at: NOW + 2.5,
        states: {
          [HOT_FLASH.sides.left.climate]: state('heat'),
          [HOT_FLASH.sides.right.climate]: state('heat'),
        },
      }),
      brokerStep('reconcile', 'left', { report_kind: 'climate', from_state: 'heat', to_state: 'off' }, {
        at: NOW + 3,
        states: {
          [HOT_FLASH.sides.left.climate]: state('off'),
          [HOT_FLASH.sides.right.climate]: state('off'),
        },
      }),
    ])

    expect(targetCalls(result, 'left').map((call) => call.data.value)).toEqual([2])
    expect(targetCalls(result, 'right').length).toBeGreaterThanOrEqual(1)
    expect(targetCalls(result, 'right').every((call) => call.data.value === 1)).toBe(true)
    const firstModeIndex = result.calls.findIndex((call) => call.action === 'climate.set_hvac_mode')
    const lastTargetIndex = Math.max(
      ...result.calls.map((call, index) => call.action === 'number.set_value' ? index : -1),
    )
    expect(firstModeIndex).toBeGreaterThan(lastTargetIndex)
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.helpers.rightPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('idle')
    expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('off')
  })

  it('adopts a genuine settled external bed-wide climate change while no restoration is pending', () => {
    const result = run({
      ...baseStates(),
      [HOT_FLASH.sides.left.climate]: state('heat'),
      [HOT_FLASH.sides.right.climate]: state('heat'),
      [HOT_FLASH.helpers.sharedPhase]: state('idle'),
      [HOT_FLASH.helpers.baselineMode]: state('heat'),
      [HOT_FLASH.helpers.desiredMode]: state('heat'),
    }, [
      brokerStep('reconcile', 'left', { report_kind: 'climate', from_state: 'heat', to_state: 'off' }, {
        states: {
          [HOT_FLASH.sides.left.climate]: state('off'),
          [HOT_FLASH.sides.right.climate]: state('off'),
        },
      }),
    ])

    expect(result.states[HOT_FLASH.helpers.baselineMode]).toBe('off')
    expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('off')
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('idle')
  })

  it('keeps both side sessions active when explicit heat supersedes only shared mode intent', () => {
    const states = {
      ...baseStates(),
      [HOT_FLASH.helpers.leftPhase]: state('holding'),
      [HOT_FLASH.helpers.rightPhase]: state('cooling'),
      [HOT_FLASH.helpers.leftTargetPayload]: state('2'),
      [HOT_FLASH.helpers.rightTargetPayload]: state('1'),
      [HOT_FLASH.helpers.leftRestoreAt]: state('2027-01-15 09:10:00', { timestamp: NOW + 600 }),
      [HOT_FLASH.helpers.rightRestoreAt]: state('2027-01-15 09:20:00', { timestamp: NOW + 1200 }),
      [HOT_FLASH.helpers.sharedPhase]: state('leased'),
      [HOT_FLASH.helpers.baselineMode]: state('off'),
      [HOT_FLASH.helpers.desiredMode]: state('off'),
    }
    const result = run(states, [brokerStep('power_heat', 'right')])
    expect(result.states[HOT_FLASH.helpers.leftPhase]).toBe('holding')
    expect(result.states[HOT_FLASH.helpers.rightPhase]).toBe('cooling')
    expect(result.states[HOT_FLASH.helpers.baselineMode]).toBe('heat')
    expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('heat')
    expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('leased')
    expect(modeCalls(result).map((call) => call.data.hvac_mode)).toEqual(['heat', 'heat'])
  })

  it('executes the transformed Tonight and All Nights wrappers with one live command and one feedback pulse', () => {
    const tonight = run(baseStates(), [{
      at: NOW,
      actions: [{
        action: 'script.sleepypod_stephen_temperature_tonight',
        data: { level: 3 },
      }],
    }])
    expect(targetCalls(tonight, 'left').map((call) => call.data.value)).toEqual([3])
    expect(feedbackCalls(tonight)).toHaveLength(1)
    expect(tonight.calls.filter((call) => call.action === 'input_number.set_value' && call.target === 'input_number.eight_sleep_stephen_bedtime_level')).toEqual([])

    const allNights = run(baseStates(), [{
      at: NOW,
      actions: [{
        action: 'script.sleepypod_stephen_bedtime_temperature_all_nights',
        data: { level: 4 },
      }],
    }])
    const recurringIndex = allNights.calls.findIndex((call) => (
      call.action === 'input_number.set_value'
      && call.target === 'input_number.eight_sleep_stephen_bedtime_level'
    ))
    const liveIndex = allNights.calls.findIndex((call) => (
      call.action === 'number.set_value'
      && call.target === HOT_FLASH.sides.left.target
    ))
    expect(recurringIndex).toBeGreaterThanOrEqual(0)
    expect(liveIndex).toBeGreaterThan(recurringIndex)
    expect(targetCalls(allNights, 'left').map((call) => call.data.value)).toEqual([4])
    expect(feedbackCalls(allNights)).toHaveLength(1)
  })

  it('fails wrapper guards closed and skips physical feedback while an alarm is active', () => {
    const wrongPhase = {
      ...baseStates(),
      [HOT_FLASH.sides.left.schedulePhase]: state('outside'),
    }
    const guarded = run(wrongPhase, [{
      at: NOW,
      actions: [{
        action: 'script.sleepypod_stephen_temperature_tonight',
        data: { level: 3 },
      }],
    }])
    expect(targetCalls(guarded, 'left')).toEqual([])
    expect(feedbackCalls(guarded)).toEqual([])

    const alarmActive = {
      ...baseStates(),
      [HOT_FLASH.sides.left.alarmState]: state('ringing'),
    }
    const noBuzz = run(alarmActive, [brokerStep('target', 'left', { level: 3 })])
    expect(targetCalls(noBuzz, 'left').map((call) => call.data.value)).toEqual([3])
    expect(feedbackCalls(noBuzz)).toEqual([])
  })

  it('recovers safely after a crash at every activation helper, persistence, and command boundary', () => {
    const baseline = run(baseStates(), [
      brokerStep('activate', 'left', { requested_by: 'left' }),
    ])
    const nestedCalls = baseline.calls.slice(1)
    expect(nestedCalls.length).toBeGreaterThan(8)

    for (let callIndex = 2; callIndex <= baseline.calls.length; callIndex += 1) {
      const result = run(baseStates(), [
        brokerStep('activate', 'left', { requested_by: 'left' }, { crashAfterCall: callIndex }),
        brokerStep('reconcile', 'shared', { report_kind: 'startup' }, { at: NOW + 30, restart: true }),
      ])
      expect(['idle', 'cooling']).toContain(result.states[HOT_FLASH.helpers.leftPhase])
      if (result.states[HOT_FLASH.helpers.leftPhase] === 'cooling') {
        expect(Number(result.states[HOT_FLASH.helpers.leftTargetPayload])).toBe(2)
        expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('leased')
        expect(result.states[HOT_FLASH.helpers.desiredMode]).toBe('heat')
      } else {
        expect(result.states[HOT_FLASH.helpers.sharedPhase]).toBe('idle')
      }
    }
  })

  it('executes the explicit startup-plus-30-second automation against the emitted broker', () => {
    const followup = generated.automations.find((automation) => automation.id === 'sleepypod_hot_flash_startup_followup')
    if (!followup) throw new Error('Missing startup follow-up automation')
    const result = run(baseStates(), [{
      at: NOW,
      actions: followup.actions as HaRecord[],
      id: 'startup',
    }])
    const broker = result.calls.find((call) => call.action === HOT_FLASH.broker)
    expect(broker?.at).toBe(NOW + 30)
    expect(broker?.data).toMatchObject({ action: 'reconcile', report_kind: 'startup', side: 'shared' })
  })
})
