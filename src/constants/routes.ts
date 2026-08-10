export interface DashboardRouteConfig {
  title: string
  path: string
  icon: string
  manualArticleId: string
  manualVisibleSectionNames?: readonly string[]
}

export const DAILY_REPORT_HASH = '#daily-report'
export const DAILY_REPORT_USER_QUERY_KEY = 'user'
export const DAILY_REPORT_TAB_QUERY_KEY = 'tab'
export const DAILY_REPORT_QUERY_KEYS = [DAILY_REPORT_USER_QUERY_KEY, DAILY_REPORT_TAB_QUERY_KEY] as const
export const APP_MANUAL_ROUTE_PATH = 'manual'
export const APP_MANUAL_SECTION_QUERY_KEY = 'manual-section'
export const APP_MANUAL_ARTICLE_QUERY_KEY = 'manual-article'
export const APP_MANUAL_TASK_SECTION_QUERY_KEY = 'manual-task-section'
export const APP_MANUAL_QUERY_KEYS = [APP_MANUAL_SECTION_QUERY_KEY, APP_MANUAL_ARTICLE_QUERY_KEY, APP_MANUAL_TASK_SECTION_QUERY_KEY] as const
export const HOME_GROCERY_LIST_ROUTE_PATH = 'grocery-list'
export const HOME_FOOD_ROUTE_PATH = 'food'
export const HOME_RECIPES_ROUTE_PATH = 'recipes'
export const HOME_ALL_FOOD_ROUTE_PATH = 'all-food'
export const HOME_PANTRY_ROUTE_PATH = 'pantry'
export const HOME_FRIDGE_ROUTE_PATH = 'fridge'
export const HOME_FREEZER_ROUTE_PATH = 'freezer'
export const HOME_SPICE_RACK_ROUTE_PATH = 'spice-rack'
export const HOME_CABINET_ROUTE_PATH = 'cabinet'

