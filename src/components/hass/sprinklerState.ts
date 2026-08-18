import type { HassEntity } from 'home-assistant-js-websocket'
import type { SprinklerControllerConfig, SprinklerZoneConfig } from '../../constants/sprinklers'
import { SPRINKLER_LOW_BATTERY_PERCENT } from '../../constants/sprinklers'

export type SprinklerEntityMap = Record<string, HassEntity | undefined>
export const SPRINKLER_STATUS = {
  fault: 0,
  ready: 1,
  unavailable: 2,
  watering: 3,
} as const

export type SprinklerControllerStatus = (typeof SPRINKLER_STATUS)[keyof typeof SPRINKLER_STATUS]

export interface SprinklerProgramSnapshot {
  available: boolean
  budget: number
  days: number[]
  enabled: boolean
  entityId: string
  letter: string | null
  name: string | null
  runTimeMinutes: number | null
  stationIds: number[]
  startTimes: string[]
}

export interface SprinklerLastRun {
  consumptionGallons: number | null
  programName: string | null
  runTimeMinutes: number | null
  startTime: Date | null
  status: string | null
}

export interface SprinklerSnapshot {
  activeValveEntityId: string | null
  available: boolean
  batteryLow: boolean
  batteryPercent: number | null
  fault: boolean
  hubConnected: boolean
  lastRun: SprinklerLastRun
  mode: string
  nextStart: Date | null
  nextStartUnknown: boolean
  rainDelay: boolean
  smartWatering: boolean
  status: SprinklerControllerStatus
  watering: boolean
  zones: SprinklerZoneSnapshot[]
}

export interface SprinklerZoneSnapshot {
  available: boolean
  config: SprinklerZoneConfig
  lastRun: SprinklerLastRun
  name: string
  program: SprinklerProgramSnapshot
  station: number | null
  valveState: string
  watering: boolean
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function numberArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(finiteNumber).filter((item): item is number => item !== null).map((item) => Math.trunc(item))
    : []
}

function dateValue(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function entityAvailable(entity: HassEntity | undefined) {
  return Boolean(entity && entity.state !== 'unavailable' && entity.state !== 'unknown')
}

function programSnapshot(entity: HassEntity | undefined, entityId: string): SprinklerProgramSnapshot {
  const frequency = recordValue(entity?.attributes.frequency)
  const runTimes = Array.isArray(entity?.attributes.run_times) ? entity.attributes.run_times : []
  const runTimeRecords = runTimes.map(recordValue).filter((runTime): runTime is Record<string, unknown> => runTime !== null)
  const firstRunTime = runTimeRecords
    .map((runTime) => finiteNumber(runTime.run_time))
    .find((runTime): runTime is number => runTime !== null) ?? null

  return {
    available: entityAvailable(entity),
    budget: finiteNumber(entity?.attributes.budget) ?? 100,
    days: numberArray(frequency?.days),
    enabled: entity?.state === 'on',
    entityId,
    letter: stringValue(entity?.attributes.program),
    name: stringValue(entity?.attributes.friendly_name),
    runTimeMinutes: firstRunTime,
    stationIds: runTimeRecords.map((runTime) => finiteNumber(runTime.station)).filter((station): station is number => station !== null),
    startTimes: stringArray(entity?.attributes.start_times),
  }
}

function lastRunSnapshot(entity: HassEntity | undefined): SprinklerLastRun {
  return {
    consumptionGallons: finiteNumber(entity?.attributes.consumption_gallons),
    programName: stringValue(entity?.attributes.program_name),
    runTimeMinutes: finiteNumber(entity?.attributes.run_time),
    startTime: dateValue(entity?.attributes.start_time ?? entity?.state),
    status: stringValue(entity?.attributes.status),
  }
}

function zoneName(entity: HassEntity | undefined) {
  return stringValue(entity?.attributes.zone_name)
    ?? stringValue(entity?.attributes.friendly_name)
    ?? entity?.entity_id
    ?? ''
}

function zoneSnapshot(entities: SprinklerEntityMap, config: SprinklerZoneConfig, programs: SprinklerProgramSnapshot[]): SprinklerZoneSnapshot {
  const valve = entities[config.valveEntityId]
  const available = entityAvailable(valve)
  const valveState = valve?.state ?? 'unavailable'
  const station = finiteNumber(valve?.attributes.station)
  const configuredProgram = programs.find((program) => program.entityId === config.programEntityId)
  const stationProgram = station === null ? undefined : programs.find((program) => program.stationIds.includes(station))

  return {
    available,
    config,
    lastRun: lastRunSnapshot(entities[config.historyEntityId]),
    name: zoneName(valve),
    program: stationProgram ?? configuredProgram ?? programSnapshot(undefined, config.programEntityId),
    station,
    valveState,
    watering: available && (valveState === 'open' || valveState === 'opening'),
  }
}

export function buildSprinklerSnapshot(entities: SprinklerEntityMap, config: SprinklerControllerConfig): SprinklerSnapshot {
  const state = entities[config.stateEntityId]
  const modeEntity = entities[config.modeEntityId]
  const battery = entities[config.batteryEntityId]
  const faultEntity = entities[config.faultEntityId]
  const nextWatering = entities[config.nextWateringEntityId]
  const programs = [...new Set(config.zones.map((zone) => zone.programEntityId))]
    .map((entityId) => programSnapshot(entities[entityId], entityId))
  const zones = config.zones.map((zone) => zoneSnapshot(entities, zone, programs))
  const available = entityAvailable(state) && zones.some((zone) => zone.available)
  const activeZone = zones.find((zone) => zone.watering)
  const watering = Boolean(activeZone)
  const fault = available && faultEntity?.state === 'on'
  const mode = entityAvailable(modeEntity) ? modeEntity?.state ?? 'unavailable' : state?.state ?? 'unavailable'
  const batteryPercent = entityAvailable(battery) ? finiteNumber(battery?.state) : null
  const status: SprinklerControllerStatus = !available
    ? SPRINKLER_STATUS.unavailable
    : fault
      ? SPRINKLER_STATUS.fault
      : watering
        ? SPRINKLER_STATUS.watering
        : SPRINKLER_STATUS.ready

  return {
    activeValveEntityId: activeZone?.config.valveEntityId ?? null,
    available,
    batteryLow: batteryPercent !== null && batteryPercent <= SPRINKLER_LOW_BATTERY_PERCENT,
    batteryPercent,
    fault,
    hubConnected: entities[config.hubConnectedEntityId]?.state === 'on',
    lastRun: zones.map((zone) => zone.lastRun).reduce<SprinklerLastRun>((latest, candidate) => {
      if (!candidate.startTime) return latest
      if (!latest.startTime || candidate.startTime > latest.startTime) return candidate
      return latest
    }, { consumptionGallons: null, programName: null, runTimeMinutes: null, startTime: null, status: null }),
    mode,
    nextStart: entityAvailable(nextWatering) ? dateValue(nextWatering?.state) : null,
    nextStartUnknown: nextWatering?.state === 'unknown',
    rainDelay: available && entities[config.rainDelayEntityId]?.state === 'on',
    smartWatering: available && entities[config.smartWateringEntityId]?.state === 'on',
    status,
    watering,
    zones,
  }
}
