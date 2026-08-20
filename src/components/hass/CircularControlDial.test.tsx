import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CircularControlDial } from './CircularControlDial'

describe('CircularControlDial', () => {
  it('renders consistent off styling with configurable handles and trails', () => {
    render(
      <CircularControlDial
        ariaLabel="Example dial"
        colors={{ color: '#00aa88' }}
        handles={[{ ariaLabel: 'Target', ariaValueText: 'Level 4', color: '#00aa88', id: 'target', value: 4 }]}
        inactive
        label="Example"
        max={9}
        min={0}
        off
        primaryText="Off"
        secondaryText="Example status"
        step={1}
        trails={[{ color: '#00aa88', from: 0, id: 'trail', to: 4 }]}
        value={0}
      />,
    )

    expect(screen.getByRole('region', { name: 'Example dial' })).toHaveAttribute('data-off', 'true')
    expect(screen.getByRole('slider', { name: 'Target' })).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByText('Off').closest('[data-off]')).toHaveAttribute('data-off', 'true')
    expect(screen.getByText('Off').closest('[data-primary-variant]')).toHaveAttribute('data-primary-variant', 'status')
  })

  it('supports wide status text without treating the dial as off', () => {
    render(
      <CircularControlDial
        ariaLabel="Sleep mode dial"
        colors={{ color: '#00aa88' }}
        inactive
        label="Example"
        max={9}
        min={0}
        primaryText="Sleep"
        primaryTextVariant="wide-status"
        step={1}
        value={0}
      />,
    )

    const readout = screen.getByText('Sleep').closest('[data-primary-variant]')
    expect(readout).toHaveAttribute('data-primary-variant', 'wide-status')
    expect(readout).toHaveAttribute('data-off', 'false')
  })

  it('renders ordered static markers without slider semantics', () => {
    render(
      <CircularControlDial
        ariaLabel="Hot flash dial"
        colors={{ color: '#00aa88' }}
        disabled
        label="Hot flash"
        markers={[
          {
            color: '#00aa88',
            id: 'current',
            kind: 'current',
            value: -2,
          },
          {
            id: 'target',
            kind: 'target',
            value: -10,
          },
        ]}
        max={10}
        min={-10}
        primaryText="-10"
        readonly
        step={1}
        value={-10}
      />,
    )

    const dial = screen.getByRole('region', { name: 'Hot flash dial' })
    const markers = dial.querySelectorAll('[data-marker]')
    expect(markers).toHaveLength(2)
    expect(markers[0]).toHaveAttribute('data-marker', 'target')
    expect(markers[0]).toHaveAttribute('data-value', '-10')
    expect(markers[1]).toHaveAttribute('data-marker', 'current')
    expect(markers[1]).toHaveAttribute('data-value', '-2')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByTestId('control-slider-circular')).not.toHaveAttribute('data-hakit-current')
  })

  it('keeps zero markers and safely positions finite out-of-range values', () => {
    render(
      <CircularControlDial
        ariaLabel="Measured dial"
        colors={{ color: '#00aa88' }}
        label="Measured"
        markers={[
          { id: 'zero', kind: 'current', value: 0 },
          { id: 'high', kind: 'current', value: 12 },
          { id: 'invalid', kind: 'current', value: Number.NaN },
        ]}
        max={10}
        min={-10}
        primaryText="0"
        step={1}
        value={0}
      />,
    )

    const dial = screen.getByRole('region', { name: 'Measured dial' })
    expect(dial.querySelector('[data-value="0"]')).toHaveAttribute('data-clamped', 'false')
    expect(dial.querySelector('[data-value="12"]')).toHaveAttribute('data-position-value', '10')
    expect(dial.querySelector('[data-value="12"]')).toHaveAttribute('data-clamped', 'true')
    expect(dial.querySelectorAll('[data-marker]')).toHaveLength(2)
  })
})
