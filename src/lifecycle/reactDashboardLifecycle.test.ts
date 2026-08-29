import {
  REACT_DASHBOARD_DISPOSE_PROPERTY,
  REACT_DASHBOARD_LIFECYCLE_PROPERTY,
  disposeReactDashboardFrame,
  installReactDashboardLifecycle,
  readReactDashboardLifecycleHistory,
} from './reactDashboardLifecycle'

function fakeWindow(timeOrigin: number, topWindow?: Window) {
  const target = new EventTarget()
  Object.defineProperties(target, {
    crypto: {
      value: undefined,
    },
    location: {
      value: {
        origin: 'https://ha.example',
        pathname: `/frame-${timeOrigin}`,
      },
    },
    performance: {
      value: { timeOrigin },
    },
    top: {
      configurable: true,
      value: topWindow ?? target,
    },
  })
  return target as unknown as Window
}

function pageHideEvent(persisted: boolean) {
  const event = new Event('pagehide')
  Object.defineProperty(event, 'persisted', { value: persisted })
  return event
}

describe('React dashboard lifecycle', () => {
  it('disposes once on a non-BFCache pagehide and clears its registrations', () => {
    const hostWindow = fakeWindow(1)
    const childWindow = fakeWindow(2, hostWindow)
    const onDispose = vi.fn()

    const registration = installReactDashboardLifecycle({
      currentWindow: childWindow,
      instanceId: 'first',
      onDispose,
    })

    expect((hostWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_LIFECYCLE_PROPERTY]).toBe(registration)
    expect((childWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_DISPOSE_PROPERTY]).toBe(registration.dispose)

    childWindow.dispatchEvent(pageHideEvent(false))
    childWindow.dispatchEvent(pageHideEvent(false))

    expect(onDispose).toHaveBeenCalledTimes(1)
    expect(registration.dispose('again')).toBe(false)
    expect((hostWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_LIFECYCLE_PROPERTY]).toBeUndefined()
    expect((childWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_DISPOSE_PROPERTY]).toBeUndefined()
    expect(readReactDashboardLifecycleHistory(childWindow)).toMatchObject([
      { event: 'mounted', instanceId: 'first' },
      { event: 'disposed', instanceId: 'first', reason: 'pagehide' },
    ])
  })

  it('keeps the current instance mounted when pagehide enters BFCache', () => {
    const currentWindow = fakeWindow(3)
    const onDispose = vi.fn()
    const registration = installReactDashboardLifecycle({
      currentWindow,
      instanceId: 'cached',
      onDispose,
    })

    currentWindow.dispatchEvent(pageHideEvent(true))

    expect(onDispose).not.toHaveBeenCalled()
    expect((currentWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_LIFECYCLE_PROPERTY]).toBe(registration)
  })

  it('disposes a stale instance before registering its replacement', () => {
    const hostWindow = fakeWindow(4)
    const firstWindow = fakeWindow(5, hostWindow)
    const secondWindow = fakeWindow(6, hostWindow)
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()

    installReactDashboardLifecycle({
      currentWindow: firstWindow,
      instanceId: 'first',
      onDispose: firstDispose,
    })
    const second = installReactDashboardLifecycle({
      currentWindow: secondWindow,
      instanceId: 'second',
      onDispose: secondDispose,
    })

    expect(firstDispose).toHaveBeenCalledTimes(1)
    expect(secondDispose).not.toHaveBeenCalled()
    expect((hostWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_LIFECYCLE_PROPERTY]).toBe(second)
    expect(readReactDashboardLifecycleHistory(secondWindow)).toMatchObject([
      { event: 'mounted', instanceId: 'first' },
      { event: 'disposed', instanceId: 'first', reason: 'superseded-by-new-instance' },
      { event: 'mounted', instanceId: 'second' },
    ])
  })

  it('calls the child disposer through an iframe and contains disposal errors', () => {
    const childWindow = fakeWindow(7)
    const dispose = vi.fn(() => true)
    ;(childWindow as unknown as Record<string, unknown>)[REACT_DASHBOARD_DISPOSE_PROPERTY] = dispose
    const iframe = { contentWindow: childWindow } as HTMLIFrameElement

    expect(disposeReactDashboardFrame(iframe, 'host-disconnected')).toBe(true)
    expect(dispose).toHaveBeenCalledWith('host-disconnected')

    const error = new Error('dispose failed')
    dispose.mockImplementation(() => {
      throw error
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(disposeReactDashboardFrame(iframe, 'host-disconnected')).toBe(false)
    expect(consoleError).toHaveBeenCalledWith('Unable to dispose the embedded React dashboard.', error)
  })
})
