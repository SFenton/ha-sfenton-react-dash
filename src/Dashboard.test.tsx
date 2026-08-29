import { act, render } from '@testing-library/react'
import Dashboard from './Dashboard'
import {
  isDeferredRouteHydrated,
  resetDeferredRouteHydrationCache,
} from './hooks/useDeferredRouteHydration'

describe('Dashboard initial route hydration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetDeferredRouteHydrationCache()
    window.history.replaceState(null, '', '/index.html?path=settings')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks Home warm when a fresh non-Home initial gate completes', async () => {
    render(<Dashboard />)

    expect(isDeferredRouteHydrated('home')).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(isDeferredRouteHydrated('home')).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(isDeferredRouteHydrated('home')).toBe(true)
  })
})
