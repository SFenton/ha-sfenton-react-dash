import { useEffect, useRef, useState } from 'react'
import type { RouteTransitionState } from '../components/shell/SmoothRouteOutlet'
import { DASHBOARD_LOADING_EXIT_MS, DASHBOARD_MIN_LOADING_MS } from '../constants/loading'

const hydratedRouteKeys = new Set<string>()

export type DeferredRouteHydrationPhase = 'content' | 'loading' | 'loading-exiting'

interface DeferredRouteHydrationOptions {
  cacheKey: string
  coldContentDelayMs?: number
  enabled?: boolean
  heavyContentDelayMs?: number
  loadingExitMs?: number
  minLoadingMs?: number
  transitionState: RouteTransitionState
  warmHeavyDelayMs?: number
}

export function resetDeferredRouteHydrationCache() {
  hydratedRouteKeys.clear()
}

export function markDeferredRouteHydrated(cacheKey: string) {
  hydratedRouteKeys.add(cacheKey)
}

export function isDeferredRouteHydrated(cacheKey: string) {
  return hydratedRouteKeys.has(cacheKey)
}

export function useDeferredRouteHydration({
  cacheKey,
  coldContentDelayMs = 120,
  enabled = true,
  heavyContentDelayMs = 220,
  loadingExitMs = DASHBOARD_LOADING_EXIT_MS,
  minLoadingMs = DASHBOARD_MIN_LOADING_MS,
  transitionState,
  warmHeavyDelayMs = 90,
}: DeferredRouteHydrationOptions) {
  const [showContent, setShowContent] = useState(() => !enabled || hydratedRouteKeys.has(cacheKey))
  const [hydrateHeavyContent, setHydrateHeavyContent] = useState(() => !enabled)
  const [loadingPhase, setLoadingPhase] = useState<DeferredRouteHydrationPhase>(() => (!enabled || hydratedRouteKeys.has(cacheKey) ? 'content' : 'loading'))
  const loadingStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    const timers: number[] = []
    const schedule = (delay: number, action: () => void) => {
      timers.push(window.setTimeout(action, delay))
    }
    const clearTimers = () => timers.forEach((timer) => window.clearTimeout(timer))

    if (!enabled) {
      schedule(0, () => {
        setShowContent(true)
        setHydrateHeavyContent(true)
        setLoadingPhase('content')
        loadingStartedAtRef.current = null
      })
      return clearTimers
    }

    const alreadyHydrated = hydratedRouteKeys.has(cacheKey)
    if (transitionState !== 'idle') {
      schedule(0, () => {
        setHydrateHeavyContent(false)
        if (!alreadyHydrated) {
          loadingStartedAtRef.current ??= Date.now()
          setShowContent(false)
          setLoadingPhase('loading')
        }
      })
      return clearTimers
    }

    if (alreadyHydrated) {
      schedule(0, () => {
        loadingStartedAtRef.current = null
        setShowContent(true)
        setHydrateHeavyContent(false)
        setLoadingPhase('content')
      })
      schedule(warmHeavyDelayMs, () => {
        setHydrateHeavyContent(true)
      })
      return clearTimers
    }

    const loadingStartedAt = loadingStartedAtRef.current ?? Date.now()
    loadingStartedAtRef.current = loadingStartedAt
    const remainingLoadingMs = Math.max(0, minLoadingMs - (Date.now() - loadingStartedAt))
    const loadingExitDelay = Math.max(coldContentDelayMs, remainingLoadingMs)

    schedule(0, () => {
      setHydrateHeavyContent(false)
      setShowContent(false)
      setLoadingPhase('loading')
    })
    schedule(loadingExitDelay, () => {
      setLoadingPhase('loading-exiting')
    })
    schedule(loadingExitDelay + loadingExitMs, () => {
      hydratedRouteKeys.add(cacheKey)
      loadingStartedAtRef.current = null
      setShowContent(true)
      setLoadingPhase('content')
    })
    schedule(loadingExitDelay + loadingExitMs + heavyContentDelayMs, () => {
      setHydrateHeavyContent(true)
    })

    return clearTimers
  }, [cacheKey, coldContentDelayMs, enabled, heavyContentDelayMs, loadingExitMs, minLoadingMs, transitionState, warmHeavyDelayMs])

  return { hydrateHeavyContent, loadingPhase, showContent }
}
