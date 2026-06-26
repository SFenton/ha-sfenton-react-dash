import { useState, type Dispatch, type SetStateAction } from 'react'

export type InventorySortMode = 'title' | 'expiry'
export type InventorySortDirection = 'ascending' | 'descending'
export type InventoryFilterMode = 'all' | 'expired' | 'week' | 'month' | 'six-months' | 'year' | 'no-expiration'

type InventoryControlState = {
  filterDraftMode: InventoryFilterMode
  filterMode: InventoryFilterMode
  filterOpen: boolean
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
  setFilterDraftMode: (mode: InventoryFilterMode) => void
  setSortDraftDirection: (direction: InventorySortDirection) => void
  setSortDraftMode: (mode: InventorySortMode) => void
  sortActive: boolean
}

const DEFAULT_INVENTORY_CONTROL_STATE: InventoryControlState = {
  filterDraftMode: 'all',
  filterMode: 'all',
  filterOpen: false,
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
    return { ...current, [scopeKey]: nextState }
  })
}

export function useEverShelfInventoryControls(scopeKey: string): EverShelfInventoryControls {
  const [controlsByScope, setControlsByScope] = useState<Record<string, InventoryControlState>>({})
  const state = controlsByScope[scopeKey] ?? DEFAULT_INVENTORY_CONTROL_STATE
  const update = (updater: (state: InventoryControlState) => InventoryControlState) => updateScopedInventoryControls(setControlsByScope, scopeKey, updater)

  return {
    ...state,
    filterActive: state.filterMode !== 'all',
    sortActive: state.sortMode !== 'title' || state.sortDirection !== 'ascending',
    openSortSheet: () => update((current) => ({ ...current, sortDraftMode: current.sortMode, sortDraftDirection: current.sortDirection, sortOpen: true })),
    closeSortSheet: () => update((current) => ({ ...current, sortOpen: false })),
    openFilterSheet: () => update((current) => ({ ...current, filterDraftMode: current.filterMode, filterOpen: true })),
    closeFilterSheet: () => update((current) => ({ ...current, filterOpen: false })),
    applySort: () => update((current) => ({ ...current, sortMode: current.sortDraftMode, sortDirection: current.sortDraftDirection })),
    applyFilter: () => update((current) => ({ ...current, filterMode: current.filterDraftMode })),
    resetSortDraft: () => update((current) => ({ ...current, sortDraftMode: 'title', sortDraftDirection: 'ascending' })),
    resetFilterDraft: () => update((current) => ({ ...current, filterDraftMode: 'all' })),
    setSortDraftMode: (mode) => update((current) => ({ ...current, sortDraftMode: mode })),
    setSortDraftDirection: (direction) => update((current) => ({ ...current, sortDraftDirection: direction })),
    setFilterDraftMode: (mode) => update((current) => ({ ...current, filterDraftMode: mode })),
  }
}
