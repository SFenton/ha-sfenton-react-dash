import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { CameraTile } from './CameraTile'
import type { CameraStreamStatus } from './cameraStreamStatus'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const statusCallbacks: ((status: CameraStreamStatus) => void)[] = []

vi.mock('./HlsCamera', () => ({
  HlsCamera: ({ onStatusChange }: { onStatusChange?: (status: CameraStreamStatus) => void }) => {
    if (onStatusChange && !statusCallbacks.includes(onStatusChange)) statusCallbacks.push(onStatusChange)
    return <div data-testid="hls-camera" />
  },
}))

const driveway = CAMERA_ITEMS.find((camera) => camera.entityId === 'camera.garage_camera')!

function emitStatus(status: CameraStreamStatus) {
  act(() => {
    for (const callback of statusCallbacks) callback(status)
  })
}

describe('CameraTile', () => {
  beforeEach(() => {
    resetMockHass()
    statusCallbacks.length = 0
    mockEntities['camera.garage_camera'].state = 'recording'
  })

  it('keeps the native player mounted while an unavailable camera attempts recovery', () => {
    mockEntities['camera.garage_camera'].state = 'unavailable'

    render(<CameraTile camera={driveway} onOpen={() => undefined} />)
    emitStatus('live')

    expect(screen.getByTestId('hls-camera')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Open Driveway camera' }).querySelectorAll('[data-dynamic-grid-label="true"]')).toHaveLength(2)
  })

  it('falls back to the Home Assistant entity state when the stream is not playing', () => {
    mockEntities['camera.garage_camera'].state = 'unavailable'

    render(<CameraTile camera={driveway} onOpen={() => undefined} />)
    emitStatus('error')

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('does not mount the stream before the tile is hydrated', () => {
    render(<CameraTile camera={driveway} live={false} onOpen={() => undefined} />)

    expect(screen.queryByTestId('hls-camera')).not.toBeInTheDocument()
    expect(screen.queryByText('Camera unavailable')).not.toBeInTheDocument()
  })
})
