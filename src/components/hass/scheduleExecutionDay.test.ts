import { describe, expect, it } from 'vitest'
import fixture from '../../../home-assistant/tests/fixtures/sleepypod-alarm-v2.json'
import { alarmExecutionDay, alarmSourceDay, type ScheduleWeekday } from './scheduleExecutionDay'

describe('provider execution-day contract', () => {
  it('preserves the Pod golden execution days on both read and write', () => {
    for (const [day, schedule] of Object.entries(fixture.right)) {
      const key = day as ScheduleWeekday
      expect(alarmExecutionDay(key, schedule.power.off, 'execution')).toBe(key)
      expect(alarmSourceDay(key, fixture.right, 'execution')).toBe(key)
      expect(alarmExecutionDay(key, '13:00', 'execution')).toBe(key)
    }
  })

  it('keeps the explicitly selected legacy bedtime-day contract', () => {
    expect(alarmExecutionDay('saturday', '09:00', 'bedtime')).toBe('sunday')
    expect(alarmSourceDay('sunday', undefined, 'bedtime')).toBe('saturday')
    expect(alarmExecutionDay('saturday', '22:00', 'bedtime')).toBe('saturday')
  })
})
