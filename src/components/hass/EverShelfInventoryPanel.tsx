import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useHass } from '@hakit/core'
import { EmptyState, type EmptyStateLayout } from '../core/EmptyState'
import { CheckboxRow } from '../core/CheckboxRow'
import { Description } from '../core/Description'
import { ExpandingSearchAction } from '../core/ExpandingSearchAction'
import { FilterSheetFooter } from '../core/FilterSheetFooter'
import { FloatingActionSlot } from '../core/FloatingActionSlot'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import { NativePickerField } from '../core/NativePickerField'
import { NumberStepper } from '../core/Stepper'
import { RadioRow } from '../core/RadioRow'
import { SurfaceAccessory } from '../core/SurfaceAccessory'
import { DashboardPageLoading } from '../shell/DashboardPageLoading'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import type { EverShelfInventoryControls, InventoryFilterMode, InventorySortDirection, InventorySortMode } from './EverShelfInventoryControls'
import { daysUntilDate, parseIsoDateOnly } from './expiryDate'
import { copy, PAGE_FOOD_COPY_KEYS, PAGE_FOOD_COPY_NAMESPACE } from '../../i18n'
import {
  recordGroceryDeletePromptParsing,
  runGroceryDeleteConfirm,
  runGroceryDeletePrompt,
} from './EverShelfInventoryPanelDiagnostics'
import styles from './EverShelfInventoryPanel.module.css'

export type EverShelfInventoryLocation = 'all' | 'dispensa' | 'frigo' | 'freezer' | 'spice_rack' | 'cabinet'

interface EverShelfInventoryPanelProps {
  controls: EverShelfInventoryControls
  emptyState?: {
    description: string
    layout?: EmptyStateLayout
    title: string
  }
  layout?: 'list' | 'responsive-grid'
  location: EverShelfInventoryLocation
  onOpenDetails?: (target: EverShelfInventoryDetailsTarget) => void
  rowVariant?: 'summary'
  title: string
}

export interface EverShelfInventoryItem {
  expiration_date?: string | null
  expiry_date?: string | null
  expires_at?: string | null
  id?: number | string
  inventory_id?: number | string
  inventory_ids?: (number | string)[] | null
  location?: string | null
  name?: string | null
  prepared_food?: boolean | number | string | null
  product_id?: number | string | null
  quantity?: number | string | null
  unit?: string | null
  vacuum_sealed?: boolean | number | string | null
}

interface EverShelfInventoryResponse {
  inventory: EverShelfInventoryItem[]
  search?: string
  source?: string
}

export type EverShelfInventoryDisplayItem = EverShelfInventoryItem & {
  groupedItems?: EverShelfInventoryItem[]
}

export interface EverShelfInventoryDetailsTarget {
  item: EverShelfInventoryDisplayItem
  location: EverShelfInventoryLocation
  locationLabel: string
  onInventoryChanged?: InventoryRefresh
}

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown
export type InventoryRefresh = () => Promise<EverShelfInventoryItem[]>

interface ExpiryInfo {
  label: string
  tone?: 'expired' | 'soon'
}

type PantryRowShoppingState = 'added' | 'adding' | 'idle'
type PantryRowDeleteState = 'deleting' | 'idle'
type DeleteQuantityPromptResult = { status: 'cancelled' } | { status: 'invalid' } | { quantity: number; status: 'valid' }
type InventorySearchLoadPhase = 'exiting' | 'loading' | 'idle'

const SORT_FILTER_COLOR = { r: 42, g: 126, b: 180 }
const SORT_FILTER_ACTIVE_COLOR = { r: 155, g: 110, b: 64 }
const INVENTORY_LOADING_EXIT_MS = 500
const PREPARED_OPTIMISTIC_REVERT_MS = 10_000
const PREPARED_REFRESH_RETRY_MS = 1_000
const INVENTORY_SEARCH_LOG_PREFIX = '[EverShelfInventorySearch]'
const HASS_GROCERY_LIST_ENTITY_ID = 'todo.shopping_list'
const INVENTORY_QUANTITY_MAX = 999
const MULTIPLE_EXPIRATION_DATES_LABEL = 'Multiple Expiration Dates'
const SHOPPING_ADDED_VISIBLE_MS = 3000
const INVENTORY_DETAILS_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'inventory-details',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry
const INVENTORY_SORT_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '560px',
  id: 'inventory-sort',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry
const INVENTORY_FILTER_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'inventory-filter',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

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

function logInventorySearch(event: string, details: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug(INVENTORY_SEARCH_LOG_PREFIX, event, details)
}

const EVERSHELF_ADD_LOCATIONS: Exclude<EverShelfInventoryLocation, 'all'>[] = ['dispensa', 'frigo', 'freezer', 'spice_rack', 'cabinet']

const LOCATION_DELETE_LABELS: Record<EverShelfInventoryLocation, string> = {
  all: 'library',
  cabinet: 'cabinet',
  dispensa: 'pantry',
  freezer: 'freezer',
  frigo: 'fridge',
  spice_rack: 'spice rack',
}

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function itemName(item: EverShelfInventoryItem) {
  return compactText(item.name) ?? 'Untitled item'
}

function itemInventoryId(item: EverShelfInventoryItem) {
  const id = Number(item.inventory_id ?? item.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

function itemInventoryIds(item: EverShelfInventoryItem) {
  if (!Array.isArray(item.inventory_ids)) return []
  return item.inventory_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
}

function itemRawQuantity(item: EverShelfInventoryItem) {
  const quantity = Number(item.quantity)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function itemProductId(item: EverShelfInventoryItem) {
  const productId = Number(item.product_id)
  return Number.isFinite(productId) && productId > 0 ? productId : null
}

function itemLocation(item: EverShelfInventoryItem) {
  const location = compactText(item.location)
  return EVERSHELF_ADD_LOCATIONS.find((candidate) => candidate === location) ?? null
}

function itemVacuumSealed(item: EverShelfInventoryItem) {
  const value = item.vacuum_sealed
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '0' && value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}

// EverShelf merges added stock into an existing batch only when product, location, expiry date,
// and sealed state all match, so quantity increases have to repeat the batch identity.
function inventoryAddServiceData(item: EverShelfInventoryItem, quantity: number, expiryDate: string) {
  const productId = itemProductId(item)
  const location = itemLocation(item)
  const unit = compactText(item.unit)
  const serviceData: Record<string, unknown> = {
    inventory_prepared_food: itemPreparedFood(item),
    name: itemName(item),
    quantity,
    vacuum_sealed: itemVacuumSealed(item),
  }
  if (productId !== null) serviceData.product_id = productId
  if (location) serviceData.location = location
  if (expiryDate) serviceData.expiry_date = expiryDate
  if (unit) serviceData.unit = unit
  return serviceData
}

function itemExpiryDate(item: EverShelfInventoryItem) {
  return compactText(item.expiry_date ?? item.expiration_date ?? item.expires_at ?? undefined)
}

function itemExpiryTime(item: EverShelfInventoryItem) {
  const value = itemExpiryDate(item)
  if (!value) return null
  return parseIsoDateOnly(value)?.getTime() ?? null
}

function itemGroupingKey(item: EverShelfInventoryItem) {
  return itemName(item).toLocaleLowerCase()
}

// Prepared units are stored as their own inventory rows, so they form their own batch rather
// than merging with unprepared stock that happens to share an expiration date.
function itemPreparedFood(item: EverShelfInventoryItem) {
  const value = item.prepared_food
  return value === true || value === 1 || value === '1'
}

function itemBatchKey(item: EverShelfInventoryItem) {
  return [itemLocation(item) ?? '', itemExpiryDate(item) ?? '', itemPreparedFood(item) ? '1' : '0'].join('\u0000')
}

// A food item is shown once per page even when EverShelf stores it as several rows with different
// expiration dates, so the card carries the total stock and the soonest date of its batches.
function soonestExpiryDate(items: EverShelfInventoryItem[]) {
  let soonest: { date: string; time: number } | null = null
  for (const item of items) {
    const date = itemExpiryDate(item)
    const time = itemExpiryTime(item)
    if (!date || time === null) continue
    if (!soonest || time < soonest.time) soonest = { date, time }
  }
  return soonest?.date
}

function groupedInventoryItems(items: EverShelfInventoryItem[]): EverShelfInventoryDisplayItem[] {
  const grouped = new Map<string, EverShelfInventoryDisplayItem>()
  const order: string[] = []
  for (const item of items) {
    const key = itemGroupingKey(item)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        ...item,
        groupedItems: [item],
        quantity: itemRawQuantity(item),
      })
      order.push(key)
      continue
    }
    existing.groupedItems = [...(existing.groupedItems ?? []), item]
    existing.quantity = itemRawQuantity(existing) + itemRawQuantity(item)
  }
  return order.flatMap((key) => {
    const item = grouped.get(key)
    if (!item) return []
    const rows = item.groupedItems ?? [item]
    const expiryDate = soonestExpiryDate(rows)
    return [{ ...item, expiration_date: null, expires_at: null, expiry_date: expiryDate ?? null }]
  })
}

