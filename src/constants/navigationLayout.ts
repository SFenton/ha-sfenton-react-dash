export const NAVIGATION_RAIL_MIN_WIDTH_PX = 1120
export const NAVIGATION_RAIL_MIN_HEIGHT_PX = 820
export const NAVIGATION_SHORT_LANDSCAPE_MAX_HEIGHT_PX = 500

export const NAVIGATION_WIDE_QUERY = `(min-width: ${NAVIGATION_RAIL_MIN_WIDTH_PX}px)`
export const NAVIGATION_RAIL_QUERY = `${NAVIGATION_WIDE_QUERY} and (min-height: ${NAVIGATION_RAIL_MIN_HEIGHT_PX}px)`
export const NAVIGATION_SHORT_LANDSCAPE_QUERY = `(orientation: landscape) and (max-height: ${NAVIGATION_SHORT_LANDSCAPE_MAX_HEIGHT_PX}px)`

export type NavigationLayout = 'bottom' | 'drawer-only' | 'rail'

interface NavigationViewport {
  height: number
  width: number
}

interface NavigationLayoutMatches {
  rail: boolean
  shortLandscape: boolean
  wide: boolean
}

export function navigationLayoutForViewport({ height, width }: NavigationViewport): NavigationLayout {
  if (width >= NAVIGATION_RAIL_MIN_WIDTH_PX && height >= NAVIGATION_RAIL_MIN_HEIGHT_PX) return 'rail'
  if (width >= NAVIGATION_RAIL_MIN_WIDTH_PX) return 'drawer-only'
  if (width > height && height <= NAVIGATION_SHORT_LANDSCAPE_MAX_HEIGHT_PX) return 'drawer-only'
  return 'bottom'
}

export function navigationLayoutFromMatches({ rail, shortLandscape, wide }: NavigationLayoutMatches): NavigationLayout {
  if (rail) return 'rail'
  if (wide || shortLandscape) return 'drawer-only'
  return 'bottom'
}
