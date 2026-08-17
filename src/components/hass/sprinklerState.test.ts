import type { HassEntity } from 'home-assistant-js-websocket'
import { BACKYARD_SPRINKLER, FRONT_YARD_SPRINKLER } from '../../constants/sprinklers'
import { buildSprinklerSnapshot, SPRINKLER_STATUS, type SprinklerEntityMap } from './sprinklerState'

function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}) {
  return { attributes, entity_id: entityId, state } as HassEntity
}

function frontYardEntities(): SprinklerEntityMap {
  const zone = FRONT_YARD_SPRINKLER.zones[0]
  return {
    [FRONT_YARD_SPRINKLER.batteryEntityId]: entity(FRONT_YARD_SPRINKLER.batteryEntityId, '12'),
    [FRONT_YARD_SPRINKLER.faultEntityId]: entity(FRONT_YARD_SPRINKLER.faultEntityId, 'off'),
    [FRONT_YARD_SPRINKLER.hubConnectedEntityId]: entity(FRONT_YARD_SPRINKLER.hubConnectedEntityId, 'on'),
    [FRONT_YARD_SPRINKLER.modeEntityId]: entity(FRONT_YARD_SPRINKLER.modeEntityId, 'auto'),
    [FRONT_YARD_SPRINKLER.nextWateringEntityId]: entity(FRONT_YARD_SPRINKLER.nextWateringEntityId, '2026-08-14T02:00:00+00:00'),
    [FRONT_YARD_SPRINKLER.rainDelayEntityId]: entity(FRONT_YARD_SPRINKLER.rainDelayEntityId, 'off'),
    [FRONT_YARD_SPRINKLER.smartWateringEntityId]: entity(FRONT_YARD_SPRINKLER.smartWateringEntityId, 'on'),
    [FRONT_YARD_SPRINKLER.stateEntityId]: entity(FRONT_YARD_SPRINKLER.stateEntityId, 'auto'),
    [zone.programEntityId]: entity(zone.programEntityId, 'on', {
      budget: 100,
      frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
      friendly_name: 'Front Yard Front Yard program',
      program: 'a',
      run_times: [{ run_time: 15, station: 1 }],
      start_times: ['07:00', '19:00'],
    }),
    [zone.valveEntityId]: entity(zone.valveEntityId, 'closed', { station: 1, zone_name: 'Front Yard' }),
    [zone.historyEntityId]: entity(zone.historyEntityId, '2026-08-13T14:00:00+00:00', {
      consumption_gallons: 91,
      program_name: 'Front Yard',
      run_time: 15,
      start_time: '2026-08-13T14:00:00.000Z',
      status: 'complete',
    }),
  }
}