function inventoryDisplayItemForGroup(items: EverShelfInventoryItem[], groupKey: string) {
  return groupedInventoryItems(items.filter((item) => itemGroupingKey(item) === groupKey))
    .find((item) => itemGroupingKey(item) === groupKey) ?? null
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

function daysUntilExpiry(item: EverShelfInventoryItem) {
  const value = itemExpiryDate(item)
  if (!value) return null
  const expiryDate = parseIsoDateOnly(value)
  return expiryDate ? daysUntilDate(expiryDate) : null
}

function inventoryResponseFromResult(result: unknown): EverShelfInventoryResponse {
  const response = result && typeof result === 'object'
    ? (result as { response?: unknown; service_response?: unknown }).response ?? (result as { service_response?: unknown }).service_response ?? result
    : result
  if (!response || typeof response !== 'object') return { inventory: [] }
  const inventory = (response as { inventory?: unknown }).inventory
  return {
    inventory: Array.isArray(inventory) ? inventory.filter((item): item is EverShelfInventoryItem => Boolean(item && typeof item === 'object')) : [],
    search: typeof (response as { search?: unknown }).search === 'string' ? (response as { search: string }).search : undefined,
    source: typeof (response as { source?: unknown }).source === 'string' ? (response as { source: string }).source : undefined,
  }
}

function fallbackSearchText(item: EverShelfInventoryItem) {
  const canonicalTerms = Array.isArray((item as { canonical_ingredients?: unknown }).canonical_ingredients)
    ? ((item as { canonical_ingredients: Array<Record<string, unknown>> }).canonical_ingredients)
      .flatMap((term) => [term.name, term.slug, term.role])
      .filter((value): value is string => typeof value === 'string')
    : []
  return [
    itemName(item),
    (item as { brand?: string | null }).brand,
    (item as { category?: string | null }).category,
    (item as { shopping_name?: string | null }).shopping_name,
    ...canonicalTerms,
  ].filter((value): value is string => typeof value === 'string' && value.trim() !== '').join(' ').toLocaleLowerCase()
}

function fallbackSearchTokens(query: string) {
  return query.toLocaleLowerCase().trim().split(/\s+/).filter((token) => token.length >= 2)
}

function fallbackFilterSearchResults(items: EverShelfInventoryItem[], query: string) {
  const tokens = fallbackSearchTokens(query)
  if (tokens.length === 0) return items
  return items.filter((item) => {
    const haystack = fallbackSearchText(item)
    return tokens.every((token) => haystack.includes(token))
  })
}

function inventorySearchResponseConfirmed(response: EverShelfInventoryResponse, query: string) {
  if (!query) return true
  return response.source === 'ha_sensor_product_search' && response.search?.trim() === query
}

function inventoryItemsFromSearchResponse(response: EverShelfInventoryResponse, query: string) {
  if (inventorySearchResponseConfirmed(response, query)) {
    return response.inventory
  }
  if (!query) {
    return response.inventory
  }
  logInventorySearch('response-search-unconfirmed-fallback', {
    itemCount: response.inventory.length,
    responseSearch: response.search,
    responseSource: response.source,
    query,
  })
  return fallbackFilterSearchResults(response.inventory, query)
}

// EverShelf's taxonomy search collapses every inventory row of a product into one response entry
// without per-row detail, so those entries are expanded back into the real rows the row actions and
// the edit modal need. Without this, searched items render with inert controls.
async function resolvedInventoryItems(items: EverShelfInventoryItem[], callService: CallService, location: EverShelfInventoryLocation) {
  const aggregated = items.filter((item) => itemInventoryId(item) === null && itemInventoryIds(item).length > 0)
  if (aggregated.length === 0) return items

  try {
    const result = await Promise.resolve(callService({
      domain: 'evershelf',
      service: 'list_inventory',
      serviceData: location === 'all' ? {} : { location },
      returnResponse: true,
    }))
    const rowsById = new Map(inventoryResponseFromResult(result).inventory.flatMap((row) => {
      const inventoryId = itemInventoryId(row)
      return inventoryId === null ? [] : [[inventoryId, row] as const]
    }))
    return items.flatMap((item) => {
      if (itemInventoryId(item) !== null) return [item]
      const rows = itemInventoryIds(item).flatMap((inventoryId) => {
        const row = rowsById.get(inventoryId)
        return row ? [row] : []
      })
      return rows.length > 0 ? rows : [item]
    })
  } catch (caughtError: unknown) {
    logInventorySearch('aggregated-rows-unresolved', {
      itemCount: aggregated.length,
      message: caughtError instanceof Error ? caughtError.message : 'Unable to load inventory rows',
    })
    return items
  }
}

function filterInventoryItems(items: EverShelfInventoryItem[], filterMode: InventoryFilterMode) {
  return filterMode === 'all' ? items : items.filter((item) => {
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

function emptySearchDescription(filterActive: boolean) {
  return filterActive
    ? 'Try a different search, clear the selected filter, or clear the search to show all items.'
    : 'Try a different search or clear the search to show all items.'
}

function inventoryErrorDescription(error: string, spaceName: string) {
  if (error === 'Unable to load inventory') return `Try again in a moment, or scan an item while ${spaceName.toLowerCase()} is unavailable.`
  return error.replace(/EverShelf is unavailable/g, `${spaceName} is unavailable`)
}

function itemQuantity(item: EverShelfInventoryItem) {
  const quantity = itemRawQuantity(item)
  return Number.isFinite(quantity) && quantity > 1 ? quantity : null
}

function itemInstances(item: EverShelfInventoryDisplayItem): EverShelfInventoryItem[] {
  if (item.groupedItems?.length) return item.groupedItems
  return [item]
}

function itemInstancesKey(item: EverShelfInventoryDisplayItem | null) {
  if (!item) return 'closed'
  return itemInstances(item).map((instance) => itemInventoryId(instance) ?? itemGroupingKey(instance)).join('|')
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function rowSubtitle(expiry: ExpiryInfo, quantity: number | null, extraBatchCount = 0) {
  const stock = quantity === null ? null : `Quantity ${formatQuantity(quantity)}`
  // Several expiration batches have no single date to show, so the card summarises the stock and
  // leaves the per-date detail to the modal.
  const expiryLabel = extraBatchCount > 0 ? MULTIPLE_EXPIRATION_DATES_LABEL : expiry.label
  return [stock, expiryLabel].filter(Boolean).join(' · ')
}

function batchExpiryLabel(expiryDate: string) {
  const parsed = expiryDate ? parseIsoDateOnly(expiryDate) : null
  return parsed ? formatDisplayDate(parsed) : null
}

// Batches with more than one item read better when the action copy says which date it applies to,
// but a single-batch item does not need the qualifier.
// Prepared units split into their own batch that can share an expiration date with the rest of
// the stock, so the prepared state is part of what makes a batch label unique.
function batchQualifier(expiryDate: string, multipleBatches: boolean, preparedFood = false) {
  if (!multipleBatches) return preparedFood ? ' prepared' : ''
  const label = batchExpiryLabel(expiryDate)
  const expiry = label ? ` expiring ${label}` : ' without an expiration date'
  return preparedFood ? `${expiry} prepared` : expiry
}

function quantityChangeHint(quantityDelta: number, locationLabel: string) {
  const amount = formatQuantity(Math.abs(quantityDelta))
  const itemLabel = Math.abs(quantityDelta) === 1 ? 'item' : 'items'
  return quantityDelta > 0
    ? `Saving adds ${amount} ${itemLabel} to the ${locationLabel}.`
    : `Saving removes ${amount} ${itemLabel} from the ${locationLabel}.`
}

function instanceLocationLabel(item: EverShelfInventoryItem, fallbackLabel: string) {
  const location = itemLocation(item)
  return location ? LOCATION_DELETE_LABELS[location] : fallbackLabel
}

function promptShoppingQuantity(title: string) {
  const value = window.prompt(`Quantity of ${title} to add to the grocery cart.`, '1')
  if (value === null) return null
  const parsedValue = Number(value.trim())
  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : null
}

function deleteDisplayTitle(title: string, qualifier?: string) {
  return qualifier
    ? copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.itemWithQualifier, { qualifier, title })
    : title
}

function promptDeleteQuantity(title: string, locationLabel: string, quantity: number) {
  const message = [
    copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.multipleDescription, { location: locationLabel, title }),
    copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.quantityError, { quantity: formatQuantity(quantity) }),
  ].join(' ')
  const value = runGroceryDeletePrompt(quantity, () => window.prompt(message, '1'))
  if (value === null) return { status: 'cancelled' } satisfies DeleteQuantityPromptResult
  const normalizedValue = value.trim().replace(',', '.')
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalizedValue)) {
    recordGroceryDeletePromptParsing(quantity, false)
    return { status: 'invalid' } satisfies DeleteQuantityPromptResult
  }
  const parsedValue = Number(normalizedValue)
  const valid = Number.isFinite(parsedValue) && parsedValue >= 1 && parsedValue <= quantity
  recordGroceryDeletePromptParsing(quantity, valid)
  return valid
    ? { quantity: parsedValue, status: 'valid' } satisfies DeleteQuantityPromptResult
    : { status: 'invalid' } satisfies DeleteQuantityPromptResult
}

function confirmInventoryDelete(title: string, locationLabel: string) {
  return runGroceryDeleteConfirm(() => window.confirm(
    copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.description, {
      location: locationLabel,
      title,
    }),
  ))
}

function promptPreparedQuantity(title: string, quantity: number, enabling: boolean) {
  const verb = enabling ? 'mark as prepared' : 'unmark as prepared'
  const value = window.prompt(`How many of ${title} to ${verb}? (available: ${formatQuantity(quantity)})`, formatQuantity(quantity))
  if (value === null) return { status: 'cancelled' } satisfies DeleteQuantityPromptResult
  const normalizedValue = value.trim().replace(',', '.')
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalizedValue)) return { status: 'invalid' } satisfies DeleteQuantityPromptResult
  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) && parsedValue >= 1 && parsedValue <= quantity
    ? { quantity: parsedValue, status: 'valid' } satisfies DeleteQuantityPromptResult
    : { status: 'invalid' } satisfies DeleteQuantityPromptResult
}

