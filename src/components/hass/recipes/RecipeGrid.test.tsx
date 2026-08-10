import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('adds desktop columns to keep recipe cards below the requested max width', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).dataset.dynamicGrid === 'true') return 1_408
        return 0
      },
    })

    try {
      const { container } = render(
        <RecipeGrid hasMore={false} items={cards(50)} loadNextPage={() => undefined} nextPageError={null} nextPageLoading={false} retryNextPage={() => undefined} />,
      )
      await waitFor(() => expect(container.querySelector('[data-recipe-grid="true"]')).toHaveAttribute('data-recipe-grid-columns', '7'))
      expect(container.querySelector('[data-dynamic-grid="true"]')).toHaveAttribute('data-dynamic-grid-columns', '7')
    } finally {
      if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
    }
  })

  it('loads page-sized batches until the sentinel starts beyond the preload boundary', async () => {
    const scroller = document.createElement('div')
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })
    scroller.getBoundingClientRect = () => ({ bottom: 1_000, height: 1_000, left: 0, right: 1_400, top: 0, width: 1_400, x: 0, y: 0, toJSON: () => ({}) })
    const scrollerRef = { current: scroller }
    const loadNextPage = vi.fn()
    const onViewportPrimed = vi.fn()
    let sentinelTop = 1_100
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.dataset.recipeGridSentinel === 'true') {
        return { bottom: sentinelTop + 1, height: 1, left: 0, right: 1_400, top: sentinelTop, width: 1_400, x: 0, y: sentinelTop, toJSON: () => ({}) }
      }
      return originalRect.call(this)
    }

    try {
      const { rerender } = render(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid
            autoLoadEnabled
            hasMore
            items={cards(50)}
            loadNextPage={loadNextPage}
            nextPageError={null}
            nextPageLoading={false}
            onViewportPrimed={onViewportPrimed}
            primeViewport
            retryNextPage={loadNextPage}
          />
        </PageScrollerContext.Provider>,
      )
      await waitFor(() => expect(loadNextPage).toHaveBeenCalledTimes(1))
      expect(onViewportPrimed).not.toHaveBeenCalled()

      rerender(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid autoLoadEnabled hasMore items={cards(50)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading onViewportPrimed={onViewportPrimed} primeViewport retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      rerender(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid autoLoadEnabled hasMore items={cards(100)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading={false} nextPageRevision={1} onViewportPrimed={onViewportPrimed} primeViewport retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      await waitFor(() => expect(loadNextPage).toHaveBeenCalledTimes(2))

      rerender(
        <PageScrollerContext.Provider value={{ current: scroller }}>
          <RecipeGrid autoLoadEnabled hasMore items={cards(100)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading nextPageRevision={1} onViewportPrimed={onViewportPrimed} primeViewport retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      sentinelTop = 1_600
      rerender(
        <PageScrollerContext.Provider value={{ current: scroller }}>
          <RecipeGrid autoLoadEnabled hasMore items={cards(150)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading={false} nextPageRevision={2} onViewportPrimed={onViewportPrimed} primeViewport retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      await waitFor(() => expect(onViewportPrimed).toHaveBeenCalledTimes(1))
      expect(loadNextPage).toHaveBeenCalledTimes(2)
    } finally {
      await act(async () => undefined)
      HTMLElement.prototype.getBoundingClientRect = originalRect
    }
  })

  it('requires the sentinel to leave and re-enter before another automatic page', async () => {
    const originalObserver = globalThis.IntersectionObserver
    let observerCallback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const scroller = document.createElement('div')
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })
    scroller.getBoundingClientRect = () => ({ bottom: 1_000, height: 1_000, left: 0, right: 1_400, top: 0, width: 1_400, x: 0, y: 0, toJSON: () => ({}) })
    const scrollerRef = { current: scroller }
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.dataset.recipeGridSentinel === 'true') {
        return { bottom: 1_101, height: 1, left: 0, right: 1_400, top: 1_100, width: 1_400, x: 0, y: 1_100, toJSON: () => ({}) }
      }
      return originalRect.call(this)
    }
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      disconnect() {}
      observe = observe
      takeRecords() { return [] }
      unobserve() {}
      root = null
      rootMargin = ''
      thresholds = []
    } as unknown as typeof IntersectionObserver
    const loadNextPage = vi.fn()
    const entry = (isIntersecting: boolean) => [{ isIntersecting } as IntersectionObserverEntry]

    try {
      const { rerender } = render(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid hasMore items={cards(100)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading={false} retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      await waitFor(() => expect(observe).toHaveBeenCalledTimes(1))
      act(() => observerCallback?.(entry(true), {} as IntersectionObserver))
      expect(loadNextPage).toHaveBeenCalledTimes(1)

      rerender(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid hasMore items={cards(100)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      act(() => observerCallback?.(entry(false), {} as IntersectionObserver))
      rerender(
        <PageScrollerContext.Provider value={scrollerRef}>
          <RecipeGrid hasMore items={cards(150)} loadNextPage={loadNextPage} nextPageError={null} nextPageLoading={false} nextPageRevision={1} retryNextPage={loadNextPage} />
        </PageScrollerContext.Provider>,
      )
      await act(async () => {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      })
      act(() => observerCallback?.(entry(true), {} as IntersectionObserver))
      expect(loadNextPage).toHaveBeenCalledTimes(1)

      act(() => observerCallback?.(entry(false), {} as IntersectionObserver))
      act(() => observerCallback?.(entry(true), {} as IntersectionObserver))
      expect(loadNextPage).toHaveBeenCalledTimes(2)
      expect(observe).toHaveBeenCalledTimes(1)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect
      globalThis.IntersectionObserver = originalObserver
    }
  })
})
