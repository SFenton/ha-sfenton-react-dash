import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export type InventorySortMode = 'title' | 'expiry'
export type InventorySortDirection = 'ascending' | 'descending'
export type InventoryFilterMode = 'all' | 'expired' | 'week' | 'month' | 'six-months' | 'year' | 'no-expiration'
export type InventoryLoadPhase = 'content' | 'exiting' | 'loading'
export const INVENTORY_SEARCH_DEBOUNCE_MS = 250

type InventoryControlState = {
  debouncedSearchQuery: string
  filterDraftMode: InventoryFilterMode
  filterMode: InventoryFilterMode
  filterOpen: boolean
  inventoryItemCount: number | null
  inventoryLoadPhase: InventoryLoadPhase
  searchQuery: string
  sortDirection: InventorySortDirection
  sortDraftDirection: InventorySortDirection
  sortDraftMode: InventorySortMode
  sortMode: InventorySortMode
  sortOpen: boolean
}

export interface EverShelfInventoryControls extends InventoryControlState {
  closeFilterSheet: () => void
  closeSortSheet: () => void
  filterActive: boolean
  openFilterSheet: () => void
  openSortSheet: () => void
  applyFilter: () => void
  applySort: () => void
  resetFilterDraft: () => void
  resetSortDraft: () => void
  searchActive: boolean
  setInventoryItemCount: (count: number | null) => void
  setInventoryLoadPhase: (phase: InventoryLoadPhase) => void
  setSearchQuery: (query: string) => void
  setFilterDraftMode: (mode: InventoryFilterMode) => void
  setSortDraftDirection: (direction: InventorySortDirection) => void
  setSortDraftMode: (mode: InventorySortMode) => void
  sortActive: boolean
}

const DEFAULT_INVENTORY_CONTROL_STATE: InventoryControlState = {
  debouncedSearchQuery: '',
  filterDraftMode: 'all',
  filterMode: 'all',
  filterOpen: false,
  inventoryItemCount: null,
  inventoryLoadPhase: 'loading',
  searchQuery: '',
  sortDirection: 'ascending',
  sortDraftDirection: 'ascending',
  sortDraftMode: 'title',
  sortMode: 'title',
  sortOpen: false,
}

function updateScopedInventoryControls(setState: Dispatch<SetStateAction<Record<string, InventoryControlState>>>, scopeKey: string, updater: (state: InventoryControlState) => InventoryControlState) {
  setState((current) => {
    const currentState = current[scopeKey] ?? DEFAULT_INVENTORY_CONTROL_STATE
    const nextState = updater(currentState)
    if (nextState === currentState) return current
    return { ...current, [scopeKey]: nextState }
  })
}

export function useEverShelfInventoryControls(scopeKey: string, enabled = true): EverShelfInventoryControls {
  const [controlsByScope, setControlsByScope] = useState<Record<string, InventoryControlState>>({})
  const state = controlsByScope[scopeKey] ?? DEFAULT_INVENTORY_CONTROL_STATE
  const update = useCallback((updater: (state: InventoryControlState) => InventoryControlState) => updateScopedInventoryControls(setControlsByScope, scopeKey, updater), [scopeKey])
  const setInventoryItemCount = useCallback((count: number | null) => update((current) => (current.inventoryItemCount === count ? current : { ...current, inventoryItemCount: count })), [update])
  const setInventoryLoadPhase = useCallback((phase: InventoryLoadPhase) => update((current) => (current.inventoryLoadPhase === phase ? current : { ...current, inventoryLoadPhase: phase })), [update])

  useEffect(() => {
    if (!enabled) return undefined
    const timer = window.setTimeout(() => {
      updateScopedInventoryControls(setControlsByScope, scopeKey, (current) => (
        current.debouncedSearchQuery === current.searchQuery ? current : { ...current, debouncedSearchQuery: current.searchQuery }
      ))
    }, INVENTORY_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [enabled, scopeKey, state.searchQuery])

  return {
    ...state,
    filterActive: state.filterMode !== 'all',
    searchActive: state.searchQuery.trim() !== '',
    setInventoryItemCount,
    setInventoryLoadPhase,
    sortActive: state.sortMode !== 'title' || state.sortDirection !== 'ascending',
    openSortSheet: () => update((current) => ({ ...current, sortDraftMode: current.sortMode, sortDraftDirection: current.sortDirection, sortOpen: true })),
    closeSortSheet: () => update((current) => ({ ...current, sortOpen: false })),
    openFilterSheet: () => update((current) => ({ ...current, filterDraftMode: current.filterMode, filterOpen: true })),
    closeFilterSheet: () => update((current) => ({ ...current, filterOpen: false })),
    applySort: () => update((current) => ({ ...current, sortMode: current.sortDraftMode, sortDirection: current.sortDraftDirection })),
    applyFilter: () => update((current) => ({ ...current, filterMode: current.filterDraftMode })),
    resetSortDraft: () => update((current) => ({ ...current, sortDraftMode: 'title', sortDraftDirection: 'ascending' })),
    resetFilterDraft: () => update((current) => ({ ...current, filterDraftMode: 'all' })),
    setSearchQuery: (query) => update((current) => (current.searchQuery === query ? current : { ...current, searchQuery: query })),
    setSortDraftMode: (mode) => update((current) => ({ ...current, sortDraftMode: mode })),
    setSortDraftDirection: (direction) => update((current) => ({ ...current, sortDraftDirection: direction })),
    setFilterDraftMode: (mode) => update((current) => ({ ...current, filterDraftMode: mode })),
  }
}