// Spreads the requested unit count across the rows backing a batch, smallest row first so whole
// rows are consumed before one gets split.
function inventoryPreparedSteps(rows: InventoryBatchRow[], amount: number) {
  const steps: { inventoryId: number; quantity: number }[] = []
  let remaining = amount
  for (const row of [...rows].sort((left, right) => left.quantity - right.quantity)) {
    if (remaining <= 0) break
    const take = Math.min(row.quantity, remaining)
    steps.push({ inventoryId: row.inventoryId, quantity: take })
    remaining -= take
  }
  return steps
}

function validExpiryInput(value: string) {
  return value.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function PantryRow({ expiry, extraBatchCount, locationLabel, multiItem, onDeleted, onOpenDetails, quantity, rows, title }: { expiry: ExpiryInfo; extraBatchCount: number; locationLabel: string; multiItem: boolean; onDeleted: (steps: InventoryDeleteStep[]) => void; onOpenDetails: () => void; quantity: number | null; rows: (InventoryBatchRow | null)[]; title: string }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [deleteState, setDeleteState] = useState<PantryRowDeleteState>('idle')
  const [shoppingState, setShoppingState] = useState<PantryRowShoppingState>('idle')
  const [rowError, setRowError] = useState<string | null>(null)
  const resetShoppingTimerRef = useRef<number | null>(null)
  const subtitle = rowSubtitle(expiry, quantity, extraBatchCount)
  const deletableRows = rows.filter((row): row is InventoryBatchRow => row !== null)
  const deletable = rows.length > 0 && deletableRows.length === rows.length
  const stockedQuantity = deletableRows.reduce((total, row) => total + row.quantity, 0)
  const deleteButtonDisabled = deleteState === 'deleting' || !deletable
  const deleteButtonLabel = deleteState === 'deleting' ? `Deleting ${title}` : `Delete ${title}`
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

  const addToShoppingList = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (shoppingButtonDisabled) return

    const shoppingQuantity = promptShoppingQuantity(title)
    if (shoppingQuantity === null) return

    clearResetShoppingTimer()
    setShoppingState('adding')
    setRowError(null)
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
        setRowError(caughtError instanceof Error ? caughtError.message : 'Unable to add to shopping list')
      })
  }

  const deleteFromEverShelf = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (deleteButtonDisabled || !deletable) return
    let deleteSteps: InventoryDeleteStep[] = deletableRows.map((row) => ({ inventoryId: row.inventoryId }))
    if (stockedQuantity > 1) {
      const promptResult = promptDeleteQuantity(title, locationLabel, stockedQuantity)
      if (promptResult.status === 'cancelled') return
      if (promptResult.status === 'invalid') {
        setRowError(copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.quantityError, { quantity: formatQuantity(stockedQuantity) }))
        return
      }
      if (promptResult.quantity < stockedQuantity) deleteSteps = inventoryDecreaseSteps(deletableRows, promptResult.quantity).steps
    } else if (!confirmInventoryDelete(title, locationLabel)) return

    setDeleteState('deleting')
    setRowError(null)
    void deleteSteps
      .reduce(
        (chain, step) => chain.then(() => Promise.resolve(callService({
          domain: 'evershelf',
          service: 'delete_inventory',
          serviceData: step.quantity === undefined
            ? { inventory_id: step.inventoryId }
            : { inventory_id: step.inventoryId, quantity: step.quantity },
        }))).then(() => undefined),
        Promise.resolve(),
      )
      .then(() => {
        onDeleted(deleteSteps)
      })
      .catch((caughtError: unknown) => {
        setDeleteState('idle')
        setRowError(caughtError instanceof Error ? caughtError.message : 'Unable to delete item')
      })
  }

  const openDetails = () => {
    if (multiItem) onOpenDetails()
  }

  return (
    <>
      <div aria-label={`${title} ${subtitle}`} className={styles.pantryRow} data-clickable={multiItem ? 'true' : undefined} data-expiry-tone={expiry.tone} onClick={openDetails} role="group">
        <span className={styles.pantryRowCopy}>
          <strong>{title}</strong>
          <small>{subtitle}</small>
          {rowError && <small className={styles.error} role="alert">{rowError}</small>}
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
          {multiItem ? (
            <button aria-label={`Edit ${title}`} className={styles.rowAction} data-modal-disclosure-button="true" onClick={(event) => {
              event.stopPropagation()
              onOpenDetails()
            }} type="button">
              <SurfaceAccessory semantics={{ kind: 'modal' }} />
            </button>
          ) : (
            <>
              <button aria-label={`Edit ${title}`} className={styles.rowAction} disabled={!deletable} onClick={(event) => {
                event.stopPropagation()
                onOpenDetails()
              }} type="button">
                <MaterialIcon name="mdi:pencil" size={22} />
              </button>
              <button aria-busy={deleteState === 'deleting' ? 'true' : undefined} aria-label={deleteButtonLabel} className={`${styles.rowAction} ${styles.deleteAction}`} data-delete-state={deleteState} disabled={deleteButtonDisabled} onClick={deleteFromEverShelf} type="button">
                <MaterialIcon name="mdi:delete" size={22} />
              </button>
            </>
          )}
        </span>
      </div>
    </>
  )
}

type InventoryBatchRow = { inventoryId: number; quantity: number }
type InventoryDeleteStep = { inventoryId: number; quantity?: number }

export type InventoryBatch = {
  addressable: boolean
  expiryDate: string
  key: string
  locationLabel: string
  preparedFood: boolean
  quantity: number
  rows: InventoryBatchRow[]
  sample: EverShelfInventoryItem
}

export interface EverShelfInventoryDetailsController {
  batches: InventoryBatch[]
  busy: boolean
  busyAction: string | null
  deleteBatch: (batch: InventoryBatch) => void
  dismissalBlocked: boolean
  error: string | null
  expiryDrafts: Record<string, string>
  multipleBatches: boolean
  quantityDrafts: Record<string, number>
  retainsDismissedView: boolean
  resetDraft: (batch: InventoryBatch) => void
  saveBatch: (batch: InventoryBatch) => void
  setExpiryDraft: (batchKey: string, value: string) => void
  setQuantityDraft: (batchKey: string, value: number) => void
  title: string
  togglePreparedFood: (batch: InventoryBatch) => void
}

function inventoryBatchRows(item: EverShelfInventoryDisplayItem | null) {
  if (!item) return []
  return itemInstances(item).map((instance) => {
    const inventoryId = itemInventoryId(instance)
    return inventoryId === null ? null : { inventoryId, quantity: itemRawQuantity(instance) }
  })
}

// EverShelf keeps a separate row per expiration batch (and creates extra rows for repeat adds), so
// the modal works in batches: rows that share a location and expiry date are one editable batch.
function inventoryBatches(item: EverShelfInventoryDisplayItem | null, fallbackLocationLabel: string): InventoryBatch[] {
  if (!item) return []
  const batches = new Map<string, InventoryBatch>()
  const order: string[] = []
  for (const row of itemInstances(item)) {
    const key = itemBatchKey(row)
    const inventoryId = itemInventoryId(row)
    const quantity = itemRawQuantity(row)
    const existing = batches.get(key)
    if (!existing) {
      batches.set(key, {
        addressable: inventoryId !== null,
        expiryDate: itemExpiryDate(row) ?? '',
        key,
        locationLabel: instanceLocationLabel(row, fallbackLocationLabel),
        preparedFood: itemPreparedFood(row),
        quantity,
        rows: inventoryId === null ? [] : [{ inventoryId, quantity }],
        sample: row,
      })
      order.push(key)
      continue
    }
    existing.addressable = existing.addressable && inventoryId !== null
    existing.quantity += quantity
    if (inventoryId !== null) existing.rows = [...existing.rows, { inventoryId, quantity }]
  }
  return order
    .flatMap((key) => {
      const batch = batches.get(key)
      return batch ? [batch] : []
    })
    .sort((left, right) => {
      const leftTime = left.expiryDate ? parseIsoDateOnly(left.expiryDate)?.getTime() ?? null : null
      const rightTime = right.expiryDate ? parseIsoDateOnly(right.expiryDate)?.getTime() ?? null : null
      if (leftTime === rightTime) return left.locationLabel.localeCompare(right.locationLabel)
      if (leftTime === null) return 1
      if (rightTime === null) return -1
      return leftTime - rightTime
    })
}

// EverShelf stores a food item as one or more inventory rows, so removing stock is spread across
// them: whole rows go first so repeat scans of the same batch get consolidated.
function inventoryDecreaseSteps(rows: InventoryBatchRow[], amount: number) {
  const steps: InventoryDeleteStep[] = []
  const remainingRows: InventoryBatchRow[] = []
  let remaining = amount
  for (const row of [...rows].sort((left, right) => left.quantity - right.quantity)) {
    if (remaining <= 0) {
      remainingRows.push(row)
      continue
    }
    if (row.quantity <= remaining) {
      steps.push({ inventoryId: row.inventoryId })
      remaining -= row.quantity
      continue
    }
    steps.push({ inventoryId: row.inventoryId, quantity: remaining })
    remainingRows.push({ inventoryId: row.inventoryId, quantity: row.quantity - remaining })
    remaining = 0
  }
  return { remainingRows, steps }
}

function inventoryBatchesAfterDelete(batches: InventoryBatch[], steps: InventoryDeleteStep[]) {
  const stepsById = new Map(steps.map((step) => [step.inventoryId, step]))
  return batches.flatMap((batch) => {
    const rows = batch.rows.flatMap((row) => {
      const step = stepsById.get(row.inventoryId)
      if (!step) return [row]
      if (step.quantity === undefined) return []
      const quantity = row.quantity - step.quantity
      return quantity > 0 ? [{ ...row, quantity }] : []
    })
    if (!rows.length) return []
    return [{ ...batch, quantity: rows.reduce((total, row) => total + row.quantity, 0), rows }]
  })
}

