import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { EmptyState } from '../components/core/EmptyState'
import { RecipeDetailModal } from '../components/hass/recipes/RecipeDetailModal'
import { RecipeGrid } from '../components/hass/recipes/RecipeGrid'
import { useRecipeCollection } from '../components/hass/recipes/useRecipeCollection'
import { useRecipeDetailModalController } from '../components/hass/recipes/useRecipeDetailModal'
import { DashboardPageLoadGate } from '../components/shell/DashboardPageLoadGate'
import type { RecipeControls } from '../components/hass/recipes/useRecipeControls'
import styles from './RecipesPage.module.css'

interface RecipesPageProps {
  controls: RecipeControls
  initiallyAppGated?: boolean
  onInitialResolved?: () => void
  preload?: boolean
}

type ResultsRegionStyle = CSSProperties & {
  '--recipe-results-frozen-height'?: string
}

export function RecipesPage({ controls, initiallyAppGated = false, onInitialResolved, preload = false }: RecipesPageProps) {
  const collection = useRecipeCollection(controls.criteria, { preload })
  const recipeDetail = useRecipeDetailModalController({ enabled: !preload })
  const regionRef = useRef<HTMLDivElement>(null)
  const previousPhaseRef = useRef(collection.criteriaPhase)
  const [frozenHeight, setFrozenHeight] = useState<number | null>(null)
  const [primedGeneration, setPrimedGeneration] = useState(preload ? 0 : -1)

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

  const viewportPrimed = collection.error !== null
    || collection.items.length === 0
    || primedGeneration >= collection.generation
  const pageReady = collection.initialResolved && viewportPrimed
  const handleViewportPrimed = useCallback(() => {
    setPrimedGeneration((current) => Math.max(current, collection.generation))
  }, [collection.generation])

  useEffect(() => {
    if (preload || !pageReady) return
    onInitialResolved?.()
  }, [onInitialResolved, pageReady, preload])

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

  const content = (
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
            autoLoadEnabled={collection.criteriaPhase === 'idle'}
            hasMore={collection.hasMore}
            items={collection.items}
            loadNextPage={collection.loadNextPage}
            nextPageError={collection.nextPageError}
            nextPageLoading={collection.nextPageLoading}
            nextPageRevision={collection.nextPageRevision}
            onOpenRecipe={recipeDetail.openRecipe}
            onViewportPrimed={handleViewportPrimed}
            primeViewport={!viewportPrimed}
            retryNextPage={collection.retryNextPage}
          />
        )}
      </div>
      <span aria-live="polite" className={styles.announcement}>{collection.announcement}</span>
      <span aria-hidden="true" data-results-transitioning={transitioning ? 'true' : undefined} />
    </section>
  )

  const contentWithModal = (
    <>
      {content}
      <RecipeDetailModal controller={recipeDetail} />
    </>
  )

  if (initiallyAppGated) return contentWithModal

  return (
    <DashboardPageLoadGate
      label="Loading Recipes"
      settled={pageReady}
    >
      {contentWithModal}
    </DashboardPageLoadGate>
  )
}
