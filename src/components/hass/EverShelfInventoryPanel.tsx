import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type TouchEvent } from 'react'
import { flushSync } from 'react-dom'
import { useHass } from '@hakit/core'
import { Description } from '../core/Description'
import { EmptyState } from '../core/EmptyState'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { RadioRow } from '../core/RadioRow'
import { DashboardPageLoading } from '../shell/DashboardPageLoading'
import type { EverShelfInventoryControls, InventoryFilterMode, InventorySortDirection, InventorySortMode } from './EverShelfInventoryControls'
import styles from './EverShelfInventoryPanel.module.css'

export type EverShelfInventoryLocation = 'dispensa' | 'frigo' | 'freezer' | 'spice_rack' | 'cabinet'

interface EverShelfInventoryPanelProps {
  controls: EverShelfInventoryControls
  location: EverShelfInventoryLocation
  title: string
}

interface EverShelfInventoryItem {
  expiration_date?: string | null
  expiry_date?: string | null
  expires_at?: string | null
  id?: number | string
  inventory_id?: number | string
  name?: string | null
  quantity?: number | string | null
}

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface ExpiryInfo {
  label: string
  tone?: 'expired' | 'soon'
}

type PantryRowShoppingState = 'added' | 'adding' | 'idle'

const DAY_MS = 24 * 60 * 60 * 1000
const SORT_FILTER_COLOR = { r: 42, g: 126, b: 180 }
const SORT_FILTER_ACTIVE_COLOR = { r: 155, g: 110, b: 64 }
const DASHBOARD_FAB_KEYBOARD_INSET_VAR = '--dashboard-fab-keyboard-inset'
const INVENTORY_SEARCH_EXPANDED_ATTR = 'data-inventory-search-expanded'
const INVENTORY_LOADING_EXIT_MS = 500
const HASS_GROCERY_LIST_ENTITY_ID = 'todo.shopping_list'
const KEYBOARD_STATE_CLEAR_MS = 150
const SHOPPING_ADDED_VISIBLE_MS = 3000

const SORT_OPTIONS: { label: string; subtitle: string; value: InventorySortMode }[] = [
  { label: 'Title', subtitle: 'Sort alphabetically by item name.', value: 'title' },
  { label: 'Expiration Date', subtitle: 'Sort by the item expiration date.', value: 'expiry' },
]

const SORT_DIRECTION_DETAILS: Record<InventorySortDirection, { hint: string; icon: string; label: string }> = {
  ascending: { hint: 'Ascending (A-Z, soonest first)', icon: 'mdi:arrow-up', label: 'Ascending' },
  descending: { hint: 'Descending (Z-A, latest first)', icon: 'mdi:arrow-down', label: 'Descending' },
}

const SORT_DIRECTION_VALUES: InventorySortDirection[] = [
  'ascending',
  'descending',
]

const FILTER_OPTIONS: { label: string; subtitle: string; value: InventoryFilterMode }[] = [
  { label: 'All Items', subtitle: 'Show everything in this location.', value: 'all' },
  { label: 'Expired', subtitle: 'Only items past their expiration date.', value: 'expired' },
  { label: 'Expiring Within a Week', subtitle: 'Items expiring in the next 7 days.', value: 'week' },
  { label: 'Expiring Within a Month', subtitle: 'Items expiring in the next 30 days.', value: 'month' },
  { label: 'Expiring Within 6 Months', subtitle: 'Items expiring in the next 6 months.', value: 'six-months' },
  { label: 'Expiring Within a Year', subtitle: 'Items expiring in the next year.', value: 'year' },
  { label: 'No Expiration Date', subtitle: 'Items without a usable expiration date.', value: 'no-expiration' },
]

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function itemName(item: EverShelfInventoryItem) {
  return compactText(item.name) ?? 'Untitled item'
}

function itemExpiryDate(item: EverShelfInventoryItem) {
  return compactText(item.expiry_date ?? item.expiration_date ?? item.expires_at ?? undefined)
}

function parseIsoDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function itemExpiryTime(item: EverShelfInventoryItem) {
  const value = itemExpiryDate(item)
  if (!value) return null
  return parseIsoDateOnly(value)?.getTime() ?? null
}

function itemSearchText(item: EverShelfInventoryItem) {
  return itemName(item).toLocaleLowerCase()
}

function normalizedSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase()
}

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatDisplayDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${month}/${day}/${value.getFullYear()}`
}

function expiryInfo(value: string | undefined): ExpiryInfo {
  if (!value) return { label: 'No expiration date' }

  const expiryDate = parseIsoDateOnly(value)
  if (!expiryDate) return { label: 'No expiration date' }

  const daysUntilExpiry = daysUntilDate(expiryDate)
  if (daysUntilExpiry < 0) {
    return { label: `Expired on ${formatDisplayDate(expiryDate)}`, tone: 'expired' }
  }

  const label = `Expires on ${formatDisplayDate(expiryDate)}`
  return daysUntilExpiry < 7 ? { label, tone: 'soon' } : { label }
}

function daysUntilDate(value: Date) {
  return Math.ceil((value.getTime() - todayDateOnly().getTime()) / DAY_MS)
}

function daysUntilExpiry(item: EverShelfInventoryItem) {
  const value = itemExpiryDate(item)
  if (!value) return null
  const expiryDate = parseIsoDateOnly(value)
  return expiryDate ? daysUntilDate(expiryDate) : null
}

function inventoryFromResponse(result: unknown): EverShelfInventoryItem[] {
  const response = result && typeof result === 'object'
    ? (result as { response?: unknown; service_response?: unknown }).response ?? (result as { service_response?: unknown }).service_response ?? result
    : result
  if (!response || typeof response !== 'object') return []
  const inventory = (response as { inventory?: unknown }).inventory
  return Array.isArray(inventory) ? inventory.filter((item): item is EverShelfInventoryItem => Boolean(item && typeof item === 'object')) : []
}

function filterInventoryItems(items: EverShelfInventoryItem[], filterMode: InventoryFilterMode, searchQuery: string) {
  const filteredItems = filterMode === 'all' ? items : items.filter((item) => {
    const days = daysUntilExpiry(item)
    if (filterMode === 'no-expiration') return days === null
    if (days === null) return false
    if (filterMode === 'expired') return days < 0
    if (days < 0) return false
    if (filterMode === 'week') return days <= 7
    if (filterMode === 'month') return days <= 30
    if (filterMode === 'six-months') return days <= 183
    return days <= 365
  })
  const query = normalizedSearchQuery(searchQuery)
  if (!query) return filteredItems
  return filteredItems.filter((item) => itemSearchText(item).includes(query))
}

function sortInventoryItems(items: EverShelfInventoryItem[], sortMode: InventorySortMode, sortDirection: InventorySortDirection) {
  const direction = sortDirection === 'ascending' ? 1 : -1
  return [...items].sort((left, right) => {
    if (sortMode === 'expiry') {
      const leftTime = itemExpiryTime(left)
      const rightTime = itemExpiryTime(right)
      if (leftTime === null && rightTime === null) return itemName(left).localeCompare(itemName(right), undefined, { sensitivity: 'base' })
      if (leftTime === null) return 1
      if (rightTime === null) return -1
      if (leftTime !== rightTime) return (leftTime - rightTime) * direction
    }
    return itemName(left).localeCompare(itemName(right), undefined, { sensitivity: 'base' }) * direction
  })
}

function visibleInventoryItems(items: EverShelfInventoryItem[], sortMode: InventorySortMode, sortDirection: InventorySortDirection, filterMode: InventoryFilterMode, searchQuery: string) {
  return sortInventoryItems(filterInventoryItems(items, filterMode, searchQuery), sortMode, sortDirection)
}

function emptyMatchMessage(searchActive: boolean, filterActive: boolean) {
  if (searchActive && filterActive) return 'No items match the current search and selected filter.'
  if (searchActive) return 'No items match the current search.'
  return 'No items match the selected filter.'
}

function emptySearchDescription(filterActive: boolean) {
  return filterActive
    ? 'Try a different search, clear the selected filter, or clear the search to show all items.'
    : 'Try a different search or clear the search to show all items.'
}

function inventoryErrorDescription(error: string) {
  return error === 'Unable to load inventory' ? 'Try again in a moment, or scan an item while inventory is unavailable.' : error
}

function itemQuantity(item: EverShelfInventoryItem) {
  const quantity = Number(item.quantity)
  return Number.isFinite(quantity) && quantity > 1 ? quantity : null
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function rowSubtitle(expiry: ExpiryInfo, quantity: number | null) {
  return quantity === null ? expiry.label : `Quantity ${formatQuantity(quantity)} - ${expiry.label}`
}

function promptShoppingQuantity(title: string) {
  const value = window.prompt(`Quantity of ${title} to add to EverShelf cart`, '1')
  if (value === null) return null
  const parsedValue = Number(value.trim())
  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : null
}

function PantryRow({ expiry, quantity, title }: { expiry: ExpiryInfo; quantity: number | null; title: string }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [shoppingState, setShoppingState] = useState<PantryRowShoppingState>('idle')
  const [shoppingError, setShoppingError] = useState<string | null>(null)
  const resetShoppingTimerRef = useRef<number | null>(null)
  const subtitle = rowSubtitle(expiry, quantity)
  const shoppingButtonDisabled = shoppingState === 'adding' || shoppingState === 'added'
  const shoppingButtonLabel = shoppingState === 'adding' ? `Adding ${title} to shopping list` : shoppingState === 'added' ? `Added ${title} to shopping list` : `Add ${title} to shopping list`

  const clearResetShoppingTimer = useCallback(() => {
    if (resetShoppingTimerRef.current === null) return
    window.clearTimeout(resetShoppingTimerRef.current)
    resetShoppingTimerRef.current = null
  }, [])

  const showAddedShoppingState = useCallback(() => {
    clearResetShoppingTimer()
    setShoppingState('added')
    resetShoppingTimerRef.current = window.setTimeout(() => {
      setShoppingState('idle')
      resetShoppingTimerRef.current = null
    }, SHOPPING_ADDED_VISIBLE_MS)
  }, [clearResetShoppingTimer])

  useEffect(() => clearResetShoppingTimer, [clearResetShoppingTimer])

  const addToShoppingList = () => {
    if (shoppingButtonDisabled) return

    const shoppingQuantity = promptShoppingQuantity(title)
    if (shoppingQuantity === null) return

    clearResetShoppingTimer()
    setShoppingState('adding')
    setShoppingError(null)
    void Promise.all([
      callService({
        domain: 'evershelf',
        service: 'add_to_shopping',
        serviceData: { name: title, quantity: shoppingQuantity },
      }),
      callService({
        domain: 'todo',
        service: 'add_item',
        target: HASS_GROCERY_LIST_ENTITY_ID,
        serviceData: { item: title },
      }),
    ])
      .then(() => {
        showAddedShoppingState()
      })
      .catch((caughtError: unknown) => {
        clearResetShoppingTimer()
        setShoppingState('idle')
        setShoppingError(caughtError instanceof Error ? caughtError.message : 'Unable to add to shopping list')
      })
  }

  return (
    <div aria-label={`${title} ${subtitle}`} className={styles.pantryRow} data-expiry-tone={expiry.tone} role="group">
      <span className={styles.pantryRowCopy}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
        {shoppingError && <small className={styles.error} role="alert">{shoppingError}</small>}
      </span>
      <span aria-label={`${title} actions`} className={styles.pantryRowActions} role="group">
        <button aria-busy={shoppingState === 'adding' ? 'true' : undefined} aria-label={shoppingButtonLabel} className={styles.rowAction} data-shopping-state={shoppingState} disabled={shoppingButtonDisabled} onClick={addToShoppingList} type="button">
          <span aria-hidden="true" className={styles.shoppingIconStack}>
            <span className={styles.shoppingIconLayer} data-icon-state="cart">
              <MaterialIcon name="mdi:cart-plus" size={22} />
            </span>
            <span className={styles.shoppingIconLayer} data-icon-state="spinner">
              <span className={styles.shoppingSpinner} />
            </span>
            <span className={styles.shoppingIconLayer} data-icon-state="check">
              <MaterialIcon name="mdi:check" size={22} />
            </span>
          </span>
        </button>
        <button aria-label={`Edit ${title}`} className={styles.rowAction} disabled type="button">
          <MaterialIcon name="mdi:pencil" size={22} />
        </button>
        <button aria-label={`Delete ${title}`} className={`${styles.rowAction} ${styles.deleteAction}`} disabled type="button">
          <MaterialIcon name="mdi:delete" size={22} />
        </button>
      </span>
    </div>
  )
}

function InventorySortSheet({ draftDirection, draftMode, onApply, onClose, onDraftDirectionChange, onDraftModeChange, onReset, open }: { draftDirection: InventorySortDirection; draftMode: InventorySortMode; onApply: () => void; onClose: () => void; onDraftDirectionChange: (direction: InventorySortDirection) => void; onDraftModeChange: (mode: InventorySortMode) => void; onReset: () => void; open: boolean }) {
  return (
    <ModalSheet
      footer={(
        <div className={styles.sheetFooter}>
          <button className={styles.resetAction} onClick={onReset} type="button">Reset</button>
          <button className={styles.primaryAction} onClick={() => {
            onApply()
            onClose()
          }} type="button">Apply</button>
        </div>
      )}
      onClose={onClose}
      open={open}
      title="Sort Inventory"
    >
      <div className={styles.sheetStack}>
        <fieldset className={styles.fieldset}>
          <legend>Sort By</legend>
          <div className={styles.radioGroup} role="radiogroup" aria-label="Sort by">
            {SORT_OPTIONS.map((option) => (
              <RadioRow active={draftMode === option.value} key={option.value} onClick={() => onDraftModeChange(option.value)} subtitle={option.subtitle} title={option.label} />
            ))}
          </div>
        </fieldset>
        <section aria-label="Sort direction" className={styles.directionControl}>
          <div className={styles.directionCopy}>
            <strong>Sort Direction</strong>
            <small>{SORT_DIRECTION_DETAILS[draftDirection].hint}</small>
          </div>
          <div className={styles.directionButtons}>
            {SORT_DIRECTION_VALUES.map((direction) => {
              const option = SORT_DIRECTION_DETAILS[direction]
              const active = draftDirection === direction
              return (
                <button
                  aria-label={option.label}
                  aria-pressed={active}
                  className={styles.directionButton}
                  data-active={active ? 'true' : undefined}
                  key={direction}
                  onClick={() => onDraftDirectionChange(direction)}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.directionButtonHalo} />
                  <MaterialIcon name={option.icon} size={22} />
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </ModalSheet>
  )
}

function InventoryFilterSheet({ draftMode, onApply, onClose, onDraftModeChange, onReset, open }: { draftMode: InventoryFilterMode; onApply: () => void; onClose: () => void; onDraftModeChange: (mode: InventoryFilterMode) => void; onReset: () => void; open: boolean }) {
  return (
    <ModalSheet
      footer={(
        <div className={styles.sheetFooter}>
          <button className={styles.resetAction} onClick={onReset} type="button">Reset</button>
          <button className={styles.primaryAction} onClick={() => {
            onApply()
            onClose()
          }} type="button">Apply</button>
        </div>
      )}
      onClose={onClose}
      open={open}
      title="Filter Inventory"
    >
      <fieldset className={styles.fieldset}>
        <legend>Filter Items</legend>
        <div className={styles.radioGroup} role="radiogroup" aria-label="Filter items">
          {FILTER_OPTIONS.map((option) => (
            <RadioRow active={draftMode === option.value} key={option.value} onClick={() => onDraftModeChange(option.value)} subtitle={option.subtitle} title={option.label} />
          ))}
        </div>
      </fieldset>
    </ModalSheet>
  )
}

function updateFabKeyboardInset(inset: number) {
  document.documentElement.style.setProperty(DASHBOARD_FAB_KEYBOARD_INSET_VAR, `${inset}px`)
}

function updateInventorySearchExpanded(expanded: boolean) {
  if (expanded) document.documentElement.setAttribute(INVENTORY_SEARCH_EXPANDED_ATTR, 'true')
  else document.documentElement.removeAttribute(INVENTORY_SEARCH_EXPANDED_ATTR)
}

function useFloatingSearchKeyboardInset(active: boolean) {
  const [keyboardInset, setKeyboardInset] = useState(0)
  const baselineRef = useRef<number | null>(null)
  const clearTimerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (clearTimerRef.current === null) return
    window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = null
  }, [])

  const captureKeyboardBaseline = useCallback(() => {
    clearTimer()
    const visualViewport = window.visualViewport
    const visualViewportBottom = visualViewport ? visualViewport.height + visualViewport.offsetTop : 0
    baselineRef.current = Math.max(
      baselineRef.current ?? 0,
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      visualViewportBottom,
    )
  }, [clearTimer])

  const clearKeyboardStateSoon = useCallback(() => {
    clearTimer()
    clearTimerRef.current = window.setTimeout(() => {
      baselineRef.current = null
      setKeyboardInset(0)
      clearTimerRef.current = null
    }, KEYBOARD_STATE_CLEAR_MS)
  }, [clearTimer])

  const updateKeyboardInset = useCallback(() => {
    if (!active) {
      setKeyboardInset(0)
      return
    }
    const visualViewport = window.visualViewport
    if (!visualViewport) {
      setKeyboardInset(0)
      return
    }
    captureKeyboardBaseline()
    const baseline = baselineRef.current ?? window.innerHeight
    const visibleBottom = visualViewport.height + visualViewport.offsetTop
    const visualViewportLoss = baseline - visibleBottom
    const innerHeightLoss = baseline - window.innerHeight
    setKeyboardInset(Math.max(0, Math.round(visualViewportLoss), Math.round(innerHeightLoss)))
  }, [active, captureKeyboardBaseline])

  useEffect(() => {
    updateFabKeyboardInset(keyboardInset)
  }, [keyboardInset])

  useEffect(() => {
    if (!active) return undefined
    const frameId = window.requestAnimationFrame(updateKeyboardInset)
    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', updateKeyboardInset)
    visualViewport?.addEventListener('scroll', updateKeyboardInset)
    window.addEventListener('resize', updateKeyboardInset)
    return () => {
      window.cancelAnimationFrame(frameId)
      visualViewport?.removeEventListener('resize', updateKeyboardInset)
      visualViewport?.removeEventListener('scroll', updateKeyboardInset)
      window.removeEventListener('resize', updateKeyboardInset)
    }
  }, [active, updateKeyboardInset])

  useEffect(() => () => {
    clearTimer()
    document.documentElement.style.removeProperty(DASHBOARD_FAB_KEYBOARD_INSET_VAR)
  }, [clearTimer])

  return { captureKeyboardBaseline, clearKeyboardStateSoon }
}

function InventorySearchAction({ controls, onExpandedChange }: { controls: EverShelfInventoryControls; onExpandedChange: (expanded: boolean) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasQuery = controls.searchQuery.trim() !== ''
  const { captureKeyboardBaseline, clearKeyboardStateSoon } = useFloatingSearchKeyboardInset(searchFocused)

  useEffect(() => {
    onExpandedChange(expanded)
    updateInventorySearchExpanded(expanded)
    return () => updateInventorySearchExpanded(false)
  }, [expanded, onExpandedChange])

  const focusInput = useCallback(() => {
    captureKeyboardBaseline()
    inputRef.current?.focus({ preventScroll: true })
  }, [captureKeyboardBaseline])

  const expandSearch = useCallback(() => {
    captureKeyboardBaseline()
    flushSync(() => setExpanded(true))
    focusInput()
  }, [captureKeyboardBaseline, focusInput])

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    controls.setSearchQuery(event.target.value)
  }, [controls])

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }, [])

  const handleInputFocus = useCallback(() => {
    captureKeyboardBaseline()
    setSearchFocused(true)
  }, [captureKeyboardBaseline])

  const handleInputBlur = useCallback(() => {
    setSearchFocused(false)
    setExpanded(false)
    clearKeyboardStateSoon()
  }, [clearKeyboardStateSoon])

  const clearSearch = useCallback(() => {
    controls.setSearchQuery('')
    focusInput()
  }, [controls, focusInput])

  const handleClearSearchPressStart = useCallback((event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
  }, [clearSearch])

  const handleClearSearchClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
  }, [clearSearch])

  if (!expanded) {
    return (
      <div className={styles.inventorySearchSlot} data-expanded="false">
        <button aria-label="Search inventory" className={styles.inventorySearchButton} data-active={hasQuery ? 'true' : undefined} onClick={expandSearch} type="button">
          <MaterialIcon name="mdi:magnify" size={26} />
          <span>{hasQuery ? controls.searchQuery : 'Search'}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={styles.inventorySearchSlot} data-expanded="true">
      <label className={styles.inventorySearchBar}>
        <span className={styles.inventorySearchIcon} aria-hidden="true"><MaterialIcon name="mdi:magnify" size={26} /></span>
        <input
          aria-label="Search inventory"
          autoComplete="off"
          className={styles.inventorySearchInput}
          enterKeyHint="search"
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder="Search items..."
          ref={inputRef}
          type="search"
          value={controls.searchQuery}
        />
        {hasQuery && (
          <button
            aria-label="Clear Search"
            className={styles.inventorySearchClear}
            data-inventory-search-clear="true"
            onClick={handleClearSearchClick}
            onMouseDown={handleClearSearchPressStart}
            onPointerDown={handleClearSearchPressStart}
            onTouchStart={handleClearSearchPressStart}
            title="Clear Search"
            type="button"
          >
            <MaterialIcon name="mdi:close" size={20} />
          </button>
        )}
      </label>
    </div>
  )
}

export function EverShelfInventoryFloatingActions({ controls }: { controls: EverShelfInventoryControls }) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  if (controls.inventoryLoadPhase !== 'content' || controls.inventoryItemCount === 0) return null

  const actionsCollapsed = searchExpanded

  return (
    <>
      <InventorySearchAction controls={controls} onExpandedChange={setSearchExpanded} />
      <span className={styles.inventoryActionSlot} data-collapsed={actionsCollapsed ? 'true' : undefined}>
        <FloatingActionButton ariaLabel="Sort" color={controls.sortActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:swap-vertical" onClick={controls.openSortSheet} />
      </span>
      <span className={styles.inventoryActionSlot} data-collapsed={actionsCollapsed ? 'true' : undefined}>
        <FloatingActionButton ariaLabel="Filter" color={controls.filterActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:tune-vertical" onClick={controls.openFilterSheet} />
      </span>
      <InventorySortSheet
        draftDirection={controls.sortDraftDirection}
        draftMode={controls.sortDraftMode}
        onApply={controls.applySort}
        onClose={controls.closeSortSheet}
        onDraftDirectionChange={controls.setSortDraftDirection}
        onDraftModeChange={controls.setSortDraftMode}
        onReset={controls.resetSortDraft}
        open={controls.sortOpen}
      />
      <InventoryFilterSheet
        draftMode={controls.filterDraftMode}
        onApply={controls.applyFilter}
        onClose={controls.closeFilterSheet}
        onDraftModeChange={controls.setFilterDraftMode}
        onReset={controls.resetFilterDraft}
        open={controls.filterOpen}
      />
    </>
  )
}

export function EverShelfInventoryPanel({ controls, location, title }: EverShelfInventoryPanelProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const { inventoryLoadPhase, setInventoryItemCount, setInventoryLoadPhase } = controls
  const [items, setItems] = useState<EverShelfInventoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let finishTimer: number | null = null

    queueMicrotask(() => {
      if (cancelled) return
      setInventoryItemCount(null)
      setInventoryLoadPhase('loading')
    })

    const finishLoading = (nextItems: EverShelfInventoryItem[], nextError: string | null = null) => {
      setInventoryLoadPhase('exiting')
      finishTimer = window.setTimeout(() => {
        if (cancelled) return
        setError(nextError)
        setItems(nextItems)
        setInventoryItemCount(nextError ? 0 : nextItems.length)
        setInventoryLoadPhase('content')
      }, INVENTORY_LOADING_EXIT_MS)
    }

    void Promise.resolve(
      callService({
        domain: 'evershelf',
        service: 'list_inventory',
        serviceData: { location },
        returnResponse: true,
      }),
    )
      .then((result) => {
        if (cancelled) return
        const nextItems = inventoryFromResponse(result)
        finishLoading(nextItems)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          finishLoading([], caughtError instanceof Error ? caughtError.message : 'Unable to load inventory')
        }
      })

    return () => {
      cancelled = true
      if (finishTimer !== null) window.clearTimeout(finishTimer)
    }
  }, [callService, location, setInventoryItemCount, setInventoryLoadPhase])

  const loadedItems = useMemo(() => items ?? [], [items])
  const effectiveSearchQuery = controls.debouncedSearchQuery.trim()
  const visibleItems = useMemo(() => visibleInventoryItems(loadedItems, controls.sortMode, controls.sortDirection, controls.filterMode, controls.debouncedSearchQuery), [controls.debouncedSearchQuery, controls.filterMode, controls.sortDirection, controls.sortMode, loadedItems])

  return (
    <>
      <article aria-label={`${title} inventory list`} className={styles.panel}>
        {inventoryLoadPhase !== 'content' ? (
          <DashboardPageLoading className={styles.inventoryLoading} label={`Loading ${title} inventory`} phase={inventoryLoadPhase === 'exiting' ? 'exiting' : 'loading'} />
        ) : (
          <div className={styles.inventoryContent}>
            {error ? (
              <EmptyState className={styles.inventoryEmpty} description={inventoryErrorDescription(error)} title="Unable to load inventory" />
            ) : items !== null && loadedItems.length === 0 ? (
              <EmptyState className={styles.inventoryEmpty} description={`Scan an item to add it to your ${title.toLowerCase()}.`} title="No items found" />
            ) : items !== null && loadedItems.length > 0 && visibleItems.length === 0 && (effectiveSearchQuery
              ? <EmptyState className={styles.inventoryEmpty} description={emptySearchDescription(controls.filterActive)} title="No matching items" />
              : <Description>{emptyMatchMessage(false, controls.filterActive)}</Description>)}
            {visibleItems.length > 0 && (
              <ul className={styles.items}>
                {visibleItems.map((item, index) => {
                  const name = itemName(item)
                  const expiry = expiryInfo(itemExpiryDate(item))
                  const quantity = itemQuantity(item)
                  return (
                    <li className={styles.item} key={item.inventory_id ?? item.id ?? `${location}-${name}-${index}`}>
                      <PantryRow expiry={expiry} quantity={quantity} title={name} />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </article>
    </>
  )
}
