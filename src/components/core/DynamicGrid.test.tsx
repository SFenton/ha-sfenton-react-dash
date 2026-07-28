import { render, screen, waitFor } from '@testing-library/react'
import { DynamicGrid } from './DynamicGrid'
import { packDynamicGridSpans } from './dynamicGridLayout'

describe('packDynamicGridSpans', () => {
  it('fills partial and final rows without changing item order', () => {
    expect(packDynamicGridSpans([1, 1, 1, 1], 3)).toEqual([1, 1, 1, 3])
    expect(packDynamicGridSpans([2, 1, 2], 3)).toEqual([2, 1, 3])
    expect(packDynamicGridSpans([1, 1], 3)).toEqual([1, 2])
  })

  it('promotes adjacent wide items to full rows instead of leaving holes', () => {
    expect(packDynamicGridSpans([2, 2], 3)).toEqual([3, 3])
  })
})

describe('DynamicGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('measures one-line labels and promotes two span-two items to full-width rows', async () => {
    const clientWidth = (element: HTMLElement) => {
      if (element.dataset.dynamicGrid === 'true') return 320

      const cell = element.dataset.dynamicGridCell === 'true'
        ? element
        : element.closest<HTMLElement>('[data-dynamic-grid-cell="true"]')
      const span = Number(cell?.dataset.dynamicGridSpan ?? 1)
      const cellWidth = span * 100 + (span - 1) * 10

      if (element.dataset.dynamicGridCell === 'true') return cellWidth
      if (element.dataset.dynamicGridLabelContainer === 'true') return cellWidth - 20
      return 0
    }

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      return clientWidth(this)
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return Number(this.dataset.naturalWidth ?? 0)
    })

    render(
      <DynamicGrid ariaLabel="Measured links" columns={3}>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="60">First link</span>
            <span data-dynamic-grid-label="true" data-natural-width="120">First subtitle</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="120">Second link</span>
          </span>
        </button>
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Measured links' })
    await waitFor(() => {
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['3', '3'])
    })
  })
})
