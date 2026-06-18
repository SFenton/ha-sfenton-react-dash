export interface DashboardRouteConfig {
  title: string
  path: string
  icon: string
}

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
  { title: 'Entryway', path: 'entryway', icon: 'mdi:door' },
  { title: 'Settings', path: 'settings', icon: 'mdi:cog' },
  { title: 'To-Do', path: 'to-do', icon: 'mdi:clipboard-list' },
  { title: 'Thermostat', path: 'ecobee', icon: 'mdi:thermostat' },
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

const SETTINGS_SUB_ROUTE_PATHS = new Set([
  'admin',
  'guests-staying-over',
  'mach-e',
  'to-do',
  'vacation',
])

export function primaryNavPathForRoute(path: string | undefined) {
  if (!path) return 'overview'
  if (HOME_SUB_ROUTE_PATHS.has(path)) return 'overview'
  if (path === 'groceries' || path.endsWith('-chores')) return 'chores'
  if (SETTINGS_SUB_ROUTE_PATHS.has(path)) return 'settings'
  return path
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
  parsedUrl.hash = normalizedHash(hash)
  return relativeUrl(parsedUrl)
}