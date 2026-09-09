import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VACUUMS } from '../../constants/portedDashboard'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { ValetudoMapCard } from './ValetudoMapCard'

const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Main Floor')
const musicRoomVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Music Room')
const theaterRoomVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Theater Room')

function mockMapFrameSize() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 400,
    height: 400,
    left: 0,
    right: 600,
    toJSON: () => ({}),
    top: 0,
    width: 600,
    x: 0,
    y: 0,
  })
}

describe('ValetudoMapCard availability', () => {
  let frameSizeSpy: ReturnType<typeof mockMapFrameSize>

  beforeEach(() => {
    frameSizeSpy = mockMapFrameSize()
    resetMockHass()
    mockEntities['camera.valetudo_exaltedsneakydeer_map_data'].state = 'idle'
    mockEntities['camera.valetudo_elatedusedram_map_data'].state = 'idle'
  })

  afterEach(() => frameSizeSpy.mockRestore())

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

  it('marks height-fitted maps while preserving the live source', () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')

    render(<ValetudoMapCard available displayMode="fitted" vacuum={mainFloorVacuum} />)

    const map = screen.getByRole('region', { name: 'Main Floor Valetudo map' })
    expect(map).toHaveAttribute('data-map-display', 'fitted')
    expect(map).toHaveAttribute('data-map-provenance', 'live')
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

  it('keeps the Music Room map focused without map-scope controls', () => {
    if (!musicRoomVacuum) throw new Error('Expected Music Room vacuum config')

    render(<ValetudoMapCard available vacuum={musicRoomVacuum} />)

    const map = screen.getByRole('region', { name: 'Music Room Valetudo map' })
    expect(map).toHaveAttribute('data-map-scope', 'focused')
    expect(map).toHaveAttribute('data-map-focus-reason', 'focused')
    expect(map).toHaveAttribute('data-map-render-clipped', 'true')
    expect(map).toHaveAttribute('data-view-min-x', '634')
    expect(map).toHaveAttribute('data-view-max-x', '782')
    expect(screen.queryByRole('button', { name: 'Full Map' })).not.toBeInTheDocument()
    expect(screen.queryByText('Reachable Area Only')).not.toBeInTheDocument()
  })

  it.each([
    ['Main Floor', mainFloorVacuum],
    ['Music Room', musicRoomVacuum],
  ])('renders truthful room-order markers for %s', (_title, vacuum) => {
    if (!vacuum) throw new Error('Expected vacuum config')
    const selectedRooms = vacuum.zones.slice(0, 2).map((zone, index) => ({ entityId: zone.entityId, order: index + 1 }))

    const { container } = render(<ValetudoMapCard available onRoomToggle={() => {}} selectedRooms={selectedRooms} vacuum={vacuum} />)

    expect(container.querySelectorAll('[data-room-order]')).toHaveLength(2)
    expect(container.querySelector('[data-room-order="1"]')).toHaveAttribute('data-room-entity-id', selectedRooms[0]?.entityId)
    expect(container.querySelector('[data-room-order="2"]')).toHaveAttribute('data-room-entity-id', selectedRooms[1]?.entityId)
  })

  it.each([
    ['Main Floor', mainFloorVacuum],
    ['Music Room', musicRoomVacuum],
  ])('maps a rendered room tap to the configured %s input boolean', (_title, vacuum) => {
    if (!vacuum) throw new Error('Expected vacuum config')
    const zone = vacuum.zones[0]!
    const onRoomToggle = vi.fn()
    const { container } = render(
      <ValetudoMapCard available onRoomToggle={onRoomToggle} selectedRooms={[{ entityId: zone.entityId, order: 1 }]} vacuum={vacuum} />,
    )
    const marker = container.querySelector<SVGGElement>('[data-room-order="1"]')!
    const circle = marker.querySelector('circle')!
    const mapTransform = marker.parentElement?.getAttribute('transform') ?? ''
    const values = mapTransform.match(/matrix\(([^)]+)\)/)?.[1]?.split(/[ ,]+/).map(Number) ?? []
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = values
    const cx = Number(circle.getAttribute('cx'))
    const cy = Number(circle.getAttribute('cy'))
    const overlay = screen.getByRole('application', { name: `${vacuum.title} room selector` })

    fireEvent.click(overlay, { clientX: a * cx + c * cy + e, clientY: b * cx + d * cy + f })

    expect(onRoomToggle).toHaveBeenCalledWith(zone.entityId)
  })

  it('keeps Main Floor marker numbers upright inside the rotated map', () => {
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum config')

    const { container } = render(<ValetudoMapCard available onRoomToggle={() => {}} selectedRooms={[{ entityId: mainFloorVacuum.zones[0]!.entityId, order: 1 }]} vacuum={mainFloorVacuum} />)

    expect(container.querySelector('[data-room-order="1"]')).toHaveAttribute('transform', expect.stringContaining('rotate(-180'))
  })

  it('does not expose map-room markers for vacuums without map selection', () => {
    if (!theaterRoomVacuum) throw new Error('Expected Theater Room vacuum config')

    const { container } = render(<ValetudoMapCard available selectedRooms={[{ entityId: 'input_boolean.unconfigured_room', order: 1 }]} vacuum={theaterRoomVacuum} />)

    expect(container.querySelector('[data-room-order]')).toBeNull()
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
