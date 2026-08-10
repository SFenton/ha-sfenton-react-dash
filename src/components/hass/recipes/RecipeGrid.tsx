import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DynamicGrid } from '../../core/DynamicGrid'
import { usePageScroller } from '../../../hooks/usePageScroller'
import { RecipeCard } from './RecipeCard'
import type { RecipeCardSummary } from './recipeTypes'
import styles from './RecipeGrid.module.css'

export const RECIPE_AUTOLOAD_ROOT_MARGIN_PX = 240
export const RECIPE_WINDOW_THRESHOLD = 300
const RECIPE_WINDOW_OVERSCAN_ROWS = 4
const RECIPE_WINDOW_FALLBACK_VIEWPORT_PX = 852
const RECIPE_GRID_GAP_PX = 12
const RECIPE_CARD_MAX_WIDTH_PX = 220
const RECIPE_GRID_MAX_COLUMNS = 10
const RECIPE_CARD_ASPECT_HEIGHT_RATIO = 0.78

interface RecipeGridProps {
  autoLoadEnabled?: boolean
  hasMore: boolean
  items: RecipeCardSummary[]
  loadNextPage: () => void
  nextPageError: string | null
  nextPageLoading: boolean
  nextPageRevision?: number
  onOpenRecipe?: (recipe: RecipeCardSummary) => void
  onViewportPrimed?: () => void
  preload?: boolean
  primeViewport?: boolean
  retryNextPage: () => void
}

interface WindowRange {
  endRow: number
  rowHeight: number
  startRow: number
}

function measuredRowHeight(gridWidth: number, columns: number) {
  const cardWidth = Math.max(
    1,
    (gridWidth - RECIPE_GRID_GAP_PX * (columns - 1)) / columns,
  )
  return (cardWidth * RECIPE_CARD_ASPECT_HEIGHT_RATIO) + RECIPE_GRID_GAP_PX
}

function sentinelWithinPreloadBoundary(root: HTMLElement, sentinel: HTMLElement) {
  const rootRect = root.getBoundingClientRect()
  const viewportHeight = root.clientHeight || rootRect.height
  if (viewportHeight <= 0) return false
  const sentinelOffset = sentinel.getBoundingClientRect().top - rootRect.top + root.scrollTop
  const preloadBoundary = root.scrollTop + viewportHeight + RECIPE_AUTOLOAD_ROOT_MARGIN_PX
  return sentinelOffset <= preloadBoundary + 1
}

