import { act, renderHook } from '@testing-library/react'
import { HOME_ASSISTANT_LOCATION_CHANGE_EVENT } from './dashboardLocation'
import { useDashboardRoute } from './useDashboardRoute'
import { useDashboardUrl } from './useDashboardUrl'
import { useHashModal } from './useHashModal'

describe('Home Assistant location events', () => {
  it.each(['/sfenton-react-dash/home', '/sfenton-react-panel'])('synchronizes route, URL, and modal for %s', (host) => {
    window.history.replaceState({}, '', `${host}?path=overview#camera-front-door`)
    const hook = renderHook(() => ({
      route: useDashboardRoute(), url: useDashboardUrl(), modal: useHashModal(),
    }))
    expect(hook.result.current.route.path).toBe('overview')
    expect(hook.result.current.modal.hash).toBe('#camera-front-door')

    act(() => {
      window.history.pushState({}, '', `${host}?path=security`)
      window.dispatchEvent(new Event(HOME_ASSISTANT_LOCATION_CHANGE_EVENT))
    })

    expect(hook.result.current.route.path).toBe('security')
    expect(hook.result.current.url).toContain(`${host}?path=security`)
    expect(hook.result.current.modal.hash).toBe('')
    hook.unmount()
  })

  it('does not subscribe inert preload modal content', () => {
    const listener = vi.spyOn(window, 'addEventListener')
    const hook = renderHook(() => useHashModal({ disabled: true }))
    expect(listener.mock.calls.filter(([name]) => name === HOME_ASSISTANT_LOCATION_CHANGE_EVENT)).toHaveLength(0)
    hook.unmount()
    listener.mockRestore()
  })

  it('removes the host-event listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const hook = renderHook(() => useDashboardRoute())
    hook.unmount()
    expect(remove.mock.calls.some(([name]) => name === HOME_ASSISTANT_LOCATION_CHANGE_EVENT)).toBe(true)
    remove.mockRestore()
  })
})
