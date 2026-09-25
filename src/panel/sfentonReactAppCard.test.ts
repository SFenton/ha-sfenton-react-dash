import { FOLD_TEST_REACT_DASHBOARD_HOST } from '../constants/dashboardHosts'
import { REACT_DASHBOARD_DISPOSE_PROPERTY } from '../lifecycle/reactDashboardLifecycle'
import {
  DEFAULT_REACT_DASHBOARD_CARD_URL,
  SFENTON_REACT_APP_CARD_TAG,
  SFENTON_REACT_FOLD_CARD_TAG,
  SfentonReactAppCard,
} from './sfentonReactAppCard'
import { FOLD_TEST_CARD_TAG } from '../constants/rtcPilot'

function setIframeDisposer(iframe: HTMLIFrameElement | null | undefined, dispose: () => boolean) {
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { [REACT_DASHBOARD_DISPOSE_PROPERTY]: dispose },
  })
}

function persistentIframe() {
  return document.documentElement.querySelector(
    'iframe[data-sfenton-react-app-frame="true"]',
  ) as HTMLIFrameElement | null
}

describe('Sfenton React app card', () => {
  it('reserves a distinct custom element tag for the Fold-only bridge build', () => {
    expect(SFENTON_REACT_FOLD_CARD_TAG).toBe(FOLD_TEST_CARD_TAG)
    expect(SFENTON_REACT_APP_CARD_TAG).not.toBe(SFENTON_REACT_FOLD_CARD_TAG)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    persistentIframe()?.remove()
    document.body.replaceChildren()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('renders the configured dashboard iframe and card metadata', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=test` })
    document.body.append(card)

    const iframe = persistentIframe()
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

  it('forwards outer dashboard safe-area variables into the React iframe', async () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.style.setProperty('--safe-area-inset-bottom', '34px')
    card.style.setProperty('--safe-area-inset-left', '59px')
    card.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(card)

    const iframe = persistentIframe()
    const iframeDocument = document.implementation.createHTMLDocument()
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: iframeDocument,
    })
    iframe?.dispatchEvent(new Event('load'))
    expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-bottom')).toBe('34px')
    expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-left')).toBe('59px')

    card.style.setProperty('--safe-area-inset-bottom', '21px')
    await vi.waitFor(() => {
      expect(iframe?.contentDocument?.documentElement.style.getPropertyValue('--safe-area-inset-bottom')).toBe('21px')
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
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })

    expect(dispose).toHaveBeenCalledWith('legacy-card-source-change')
    expect(iframe).toHaveAttribute(
      'src',
      `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`,
    )
  })

  it.each([
    '/sfenton-react-dash/home',
    `/${FOLD_TEST_REACT_DASHBOARD_HOST}/home`,
  ])('keeps the same app frame after a long same-route Lovelace detach on %s', (path) => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', path)
    const firstCard = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    firstCard.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(firstCard)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    firstCard.remove()
    vi.advanceTimersByTime(5_100)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).not.toHaveBeenCalled()

    const replacement = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    replacement.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(replacement)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('cancels delayed release when a replacement arrives at the grace boundary', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/sfenton-react-dash/home')
    const firstCard = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    firstCard.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(firstCard)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    firstCard.remove()
    vi.advanceTimersByTime(4_999)
    const replacement = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    replacement.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(replacement)
    vi.advanceTimersByTime(1)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('disposes a retained iframe when the route changes after the grace period', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/sfenton-react-dash/home')
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(card)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    card.remove()
    vi.advanceTimersByTime(5_100)
    expect(persistentIframe()).toBe(iframe)

    window.history.replaceState({}, '', '/another-dashboard/home')
    window.dispatchEvent(new Event('location-changed'))

    expect(dispose).toHaveBeenCalledWith('legacy-card-disconnected')
    expect(iframe).not.toBeInTheDocument()
  })

  it('disposes the pilot iframe when its app source changes after replacement', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/sfenton-react-fold-test/home')
    const firstCard = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    firstCard.setConfig({ url: '/local/ha-sfenton-react-dash-fold-test/index.html?v=first' })
    document.body.append(firstCard)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    firstCard.remove()
    const replacement = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    replacement.setConfig({ url: '/local/ha-sfenton-react-dash-fold-test/index.html?v=second' })
    document.body.append(replacement)

    expect(persistentIframe()).toBe(iframe)
    expect(dispose).toHaveBeenCalledWith('legacy-card-source-change')
    expect(iframe).toHaveAttribute('src', '/local/ha-sfenton-react-dash-fold-test/index.html?v=second')
  })

  it('disposes the pilot iframe on route departure rather than retaining it', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/sfenton-react-fold-test/home')
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: '/local/ha-sfenton-react-dash-fold-test/index.html' })
    document.body.append(card)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    window.history.replaceState({}, '', '/another-dashboard/home')
    card.remove()

    expect(dispose).toHaveBeenCalledWith('legacy-card-disconnected')
    expect(iframe).not.toBeInTheDocument()
  })

  it('disposes the current app when Home Assistant removes the card', () => {
    const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
    card.setConfig({ url: DEFAULT_REACT_DASHBOARD_CARD_URL })
    document.body.append(card)
    const iframe = persistentIframe()
    const dispose = vi.fn(() => true)
    setIframeDisposer(iframe, dispose)

    card.remove()

    expect(dispose).toHaveBeenCalledWith('legacy-card-disconnected')
    expect(iframe).not.toBeInTheDocument()
  })
})
