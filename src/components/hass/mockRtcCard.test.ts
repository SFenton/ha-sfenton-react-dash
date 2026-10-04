import { waitFor } from '@testing-library/react'
import { resetMockRtcStreams } from './mockRtcCard'

type MockCard = HTMLElement & {
  setConfig: (config: Record<string, unknown>) => void
  video: HTMLVideoElement | null
}
type MockWindow = Window & {
  __mockCameraDelayMs?: number
  __mockCameraFrameDelayMs?: number
  __mockRtcCardCreations?: number
  __webrtcGetMuteState?: (cardId: string) => boolean | undefined
}

function mountCard(cardId: string, streamUrl?: string) {
  const card = document.createElement('webrtc-camera-sfenton') as MockCard
  card.setConfig({ card_id: cardId, muted: true, streams: streamUrl ? [{ url: streamUrl }] : [] })
  document.body.append(card)
  return card
}

describe('mock RTC card', () => {
  afterEach(() => {
    document.body.replaceChildren()
    resetMockRtcStreams()
    delete (window as MockWindow).__mockCameraDelayMs
    delete (window as MockWindow).__mockCameraFrameDelayMs
  })

  it('mirrors the card shadow structure and connects after the configured mock delay', async () => {
    ;(window as MockWindow).__mockCameraDelayMs = 20
    const card = mountCard('mock-delay')

    expect(card).toHaveAttribute('data-stream-status', 'connecting')
    expect(card.shadowRoot?.querySelector('ha-card .player .ptz-transform video')).toBeInTheDocument()
    await waitFor(() => expect(card).toHaveAttribute('data-stream-status', 'connected'))
  })

  it('does not connect after it leaves the document', async () => {
    ;(window as MockWindow).__mockCameraDelayMs = 20
    const card = mountCard('mock-removed')
    card.remove()

    await new Promise((resolve) => window.setTimeout(resolve, 40))
    expect(card).toHaveAttribute('data-stream-status', 'connecting')
  })

  it('publishes mute state for its own card id only', () => {
    mountCard('mock-audio')
    mountCard('mock-other')
    const audioStates: unknown[] = []
    const listener = (event: Event) => audioStates.push((event as CustomEvent).detail)
    window.addEventListener('webrtc-audio-state', listener)

    window.dispatchEvent(new CustomEvent('webrtc-unmute', { detail: { target_id: 'mock-audio' } }))

    expect(audioStates).toEqual([{ target_id: 'mock-audio', muted: false }])
    expect((window as MockWindow).__webrtcGetMuteState?.('mock-audio')).toBe(false)
    expect((window as MockWindow).__webrtcGetMuteState?.('mock-other')).toBe(true)
    window.removeEventListener('webrtc-audio-state', listener)
  })

  it('reports connected before its video decodes the first frame', async () => {
    ;(window as MockWindow).__mockCameraFrameDelayMs = 20
    const card = mountCard('mock-frame', 'mock_stream')
    const loaded = vi.fn()
    card.video?.addEventListener('loadeddata', loaded)

    await waitFor(() => expect(card).toHaveAttribute('data-stream-status', 'connected'))
    expect(card.video?.readyState).toBe(HTMLMediaElement.HAVE_NOTHING)
    await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1))
    expect(card.video?.readyState).toBe(HTMLMediaElement.HAVE_ENOUGH_DATA)
    expect(card.video?.videoWidth).toBeGreaterThan(0)
  })

  it('joins an already-live shared stream at once and keeps a decoded frame across reattachment', async () => {
    ;(window as MockWindow).__mockCameraDelayMs = 20
    ;(window as MockWindow).__mockCameraFrameDelayMs = 0
    const first = mountCard('mock-first', 'shared_stream')
    await waitFor(() => expect(first.video?.readyState).toBe(HTMLMediaElement.HAVE_ENOUGH_DATA))

    const creations = (window as MockWindow).__mockRtcCardCreations ?? 0
    const second = mountCard('mock-second', 'shared_stream')
    expect((window as MockWindow).__mockRtcCardCreations).toBe(creations + 1)
    expect(second).toHaveAttribute('data-stream-status', 'connected')
    expect(second.video?.readyState).toBe(HTMLMediaElement.HAVE_NOTHING)

    first.remove()
    document.body.append(first)
    expect(first).toHaveAttribute('data-stream-status', 'connected')
    expect(first.video?.readyState).toBe(HTMLMediaElement.HAVE_ENOUGH_DATA)
  })
})
