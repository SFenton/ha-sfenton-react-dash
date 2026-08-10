import { useEffect, useMemo, useRef, useState } from 'react'
import { useHass } from '@hakit/core'
import { CardCarousel } from '../../core/CardCarousel'
import { responsiveDynamicGridColumnCount } from '../../core/dynamicGridLayout'
import { RecipeCard } from './RecipeCard'
import { normalizeRecipeRecommendationsEnvelope, recipeRecommendationServiceData, type RecipeCardSummary } from './recipeTypes'
import { callRecipeService } from './recipeService'
import styles from './SuggestedRecipeCarousel.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface SuggestedRecipeCarouselProps {
  onLoadStateChange?: (state: RecommendationLoadState) => void
  onOpenRecipe?: (recipe: RecipeCardSummary) => void
  preload?: boolean
}

export type RecommendationLoadState = 'error' | 'ready'

const RECOMMENDATION_PAGE_COUNT = 5
const MOBILE_RECOMMENDATION_ROWS = 3
const DESKTOP_RECOMMENDATION_ROWS = 2
const DESKTOP_CAROUSEL_MIN_WIDTH = 900
const RECOMMENDATION_CARD_MAX_WIDTH = 220
const RECOMMENDATION_MAX_COLUMNS = 10
const RECOMMENDATION_GRID_GAP = 10
const RECOMMENDATION_PAGE_HORIZONTAL_INSET = 48

interface RecommendationLayout {
  columns: number
  pageSize: number
  rows: number
  total: number
}

function recommendationLayout(viewportWidth: number): RecommendationLayout {
  const rows = viewportWidth >= DESKTOP_CAROUSEL_MIN_WIDTH
    ? DESKTOP_RECOMMENDATION_ROWS
    : MOBILE_RECOMMENDATION_ROWS
  const columns = responsiveDynamicGridColumnCount(
    Math.max(1, viewportWidth - RECOMMENDATION_PAGE_HORIZONTAL_INSET),
    RECOMMENDATION_GRID_GAP,
    2,
    RECOMMENDATION_CARD_MAX_WIDTH,
    RECOMMENDATION_MAX_COLUMNS,
  )
  const pageSize = columns * rows
  return {
    columns,
    pageSize,
    rows,
    total: pageSize * RECOMMENDATION_PAGE_COUNT,
  }
}

function layoutsMatch(left: RecommendationLayout, right: RecommendationLayout) {
  return left.columns === right.columns && left.rows === right.rows
}

function PlaceholderSlot({ index }: { index: number }) {
  return <div aria-hidden="true" className={styles.placeholder} data-recipe-placeholder={index + 1} />
}

export function SuggestedRecipeCarousel({ onLoadStateChange, onOpenRecipe = () => undefined, preload = false }: SuggestedRecipeCarouselProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const rootRef = useRef<HTMLDivElement>(null)
  const [recipes, setRecipes] = useState<RecipeCardSummary[]>([])
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>(preload ? 'ready' : 'loading')
  const [layout, setLayout] = useState(() => recommendationLayout(
    preload || typeof window === 'undefined' ? 393 : window.innerWidth,
  ))

  useEffect(() => {
    if (preload) return undefined
    const update = () => {
      const next = recommendationLayout(window.innerWidth)
      setLayout((current) => layoutsMatch(current, next) ? current : next)
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [preload])

  useEffect(() => {
    if (preload) return undefined
    let stale = false
    void callRecipeService(
      callService,
      'recipe_query',
      recipeRecommendationServiceData({ limit: layout.total }),
    ).then((result) => {
      if (stale) return
      setRecipes(normalizeRecipeRecommendationsEnvelope(result).items)
      setStatus('ready')
    }).catch(() => {
      if (stale) return
      setRecipes([])
      setStatus('error')
      onLoadStateChange?.('error')
    })
    return () => {
      stale = true
    }
  }, [callService, layout.total, onLoadStateChange, preload])

  useEffect(() => {
    if (preload || status !== 'ready') return undefined
    const root = rootRef.current
    if (!root) return undefined
    let reported = false
    let frame: number | null = null
    const check = () => {
      if (reported) return
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-recipe-card]'))
      if (cards.length < recipes.length) return
      const settled = cards.every((card) => {
        const image = card.querySelector('img')
        return image === null || (image.complete && image.naturalWidth > 0)
      })
      if (!settled) return
      reported = true
      onLoadStateChange?.('ready')
    }
    const scheduleCheck = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = null
        check()
      })
    }
    root.addEventListener('load', scheduleCheck, true)
    root.addEventListener('error', scheduleCheck, true)
    const observer = new MutationObserver(scheduleCheck)
    observer.observe(root, { childList: true, subtree: true })
    check()
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer.disconnect()
      root.removeEventListener('load', scheduleCheck, true)
      root.removeEventListener('error', scheduleCheck, true)
    }
  }, [onLoadStateChange, preload, recipes, status])

  const pages = useMemo(() => {
    const slots = Array.from({ length: layout.total }, (_, index) => {
      const recipe = preload ? undefined : recipes[index]
      return recipe
        ? <RecipeCard compact eager key={recipe.dedupeKey} onOpenRecipe={onOpenRecipe} recipe={recipe} />
        : <PlaceholderSlot index={index} key={`placeholder-${index}`} />
    })
    return Array.from({ length: RECOMMENDATION_PAGE_COUNT }, (_, pageIndex) => (
      slots.slice(pageIndex * layout.pageSize, (pageIndex + 1) * layout.pageSize)
    ))
  }, [layout.pageSize, layout.total, onOpenRecipe, preload, recipes])

  return (
    <div data-recommendation-status={status} ref={rootRef}>
      <CardCarousel ariaLabel="Suggested recipes" columns={layout.columns} pages={pages} />
      <span aria-live="polite" className={styles.status}>
        {status === 'error' ? 'Suggested recipes are temporarily unavailable.' : status === 'ready' && recipes.length > 0 ? `${recipes.length} suggested recipes loaded.` : ''}
      </span>
    </div>
  )
}
