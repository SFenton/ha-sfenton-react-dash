import { useHass } from '@hakit/core'
import { GUEST_CONTROL_ITEMS } from '../../constants/portedDashboard'

const guestToggleEntityIds = GUEST_CONTROL_ITEMS.map((item) => item.entityId)

export function useGuestPresenceSecurityActive() {
  return useHass((state) => guestToggleEntityIds.some((entityId) => state.entities[entityId]?.state === 'on'))
}
