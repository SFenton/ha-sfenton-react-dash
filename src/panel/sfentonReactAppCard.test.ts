import { REACT_DASHBOARD_DISPOSE_PROPERTY } from '../lifecycle/reactDashboardLifecycle'
import {
  DEFAULT_REACT_DASHBOARD_CARD_URL,
  SFENTON_REACT_APP_CARD_TAG,
  SfentonReactAppCard,
} from './sfentonReactAppCard'

function setIframeDisposer(iframe: HTMLIFrameElement | null | undefined, dispose: () => boolean) {
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { [REACT_DASHBOARD_DISPOSE_PROPERTY]: dispose },
  })
}

describe('Sfenton React app card', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('renders the configured dashboard iframe and card metadata', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=test` })
    document.body.append(card)

    const iframe = card.shadowRoot?.querySelector('iframe')
    expect(iframe).toBeInstanceOf(HTMLIFrameElement)
    expect(iframe).toHaveAttribute(
      'src',
      `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=test`,
    )
    expect(iframe).toHaveAttribute('title', SFENTON_REACT_APP_CARD_TAG)
    expect(window.customCards).toContainEqual({
      name: SFENTON_REACT_APP_CARD_TAG,
      type: SFENTON_REACT_APP_CARD_TAG,
    })
  })

  it('rejects a cross-origin app URL', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    expect(() => card.setConfig({ url: 'https://example.com/dashboard' })).toThrow(
      'must load a same-origin app URL',
    )
  })

  it('disposes the current app before changing the iframe source', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=first` })
    document.body.append(card)
    const iframe = card.shadowRoot?.querySelector('iframe')
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })

    expect(dispose).toHaveBeenCalledWith('legacy-card-source-change')
    expect(iframe).toHaveAttribute(
      'src',
      `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`,
    )
  })

  it('disposes the current app when Home Assistant removes the card', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(card)
    const iframe = card.shadowRoot?.querySelector('iframe')
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    card.remove()

    expect(dispose).toHaveBeenCalledWith('legacy-card-disconnected')
  })
})
