import { render, screen } from '@testing-library/react'
import { CheckboxRow } from './CheckboxRow'

describe('CheckboxRow', () => {
  it('keeps interactive controls on aria-pressed semantics', () => {
    render(<CheckboxRow active aria-label="Interactive option" title="Interactive option" />)
    expect(screen.getByRole('button', { name: 'Interactive option' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders immutable inventory state as a read-only checkbox without aria-pressed', () => {
    render(
      <CheckboxRow
        active={false}
        aria-label="Fresh herbs: Inventory match uncertain"
        mode="status"
        status="mixed"
        subtitle="Inventory match uncertain"
        title="Fresh herbs"
      />,
    )

    const status = screen.getByRole('checkbox', { name: 'Fresh herbs: Inventory match uncertain' })
    expect(status).toHaveAttribute('aria-checked', 'mixed')
    expect(status).toHaveAttribute('aria-readonly', 'true')
    expect(status).not.toHaveAttribute('aria-pressed')
    expect(status).not.toHaveAttribute('tabindex')
  })
})
