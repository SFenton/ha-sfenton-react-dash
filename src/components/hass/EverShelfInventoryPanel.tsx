import { useEffect, useMemo, useState } from 'react'
import { useHass } from '@hakit/core'
import { CheckboxRow } from '../core/CheckboxRow'
import { Description } from '../core/Description'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { RadioRow } from '../core/RadioRow'
import type { EverShelfInventoryControls, InventoryFilterMode, InventorySortDirection, InventorySortMode } from './EverShelfInventoryControls'
import styles from './EverShelfInventoryPanel.module.css'

export type EverShelfInventoryLocation = 'dispensa' | 'frigo' | 'freezer'

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
}

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface ExpiryInfo {
  label: string
  tone?: 'expired' | 'soon'
}

const DAY_MS = 24 * 60 * 60 * 1000
const SORT_FILTER_COLOR = { r: 42, g: 126, b: 180 }
const SORT_FILTER_ACTIVE_COLOR = { r: 155, g: 110, b: 64 }

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

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function plural(amount: number, unit: 'day' | 'week' | 'month' | 'year') {
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`
}

function roundedDuration(absDays: number) {
  if (absDays < 7) return plural(absDays, 'day')
  if (absDays < 30) return plural(Math.max(1, Math.round(absDays / 7)), 'week')
  if (absDays < 365) return plural(Math.max(1, Math.round(absDays / 30)), 'month')
  return plural(Math.max(1, Math.round(absDays / 365)), 'year')
}

function expiryInfo(value: string | undefined): ExpiryInfo {
  if (!value) return { label: 'No expiration date' }

  const expiryDate = parseIsoDateOnly(value)
  if (!expiryDate) return { label: 'No expiration date' }

  const daysUntilExpiry = daysUntilDate(expiryDate)
  if (daysUntilExpiry < 0) {
    return { label: `Expired for ${roundedDuration(Math.abs(daysUntilExpiry))}`, tone: 'expired' }
  }

  const label = `Expires in ${roundedDuration(daysUntilExpiry)}`
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

function filterInventoryItems(items: EverShelfInventoryItem[], filterMode: InventoryFilterMode) {
  if (filterMode === 'all') return items
  return items.filter((item) => {
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

function visibleInventoryItems(items: EverShelfInventoryItem[], sortMode: InventorySortMode, sortDirection: InventorySortDirection, filterMode: InventoryFilterMode) {
  return sortInventoryItems(filterInventoryItems(items, filterMode), sortMode, sortDirection)
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

export function EverShelfInventoryFloatingActions({ controls }: { controls: EverShelfInventoryControls }) {
  return (
    <>
      <FloatingActionButton color={controls.sortActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:swap-vertical" label="Sort" onClick={controls.openSortSheet} />
      <FloatingActionButton color={controls.filterActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:tune-vertical" label="Filter" onClick={controls.openFilterSheet} />
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
  const [items, setItems] = useState<EverShelfInventoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

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
        setError(null)
        setItems(inventoryFromResponse(result))
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : 'Unable to load inventory')
      })

    return () => {
      cancelled = true
    }
  }, [callService, location])

  const loadedItems = useMemo(() => items ?? [], [items])
  const visibleItems = useMemo(() => visibleInventoryItems(loadedItems, controls.sortMode, controls.sortDirection, controls.filterMode), [controls.filterMode, controls.sortDirection, controls.sortMode, loadedItems])

  return (
    <>
      <article aria-label={`${title} inventory list`} className={styles.panel}>
        {items === null && !error && <span className={styles.status}>Loading inventory...</span>}
        {error && <span className={styles.error}>{error}</span>}
        {items !== null && loadedItems.length === 0 && <Description>No items found.</Description>}
        {items !== null && loadedItems.length > 0 && visibleItems.length === 0 && <Description>No items match the selected filter.</Description>}
        {visibleItems.length > 0 && (
          <ul className={styles.items}>
            {visibleItems.map((item, index) => {
              const name = itemName(item)
              const expiry = expiryInfo(itemExpiryDate(item))
              return (
                <li className={styles.item} key={item.inventory_id ?? item.id ?? `${location}-${name}-${index}`}>
                  <CheckboxRow
                    active={false}
                    aria-label={`${name} ${expiry.label}`}
                    className={styles.itemButton}
                    data-expiry-tone={expiry.tone}
                    disabled
                    subtitle={expiry.label}
                    title={name}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </article>
    </>
  )
}
