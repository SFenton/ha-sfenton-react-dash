import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { MEDIA_REMOTE_CONFIGS } from '../../constants/mediaRemotes'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { MediaRemoteModalContent, MediaRemoteModalNav } from './MediaRemoteModalContent'

const livingRoomRemote = MEDIA_REMOTE_CONFIGS['#living-room-shield']
const theaterRemote = MEDIA_REMOTE_CONFIGS['#theater-room-shield']

beforeEach(() => {
  resetMockHass()
  mockEntities[livingRoomRemote.controlEntityId].state = 'playing'
  mockEntities[livingRoomRemote.volumeEntityId].state = 'playing'
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
