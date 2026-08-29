export const SFENTON_REACT_APP_CARD_TAG = 'sfenton-react-app-card'
export const DEFAULT_REACT_DASHBOARD_CARD_URL = '/local/ha-sfenton-react-dash/index.html'
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

interface ReactDashboardCardConfig {
  title?: unknown
  url?: unknown
}

interface CustomCardMetadata {
  name: string
  type: string
}

type CustomCardWindow = Window & {
  customCards?: CustomCardMetadata[]
}

export class SfentonReactAppCard extends HTMLElement {
  private config: ReactDashboardCardConfig = {}
  private needsReload = false

  setConfig(config: ReactDashboardCardConfig | undefined) {
    this.config = config ?? {}
    this.render()
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    disposeReactDashboardFrame(this.currentIframe(), 'legacy-card-disconnected')
    this.needsReload = true
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
            z-index: 1;
            display: block;
            width: 100vw;
            height: 100vh;
            height: 100lvh;
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
          referrerpolicy="same-origin"
        ></iframe>
      `
    }

    const iframe = this.iframe()
    const configuredUrl = this.configuredUrl()
    if (this.needsReload || iframe.src !== configuredUrl.resolvedUrl.href) {
      disposeReactDashboardFrame(
        iframe,
        this.needsReload ? 'legacy-card-reconnected' : 'legacy-card-source-change',
      )
      iframe.src = configuredUrl.source
      this.needsReload = false
    }
    iframe.title = this.iframeTitle()
  }

  private currentIframe() {
    const iframe = this.shadowRoot?.querySelector('iframe')
    return iframe instanceof HTMLIFrameElement ? iframe : undefined
  }

  private iframe() {
    const iframe = this.currentIframe()
    if (!iframe) throw new Error('The React dashboard card iframe was not created.')
    return iframe
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
