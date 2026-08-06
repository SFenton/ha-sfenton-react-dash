import { fireEvent, render, screen } from '@testing-library/react'
import { materialIconPath } from '../core/iconPaths'
import { entity, mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { PresenceOverrideCard, PresenceOverrideDetailPage } from './PresenceOverrideCard'
import { presenceOverrideDisplayState, presenceOverrideServiceState } from './presenceOverrideState'

const ENTITY_ID = 'switch.test_presence_lighting_allowed'
const ITEM = { entityId: ENTITY_ID, title: 'Test Room' }

describe('presenceOverrideDisplayState', () => {
  it('applies the approved display-state precedence', () => {
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'off', { automation_state: 'paused', automation_paused: true }))).toBe('off')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: 'quieted', automation_paused: true }))).toBe('paused')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_state: 'paused' }))).toBe('paused')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on', { automation_quieted: true }))).toBe('quieted')
    expect(presenceOverrideDisplayState(entity(ENTITY_ID, 'on'))).toBe('enabled')
    expect(presenceOverrideDisplayState(null)).toBe('unavailable')
  })

  it('maps the collapsed enabled choice to the backend active command', () => {
    expect(presenceOverrideServiceState('enabled')).toBe('active')
  })
})

describe('PresenceOverrideCard', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[ENTITY_ID] = entity(ENTITY_ID, 'on', { automation_state: 'occupied' })
  })
  afterEach(() => delete mockEntities[ENTITY_ID])

  it('opens its room detail page through the shared modal trigger contract', () => {
    const onSelect = vi.fn()
    render(<PresenceOverrideCard item={ITEM} onSelect={onSelect} />)
    const tile = screen.getByRole('button', { name: 'Test Room Enabled' })
    expect(tile).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(tile.closest('[data-modal-detail-trigger]')).toHaveAttribute('data-modal-detail-trigger', ENTITY_ID)
    expect(tile.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-auto'))
    fireEvent.click(tile)
    expect(onSelect).toHaveBeenCalledWith(ITEM)
  })

  it('uses a dynamic Alarm-style two-column grid without icon surfaces', () => {
    render(<PresenceOverrideDetailPage item={ITEM} />)
    const stateGrid = screen.getByRole('group', { name: 'Test Room presence lighting states' })
    expect(stateGrid).toHaveAttribute('data-dynamic-grid-columns', '2')
    expect(screen.getAllByRole('button')).toHaveLength(4)
    const enabled = screen.getByRole('button', { name: 'Set Test Room presence lighting to Enable Presence-Based Lighting' })
    expect(enabled).toHaveAttribute('data-active', 'true')
    expect(enabled).toHaveAttribute('data-icon-surface', 'false')
    expect(screen.queryByText('Selected')).not.toBeInTheDocument()
    expect(screen.getByText('Lights stay in their current state until explicitly resumed.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Set Test Room presence lighting to Quieted' }))
    expect(mockCallServiceCalls).toEqual([{
      domain: 'presence_based_lighting',
      service: 'set_automation_state',
      target: ENTITY_ID,
      serviceData: { state: 'quieted' },
    }])
  })

  it('disables unavailable overview and detail controls', () => {
    mockEntities[ENTITY_ID] = entity(ENTITY_ID, 'unknown', { automation_paused: true })
    const onSelect = vi.fn()
    const { rerender } = render(<PresenceOverrideCard item={ITEM} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Test Room Unavailable' })).toBeDisabled()
    rerender(<PresenceOverrideDetailPage item={ITEM} />)
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
  })
})
