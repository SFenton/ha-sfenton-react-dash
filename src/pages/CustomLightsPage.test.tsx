import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomLightsPage } from './CustomLightsPage'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

const MANUAL = 'input_boolean.manually_control_front_yard_lights'
const MODE = 'input_select.front_yard_custom_lights'

const CUSTOM_LIGHT_IDS = [
  'light.front_door_exterior_left_light',
  'light.front_door_exterior_light_v2',
  'light.front_door_bollard_1',
  'light.front_door_bollard_2',
  'light.front_door_bollard_3',
  'light.front_door_bollard_4',
  'light.front_door_bollard_5',
  'light.front_door_bollard_6',
]

function setManual(state: 'on' | 'off') {
  mockEntities[MANUAL].state = state
}

function setMode(option: string) {
  mockEntities[MODE].state = option
}

describe('CustomLightsPage', () => {
  beforeEach(() => {
    resetMockHass()
    setManual('off')
    setMode('Default')
  })

  afterEach(() => {
    setManual('off')
    setMode('Default')
    for (const light of CUSTOM_LIGHT_IDS) {
      delete mockEntities[light].attributes.rgb_color
    }
  })

  it('renders the Front Yard header and the manual control card', () => {
    render(<CustomLightsPage />)
    const heading = screen.getByRole('heading', { name: 'Front Yard' })
    expect(heading).toBeInTheDocument()
    expect(heading.closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    expect(screen.getByRole('button', { name: 'Manually control front yard lights' })).toBeInTheDocument()
  })

  it('hides the mode select and the light grid when manual control is off', () => {
    render(<CustomLightsPage />)
    expect(screen.queryByRole('button', { name: 'Select lighting mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Left Door Light/ })).not.toBeInTheDocument()
  })

  it('shows the mode select but hides the grid when on but not in Custom mode', () => {
    setManual('on')
    setMode('Default')
    render(<CustomLightsPage />)
    expect(screen.getByRole('button', { name: 'Select lighting mode' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Left Door Light/ })).not.toBeInTheDocument()
  })

  it('reveals all eight light cards when on and in Custom mode', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    expect(screen.getByRole('group', { name: /Left Door Light/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Right Door Light/ })).toBeInTheDocument()
    const lightGrid = screen.getByRole('group', { name: /Left Door Light/ }).closest('[data-dynamic-grid="true"]')
    expect(lightGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(lightGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
    expect(lightGrid?.querySelectorAll('[data-dynamic-grid-cell="true"]')).toHaveLength(8)
    for (let i = 1; i <= 6; i += 1) {
      expect(screen.getByRole('group', { name: new RegExp(`Bollard ${i}`) })).toBeInTheDocument()
    }
  })

  it('toggles the manual control boolean when the mode card is tapped', () => {
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Manually control front yard lights' }))
    expect(mockCallServiceCalls).toEqual([{ domain: 'homeassistant', service: 'toggle', target: MANUAL }])
  })

  it('selects an input_select option from the mode picker', () => {
    setManual('on')
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Select lighting mode' }))
    const picker = screen.getByRole('dialog')
    expect(picker).toHaveAttribute('data-modal-geometry-intent', 'option-picker-compact')
    expect(picker).toHaveAttribute('data-modal-block-policy', 'content-fit')
    expect(picker).toHaveStyle({
      '--modal-centered-block-size': 'auto',
      '--modal-centered-inline-size': '500px',
      '--modal-centered-max-inline-size': '500px',
    })
    expect(screen.getByRole('group', { name: 'Lighting Mode options' })).toHaveAttribute('data-layout', 'compact-grid')
    expect(picker.querySelector('span[aria-hidden="true"][class*="separator"]')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(mockCallServiceCalls).toEqual([{ domain: 'input_select', service: 'select_option', target: MODE, serviceData: { option: 'Custom' } }])
    // The picker stays open after selection so the user can switch modes again.
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
  })

  it('opens more-info instead of toggling when a door light tile is tapped', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    const tile = screen.getByRole('group', { name: /Left Door Light/ })
    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 10 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 10 })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('opens more-info instead of toggling when a bollard tile is tapped', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    const tile = screen.getByRole('group', { name: /Bollard 1/ })
    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 10 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 10 })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('does not open more-info when a tile is swiped vertically (page scroll)', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    const tile = screen.getByRole('group', { name: /Left Door Light/ })
    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 20, clientY: 0 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 20, clientY: 60 })
    // A vertical swipe must be treated as a scroll, not a tap, so no modal opens.
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('toggles the light from the power sub-button', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Bollard 3' }))
    expect(mockCallServiceCalls).toEqual([{ domain: 'homeassistant', service: 'toggle', target: 'light.front_door_bollard_3' }])
  })

  it('sends brightness only on slider release and holds the optimistic value', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    const tile = screen.getByRole('group', { name: /Bollard 4/ })
    vi.spyOn(tile, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 84, right: 200, bottom: 84, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    tile.setPointerCapture = vi.fn()
    tile.releasePointerCapture = vi.fn()
    tile.hasPointerCapture = vi.fn(() => false)

    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 0 })
    // Dragging past the threshold must not call any service yet.
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 100 })
    expect(mockCallServiceCalls).toEqual([])

    // Release at 75% of the 200px width.
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 150 })
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: 'light.front_door_bollard_4', serviceData: { brightness_pct: 75 } },
    ])

    // The tile holds the released value optimistically even though the entity is still off.
    expect(tile.style.getPropertyValue('--fill-pct')).toBe('75%')
    expect(tile.getAttribute('data-active')).toBe('true')
  })

  it('shows the Seahawks green-to-blue gradient on the selected Seahawks option', () => {
    setManual('on')
    setMode('Seahawks')
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Select lighting mode' }))
    const option = screen.getByRole('button', { name: 'Seahawks' })
    expect(option.style.background).toBe('linear-gradient(90deg, rgb(0, 255, 0), rgb(0, 0, 255))')
  })

  it("shows the Valentine's red-to-pink gradient on the selected Valentine's option", () => {
    setManual('on')
    setMode("Valentine's Day")
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Select lighting mode' }))
    const option = screen.getByRole('button', { name: "Valentine's Day" })
    expect(option.style.background).toBe('linear-gradient(90deg, rgb(255, 0, 0), rgb(255, 0, 234))')
  })

  it('builds the Custom gradient from live light colors, sorted darkest to brightest and de-duped', () => {
    setManual('on')
    setMode('Custom')
    mockEntities['light.front_door_bollard_1'].attributes.rgb_color = [0, 255, 0]
    mockEntities['light.front_door_bollard_2'].attributes.rgb_color = [0, 0, 255]
    mockEntities['light.front_door_bollard_3'].attributes.rgb_color = [0, 0, 255]
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Select lighting mode' }))
    const option = screen.getByRole('button', { name: 'Custom' })
    // Blue (luminance 29) before green (luminance 150); duplicate blue removed.
    expect(option.style.background).toBe('linear-gradient(90deg, rgb(0, 0, 255), rgb(0, 255, 0))')
  })

  it('falls back to the default green selection for the Default option (no gradient)', () => {
    setManual('on')
    setMode('Default')
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Select lighting mode' }))
    const option = screen.getByRole('button', { name: 'Default' })
    expect(option.style.background).toBe('')
  })

  it('resets all lights to the HA default warm white at full brightness', () => {
    setManual('on')
    setMode('Custom')
    render(<CustomLightsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset All Lights' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'light', service: 'turn_on', target: 'light.front_yard_lights', serviceData: { color_temp_kelvin: 2000, brightness: 255, transition: 1 } },
    ])
  })

  it('hides the Reset All Lights button when the custom grid is hidden', () => {
    setManual('on')
    setMode('Default')
    render(<CustomLightsPage />)
    expect(screen.queryByRole('button', { name: 'Reset All Lights' })).not.toBeInTheDocument()
  })
})

afterEach(() => {
  vi.clearAllMocks()
})
