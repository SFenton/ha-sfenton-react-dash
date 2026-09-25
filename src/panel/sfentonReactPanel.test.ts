import { REACT_DASHBOARD_DISPOSE_PROPERTY } from '../lifecycle/reactDashboardLifecycle'
import { DEFAULT_REACT_DASHBOARD_URL, SFENTON_REACT_PANEL_TAG, SfentonReactPanel, reactDashboardUrl } from './sfentonReactPanel'

function setIframeDisposer(iframe: HTMLIFrameElement | null | undefined, dispose: () => boolean) {
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { [REACT_DASHBOARD_DISPOSE_PROPERTY]: dispose },
  })
}

function persistentIframe() {
  return document.documentElement.querySelector(
    'iframe[data-sfenton-react-panel-frame="true"]',
  ) as HTMLIFrameElement | null
}

describe('Sfenton React custom panel', () => {
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    persistentIframe()?.remove()
    document.body.replaceChildren()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('adds a per-mount cache buster while preserving existing query parameters', () => {
    expect(reactDashboardUrl(`${DEFAULT_REACT_DASHBOARD_URL}?source=panel`, 1234, 'https://ha.example')).toBe(
      'https://ha.example/local/ha-sfenton-react-dash/index.html?source=panel&v=1234',
    )
  })

  it('rejects cross-origin app URLs', () => {
    expect(() => reactDashboardUrl('https://example.com/dashboard', 1234, 'https://ha.example')).toThrow(
      'must load a same-origin app URL',
    )
  })

  it('creates one persistent iframe across Home Assistant property updates', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5678)
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)

    const initialIframe = persistentIframe()
    expect(initialIframe).toBeInstanceOf(HTMLIFrameElement)
    expect(initialIframe).toHaveAttribute('title', 'React Dash Panel')
    expect(initialIframe).toHaveAttribute(
      'src',
      `${window.location.origin}/local/ha-sfenton-react-dash/index.html?v=5678`,
    )

    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'Updated Panel Title',
    }
    panel.connectedCallback()

    expect(persistentIframe()).toBe(initialIframe)
    expect(initialIframe).toHaveAttribute('title', 'Updated Panel Title')
    expect(initialIframe).toHaveAttribute(
      'src',
      `${window.location.origin}/local/ha-sfenton-react-dash/index.html?v=5678`,
    )
  })

  it('keeps the persistent iframe aligned to the native panel viewport', () => {
    let panelRect = {
      x: 256,
      y: 0,
      left: 256,
      top: 0,
      right: 1440,
      bottom: 900,
      width: 1184,
      height: 900,
      toJSON: () => ({}),
    } as DOMRect
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => panelRect)
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)

    const iframe = persistentIframe()
    expect(iframe).toHaveStyle({
      left: '256px',
      top: '0px',
      width: '1184px',
      height: '900px',
    })

    panelRect = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 852,
      bottom: 393,
      width: 852,
      height: 393,
      toJSON: () => ({}),
    } as DOMRect
    window.dispatchEvent(new Event('resize'))

    expect(iframe).toHaveStyle({
      left: '0px',
      top: '0px',
      width: '852px',
      height: '393px',
    })
  })

  it('forwards outer panel safe-area variables into the React iframe', async () => {
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    panel.style.setProperty('--safe-area-inset-left', '59px')
    panel.style.setProperty('--safe-area-inset-right', '44px')
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)

    const iframe = persistentIframe()
    const iframeDocument = document.implementation.createHTMLDocument()
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: iframeDocument,
    })
    iframe?.dispatchEvent(new Event('load'))
    expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-left')).toBe('59px')
    expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-right')).toBe('44px')

    panel.style.setProperty('--safe-area-inset-left', '24px')
    await vi.waitFor(() => {
      expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-left')).toBe('24px')
    })
  })

  it('disposes the current app before changing the configured app URL', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(2000)
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    panel.panel = {
      config: { app_url: `${DEFAULT_REACT_DASHBOARD_URL}?source=updated` },
      title: 'React Dash Panel',
    }

    expect(dispose).toHaveBeenCalledWith('panel-source-change')
    expect(iframe).toHaveAttribute(
      'src',
      `${window.location.origin}/local/ha-sfenton-react-dash/index.html?source=updated&v=2000`,
    )
  })

  it('keeps the same app frame after a long same-route panel detach', () => {
    vi.useFakeTimers()
    vi.spyOn(Date, 'now').mockReturnValue(5678)
    window.history.replaceState({}, '', '/sfenton-react-panel')
    const firstPanel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    firstPanel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(firstPanel)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    firstPanel.remove()
    vi.advanceTimersByTime(5_100)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).not.toHaveBeenCalled()

    const replacement = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    replacement.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(replacement)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('disposes a retained panel iframe when resume reveals route departure', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/sfenton-react-panel')
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    panel.remove()
    vi.advanceTimersByTime(5_100)
    expect(persistentIframe()).toBe(iframe)

    window.history.replaceState({}, '', '/another-panel')
    window.dispatchEvent(new Event('pageshow'))

    expect(dispose).toHaveBeenCalledWith('panel-host-disconnected')
    expect(iframe).not.toBeInTheDocument()
  })

  it('disposes the current app when Home Assistant removes the panel', () => {
    const panel = document.createElement(SFENTON_REACT_PANEL_TAG) as SfentonReactPanel
    panel.panel = {
      config: { app_url: DEFAULT_REACT_DASHBOARD_URL },
      title: 'React Dash Panel',
    }
    document.body.append(panel)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    panel.remove()

    expect(dispose).toHaveBeenCalledWith('panel-host-disconnected')
    expect(iframe).not.toBeInTheDocument()
  })
})
