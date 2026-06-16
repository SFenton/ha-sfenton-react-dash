import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LightMoreInfoSheet } from './LightMoreInfoSheet'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const OPEN = 'light.front_door_bollard_1'
const OTHER = 'light.front_door_bollard_2'

const LIGHTS = [
  { entityId: OPEN, title: 'Bollard 1' },
  { entityId: OTHER, title: 'Bollard 2' },
]

function makeColorCapable(entityId: string, rgb: [number, number, number]) {
  mockEntities[entityId].state = 'on'
  mockEntities[entityId].attributes.supported_color_modes = ['color_temp', 'xy']
  mockEntities[entityId].attributes.color_mode = 'xy'
  mockEntities[entityId].attributes.rgb_color = rgb
}

function cleanup(entityId: string) {
  mockEntities[entityId].state = 'off'
  delete mockEntities[entityId].attributes.supported_color_modes
  delete mockEntities[entityId].attributes.color_mode
  delete mockEntities[entityId].attributes.rgb_color
}

describe('LightMoreInfoSheet', () => {
  beforeEach(() => {
    resetMockHass()
    makeColorCapable(OPEN, [10, 20, 30])
    makeColorCapable(OTHER, [200, 100, 50])
  })

  afterEach(() => {
    cleanup(OPEN)
    cleanup(OTHER)
  })

  it('shows the color picker and RGB inputs seeded from the live color', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    expect(screen.getByTestId('color-picker')).toBeInTheDocument()
    expect((screen.getByLabelText('Bollard 1 R channel') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('Bollard 1 G channel') as HTMLInputElement).value).toBe('20')
    expect((screen.getByLabelText('Bollard 1 B channel') as HTMLInputElement).value).toBe('30')
  })

  it('applies a valid RGB channel edit to the open light', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    fireEvent.change(screen.getByLabelText('Bollard 1 R channel'), { target: { value: '255' } })
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: OPEN, serviceData: { rgb_color: [255, 20, 30] } },
    ])
  })

  it('does not call a service for an out-of-range channel value', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    fireEvent.change(screen.getByLabelText('Bollard 1 R channel'), { target: { value: '300' } })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('resets the open light to the warm white default', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: OPEN, serviceData: { color_temp_kelvin: 2000, brightness: 255, transition: 1 } },
    ])
  })

  it('applies the current color to the front yard group with Apply to All Lights', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Apply to All Lights' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: 'light.front_yard_lights', serviceData: { rgb_color: [10, 20, 30] } },
    ])
  })

  it('copies another light color onto the open light', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    const swatch = screen.getByRole('button', { name: 'Apply Bollard 2 Color' })
    expect(swatch).toHaveAttribute('data-icon', 'mdi:outdoor-lamp')
    expect(swatch).toHaveAttribute('data-icon-color', '#ffffff')
    expect(swatch).toHaveAttribute('data-has-color', 'true')
    expect(swatch.style.getPropertyValue('--other-light-color')).toBe('rgb(200 100 50)')
    expect(swatch.textContent).toBe('')

    fireEvent.click(swatch)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: OPEN, serviceData: { rgb_color: [200, 100, 50] } },
    ])
  })

  it('does not render an apply button for the open light itself', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    expect(screen.queryByRole('button', { name: 'Apply Bollard 1 Color' })).not.toBeInTheDocument()
  })

  it('keeps the color picker swipeable so the modal can be dismissed over it', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    const picker = screen.getByTestId('color-picker')
    expect(picker.closest('[data-vaul-no-drag]')).toBeNull()
  })

  it('picks a color when the wheel is tapped', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    const overlay = screen.getByTestId('color-wheel-overlay')
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    // Tap to the right of center: hue 0, saturation 50%.
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(overlay, { clientX: 150, clientY: 100, pointerId: 1 })
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: OPEN, serviceData: { hs_color: [0, 50] } },
    ])
  })

  it('does not pick a color when the wheel is swiped (so the sheet can dismiss)', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    const overlay = screen.getByTestId('color-wheel-overlay')
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(overlay, { clientX: 150, clientY: 175, pointerId: 1 })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('moves the marker optimistically on tap before the backend confirms', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    const overlay = screen.getByTestId('color-wheel-overlay')
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    // No color reported yet, so no marker is rendered initially.
    expect(screen.queryByTestId('color-wheel-marker')).not.toBeInTheDocument()
    // Tap to the right of center: the marker should appear at that point immediately,
    // without waiting for Home Assistant to echo the new color back.
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(overlay, { clientX: 150, clientY: 100, pointerId: 1 })
    const marker = screen.getByTestId('color-wheel-marker')
    expect(marker.style.left).toBe('75%')
    expect(marker.style.top).toBe('50%')
  })

  it('groups the other lights under an "Other Lights" separator', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)
    expect(screen.getByText('Other Lights')).toBeInTheDocument()
  })

  it('uses a 700px desktop split layout with the light slider spanning both columns', () => {
    render(<LightMoreInfoSheet entityId={OPEN} lights={LIGHTS} onClose={() => {}} open title="Bollard 1" />)

    const dialog = screen.getByRole('dialog', { name: 'Bollard 1' })
    expect(dialog).toHaveStyle({
      '--modal-desktop-height': 'auto',
      '--modal-desktop-max-width': '700px',
      '--modal-desktop-width': '700px',
    })

    const layout = dialog.querySelector('[data-has-other-lights="true"]')
    if (!(layout instanceof HTMLElement)) throw new Error('Light color picker layout was not rendered')

    const slider = screen.getByRole('region', { name: 'Bollard 1 light slider' })
    const controls = screen.getByRole('region', { name: 'Bollard 1 color controls' })
    const otherLights = screen.getByRole('region', { name: 'Other Lights' })
    const otherLightsGrid = otherLights.querySelector('[data-layout="color-swatch-grid"]')
    expect(layout).toContainElement(slider)
    expect(layout).toContainElement(controls)
    expect(layout).toContainElement(otherLights)
    expect(slider).toHaveAttribute('data-layout', 'light-slider')
    expect(slider).toContainElement(screen.getByRole('group', { name: 'Bollard 1' }))
    expect(otherLightsGrid).toBeInTheDocument()
    const reset = screen.getByRole('button', { name: 'Reset' })
    const applyToAll = screen.getByRole('button', { name: 'Apply to All Lights' })
    expect(reset).toHaveAttribute('data-icon-color', '#ffffff')
    expect(applyToAll).toHaveAttribute('data-icon-color', '#ffffff')
    expect(controls).toContainElement(reset)
    expect(controls).toContainElement(applyToAll)
    expect(otherLights).toContainElement(screen.getByRole('button', { name: 'Apply Bollard 2 Color' }))
  })
})
