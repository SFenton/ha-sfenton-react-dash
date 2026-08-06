import { describe, expect, it } from 'vitest'
import {
  createHumidifierScheduleRule,
  emptyScheduleDays,
  formatScheduleDays,
  scheduleConflicts,
  scheduleDaysFromRules,
  scheduleRules,
  scheduleUpdateMessage,
  type HassSchedule,
  type HumidifierScheduleRule,
} from './humidifierSchedule'

function rule(overrides: Partial<HumidifierScheduleRule> = {}): HumidifierScheduleRule {
  return {
    ...createHumidifierScheduleRule(overrides.id ?? 'rule-1'),
    ...overrides,
  }
}

describe('humidifier schedules', () => {
  it('uses shared weekday creation defaults while accepting an explicit consumer override', () => {
    expect(createHumidifierScheduleRule('weekday').days).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    expect(createHumidifierScheduleRule('sunday', ['sunday']).days).toEqual(['sunday'])
  })

  it('serializes multiple activities and preserves their profile data', () => {
    const morning = rule({
      days: ['monday', 'wednesday'],
      end: '07:30',
      id: 'morning',
      label: 'Morning',
      mistLevel: 3,
      mode: 'Target Humidity',
      start: '06:00',
      targetHumidity: 45,
    })
    const evening = rule({
      days: ['monday', 'wednesday'],
      display: true,
      end: '22:30',
      id: 'evening',
      label: 'Evening',
      mistLevel: 6,
      mode: 'Manual',
      start: '20:00',
      warmLevel: 2,
    })

    const days = scheduleDaysFromRules([morning, evening])

    expect(days.monday).toHaveLength(2)
    expect(days.monday[0]).toMatchObject({
      from: '06:00',
      to: '07:30',
      data: {
        label: 'Morning',
        mist_level: 3,
        mode: 'Target Humidity',
        rule_id: 'morning',
        target_humidity: 45,
      },
    })
    expect(days.monday[1]).toMatchObject({
      from: '20:00',
      to: '22:30',
      data: {
        display: true,
        label: 'Evening',
        mist_level: 6,
        mode: 'Manual',
        rule_id: 'evening',
        warm_level: 2,
      },
    })
    expect(days.tuesday).toEqual([])
    expect(scheduleConflicts([morning, evening])).toEqual([])
  })

  it('splits overnight activities into touching blocks and round-trips them as one rule', () => {
    const overnight = rule({
      days: ['monday', 'tuesday'],
      end: '07:00',
      id: 'overnight',
      label: 'Overnight',
      mode: 'Sleep',
      start: '22:00',
    })
    const days = scheduleDaysFromRules([overnight])
    const schedule: HassSchedule = {
      id: 'master_bedroom_humidifier',
      icon: 'mdi:calendar-clock',
      name: 'Master Bedroom Humidifier',
      ...days,
    }

    expect(days.monday).toEqual([
      expect.objectContaining({ from: '22:00', to: '24:00' }),
    ])
    expect(days.tuesday).toEqual([
      expect.objectContaining({ from: '00:00', to: '07:00' }),
      expect.objectContaining({ from: '22:00', to: '24:00' }),
    ])
    expect(days.wednesday).toEqual([
      expect.objectContaining({ from: '00:00', to: '07:00' }),
    ])
    expect(scheduleRules(schedule)).toEqual([overnight])
  })

  it('does not create a zero-length next-day block when an activity ends at midnight', () => {
    const evening = rule({
      days: ['monday'],
      end: '00:00',
      id: 'evening',
      start: '22:00',
    })

    const days = scheduleDaysFromRules([evening])

    expect(days.monday).toEqual([
      expect.objectContaining({ from: '22:00', to: '24:00' }),
    ])
    expect(days.tuesday).toEqual([])
    expect(scheduleConflicts([evening])).toEqual([])
  })

  it('allows touching rules but reports overlaps', () => {
    const first = rule({ days: ['friday'], end: '10:00', id: 'first', start: '08:00' })
    const touching = rule({ days: ['friday'], end: '12:00', id: 'touching', start: '10:00' })
    const overlapping = rule({ days: ['friday'], end: '11:00', id: 'overlap', start: '09:30' })

    expect(scheduleConflicts([first, touching])).toEqual([])
    expect(scheduleConflicts([first, overlapping])).toEqual([
      { day: 'friday', firstRuleId: 'first', secondRuleId: 'overlap' },
    ])
  })

  it('builds a complete schedule update message', () => {
    const schedule: HassSchedule = {
      id: 'master_bedroom_humidifier',
      icon: 'mdi:calendar-clock',
      name: 'Master Bedroom Humidifier',
      ...emptyScheduleDays(),
    }
    const activity = rule({ days: ['saturday', 'sunday'], end: '09:00', id: 'weekend', start: '07:00' })

    expect(scheduleUpdateMessage(schedule, [activity])).toMatchObject({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      saturday: [expect.objectContaining({ from: '07:00', to: '09:00' })],
      sunday: [expect.objectContaining({ from: '07:00', to: '09:00' })],
    })
    expect(formatScheduleDays(activity.days)).toBe('Weekends')
  })
})
