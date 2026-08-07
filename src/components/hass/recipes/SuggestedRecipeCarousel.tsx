import { useEffect, useMemo, useState } from 'react'
import { useHass } from '@hakit/core'
import { CardCarousel } from '../../core/CardCarousel'
import { RecipeCard } from './RecipeCard'
import { normalizeRecipeRecommendationsEnvelope, recipeRecommendationServiceData, type RecipeCardSummary } from './recipeTypes'
import { callRecipeService } from './recipeService'
import styles from './SuggestedRecipeCarousel.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface SuggestedRecipeCarouselProps {
  preload?: boolean
}

const RECOMMENDATION_PAGE_COUNT = 5
const RECOMMENDATIONS_PER_PAGE = 6
const RECOMMENDATION_SLOT_COUNT = RECOMMENDATION_PAGE_COUNT * RECOMMENDATIONS_PER_PAGE
const DESKTOP_RECOMMENDATIONS_PER_PAGE = 10
const DESKTOP_CAROUSEL_QUERY = '(min-width: 900px)'

function PlaceholderSlot({ index }: { index: number }) {
  return <div aria-hidden="true" className={styles.placeholder} data-recipe-placeholder={index + 1} />
}

export function SuggestedRecipeCarousel({ preload = false }: SuggestedRecipeCarouselProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [recipes, setRecipes] = useState<RecipeCardSummary[]>([])
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>(preload ? 'ready' : 'loading')
  const [desktop, setDesktop] = useState(() => (
    !preload
    && typeof window.matchMedia === 'function'
    && window.matchMedia(DESKTOP_CAROUSEL_QUERY).matches
  ))

  useEffect(() => {
    if (preload || typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(DESKTOP_CAROUSEL_QUERY)
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [preload])

  useEffect(() => {
    if (preload) return undefined
    let stale = false
    void callRecipeService(
      callService,
      'recipe_query',
      recipeRecommendationServiceData(),
    ).then((result) => {
      if (stale) return
      setRecipes(normalizeRecipeRecommendationsEnvelope(result).items)
      setStatus('ready')
    }).catch(() => {
      if (stale) return
      setRecipes([])
      setStatus('error')
    })
    return () => {
      stale = true
    }
  }, [callService, preload])

  const pages = useMemo(() => {
    const slots = Array.from({ length: RECOMMENDATION_SLOT_COUNT }, (_, index) => {
      const recipe = preload ? undefined : recipes[index]
      return recipe
        ? <RecipeCard compact eager={index < RECOMMENDATIONS_PER_PAGE} key={recipe.dedupeKey} recipe={recipe} />
        : <PlaceholderSlot index={index} key={`placeholder-${index}`} />
    })
    const pageSize = desktop ? DESKTOP_RECOMMENDATIONS_PER_PAGE : RECOMMENDATIONS_PER_PAGE
    return Array.from({ length: Math.ceil(RECOMMENDATION_SLOT_COUNT / pageSize) }, (_, pageIndex) => (
      slots.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
    ))
  }, [desktop, preload, recipes])

  return (
    <div data-recommendation-status={status}>
      <CardCarousel ariaLabel="Suggested recipes" columns={desktop ? 5 : 2} pages={pages} />
      <span aria-live="polite" className={styles.status}>
        {status === 'error' ? 'Suggested recipes are temporarily unavailable.' : status === 'ready' && recipes.length > 0 ? `${recipes.length} suggested recipes loaded.` : ''}
      </span>
    </div>
  )
}
