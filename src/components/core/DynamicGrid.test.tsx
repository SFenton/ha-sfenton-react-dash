// @covers src/components/core/dynamicGridLayout.ts
import { act, render, screen, waitFor } from '@testing-library/react'
import { DynamicGrid } from './DynamicGrid'
import { centeredDynamicGridStarts, packDynamicGridSpans, responsiveDynamicGridColumnCount, uniformDynamicGridColumnCount } from './dynamicGridLayout'

describe('text-aware leading-row fill', () => {
  it('gives spare tracks to narrower tiles and leaves the final row at its minimum', () => {
    expect(packDynamicGridSpans([1, 2, 2, 1, 1, 2], 4, 'except-last')).toEqual([2, 2, 2, 1, 1, 2])
    expect(packDynamicGridSpans([2, 1, 2], 4, 'except-last')).toEqual([2, 2, 2])
    expect(packDynamicGridSpans([2, 2], 3, 'except-last')).toEqual([3, 2])
    expect(packDynamicGridSpans([1, 1, 2, 2, 1], 3, 'except-last')).toEqual([1, 2, 3, 2, 1])
  })

  it('does not inflate a final-only row or reorder uneven rows', () => {
    expect(packDynamicGridSpans([1, 2], 4, 'except-last')).toEqual([1, 2])
    expect(packDynamicGridSpans([1, 1, 1, 1, 1], 4, 'except-last')).toEqual([1, 1, 1, 1, 1])
    expect(packDynamicGridSpans([], 4, 'except-last')).toEqual([])
  })
})

describe('packDynamicGridSpans', () => {
  it('fills partial and final rows without changing item order', () => {
    expect(packDynamicGridSpans([1, 1, 1, 1], 3)).toEqual([1, 1, 1, 3])
    expect(packDynamicGridSpans([2, 1, 2], 3)).toEqual([2, 1, 3])
    expect(packDynamicGridSpans([1, 1], 3)).toEqual([1, 2])
  })

  describe('centeredDynamicGridStarts', () => {
    it('centers only the final partial row without changing item order', () => {
      expect(centeredDynamicGridStarts([1, 1, 1, 1, 1], 4)).toEqual([0, 0, 0, 0, 2])
      expect(centeredDynamicGridStarts([2, 1, 1, 1], 4)).toEqual([0, 0, 0, 2])
      expect(centeredDynamicGridStarts([1, 1, 1, 1], 4)).toEqual([0, 0, 0, 0])
    })
  })

  it('promotes adjacent wide items to full rows instead of leaving holes', () => {
    expect(packDynamicGridSpans([2, 2], 3)).toEqual([3, 3])
  })
})

