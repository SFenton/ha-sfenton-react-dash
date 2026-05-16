import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardViewPage } from './DashboardViewPage'
import { ROOM_PAGE_CONFIGS, ROOM_PAGE_ORDER } from '../constants/roomPages'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

describe('DashboardViewPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['select.living_room_air_purifier_auto_mode'].state = 'Default'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
  })

  it('renders a statically ported room page from React-owned config', () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Room Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Window/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
  })

  it('opens room status hashes with reusable Home modal sheets directly', async () => {
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    fireEvent.click(screen.getByRole('button', { name: /Lights/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen Lights' })).toBeInTheDocument()
    expect(screen.queryByText('Rooms')).not.toBeInTheDocument()
  })

  it('opens Living Room climate, occupancy, and air quality popups from header chips', async () => {
    const renderLivingRoom = () => render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    let view = renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Climate/i })[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room Climate' })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Occupancy/i })[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room Occupancy' })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room Air Quality' })).toBeInTheDocument()
    expect(screen.getByText('Fan Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('PM2.5')).toBeInTheDocument()
    expect(screen.getByText('AQI')).toBeInTheDocument()
  })

  it('runs HASS air purifier mode services from the source popup', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Quiet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.living_room_air_purifier_auto_mode', serviceData: { option: 'Quiet' } },
      { domain: 'select', service: 'select_option', target: 'select.living_room_air_purifier_fan_mode', serviceData: { option: 'Manual' } },
    ])
  })

  it('shows manual air purifier fan speeds and runs fan percentage services', async () => {
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Manual'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 66
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    expect(await screen.findByText('Manual Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'High' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'fan', service: 'set_percentage', target: 'fan.living_room_air_purifier_levoit_purifier', serviceData: { percentage: 100 } },
    ])
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
  })

  it('keeps dedicated climate popups in manual review fallback', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Master Bedroom: Humidifier' })).toBeInTheDocument()
    expect(screen.getByText('#humidifier-master-bedroom')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Master Bedroom Climate' })).not.toBeInTheDocument()
  })

  it('opens room vacuum source cards with reusable vacuum modal controls', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Robot Vacuum Docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByText('Main Floor Robot Vacuum')).toBeInTheDocument()
    expect(screen.getByText('Power Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument()
  })

  it('matches Kitchen section order and dishwasher subtitle', () => {
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    expect(screen.getByRole('heading', { name: 'Appliances' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Dishwasher Closed.*Eco 50/i)).toBeInTheDocument()
    expect(screen.queryByText('Dishwasher Program')).not.toBeInTheDocument()
    expect(screen.queryByText('Dishwasher Progress')).not.toBeInTheDocument()
  })

  it('opens Kitchen vent as the exact vent popup rather than the full climate sheet', async () => {
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    fireEvent.click(screen.getByRole('button', { name: /Vent Open/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen: Vent' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Kitchen Climate' })).not.toBeInTheDocument()
  })

  it('keeps Back Deck grill controls inside the grill popup', async () => {
    render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    expect(screen.getByRole('heading', { name: 'Grill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bear Grills Off/i })).not.toBeInTheDocument()
    expect(screen.getByText('Bear Grills')).toBeInTheDocument()
    expect(screen.queryByText('Pellet Level')).not.toBeInTheDocument()
    expect(screen.queryByText('Keep Warm')).not.toBeInTheDocument()

    mockEntities['sensor.d8478fa2ad0a_grill_state'].state = 'ignite'
    const activeView = render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    fireEvent.click(screen.getByRole('button', { name: /Bear Grills Ignite/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Back Deck: Bear Grills' })).toBeInTheDocument()
    expect(screen.getAllByText('Pellet Level').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Keep Warm').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Super Smoke').length).toBeGreaterThan(0)
    activeView.unmount()
    mockEntities['sensor.d8478fa2ad0a_grill_state'].state = 'off'
  })

  it('matches HASS Office PC icons and subtitles', () => {
    render(<DashboardViewPage activePath="office" onNavigate={() => undefined} path="office" />)

    expect(screen.getByRole('heading', { name: 'Office PCs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stephen's PC Off/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's PC Off/i })).toBeInTheDocument()
  })

  it('has YAML-derived scaffolds for every room route', () => {
    expect(ROOM_PAGE_ORDER).toHaveLength(16)
    for (const path of ROOM_PAGE_ORDER) {
      const room = ROOM_PAGE_CONFIGS[path]
      expect(room.overviewCards.length).toBeGreaterThan(0)
      expect(room.popupTemplates.length).toBeGreaterThan(0)
    }
  })

  it('renders todo list panels through the mock HASS websocket', async () => {
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
    expect(await screen.findByText('Mock task one')).toBeInTheDocument()
  })

  it('flags the thermostat route for manual review', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.getByText(/manually reviewed/i)).toBeInTheDocument()
  })

  it('opens available vacuum cards as modal controls and leaves unavailable cards inert', async () => {
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    expect(screen.getByLabelText('Music Room')).not.toHaveAttribute('data-clickable')
    fireEvent.click(screen.getByRole('button', { name: /main floor docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByText('Power Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clean/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument()
  })
})