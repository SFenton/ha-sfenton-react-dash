import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RouteTransitionState } from './components/shell/SmoothRouteOutlet'
import { AtAGlancePage } from './pages/AtAGlancePage'
import { DashboardViewPage } from './pages/DashboardViewPage'
import { AppShell } from './components/shell/AppShell'
import { BottomNav } from './components/shell/BottomNav'
import type { DashboardPageLoadingPhase } from './components/shell/DashboardPageLoading'
import { DashboardPreloadCache } from './components/shell/DashboardPreloadCache'
import { DashboardFloatingAction } from './components/shell/DashboardFloatingAction'
import { SmoothRouteOutlet } from './components/shell/SmoothRouteOutlet'
import { hasDashboardFloatingAction } from './components/shell/dashboardFloatingAction'
import { PRIMARY_NAV_ROUTES, routeUrl } from './constants/routes'
import { dashboardHref } from './hooks/dashboardLocation'
import { useDashboardRoute } from './hooks/useDashboardRoute'
import { useSmoothDisplayedRoute } from './hooks/useSmoothDisplayedRoute'

const INITIAL_PRELOAD_MIN_MS = 1000
const INITIAL_PRELOAD_EXIT_MS = 500
let initialPreloadCompleted = false

function pageForPath(path: string, activePath: string, onNavigate: (path: string) => void, transitionState: RouteTransitionState, loadingPhase?: DashboardPageLoadingPhase) {
  if (path === 'overview') {
    return <AtAGlancePage activePath={activePath} deferRouteContent loadingPhase={loadingPhase} onNavigate={onNavigate} routeTransitionState={transitionState} withShell={false} />
  }

  return <DashboardViewPage activePath={activePath} loadingPhase={loadingPhase} onNavigate={onNavigate} path={path} withShell={false} />
}

function floatingActionForPath(path: string, onNavigate: (path: string) => void): ReactNode {
  return hasDashboardFloatingAction(path) ? <DashboardFloatingAction key={path} onNavigate={onNavigate} path={path} /> : undefined
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
  const preloadStartedAtRef = useRef<number | null>(null)
  const routeLoadingPhase = preloadGatePhase === 'content' ? undefined : preloadGatePhase

  const handlePreloadComplete = useCallback(() => {
    setPreloadReady(true)
  }, [])

  useEffect(() => {
    preloadStartedAtRef.current ??= Date.now()
  }, [])

  useEffect(() => {
    if (!preloadReady || preloadGatePhase !== 'loading') return undefined
    const preloadStartedAt = preloadStartedAtRef.current ?? Date.now()
    preloadStartedAtRef.current = preloadStartedAt
    const remainingLoadingMs = Math.max(0, INITIAL_PRELOAD_MIN_MS - (Date.now() - preloadStartedAt))
    const timer = window.setTimeout(() => setPreloadGatePhase('exiting'), remainingLoadingMs)
    return () => window.clearTimeout(timer)
  }, [preloadGatePhase, preloadReady])

  useEffect(() => {
    if (preloadGatePhase !== 'exiting') return undefined
    const timer = window.setTimeout(() => {
      initialPreloadCompleted = true
      setPreloadGatePhase('content')
    }, INITIAL_PRELOAD_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [preloadGatePhase])

  const navigateToPath = (nextPath: string) => {
    navigate(routeUrl(nextPath, dashboardHref()))
  }

  return (
    <AppShell bottomNav={<BottomNav activePath={path} onNavigate={navigateToPath} />} chromeHidden={Boolean(routeLoadingPhase)} floatingAction={floatingActionForPath(displayedPath, navigateToPath)}>
      <SmoothRouteOutlet leadingChromeTransition={leadingChromeTransition} routePath={displayedPath} transitionState={transitionState}>
        {pageForPath(displayedPath, path, navigateToPath, transitionState, routeLoadingPhase)}
      </SmoothRouteOutlet>
      {!initialPreloadCompleted && <DashboardPreloadCache active onComplete={handlePreloadComplete} />}
    </AppShell>
  )
}

export default Dashboard
