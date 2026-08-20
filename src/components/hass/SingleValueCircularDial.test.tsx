import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SingleValueCircularDial } from './SingleValueCircularDial'

describe('SingleValueCircularDial', () => {
  it('supports keyboard value changes through the shared handle', () => {
    const onCommit = vi.fn()
    render(
      <SingleValueCircularDial
        actionText="Level"
        ariaLabel="Example level 4"
        color="#00aa88"
        handleAriaLabel="Example level"
        max={9}
        min={0}
        onCommit={onCommit}
        primaryText={String}
        step={1}
        value={4}
      />,
    )

    const slider = screen.getByRole('slider', { name: 'Example level' })
    expect(screen.getByTestId('control-slider-circular')).toHaveAttribute('inert')
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenCalledWith(5)
  })

  it('keeps read-only current markers visible without exposing an adjustable slider', () => {
    const onCommit = vi.fn()
    render(
      <SingleValueCircularDial
        ariaLabel="Automatic level 5"
        color="#00aa88"
        handleAriaLabel="Example level"
        markers={[{ color: '#00aa88', id: 'current', kind: 'current', value: 5 }]}
        max={9}
        min={0}
        onCommit={onCommit}
        primaryText={() => 'Sleep'}
        readOnly
        step={1}
        value={7}
      />,
    )

    const dial = screen.getByRole('region', { name: 'Automatic level 5' })
    expect(dial).not.toHaveAttribute('aria-disabled')
    expect(dial.querySelector('[data-marker="current"]')).toHaveAttribute('data-value', '5')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })
})
