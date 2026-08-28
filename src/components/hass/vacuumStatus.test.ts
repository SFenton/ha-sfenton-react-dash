import { describe, expect, it } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import {
  nativeVacuumIssue,
  parseVacuumStatusContract,
  resolveVacuumStatusContract,
  vacuumAvailabilityStatus,
  type VacuumStatusContract,
} from './vacuumStatus'

function contract(overrides: Partial<VacuumStatusContract> = {}): VacuumStatusContract {
  return {
    active_conditions: [],
    availability: { since: null, status: 'available' },
    command_policy: { mode: 'normal', reason: null },
    current_issue: { code: null, raw: null, reported_at: null, status: 'clear' },
    last_issue: null,
    observed_vacuum_state: 'docked',
    vacuum_entity_id: 'vacuum.valetudo_test',
    version: 1,
    ...overrides,
  }
}

describe('vacuum status contract parsing', () => {
  it('accepts a coherent v1 contract', () => {
    expect(parseVacuumStatusContract(contract())).toEqual(contract())
  })

  it.each([
    ['unknown version', { version: 2 }],
    ['wrong current issue shape', { current_issue: { status: 'present' } }],
    ['present issue while unavailable', {
      availability: { since: '2026-08-21T21:51:49Z', status: 'unavailable' },
      command_policy: { mode: 'none', reason: 'primary_unavailable' },
      current_issue: {
        code: 'unknown_error_75',
        raw: 'Unknown error 75',
        reported_at: '2026-08-21T21:20:11Z',
        status: 'present',
      },
      observed_vacuum_state: 'unavailable',
    }],
    ['normal commands with unknown error status', {
      command_policy: { mode: 'normal', reason: null },
      current_issue: { code: null, raw: null, reported_at: null, status: 'unknown' },
    }],
    ['normal commands with a current issue', {
      command_policy: { mode: 'normal', reason: null },
      current_issue: {
        code: 'navigation.stuck',
        raw: 'Robot stuck or trapped',
        reported_at: '2026-08-21T21:20:11Z',
        status: 'present',
      },
    }],
    ['normal commands with an active condition', {
      active_conditions: [{
        code: 'vacuum.task_resume_pending',
        since: '2026-08-21T21:20:11Z',
        source: 'coordinator',
      }],
      command_policy: { mode: 'normal', reason: null },
    }],
    ['availability that disagrees with the observed primary', {
      availability: { since: null, status: 'unavailable' },
      command_policy: { mode: 'none', reason: 'primary_unavailable' },
    }],
  ])('rejects an %s', (_name, overrides) => {
    expect(parseVacuumStatusContract({ ...contract(), ...overrides })).toBeNull()
  })

  it('requires unavailable contracts to fail closed', () => {
    const unavailable = contract({
      availability: { since: '2026-08-21T21:51:49Z', status: 'unavailable' },
      command_policy: { mode: 'none', reason: 'primary_unavailable' },
      current_issue: { code: null, raw: null, reported_at: null, status: 'unknown' },
      last_issue: {
        code: 'unknown_error_75',
        provenance: 'observed',
        raw: 'Unknown error 75',
        reported_at: '2026-08-21T21:20:11Z',
      },
      observed_vacuum_state: 'unavailable',
    })

    expect(parseVacuumStatusContract(unavailable)).toEqual(unavailable)
  })
})

describe('vacuum status contract resolution', () => {
  it('rejects contracts for another vacuum or an older primary state', () => {
    expect(resolveVacuumStatusContract(contract(), 'vacuum.other', 'docked')).toEqual({
      kind: 'legacy',
      reason: 'invalid',
    })
    expect(resolveVacuumStatusContract(contract(), 'vacuum.valetudo_test', 'cleaning')).toEqual({
      kind: 'legacy',
      reason: 'stale',
    })
  })

  it('accepts the contract only when its observed primary state matches', () => {
    expect(resolveVacuumStatusContract(contract(), 'vacuum.valetudo_test', 'docked')).toMatchObject({
      kind: 'typed',
    })
  })

  it('accepts the producer missing-primary shape only when the live entity is missing', () => {
    const missing = contract({
      availability: { since: null, status: 'missing' },
      command_policy: { mode: 'none', reason: 'primary_missing' },
      current_issue: { code: null, raw: null, reported_at: null, status: 'unknown' },
      observed_vacuum_state: null,
    })

    expect(resolveVacuumStatusContract(missing, 'vacuum.valetudo_test', undefined)).toMatchObject({
      kind: 'typed',
    })
    expect(resolveVacuumStatusContract(missing, 'vacuum.valetudo_test', 'unknown')).toEqual({
      kind: 'legacy',
      reason: 'stale',
    })
  })
})

describe('native vacuum status fallback', () => {
  it.each([
    [undefined, false, 'missing'],
    [undefined, true, 'unknown'],
    ['unknown', true, 'unknown'],
    ['unavailable', true, 'unavailable'],
    ['docked', true, 'available'],
  ] as const)('maps primary state %s to %s', (state, exists, expected) => {
    expect(vacuumAvailabilityStatus(state, exists)).toBe(expected)
  })

  it.each([
    [undefined, 'unknown'],
    ['unknown', 'unknown'],
    ['unavailable', 'unknown'],
    ['', 'clear'],
    ['none', 'clear'],
    ['ok', 'clear'],
    ['No error', 'clear'],
    ['Unknown error 75', 'present'],
  ] as const)('maps raw error %s to %s', (state, expected) => {
    expect(nativeVacuumIssue(state).status).toBe(expected)
  })
})

describe('vacuum status configuration', () => {
  it('configures one unique observer entity for every vacuum', () => {
    expect(VACUUMS.map((vacuum) => vacuum.statusEntityId)).toEqual([
      'sensor.music_room_vacuum_status',
      'sensor.theater_room_vacuum_status',
      'sensor.main_floor_vacuum_status',
    ])
    expect(new Set(VACUUMS.map((vacuum) => vacuum.statusEntityId)).size).toBe(VACUUMS.length)
  })
})