describe('buildSprinklerSnapshot', () => {
  it('normalizes the available Front Yard controller and program', () => {
    const snapshot = buildSprinklerSnapshot(frontYardEntities(), FRONT_YARD_SPRINKLER)

    expect(snapshot).toMatchObject({
      activeValveEntityId: null,
      available: true,
      batteryLow: true,
      batteryPercent: 12,
      hubConnected: true,
      mode: 'auto',
      rainDelay: false,
      smartWatering: true,
      status: SPRINKLER_STATUS.ready,
      watering: false,
    })
    expect(snapshot.zones[0]).toMatchObject({
      available: true,
      name: 'Front Yard',
      program: {
        available: true,
        budget: 100,
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        entityId: FRONT_YARD_SPRINKLER.zones[0].programEntityId,
        letter: 'a',
        name: 'Front Yard Front Yard program',
        runTimeMinutes: 15,
        stationIds: [1],
        startTimes: ['07:00', '19:00'],
      },
      station: 1,
    })
  })

  it('makes availability override stale zone attributes', () => {
    const entities = frontYardEntities()
    const zone = FRONT_YARD_SPRINKLER.zones[0]
    entities[zone.valveEntityId] = entity(zone.valveEntityId, 'unavailable', {
      current_runtime: 15,
      started_watering_station_at: '2025-09-12T03:20:00.000Z',
    })

    const snapshot = buildSprinklerSnapshot(entities, FRONT_YARD_SPRINKLER)

    expect(snapshot.available).toBe(false)
    expect(snapshot.status).toBe(SPRINKLER_STATUS.unavailable)
    expect(snapshot.watering).toBe(false)
    expect(snapshot.activeValveEntityId).toBeNull()
  })

  it('tracks the one active zone and prioritizes controller faults', () => {
    const entities = frontYardEntities()
    const zone = FRONT_YARD_SPRINKLER.zones[0]
    entities[zone.valveEntityId] = entity(zone.valveEntityId, 'open', { zone_name: 'Front Yard' })
    expect(buildSprinklerSnapshot(entities, FRONT_YARD_SPRINKLER)).toMatchObject({
      activeValveEntityId: zone.valveEntityId,
      status: SPRINKLER_STATUS.watering,
      watering: true,
    })

    entities[FRONT_YARD_SPRINKLER.faultEntityId] = entity(FRONT_YARD_SPRINKLER.faultEntityId, 'on')
    expect(buildSprinklerSnapshot(entities, FRONT_YARD_SPRINKLER).status).toBe(SPRINKLER_STATUS.fault)
  })

  it('uses live Backyard zone names instead of legacy entity-id names', () => {
    const entities: SprinklerEntityMap = {
      [BACKYARD_SPRINKLER.stateEntityId]: entity(BACKYARD_SPRINKLER.stateEntityId, 'auto'),
      [BACKYARD_SPRINKLER.modeEntityId]: entity(BACKYARD_SPRINKLER.modeEntityId, 'auto'),
      [BACKYARD_SPRINKLER.batteryEntityId]: entity(BACKYARD_SPRINKLER.batteryEntityId, '100'),
      [BACKYARD_SPRINKLER.faultEntityId]: entity(BACKYARD_SPRINKLER.faultEntityId, 'off'),
      [BACKYARD_SPRINKLER.hubConnectedEntityId]: entity(BACKYARD_SPRINKLER.hubConnectedEntityId, 'on'),
      [BACKYARD_SPRINKLER.nextWateringEntityId]: entity(BACKYARD_SPRINKLER.nextWateringEntityId, 'unknown'),
      [BACKYARD_SPRINKLER.rainDelayEntityId]: entity(BACKYARD_SPRINKLER.rainDelayEntityId, 'off'),
      [BACKYARD_SPRINKLER.smartWateringEntityId]: entity(BACKYARD_SPRINKLER.smartWateringEntityId, 'on'),
    }
    const liveNames = ['Sidewalk (New)', 'Bushes (New)', 'Backyard', 'House']
    BACKYARD_SPRINKLER.zones.forEach((zone, index) => {
      entities[zone.valveEntityId] = entity(zone.valveEntityId, 'closed', { zone_name: liveNames[index] })
      entities[zone.programEntityId] = entity(zone.programEntityId, index === 2 ? 'off' : 'on', {
        budget: 100,
        frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
        friendly_name: `Backyard Faucet Program ${index + 1}`,
        program: String.fromCharCode(97 + index),
        run_times: [{ run_time: 15, station: index + 1 }],
        start_times: ['07:00', '19:00'],
      })
      entities[zone.historyEntityId] = entity(zone.historyEntityId, 'unknown')
    })

    const snapshot = buildSprinklerSnapshot(entities, BACKYARD_SPRINKLER)

    expect(snapshot.available).toBe(true)
    expect(snapshot.batteryPercent).toBe(100)
    expect(snapshot.nextStartUnknown).toBe(true)
    expect(snapshot.zones.map((zone) => zone.name)).toEqual(liveNames)
    expect(snapshot.zones.map((zone) => zone.program.enabled)).toEqual([true, true, false, true])
  })

  it('associates schedules by live station instead of legacy entity naming', () => {
    const entities: SprinklerEntityMap = {
      [BACKYARD_SPRINKLER.stateEntityId]: entity(BACKYARD_SPRINKLER.stateEntityId, 'auto'),
    }
    BACKYARD_SPRINKLER.zones.forEach((zone, index) => {
      entities[zone.valveEntityId] = entity(zone.valveEntityId, 'closed', { station: index + 1, zone_name: `Zone ${index + 1}` })
      const targetStation = index === 0 ? 2 : index === 1 ? 1 : index + 1
      entities[zone.programEntityId] = entity(zone.programEntityId, 'on', {
        run_times: [{ run_time: 15, station: targetStation }],
      })
    })

    const snapshot = buildSprinklerSnapshot(entities, BACKYARD_SPRINKLER)

    expect(snapshot.zones[0].program.entityId).toBe(BACKYARD_SPRINKLER.zones[1].programEntityId)
    expect(snapshot.zones[1].program.entityId).toBe(BACKYARD_SPRINKLER.zones[0].programEntityId)
  })
})
