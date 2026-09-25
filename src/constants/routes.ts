import { copy } from '../i18n'
import { dashboardRouteHostIndex, isDashboardRouteHostPath } from './dashboardHosts'

export interface DashboardRouteConfig {
  title: string
  path: string
  icon: string
}

export const DAILY_REPORT_HASH = '#daily-report'
export const DAILY_REPORT_USER_QUERY_KEY = 'user'
export const DAILY_REPORT_TAB_QUERY_KEY = 'tab'
export const DAILY_REPORT_QUERY_KEYS = [DAILY_REPORT_USER_QUERY_KEY, DAILY_REPORT_TAB_QUERY_KEY] as const
export const HOME_GROCERY_LIST_ROUTE_PATH = 'grocery-list'
export const HOME_FOOD_ROUTE_PATH = 'food'
export const HOME_RECIPES_ROUTE_PATH = 'recipes'
export const HOME_ALL_FOOD_ROUTE_PATH = 'all-food'
export const HOME_PANTRY_ROUTE_PATH = 'pantry'
export const HOME_FRIDGE_ROUTE_PATH = 'fridge'
export const HOME_FREEZER_ROUTE_PATH = 'freezer'
export const HOME_SPICE_RACK_ROUTE_PATH = 'spice-rack'
export const HOME_CABINET_ROUTE_PATH = 'cabinet'
export const HOME_SPRINKLERS_ROUTE_PATH = 'sprinklers'
export const THERMOSTAT_ROUTE_PATH = 'thermostat'
export const VACATION_MODE_ROUTE_PATH = 'vacation-mode'
export const SOLO_TRIP_ROUTE_PATH = 'solo-trip'
const specialDeviceModesRouteName = copy('pageSettings', 'items.specialDeviceModes.title')
const sprinklersRouteName = copy('pageSprinklers', 'title')
const controlShowcaseRouteName = copy('pageControlShowcase', 'title')

export const LIGHT_CONTROLS_SHOWCASE_ROUTE_PATH = 'light-controls'

export const DASHBOARD_ROUTES: DashboardRouteConfig[] = [
  { title: 'Overview', path: 'overview', icon: 'mdi:home' },
  { title: 'Security', path: 'security', icon: 'mdi:shield' },
  { title: 'Chores', path: 'chores', icon: 'mdi:clipboard-list' },
  { title: 'Living Room', path: 'living-room', icon: 'mdi:sofa' },
  { title: 'Guest Room', path: 'guest-room', icon: 'mdi:bed' },
  { title: 'Master Bedroom', path: 'master-bedroom', icon: 'mdi:bed-king' },
  { title: 'Gym', path: 'gym', icon: 'mdi:dumbbell' },
  { title: 'Hallway', path: 'hallway', icon: 'mdi:door-open' },
  { title: 'Office', path: 'office', icon: 'mdi:desktop-tower' },
  { title: 'Kitchen', path: 'kitchen', icon: 'mdi:stove' },
  { title: 'Groceries', path: HOME_GROCERY_LIST_ROUTE_PATH, icon: 'mdi:cart' },
  { title: 'Food & Recipes', path: HOME_FOOD_ROUTE_PATH, icon: 'mdi:food-fork-drink' },
  { title: 'Recipes', path: HOME_RECIPES_ROUTE_PATH, icon: 'mdi:chef-hat' },
  { title: 'All Food', path: HOME_ALL_FOOD_ROUTE_PATH, icon: 'mdi:food-variant' },
  { title: 'Pantry', path: HOME_PANTRY_ROUTE_PATH, icon: 'mdi:food-fork-drink' },
  { title: 'Fridge', path: HOME_FRIDGE_ROUTE_PATH, icon: 'mdi:fridge' },
  { title: 'Freezer', path: HOME_FREEZER_ROUTE_PATH, icon: 'mdi:snowflake' },
  { title: 'Spice Rack', path: HOME_SPICE_RACK_ROUTE_PATH, icon: 'mdi:shaker-outline' },
  { title: 'Cabinet', path: HOME_CABINET_ROUTE_PATH, icon: 'mdi:cupboard' },
  { title: 'Dining Room', path: 'dining-room', icon: 'mdi:silverware-fork-knife' },
  { title: 'Back Deck', path: 'back-deck', icon: 'mdi:grill' },
  { title: 'Music Room', path: 'music-room', icon: 'mdi:music' },
  { title: 'Theater Room', path: 'theater-room', icon: 'mdi:movie-open' },
  { title: 'Downstairs Hallway', path: 'downstairs-hallway', icon: 'mdi:stairs' },
  { title: 'Garage', path: 'garage', icon: 'mdi:garage' },
  { title: 'Guest Bathroom', path: 'guest-bathroom', icon: 'mdi:shower' },
  { title: 'Master Bathroom', path: 'master-bathroom', icon: 'mdi:bathtub' },
  { title: 'Mach-E', path: 'mach-e', icon: 'mdi:car-electric' },
  { title: 'Admin', path: 'admin', icon: 'mdi:home-assistant' },
  { title: specialDeviceModesRouteName, path: 'special-device-modes', icon: 'mdi:tune-vertical' },
  { title: 'Entryway', path: 'entryway', icon: 'mdi:door' },
  { title: 'Settings', path: 'settings', icon: 'mdi:cog' },
  { title: 'To-Do', path: 'to-do', icon: 'mdi:clipboard-list' },
  { title: 'Thermostat', path: THERMOSTAT_ROUTE_PATH, icon: 'mdi:thermostat' },
  { title: 'Groceries', path: 'groceries', icon: 'mdi:cart' },
  { title: "Stephen's Chores", path: 'stephens-chores', icon: 'mdi:account-check' },
  { title: "Steph's Chores", path: 'stephs-chores', icon: 'mdi:account-check' },
  { title: 'Unassigned Chores', path: 'unassigned-chores', icon: 'mdi:account-question' },
  { title: 'Home Improvement Tasks', path: 'home-improvement-chores', icon: 'mdi:hammer-wrench' },
  { title: 'Vacuums', path: 'vacuums', icon: 'mdi:robot-vacuum' },
  { title: 'Guests Staying Over', path: 'guests-staying-over', icon: 'mdi:account-group' },
  { title: 'Vacation', path: 'vacation', icon: 'mdi:airplane' },
  { title: 'Media', path: 'media', icon: 'mdi:remote' },
  { title: 'Custom Lights', path: 'custom-lights', icon: 'mdi:lightbulb-group' },
  { title: controlShowcaseRouteName, path: LIGHT_CONTROLS_SHOWCASE_ROUTE_PATH, icon: 'mdi:palette' },
  { title: sprinklersRouteName, path: HOME_SPRINKLERS_ROUTE_PATH, icon: 'mdi:sprinkler-variant' },
]

