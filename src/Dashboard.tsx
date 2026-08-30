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
import { OptimisticActionStateBoundary } from './components/hass/OptimisticActionState'
import { useRecipeControls, type RecipeControls } from './components/hass/recipes/useRecipeControls'
import { SmoothRouteOutlet } from './components/shell/SmoothRouteOutlet'
import { hasDashboardFloatingAction } from './components/shell/dashboardFloatingAction'
import { MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS } from './constants/mediaRemotes'
import { HOME_ALL_FOOD_ROUTE_PATH, HOME_CABINET_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_RECIPES_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH, PRIMARY_NAV_ROUTES, routeUrl } from './constants/routes'
import { pageMeasureForPath } from './constants/pageLayout'
import { dashboardHref } from './hooks/dashboardLocation'
import { DASHBOARD_PAGE_LOAD_TIMEOUT_MS } from './constants/loading'
import { markDeferredRouteHydrated } from './hooks/useDeferredRouteHydration'
import { useDashboardRoute } from './hooks/useDashboardRoute'
import { useSmoothDisplayedRoute } from './hooks/useSmoothDisplayedRoute'
import { ModalAcceptanceHarness } from './test/ModalAcceptanceHarness'
import styles from './Dashboard.module.css'

const INITIAL_PRELOAD_MIN_MS = 1000
const INITIAL_PRELOAD_EXIT_MS = 500
const INITIAL_CONTENT_ENTER_MS = 170
const INITIAL_INVENTORY_CONTENT_ENTER_DELAY_MS = 430
let initialPreloadCompleted = false

type InitialContentTransitionState = 'entering' | 'idle' | 'pre-entering'

const FOOD_SPACE_ROUTE_PATHS = new Set([
  HOME_ALL_FOOD_ROUTE_PATH,
  HOME_CABINET_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
])

function pageForPath(path: string, activePath: string, onNavigate: (path: string) => void, onBack: (fallbackPath?: string) => void, transitionState: RouteTransitionState, inventoryControls: EverShelfInventoryControls, recipeControls: RecipeControls, appChromeHidden: boolean, onRecipesInitialResolved: () => void, recipesInitiallyAppGated: boolean, loadingPhase?: DashboardPageLoadingPhase, initialContentTransitionState: InitialContentTransitionState = 'idle') {
  if (path === 'overview') {
    return <AtAGlancePage activePath={activePath} deferRouteContent loadingPhase={loadingPhase} onNavigate={onNavigate} routeTransitionState={transitionState} withShell={false} />
  }

  return <DashboardViewPage activePath={activePath} appChromeHidden={appChromeHidden} initialContentTransitionState={initialContentTransitionState} inventoryControls={inventoryControls} loadingPhase={loadingPhase} onBack={onBack} onNavigate={onNavigate} onRecipesInitialResolved={onRecipesInitialResolved} path={path} recipeControls={recipeControls} recipesInitiallyAppGated={recipesInitiallyAppGated} withShell={false} />
}

function floatingActionForPath(path: string, inventoryControls: EverShelfInventoryControls, recipeControls: RecipeControls): ReactNode {
  return hasDashboardFloatingAction(path) ? <DashboardFloatingAction inventoryControls={inventoryControls} key={path} path={path} recipeControls={recipeControls} /> : undefined
}

function routeUsesMenuChrome(path: string) {
  return PRIMARY_NAV_ROUTES.some((route) => route.path === path)
}

