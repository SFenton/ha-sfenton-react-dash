import { render, screen } from '@testing-library/react'
import { ResponsiveSectionGrid, ResponsiveSectionItem } from './ResponsiveSectionGrid'

describe('ResponsiveSectionGrid', () => {
  it('preserves DOM order and exposes explicit span policies', () => {
    render(
      <ResponsiveSectionGrid maxColumns={3}>
        <ResponsiveSectionItem><section>First</section></ResponsiveSectionItem>
        <ResponsiveSectionItem span="wide"><section>Second</section></ResponsiveSectionItem>
        <ResponsiveSectionItem span="full"><section>Third</section></ResponsiveSectionItem>
      </ResponsiveSectionGrid>,
    )

    const grid = document.querySelector('[data-responsive-section-grid="true"]')
    expect(grid).toHaveAttribute('data-max-columns', '3')
    expect(Array.from(grid?.children ?? []).map((item) => item.textContent)).toEqual(['First', 'Second', 'Third'])
    expect(screen.getByText('Second').parentElement).toHaveAttribute('data-span', 'wide')
    expect(screen.getByText('Third').parentElement).toHaveAttribute('data-span', 'full')
  })
})