function inventoryBatchToken(batches: InventoryBatch[]) {
  return JSON.stringify(
    batches
      .map((batch) => [batch.key, batch.quantity] as const)
      .sort((left, right) => left[0].localeCompare(right[0]) || left[1] - right[1]),
  )
}

function inventoryBatchesAfterPreparedToggle(batches: InventoryBatch[], sourceBatch: InventoryBatch, steps: { inventoryId: number; quantity: number }[], nextPrepared: boolean) {
  const movedQuantity = steps.reduce((total, step) => total + step.quantity, 0)
  const remainingQuantity = sourceBatch.quantity - movedQuantity
  const destinationSample = { ...sourceBatch.sample, prepared_food: nextPrepared }
  const destinationKey = itemBatchKey(destinationSample)
  const existingDestination = batches.find((batch) => batch.key === destinationKey)
  const destinationQuantity = (existingDestination?.quantity ?? 0) + movedQuantity
  const destinationBatch: InventoryBatch = {
    addressable: false,
    expiryDate: sourceBatch.expiryDate,
    key: destinationKey,
    locationLabel: sourceBatch.locationLabel,
    preparedFood: nextPrepared,
    quantity: destinationQuantity,
    rows: [],
    sample: existingDestination?.sample ?? destinationSample,
  }
  const sourceBatchProjection = remainingQuantity > 0
    ? {
      ...sourceBatch,
      addressable: false,
      quantity: remainingQuantity,
      rows: [],
    }
    : null

  return batches.flatMap((batch) => {
    if (batch.key === sourceBatch.key) {
      const projected = sourceBatchProjection ? [projectedBatch(sourceBatchProjection)] : []
      return existingDestination ? projected : [...projected, destinationBatch]
    }
    if (batch.key === destinationKey) return [destinationBatch]
    return [batch]
  })
}

function projectedBatch(batch: InventoryBatch) {
  return {
    ...batch,
    addressable: false,
    rows: [],
  }
}

type PreparedOperation = {
  epoch: number
  generation: number
  identity: string
  projectedBatches: InventoryBatch[]
  sourceRevision: number
  token: string
}

type DetailErrorSource = 'delete' | 'edit' | 'prepared-mutation' | 'prepared-read' | 'prepared-timeout' | null
type InventoryTargetContext = { epoch: number; identity: string | null }
type InventoryAuthorityContext = { key: string | null; revision: number }
type InventoryDetailsContext = { active: boolean; identity: string | null; revision: number }

