import { act, renderHook } from '@testing-library/react'
import { routePathFromUrl } from '../constants/routes'
import { pushDashboardUrl } from './dashboardLocation'
import { useDashboardRoute } from './useDashboardRoute'

function currentRoutePath() {
  return routePathFromUrl(window.location.href)
}

describe('useDashboardRoute', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/at-a-glance/overview')
  })

  it('navigates app back to the previous page instead of hash modal history', () => {
    const { result } = renderHook(() => useDashboardRoute())

    act(() => result.current.navigate('/at-a-glance/settings'))
    act(() => result.current.navigate('/at-a-glance/to-do'))
    act(() => pushDashboardUrl('#presence-based-overrides'))
    act(() => pushDashboardUrl('/at-a-glance/to-do'))

    expect(result.current.path).toBe('to-do')

    act(() => result.current.navigateBack('settings'))

    expect(result.current.path).toBe('settings')
    expect(currentRoutePath()).toBe('settings')
    expect(window.location.hash).toBe('')
  })

  it('uses the route fallback when there is no previous page', () => {
    window.history.replaceState(null, '', '/at-a-glance/pantry#inventory')
    const { result } = renderHook(() => useDashboardRoute())

    act(() => result.current.navigateBack('food'))

    expect(result.current.path).toBe('food')
    expect(currentRoutePath()).toBe('food')
    expect(window.location.hash).toBe('')
  })
})
