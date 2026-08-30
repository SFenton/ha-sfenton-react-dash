import {
  NAVIGATION_RAIL_QUERY,
  NAVIGATION_SHORT_LANDSCAPE_QUERY,
  NAVIGATION_WIDE_QUERY,
} from '../../constants/navigationLayout'

interface ViewportSize {
  height: number
  width: number
}

type MediaQueryListener = (event: MediaQueryListEvent) => void

export interface MatchMediaController {
  listenerCount: (query: string) => number
  matchMedia: typeof window.matchMedia
  setViewport: (viewport: ViewportSize) => void
}

export function createMatchMediaController(initialViewport: ViewportSize): MatchMediaController {
  let viewport = initialViewport
  const listeners = new Map<string, Set<MediaQueryListener>>()

  const matches = (query: string) => {
    if (query === NAVIGATION_RAIL_QUERY) return viewport.width >= 1120 && viewport.height >= 820
    if (query === NAVIGATION_WIDE_QUERY) return viewport.width >= 1120
    if (query === NAVIGATION_SHORT_LANDSCAPE_QUERY) return viewport.width > viewport.height && viewport.height <= 500
    return false
  }

  const matchMedia = ((query: string) => ({
    get matches() {
      return matches(query)
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: MediaQueryListener) => {
      const queryListeners = listeners.get(query) ?? new Set<MediaQueryListener>()
      queryListeners.add(listener)
      listeners.set(query, queryListeners)
    },
    removeEventListener: (_type: string, listener: MediaQueryListener) => {
      listeners.get(query)?.delete(listener)
    },
    addListener: (listener: MediaQueryListener) => {
      const queryListeners = listeners.get(query) ?? new Set<MediaQueryListener>()
      queryListeners.add(listener)
      listeners.set(query, queryListeners)
    },
    removeListener: (listener: MediaQueryListener) => {
      listeners.get(query)?.delete(listener)
    },
    dispatchEvent: () => true,
  })) as typeof window.matchMedia

  const setViewport = (nextViewport: ViewportSize) => {
    const previousMatches = new Map([...listeners.keys()].map((query) => [query, matches(query)]))
    viewport = nextViewport
    for (const [query, queryListeners] of listeners) {
      const nextMatches = matches(query)
      if (previousMatches.get(query) === nextMatches) continue
      const event = { matches: nextMatches, media: query } as MediaQueryListEvent
      queryListeners.forEach((listener) => listener(event))
    }
  }

  return {
    listenerCount: (query) => listeners.get(query)?.size ?? 0,
    matchMedia,
    setViewport,
  }
}
