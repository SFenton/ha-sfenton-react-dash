export const SFENTON_REACT_APP_CARD_TAG = 'sfenton-react-app-card'
export const SFENTON_REACT_FOLD_CARD_TAG = 'sfenton-react-fold-app-card'
const ACTIVE_REACT_APP_CARD_TAG = import.meta.env.MODE === 'fold-bridge'
  ? SFENTON_REACT_FOLD_CARD_TAG
  : SFENTON_REACT_APP_CARD_TAG
export const DEFAULT_REACT_DASHBOARD_CARD_URL = '/local/ha-sfenton-react-dash/index.html'
const REACT_DASHBOARD_DISPOSE_PROPERTY = '__sfentonReactDashboardDispose'
const REACT_DASHBOARD_FRAME_PROPERTY = '__sfentonReactDashboardCardFrame'
const REACT_DASHBOARD_REATTACH_GRACE_MS = 5_000
const REACT_DASHBOARD_ROUTE_EVENTS = [
  'dashboard-route-change',
  'location-changed',
  'pageshow',
  'popstate',
] as const
const REACT_DASHBOARD_VERSION_PARAM = 'v'
const REACT_DASHBOARD_ENTRY_SCRIPT_SELECTOR = 'script[type="module"][src]'
// A deferred build update still lands on an always-visible wall display within a working day.
const REACT_DASHBOARD_UPDATE_MAX_DEFER_MS = 6 * 60 * 60 * 1_000
const LEGACY_REACT_DASHBOARD_PATH = '/sfenton-react-dash/home'
const RTC_PILOT_DASHBOARD_PATH = '/sfenton-react-fold-test/home'
const SAFE_AREA_EDGES = ['top', 'right', 'bottom', 'left'] as const

type DisposableDashboardWindow = Window & {
  [REACT_DASHBOARD_DISPOSE_PROPERTY]?: (reason?: string) => boolean
}

function disposeReactDashboardFrame(
  iframe: HTMLIFrameElement | null | undefined,
  reason: string,
) {
  const childWindow = iframe?.contentWindow
  if (!childWindow) return false

  try {
    const dispose = (childWindow as DisposableDashboardWindow)[REACT_DASHBOARD_DISPOSE_PROPERTY]
    return typeof dispose === 'function' ? dispose(reason) : false
  } catch (error) {
    console.error('Unable to dispose the embedded React dashboard.', error)
    return false
  }
}

// Stable Home Assistant entry bundles must remain self-contained and cannot import a shared hashed chunk.
function bridgeSafeAreaToDashboardFrame(
  source: Element,
  iframe: HTMLIFrameElement,
) {
  const sourceWindow = source.ownerDocument.defaultView
  const sync = () => {
    const childRoot = iframe.contentDocument?.documentElement
    if (!childRoot || !sourceWindow) return

    const sourceStyles = sourceWindow.getComputedStyle(source)
    for (const edge of SAFE_AREA_EDGES) {
      const property = `--safe-area-inset-${edge}`
      const appProperty = `--app-safe-area-inset-${edge}`
      const value = sourceStyles.getPropertyValue(property).trim()
        || sourceStyles.getPropertyValue(appProperty).trim()
      if (value) childRoot.style.setProperty(property, value)
      else childRoot.style.removeProperty(property)
    }
  }
  const observer = sourceWindow?.MutationObserver
    ? new sourceWindow.MutationObserver(sync)
    : undefined

  iframe.addEventListener('load', sync)
  sourceWindow?.addEventListener('resize', sync)
  sourceWindow?.addEventListener('orientationchange', sync)
  sourceWindow?.addEventListener('pageshow', sync)
  observer?.observe(source.ownerDocument.documentElement, {
    attributeFilter: ['style'],
    attributes: true,
  })
  if (source !== source.ownerDocument.documentElement) {
    observer?.observe(source, {
      attributeFilter: ['style'],
      attributes: true,
    })
  }
  sync()

  return () => {
    iframe.removeEventListener('load', sync)
    sourceWindow?.removeEventListener('resize', sync)
    sourceWindow?.removeEventListener('orientationchange', sync)
    sourceWindow?.removeEventListener('pageshow', sync)
    observer?.disconnect()
  }
}

