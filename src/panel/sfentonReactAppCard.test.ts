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

const APP_ENTRY = '/local/ha-sfenton-react-dash/assets/app-current.js'

function runningBuild(iframe: HTMLIFrameElement | null, dispose: () => boolean) {
  const childDocument = document.implementation.createHTMLDocument()
  const entry = childDocument.createElement('script')
  entry.type = 'module'
  entry.src = new URL(APP_ENTRY, window.location.origin).href
  childDocument.head.append(entry)
  Object.defineProperty(childDocument, 'readyState', { configurable: true, value: 'complete' })
  Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: childDocument })
  setIframeDisposer(iframe, dispose)
}

function publishBuild(entry: string | Error) {
  return vi.spyOn(window, 'fetch').mockImplementation(async () => {
    if (entry instanceof Error) throw entry
    return new Response(`<!doctype html><script type="module" crossorigin src="${entry}"></script>`)
  })
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountRunningCard(version: string) {
  const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
  card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=${version}` })
  document.body.append(card)
  const iframe = persistentIframe()
  const dispose = vi.fn(() => true)
  runningBuild(iframe, dispose)
  return { card, dispose, iframe }
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
    Reflect.deleteProperty(document, 'hidden')
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

  describe('deployment version changes', () => {
    it('keeps the running app when the published build is unchanged', async () => {
      const fetch = publishBuild('./assets/app-current.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      setDocumentHidden(true)

      expect(fetch).toHaveBeenCalledWith(
        new URL(`${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`, window.location.origin).href,
        { cache: 'no-store', credentials: 'same-origin' },
      )
      expect(dispose).not.toHaveBeenCalled()
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=first`)
      expect(iframe?.dataset.configuredAppUrl).toBe(
        new URL(`${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`, window.location.origin).href,
      )
    })

    it('defers a changed build until the dashboard is hidden', async () => {
      const fetch = publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      await settle()

      expect(dispose).not.toHaveBeenCalled()
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=first`)

      setDocumentHidden(true)

      expect(dispose).toHaveBeenCalledWith('legacy-card-version-update')
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`)
    })

    it('applies a changed build immediately when the dashboard is already hidden', async () => {
      publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })

      await vi.waitFor(() => expect(dispose).toHaveBeenCalledWith('legacy-card-version-update'))
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`)
    })

    it('treats an unreadable published build as changed', async () => {
      const fetch = publishBuild(new Error('offline'))
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      await settle()
      expect(dispose).not.toHaveBeenCalled()

      setDocumentHidden(true)

      expect(dispose).toHaveBeenCalledWith('legacy-card-version-update')
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`)
    })

    it('applies a changed build after the maximum deferral on an always-visible display', async () => {
      vi.useFakeTimers()
      const fetch = publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1_000 - 1)
      expect(dispose).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)

      expect(dispose).toHaveBeenCalledWith('legacy-card-version-update')
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`)
    })

    it('replaces a pending update when another deployment arrives', async () => {
      const fetch = publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=third` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
      await settle()

      setDocumentHidden(true)

      expect(dispose).toHaveBeenCalledTimes(1)
      expect(iframe).toHaveAttribute('src', `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=third`)
    })

    it('cancels a pending update when the card leaves the dashboard', async () => {
      const fetch = publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      await settle()
      card.remove()
      expect(dispose).toHaveBeenCalledWith('legacy-card-disconnected')
      dispose.mockClear()

      setDocumentHidden(true)

      expect(dispose).not.toHaveBeenCalled()
      expect(iframe).not.toBeInTheDocument()
    })

    it('reloads immediately when the app path changes', () => {
      const fetch = publishBuild('./assets/app-next.js')
      const { card, dispose, iframe } = mountRunningCard('first')

      card.setConfig({ url: '/local/ha-sfenton-react-dash-next/index.html?v=first' })

      expect(fetch).not.toHaveBeenCalled()
      expect(dispose).toHaveBeenCalledWith('legacy-card-source-change')
      expect(iframe).toHaveAttribute('src', '/local/ha-sfenton-react-dash-next/index.html?v=first')
    })
  })

  describe('stalled frame loads', () => {
    function trackNavigations(iframe: HTMLIFrameElement) {
      const navigations: string[] = []
      Object.defineProperty(iframe, 'src', {
        configurable: true,
        get: () => iframe.getAttribute('src') ?? '',
        set: (value: string) => {
          navigations.push(value)
          iframe.setAttribute('src', value)
        },
      })
      return navigations
    }

    function unstartedFrame(iframe: HTMLIFrameElement | null) {
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: { location: { href: 'https://ha.example/local/ha-sfenton-react-dash/index.html' } },
      })
    }

    async function hiddenVersionUpdate() {
      vi.useFakeTimers()
      publishBuild('./assets/app-next.js')
      const { card, iframe } = mountRunningCard('first')
      const navigations = trackNavigations(iframe!)
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      card.setConfig({ url: `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second` })
      await vi.waitFor(() => expect(navigations).toEqual([`${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`]))
      unstartedFrame(iframe)
      return { iframe: iframe!, navigations }
    }

    it('restarts a hidden update whose app never started once the dashboard is visible', async () => {
      const { navigations } = await hiddenVersionUpdate()

      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(3_999)
      expect(navigations).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)

      expect(navigations).toEqual([
        `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`,
        `${DEFAULT_REACT_DASHBOARD_CARD_URL}?v=second`,
      ])
    })

    it('leaves an interrupted load alone once it finished or the app started', async () => {
      const finished = await hiddenVersionUpdate()
      finished.iframe.dispatchEvent(new Event('load'))
      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(finished.navigations).toHaveLength(1)

      persistentIframe()?.remove()
      document.body.replaceChildren()
      Reflect.deleteProperty(window, '__sfentonReactDashboardCardFrame')

      const started = await hiddenVersionUpdate()
      Object.defineProperty(started.iframe, 'contentWindow', {
        configurable: true,
        value: { [REACT_DASHBOARD_DISPOSE_PROPERTY]: () => true },
      })
      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(started.navigations).toHaveLength(1)
    })

    it('never restarts a slow load that was not interrupted by backgrounding', async () => {
      vi.useFakeTimers()
      const card = document.createElement(SFENTON_REACT_APP_CARD_TAG) as SfentonReactAppCard
      document.body.append(card)
      const iframe = persistentIframe()!
      const navigations = trackNavigations(iframe)
      card.setConfig({ url: '/local/ha-sfenton-react-dash-next/index.html?v=first' })
      unstartedFrame(iframe)

      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(10_000)

      expect(navigations).toEqual(['/local/ha-sfenton-react-dash-next/index.html?v=first'])
    })

    it('restarts a stalled load at most once a minute', async () => {
      const { navigations } = await hiddenVersionUpdate()

      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(4_000)
      setDocumentHidden(true)
      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(4_000)
      expect(navigations).toHaveLength(2)

      setDocumentHidden(true)
      await vi.advanceTimersByTimeAsync(60_000)
      setDocumentHidden(false)
      await vi.advanceTimersByTimeAsync(4_000)
      expect(navigations).toHaveLength(3)
    })
  })
})
