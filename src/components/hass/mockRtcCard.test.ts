import { waitFor } from '@testing-library/react'
import './mockRtcCard'

type MockCard = HTMLElement & { setConfig: (config: Record<string, unknown>) => void }
type MockWindow = Window & {
  __mockCameraDelayMs?: number
  __webrtcGetMuteState?: (cardId: string) => boolean | undefined
}

function mountCard(cardId: string) {
  const card = document.createElement('webrtc-camera-sfenton') as MockCard
  card.setConfig({ card_id: cardId, muted: true })
  document.body.append(card)
  return card
}

describe('mock RTC card', () => {
  afterEach(() => {
    document.body.replaceChildren()
    delete (window as MockWindow).__mockCameraDelayMs
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
})
