import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePageScroller } from '../../../hooks/usePageScroller'
import { RecipeCard } from './RecipeCard'
import type { RecipeCardSummary } from './recipeTypes'
import styles from './RecipeGrid.module.css'

export const RECIPE_WINDOW_THRESHOLD = 300
const RECIPE_WINDOW_OVERSCAN_ROWS = 4
const RECIPE_WINDOW_FALLBACK_VIEWPORT_PX = 852
const RECIPE_GRID_COLUMN_GAP_PX = 10
const RECIPE_GRID_ROW_GAP_PX = 12
const RECIPE_CARD_ASPECT_HEIGHT_RATIO = 0.78
const RECIPE_CARD_METADATA_HEIGHT_PX = 56

interface RecipeGridProps {
  hasMore: boolean
  items: RecipeCardSummary[]
  loadNextPage: () => void
  nextPageError: string | null
  nextPageLoading: boolean
  preload?: boolean
  retryNextPage: () => void
}

interface WindowRange {
  endRow: number
  rowHeight: number
  startRow: number
}

function measuredRowHeight(gridWidth: number) {
  const cardWidth = Math.max(1, (gridWidth - RECIPE_GRID_COLUMN_GAP_PX) / 2)
  return (cardWidth * RECIPE_CARD_ASPECT_HEIGHT_RATIO) + RECIPE_CARD_METADATA_HEIGHT_PX + RECIPE_GRID_ROW_GAP_PX
}

export function RecipeGrid({ hasMore, items, loadNextPage, nextPageError, nextPageLoading, preload = false, retryNextPage }: RecipeGridProps) {
  const pageScroller = usePageScroller()
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const windowed = items.length > RECIPE_WINDOW_THRESHOLD
  const totalRows = Math.ceil(items.length / 2)
  const [windowRange, setWindowRange] = useState<WindowRange>({
    endRow: Math.min(totalRows, 10),
    rowHeight: 148,
    startRow: 0,
  })

  useEffect(() => {
    if (preload || !hasMore || nextPageLoading || nextPageError) return undefined
    const root = pageScroller?.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextPage()
    }, {
      root,
      rootMargin: '0px 0px 240px 0px',
      threshold: 0,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadNextPage, nextPageError, nextPageLoading, pageScroller, preload])

  useLayoutEffect(() => {
    if (preload || !windowed) return undefined
    const root = pageScroller?.current
    const grid = gridRef.current
    if (!root || !grid) return undefined

    const updateWindow = () => {
      const rowHeight = measuredRowHeight(grid.clientWidth || 361)
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
  }, [pageScroller, preload, totalRows, windowed])

  const visible = useMemo(() => {
    if (!windowed) return { endIndex: items.length, items, startIndex: 0 }
    const startIndex = windowRange.startRow * 2
    const endIndex = Math.min(items.length, windowRange.endRow * 2)
    return { endIndex, items: items.slice(startIndex, endIndex), startIndex }
  }, [items, windowRange.endRow, windowRange.startRow, windowed])

  const topSpacerHeight = windowed ? windowRange.startRow * windowRange.rowHeight : 0
  const bottomSpacerHeight = windowed ? Math.max(0, (totalRows - windowRange.endRow) * windowRange.rowHeight) : 0

  return (
    <div className={styles.collection}>
      <div
        aria-label="Recipe results"
        className={styles.grid}
        data-recipe-grid="true"
        data-window-end={windowed ? visible.endIndex : undefined}
        data-window-start={windowed ? visible.startIndex : undefined}
        data-windowed={windowed ? 'true' : 'false'}
        ref={gridRef}
        role="list"
      >
        {topSpacerHeight > 0 && <div aria-hidden="true" className={styles.spacer} data-window-spacer="top" style={{ height: topSpacerHeight }} />}
        {visible.items.map((recipe, visibleIndex) => {
          const absoluteIndex = visible.startIndex + visibleIndex
          return <RecipeCard eager={absoluteIndex < 6} key={recipe.dedupeKey} recipe={recipe} />
        })}
        {bottomSpacerHeight > 0 && <div aria-hidden="true" className={styles.spacer} data-window-spacer="bottom" style={{ height: bottomSpacerHeight }} />}
      </div>
      <div aria-hidden="true" className={styles.sentinel} ref={sentinelRef} />
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
