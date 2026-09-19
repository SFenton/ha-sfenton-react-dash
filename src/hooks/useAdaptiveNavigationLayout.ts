import { useSyncExternalStore } from 'react'
import {
  duoDisplayModeForEnvironment,
  usesDuoNavigationLayout,
  type DuoDisplayMode,
} from '../constants/duoLayout'
import {
  NAVIGATION_RAIL_QUERY,
  NAVIGATION_SHORT_LANDSCAPE_QUERY,
  NAVIGATION_WIDE_QUERY,
  navigationLayoutFromMatches,
  type NavigationLayout,
} from '../constants/navigationLayout'

const NAVIGATION_LAYOUT_QUERIES = [
  NAVIGATION_RAIL_QUERY,
  NAVIGATION_SHORT_LANDSCAPE_QUERY,
  NAVIGATION_WIDE_QUERY,
] as const

interface DevicePosture extends EventTarget {
  type?: string
}

interface NavigatorWithDevicePosture extends Navigator {
  devicePosture?: DevicePosture
}

interface WindowWithViewportSegments extends Window {
  viewport?: {
    segments?: readonly unknown[]
  }
}

export interface AdaptiveNavigationState {
  duoDisplayMode: DuoDisplayMode | null
  navigationLayout: NavigationLayout
}

function readDuoPreviewMode(): DuoDisplayMode | 'auto' | null {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') return null
  const preview = new URLSearchParams(window.location.search).get('duo')
  return preview === 'auto' || preview === 'folded' || preview === 'inner' || preview === 'outer'
    ? preview
    : null
}

export function readDuoDisplayMode(): DuoDisplayMode | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null
  const posture = (navigator as NavigatorWithDevicePosture).devicePosture
  const segments = (window as WindowWithViewportSegments).viewport?.segments
  return duoDisplayModeForEnvironment({
    devicePosture: posture?.type,
    maxTouchPoints: navigator.maxTouchPoints,
    preview: readDuoPreviewMode(),
    screenHeight: window.screen?.height ?? window.innerHeight,
    screenWidth: window.screen?.width ?? window.innerWidth,
    userAgent: navigator.userAgent,
    viewportHeight: window.innerHeight,
    viewportSegmentCount: segments?.length,
    viewportWidth: window.innerWidth,
  })
}

export function readAdaptiveNavigationLayout(): NavigationLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'bottom'

  const duoDisplayMode = readDuoDisplayMode()
  return navigationLayoutFromMatches({
    duo: usesDuoNavigationLayout(duoDisplayMode, window.innerWidth, window.innerHeight),
    rail: window.matchMedia(NAVIGATION_RAIL_QUERY).matches,
    shortLandscape: window.matchMedia(NAVIGATION_SHORT_LANDSCAPE_QUERY).matches,
    wide: window.matchMedia(NAVIGATION_WIDE_QUERY).matches,
  })
}

function readAdaptiveNavigationSnapshot() {
  const duoDisplayMode = readDuoDisplayMode()
  const usesDuoLayout = typeof window !== 'undefined'
    && usesDuoNavigationLayout(duoDisplayMode, window.innerWidth, window.innerHeight)
  const navigationLayout = typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? usesDuoLayout ? 'duo' : 'bottom'
    : navigationLayoutFromMatches({
        duo: usesDuoLayout,
        rail: window.matchMedia(NAVIGATION_RAIL_QUERY).matches,
        shortLandscape: window.matchMedia(NAVIGATION_SHORT_LANDSCAPE_QUERY).matches,
        wide: window.matchMedia(NAVIGATION_WIDE_QUERY).matches,
      })
  return `${navigationLayout}:${duoDisplayMode ?? ''}`
}

function subscribeToAdaptiveNavigationLayout(onStoreChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined

  const mediaQueries = NAVIGATION_LAYOUT_QUERIES.map((query) => window.matchMedia(query))
  const posture = (navigator as NavigatorWithDevicePosture).devicePosture
  mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener('change', onStoreChange))
  window.addEventListener('resize', onStoreChange)
  window.addEventListener('orientationchange', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  posture?.addEventListener('change', onStoreChange)
  return () => {
    mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener('change', onStoreChange))
    window.removeEventListener('resize', onStoreChange)
    window.removeEventListener('orientationchange', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
    posture?.removeEventListener('change', onStoreChange)
  }
}

export function useAdaptiveNavigationState(): AdaptiveNavigationState {
  const snapshot = useSyncExternalStore(
    subscribeToAdaptiveNavigationLayout,
    readAdaptiveNavigationSnapshot,
    () => 'bottom:',
  )
  const [navigationLayout, duoDisplayMode] = snapshot.split(':') as [NavigationLayout, DuoDisplayMode | '']
  return {
    duoDisplayMode: duoDisplayMode || null,
    navigationLayout,
  }
}

export function useAdaptiveNavigationLayout() {
  return useAdaptiveNavigationState().navigationLayout
}
