import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RouteTransitionState } from './components/shell/SmoothRouteOutlet'
import { AtAGlancePage } from './pages/AtAGlancePage'
import { DashboardViewPage } from './pages/DashboardViewPage'
import { AppShell } from './components/shell/AppShell'
import { BottomNav } from './components/shell/BottomNav'
import { DashboardPageLoading, type DashboardPageLoadingPhase } from './components/shell/DashboardPageLoading'
import { DashboardPreloadCache } from './components/shell/DashboardPreloadCache'
import { DashboardFloatingAction } from './components/shell/DashboardFloatingAction'
import { useEverShelfInventoryControls, type EverShelfInventoryControls } from './components/hass/EverShelfInventoryControls'
import { SmoothRouteOutlet } from './components/shell/SmoothRouteOutlet'
import { hasDashboardFloatingAction } from './components/shell/dashboardFloatingAction'
import { HOME_CABINET_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH, PRIMARY_NAV_ROUTES, routeUrl } from './constants/routes'
import { dashboardHref } from './hooks/dashboardLocation'
import { useDashboardRoute } from './hooks/useDashboardRoute'
import { useSmoothDisplayedRoute } from './hooks/useSmoothDisplayedRoute'
import styles from './Dashboard.module.css'

const INITIAL_PRELOAD_MIN_MS = 1000
const INITIAL_PRELOAD_EXIT_MS = 500
const INITIAL_CONTENT_ENTER_MS = 170
const INITIAL_INVENTORY_GATE_TIMEOUT_MS = 10000
const INITIAL_INVENTORY_CONTENT_ENTER_DELAY_MS = 430
let initialPreloadCompleted = false

type InitialContentTransitionState = 'entering' | 'idle' | 'pre-entering'

const FOOD_SPACE_ROUTE_PATHS = new Set([
  HOME_CABINET_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
])

function pageForPath(path: string, activePath: string, onNavigate: (path: string) => void, transitionState: RouteTransitionState, inventoryControls: EverShelfInventoryControls, loadingPhase?: DashboardPageLoadingPhase, initialContentTransitionState: InitialContentTransitionState = 'idle') {
  if (path === 'overview') {
    return <AtAGlancePage activePath={activePath} deferRouteContent loadingPhase={loadingPhase} onNavigate={onNavigate} routeTransitionState={transitionState} withShell={false} />
  }

  return <DashboardViewPage activePath={activePath} initialContentTransitionState={initialContentTransitionState} inventoryControls={inventoryControls} loadingPhase={loadingPhase} onNavigate={onNavigate} path={path} withShell={false} />
}

function floatingActionForPath(path: string, onNavigate: (path: string) => void, inventoryControls: EverShelfInventoryControls): ReactNode {
  return hasDashboardFloatingAction(path) ? <DashboardFloatingAction inventoryControls={inventoryControls} key={path} onNavigate={onNavigate} path={path} /> : undefined
}

function routeUsesMenuChrome(path: string) {
  return PRIMARY_NAV_ROUTES.some((route) => route.path === path)
}

