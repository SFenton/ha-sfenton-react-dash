import {
  HOME_CABINET_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
} from './routes'

export const FOOD_CARD_BACKGROUND_COLOR = 'rgba(155, 110, 64, 0.72)'
export const EVERSHELF_EXPIRING_SOON_ENTITY_ID = 'sensor.evershelf_expiring_soon'
export const EVERSHELF_TOTAL_ITEMS_ENTITY_ID = 'sensor.evershelf_total_items'

export const EVERSHELF_FOOD_SPACES = [
  { title: 'Pantry', entityId: 'sensor.evershelf_items_in_pantry', location: 'dispensa', icon: 'mdi:food-fork-drink', color: { r: 155, g: 110, b: 64 }, routePath: HOME_PANTRY_ROUTE_PATH },
  { title: 'Fridge', entityId: 'sensor.evershelf_items_in_fridge', location: 'frigo', icon: 'mdi:fridge', color: { r: 42, g: 126, b: 180 }, routePath: HOME_FRIDGE_ROUTE_PATH },
  { title: 'Freezer', entityId: 'sensor.evershelf_items_in_freezer', location: 'freezer', icon: 'mdi:snowflake', color: { r: 52, g: 103, b: 176 }, routePath: HOME_FREEZER_ROUTE_PATH },
  { title: 'Spice Rack', entityId: 'sensor.kitchen_evershelf_items_in_spice_rack', location: 'spice_rack', icon: 'mdi:shaker-outline', color: { r: 183, g: 98, b: 56 }, routePath: HOME_SPICE_RACK_ROUTE_PATH },
  { title: 'Cabinet', entityId: 'sensor.kitchen_evershelf_items_in_cabinet', location: 'cabinet', icon: 'mdi:cupboard', color: { r: 118, g: 96, b: 72 }, routePath: HOME_CABINET_ROUTE_PATH },
] as const

type EverShelfEntity = {
  attributes?: Record<string, unknown>
  state?: number | string
}

type EverShelfEntityLookup = Record<string, EverShelfEntity | null | undefined>

function numericEntityState(entity: EverShelfEntity | null | undefined) {
  const value = Number(entity?.state)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function normalizedEverShelfLocation(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'pantry') return 'dispensa'
  if (normalized === 'fridge') return 'frigo'
  if (normalized === 'spice rack' || normalized === 'spice-rack') return 'spice_rack'
  return normalized
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function dateFromIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function itemExpiresWithinWeek(item: Record<string, unknown>) {
  const daysRemaining = Number(item.days_remaining)
  if (Number.isFinite(daysRemaining)) return daysRemaining >= 0 && daysRemaining <= 7

  const expiryDate = typeof item.expiry_date === 'string' ? dateFromIsoDate(item.expiry_date) : null
  if (!expiryDate) return false
  const today = dateOnly(new Date())
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  return expiryDate >= today && expiryDate <= nextWeek
}

function expiringSoonCountForLocation(entities: EverShelfEntityLookup, location: string) {
  const expiringList = entities[EVERSHELF_EXPIRING_SOON_ENTITY_ID]?.attributes?.expiring_list
  if (!Array.isArray(expiringList)) return 0
  return expiringList.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const expiringItem = item as Record<string, unknown>
    return normalizedEverShelfLocation(expiringItem.location) === location && itemExpiresWithinWeek(expiringItem)
  }).length
}

export function groceryPlaceSubtitle(entities: EverShelfEntityLookup, entityId: string, location: string) {
  const itemCount = numericEntityState(entities[entityId])
  const expiringCount = expiringSoonCountForLocation(entities, location)
  return itemCount + ' Items • ' + expiringCount + ' Expiring Soon'
}

export function foodSummarySubtitle(entities: EverShelfEntityLookup) {
  const itemCount = EVERSHELF_FOOD_SPACES.reduce((total, place) => total + numericEntityState(entities[place.entityId]), 0)
  const expiringCount = EVERSHELF_FOOD_SPACES.reduce((total, place) => total + expiringSoonCountForLocation(entities, place.location), 0)
  return itemCount + ' Items • ' + expiringCount + ' Expiring Soon'
}

/** The shared HA-derived subtitle used anywhere that represents the complete EverShelf inventory. */
export function allFoodSubtitle(entities: EverShelfEntityLookup) {
  const fallbackItemCount = EVERSHELF_FOOD_SPACES.reduce((total, place) => total + numericEntityState(entities[place.entityId]), 0)
  const itemCount = numericEntityState(entities[EVERSHELF_TOTAL_ITEMS_ENTITY_ID]) || fallbackItemCount
  const expiringCount = numericEntityState(entities[EVERSHELF_EXPIRING_SOON_ENTITY_ID])
  return itemCount + ' Items • ' + expiringCount + ' Expiring Soon'
}
