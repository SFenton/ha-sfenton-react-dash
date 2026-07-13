import { describe, expect, it } from 'vitest'
import {
  sleepypodOutsideScheduleTemperatureService,
  sleepypodSchedulePhase,
  sleepypodSchedulePhaseAvailable,
  sleepypodTemperatureScopeService,
  type SleepypodSchedulePhase,
  type SleepypodSide,
  type SleepypodTemperatureScope,
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
    ['left', 'tonight', 'bedtime', 'sleepypod_stephen_temperature_tonight'],
    ['left', 'tonight', 'asleep', 'sleepypod_stephen_temperature_tonight'],
    ['left', 'tonight', 'dawn', 'sleepypod_stephen_temperature_tonight'],
    ['left', 'all-nights', 'bedtime', 'sleepypod_stephen_bedtime_temperature_all_nights'],
    ['left', 'all-nights', 'asleep', 'sleepypod_stephen_asleep_temperature_all_nights'],
    ['left', 'all-nights', 'dawn', 'sleepypod_stephen_dawn_temperature_all_nights'],
    ['right', 'tonight', 'bedtime', 'sleepypod_steph_temperature_tonight'],
    ['right', 'tonight', 'asleep', 'sleepypod_steph_temperature_tonight'],
    ['right', 'tonight', 'dawn', 'sleepypod_steph_temperature_tonight'],
    ['right', 'all-nights', 'bedtime', 'sleepypod_steph_bedtime_temperature_all_nights'],
    ['right', 'all-nights', 'asleep', 'sleepypod_steph_asleep_temperature_all_nights'],
    ['right', 'all-nights', 'dawn', 'sleepypod_steph_dawn_temperature_all_nights'],
  ] satisfies [SleepypodSide, SleepypodTemperatureScope, SleepypodSchedulePhase, string][])('routes %s %s during %s to %s', (side, scope, phase, expected) => {
    expect(sleepypodTemperatureScopeService(side, scope, phase)).toBe(expected)
  })

  it.each([
    ['left', 'sleepypod_stephen_temperature_outside_schedule'],
    ['right', 'sleepypod_steph_temperature_outside_schedule'],
  ] satisfies [SleepypodSide, string][])('routes %s outside-window changes through %s', (side, expected) => {
    expect(sleepypodOutsideScheduleTemperatureService(side)).toBe(expected)
  })
})
