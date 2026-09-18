// @covers src/components/core/ModalTabNav.tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { HUE_SYNC_OPTIMISTIC_REVERT_MS, MEDIA_REMOTE_CONFIGS, MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_COMMAND_REVERT_MS, MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID, MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID, MUSIC_ROOM_MEDIA_ACTIONS, MUSIC_ROOM_XBOX_ACTIVE_HOLD_MS, MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID, MUSIC_ROOM_XBOX_OFF_REVERT_MS } from '../../constants/mediaRemotes'
import { mockCallServiceCalls, mockEntities, resetMockHass, setMockCallServiceOutcome } from '../../test/mocks/hakitCoreState'
import { MediaRemoteModalContent, MediaRemoteModalNav } from './MediaRemoteModalContent'

const livingRoomRemote = MEDIA_REMOTE_CONFIGS['#living-room-shield']
const musicRoomRemote = MEDIA_REMOTE_CONFIGS['#music-room-remote']
const musicRoomHueSync = musicRoomRemote.hueSync!
const theaterRemote = MEDIA_REMOTE_CONFIGS['#theater-room-shield']

beforeEach(() => {
  resetMockHass()
  mockEntities[livingRoomRemote.controlEntityId].state = 'playing'
  mockEntities[livingRoomRemote.volumeEntityId].state = 'playing'
  mockEntities[musicRoomRemote.controlEntityId].state = 'off'
  mockEntities['input_select.music_room_media_source'].state = 'Off'
  mockEntities[musicRoomRemote.volumeEntityId].state = 'playing'
  mockEntities[musicRoomRemote.volumeEntityId].attributes.volume_level = 0.3
})

