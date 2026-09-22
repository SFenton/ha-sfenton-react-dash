import type { CameraStreamStatus } from './cameraStreamStatus'

const CONNECT_TIMEOUT_MS = 30_000
const FAST_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000] as const
const HIDDEN_CLEANUP_MS = 60_000
const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl'
const SLOW_RETRY_MS = 60_000
const STALL_CHECK_MS = 5_000
const STALL_TIMEOUT_MS = 15_000

interface HaHlsConnection {
  readonly connected: boolean
  readonly socket?: unknown
  addEventListener: (event: 'ready' | 'disconnected', listener: () => void) => void
  removeEventListener: (event: 'ready' | 'disconnected', listener: () => void) => void
  sendMessagePromise: <T>(message: { type: string; [key: string]: unknown }) => Promise<T>
}

interface CameraStreamResponse {
  url: string
}

interface HlsErrorData {
  details?: string
  error?: unknown
  fatal?: boolean
  response?: { code?: number }
  type?: string
}

interface HlsInstance {
  attachMedia: (video: HTMLVideoElement) => void
  destroy: () => void
  loadSource: (url: string) => void
  on: (event: string, listener: (event: string, data: HlsErrorData) => void) => void
  recoverMediaError: () => void
}

interface HlsConstructor {
  new (config: {
    backBufferLength: number
    fragLoadingTimeOut: number
    levelLoadingTimeOut: number
    lowLatencyMode: boolean
    manifestLoadingTimeOut: number
    maxLiveSyncPlaybackRate: number
  }): HlsInstance
  readonly ErrorTypes: {
    MEDIA_ERROR: string
    NETWORK_ERROR: string
  }
  readonly Events: {
    ERROR: string
    FRAG_LOADED: string
    MEDIA_ATTACHED: string
  }
  isSupported: () => boolean
}

interface HaHlsSessionOptions {
  connection: HaHlsConnection
  entityId: `camera.${string}`
  video: HTMLVideoElement
  resolveUrl: (path: string) => string
  onError: (error: Error) => void
  onStatusChange: (status: CameraStreamStatus) => void
  loadHls?: () => Promise<HlsConstructor>
  mockPlayback?: boolean
  random?: () => number
}

export interface HaHlsSession {
  start: () => void
  stop: () => void
}

let activeHlsSessionCount = 0

function toException(value: unknown, fallback: string) {
  if (value instanceof Error) return value
  if (typeof value === 'string' && value.trim()) return new Error(value)
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return new Error(value.message)
  }
  return new Error(fallback)
}

function slowRetryDelay(random: () => number) {
  return Math.round(SLOW_RETRY_MS * (0.9 + random() * 0.2))
}

function isMultiplexedProtocol(protocol: string) {
  const normalized = protocol.toLowerCase()
  return normalized === 'h2'
    || normalized === 'http/2'
    || normalized === 'h3'
    || normalized === 'http/3'
    || normalized === 'quic'
    || normalized.startsWith('h3-')
}

export function supportsLowLatencyHls(streamCount = activeHlsSessionCount) {
  if (streamCount <= 2) return true
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return false

  return ['navigation', 'resource'].some((entryType) =>
    performance.getEntriesByType(entryType).some((entry) =>
      'nextHopProtocol' in entry
      && typeof entry.nextHopProtocol === 'string'
      && isMultiplexedProtocol(entry.nextHopProtocol),
    ),
  )
}

async function loadHlsLight() {
  const hlsModule = await import('hls.js/light')
  return hlsModule.default as unknown as HlsConstructor
}

function hlsFailure(data: HlsErrorData) {
  if (data.error) return toException(data.error, 'Unable to play camera stream')
  if (data.details === 'manifestLoadTimeOut') return new Error('Timed out while loading camera stream')
  if (data.response?.code) return new Error(`Camera stream request failed (${data.response.code})`)
  return new Error('Unable to play camera stream')
}

