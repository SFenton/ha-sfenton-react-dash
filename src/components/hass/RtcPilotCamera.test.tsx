// @covers src/constants/rtcPilot.ts
// @covers src/components/hass/rtcStreamRetention.ts
import { act, render, waitFor } from '@testing-library/react'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { resetMockHass, setMockConnectionStatus } from '../../test/mocks/hakitCoreState'
import {
  getCameraStreamMuteState,
  subscribeCameraStreamMuteState,
  takeCameraStreamSnapshot,
  toggleCameraStreamMuted,
} from './cameraStreamActions'
import { RtcPilotCamera } from './RtcPilotCamera'
import { isRtcStreamRetained, releaseRetainedRtcStreams } from './rtcStreamRetention'

interface FakeRtcConfig {
  card_id: string
  shared: boolean
  streams: { url: string; mode: string; media: string }[]
}

class FakeRtcCard extends HTMLElement {
  static failuresRemaining = 0
  configuration?: FakeRtcConfig
  hassState?: unknown
  setConfig(config: FakeRtcConfig) {
    if (FakeRtcCard.failuresRemaining > 0) {
      FakeRtcCard.failuresRemaining -= 1
      throw new Error('RTC configuration failed')
    }
    this.configuration = config
  }
  set hass(state: unknown) {
    this.hassState = state
  }
  get hass() {
    return this.hassState
  }
  connectedCallback() {
    this.setAttribute('data-stream-status', 'connecting')
  }
}

if (!customElements.get('webrtc-camera-sfenton')) {
  customElements.define('webrtc-camera-sfenton', FakeRtcCard)
}

const driveway = CAMERA_ITEMS.find((camera) => camera.entityId === 'camera.garage_camera')!

