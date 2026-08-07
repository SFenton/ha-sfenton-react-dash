import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { INVENTORY_SEARCH_DEBOUNCE_MS } from '../EverShelfInventoryControls'
import type { RecipeBrowseCriteria, RecipeSort } from './recipeTypes'

export const RECIPE_SEARCH_DEBOUNCE_MS = INVENTORY_SEARCH_DEBOUNCE_MS

export interface RecipeFilterValues {
  expiringOnly: boolean
  expiringWithinDays: 7 | 30 | 90
  minimumCoverage: number
  availabilityWeight: number
  expiryWeight: number
}

interface RecipeControlState {
  debouncedSearchQuery: string
  filterDraft: RecipeFilterValues
  filterOpen: boolean
  filters: RecipeFilterValues
  searchQuery: string
  sort: RecipeSort
  sortDraft: RecipeSort
  sortOpen: boolean
}

export interface RecipeControls extends RecipeControlState {
  applyFilter: () => void
  applySort: () => void
  closeFilterSheet: () => void
  closeSortSheet: () => void
  criteria: RecipeBrowseCriteria
  filterActive: boolean
  openFilterSheet: () => void
  openSortSheet: () => void
  resetFilterDraft: () => void
  resetSortDraft: () => void
  searchActive: boolean
  setFilterDraft: (filters: RecipeFilterValues) => void
  setSearchQuery: (query: string) => void
  setSortDraft: (sort: RecipeSort) => void
  sortActive: boolean
}

export const DEFAULT_RECIPE_FILTERS: RecipeFilterValues = {
  expiringOnly: false,
  expiringWithinDays: 7,
  minimumCoverage: 0,
  availabilityWeight: 100,
  expiryWeight: 25,
}

const DEFAULT_RECIPE_CONTROL_STATE: RecipeControlState = {
  debouncedSearchQuery: '',
  filterDraft: DEFAULT_RECIPE_FILTERS,
  filterOpen: false,
  filters: DEFAULT_RECIPE_FILTERS,
  searchQuery: '',
  sort: 'availability',
  sortDraft: 'availability',
  sortOpen: false,
}

function updateScopedRecipeControls(setState: Dispatch<SetStateAction<Record<string, RecipeControlState>>>, scopeKey: string, updater: (state: RecipeControlState) => RecipeControlState) {
  setState((current) => {
    const currentState = current[scopeKey] ?? DEFAULT_RECIPE_CONTROL_STATE
    const nextState = updater(currentState)
    if (nextState === currentState) return current
    return { ...current, [scopeKey]: nextState }
  })
}

function filtersEqual(left: RecipeFilterValues, right: RecipeFilterValues) {
  return left.expiringOnly === right.expiringOnly
    && left.expiringWithinDays === right.expiringWithinDays
    && left.minimumCoverage === right.minimumCoverage
    && left.availabilityWeight === right.availabilityWeight
    && left.expiryWeight === right.expiryWeight
}

export function useRecipeControls(scopeKey: string, enabled = true): RecipeControls {
  const [controlsByScope, setControlsByScope] = useState<Record<string, RecipeControlState>>({})
  const state = controlsByScope[scopeKey] ?? DEFAULT_RECIPE_CONTROL_STATE
  const update = useCallback((updater: (current: RecipeControlState) => RecipeControlState) => {
    updateScopedRecipeControls(setControlsByScope, scopeKey, updater)
  }, [scopeKey])

  useEffect(() => {
    if (!enabled) return undefined
    const timer = window.setTimeout(() => {
      updateScopedRecipeControls(setControlsByScope, scopeKey, (current) => (
        current.debouncedSearchQuery === current.searchQuery ? current : { ...current, debouncedSearchQuery: current.searchQuery }
      ))
    }, RECIPE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [enabled, scopeKey, state.searchQuery])

  useEffect(() => {
    if (
      enabled
      || (
        !state.filterOpen
        && !state.sortOpen
        && state.debouncedSearchQuery === state.searchQuery
      )
    ) return undefined
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      updateScopedRecipeControls(setControlsByScope, scopeKey, (current) => (
        !current.filterOpen
          && !current.sortOpen
          && current.debouncedSearchQuery === current.searchQuery
          ? current
          : {
            ...current,
            debouncedSearchQuery: current.searchQuery,
            filterOpen: false,
            sortOpen: false,
          }
      ))
    })
    return () => {
      cancelled = true
    }
  }, [
    enabled,
    scopeKey,
    state.debouncedSearchQuery,
    state.filterOpen,
    state.searchQuery,
    state.sortOpen,
  ])

  const criteria = useMemo<RecipeBrowseCriteria>(() => ({
    q: state.debouncedSearchQuery,
    sort: state.sort,
    availabilityWeight: state.filters.availabilityWeight,
    expiryWeight: state.filters.expiryWeight,
    minimumCoverage: state.filters.minimumCoverage,
    ...(state.filters.expiringOnly ? { expiringWithinDays: state.filters.expiringWithinDays } : {}),
  }), [state.debouncedSearchQuery, state.filters, state.sort])

  return {
    ...state,
    applyFilter: () => update((current) => filtersEqual(current.filters, current.filterDraft) ? current : { ...current, filters: { ...current.filterDraft } }),
    applySort: () => update((current) => current.sort === current.sortDraft ? current : { ...current, sort: current.sortDraft }),
    closeFilterSheet: () => update((current) => ({ ...current, filterOpen: false })),
    closeSortSheet: () => update((current) => ({ ...current, sortOpen: false })),
    criteria,
    filterActive: !filtersEqual(state.filters, DEFAULT_RECIPE_FILTERS),
    openFilterSheet: () => update((current) => ({ ...current, filterDraft: { ...current.filters }, filterOpen: true })),
    openSortSheet: () => update((current) => ({ ...current, sortDraft: current.sort, sortOpen: true })),
    resetFilterDraft: () => update((current) => ({ ...current, filterDraft: { ...DEFAULT_RECIPE_FILTERS } })),
    resetSortDraft: () => update((current) => ({ ...current, sortDraft: 'availability' })),
    searchActive: state.searchQuery.trim() !== '',
    setFilterDraft: (filters) => update((current) => ({ ...current, filterDraft: filters })),
    setSearchQuery: (query) => update((current) => current.searchQuery === query ? current : { ...current, searchQuery: query }),
    setSortDraft: (sort) => update((current) => ({ ...current, sortDraft: sort })),
    sortActive: state.sort !== 'availability',
  }
}