export const PRIMARY_NAV_ROUTES = [
  { label: copy('shell', 'navigation.items.home'), path: 'overview', icon: 'mdi:home' },
  { label: copy('shell', 'navigation.items.security'), path: 'security', icon: 'mdi:shield' },
  { label: copy('shell', 'navigation.items.climate'), path: THERMOSTAT_ROUTE_PATH, icon: 'mdi:thermostat' },
  { label: copy('shell', 'navigation.items.chores'), path: 'chores', icon: 'mdi:clipboard-list' },
  { label: copy('shell', 'navigation.items.settings'), path: 'settings', icon: 'mdi:cog' },
]

const HOME_SUB_ROUTE_PATHS = new Set([
  'back-deck',
  'custom-lights',
  LIGHT_CONTROLS_SHOWCASE_ROUTE_PATH,
  'dining-room',
  'downstairs-hallway',
  'entryway',
  'garage',
  'guest-bathroom',
  'guest-room',
  'gym',
  'hallway',
  HOME_GROCERY_LIST_ROUTE_PATH,
  HOME_FOOD_ROUTE_PATH,
  HOME_RECIPES_ROUTE_PATH,
  HOME_ALL_FOOD_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
  HOME_CABINET_ROUTE_PATH,
  HOME_SPRINKLERS_ROUTE_PATH,
  'kitchen',
  'living-room',
  'master-bathroom',
  'master-bedroom',
  'media',
  'music-room',
  'office',
  'theater-room',
  'vacuums',
])

const HOME_FOOD_DETAIL_ROUTE_PATHS = new Set([
  HOME_RECIPES_ROUTE_PATH,
  HOME_ALL_FOOD_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
  HOME_CABINET_ROUTE_PATH,
])

const SETTINGS_SUB_ROUTE_PATHS = new Set([
  'admin',
  'guests-staying-over',
  'mach-e',
  SOLO_TRIP_ROUTE_PATH,
  'special-device-modes',
  'to-do',
  'vacation',
  VACATION_MODE_ROUTE_PATH,
])

const AUXILIARY_ROUTE_PATHS = new Set([
  SOLO_TRIP_ROUTE_PATH,
  VACATION_MODE_ROUTE_PATH,
])

