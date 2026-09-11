import { fireEvent, render, screen } from '@testing-library/react'
import { ChatColorEditor } from './ChatColorEditor'
import type { ChatColorDraft } from './chatColorDraft'
import type { ChatResponseControl } from './chatRecords'

// @covers src/components/hass/chat/chatColorDraft.ts
type ColorControl = Extract<ChatResponseControl, { kind: 'color-picker' }>

const rgbControl: ColorControl = {
  id: 'rgb', kind: 'color-picker', room: 'Music Room', rooms: ['Music Room'], palette: ['red'], supportsCustomRgb: true,
  colorMode: 'rgb', entityIds: [], currentRgb: [10, 20, 30], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
}

it('edits a custom RGB value without calling Home Assistant', () => {
  let draft: ChatColorDraft = { kind: 'rgb', rgb: [10, 20, 30] }
  const onChange = vi.fn((next: ChatColorDraft) => { draft = next })
  const view = render(<ChatColorEditor control={rgbControl} draft={draft} onChange={onChange} />)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'R channel' }), { target: { value: '255' } })
  expect(onChange).toHaveBeenCalledWith({ kind: 'rgb', rgb: [255, 20, 30] })
  view.rerender(<ChatColorEditor control={rgbControl} draft={{ kind: 'rgb', rgb: [255, 20, 30] }} onChange={onChange} />)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'G channel' }), { target: { value: '300' } })
  expect(onChange).toHaveBeenCalledTimes(1)
  const wheel = screen.getByRole('slider', { name: 'Custom' })
  expect(wheel.closest('[data-light-color-picker="true"]')).toBeInTheDocument()
  expect(wheel).toHaveAttribute('aria-valuetext', 'RGB 255, 20, 30')
  fireEvent.keyDown(wheel, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenCalledTimes(2)
  expect(onChange.mock.calls[1]?.[0]).toMatchObject({ kind: 'rgb' })
})

it('cancels RGB dragging when the active pointer is cancelled', () => {
  const onChange = vi.fn()
  render(<ChatColorEditor control={rgbControl} draft={{ kind: 'rgb', rgb: [10, 20, 30] }} onChange={onChange} />)
  const overlay = screen.getByRole('slider', { name: 'Custom' })
  vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200,
    toJSON: () => ({}),
  } as DOMRect)

  fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerCancel(window, { pointerId: 1 })
  onChange.mockClear()
  fireEvent.pointerMove(window, { pointerId: 2, clientX: 180, clientY: 100 })

  expect(onChange).not.toHaveBeenCalled()
})

it('limits mixed-capability targets to the white temperature spectrum', () => {
  const control: ColorControl = {
    ...rgbControl, id: 'temperature', rooms: ['Living Room', 'Music Room'], supportsCustomRgb: false,
    colorMode: 'temperature', currentRgb: undefined, currentTemperatureKelvin: 4200,
  }
  const onChange = vi.fn()
  render(<ChatColorEditor control={control} draft={{ kind: 'temperature', kelvin: 4200 }} onChange={onChange} />)
  const slider = screen.getByRole('slider', { name: 'Color Temperature' })
  expect(screen.getByRole('spinbutton', { name: 'Color Temperature' })).toHaveValue(4200)
  expect(slider).toHaveAttribute('aria-valuenow', '4200')
  expect(slider.closest('[data-light-temperature-picker="true"]')).toBeInTheDocument()
  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenCalledWith({ kind: 'temperature', kelvin: 4250 })
})
