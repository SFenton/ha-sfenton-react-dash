export const SFENTON_REACT_APP_CARD_TAG = 'sfenton-react-app-card'
export const DEFAULT_REACT_DASHBOARD_CARD_URL = '/local/ha-sfenton-react-dash/index.html'
const REACT_DASHBOARD_DISPOSE_PROPERTY = '__sfentonReactDashboardDispose'
const REACT_DASHBOARD_FRAME_PROPERTY = '__sfentonReactDashboardCardFrame'
const REACT_DASHBOARD_REATTACH_GRACE_MS = 5_000
const LEGACY_REACT_DASHBOARD_PATH = '/sfenton-react-dash/home'
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
  releaseTimer?: number
}

type CustomCardWindow = Window & {
  [REACT_DASHBOARD_FRAME_PROPERTY]?: PersistentReactDashboardFrame
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

function disposePersistentFrame(
  ownerWindow: CustomCardWindow,
  frame: PersistentReactDashboardFrame,
  reason: string,
) {
  if (frame.releaseTimer !== undefined) {
    ownerWindow.clearTimeout(frame.releaseTimer)
    frame.releaseTimer = undefined
  }
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
    !frame
    || frame.iframe.ownerDocument !== card.ownerDocument
    || !frame.iframe.isConnected
  ) {
    frame = { iframe: createPersistentFrame(card.ownerDocument) }
    ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY] = frame
  }

  if (frame.releaseTimer !== undefined) {
    ownerWindow.clearTimeout(frame.releaseTimer)
    frame.releaseTimer = undefined
  }
  frame.owner = card
  frame.iframe.hidden = false
  return frame
}

function releasePersistentFrame(card: SfentonReactAppCard) {
  const ownerWindow = cardWindow(card)
  const frame = ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  if (!frame || frame.owner !== card) return

  frame.owner = undefined
  const currentPath = card.ownerDocument.location.pathname.replace(/\/+$/, '')
  if (currentPath !== LEGACY_REACT_DASHBOARD_PATH) {
    disposePersistentFrame(ownerWindow, frame, 'legacy-card-disconnected')
    return
  }

  frame.releaseTimer = ownerWindow.setTimeout(() => {
    if (frame.owner || ownerWindow[REACT_DASHBOARD_FRAME_PROPERTY] !== frame) return
    disposePersistentFrame(ownerWindow, frame, 'legacy-card-disconnected')
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
      : this.ownerDocument.title.trim() || SFENTON_REACT_APP_CARD_TAG
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

    const iframe = this.iframe()
    const configuredUrl = this.configuredUrl()
    if (iframe.dataset.configuredAppUrl !== configuredUrl.resolvedUrl.href) {
      disposeReactDashboardFrame(iframe, 'legacy-card-source-change')
      iframe.dataset.configuredAppUrl = configuredUrl.resolvedUrl.href
      iframe.src = configuredUrl.source
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

if (!customElements.get(SFENTON_REACT_APP_CARD_TAG)) {
  customElements.define(SFENTON_REACT_APP_CARD_TAG, SfentonReactAppCard)
}

const customCardWindow = window as CustomCardWindow
customCardWindow.customCards ??= []
if (!customCardWindow.customCards.some((card) => card.type === SFENTON_REACT_APP_CARD_TAG)) {
  customCardWindow.customCards.push({
    type: SFENTON_REACT_APP_CARD_TAG,
    name: document.title.trim() || SFENTON_REACT_APP_CARD_TAG,
  })
}
