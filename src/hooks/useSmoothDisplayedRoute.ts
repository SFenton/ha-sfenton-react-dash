import { useCallback, useEffect, useRef, useState } from 'react'
import type { RouteTransitionState } from '../components/shell/SmoothRouteOutlet'

const ROUTE_EXIT_MS = 130
const ROUTE_ENTER_START_MS = 16
const ROUTE_ENTER_MS = 170
const ROUTE_RETARGET_QUIET_MS = 120

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSmoothDisplayedRoute(activePath: string) {
  const [displayedPath, setDisplayedPath] = useState(activePath)
  const [transitionSourcePath, setTransitionSourcePath] = useState(activePath)
  const [transitionState, setTransitionState] = useState<RouteTransitionState>('idle')
  const transitionStateRef = useRef<RouteTransitionState>('idle')
  const displayedPathRef = useRef(displayedPath)
  const pendingPathRef = useRef(activePath)
  const lastPendingPathChangedAtRef = useRef(0)
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
    displayedPathRef.current = displayedPath
  }, [displayedPath])

  useEffect(() => {
    return clearTimers
  }, [clearTimers])

  useEffect(() => {
    if (pendingPathRef.current !== activePath) {
      pendingPathRef.current = activePath
      lastPendingPathChangedAtRef.current = Date.now()
    }

    const settleToIdle = (nextSourcePath: string) => {
      startTimerRef.current = window.setTimeout(() => {
        setTransitionSourcePath(nextSourcePath)
        setTrackedTransitionState('idle')
        startTimerRef.current = null
      }, 0)
    }

    if (prefersReducedMotion()) {
      clearTimers()
      startTimerRef.current = window.setTimeout(() => {
        displayedPathRef.current = activePath
        setDisplayedPath(activePath)
        setTransitionSourcePath(activePath)
        setTrackedTransitionState('idle')
        startTimerRef.current = null
      }, 0)
      return
    }

    if (transitionStateRef.current === 'exiting') return

    if (activePath === displayedPathRef.current) {
      clearTimers()
      settleToIdle(activePath)
      return
    }

    const scheduleTargetEnter = () => {
      const nextPath = pendingPathRef.current
      displayedPathRef.current = nextPath
      setDisplayedPath(nextPath)
      setTrackedTransitionState('pre-entering')
      enterStartTimerRef.current = window.setTimeout(() => {
        setTrackedTransitionState('entering')
        settleTimerRef.current = window.setTimeout(() => {
          setTransitionSourcePath(pendingPathRef.current)
          setTrackedTransitionState('idle')
          settleTimerRef.current = null
        }, ROUTE_ENTER_MS)
        enterStartTimerRef.current = null
      }, ROUTE_ENTER_START_MS)
    }

    const scheduleTargetEnterWhenQuiet = () => {
      const remainingQuietMs = ROUTE_RETARGET_QUIET_MS - (Date.now() - lastPendingPathChangedAtRef.current)
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

    const sourcePath = displayedPathRef.current
    startTimerRef.current = window.setTimeout(() => {
      setTransitionSourcePath(sourcePath)
      setTrackedTransitionState('exiting')
      startTimerRef.current = null
    }, 0)

    exitTimerRef.current = window.setTimeout(scheduleTargetEnterWhenQuiet, ROUTE_EXIT_MS)

  }, [activePath, clearTimers, setTrackedTransitionState])

  return { displayedPath, transitionSourcePath, transitionState }
}
