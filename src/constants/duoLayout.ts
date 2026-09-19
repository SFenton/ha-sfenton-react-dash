export type DuoDisplayMode = 'folded' | 'inner' | 'outer'

export interface DuoDisplayEnvironment {
  devicePosture?: string
  maxTouchPoints: number
  preview?: DuoDisplayMode | 'auto' | null
  screenHeight: number
  screenWidth: number
  userAgent: string
  viewportHeight: number
  viewportSegmentCount?: number
  viewportWidth: number
}

const DUO_DIMENSION_TOLERANCE_PX = 12
const DUO_OUTER_SHORT_EDGE_PX = 466
const DUO_OUTER_LONG_EDGE_PX = 678
const DUO_INNER_SHORT_EDGE_PX = 626
const DUO_INNER_LONG_EDGE_PX = 890
const DUO_PREVIEW_OUTER_MAX_SHORT_EDGE_PX = 550

function normalizedDimensions(width: number, height: number) {
  return {
    longEdge: Math.max(width, height),
    shortEdge: Math.min(width, height),
  }
}

function matchesDimensions(
  width: number,
  height: number,
  expectedShortEdge: number,
  expectedLongEdge: number,
) {
  const { longEdge, shortEdge } = normalizedDimensions(width, height)
  return Math.abs(shortEdge - expectedShortEdge) <= DUO_DIMENSION_TOLERANCE_PX
    && Math.abs(longEdge - expectedLongEdge) <= DUO_DIMENSION_TOLERANCE_PX
}

function postureMode(environment: DuoDisplayEnvironment): DuoDisplayMode | null {
  return environment.devicePosture === 'folded' || (environment.viewportSegmentCount ?? 0) > 1
    ? 'folded'
    : null
}

function previewMode(environment: DuoDisplayEnvironment): DuoDisplayMode | null {
  if (!environment.preview) return null
  if (environment.preview !== 'auto') return environment.preview
  if (postureMode(environment)) return 'folded'
  const { shortEdge } = normalizedDimensions(environment.viewportWidth, environment.viewportHeight)
  return shortEdge <= DUO_PREVIEW_OUTER_MAX_SHORT_EDGE_PX ? 'outer' : 'inner'
}

export function duoDisplayModeForEnvironment(environment: DuoDisplayEnvironment): DuoDisplayMode | null {
  const preview = previewMode(environment)
  if (preview) return preview

  const isIPhone = /\biPhone\b/i.test(environment.userAgent)
  if (!isIPhone || environment.maxTouchPoints < 1) return null

  const folded = postureMode(environment)
  const viewportMatchesInner = matchesDimensions(
    environment.viewportWidth,
    environment.viewportHeight,
    DUO_INNER_SHORT_EDGE_PX,
    DUO_INNER_LONG_EDGE_PX,
  )
  if (viewportMatchesInner) return folded ?? 'inner'

  const viewportMatchesOuter = matchesDimensions(
    environment.viewportWidth,
    environment.viewportHeight,
    DUO_OUTER_SHORT_EDGE_PX,
    DUO_OUTER_LONG_EDGE_PX,
  )
  if (viewportMatchesOuter) return 'outer'

  const screenMatchesInner = matchesDimensions(
    environment.screenWidth,
    environment.screenHeight,
    DUO_INNER_SHORT_EDGE_PX,
    DUO_INNER_LONG_EDGE_PX,
  )
  if (screenMatchesInner) return folded ?? 'inner'

  const screenMatchesOuter = matchesDimensions(
    environment.screenWidth,
    environment.screenHeight,
    DUO_OUTER_SHORT_EDGE_PX,
    DUO_OUTER_LONG_EDGE_PX,
  )
  return screenMatchesOuter ? 'outer' : null
}

export function usesDuoNavigationLayout(
  displayMode: DuoDisplayMode | null,
  viewportWidth: number,
  viewportHeight: number,
) {
  return displayMode !== null && (displayMode !== 'inner' || viewportWidth > viewportHeight)
}
