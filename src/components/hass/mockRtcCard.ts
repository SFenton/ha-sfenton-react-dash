// Mock-mode stand-in for the pinned `webrtc-camera-sfenton` card. It mirrors the card's
// shadow structure, `data-stream-status` lifecycle, shared-stream reuse, first decoded
// video frame and audio events so mock browsers can exercise the RTC adapter without a
// Home Assistant host. It never proves real media.
const RTC_CARD_TAG = 'webrtc-camera-sfenton'
const MOCK_FRAME_WIDTH = 1280
const MOCK_FRAME_HEIGHT = 720
const DEFAULT_FRAME_DELAY_MS = 40
const muteStates = new Map<string, boolean>()
// The real shared stream manager keeps one peer per stream, so a card attached to an
// already-live stream reports `connected` at once while its new video still waits a frame.
const liveStreams = new Set<string>()

type MockRtcWindow = Window & {
  __mockCameraDelayMs?: number
  __mockCameraFrameDelayMs?: number
  __mockRtcCardCreations?: number
  __webrtcGetMuteState?: (cardId: string) => boolean | undefined
}

interface MockRtcConfig {
  card_id?: string
  muted?: boolean
  streams?: { url?: string }[]
}

function configuredDelayMs(key: '__mockCameraDelayMs' | '__mockCameraFrameDelayMs', fallback: number) {
  const configured = Number(
    (window as MockRtcWindow)[key]
    ?? new URLSearchParams(window.location.search).get(key)
    ?? fallback,
  )
  return Number.isFinite(configured) ? Math.max(0, configured) : fallback
}

export function resetMockRtcStreams() {
  liveStreams.clear()
}

class MockRtcCard extends HTMLElement {
  hass: unknown
  private cardId = ''
  private streamUrl = ''
  private frameReady = false
  private readyTimer: number | null = null
  private frameTimer: number | null = null

  constructor() {
    super()
    const mockWindow = window as MockRtcWindow
    mockWindow.__mockRtcCardCreations = (mockWindow.__mockRtcCardCreations ?? 0) + 1
  }

  get video(): HTMLVideoElement | null {
    return this.shadowRoot?.querySelector('video') ?? null
  }

  private readonly handleAudio = (event: Event) => {
    const detail = (event as CustomEvent<{ target_id?: string }>).detail
    if (detail?.target_id !== this.cardId) return
    const muted = event.type === 'webrtc-mute'
    muteStates.set(this.cardId, muted)
    window.dispatchEvent(new CustomEvent('webrtc-audio-state', { detail: { target_id: this.cardId, muted } }))
  }

  setConfig(config: MockRtcConfig) {
    this.cardId = config.card_id ?? ''
    this.streamUrl = config.streams?.[0]?.url ?? ''
    muteStates.set(this.cardId, config.muted !== false)
  }

  private attachVideoState(video: HTMLVideoElement) {
    // A mock video has no decoder, so it reports the decoded-frame state the real card's video
    // reaches after its MediaStream delivers the first frame.
    Object.defineProperties(video, {
      readyState: { configurable: true, get: () => (this.frameReady ? HTMLMediaElement.HAVE_ENOUGH_DATA : HTMLMediaElement.HAVE_NOTHING) },
      videoWidth: { configurable: true, get: () => (this.frameReady ? MOCK_FRAME_WIDTH : 0) },
      videoHeight: { configurable: true, get: () => (this.frameReady ? MOCK_FRAME_HEIGHT : 0) },
    })
  }

  private connect() {
    this.setAttribute('data-stream-status', 'connected')
    if (this.streamUrl) liveStreams.add(this.streamUrl)
    if (this.frameReady || this.frameTimer !== null) return
    this.frameTimer = window.setTimeout(() => {
      this.frameTimer = null
      this.frameReady = true
      this.video?.dispatchEvent(new Event('loadeddata'))
    }, configuredDelayMs('__mockCameraFrameDelayMs', DEFAULT_FRAME_DELAY_MS))
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).innerHTML = `<style>
        ha-card { display: block; background: linear-gradient(135deg, #3d5a4c, #6f8f7a 55%, #b7c7a3); }
        video { display: block; width: 100%; }
      </style><ha-card><div class="player"><div class="ptz-transform">
        <video muted playsinline></video>
      </div></div></ha-card>`
      if (this.video) this.attachVideoState(this.video)
    }
    window.addEventListener('webrtc-mute', this.handleAudio)
    window.addEventListener('webrtc-unmute', this.handleAudio)
    if (this.streamUrl && liveStreams.has(this.streamUrl)) {
      this.connect()
      return
    }
    this.setAttribute('data-stream-status', 'connecting')
    this.readyTimer = window.setTimeout(() => {
      this.readyTimer = null
      this.connect()
    }, configuredDelayMs('__mockCameraDelayMs', 0))
  }

  disconnectedCallback() {
    if (this.readyTimer !== null) window.clearTimeout(this.readyTimer)
    if (this.frameTimer !== null) window.clearTimeout(this.frameTimer)
    this.readyTimer = null
    this.frameTimer = null
    window.removeEventListener('webrtc-mute', this.handleAudio)
    window.removeEventListener('webrtc-unmute', this.handleAudio)
  }
}

if (!customElements.get(RTC_CARD_TAG)) {
  customElements.define(RTC_CARD_TAG, MockRtcCard)
  ;(window as MockRtcWindow).__webrtcGetMuteState = (cardId) => muteStates.get(cardId)
}
