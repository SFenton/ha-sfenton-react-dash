import { useEffect, useRef, useState } from 'react'
import type { RouteTransitionState } from '../components/shell/SmoothRouteOutlet'

const ROUTE_EXIT_MS = 130
const ROUTE_ENTER_START_MS = 16

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSmoothDisplayedRoute(activePath: string) {
  const [displayedPath, setDisplayedPath] = useState(activePath)
  const [transitionSourcePath, setTransitionSourcePath] = useState(activePath)
  const [transitionState, setTransitionState] = useState<RouteTransitionState>('idle')
  const displayedPathRef = useRef(displayedPath)
  const startTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const enterStartTimerRef = useRef<number | null>(null)

  useEffect(() => {
    displayedPathRef.current = displayedPath
  }, [displayedPath])

  useEffect(() => {
    const clearTimers = () => {
      if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current)
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
      if (enterStartTimerRef.current !== null) window.clearTimeout(enterStartTimerRef.current)
      startTimerRef.current = null
      exitTimerRef.current = null
      enterStartTimerRef.current = null
    }

    clearTimers()

    if (activePath === displayedPathRef.current) {
      startTimerRef.current = window.setTimeout(() => {
        setTransitionSourcePath(activePath)
        setTransitionState('idle')
        startTimerRef.current = null
      }, 0)
      return clearTimers
    }

    if (prefersReducedMotion()) {
      startTimerRef.current = window.setTimeout(() => {
        displayedPathRef.current = activePath
        setDisplayedPath(activePath)
        setTransitionSourcePath(activePath)
        setTransitionState('idle')
        startTimerRef.current = null
      }, 0)
      return clearTimers
    }

    startTimerRef.current = window.setTimeout(() => {
      setTransitionSourcePath(displayedPathRef.current)
      setTransitionState('exiting')
      startTimerRef.current = null
    }, 0)

    exitTimerRef.current = window.setTimeout(() => {
      setDisplayedPath(activePath)
      displayedPathRef.current = activePath
      setTransitionState('pre-entering')
      enterStartTimerRef.current = window.setTimeout(() => {
        setTransitionState('entering')
        enterStartTimerRef.current = null
      }, ROUTE_ENTER_START_MS)
      exitTimerRef.current = null
    }, ROUTE_EXIT_MS)

    return clearTimers
  }, [activePath])

  return { displayedPath, transitionSourcePath, transitionState }
}
