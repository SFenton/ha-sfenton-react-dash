import { describe, expect, it } from 'vitest'
import {
  HOT_FLASH,
  HOT_FLASH_SHARED_PHASES,
  HOT_FLASH_SIDE_PHASES,
  HOT_FLASH_TARGET_WRAPPERS,
  HOT_FLASH_TRANSITION_CONTRACT,
  hotFlashBroker,
  hotFlashFeedbackScript,
  hotFlashHelpers,
  hotFlashRecoveryAutomations,
  hotFlashRecoveryConfig,
  hotFlashRecoveryScripts,
  type HaRecord,
} from './hotFlashRecoveryConfig'

const REQUESTERS = { left: 'sanitized-left-requester', right: 'sanitized-right-requester' }

const containsAction = (value: unknown, action: string): boolean => {
  if (Array.isArray(value)) return value.some((item) => containsAction(item, action))
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.action === action || Object.values(record).some((item) => containsAction(item, action))
}

const actionNames = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(actionNames)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  return [
    ...(typeof record.action === 'string' ? [record.action] : []),
    ...Object.values(record).flatMap(actionNames),
  ]
}

function originalWrapper(id: string): HaRecord {
  const wrapper = HOT_FLASH_TARGET_WRAPPERS.find((candidate) => candidate.id === id)
  if (!wrapper) throw new Error(`Unknown wrapper ${id}`)
  const schedule = HOT_FLASH.sides[wrapper.side].schedulePhase
  const guard = wrapper.phase === 'tonight'
    ? { condition: 'state', entity_id: schedule, state: ['bedtime', 'asleep', 'dawn'] }
    : wrapper.phase === 'outside_schedule'
      ? { condition: 'state', entity_id: schedule, state: 'outside' }
      : { condition: 'state', entity_id: schedule, state: wrapper.phase }
  const recurring = wrapper.phase === 'tonight' || wrapper.phase === 'outside_schedule'
    ? []
    : [{
        action: 'input_number.set_value',
        target: { entity_id: `input_number.eight_sleep_${wrapper.owner}_${wrapper.phase}_level` },
        data: { value: '{{ level }}' },
      }]
  return {
    alias: `Preserved ${id}`,
    description: `Preserved description ${id}`,
    icon: 'mdi:test-tube',
    mode: 'restart',
    fields: {
      level: {
        name: 'Target level',
        description: 'Preserved field description.',
        required: true,
        selector: { number: { min: -10, max: 10, step: 1, mode: 'box' } },
      },
    },
    sequence: [
      guard,
      ...recurring,
      {
        action: 'number.set_value',
        target: { entity_id: HOT_FLASH.sides[wrapper.side].target },
        data: { value: '{{ level }}' },
      },
    ],
  }
}

