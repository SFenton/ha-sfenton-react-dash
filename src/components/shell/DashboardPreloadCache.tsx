import { memo, useEffect, useMemo, useState } from 'react'
import { AtAGlancePage } from '../../pages/AtAGlancePage'
import { DashboardViewPage } from '../../pages/DashboardViewPage'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { DASHBOARD_ROUTES } from '../../constants/routes'
import { ROOM_PAGE_CONFIGS } from '../../constants/roomPages'
import { THERMOSTAT_ROOMS } from '../../constants/portedDashboard'
import { GUEST_PRESENCE_SECURITY_HASH } from '../hass/GuestPresenceSecurity'
import styles from './DashboardPreloadCache.module.css'

const TARGETS_PER_FRAME = 4

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
  onComplete?: () => void
}

const noopNavigate = () => undefined

function preloadHashesEqual(previousHashes: string[], nextHashes: string[]) {
  return previousHashes.length === nextHashes.length && previousHashes.every((hash, index) => hash === nextHashes[index])
}

const PreloadRoute = memo(function PreloadRoute({ path, preloadHashes }: { path: string; preloadHashes: string[] }) {
  if (path === 'overview') {
    return <AtAGlancePage activePath="overview" onNavigate={noopNavigate} preload preloadHashes={preloadHashes} routeTransitionState="idle" withShell={false} />
  }

  return <DashboardViewPage activePath={path} onNavigate={noopNavigate} path={path} preload preloadHashes={preloadHashes} withShell={false} />
}, (previous, next) => previous.path === next.path && preloadHashesEqual(previous.preloadHashes, next.preloadHashes))

export function DashboardPreloadCache({ active, onComplete }: DashboardPreloadCacheProps) {
  const [started, setStarted] = useState(false)
  const [visibleTargetCount, setVisibleTargetCount] = useState(0)
  const routePaths = useMemo(() => uniqueValues(DASHBOARD_ROUTES.map((route) => route.path)), [])
  const targets = useMemo(() => [
    ...routePaths.map((path) => ({ path, type: 'route' as const })),
    ...MODAL_PRELOAD_TARGETS.map((target) => ({ ...target, type: 'modal' as const })),
  ], [routePaths])

  useEffect(() => {
    if (!active || started) return undefined
    const timer = window.setTimeout(() => setStarted(true), 0)
    return () => window.clearTimeout(timer)
  }, [active, started])

  useEffect(() => {
    if (!started || visibleTargetCount >= targets.length) return undefined

    const frame = window.requestAnimationFrame(() => {
      setVisibleTargetCount((current) => Math.min(targets.length, current + TARGETS_PER_FRAME))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [started, targets.length, visibleTargetCount])

  const completed = started && visibleTargetCount >= targets.length

  useEffect(() => {
    if (!completed) return
    onComplete?.()
  }, [completed, onComplete])

  if (!started) return null

  const visibleTargets = targets.slice(0, visibleTargetCount)
  const visibleRoutePaths = visibleTargets.filter((target) => target.type === 'route').map((target) => target.path)
  const visibleModalTargets = visibleTargets.filter((target) => target.type === 'modal')

  return (
    <div aria-hidden="true" className={styles.cache} data-dashboard-preload-cache="true" data-ready={completed ? 'true' : 'false'}>
      {visibleRoutePaths.map((path) => (
        <div className={styles.slot} data-preload-route={path} key={`route-${path}`}>
          <PreloadRoute path={path} preloadHashes={visibleModalTargets.filter((target) => target.path === path).map((target) => target.hash)} />
        </div>
      ))}
    </div>
  )
}
