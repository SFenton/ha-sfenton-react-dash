import { act } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATHROOM_FANS } from '../../constants/bathroomFans'
import { mockCallServiceCalls, mockEntities, resetMockHass, setMockEntityState } from '../../test/mocks/hakitCoreState'
import { BathroomFanModalContent } from './BathroomFanModalContent'

const config = BATHROOM_FANS.guest

describe('BathroomFanModalContent', () => {
  beforeEach(() => {
    resetMockHass()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps timer setup visible but disables starting it until power is on', () => {
    render(<BathroomFanModalContent config={config} />)

    expect(screen.queryByText('Room occupancy')).not.toBeInTheDocument()
    expect(screen.queryByText('Room temperature range')).not.toBeInTheDocument()
    expect(screen.queryByText('Humidity')).not.toBeInTheDocument()
    expect(document.querySelector('[data-dynamic-grid="true"]')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Power Off' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Lock Unlocked' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('note', { name: 'Hint' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    const duration = screen.getByRole('combobox', { name: 'Timer' })
    const set = screen.getByRole('button', { name: 'Set' })
    expect(duration).toHaveValue('30')
    expect(set).toBeDisabled()
    fireEvent.change(duration, { target: { value: '15' } })
    fireEvent.click(set)
    expect(mockCallServiceCalls).toEqual([])

    act(() => setMockEntityState(config.powerEntityId, 'on'))
    expect(duration).toHaveValue('15')
    expect(set).toBeEnabled()
    fireEvent.click(set)
    expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { auto_unlock: false, command: 'timer_start', minutes: 15 },
    }])
  })

  it('does not enable timer setup when power or timer state is unavailable', () => {
    mockEntities[config.powerEntityId].state = 'unavailable'
    render(<BathroomFanModalContent config={config} />)

    expect(screen.getByRole('switch', { name: 'Power Unavailable' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Timer' })).toBeVisible()
    const set = screen.getByRole('button', { name: 'Set' })
    expect(set).toBeDisabled()

    act(() => {
      setMockEntityState(config.powerEntityId, 'on')
      setMockEntityState(config.pendingEntityId, 'unavailable')
    })
    expect(set).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps an active timer cancellable if live fan power drops unexpectedly', () => {
    mockEntities[config.pendingEntityId].state = 'on'
    render(<BathroomFanModalContent config={config} />)

    expect(screen.getByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Timer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('heading', { name: 'Timer' }).closest('section')?.children).toHaveLength(2)
  })

  it('starts a timer from the fixed duration dropdown with an auto-checked lock choice', () => {
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.lockEntityId].state = 'on'
    render(<BathroomFanModalContent config={config} />)

    const duration = screen.getByRole('combobox', { name: 'Timer' })
    expect(duration).toHaveValue('30')
    expect(Array.from((duration as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      '5 minutes',
      '10 minutes',
      '15 minutes',
      '20 minutes',
      '30 minutes',
      '1 hour',
    ])
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()

    const autoUnlock = screen.getByRole('checkbox', { name: 'Auto-disable lock' })
    expect(autoUnlock).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(autoUnlock)
    expect(autoUnlock).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(autoUnlock)
    expect(autoUnlock).toHaveAttribute('aria-checked', 'true')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.change(duration, { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set' }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { auto_unlock: true, command: 'timer_start', minutes: 60 },
      },
    ])
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Timer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set' })).not.toBeInTheDocument()
  })

  it('defaults auto-disable on when lock becomes enabled during an active timer', async () => {
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.pendingEntityId].state = 'on'
    render(<BathroomFanModalContent config={config} />)

    expect(screen.queryByRole('checkbox', { name: 'Auto-disable lock' })).not.toBeInTheDocument()

    act(() => {
      setMockEntityState(config.lockEntityId, 'on')
      setMockEntityState(config.autoUnlockEntityId, 'on')
    })
    const autoUnlock = await screen.findByRole('checkbox', { name: 'Auto-disable lock' })
    await waitFor(() => expect(autoUnlock).toHaveAttribute('aria-checked', 'true'))

    act(() => {
      setMockEntityState(config.lockEntityId, 'off')
      setMockEntityState(config.autoUnlockEntityId, 'off')
    })
    expect(screen.queryByRole('checkbox', { name: 'Auto-disable lock' })).not.toBeInTheDocument()

    act(() => {
      setMockEntityState(config.lockEntityId, 'on')
      setMockEntityState(config.autoUnlockEntityId, 'on')
    })
    const relockedAutoUnlock = await screen.findByRole('checkbox', { name: 'Auto-disable lock' })
    await waitFor(() => expect(relockedAutoUnlock).toHaveAttribute('aria-checked', 'true'))

    fireEvent.click(relockedAutoUnlock)
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'timer_auto_unlock', enabled: false },
    })
  })

  it('cancels an active timer and uses one power command for the locked timer state', () => {
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.lockEntityId].state = 'on'
    mockEntities[config.pendingEntityId].state = 'on'
    mockEntities[config.autoUnlockEntityId].state = 'on'
    const view = render(<BathroomFanModalContent config={config} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'timer_cancel' },
      },
    ])
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()

    view.unmount()
    resetMockHass()
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.lockEntityId].state = 'on'
    mockEntities[config.pendingEntityId].state = 'on'
    mockEntities[config.autoUnlockEntityId].state = 'on'
    render(<BathroomFanModalContent config={config} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Power On' }))
    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'power', target_power: 'off' },
      },
    ])
    expect(screen.getByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Lock Unlocked' })).toHaveAttribute('aria-checked', 'false')
  })

  it('renders inert preload content without scheduling a countdown interval', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    render(<BathroomFanModalContent config={config} preload />)

    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set' })).toBeDisabled()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })

  it('counts down from the Home Assistant deadline while the modal is active', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'))
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.pendingEntityId].state = 'on'
    mockEntities[config.deadlineEntityId].state = '2026-08-17T12:01:05Z'
    mockEntities[config.deadlineEntityId].attributes.timestamp = Date.parse('2026-08-17T12:01:05Z') / 1000
    render(<BathroomFanModalContent config={config} />)

    expect(screen.getByRole('group', { name: 'Timer 01:05' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByRole('group', { name: 'Timer 01:04' })).toBeInTheDocument()
  })

  it('does not run the countdown interval while a retained modal is closed', () => {
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.pendingEntityId].state = 'on'
    mockEntities[config.deadlineEntityId].state = '2026-08-17T12:01:05Z'
    mockEntities[config.deadlineEntityId].attributes.timestamp = Date.parse('2026-08-17T12:01:05Z') / 1000
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    render(<BathroomFanModalContent config={config} runtimeActive={false} />)

    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })
})
