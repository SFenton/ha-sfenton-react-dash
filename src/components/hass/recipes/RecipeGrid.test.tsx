import { fireEvent, render, screen } from '@testing-library/react'
import { PageScrollerContext } from '../../../hooks/usePageScroller'
import type { RecipeCardSummary } from './recipeTypes'
import { RecipeGrid } from './RecipeGrid'

function cards(count: number): RecipeCardSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    dedupeKey: `recipe:${index + 1}`,
    title: `Recipe ${index + 1}`,
    imageUrl: null,
    thumbnailUrl: null,
    source: 'Test',
    sourceUrl: null,
    coverage: 80,
    matchedRequired: 8,
    requiredTotal: 10,
    expiryScore: 4,
    soonestExpiryDays: null,
    score: 90,
    cookable: true,
  }))
}

describe('RecipeGrid', () => {
  it('reserves a centered spinner row and accessible Load More fallback', () => {
    const loadNextPage = vi.fn()
    const { rerender } = render(
      <RecipeGrid hasMore items={cards(50)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading={false} retryNextPage={loadNextPage} />,
    )

    expect(screen.getByRole('button', { name: 'Load More' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load More' }))
    expect(loadNextPage).toHaveBeenCalledTimes(1)

    rerender(<RecipeGrid hasMore items={cards(50)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading retryNextPage={loadNextPage} />)
    expect(screen.getByRole('status', { name: 'Loading more recipes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loading More' })).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Loading more recipes' }).parentElement).toHaveClass(/nextPageRow/)
  })

  it('windows fixed-height rows after 300 cards using top and bottom spacers', () => {
    const scroller = document.createElement('div')
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 700 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })
    const scrollerRef = { current: scroller }

    const { container } = render(
      <PageScrollerContext.Provider value={scrollerRef}>
        <RecipeGrid hasMore={false} items={cards(350)} loadNextPage={() => undefined} nextPageError={null} nextPageLoading={false} retryNextPage={() => undefined} />
      </PageScrollerContext.Provider>,
    )

    const grid = container.querySelector('[data-recipe-grid="true"]')
    expect(grid).toHaveAttribute('data-windowed', 'true')
    expect(grid).toHaveAttribute('data-window-start', '0')
    expect(container.querySelector('[data-window-spacer="bottom"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-recipe-card]').length).toBeLessThan(350)
  })

  it('waits for explicit Retry instead of observing a failed next page', () => {
    const originalObserver = globalThis.IntersectionObserver
    const observe = vi.fn()
    globalThis.IntersectionObserver = class {
      disconnect() {}
      observe = observe
      takeRecords() { return [] }
      unobserve() {}
      root = null
      rootMargin = ''
      thresholds = []
    } as unknown as typeof IntersectionObserver
    const scrollerRef = { current: document.createElement('div') }

    try {
      render(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid
            hasMore
            items={cards(50)}
            loadNextPage={vi.fn()}
            nextPageError="Page failed"
            nextPageLoading={false}
            retryNextPage={vi.fn()}
          />
        </PageScrollerContext.Provider>,
      )
      expect(observe).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    } finally {
      globalThis.IntersectionObserver = originalObserver
    }
  })
})
