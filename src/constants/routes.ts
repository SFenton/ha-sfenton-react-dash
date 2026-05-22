export interface DashboardRouteConfig {
  title: string
  path: string
  icon: string
  manualReview?: boolean
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
  { title: 'Thermostat', path: 'ecobee', icon: 'mdi:thermostat', manualReview: true },
  { title: 'Groceries', path: 'groceries', icon: 'mdi:cart' },
  { title: "Stephen's Chores", path: 'stephens-chores', icon: 'mdi:account-check' },
  { title: "Steph's Chores", path: 'stephs-chores', icon: 'mdi:account-check' },
  { title: 'Unassigned Chores', path: 'unassigned-chores', icon: 'mdi:account-question' },
  { title: 'Home Improvement Tasks', path: 'home-improvement-chores', icon: 'mdi:hammer-wrench' },
  { title: 'Vacuums', path: 'vacuums', icon: 'mdi:robot-vacuum' },
  { title: 'Guests Staying Over', path: 'guests-staying-over', icon: 'mdi:account-group' },
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

export function routePathFromUrl(url: string | undefined) {
  if (!url) return 'overview'
  const cleanUrl = url.split('#', 1)[0]
  const parts = cleanUrl.split('/').filter(Boolean)
  const atAGlanceIndex = parts.lastIndexOf('at-a-glance')
  if (atAGlanceIndex >= 0) return parts[atAGlanceIndex + 1] || 'overview'
  const lastPart = parts.at(-1)
  if (!lastPart || lastPart === 'home' || lastPart === 'index.html') return 'overview'
  return DASHBOARD_ROUTES.some((route) => route.path === lastPart) ? lastPart : 'overview'
}

export function routeUrl(path: string) {
  return `/at-a-glance/${path || 'overview'}`
}