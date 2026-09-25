import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { HOUSEHOLD_RESIDENTS } from './constants/householdResidents'
import Dashboard from './Dashboard'
import {
  isDeferredRouteHydrated,
  resetDeferredRouteHydrationCache,
} from './hooks/useDeferredRouteHydration'
import { resetMockHass, setMockUser } from './test/mocks/hakitCoreState'

describe('Dashboard initial route hydration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetDeferredRouteHydrationCache()
    resetMockHass()
    window.history.replaceState(null, '', '/index.html?path=settings')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each([
    ['/at-a-glance/to-do', '/at-a-glance/to-do?path=settings'],
    ['/sfenton-react-dash/home?path=to-do', '/sfenton-react-dash/home?path=settings'],
    ['/sfenton-react-panel?path=to-do', '/sfenton-react-panel?path=settings'],
  ])('renders Settings immediately and replaces a direct Steph To-Do URL from %s', (sourceUrl, expectedUrl) => {
    setMockUser({ id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' })
    window.history.replaceState(null, '', sourceUrl)
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')

    const { container } = render(<StrictMode><Dashboard /></StrictMode>)

    expect(container.querySelector('[data-route-path="settings"]')).not.toBeNull()
    expect(container.querySelector('[data-route-path="to-do"]')).toBeNull()
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(expectedUrl)
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith(null, '', expectedUrl)
    expect(pushState).not.toHaveBeenCalled()
  })

  it.each([
    ['Stephen', { id: HOUSEHOLD_RESIDENTS.stephen.haUserId, name: 'Stephen' }],
    ['an unknown user', { id: 'unknown-user', name: 'Unknown' }],
    ['a missing user', null],
  ] as const)('keeps the direct To-Do route available for %s', (_label, user) => {
    setMockUser(user ? { ...user } : null)
    window.history.replaceState(null, '', '/at-a-glance/to-do')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')

    const { container } = render(<Dashboard />)

    expect(container.querySelector('[data-route-path="to-do"]')).not.toBeNull()
    expect(window.location.pathname).toBe('/at-a-glance/to-do')
    expect(replaceState).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
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
