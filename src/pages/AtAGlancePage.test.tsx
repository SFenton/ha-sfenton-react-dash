import { fireEvent, render, screen, within } from '@testing-library/react'
import { AtAGlancePage } from './AtAGlancePage'
import { materialIconPath } from '../components/core/iconPaths'
import { CONTACT_GROUPS, SECURITY_ENTITY } from '../constants/atAGlance'
import { CHORE_BLUE } from '../constants/portedDashboard'
import { mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

describe('AtAGlancePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
  })

  it('opens the Air Quality overview from the header chip with room cards', async () => {
    mockEntities['input_text.office_aqi_color'].state = 'rgba(229, 57, 53, 1)'
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /Air Quality AQI 1 · PM2\.5 0μg\/m³ - 1μg\/m³/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('Rooms')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Living Room AQI 1 PM2.5 2 μg/m³')).toHaveStyle('--card-rgb: 0 150 136')
    expect(within(dialog).getByLabelText('Guest Room AQI 1 PM2.5 2 μg/m³')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Office AQI 1 PM2.5 2 μg/m³')).toHaveStyle('--card-rgb: 229 57 53')
    expect(within(dialog).queryByRole('button', { name: /Living Room AQI/i })).not.toBeInTheDocument()

    expect(within(dialog).getAllByText('1 • 2 μg/m³')).toHaveLength(6)
  })

  it('colors overview security tiles from the alarm state', () => {
    mockEntities[SECURITY_ENTITY].state = 'armed_night'
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: 'Security Armed Night' })).toHaveStyle('--header-pill-color: rgba(142, 36, 170, 0.44)')
    expect(screen.getByRole('button', { name: 'Security System Armed Night' })).toHaveStyle('--tile-color: rgba(142, 36, 170, 0.5)')
  })

  it('uses open and closed language for the home contact sensor chip', () => {
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Contact Sensors\s*0 Sensors Active/i })).not.toBeInTheDocument()
  })

  it('shows open contact counts on the home contact sensor chip', () => {
    const contactEntity = mockEntities[CONTACT_GROUPS[0].items[0].entityId]
    const originalState = contactEntity.state
    contactEntity.state = 'on'

    try {
      render(<AtAGlancePage />)

      expect(screen.getByRole('button', { name: /Contact Sensors\s*1 Open/i })).toBeInTheDocument()
    } finally {
      contactEntity.state = originalState
    }
  })

  it('opens a Pirate Weather seven-day forecast sheet', async () => {
    mockEntities['weather.pirate_weather'].state = 'cloudy'
    mockEntities['weather.pirate_weather'].attributes = {
      apparent_temperature: 63,
      cloud_coverage: 100,
      dew_point: 48,
      humidity: 72,
      precipitation_unit: 'in',
      temperature: 57,
      temperature_unit: '°F',
      visibility: 10,
      visibility_unit: 'mi',
      wind_bearing: 59,
      wind_speed: 0.08,
      wind_speed_unit: 'mph',
    }
    render(<AtAGlancePage />)

    expect(await screen.findByLabelText('Today Sunny H:65° L:48°')).toBeInTheDocument()
  expect(screen.getByLabelText('Today Sunny H:65° L:48°').querySelector('[class*="heroDayRangeTrack"]')).toHaveStyle({ '--range-marker': '52.94117647058824%', '--range-size': '100%', '--range-start': '0%' })
    const heroHourly = await screen.findByLabelText('24-hour weather forecast')
    expect(heroHourly).toHaveTextContent('Now57°1 PM58°')
    expect(within(heroHourly).getByLabelText('Now Cloudy 57°F')).toBeInTheDocument()
    expect(within(heroHourly).getByLabelText('11 AM Sunny 58°F')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Weather' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Conditions')).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Now Cloudy 57°F' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Precipitation conditions' }))
    expect(await within(dialog).findByRole('article', { name: 'Now precipitation 0%' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: 'Today precipitation 0 in 0%' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wind conditions' }))
    expect(await within(dialog).findByRole('article', { name: 'Now wind 3 mph gusts 5 mph' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: 'Today wind 4-8 mph' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Next Seven Days')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Current weather conditions')).toHaveTextContent('Home57°CloudyH:65° L:48°')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conditions conditions' }))
    expect(await within(dialog).findByRole('article', { name: 'Today Sunny H:65° L:48°' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: 'Thu Sunny H:71° L:50°' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: /Tue Rain H:84° L:59°/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Feels Like 63°F' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Humidity 72%' })).toBeInTheDocument()
  })

  it('uses the shell header menu and More actions', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenCalledWith('security')

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(within(dialog).getByRole('navigation', { name: 'Settings pages' })).toBeInTheDocument()
    expect(within(dialog).queryByText(/not available from Home/i)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Admin Controls Presence-Based Toggles, Automation Overrides, and More/i }))
    expect(navigate).toHaveBeenLastCalledWith('admin')
  })

  it('opens the Chores preview hash with live chore links', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}#chores-preview`)
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Chores' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Groceries/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Stephen's Tasks/i })).toBeInTheDocument()
    expect(within(dialog).queryByText(/not available from Home/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Groceries/i }))
    expect(navigate).toHaveBeenCalledWith('groceries')
  })

  it('moves overview room navigation into the layout FAB sheet', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    expect(screen.queryByRole('heading', { name: 'Areas' })).not.toBeInTheDocument()
    const layoutButton = screen.getByRole('button', { name: 'Open room layout' })
    expect(layoutButton).toHaveStyle(`--card-rgb: ${CHORE_BLUE.r} ${CHORE_BLUE.g} ${CHORE_BLUE.b}`)
    expect(layoutButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:floor-plan'))
    fireEvent.click(layoutButton)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Living Room area' }))

    expect(navigate).toHaveBeenCalledWith('living-room')
  })
})
