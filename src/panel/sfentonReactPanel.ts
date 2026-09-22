export const SFENTON_REACT_PANEL_TAG = 'sfenton-react-panel'
export const DEFAULT_REACT_DASHBOARD_URL = '/local/ha-sfenton-react-dash/index.html'
const REACT_DASHBOARD_DISPOSE_PROPERTY = '__sfentonReactDashboardDispose'
const REACT_DASHBOARD_FRAME_PROPERTY = '__sfentonReactDashboardPanelFrame'
const REACT_DASHBOARD_REATTACH_GRACE_MS = 5_000
const REACT_DASHBOARD_PANEL_PATH = '/sfenton-react-panel'
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

interface CustomPanelInfo {
  config?: {
    app_url?: unknown
  }
  title?: string
}

interface PersistentReactDashboardFrame {
  iframe: HTMLIFrameElement
  owner?: SfentonReactPanel
  releaseTimer?: number
}

type PanelHostWindow = Window & {
  [REACT_DASHBOARD_FRAME_PROPERTY]?: PersistentReactDashboardFrame
  MutationObserver?: typeof MutationObserver
  ResizeObserver?: typeof ResizeObserver
}

function panelHostWindow(panel: SfentonReactPanel) {
  const ownerWindow = panel.ownerDocument.defaultView
  if (!ownerWindow) throw new Error('The React dashboard custom panel requires a browser window.')

  try {
    const topWindow = ownerWindow.top
    if (topWindow && topWindow.location.origin === ownerWindow.location.origin) {
      return topWindow as PanelHostWindow
    }
  } catch {
    // Cross-origin embedding cannot share a frame with the top document.
  }

  return ownerWindow as PanelHostWindow
}

