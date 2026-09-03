import { useSyncExternalStore, type ReactNode } from 'react'
import { entity, getMockHassRevision, mockEntities, mockState, subscribeMockHass } from './hakitCoreState'
import type { MockHassState } from './hakitCoreState'

export const OFF = 'off'
export const ON = 'on'
export const UNAVAILABLE = 'unavailable'
export const UNAVAILABLE_STATES = ['unavailable', 'unknown'] as const

export function HassConnect({ children }: { children: ReactNode }) {
  return children
}

function useMockHassRevision() {
  useSyncExternalStore(subscribeMockHass, getMockHassRevision, getMockHassRevision)
}

export function useEntity(entityId: string, options?: { returnNullIfNotFound?: boolean }) {
  useMockHassRevision()
  const found = mockEntities[entityId]
  if (!found && options?.returnNullIfNotFound) return null
  return found ?? entity(entityId, 'unknown')
}

export function useHass<T>(selector: (state: MockHassState) => T): T {
  useMockHassRevision()
  return selector(mockState)
}

export function useUser() {
  useMockHassRevision()
  return mockState.user
}