export const DASHBOARD_ROUTES: DashboardRouteConfig[] = [
  {
    title: 'Overview',
    path: 'overview',
    icon: 'mdi:home',
    manualArticleId: 'home-overview',
    manualVisibleSectionNames: ['Weather', 'Status chips', 'Quick Links', 'Guest Presence Security', 'Cameras', 'Rooms'],
  },
  {
    title: 'Security',
    path: 'security',
    icon: 'mdi:shield',
    manualArticleId: 'security-page-guide',
    manualVisibleSectionNames: ['Status chips', 'Security', 'Guest Presence Security', 'Cameras'],
  },
  {
    title: 'Chores',
    path: 'chores',
    icon: 'mdi:clipboard-list',
    manualArticleId: 'chores-page-guide',
    manualVisibleSectionNames: ['Quick Links', 'Past Due', 'Evening Tasks', 'Afternoon Tasks', 'Morning Tasks', 'Due Any Time Today', 'No Due Date', 'Upcoming'],
  },
  { title: 'Living Room', path: 'living-room', icon: 'mdi:sofa', manualArticleId: 'room-living-room', manualVisibleSectionNames: ['Header Summaries', 'Climate', 'Devices', 'Remote', 'Quick App Launch'] },
  { title: 'Guest Room', path: 'guest-room', icon: 'mdi:bed', manualArticleId: 'room-guest-room', manualVisibleSectionNames: ['Header Summaries', 'Climate'] },
  { title: 'Master Bedroom', path: 'master-bedroom', icon: 'mdi:bed-king', manualArticleId: 'room-master-bedroom', manualVisibleSectionNames: ['Header Summaries', 'SleepyPod', 'Media', 'Climate'] },
  { title: 'Gym', path: 'gym', icon: 'mdi:dumbbell', manualArticleId: 'room-gym', manualVisibleSectionNames: ['Header Summaries', 'Climate'] },
  { title: 'Hallway', path: 'hallway', icon: 'mdi:door-open', manualArticleId: 'room-hallway', manualVisibleSectionNames: ['Header Summaries', 'Nothing Here Yet!'] },
  { title: 'Office', path: 'office', icon: 'mdi:desktop-tower', manualArticleId: 'room-office', manualVisibleSectionNames: ['Header Summaries', 'Climate', 'Office PCs'] },
  { title: 'Kitchen', path: 'kitchen', icon: 'mdi:stove', manualArticleId: 'room-kitchen', manualVisibleSectionNames: ['Header Summaries', 'Groceries', 'Appliances', 'Climate'] },
  {
    title: 'Groceries',
    path: HOME_GROCERY_LIST_ROUTE_PATH,
    icon: 'mdi:cart',
    manualArticleId: 'grocery-list-page-guide',
    manualVisibleSectionNames: ['Grocery List'],
  },
  {
    title: 'Food & Recipes',
    path: HOME_FOOD_ROUTE_PATH,
    icon: 'mdi:food-fork-drink',
    manualArticleId: 'food-page-guide',
    manualVisibleSectionNames: ['Suggested Recipes', 'All Recipes', 'All Food', 'Food Spaces'],
  },
  {
    title: 'Recipes',
    path: HOME_RECIPES_ROUTE_PATH,
    icon: 'mdi:chef-hat',
    manualArticleId: 'recipes-page-guide',
    manualVisibleSectionNames: ['Recipes'],
  },
  {
    title: 'All Food',
    path: HOME_ALL_FOOD_ROUTE_PATH,
    icon: 'mdi:food-variant',
    manualArticleId: 'all-food-page-guide',
    manualVisibleSectionNames: ['All Food'],
  },
  {
    title: 'Pantry',
    path: HOME_PANTRY_ROUTE_PATH,
    icon: 'mdi:food-fork-drink',
    manualArticleId: 'pantry-page-guide',
    manualVisibleSectionNames: ['Pantry'],
  },
  {
    title: 'Fridge',
    path: HOME_FRIDGE_ROUTE_PATH,
    icon: 'mdi:fridge',
    manualArticleId: 'fridge-page-guide',
    manualVisibleSectionNames: ['Fridge'],
  },
  {
    title: 'Freezer',
    path: HOME_FREEZER_ROUTE_PATH,
    icon: 'mdi:snowflake',
    manualArticleId: 'freezer-page-guide',
    manualVisibleSectionNames: ['Freezer'],
  },
  {
    title: 'Spice Rack',
    path: HOME_SPICE_RACK_ROUTE_PATH,
    icon: 'mdi:shaker-outline',
    manualArticleId: 'spice-rack-page-guide',
    manualVisibleSectionNames: ['Spice Rack'],
  },
  {
    title: 'Cabinet',
    path: HOME_CABINET_ROUTE_PATH,
    icon: 'mdi:cupboard',
    manualArticleId: 'cabinet-page-guide',
    manualVisibleSectionNames: ['Cabinet'],
  },
  { title: 'Dining Room', path: 'dining-room', icon: 'mdi:silverware-fork-knife', manualArticleId: 'room-dining-room', manualVisibleSectionNames: ['Header Summaries', 'Climate'] },
  { title: 'Back Deck', path: 'back-deck', icon: 'mdi:grill', manualArticleId: 'room-back-deck', manualVisibleSectionNames: ['Header Summaries', 'Grill'] },
  { title: 'Music Room', path: 'music-room', icon: 'mdi:music', manualArticleId: 'room-music-room', manualVisibleSectionNames: ['Header Summaries', 'Climate', 'Devices'] },
  { title: 'Theater Room', path: 'theater-room', icon: 'mdi:movie-open', manualArticleId: 'room-theater-room', manualVisibleSectionNames: ['Header Summaries', 'Climate', 'Remote', 'Quick App Launch', 'Theater Room PCs', 'Devices'] },
  { title: 'Downstairs Hallway', path: 'downstairs-hallway', icon: 'mdi:stairs', manualArticleId: 'room-downstairs-hallway', manualVisibleSectionNames: ['Header Summaries', 'Nothing Here Yet!'] },
  { title: 'Garage', path: 'garage', icon: 'mdi:garage', manualArticleId: 'room-garage', manualVisibleSectionNames: ['Header Summaries', 'Appliances', 'Garage Doors'] },
  { title: 'Guest Bathroom', path: 'guest-bathroom', icon: 'mdi:shower', manualArticleId: 'room-guest-bathroom', manualVisibleSectionNames: ['Header Summaries', 'Climate'] },
  { title: 'Master Bathroom', path: 'master-bathroom', icon: 'mdi:bathtub', manualArticleId: 'room-master-bathroom', manualVisibleSectionNames: ['Header Summaries', 'Climate'] },
  {
    title: 'Mach-E',
    path: 'mach-e',
    icon: 'mdi:car-electric',
    manualArticleId: 'mach-e-page-guide',
    manualVisibleSectionNames: ['Charge Status', 'Doors', "Driver's Seat", 'Passenger Seat', 'Climate'],
  },
  {
    title: 'Admin',
    path: 'admin',
    icon: 'mdi:home-assistant',
    manualArticleId: 'admin-page-guide',
    manualVisibleSectionNames: ['Security Controls', 'Living Room Power Recovery', 'Relay Control Mode', 'Presence-Based Light Overrides', 'Show Specific Controls', 'Automatic Presence Setting Overrides'],
  },
  { title: 'Entryway', path: 'entryway', icon: 'mdi:door', manualArticleId: 'room-entryway', manualVisibleSectionNames: ['Header Summaries', 'Nothing Here Yet!'] },
  {
    title: 'Settings',
    path: 'settings',
    icon: 'mdi:cog',
    manualArticleId: 'settings-page-guide',
    manualVisibleSectionNames: ['App Manual', 'Admin Controls', 'Guest Controls', 'Vacation', 'To-Do', 'Mach-E', 'Home Assistant Settings'],
  },
  {
    title: 'App Manual',
    path: APP_MANUAL_ROUTE_PATH,
    icon: 'mdi:book-open-page-variant',
    manualArticleId: 'app-manual-page-guide',
    manualVisibleSectionNames: ['Search', 'Popular Questions', 'Browse the Manual', 'Section landings', 'Article guides', 'Status labels', 'Screenshots and related guides'],
  },
  {
    title: 'To-Do',
    path: 'to-do',
    icon: 'mdi:clipboard-list',
    manualArticleId: 'to-do-page-guide',
    manualVisibleSectionNames: ['Admin To-Do'],
  },
  {
    title: 'Thermostat',
    path: 'ecobee',
    icon: 'mdi:thermostat',
    manualArticleId: 'thermostat-page-guide',
    manualVisibleSectionNames: ['Whole Home', 'Open Contact Sensors', 'Rooms', 'Automation', 'Tracking'],
  },
  {
    title: 'Groceries',
    path: 'groceries',
    icon: 'mdi:cart',
    manualArticleId: 'groceries-page-guide',
    manualVisibleSectionNames: ['Grocery List'],
  },
  {
    title: "Stephen's Chores",
    path: 'stephens-chores',
    icon: 'mdi:account-check',
    manualArticleId: 'stephens-chores-page-guide',
    manualVisibleSectionNames: ['Past Due', 'Due Today', 'Upcoming', 'No Due Date'],
  },
  {
    title: "Steph's Chores",
    path: 'stephs-chores',
    icon: 'mdi:account-check',
    manualArticleId: 'stephs-chores-page-guide',
    manualVisibleSectionNames: ['Past Due', 'Due Today', 'Upcoming', 'No Due Date'],
  },
  {
    title: 'Unassigned Chores',
    path: 'unassigned-chores',
    icon: 'mdi:account-question',
    manualArticleId: 'unassigned-chores-page-guide',
    manualVisibleSectionNames: ['Past Due', 'Due Today', 'Upcoming', 'No Due Date'],
  },
  {
    title: 'Home Improvement Tasks',
    path: 'home-improvement-chores',
    icon: 'mdi:hammer-wrench',
    manualArticleId: 'home-improvement-chores-page-guide',
    manualVisibleSectionNames: ['Past Due', 'Due Today', 'Upcoming', 'No Due Date'],
  },
  {
    title: 'Vacuums',
    path: 'vacuums',
    icon: 'mdi:robot-vacuum',
    manualArticleId: 'vacuums-page-guide',
    manualVisibleSectionNames: ['Robot Vacuums', 'Auto-Clean'],
  },
  {
    title: 'Guests Staying Over',
    path: 'guests-staying-over',
    icon: 'mdi:account-group',
    manualArticleId: 'guest-controls-page-guide',
    manualVisibleSectionNames: ['Guest Controls'],
  },
  {
    title: 'Vacation',
    path: 'vacation',
    icon: 'mdi:airplane',
    manualArticleId: 'vacation-page-guide',
    manualVisibleSectionNames: ['Vacation Mode', 'Pre-Vacation Checklist', 'Vacation Dates'],
  },
  {
    title: 'Media',
    path: 'media',
    icon: 'mdi:remote',
    manualArticleId: 'media-page-guide',
    manualVisibleSectionNames: ['Living Room', 'Theater Room'],
  },
  {
    title: 'Custom Lights',
    path: 'custom-lights',
    icon: 'mdi:lightbulb-group',
    manualArticleId: 'custom-lights-page-guide',
    manualVisibleSectionNames: ['Front Yard', 'Manual control', 'Lighting Mode', 'Custom light controls', 'Reset All Lights'],
  },
]

