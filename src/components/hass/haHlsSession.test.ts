import { createHaHlsSession, supportsLowLatencyHls, type HaHlsSession } from './haHlsSession'

interface HlsEventData {
  details?: string
  error?: unknown
  fatal?: boolean
  response?: { code?: number }
  type?: string
}

type HlsListener = (event: string, data: HlsEventData) => void

class FakeConnection {
  connected = true
  socket: object | undefined = {}
  readonly listeners = new Map<string, Set<() => void>>()
  readonly messages: Record<string, unknown>[] = []
  private streamSequence = 0

  addEventListener(event: 'ready' | 'disconnected', listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  removeEventListener(event: 'ready' | 'disconnected', listener: () => void) {
    this.listeners.get(event)?.delete(listener)
  }

  async sendMessagePromise<T>(message: { type: string; [key: string]: unknown }): Promise<T> {
    this.messages.push(message)
    if (message.type !== 'camera/stream') throw new Error(`Unexpected message: ${message.type}`)
    this.streamSequence += 1
    return { url: `/api/hls/stream-${this.streamSequence}/master_playlist.m3u8` } as T
  }

  disconnect() {
    this.connected = false
    this.socket = undefined
    for (const listener of this.listeners.get('disconnected') ?? []) listener()
  }

  reconnect() {
    this.socket = {}
    this.connected = true
    for (const listener of this.listeners.get('ready') ?? []) listener()
  }
}

class FakeHls {
  static readonly ErrorTypes = {
    MEDIA_ERROR: 'mediaError',
    NETWORK_ERROR: 'networkError',
  }

  static readonly Events = {
    ERROR: 'error',
    FRAG_LOADED: 'fragLoaded',
    MEDIA_ATTACHED: 'mediaAttached',
  }

  static readonly instances: FakeHls[] = []
  static readonly isSupported = vi.fn(() => true)

  readonly attachMedia = vi.fn((video: HTMLVideoElement) => {
    this.video = video
  })
  readonly destroy = vi.fn()
  readonly loadSource = vi.fn()
  readonly recoverMediaError = vi.fn()
  readonly listeners = new Map<string, HlsListener[]>()
  video: HTMLVideoElement | null = null

  constructor(readonly config: Record<string, unknown>) {
    FakeHls.instances.push(this)
  }

  on(event: string, listener: HlsListener) {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
  }

