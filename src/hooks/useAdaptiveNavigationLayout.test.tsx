import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import {
  NAVIGATION_RAIL_QUERY,
  NAVIGATION_SHORT_LANDSCAPE_QUERY,
  NAVIGATION_WIDE_QUERY,
} from '../constants/navigationLayout'
import { createMatchMediaController } from '../test/mocks/matchMedia'
import { useAdaptiveNavigationLayout } from './useAdaptiveNavigationLayout'

describe('useAdaptiveNavigationLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns bottom when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useAdaptiveNavigationLayout())
    expect(result.current).toBe('bottom')
  })

  it('updates all consumers from one media-query snapshot', () => {
    const media = createMatchMediaController({ height: 852, width: 393 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    const { result } = renderHook(() => useAdaptiveNavigationLayout())

    expect(result.current).toBe('bottom')

    act(() => media.setViewport({ height: 741, width: 1152 }))
    expect(result.current).toBe('drawer-only')

    act(() => media.setViewport({ height: 820, width: 1180 }))
    expect(result.current).toBe('rail')

    act(() => media.setViewport({ height: 393, width: 852 }))
    expect(result.current).toBe('drawer-only')
  })

  it('subscribes and cleans up every navigation query', () => {
    const media = createMatchMediaController({ height: 852, width: 393 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    const { unmount } = renderHook(() => useAdaptiveNavigationLayout(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    })

    expect(media.listenerCount(NAVIGATION_RAIL_QUERY)).toBe(1)
    expect(media.listenerCount(NAVIGATION_WIDE_QUERY)).toBe(1)
    expect(media.listenerCount(NAVIGATION_SHORT_LANDSCAPE_QUERY)).toBe(1)

    unmount()

    expect(media.listenerCount(NAVIGATION_RAIL_QUERY)).toBe(0)
    expect(media.listenerCount(NAVIGATION_WIDE_QUERY)).toBe(0)
    expect(media.listenerCount(NAVIGATION_SHORT_LANDSCAPE_QUERY)).toBe(0)
  })
})
