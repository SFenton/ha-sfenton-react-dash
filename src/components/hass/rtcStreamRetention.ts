// App-wide retention for shared RTC camera streams.
//
// The pinned card's shared stream manager pools one peer connection per stream key, so a
// page tile and its camera modal already render the same MediaStream. The manager closes a
// stream 30 s after its last card unmounts, which forced a fresh connection whenever a route
// change unmounted the cameras. Once a camera is shown, this module keeps one passive
// subscriber on that stream for the rest of the app session so every later tile or modal
// attaches to the live stream immediately. The manager still releases peers while the
// document is hidden and reconnects them when it becomes visible again.

export interface RtcStreamConfig {
  url: string
  mode: 'webrtc'
  media: 'video,audio'
}

type RtcStreamCallback = (stream: MediaStream | null, status: string, mode: string | null) => void

interface RtcSharedStreamManager {
  subscribe: (config: RtcStreamConfig, callback: RtcStreamCallback) => () => void
}

type RtcStreamManagerWindow = Window & {
  __webrtcStreamManager?: RtcSharedStreamManager
}

const retainedStreams = new Map<string, () => void>()

export function rtcStreamConfig(streamId: string): RtcStreamConfig {
  return { url: streamId, mode: 'webrtc', media: 'video,audio' }
}

function sharedStreamManager() {
  const manager = (window as RtcStreamManagerWindow).__webrtcStreamManager
  return typeof manager?.subscribe === 'function' ? manager : null
}

export function retainRtcStream(streamId: string) {
  if (retainedStreams.has(streamId)) return
  const manager = sharedStreamManager()
  if (!manager) return

  let unsubscribe: (() => void) | null = null
  let failed = false
  const release = () => {
    if (retainedStreams.get(streamId) === release) retainedStreams.delete(streamId)
    const stop = unsubscribe
    unsubscribe = null
    stop?.()
  }
  retainedStreams.set(streamId, release)
  // A stream that exhausts its reconnect attempts stays in error while it has subscribers.
  // Dropping the passive subscriber lets the manager discard it, so the next mount starts fresh.
  unsubscribe = manager.subscribe(rtcStreamConfig(streamId), (_stream, status) => {
    if (status !== 'error') return
    failed = true
    release()
  })
  if (failed) {
    const stop = unsubscribe
    unsubscribe = null
    stop?.()
  }
}

export function isRtcStreamRetained(streamId: string) {
  return retainedStreams.has(streamId)
}

export function releaseRetainedRtcStreams() {
  for (const release of [...retainedStreams.values()]) release()
}
