// @covers src/constants/atAGlance.ts
// @covers src/components/hass/cameraStreamActions.ts
// @covers src/components/hass/cameraStreamStatus.ts
// @covers src/components/hass/WebRtcCamera.tsx
// @covers src/components/hass/webRtcStatus.ts
// @covers src/i18n/locales/en/modals/camera.json
import { act, fireEvent, render } from '@testing-library/react'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { resetMockHass } from '../../test/mocks/hakitCoreState'
import {
  getCameraStreamMuteState,
  takeCameraStreamSnapshot,
  toggleCameraStreamMuted,
} from './cameraStreamActions'
import { HlsCamera } from './HlsCamera'

interface SessionOptions {
  entityId: string
  mockPlayback?: boolean
  onError: (error: Error) => void
  onStatusChange: (status: 'loading' | 'live' | 'error') => void
  resolveUrl: (path: string) => string
}

const sessionMock = vi.hoisted(() => ({
  options: [] as SessionOptions[],
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('./haHlsSession', () => ({
  createHaHlsSession: vi.fn((options: SessionOptions) => {
    sessionMock.options.push(options)
    return { start: sessionMock.start, stop: sessionMock.stop }
  }),
}))

const driveway = CAMERA_ITEMS.find((camera) => camera.entityId === 'camera.garage_camera')!

describe('HlsCamera', () => {
  beforeEach(() => {
    resetMockHass()
    sessionMock.options.length = 0
    sessionMock.start.mockReset()
    sessionMock.stop.mockReset()
  })

  it('maps every dashboard camera to a native Home Assistant stream entity', () => {
    expect(CAMERA_ITEMS.map((camera) => camera.entityId)).toEqual([
      'camera.front_door_camera',
      'camera.garage_camera',
      'camera.upper_deck_camera_2',
      'camera.lower_deck_camera',
    ])
  })

  it('starts an HA HLS session for the configured entity and exposes decoded status', () => {
    const onStatusChange = vi.fn()
    const view = render(
      <HlsCamera camera={driveway} controls errorLabel="Camera unavailable" fill minHeight={310} onStatusChange={onStatusChange} variant="modal" />,
    )

    const video = view.container.querySelector('video')
    expect(video).toBeInstanceOf(HTMLVideoElement)
    expect(video).toHaveAttribute('crossorigin', 'anonymous')
    expect(video).toHaveAttribute('data-camera-entity', 'camera.garage_camera')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    expect(video?.muted).toBe(true)
    expect(view.container.querySelector('[data-camera-transport="hls"]')).toBeInTheDocument()
    expect(sessionMock.options[0]).toMatchObject({
      entityId: 'camera.garage_camera',
      mockPlayback: true,
    })
    expect(sessionMock.options[0].resolveUrl('/api/hls/example/master_playlist.m3u8')).toBe(
      'http://mock-hass.local/api/hls/example/master_playlist.m3u8',
    )
    expect(sessionMock.start).toHaveBeenCalledOnce()

    act(() => sessionMock.options[0].onStatusChange('live'))
    expect(view.container.querySelector('[data-status="live"]')).toHaveAttribute('data-loaded', 'true')
    expect(onStatusChange).toHaveBeenLastCalledWith('live')

    act(() => {
      sessionMock.options[0].onError(new Error('Stream failed'))
      sessionMock.options[0].onStatusChange('error')
    })
    expect(view.container).toHaveTextContent('Camera unavailable')

    view.unmount()
    expect(sessionMock.stop).toHaveBeenCalledOnce()
  })

  it('preserves mute control state for the active HLS video', () => {
    const view = render(<HlsCamera camera={driveway} minHeight={310} variant="modal" />)
    const video = view.container.querySelector('video')!
    expect(getCameraStreamMuteState(driveway.popupCardId)).toBe(true)

    act(() => {
      toggleCameraStreamMuted(driveway.popupCardId)
    })
    expect(video.muted).toBe(false)
    expect(getCameraStreamMuteState(driveway.popupCardId)).toBe(false)

    act(() => {
      video.muted = true
      fireEvent.volumeChange(video)
    })
    expect(getCameraStreamMuteState(driveway.popupCardId)).toBe(true)

    view.unmount()
  })

  it('rebuilds native video controls after the modal media resizes', () => {
    let resize: ResizeObserverCallback | undefined
    let restoreControls: FrameRequestCallback | undefined
    const originalResizeObserver = globalThis.ResizeObserver
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      restoreControls = callback
      return 1
    })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      restoreControls = undefined
    })
    const videoRect = vi.spyOn(HTMLVideoElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 269.25,
      width: 359,
    } as DOMRect)
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }

      disconnect() {}

      observe() {}

      unobserve() {}
    }

    try {
      const view = render(<HlsCamera camera={driveway} controls minHeight={310} variant="modal" />)
      const video = view.container.querySelector('video')!
      const entry = (width: number, height: number) => ({
        contentRect: { width, height },
      }) as ResizeObserverEntry

      act(() => resize?.([entry(359, 269.25)], {} as ResizeObserver))
      expect(video.controls).toBe(true)
      expect(requestFrame).not.toHaveBeenCalled()

      act(() => resize?.([entry(337.5, 253.125)], {} as ResizeObserver))
      expect(video.controls).toBe(false)

      act(() => restoreControls?.(0))
      expect(video.controls).toBe(true)

      view.unmount()
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
      videoRect.mockRestore()
    }
  })

  it('downloads a snapshot from the active HLS video frame', () => {
    const drawImage = vi.fn()
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    const toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,snapshot')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const view = render(<HlsCamera camera={driveway} minHeight={310} variant="modal" />)
    const video = view.container.querySelector('video')!
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1280 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 720 })

    takeCameraStreamSnapshot(driveway.popupCardId)

    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720)
    expect(toDataUrl).toHaveBeenCalledWith('image/jpeg')
    expect(click).toHaveBeenCalledOnce()

    view.unmount()
    getContext.mockRestore()
    toDataUrl.mockRestore()
    click.mockRestore()
  })
})
