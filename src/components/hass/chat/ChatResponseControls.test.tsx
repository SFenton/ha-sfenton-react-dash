import { fireEvent, render, screen } from '@testing-library/react'
import type { ChatClient } from './chatClient'
import { ChatResponseControls } from './ChatResponseControls'
import type { ChatResponseControl } from './chatRecords'

function client(used = false) {
  return {
    controlUsed: () => used,
    sendControl: vi.fn(async () => undefined),
  } as unknown as ChatClient
}

describe('ChatResponseControls', () => {
  it('renders a room carousel and submits its selected room once', () => {
    const control: ChatResponseControl = {
      id: 'room-one', kind: 'room-picker',
      options: [
        { label: 'Living Room', value: 'Living Room', message: 'Turn on the Living Room lights.' },
        { label: 'Kitchen', value: 'Kitchen', message: 'Turn on the Kitchen lights.' },
      ],
    }
    const active = client()
    const view = render(<ChatResponseControls client={active} controls={[control]} ownerResultId="result-one" />)
    fireEvent.click(screen.getByRole('option', { name: 'Kitchen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send Selection' }))
    expect(active.sendControl).toHaveBeenCalledWith('room-one', 'Turn on the Kitchen lights.', 'result-one')

    view.rerender(<ChatResponseControls client={client(true)} controls={[control]} ownerResultId="result-one" />)
    expect(screen.getByRole('button', { name: 'Already Sent' })).toBeDisabled()
    fireEvent.click(screen.getByRole('option', { name: 'Living Room' }))
    expect(screen.getByRole('option', { name: 'Living Room' })).toHaveAttribute('aria-selected', 'true')
  })

  it('submits compact typed color and brightness continuation messages', () => {
    const controls: ChatResponseControl[] = [
      { id: 'color-send', kind: 'color-picker', room: 'Music Room', rooms: ['Music Room'], palette: ['red'], supportsCustomRgb: true, colorMode: 'rgb', entityIds: [], currentRgb: [18, 52, 86], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500 },
      { id: 'brightness-send', kind: 'brightness-slider', room: 'Music Room', value: 40, min: 0, max: 100, step: 1 },
    ]
    const active = client()
    const drafts = new Map([['color-send', { kind: 'rgb' as const, rgb: [18, 52, 86] as [number, number, number] }]])
    render(<ChatResponseControls client={active} colorDrafts={drafts} controls={controls} ownerResultId="result-two" />)
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Send Color' }))
    const slider = screen.getByRole('slider', { name: 'Brightness' })
    fireEvent.change(slider, { target: { value: '65' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Brightness' }))
    expect(active.sendControl).toHaveBeenNthCalledWith(1, 'color-send', 'Turn the Music Room lights to rgb(18, 52, 86).', 'result-two')
    expect(active.sendControl).toHaveBeenNthCalledWith(2, 'brightness-send', 'Turn the Music Room lights to 65%.', 'result-two')
    for (const [, message] of (active.sendControl as ReturnType<typeof vi.fn>).mock.calls) expect(message.length).toBeLessThanOrEqual(180)
  })

  it('opens the custom color detail and sends a retained white-spectrum value', () => {
    const control: Extract<ChatResponseControl, { kind: 'color-picker' }> = {
      id: 'mixed-color', kind: 'color-picker', room: 'Living Room', rooms: ['Living Room', 'Music Room'],
      subject: 'Living Room lights and Music Room lights', palette: ['warm white', 'cool white'], supportsCustomRgb: false,
      colorMode: 'temperature', entityIds: [], currentTemperatureKelvin: 4100, minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
    }
    const active = client()
    const open = vi.fn()
    const drafts = new Map([['mixed-color', { kind: 'temperature' as const, kelvin: 4250 }]])
    render(<ChatResponseControls client={active} colorDrafts={drafts} controls={[control]} onOpenCustomColor={open} ownerResultId="mixed-result" />)
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(open).toHaveBeenCalledWith(control, { kind: 'temperature', kelvin: 4250 })
    fireEvent.click(screen.getByRole('button', { name: 'Send Color' }))
    expect(active.sendControl).toHaveBeenCalledWith('mixed-color', 'Turn the Living Room lights and Music Room lights to 4250K.', 'mixed-result')
  })

  it('preserves fixture targets in color and brightness continuations', () => {
    const controls: ChatResponseControl[] = [
      { id: 'fixture-color', kind: 'color-picker', room: 'Living Room', rooms: ['Living Room'], subject: 'Front Left in the Living Room', palette: ['warm white'], supportsCustomRgb: false, colorMode: 'temperature', entityIds: [], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500 },
      { id: 'fixture-brightness', kind: 'brightness-slider', room: 'Living Room', subject: 'Front Left in the Living Room', value: 40, min: 0, max: 100, step: 1 },
    ]
    const active = client()
    render(<ChatResponseControls client={active} controls={controls} ownerResultId="fixture-result" />)
    fireEvent.click(screen.getByRole('button', { name: 'Send Color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send Brightness' }))
    expect(active.sendControl).toHaveBeenNthCalledWith(1, 'fixture-color', 'Turn the Front Left in the Living Room to warm white.', 'fixture-result')
    expect(active.sendControl).toHaveBeenNthCalledWith(2, 'fixture-brightness', 'Turn the Front Left in the Living Room to 40%.', 'fixture-result')
  })

  it('keeps color and brightness inputs adjustable after their send action is locked', () => {
    const controls: ChatResponseControl[] = [
      { id: 'color-one', kind: 'color-picker', room: 'Music Room', rooms: ['Music Room'], palette: ['red', 'blue'], supportsCustomRgb: true, colorMode: 'rgb', entityIds: [], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500 },
      { id: 'brightness-one', kind: 'brightness-slider', room: 'Music Room', value: 40, min: 0, max: 100, step: 1 },
    ]
    render(<ChatResponseControls client={client(true)} controls={controls} ownerResultId="result-three" />)
    fireEvent.click(screen.getByRole('button', { name: 'blue' }))
    expect(screen.getByRole('button', { name: 'blue' })).toHaveAttribute('aria-pressed', 'true')
    const slider = screen.getByRole('slider', { name: 'Brightness' })
    fireEvent.change(slider, { target: { value: '65' } })
    expect(slider).toHaveValue('65')
    expect(screen.getAllByRole('button', { name: 'Already Sent' })).toHaveLength(2)
  })
})
