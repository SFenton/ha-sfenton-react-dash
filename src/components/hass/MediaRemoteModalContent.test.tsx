import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { MEDIA_REMOTE_CONFIGS, MUSIC_ROOM_COMMAND_REVERT_MS, MUSIC_ROOM_MEDIA_ACTIONS } from '../../constants/mediaRemotes'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { MediaRemoteModalContent, MediaRemoteModalNav } from './MediaRemoteModalContent'

const livingRoomRemote = MEDIA_REMOTE_CONFIGS['#living-room-shield']
const musicRoomRemote = MEDIA_REMOTE_CONFIGS['#music-room-remote']
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
})

describe('MediaRemoteModalContent', () => {
  it('renders Theater devices in the shared uniform DynamicGrid without calling services', () => {
    render(<MediaRemoteModalContent activeTab="devices" config={theaterRemote} onTabChange={() => undefined} />)

    expect(screen.getByRole('group', { name: 'Theater Room SHIELD remote controls' })).toBeInTheDocument()
    const projector = screen.getByRole('button', { name: /Projector Off/i })
    const grid = projector.closest('[data-dynamic-grid="true"]')
    expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'uniform')
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
      view.rerender(<MediaRemoteModalContent config={musicRoomRemote} />)
      fireEvent.click(screen.getByRole('switch', { name: 'Power' }))
      expect(screen.getByRole('switch', { name: 'Power' })).toHaveAttribute('aria-checked', 'false')

      expect(mockCallServiceCalls).toEqual([
        { domain: 'script', returnResponse: true, service: 'music_room_tv', target: undefined, serviceData: undefined },
        { domain: 'script', returnResponse: true, service: 'music_room_tv_off', target: undefined, serviceData: undefined },
      ])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('derives TV and Xbox device toggles from their own media-player entities', () => {
    mockEntities['input_select.music_room_media_source'].state = 'Xbox'
    mockEntities[musicRoomRemote.controlEntityId].state = 'playing'
    mockEntities['media_player.xbox'].state = 'off'

    render(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)

    expect(musicRoomRemote.devices?.find((device) => device.title === 'Xbox')?.activeStates).toEqual(['on', 'playing', 'paused'])
    expect(screen.getByRole('switch', { name: 'TV Playing' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')
  })

  it('uses actual TV and Xbox states for device toggles without forcing the source off', () => {
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

    mockEntities['input_select.music_room_media_source'].state = 'Xbox'
    mockEntities['media_player.xbox'].state = 'on'
    view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
    mockEntities['media_player.xbox'].state = 'playing'
    view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
    expect(screen.getByRole('switch', { name: 'Xbox Playing' })).toHaveAttribute('aria-checked', 'true')

    mockEntities['input_select.music_room_media_source'].state = 'Server'
    view.rerender(<MediaRemoteModalContent activeTab="devices" config={musicRoomRemote} onTabChange={() => undefined} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Xbox Playing' }))
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
        optimisticResetState: [{
          entityId: 'input_select.music_room_media_source',
          values: ['Xbox', 'Fortnite'],
        }],
        optimisticState: [{
          entityId: 'media_player.xbox',
          revertMs: MUSIC_ROOM_COMMAND_REVERT_MS.xbox,
          value: 'off',
        }],
      })
    }
  })

  it('rolls back Music Room app intent when Home Assistant never confirms it', () => {
    vi.useFakeTimers()
    try {
      render(<MediaRemoteModalContent activeTab="apps" config={musicRoomRemote} onTabChange={() => undefined} />)

      const fortnite = screen.getByRole('button', { name: 'Fortnite' })
      expect(fortnite).toHaveAttribute('data-action-kind', 'selection')
      expect(fortnite).toHaveAttribute('data-active', 'false')
      expect(fortnite).toHaveAttribute('aria-pressed', 'false')
      expect(fortnite.querySelector('img')).not.toBeInTheDocument()

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
    mockEntities['input_select.music_room_media_source'].state = 'unavailable'
    mockEntities[musicRoomRemote.controlEntityId].state = 'unavailable'
    mockEntities['media_player.xbox'].state = 'unavailable'
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
