import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { RouteTransitionState } from '../components/shell/SmoothRouteOutlet'

const MODAL_TAB_EXIT_MS = 130
const MODAL_TAB_ENTER_START_MS = 16
const MODAL_TAB_ENTER_MS = 170
const MODAL_TAB_RETARGET_QUIET_MS = 120

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSmoothDisplayedModalTab<T extends string>(activeTab: T) {
  const [displayedTab, setDisplayedTab] = useState(activeTab)
  const [transitionState, setTransitionState] = useState<RouteTransitionState>('idle')
  const transitionStateRef = useRef<RouteTransitionState>('idle')
  const displayedTabRef = useRef(displayedTab)
  const pendingTabRef = useRef(activeTab)
  const lastPendingTabChangedAtRef = useRef(0)
  const startTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const enterStartTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)

  const setTrackedTransitionState = useCallback((nextState: RouteTransitionState) => {
    transitionStateRef.current = nextState
    setTransitionState(nextState)
  }, [])

  const clearTimers = useCallback(() => {
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current)
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    if (enterStartTimerRef.current !== null) window.clearTimeout(enterStartTimerRef.current)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    startTimerRef.current = null
    exitTimerRef.current = null
    enterStartTimerRef.current = null
    settleTimerRef.current = null
  }, [])

  useEffect(() => {
    displayedTabRef.current = displayedTab
  }, [displayedTab])

  useEffect(() => clearTimers, [clearTimers])

  useEffect(() => {
    if (pendingTabRef.current !== activeTab) {
      pendingTabRef.current = activeTab
      lastPendingTabChangedAtRef.current = Date.now()
    }

    const settleToIdle = () => {
      startTimerRef.current = window.setTimeout(() => {
        setTrackedTransitionState('idle')
        startTimerRef.current = null
      }, 0)
    }

    if (prefersReducedMotion()) {
      clearTimers()
      startTimerRef.current = window.setTimeout(() => {
        displayedTabRef.current = activeTab
        setDisplayedTab(activeTab)
        setTrackedTransitionState('idle')
        startTimerRef.current = null
      }, 0)
      return
    }

    if (transitionStateRef.current === 'exiting') return

    if (activeTab === displayedTabRef.current) {
      clearTimers()
      settleToIdle()
      return
    }

    const scheduleTargetEnter = () => {
      const nextTab = pendingTabRef.current
      displayedTabRef.current = nextTab
      setDisplayedTab(nextTab)
      setTrackedTransitionState('pre-entering')
      enterStartTimerRef.current = window.setTimeout(() => {
        setTrackedTransitionState('entering')
        settleTimerRef.current = window.setTimeout(() => {
          setTrackedTransitionState('idle')
          settleTimerRef.current = null
        }, MODAL_TAB_ENTER_MS)
        enterStartTimerRef.current = null
      }, MODAL_TAB_ENTER_START_MS)
    }

    const scheduleTargetEnterWhenQuiet = () => {
      const remainingQuietMs = MODAL_TAB_RETARGET_QUIET_MS - (Date.now() - lastPendingTabChangedAtRef.current)
      if (remainingQuietMs > 0) {
        exitTimerRef.current = window.setTimeout(scheduleTargetEnterWhenQuiet, remainingQuietMs)
        return
      }

      exitTimerRef.current = null
      scheduleTargetEnter()
    }

    if (transitionStateRef.current === 'pre-entering' || transitionStateRef.current === 'entering') {
      clearTimers()
      scheduleTargetEnter()
      return
    }

    clearTimers()

    startTimerRef.current = window.setTimeout(() => {
      setTrackedTransitionState('exiting')
      startTimerRef.current = null
    }, 0)

    exitTimerRef.current = window.setTimeout(scheduleTargetEnterWhenQuiet, MODAL_TAB_EXIT_MS)
  }, [activeTab, clearTimers, setTrackedTransitionState])

  return { displayedTab, transitionState }
}

export function useImmediateVisualTab<T extends string>(activeTab: T) {
  const [visualOverride, setVisualOverride] = useState<{ activeTab: T; tab: T } | undefined>()
  const visualActiveTab = visualOverride?.activeTab === activeTab ? visualOverride.tab : activeTab
  const setVisualTabNow = useCallback((tab: T) => {
    flushSync(() => setVisualOverride({ activeTab, tab }))
  }, [activeTab])
  const clearVisualTab = useCallback(() => setVisualOverride(undefined), [])

  return { clearVisualTab, setVisualTabNow, visualActiveTab }
}
