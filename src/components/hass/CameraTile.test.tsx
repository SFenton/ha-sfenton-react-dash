import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { CameraTile } from './CameraTile'
import type { WebRtcStatus } from './WebRtcCamera'
import { readStatusFromMode } from './WebRtcCamera'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const statusCallbacks: ((status: WebRtcStatus) => void)[] = []

vi.mock('./WebRtcCamera', async () => {
  const actual = await vi.importActual<typeof import('./WebRtcCamera')>('./WebRtcCamera')
  return {
    ...actual,
    WebRtcCamera: ({ onStatusChange }: { onStatusChange?: (status: WebRtcStatus) => void }) => {
      if (onStatusChange && !statusCallbacks.includes(onStatusChange)) statusCallbacks.push(onStatusChange)
      return <div data-testid="webrtc-camera" />
    },
  }
})

const driveway = CAMERA_ITEMS.find((camera) => camera.entityId === 'camera.garage_camera')!

function emitStatus(status: WebRtcStatus) {
  act(() => {
    for (const callback of statusCallbacks) callback(status)
  })
}

describe('readStatusFromMode', () => {
  it.each([
    ['WEBRTC', 'live'],
    ['MSE', 'live'],
    ['HLS', 'live'],
    ['MJPEG', 'live'],
  ])('treats transport mode %s as a playing stream', (mode, expected) => {
    expect(readStatusFromMode(mode)).toBe(expected)
  })

  it.each([
    ['', 'loading'],
    ['Loading..', 'loading'],
    ['Loading...', 'loading'],
    ['Waiting...', 'loading'],
    ['Reconnecting...', 'loading'],
  ])('treats %s as loading rather than an error', (mode, expected) => {
    expect(readStatusFromMode(mode)).toBe(expected)
  })

  it('only reports an error for the card error mode', () => {
    expect(readStatusFromMode('error')).toBe('error')
  })
})

describe('CameraTile', () => {
  beforeEach(() => {
    resetMockHass()
    statusCallbacks.length = 0
    mockEntities['camera.garage_camera'].state = 'recording'
  })

  it('streams even when the Home Assistant camera entity is unavailable', () => {
    mockEntities['camera.garage_camera'].state = 'unavailable'

    render(<CameraTile camera={driveway} onOpen={() => undefined} />)
    emitStatus('live')

    expect(screen.getByTestId('webrtc-camera')).toBeInTheDocument()
    expect(screen.queryByText('Camera unavailable')).not.toBeInTheDocument()
  })

  it('shows the unavailable placeholder only when the stream itself fails', () => {
    render(<CameraTile camera={driveway} onOpen={() => undefined} />)

    emitStatus('loading')
    expect(screen.queryByText('Camera unavailable')).not.toBeInTheDocument()

    emitStatus('error')
    expect(screen.getByText('Camera unavailable')).toBeInTheDocument()
  })

  it('labels a playing stream as Live regardless of the Home Assistant entity state', () => {
    mockEntities['camera.garage_camera'].state = 'unavailable'

    const { rerender } = render(<CameraTile camera={driveway} onOpen={() => undefined} />)
    emitStatus('live')
    expect(screen.getByText('Live')).toBeInTheDocument()

    mockEntities['camera.garage_camera'].state = 'idle'
    rerender(<CameraTile camera={driveway} onOpen={() => undefined} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('falls back to the Home Assistant entity state when the stream is not playing', () => {
    mockEntities['camera.garage_camera'].state = 'unavailable'

    render(<CameraTile camera={driveway} onOpen={() => undefined} />)
    emitStatus('error')

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('does not mount the stream before the tile is hydrated', () => {
    render(<CameraTile camera={driveway} live={false} onOpen={() => undefined} />)

    expect(screen.queryByTestId('webrtc-camera')).not.toBeInTheDocument()
    expect(screen.queryByText('Camera unavailable')).not.toBeInTheDocument()
  })
})
