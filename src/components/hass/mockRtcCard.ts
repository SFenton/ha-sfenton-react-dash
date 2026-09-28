// Mock-mode stand-in for the pinned `webrtc-camera-sfenton` card. It mirrors the card's
// shadow structure, `data-stream-status` lifecycle and audio events so mock browsers can
// exercise the RTC adapter without a Home Assistant host. It never proves real media.
const RTC_CARD_TAG = 'webrtc-camera-sfenton'
const muteStates = new Map<string, boolean>()

type MockRtcWindow = Window & {
  __mockCameraDelayMs?: number
  __webrtcGetMuteState?: (cardId: string) => boolean | undefined
}

function mockDelayMs() {
  const configured = Number(
    (window as MockRtcWindow).__mockCameraDelayMs
    ?? new URLSearchParams(window.location.search).get('__mockCameraDelayMs')
    ?? 0,
  )
  return Number.isFinite(configured) ? Math.max(0, configured) : 0
}

class MockRtcCard extends HTMLElement {
  hass: unknown
  private cardId = ''
  private readyTimer: number | null = null

  private readonly handleAudio = (event: Event) => {
    const detail = (event as CustomEvent<{ target_id?: string }>).detail
    if (detail?.target_id !== this.cardId) return
    const muted = event.type === 'webrtc-mute'
    muteStates.set(this.cardId, muted)
    window.dispatchEvent(new CustomEvent('webrtc-audio-state', { detail: { target_id: this.cardId, muted } }))
  }

  setConfig(config: { card_id?: string; muted?: boolean }) {
    this.cardId = config.card_id ?? ''
    muteStates.set(this.cardId, config.muted !== false)
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).innerHTML = `<style>
        ha-card { display: block; background: linear-gradient(135deg, #3d5a4c, #6f8f7a 55%, #b7c7a3); }
        video { display: block; width: 100%; }
      </style><ha-card><div class="player"><div class="ptz-transform">
        <video muted playsinline></video>
      </div></div></ha-card>`
    }
    this.setAttribute('data-stream-status', 'connecting')
    window.addEventListener('webrtc-mute', this.handleAudio)
    window.addEventListener('webrtc-unmute', this.handleAudio)
    this.readyTimer = window.setTimeout(() => {
      this.readyTimer = null
      this.setAttribute('data-stream-status', 'connected')
    }, mockDelayMs())
  }

  disconnectedCallback() {
    if (this.readyTimer !== null) window.clearTimeout(this.readyTimer)
    this.readyTimer = null
    window.removeEventListener('webrtc-mute', this.handleAudio)
    window.removeEventListener('webrtc-unmute', this.handleAudio)
  }
}

if (!customElements.get(RTC_CARD_TAG)) {
  customElements.define(RTC_CARD_TAG, MockRtcCard)
  ;(window as MockRtcWindow).__webrtcGetMuteState = (cardId) => muteStates.get(cardId)
}
