import { describe, expect, it } from 'vitest'

import {
  bedAlarmDaysAtTime, bedAlarmPlanIsEmpty, normalizedBedAlarmTime, planBedAlarmProvision,
} from './bedAlarmProvisioning'
import { wakeLightAlarmLinkKey } from './wakeLightContract'

const RIGHT = 'sleepypod:right'
const LEFT = 'sleepypod:left'

describe('normalizedBedAlarmTime', () => {
  it('normalizes to the strict link-key shape', () => {
    expect(normalizedBedAlarmTime('7:30')).toBe('07:30')
    expect(normalizedBedAlarmTime('07:30:00')).toBe('07:30')
    expect(normalizedBedAlarmTime(' 23:05 ')).toBe('23:05')
  })

  it('rejects impossible times', () => {
    expect(normalizedBedAlarmTime('24:00')).toBeNull()
    expect(normalizedBedAlarmTime('07:60')).toBeNull()
    expect(normalizedBedAlarmTime('nope')).toBeNull()
  })
})

describe('bedAlarmDaysAtTime', () => {
  it('matches across time formats and returns weekday order', () => {
    expect(bedAlarmDaysAtTime([
      { day: 'friday', time: '7:30' },
      { day: 'monday', time: '07:30:00' },
      { day: 'tuesday', time: '08:00' },
    ], '07:30')).toEqual(['monday', 'friday'])
  })
})

describe('planBedAlarmProvision', () => {
  it('creates a bed alarm when that side has none at the day/time', () => {
    const plan = planBedAlarmProvision({
      alarmLinks: {}, days: ['monday', 'tuesday'], linked: true, slots: [], sourceRef: RIGHT, time: '07:30',
    })
    expect(plan).toEqual({ createDays: ['monday', 'tuesday'], linkKeysOff: [], linkKeysOn: [] })
  })

  it('does not duplicate an existing bed alarm', () => {
    const plan = planBedAlarmProvision({
      alarmLinks: {}, days: ['monday'], linked: true, slots: [{ day: 'monday', time: '07:30' }], sourceRef: RIGHT, time: '07:30',
    })
    expect(plan?.createDays).toEqual([])
  })

  it('turns the link on when the existing bed alarm opted out', () => {
    const key = wakeLightAlarmLinkKey(RIGHT, 'monday', '07:30')
    const plan = planBedAlarmProvision({
      alarmLinks: { [key]: false }, days: ['monday'], linked: true,
      slots: [{ day: 'monday', time: '07:30' }], sourceRef: RIGHT, time: '07:30',
    })
    expect(plan).toEqual({ createDays: [], linkKeysOff: [], linkKeysOn: [key] })
  })

  it('never creates a bed alarm while the toggle is off', () => {
    expect(bedAlarmPlanIsEmpty(planBedAlarmProvision({
      alarmLinks: {}, days: ['monday'], linked: false, slots: [], sourceRef: RIGHT, time: '07:30',
    }))).toBe(true)
  })

  it('clears a stale opt-out for a bed alarm it creates', () => {
    const key = wakeLightAlarmLinkKey(RIGHT, 'monday', '07:30')
    const plan = planBedAlarmProvision({
      alarmLinks: { [key]: false }, days: ['monday'], linked: true, slots: [], sourceRef: RIGHT, time: '07:30',
    })
    expect(plan).toEqual({ createDays: ['monday'], linkKeysOff: [], linkKeysOn: [key] })
  })

  it("turns Steph's link off without ever touching Stephen's link", () => {
    // Steph drafts 07:30 with the wake link off, and already owns a linked 07:30 bed alarm.
    // Stephen also owns a linked 07:30 bed alarm, which must survive untouched.
    const stephenKey = wakeLightAlarmLinkKey(LEFT, 'monday', '07:30')
    const stephKey = wakeLightAlarmLinkKey(RIGHT, 'monday', '07:30')
    const plan = planBedAlarmProvision({
      alarmLinks: {}, days: ['monday'], linked: false,
      slots: [{ day: 'monday', time: '07:30' }], sourceRef: RIGHT, time: '07:30',
    })
    expect(plan).toEqual({ createDays: [], linkKeysOff: [stephKey], linkKeysOn: [] })
    expect(JSON.stringify(plan)).not.toContain(LEFT)
    expect(plan?.linkKeysOff).not.toContain(stephenKey)
  })

  it('is a no-op when the existing bed alarm already matches the requested link', () => {
    expect(bedAlarmPlanIsEmpty(planBedAlarmProvision({
      alarmLinks: {}, days: ['monday'], linked: true,
      slots: [{ day: 'monday', time: '07:30' }], sourceRef: RIGHT, time: '07:30',
    }))).toBe(true)
  })

  it('rejects an unusable time', () => {
    expect(planBedAlarmProvision({
      alarmLinks: {}, days: ['monday'], linked: true, slots: [], sourceRef: RIGHT, time: '7:99',
    })).toBeNull()
  })
})
