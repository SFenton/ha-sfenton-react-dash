import { render } from '@testing-library/react'
import { DASHBOARD_ROUTES, THERMOSTAT_ROUTE_PATH } from '../../constants/routes'
import { mockCallServiceCalls, mockState, resetMockHass } from '../../test/mocks/hakitCoreState'
import { DashboardPreloadCache } from './DashboardPreloadCache'

describe('DashboardPreloadCache', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('renders inert geometry without runtime I/O', () => {
    const view = render(<div />)
    const resizeObserver = vi.fn()
    const mutationObserver = vi.fn()
    const intersectionObserver = vi.fn()
    const fetch = vi.fn()
    const timeout = vi.spyOn(window, 'setTimeout')
    const interval = vi.spyOn(window, 'setInterval')
    const animationFrame = vi.spyOn(window, 'requestAnimationFrame')
    const windowListener = vi.spyOn(window, 'addEventListener')
    const documentListener = vi.spyOn(document, 'addEventListener')
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => undefined)
    const websocketCalls = vi.spyOn(mockState.connection, 'sendMessagePromise')
    const websocketSubscriptions = vi.spyOn(mockState.connection, 'subscribeMessage')

    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('ResizeObserver', class {
      constructor() {
        resizeObserver()
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    })
    vi.stubGlobal('MutationObserver', class {
      constructor() {
        mutationObserver()
      }

      disconnect() {}
      observe() {}
      takeRecords() {
        return []
      }
    })
    vi.stubGlobal('IntersectionObserver', class {
      constructor() {
        intersectionObserver()
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    })

    try {
      view.rerender(<DashboardPreloadCache active />)
      const { container } = view

      expect(container.querySelectorAll('[data-preload-route]')).toHaveLength(DASHBOARD_ROUTES.length)
      expect(container.querySelectorAll('[data-preload-geometry="modal"]').length).toBeGreaterThan(0)
      expect(container.querySelector(`[data-preload-modal="${THERMOSTAT_ROUTE_PATH}#thermostat-controls"]`)).toBeInTheDocument()
      expect(container.querySelector('[data-dynamic-grid="true"]')).toBeNull()
      expect(container.querySelector('img, video, audio, source, iframe, object, embed, script, link, canvas')).toBeNull()
      expect(mockCallServiceCalls).toEqual([])
      expect(websocketCalls).not.toHaveBeenCalled()
      expect(websocketSubscriptions).not.toHaveBeenCalled()
      expect(resizeObserver).not.toHaveBeenCalled()
      expect(mutationObserver).not.toHaveBeenCalled()
      expect(intersectionObserver).not.toHaveBeenCalled()
      expect(timeout).not.toHaveBeenCalled()
      expect(interval).not.toHaveBeenCalled()
      expect(animationFrame).not.toHaveBeenCalled()
      expect(windowListener).not.toHaveBeenCalled()
      expect(documentListener).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      expect(xhr).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })

  it('renders nothing while inactive', () => {
    const { container } = render(<DashboardPreloadCache active={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
