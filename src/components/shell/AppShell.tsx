import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode, type TransitionEvent } from 'react'
import { DailyReportModal } from '../hass/DailyReportModal'
import { useAdaptiveNavigationState } from '../../hooks/useAdaptiveNavigationLayout'
import { useDashboardViewport } from '../../hooks/useDashboardViewport'
import type { NavigationLayout } from '../../constants/navigationLayout'
import type { PageMeasure } from '../../constants/pageLayout'
import { fallbackBackPathForRoute } from '../../constants/routes'
import { MaterialIcon } from '../core/Icon'
import { SHELL_COPY_KEYS, SHELL_COPY_NAMESPACE, useCopy } from '../../i18n'
import { AdaptiveNavigation, type DuoNavigationRouteCount } from './AdaptiveNavigation'
import { DuoControlLaneContext } from './DuoControlLaneContext'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'
import { NavigationLayoutContext } from './NavigationLayoutContext'
import type { RouteTransitionState } from './SmoothRouteOutlet'
import styles from './AppShell.module.css'

interface AppShellProps {
  activePath?: string
  children: ReactNode
  displayedPath?: string
  bottomNav: ReactNode
  chromeHidden?: boolean
  floatingAction?: ReactNode
  onNavigate: (path: string) => void
  pageMeasure?: PageMeasure
  routeActionsReady?: boolean
  routeTransitionState?: RouteTransitionState
}

type DuoRouteActionPhase = 'entering' | 'exiting' | 'resizing' | 'visible'

