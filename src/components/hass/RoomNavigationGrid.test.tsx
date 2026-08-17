import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AREA_ITEMS } from '../../constants/atAGlance'
import { entity, mockCallServiceCalls, mockEntities, mockState, resetMockHass } from '../../test/mocks/hakitCoreState'
import { RoomNavigationGrid } from './RoomNavigationGrid'

describe('RoomNavigationGrid', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('ranks rooms from live counters and sends one HA-owned access increment after navigation', () => {
    const originalEntities = mockState.entities
    const navigate = vi.fn()
    mockState.entities = {
      ...mockEntities,
      [AREA_ITEMS[0].accessCounterEntityId]: entity(AREA_ITEMS[0].accessCounterEntityId, '2'),
      [AREA_ITEMS[1].accessCounterEntityId]: entity(AREA_ITEMS[1].accessCounterEntityId, '7'),
      [AREA_ITEMS[2].accessCounterEntityId]: entity(AREA_ITEMS[2].accessCounterEntityId, '7'),
      [AREA_ITEMS[4].accessCounterEntityId]: entity(AREA_ITEMS[4].accessCounterEntityId, 'unavailable'),
    }

    try {
      const view = render(<RoomNavigationGrid ariaLabel="Rooms" onNavigate={navigate} />)
      const grid = screen.getByRole('region', { name: 'Rooms' })
      expect(within(grid).getAllByRole('button').slice(0, 5).map((button) => button.getAttribute('aria-label'))).toEqual([
        'Guest Room area',
        'Gym area',
        'Living Room area',
        'Master Bedroom area',
        'Office area',
      ])

      mockState.entities = {
        ...mockState.entities,
        [AREA_ITEMS[4].accessCounterEntityId]: entity(AREA_ITEMS[4].accessCounterEntityId, '8'),
      }
      view.rerender(<RoomNavigationGrid ariaLabel="Rooms" onNavigate={navigate} />)
      expect(within(grid).getAllByRole('button').slice(0, 5).map((button) => button.getAttribute('aria-label'))).toEqual([
        'Office area',
        'Guest Room area',
        'Gym area',
        'Living Room area',
        'Master Bedroom area',
      ])

      fireEvent.click(within(grid).getByRole('button', { name: 'Living Room area' }))

      expect(navigate).toHaveBeenCalledWith('living-room')
      expect(mockCallServiceCalls.filter((call) => call.domain === 'script' && call.target === 'script.increment_room_access')).toEqual([
        {
          domain: 'script',
          service: 'turn_on',
          serviceData: { variables: { room: 'living-room' } },
          target: 'script.increment_room_access',
        },
      ])
    } finally {
      mockState.entities = originalEntities
    }
  })

  it('does not delay or cancel navigation when the access increment command fails', async () => {
    const originalCallService = mockState.helpers.callService
    const commandError = new Error('Home Assistant unavailable')
    const callService = vi.fn(() => Promise.reject(commandError))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const navigate = vi.fn()
    mockState.helpers.callService = callService

    try {
      render(<RoomNavigationGrid ariaLabel="Rooms" onNavigate={navigate} />)
      fireEvent.click(screen.getByRole('button', { name: 'Living Room area' }))

      expect(navigate).toHaveBeenCalledTimes(1)
      expect(navigate).toHaveBeenCalledWith('living-room')
      expect(callService).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(consoleError).toHaveBeenCalledWith(
        'Failed to increment room access for living-room.',
        commandError,
      ))
    } finally {
      mockState.helpers.callService = originalCallService
      consoleError.mockRestore()
    }
  })
})
