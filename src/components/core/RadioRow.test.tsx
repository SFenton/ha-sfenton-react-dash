import { render, screen } from '@testing-library/react'
import { RadioRow } from './RadioRow'

describe('RadioRow', () => {
  it('exposes its title and subtitle to DynamicGrid measurement', () => {
    render(<RadioRow active subtitle="Thirty minutes" title="Ramp duration" />)

    const row = screen.getByRole('radio')
    expect(row.querySelector('[data-dynamic-grid-label-container="true"]')).toBeInTheDocument()
    expect(Array.from(row.querySelectorAll('[data-dynamic-grid-label="true"]')).map((label) => label.textContent)).toEqual([
      'Ramp duration',
      'Thirty minutes',
    ])
  })
})
