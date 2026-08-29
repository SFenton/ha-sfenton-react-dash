import { act, renderHook } from '@testing-library/react'
import {
  markDeferredRouteHydrated,
  resetDeferredRouteHydrationCache,
  useDeferredRouteHydration,
} from './useDeferredRouteHydration'

describe('useDeferredRouteHydration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetDeferredRouteHydrationCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a warmed route immediately while deferring heavy content until idle', () => {
    markDeferredRouteHydrated('home')
    const { result, rerender } = renderHook(
      ({ transitionState }) => useDeferredRouteHydration({
        cacheKey: 'home',
        transitionState,
      }),
      { initialProps: { transitionState: 'entering' as const } },
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toEqual({
      hydrateHeavyContent: false,
      loadingPhase: 'content',
      showContent: true,
    })

    rerender({ transitionState: 'idle' })
    act(() => {
      vi.advanceTimersByTime(89)
    })
    expect(result.current.hydrateHeavyContent).toBe(false)
    expect(result.current.showContent).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.hydrateHeavyContent).toBe(true)
  })

  it('preserves the cold route loading and exit phases', () => {
    const { result, rerender } = renderHook(
      ({ transitionState }) => useDeferredRouteHydration({
        cacheKey: 'home',
        transitionState,
      }),
      { initialProps: { transitionState: 'entering' as const } },
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toEqual({
      hydrateHeavyContent: false,
      loadingPhase: 'loading',
      showContent: false,
    })

    rerender({ transitionState: 'idle' })
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.loadingPhase).toBe('loading')
    expect(result.current.showContent).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.loadingPhase).toBe('loading-exiting')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.loadingPhase).toBe('content')
    expect(result.current.showContent).toBe(true)
  })
})
