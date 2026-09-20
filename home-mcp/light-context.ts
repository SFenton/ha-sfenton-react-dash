import { HOUSE_LIGHT_ROOMS } from './lights-config'
import type { LightAction, LightContext } from './light-skill'

const ACTIONS = new Set<LightAction>([
  'on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on',
  'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules',
])
const STATES = new Set<NonNullable<LightContext['lastState']>>(['on', 'off', 'mixed', 'unavailable'])

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function canonicalizeLightContext(
  value: unknown,
  options: { retainEntityIds?: boolean } = {},
): LightContext | null {
  if (!object(value) || value.domain !== 'lights'
    || !(value.roomId === null || typeof value.roomId === 'string')
    || !Array.isArray(value.entityIds) || !value.entityIds.every((item) => typeof item === 'string')
    || !Array.isArray(value.lightNames) || !value.lightNames.every((item) => typeof item === 'string')) return null
  const lastAction = value.lastAction === 'brightness' ? 'brightness-state' : value.lastAction
  if (lastAction !== undefined && (typeof lastAction !== 'string' || !ACTIONS.has(lastAction as LightAction))) return null
  if (value.lastState !== undefined && (typeof value.lastState !== 'string' || !STATES.has(value.lastState as NonNullable<LightContext['lastState']>))) return null
  if (value.targetState !== undefined && value.targetState !== 'on' && value.targetState !== 'off') return null
  if (value.historyBefore !== undefined && (
    typeof value.historyBefore !== 'string' || value.historyBefore.length > 64 || Number.isNaN(Date.parse(value.historyBefore))
  )) return null
  const roomIds = value.roomIds === undefined
    ? undefined
    : Array.isArray(value.roomIds) && value.roomIds.length <= HOUSE_LIGHT_ROOMS.length
      && value.roomIds.every((item) => typeof item === 'string')
      && new Set(value.roomIds).size === value.roomIds.length
      ? value.roomIds
      : null
  if (roomIds === null || roomIds?.some((id) => !HOUSE_LIGHT_ROOMS.some((room) => room.id === id))) return null
  const roomLightNames = value.roomLightNames === undefined
    ? undefined
    : object(value.roomLightNames)
      ? value.roomLightNames
      : null
  if (roomLightNames === null || (roomLightNames && !roomIds?.length)) return null
  const canonicalRoomLightNames: Record<string, string[]> = {}
  if (roomLightNames) {
    for (const [roomId, names] of Object.entries(roomLightNames)) {
      const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === roomId)
      if (!room || !roomIds?.includes(roomId) || !Array.isArray(names)
        || names.length < 1 || names.length > room.lights.length || new Set(names).size !== names.length
        || !names.every((name) => typeof name === 'string' && room.lights.some((light) => light.name === name))) return null
      canonicalRoomLightNames[roomId] = names
    }
    if (!Object.keys(canonicalRoomLightNames).length) return null
  }

  if (value.roomId === null) {
    if (value.entityIds.length || value.lightNames.length) return null
    return {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      ...(roomIds?.length ? { roomIds: [...roomIds] } : {}),
      ...(Object.keys(canonicalRoomLightNames).length ? { roomLightNames: canonicalRoomLightNames } : {}),
      ...(lastAction ? { lastAction: lastAction as LightAction } : {}),
      ...(value.lastState ? { lastState: value.lastState as NonNullable<LightContext['lastState']> } : {}),
      ...(value.targetState ? { targetState: value.targetState as 'on' | 'off' } : {}),
      ...(value.historyBefore ? { historyBefore: value.historyBefore } : {}),
    }
  }

  const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === value.roomId)
  if (!room || roomIds?.length || roomLightNames
    || new Set(value.entityIds).size !== value.entityIds.length || new Set(value.lightNames).size !== value.lightNames.length) return null
  const byIds = value.entityIds.map((id) => room.lights.find((light) => light.entityId === id))
  if (byIds.some((light) => !light)) return null
  const byNames = value.lightNames.map((name) => room.lights.find((light) => light.name === name))
  if (byNames.some((light) => !light)) return null
  const selected = byIds.length ? byIds : byNames
  const entityIds = selected.map((light) => light!.entityId)
  const lightNames = selected.map((light) => light!.name)
  if (byIds.length && byNames.length && (
    byIds.length !== byNames.length || byIds.some((light, index) => light!.name !== byNames[index]!.name)
  )) return null

  return {
    domain: 'lights',
    roomId: room.id,
    entityIds: options.retainEntityIds === false ? [] : entityIds,
    lightNames,
    ...(lastAction ? { lastAction: lastAction as LightAction } : {}),
    ...(value.lastState ? { lastState: value.lastState as NonNullable<LightContext['lastState']> } : {}),
    ...(value.targetState ? { targetState: value.targetState as 'on' | 'off' } : {}),
    ...(value.historyBefore ? { historyBefore: value.historyBefore } : {}),
  }
}
