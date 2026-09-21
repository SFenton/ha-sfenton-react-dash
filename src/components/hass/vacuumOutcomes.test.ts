// @covers src/test/fixtures/vacuumOutcomes.ts
import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD,
  FUTURE_VACUUM_OUTCOME_PAYLOAD,
  INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD,
  LEGACY_VACUUM_OUTCOMES,
  MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD,
  MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
  NINE_ROOM_VACUUM_OUTCOME_CONTRACT,
} from '../../test/fixtures/vacuumOutcomes'
import {
  parseVacuumOutcomeContract,
  parseVacuumOutcomeReport,
  vacuumOutcomeEventsForRoom,
  vacuumWhileAwayPresentation,
  type VacuumOutcomeContract,
} from './vacuumOutcomes'

function cloneV1Contract() {
  return structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT)
}

function cloneV2Payload() {
  return structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)
}

function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected record fixture')
  return value as Record<string, unknown>
}

function v2PayloadWithLivingRoomReason(reason: Record<string, unknown>) {
  const payload = cloneV2Payload()
  const room = record(payload.rooms[2])
  const attempt = record(room.latest_attempt)
  const event = record(payload.events[2])
  room.status = 'interrupted'
  attempt.result = 'interrupted'
  attempt.reason = structuredClone(reason)
  room.credit = { operation: null, status: 'none' }
  room.outstanding = { operation: 'vacuum_mop', reason: structuredClone(reason) }
  event.kind = 'failed'
  event.attempt_result = 'interrupted'
  event.reason = structuredClone(reason)
  return payload
}

