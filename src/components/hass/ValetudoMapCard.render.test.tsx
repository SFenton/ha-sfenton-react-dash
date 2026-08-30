import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VACUUMS } from '../../constants/portedDashboard'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { ValetudoMapCard } from './ValetudoMapCard'

const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Main Floor')
const musicRoomVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Music Room')

describe('ValetudoMapCard availability', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities['camera.valetudo_exaltedsneakydeer_map_data'].state = 'idle'
    mockEntities['camera.valetudo_elatedusedram_map_data'].state = 'idle'
  })

  it.each(VACUUMS)('renders the $title last reported position as a noninteractive historical map', async (vacuum) => {
    const cameraEntityId = `camera.${vacuum.vacuumMapId}_map_data`
    if (mockEntities[cameraEntityId]) mockEntities[cameraEntityId].state = 'unavailable'

    render(<ValetudoMapCard available={false} vacuum={vacuum} />)

    const map = screen.getByRole('region', { name: `${vacuum.title} Valetudo map` })
    expect(map).toHaveAttribute('data-source-available', 'false')
    expect(map).toHaveAttribute('data-map-provenance', 'reported')
    expect(map).toHaveAttribute('data-interactive', 'false')
    expect(screen.queryByText('Map Unavailable')).not.toBeInTheDocument()
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Last Reported Position')
    expect(note).toHaveTextContent('This is the last map the vacuum reported before contact was lost. The exact report time is unknown, and the vacuum may have been moved since then.')
    expect(map.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(map).toHaveAccessibleDescription(/last map the vacuum reported.*may have been moved since then/i)
    await waitFor(() => expect(map).toHaveAttribute('data-loaded', 'true'))
  })

  it('keeps the current map visible while both primary and camera sources are available', () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')

    render(<ValetudoMapCard available vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-source-available', 'true')
    expect(map).toHaveAttribute('data-map-provenance', 'live')
    expect(map).toHaveAttribute('data-map-render-clipped', 'false')
    expect(map).toHaveAttribute('data-loaded', 'true')
    expect(screen.queryByText('Map Unavailable')).not.toBeInTheDocument()
  })

  it('hides the cached map when only the camera source is unavailable', async () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')
    mockEntities['camera.valetudo_exaltedsneakydeer_map_data'].state = 'unavailable'

    render(<ValetudoMapCard available vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-source-available', 'false')
    expect(map).toHaveAttribute('data-map-provenance', 'none')
    expect(screen.getByText('Map Unavailable')).toBeInTheDocument()
    await waitFor(() => expect(map).toHaveAttribute('data-loaded', 'false'))
  })

  it('falls back when no retained camera entity exists', async () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')
    const cameraEntityId = 'camera.valetudo_exaltedsneakydeer_map_data'
    const cameraEntity = mockEntities[cameraEntityId]
    delete mockEntities[cameraEntityId]

    try {
      render(<ValetudoMapCard available={false} vacuum={mainFloorVacuum} />)

      const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
      expect(map).toHaveAttribute('data-map-provenance', 'none')
      expect(screen.getByText('Map Unavailable')).toBeInTheDocument()
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      await waitFor(() => expect(map).toHaveAttribute('data-loaded', 'false'))
    } finally {
      if (cameraEntity) mockEntities[cameraEntityId] = cameraEntity
    }
  })

  it('starts the Music Room map in focused mode and exposes a full-map toggle', () => {
    if (!musicRoomVacuum) throw new Error('Expected Music Room vacuum config')

    render(<ValetudoMapCard available vacuum={musicRoomVacuum} />)

    const map = screen.getByRole('region', { name: 'Music Room Valetudo map' })
    const fullMap = screen.getByRole('button', { name: 'Full Map' })
    expect(map).toHaveAttribute('data-map-scope', 'focused')
    expect(map).toHaveAttribute('data-map-focus-reason', 'focused')
    expect(map).toHaveAttribute('data-map-render-clipped', 'true')
    expect(map).toHaveAttribute('data-view-min-x', '634')
    expect(map).toHaveAttribute('data-view-max-x', '782')
    expect(screen.getByText('Reachable Area Only')).toBeVisible()
    expect(fullMap).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(fullMap)

    expect(map).toHaveAttribute('data-map-scope', 'full')
    expect(map).toHaveAttribute('data-map-render-clipped', 'false')
    expect(map).toHaveAttribute('data-view-min-x', '504')
    expect(fullMap).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Reachable Area Only')).not.toBeInTheDocument()
  })

  it('marks selections outside the focused interaction bounds as unsafe', () => {
    if (!musicRoomVacuum) throw new Error('Expected Music Room vacuum config')

    render(
      <ValetudoMapCard
        available
        interactive
        selection={{ x0: 520, x1: 540, y0: 580, y1: 600 }}
        vacuum={musicRoomVacuum}
      />,
    )

    expect(screen.getByRole('region', { name: 'Music Room Valetudo map' })).toHaveAttribute('data-selection-allowed', 'false')
  })
})