describe('emitted SleepyPod Hot Flash recovery graph', () => {
  it('freezes the eleven-helper transition representation without token helpers', () => {
    expect(HOT_FLASH_TRANSITION_CONTRACT).toHaveLength(7)
    expect(hotFlashHelpers).toHaveLength(11)
    expect(hotFlashHelpers.filter((helper) => helper.domain === 'timer')).toHaveLength(2)
    expect(hotFlashHelpers.filter((helper) => helper.config.restore === true)).toHaveLength(2)
    expect(hotFlashHelpers.find((helper) => helper.id === 'sleepypod_hot_flash_left_phase')?.config.options).toEqual([...HOT_FLASH_SIDE_PHASES])
    expect(hotFlashHelpers.find((helper) => helper.id === 'sleepypod_hot_flash_shared_phase')?.config.options).toEqual([...HOT_FLASH_SHARED_PHASES])
    expect(hotFlashHelpers.find((helper) => helper.id === 'sleepypod_hot_flash_baseline_mode')?.config.options).toEqual(['heat', 'off'])
    expect(hotFlashHelpers.some((helper) => /token|generation/i.test(helper.id))).toBe(false)
    expect(hotFlashHelpers.map((helper) => String(helper.config.name).toLowerCase().replaceAll(' ', '_'))).toEqual(
      hotFlashHelpers.map((helper) => helper.id),
    )
  })

  it('emits one queued non-recursive broker with durable state before device I/O', () => {
    const broker = hotFlashBroker()
    const names = actionNames(broker.sequence)
    expect(broker.mode).toBe('queued')
    expect(broker.max).toBe(100)
    expect(broker.max_exceeded).toBe('error')
    expect(containsAction(broker.sequence, HOT_FLASH.broker)).toBe(false)
    expect(names).toContain('homeassistant.save_persistent_states')
    expect(names).toContain('number.set_value')
    expect(names).toContain('climate.set_hvac_mode')
    expect(JSON.stringify(broker)).toContain('as_timestamp(now()) + 2700')
    expect(JSON.stringify(broker)).toContain('as_timestamp(now()) + 900')
    expect(JSON.stringify(broker)).toContain('from_state_name')
    expect(JSON.stringify(broker)).not.toContain('script.turn_on')
  })

  it('transforms all ten fresh live wrappers without changing metadata, guards, fields, or recurring-write ordering', () => {
    const originals = Object.fromEntries(HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => [
      `script.${wrapper.id}`,
      originalWrapper(wrapper.id),
    ]))
    const scripts = hotFlashRecoveryScripts(originals)
    expect(Object.keys(scripts)).toEqual([
      HOT_FLASH.feedbackId,
      ...HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => wrapper.id),
    ])
    for (const wrapper of HOT_FLASH_TARGET_WRAPPERS) {
      const original = originals[`script.${wrapper.id}`]
      const transformed = scripts[wrapper.id]
      expect(transformed.alias).toBe(original.alias)
      expect(transformed.description).toBe(original.description)
      expect(transformed.icon).toBe(original.icon)
      expect(transformed.mode).toBe('restart')
      expect(transformed.fields).toEqual(original.fields)
      expect((transformed.sequence as HaRecord[])[0]).toEqual((original.sequence as HaRecord[])[0])
      const sequence = transformed.sequence as HaRecord[]
      if (wrapper.phase === 'tonight' || wrapper.phase === 'outside_schedule') {
        expect(sequence).toHaveLength(2)
      } else {
        expect(sequence).toHaveLength(3)
        expect(sequence[1]).toEqual((original.sequence as HaRecord[])[1])
      }
      expect(sequence.at(-1)?.action).toBe(HOT_FLASH.broker)
      expect(JSON.stringify(transformed)).not.toContain('script.turn_on')
    }
  })

  it('refuses to transform a wrapper whose live contract drifted', () => {
    const original = originalWrapper('sleepypod_stephen_temperature_tonight')
    original.sequence = [...original.sequence as HaRecord[], { action: 'notify.notify' }]
    expect(() => hotFlashRecoveryScripts({
      'script.sleepypod_stephen_temperature_tonight': original,
    })).toThrow(/changed shape/)

    const guardDrift = originalWrapper('sleepypod_stephen_temperature_tonight')
    ;(guardDrift.sequence as HaRecord[])[0] = {
      condition: 'state',
      entity_id: HOT_FLASH.sides.left.schedulePhase,
      state: 'outside',
    }
    expect(() => hotFlashRecoveryScripts({
      'script.sleepypod_stephen_temperature_tonight': guardDrift,
    })).toThrow(/schedule guard/)

    const recurringDrift = originalWrapper('sleepypod_stephen_bedtime_temperature_all_nights')
    ;((recurringDrift.sequence as HaRecord[])[1].target as HaRecord).entity_id = 'input_number.wrong_stage'
    expect(() => hotFlashRecoveryScripts({
      'script.sleepypod_stephen_bedtime_temperature_all_nights': recurringDrift,
    })).toThrow(/recurring write contract/)
  })

  it('covers deadline, timer, report, reconnect, startup, reload, watchdog, and delayed-startup entry points', () => {
    const automations = hotFlashRecoveryAutomations(REQUESTERS)
    expect(automations.map((automation) => automation.id)).toEqual([
      'sleepypod_hot_flash_state_reconciler',
      'sleepypod_hot_flash_startup_followup',
      'eight_sleep_stephen_hot_flash_mode',
      'eight_sleep_steph_hot_flash_mode',
    ])
    const reconciler = automations[0]
    const triggers = reconciler.triggers as HaRecord[]
    expect(triggers.filter((trigger) => String(trigger.id).endsWith('_target')).map((trigger) => trigger.for)).toEqual([
      '00:00:05',
      '00:00:05',
    ])
    expect(triggers.filter((trigger) => String(trigger.id).endsWith('_climate')).map((trigger) => trigger.for)).toEqual([
      '00:00:05',
      '00:00:05',
    ])
    expect(triggers.filter((trigger) => trigger.trigger === 'time').map((trigger) => trigger.at)).toEqual([
      HOT_FLASH.helpers.leftRestoreAt,
      HOT_FLASH.helpers.rightRestoreAt,
    ])
    expect(triggers.filter((trigger) => trigger.event_type === 'timer.finished').map((trigger) => (trigger.event_data as HaRecord).entity_id)).toEqual([
      HOT_FLASH.helpers.leftTimer,
      HOT_FLASH.helpers.rightTimer,
    ])
    expect(triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ trigger: 'homeassistant', event: 'start' }),
      expect.objectContaining({ event_type: 'automation_reloaded' }),
      expect.objectContaining({ trigger: 'time_pattern', minutes: '/1' }),
    ]))
    expect(JSON.stringify(automations[1])).toContain('"seconds":30')
    expect(automations.every((automation) => containsAction(automation.actions, HOT_FLASH.broker))).toBe(true)
    expect(JSON.stringify(automations)).not.toContain('sleepypod_target_report')
  })

  it('uses an alarm-state-gated ten-second physical feedback command with no browser haptics or alarm clear', () => {
    const feedback = hotFlashFeedbackScript()
    const serialized = JSON.stringify(feedback)
    expect(feedback.mode).toBe('queued')
    expect(serialized).toContain('sleepypod/eight-pod/cmd/set-alarm')
    expect(serialized).toContain('"duration\\":10')
    expect(serialized).toContain(HOT_FLASH.sides.left.alarmState)
    expect(serialized).toContain(HOT_FLASH.sides.right.alarmState)
    expect(serialized).not.toContain('clear-alarm')
    expect(serialized).not.toContain('navigator.vibrate')
  })

  it('requires independently sourced requester projections and rejects unsafe bindings', () => {
    expect(hotFlashRecoveryConfig(REQUESTERS).requestedBy).toEqual(REQUESTERS)
    expect(hotFlashRecoveryConfig('sanitized-shared-requester').requestedBy).toEqual({
      left: 'sanitized-shared-requester',
      right: 'sanitized-shared-requester',
    })
    expect(() => hotFlashRecoveryConfig({ left: 'ok', right: 'bad\0value' })).toThrow()
  })
})