describe('vacuum outcome contract parsing', () => {
  it('accepts the complete v1 contract and preserves backend order', () => {
    const parsed = parseVacuumOutcomeContract(cloneV1Contract())

    expect(parsed?.version).toBe(1)
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

  it('accepts complete v2 partial and uncertain outcomes with structured evidence', () => {
    const parsed = parseVacuumOutcomeReport(cloneV2Payload())

    expect(parsed.kind).toBe('valid')
    if (parsed.kind !== 'valid') throw new Error('Expected valid v2 payload')
    expect(parsed.contract.version).toBe(2)
    expect(parsed.contract.rooms.map((room) => room.status)).toEqual(['uncertain', 'uncertain', 'partial'])
    expect(parsed.contract.events.map((event) => event.type === 'attempt' ? event.attempt_result : null))
      .toEqual(['uncertain', 'uncertain', 'partial'])
    expect(parsed.contract.rooms[0].latest_attempt?.evidence).toMatchObject({
      kind: 'available',
      data: {
        duration: {
          observed: 1500,
          reset_count: 1,
          status: 'passed',
        },
        iterations: {
          observed: 1,
          requested: 2,
          status: 'unverified',
        },
        physical_work: {
          status: 'substantial',
        },
      },
    })
    expect(parsed.contract.rooms[1].latest_attempt?.evidence).toMatchObject({
      kind: 'available',
      data: {
        duration: {
          lower_bound: 1440,
          observed: null,
          status: 'passed_lower_bound',
        },
        telemetry: {
          source_outage_count: 1,
          source_outage_seconds: 258,
          status: 'unresolved',
        },
      },
    })
  })

  it('accepts evidence-free retained v2 outcomes without manufacturing evidence', () => {
    const parsed = parseVacuumOutcomeReport(structuredClone(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD))

    expect(parsed.kind).toBe('valid')
    if (parsed.kind !== 'valid') throw new Error('Expected valid evidence-free v2 payload')
    expect(parsed.contract.rooms[0]).toMatchObject({
      room_id: 'office',
      status: 'uncertain',
      latest_attempt: {
        result: 'uncertain',
      },
    })
    expect(parsed.contract.rooms[0].latest_attempt).not.toHaveProperty('evidence')
    expect(parsed.contract.events[0]).not.toHaveProperty('evidence')
  })

  it('normalizes the exact legacy lost-mop reason without overriding canonical or unrelated reasons', () => {
    const historicalReason = { category: 'unknown', code: 'unknown', data: {}, raw: 'Lost mop pad' }
    const parsedHistorical = parseVacuumOutcomeReport(v2PayloadWithLivingRoomReason(historicalReason))

    expect(parsedHistorical.kind).toBe('valid')
    if (parsedHistorical.kind !== 'valid') throw new Error('Expected valid historical lost-mop payload')
    expect(parsedHistorical.contract.rooms[2]).toMatchObject({
      latest_attempt: {
        reason: {
          category: 'mop',
          code: 'mop.attachment_missing',
          data: {},
          raw: 'Lost mop pad',
        },
      },
      outstanding: {
        reason: {
          category: 'mop',
          code: 'mop.attachment_missing',
          raw: 'Lost mop pad',
        },
      },
    })
    expect(parsedHistorical.contract.events[2].reason).toMatchObject({
      category: 'mop',
      code: 'mop.attachment_missing',
      raw: 'Lost mop pad',
    })

    const canonicalReason = { category: 'mop', code: 'mop.clean_water_empty', data: {}, raw: 'Lost mop pad' }
    const parsedCanonical = parseVacuumOutcomeReport(v2PayloadWithLivingRoomReason(canonicalReason))
    expect(parsedCanonical.kind).toBe('valid')
    if (parsedCanonical.kind !== 'valid') throw new Error('Expected valid canonical payload')
    expect(parsedCanonical.contract.rooms[2].latest_attempt?.reason?.code).toBe('mop.clean_water_empty')

    const unrelatedReason = { category: 'unknown', code: 'unknown', data: {}, raw: 'Lost side brush' }
    const parsedUnrelated = parseVacuumOutcomeReport(v2PayloadWithLivingRoomReason(unrelatedReason))
    expect(parsedUnrelated.kind).toBe('valid')
    if (parsedUnrelated.kind !== 'valid') throw new Error('Expected valid unrelated unknown payload')
    expect(parsedUnrelated.contract.rooms[2].latest_attempt?.reason).toEqual(unrelatedReason)
  })

  it('preserves a valid v2 core while marking malformed optional evidence unavailable', () => {
    const payload = cloneV2Payload()
    const room = record(payload.rooms[0])
    const attempt = record(room.latest_attempt)
    const evidence = record(attempt.evidence)
    record(evidence.duration).minimum = 'not-a-number'

    const parsed = parseVacuumOutcomeReport(payload)

    expect(parsed.kind).toBe('valid')
    if (parsed.kind !== 'valid') throw new Error('Expected valid core with malformed evidence')
    expect(parsed.contract.rooms[0].status).toBe('uncertain')
    expect(parsed.contract.rooms[0].latest_attempt?.evidence).toEqual({ kind: 'malformed' })
    expect(parsed.contract.events[0]).toMatchObject({
      evidence: {
        kind: 'malformed',
      },
    })
  })

  it('tolerates additive fields throughout a supported v2 payload', () => {
    const payload = cloneV2Payload()
    const room = record(payload.rooms[0])
    const attempt = record(room.latest_attempt)
    const evidence = record(attempt.evidence)
    record(payload).future_top_level = true
    room.future_room_field = 'kept-compatible'
    evidence.future_evidence_field = { vendor: 'value' }

    expect(parseVacuumOutcomeReport(payload).kind).toBe('valid')
  })

  it('distinguishes incomplete, malformed, absent, and unsupported reports', () => {
    expect(parseVacuumOutcomeReport(undefined)).toEqual({ kind: 'absent' })
    expect(parseVacuumOutcomeReport(structuredClone(INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD))).toEqual({
      kind: 'incomplete',
      version: 2,
    })
    expect(parseVacuumOutcomeReport(structuredClone(MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD))).toEqual({
      kind: 'malformed',
      version: 2,
    })
    expect(parseVacuumOutcomeReport(structuredClone(FUTURE_VACUUM_OUTCOME_PAYLOAD))).toEqual({
      kind: 'unsupported',
      version: 3,
    })
    expect(parseVacuumOutcomeReport('not-an-object')).toEqual({ kind: 'malformed' })
  })

  it.each([
    ['invalid day', (contract: Record<string, unknown>) => { contract.day = '2026-02-30' }],
    ['missing rooms', (contract: Record<string, unknown>) => { delete contract.rooms }],
    ['v2-only status in v1', (contract: Record<string, unknown>) => {
      record((contract.rooms as unknown[])[0]).status = 'uncertain'
    }],
  ])('rejects malformed supported core data: %s', (_name, mutate) => {
    const contract = cloneV1Contract() as unknown as Record<string, unknown>
    mutate(contract)
    expect(parseVacuumOutcomeContract(contract)).toBeNull()
    expect(parseVacuumOutcomeReport(contract)).toMatchObject({ kind: 'malformed', version: 1 })
  })

  it('rejects unresolved and cross-room history references', () => {
    const unresolved = cloneV1Contract()
    unresolved.rooms[0].event_ids[0] = 'missing-event'
    expect(parseVacuumOutcomeContract(unresolved)).toBeNull()

    const crossRoom = cloneV1Contract()
    crossRoom.rooms[0].event_ids[0] = 'session-one:gym:attempt'
    expect(parseVacuumOutcomeContract(crossRoom)).toBeNull()
  })

  it('rejects a latest attempt that does not resolve to the matching attempt event', () => {
    const contract = cloneV1Contract()
    contract.rooms[0].latest_attempt = {
      event_id: 'session-one:dining-room:deferral',
      mode: 'vacuum_mop',
      reason: contract.rooms[0].latest_attempt?.reason ?? null,
      result: 'failed',
    }

    expect(parseVacuumOutcomeContract(contract)).toBeNull()
  })

  it('looks up one room history through authoritative event IDs without sorting', () => {
    const contract = parseVacuumOutcomeContract(cloneV1Contract()) as VacuumOutcomeContract
    const dining = contract.rooms[0]

    expect(vacuumOutcomeEventsForRoom(contract, dining).map((event) => event.id)).toEqual(dining.event_ids)
    expect(dining.occurrence_count).toBe(2)
    expect(dining.event_ids).toHaveLength(4)
  })
})

describe('vacuum while-away source selection', () => {
  it('uses a valid v1 contract without exposing legacy strings as typed data', () => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: cloneV1Contract(),
    })

    expect(presentation).toMatchObject({ kind: 'typed' })
    expect(presentation).not.toHaveProperty('cleaned')
    expect(presentation).not.toHaveProperty('issues')
  })

  it('uses valid v2 data authoritatively over misleading legacy issue strings', () => {
    const presentation = vacuumWhileAwayPresentation({
      ...MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: structuredClone(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD),
    })

    expect(presentation.kind).toBe('typed')
    if (presentation.kind !== 'typed') throw new Error('Expected typed v2 presentation')
    expect(presentation.contract.rooms[0]).toMatchObject({
      room_id: 'office',
      status: 'uncertain',
    })
    expect(presentation).not.toHaveProperty('issues')
  })

  it('reconciles only an exact Home Assistant attempt marker without rewriting attempt history', () => {
    const payload = cloneV2Payload()
    const originalGym = structuredClone(payload.rooms[0])
    const originalLivingRoom = structuredClone(payload.rooms[2])
    const presentation = vacuumWhileAwayPresentation(
      { while_away_outcomes: payload },
      {
        gym: 'session-v2:gym:attempt',
        living_room: 'session-v2:living-room:attempt',
        office: 'session-v2:gym:attempt',
      },
    )

    expect(presentation.kind).toBe('typed')
    if (presentation.kind !== 'typed') throw new Error('Expected reconciled typed presentation')
    expect(presentation.contract.rooms[0]).toMatchObject({
      credit: { operation: 'vacuum', status: 'full' },
      latest_attempt: {
        event_id: 'session-v2:gym:attempt',
        result: 'uncertain',
      },
      outstanding: null,
      reconciled_event_id: 'session-v2:gym:attempt',
      status: 'completed',
    })
    expect(presentation.contract.events[0]).toMatchObject({
      attempt_result: 'uncertain',
      id: 'session-v2:gym:attempt',
    })
    expect(presentation.contract.rooms[1]).toMatchObject({
      room_id: 'office',
      status: 'uncertain',
    })
    expect(presentation.contract.rooms[2]).toMatchObject({
      credit: { operation: 'vacuum_mop', status: 'full' },
      latest_attempt: {
        event_id: 'session-v2:living-room:attempt',
        result: 'partial',
      },
      outstanding: null,
      reconciled_event_id: 'session-v2:living-room:attempt',
      room_id: 'living_room',
      status: 'completed',
    })
    expect(payload.rooms[0]).toEqual(originalGym)
    expect(payload.rooms[2]).toEqual(originalLivingRoom)
  })

  it.each([
    ['incomplete', INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD, 'incomplete'],
    ['malformed', MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD, 'malformed'],
    ['incompatible', FUTURE_VACUUM_OUTCOME_PAYLOAD, 'incompatible'],
  ])('keeps legacy strings secondary for an %s typed report', (_name, payload, kind) => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: structuredClone(payload),
    })

    expect(presentation).toMatchObject({
      cleaned: LEGACY_VACUUM_OUTCOMES.while_away_cleaned,
      issues: LEGACY_VACUUM_OUTCOMES.while_away_issues,
      kind,
    })
    expect(presentation.kind).not.toBe('legacy')
  })

  it('uses legacy content only when structured data is genuinely absent', () => {
    expect(vacuumWhileAwayPresentation(LEGACY_VACUUM_OUTCOMES)).toEqual({
      cleaned: LEGACY_VACUUM_OUTCOMES.while_away_cleaned,
      issues: LEGACY_VACUUM_OUTCOMES.while_away_issues,
      kind: 'legacy',
    })
  })

  it('renders nothing for a complete empty v2 contract even when stale legacy strings exist', () => {
    const presentation = vacuumWhileAwayPresentation({
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: {
        complete: true,
        day: '2026-09-18',
        events: [],
        rooms: [],
        version: 2,
      },
    })

    expect(presentation).toEqual({ kind: 'empty' })
  })

  it('renders nothing when neither typed nor legacy data exists', () => {
    expect(vacuumWhileAwayPresentation({})).toEqual({ kind: 'empty' })
  })
})
