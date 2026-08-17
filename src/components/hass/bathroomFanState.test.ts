import { describe, expect, it } from 'vitest'
import { BATHROOM_FANS } from '../../constants/bathroomFans'
import { bathroomFanServiceCall, normalizeBathroomFanTimerMinutes } from './bathroomFanState'

describe('bathroom fan state and service matrix', () => {
  it('keeps the exact guest and master Home Assistant contract', () => {
    expect(BATHROOM_FANS.guest).toEqual({
      autoUnlockEntityId: 'input_boolean.guest_bathroom_fan_timer_auto_unlock',
      deadlineEntityId: 'input_datetime.guest_bathroom_fan_timer_ends_at',
      hash: '#fan-guest-bathroom',
      humidityEntityId: 'sensor.guest_bathroom_presence_sensor_humidity_2',
      id: 'guest',
      lockEntityId: 'input_boolean.guest_bathroom_fan_automation_lock',
      occupancyEntityId: 'binary_sensor.guest_bathroom_occupancy_sensors',
      pendingEntityId: 'input_boolean.guest_bathroom_fan_timer_pending',
      powerEntityId: 'switch.guest_bathroom_fan_switch_top',
      scriptService: 'guest_bathroom_fan_command',
      temperatureColorEntityId: 'input_text.guest_bathroom_climate_color',
      temperatureRangeEntityId: 'input_text.guest_bathroom_climate_range',
      timerEntityId: 'timer.guest_bathroom_fan_off_timer',
    })
    expect(BATHROOM_FANS.master).toEqual({
      autoUnlockEntityId: 'input_boolean.master_bathroom_fan_timer_auto_unlock',
      deadlineEntityId: 'input_datetime.master_bathroom_fan_timer_ends_at',
      hash: '#fan-master-bathroom',
      humidityEntityId: 'sensor.master_bathroom_presence_sensor_humidity',
      id: 'master',
      lockEntityId: 'input_boolean.master_bathroom_fan_automation_lock',
      occupancyEntityId: 'binary_sensor.master_bathroom_presence_sensor_presence',
      pendingEntityId: 'input_boolean.master_bathroom_fan_timer_pending',
      powerEntityId: 'switch.master_bathroom_fan_switch_top',
      scriptService: 'master_bathroom_fan_command',
      temperatureColorEntityId: 'input_text.master_bathroom_climate_color',
      temperatureRangeEntityId: 'input_text.master_bathroom_climate_range',
      timerEntityId: 'timer.master_bathroom_fan_off_timer',
    })
  })

  it('maps every high-level command to the room script service', () => {
    const config = BATHROOM_FANS.guest

    expect(bathroomFanServiceCall(config, { type: 'power', targetPower: 'on' })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'power', target_power: 'on' },
    })
    expect(bathroomFanServiceCall(config, { type: 'power', targetPower: 'off' })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'power', target_power: 'off' },
    })
    expect(bathroomFanServiceCall(config, { type: 'lock', locked: true })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'lock', locked: true },
    })
    expect(bathroomFanServiceCall(config, { type: 'timer-start', autoUnlock: true, minutes: 60 })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { auto_unlock: true, command: 'timer_start', minutes: 60 },
    })
    expect(bathroomFanServiceCall(config, { type: 'timer-cancel' })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'timer_cancel' },
    })
    expect(bathroomFanServiceCall(config, { type: 'timer-auto-unlock', enabled: false })).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'timer_auto_unlock', enabled: false },
    })
  })

  it('keeps timer minutes inside the supported five-minute range', () => {
    expect(normalizeBathroomFanTimerMinutes(1)).toBe(5)
    expect(normalizeBathroomFanTimerMinutes(12)).toBe(10)
    expect(normalizeBathroomFanTimerMinutes(33)).toBe(30)
    expect(normalizeBathroomFanTimerMinutes(999)).toBe(60)
  })
})
