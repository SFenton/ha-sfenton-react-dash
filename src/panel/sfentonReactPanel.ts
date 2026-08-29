export const SFENTON_REACT_PANEL_TAG = 'sfenton-react-panel'
export const DEFAULT_REACT_DASHBOARD_URL = '/local/ha-sfenton-react-dash/index.html'
const REACT_DASHBOARD_DISPOSE_PROPERTY = '__sfentonReactDashboardDispose'

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

interface CustomPanelInfo {
  config?: {
    app_url?: unknown
  }
  title?: string
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
  private needsReload = false
  private panelInfo?: CustomPanelInfo

  set panel(value: CustomPanelInfo | undefined) {
    this.panelInfo = value
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
    disposeReactDashboardFrame(this.currentIframe(), 'panel-host-disconnected')
    this.needsReload = true
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
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #0b0f14;
          }

          iframe {
            display: block;
            width: 100%;
            height: 100%;
            border: 0;
            background: #0b0f14;
          }
        </style>
        <iframe
          allow="autoplay; camera; microphone; fullscreen"
          data-react-dashboard-panel="true"
          referrerpolicy="same-origin"
        ></iframe>
      `
    }

    const iframe = this.iframe()
    const configuredUrl = this.configuredAppUrl()
    if (this.needsReload || iframe.dataset.configuredAppUrl !== configuredUrl) {
      disposeReactDashboardFrame(
        iframe,
        this.needsReload ? 'panel-host-reconnected' : 'panel-source-change',
      )
      iframe.dataset.configuredAppUrl = configuredUrl
      iframe.src = reactDashboardUrl(configuredUrl)
      this.needsReload = false
    }
    this.syncTitle()
  }

  private currentIframe() {
    const iframe = this.shadowRoot?.querySelector('iframe')
    return iframe instanceof HTMLIFrameElement ? iframe : undefined
  }

  private iframe() {
    const iframe = this.currentIframe()
    if (!iframe) {
      throw new Error('The React dashboard custom panel iframe was not created.')
    }
    return iframe
  }

  private syncTitle() {
    if (!this.shadowRoot) return
    const title = this.panelInfo?.title?.trim() || this.ownerDocument.title
    this.iframe().title = title
  }
}

if (!customElements.get(SFENTON_REACT_PANEL_TAG)) {
  customElements.define(SFENTON_REACT_PANEL_TAG, SfentonReactPanel)
}