describe('MediaRemoteModalNav', () => {
  it('updates the visual active tab on pointer down before content navigation settles', () => {
    const onTabChange = vi.fn()

    render(<MediaRemoteModalNav activeTab="controls" onTabChange={onTabChange} remoteTitle="Living Room" showDevices />)

    const controlsTab = screen.getByRole('tab', { name: 'Controls' })
    const devicesTab = screen.getByRole('tab', { name: 'Devices' })

    expect(controlsTab).toHaveAttribute('data-active', 'true')
    expect(controlsTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.pointerDown(devicesTab)

    expect(devicesTab).toHaveAttribute('data-active', 'true')
    expect(devicesTab).toHaveAttribute('aria-selected', 'false')
    expect(controlsTab).toHaveAttribute('aria-selected', 'true')
    expect(onTabChange).not.toHaveBeenCalled()

    fireEvent.click(devicesTab)

    expect(onTabChange).toHaveBeenCalledWith('devices')
  })

  it('only includes Apps and Devices when the remote config supplies them', () => {
    const onTabChange = vi.fn()

    render(<MediaRemoteModalNav activeTab="controls" onTabChange={onTabChange} remoteTitle="Minimal Remote" showApps={false} showDevices={false} />)

    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls'])
  })

  it('adds Hue Sync only when the remote config exposes Sync Box controls', () => {
    const onTabChange = vi.fn()

    const view = render(<MediaRemoteModalNav activeTab="controls" onTabChange={onTabChange} remoteTitle="Music Room" showApps showDevices showHueSync />)
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Apps', 'Devices', 'Hue Sync'])

    view.rerender(<MediaRemoteModalNav activeTab="controls" onTabChange={onTabChange} remoteTitle="Living Room" showApps showDevices />)
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Apps', 'Devices'])
  })
})

describe('MediaRemoteModalContent', () => {
  it('renders Theater devices in the shared content-aware DynamicGrid without calling services', () => {
    render(<MediaRemoteModalContent activeTab="devices" config={theaterRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('group', { name: 'Theater Room SHIELD remote controls' })).toBeInTheDocument()
    const projector = screen.getByRole('button', { name: /Projector Off/i })
    const grid = projector.closest('[data-dynamic-grid="true"]')
    expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(grid).toHaveAttribute('data-dynamic-grid-max-cell-width', '260')
    expect(grid).toHaveAttribute('data-dynamic-grid-max-columns', '4')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders the Music Room navigation and Beam volume controls without a keyboard prompt', () => {
    mockEntities[musicRoomRemote.controlEntityId].state = 'on'
    render(<MediaRemoteModalContent config={musicRoomRemote} />)

    expect(screen.getByRole('group', { name: 'Music Room Remote remote controls' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keyboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sonos Beam Volume' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Up' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Sonos Beam Volume volume' }), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'remote',
        service: 'send_command',
        target: 'remote.music_room_tv_android',
        serviceData: { command: 'DPAD_UP' },
      },
      {
        domain: 'media_player',
        service: 'volume_set',
        target: 'media_player.beam',
        serviceData: { volume_level: 0.42 },
      },
      {
        domain: 'script',
        service: 'toggle_sonos_mute',
        target: undefined,
        serviceData: { sonosdevice: ['media_player.beam'] },
      },
    ])
  })

  it('uses the Music Room Android TV state for the optimistic power toggle', () => {
    vi.useFakeTimers()
    const view = render(<MediaRemoteModalContent config={musicRoomRemote} />)

    try {
      const power = screen.getByRole('switch', { name: 'Power' })
      expect(power).toHaveAttribute('aria-checked', 'false')

      fireEvent.click(power)
      expect(power).toHaveAttribute('aria-checked', 'true')
      act(() => vi.advanceTimersByTime(MUSIC_ROOM_COMMAND_REVERT_MS.tv - 1))
      expect(power).toHaveAttribute('aria-checked', 'true')
      act(() => vi.advanceTimersByTime(1))
      expect(power).toHaveAttribute('aria-checked', 'false')

      mockEntities[musicRoomRemote.controlEntityId].state = 'on'
      mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'
      view.unmount()
      render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(screen.getByRole('switch', { name: 'Power' }))
      expect(screen.getByRole('switch', { name: 'Power' })).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')
      act(() => vi.advanceTimersByTime(MUSIC_ROOM_XBOX_ACTIVE_HOLD_MS))
      expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')

      expect(mockCallServiceCalls).toEqual([
        { domain: 'script', returnResponse: true, service: 'music_room_tv', target: undefined, serviceData: undefined },
        { domain: 'script', returnResponse: true, service: 'music_room_tv_off', target: undefined, serviceData: undefined },
      ])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('derives the Xbox device toggle from cloud state or an active HDMI 1 link', () => {
    vi.useFakeTimers()
    mockEntities['input_select.music_room_media_source'].state = 'Xbox'
    mockEntities[musicRoomRemote.controlEntityId].state = 'playing'
    mockEntities['media_player.xbox'].state = 'off'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'

    try {
      const view = render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

      const xboxDevice = musicRoomRemote.devices?.find((device) => device.title === 'Xbox')
      expect(xboxDevice?.activeHoldMs).toBe(MUSIC_ROOM_XBOX_ACTIVE_HOLD_MS)
      expect(xboxDevice?.activeStates).toEqual(['on'])
      expect(xboxDevice?.stateEntityIds).toEqual([
        'media_player.xbox',
        MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID,
        musicRoomRemote.controlEntityId,
        MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID,
        MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID,
      ])
      expect(screen.getByRole('switch', { name: 'TV Playing' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')

      mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'unplugged'
      view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
      act(() => vi.advanceTimersByTime(MUSIC_ROOM_XBOX_ACTIVE_HOLD_MS - 1))
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')

      mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'
      view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
      mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'HDMI 2'
      view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
      expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')

      mockEntities['media_player.xbox'].state = 'playing'
      view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
      expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('uses combined Xbox state for optimistic device toggles without forcing a newer source off', () => {
    const view = render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

    const tv = screen.getByRole('switch', { name: 'TV Off' })
    const xbox = screen.getByRole('switch', { name: 'Xbox Off' })
    const server = screen.getByRole('button', { name: 'Server Off' })
    expect(tv).toHaveAttribute('aria-checked', 'false')
    expect(xbox).toHaveAttribute('aria-checked', 'false')
    expect(server).toHaveAttribute('data-action-kind', 'selection')
    expect(server).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(tv)
    expect(screen.getByRole('switch', { name: 'TV On' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch', { name: 'TV On' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_tv', target: undefined, serviceData: undefined },
      { domain: 'script', returnResponse: true, service: 'music_room_tv_off', target: undefined, serviceData: undefined },
    ])

    mockEntities[musicRoomRemote.controlEntityId].state = 'off'
    mockEntities['input_select.music_room_media_source'].state = 'Off'
    view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Xbox Off' }))
    expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'script',
      returnResponse: true,
      service: 'music_room_xbox',
      target: undefined,
      serviceData: undefined,
    })

    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Server'
    mockEntities['input_select.music_room_media_source'].state = 'Server'
    mockEntities[musicRoomRemote.controlEntityId].state = 'on'
    mockEntities['media_player.xbox'].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'HDMI 2'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'plugged'
    view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
    expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('switch', { name: 'Xbox On' }))
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'script',
      returnResponse: true,
      service: 'music_room_xbox_off',
      target: undefined,
      serviceData: undefined,
    })
    expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')

    const xboxToggle = MUSIC_ROOM_MEDIA_ACTIONS.xboxToggle
    expect(xboxToggle.type).toBe('state')
    if (xboxToggle.type === 'state') {
      expect(xboxToggle.cases[0].action).toMatchObject({
        optimisticState: [{
          entityId: 'media_player.xbox',
          revertMs: MUSIC_ROOM_XBOX_OFF_REVERT_MS,
          value: 'off',
        }, {
          entityId: MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID,
          revertMs: MUSIC_ROOM_XBOX_OFF_REVERT_MS,
          value: 'plugged',
        }],
      })
    }

    fireEvent.click(screen.getByRole('button', { name: 'Server On' }))
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'script',
      returnResponse: true,
      service: 'music_room_tv_off',
      target: undefined,
      serviceData: undefined,
    })
    expect(screen.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows Xbox Off immediately when the modal turns off a linked Xbox route', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Xbox'
    mockEntities[musicRoomRemote.controlEntityId].state = 'on'
    mockEntities['media_player.xbox'].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'HDMI 1'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'
    render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Xbox On' }))

    expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')
    expect(mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state).toBe('linked')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_xbox_off', target: undefined, serviceData: undefined },
    ])
  })

  it('does not optimistically hide an independently active Xbox during a Server request', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Xbox'
    mockEntities['media_player.xbox'].state = 'on'
    render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Server Off' }))

    expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('switch', { name: 'Xbox On' })).toHaveAttribute('aria-checked', 'true')
  })

  it('rolls back Music Room app intent when Home Assistant never confirms it', () => {
    vi.useFakeTimers()
    try {
      render(<MediaRemoteModalContent activeTab="apps" config={musicRoomRemote} onTabChange={() => undefined} />)

      const fortnite = screen.getByRole('button', { name: 'Fortnite' })
      expect(fortnite).toHaveAttribute('data-action-kind', 'selection')
      expect(fortnite).toHaveAttribute('data-active', 'false')
      expect(fortnite).toHaveAttribute('aria-pressed', 'false')
      expect(fortnite.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fortnite.jpg'))

      fireEvent.click(fortnite)
      expect(fortnite).toHaveAttribute('data-active', 'true')
      expect(fortnite).toHaveAttribute('aria-pressed', 'true')
      expect(mockCallServiceCalls).toEqual([
        { domain: 'script', returnResponse: true, service: 'music_room_fortnite', target: undefined, serviceData: undefined },
      ])

      act(() => vi.advanceTimersByTime(MUSIC_ROOM_COMMAND_REVERT_MS.fortnite - 1))
      expect(fortnite).toHaveAttribute('data-active', 'true')
      act(() => vi.advanceTimersByTime(1))
      expect(fortnite).toHaveAttribute('data-active', 'false')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('disables unavailable Music Room commands and keeps Sonos Beam state-only', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'unavailable'
    mockEntities[musicRoomRemote.controlEntityId].state = 'unavailable'
    mockEntities['media_player.xbox'].state = 'unavailable'
    mockEntities[MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID].state = 'unavailable'
    mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'unavailable'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'unavailable'
    mockEntities[musicRoomRemote.volumeEntityId].state = 'unavailable'

    render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('switch', { name: 'TV Unavailable' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Xbox Unavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Server Unavailable' })).toBeDisabled()
    const sonos = screen.getByLabelText('Sonos Beam Unavailable')
    expect(sonos).toHaveAttribute('data-action-kind', 'state')
    expect(screen.queryByRole('button', { name: 'Sonos Beam Unavailable' })).not.toBeInTheDocument()
    fireEvent.click(sonos)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders the Hue Sync tab from live entities without issuing commands', () => {
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('switch', { name: 'Sync Box Power On' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Light Sync Off' })).toHaveAttribute('aria-checked', 'false')
    const modeGroup = screen.getByRole('group', { name: 'Sync Mode' })
    expect(within(modeGroup).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Music', 'Video', 'Game'])
    expect(within(modeGroup).getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(modeGroup).getByRole('button', { name: 'Music' })).toHaveAttribute('data-size', 'round')
    const intensityGroup = screen.getByRole('group', { name: 'Intensity' })
    expect(within(intensityGroup).getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(intensityGroup).getByRole('button', { name: 'High' })).toHaveAttribute('data-tone', 'light')
    expect(within(intensityGroup).getByRole('button', { name: 'High' }).className).not.toMatch(/compact/)
    expect(intensityGroup).toHaveAttribute('data-dynamic-grid', 'true')
    expect(screen.getByRole('slider', { name: 'Brightness' })).toHaveValue('100')
    const inputGroup = screen.getByRole('group', { name: 'HDMI Input' })
    const unpluggedInput = within(inputGroup).getByRole('button', { name: 'HDMI 1 Selected • Unplugged' })
    expect(unpluggedInput).toHaveAttribute('aria-pressed', 'true')
    expect(unpluggedInput).toHaveAttribute('data-action-kind', 'selection')
    expect(unpluggedInput).toHaveAttribute('data-icon', 'mdi:television-off')
    expect(unpluggedInput).toHaveAttribute('data-tone', 'switch')
    expect(unpluggedInput).toBeDisabled()
    expect(unpluggedInput.parentElement).toHaveAttribute('data-disabled', 'true')
    expect(unpluggedInput.className).not.toMatch(/compact/)
    const pluggedInput = within(inputGroup).getByRole('button', { name: 'HDMI 2 Plugged' })
    expect(pluggedInput).toHaveAttribute('aria-pressed', 'false')
    expect(pluggedInput).toHaveAttribute('data-icon', 'mdi:television')
    expect(pluggedInput).toBeEnabled()
    expect(pluggedInput.parentElement).toHaveAttribute('data-disabled', 'false')
    expect(inputGroup).toHaveAttribute('data-dynamic-grid', 'true')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Entertainment Area')).not.toBeInTheDocument()
    expect(screen.queryByText('LED Indicator')).not.toBeInTheDocument()
    expect(screen.queryByText('Entertainment Stream')).not.toBeInTheDocument()
    expect(document.querySelector('[data-surface-accessory="selection"]')).not.toBeInTheDocument()
    fireEvent.click(unpluggedInput)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('sends one entity service per Hue Sync control and commits brightness once', () => {
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Light Sync Off' }))
    expect(screen.getByRole('switch', { name: 'Light Sync On' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Sync Box Power On' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Game' }))
    fireEvent.click(screen.getByRole('button', { name: 'Intense' }))
    fireEvent.click(screen.getByRole('button', { name: 'HDMI 2 Plugged' }))

    const brightness = screen.getByRole('slider', { name: 'Brightness' })
    fireEvent.change(brightness, { target: { value: '70' } })
    fireEvent.change(brightness, { target: { value: '80' } })
    expect(mockCallServiceCalls).toHaveLength(4)
    fireEvent.pointerUp(brightness)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: musicRoomHueSync.lightSyncEntityId },
      { domain: 'select', service: 'select_option', target: musicRoomHueSync.syncModeEntityId, serviceData: { option: 'game' } },
      { domain: 'select', service: 'select_option', target: musicRoomHueSync.intensityEntityId, serviceData: { option: 'intense' } },
      { domain: 'select', service: 'select_option', target: musicRoomHueSync.hdmiInputEntityId, serviceData: { option: 'HDMI 2' } },
      { domain: 'number', service: 'set_value', target: musicRoomHueSync.brightnessEntityId, serviceData: { value: 80 } },
    ])
  })

  it('keeps power and light-sync projections coherent while sending one switch command', () => {
    mockEntities[musicRoomHueSync.lightSyncEntityId].state = 'on'
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Sync Box Power On' }))

    expect(screen.getByRole('switch', { name: 'Sync Box Power Off' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Light Sync Off' })).toHaveAttribute('aria-checked', 'false')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_off', target: musicRoomHueSync.powerEntityId },
    ])
  })

  it('keeps a resolved Hue Sync command after its optimistic window expires', () => {
    vi.useFakeTimers()
    try {
      render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)
      fireEvent.click(screen.getByRole('switch', { name: 'Light Sync Off' }))

      expect(mockEntities[musicRoomHueSync.lightSyncEntityId].state).toBe('on')
      act(() => vi.advanceTimersByTime(HUE_SYNC_OPTIMISTIC_REVERT_MS))
      expect(screen.getByRole('switch', { name: 'Light Sync On' })).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('resets stale intensity optimism when the sync mode changes', () => {
    setMockCallServiceOutcome('select', 'select_option', 'pending')
    mockEntities[musicRoomHueSync.powerEntityId].state = 'off'
    mockEntities[musicRoomHueSync.lightSyncEntityId].state = 'off'
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Intense' }))
    expect(screen.getByRole('button', { name: 'Intense' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Game' }))
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('switch', { name: 'Sync Box Power On' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Light Sync On' })).toHaveAttribute('aria-checked', 'true')
  })

  it('restarts syncing when the already-selected mode is pressed while sync is off', () => {
    mockEntities[musicRoomHueSync.powerEntityId].state = 'off'
    mockEntities[musicRoomHueSync.lightSyncEntityId].state = 'off'
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Music' }))

    expect(screen.getByRole('switch', { name: 'Sync Box Power On' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Light Sync On' })).toHaveAttribute('aria-checked', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: musicRoomHueSync.syncModeEntityId, serviceData: { option: 'music' } },
    ])
  })

  it('does not resend the selected mode while syncing is already active', () => {
    mockEntities[musicRoomHueSync.powerEntityId].state = 'on'
    mockEntities[musicRoomHueSync.lightSyncEntityId].state = 'on'
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Music' }))

    expect(mockCallServiceCalls).toEqual([])
  })

  it('uses live HDMI option names for the fixed status slots', () => {
    mockEntities[musicRoomHueSync.hdmiInputEntityId].state = 'Console'
    mockEntities[musicRoomHueSync.hdmiInputEntityId].attributes.options = ['Console', 'Server', 'Spare', 'Guest']

    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Console Selected • Unplugged' })).toHaveAttribute('data-tone', 'switch')
    expect(screen.getByRole('button', { name: 'Console Selected • Unplugged' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Console Selected • Unplugged' })).toHaveAttribute('data-icon', 'mdi:television-off')
    expect(screen.getByRole('button', { name: 'Console Selected • Unplugged' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Console Selected • Unplugged' }).parentElement).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Server Plugged' })).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByRole('button', { name: 'Server Plugged' })).toHaveAttribute('data-icon', 'mdi:television')
    expect(screen.getByRole('button', { name: 'Server Plugged' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Server Plugged' }).parentElement).toHaveAttribute('data-disabled', 'false')
  })

  it('rolls Hue Sync optimism back on rejection and timeout', async () => {
    vi.useFakeTimers()
    try {
      setMockCallServiceOutcome('switch', 'turn_on', 'reject')
      const view = render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

      fireEvent.click(screen.getByRole('switch', { name: 'Light Sync Off' }))
      expect(screen.getByRole('switch', { name: 'Light Sync On' })).toBeInTheDocument()
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(screen.getByRole('switch', { name: 'Light Sync Off' })).toBeInTheDocument()

      view.unmount()
      setMockCallServiceOutcome('switch', 'turn_on', 'pending')
      render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)
      fireEvent.click(screen.getByRole('switch', { name: 'Light Sync Off' }))
      act(() => vi.advanceTimersByTime(HUE_SYNC_OPTIMISTIC_REVERT_MS - 1))
      expect(screen.getByRole('switch', { name: 'Light Sync On' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole('switch', { name: 'Light Sync Off' })).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('can return brightness to the live value during a pending optimistic change', () => {
    setMockCallServiceOutcome('number', 'set_value', 'pending')
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)
    const brightness = screen.getByRole('slider', { name: 'Brightness' })

    fireEvent.change(brightness, { target: { value: '70' } })
    fireEvent.pointerUp(brightness)
    expect(brightness).toHaveValue('70')

    fireEvent.change(brightness, { target: { value: '100' } })
    fireEvent.pointerUp(brightness)

    expect(brightness).toHaveValue('100')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'number', service: 'set_value', target: musicRoomHueSync.brightnessEntityId, serviceData: { value: 70 } },
      { domain: 'number', service: 'set_value', target: musicRoomHueSync.brightnessEntityId, serviceData: { value: 100 } },
    ])
  })

  it('keeps HDMI status live-only while remote Power Off is optimistic', () => {
    mockEntities[musicRoomRemote.controlEntityId].state = 'on'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'
    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('button', { name: 'HDMI 1 Selected • Linked' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Power' }))

    expect(screen.getByRole('button', { name: 'HDMI 1 Selected • Linked' })).toBeInTheDocument()
    expect(mockCallServiceCalls.at(-1)).toEqual({ domain: 'script', returnResponse: true, service: 'music_room_tv_off', target: undefined, serviceData: undefined })
  })

  it('disables unavailable Hue Sync controls while preserving status geometry', () => {
    for (const entityId of [
      musicRoomHueSync.powerEntityId,
      musicRoomHueSync.lightSyncEntityId,
      musicRoomHueSync.brightnessEntityId,
      musicRoomHueSync.syncModeEntityId,
      musicRoomHueSync.intensityEntityId,
      musicRoomHueSync.hdmiInputEntityId,
      ...musicRoomHueSync.hdmiStatusEntityIds,
    ]) {
      mockEntities[entityId].state = 'unavailable'
    }

    render(<MediaRemoteModalContent activeTab="hueSync" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('switch', { name: 'Sync Box Power Unavailable' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Light Sync Unavailable' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Brightness' })).toBeDisabled()
    expect(within(screen.getByRole('group', { name: 'Sync Mode' })).getAllByRole('button')).toHaveLength(3)
    expect(within(screen.getByRole('group', { name: 'Sync Mode' })).getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(within(screen.getByRole('group', { name: 'Intensity' })).getAllByRole('button')).toHaveLength(4)
    expect(within(screen.getByRole('group', { name: 'Intensity' })).getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(within(screen.getByRole('group', { name: 'HDMI Input' })).getAllByRole('button')).toHaveLength(4)
    expect(within(screen.getByRole('group', { name: 'HDMI Input' })).getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /HDMI [1-4].*Unavailable/ })).toHaveLength(4)
    expect(screen.getByRole('slider', { name: 'Brightness' })).toHaveAttribute('aria-valuetext', 'Unavailable')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders an inert Music Room preload without commands, images, listeners, or timers', () => {
    vi.useFakeTimers()
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame')
    const setTimeout = vi.spyOn(window, 'setTimeout')
    try {
      const { container } = render(<MediaRemoteModalContent config={musicRoomRemote} preload />)

      expect(container.querySelector('[data-media-remote-preload="#music-room-remote"]')).toBeInTheDocument()
      expect(container.querySelectorAll('button, img, video, canvas')).toHaveLength(0)
      expect(mockCallServiceCalls).toEqual([])
      expect(addEventListener).not.toHaveBeenCalled()
      expect(requestAnimationFrame).not.toHaveBeenCalled()
      expect(setTimeout).not.toHaveBeenCalled()
    } finally {
      addEventListener.mockRestore()
      requestAnimationFrame.mockRestore()
      setTimeout.mockRestore()
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('keeps the text prompt mounted through its close transition and restores input focus on open', async () => {
    render(<MediaRemoteModalContent config={livingRoomRemote} />)

    fireEvent.click(screen.getByRole('button', { name: 'Keyboard' }))

    const input = screen.getByLabelText('Text to send')
    const accordion = input.closest<HTMLElement>('[data-state]')
    expect(accordion).toHaveAttribute('data-state', 'closed')
    expect(accordion).toHaveAttribute('aria-hidden', 'false')

    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    })

    expect(accordion).toHaveAttribute('data-state', 'opening')
    fireEvent.transitionEnd(accordion!, { propertyName: 'height' })
    expect(accordion).toHaveAttribute('data-state', 'open')
    expect(input).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(accordion).toHaveAttribute('data-state', 'closing')
    expect(screen.getByLabelText('Text to send')).toBeInTheDocument()

    fireEvent.transitionEnd(accordion!, { propertyName: 'height' })
    expect(screen.queryByLabelText('Text to send')).not.toBeInTheDocument()
  })

  it('shows an optimistic volume until Home Assistant confirms it, then follows live changes', () => {
    mockEntities[livingRoomRemote.volumeEntityId].attributes.volume_level = 0.25
    const view = render(<MediaRemoteModalContent config={livingRoomRemote} />)
    const slider = screen.getByRole('slider', { name: 'Sonos Volume volume' })

    fireEvent.change(slider, { target: { value: '37' } })

    expect(slider).toHaveValue('37')
    expect(mockCallServiceCalls).toEqual([{
      domain: 'media_player',
      service: 'volume_set',
      target: livingRoomRemote.volumeEntityId,
      serviceData: { volume_level: 0.37 },
    }])

    mockEntities[livingRoomRemote.volumeEntityId].attributes.volume_level = 0.37
    view.rerender(<MediaRemoteModalContent config={livingRoomRemote} />)
    expect(slider).toHaveValue('37')

    mockEntities[livingRoomRemote.volumeEntityId].attributes.volume_level = 0.42
    view.rerender(<MediaRemoteModalContent config={livingRoomRemote} />)
    expect(slider).toHaveValue('42')
  })

  it('cancels delayed text-prompt visibility work when unmounted', () => {
    vi.useFakeTimers()
    try {
      const view = render(<MediaRemoteModalContent config={livingRoomRemote} />)
      act(() => {
        vi.advanceTimersByTime(20)
      })
      const baselineTimerCount = vi.getTimerCount()

      fireEvent.click(screen.getByRole('button', { name: 'Keyboard' }))
      const openTimerCount = vi.getTimerCount()
      expect(openTimerCount).toBeGreaterThan(baselineTimerCount)

      view.unmount()
      expect(vi.getTimerCount()).toBeLessThan(openTimerCount)
      expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimerCount + 1)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})
