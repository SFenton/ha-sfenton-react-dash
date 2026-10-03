import {
  isRtcStreamRetained,
  releaseRetainedRtcStreams,
  retainRtcStream,
  rtcStreamConfig,
} from './rtcStreamRetention'

type StreamCallback = (stream: MediaStream | null, status: string, mode: string | null) => void

function stubStreamManager() {
  const callbacks: StreamCallback[] = []
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((_config: unknown, callback: StreamCallback) => {
    callbacks.push(callback)
    return unsubscribe
  })
  vi.stubGlobal('__webrtcStreamManager', { subscribe })
  return { callbacks, subscribe, unsubscribe }
}

describe('RTC stream retention', () => {
  beforeEach(() => {
    releaseRetainedRtcStreams()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    releaseRetainedRtcStreams()
    vi.unstubAllGlobals()
  })

  it('matches the shared stream configuration every dashboard camera card uses', () => {
    expect(rtcStreamConfig('garage_camera')).toEqual({ url: 'garage_camera', mode: 'webrtc', media: 'video,audio' })
  })

  it('holds one passive subscription per stream for the app session', () => {
    const manager = stubStreamManager()

    retainRtcStream('garage_camera')
    retainRtcStream('garage_camera')
    retainRtcStream('front_door')

    expect(manager.subscribe).toHaveBeenCalledTimes(2)
    expect(manager.subscribe).toHaveBeenNthCalledWith(1, rtcStreamConfig('garage_camera'), expect.any(Function))
    expect(manager.subscribe).toHaveBeenNthCalledWith(2, rtcStreamConfig('front_door'), expect.any(Function))
    manager.callbacks.forEach((callback) => callback(null, 'connecting', null))
    manager.callbacks.forEach((callback) => callback(null, 'disconnected', null))
    expect(manager.unsubscribe).not.toHaveBeenCalled()
    expect(isRtcStreamRetained('garage_camera')).toBe(true)
  })

  it('lets a stream that exhausted its reconnects close and retains it again on the next mount', () => {
    const manager = stubStreamManager()

    retainRtcStream('garage_camera')
    manager.callbacks[0](null, 'error', null)

    expect(manager.unsubscribe).toHaveBeenCalledTimes(1)
    expect(isRtcStreamRetained('garage_camera')).toBe(false)

    retainRtcStream('garage_camera')
    expect(manager.subscribe).toHaveBeenCalledTimes(2)
    expect(isRtcStreamRetained('garage_camera')).toBe(true)
  })

  it('does not hold a stream that is already in error when subscribed', () => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn((_config: unknown, callback: StreamCallback) => {
      callback(null, 'error', null)
      return unsubscribe
    })
    vi.stubGlobal('__webrtcStreamManager', { subscribe })

    retainRtcStream('garage_camera')

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(isRtcStreamRetained('garage_camera')).toBe(false)
  })

  it('does nothing when the shared stream manager is not loaded', () => {
    retainRtcStream('garage_camera')
    expect(isRtcStreamRetained('garage_camera')).toBe(false)
  })
})
