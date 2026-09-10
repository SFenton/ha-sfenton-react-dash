import { describe, expect, it } from 'vitest'
import { MASTER_BEDROOM_WAKE_LIGHT } from '../../../constants/wakeLights'
import {
  createWakeLightAlarm,
  validateWakeLightAlarm,
  vacationPermitsWakeLightRun,
  wakeLightServiceCall,
  wakeLightSnapshotFromEntity,
} from './wakeLightContract'

describe('wakeLightContract', () => {
  it('keeps the Master Bedroom wake profile explicit and excludes the bathroom leaf', () => {
    expect(MASTER_BEDROOM_WAKE_LIGHT.targetLightEntityIds).toEqual([
      'light.master_bedroom_window_light',
      'light.master_bedroom_door_light',
      'light.stephen_nightstand_light',
      'light.steph_nightstand_light',
    ])
    expect(MASTER_BEDROOM_WAKE_LIGHT.targetLightEntityIds).not.toContain('light.master_bedroom_bathroom_light')
  })

  it('parses a generic profile snapshot and fails unavailable entities closed', () => {
    const snapshot = wakeLightSnapshotFromEntity(MASTER_BEDROOM_WAKE_LIGHT, {
      state: 'ramping',
      attributes: {
        contract_version: 4,
        command_available: true,
        episode_ref: 'episode-current',
        active_occurrences: [{
          alarm_id: 'weekday',
          occurrence_id: 'occurrence-1',
          phase: 'ramping',
          progress: 42,
          snoozed_until: null,
          source_ref: null,
          wake_at: '2030-06-10T06:30:00-07:00',
        }],
        auto_relight_blocked_until: '2030-06-10T07:05:00-07:00',
        available: true,
        compatible: true,
        episodeRef: 'episode-current',
        alarms: [{
          date: null,
          enabled: true,
          id: 'weekday',
          kind: 'weekly',
          label: 'Weekday Wake',
          local_time: '06:30',
          ramp_minutes: 30,
          revision: 2,
          source: 'native',
          weekdays: ['monday', 'tuesday'],
        }],
        defaults: {
          post_wake_hold_minutes: 15,
          ramp_minutes: 15,
        },
        commanded_brightness_pct: 43,
        last_cancellation: {
          at: '2030-06-10T06:43:55-07:00',
          occurrence_count: 2,
          outcome: 'cancelled_by_user',
          suppressed_until: '2030-06-10T07:05:00-07:00',
        },
        last_outcome: 'cancelled_by_user',
        next_wake_at: '2030-06-10T06:30:00-07:00',
        profile_id: 'master-bedroom',
        progress: 42,
        revision: 7,
        safety: {
          light_state: 'ready',
          light_target_name: 'Bedroom Lights',
          occupancy_state: 'off',
          pbl_state: 'held',
          vacation_state: 'off',
        },
        alarm_links: {
          'sleepypod:left#monday#06:30': false,
        },
      },
    })

    expect(snapshot).toMatchObject({
      available: true,
      activeOccurrences: [{
        alarmId: 'weekday',
        id: 'occurrence-1',
        phase: 'ramping',
        progress: 42,
        snoozedUntil: null,
        sourceRef: null,
        wakeAt: '2030-06-10T06:30:00-07:00',
      }],
      autoRelightBlockedUntil: '2030-06-10T07:05:00-07:00',
      defaults: {
        postWakeHoldMinutes: 15,
        rampMinutes: 15,
      },
      phase: 'ramping',
      progress: 42,
      commandedBrightnessPct: 43,
      lastCancellation: {
        at: '2030-06-10T06:43:55-07:00',
        occurrenceCount: 2,
        outcome: 'cancelled_by_user',
        suppressedUntil: '2030-06-10T07:05:00-07:00',
      },
      lastOutcome: 'cancelled_by_user',
      revision: 7,
      alarmLinks: {
        'sleepypod:left#monday#06:30': false,
      },
      safety: {
        occupancyState: 'off',
      },
    })
    expect(snapshot.alarms).toHaveLength(1)
    expect(wakeLightSnapshotFromEntity(MASTER_BEDROOM_WAKE_LIGHT, null)).toMatchObject({
      available: false,
      phase: 'unavailable',
      safety: {
        vacationState: 'unknown',
      },
    })
  })

  it('requires vacation to be exactly off', () => {
    expect(vacationPermitsWakeLightRun('off')).toBe(true)
    expect(vacationPermitsWakeLightRun('on')).toBe(false)
    expect(vacationPermitsWakeLightRun('unknown')).toBe(false)
    expect(vacationPermitsWakeLightRun('unavailable')).toBe(false)
  })

  it('validates recurring and one-time alarms without sharing a persistence model', () => {
    const now = new Date(2030, 0, 1, 8)
    const oneTime = createWakeLightAlarm('once', 'Morning Alarm', now)
    expect(oneTime.kind).toBe('once')
    expect(validateWakeLightAlarm(oneTime, now).valid).toBe(true)

    const invalidWeekly = { ...oneTime, date: null, kind: 'weekly' as const, weekdays: [] }
    expect(validateWakeLightAlarm(invalidWeekly, now)).toMatchObject({
      daysValid: false,
      valid: false,
    })

    const future = { ...oneTime, date: '2030-01-03' }
    expect(validateWakeLightAlarm(future, now).valid).toBe(true)
    expect(validateWakeLightAlarm({ ...future, date: '2030-01-01', localTime: '07:00' }, now)).toMatchObject({
      dateValid: false,
      valid: false,
    })
    expect(validateWakeLightAlarm(
      { ...future, date: '2030-01-01', localTime: '07:00' },
      new Date(2030, 0, 1, 0, 30),
    )).toMatchObject({
      dateValid: true,
      valid: true,
    })
  })

  it('preserves legacy ramp values for display but rejects them from new saves', () => {
    const snapshot = wakeLightSnapshotFromEntity(MASTER_BEDROOM_WAKE_LIGHT, {
      state: 'scheduled',
      attributes: {
        alarms: [{
          date: null,
          enabled: true,
          id: 'legacy-weekday',
          kind: 'weekly',
          label: 'Legacy Weekday',
          local_time: '06:30',
          ramp_minutes: 60,
          revision: 1,
          source: 'native',
          weekdays: ['monday'],
        }],
        command_available: true,
        contract_version: 4,
        defaults: {
          post_wake_hold_minutes: 5,
          ramp_minutes: 45,
        },
        profile_id: 'master-bedroom',
        revision: 4,
      },
    })

    expect(snapshot.defaults.rampMinutes).toBe(45)
    expect(snapshot.alarms[0].rampMinutes).toBe(60)
    expect(validateWakeLightAlarm(snapshot.alarms[0]).rampValid).toBe(false)
  })

  it('routes every write through one versioned wake_light.command service', () => {
    const snapshot = wakeLightSnapshotFromEntity(MASTER_BEDROOM_WAKE_LIGHT, {
      state: 'scheduled',
      attributes: {
        contract_version: 5,
        command_available: true,
        available: true,
        profile_id: 'master-bedroom',
        revision: 9,
      },
    })
    const alarm = {
      ...createWakeLightAlarm('alarm-1', 'Morning Alarm', new Date(2030, 0, 1)),
      bedSides: ['left'] as const,
    }

    expect(wakeLightServiceCall(snapshot, { alarm, operation: 'upsert_alarm' }, 'request-1')).toEqual({
      domain: 'wake_light',
      returnResponse: true,
      service: 'command',
      serviceData: {
        alarm: {
          bed_sides: ['left'],
          date: '2030-01-02',
          enabled: true,
          id: 'alarm-1',
          kind: 'once',
          label: 'Morning Alarm',
          local_time: '07:00',
          ramp_minutes: 30,
          revision: 0,
          source: 'native',
          source_ref: null,
          weekdays: [],
        },
        expected_revision: 9,
        operation: 'upsert_alarm',
        profile_id: 'master-bedroom',
        request_id: 'request-1',
      },
    })
    expect(wakeLightServiceCall(snapshot, { operation: 'end_episode' }, 'request-2')).toEqual({
      domain: 'wake_light',
      returnResponse: true,
      service: 'command',
      serviceData: {
        expected_revision: 9,
        operation: 'end_episode',
        profile_id: 'master-bedroom',
        request_id: 'request-2',
      },
    })
  })
})
