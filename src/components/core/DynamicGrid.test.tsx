import { render, screen, waitFor } from '@testing-library/react'
import { DynamicGrid } from './DynamicGrid'
import { equivalentDynamicGridColumnCount, packDynamicGridSpans } from './dynamicGridLayout'

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

describe('equivalentDynamicGridColumnCount', () => {
  it('uses the widest item to choose one shared column count', () => {
    expect(equivalentDynamicGridColumnCount([1, 1, 1], 3)).toBe(3)
    expect(equivalentDynamicGridColumnCount([1, 2, 1], 4)).toBe(2)
    expect(equivalentDynamicGridColumnCount([1, 2, 1], 2)).toBe(1)
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

  it('forces every item into the same measured column count when requested', async () => {
    const gridWidth = 210
    const gap = 10
    const clientWidth = (element: HTMLElement) => {
      if (element.dataset.dynamicGrid === 'true') return gridWidth

      const cell = element.dataset.dynamicGridCell === 'true'
        ? element
        : element.closest<HTMLElement>('[data-dynamic-grid-cell="true"]')
      const grid = cell?.closest<HTMLElement>('[data-dynamic-grid="true"]')
      const columns = Number(grid?.dataset.dynamicGridColumns ?? 2)
      const span = Number(cell?.dataset.dynamicGridSpan ?? 1)
      const columnWidth = (gridWidth - gap * (columns - 1)) / columns
      const cellWidth = span * columnWidth + (span - 1) * gap

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

    const items = [60, 60, 130, 60].map((naturalWidth, index) => (
      <button key={naturalWidth + index} type="button">
        <span data-dynamic-grid-label-container="true">
          <span data-dynamic-grid-label="true" data-natural-width={naturalWidth}>Link {index + 1}</span>
        </span>
      </button>
    ))
    const { rerender } = render(
      <DynamicGrid ariaLabel="Equivalent links" columns={2}>
        {items}
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Equivalent links' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '2')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '2', '2'])
    })

    rerender(
      <DynamicGrid ariaLabel="Equivalent links" columns={2} forceEquivalentColumnCount>
        {items}
      </DynamicGrid>,
    )

    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '1')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '1', '1'])
    })
  })
})
