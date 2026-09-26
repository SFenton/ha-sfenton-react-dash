import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AtAGlancePage, LightsSheet } from './AtAGlancePage'
import { CONTACT_GROUPS, LIGHT_GROUPS, OCCUPANCY_GROUPS, SECURITY_ENTITY } from '../constants/atAGlance'
import { GUEST_CONTROLS_DESCRIPTION } from '../constants/portedDashboard'
import { GUEST_PRESENCE_SECURITY_HASH, GUEST_PRESENCE_SECURITY_SUMMARY } from '../components/hass/GuestPresenceSecurity'
import { entity, mockCallServiceCalls, mockEntities, mockState, resetMockHass, setMockDailyWeatherForecast, setMockEntityAttribute, setMockHourlyWeatherForecast } from '../test/mocks/hakitCoreState'
import { resetDeferredRouteHydrationCache } from '../hooks/useDeferredRouteHydration'
import { WeatherSummary } from '../components/hass/WeatherSummary'
import { WEATHER_FORECAST_TTL_MS } from '../components/hass/useWeatherForecasts'
import { HOUSEHOLD_RESIDENTS } from '../constants/householdResidents'

// @covers src/constants/atAGlance.ts

describe('AtAGlancePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetDeferredRouteHydrationCache()
    resetMockHass()
  })

  function setExistingMockEntityStates(entityIds: Iterable<string | undefined>, state: string) {
    const originalStates = new Map<string, string>()

    for (const entityId of entityIds) {
      if (!entityId || !mockEntities[entityId]) continue
      originalStates.set(entityId, mockEntities[entityId].state)
      mockEntities[entityId].state = state
    }

    return () => {
      for (const [entityId, originalState] of originalStates) {
        mockEntities[entityId].state = originalState
      }
    }
  }

  it('personalizes resident nightstands and preserves unknown-user fallbacks', () => {
    const masterBedroom = LIGHT_GROUPS.find((group) => group.title === 'Master Bedroom Lights')!
    const stephenView = render(<LightsSheet directGroup={masterBedroom} />)
    expect(screen.getByRole('button', { name: /Your Nightstand/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph Nightstand/i })).toBeInTheDocument()

    stephenView.unmount()
    mockState.user = { id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' }
    const stephView = render(<LightsSheet directGroup={masterBedroom} />)
    expect(screen.getByRole('button', { name: /Stephen Nightstand/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your Nightstand/i })).toBeInTheDocument()

    stephView.unmount()
    mockState.user = { id: 'unknown-user', name: 'Unknown' }
    render(<LightsSheet directGroup={masterBedroom} />)
    expect(screen.getByRole('button', { name: /Stephen Nightstand/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph Nightstand/i })).toBeInTheDocument()
  })

  it('renders shared room light brightness controls while preserving the non-dimmable switch fallback', () => {
    const guestRoom = LIGHT_GROUPS.find((group) => group.title === 'Guest Room Lights')!
    mockEntities['light.guest_room_tv_light'] = entity('light.guest_room_tv_light', 'on', { brightness: 64 })
    mockEntities['light.guest_room_bed_light'] = entity('light.guest_room_bed_light', 'off')
    const guestView = render(<LightsSheet directGroup={guestRoom} />)

    const tvLight = screen.getByRole('group', { name: 'TV Light' })
    expect(tvLight).toHaveAttribute('data-action-kind', 'value')
    expect(tvLight.style.getPropertyValue('--fill-pct')).toBe('25%')
    expect(screen.getByRole('button', { name: 'Toggle TV Light' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Bed Light' })).toHaveAttribute('data-active', 'false')

    guestView.unmount()
    const entryway = LIGHT_GROUPS.find((group) => group.title === 'Entryway Light')!
    mockEntities['switch.upper_entryway_light_switch_top'] = entity('switch.upper_entryway_light_switch_top', 'off')
    render(<LightsSheet directGroup={entryway} />)

    expect(screen.queryByRole('group', { name: 'Entryway Light' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entryway Light Off' })).toBeInTheDocument()
  })

  it('uses the shared disclosure affordance on the Home weather modal opener', async () => {
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: /Open seven-day weather forecast/i }).querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    await act(async () => {})
  })

  it('keeps header status chips and camera pills free of disclosure chevrons', () => {
    render(<AtAGlancePage />)

    const chip = screen.getByRole('button', { name: /^Lights / })
    expect(chip).toHaveAttribute('data-tone', 'light')
    expect(chip.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
    expect(chip).not.toHaveAttribute('data-modal-opener')

    expect(screen.getByRole('button', { name: 'Open Front Door camera' }).querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('uses the Security page dynamic camera grid layout', () => {
    render(<AtAGlancePage />)

    const cameraGrid = screen.getByRole('button', { name: 'Open Front Door camera' }).closest('[data-dynamic-grid="true"]')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'fixed')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-max-columns', '4')
  })

  it('opens an HA HLS camera modal with working audio controls', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Front Door camera' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Front Door' })).toBeInTheDocument()
    expect(dialog.querySelector('[data-camera-transport="hls"]')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Muted' }))
    expect(within(dialog).getByRole('button', { name: 'Audio' })).toBeInTheDocument()
  })

  it('moves the Home Quick Links grid into the global floating action', () => {
    render(<AtAGlancePage />)

    expect(screen.queryByRole('heading', { name: 'Quick Links' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Home quick links' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quick Links' })).toBeInTheDocument()
  })

  it('keeps cold Home content behind a centered spinner before fading content in', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<AtAGlancePage deferRouteContent routeTransitionState="entering" />)

      expect(screen.getByRole('status', { name: 'Loading Home dashboard content' })).toHaveAttribute('data-state', 'loading')
      expect(screen.queryByRole('button', { name: /Open seven-day weather forecast/i })).not.toBeInTheDocument()

      rerender(<AtAGlancePage deferRouteContent routeTransitionState="idle" />)
      act(() => {
        vi.advanceTimersByTime(999)
      })
      expect(screen.getByRole('status', { name: 'Loading Home dashboard content' })).toHaveAttribute('data-state', 'loading')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByRole('status', { name: 'Loading Home dashboard content' })).toHaveAttribute('data-state', 'exiting')
      expect(screen.queryByRole('button', { name: /Open seven-day weather forecast/i })).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(499)
      })
      expect(screen.getByRole('status', { name: 'Loading Home dashboard content' })).toHaveAttribute('data-state', 'exiting')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('status', { name: 'Loading Home dashboard content' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Open seven-day weather forecast/i })).toBeInTheDocument()
      expect(screen.getAllByText('Cameras')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
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

  it('preloads modal content without opening the live URL hash modal', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#lights-overview`)
    const { container } = render(<AtAGlancePage preload preloadHashes={['#lights-overview']} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quick Links' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-floating-action-dock="true"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-preload-modal="overview#lights-overview"]')).toBeInTheDocument()
  })

  it('colors overview security tiles from the alarm state', () => {
    mockEntities[SECURITY_ENTITY].state = 'armed_night'
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: 'Security Armed Night' })).toHaveStyle('--header-pill-color: rgba(142, 36, 170, 0.44)')
  })

  it('uses open and closed language for the home contact sensor chip', () => {
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Contact Sensors\s*0 Sensors Active/i })).not.toBeInTheDocument()
  })

  it('shows Guest Presence Security only when a guest room is active', async () => {
    const inactiveView = render(<AtAGlancePage />)
    expect(screen.queryByRole('heading', { name: 'Guest Presence Security' })).not.toBeInTheDocument()
    inactiveView.unmount()

    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'on'
    render(<AtAGlancePage />)

    expect(screen.getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
    expect(screen.getByText(GUEST_PRESENCE_SECURITY_SUMMARY)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guest Presence Security' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
    expect(within(dialog).getByText(GUEST_CONTROLS_DESCRIPTION)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Garage Doors' })).toBeInTheDocument()
    expect(within(dialog).getByText(/guest mode skips that automatic close/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Front Door' })).toBeInTheDocument()
    expect(within(dialog).getByText(/auto-lock is also paused while guests are present/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Security System' })).toBeInTheDocument()
    expect(within(dialog).getByText(/leaves arming to you/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Vacuum Auto-Clean' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Guest Room On/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Main Floor Enabled/i })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Left Door Closed' }))
    expect(within(dialog).getByRole('button', { name: 'Left Door Sending Open…' })).toHaveAttribute('aria-disabled', 'true')
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'cover',
      service: 'open_cover',
      target: 'cover.garage_left_door',
    })

    fireEvent.click(within(dialog).getByRole('button', { name: /Enforce Home Temperatures Keep Eco Active/i }))

    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'select',
      service: 'select_option',
      serviceData: { option: 'Disable Eco When Away' },
      target: 'select.thermostat_contact_sensors_eco_behavior_when_away',
    })
  })

  it('opens Guest Presence Security from the Home deep-link hash', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}${GUEST_PRESENCE_SECURITY_HASH}`)
    render(<AtAGlancePage />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Set security system to Away/i })).toBeInTheDocument()
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

  it('renders contact sensor room details as occupancy-style source rows', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Contact Sensors\b/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('Open Office Contact Sensors'))

    const pcWindow = within(dialog).getByRole('article', { name: /PC Window Closed/i })
    expect(pcWindow).toHaveClass(/sourceRow/)
    expect(pcWindow).not.toHaveClass(/bubble/)
  })

  it('shows Master Bedroom Closet as a top-level light card', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Lights\b/i }))

    const dialog = await screen.findByRole('dialog')
    const closetCard = within(dialog).getByLabelText('Open Master Bedroom Closet Light')
    expect(closetCard).toBeInTheDocument()

    fireEvent.click(closetCard)

    expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Closet Lights' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Closet Light' })).toHaveAttribute('data-action-kind', 'value')
    expect(within(dialog).getByRole('button', { name: 'Toggle Closet Light' })).toBeInTheDocument()
  })

  it('groups the Lights overview by on and off rooms', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Lights\b/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('heading', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Lights On' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Lights Off' })).toBeInTheDocument()
  })

  it('uses child light state for room light cards when a group toggle entity is stale', async () => {
    const hallwayGroup = LIGHT_GROUPS.find((group) => group.title === 'Hallway Lights')
    expect(hallwayGroup).toBeDefined()
    if (!hallwayGroup) return

    const originalEntities = new Map<string, typeof mockEntities[string] | undefined>()
    const setMockEntity = (entityId: string, state: string) => {
      if (!originalEntities.has(entityId)) originalEntities.set(entityId, mockEntities[entityId])
      mockEntities[entityId] = entity(entityId, state)
    }

    setMockEntity('light.hallway_lights', 'off')
    hallwayGroup.items.forEach((item) => setMockEntity(item.entityId, 'on'))

    try {
      render(<AtAGlancePage />)

      fireEvent.click(screen.getByRole('button', { name: /^Lights\b/i }))

      const dialog = await screen.findByRole('dialog')
      const hallwayCard = within(dialog).getByLabelText('Open Hallway Lights')
      expect(within(hallwayCard).getByText('4 On')).toBeInTheDocument()
      expect(hallwayCard).toHaveAttribute('data-muted', 'false')

      fireEvent.click(hallwayCard)

      expect(within(dialog).getByRole('heading', { name: 'Hallway Lights' })).toBeInTheDocument()
      expect(within(dialog).getByText('4 On')).toBeInTheDocument()
    } finally {
      for (const [entityId, originalEntity] of originalEntities) {
        if (originalEntity) mockEntities[entityId] = originalEntity
        else delete mockEntities[entityId]
      }
    }
  })

  it('hides the Lights On section when no light room is on', async () => {
    const restoreLights = setExistingMockEntityStates(new Set(LIGHT_GROUPS.flatMap((group) => [group.toggleEntityId, ...group.items.map((item) => item.entityId)])), 'off')

    try {
      render(<AtAGlancePage />)

      fireEvent.click(screen.getByRole('button', { name: /^Lights\b/i }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('heading', { name: 'Lights On' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: 'Lights Off' })).toBeInTheDocument()
    } finally {
      restoreLights()
    }
  })

  it('shows Master Bedroom Closet as a top-level occupancy card', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Occupancy\b/i }))

    const dialog = await screen.findByRole('dialog')
    const closetCard = within(dialog).getByLabelText('Open Master Bedroom Closet Occupancy')
    expect(closetCard).toBeInTheDocument()

    fireEvent.click(closetCard)

    expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Closet Occupancy' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /Closet Clear/i })).toBeInTheDocument()
  })

  it('shows the Master Bedroom bed sensor after the main sensor in occupancy details', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Occupancy\b/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('Open Master Bedroom Occupancy'))

    expect(within(dialog).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Master Bedroom Clear',
      'Bed Clear',
      'Bathroom Clear',
      'Closet Clear',
    ])
  })

  it('shows the Master Bedroom bed temperature after Window with its helper color', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(document.querySelector('[data-status-chip="Climate"] button')!)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('Open Master Bedroom Climate'))

    expect(within(dialog).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Window 70.0°F',
      'Bed 73.1°F',
      'Bathroom 70.0°F',
      'Closet 70.0°F',
      'Vents Closed',
    ])
    expect(within(dialog).getByRole('article', { name: 'Bed 73.1°F' })).toHaveStyle('--card-rgb: 220 213 17')
  })

  it('groups the Occupancy overview by occupied and clear rooms', async () => {
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /^Occupancy\b/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('heading', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Occupied' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Clear' })).toBeInTheDocument()
  })

  it('hides the Occupied section when no room is occupied', async () => {
    const restoreOccupancy = setExistingMockEntityStates(new Set(OCCUPANCY_GROUPS.flatMap((group) => group.items.map((item) => item.entityId))), 'off')

    try {
      render(<AtAGlancePage />)

      fireEvent.click(screen.getByRole('button', { name: /^Occupancy\b/i }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('heading', { name: 'Occupied' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: 'Clear' })).toBeInTheDocument()
    } finally {
      restoreOccupancy()
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
    expect(screen.getByLabelText('Today Sunny H:65° L:48°').querySelector('[data-weather-rail="temperature"]')).toHaveStyle({ '--weather-rail-marker': '52.94117647058824%', '--weather-rail-size': '100%', '--weather-rail-start': '0%' })
    const heroHourly = await screen.findByLabelText('24-hour weather forecast')
    expect(heroHourly).toHaveAttribute('data-weather-carousel', 'hero')
    expect(heroHourly).toHaveAttribute('tabindex', '0')
    const nextHour = new Date()
    nextHour.setHours(nextHour.getHours() + 1)
    const finalHour = new Date()
    finalHour.setHours(finalHour.getHours() + 23)
    const hourLabel = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', hour12: true }).replace(/\s+/g, ' ')
    expect(heroHourly).toHaveTextContent(`Now57°${hourLabel(nextHour)}58°`)
    expect(within(heroHourly).getByLabelText('Now Cloudy 57°F')).toBeInTheDocument()
    expect(within(heroHourly).getByLabelText(`${hourLabel(finalHour)} Sunny 58°F`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Weather' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Conditions')).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: '24-hour conditions', exact: true })).toHaveAttribute('aria-roledescription', 'carousel')
    expect(within(dialog).getByRole('article', { name: 'Now Cloudy 57°F' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Precipitation conditions' }))
    expect(await within(dialog).findByRole('article', { name: 'Now precipitation 0%' })).toBeInTheDocument()
    const dailyPrecipitation = await within(dialog).findByRole('article', { name: 'Today precipitation 0 in 0%' })
    expect(dailyPrecipitation.querySelector('[data-weather-rail="precipitation"]')).toHaveStyle({
      '--weather-rail-size': '0%',
      '--weather-rail-start': '0%',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wind conditions' }))
    const hourlyWind = await within(dialog).findByRole('article', { name: 'Now wind 3 mph gusts 5 mph' })
    expect(hourlyWind.querySelector('[data-wind-source-bearing="185"]')).toHaveAttribute('data-wind-destination-bearing', '5')
    expect(hourlyWind.querySelector('[data-wind-source-bearing="185"]')).toHaveStyle({ transform: 'rotate(5deg)' })
    const dailyWind = await within(dialog).findByRole('article', { name: 'Today wind 4-8 mph' })
    expect(dailyWind.querySelector('[data-wind-source-bearing="185"]')).toHaveAttribute('data-wind-destination-bearing', '5')
    expect(dailyWind.querySelector('[data-wind-source-bearing="185"]')).toHaveStyle({ transform: 'translateX(0px) rotate(5deg)' })
    expect(dailyWind.querySelector('[data-forecast-wind-summary="true"]')).toHaveTextContent('4-8 mph')
    expect(dailyWind.querySelector('[class*="windSparkline"]')).not.toBeInTheDocument()
    expect(await within(dialog).findByText('Next Seven Days')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Current weather conditions')).toHaveTextContent('57°CloudyHigh: 65° Low: 48°')
    expect(within(dialog).getByText('57° · Cloudy')).toBeInTheDocument()
    expect(within(dialog).queryByText('Powered by Pirate Weather')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Outdoor · Pirate Weather')).not.toBeInTheDocument()
    expect(dialog.querySelector('[data-weather-scene="clouds"]')).toBeInTheDocument()
    expect(within(dialog).getByText('Poor Air Quality')).toBeInTheDocument()
    const aqiTile = within(dialog).getByRole('article', { name: 'Outdoor air quality 152, Unhealthy' })
    expect(aqiTile).toHaveAttribute('data-aqi-tone', 'unhealthy')
    expect(within(aqiTile).queryByText('Health effects are possible for everyone.')).not.toBeInTheDocument()
    const precipitationTiles = dialog.querySelector('[data-weather-precipitation-tile="true"]') as HTMLElement
    const precipitationTile = within(dialog).getByRole('article', { name: 'Hourly precipitation chance over 6 hours, peaking at 94%' })
    const accumulationTile = within(dialog).getByRole('article', { name: 'Cumulative precipitation through 6 hours, totaling 0.04 in' })
    expect(precipitationTiles.querySelectorAll('[data-precipitation-sample]')).toHaveLength(2)
    expect(precipitationTile).toHaveTextContent('Precipitation')
    expect(accumulationTile).toHaveTextContent('Accumulation')
    expect(precipitationTile.querySelectorAll('[data-precipitation-bar="true"]')).toHaveLength(6)
    expect(accumulationTile.querySelectorAll('[data-cumulative-bar="true"]')).toHaveLength(6)
    expect(precipitationTile.querySelectorAll('[data-precipitation-grid-lines="chance"] > i')).toHaveLength(3)
    expect(accumulationTile.querySelectorAll('[data-precipitation-grid-lines="cumulative"] > i')).toHaveLength(3)
    expect(precipitationTile.querySelector('[data-precipitation-y-axis="chance"]')).toHaveTextContent('100%50%0%')
    expect(accumulationTile.querySelector('[data-precipitation-y-axis="cumulative"]')).toHaveTextContent('0.04 in0.02 in0 in')
    expect([...precipitationTile.querySelectorAll('[data-precipitation-hour-label="time"]')].map((label) => label.textContent))
      .toEqual([...accumulationTile.querySelectorAll('[data-precipitation-hour-label="cumulative-time"]')].map((label) => label.textContent))
    expect(precipitationTile.querySelector('[data-precipitation-hour-label="time"]')).toHaveTextContent('Now')
    const highProbabilityDryBar = precipitationTile.querySelector('[data-probability="94"][data-amount="0"]')
    expect(highProbabilityDryBar).toHaveAttribute('data-measurable', 'false')
    expect(highProbabilityDryBar).toHaveStyle({ '--precipitation-probability': '94%' })
    expect(precipitationTile.querySelector('[data-probability="0"]')).toHaveStyle({ '--precipitation-probability': '0%' })
    const precipitationTable = within(precipitationTiles).getByRole('table', { name: '6-hour precipitation details' })
    expect(within(precipitationTable).getAllByRole('row')).toHaveLength(7)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conditions conditions' }))
    expect(await within(dialog).findByRole('article', { name: 'Today Sunny H:65° L:48°' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: 'Thu Sunny H:71° L:50°' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('article', { name: /Tue Rain H:84° L:59°/ })).toBeInTheDocument()
    const feelsLikeTile = within(dialog).getByRole('article', { name: 'Feels Like 63°F' })
    expect(feelsLikeTile.querySelector('[data-weather-highlight-rail="feels"]')).toBeInTheDocument()
    const uvTile = within(dialog).getByRole('article', { name: 'UV Index 6.7 High' })
    expect(uvTile.querySelector('[data-weather-highlight-rail="uv"]')).toBeInTheDocument()
    const visibilityTile = within(dialog).getByRole('article', { name: 'Visibility 10 mi' })
    expect(visibilityTile.querySelector('[data-visibility-visual="distance-rail"]')).toHaveStyle({ '--weather-rail-marker': '100%', '--weather-rail-size': '100%', '--weather-rail-start': '0%' })
    expect(visibilityTile.querySelector('[data-weather-rail-marker="true"]')).toBeInTheDocument()
    const humidityTile = within(dialog).getByRole('article', { name: 'Hourly Humidity over 6 hours, ranging from 62% to 74%' })
    const cloudTile = within(dialog).getByRole('article', { name: 'Hourly Cloud Cover over 6 hours, ranging from 20% to 70%' })
    expect(humidityTile.querySelectorAll('[data-hourly-metric-bar="true"]')).toHaveLength(6)
    expect(cloudTile.querySelectorAll('[data-hourly-metric-bar="true"]')).toHaveLength(6)
    expect(humidityTile.querySelector('[data-precipitation-y-axis="humidity"]')).toHaveTextContent('80%40%0%')
    expect(cloudTile.querySelector('[data-precipitation-y-axis="cloud"]')).toHaveTextContent('70%35%0%')
    expect(humidityTile.querySelector('[data-hourly-metric-plot="humidity"]')).not.toHaveAttribute('data-axis-truncated')
    expect(humidityTile.querySelector('[data-metric="humidity"]')).toHaveAttribute('data-value', '62')
    expect(cloudTile.querySelector('[data-metric="cloud"]')).toHaveAttribute('data-value', '20')
    expect([...humidityTile.querySelectorAll('[data-hourly-metric-label="humidity"]')].map((label) => label.textContent))
      .toEqual([...cloudTile.querySelectorAll('[data-hourly-metric-label="cloud"]')].map((label) => label.textContent))
    const windTile = within(dialog).getByRole('article', { name: "Wind <1 mph; Today's gust 8 mph; From east-northeast, 59 degrees" })
    expect(windTile).toHaveAttribute('data-wide', 'true')
    expect(windTile).toHaveAttribute('data-wind-gust-forecast', 'true')
    expect(windTile.querySelector('[data-wind-speed-label]')).toHaveTextContent('Wind')
    expect(windTile.querySelector('[data-wind-speed-value]')).toHaveTextContent('<1 mph')
    expect(windTile.querySelector('[data-wind-gust-label]')).toHaveTextContent("Today's gust")
    expect(windTile.querySelector('[data-wind-gust-value]')).toHaveTextContent('8 mph')
    expect(windTile.querySelector('[data-wind-direction-label]')).toHaveTextContent('From')
    expect(windTile.querySelector('[data-wind-direction-value]')).toHaveTextContent('ENE · 59°')
    expect(windTile.querySelector('[data-wind-compass]')).toHaveAttribute('aria-hidden', 'true')
    expect([...windTile.querySelectorAll('[data-wind-cardinal]')].map((cardinal) => cardinal.textContent)).toEqual(['N', 'E', 'S', 'W'])
    expect(windTile.querySelector('[data-wind-vector]')).toHaveAttribute('data-source-bearing', '59')
    expect(windTile.querySelector('[data-wind-vector]')).toHaveAttribute('data-destination-bearing', '239')
    expect(within(dialog).getByRole('article', { name: /^Sunset / })).toBeInTheDocument()
    expect(within(dialog).queryByRole('article', { name: 'Cloud Cover 100%' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Visualization Lab/i })).not.toBeInTheDocument()
  })

  it('keeps outdoor AQI visible across good and unavailable states', async () => {
    mockEntities['sensor.pirate_weather_air_quality_index'].state = '42'
    const view = render(<AtAGlancePage />)
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    let dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('article', { name: 'Outdoor air quality 42, Good' })).toHaveAttribute('data-aqi-tone', 'good')
    expect(within(dialog).queryByText(/Outdoor air quality is/i)).not.toBeInTheDocument()

    view.unmount()
    mockEntities['sensor.pirate_weather_air_quality_index'].state = 'unavailable'
    render(<AtAGlancePage />)
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('article', { name: 'Outdoor air quality unavailable' })).toHaveAttribute('data-unavailable', 'true')
  })

  it('shows calm wind without a misleading direction vector', async () => {
    mockEntities['weather.pirate_weather'].attributes = {
      ...mockEntities['weather.pirate_weather'].attributes,
      wind_bearing: 0,
      wind_gust_speed: undefined,
      wind_speed: 0,
    }
    render(<AtAGlancePage />)
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Weather' })
    const windTile = await within(dialog).findByRole('article', { name: "Wind 0 mph; Today's gust 8 mph; Direction Calm" })
    expect(windTile.querySelector('[data-wind-direction-value]')).toHaveTextContent('Calm')
    expect(windTile.querySelector('[data-wind-vector]')).not.toBeInTheDocument()
    expect([...windTile.querySelectorAll('[data-wind-cardinal]')].map((cardinal) => cardinal.textContent)).toEqual(['N', 'S'])

    act(() => {
      setMockEntityAttribute('weather.pirate_weather', 'wind_bearing', 20)
      setMockEntityAttribute('weather.pirate_weather', 'wind_speed', 5)
    })
    await waitFor(() => expect(windTile.querySelector('[data-wind-vector]')).toHaveStyle({ transform: 'rotate(20deg)' }))
    expect([...windTile.querySelectorAll('[data-wind-cardinal]')].map((cardinal) => cardinal.textContent)).toEqual(['N', 'E', 'S', 'W'])
  })

  it('unwraps live wind bearing updates over the shortest path', async () => {
    mockEntities['weather.pirate_weather'].attributes = {
      ...mockEntities['weather.pirate_weather'].attributes,
      wind_bearing: 350,
    }
    render(<AtAGlancePage />)
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Weather' })
    const windTile = await within(dialog).findByRole('article', { name: /^Wind / })
    expect(windTile).toHaveAccessibleName(/^Wind .*; From north, 350 degrees$/)
    const vector = windTile.querySelector('[data-wind-vector]') as SVGGElement
    expect(vector).toHaveStyle({ transform: 'rotate(350deg)' })

    act(() => setMockEntityAttribute('weather.pirate_weather', 'wind_bearing', 10))
    await waitFor(() => expect(vector).toHaveStyle({ transform: 'rotate(370deg)' }))
    expect(vector).toHaveAttribute('data-source-bearing', '10')

    act(() => setMockEntityAttribute('weather.pirate_weather', 'wind_bearing', 350))
    await waitFor(() => expect(vector).toHaveStyle({ transform: 'rotate(350deg)' }))
    expect(vector).toHaveAttribute('data-source-bearing', '350')
  })

  it('uses the shell header menu without Home header actions', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
    const sidebar = screen.getAllByLabelText('Navigation menu').find((element) => element.getAttribute('data-state') === 'open')!
    expect(within(sidebar).getByText('Navigation')).toBeInTheDocument()
    const chores = within(sidebar).getByRole('menuitem', { name: /Chores/ })
    expect(chores.lastElementChild).toHaveAttribute('data-count')
    expect(sidebar).toHaveAttribute('data-state', 'open')
    fireEvent.click(sidebar.parentElement!)
    expect(sidebar).toHaveAttribute('data-state', 'closed')

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenCalledWith('security')
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
  })

  it('opens the Chores preview hash with live chore links', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}#chores-preview`)
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Chores' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Groceries/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Your Chores/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Steph's Chores/i })).toBeInTheDocument()
    expect(within(dialog).queryByText(/not available from Home/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Groceries/i }))
    expect(navigate).toHaveBeenCalledWith('groceries')
  })

})

