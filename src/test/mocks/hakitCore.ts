import type { ReactNode } from 'react'
import { entity, mockEntities, mockState } from './hakitCoreState'
import type { MockHassState } from './hakitCoreState'

export function HassConnect({ children }: { children: ReactNode }) {
  return children
}

export function useEntity(entityId: string, options?: { returnNullIfNotFound?: boolean }) {
  const found = mockEntities[entityId]
  if (!found && options?.returnNullIfNotFound) return null
  return found ?? entity(entityId, 'unknown')
}

export function useHass<T>(selector: (state: MockHassState) => T): T {
  return selector(mockState)
}

export function useUser() {
  return mockState.user
}