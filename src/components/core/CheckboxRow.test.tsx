import { render, screen } from '@testing-library/react'
import { CheckboxRow } from './CheckboxRow'

describe('CheckboxRow', () => {
  it('keeps interactive controls on aria-pressed semantics', () => {
    render(<CheckboxRow active aria-label="Interactive option" title="Interactive option" />)
    const control = screen.getByRole('button', { name: 'Interactive option' })
    expect(control).toHaveAttribute('aria-pressed', 'true')
    expect(control.querySelector('[data-dynamic-grid-label-container="true"]')).toBeInTheDocument()
    expect(control.querySelector('[data-dynamic-grid-label="true"]')).toHaveTextContent('Interactive option')
  })

  it('renders immutable inventory state as labelled status without checkbox semantics', () => {
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

    const status = screen.getByRole('group', { name: 'Fresh herbs: Inventory match uncertain' })
    expect(status).toHaveAttribute('data-status', 'mixed')
    expect(status).not.toHaveAttribute('aria-checked')
    expect(status).not.toHaveAttribute('aria-pressed')
    expect(status).not.toHaveAttribute('tabindex')
  })

  it('renders actionable status rows as buttons without pretending to be checkboxes', () => {
    render(
      <CheckboxRow
        active={false}
        aria-label="Fresh herbs: uncertain. Activate to mark as have"
        mode="status-control"
        status="mixed"
        subtitle="Inventory match uncertain"
        title="Fresh herbs"
      />,
    )
    const control = screen.getByRole('button', {
      name: 'Fresh herbs: uncertain. Activate to mark as have',
    })
    expect(control).toHaveAttribute('data-status', 'mixed')
    expect(control).not.toHaveAttribute('aria-checked')
    expect(control).not.toHaveAttribute('aria-pressed')
  })
})
