import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BATHROOM_FANS } from '../../constants/bathroomFans'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { BathroomFanTile } from './BathroomFanTile'

const config = BATHROOM_FANS.guest

describe('BathroomFanTile', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('keeps modal, lock, and power actions as separate sibling buttons', () => {
    const onOpen = vi.fn()
    render(<BathroomFanTile config={config} onOpen={onOpen} />)

    const main = screen.getByRole('button', { name: 'Fan Off' })
    const lock = screen.getByRole('switch', { name: 'Lock' })
    const power = screen.getByRole('switch', { name: 'Power' })

    expect(main).toHaveAttribute('data-modal-opener', 'true')
    expect(main.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(lock).toHaveAttribute('aria-checked', 'false')
    expect(power).toHaveAttribute('aria-checked', 'false')
    expect(main).not.toContainElement(lock)
    expect(main).not.toContainElement(power)

    fireEvent.click(lock)
    fireEvent.click(power)

    expect(onOpen).not.toHaveBeenCalled()
    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'lock', locked: true },
      },
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'power', target_power: 'on' },
      },
    ])

    fireEvent.click(main)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('maps displayed on and locked states to the opposite explicit commands', () => {
    mockEntities[config.powerEntityId].state = 'on'
    mockEntities[config.lockEntityId].state = 'on'
    render(<BathroomFanTile config={config} onOpen={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Fan On' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Lock' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Power' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch', { name: 'Power' }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'power', target_power: 'off' },
      },
    ])
    expect(screen.getByRole('switch', { name: 'Lock' })).toHaveAttribute('aria-checked', 'false')
  })

  it('disables unavailable entity controls without blocking modal status access', () => {
    mockEntities[config.powerEntityId].state = 'unavailable'
    mockEntities[config.lockEntityId].state = 'unavailable'
    const onOpen = vi.fn()
    render(<BathroomFanTile config={config} onOpen={onOpen} />)

    expect(screen.getByRole('switch', { name: 'Power' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Lock' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Fan Unavailable' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders inert preload geometry without Home Assistant commands', () => {
    render(<BathroomFanTile config={config} onOpen={vi.fn()} preload />)

    expect(screen.getByRole('button', { name: 'Fan Unavailable' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('switch', { name: 'Power' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Lock' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })
})
