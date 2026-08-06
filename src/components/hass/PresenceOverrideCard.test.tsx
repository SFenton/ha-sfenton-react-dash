import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { materialIconPath } from '../core/iconPaths'
import { entity, mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { PresenceOverrideCard } from './PresenceOverrideCard'
import { presenceOverrideDisplayState } from './presenceOverrideState'

const ENTITY_ID = 'switch.test_presence_lighting_allowed'
const ITEM = { entityId: ENTITY_ID, title: 'Test Room' }

describe('presenceOverrideDisplayState', () => {
  it('applies the approved display-state precedence', () => {
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'off', { automation_state: 'paused', automation_paused: true }))).toBe('off')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: 'quieted', automation_paused: true }))).toBe('paused')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: 'paused' }))).toBe('paused')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_quieted: true }))).toBe('quieted')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: 'quieted' }))).toBe('quieted')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on'))).toBe('on')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'unknown', { automation_paused: true }))).toBe('unavailable')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'unavailable'))).toBe('unavailable')
    expect(presenceOverrideDisplayState(null)).toBe('unavailable')
  })

  it.each(['occupied', 'clearing', 'waiting_for_clear', 'settling_on', 'settling_off', 'pending_activation'])(
    'maps automation state %s to Active',
    (automationState) => {
      expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: automationState }))).toBe('active')
    },
  )
})

describe('PresenceOverrideCard', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[ENTITY_ID] = entity(ENTITY_ID, 'on', { automation_state: 'occupied' })
  })

  afterEach(() => {
    delete mockEntities[ENTITY_ID]
  })

  it('opens the five-option picker and optimistically applies the selected state', async () => {
    render(<PresenceOverrideCard item={ITEM} />)

    const tile = screen.getByRole('button', { name: 'Test Room Active' })
    expect(tile).toHaveStyle({ '--card-rgb': '30 136 229' })
    expect(tile.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-auto'))

    fireEvent.click(tile)

    const picker = await screen.findByRole('dialog', { name: 'Test Room Presence Lighting' })
    const options = within(picker).getByRole('group', { name: 'Test Room Presence Lighting options' })
    expect(within(options).getAllByRole('button').map((option) => option.textContent)).toEqual(['On', 'Off', 'Paused', 'Quieted', 'Active'])
    expect(within(options).getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(options).getByRole('button', { name: 'Quieted' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:volume-mute'))

    fireEvent.click(within(options).getByRole('button', { name: 'Quieted' }))

    expect(screen.getByRole('button', { name: 'Test Room Quieted', hidden: true })).toHaveStyle({ '--card-rgb': '117 91 180' })
    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'presence_based_lighting',
        service: 'set_automation_state',
        target: ENTITY_ID,
        serviceData: { state: 'quieted' },
      },
    ])
    await waitFor(() => expect(picker).toHaveAttribute('data-state', 'closed'))
    expect(picker).toHaveAttribute('data-closing', 'true')
  })

  it('disables unavailable entities without opening the picker', () => {
    mockEntities[ENTITY_ID] = entity(ENTITY_ID, 'unknown', { automation_paused: true })

    render(<PresenceOverrideCard item={ITEM} />)

    const tile = screen.getByRole('button', { name: 'Test Room Unavailable' })
    expect(tile).toBeDisabled()
    fireEvent.click(tile)
    expect(screen.queryByRole('dialog', { name: 'Test Room Presence Lighting' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })
})