interface ReactDashboardCardConfig {
  title?: unknown
  url?: unknown
}

interface CustomCardMetadata {
  name: string
  type: string
}

interface PersistentReactDashboardFrame {
  iframe: HTMLIFrameElement
  owner?: SfentonReactAppCard
  releasePendingUpdate?: () => void
  releaseRouteCleanup?: () => void
  releaseTimer?: number
}

type CustomCardWindow = Window & {
  [REACT_DASHBOARD_FRAME_PROPERTY]?: PersistentReactDashboardFrame
  DOMParser: typeof DOMParser
  customCards?: CustomCardMetadata[]
}

function cardWindow(card: SfentonReactAppCard) {
  const ownerWindow = card.ownerDocument.defaultView
  if (!ownerWindow) throw new Error('The React dashboard card requires a browser window.')
  return ownerWindow as CustomCardWindow
}

function createPersistentFrame(ownerDocument: Document) {
  const iframe = ownerDocument.createElement('iframe')
  iframe.allow = 'autoplay; camera; microphone; fullscreen'
  iframe.dataset.sfentonReactAppFrame = 'true'
  iframe.referrerPolicy = 'same-origin'
  iframe.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100vw;
    height: 100vh;
    height: 100lvh;
    border: 0;
    background: #0b0f14;
  `
  ownerDocument.documentElement.append(iframe)
  return iframe
}

function clearPersistentFrameRelease(
  ownerWindow: CustomCardWindow,
  frame: PersistentReactDashboardFrame,
) {
  if (frame.releaseTimer !== undefined) {
    ownerWindow.clearTimeout(frame.releaseTimer)
    frame.releaseTimer = undefined
  }
  frame.releaseRouteCleanup?.()
  frame.releaseRouteCleanup = undefined
}

function isReactDashboardCardPath(pathname: string) {
  const currentPath = pathname.replace(/\/+$/, '')
  return currentPath === LEGACY_REACT_DASHBOARD_PATH
    || currentPath === RTC_PILOT_DASHBOARD_PATH
}

function withoutVersion(url: URL) {
  const copy = new URL(url.href)
  copy.searchParams.delete(REACT_DASHBOARD_VERSION_PARAM)
  return copy.href
}

// Deployments rewrite only the cache-busting version, including for merges that leave the bundle unchanged.
function isVersionOnlyChange(currentHref: string | undefined, next: URL) {
  if (!currentHref) return false
  return withoutVersion(new URL(currentHref)) === withoutVersion(next)
}

function runningEntryScript(iframe: HTMLIFrameElement) {
  try {
    const childDocument = iframe.contentDocument
    if (!childDocument || childDocument.readyState === 'loading') return undefined
    return childDocument.querySelector<HTMLScriptElement>(REACT_DASHBOARD_ENTRY_SCRIPT_SELECTOR)?.src || undefined
  } catch {
    return undefined
  }
}

async function publishedEntryScript(ownerWindow: CustomCardWindow, source: URL) {
  const response = await ownerWindow.fetch(source.href, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) return undefined
  const published = new ownerWindow.DOMParser().parseFromString(await response.text(), 'text/html')
  const entry = published.querySelector(REACT_DASHBOARD_ENTRY_SCRIPT_SELECTOR)?.getAttribute('src')
  return entry ? new URL(entry, source).href : undefined
}

function loadFrameSource(
  frame: PersistentReactDashboardFrame,
  resolvedUrl: URL,
  source: string,
  reason: string,
) {
  frame.releasePendingUpdate?.()
  disposeReactDashboardFrame(frame.iframe, reason)
  frame.iframe.dataset.configuredAppUrl = resolvedUrl.href
  frame.iframe.src = source
}

// Reloading on every deployment restarts the dashboard whenever Home Assistant refreshes the card config,
// which is exactly when a resumed mobile app reconnects. Keep the running build unless the published entry
// changed, and swap a changed build only while the dashboard is hidden.
function scheduleVersionUpdate(
  ownerWindow: CustomCardWindow,
  frame: PersistentReactDashboardFrame,
  resolvedUrl: URL,
  source: string,
) {
  const running = runningEntryScript(frame.iframe)
  if (!running) {
    loadFrameSource(frame, resolvedUrl, source, 'legacy-card-source-change')
    return
  }

  frame.releasePendingUpdate?.()
  frame.iframe.dataset.configuredAppUrl = resolvedUrl.href
  const ownerDocument = ownerWindow.document
  let cancelled = false
  let deadline: number | undefined
  const onVisibilityChange = () => {
    if (ownerDocument.hidden) apply()
  }
  const release = () => {
    cancelled = true
    ownerDocument.removeEventListener('visibilitychange', onVisibilityChange)
    if (deadline !== undefined) ownerWindow.clearTimeout(deadline)
    if (frame.releasePendingUpdate === release) frame.releasePendingUpdate = undefined
  }
  const apply = () => {
    release()
    disposeReactDashboardFrame(frame.iframe, 'legacy-card-version-update')
    frame.iframe.src = source
  }
  const deferUnlessIdentical = (published: string | undefined) => {
    if (cancelled) return
    if (published === running) {
      release()
      return
    }
    if (ownerDocument.hidden) {
      apply()
      return
    }
    ownerDocument.addEventListener('visibilitychange', onVisibilityChange)
    deadline = ownerWindow.setTimeout(apply, REACT_DASHBOARD_UPDATE_MAX_DEFER_MS)
  }
  frame.releasePendingUpdate = release
  publishedEntryScript(ownerWindow, resolvedUrl).then(
    deferUnlessIdentical,
    () => deferUnlessIdentical(undefined),
  )
}

function disposePersistentFrame(
  ownerWindow: CustomCardWindow,
  frame: PersistentReactDashboardFrame,
  reason: string,
) {
  frame.releasePendingUpdate?.()
  clearPersistentFrameRelease(ownerWindow, frame)
  disposeReactDashboardFrame(frame.iframe, reason)
  frame.iframe.remove()
  if (ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY] === frame) {
    delete ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  }
}

function acquirePersistentFrame(card: SfentonReactAppCard) {
  const ownerWindow = cardWindow(card)
  let frame = ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  if (
    frame
    && (
      frame.iframe.ownerDocument !== card.ownerDocument
      || !frame.iframe.isConnected
    )
  ) {
    clearPersistentFrameRelease(ownerWindow, frame)
    frame = undefined
  }
  if (!frame) {
    frame = { iframe: createPersistentFrame(card.ownerDocument) }
    ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY] = frame
  }

  clearPersistentFrameRelease(ownerWindow, frame)
  frame.owner = card
  frame.iframe.hidden = false
  return frame
}

function releasePersistentFrame(card: SfentonReactAppCard) {
  const ownerWindow = cardWindow(card)
  const frame = ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  if (!frame || frame.owner !== card) return

  frame.owner = undefined
  if (!isReactDashboardCardPath(card.ownerDocument.location.pathname)) {
    disposePersistentFrame(ownerWindow, frame, 'legacy-card-disconnected')
    return
  }

  // Home Assistant may detach the wrapper while backgrounded; elapsed time alone is not abandonment.
  const disposeIfDeparted = () => {
    if (frame.owner || ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY] !== frame) {
      clearPersistentFrameRelease(ownerWindow, frame)
      return
    }
    if (
      !frame.iframe.isConnected
      || frame.iframe.ownerDocument !== ownerWindow.document
      || !isReactDashboardCardPath(ownerWindow.location.pathname)
    ) {
      disposePersistentFrame(ownerWindow, frame, 'legacy-card-disconnected')
    }
  }
  for (const eventName of REACT_DASHBOARD_ROUTE_EVENTS) {
    ownerWindow.addEventListener(eventName, disposeIfDeparted)
  }
  frame.releaseRouteCleanup = () => {
    for (const eventName of REACT_DASHBOARD_ROUTE_EVENTS) {
      ownerWindow.removeEventListener(eventName, disposeIfDeparted)
    }
  }
  frame.releaseTimer = ownerWindow.setTimeout(() => {
    frame.releaseTimer = undefined
    disposeIfDeparted()
  }, REACT_DASHBOARD_REATTACH_GRACE_MS)
}

export class SfentonReactAppCard extends HTMLElement {
  private config: ReactDashboardCardConfig = {}
  private releaseSafeAreaBridge?: () => void

  setConfig(config: ReactDashboardCardConfig | undefined) {
    this.config = config ?? {}
    this.configuredUrl()
    this.render()
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    this.releaseSafeAreaBridge?.()
    this.releaseSafeAreaBridge = undefined
    releasePersistentFrame(this)
  }

  private configuredUrl() {
    const configuredUrl = this.config.url
    const source = configuredUrl === undefined
      ? DEFAULT_REACT_DASHBOARD_CARD_URL
      : configuredUrl
    if (typeof source !== 'string' || !source.trim()) {
      throw new Error('React dashboard card config.url must be a non-empty string.')
    }

    const resolvedUrl = new URL(source, this.ownerDocument.baseURI)
    if (resolvedUrl.origin !== this.ownerDocument.location.origin) {
      throw new Error('The React dashboard card must load a same-origin app URL.')
    }

    return { resolvedUrl, source }
  }

  private iframeTitle() {
    const configuredTitle = this.config.title
    return typeof configuredTitle === 'string' && configuredTitle.trim()
      ? configuredTitle
      : this.ownerDocument.title.trim() || ACTIVE_REACT_APP_CARD_TAG
  }

  private render() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' })
      shadow.innerHTML = `
        <style>
          :host {
            position: fixed;
            inset: 0;
            display: block;
            width: 0;
            height: 0;
            pointer-events: none;
          }
        </style>
      `
    }
    if (!this.isConnected) return

    const frame = acquirePersistentFrame(this)
    const { iframe } = frame
    const { resolvedUrl, source } = this.configuredUrl()
    const currentUrl = iframe.dataset.configuredAppUrl
    if (currentUrl !== resolvedUrl.href) {
      if (isVersionOnlyChange(currentUrl, resolvedUrl)) {
        scheduleVersionUpdate(cardWindow(this), frame, resolvedUrl, source)
      } else {
        loadFrameSource(frame, resolvedUrl, source, 'legacy-card-source-change')
      }
    }
    iframe.title = this.iframeTitle()
    this.connectSafeAreaBridge()
  }

  private iframe() {
    return acquirePersistentFrame(this).iframe
  }

  private connectSafeAreaBridge() {
    if (!this.isConnected || this.releaseSafeAreaBridge) return
    this.releaseSafeAreaBridge = bridgeSafeAreaToDashboardFrame(this, this.iframe())
  }

  getCardSize() {
    return 10
  }
}

if (!customElements.get(ACTIVE_REACT_APP_CARD_TAG)) {
  customElements.define(ACTIVE_REACT_APP_CARD_TAG, SfentonReactAppCard)
}

const customCardWindow = window as CustomCardWindow
customCardWindow.customCards ??= []
if (!customCardWindow.customCards.some((card) => card.type === ACTIVE_REACT_APP_CARD_TAG)) {
  customCardWindow.customCards.push({
    type: ACTIVE_REACT_APP_CARD_TAG,
    name: document.title.trim() || ACTIVE_REACT_APP_CARD_TAG,
  })
}
