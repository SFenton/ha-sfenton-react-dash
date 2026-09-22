import { fireEvent, render, screen } from '@testing-library/react'
import { CAMERA_ITEMS } from '../../constants/atAGlance'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CameraModalContent } from './CameraModalContent'

const frontDoor = CAMERA_ITEMS.find((camera) => camera.entityId === 'camera.front_door_camera')!

describe('CameraModalContent', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('controls the active HLS player and delegates recording to Home Assistant', () => {
    const view = render(<CameraModalContent camera={frontDoor} />)

    expect(view.container.querySelector('[data-camera-transport="hls"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Snapshot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Muted' }))
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Record' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'turn_on', target: 'script.front_door_manual_recording' },
    ])
  })
})
