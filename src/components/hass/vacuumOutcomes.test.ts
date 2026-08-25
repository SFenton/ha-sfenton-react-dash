import { describe, expect, it } from 'vitest'
import { LEGACY_VACUUM_OUTCOMES, NINE_ROOM_VACUUM_OUTCOME_CONTRACT } from '../../test/fixtures/vacuumOutcomes'
import {
  parseVacuumOutcomeContract,
  vacuumOutcomeEventsForRoom,
  vacuumWhileAwayPresentation,
  type VacuumOutcomeContract,
} from './vacuumOutcomes'

function cloneContract() {
  return structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT)
}

describe('vacuum outcome contract parsing', () => {
  it('accepts the complete authoritative nine-room contract and preserves backend order', () => {
    const parsed = parseVacuumOutcomeContract(cloneContract())

    expect(parsed?.rooms.map((room) => room.room_id)).toEqual([
      'dining_room',
      'kitchen',
      'master_bathroom',
      'guest_bathroom',
      'gym',
      'office',
      'guest_room',
      'master_bedroom_closet',
      'hallway',
    ])
    expect(parsed?.events.map((event) => event.sequence)).toEqual(
      NINE_ROOM_VACUUM_OUTCOME_CONTRACT.events.map((event) => event.sequence),
    )
  })

  it.each([
    ['unknown version', (contract: Record<string, unknown>) => { contract.version = 2 }],
    ['incomplete contract', (contract: Record<string, unknown>) => { contract.complete = false }],
    ['invalid day', (contract: Record<string, unknown>) => { contract.day = '2026-02-30' }],
    ['missing rooms', (contract: Record<string, unknown>) => { delete contract.rooms }],
  ])('rejects an %s', (_name, mutate) => {
    const contract = cloneContract() as unknown as Record<string, unknown>
    mutate(contract)
    expect(parseVacuumOutcomeContract(contract)).toBeNull()
  })

  it('rejects unresolved and cross-room history references', () => {
    const unresolved = cloneContract()
    unresolved.rooms[0].event_ids[0] = 'missing-event'
    expect(parseVacuumOutcomeContract(unresolved)).toBeNull()

    const crossRoom = cloneContract()
    crossRoom.rooms[0].event_ids[0] = 'session-one:gym:attempt'
    expect(parseVacuumOutcomeContract(crossRoom)).toBeNull()
  })

  it('rejects a latest attempt that does not resolve to the matching attempt event', () => {
    const contract = cloneContract()
    contract.rooms[0].latest_attempt = {
      event_id: 'session-one:dining-room:deferral',
      mode: 'vacuum_mop',
      reason: contract.rooms[0].latest_attempt?.reason ?? null,
      result: 'failed',
    }

    expect(parseVacuumOutcomeContract(contract)).toBeNull()
  })

  it('looks up one room history through authoritative event IDs without sorting', () => {
    const contract = parseVacuumOutcomeContract(cloneContract()) as VacuumOutcomeContract
    const dining = contract.rooms[0]

    expect(vacuumOutcomeEventsForRoom(contract, dining).map((event) => event.id)).toEqual(dining.event_ids)
    expect(dining.occurrence_count).toBe(2)
    expect(dining.event_ids).toHaveLength(4)
  })
})

describe('vacuum while-away source selection', () => {
  it('uses a valid complete typed contract without mixing legacy strings', () => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: cloneContract(),
    })

    expect(presentation.kind).toBe('typed')
    if (presentation.kind !== 'typed') throw new Error('Expected typed presentation')
    expect(presentation.cleaned).toEqual(LEGACY_VACUUM_OUTCOMES.while_away_cleaned)
    expect(presentation.issues).toEqual(LEGACY_VACUUM_OUTCOMES.while_away_issues)
  })

  it.each([
    { complete: false, version: 1 },
    { complete: true, version: 2 },
    { complete: true, day: 'bad-day', version: 1 },
  ])('uses the complete legacy view when typed data is invalid: %j', (invalid) => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: {
        ...cloneContract(),
        ...invalid,
      },
    })

    expect(presentation).toEqual({
      cleaned: LEGACY_VACUUM_OUTCOMES.while_away_cleaned,
      issues: LEGACY_VACUUM_OUTCOMES.while_away_issues,
      kind: 'legacy',
    })
  })

  it('renders nothing for a complete empty contract even when stale legacy strings exist', () => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: {
        complete: true,
        day: '2026-08-19',
        events: [],
        rooms: [],
        version: 1,
      },
    })

    expect(presentation).toEqual({ kind: 'empty' })
  })

  it('renders nothing when neither typed nor legacy data exists', () => {
    expect(vacuumWhileAwayPresentation({})).toEqual({ kind: 'empty' })
  })
})
