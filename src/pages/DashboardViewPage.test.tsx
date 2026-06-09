import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { materialIconPath } from '../components/core/iconPaths'
import { DashboardViewPage } from './DashboardViewPage'
import { ROOM_PAGE_CONFIGS, ROOM_PAGE_ORDER } from '../constants/roomPages'
import { entity, mockCallServiceCalls, mockEntities, mockState, mockTodoItemsByEntity, resetMockHass } from '../test/mocks/hakitCoreState'

describe('DashboardViewPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_home'
    mockEntities['binary_sensor.all_contact_sensors'].state = 'off'
    mockEntities['binary_sensor.contact_sensors'].state = 'off'
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['select.living_room_air_purifier_auto_mode'].state = 'Default'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'docked'
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'ready'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'No error'
    mockEntities['input_text.main_floor_vacuum_error_message'].state = ''
    mockEntities['input_text.main_floor_vacuum_mode'].state = 'Vacuum'
    mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'vacuum'
    mockEntities['select.valetudo_exaltedsneakydeer_fan'].state = 'balanced'
    mockEntities['select.valetudo_exaltedsneakydeer_water'].state = 'medium'
    mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state = '1'
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['input_boolean.roborock_living_room_toggle'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_theater_room'].state = 'off'
    mockEntities['media_player.living_room_shield_2'].state = 'off'
    mockEntities['media_player.sonos'].state = 'playing'
    mockEntities['media_player.master_bedroom_apple_tv'].state = 'paused'
    mockEntities['media_player.primary_bedroom'].state = 'playing'
    mockEntities['media_player.theater_room_shield'].state = 'off'
    mockEntities['media_player.theater'].state = 'off'
    mockEntities['media_player.sony_projector'].state = 'off'
    mockEntities['switch.guest_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.guest_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['switch.master_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.master_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['cover.left_door'].state = 'closed'
    mockEntities['cover.right_door'].state = 'closed'
    mockEntities['lock.aqara_smart_lock_u400'].state = 'locked'
    mockEntities['lock.fordpass_3fmtk3su5mma09266_doorlock'].state = 'locked'
  })

  it('renders a statically ported room page from React-owned config', () => {
    const navigate = vi.fn()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    render(<DashboardViewPage activePath="living-room" onNavigate={navigate} path="living-room" />)

    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(back).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalledWith('overview')
    back.mockRestore()
    expect(screen.queryByRole('heading', { name: 'Room Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Window/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
  })

  it('renders the source empty room state for room pages without body cards', () => {
    render(<DashboardViewPage activePath="hallway" onNavigate={() => undefined} path="hallway" />)

    expect(screen.getByRole('heading', { name: 'Hallway' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' })).toBeInTheDocument()
    expect(screen.getByText('Once some devices are added to this room, we can display them here.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' }).parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' }).parentElement).toHaveAttribute('data-empty-typography', 'festival')
  })

  it('opens room status hashes with reusable Home modal sheets directly', async () => {
    mockEntities['light.kitchen'] = entity('light.kitchen', 'off')
    mockEntities['light.kitchen_table_light'] = entity('light.kitchen_table_light', 'off')
    mockEntities['light.kitchen_door_light'] = entity('light.kitchen_door_light', 'off')
    mockEntities['light.kitchen_counter_light'] = entity('light.kitchen_counter_light', 'off')
    mockEntities['light.kitchen_sink_light'] = entity('light.kitchen_sink_light', 'off')
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    fireEvent.click(screen.getByRole('button', { name: /Lights/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Kitchen Lights' })).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Kitchen: Lights' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Kitchen Lights: Off')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Kitchen Lights controls and status details')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle Kitchen lights' })
    expect(toggle).toBeInTheDocument()
    expect(toggle.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-multiple-off'))
    expect(screen.queryByText('Rooms')).not.toBeInTheDocument()
  })

  it('uses a singular active bulb icon for single-light room toggles', async () => {
    mockEntities['light.gym_light'] = entity('light.gym_light', 'on')
    render(<DashboardViewPage activePath="gym" onNavigate={() => undefined} path="gym" />)

    fireEvent.click(screen.getByRole('button', { name: /Light/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle Gym lights' })
    expect(toggle.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb'))
  })

  it('opens Living Room climate, occupancy, and air quality popups from header chips', async () => {
    const renderLivingRoom = () => render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    let view = renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Climate/i })[0])
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Climate' })).toHaveLength(1)
    expect(within(dialog).getByText('69°F - 72°F')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Occupancy/i })[0])
    dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Occupancy' })).toHaveLength(1)
    expect(within(dialog).getByText('Occupied')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Living Room Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 • 2 μg/m³')).toBeInTheDocument()
    expect(screen.getByText('Fan Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Current Readings')).not.toBeInTheDocument()
  })

  it('ports the Guest Room source page with its status chips and reusable popups', async () => {
    const renderGuestRoom = () => render(<DashboardViewPage activePath="guest-room" onNavigate={() => undefined} path="guest-room" />)

    let view = renderGuestRoom()
    expect(screen.getByRole('heading', { name: 'Guest Room' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Room Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lights On$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Climate 69°F - 71°F$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Occupancy Detected$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Occupancy Detected$/i })).toHaveAttribute('data-icon', 'mdi:motion-sensor')
    expect(screen.getByRole('button', { name: /^Window Closed$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Air Quality 1 • 2 μg\/m³$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    const ventCard = screen.getByRole('button', { name: /^Vent Open$/i })
    const airPurifierCard = screen.getByRole('button', { name: /^Air Purifier Auto • On$/i })
    expect(ventCard).toHaveAttribute('data-tone', 'climate')
    expect(ventCard).not.toHaveAttribute('data-size')
    expect(airPurifierCard).toHaveAttribute('data-tone', 'air')
    expect(airPurifierCard).not.toHaveAttribute('data-size')

    fireEvent.click(screen.getByRole('button', { name: /^Lights On$/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Guest Room Lights' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TV Light On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bed Light Off/i })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Climate 69°F - 71°F$/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Guest Room Climate' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Temperature Sensors' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vent' })).toBeInTheDocument()
    expect(screen.getByText('69.5°F')).toBeInTheDocument()
    expect(screen.getByText('70.2°F')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Window Closed$/i }))
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Window' })).toBeInTheDocument()
    expect(within(dialog).queryByText('All Closed')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Guest Room Window: All Closed')).not.toBeInTheDocument()
    const windowRow = within(dialog).getByLabelText('Window Closed')
    expect(windowRow.tagName).toBe('ARTICLE')
    expect(within(dialog).queryByRole('button', { name: /^Window Closed$/i })).not.toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Air Quality 1 • 2 μg\/m³$/i }))
  dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 • 2 μg/m³')).toBeInTheDocument()
    expect(screen.getByText('Fan Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Current Readings')).not.toBeInTheDocument()
  })

  it('uses the clear motion sensor icon for clear occupancy header chips', () => {
    mockEntities['binary_sensor.living_room_occupancy_sensors'].state = 'off'

    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    expect(screen.getByRole('button', { name: /^Occupancy Clear$/i })).toHaveAttribute('data-icon', 'mdi:motion-sensor-off')
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

  it('ports the Admin page sections, descriptions, and presence override modal', async () => {
    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Security Controls' })).toBeInTheDocument()
    expect(screen.getByText('Disables automatic locking of the front door. Useful for when contractors are over, or we have people frequently entering/leaving the home.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('heading', { name: 'Presence-Based Light Overrides' })).toBeInTheDocument()
    expect(screen.getByText('Enable or disable presence-based lighting in specific rooms. Useful for when we have company, or need to quickly keep lights on or off without using the voice commands.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Overrides' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Overrides' })).toHaveAttribute('data-tone', 'switch-active')
    expect(screen.getByRole('heading', { name: 'Show Specific Controls' })).toBeInTheDocument()
    expect(screen.getByText("Shows the outdoor faucets in our Home Assistant pages. Useful to disable during the winter, when we aren't using them.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Outdoor Faucets Off/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Christmas Lights Off/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Automatic Presence Setting Overrides' })).toBeInTheDocument()
    expect(screen.getByText("Sometimes, we disable automatic presence-based lighting in rooms that we'd otherwise want to wake up and have that presence-based lighting active.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' })).toHaveAttribute('data-tone', 'switch-active')

    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Overrides' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-surface', 'hass-popup')
    expect(screen.getByRole('heading', { name: 'Presence-Based Overrides' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On · Active/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On · Active/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('button', { name: /Living Room On · Active/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-auto'))
    expect(screen.getByRole('button', { name: /Upper Deck On · Active/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Living Room On · Active/i }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'toggle_presence_lighting_override',
        serviceData: { presence_switch: 'switch.living_room_presence_living_room_lights_presence_allowed' },
      },
    ])
  })

  it('opens the Admin auto-reset modal and toggles room auto re-enable switches', async () => {
    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Presence-Based Overrides Auto-Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('button', { name: /Living Room On/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:autorenew'))
    expect(screen.getByRole('button', { name: /Upper Deck On/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Kitchen On/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.kitchen_auto_re_enable_presence_lighting' },
    ])
  })

  it('ports the Settings tab as the source row list with exact navigation targets', () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="settings" />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Settings pages' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pages' })).not.toBeInTheDocument()
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom Lights')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenLastCalledWith('security')

    const admin = screen.getByRole('button', { name: /Admin Controls Presence-Based Toggles, Automation Overrides, and More/i })
    expect(admin.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:shield-account'))
    fireEvent.click(admin)
    expect(navigate).toHaveBeenLastCalledWith('admin')

    fireEvent.click(screen.getByRole('button', { name: /Guest Controls Toggle automations when guests stay over\./i }))
    expect(navigate).toHaveBeenLastCalledWith('guests-staying-over')

    fireEvent.click(screen.getByRole('button', { name: /To-Do An admin panel for to-do tasks\./i }))
    expect(navigate).toHaveBeenLastCalledWith('to-do')

    const machE = screen.getByRole('button', { name: /Mach-E Controls for the Mustang Mach-E\./i })
    expect(machE.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:car-estate'))
    fireEvent.click(machE)
    expect(navigate).toHaveBeenLastCalledWith('mach-e')

    const hassSettings = screen.getByRole('button', { name: /Home Assistant Settings Access more in-depth Home Assistant details and settings\./i })
    expect(hassSettings).toHaveAttribute('data-external-path', '/config')
  })

  it('ports the Guest Controls page with source text, icons, states, and toggle actions', () => {
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'on'
    mockEntities['input_boolean.guests_staying_in_theater_room'].state = 'off'
    const navigate = vi.fn()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)

    render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="guests-staying-over" />)

    expect(screen.getByRole('heading', { name: 'Guest Controls', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Guests Staying Over' })).not.toBeInTheDocument()
    expect(screen.getByText("When guests stay over, toggle these controls on based on the rooms they're staying in to disable automations (like automatic vacuuming in the music room) and ensure that rooms are tracked for temperature monitoring and vent control.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(back).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalledWith('overview')
    back.mockRestore()

    const guestRoom = screen.getByRole('button', { name: /Guest Room Off/i })
    expect(guestRoom).toHaveAttribute('aria-pressed', 'false')
    expect(guestRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:bed'))

    const musicRoom = screen.getByRole('button', { name: /Music Room On/i })
    expect(musicRoom).toHaveAttribute('aria-pressed', 'true')
    expect(musicRoom).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(musicRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:guitar-electric'))

    const theaterRoom = screen.getByRole('button', { name: /Theater Room Off/i })
    expect(theaterRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:projector'))
    fireEvent.click(theaterRoom)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'input_boolean.guests_staying_in_theater_room' },
    ])
  })

  it('keeps the Whole Home thermostat range colors visible while the aggregate climate is off', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveStyle({ '--ha-control-slider-color': 'rgba(255, 255, 255, 0.78)', '--ha-control-slider-high-color': '#2c8e98', '--ha-control-slider-low-color': '#cd5401' })
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveAttribute('data-inactive', 'false')
  })

  it('colors the Thermostat Hub glass card from active heat and cool status', () => {
    mockEntities['climate.thermostat_hub_w200'].attributes.hvac_action = 'cooling'
    const view = render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'cool')

    view.unmount()
    mockEntities['climate.thermostat_hub_w200'].attributes.hvac_action = 'heating'
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'heat')
  })

  it('uses HASS climate dropdowns for Thermostat Hub mode and fan mode when exposed', async () => {
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_modes = ['auto', 'off']
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_mode = 'auto'
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Mode Off/i))
    let pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Heat' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_hvac_mode', target: 'climate.thermostat_hub_w200', serviceData: { hvac_mode: 'heat' } })

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Fan Auto/i))
    pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Off' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_fan_mode', target: 'climate.thermostat_hub_w200', serviceData: { fan_mode: 'off' } })
  })

  it('renders Thermostat Hub as a mode-only card without temperature and humidity chips', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Thermostat Hub Mode Off/i)).toBeInTheDocument()
    expect(screen.queryByText('73.4 °F')).not.toBeInTheDocument()
    expect(screen.queryByText('38.0%')).not.toBeInTheDocument()
  })

  it('ports the Ecobee thermostat page with source controls and room popups', async () => {
    mockEntities['climate.thermostat_contact_sensors_global_virtual_thermostat'].attributes.hvac_action = 'heating'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.current_temperature = null
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.queryByText(/manual review/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Whole Home' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Heating 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveStyle({ '--ha-control-slider-color': '#cd5401', '--ha-control-slider-high-color': '#2c8e98', '--ha-control-slider-low-color': '#cd5401' })
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveAttribute('data-inactive', 'false')
    expect(screen.queryByRole('button', { name: /Decrease Whole Home target temperature/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Increase Whole Home target temperature/i })).not.toBeInTheDocument()
    const targetSliders = screen.getAllByRole('slider', { name: 'Whole Home target temperature' })
    expect(targetSliders).toHaveLength(2)
    fireEvent.change(targetSliders[0], { target: { value: '73' } })
    expect(screen.getByRole('region', { name: /Whole Home thermostat Heating 71.0°F 73.0 · 74.0/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
    fireEvent.pointerUp(targetSliders[0])
    expect(mockCallServiceCalls).toEqual([{ domain: 'climate', service: 'set_temperature', target: [
      'climate.thermostat_contact_sensors_living_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_office_virtual_thermostat',
      'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_kitchen_virtual_thermostat',
      'climate.thermostat_contact_sensors_guest_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_dining_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_gym_virtual_thermostat',
      'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_music_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_theater_room_virtual_thermostat',
    ], serviceData: { target_temp_high: 74, target_temp_low: 73 } }])
    mockCallServiceCalls.length = 0
    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Thermostat Hub Mode Off/i)).toBeInTheDocument()
    expect(screen.queryByText('73.4 °F')).not.toBeInTheDocument()
    expect(screen.queryByText('38.0%')).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Office 71.6°F · Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Master Bedroom 71.0°F · Active' })).toBeInTheDocument()

    const ecoMode = screen.getByRole('button', { name: /^Eco Mode On$/i })
    expect(ecoMode).toHaveAttribute('aria-pressed', 'true')
    expect(ecoMode.closest('[data-active]')).toHaveAttribute('data-active', 'true')
    expect(screen.getByLabelText(/Eco Mode Critical Tracking Track Select Critical/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Eco Behavior When Away Keep Eco Active/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Eco Mode Critical Tracking Track Select Critical/i))
    const pickerSheet = await screen.findByRole('dialog')
    expect(pickerSheet).toHaveAttribute('data-surface', 'default')
    expect(within(pickerSheet).getByRole('group', { name: 'Eco Mode Critical Tracking options' })).toHaveAttribute('data-layout', 'card-grid')
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:thermometer-check'))
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }).querySelectorAll('path')).toHaveLength(1)
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Active' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:thermometer-alert'))
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/Enable Eco Mode to only track active rooms/i)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Track Selected Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Living Room On$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Office Off$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Force Track Critical Temperature' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Music Room' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Theater Room' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /^Master Bedroom$/i })).not.toBeInTheDocument()

    fireEvent.click(ecoMode)
    fireEvent.click(screen.getByRole('button', { name: /^Automatic Thermostat On$/i }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_eco_mode' },
      { domain: 'homeassistant', service: 'toggle', target: 'input_boolean.enable_disable_thermostat_contact_sensors_integration' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-surface', 'hass-popup')
    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room Vents' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Living Room thermostat Idle --°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Living Room thermostat Idle 0.0°F/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Decrease Living Room target temperature/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Increase Living Room target temperature/i })).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: /^Vent 1 Open$/i })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: /^Vent 2 Open$/i })).toBeInTheDocument()
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
    mockEntities['humidifier.master_bedroom_humidifier'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    expect(screen.getByLabelText(/Humidifier Unavailable/i)).toHaveAttribute('data-muted', 'true')
    expect(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i })).toHaveStyle('--tile-color: rgba(136, 64, 26, 0.6)')
    expect(screen.getByRole('button', { name: /Steph's Bed Off/i })).toHaveAttribute('data-muted', 'true')
    expect(screen.getByRole('button', { name: /Apple TV Paused/i })).toHaveAttribute('data-muted', 'false')

    fireEvent.click(screen.getByLabelText(/Humidifier Unavailable/i))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Master Bedroom Climate' })).not.toBeInTheDocument()
  })

  it('opens Eight Sleep bed modals with stage controls and hot flash actions', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(dialog).getByRole('heading', { name: "Master Bedroom Stephen's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+1/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })).toHaveAttribute('aria-readonly', 'false')
    expect(within(dialog).getByRole('heading', { name: 'Sleep Stages' })).toBeInTheDocument()
    expect(within(dialog).getByText('NOW')).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Stephen's Bed now value 0")).toBeInTheDocument()
    expect(within(dialog).getByText('BEDTIME')).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Stephen's Bed bedtime value -1")).toHaveTextContent('-1')
    expect(within(dialog).getByText('ASLEEP')).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Stephen's Bed asleep value 2")).toHaveTextContent('+2')
    expect(within(dialog).getByText('DAWN')).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Stephen's Bed dawn value 2")).toHaveTextContent('+2')
    expect(within(dialog).getByRole('heading', { name: 'Special Modes' })).toBeInTheDocument()
    expect(within(dialog).getByText('Activating hot flash mode will set the bed to -10 for fifteen minutes.')).toBeInTheDocument()
    const hotFlash = within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })
    expect(hotFlash).toBeInTheDocument()
    expect(hotFlash.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:snowflake'))

    fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed now increase" }))
    fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed bedtime increase" }))
    fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed asleep increase" }))
    fireEvent.click(hotFlash)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: 10, sleep_stage: 'override_bedtime' } },
      { domain: 'input_number', service: 'set_value', target: 'input_number.eight_sleep_stephen_bedtime_level', serviceData: { value: 0 } },
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: 0, sleep_stage: 'bedTimeLevel' } },
      { domain: 'input_number', service: 'set_value', target: 'input_number.eight_sleep_stephen_asleep_level', serviceData: { value: 3 } },
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: 30, sleep_stage: 'initialSleepLevel' } },
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_hot_flash' },
    ])
  })

  it('shows active Eight Sleep hot flash countdown and cancel action', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('region', { name: /Steph's Bed thermostat Cooling -10/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('12:34')).toBeInTheDocument()
    const cancel = within(dialog).getByRole('button', { name: "Cancel Steph's Bed hot flash mode" })
    expect(cancel.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:close'))

    fireEvent.click(cancel)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_steph_cancel_hot_flash' },
    ])
  })

  it('turns on an off Eight Sleep side from the thermostat tap target', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'off'
    mockEntities['sensor.steph_s_eight_sleep_side_now_level'].state = '-3'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: "Turn on Steph's Bed" }))

    expect(confirm).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: "Turn off Steph's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Steph's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Steph's Bed now increase" })).not.toBeDisabled()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'eight_sleep', service: 'side_on', target: 'sensor.steph_s_eight_sleep_side_bed_temperature' },
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.steph_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: -30, sleep_stage: 'override_bedtime' } },
    ])

    confirm.mockRestore()
  })

  it('reapplies the displayed Eight Sleep NOW value after power cycling the side', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i }))
    const dialog = await screen.findByRole('dialog')
    const decreaseNow = within(dialog).getByRole('button', { name: "Stephen's Bed now decrease" })
    fireEvent.click(decreaseNow)
    fireEvent.click(decreaseNow)
    fireEvent.click(decreaseNow)
    expect(within(dialog).getByLabelText("Stephen's Bed now value -3")).toHaveTextContent('-3')

    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: "Turn off Stephen's Bed" }))
    fireEvent.click(within(dialog).getByRole('button', { name: "Turn on Stephen's Bed" }))

    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'eight_sleep', service: 'side_off', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature' },
      { domain: 'eight_sleep', service: 'side_on', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature' },
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: -30, sleep_stage: 'override_bedtime' } },
    ])

    confirm.mockRestore()
  })

  it('drags the Eight Sleep hero dial as an app-scale NOW control', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i }))
    const dialog = await screen.findByRole('dialog')
    const slider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })

    fireEvent.change(slider, { target: { value: '-3.6' } })
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -4/i })).toBeInTheDocument()
    expect(within(dialog).getByText('Heating • +1')).toBeInTheDocument()
    expect(within(dialog).getByText("Master Bedroom Stephen's Bed: Heating • +1")).toBeInTheDocument()
    fireEvent.pointerUp(slider)

    expect(within(dialog).getByText('Cooling • -4')).toBeInTheDocument()
    expect(within(dialog).getByText("Master Bedroom Stephen's Bed: Cooling • -4")).toBeInTheDocument()

    expect(mockCallServiceCalls).toEqual([
      { domain: 'eight_sleep', service: 'heat_set', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature', serviceData: { duration: 0, target: -40, sleep_stage: 'override_bedtime' } },
    ])
  })

  it('confirms before turning off an on Eight Sleep side from the thermostat tap target', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i }))
    const dialog = await screen.findByRole('dialog')
    const toggle = within(dialog).getByRole('button', { name: "Turn off Stephen's Bed" })

    fireEvent.click(toggle)
    expect(confirm).toHaveBeenCalledWith("Turn off Stephen's Bed?")
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(toggle)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'eight_sleep', service: 'side_off', target: 'sensor.stephen_s_eight_sleep_side_bed_temperature' },
    ])
    expect(within(dialog).getByRole('button', { name: "Turn on Stephen's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Idle 0/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Stephen's Bed now increase" })).toBeDisabled()

    confirm.mockRestore()
  })

  it('disables Eight Sleep stage controls when that bed side is off', async () => {
    mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'off'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))

    const dialog = await screen.findByRole('dialog')
    for (const label of ['now', 'bedtime', 'asleep', 'dawn']) {
      const decrease = within(dialog).getByRole('button', { name: `Steph's Bed ${label} decrease` })
      const increase = within(dialog).getByRole('button', { name: `Steph's Bed ${label} increase` })
      expect(decrease).toBeDisabled()
      expect(increase).toBeDisabled()
      fireEvent.click(decrease)
      fireEvent.click(increase)
    }

    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps Eight Sleep stage edits visible while stale HASS values catch up', async () => {
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Heating • 86 °F/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed now decrease" }))
    fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed now decrease" }))

    expect(within(dialog).getByLabelText("Stephen's Bed now value -2")).toHaveTextContent('-2')

    mockEntities['sensor.stephen_s_eight_sleep_side_now_level'].state = '-1'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(within(screen.getByRole('dialog')).getByLabelText("Stephen's Bed now value -2")).toHaveTextContent('-2')

    mockEntities['sensor.stephen_s_eight_sleep_side_now_level'].state = '-2'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    mockEntities['sensor.stephen_s_eight_sleep_side_now_level'].state = '0'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(within(screen.getByRole('dialog')).getByLabelText("Stephen's Bed now value 0")).toHaveTextContent('0')
  })

  it('ports the Living Room SHIELD remote modal and only runs explicit controls', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'playing'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^SHIELD Off$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room: SHIELD' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sonos Volume' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(screen.getByRole('button', { name: 'Select' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:circle'))
    expect(screen.getByRole('button', { name: 'Back' }).querySelector('path')).toHaveAttribute('transform', 'rotate(90 12 12)')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Volume Down' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'remote', service: 'send_command', target: 'remote.living_room_shield', serviceData: { command: 'DPAD_UP' } },
      { domain: 'androidtv', service: 'adb_command', target: 'media_player.living_room_shield_2', serviceData: { command: 'input keyevent KEYCODE_MEDIA_PAUSE' } },
      { domain: 'media_player', service: 'volume_down', target: 'media_player.sonos', serviceData: undefined },
    ])
  })

  it('hides remote volume and playback sections when their entities are off', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'off'
    mockEntities['media_player.sonos'].state = 'off'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^SHIELD Off$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(0, 128, 0)' })
    expect(screen.queryByRole('heading', { name: 'Sonos Volume' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Controls' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Volume Down' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('ports media app cards inside remote modals with YAML service payloads', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'playing'
    let view = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^SHIELD Off$/i }))
    expect(await screen.findByRole('heading', { name: 'Media' })).toBeInTheDocument()
    const livingRoomRemoteDialog = screen.getByRole('dialog')
    expect(within(livingRoomRemoteDialog).getByRole('button', { name: 'YouTube' })).toHaveAttribute('data-background', 'white')
    fireEvent.click(within(livingRoomRemoteDialog).getByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.living_room_shield', remote_entity: 'remote.living_room_shield', app_id: 'com.plexapp.android' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    fireEvent.click(screen.getByRole('button', { name: /^Apple TV Paused$/i }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_apple_tv', target: undefined, serviceData: { entity: 'media_player.master_bedroom_apple_tv', app_name: 'Plex', remote_entity: 'remote.master_bedroom_apple_tv' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disney+' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield', app_id: 'com.disney.disneyplus', turn_on_projector: true } },
    ])
  })

  it('runs Living Room page-level media app shortcuts from source image tiles', () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    const plex = screen.getByRole('button', { name: 'Plex' })
    expect(plex).toHaveAttribute('data-card', 'media-app')
    expect(screen.getByRole('button', { name: 'YouTube' })).toHaveClass(/mediaAppTileWhite/)

    fireEvent.click(plex)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.living_room_shield', remote_entity: 'remote.living_room_shield', app_id: 'com.plexapp.android' } },
    ])
  })

  it('matches the Music Room source vacuum overview card', () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'docked'
    mockEntities['sensor.valetudo_elatedusedram_battery_level'].state = '100'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Music Room Docked • 100%/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Robot Vacuum Docked/i })).not.toBeInTheDocument()
  })

  it('matches Theater Room source media app, PC, and vacuum cards', () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Plex' }))
    fireEvent.click(screen.getByRole('button', { name: /Theater Room PC Off/i }))

    expect(screen.getByRole('button', { name: /Theater Room Docked • 99%/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield_remote', app_id: 'com.plexapp.android', turn_on_projector: true } },
      { domain: 'input_button', service: 'press', target: 'input_button.theater_pc_on' },
    ])
  })

  it('runs bathroom switch cards and preserves source switch colors', () => {
    render(<DashboardViewPage activePath="guest-bathroom" onNavigate={() => undefined} path="guest-bathroom" />)

    const fan = screen.getByRole('button', { name: /Fan Off/i })
    const towelRack = screen.getByRole('button', { name: /Towel Rack On/i })
    expect(towelRack).toHaveStyle('--tile-color: rgba(136, 64, 26, 0.6)')

    fireEvent.click(fan)
    fireEvent.click(towelRack)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.guest_bathroom_fan_switch_top' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.guest_bathroom_towel_rack_switch_top' },
    ])
  })

  it('ports the Master Bedroom Apple TV remote modal from the YAML popup', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /^Apple TV Paused$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Master Bedroom: Apple TV' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Apple TV Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Volume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'apple_tv_remote_send_command', target: undefined, serviceData: { remote_entity: 'remote.master_bedroom_apple_tv', command: 'select' } },
      { domain: 'script', service: 'toggle_sonos_mute', target: undefined, serviceData: { sonosdevice: ['media_player.primary_bedroom'] } },
      { domain: 'script', service: 'apple_tv_remote_send_command', target: undefined, serviceData: { remote_entity: 'remote.master_bedroom_apple_tv', command: 'play' } },
    ])
  })

  it('ports the Theater Room remote modal with device controls', async () => {
    mockEntities['media_player.theater_room_shield'].state = 'playing'
    mockEntities['media_player.theater'].state = 'on'
    mockEntities['input_boolean.theater_pc_power'].state = 'on'
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room: Theater Room' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    fireEvent.click(screen.getByRole('button', { name: /Projector Off/i }))
    fireEvent.click(screen.getByRole('button', { name: /Theater Room PC On/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'toggle_on_off_theater_room', target: undefined, serviceData: undefined },
      { domain: 'remote', service: 'send_command', target: 'remote.theater_shield_remote', serviceData: { command: 'DPAD_RIGHT' } },
      { domain: 'media_player', service: 'toggle', target: 'media_player.sony_projector', serviceData: undefined },
      { domain: 'input_button', service: 'press', target: 'input_button.theater_pc_off', serviceData: undefined },
    ])
  })

  it('opens room vacuum source cards with reusable vacuum modal controls', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.queryByText('Main Floor Robot Vacuum')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vacuum Controls' })).toBeInTheDocument()
    expect(screen.getByText('Power Settings')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Power Settings' })).toBeInTheDocument()
    const dockedGroup = screen.getByRole('group', { name: 'Docked' })
    expect(dockedGroup).toBeInTheDocument()
    expect(within(dockedGroup).queryByRole('button', { name: 'Empty Dock' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mode options' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mode Vacuum/i }))
    const modePicker = await screen.findByRole('dialog', { name: 'Mode' })
    expect(within(modePicker).getByRole('button', { name: 'Vacuum' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(modePicker).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: /Fan Balanced/i }))
    const fanPicker = await screen.findByRole('dialog', { name: 'Fan' })
    expect(within(fanPicker).getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(fanPicker).getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('heading', { name: 'Docked' })).toBeInTheDocument()
    const cleaningPassesButton = screen.getByRole('button', { name: /Cleaning Passes 1/i })
    expect(cleaningPassesButton).toHaveAttribute('data-has-icon', 'false')
    fireEvent.click(cleaningPassesButton)
    const passesPicker = await screen.findByRole('dialog', { name: 'Cleaning Passes' })
    expect(within(passesPicker).getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(passesPicker).getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: 'Clean' })).toHaveAttribute('data-icon', 'mdi:play')
    const zonesHeading = screen.getByRole('heading', { name: 'Zones' })
    expect(screen.getByText('Select any zones to focus cleaning in those areas. If you press clean and no zones are selected, we will clean all zones on the Main Floor.')).toBeInTheDocument()
    expect(screen.getByText('Zones are not selectable or changeable while cleaning is ongoing.')).toBeInTheDocument()
    const additionalControlsHeading = screen.getByRole('heading', { name: 'Additional Controls' })
    expect(zonesHeading.compareDocumentPosition(additionalControlsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Empty Dock' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:delete-restore'))
    expect(screen.getByRole('button', { name: /living room/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:sofa'))
  })

  it('runs source-derived vacuum modal services without activating hidden actions', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Locate' }))
    fireEvent.click(screen.getByRole('button', { name: /Fan Balanced/i }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Fan' })).getByRole('button', { name: 'Turbo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))
    fireEvent.click(screen.getByRole('button', { name: 'Empty Dock' }))
    fireEvent.click(screen.getByRole('button', { name: 'Living Room' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'locate', target: 'vacuum.valetudo_exaltedsneakydeer' },
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_fan', serviceData: { option: 'turbo' } },
      { domain: 'script', service: 'main_floor_vacuum_clean_selected_segments', target: undefined },
      { domain: 'button', service: 'press', target: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock' },
      { domain: 'input_boolean', service: 'toggle', target: 'input_boolean.roborock_living_room_toggle' },
    ])
  })

  it('keeps mapped vacuum error text visible in the modal status area', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'error'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'Brush stuck'
    mockEntities['input_text.main_floor_vacuum_error_message'].state = 'Main brush is stuck under the sofa'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Error/i }))

    const errorMessage = await screen.findByRole('alert')
    expect(within(errorMessage).getByText('Main brush is stuck under the sofa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dock' })).toBeInTheDocument()
  })

  it('opens Theater Room vacuum with map and full Valetudo power controls', async () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Theater Room Docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mode Vacuum/i }))
    const theaterModePicker = await screen.findByRole('dialog', { name: 'Mode' })
    expect(within(theaterModePicker).getByRole('button', { name: 'Vacuum' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(theaterModePicker).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: /Fan Balanced/i }))
    expect(within(await screen.findByRole('dialog', { name: 'Fan' })).getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/Entity not available/i)).not.toBeInTheDocument()
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

    const ventCard = screen.getByRole('button', { name: /Vent Open/i })
    expect(ventCard).toHaveAttribute('data-tone', 'climate')
    expect(ventCard).not.toHaveAttribute('data-size')
    fireEvent.click(ventCard)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen: Vent' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Kitchen Climate' })).not.toBeInTheDocument()
  })

  it('keeps Back Deck grill controls inside the grill popup', async () => {
    render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    expect(screen.getByRole('heading', { name: 'Grill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bear Grills Off/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bear Grills Off')).toHaveAttribute('data-muted', 'true')
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
    mockEntities['input_boolean.stephen_s_pc_power'].state = 'on'
    mockEntities['input_text.stephen_s_pc_power_state'].state = 'On'
    mockEntities['input_boolean.steph_s_pc_power'].state = 'off'
    mockEntities['input_text.steph_s_pc_power_state'].state = 'Off'
    render(<DashboardViewPage activePath="office" onNavigate={() => undefined} path="office" />)

    expect(screen.getByRole('heading', { name: 'Office PCs' })).toBeInTheDocument()
    const stephenPc = screen.getByRole('button', { name: /Stephen's PC On/i })
    const stephPc = screen.getByRole('button', { name: /Steph's PC Off/i })
    expect(stephenPc).toHaveAttribute('data-tone', 'switch')
    expect(stephenPc).toHaveAttribute('data-muted', 'false')
    expect(stephPc).toHaveAttribute('data-tone', 'switch')
    expect(stephPc).toHaveAttribute('data-muted', 'true')
    expect(stephenPc.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:controller'))
    expect(stephPc.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:controller'))

    fireEvent.click(stephenPc)
    fireEvent.click(stephPc)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.stephen_s_pc_off' },
      { domain: 'input_button', service: 'press', target: 'input_button.steph_s_pc_on' },
    ])
  })

  it('ports the Security page visible YAML sections and controls', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getAllByRole('heading', { name: 'Security' }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toHaveAttribute('data-icon', 'mdi:shield-home')
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toHaveAttribute('data-icon-color', 'rgb(30, 136, 229)')
    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toHaveAttribute('data-icon', 'mdi:door')
    expect(screen.getByRole('button', { name: /Security System Armed Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Locked/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cameras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Front Door camera' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mach-E' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Doors Locked/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/manual review/i)).not.toBeInTheDocument()
  })

  it('reflects alarm state in the Security header chip', () => {
    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'disarmed'
    const disarmedView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Disarmed/i })).toHaveAttribute('data-icon', 'mdi:shield-off')
    expect(screen.getByRole('button', { name: /Security\s*Disarmed/i })).toHaveAttribute('data-icon-color', 'rgb(67, 160, 71)')
    disarmedView.unmount()

    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_away'
    const awayView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Armed Away/i })).toHaveAttribute('data-icon', 'mdi:shield')
    expect(screen.getByRole('button', { name: /Security\s*Armed Away/i })).toHaveAttribute('data-icon-color', 'rgb(229, 57, 53)')
    awayView.unmount()

    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_night'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Armed Night/i })).toHaveAttribute('data-icon', 'mdi:shield-moon')
    expect(screen.getByRole('button', { name: /Security\s*Armed Night/i })).toHaveAttribute('data-icon-color', 'rgb(142, 36, 170)')
  })

  it('matches HASS Security garage door colors for closed, open, and closing states', () => {
    const closedView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toHaveAttribute('data-tone', 'contact')
    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Closed/i })).toHaveAttribute('data-tone', 'contact')
    expect(screen.getByRole('button', { name: /Right Door Closed/i })).toHaveAttribute('data-muted', 'false')
    closedView.unmount()

    mockEntities['cover.left_door'].state = 'open'
    mockEntities['cover.right_door'].state = 'open'
    const openView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-muted', 'false')
    openView.unmount()

    mockEntities['cover.left_door'].state = 'closing'
    mockEntities['cover.right_door'].state = 'closing'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Closing/i })).toHaveAttribute('data-tone', 'security')
    expect(screen.getByRole('button', { name: /Left Door Closing/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Closing/i })).toHaveAttribute('data-tone', 'security')
    expect(screen.getByRole('button', { name: /Right Door Closing/i })).toHaveAttribute('data-muted', 'false')
  })

  it('opens Security System as a modal and only calls alarm services from explicit mode buttons', async () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Security System Armed Home/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Security System' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set security system to Away' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Set security system to Away' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'alarm_control_panel', service: 'alarm_arm_away', target: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2' },
    ])
  })

  it('runs explicit lock services and YAML toggle actions for garage doors', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Front Door Locked/i }))
    fireEvent.click(screen.getByRole('button', { name: /Left Door Closed/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'lock', service: 'unlock', target: 'lock.aqara_smart_lock_u400' },
      { domain: 'homeassistant', service: 'toggle', target: 'cover.left_door' },
    ])
  })

  it('locks the Front Door when the U400 lock is already unlocked', () => {
    mockEntities['lock.aqara_smart_lock_u400'].state = 'unlocked'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Front Door Unlocked/i }))

    expect(mockCallServiceCalls).toEqual([{ domain: 'lock', service: 'lock', target: 'lock.aqara_smart_lock_u400' }])
  })

  it('opens the Security contact sensor overview grouped from the YAML popup', async () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact Sensors' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entryway' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Office' })).toBeInTheDocument()
    expect(screen.getByLabelText('PC Window Closed')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Window Closed').length).toBeGreaterThan(0)
  })

  it('opens Security camera popups with WebRTC actions and recording script payloads', async () => {
    const firedEvents: string[] = []
    window.addEventListener('webrtc-screenshot', () => firedEvents.push('webrtc-screenshot'), { once: true })
    window.addEventListener('webrtc-toggle-mute', () => firedEvents.push('webrtc-toggle-mute'), { once: true })
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Front Door camera' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Front Door Camera' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Snapshot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Muted' }))
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))

    expect(firedEvents).toEqual(['webrtc-screenshot', 'webrtc-toggle-mute'])
    expect(mockCallServiceCalls).toEqual([{ domain: 'script', service: 'turn_on', target: 'script.front_door_manual_recording' }])
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

  it('ports the Chores page source sections, quick links, and Stephen user visibility', async () => {
    const navigate = vi.fn()
    mockEntities['todo.stephen_s_tasks'] = entity('todo.stephen_s_tasks', '8')
    mockEntities['todo.stephen_s_due_today'] = entity('todo.stephen_s_due_today', '4')
    mockEntities['todo.stephen_s_no_due_date'] = entity('todo.stephen_s_no_due_date', '1')
    render(<DashboardViewPage activePath="chores" onNavigate={navigate} path="chores" />)

    expect(screen.getByRole('heading', { name: 'Chores' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'House Calendar' })).not.toBeInTheDocument()
  expect(screen.queryByText('No events to display')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick Links' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Groceries 2 items/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stephen's Tasks 5 active tasks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Tasks No active tasks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unassigned Tasks 17 active tasks/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Groceries 2 items/i }))
    expect(navigate).toHaveBeenCalledWith('groceries')

    expect(screen.getByRole('heading', { name: 'Past Due' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evening Tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Afternoon Tasks' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No Due Date' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/todo list$/)).toHaveLength(4)
    expect(within(screen.getByLabelText('Past Due todo list')).queryByText('Active')).not.toBeInTheDocument()
  })

  it('switches Chores user-gated todo sections for Steph and updates the Steph list', async () => {
    mockState.user = { id: '43cb71bbd1cb4860b2a7de4c829020f0', name: 'Steph' }
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const eveningList = await screen.findByLabelText('Evening Tasks todo list')
    fireEvent.click(within(eveningList).getByRole('button', { name: /Mock task one/i }))

    expect(mockCallServiceCalls).toContainEqual({
      domain: 'todo',
      service: 'update_item',
      target: 'todo.steph_s_evening_with_unassigned',
      serviceData: { item: 'todo.steph_s_evening_with_unassigned-1', status: 'completed' },
    })
  })

  it('removes completed chore rows immediately and reloads rows when Home Assistant updates the todo entity', async () => {
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [{ uid: 'past-due-1', summary: 'First live task', status: 'needs_action' }]
    const view = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')
    fireEvent.click(within(pastDueList).getByRole('button', { name: /First live task/i }))

    await waitFor(() => expect(screen.queryByLabelText('Past Due todo list')).not.toBeInTheDocument())

    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [{ uid: 'past-due-2', summary: 'Second live task', status: 'needs_action' }]
    mockEntities['todo.stephen_s_past_due_with_unassigned'].state = '2'
    view.rerender(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const reloadedPastDueList = await screen.findByLabelText('Past Due todo list')
    expect(await within(reloadedPastDueList).findByRole('button', { name: /Second live task/i })).toBeInTheDocument()
  })

  it('does not render chore sections whose loaded todo list has no visible tasks', async () => {
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = []
    mockEntities['todo.stephen_s_evening_with_unassigned'].state = '1'
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(screen.getByRole('heading', { name: 'Evening Tasks' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Evening Tasks' })).not.toBeInTheDocument())
  })

  it.each([
    ['stephs-chores', 'todo.steph_s_due_today', 'Due Today', 'Past Due'],
    ['stephens-chores', 'todo.stephen_s_due_today', 'Due Today', 'Past Due'],
    ['unassigned-chores', 'todo.unassigned_upcoming', 'Upcoming', 'Past Due'],
    ['home-improvement-chores', 'todo.home_improvement_s_upcoming', 'Upcoming', 'No Due Date'],
  ])('does not render empty sections on the %s subpage', async (path, emptyEntityId, emptyHeading, remainingHeading) => {
    mockTodoItemsByEntity[emptyEntityId] = []
    render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)

    expect(screen.getByRole('heading', { name: emptyHeading })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: emptyHeading })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: remainingHeading })).toBeInTheDocument()
  })

  it('does not render the Groceries section when the shopping list has no visible items', async () => {
    mockTodoItemsByEntity['todo.shopping_list'] = []
    mockEntities['todo.shopping_list'].state = '1'
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    expect(screen.getByRole('heading', { name: 'Grocery List' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Grocery List' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'No groceries listed' })).toBeInTheDocument()
    expect(screen.getByText('Add some groceries via the YAML app for now to see them appear here.')).toBeInTheDocument()
  })

  it('renders an empty task state when a todo page has no visible task sections', async () => {
    for (const entityId of ['todo.steph_s_past_due', 'todo.steph_s_due_today', 'todo.steph_s_upcoming', 'todo.steph_s_no_due_date']) {
      mockTodoItemsByEntity[entityId] = []
      mockEntities[entityId] = entity(entityId, '1')
    }

    render(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)

    expect(await screen.findByRole('heading', { name: 'No Tasks!' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText(/todo list$/)).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'No Tasks!' }).parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByRole('heading', { name: 'No Tasks!' }).parentElement).toHaveAttribute('data-empty-typography', 'festival')
    expect(screen.getByText('You have no tasks due- nice job!')).toBeInTheDocument()
  })

  it('renders chore due dates as explicit overdue durations instead of calendar phrases', async () => {
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [
      { uid: 'past-due-overdue', summary: 'Explicit overdue task', status: 'needs_action', due: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-hours', summary: 'Hours overdue task', status: 'needs_action', due: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-months', summary: 'Months overdue task', status: 'needs_action', due: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-future', summary: 'Future task', status: 'needs_action', due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')

    expect(within(pastDueList).getByText('5 days overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('7 hours overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('3 months overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('Due in 2 days')).toBeInTheDocument()
    expect(within(pastDueList).getByRole('button', { name: /Hours overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-hours')
    expect(within(pastDueList).getByRole('button', { name: /Explicit overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-long')
    expect(within(pastDueList).getByRole('button', { name: /Months overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-long')
    expect(within(pastDueList).queryByText(/last week|this week/i)).not.toBeInTheDocument()
  })

  it('opens the source create Donetick task modal from Chores and submits Donetick service data', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(await screen.findAllByText('Mock task one')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Create Task' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Create Donetick Task')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Task Name')).toBeRequired()
    expect(within(dialog).getByLabelText('Due Date')).toHaveAttribute('type', 'date')
    expect(within(dialog).getByLabelText('Due Time')).toHaveAttribute('type', 'time')
    expect(within(dialog).getByLabelText('Assignee')).toHaveValue('')
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('critical')
    expect(within(dialog).getByLabelText('Recurrence')).toHaveValue('no_repeat')
    expect(within(dialog).queryByRole('option', { name: /Adaptive/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Days of Week')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Task Name'), { target: { value: 'Clean the gutters' } })
    fireEvent.change(within(dialog).getByLabelText('Assignee'), { target: { value: '3' } })
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'Use the tall ladder' } })
    fireEvent.change(within(dialog).getByLabelText('Due Date'), { target: { value: '2026-06-07' } })
    fireEvent.change(within(dialog).getByLabelText('Due Time'), { target: { value: '08:30' } })
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: 'high' } })
    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'interval' } })
    expect(within(dialog).getByLabelText('Repeat Every')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Interval Unit')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Days of Week')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Repeat Every')).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(within(dialog).getByLabelText('Repeat Every'), { target: { value: '0' } })
    fireEvent.blur(within(dialog).getByLabelText('Repeat Every'))
    expect(within(dialog).getByLabelText('Repeat Every')).toHaveValue('1')
    fireEvent.change(within(dialog).getByLabelText('Repeat Every'), { target: { value: '2' } })
    fireEvent.change(within(dialog).getByLabelText('Interval Unit'), { target: { value: 'weeks' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'donetick',
        service: 'create_task_form',
        serviceData: {
          assignees: '3',
          description: 'Use the tall ladder',
          due_date: '2026-06-07T08:30:00',
          name: 'Clean the gutters',
          priority: 'high',
          recurrence: 'interval',
          recurrence_days: [],
          recurrence_interval: 2,
          recurrence_unit: 'weeks',
        },
      },
    ]))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
  })

  it('only shows recurrence days for the specific days recurrence option', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create Donetick task' }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'days_of_the_week' } })

    expect(within(dialog).getByLabelText('Days of Week')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
  })

  it('resets create task recurrence state after closing and reopening the modal', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create Donetick task' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'interval' } })

    expect(within(dialog).getByLabelText('Recurrence')).toHaveValue('interval')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task', hidden: true }))

    const reopenedDialog = await screen.findByRole('dialog')
    expect(within(reopenedDialog).getByLabelText('Recurrence')).toHaveValue('no_repeat')
    expect(within(reopenedDialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
  })

  it('shows the create task FAB on chore task pages with route-specific assignee defaults', async () => {
    const { rerender } = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(await screen.findByRole('button', { name: 'Create Donetick task' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('')

    rerender(<DashboardViewPage activePath="stephens-chores" onNavigate={() => undefined} path="stephens-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('1')

    rerender(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('2')

    rerender(<DashboardViewPage activePath="unassigned-chores" onNavigate={() => undefined} path="unassigned-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('')

    rerender(<DashboardViewPage activePath="home-improvement-chores" onNavigate={() => undefined} path="home-improvement-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Donetick task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('3')

    rerender(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)
    expect(screen.queryByRole('button', { name: 'Create Donetick task' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add grocery item' })).toBeInTheDocument()
  })

  it('opens a grocery item modal on the Groceries page and adds to the shopping list', async () => {
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add grocery item' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('heading', { name: 'Add Grocery Item' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Item')).toBeRequired()
    expect(within(dialog).queryByLabelText('Assignee')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Priority')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Recurrence')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Description')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Item'), { target: { value: 'Bananas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Item' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'todo',
        service: 'add_item',
        target: 'todo.shopping_list',
        serviceData: { item: 'Bananas' },
      },
    ]))
  })

  it('renders the thermostat route as a dedicated Ecobee port', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.queryByText(/manually reviewed/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eco Mode' })).toBeInTheDocument()
  })

  it('opens available vacuum cards as modal controls and leaves unavailable cards inert', async () => {
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    expect(screen.getByLabelText('Music Room')).not.toHaveAttribute('data-clickable')
    fireEvent.click(screen.getByRole('button', { name: /main floor docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(screen.getByText('Power Settings')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fan Balanced/i }))
    expect(within(await screen.findByRole('dialog', { name: 'Fan' })).getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Clean' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument()
  })
})
