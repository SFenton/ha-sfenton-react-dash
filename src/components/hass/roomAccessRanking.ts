import type { RoomNavigationConfig } from '../../constants/atAGlance'

interface RoomAccessEntity {
  state: string
}

export function roomAccessCount(entity: RoomAccessEntity | null | undefined) {
  const count = Number(entity?.state)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

export function rankRoomsByAccess(
  rooms: readonly RoomNavigationConfig[],
  entities: Record<string, RoomAccessEntity | undefined>,
) {
  return rooms
    .map((room, configuredIndex) => ({
      configuredIndex,
      count: roomAccessCount(entities[room.accessCounterEntityId]),
      room,
    }))
    .sort((left, right) => right.count - left.count || left.configuredIndex - right.configuredIndex)
    .map(({ room }) => room)
}
