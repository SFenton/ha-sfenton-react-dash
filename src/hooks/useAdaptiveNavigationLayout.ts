import { useSyncExternalStore } from 'react'
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

export function readAdaptiveNavigationLayout(): NavigationLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'bottom'

  return navigationLayoutFromMatches({
    rail: window.matchMedia(NAVIGATION_RAIL_QUERY).matches,
    shortLandscape: window.matchMedia(NAVIGATION_SHORT_LANDSCAPE_QUERY).matches,
    wide: window.matchMedia(NAVIGATION_WIDE_QUERY).matches,
  })
}

function subscribeToAdaptiveNavigationLayout(onStoreChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined

  const mediaQueries = NAVIGATION_LAYOUT_QUERIES.map((query) => window.matchMedia(query))
  mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener('change', onStoreChange))
  return () => mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener('change', onStoreChange))
}

export function useAdaptiveNavigationLayout() {
  return useSyncExternalStore(
    subscribeToAdaptiveNavigationLayout,
    readAdaptiveNavigationLayout,
    (): NavigationLayout => 'bottom',
  )
}
