export const SFENTON_REACT_PANEL_TAG = 'sfenton-react-panel'
export const DEFAULT_REACT_DASHBOARD_URL = '/local/ha-sfenton-react-dash/index.html'

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
  private panelInfo?: CustomPanelInfo

  set panel(value: CustomPanelInfo | undefined) {
    this.panelInfo = value
    this.syncTitle()
  }

  get panel() {
    return this.panelInfo
  }

  connectedCallback() {
    this.render()
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
    if (this.shadowRoot) {
      this.syncTitle()
      return
    }

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

    const iframe = this.iframe()
    iframe.src = reactDashboardUrl(this.configuredAppUrl())
    this.syncTitle()
  }

  private iframe() {
    const iframe = this.shadowRoot?.querySelector('iframe')
    if (!(iframe instanceof HTMLIFrameElement)) {
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