const DUO_ROOT_PROFILE_RESERVATION = 51
const DUO_BACK_PROFILE_RESERVATION = 108
const DUO_HEADER_CLEARANCE = 3
const DUO_NAVIGATION_HEIGHTS: Record<DuoNavigationRouteCount, number> = {
  1: 100,
  2: 146,
  3: 192,
  5: 238,
}
const DUO_ACTION_STACK_GAP = 12
const DUO_ROUTE_ACTION_RESIZE_FALLBACK_MS = 300
const DUO_ROUTE_ACTION_ENTER_MS = 160

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function AppShell({
  activePath = 'overview',
  children,
  displayedPath = activePath,
  bottomNav,
  chromeHidden = false,
  floatingAction,
  onNavigate,
  pageMeasure = 'dashboard',
  routeActionsReady = true,
  routeTransitionState = 'idle',
}: AppShellProps) {
  useDashboardViewport()
  const copy = useCopy(SHELL_COPY_NAMESPACE)
  const { duoDisplayMode, navigationLayout } = useAdaptiveNavigationState()
  const [duoControlLane, setDuoControlLane] = useState<HTMLDivElement | null>(null)
  const [duoBaseNavigationRouteCount, setDuoBaseNavigationRouteCount] = useState<DuoNavigationRouteCount>(5)
  const [duoNavigationExpanded, setDuoNavigationExpanded] = useState(false)
  const [duoActionGapTight, setDuoActionGapTight] = useState(false)
  const [duoRouteActionPhase, setDuoRouteActionPhase] = useState<DuoRouteActionPhase>('visible')
  const duoLaneRef = useRef<HTMLDivElement>(null)
  const floatingActionRef = useRef<HTMLDivElement>(null)
  const focusedNavigationRef = useRef<NavigationLayout | null>(null)
  const previousNavigationLayoutRef = useRef(navigationLayout)
  const duoRouteActionPhaseRef = useRef<DuoRouteActionPhase>('visible')
  const duoRouteActionTimerRef = useRef<number | null>(null)
  const duoRouteActionEpochRef = useRef(0)
  const duoRouteActionResizeScheduledEpochRef = useRef<number | null>(null)
  const previousDisplayedPathRef = useRef(displayedPath)
  const duoNavigationRouteCount = duoNavigationExpanded ? 5 : duoBaseNavigationRouteCount
  const duoLaneOverflow = duoBaseNavigationRouteCount < 5
  const duoActionsCompressed = duoLaneOverflow && duoNavigationExpanded

  const shellClassName = !chromeHidden ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell
  const trackNavigationFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target
    focusedNavigationRef.current = target.closest('[data-adaptive-navigation="duo"]')
      ? 'duo'
      : target.closest('[data-adaptive-navigation="rail"]')
        ? 'rail'
      : target.closest('[data-adaptive-navigation="bottom"]')
        ? 'bottom'
        : target.closest('[aria-controls="dashboard-navigation-drawer"]')
          ? navigationLayout
          : null
  }

  const clearDuoRouteActionTimer = useCallback(() => {
    if (duoRouteActionTimerRef.current === null) return
    window.clearTimeout(duoRouteActionTimerRef.current)
    duoRouteActionTimerRef.current = null
  }, [])

  const setTrackedDuoRouteActionPhase = useCallback((phase: DuoRouteActionPhase) => {
    duoRouteActionPhaseRef.current = phase
    setDuoRouteActionPhase(phase)
  }, [])

  const beginDuoRouteActionEnter = useCallback(() => {
    if (
      !routeActionsReady
      || (duoRouteActionPhaseRef.current !== 'resizing' && duoRouteActionPhaseRef.current !== 'exiting')
    ) return
    clearDuoRouteActionTimer()
    duoRouteActionResizeScheduledEpochRef.current = null
    const epoch = duoRouteActionEpochRef.current
    setTrackedDuoRouteActionPhase('entering')
    duoRouteActionTimerRef.current = window.setTimeout(() => {
      if (duoRouteActionEpochRef.current !== epoch || duoRouteActionPhaseRef.current !== 'entering') return
      duoRouteActionTimerRef.current = null
      setTrackedDuoRouteActionPhase('visible')
    }, DUO_ROUTE_ACTION_ENTER_MS)
  }, [clearDuoRouteActionTimer, routeActionsReady, setTrackedDuoRouteActionPhase])

  const scheduleDuoRouteActionEnter = useCallback((delayMs: number) => {
    if (!routeActionsReady || duoRouteActionPhaseRef.current !== 'resizing') return
    const epoch = duoRouteActionEpochRef.current
    if (duoRouteActionResizeScheduledEpochRef.current === epoch) return
    duoRouteActionResizeScheduledEpochRef.current = epoch
    clearDuoRouteActionTimer()
    duoRouteActionTimerRef.current = window.setTimeout(() => {
      if (duoRouteActionEpochRef.current === epoch) beginDuoRouteActionEnter()
    }, delayMs)
  }, [beginDuoRouteActionEnter, clearDuoRouteActionTimer, routeActionsReady])

  useLayoutEffect(() => {
    const displayedPathChanged = previousDisplayedPathRef.current !== displayedPath
    previousDisplayedPathRef.current = displayedPath
    const schedulePhase = (phase: DuoRouteActionPhase, collapseNavigation = false) => {
      const epoch = duoRouteActionEpochRef.current + 1
      duoRouteActionEpochRef.current = epoch
      duoRouteActionResizeScheduledEpochRef.current = null
      clearDuoRouteActionTimer()
      queueMicrotask(() => {
        if (duoRouteActionEpochRef.current !== epoch) return
        setTrackedDuoRouteActionPhase(phase)
        if (collapseNavigation) setDuoNavigationExpanded(false)
      })
    }
    if (navigationLayout !== 'duo' || prefersReducedMotion()) {
      const collapseNavigation = navigationLayout === 'duo' && displayedPathChanged
      if (duoRouteActionPhaseRef.current !== 'visible' || collapseNavigation) {
        schedulePhase('visible', collapseNavigation)
      }
      return
    }

    if (routeTransitionState === 'exiting') {
      schedulePhase('exiting')
      return
    }

    if (routeTransitionState === 'pre-entering') {
      schedulePhase('resizing', true)
      return
    }

    if (routeTransitionState === 'idle' && duoRouteActionPhaseRef.current === 'exiting') {
      beginDuoRouteActionEnter()
    }
  }, [
    beginDuoRouteActionEnter,
    clearDuoRouteActionTimer,
    displayedPath,
    navigationLayout,
    routeTransitionState,
    routeActionsReady,
    setTrackedDuoRouteActionPhase,
  ])

  useEffect(() => clearDuoRouteActionTimer, [clearDuoRouteActionTimer])

  useEffect(() => {
    const previousLayout = previousNavigationLayoutRef.current
    previousNavigationLayoutRef.current = navigationLayout
    if (previousLayout === navigationLayout || focusedNavigationRef.current !== previousLayout) return

    const selector = navigationLayout === 'rail' || navigationLayout === 'duo'
      ? `[data-adaptive-navigation="${navigationLayout}"] button[aria-current="page"]`
      : navigationLayout === 'bottom'
        ? '[data-adaptive-navigation="bottom"] button[aria-current="page"]'
        : 'button[aria-label="Open navigation menu"]'
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true }))
  }, [navigationLayout])

  useLayoutEffect(() => {
    if (navigationLayout !== 'duo') {
      if (duoBaseNavigationRouteCount === 5 && !duoNavigationExpanded && !duoActionGapTight) return undefined
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled) return
        setDuoBaseNavigationRouteCount(5)
        setDuoNavigationExpanded(false)
        setDuoActionGapTight(false)
      })
      return () => {
        cancelled = true
      }
    }

    const lane = duoLaneRef.current
    const actionDock = floatingActionRef.current
    if (!lane || !actionDock) return undefined

    const measure = () => {
      if (!routeActionsReady) return
      const auxiliaryActions = actionDock.querySelector<HTMLElement>('[data-duo-auxiliary-actions="true"]')
      const actionContainers = auxiliaryActions
        ? [...new Set(Array.from(
            auxiliaryActions.querySelectorAll<HTMLButtonElement>('button'),
            (button) => {
              if (button.getClientRects().length === 0) return null
              const routeActions = button.closest<HTMLElement>('[data-duo-route-actions="true"]')
              const containerParent = routeActions ?? auxiliaryActions
              let container: HTMLElement = button
              while (container.parentElement && container.parentElement !== containerParent) container = container.parentElement
              return container
            },
          ).filter((container): container is HTMLElement => container !== null))]
        : []
      const actionCount = actionContainers.length
      actionContainers.forEach((element, index) => {
        element.style.setProperty('--duo-collapse-y', `${(actionCount - index - 1) * 52}px`)
      })
      const actionHeight = actionCount > 0 ? actionCount * 48 + (actionCount - 1) * 4 : 0
      const laneRect = lane.getBoundingClientRect()
      const isBackPage = Boolean(fallbackBackPathForRoute(displayedPath))
      const profileRect = document.querySelector<HTMLElement>('[data-app-header-profile="true"]')?.getBoundingClientRect() ?? null
      const reservedHeaderHeight = profileRect
        ? Math.max(0, profileRect.bottom - laneRect.top) + DUO_HEADER_CLEARANCE
        : (isBackPage ? DUO_BACK_PROFILE_RESERVATION : DUO_ROOT_PROFILE_RESERVATION)
      const availableHeight = laneRect.height - reservedHeaderHeight
      const navigationBudget = availableHeight - actionHeight - DUO_ACTION_STACK_GAP
      const nextRouteCount: DuoNavigationRouteCount = navigationBudget >= DUO_NAVIGATION_HEIGHTS[5]
        ? 5
        : navigationBudget >= DUO_NAVIGATION_HEIGHTS[3]
          ? 3
          : navigationBudget >= DUO_NAVIGATION_HEIGHTS[2]
            ? 2
            : 1
      const minimumHeightWithDefaultGap = actionHeight + DUO_ACTION_STACK_GAP + DUO_NAVIGATION_HEIGHTS[1]
      const gapTight = nextRouteCount === 1 && minimumHeightWithDefaultGap > availableHeight
      setDuoBaseNavigationRouteCount(nextRouteCount)
      setDuoActionGapTight(gapTight)
      if (nextRouteCount === 5) setDuoNavigationExpanded(false)
      if (
        duoRouteActionPhaseRef.current === 'resizing'
        && routeActionsReady
        && duoRouteActionResizeScheduledEpochRef.current !== duoRouteActionEpochRef.current
      ) {
        scheduleDuoRouteActionEnter(duoNavigationRouteCount === nextRouteCount ? 16 : DUO_ROUTE_ACTION_RESIZE_FALLBACK_MS)
      }
    }

    measure()
    // Recheck after the route-owned header reaches its final fixed position.
    const staleFrameId = typeof requestAnimationFrame === 'undefined' ? null : requestAnimationFrame(measure)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(lane)
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure)
    mutationObserver?.observe(actionDock, { childList: true, subtree: true })
    const routeOutlet = lane.parentElement?.querySelector<HTMLElement>('[data-route-transition-state]')
    const routeObserver = typeof MutationObserver === 'undefined' || !routeOutlet ? null : new MutationObserver(measure)
    if (routeOutlet && routeObserver) {
      routeObserver.observe(routeOutlet, {
        attributeFilter: ['data-route-path', 'data-route-transition-state'],
        attributes: true,
      })
    }
    window.addEventListener('resize', measure)
    return () => {
      if (staleFrameId !== null) cancelAnimationFrame(staleFrameId)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      routeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [displayedPath, duoActionGapTight, duoBaseNavigationRouteCount, duoControlLane, duoNavigationExpanded, duoNavigationRouteCount, navigationLayout, routeActionsReady, routeTransitionState, scheduleDuoRouteActionEnter])
  const expandDuoNavigation = () => {
    setDuoNavigationExpanded(true)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-duo-actions-toggle="true"]')?.focus({ preventScroll: true }))
  }
  const showDuoActions = () => {
    setDuoNavigationExpanded(false)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-duo-expand="true"]')?.focus({ preventScroll: true }))
  }
  const duoRouteActionsHidden = duoRouteActionPhase !== 'visible'
  const handleDuoLaneTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    const target = event.target
    if (
      !(target instanceof HTMLElement)
      || target.dataset.adaptiveNavigation !== 'duo'
      || event.propertyName !== 'height'
    ) return
    beginDuoRouteActionEnter()
  }

  return (
    <NavigationLayoutContext.Provider value={navigationLayout}>
      <DuoControlLaneContext.Provider value={duoControlLane}>
        <div className={shellClassName} data-app-shell="true" data-duo-display={duoDisplayMode ?? undefined} data-navigation-layout={navigationLayout} data-page-measure={pageMeasure} data-route-displayed-path={displayedPath} data-route-transition-state={routeTransitionState} onFocusCapture={trackNavigationFocus}>
          <div className={styles.backdrop} aria-hidden="true" />
          <div className={styles.scrim} aria-hidden="true" />
          {!chromeHidden && (
            <div
              className={styles.duoLane}
              data-duo-action-gap={duoActionGapTight ? 'tight' : 'default'}
              data-duo-navigation-expanded={duoNavigationExpanded ? 'true' : 'false'}
              data-duo-navigation-routes={duoNavigationRouteCount}
              data-duo-control-lane="true"
              data-duo-overflow={duoLaneOverflow ? 'true' : 'false'}
              onTransitionEnd={handleDuoLaneTransitionEnd}
              ref={duoLaneRef}
            >
              <AdaptiveNavigation
                activePath={activePath}
                duoRouteCount={duoNavigationRouteCount}
                onDuoExpand={expandDuoNavigation}
                onNavigate={onNavigate}
              />
              <div
                className={styles.floatingAction}
                data-duo-actions-compressed={duoActionsCompressed ? 'true' : 'false'}
                data-floating-action-dock="true"
                ref={floatingActionRef}
              >
                <div
                  aria-hidden={duoActionsCompressed || undefined}
                  className={styles.duoAuxiliaryActions}
                  data-duo-auxiliary-actions="true"
                  inert={duoActionsCompressed ? true : undefined}
                >
                  <div
                    aria-hidden={duoRouteActionsHidden || undefined}
                    className={styles.duoRouteActions}
                    data-duo-route-action-phase={duoRouteActionPhase}
                    data-duo-route-actions="true"
                    inert={duoRouteActionsHidden ? true : undefined}
                  >
                    <div className={styles.duoStatusSlot} data-duo-status-slot="true" ref={setDuoControlLane} />
                    {floatingAction}
                  </div>
                  <div className={styles.duoQuickLinksSlot} data-duo-quick-links="true">
                    <GlobalQuickLinksAction onNavigate={onNavigate} />
                  </div>
                </div>
                <button
                  aria-expanded={false}
                  aria-hidden={!duoActionsCompressed}
                  aria-label={copy(SHELL_COPY_KEYS.navigation.showPageActions)}
                  className={styles.duoActionsToggle}
                  data-action-kind="toggle"
                  data-duo-actions-toggle="true"
                  onClick={showDuoActions}
                  tabIndex={duoActionsCompressed ? 0 : -1}
                  type="button"
                >
                  <MaterialIcon name="mdi:dots-horizontal" size={28} />
                </button>
              </div>
            </div>
          )}
          <div className={styles.content}>{children}</div>
          {!chromeHidden && bottomNav}
          <DailyReportModal />
        </div>
      </DuoControlLaneContext.Provider>
    </NavigationLayoutContext.Provider>
  )
}
