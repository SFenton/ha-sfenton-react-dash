import { render } from '@testing-library/react'
import { DASHBOARD_ROUTES } from '../../constants/routes'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { DashboardPreloadCache } from './DashboardPreloadCache'

describe('DashboardPreloadCache', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('renders inert geometry without runtime I/O', () => {
    const resizeObserver = vi.fn()
    const mutationObserver = vi.fn()
    const timeout = vi.spyOn(window, 'setTimeout')
    const animationFrame = vi.spyOn(window, 'requestAnimationFrame')
    const windowListener = vi.spyOn(window, 'addEventListener')

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

    try {
      const { container } = render(<DashboardPreloadCache active />)

      expect(container.querySelectorAll('[data-preload-route]')).toHaveLength(DASHBOARD_ROUTES.length)
      expect(container.querySelectorAll('[data-preload-geometry="modal"]').length).toBeGreaterThan(0)
      expect(container.querySelector('[data-dynamic-grid="true"]')).toBeNull()
      expect(container.querySelector('img, video, canvas')).toBeNull()
      expect(mockCallServiceCalls).toEqual([])
      expect(resizeObserver).not.toHaveBeenCalled()
      expect(mutationObserver).not.toHaveBeenCalled()
      expect(timeout).not.toHaveBeenCalled()
      expect(animationFrame).not.toHaveBeenCalled()
      expect(windowListener).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })

  it('renders nothing while inactive', () => {
    const { container } = render(<DashboardPreloadCache active={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