  emit(event: string, data: HlsEventData = {}) {
    for (const listener of this.listeners.get(event) ?? []) listener(event, data)
  }
}

function videoElement(nativeHls = false) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'canPlayType', {
    configurable: true,
    value: vi.fn(() => nativeHls ? 'maybe' : ''),
  })
  Object.defineProperty(video, 'currentTime', { configurable: true, value: 0, writable: true })
  Object.defineProperty(video, 'load', { configurable: true, value: vi.fn() })
  return video
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createHaHlsSession', () => {
  const sessions: HaHlsSession[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'))
    FakeHls.instances.length = 0
    FakeHls.isSupported.mockReset()
    FakeHls.isSupported.mockReturnValue(true)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    for (const session of sessions.splice(0)) session.stop()
    Reflect.deleteProperty(document, 'visibilityState')
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function startSession({
    connection = new FakeConnection(),
    nativeHls = false,
  }: {
    connection?: FakeConnection
    nativeHls?: boolean
  } = {}) {
    const statuses: string[] = []
    const errors: Error[] = []
    const video = videoElement(nativeHls)
    const session = createHaHlsSession({
      connection,
      entityId: 'camera.garage_camera',
      video,
      resolveUrl: (path) => new URL(path, 'https://ha.example.test').href,
      loadHls: async () => FakeHls,
      onError: (error) => errors.push(error),
      onStatusChange: (status) => statuses.push(status),
      random: () => 0.5,
    })
    sessions.push(session)
    session.start()
    return { connection, errors, session, statuses, video }
  }

  it('loads an HA HLS URL through hls.js and reports decoded video', async () => {
    const { connection, statuses, video } = startSession()
    await flushPromises()

    expect(connection.messages).toEqual([{
      type: 'camera/stream',
      entity_id: 'camera.garage_camera',
      format: 'hls',
    }])
    expect(connection.messages.some((message) => String(message.type).includes('webrtc'))).toBe(false)

    const hls = FakeHls.instances[0]
    expect(hls.config).toMatchObject({
      backBufferLength: 60,
      lowLatencyMode: true,
      maxLiveSyncPlaybackRate: 2,
    })
    expect(hls.attachMedia).toHaveBeenCalledWith(video)

    hls.emit(FakeHls.Events.MEDIA_ATTACHED)
    expect(hls.loadSource).toHaveBeenCalledWith('https://ha.example.test/api/hls/stream-1/master_playlist.m3u8')

    video.dispatchEvent(new Event('loadeddata'))
    expect(statuses).toEqual(['loading', 'live'])
  })

  it('uses native HLS when the browser advertises support', async () => {
    const { statuses, video } = startSession({ nativeHls: true })
    await flushPromises()

    expect(FakeHls.instances).toHaveLength(0)
    expect(video.src).toBe('https://ha.example.test/api/hls/stream-1/master_playlist.m3u8')
    expect(video.load).toHaveBeenCalledOnce()

    video.dispatchEvent(new Event('playing'))
    expect(statuses).toEqual(['loading', 'live'])
  })

  it('enables LL-HLS for multiplexed HTTP/2 and HTTP/3 connections', () => {
    const getEntries = vi.spyOn(performance, 'getEntriesByType')
    getEntries.mockImplementation((entryType) => entryType === 'navigation'
      ? [{ nextHopProtocol: 'h3' } as PerformanceResourceTiming]
      : [])
    expect(supportsLowLatencyHls(5)).toBe(true)

    getEntries.mockImplementation((entryType) => entryType === 'resource'
      ? [{ nextHopProtocol: 'h2' } as PerformanceResourceTiming]
      : [])
    expect(supportsLowLatencyHls(5)).toBe(true)

    getEntries.mockReturnValue([{ nextHopProtocol: 'http/1.1' } as PerformanceResourceTiming])
    expect(supportsLowLatencyHls(5)).toBe(false)
    expect(supportsLowLatencyHls(2)).toBe(true)
  })

  it('recovers one fatal media error in place before refreshing the HA stream URL', async () => {
    const { connection, statuses } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]

    firstHls.emit(FakeHls.Events.ERROR, { fatal: true, type: FakeHls.ErrorTypes.MEDIA_ERROR })
    expect(firstHls.recoverMediaError).toHaveBeenCalledOnce()
    expect(statuses.at(-1)).toBe('loading')

    firstHls.emit(FakeHls.Events.ERROR, { fatal: true, type: FakeHls.ErrorTypes.MEDIA_ERROR })
    expect(firstHls.destroy).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    expect(connection.messages).toHaveLength(2)
    expect(FakeHls.instances).toHaveLength(2)
  })

  it('requests a fresh HA stream URL after fatal network failure', async () => {
    const { connection, statuses } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]

    firstHls.emit(FakeHls.Events.ERROR, {
      details: 'manifestLoadError',
      fatal: true,
      response: { code: 401 },
      type: FakeHls.ErrorTypes.NETWORK_ERROR,
    })
    expect(firstHls.destroy).toHaveBeenCalledOnce()
    expect(statuses.at(-1)).toBe('loading')

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(connection.messages).toHaveLength(2)
    const secondHls = FakeHls.instances[1]
    secondHls.emit(FakeHls.Events.MEDIA_ATTACHED)
    expect(secondHls.loadSource).toHaveBeenCalledWith('https://ha.example.test/api/hls/stream-2/master_playlist.m3u8')
  })

  it('drops media on disconnect and obtains a fresh URL after reconnect', async () => {
    const { connection } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]

    connection.disconnect()
    expect(firstHls.destroy).toHaveBeenCalledOnce()

    connection.reconnect()
    await flushPromises()

    expect(connection.messages).toHaveLength(2)
    expect(FakeHls.instances).toHaveLength(2)
  })

  it('drops media immediately while offline and obtains a fresh URL when the browser returns online', async () => {
    const { connection } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]

    window.dispatchEvent(new Event('offline'))
    expect(firstHls.destroy).toHaveBeenCalledOnce()
    expect(connection.messages).toHaveLength(1)

    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(connection.messages).toHaveLength(2)
    expect(FakeHls.instances).toHaveLength(2)
  })

  it('releases hidden media after one minute and starts fresh when visible', async () => {
    const { connection } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(firstHls.destroy).toHaveBeenCalledOnce()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(connection.messages).toHaveLength(2)
    expect(FakeHls.instances).toHaveLength(2)
  })

  it('refreshes a visible stream that stops advancing but respects an intentional pause', async () => {
    const { connection, video } = startSession()
    await flushPromises()
    const firstHls = FakeHls.instances[0]
    Object.defineProperty(video, 'paused', { configurable: true, value: false, writable: true })
    video.dispatchEvent(new Event('loadeddata'))

    await vi.advanceTimersByTimeAsync(15_000)
    expect(firstHls.destroy).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    expect(connection.messages).toHaveLength(2)

    video.dispatchEvent(new Event('loadeddata'))
    Object.defineProperty(video, 'paused', { configurable: true, value: true, writable: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(FakeHls.instances[1].destroy).not.toHaveBeenCalled()
  })
})
