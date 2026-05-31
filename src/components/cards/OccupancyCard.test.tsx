import { render, screen } from '@testing-library/react'
import { materialIconPath } from '../core/iconPaths'
import { OccupancyCard } from './OccupancyCard'

describe('OccupancyCard', () => {
  it('uses the motion sensor icon pair for detected and clear states', () => {
    render(
      <>
        <OccupancyCard entityId="binary_sensor.living_room_back_wall_presence_occupancy" title="Back Wall" />
        <OccupancyCard entityId="binary_sensor.living_room_bar_presence_occupancy" title="Bar" />
      </>,
    )

    const detectedPath = materialIconPath('mdi:motion-sensor')
    const clearPath = materialIconPath('mdi:motion-sensor-off')

    expect(screen.getByLabelText('Back Wall Detected').querySelector('path')).toHaveAttribute('d', detectedPath)
    expect(screen.getByLabelText('Bar Clear').querySelector('path')).toHaveAttribute('d', clearPath)
  })
})