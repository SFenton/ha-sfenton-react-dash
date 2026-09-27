import { fireEvent, render, screen } from '@testing-library/react'
import { LightBrightnessCard } from './LightBrightnessCard'
import { entity, mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const LIGHT_ID = 'light.test_custom_light'

function prepareDragSurface(card: HTMLElement, slider?: HTMLElement) {
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 84, right: 200, bottom: 84, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  if (slider) vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 20, width: 160, top: 0, height: 44, right: 180, bottom: 44, x: 20, y: 0, toJSON: () => ({}) } as DOMRect)
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

  it('uses the full separator slider track for group brightness, including 0 and 100 percent', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} separator showStatus title="Test Room Lights" />)
    const card = screen.getByRole('group', { name: 'Test Room Lights' })
    const slider = screen.getByRole('slider', { name: 'Test Room Lights' })
    expect(card.querySelectorAll('[data-dynamic-grid-label="true"]')).toHaveLength(1)
    prepareDragSurface(card, slider)

    fireEvent.pointerDown(slider, { pointerId: 9, clientX: 30, clientY: 10 })
    fireEvent.pointerMove(slider, { pointerId: 9, clientX: 120, clientY: 10 })
    fireEvent.pointerUp(slider, { pointerId: 9, clientX: 180, clientY: 10 })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: LIGHT_ID, serviceData: { brightness_pct: 100 } },
    ])

    fireEvent.pointerDown(slider, { pointerId: 10, clientX: 20, clientY: 10 })
    fireEvent.pointerUp(slider, { pointerId: 10, clientX: 20, clientY: 10 })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(mockCallServiceCalls.at(-1)).toEqual({ domain: 'light', service: 'turn_off', target: LIGHT_ID })
  })

  it('adjusts the separator from the keyboard and preserves the group power action', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} separator showStatus title="Test Room Lights" />)
    const slider = screen.getByRole('slider', { name: 'Test Room Lights' })
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
    expect(slider).toHaveAttribute('aria-valuetext', '50%')
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(slider).toHaveAttribute('aria-valuenow', '55')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(mockCallServiceCalls).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Test Room Lights' }))
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(mockCallServiceCalls.at(-1)).toEqual({ domain: 'homeassistant', service: 'toggle', target: LIGHT_ID })
  })

  it('does not issue a brightness command for a vertical swipe across the separator', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} separator title="Lights" />)
    const card = screen.getByRole('group', { name: 'Lights' })
    const slider = screen.getByRole('slider', { name: 'Lights' })
    prepareDragSurface(card, slider)

    fireEvent.pointerDown(slider, { pointerId: 12, clientX: 60, clientY: 0 })
    fireEvent.pointerMove(slider, { pointerId: 12, clientX: 68, clientY: 50 })
    fireEvent.pointerUp(slider, { pointerId: 12, clientX: 68, clientY: 50 })

    expect(mockCallServiceCalls).toEqual([])
    expect(card).toHaveAttribute('data-dragging', 'false')
  })
})
