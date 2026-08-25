import { DEFAULT_REACT_DASHBOARD_URL, SFENTON_REACT_PANEL_TAG, SfentonReactPanel, reactDashboardUrl } from './sfentonReactPanel'

describe('Sfenton React custom panel', () => {
  afterEach(() => {
    document.body.replaceChildren()
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

    const initialIframe = panel.shadowRoot?.querySelector('iframe')
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

    expect(panel.shadowRoot?.querySelector('iframe')).toBe(initialIframe)
    expect(initialIframe).toHaveAttribute('title', 'Updated Panel Title')
    expect(initialIframe).toHaveAttribute(
      'src',
      `${window.location.origin}/local/ha-sfenton-react-dash/index.html?v=5678`,
    )
  })
})