function Dashboard() {
  const { path, navigate } = useDashboardRoute()
  const { displayedPath, transitionSourcePath, transitionState } = useSmoothDisplayedRoute(path)
  const leadingChromeTransition = routeUsesMenuChrome(transitionSourcePath) === routeUsesMenuChrome(path) ? 'stable' : 'changing'
  const [preloadReady, setPreloadReady] = useState(initialPreloadCompleted)
  const [preloadGatePhase, setPreloadGatePhase] = useState<DashboardPageLoadingPhase | 'content'>(() => (initialPreloadCompleted ? 'content' : 'loading'))
  const [initialInventoryGateTimedOut, setInitialInventoryGateTimedOut] = useState(false)
  const [initialContentTransitionState, setInitialContentTransitionState] = useState<InitialContentTransitionState>(() => (initialPreloadCompleted ? 'idle' : 'pre-entering'))
  const contentEnterFrameRef = useRef<number | null>(null)
  const contentEnterSettleTimerRef = useRef<number | null>(null)
  const preloadStartedAtRef = useRef<number | null>(null)
  const routeLoadingPhase = preloadGatePhase === 'content' ? undefined : preloadGatePhase
  const inventoryControls = useEverShelfInventoryControls(displayedPath)
  const waitsForInitialInventory = !initialPreloadCompleted && FOOD_SPACE_ROUTE_PATHS.has(path)
  const usesInitialInventoryAppGate = Boolean(routeLoadingPhase && FOOD_SPACE_ROUTE_PATHS.has(displayedPath))
  const initialInventoryGateReady = !waitsForInitialInventory || inventoryControls.inventoryLoadPhase === 'content' || initialInventoryGateTimedOut
  const pageLoadingPhase = usesInitialInventoryAppGate ? undefined : routeLoadingPhase
  const pageInitialContentTransitionState = initialContentTransitionState

  const handlePreloadComplete = useCallback(() => {
    setPreloadReady(true)
  }, [])

  const clearInitialContentEnterTimers = useCallback(() => {
    if (contentEnterFrameRef.current !== null) window.cancelAnimationFrame(contentEnterFrameRef.current)
    if (contentEnterSettleTimerRef.current !== null) window.clearTimeout(contentEnterSettleTimerRef.current)
    contentEnterFrameRef.current = null
    contentEnterSettleTimerRef.current = null
  }, [])

  const startInitialContentEnter = useCallback(() => {
    clearInitialContentEnterTimers()
    setInitialContentTransitionState('pre-entering')
    contentEnterFrameRef.current = window.requestAnimationFrame(() => {
      contentEnterFrameRef.current = null
      setInitialContentTransitionState('entering')
      contentEnterSettleTimerRef.current = window.setTimeout(() => {
        contentEnterSettleTimerRef.current = null
        setInitialContentTransitionState('idle')
      }, INITIAL_CONTENT_ENTER_MS)
    })
  }, [clearInitialContentEnterTimers])

  useEffect(() => {
    preloadStartedAtRef.current ??= Date.now()
  }, [])

  useEffect(() => {
    return clearInitialContentEnterTimers
  }, [clearInitialContentEnterTimers])

  useEffect(() => {
    if (!preloadReady || preloadGatePhase !== 'loading' || !initialInventoryGateReady) return undefined
    const preloadStartedAt = preloadStartedAtRef.current ?? Date.now()
    preloadStartedAtRef.current = preloadStartedAt
    const remainingLoadingMs = Math.max(0, INITIAL_PRELOAD_MIN_MS - (Date.now() - preloadStartedAt))
    const timer = window.setTimeout(() => setPreloadGatePhase('exiting'), remainingLoadingMs)
    return () => window.clearTimeout(timer)
  }, [initialInventoryGateReady, initialInventoryGateTimedOut, inventoryControls.inventoryLoadPhase, preloadGatePhase, preloadReady, waitsForInitialInventory])

  useEffect(() => {
    if (!waitsForInitialInventory || preloadGatePhase !== 'loading') return undefined
    const timer = window.setTimeout(() => setInitialInventoryGateTimedOut(true), INITIAL_INVENTORY_GATE_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [preloadGatePhase, waitsForInitialInventory])

  useEffect(() => {
    if (preloadGatePhase !== 'exiting') return undefined
    const enterTimer = waitsForInitialInventory
      ? window.setTimeout(startInitialContentEnter, INITIAL_INVENTORY_CONTENT_ENTER_DELAY_MS)
      : null
    const timer = window.setTimeout(() => {
      initialPreloadCompleted = true
      if (!waitsForInitialInventory) startInitialContentEnter()
      setPreloadGatePhase('content')
    }, INITIAL_PRELOAD_EXIT_MS)
    return () => {
      if (enterTimer !== null) window.clearTimeout(enterTimer)
      window.clearTimeout(timer)
    }
  }, [preloadGatePhase, startInitialContentEnter, waitsForInitialInventory])

  const navigateToPath = (nextPath: string) => {
    navigate(routeUrl(nextPath, dashboardHref()))
  }

  return (
    <AppShell bottomNav={<BottomNav activePath={path} onNavigate={navigateToPath} />} chromeHidden={Boolean(routeLoadingPhase)} floatingAction={floatingActionForPath(displayedPath, navigateToPath, inventoryControls)}>
      <SmoothRouteOutlet leadingChromeTransition={leadingChromeTransition} routePath={displayedPath} transitionState={transitionState}>
        {pageForPath(displayedPath, path, navigateToPath, transitionState, inventoryControls, pageLoadingPhase, pageInitialContentTransitionState)}
      </SmoothRouteOutlet>
      {usesInitialInventoryAppGate && routeLoadingPhase && <DashboardPageLoading className={styles.initialAppLoader} phase={routeLoadingPhase} />}
      {!initialPreloadCompleted && <DashboardPreloadCache active onComplete={handlePreloadComplete} />}
    </AppShell>
  )
}

export default Dashboard