export const PRIMARY_NAV_ROUTES = [
  { label: 'Home', path: 'overview', icon: 'mdi:home' },
  { label: 'Security', path: 'security', icon: 'mdi:shield' },
  { label: 'Climate', path: 'ecobee', icon: 'mdi:thermostat' },
  { label: 'Chores', path: 'chores', icon: 'mdi:clipboard-list' },
  { label: 'Settings', path: 'settings', icon: 'mdi:cog' },
]

const HOME_SUB_ROUTE_PATHS = new Set([
  'back-deck',
  'custom-lights',
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
  APP_MANUAL_ROUTE_PATH,
  'guests-staying-over',
  'mach-e',
  'to-do',
  'vacation',
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
  return Boolean(path && DASHBOARD_ROUTES.some((route) => route.path === path))
}

function routeSegment(segment: string | undefined) {
  if (!segment || segment === 'home' || segment === 'index.html') return undefined
  return isKnownRoute(segment) ? segment : undefined
}

function routePathFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const atAGlanceIndex = parts.lastIndexOf('at-a-glance')
  if (atAGlanceIndex >= 0) return routeSegment(parts[atAGlanceIndex + 1]) ?? DEFAULT_ROUTE_PATH

  const wrapperIndex = parts.lastIndexOf('sfenton-react-dash')
  if (wrapperIndex >= 0) return routeSegment(parts[wrapperIndex + 1]) ?? DEFAULT_ROUTE_PATH

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

function isDashboardRouteHostPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts.includes('sfenton-react-dash') || parts.includes('at-a-glance')
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
  if (routePath !== APP_MANUAL_ROUTE_PATH) {
    for (const key of APP_MANUAL_QUERY_KEYS) parsedUrl.searchParams.delete(key)
  }
  const nextHash = normalizedHash(hash)
  if (nextHash !== DAILY_REPORT_HASH) {
    for (const key of DAILY_REPORT_QUERY_KEYS) parsedUrl.searchParams.delete(key)
  }
  parsedUrl.hash = nextHash
  return relativeUrl(parsedUrl)
}