describe('RTC camera', () => {
  beforeEach(() => {
    resetMockHass()
    setMockConnectionStatus('connected')
    FakeRtcCard.failuresRemaining = 0
    releaseRetainedRtcStreams()
  })

  it('uses an HA-signed shared video-and-audio stream and requires decoded status for Live', async () => {
    const onStatusChange = vi.fn()
    const view = render(
      <RtcPilotCamera camera={driveway} controls errorLabel="Camera unavailable" fill
        minHeight={310} onStatusChange={onStatusChange} variant="modal" />,
    )
    const card = await waitFor(() => {
      const element = view.container.querySelector('webrtc-camera-sfenton')
      expect(element).toBeInTheDocument()
      return element as FakeRtcCard
    })

    expect(card.configuration).toMatchObject({
      card_id: driveway.popupCardId,
      muted: true,
      shared: true,
      streams: [{ url: 'garage_camera', mode: 'webrtc', media: 'video,audio' }],
    })
    expect(view.container.querySelector('[data-camera-transport="webrtc"]')).toHaveAttribute('data-loaded', 'false')
    expect(onStatusChange).not.toHaveBeenCalledWith('live')
    expect(card).toHaveAttribute('data-dashboard-visible', 'false')
    expect(card).toHaveAttribute('aria-hidden', 'true')
    expect(card).toHaveAttribute('inert')

    act(() => card.setAttribute('data-stream-status', 'connected'))
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('live'))
    expect(view.container.querySelector('[data-status="live"]')).toHaveAttribute('data-loaded', 'true')
    expect(card).toHaveAttribute('data-dashboard-visible', 'true')
    expect(card).not.toHaveAttribute('aria-hidden')
    expect(card).not.toHaveAttribute('inert')

    act(() => card.setAttribute('data-stream-status', 'disconnected'))
    await waitFor(() => expect(view.container.querySelector('[data-status="loading"]')).toBeInTheDocument())
    expect(card).toHaveAttribute('data-dashboard-visible', 'false')
    expect(card).toHaveAttribute('aria-hidden', 'true')
    expect(card).toHaveAttribute('inert')

    act(() => card.setAttribute('data-stream-status', 'connecting'))
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith('loading'))
    expect(card).toHaveAttribute('data-dashboard-visible', 'false')

    act(() => card.setAttribute('data-stream-status', 'connected'))
    await waitFor(() => expect(card).toHaveAttribute('data-dashboard-visible', 'true'))

    act(() => card.setAttribute('data-stream-status', 'error'))
    await waitFor(() => expect(view.container).toHaveTextContent('Camera unavailable'))
    expect(card).toHaveAttribute('data-dashboard-visible', 'false')
    expect(card).toHaveAttribute('aria-hidden', 'true')
    expect(card).toHaveAttribute('inert')
    view.unmount()
  })

  it('keeps a shown stream pooled across page unmounts so tiles and modals reattach without reconnecting', async () => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn(() => unsubscribe)
    vi.stubGlobal('__webrtcStreamManager', { subscribe })

    const tile = render(<RtcPilotCamera camera={driveway} minHeight={190} variant="tile" />)
    const tileCard = await waitFor(() => {
      const card = tile.container.querySelector('webrtc-camera-sfenton')
      expect(card).toBeInTheDocument()
      return card as FakeRtcCard
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith(tileCard.configuration?.streams[0], expect.any(Function))
    expect(isRtcStreamRetained('garage_camera')).toBe(true)

    tile.unmount()
    expect(unsubscribe).not.toHaveBeenCalled()

    const modal = render(<RtcPilotCamera camera={driveway} controls fill minHeight={310} variant="modal" />)
    const modalCard = await waitFor(() => {
      const card = modal.container.querySelector('webrtc-camera-sfenton')
      expect(card).toBeInTheDocument()
      return card as FakeRtcCard
    })
    expect(modalCard.configuration?.card_id).toBe(driveway.popupCardId)
    expect(modalCard.configuration?.streams).toEqual(tileCard.configuration?.streams)
    expect(subscribe).toHaveBeenCalledTimes(1)
    modal.unmount()
    expect(unsubscribe).not.toHaveBeenCalled()

    releaseRetainedRtcStreams()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('marks tile and fill-modal hosts for scoped full-height sizing', async () => {
    const tile = render(<RtcPilotCamera camera={driveway} minHeight={190} variant="tile" />)
    const modal = render(<RtcPilotCamera camera={driveway} fill minHeight={310} variant="modal" />)
    const tileCard = await waitFor(() => {
      const card = tile.container.querySelector('webrtc-camera-sfenton')
      expect(card).toBeInTheDocument()
      return card as FakeRtcCard
    })
    const modalCard = await waitFor(() => {
      const card = modal.container.querySelector('webrtc-camera-sfenton')
      expect(card).toBeInTheDocument()
      return card as FakeRtcCard
    })

    expect(tileCard.className).toBeTruthy()
    expect(tileCard.className).toBe(modalCard.className)
    expect(tileCard).toHaveAttribute('data-dashboard-variant', 'tile')
    expect(modalCard).toHaveAttribute('data-dashboard-variant', 'modal')
    expect(modalCard).toHaveAttribute('data-dashboard-fill', 'true')
    tile.unmount()
    modal.unmount()
  })

  it('retains one mounted card when the Home Assistant connection reconnects', async () => {
    const view = render(<RtcPilotCamera camera={driveway} minHeight={190} variant="tile" />)
    const card = await waitFor(() => {
      const element = view.container.querySelector('webrtc-camera-sfenton')
      expect(element).toBeInTheDocument()
      return element as FakeRtcCard
    })
    const initialHass = card.hassState

    act(() => setMockConnectionStatus('disconnected'))
    act(() => setMockConnectionStatus('connected'))

    expect(view.container.querySelector('webrtc-camera-sfenton')).toBe(card)
    expect(card.hassState).toBe(initialHass)
    view.unmount()
  })

  it('delegates mute and snapshot actions to the card and listens for its actual audio state', async () => {
    const states = new Map([[driveway.popupCardId, true]])
    vi.stubGlobal('__webrtcGetMuteState', (id: string) => states.get(id))
    const events = vi.spyOn(window, 'dispatchEvent')
    const onMuteState = vi.fn()
    const unsubscribe = subscribeCameraStreamMuteState(onMuteState)
    const view = render(<RtcPilotCamera camera={driveway} minHeight={310} variant="modal" />)
    await waitFor(() => expect(view.container.querySelector('webrtc-camera-sfenton')).toBeInTheDocument())

    act(() => {
      toggleCameraStreamMuted(driveway.popupCardId)
      takeCameraStreamSnapshot(driveway.popupCardId)
    })
    expect(events.mock.calls.map(([event]) => event.type)).toContain('webrtc-unmute')
    expect(events.mock.calls.map(([event]) => event.type)).toContain('webrtc-screenshot')

    states.set(driveway.popupCardId, false)
    act(() => window.dispatchEvent(new CustomEvent('webrtc-audio-state', {
      detail: { target_id: driveway.popupCardId, muted: false },
    })))
    expect(getCameraStreamMuteState(driveway.popupCardId)).toBe(false)
    expect(onMuteState).toHaveBeenCalledWith({ targetId: driveway.popupCardId, muted: false })

    view.unmount()
    unsubscribe()
    events.mockRestore()
    vi.unstubAllGlobals()
  })

  it('surfaces an unmapped camera instead of pretending it is live', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = render(<RtcPilotCamera camera={{ ...driveway, rtcStreamId: undefined }}
      errorLabel="Camera unavailable" minHeight={190} variant="tile" />)

    await waitFor(() => expect(view.container.querySelector('[data-status="error"]')).toBeInTheDocument())
    expect(view.container.querySelector('webrtc-camera-sfenton')).not.toBeInTheDocument()
    expect(view.container).toHaveTextContent('Camera unavailable')
    expect(errorLog).toHaveBeenCalledWith('Unable to start RTC camera:', expect.any(Error))
    view.unmount()
    errorLog.mockRestore()
  })

  it('retries a failed card setup after HA reconnects without reloading the page', async () => {
    FakeRtcCard.failuresRemaining = 1
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = render(<RtcPilotCamera camera={driveway} errorLabel="Camera unavailable"
      minHeight={190} variant="tile" />)

    await waitFor(() => expect(view.container.querySelector('[data-status="error"]')).toBeInTheDocument())
    expect(view.container.querySelector('webrtc-camera-sfenton')).not.toBeInTheDocument()

    act(() => setMockConnectionStatus('disconnected'))
    act(() => setMockConnectionStatus('connected'))

    await waitFor(() => expect(view.container.querySelector('webrtc-camera-sfenton')).toBeInTheDocument())
    expect(view.container.querySelector('[data-status="loading"]')).toBeInTheDocument()
    view.unmount()
    errorLog.mockRestore()
  })

  it('retries a transient card setup failure without waiting for HA to reconnect', async () => {
    FakeRtcCard.failuresRemaining = 1
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = render(<RtcPilotCamera camera={driveway} errorLabel="Camera unavailable"
      minHeight={190} variant="tile" />)

    await waitFor(() => expect(view.container.querySelector('[data-status="error"]')).toBeInTheDocument())
    await waitFor(() => expect(view.container.querySelector('webrtc-camera-sfenton')).toBeInTheDocument(), {
      timeout: 3_500,
    })
    expect(errorLog).toHaveBeenCalledWith('Unable to start RTC camera:', expect.any(Error))
    view.unmount()
    errorLog.mockRestore()
  })

  it('replays a HA ready event that arrives while card setup is still pending', async () => {
    FakeRtcCard.failuresRemaining = 1
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = render(<RtcPilotCamera camera={driveway} minHeight={190} variant="tile" />)

    act(() => {
      setMockConnectionStatus('disconnected')
      setMockConnectionStatus('connected')
    })
    await waitFor(() => expect(view.container.querySelector('webrtc-camera-sfenton')).toBeInTheDocument())
    expect(errorLog).toHaveBeenCalledWith('Unable to start RTC camera:', expect.any(Error))
    view.unmount()
    errorLog.mockRestore()
  })
})
