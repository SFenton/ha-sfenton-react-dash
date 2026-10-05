import type { HassEntity } from 'home-assistant-js-websocket'
import { isContactOpen } from '../components/hass/entityState'
import type { EntityGroupConfig } from '../constants/atAGlance'
import { COMMON_COPY_NAMESPACE, ROOM_GROUP_COPY_KEYS, copy } from '../i18n'

type RoomGroupItem = EntityGroupConfig['items'][number]
type ContactItemKind = 'door' | 'window'

const CONTACT_ITEM_KINDS: readonly ContactItemKind[] = ['window', 'door']

export function contactItemKind(item: RoomGroupItem): ContactItemKind {
  const value = `${item.title} ${item.entityId}`.toLowerCase()
  return value.includes('window') ? 'window' : 'door'
}

function contactItemCount(item: RoomGroupItem) {
  return item.contactCount ?? 1
}

function contactKindOpenSummary(kind: ContactItemKind, openCount: number, totalCount: number) {
  const keys = ROOM_GROUP_COPY_KEYS.contact[kind]
  if (totalCount === 1) return copy(COMMON_COPY_NAMESPACE, openCount === 1 ? keys.open : keys.closed)
  if (openCount === 0) return copy(COMMON_COPY_NAMESPACE, keys.allClosed)
  if (openCount === totalCount) return copy(COMMON_COPY_NAMESPACE, keys.allOpen)
  return copy(COMMON_COPY_NAMESPACE, keys.openCount, { count: openCount })
}

export function contactGroupOpenSummary(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const counts = group.items.reduce(
    (nextCounts, item) => {
      const kind = contactItemKind(item)
      nextCounts[kind].total += contactItemCount(item)
      if (isContactOpen(entities[item.entityId])) nextCounts[kind].open += 1
      return nextCounts
    },
    {
      door: { open: 0, total: 0 },
      window: { open: 0, total: 0 },
    },
  )

  const activeKinds = CONTACT_ITEM_KINDS.filter((kind) => counts[kind].total > 0)

  if (activeKinds.length === 1) {
    const kind = activeKinds[0]
    return contactKindOpenSummary(kind, counts[kind].open, counts[kind].total)
  }

  const openParts = activeKinds
    .filter((kind) => counts[kind].open > 0)
    .map((kind) => contactKindOpenSummary(kind, counts[kind].open, counts[kind].total))

  return openParts.length > 0 ? openParts.join(', ') : copy(COMMON_COPY_NAMESPACE, ROOM_GROUP_COPY_KEYS.contact.allClosed)
}
