import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BACKYARD_SPRINKLER, FRONT_YARD_SPRINKLER } from '../constants/sprinklers'
import { mockCallServiceCalls, mockEntities, mockState, resetMockHass } from '../test/mocks/hakitCoreState'
import { SprinklersPage } from './SprinklersPage'

function setFrontYardAvailable() {
  const zone = FRONT_YARD_SPRINKLER.zones[0]
  mockEntities[FRONT_YARD_SPRINKLER.stateEntityId].state = 'auto'
  mockEntities[FRONT_YARD_SPRINKLER.modeEntityId].state = 'auto'
  mockEntities[zone.valveEntityId].state = 'closed'
  mockEntities[FRONT_YARD_SPRINKLER.faultEntityId].state = 'off'
  mockEntities[FRONT_YARD_SPRINKLER.rainDelayEntityId].state = 'off'
  mockEntities[FRONT_YARD_SPRINKLER.smartWateringEntityId].state = 'on'
  mockEntities[zone.programEntityId].state = 'on'
}

describe('SprinklersPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/at-a-glance/sprinklers')
    resetMockHass()
    setFrontYardAvailable()
  })

  it('shows the Front Yard controller and opens its modal', async () => {
    render(<SprinklersPage />)

    expect(screen.getByText('Battery 12%')).toBeInTheDocument()
    const controller = screen.getByRole('button', { name: /Front Yard Auto · Next/i })
    expect(controller).toHaveAttribute('data-modal-opener', 'true')
    fireEvent.click(controller)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Front Yard' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Water now · Front Yard' })).toHaveAttribute('data-action-kind', 'modal')
    expect(within(dialog).getByRole('button', { name: 'Stop watering' })).toBeDisabled()
  })

  it('starts and stops watering through explicit B-hyve services', async () => {
    const closedView = render(<SprinklersPage />)
    fireEvent.click(screen.getByRole('button', { name: /Front Yard Auto · Next/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Water now · Front Yard' }))
    expect(within(dialog).getByRole('spinbutton', { name: 'Run time' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start watering' }))

    expect(mockCallServiceCalls).toEqual([{
      domain: 'bhyve',
      service: 'start_watering',
      serviceData: { entity_id: FRONT_YARD_SPRINKLER.zones[0].valveEntityId, minutes: 15 },
    }])
    closedView.unmount()

    mockCallServiceCalls.length = 0
    mockEntities[FRONT_YARD_SPRINKLER.zones[0].valveEntityId].state = 'open'
    window.history.replaceState(null, '', '/at-a-glance/sprinklers')
    const view = render(<SprinklersPage />)
    fireEvent.click(screen.getByRole('button', { name: /Front Yard Watering · Next/i }))
    const openDialog = await screen.findByRole('dialog')
    fireEvent.click(within(openDialog).getByRole('button', { name: 'Stop watering' }))

    expect(mockCallServiceCalls).toEqual([{
      domain: 'bhyve',
      service: 'stop_watering',
      serviceData: { entity_id: FRONT_YARD_SPRINKLER.zones[0].valveEntityId },
    }])
    view.unmount()
  })

  it('toggles rain delay, Smart Watering, and program enablement', async () => {
    render(<SprinklersPage />)
    fireEvent.click(screen.getByRole('button', { name: /Front Yard Auto · Next/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn on Rain delay · 24 hours' }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Smart watering' }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Front Yard schedule' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: FRONT_YARD_SPRINKLER.rainDelayEntityId },
      { domain: 'switch', service: 'turn_off', target: FRONT_YARD_SPRINKLER.smartWateringEntityId },
      { domain: 'switch', service: 'turn_off', target: FRONT_YARD_SPRINKLER.zones[0].programEntityId },
    ])
  })

  it('edits start times, days, and budget without exposing create or delete', async () => {
    render(<SprinklersPage />)
    fireEvent.click(screen.getByRole('button', { name: /Front Yard Auto · Next/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Front Yard schedule .* Every day/i }))

    fireEvent.change(within(dialog).getByLabelText('Start 1'), { target: { value: '06:30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sunday' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Increase watering budget' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(mockCallServiceCalls.at(-1)).toEqual({
        domain: 'bhyve',
        service: 'update_program',
        serviceData: {
          budget: 105,
          entity_id: FRONT_YARD_SPRINKLER.zones[0].programEntityId,
          frequency: { days: [1, 2, 3, 4, 5, 6], type: 'days' },
          start_times: ['06:30', '19:00'],
        },
      })
    })
    expect(within(dialog).queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
  })

  it('keeps the modal inspectable but disables commands when the controller is unavailable', async () => {
    mockEntities[FRONT_YARD_SPRINKLER.stateEntityId].state = 'unavailable'
    mockEntities[FRONT_YARD_SPRINKLER.zones[0].valveEntityId].state = 'unavailable'
    render(<SprinklersPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Front Yard Unavailable' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('button', { name: 'Water now · Front Yard' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Stop watering' })).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Turn on Rain delay · 24 hours' })).toHaveAttribute('aria-disabled', 'true')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('shows the revived Backyard controller with live station names and four programs', async () => {
    render(<SprinklersPage />)

    const controller = screen.getByRole('button', { name: 'Backyard Faucet Auto · Next Unknown' })
    fireEvent.click(controller)
    const dialog = await screen.findByRole('dialog')

    for (const zoneName of ['Sidewalk (New)', 'Bushes (New)', 'Backyard', 'House']) {
      expect(within(dialog).getByRole('button', { name: `Water now · ${zoneName}` })).toHaveAttribute('data-modal-opener', 'true')
    }
    for (const programName of ['Sidewalk (New) schedule', 'Bushes (New) schedule', 'Backyard schedule', 'House schedule']) {
      expect(within(dialog).getByText(programName)).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('switch', { name: 'Turn on Backyard schedule' })).toHaveAttribute('aria-checked', 'false')
    expect(within(dialog).getByRole('switch', { name: 'Turn off Sidewalk (New) schedule' })).toHaveAttribute('aria-checked', 'true')
    expect(mockEntities[BACKYARD_SPRINKLER.batteryEntityId].state).toBe('100')
  })

  it('updates zone and schedule labels when Home Assistant changes the live zone name', async () => {
    const originalEntities = mockState.entities
    const view = render(<SprinklersPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Backyard Faucet Auto · Next Unknown' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Water now · Sidewalk (New)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Sidewalk \(New\) schedule/ })).toBeInTheDocument()

    const valveEntityId = BACKYARD_SPRINKLER.zones[0].valveEntityId
    mockState.entities = {
      ...mockState.entities,
      [valveEntityId]: {
        ...mockState.entities[valveEntityId],
        attributes: { ...mockState.entities[valveEntityId].attributes, zone_name: 'Sidewalk Drip Line' },
      },
    }
    view.rerender(<SprinklersPage />)

    expect(within(dialog).getByRole('button', { name: 'Water now · Sidewalk Drip Line' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Sidewalk Drip Line schedule/ })).toBeInTheDocument()
    mockState.entities = originalEntities
  })

  it('renders inert preload geometry', () => {
    const { container } = render(<SprinklersPage preload />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