function Dashboard() {
  const { path, navigate, navigateBack } = useDashboardRoute()
  const [initialRoute] = useState(() => ({
    path,
    preloadCompleted: initialPreloadCompleted,
  }))
  const { displayedPath, transitionSourcePath, transitionState } = useSmoothDisplayedRoute(path)
  const leadingChromeTransition = routeUsesMenuChrome(transitionSourcePath) === routeUsesMenuChrome(path) ? 'stable' : 'changing'
  const [preloadGatePhase, setPreloadGatePhase] = useState<DashboardPageLoadingPhase | 'content'>(() => (initialPreloadCompleted ? 'content' : 'loading'))
  const [initialDataGateTimedOut, setInitialDataGateTimedOut] = useState(false)
  const [initialRecipesResolved, setInitialRecipesResolved] = useState(false)
  const [initialContentTransitionState, setInitialContentTransitionState] = useState<InitialContentTransitionState>(() => (initialPreloadCompleted ? 'idle' : 'pre-entering'))
  const contentEnterFrameRef = useRef<number | null>(null)
  const contentEnterSettleTimerRef = useRef<number | null>(null)
  const preloadStartedAtRef = useRef<number | null>(null)
  const routeLoadingPhase = preloadGatePhase === 'content' ? undefined : preloadGatePhase
  const inventoryControls = useEverShelfInventoryControls(displayedPath, FOOD_SPACE_ROUTE_PATHS.has(displayedPath))
  const recipeControls = useRecipeControls(
    HOME_RECIPES_ROUTE_PATH,
    displayedPath === HOME_RECIPES_ROUTE_PATH,
  )
  const waitsForInitialInventory = !initialPreloadCompleted && FOOD_SPACE_ROUTE_PATHS.has(path)
  const waitsForInitialRecipes = !initialRoute.preloadCompleted
    && initialRoute.path === HOME_RECIPES_ROUTE_PATH
  const waitsForInitialData = waitsForInitialInventory || waitsForInitialRecipes
  const usesInitialDataAppGate = Boolean(
    routeLoadingPhase
    && (FOOD_SPACE_ROUTE_PATHS.has(displayedPath) || displayedPath === HOME_RECIPES_ROUTE_PATH),
  )
  const initialDataGateReady = (
    (!waitsForInitialInventory || inventoryControls.inventoryLoadPhase === 'content')
    && (!waitsForInitialRecipes || initialRecipesResolved)
  ) || initialDataGateTimedOut
  const pageLoadingPhase = usesInitialDataAppGate ? undefined : routeLoadingPhase
  const pageInitialContentTransitionState = initialContentTransitionState
  const modalAcceptanceHarness = import.meta.env.MODE === 'test'
    && new URLSearchParams(window.location.search).has('__modalAcceptance')

  const handleRecipesInitialResolved = useCallback(() => {
    setInitialRecipesResolved(true)
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
    if (preloadGatePhase !== 'loading' || !initialDataGateReady) return undefined
    const preloadStartedAt = preloadStartedAtRef.current ?? Date.now()
    preloadStartedAtRef.current = preloadStartedAt
    const remainingLoadingMs = Math.max(0, INITIAL_PRELOAD_MIN_MS - (Date.now() - preloadStartedAt))
    const timer = window.setTimeout(() => setPreloadGatePhase('exiting'), remainingLoadingMs)
    return () => window.clearTimeout(timer)
  }, [initialDataGateReady, preloadGatePhase])

  useEffect(() => {
    if (!waitsForInitialData || preloadGatePhase !== 'loading') return undefined
    const timer = window.setTimeout(() => setInitialDataGateTimedOut(true), DASHBOARD_PAGE_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [preloadGatePhase, waitsForInitialData])

  useEffect(() => {
    if (preloadGatePhase !== 'exiting') return undefined
    const enterTimer = waitsForInitialData
      ? window.setTimeout(startInitialContentEnter, INITIAL_INVENTORY_CONTENT_ENTER_DELAY_MS)
      : null
    const timer = window.setTimeout(() => {
      initialPreloadCompleted = true
      markDeferredRouteHydrated('home')
      if (!waitsForInitialData) startInitialContentEnter()
      setPreloadGatePhase('content')
    }, INITIAL_PRELOAD_EXIT_MS)
    return () => {
      if (enterTimer !== null) window.clearTimeout(enterTimer)
      window.clearTimeout(timer)
    }
  }, [preloadGatePhase, startInitialContentEnter, waitsForInitialData])

  const navigateToPath = (nextPath: string) => {
    navigate(routeUrl(nextPath, dashboardHref()))
  }

  if (modalAcceptanceHarness) return <ModalAcceptanceHarness />

  return (
    <AppShell activePath={path} bottomNav={<BottomNav activePath={path} onNavigate={navigateToPath} />} chromeHidden={Boolean(routeLoadingPhase)} floatingAction={floatingActionForPath(displayedPath, inventoryControls, recipeControls)} onNavigate={navigateToPath} pageMeasure={displayedPath === 'overview' ? 'dashboard' : pageMeasureForPath(displayedPath)}>
      <SmoothRouteOutlet leadingChromeTransition={leadingChromeTransition} routePath={displayedPath} transitionState={transitionState}>
        <OptimisticActionStateBoundary entityIds={MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS}>
          {pageForPath(displayedPath, path, navigateToPath, navigateBack, transitionState, inventoryControls, recipeControls, usesInitialDataAppGate, handleRecipesInitialResolved, waitsForInitialRecipes, pageLoadingPhase, pageInitialContentTransitionState)}
        </OptimisticActionStateBoundary>
      </SmoothRouteOutlet>
      {usesInitialDataAppGate && routeLoadingPhase && <DashboardPageLoading className={styles.initialAppLoader} placement="viewport" phase={routeLoadingPhase} />}
      {!initialPreloadCompleted && <DashboardPreloadCache active />}
    </AppShell>
  )
}

export default Dashboard
