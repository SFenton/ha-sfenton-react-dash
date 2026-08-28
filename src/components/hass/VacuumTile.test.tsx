import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import { entity, getMockHassListenerCount, mockCallServiceCalls, mockEntities, resetMockHass, setMockEntityState } from '../../test/mocks/hakitCoreState'
import { VacuumTile } from './VacuumTile'

const vacuum = VACUUMS.find((candidate) => candidate.title === 'Music Room')!

describe('VacuumTile', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('keeps unavailable status access actionable without claiming commands are enabled', () => {
    mockEntities[vacuum.entityId].state = 'unavailable'
    mockEntities[vacuum.batteryEntityId].state = '87'
    const onOpen = vi.fn()

    render(<VacuumTile interaction={{ kind: 'modal', onOpen }} vacuum={vacuum} />)

    const tile = screen.getByRole('button', { name: 'Music Room Unavailable' })
    expect(tile).toHaveAttribute('data-action-kind', 'modal')
    expect(tile).toHaveAttribute('data-modal-opener', 'true')
    expect(tile).toHaveAttribute('data-icon', 'mdi:robot-vacuum-off')
    expect(tile).toHaveAttribute('data-muted', 'true')
    expect(tile).not.toHaveAttribute('aria-disabled')

    fireEvent.click(tile)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('retains the same focused button while availability changes', () => {
    mockEntities[vacuum.entityId].state = 'docked'
    mockEntities[vacuum.batteryEntityId].state = '0'
    render(<VacuumTile interaction={{ kind: 'modal', onOpen: () => undefined }} vacuum={vacuum} />)

    const tile = screen.getByRole('button', { name: 'Music Room Docked • 0%' })
    tile.focus()
    expect(tile).toHaveFocus()

    act(() => {
      setMockEntityState(vacuum.entityId, 'unavailable')
      setMockEntityState(vacuum.batteryEntityId, 'unavailable')
    })

    expect(screen.getByRole('button', { name: 'Music Room Unavailable' })).toBe(tile)
    expect(tile).toHaveFocus()
  })

  it('uses the primary vacuum state instead of a stale status observer', () => {
    mockEntities[vacuum.entityId].state = 'cleaning'
    mockEntities[vacuum.batteryEntityId].state = '64'
    mockEntities[vacuum.statusEntityId] = entity(vacuum.statusEntityId, 'unavailable')

    render(<VacuumTile interaction={{ kind: 'modal', onOpen: () => undefined }} vacuum={vacuum} />)

    expect(screen.getByRole('button', { name: 'Music Room Cleaning • 64%' })).toHaveAttribute('data-icon', 'mdi:broom')
  })

  it('renders preload as static geometry without a chevron, tab stop, or Home Assistant command', () => {
    const listenerCount = getMockHassListenerCount()
    render(<VacuumTile interaction={{ kind: 'preload' }} vacuum={vacuum} />)

    const tile = screen.getByLabelText('Music Room Unavailable')
    expect(tile.tagName).toBe('DIV')
    expect(tile).not.toHaveAttribute('data-modal-opener')
    expect(tile.querySelector('[data-modal-disclosure="right-chevron"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Music Room/ })).not.toBeInTheDocument()
    expect(getMockHassListenerCount()).toBe(listenerCount)
    expect(mockCallServiceCalls).toEqual([])
  })
})