class BrowserHaHlsSession implements HaHlsSession {
  private activeAttempt = 0
  private connectTimer: number | null = null
  private hiddenTimer: number | null = null
  private hls: HlsInstance | null = null
  private mediaAttempt: number | null = null
  private mediaRecoveryAttempted = false
  private mockProgressTimer: number | null = null
  private mockReadyTimer: number | null = null
  private nativeSource = false
  private lastProgressAt = 0
  private lastVideoTime = 0
  private retryCount = 0
  private retryTimer: number | null = null
  private stalledTimer: number | null = null
  private started = false
  private status: CameraStreamStatus | null = null
  private suspendedWhileHidden = false
  private readonly options: HaHlsSessionOptions

  constructor(options: HaHlsSessionOptions) {
    this.options = options
  }

  start = () => {
    if (this.started) return
    this.started = true
    activeHlsSessionCount += 1
    this.options.connection.addEventListener('ready', this.handleConnectionReady)
    this.options.connection.addEventListener('disconnected', this.handleConnectionDisconnected)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('offline', this.handleNetworkOffline)
    window.addEventListener('online', this.handleNetworkOnline)
    this.options.video.addEventListener('error', this.handleVideoError)
    this.options.video.addEventListener('loadeddata', this.handleVideoReady)
    this.options.video.addEventListener('playing', this.handleVideoReady)
    this.publishStatus('loading')
    this.startAttempt()
  }

  stop = () => {
    if (!this.started) return
    this.started = false
    activeHlsSessionCount = Math.max(0, activeHlsSessionCount - 1)
    this.options.connection.removeEventListener('ready', this.handleConnectionReady)
    this.options.connection.removeEventListener('disconnected', this.handleConnectionDisconnected)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('offline', this.handleNetworkOffline)
    window.removeEventListener('online', this.handleNetworkOnline)
    this.options.video.removeEventListener('error', this.handleVideoError)
    this.options.video.removeEventListener('loadeddata', this.handleVideoReady)
    this.options.video.removeEventListener('playing', this.handleVideoReady)
    this.clearTimer('hiddenTimer')
    this.clearRetryTimer()
    this.invalidateAttempt()
  }

  private readonly handleConnectionReady = () => {
    if (!this.started) return
    this.retryCount = 0
    this.restartNow()
  }

  private readonly handleConnectionDisconnected = () => {
    if (!this.started) return
    this.clearRetryTimer()
    this.invalidateAttempt()
    this.publishStatus('loading')
  }

  private readonly handleNetworkOffline = () => {
    if (!this.started) return
    this.clearRetryTimer()
    this.invalidateAttempt()
    this.publishStatus('loading')
  }

  private readonly handleNetworkOnline = () => {
    if (!this.started || this.suspendedWhileHidden || document.visibilityState === 'hidden') return
    this.retryCount = 0
    if (this.options.connection.connected) this.restartNow()
  }

  private readonly handleVisibilityChange = () => {
    if (!this.started || document.pictureInPictureElement === this.options.video) return

    if (document.visibilityState === 'hidden') {
      this.clearTimer('hiddenTimer')
      this.hiddenTimer = window.setTimeout(() => {
        this.hiddenTimer = null
        if (!this.started || document.visibilityState !== 'hidden') return
        this.suspendedWhileHidden = true
        this.clearRetryTimer()
        this.invalidateAttempt()
      }, HIDDEN_CLEANUP_MS)
      return
    }

    this.clearTimer('hiddenTimer')
    if (this.suspendedWhileHidden) {
      this.suspendedWhileHidden = false
      this.retryCount = 0
      this.restartNow()
    } else if (this.mediaAttempt === null && this.retryTimer === null) {
      this.restartNow()
    }
  }

  private readonly handleVideoError = () => {
    const attempt = this.mediaAttempt
    if (attempt === null) return
    this.failAttempt(attempt, new Error('Unable to load camera stream'))
  }

  private readonly handleVideoReady = () => {
    if (!this.started || this.mediaAttempt !== this.activeAttempt) return
    this.clearTimer('connectTimer')
    this.retryCount = 0
    this.mediaRecoveryAttempted = false
    this.lastVideoTime = this.options.video.currentTime
    this.lastProgressAt = Date.now()
    this.publishStatus('live')
  }

