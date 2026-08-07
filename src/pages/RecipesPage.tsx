import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { EmptyState } from '../components/core/EmptyState'
import { RecipeGrid } from '../components/hass/recipes/RecipeGrid'
import { useRecipeCollection } from '../components/hass/recipes/useRecipeCollection'
import type { RecipeControls } from '../components/hass/recipes/useRecipeControls'
import styles from './RecipesPage.module.css'

interface RecipesPageProps {
  controls: RecipeControls
  preload?: boolean
}

type ResultsRegionStyle = CSSProperties & {
  '--recipe-results-frozen-height'?: string
}

export function RecipesPage({ controls, preload = false }: RecipesPageProps) {
  const collection = useRecipeCollection(controls.criteria, { preload })
  const regionRef = useRef<HTMLDivElement>(null)
  const previousPhaseRef = useRef(collection.criteriaPhase)
  const [frozenHeight, setFrozenHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (preload) return
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = collection.criteriaPhase
    if (collection.criteriaPhase === 'exiting' && previousPhase === 'idle') {
      const region = regionRef.current
      const measuredHeight = Math.ceil(region?.getBoundingClientRect().height ?? 0)
      setFrozenHeight(Math.max(180, measuredHeight))
      return
    }
    if (collection.criteriaPhase === 'idle') setFrozenHeight(null)
  }, [collection.criteriaPhase, preload])

  const transitioning = collection.criteriaPhase !== 'idle'
  const showGrid = collection.criteriaPhase === 'idle' || collection.criteriaPhase === 'entering' || collection.criteriaPhase === 'exiting'
  const showSpinner = collection.criteriaPhase === 'loading' || collection.criteriaPhase === 'spinner-exiting'
  const regionStyle: ResultsRegionStyle | undefined = frozenHeight === null ? undefined : {
    '--recipe-results-frozen-height': `${frozenHeight}px`,
  }

  if (preload) {
    return (
      <div aria-hidden="true" className={styles.preloadGrid} data-recipes-preload="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
      </div>
    )
  }

  return (
    <section
      aria-label="Recipes"
      className={styles.page}
      data-generation={collection.generation}
      data-hydration-state={collection.hydrationState}
    >
      <div
        className={styles.resultsRegion}
        data-criteria-phase={collection.criteriaPhase}
        data-height-frozen={frozenHeight === null ? undefined : 'true'}
        ref={regionRef}
        style={regionStyle}
      >
        {showSpinner && (
          <div aria-label="Loading recipes" className={styles.criteriaLoading} role="status">
            <span aria-hidden="true" className={styles.spinner} />
          </div>
        )}
        {showGrid && collection.error && (
          <div className={styles.errorState}>
            <EmptyState description={collection.error} title="Unable to Load Recipes" />
            <button onClick={collection.retryCriteria} type="button">Retry</button>
          </div>
        )}
        {showGrid && !collection.error && collection.items.length === 0 && collection.criteriaPhase !== 'exiting' && (
          <EmptyState
            description={controls.criteria.q.trim() ? 'Try a different search or loosen the recipe filters.' : 'No recipes matched the current filters.'}
            title="No Recipes Found"
          />
        )}
        {showGrid && !collection.error && collection.items.length > 0 && (
          <RecipeGrid
            hasMore={collection.hasMore}
            items={collection.items}
            loadNextPage={collection.loadNextPage}
            nextPageError={collection.nextPageError}
            nextPageLoading={collection.nextPageLoading}
            retryNextPage={collection.retryNextPage}
          />
        )}
      </div>
      <span aria-live="polite" className={styles.announcement}>{collection.announcement}</span>
      <span aria-hidden="true" data-results-transitioning={transitioning ? 'true' : undefined} />
    </section>
  )
}
