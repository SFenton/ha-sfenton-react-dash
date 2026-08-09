import type { RoomSourceKind } from '../constants/roomPages'

export function roomCardFamilyArticleId(kind: RoomSourceKind) {
  return `room-card-family-${kind}`
}

export function roomCardFamilySourceId(kind: RoomSourceKind) {
  return `room-card-kind:${kind}`
}

export function roomCardFamilySurfaceId(kind: RoomSourceKind) {
  return `family:${roomCardFamilySourceId(kind)}`
}