function useInventoryItemDetails({ active, item, location, locationLabel, onBusyChange, onComplete, onDismissalBlockedChange, onErrorChange, onInventoryChanged }: { active: boolean; item: EverShelfInventoryDisplayItem | null; location: EverShelfInventoryLocation; locationLabel: string; onBusyChange?: (busy: boolean) => void; onComplete: () => void; onDismissalBlockedChange?: (blocked: boolean) => void; onErrorChange?: (error: string | null) => void; onInventoryChanged?: InventoryRefresh }): EverShelfInventoryDetailsController {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorSource, setErrorSource] = useState<DetailErrorSource>(null)
  const requestedTargetIdentity = item ? `${location}\u0000${itemGroupingKey(item)}` : null
  const [targetContextState, dispatchTargetContext] = useReducer(
    (current: InventoryTargetContext, next: InventoryTargetContext) => current.epoch === next.epoch && current.identity === next.identity ? current : next,
    {
      epoch: requestedTargetIdentity === null ? 0 : 1,
      identity: requestedTargetIdentity,
    },
  )
  const targetContextNeedsCommit = requestedTargetIdentity !== null && requestedTargetIdentity !== targetContextState.identity
  const targetEpoch = targetContextNeedsCommit ? targetContextState.epoch + 1 : targetContextState.epoch
  const targetIdentity = requestedTargetIdentity ?? targetContextState.identity
  const propBatches = useMemo(() => inventoryBatches(item, locationLabel), [item, locationLabel])
  const propAuthorityKey = item
    ? `${requestedTargetIdentity}\u0000${itemInstancesKey(item)}\u0000${inventoryBatchToken(propBatches)}`
    : null
  const [authorityContextState, dispatchAuthorityContext] = useReducer(
    (current: InventoryAuthorityContext, next: InventoryAuthorityContext) => current.revision === next.revision && current.key === next.key ? current : next,
    { key: propAuthorityKey, revision: 0 },
  )
  const authorityContextNeedsCommit = propAuthorityKey !== null && propAuthorityKey !== authorityContextState.key
  const sourceRevision = authorityContextNeedsCommit ? authorityContextState.revision + 1 : authorityContextState.revision

  useEffect(() => {
    if (!targetContextNeedsCommit || requestedTargetIdentity === null) return
    dispatchTargetContext({ epoch: targetEpoch, identity: targetIdentity })
  }, [requestedTargetIdentity, targetContextNeedsCommit, targetEpoch, targetIdentity])

  useEffect(() => {
    if (!authorityContextNeedsCommit || propAuthorityKey === null) return
    dispatchAuthorityContext({ key: propAuthorityKey, revision: sourceRevision })
  }, [authorityContextNeedsCommit, propAuthorityKey, sourceRevision])

  const [reconciledTarget, setReconciledTarget] = useState<{ epoch: number; identity: string; item: EverShelfInventoryDisplayItem; sourceRevision: number } | null>(null)
  const reconciledSelection = Boolean(
    reconciledTarget
    && reconciledTarget.epoch === targetEpoch
    && reconciledTarget.identity === targetIdentity
    && reconciledTarget.sourceRevision === sourceRevision,
  )
  const authorityItem = reconciledSelection ? reconciledTarget?.item ?? item : item
  const sourceBatches = useMemo(() => inventoryBatches(authorityItem, locationLabel), [authorityItem, locationLabel])
  const sourceToken = inventoryBatchToken(sourceBatches)
  const [optimisticToken, commitOptimisticToken, resetOptimisticToken] = useOptimisticState(sourceToken, {
    clearOn: 'confirmation',
    revertMs: PREPARED_OPTIMISTIC_REVERT_MS,
  })
  const [preparedOperation, setPreparedOperation] = useState<PreparedOperation | null>(null)
  const [localBatchOverride, setLocalBatchOverride] = useState<InventoryBatch[] | null>(null)
  const currentPreparedOperation = preparedOperation
    && preparedOperation.epoch === targetEpoch
    && preparedOperation.identity === targetIdentity
    && preparedOperation.sourceRevision === sourceRevision
    && preparedOperation.token === optimisticToken
    ? preparedOperation
    : null
  const batches = currentPreparedOperation?.projectedBatches ?? localBatchOverride ?? sourceBatches
  const multipleBatches = batches.length > 1
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({})
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({})
  const mountedRef = useRef(false)
  const preparedActionGenerationRef = useRef(0)
  const preparedStatusRef = useRef<'pending' | 'completed' | 'timed-out' | null>(null)
  const preparedDeadlineTimerRef = useRef<number | null>(null)
  const readRetryTimerRef = useRef<number | null>(null)
  const readRetryResolverRef = useRef<(() => void) | null>(null)
  const errorSourceRef = useRef<DetailErrorSource>(null)
  const latestContextRef = useRef<InventoryTargetContext & { revision: number } | null>(null)
  const previousContextRef = useRef<InventoryDetailsContext | null>(null)
  const draftSourceKeyRef = useRef<string | null>(null)
  const clearPreparedDeadline = () => {
    if (preparedDeadlineTimerRef.current === null) return
    window.clearTimeout(preparedDeadlineTimerRef.current)
    preparedDeadlineTimerRef.current = null
  }
  const cancelReadRetry = () => {
    if (readRetryTimerRef.current !== null) {
      window.clearTimeout(readRetryTimerRef.current)
      readRetryTimerRef.current = null
    }
    const resolve = readRetryResolverRef.current
    readRetryResolverRef.current = null
    resolve?.()
  }
  const updateError = useCallback((nextError: string | null, source: DetailErrorSource = null) => {
    if (!mountedRef.current) return
    const nextSource = nextError ? source : null
    errorSourceRef.current = nextSource
    setErrorSource(nextSource)
    setError(nextError)
    onErrorChange?.(nextError)
  }, [onErrorChange])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      preparedActionGenerationRef.current += 1
      clearPreparedDeadline()
      cancelReadRetry()
    }
  }, [])

  useEffect(() => {
    latestContextRef.current = { epoch: targetEpoch, identity: targetIdentity, revision: sourceRevision }
  }, [sourceRevision, targetEpoch, targetIdentity])

  useEffect(() => {
    const previous = previousContextRef.current
    const targetChanged = previous !== null && previous.identity !== targetIdentity
    const authorityChanged = previous !== null && previous.revision !== sourceRevision
    const reopened = previous !== null && active && !previous.active
    previousContextRef.current = { active, identity: targetIdentity, revision: sourceRevision }

    if (targetChanged || authorityChanged) {
      preparedActionGenerationRef.current += 1
      clearPreparedDeadline()
      cancelReadRetry()
      preparedStatusRef.current = null
      setPreparedOperation(null)
      setLocalBatchOverride(null)
      setReconciledTarget(null)
      resetOptimisticToken()
      setBusyAction(null)
      onBusyChange?.(false)
      onDismissalBlockedChange?.(false)
      if (targetChanged) updateError(null)
    }

    if (!item || currentPreparedOperation) return
    const draftSourceKey = `${targetIdentity}\u0000${sourceRevision}\u0000${sourceToken}`
    if (draftSourceKeyRef.current === draftSourceKey && !reopened) return
    draftSourceKeyRef.current = draftSourceKey
    setExpiryDrafts(Object.fromEntries(sourceBatches.map((batch) => [batch.key, batch.expiryDate])))
    setQuantityDrafts(Object.fromEntries(sourceBatches.map((batch) => [batch.key, batch.quantity])))
  }, [active, currentPreparedOperation, item, onBusyChange, onDismissalBlockedChange, resetOptimisticToken, sourceBatches, sourceRevision, sourceToken, targetIdentity, updateError])

  const busy = busyAction !== null
  const dismissalBlocked = busyAction?.startsWith('edit-') === true || busyAction?.startsWith('delete-') === true
  const retainsDismissedView = dismissalBlocked || (
    error !== null
    && (errorSource === 'delete' || errorSource === 'edit')
  )
  const title = item ? itemName(item) : authorityItem ? itemName(authorityItem) : 'Inventory Item'

  const reportUpdateError = (caughtError: unknown, source: DetailErrorSource = null) => {
    updateError(caughtError instanceof Error ? caughtError.message : copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.inventory.updateError), source)
  }

  const readAuthoritativeInventory = async () => {
    const result = await Promise.resolve(callService({
      domain: 'evershelf',
      service: 'list_inventory',
      serviceData: location === 'all' ? {} : { location },
      returnResponse: true,
    }))
    const response = inventoryResponseFromResult(result)
    return resolvedInventoryItems(response.inventory, callService, location)
  }

  const refreshVisibleInventory = async () => {
    if (!mountedRef.current || !onInventoryChanged) return
    await onInventoryChanged()
  }

  const notifyInventoryChanged = () => {
    if (!mountedRef.current || !onInventoryChanged) return
    void onInventoryChanged().catch((caughtError: unknown) => reportUpdateError(caughtError))
  }

  const finishAction = () => {
    if (!mountedRef.current) return
    setBusyAction(null)
    onBusyChange?.(false)
    onDismissalBlockedChange?.(false)
    notifyInventoryChanged()
    onComplete()
  }

  const resetDraft = (batch: InventoryBatch) => {
    setExpiryDrafts((current) => ({ ...current, [batch.key]: batch.expiryDate }))
    setQuantityDrafts((current) => ({ ...current, [batch.key]: batch.quantity }))
    updateError(null)
  }

  const deleteInventoryRow = (step: InventoryDeleteStep) => Promise.resolve(callService({
    domain: 'evershelf',
    service: 'delete_inventory',
    serviceData: step.quantity === undefined
      ? { inventory_id: step.inventoryId }
      : { inventory_id: step.inventoryId, quantity: step.quantity },
  }))

  const runDeleteSteps = (steps: InventoryDeleteStep[]) => steps.reduce(
    (chain, step) => chain.then(() => deleteInventoryRow(step)).then(() => undefined),
    Promise.resolve(),
  )

  // Home Assistant owns the stock change: EverShelf adds the extra items to the batch and removes
  // reduced items row by row, and the expiration move is applied one item at a time.
  const applyInventoryChanges = async (batch: InventoryBatch, quantityDelta: number, expiryChanged: boolean, expiryDate: string) => {
    const decrease = quantityDelta < 0 ? inventoryDecreaseSteps(batch.rows, -quantityDelta) : { remainingRows: batch.rows, steps: [] as InventoryDeleteStep[] }
    await runDeleteSteps(decrease.steps)
    if (expiryChanged) {
      for (const row of decrease.remainingRows) {
        for (let moved = 0; moved < Math.ceil(row.quantity); moved += 1) {
          await Promise.resolve(callService({
            domain: 'evershelf',
            service: 'update_inventory_item',
            serviceData: { expiry_date: expiryDate, inventory_id: row.inventoryId },
          }))
        }
      }
    }
    if (quantityDelta > 0) {
      await Promise.resolve(callService({
        domain: 'evershelf',
        service: 'add_scanned_item',
        serviceData: inventoryAddServiceData(batch.sample, quantityDelta, expiryDate),
      }))
    }
  }

  const saveBatch = (batch: InventoryBatch) => {
    if (!batch.addressable) return
    const expiryDraft = expiryDrafts[batch.key] ?? batch.expiryDate
    if (!validExpiryInput(expiryDraft)) {
      updateError('Use YYYY-MM-DD or clear the date.', 'edit')
      return
    }
    const quantityDelta = (quantityDrafts[batch.key] ?? batch.quantity) - batch.quantity
    const expiryChanged = expiryDraft !== batch.expiryDate
    if (quantityDelta === 0 && !expiryChanged) return
    if (quantityDelta > 0 && itemLocation(batch.sample) === null) {
      updateError(`Home Assistant did not report a storage location for ${title}, so more cannot be added.`, 'edit')
      return
    }
    setBusyAction(`edit-${batch.key}`)
    onBusyChange?.(true)
    onDismissalBlockedChange?.(true)
    updateError(null)
    void applyInventoryChanges(batch, quantityDelta, expiryChanged, expiryDraft.trim())
      .then(finishAction)
      .catch((caughtError: unknown) => {
        setBusyAction(null)
        onDismissalBlockedChange?.(false)
        reportUpdateError(caughtError, 'edit')
      })
      .finally(() => {
        onBusyChange?.(false)
        onDismissalBlockedChange?.(false)
      })
  }

  // Home Assistant owns the split. The projection only makes the user's intent visible until the
  // direct, unfiltered inventory read confirms the same semantic batch token.
  const togglePreparedFood = (batch: InventoryBatch) => {
    if (!batch.addressable || busy) return
    const nextPrepared = !batch.preparedFood
    const qualifier = batchQualifier(batch.expiryDate, multipleBatches, batch.preparedFood)
    let quantity = batch.quantity
    if (batch.quantity > 1) {
      const promptResult = promptPreparedQuantity(`${title}${qualifier}`, batch.quantity, nextPrepared)
      if (promptResult.status === 'cancelled') return
      if (promptResult.status === 'invalid') {
        updateError(`Enter a number from 1 to ${formatQuantity(batch.quantity)}.`)
        return
      }
      quantity = promptResult.quantity
    }

    const groupKey = itemGroupingKey(authorityItem ?? batch.sample)
    const capturedEpoch = targetEpoch
    const capturedIdentity = targetIdentity
    const capturedSourceRevision = sourceRevision
    if (capturedIdentity === null) return
    const actionGeneration = preparedActionGenerationRef.current + 1
    preparedActionGenerationRef.current = actionGeneration
    preparedStatusRef.current = 'pending'
    const actionKey = `prepared-${batch.key}`
    const steps = inventoryPreparedSteps(batch.rows, quantity)
    const projectedBatches = inventoryBatchesAfterPreparedToggle(batches, batch, steps, nextPrepared)
    const projectedToken = inventoryBatchToken(projectedBatches)
    const deadline = Date.now() + PREPARED_OPTIMISTIC_REVERT_MS
    const isOriginCurrent = () => (
      mountedRef.current
      && latestContextRef.current?.epoch === capturedEpoch
      && latestContextRef.current.identity === capturedIdentity
      && latestContextRef.current.revision === capturedSourceRevision
      && preparedActionGenerationRef.current === actionGeneration
    )
    const hasTimedOut = () => preparedStatusRef.current === 'timed-out'
    const isPreparedComplete = () => preparedStatusRef.current === 'completed'
    const clearProjection = () => {
      clearPreparedDeadline()
      setPreparedOperation(null)
      setLocalBatchOverride(null)
      setExpiryDrafts(Object.fromEntries(sourceBatches.map((nextBatch) => [nextBatch.key, nextBatch.expiryDate])))
      setQuantityDrafts(Object.fromEntries(sourceBatches.map((nextBatch) => [nextBatch.key, nextBatch.quantity])))
      resetOptimisticToken()
    }
    const finishBusy = () => {
      if (!isOriginCurrent()) return
      setBusyAction((current) => current === actionKey ? null : current)
      onBusyChange?.(false)
      onDismissalBlockedChange?.(false)
    }
    const installAuthority = (refreshedItems: EverShelfInventoryItem[]) => {
      if (!isOriginCurrent()) return null
      const refreshedItem = inventoryDisplayItemForGroup(refreshedItems, groupKey)
      if (!refreshedItem) return null
      const refreshedBatches = inventoryBatches(refreshedItem, locationLabel)
      setReconciledTarget({
        epoch: capturedEpoch,
        identity: capturedIdentity,
        item: refreshedItem,
        sourceRevision: capturedSourceRevision,
      })
      setPreparedOperation(null)
      setLocalBatchOverride(null)
      setExpiryDrafts(Object.fromEntries(refreshedBatches.map((nextBatch) => [nextBatch.key, nextBatch.expiryDate])))
      setQuantityDrafts(Object.fromEntries(refreshedBatches.map((nextBatch) => [nextBatch.key, nextBatch.quantity])))
      resetOptimisticToken()
      return refreshedItem
    }
    const finishWithAuthority = (refreshedItems: EverShelfInventoryItem[], clearPureTimeoutError: boolean) => {
      const refreshedItem = installAuthority(refreshedItems)
      if (!refreshedItem) return null
      const confirmed = inventoryBatchToken(inventoryBatches(refreshedItem, locationLabel)) === projectedToken
      preparedStatusRef.current = 'completed'
      clearPreparedDeadline()
      cancelReadRetry()
      finishBusy()
      if (clearPureTimeoutError && confirmed && errorSourceRef.current === 'prepared-timeout') updateError(null)
      return { confirmed, item: refreshedItem }
    }
    const finishWithoutTarget = (message: string, source: DetailErrorSource) => {
      if (!isOriginCurrent()) return
      clearPreparedDeadline()
      cancelReadRetry()
      clearProjection()
      preparedStatusRef.current = 'completed'
      finishBusy()
      updateError(message, source)
    }
    const waitForRetry = (delayMs: number) => new Promise<void>((resolve) => {
      cancelReadRetry()
      readRetryResolverRef.current = resolve
      readRetryTimerRef.current = window.setTimeout(() => {
        readRetryTimerRef.current = null
        readRetryResolverRef.current = null
        resolve()
      }, delayMs)
    })
    let mutationSettled = false
    let authorityReadSucceeded = false
    let latestAuthorityItems: EverShelfInventoryItem[] | null = null
    const markTimedOut = () => {
      if (!isOriginCurrent() || preparedStatusRef.current !== 'pending') return
      preparedStatusRef.current = 'timed-out'
      clearProjection()
      updateError(copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.inventory.preparedFoodUpdateError), 'prepared-timeout')
      if (mutationSettled && authorityReadSucceeded && latestAuthorityItems) finishWithAuthority(latestAuthorityItems, true)
    }
    const readUntilAuthority = async () => {
      while (isOriginCurrent() && preparedStatusRef.current !== 'completed') {
        try {
          const refreshedItems = await readAuthoritativeInventory()
          if (!isOriginCurrent()) return null
          authorityReadSucceeded = true
          latestAuthorityItems = refreshedItems
          const refreshedItem = inventoryDisplayItemForGroup(refreshedItems, groupKey)
          if (refreshedItem) return { item: refreshedItem, items: refreshedItems }
          if (hasTimedOut() || Date.now() >= deadline) {
            markTimedOut()
            return { item: null, items: refreshedItems }
          }
        } catch {
          if (!isOriginCurrent()) return null
        }
        await waitForRetry(PREPARED_REFRESH_RETRY_MS)
      }
      return null
    }
    const readUntilConfirmed = async () => {
      let latestItem: EverShelfInventoryDisplayItem | null = null
      while (isOriginCurrent() && preparedStatusRef.current !== 'completed') {
        let refreshedItems: EverShelfInventoryItem[]
        try {
          refreshedItems = await readAuthoritativeInventory()
        } catch (caughtError: unknown) {
          if (!isOriginCurrent()) return { item: latestItem, items: null, status: 'stale' as const }
          if (!hasTimedOut()) {
            updateError(
              caughtError instanceof Error
                ? caughtError.message
                : copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.inventory.preparedFoodUpdateError),
              'prepared-read',
            )
          }
          if (Date.now() >= deadline) markTimedOut()
          await waitForRetry(PREPARED_REFRESH_RETRY_MS)
          continue
        }
        if (!isOriginCurrent()) return { item: latestItem, items: null, status: 'stale' as const }
        authorityReadSucceeded = true
        latestAuthorityItems = refreshedItems
        latestItem = inventoryDisplayItemForGroup(refreshedItems, groupKey)
        if (isPreparedComplete()) return { item: latestItem, items: refreshedItems, status: 'stale' as const }
        const refreshedToken = latestItem
          ? inventoryBatchToken(inventoryBatches(latestItem, locationLabel))
          : null
        if (refreshedToken === projectedToken) return { item: latestItem, items: refreshedItems, status: 'confirmed' as const }
        if (hasTimedOut()) return { item: latestItem, items: refreshedItems, status: 'late' as const }
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          markTimedOut()
          return { item: latestItem, items: refreshedItems, status: 'late' as const }
        }
        await waitForRetry(Math.min(PREPARED_REFRESH_RETRY_MS, remaining))
        if (!isOriginCurrent()) return { item: latestItem, items: null, status: 'stale' as const }
      }
      return { item: latestItem, items: null, status: 'stale' as const }
    }

    clearPreparedDeadline()
    setPreparedOperation({
      epoch: capturedEpoch,
      generation: actionGeneration,
      identity: capturedIdentity,
      projectedBatches,
      sourceRevision: capturedSourceRevision,
      token: projectedToken,
    })
    setLocalBatchOverride(null)
    setExpiryDrafts(Object.fromEntries(projectedBatches.map((nextBatch) => [nextBatch.key, nextBatch.expiryDate])))
    setQuantityDrafts(Object.fromEntries(projectedBatches.map((nextBatch) => [nextBatch.key, nextBatch.quantity])))
    commitOptimisticToken(projectedToken, { revertMs: PREPARED_OPTIMISTIC_REVERT_MS })
    setBusyAction(actionKey)
    onBusyChange?.(true)
    onDismissalBlockedChange?.(false)
    updateError(null)
    preparedDeadlineTimerRef.current = window.setTimeout(markTimedOut, Math.max(0, deadline - Date.now()))

    const runPreparedOperation = async () => {
      let mutationError: unknown = null
      try {
        for (const step of steps) {
          await callService({
            domain: 'evershelf',
            service: 'set_inventory_prepared_food',
            serviceData: { inventory_id: step.inventoryId, prepared_food: nextPrepared, quantity: step.quantity },
          })
        }
      } catch (caughtError: unknown) {
        mutationError = caughtError
      }

      if (!isOriginCurrent()) return
      mutationSettled = true

      if (mutationError !== null) {
        const mutationMessage = mutationError instanceof Error
          ? mutationError.message
          : copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.inventory.preparedFoodUpdateError)
        updateError(mutationMessage, 'prepared-mutation')
        const authority = await readUntilAuthority()
        if (!isOriginCurrent() || !authority) return
        const completion = finishWithAuthority(authority.items, false)
        if (!completion) {
          finishWithoutTarget(mutationMessage, 'prepared-mutation')
          return
        }
        updateError(mutationMessage, 'prepared-mutation')
        try {
          await refreshVisibleInventory()
        } catch {
          // The direct read is the authority; a filtered parent refresh cannot invalidate it.
        }
        return
      }

      const result = await readUntilConfirmed()
      if (!isOriginCurrent() || result.status === 'stale' || !result.items) return
      const completion = finishWithAuthority(result.items, result.status === 'late')
      if (!completion) {
        finishWithoutTarget(
          copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.inventory.preparedFoodUpdateError),
          'prepared-read',
        )
        return
      }
      if (result.status === 'confirmed') {
        updateError(null)
        try {
          await refreshVisibleInventory()
        } catch (caughtError: unknown) {
          if (isOriginCurrent()) reportUpdateError(caughtError, 'prepared-read')
        }
      }
    }

    void runPreparedOperation()
  }

  const deleteBatch = (batch: InventoryBatch) => {
    if (!batch.addressable) return
    const qualifier = batchQualifier(batch.expiryDate, multipleBatches, batch.preparedFood)
    const displayTitle = deleteDisplayTitle(title, qualifier)
    let quantityToDelete = batch.quantity
    if (batch.quantity > 1) {
      const promptResult = promptDeleteQuantity(displayTitle, batch.locationLabel, batch.quantity)
      if (promptResult.status === 'cancelled') return
      if (promptResult.status === 'invalid') {
        updateError(copy(PAGE_FOOD_COPY_NAMESPACE, PAGE_FOOD_COPY_KEYS.delete.quantityError, { quantity: formatQuantity(batch.quantity) }), 'delete')
        return
      }
      quantityToDelete = promptResult.quantity
    } else if (!confirmInventoryDelete(displayTitle, batch.locationLabel)) return

    const totalQuantity = batches.reduce((total, batch) => total + batch.quantity, 0)
    const deleteSteps: InventoryDeleteStep[] = quantityToDelete < batch.quantity
      ? inventoryDecreaseSteps(batch.rows, quantityToDelete).steps
      : batch.rows.map((row) => ({ inventoryId: row.inventoryId }))
    setBusyAction(`delete-${batch.key}`)
    onBusyChange?.(true)
    onDismissalBlockedChange?.(true)
    updateError(null)
    void runDeleteSteps(deleteSteps)
      .then(() => {
        notifyInventoryChanged()
        if (quantityToDelete >= totalQuantity) {
          setBusyAction(null)
          onBusyChange?.(false)
          onDismissalBlockedChange?.(false)
          onComplete()
          return
        }
        const nextBatches = inventoryBatchesAfterDelete(batches, deleteSteps)
        setLocalBatchOverride(nextBatches)
        setExpiryDrafts(Object.fromEntries(nextBatches.map((batch) => [batch.key, batch.expiryDate])))
        setQuantityDrafts(Object.fromEntries(nextBatches.map((batch) => [batch.key, batch.quantity])))
        setBusyAction(null)
        onDismissalBlockedChange?.(false)
      })
      .catch((caughtError: unknown) => {
        setBusyAction(null)
        onDismissalBlockedChange?.(false)
        updateError(caughtError instanceof Error ? caughtError.message : 'Unable to delete item', 'delete')
      })
      .finally(() => {
        onBusyChange?.(false)
        onDismissalBlockedChange?.(false)
      })
  }

  return {
    batches,
    busy,
    busyAction,
    deleteBatch,
    dismissalBlocked,
    error,
    expiryDrafts,
    multipleBatches,
    quantityDrafts,
    retainsDismissedView,
    resetDraft,
    saveBatch,
    setExpiryDraft: (batchKey, value) => setExpiryDrafts((current) => ({ ...current, [batchKey]: value })),
    setQuantityDraft: (batchKey, value) => setQuantityDrafts((current) => ({ ...current, [batchKey]: value })),
    title,
    togglePreparedFood,
  }
}

