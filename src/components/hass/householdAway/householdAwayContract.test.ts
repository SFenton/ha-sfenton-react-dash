import { describe, expect, it } from 'vitest'
import {
  defaultSoloTripDraft,
  householdAwayFullyActive,
  householdAwayServiceCall,
  householdAwaySnapshotFromEntity,
  householdAwayWallClockParts,
  soloTripHomeResident,
  validateSoloTripEndDraft,
  validateSoloTripDraft,
  type HouseholdAwaySnapshot,
} from './householdAwayContract'

function snapshotEntity(overrides: Record<string, unknown> = {}, state = 'active') {
  return {
    state,
    attributes: {
      blockers: [],
      command_available: true,
      contract_version: 1,
      effects: { sleepypod_live_follow: true, sleepypod_schedule: true, wake_light_source: true },
      ends_at: '2026-01-05T18:00:00+00:00',
      home_resident: 'steph',
      mode: 'solo_trip',
      revision: 3,
      starts_at: '2026-01-02T09:00:00+00:00',
      traveler: 'stephen',
      ...overrides,
    },
  }
}

describe('householdAwaySnapshotFromEntity', () => {
  it('parses a fully active solo trip snapshot', () => {
    const snapshot = householdAwaySnapshotFromEntity(snapshotEntity())
    expect(snapshot).toMatchObject({
      available: true,
      compatible: true,
      homeResident: 'steph',
      mode: 'solo_trip',
      revision: 3,
      state: 'active',
      traveler: 'stephen',
    })
    expect(householdAwayFullyActive(snapshot)).toBe(true)
  })

  it('treats a null entity as unavailable idle', () => {
    const snapshot = householdAwaySnapshotFromEntity(null)
    expect(snapshot.available).toBe(false)
    expect(snapshot.state).toBe('idle')
    expect(snapshot.mode).toBe('none')
  })

  it('rejects an incompatible contract version', () => {
    const snapshot = householdAwaySnapshotFromEntity(snapshotEntity({ contract_version: 99 }))
    expect(snapshot.compatible).toBe(false)
    expect(snapshot.available).toBe(false)
  })

  it('is not fully active unless every effect is confirmed', () => {
    const snapshot = householdAwaySnapshotFromEntity(snapshotEntity({
      effects: { sleepypod_live_follow: false, sleepypod_schedule: true, wake_light_source: true },
    }))
    expect(householdAwayFullyActive(snapshot)).toBe(false)
  })

  it('is not fully active while only scheduled', () => {
    const snapshot = householdAwaySnapshotFromEntity(snapshotEntity({}, 'scheduled'))
    expect(householdAwayFullyActive(snapshot)).toBe(false)
  })

  it('falls back to idle for an unrecognized state string', () => {
    const snapshot = householdAwaySnapshotFromEntity(snapshotEntity({}, 'not_a_real_state'))
    expect(snapshot.state).toBe('idle')
  })
})

describe('householdAwayServiceCall', () => {
  const snapshot: HouseholdAwaySnapshot = householdAwaySnapshotFromEntity(snapshotEntity())

  it('builds a schedule solo_trip payload', () => {
    const call = householdAwayServiceCall(snapshot, {
      operation: 'schedule', mode: 'solo_trip', traveler: 'stephen',
      startDate: '2026-02-01', startTime: '09:00', endDate: '2026-02-05', endTime: '18:00',
    }, 'req-1')
    expect(call).toMatchObject({
      domain: 'script', service: 'household_away_command', returnResponse: true,
      serviceData: {
        expected_revision: 3, operation: 'schedule', mode: 'solo_trip', traveler: 'stephen',
        start_date: '2026-02-01', start_time: '09:00', end_date: '2026-02-05', end_time: '18:00',
        request_id: 'req-1',
      },
    })
  })

  it('builds a resolve_restore payload', () => {
    const call = householdAwayServiceCall(snapshot, { operation: 'resolve_restore', resolveAction: 'keep_current' }, 'req-2')
    expect(call.serviceData.resolve_action).toBe('keep_current')
  })

  it('builds an end_now payload with no extra fields', () => {
    const call = householdAwayServiceCall(snapshot, { operation: 'end_now' }, 'req-3')
    expect(call.serviceData).toEqual({ expected_revision: 3, operation: 'end_now', request_id: 'req-3' })
  })
})

describe('validateSoloTripDraft', () => {
  it('accepts a valid future draft with end after start', () => {
    const validation = validateSoloTripDraft({
      endDate: '2026-01-05', endTime: '18:00', startDate: '2026-01-02', startTime: '09:00', traveler: 'stephen',
    })
    expect(validation.valid).toBe(true)
  })

  it('accepts a departure in the past when return is after departure', () => {
    const validation = validateSoloTripDraft({
      endDate: '2026-01-05', endTime: '18:00', startDate: '2025-12-31', startTime: '09:00', traveler: 'stephen',
    })
    expect(validation.endAfterStart).toBe(true)
    expect(validation.valid).toBe(true)
  })

  it('rejects an end before start', () => {
    const validation = validateSoloTripDraft({
      endDate: '2026-01-02', endTime: '08:00', startDate: '2026-01-02', startTime: '09:00', traveler: 'stephen',
    })
    expect(validation.endAfterStart).toBe(false)
    expect(validation.valid).toBe(false)
  })
})

describe('validateSoloTripEndDraft', () => {
  const now = new Date('2026-01-02T09:30:00')

  it('accepts a future return change after the stored departure', () => {
    const validation = validateSoloTripEndDraft('2026-01-02', '10:00', '2026-01-02T09:00:00', now)
    expect(validation.endAfterStart).toBe(true)
    expect(validation.endInFuture).toBe(true)
    expect(validation.valid).toBe(true)
  })

  it('rejects a return change that is not in the future', () => {
    const validation = validateSoloTripEndDraft('2026-01-02', '09:15', '2026-01-02T09:00:00', now)
    expect(validation.endAfterStart).toBe(true)
    expect(validation.endInFuture).toBe(false)
    expect(validation.valid).toBe(false)
  })

  it('rejects a future return change at or before the stored departure', () => {
    const validation = validateSoloTripEndDraft('2026-01-03', '09:00', '2026-01-04T09:00:00', now)
    expect(validation.endAfterStart).toBe(false)
    expect(validation.endInFuture).toBe(true)
    expect(validation.valid).toBe(false)
  })
})

describe('householdAwayWallClockParts', () => {
  it('preserves HA wall-clock date and time parts without timezone conversion', () => {
    expect(householdAwayWallClockParts('2026-01-05T18:45:00+00:00')).toEqual({
      date: '2026-01-05',
      time: '18:45',
    })
    expect(householdAwayWallClockParts('2026-01-05 18:45:00')).toEqual({
      date: '2026-01-05',
      time: '18:45',
    })
  })
})

describe('soloTripHomeResident', () => {
  it('maps traveler to the other resident', () => {
    expect(soloTripHomeResident('stephen')).toBe('steph')
    expect(soloTripHomeResident('steph')).toBe('stephen')
  })
})

describe('defaultSoloTripDraft', () => {
  it('produces a valid time range that still requires a traveler', () => {
    const now = new Date('2026-01-01T00:00:00')
    const draft = defaultSoloTripDraft(now)
    const validation = validateSoloTripDraft(draft)
    expect(validation.endAfterStart).toBe(true)
    expect(validation.travelerValid).toBe(false)
    expect(validation.valid).toBe(false)
  })
})