export function RecipeGrid({ autoLoadEnabled = true, hasMore, items, loadNextPage, nextPageError, nextPageLoading, nextPageRevision = 0, onOpenRecipe = () => undefined, onViewportPrimed, preload = false, primeViewport = false, retryNextPage }: RecipeGridProps) {
  const pageScroller = usePageScroller()
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const autoLoadArmedRef = useRef(true)
  const autoLoadRequestPendingRef = useRef(false)
  const nextPageLoadingRef = useRef(nextPageLoading)
  const primeRequestPendingRef = useRef(false)
  const windowed = items.length > RECIPE_WINDOW_THRESHOLD
  const [gridColumns, setGridColumns] = useState(2)
  const totalRows = Math.ceil(items.length / gridColumns)
  const [windowRange, setWindowRange] = useState<WindowRange>({
    endRow: Math.min(totalRows, 10),
    rowHeight: 148,
    startRow: 0,
  })

  useEffect(() => {
    if (preload || !autoLoadEnabled || primeViewport || !hasMore || nextPageError) return undefined
    const root = pageScroller?.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      const intersects = entries.some((entry) => entry.isIntersecting)
      if (!intersects) {
        if (!autoLoadRequestPendingRef.current) autoLoadArmedRef.current = true
        return
      }
      if (!autoLoadArmedRef.current || autoLoadRequestPendingRef.current || nextPageLoadingRef.current) return
      autoLoadArmedRef.current = false
      autoLoadRequestPendingRef.current = true
      loadNextPage()
    }, {
      root,
      rootMargin: `0px 0px ${RECIPE_AUTOLOAD_ROOT_MARGIN_PX}px 0px`,
      threshold: 0,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [autoLoadEnabled, hasMore, loadNextPage, nextPageError, pageScroller, preload, primeViewport])

  useLayoutEffect(() => {
    nextPageLoadingRef.current = nextPageLoading
  }, [nextPageLoading])

  useLayoutEffect(() => {
    if (nextPageRevision === 0) {
      autoLoadArmedRef.current = true
      autoLoadRequestPendingRef.current = false
      return undefined
    }
    if (preload || primeViewport) return undefined
    const root = pageScroller?.current
    const sentinel = sentinelRef.current
    autoLoadRequestPendingRef.current = false
    if (!root || !sentinel) {
      autoLoadArmedRef.current = true
      return undefined
    }

    const frame = window.requestAnimationFrame(() => {
      autoLoadArmedRef.current = !sentinelWithinPreloadBoundary(root, sentinel)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [nextPageRevision, pageScroller, preload, primeViewport])

  useEffect(() => {
    primeRequestPendingRef.current = false
  }, [nextPageRevision])

  useLayoutEffect(() => {
    if (preload || !primeViewport || !autoLoadEnabled || nextPageLoading) return undefined
    const root = pageScroller?.current
    const grid = gridRef.current
    const sentinel = sentinelRef.current
    if (!root || !grid || !sentinel) {
      onViewportPrimed?.()
      return undefined
    }
    let frame: number | null = null

    const evaluate = () => {
      frame = null
      if (nextPageError || !hasMore) {
        onViewportPrimed?.()
        return
      }
      if (sentinelWithinPreloadBoundary(root, sentinel)) {
        if (!primeRequestPendingRef.current) {
          primeRequestPendingRef.current = true
          loadNextPage()
        }
        return
      }

      onViewportPrimed?.()
    }
    const schedule = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(evaluate)
    }

    schedule()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(root)
    observer?.observe(grid)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [autoLoadEnabled, gridColumns, hasMore, items.length, loadNextPage, nextPageError, nextPageLoading, nextPageRevision, onViewportPrimed, pageScroller, preload, primeViewport])

  useLayoutEffect(() => {
    if (preload || !windowed) return undefined
    const root = pageScroller?.current
    const grid = gridRef.current
    if (!root || !grid) return undefined

    const updateWindow = () => {
      const rowHeight = measuredRowHeight(grid.clientWidth || 361, gridColumns)
      const gridTop = grid.getBoundingClientRect().top
        - root.getBoundingClientRect().top
        + root.scrollTop
      const relativeScrollTop = Math.max(0, root.scrollTop - gridTop)
      const viewportHeight = root.clientHeight || RECIPE_WINDOW_FALLBACK_VIEWPORT_PX
      const startRow = Math.max(0, Math.floor(relativeScrollTop / rowHeight) - RECIPE_WINDOW_OVERSCAN_ROWS)
      const endRow = Math.min(totalRows, Math.ceil((relativeScrollTop + viewportHeight) / rowHeight) + RECIPE_WINDOW_OVERSCAN_ROWS)
      setWindowRange((current) => (
        current.startRow === startRow && current.endRow === endRow && Math.abs(current.rowHeight - rowHeight) < 0.5
          ? current
          : { endRow, rowHeight, startRow }
      ))
    }

    updateWindow()
    root.addEventListener('scroll', updateWindow, { passive: true })
    window.addEventListener('resize', updateWindow)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateWindow)
    observer?.observe(grid)
    return () => {
      observer?.disconnect()
      root.removeEventListener('scroll', updateWindow)
      window.removeEventListener('resize', updateWindow)
    }
  }, [gridColumns, pageScroller, preload, totalRows, windowed])

  const visible = useMemo(() => {
    if (!windowed) return { endIndex: items.length, items, startIndex: 0 }
    const startIndex = windowRange.startRow * gridColumns
    const endIndex = Math.min(items.length, windowRange.endRow * gridColumns)
    return { endIndex, items: items.slice(startIndex, endIndex), startIndex }
  }, [gridColumns, items, windowRange.endRow, windowRange.startRow, windowed])

  const topSpacerHeight = windowed ? windowRange.startRow * windowRange.rowHeight : 0
  const bottomSpacerHeight = windowed ? Math.max(0, (totalRows - windowRange.endRow) * windowRange.rowHeight) : 0

  return (
    <div className={styles.collection}>
      <div
        data-recipe-grid="true"
        data-recipe-grid-columns={gridColumns}
        data-window-end={windowed ? visible.endIndex : undefined}
        data-window-start={windowed ? visible.startIndex : undefined}
        data-windowed={windowed ? 'true' : 'false'}
        ref={gridRef}
      >
        {topSpacerHeight > 0 && <div aria-hidden="true" className={styles.spacer} data-window-spacer="top" style={{ height: topSpacerHeight }} />}
        <DynamicGrid
          ariaLabel="Recipe results"
          columns={2}
          fillRows={false}
          gap={RECIPE_GRID_GAP_PX}
          maxCellWidth={RECIPE_CARD_MAX_WIDTH_PX}
          maxColumns={RECIPE_GRID_MAX_COLUMNS}
          onColumnsChange={setGridColumns}
          role="list"
        >
          {visible.items.map((recipe, visibleIndex) => {
            const absoluteIndex = visible.startIndex + visibleIndex
            return (
              <RecipeCard
                eager={absoluteIndex < Math.max(6, gridColumns * 2)}
                key={recipe.dedupeKey}
                onOpenRecipe={onOpenRecipe}
                recipe={recipe}
              />
            )
          })}
        </DynamicGrid>
        {bottomSpacerHeight > 0 && <div aria-hidden="true" className={styles.spacer} data-window-spacer="bottom" style={{ height: bottomSpacerHeight }} />}
      </div>
      <div aria-hidden="true" className={styles.sentinel} data-recipe-grid-sentinel="true" ref={sentinelRef} />
      {(hasMore || nextPageLoading || nextPageError) && (
        <div className={styles.nextPageRow} data-loading={nextPageLoading ? 'true' : undefined}>
          {nextPageLoading && (
            <span aria-label="Loading more recipes" className={styles.nextPageStatus} role="status">
              <span aria-hidden="true" className={styles.spinner} />
            </span>
          )}
        </div>
      )}
      {nextPageError && (
        <div className={styles.pageError} role="alert">
          <span>{nextPageError}</span>
          <button onClick={retryNextPage} type="button">Retry</button>
        </div>
      )}
      {hasMore && !nextPageError && (
        <button className={styles.loadMore} disabled={nextPageLoading} onClick={loadNextPage} type="button">
          {nextPageLoading ? 'Loading More' : 'Load More'}
        </button>
      )}
    </div>
  )
}
