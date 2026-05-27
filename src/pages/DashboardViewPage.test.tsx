import { fireEvent, render, screen, within } from '@testing-library/react'
import { materialIconPath } from '../components/core/iconPaths'
import { DashboardViewPage } from './DashboardViewPage'
import { ROOM_PAGE_CONFIGS, ROOM_PAGE_ORDER } from '../constants/roomPages'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

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
    mockEntities['input_boolean.roborock_living_room_toggle'].state = 'off'
    mockEntities['media_player.living_room_shield_2'].state = 'off'
    mockEntities['media_player.sonos'].state = 'playing'
    mockEntities['media_player.master_bedroom_apple_tv'].state = 'paused'
    mockEntities['media_player.primary_bedroom'].state = 'playing'
    mockEntities['media_player.theater_room_shield'].state = 'off'
    mockEntities['media_player.theater'].state = 'off'
    mockEntities['media_player.sony_projector'].state = 'off'
    mockEntities['cover.left_door'].state = 'closed'
    mockEntities['cover.right_door'].state = 'closed'
    mockEntities['lock.aqara_smart_lock_u400'].state = 'locked'
    mockEntities['lock.fordpass_3fmtk3su5mma09266_doorlock'].state = 'locked'
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
    expect(screen.getByRole('button', { name: 'YouTube' })).toHaveAttribute('data-background', 'white')
    fireEvent.click(screen.getByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.living_room_shield', remote_entity: 'remote.living_room_shield', app_id: 'com.plexapp.android' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    fireEvent.click(screen.getByRole('button', { name: /^Apple TV Paused$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_apple_tv', target: undefined, serviceData: { entity: 'media_player.master_bedroom_apple_tv', app_name: 'Plex', remote_entity: 'remote.master_bedroom_apple_tv' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Disney+' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield', app_id: 'com.disney.disneyplus', turn_on_projector: true } },
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

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'toggle_on_off_theater_room', target: undefined, serviceData: undefined },
      { domain: 'remote', service: 'send_command', target: 'remote.theater_shield_remote', serviceData: { command: 'DPAD_RIGHT' } },
      { domain: 'media_player', service: 'toggle', target: 'media_player.sony_projector', serviceData: undefined },
    ])
  })

  it('opens room vacuum source cards with reusable vacuum modal controls', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Robot Vacuum Docked/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Robot Vacuum Docked/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Robot Vacuum Error/i }))

    const errorMessage = await screen.findByRole('alert')
    expect(within(errorMessage).getByText('Main brush is stuck under the sofa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dock' })).toBeInTheDocument()
  })

  it('opens Theater Room vacuum with map and full Valetudo power controls', async () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Robot Vacuum Docked/i }))

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
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Entryway Contact Sensors' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Office Contact Sensors' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Office Contact Sensors' }))

    expect(await screen.findByRole('heading', { name: 'Office Contact Sensors' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to room contact sensors' })).toBeInTheDocument()
    expect(screen.getByLabelText('PC Window Closed')).toBeInTheDocument()
    expect(screen.getByLabelText('Window Closed')).toBeInTheDocument()
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
    expect(screen.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(screen.getByText('Power Settings')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fan Balanced/i }))
    expect(within(await screen.findByRole('dialog', { name: 'Fan' })).getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Clean' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument()
  })
})