  private restartNow() {
    this.clearRetryTimer()
    this.invalidateAttempt()
    this.publishStatus('loading')
    this.startAttempt()
  }

  private startAttempt() {
    if (!this.started || this.suspendedWhileHidden || document.visibilityState === 'hidden') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.publishStatus('loading')
      return
    }
    if (!this.options.connection.connected) {
      this.publishStatus('loading')
      return
    }

    const socket = this.options.connection.socket
    if (!socket) {
      this.scheduleRetry(new Error('Home Assistant WebSocket is not ready'))
      return
    }

    const attempt = ++this.activeAttempt
    this.armConnectTimer(attempt)
    void this.prepareStream(attempt, socket)
  }

  private async prepareStream(attempt: number, socket: unknown) {
    try {
      const stream = await this.options.connection.sendMessagePromise<CameraStreamResponse>({
        type: 'camera/stream',
        entity_id: this.options.entityId,
        format: 'hls',
      })
      if (!this.isCurrentAttempt(attempt, socket)) return
      if (!stream.url) throw new Error('Home Assistant returned an empty camera stream URL')

      const url = this.options.resolveUrl(stream.url)
      this.mediaAttempt = attempt
      this.mediaRecoveryAttempted = false

      if (this.options.mockPlayback) {
        this.startMockPlayback(attempt, socket)
        this.startStallWatch(attempt, socket)
        return
      }

      if (this.options.video.canPlayType(HLS_MIME_TYPE)) {
        this.nativeSource = true
        this.options.video.src = url
        this.options.video.load()
        this.startStallWatch(attempt, socket)
        return
      }

      const Hls = await (this.options.loadHls ?? loadHlsLight)()
      if (!this.isCurrentAttempt(attempt, socket)) return
      if (!Hls.isSupported()) {
        this.failPermanently(attempt, new Error('This browser cannot play the camera stream'))
        return
      }

      const hls = new Hls({
        backBufferLength: 60,
        fragLoadingTimeOut: CONNECT_TIMEOUT_MS,
        levelLoadingTimeOut: CONNECT_TIMEOUT_MS,
        lowLatencyMode: supportsLowLatencyHls(),
        manifestLoadingTimeOut: CONNECT_TIMEOUT_MS,
        maxLiveSyncPlaybackRate: 2,
      })
      this.hls = hls
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (this.isCurrentHlsAttempt(attempt, socket, hls)) hls.loadSource(url)
      })
      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (this.isCurrentHlsAttempt(attempt, socket, hls)) this.mediaRecoveryAttempted = false
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!this.isCurrentHlsAttempt(attempt, socket, hls) || !data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !this.mediaRecoveryAttempted) {
          this.mediaRecoveryAttempted = true
          this.publishStatus('loading')
          this.armConnectTimer(attempt)
          hls.recoverMediaError()
          return
        }
        this.failAttempt(attempt, hlsFailure(data))
      })
      hls.attachMedia(this.options.video)
      this.startStallWatch(attempt, socket)
    } catch (error) {
      this.failAttempt(attempt, toException(error, 'Unable to start camera stream'))
    }
  }

  private startMockPlayback(attempt: number, socket: unknown) {
    const configuredDelay = Number(
      (window as unknown as { __mockCameraDelayMs?: number }).__mockCameraDelayMs
      ?? new URLSearchParams(window.location.search).get('__mockCameraDelayMs')
      ?? 0,
    )
    const delay = Number.isFinite(configuredDelay) ? Math.max(0, configuredDelay) : 0
    this.mockReadyTimer = window.setTimeout(() => {
      this.mockReadyTimer = null
      if (!this.isCurrentAttempt(attempt, socket)) return
      Object.defineProperty(this.options.video, 'currentTime', { configurable: true, value: 0, writable: true })
      this.options.video.dispatchEvent(new Event('loadeddata'))
      this.options.video.dispatchEvent(new Event('playing'))
      this.mockProgressTimer = window.setInterval(() => {
        if (this.isCurrentAttempt(attempt, socket)) this.options.video.currentTime += 1
      }, 1_000)
    }, delay)
  }

  private startStallWatch(attempt: number, socket: unknown) {
    this.clearTimer('stalledTimer')
    this.lastVideoTime = this.options.video.currentTime
    this.lastProgressAt = Date.now()
    this.stalledTimer = window.setInterval(() => {
      if (!this.isCurrentAttempt(attempt, socket) || document.visibilityState === 'hidden' || this.status !== 'live') return

      const currentTime = this.options.video.currentTime
      if (this.options.video.paused || this.options.video.ended) {
        this.lastVideoTime = currentTime
        this.lastProgressAt = Date.now()
        return
      }
      if (currentTime > this.lastVideoTime + 0.01) {
        this.lastVideoTime = currentTime
        this.lastProgressAt = Date.now()
        return
      }

      if (Date.now() - this.lastProgressAt >= STALL_TIMEOUT_MS) {
        this.failAttempt(attempt, new Error('Camera stream stopped advancing'))
      }
    }, STALL_CHECK_MS)
  }

  private armConnectTimer(attempt: number) {
    this.clearTimer('connectTimer')
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null
      this.failAttempt(attempt, new Error('Timed out while starting camera stream'))
    }, CONNECT_TIMEOUT_MS)
  }

  private failPermanently(attempt: number, error: Error) {
    if (!this.started || attempt !== this.activeAttempt) return
    this.options.onError(error)
    this.invalidateAttempt()
    this.publishStatus('error')
  }

  private failAttempt(attempt: number, error: Error) {
    if (!this.started || attempt !== this.activeAttempt) return
    this.options.onError(error)
    this.invalidateAttempt()
    this.scheduleRetry(error)
  }

  private scheduleRetry(error: Error) {
    if (!this.started || this.suspendedWhileHidden || document.visibilityState === 'hidden' || !this.options.connection.connected) {
      this.publishStatus('loading')
      return
    }

    this.retryCount += 1
    const fastDelay = FAST_RETRY_DELAYS_MS[this.retryCount - 1]
    const delay = fastDelay ?? slowRetryDelay(this.options.random ?? Math.random)
    this.publishStatus(fastDelay === undefined ? 'error' : 'loading')
    this.clearRetryTimer()
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null
      if (!this.started) return
      this.publishStatus(fastDelay === undefined ? 'error' : 'loading')
      this.startAttempt()
    }, delay)

    if (!error.message) this.options.onError(new Error('Unable to recover camera stream'))
  }

  private invalidateAttempt() {
    this.activeAttempt += 1
    this.clearTimer('connectTimer')
    this.clearTimer('mockProgressTimer')
    this.clearTimer('mockReadyTimer')
    this.clearTimer('stalledTimer')

    const hls = this.hls
    const hadNativeSource = this.nativeSource
    this.hls = null
    this.mediaAttempt = null
    this.mediaRecoveryAttempted = false
    this.nativeSource = false

    hls?.destroy()
    if (hadNativeSource) {
      this.options.video.removeAttribute('src')
      this.options.video.load()
    }
  }

  private isCurrentAttempt(attempt: number, socket: unknown) {
    return this.started
      && attempt === this.activeAttempt
      && this.options.connection.connected
      && this.options.connection.socket === socket
  }

  private isCurrentHlsAttempt(attempt: number, socket: unknown, hls: HlsInstance) {
    return this.hls === hls && this.isCurrentAttempt(attempt, socket)
  }

  private clearRetryTimer() {
    this.clearTimer('retryTimer')
  }

  private clearTimer(name: 'connectTimer' | 'hiddenTimer' | 'mockProgressTimer' | 'mockReadyTimer' | 'retryTimer' | 'stalledTimer') {
    const timer = this[name]
    if (timer === null) return
    if (name === 'mockProgressTimer' || name === 'stalledTimer') window.clearInterval(timer)
    else window.clearTimeout(timer)
    this[name] = null
  }

  private publishStatus(status: CameraStreamStatus) {
    if (status === this.status) return
    this.status = status
    this.options.onStatusChange(status)
  }
}

export function createHaHlsSession(options: HaHlsSessionOptions): HaHlsSession {
  return new BrowserHaHlsSession(options)
}