export function EverShelfInventoryDetailsPage({ controller }: { controller: EverShelfInventoryDetailsController }) {
  const {
    batches,
    busy,
    busyAction,
    deleteBatch,
    error,
    expiryDrafts,
    multipleBatches,
    quantityDrafts,
    resetDraft,
    saveBatch,
    setExpiryDraft,
    setQuantityDraft,
    title,
    togglePreparedFood,
  } = controller

  return (
    <div className={styles.instancesSheet}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <ul className={styles.instancesList}>
        {batches.map((batch) => {
          const qualifier = batchQualifier(batch.expiryDate, multipleBatches, batch.preparedFood)
          const expiryDraft = expiryDrafts[batch.key] ?? batch.expiryDate
          const quantityDraft = quantityDrafts[batch.key] ?? batch.quantity
          const quantityDelta = quantityDraft - batch.quantity
          const expiryChanged = expiryDraft !== batch.expiryDate
          const disabled = busy || !batch.addressable
          return (
            <li className={styles.instanceRow} key={batch.key}>
              <div className={styles.instanceHeader}>
                <span className={styles.instanceCopy}>
                  <strong>{multipleBatches ? expiryInfo(batch.expiryDate || undefined).label : title}</strong>
                  <small>{batch.preparedFood ? `In the ${batch.locationLabel} · Prepared` : `In the ${batch.locationLabel}`}</small>
                </span>
                <button aria-busy={busyAction === `delete-${batch.key}` ? 'true' : undefined} aria-label={`Delete ${title}${qualifier}`} className={`${styles.rowAction} ${styles.deleteAction}`} disabled={disabled} onClick={() => deleteBatch(batch)} type="button">
                  <MaterialIcon name="mdi:delete" size={22} />
                </button>
              </div>
              <div className={styles.instanceEditPanel}>
                <NumberStepper
                  ariaLabel={`Quantity for ${title}${qualifier}`}
                  decrementLabel={`Remove one ${title}${qualifier}`}
                  disabled={disabled}
                  formatValue={formatQuantity}
                  incrementLabel={`Add one ${title}${qualifier}`}
                  label="Quantity"
                  max={INVENTORY_QUANTITY_MAX}
                  min={Math.min(1, batch.quantity)}
                  onChange={(value) => setQuantityDraft(batch.key, value)}
                  value={quantityDraft}
                />
                <NativePickerField ariaLabel={`Expiration date for ${title}${qualifier}`} className={styles.instanceDateField} emptyLabel="No expiration date" label="Expiration Date" onChange={(value) => setExpiryDraft(batch.key, value)} type="date" value={expiryDraft} />
                <CheckboxRow
                  active={batch.preparedFood}
                  alignWrappedToIconTop
                  aria-busy={busyAction?.startsWith('prepared-') ? 'true' : undefined}
                  aria-label={`Prepared Food Item for ${title}${qualifier}`}
                  className={styles.instancePreparedRow}
                  disabled={disabled}
                  onClick={() => togglePreparedFood(batch)}
                  subtitle="Indicates this is a prepared food item and does not need classification."
                  title="Prepared Food Item"
                />
                {quantityDelta !== 0 && <Description className={styles.instanceHint}>{quantityChangeHint(quantityDelta, batch.locationLabel)}</Description>}
                {(expiryChanged || quantityDelta !== 0) && (
                  <span className={styles.instanceEditActions}>
                    <button className={styles.secondaryAction} disabled={busy} onClick={() => resetDraft(batch)} type="button">Reset</button>
                    <button aria-busy={busyAction === `edit-${batch.key}` ? 'true' : undefined} aria-label={`Save ${title}${qualifier}`} className={styles.primaryAction} disabled={busy} onClick={() => saveBatch(batch)} type="button">Save</button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function EverShelfInventoryDetailsPageHost({ active, children, target, onBusyChange, onComplete, onDismissalBlockedChange, onErrorChange, onInventoryChanged }: { active: boolean; children: (controller: EverShelfInventoryDetailsController) => ReactNode; target: EverShelfInventoryDetailsTarget | null; onBusyChange?: (busy: boolean) => void; onComplete: () => void; onDismissalBlockedChange?: (blocked: boolean) => void; onErrorChange?: (error: string | null) => void; onInventoryChanged?: InventoryRefresh }) {
  const controller = useInventoryItemDetails({
    active,
    item: target?.item ?? null,
    location: target?.location ?? 'all',
    locationLabel: target?.locationLabel ?? 'inventory',
    onBusyChange,
    onComplete,
    onDismissalBlockedChange,
    onErrorChange,
    onInventoryChanged: onInventoryChanged ?? target?.onInventoryChanged,
  })
  return children(controller)
}

function InventoryItemDetailsModal({ item, location, locationLabel, onClose, onInventoryChanged, open }: { item: EverShelfInventoryDisplayItem | null; location: EverShelfInventoryLocation; locationLabel: string; onClose: () => void; onInventoryChanged: InventoryRefresh; open: boolean }) {
  const controller = useInventoryItemDetails({
    active: open && item !== null,
    item,
    location,
    locationLabel,
    onComplete: onClose,
    onInventoryChanged,
  })

  return (
    <ModalSheet centeredGeometry={INVENTORY_DETAILS_CENTERED_GEOMETRY} onClose={() => {
      if (!controller.dismissalBlocked) onClose()
    }} open={open && item !== null} size="form" title={controller.title}>
      <EverShelfInventoryDetailsPage controller={controller} />
    </ModalSheet>
  )
}

function InventorySortSheet({ draftDirection, draftMode, onApply, onClose, onDraftDirectionChange, onDraftModeChange, onReset, open }: { draftDirection: InventorySortDirection; draftMode: InventorySortMode; onApply: () => void; onClose: () => void; onDraftDirectionChange: (direction: InventorySortDirection) => void; onDraftModeChange: (mode: InventorySortMode) => void; onReset: () => void; open: boolean }) {
  return (
    <ModalSheet
      centeredGeometry={INVENTORY_SORT_CENTERED_GEOMETRY}
      footer={(
        <FilterSheetFooter
          onApply={() => {
            onApply()
            onClose()
          }}
          onReset={onReset}
        />
      )}
      onClose={onClose}
      open={open}
      size="form"
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
      centeredGeometry={INVENTORY_FILTER_CENTERED_GEOMETRY}
      footer={(
        <FilterSheetFooter
          onApply={() => {
            onApply()
            onClose()
          }}
          onReset={onReset}
        />
      )}
      onClose={onClose}
      open={open}
      size="form"
      title="Filter Inventory"
    >
      <fieldset className={styles.fieldset} data-modal-landscape-layout="option-grid">
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

function InventorySearchAction({ controls, onExpandedChange }: { controls: EverShelfInventoryControls; onExpandedChange: (expanded: boolean) => void }) {
  return (
    <ExpandingSearchAction
      ariaLabel="Search inventory"
      onExpandedChange={onExpandedChange}
      onQueryChange={(query) => {
        logInventorySearch('input-change', { value: query })
        controls.setSearchQuery(query)
      }}
      placeholder="Search items..."
      query={controls.searchQuery}
    />
  )
}

export function EverShelfInventoryFloatingActions({ controls }: { controls: EverShelfInventoryControls }) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  if (controls.inventoryLoadPhase !== 'content' || (controls.inventoryItemCount === 0 && !controls.searchActive && !searchExpanded)) return null
  const actionsCollapsed = searchExpanded

  return (
    <>
      <InventorySearchAction controls={controls} onExpandedChange={setSearchExpanded} />
      <FloatingActionSlot collapsed={actionsCollapsed}>
        <FloatingActionButton ariaLabel="Sort" color={controls.sortActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:swap-vertical" onClick={controls.openSortSheet} />
      </FloatingActionSlot>
      <FloatingActionSlot collapsed={actionsCollapsed}>
        <FloatingActionButton ariaLabel="Filter" color={controls.filterActive ? SORT_FILTER_ACTIVE_COLOR : SORT_FILTER_COLOR} icon="mdi:tune-vertical" onClick={controls.openFilterSheet} />
      </FloatingActionSlot>
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

export function EverShelfInventoryPanel({ controls, emptyState, layout = 'list', location, onOpenDetails, rowVariant, title }: EverShelfInventoryPanelProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const { inventoryLoadPhase, setInventoryItemCount, setInventoryLoadPhase } = controls
  const [detailsItem, setDetailsItem] = useState<EverShelfInventoryDisplayItem | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [items, setItems] = useState<EverShelfInventoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settledSearchQuery, setSettledSearchQuery] = useState('')
  const [searchLoadPhase, setSearchLoadPhase] = useState<InventorySearchLoadPhase>('idle')
  const itemsRef = useRef<EverShelfInventoryItem[] | null>(null)
  const loadScopeRef = useRef({ location })
  const rawSearchQueryRef = useRef(controls.searchQuery.trim())
  const refreshRequestRef = useRef(0)
  const requestIdRef = useRef(0)
  const searchFinishTimerRef = useRef<number | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    rawSearchQueryRef.current = controls.searchQuery.trim()
  }, [controls.searchQuery])

  const loadInventoryItems = useCallback(async (searchQuery: string) => {
    const serviceData = {
      ...(location === 'all' ? {} : { location }),
      ...(searchQuery ? { q: searchQuery } : {}),
    }
    const result = await Promise.resolve(
      callService({
        domain: 'evershelf',
        service: 'list_inventory',
        serviceData,
        returnResponse: true,
      }),
    )
    const response = inventoryResponseFromResult(result)
    const searchItems = inventoryItemsFromSearchResponse(response, searchQuery)
    const nextItems = await resolvedInventoryItems(searchItems, callService, location)
    return { nextItems, response }
  }, [callService, location])

  useEffect(() => {
    let cancelled = false
    let finishTimer: number | null = null
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const searchQuery = controls.debouncedSearchQuery.trim()
    const previousScope = loadScopeRef.current
    const searchOnlyLoad = itemsRef.current !== null && previousScope.location === location
    const initialLoad = !searchOnlyLoad
    loadScopeRef.current = { location }

    if (searchFinishTimerRef.current !== null) {
      window.clearTimeout(searchFinishTimerRef.current)
      searchFinishTimerRef.current = null
    }

    logInventorySearch('request-start', {
      id: requestId,
      initialLoad,
      location,
      query: searchQuery,
    })

    if (initialLoad) {
      queueMicrotask(() => {
        if (cancelled || requestIdRef.current !== requestId) return
        setInventoryItemCount(null)
        setInventoryLoadPhase('loading')
      })
    } else {
      setSearchLoadPhase('loading')
    }

    const finishLoading = (nextItems: EverShelfInventoryItem[], nextError: string | null = null) => {
      logInventorySearch('initial-finish-scheduled', {
        error: nextError,
        id: requestId,
        itemCount: nextItems.length,
        query: searchQuery,
      })
      setInventoryLoadPhase('exiting')
      finishTimer = window.setTimeout(() => {
        if (cancelled || requestIdRef.current !== requestId) {
          logInventorySearch('initial-finish-stale', { id: requestId, query: searchQuery })
          return
        }
        setError(nextError)
        setItems(nextItems)
        setInventoryItemCount(nextError ? 0 : nextItems.length)
        setSettledSearchQuery(searchQuery)
        setInventoryLoadPhase('content')
        logInventorySearch('initial-finish-applied', {
          error: nextError,
          id: requestId,
          itemCount: nextItems.length,
          query: searchQuery,
        })
      }, INVENTORY_LOADING_EXIT_MS)
    }

    const finishSearch = (nextItems: EverShelfInventoryItem[], nextError: string | null = null) => {
      logInventorySearch('search-finish-scheduled', {
        error: nextError,
        id: requestId,
        itemCount: nextItems.length,
        query: searchQuery,
      })
      setSearchLoadPhase('exiting')
      searchFinishTimerRef.current = window.setTimeout(() => {
        if (cancelled || requestIdRef.current !== requestId) {
          logInventorySearch('search-finish-stale', { id: requestId, query: searchQuery })
          return
        }
        if (rawSearchQueryRef.current !== searchQuery) {
          logInventorySearch('search-finish-superseded', {
            id: requestId,
            query: searchQuery,
            rawQuery: rawSearchQueryRef.current,
          })
          return
        }
        setError(nextError)
        setItems(nextItems)
        setInventoryItemCount(nextError ? 0 : nextItems.length)
        setSettledSearchQuery(searchQuery)
        setSearchLoadPhase('idle')
        searchFinishTimerRef.current = null
        logInventorySearch('search-finish-applied', {
          error: nextError,
          id: requestId,
          itemCount: nextItems.length,
          query: searchQuery,
        })
      }, 190)
    }

    void loadInventoryItems(searchQuery)
      .then(({ nextItems, response }) => {
        if (cancelled || requestIdRef.current !== requestId) {
          logInventorySearch('response-stale', { id: requestId, query: searchQuery })
          return
        }
        logInventorySearch('response-received', {
          id: requestId,
          initialLoad,
          itemCount: nextItems.length,
          query: searchQuery,
          responseSearch: response.search,
          responseSource: response.source,
        })
        if (initialLoad) finishLoading(nextItems)
        else finishSearch(nextItems)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled && requestIdRef.current === requestId) {
          const message = caughtError instanceof Error ? caughtError.message : 'Unable to load inventory'
          logInventorySearch('request-error', { id: requestId, message, query: searchQuery })
          if (!initialLoad) {
            finishSearch([], message)
            return
          }
          finishLoading([], caughtError instanceof Error ? caughtError.message : 'Unable to load inventory')
        }
      })

    return () => {
      cancelled = true
      if (finishTimer !== null) window.clearTimeout(finishTimer)
      if (searchFinishTimerRef.current !== null && requestIdRef.current === requestId) {
        window.clearTimeout(searchFinishTimerRef.current)
        searchFinishTimerRef.current = null
      }
      logInventorySearch('request-cleanup', { id: requestId, query: searchQuery })
    }
  }, [controls.debouncedSearchQuery, loadInventoryItems, location, setInventoryItemCount, setInventoryLoadPhase])

  const loadedItems = useMemo(() => items ?? [], [items])
  const displayItems = useMemo(() => groupedInventoryItems(loadedItems), [loadedItems])
  const refreshInventory = useCallback(async (): Promise<EverShelfInventoryItem[]> => {
    const refreshId = refreshRequestRef.current + 1
    refreshRequestRef.current = refreshId
    requestIdRef.current += 1
    if (searchFinishTimerRef.current !== null) {
      window.clearTimeout(searchFinishTimerRef.current)
      searchFinishTimerRef.current = null
    }
    const searchQuery = controls.debouncedSearchQuery.trim()
    try {
      const { nextItems } = await loadInventoryItems(searchQuery)
      if (refreshRequestRef.current === refreshId) {
        setError(null)
        setItems(nextItems)
        setInventoryItemCount(nextItems.length)
        setSettledSearchQuery(searchQuery)
        setSearchLoadPhase('idle')
      }
      return nextItems
    } catch (caughtError: unknown) {
      if (refreshRequestRef.current === refreshId) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load inventory')
        setSettledSearchQuery(searchQuery)
        setSearchLoadPhase('idle')
      }
      throw caughtError
    }
  }, [controls.debouncedSearchQuery, loadInventoryItems, setInventoryItemCount])
  const removeDeletedItems = useCallback((steps: InventoryDeleteStep[]) => {
    setItems((currentItems) => {
      if (currentItems === null) return currentItems
      const stepsById = new Map(steps.map((step) => [step.inventoryId, step]))
      const nextItems = currentItems.flatMap((item) => {
        const inventoryId = itemInventoryId(item)
        const step = inventoryId === null ? undefined : stepsById.get(inventoryId)
        if (!step) return [item]
        if (step.quantity === undefined) return []
        const remainingQuantity = itemRawQuantity(item) - step.quantity
        return remainingQuantity > 0 ? [{ ...item, quantity: remainingQuantity }] : []
      })
      setInventoryItemCount(nextItems.length)
      return nextItems
    })
  }, [setInventoryItemCount])
  const effectiveSearchQuery = controls.debouncedSearchQuery.trim()
  const visibleItems = useMemo(() => visibleInventoryItems(displayItems, controls.sortMode, controls.sortDirection, controls.filterMode), [controls.filterMode, controls.sortDirection, controls.sortMode, displayItems])
  const searchInputPending = controls.searchQuery.trim() !== controls.debouncedSearchQuery.trim()
  const searchResultPending = items !== null && effectiveSearchQuery !== settledSearchQuery
  const searchLoading = searchLoadPhase !== 'idle' || searchInputPending || searchResultPending
  const configuredEmptyState = effectiveSearchQuery ? undefined : emptyState
  const renderEmptyState = (fallbackTitle: string, fallbackDescription: string) => (
    <EmptyState
      className={styles.inventoryEmpty}
      description={configuredEmptyState?.description ?? fallbackDescription}
      layout={configuredEmptyState?.layout}
      title={configuredEmptyState?.title ?? fallbackTitle}
    />
  )
  const openItemDetails = (item: EverShelfInventoryDisplayItem) => {
    if (onOpenDetails) {
      onOpenDetails({ item, location, locationLabel: LOCATION_DELETE_LABELS[location], onInventoryChanged: refreshInventory })
      return
    }
    setDetailsItem(item)
    setDetailsOpen(true)
  }

  return (
    <>
      <article aria-label={`${title} inventory list`} className={styles.panel} data-layout={layout} data-row-variant={rowVariant}>
        {inventoryLoadPhase !== 'content' ? (
          <DashboardPageLoading className={styles.inventoryLoading} label={`Loading ${title}`} phase={inventoryLoadPhase === 'exiting' ? 'exiting' : 'loading'} />
        ) : (
          <>
            <div className={styles.inventoryContent} data-search-loading={searchLoading ? 'true' : undefined}>
              <div className={styles.inventoryResults}>
                {error ? (
                  <EmptyState className={styles.inventoryEmpty} description={inventoryErrorDescription(error, title)} title={`Unable to Load ${title}`} />
                ) : items !== null && loadedItems.length === 0 ? (
                  renderEmptyState(effectiveSearchQuery ? 'No Matching Items' : 'No Items Found', effectiveSearchQuery ? emptySearchDescription(controls.filterActive) : `Scan an item to add it to your ${title.toLowerCase()}.`)
                ) : items !== null && loadedItems.length > 0 && visibleItems.length === 0 && (effectiveSearchQuery
                  ? renderEmptyState('No Matching Items', emptySearchDescription(controls.filterActive))
                  : renderEmptyState('No Matching Items', 'Try a different filter, or clear it to show all items.'))}
                {visibleItems.length > 0 && (
                  <ul className={styles.items}>
                    {visibleItems.map((item, index) => {
                      const name = itemName(item)
                      const expiry = expiryInfo(itemExpiryDate(item))
                      const batchCount = inventoryBatches(item, LOCATION_DELETE_LABELS[location]).length
                      const multiItem = batchCount > 1
                      const quantity = itemQuantity(item)
                      return (
                        <li className={styles.item} key={item.inventory_id ?? item.id ?? `${location}-${name}-${index}`}>
                          <PantryRow expiry={expiry} extraBatchCount={batchCount - 1} locationLabel={LOCATION_DELETE_LABELS[location]} multiItem={multiItem} onDeleted={removeDeletedItems} onOpenDetails={() => openItemDetails(item)} quantity={quantity} rows={inventoryBatchRows(item)} title={name} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {searchLoading && (
                <div aria-live="polite" aria-label="Searching inventory" className={styles.inventorySearchOverlay} data-phase={searchLoadPhase}>
                  <span aria-hidden="true" className={styles.inventorySearchSpinner} />
                </div>
              )}
            </div>
          </>
        )}
      </article>
      {!onOpenDetails && <InventoryItemDetailsModal item={detailsItem} location={location} locationLabel={LOCATION_DELETE_LABELS[location]} onClose={() => setDetailsOpen(false)} onInventoryChanged={refreshInventory} open={detailsOpen} />}
    </>
  )
}
