import { render, screen, waitFor } from '@testing-library/react'
import { VACUUMS } from '../../constants/portedDashboard'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { ValetudoMapCard } from './ValetudoMapCard'

const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Main Floor')

describe('ValetudoMapCard availability', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities['camera.valetudo_exaltedsneakydeer_map_data'].state = 'idle'
  })

  it('renders inert unavailable geometry instead of a cached robot map', async () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')

    render(<ValetudoMapCard available={false} vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-source-available', 'false')
    expect(screen.getByText('Map Unavailable')).toBeInTheDocument()
    expect(screen.getByText("Home Assistant cannot currently confirm the vacuum's map or position.")).toBeInTheDocument()
    await waitFor(() => expect(map).toHaveAttribute('data-loaded', 'false'))
  })

  it('keeps the current map visible while both primary and camera sources are available', () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')

    render(<ValetudoMapCard available vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-source-available', 'true')
    expect(map).toHaveAttribute('data-loaded', 'true')
    expect(screen.queryByText('Map Unavailable')).not.toBeInTheDocument()
  })

  it('hides the cached map when only the camera source is unavailable', async () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')
    mockEntities['camera.valetudo_exaltedsneakydeer_map_data'].state = 'unavailable'

    render(<ValetudoMapCard available vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-source-available', 'false')
    expect(screen.getByText('Map Unavailable')).toBeInTheDocument()
    await waitFor(() => expect(map).toHaveAttribute('data-loaded', 'false'))
  })
})