const CHORES_SUB_ROUTE_PATHS = new Set([
  'groceries',
  'stephens-chores',
  'stephs-chores',
  'unassigned-chores',
  'home-improvement-chores',
])

export function primaryNavPathForRoute(path: string | undefined) {
  if (!path) return 'overview'
  if (HOME_SUB_ROUTE_PATHS.has(path)) return 'overview'
  if (CHORES_SUB_ROUTE_PATHS.has(path) || path.endsWith('-chores')) return 'chores'
  if (SETTINGS_SUB_ROUTE_PATHS.has(path)) return 'settings'
  return path
}

export function fallbackBackPathForRoute(path: string | undefined) {
  if (!path) return undefined
  if (HOME_FOOD_DETAIL_ROUTE_PATHS.has(path)) return HOME_FOOD_ROUTE_PATH
  if (HOME_SUB_ROUTE_PATHS.has(path)) return 'overview'
  if (CHORES_SUB_ROUTE_PATHS.has(path)) return 'chores'
  if (SETTINGS_SUB_ROUTE_PATHS.has(path)) return 'settings'
  return undefined
}

export function primaryNavRouteActive(activePath: string | undefined, routePath: string) {
  return primaryNavPathForRoute(activePath) === routePath
}

const DEFAULT_ROUTE_PATH = 'overview'
const URL_PARSE_ORIGIN = 'http://ha-sfenton-react-dash.local'
const ROUTE_QUERY_KEYS = ['path', 'route', 'view']

function parseRouteUrl(url: string) {
  return new URL(url, URL_PARSE_ORIGIN)
}

function isKnownRoute(path: string | undefined) {
  return Boolean(path && (AUXILIARY_ROUTE_PATHS.has(path) || DASHBOARD_ROUTES.some((route) => route.path === path)))
}

function routeSegment(segment: string | undefined) {
  if (!segment || segment === 'home' || segment === 'index.html') return undefined
  return isKnownRoute(segment) ? segment : undefined
}

function routePathFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const dashboardIndex = dashboardRouteHostIndex(parts)
  if (dashboardIndex >= 0) return routeSegment(parts[dashboardIndex + 1]) ?? DEFAULT_ROUTE_PATH

  return routeSegment(parts.at(-1))
}

function routePathFromValue(value: string | null) {
  if (!value) return undefined

  let decodedValue = value.trim()
  if (!decodedValue) return undefined


  try {
    decodedValue = decodeURIComponent(decodedValue)
  } catch {
    // Keep the raw value if it was not URI-encoded cleanly.
  }

  const withoutHash = decodedValue.split('#', 1)[0]
  const withoutSearch = withoutHash.split('?', 1)[0]
  if (isKnownRoute(withoutSearch)) return withoutSearch
  return routePathFromPathname(withoutSearch)
}

function isStaticAppPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const appIndex = parts.lastIndexOf('ha-sfenton-react-dash')
  return appIndex >= 0 && parts[appIndex + 1] === 'index.html'
}

function shouldUseQueryRoute(url: URL) {
  return isDashboardRouteHostPath(url.pathname) || isStaticAppPath(url.pathname)
}

function normalizedHash(hash: string | undefined) {
  if (!hash) return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

function relativeUrl(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`
}

export function routePathFromUrl(url: string | undefined) {
  if (!url) return DEFAULT_ROUTE_PATH
  const parsedUrl = parseRouteUrl(url)

  for (const key of ROUTE_QUERY_KEYS) {
    const queryRoute = routePathFromValue(parsedUrl.searchParams.get(key))
    if (queryRoute) return queryRoute
  }

  return routePathFromPathname(parsedUrl.pathname) ?? DEFAULT_ROUTE_PATH
}

export function routeUrl(path: string, currentUrl?: string, hash?: string) {
  const routePath = routePathFromValue(path) ?? DEFAULT_ROUTE_PATH

  if (!currentUrl) return `/at-a-glance/${routePath}${normalizedHash(hash)}`

  const parsedUrl = parseRouteUrl(currentUrl)
  if (!shouldUseQueryRoute(parsedUrl)) return `/at-a-glance/${routePath}${normalizedHash(hash)}`

  parsedUrl.searchParams.set('path', routePath)
  const nextHash = normalizedHash(hash)
  if (nextHash !== DAILY_REPORT_HASH) {
    for (const key of DAILY_REPORT_QUERY_KEYS) parsedUrl.searchParams.delete(key)
  }
  parsedUrl.hash = nextHash
  return relativeUrl(parsedUrl)
}

export { isDashboardPathVisibleToResident, visibleDashboardPathForResident } from './dashboardAccess'