describe('Home weather forecast freshness and ranges', () => {
  const weather = mockEntities['weather.pirate_weather']
  let originalAttributes: typeof weather.attributes
  let originalRevision: typeof weather.last_updated

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T12:30:00Z'))
    resetMockHass()
    originalAttributes = weather.attributes
    originalRevision = weather.last_updated
    weather.attributes = { ...weather.attributes, precipitation_unit: 'mm', temperature: 57, temperature_unit: '°F' }
    weather.last_updated = '2026-09-05T12:29:00Z'
    vi.spyOn(mockState.helpers, 'callService')
  })

  afterEach(() => {
    cleanup()
    weather.attributes = originalAttributes
    weather.last_updated = originalRevision
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function settle() {
    await act(async () => {})
  }

  async function openWeather() {
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/i }))
    await settle()
    return screen.getByRole('dialog', { name: 'Weather' })
  }

  function forecastCalls() {
    return mockCallServiceCalls
      .filter((call) => call.domain === 'weather')
      .map((call) => (call.serviceData as { type: string }).type)
  }

  it('delivers TTL and HA source refreshes to the hero, hourly carousel and highlight charts', async () => {
    render(<WeatherSummary />)
    await settle()
    expect(forecastCalls()).toEqual(['daily', 'hourly'])
    const hero = screen.getByLabelText('24-hour weather forecast')
    expect(within(hero).getByLabelText('Now Cloudy 57°F')).toBeInTheDocument()
    setMockHourlyWeatherForecast(0, { temperature: 71, precipitation_probability: 98, humidity: 99, cloud_coverage: 98 })
    setMockDailyWeatherForecast(0, { temperature: 85 })
    await act(async () => { await vi.advanceTimersByTimeAsync(WEATHER_FORECAST_TTL_MS) })
    expect(forecastCalls()).toEqual(['daily', 'hourly', 'daily', 'hourly'])
    expect(within(hero).getByLabelText('Now Cloudy 71°F')).toBeInTheDocument()
    const dialog = await openWeather()
    expect(forecastCalls()).toHaveLength(4)
    expect(within(dialog).getByRole('article', { name: 'Now Cloudy 71°F' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Today Sunny H:85° L:48°' })).toBeInTheDocument()
    expect(dialog.querySelector('[data-probability="98"]')).toBeInTheDocument()
    expect(dialog.querySelector('[data-metric="humidity"][data-value="99"]')).toBeInTheDocument()
    expect(dialog.querySelector('[data-metric="cloud"][data-value="98"]')).toBeInTheDocument()
    setMockHourlyWeatherForecast(0, { temperature: 73, precipitation_probability: 42, humidity: 51 })
    setMockDailyWeatherForecast(0, { temperature: 86 })
    act(() => setMockEntityAttribute('weather.pirate_weather', 'temperature', 58))
    await settle()
    expect(forecastCalls()).toEqual(['daily', 'hourly', 'daily', 'hourly', 'daily', 'hourly'])
    expect(within(hero).getByLabelText('Now Cloudy 73°F')).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Now Cloudy 73°F' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: 'Today Sunny H:86° L:48°' })).toBeInTheDocument()
    expect(dialog.querySelector('[data-metric="humidity"][data-value="51"]')).toBeInTheDocument()
  })

  it.each([
    [undefined, undefined, 'Unavailable Unavailable'],
    [undefined, 0, 'Unavailable 0%'],
    [0, undefined, '0 mm Unavailable'],
    [0, 0, '0 mm 0%'],
  ])('keeps daily amount=%s and chance=%s independent with millimeter units', async (amount, chance, label) => {
    setMockDailyWeatherForecast(0, { precipitation: amount, precipitation_probability: chance })
    setMockHourlyWeatherForecast(0, { precipitation: amount, precipitation_probability: chance })
    render(<WeatherSummary />)
    await settle()
    const dialog = await openWeather()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Precipitation conditions' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    const row = within(dialog).getByRole('article', { name: `Today precipitation ${label}` })
    expect(row).not.toHaveTextContent(' in')
    expect(within(dialog).getByRole('article', { name: `Now precipitation ${chance === undefined ? 'Unavailable' : '0%'}` })).toBeInTheDocument()
  })

  it('does not invent a unit when the daily amount is known but its unit is missing', async () => {
    delete weather.attributes.precipitation_unit
    setMockDailyWeatherForecast(0, { precipitation: 0, precipitation_probability: 0 })
    render(<WeatherSummary />)
    await settle()
    const dialog = await openWeather()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Precipitation conditions' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(within(dialog).getByRole('article', { name: 'Today precipitation 0 0%' })).toBeInTheDocument()
  })

  it.each([
    [90, 90, '100%', '50%'],
    [0, 0, '0%', '50%'],
    [40, 80, '0%', '0%'],
    [Number.NaN, 40, '0%', '0%'],
    [Infinity, 40, '0%', '0%'],
  ])('does not fabricate a temperature range for high=%s low=%s', async (high, low, dailyStart, heroStart) => {
    setMockDailyWeatherForecast(0, { temperature: high, templow: low })
    render(<WeatherSummary />)
    await settle()
    const hero = screen.getByRole('button', { name: /Open seven-day weather forecast/i })
    expect(hero.querySelector('[data-weather-rail="temperature"]')).toHaveStyle({
      '--weather-rail-start': heroStart,
      '--weather-rail-size': '0%',
    })
    const dialog = await openWeather()
    const rail = within(dialog).getByRole('region', { name: 'Seven-day weather forecast' }).querySelector('[data-weather-rail="temperature"]')
    expect(rail).toHaveStyle({ '--weather-rail-start': dailyStart, '--weather-rail-size': '0%' })
    if (!Number.isFinite(high) || high < low) expect(rail?.querySelector('[data-weather-rail-marker]')).toBeNull()
  })

  it('centers an entirely equal weekly range without a fabricated spread', async () => {
    for (let index = 0; index < 7; index += 1) setMockDailyWeatherForecast(index, { temperature: 0, templow: 0 })
    weather.attributes.temperature = 0
    render(<WeatherSummary />)
    await settle()
    const dialog = await openWeather()
    const rails = within(dialog).getByRole('region', { name: 'Seven-day weather forecast' }).querySelectorAll('[data-weather-rail="temperature"]')
    expect(rails).toHaveLength(7)
    rails.forEach((rail) => expect(rail).toHaveStyle({ '--weather-rail-start': '50%', '--weather-rail-size': '0%' }))
    expect(rails[0]).toHaveStyle({ '--weather-rail-marker': '50%' })
  })

  it.each([false, true])('reports refresh errors with cached forecasts=%s without silently hiding available data', async (cached) => {
    if (!cached) vi.mocked(mockState.helpers.callService).mockRejectedValue(new Error('Weather connection lost'))
    render(<WeatherSummary />)
    await settle()
    if (cached) {
      vi.mocked(mockState.helpers.callService).mockRejectedValue(new Error('Weather connection lost'))
      act(() => setMockEntityAttribute('weather.pirate_weather', 'temperature', 58))
      await settle()
    }
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual(['Weather connection lost', 'Weather connection lost'])
    const dialog = await openWeather()
    expect(within(dialog).getAllByText('Weather connection lost')).toHaveLength(2)
    expect(within(dialog).queryByRole('article', { name: 'Now Cloudy 57°F' }) !== null).toBe(cached)
    expect(within(dialog).queryByRole('article', { name: 'Today Sunny H:65° L:48°' }) !== null).toBe(cached)
    expect(within(dialog).queryByLabelText('Loading 24-hour conditions')).toBeNull()
  })
})
