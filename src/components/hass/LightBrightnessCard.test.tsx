import { fireEvent, render, screen } from '@testing-library/react'
import { LightBrightnessCard } from './LightBrightnessCard'
import { entity, mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const LIGHT_ID = 'light.test_custom_light'

function prepareDragSurface(card: HTMLElement) {
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 84, right: 200, bottom: 84, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  card.setPointerCapture = vi.fn()
  card.releasePointerCapture = vi.fn()
  card.hasPointerCapture = vi.fn(() => false)
}

describe('LightBrightnessCard modal disclosure', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[LIGHT_ID] = entity(LIGHT_ID, 'on', { brightness: 128, rgb_color: [255, 128, 64] })
  })

  it('separates the keyboard-accessible detail opener from the HA power action', () => {
    const onMoreInfo = vi.fn()
    render(<LightBrightnessCard entityId={LIGHT_ID} onMoreInfo={onMoreInfo} showStatus tapAction="more-info" title="Test Light" />)

    const details = screen.getByRole('button', { name: 'Open Test Light details' })
    expect(details.parentElement?.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(details.parentElement?.querySelectorAll('[data-dynamic-grid-label="true"]')).toHaveLength(2)
    fireEvent.click(details)

    expect(onMoreInfo).toHaveBeenCalledWith(LIGHT_ID, 'Test Light')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Test Light' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: LIGHT_ID },
    ])
    expect(screen.getByRole('button', { name: 'Toggle Test Light' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not show modal disclosure for a direct toggle card', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} title="Test Light" />)

    expect(screen.queryByRole('button', { name: 'Open Test Light details' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Test Light' }).querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('cancels a brightness drag without issuing a Home Assistant command', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} showStatus title="Test Light" />)
    const card = screen.getByRole('group', { name: 'Test Light' })
    prepareDragSurface(card)

    fireEvent.pointerDown(card, { pointerId: 7, clientX: 0 })
    fireEvent.pointerMove(card, { pointerId: 7, clientX: 160 })
    expect(card.style.getPropertyValue('--fill-pct')).toBe('80%')

    fireEvent.pointerCancel(card, { pointerId: 7, clientX: 160 })

    expect(mockCallServiceCalls).toEqual([])
    expect(card.style.getPropertyValue('--fill-pct')).toBe('50%')
    expect(card).toHaveAttribute('data-dragging', 'false')
  })

  it.each([
    ['missing', 'Unavailable'],
    ['unknown', 'Unknown'],
    ['unavailable', 'Unavailable'],
  ])('disables brightness and power actions when the entity is %s', (state, expectedStatus) => {
    if (state === 'missing') delete mockEntities[LIGHT_ID]
    else mockEntities[LIGHT_ID] = entity(LIGHT_ID, state, { brightness: 128 })

    render(<LightBrightnessCard entityId={LIGHT_ID} showStatus title="Test Light" />)
    const card = screen.getByRole('group', { name: 'Test Light' })
    prepareDragSurface(card)

    expect(card).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByText(expectedStatus)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle Test Light' })).toBeDisabled()

    fireEvent.pointerDown(card, { pointerId: 3, clientX: 0 })
    fireEvent.pointerMove(card, { pointerId: 3, clientX: 100 })
    fireEvent.pointerUp(card, { pointerId: 3, clientX: 100 })

    expect(mockCallServiceCalls).toEqual([])
  })

  it('turns an off light on at the released brightness even without a live brightness attribute', () => {
    mockEntities[LIGHT_ID] = entity(LIGHT_ID, 'off')
    render(<LightBrightnessCard entityId={LIGHT_ID} showStatus title="Test Light" />)
    const card = screen.getByRole('group', { name: 'Test Light' })
    prepareDragSurface(card)

    fireEvent.pointerDown(card, { pointerId: 9, clientX: 0 })
    fireEvent.pointerMove(card, { pointerId: 9, clientX: 50 })
    fireEvent.pointerUp(card, { pointerId: 9, clientX: 100 })

    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: LIGHT_ID, serviceData: { brightness_pct: 50 } },
    ])
    expect(screen.getByRole('button', { name: 'Toggle Test Light' })).not.toBeDisabled()
  })

  it('turns the light off when brightness is released at zero', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} showStatus title="Test Light" />)
    const card = screen.getByRole('group', { name: 'Test Light' })
    prepareDragSurface(card)

    fireEvent.pointerDown(card, { pointerId: 11, clientX: 100 })
    fireEvent.pointerMove(card, { pointerId: 11, clientX: 50 })
    fireEvent.pointerUp(card, { pointerId: 11, clientX: 0 })

    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_off', target: LIGHT_ID },
    ])
  })
})