function createPersistentFrame(ownerDocument: Document) {
  const iframe = ownerDocument.createElement('iframe')
  iframe.allow = 'autoplay; camera; microphone; fullscreen'
  iframe.dataset.sfentonReactPanelFrame = 'true'
  iframe.referrerPolicy = 'same-origin'
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
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

function syncPersistentFrameGeometry(
  panel: SfentonReactPanel,
  iframe: HTMLIFrameElement,
  hostWindow: PanelHostWindow = panelHostWindow(panel),
) {
  const sourceWindow = panel.ownerDocument.defaultView
  if (!sourceWindow) return

  const embeddingFrame = sourceWindow !== hostWindow ? sourceWindow.frameElement : null
  const rect = embeddingFrame?.getBoundingClientRect() ?? panel.getBoundingClientRect()
  const usePanelWidth = rect.width > 0
  const usePanelHeight = rect.height > 0

  iframe.style.left = `${usePanelWidth ? rect.left : 0}px`
  iframe.style.top = `${usePanelHeight ? rect.top : 0}px`
  iframe.style.width = `${usePanelWidth ? rect.width : sourceWindow.innerWidth}px`
  iframe.style.height = `${usePanelHeight ? rect.height : sourceWindow.innerHeight}px`
}

function bridgePanelGeometryToDashboardFrame(
  panel: SfentonReactPanel,
  iframe: HTMLIFrameElement,
) {
  const sourceWindow = panel.ownerDocument.defaultView
  if (!sourceWindow) return () => undefined

  const hostWindow = panelHostWindow(panel)
  const embeddingFrame = sourceWindow !== hostWindow ? sourceWindow.frameElement : null
  const sync = () => syncPersistentFrameGeometry(panel, iframe, hostWindow)
  const sourceResizeObserver = sourceWindow.ResizeObserver
    ? new sourceWindow.ResizeObserver(sync)
    : undefined
  const hostResizeObserver = embeddingFrame && hostWindow.ResizeObserver
    ? new hostWindow.ResizeObserver(sync)
    : undefined
  const sourceMutationObserver = sourceWindow.MutationObserver
    ? new sourceWindow.MutationObserver(sync)
    : undefined
  const hostMutationObserver = embeddingFrame && hostWindow.MutationObserver
    ? new hostWindow.MutationObserver(sync)
    : undefined

  iframe.addEventListener('load', sync)
  sourceWindow.addEventListener('resize', sync)
  sourceWindow.addEventListener('orientationchange', sync)
  sourceWindow.addEventListener('pageshow', sync)
  if (hostWindow !== sourceWindow) {
    hostWindow.addEventListener('resize', sync)
    hostWindow.addEventListener('orientationchange', sync)
    hostWindow.addEventListener('pageshow', sync)
  }
  sourceResizeObserver?.observe(panel)
  sourceMutationObserver?.observe(panel, {
    attributeFilter: ['class', 'style'],
    attributes: true,
  })
  if (embeddingFrame) {
    hostResizeObserver?.observe(embeddingFrame)
    hostMutationObserver?.observe(embeddingFrame, {
      attributeFilter: ['class', 'style'],
      attributes: true,
    })
  }
  sync()

  return () => {
    iframe.removeEventListener('load', sync)
    sourceWindow.removeEventListener('resize', sync)
    sourceWindow.removeEventListener('orientationchange', sync)
    sourceWindow.removeEventListener('pageshow', sync)
    if (hostWindow !== sourceWindow) {
      hostWindow.removeEventListener('resize', sync)
      hostWindow.removeEventListener('orientationchange', sync)
      hostWindow.removeEventListener('pageshow', sync)
    }
    sourceResizeObserver?.disconnect()
    hostResizeObserver?.disconnect()
    sourceMutationObserver?.disconnect()
    hostMutationObserver?.disconnect()
  }
}

function disposePersistentFrame(
  hostWindow: PanelHostWindow,
  frame: PersistentReactDashboardFrame,
  reason: string,
) {
  if (frame.releaseTimer !== undefined) {
    hostWindow.clearTimeout(frame.releaseTimer)
    frame.releaseTimer = undefined
  }
  disposeReactDashboardFrame(frame.iframe, reason)
  frame.iframe.remove()
  if (hostWindow[REACT_DASHBOARD_FRAME_PROPERTY] === frame) {
    delete hostWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  }
}

function acquirePersistentFrame(panel: SfentonReactPanel) {
  const hostWindow = panelHostWindow(panel)
  let frame = hostWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  if (
    !frame
    || frame.iframe.ownerDocument !== hostWindow.document
    || !frame.iframe.isConnected
  ) {
    frame = { iframe: createPersistentFrame(hostWindow.document) }
    hostWindow[REACT_DASHBOARD_FRAME_PROPERTY] = frame
  }

  if (frame.releaseTimer !== undefined) {
    hostWindow.clearTimeout(frame.releaseTimer)
    frame.releaseTimer = undefined
  }
  frame.owner = panel
  frame.iframe.hidden = false
  syncPersistentFrameGeometry(panel, frame.iframe, hostWindow)
  return frame
}

function releasePersistentFrame(panel: SfentonReactPanel) {
  const hostWindow = panelHostWindow(panel)
  const frame = hostWindow[REACT_DASHBOARD_FRAME_PROPERTY]
  if (!frame || frame.owner !== panel) return

  frame.owner = undefined
  const currentPath = hostWindow.location.pathname.replace(/\/+$/, '')
  if (currentPath !== REACT_DASHBOARD_PANEL_PATH) {
    disposePersistentFrame(hostWindow, frame, 'panel-host-disconnected')
    return
  }

  frame.releaseTimer = hostWindow.setTimeout(() => {
    if (frame.owner || hostWindow[REACT_DASHBOARD_FRAME_PROPERTY] !== frame) return
    disposePersistentFrame(hostWindow, frame, 'panel-host-disconnected')
  }, REACT_DASHBOARD_REATTACH_GRACE_MS)
}

export function reactDashboardUrl(
  configuredUrl: string = DEFAULT_REACT_DASHBOARD_URL,
  cacheBust: number = Date.now(),
  origin: string = window.location.origin,
) {
  const url = new URL(configuredUrl, origin)
  if (url.origin !== origin) {
    throw new Error('The React dashboard custom panel must load a same-origin app URL.')
  }
  url.searchParams.set('v', String(cacheBust))
  return url.href
}

export class SfentonReactPanel extends HTMLElement {
  private panelInfo?: CustomPanelInfo
  private releaseFrameBridges?: () => void

  set panel(value: CustomPanelInfo | undefined) {
    this.panelInfo = value
    this.configuredAppUrl()
    if (this.isConnected) this.render()
    else this.syncTitle()
  }

  get panel() {
    return this.panelInfo
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    this.releaseFrameBridges?.()
    this.releaseFrameBridges = undefined
    releasePersistentFrame(this)
  }

  private configuredAppUrl() {
    const configuredUrl = this.panelInfo?.config?.app_url
    if (configuredUrl === undefined) return DEFAULT_REACT_DASHBOARD_URL
    if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) {
      throw new Error('panel_custom config.app_url must be a non-empty string.')
    }
    return configuredUrl
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
    const configuredUrl = this.configuredAppUrl()
    if (iframe.dataset.configuredAppUrl !== configuredUrl) {
      disposeReactDashboardFrame(iframe, 'panel-source-change')
      iframe.dataset.configuredAppUrl = configuredUrl
      iframe.src = reactDashboardUrl(configuredUrl)
    }
    this.syncTitle()
    this.connectFrameBridges()
  }

  private iframe() {
    return acquirePersistentFrame(this).iframe
  }

  private connectFrameBridges() {
    if (!this.isConnected || this.releaseFrameBridges) return
    const iframe = this.iframe()
    const releaseSafeAreaBridge = bridgeSafeAreaToDashboardFrame(this, iframe)
    const releaseGeometryBridge = bridgePanelGeometryToDashboardFrame(this, iframe)
    this.releaseFrameBridges = () => {
      releaseSafeAreaBridge()
      releaseGeometryBridge()
    }
  }

  private syncTitle() {
    if (!this.isConnected) return
    const title = this.panelInfo?.title?.trim() || this.ownerDocument.title
    this.iframe().title = title
  }
}

if (!customElements.get(SFENTON_REACT_PANEL_TAG)) {
  customElements.define(SFENTON_REACT_PANEL_TAG, SfentonReactPanel)
}
