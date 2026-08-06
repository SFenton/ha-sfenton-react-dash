import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CircularControlDial } from './CircularControlDial'

describe('CircularControlDial', () => {
  it('renders consistent off styling with configurable handles and trails', () => {
    render(
      <CircularControlDial
        ariaLabel="Example dial"
        colors={{ color: '#00aa88' }}
        current={0}
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
  })
})