describe('uniformDynamicGridColumnCount', () => {
  it('reduces one column at a time until every item fits', () => {
    expect(uniformDynamicGridColumnCount([240, 220], 1_000, 10, 4)).toBe(4)
    expect(uniformDynamicGridColumnCount([260, 220], 1_000, 10, 4)).toBe(3)
    expect(uniformDynamicGridColumnCount([400, 220], 1_000, 10, 4)).toBe(2)
    expect(uniformDynamicGridColumnCount([700, 220], 1_000, 10, 4)).toBe(1)
  })

  describe('responsiveDynamicGridColumnCount', () => {
    it('adds columns until cards fit the requested maximum width', () => {
      expect(responsiveDynamicGridColumnCount(361, 12, 2, 220, 10)).toBe(2)
      expect(responsiveDynamicGridColumnCount(1_408, 12, 2, 220, 10)).toBe(7)
      expect(responsiveDynamicGridColumnCount(4_000, 12, 2, 220, 10)).toBe(10)
    })
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

  it('measures horizontal title and value groups as one intrinsic row', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.dynamicGrid === 'true') return 320
      if (this.dataset.dynamicGridCell === 'true') return 100
      if (this.dataset.dynamicGridLabelContainer === 'true') return 80
      return 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return Number(this.dataset.naturalContainerWidth ?? this.dataset.naturalWidth ?? 0)
    })

    render(
      <DynamicGrid ariaLabel="Camera links" columns={3} fillRows={false}>
        <button type="button">
          <span data-dynamic-grid-label-container="true" data-natural-container-width="180">
            <span data-dynamic-grid-label="true" data-natural-width="100">Front Door</span>
            <span data-dynamic-grid-label="true" data-natural-width="70">Streaming</span>
          </span>
        </button>
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Camera links' })
    await waitFor(() => {
      expect(grid.firstElementChild).toHaveAttribute('data-dynamic-grid-span', '2')
    })
  })

  it('reduces uniform grids recursively while keeping every item one track wide', async () => {
    let gridWidth = 1_000
    const gap = 10
    const clientWidth = (element: HTMLElement) => {
      if (element.dataset.dynamicGrid === 'true') return gridWidth

      const cell = element.dataset.dynamicGridCell === 'true'
        ? element
        : element.closest<HTMLElement>('[data-dynamic-grid-cell="true"]')
      const grid = cell?.closest<HTMLElement>('[data-dynamic-grid="true"]')
      const columns = Number(grid?.dataset.dynamicGridColumns ?? 4)
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

    const items = [200, 200, 280, 200].map((naturalWidth, index) => (
      <button key={naturalWidth + index} type="button">
        <span data-dynamic-grid-label-container="true">
          <span data-dynamic-grid-label="true" data-natural-width={naturalWidth}>Link {index + 1}</span>
        </span>
      </button>
    ))
    render(
      <DynamicGrid ariaLabel="Uniform links" columns={4} fillRows={false} itemSizing="uniform">
        {items}
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Uniform links' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-available-columns', '4')
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '3')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '1', '1'])
    })

    gridWidth = 500
    act(() => window.dispatchEvent(new Event('resize')))
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '1')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '1', '1'])
    })
  })

  it('keeps fixed grids on stable tracks when marked labels change', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.dynamicGrid === 'true') return 370
      if (this.dataset.dynamicGridCell === 'true') return 180
      if (this.dataset.dynamicGridLabelContainer === 'true') return 112
      return 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return Number(this.dataset.naturalWidth ?? 0)
    })

    const renderGrid = (state: string) => (
      <DynamicGrid ariaLabel="Stable live tiles" columns={2} fillRows={false} itemSizing="fixed">
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="260">Security System</span>
            <span data-dynamic-grid-label="true" data-natural-width="200">{state}</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="240">Front Door</span>
            <span data-dynamic-grid-label="true" data-natural-width="180">Locked</span>
          </span>
        </button>
      </DynamicGrid>
    )
    const view = render(renderGrid('Loading'))
    const grid = screen.getByRole('group', { name: 'Stable live tiles' })

    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'fixed')
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '2')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1'])
    })

    view.rerender(renderGrid('Live'))
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '2')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1'])
    })
  })

  it('wraps only after a uniform grid reaches one column', async () => {
    const gridWidth = 210
    const clientWidth = (element: HTMLElement) => {
      if (element.dataset.dynamicGrid === 'true') return gridWidth
      const cellWidth = gridWidth
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
      <DynamicGrid ariaLabel="Uniform links" columns={2} fillRows={false} itemSizing="uniform">
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="300">A very long first link</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="40">Short</span>
          </span>
        </button>
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Uniform links' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'uniform')
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '1')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1'])
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-wrap'))).toEqual(['true', null])
    })
  })

  it('keeps the bounded grid width while uniform text reduces its column count', async () => {
    const gridWidth = 1_408
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.querySelector?.('[data-dynamic-grid="true"]')) return gridWidth
      if (this.dataset.dynamicGrid === 'true') return 1_156
      if (this.dataset.dynamicGridCell === 'true') return 280
      if (this.dataset.dynamicGridLabelContainer === 'true') return 260
      return 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return Number(this.dataset.naturalWidth ?? 0)
    })

    render(
      <DynamicGrid
        ariaLabel="Bounded uniform links"
        columns={2}
        fillRows={false}
        gap={12}
        itemSizing="uniform"
        layout="bounded"
        maxCellWidth={280}
        maxColumns={4}
      >
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="300">A very long first link</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="40">Short</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="40">Third</span>
          </span>
        </button>
        <button type="button">
          <span data-dynamic-grid-label-container="true">
            <span data-dynamic-grid-label="true" data-natural-width="40">Fourth</span>
          </span>
        </button>
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Bounded uniform links' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'uniform')
      expect(grid).toHaveAttribute('data-dynamic-grid-available-columns', '4')
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '3')
      expect(grid.style.getPropertyValue('--dynamic-grid-max-width')).toBe('1156px')
    })
  })

  it('inserts responsive columns without stretching cards past a requested max width', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.dynamicGrid === 'true') return 1_408
      return 0
    })

    render(
      <DynamicGrid
        ariaLabel="Responsive recipes"
        columns={2}
        fillRows={false}
        gap={12}
        maxCellWidth={220}
        maxColumns={10}
      >
        {Array.from({ length: 14 }, (_, index) => <div key={index}>Recipe {index + 1}</div>)}
      </DynamicGrid>,
    )

    const grid = screen.getByRole('group', { name: 'Responsive recipes' })
    await waitFor(() => expect(grid).toHaveAttribute('data-dynamic-grid-columns', '7'))
    expect(Array.from(grid.children).every((cell) => cell.getAttribute('data-dynamic-grid-span') === '1')).toBe(true)
    expect(grid.style.getPropertyValue('--dynamic-grid-rendered-columns')).toBe('7')
  })

  it('keeps bounded grids mobile-compatible and stops filling rows after expansion', async () => {
    let availableWidth = 361
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.dynamicGrid === 'true') return availableWidth
      if (this.querySelector?.('[data-dynamic-grid="true"]')) return availableWidth
      return 0
    })

    const view = render(
      <div>
        <DynamicGrid
          ariaLabel="Bounded controls"
          columns={2}
          lastRow="fill-minimum"
          layout="bounded"
          maxCellWidth={320}
          maxColumns={4}
        >
          <button type="button">Only control</button>
        </DynamicGrid>
      </div>,
    )

    const grid = screen.getByRole('group', { name: 'Bounded controls' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '2')
      expect(grid.firstElementChild).toHaveAttribute('data-dynamic-grid-span', '2')
      expect(grid.style.getPropertyValue('--dynamic-grid-max-width')).toBe('')
    })

    availableWidth = 1_408
    act(() => window.dispatchEvent(new Event('resize')))
    view.rerender(
      <div>
        <DynamicGrid
          ariaLabel="Bounded controls"
          columns={2}
          lastRow="fill-minimum"
          layout="bounded"
          maxCellWidth={320}
          maxColumns={4}
        >
          <button type="button">Only control</button>
        </DynamicGrid>
      </div>,
    )

    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '1')
      expect(grid.firstElementChild).toHaveAttribute('data-dynamic-grid-span', '1')
      expect(grid.style.getPropertyValue('--dynamic-grid-max-width')).toBe('320px')
    })
  })

  it('fills expanded intermediate rows without shrinking measured content spans', async () => {
    const availableWidth = 800
    const labelContainerWidth = 240
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.dynamicGrid === 'true') return availableWidth
      if (this.querySelector?.('[data-dynamic-grid="true"]')) return availableWidth
      if (this.dataset.dynamicGridLabelContainer === 'true') return labelContainerWidth
      return 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return Number(this.dataset.naturalContainerWidth ?? this.dataset.naturalWidth ?? 0)
    })

    const items = [100, 100, 300, 300, 100].map((naturalWidth, index) => (
      <button key={`${naturalWidth}-${index}`} type="button">
        <span data-dynamic-grid-label-container="true" data-natural-container-width={naturalWidth}>
          <span data-dynamic-grid-label="true" data-natural-width={naturalWidth}>Link {index + 1}</span>
        </span>
      </button>
    ))
    const view = render(
      <div>
        <DynamicGrid
          ariaLabel="Expanded links"
          columns={2}
          lastRow="fill-minimum"
          layout="bounded"
          maxCellWidth={300}
          maxColumns={3}
        >
          {items}
        </DynamicGrid>
      </div>,
    )

    const grid = screen.getByRole('group', { name: 'Expanded links' })
    await waitFor(() => {
      expect(grid).toHaveAttribute('data-dynamic-grid-columns', '3')
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '2', '3', '2', '1'])
    })

    view.rerender(
      <div>
        <DynamicGrid
          ariaLabel="Expanded links"
          columns={2}
          fillRows={false}
          lastRow="fill-minimum"
          layout="bounded"
          maxCellWidth={300}
          maxColumns={3}
        >
          {items}
        </DynamicGrid>
      </div>,
    )

    await waitFor(() => {
      expect(Array.from(grid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '2', '2', '1'])
    })
  })
})
