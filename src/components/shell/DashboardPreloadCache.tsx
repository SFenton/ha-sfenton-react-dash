import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { DASHBOARD_ROUTES } from '../../constants/routes'
import { ROOM_PAGE_CONFIGS } from '../../constants/roomPages'
import { THERMOSTAT_ROOMS } from '../../constants/portedDashboard'
import { GUEST_PRESENCE_SECURITY_HASH } from '../hass/GuestPresenceSecurity'
import styles from './DashboardPreloadCache.module.css'

const HOME_PRELOAD_HASHES = [
  '#lights-overview',
  '#security-system',
  '#climate-overview',
  '#occupancy-overview',
  '#contact-sensors-overview',
  '#aqi-overview',
  '#chores-preview',
  '#settings-preview',
  GUEST_PRESENCE_SECURITY_HASH,
  ...CAMERA_ITEMS.map((camera) => camera.hash),
]

const SECURITY_PRELOAD_HASHES = [
  '#security-system',
  '#contact-sensors-overview',
  GUEST_PRESENCE_SECURITY_HASH,
  ...CAMERA_ITEMS.map((camera) => camera.hash),
]

const ADMIN_PRELOAD_HASHES = ['#presence-based-overrides', '#presence-based-overrides-auto']
const MEDIA_PRELOAD_HASHES = ['#living-room-shield', '#theater-room-shield']
const THERMOSTAT_PRELOAD_HASHES = [
  '#thermostat-controls',
  '#thermostat-rooms',
  '#thermostat-automation',
  '#thermostat-tracking',
  '#predictive-comfort',
  ...THERMOSTAT_ROOMS.map((room) => `#${room.title.toLowerCase().replaceAll(' ', '-')}`),
]

function uniqueValues(values: (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

const ROOM_MODAL_TARGETS = Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => {
  const hashes = uniqueValues([
    ...room.overviewCards.map((card) => card.hash),
    ...room.sourceSections.flatMap((section) => section.cards.map((card) => card.hash)),
  ])
  return hashes.map((hash) => ({ hash, path: room.path }))
})

const MODAL_PRELOAD_TARGETS = [
  ...HOME_PRELOAD_HASHES.map((hash) => ({ hash, path: 'overview' })),
  ...SECURITY_PRELOAD_HASHES.map((hash) => ({ hash, path: 'security' })),
  ...ADMIN_PRELOAD_HASHES.map((hash) => ({ hash, path: 'admin' })),
  ...MEDIA_PRELOAD_HASHES.map((hash) => ({ hash, path: 'media' })),
  ...THERMOSTAT_PRELOAD_HASHES.map((hash) => ({ hash, path: 'ecobee' })),
  ...ROOM_MODAL_TARGETS,
]

interface DashboardPreloadCacheProps {
  active: boolean
}

const ROUTE_PATHS = uniqueValues(DASHBOARD_ROUTES.map((route) => route.path))

export function DashboardPreloadCache({ active }: DashboardPreloadCacheProps) {
  if (!active) return null
  return (
    <div aria-hidden="true" className={styles.cache} data-dashboard-preload-cache="true" data-ready="true">
      {ROUTE_PATHS.map((path) => (
        <div className={styles.slot} data-preload-route={path} key={`route-${path}`}>
          <div className={styles.routeGeometry} data-preload-geometry="route" />
          {MODAL_PRELOAD_TARGETS.filter((target) => target.path === path).map((target) => (
            <div
              className={styles.modalGeometry}
              data-preload-geometry="modal"
              data-preload-modal={`${target.path}${target.hash}`}
              key={`${target.path}${target.hash}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
