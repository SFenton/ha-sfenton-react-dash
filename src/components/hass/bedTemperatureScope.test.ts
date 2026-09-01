import { describe, expect, it } from 'vitest'
import {
  sleepypodOutsideScheduleTemperatureService,
  sleepypodSchedulePhase,
  sleepypodSchedulePhaseAvailable,
  sleepypodTonightTemperatureService,
  type SleepypodSchedulePhase,
  type SleepypodSide,
} from './bedTemperatureScope'

describe('SleepyPod temperature scope', () => {
  it.each([
    ['bedtime', 'bedtime'],
    ['asleep', 'asleep'],
    ['dawn', 'dawn'],
    [' Bedtime ', 'bedtime'],
  ] satisfies [string, SleepypodSchedulePhase][])('prompts for the %s phase', (state, expected) => {
    expect(sleepypodSchedulePhase(state)).toBe(expected)
    expect(sleepypodSchedulePhaseAvailable(state)).toBe(true)
  })

  it.each(['outside', 'unknown', 'unavailable', 'preheating', '', null, undefined])('does not prompt for %s', (state) => {
    expect(sleepypodSchedulePhase(state)).toBeNull()
  })

  it.each(['unknown', 'unavailable', 'preheating', '', null, undefined])('fails closed when the phase is %s', (state) => {
    expect(sleepypodSchedulePhaseAvailable(state)).toBe(false)
  })

  it('keeps outside-window operation available without a prompt', () => {
    expect(sleepypodSchedulePhaseAvailable('outside')).toBe(true)
  })

  it.each([
    ['left', 'sleepypod_stephen_temperature_tonight'],
    ['right', 'sleepypod_steph_temperature_tonight'],
  ] satisfies [SleepypodSide, string][])('routes %s current-night changes through %s', (side, expected) => {
    expect(sleepypodTonightTemperatureService(side)).toBe(expected)
  })

  it.each([
    ['left', 'sleepypod_stephen_temperature_outside_schedule'],
    ['right', 'sleepypod_steph_temperature_outside_schedule'],
  ] satisfies [SleepypodSide, string][])('routes %s outside-window changes through %s', (side, expected) => {
    expect(sleepypodOutsideScheduleTemperatureService(side)).toBe(expected)
  })
})
