import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useHass } from '@hakit/core'
import { usePageScrollToTop } from '../../../hooks/usePageScroller'
import {
  appendUniqueRecipes,
  normalizeRecipeBrowseEnvelope,
  normalizeRecipeHydrationEnvelope,
  normalizeRecipeQuery,
  recipeBrowseServiceData,
  recipeCriteriaKey,
  recipeHydrationStartData,
  recipeMatchesCriteriaFilters,
  type RecipeBrowseCriteria,
  type RecipeCardSummary,
} from './recipeTypes'
import { callRecipeService } from './recipeService'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

export type RecipeCriteriaPhase = 'entering' | 'exiting' | 'idle' | 'loading' | 'spinner-exiting'
export type RecipeHydrationState = 'complete' | 'error' | 'idle' | 'loading' | 'polling' | 'waiting'

interface UseRecipeCollectionOptions {
  preload?: boolean
}

export interface RecipeCollection {
  announcement: string
  criteriaPhase: RecipeCriteriaPhase
  error: string | null
  generation: number
  hasMore: boolean
  hydrationState: RecipeHydrationState
  initialResolved: boolean
  items: RecipeCardSummary[]
  loadNextPage: () => void
  nextPageError: string | null
  nextPageLoading: boolean
  nextPageRevision: number
  retryCriteria: () => void
  retryNextPage: () => void
  total: number
}

const CRITERIA_CONTENT_EXIT_MS = 170
const CRITERIA_SPINNER_EXIT_MS = 140
const CRITERIA_CONTENT_ENTER_MS = 170
export const RECIPE_HYDRATION_SETTLE_MS = 600

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function hydrationComplete(status: string, exhausted: boolean) {
  return exhausted || ['complete', 'completed', 'done', 'exhausted'].includes(status.trim().toLowerCase())
}

export function useRecipeCollection(criteria: RecipeBrowseCriteria, { preload = false }: UseRecipeCollectionOptions = {}): RecipeCollection {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const scrollPageToTop = usePageScrollToTop()
  const criteriaKey = recipeCriteriaKey(criteria)
  const criteriaRef = useRef(criteria)
  const generationRef = useRef(0)
  const itemsRef = useRef<RecipeCardSummary[]>([])
  const hasMoreRef = useRef(false)
  const nextCursorRef = useRef<string | null>(null)
  const phaseRef = useRef<RecipeCriteriaPhase>('idle')
  const nextPageFlightRef = useRef<{ generation: number } | null>(null)
  const announcementSequenceRef = useRef(0)
  const [announcement, setAnnouncement] = useState('')
  const [criteriaPhase, setCriteriaPhase] = useState<RecipeCriteriaPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [hydrationState, setHydrationState] = useState<RecipeHydrationState>('idle')
  const [initialResolved, setInitialResolved] = useState(preload)
  const [items, setItems] = useState<RecipeCardSummary[]>([])
  const [nextPageError, setNextPageError] = useState<string | null>(null)
  const [nextPageLoading, setNextPageLoading] = useState(false)
  const [nextPageRevision, setNextPageRevision] = useState(0)
  const [retryNonce, setRetryNonce] = useState(0)
  const [total, setTotal] = useState(0)

  const announce = useCallback((message: string) => {
    announcementSequenceRef.current += 1
    setAnnouncement(`Update ${announcementSequenceRef.current}: ${message}`)
  }, [])

  const replaceItems = useCallback((nextItems: RecipeCardSummary[]) => {
    itemsRef.current = nextItems
    setItems(nextItems)
  }, [])

  const updateHasMore = useCallback((nextHasMore: boolean, nextCursor: string | null) => {
    const usableHasMore = nextHasMore && Boolean(nextCursor)
    hasMoreRef.current = usableHasMore
    nextCursorRef.current = usableHasMore ? nextCursor : null
    setHasMore(usableHasMore)
  }, [])

  useLayoutEffect(() => {
    if (preload) return undefined
    const activeGeneration = generationRef.current + 1
    generationRef.current = activeGeneration
    const previousCriteria = criteriaRef.current
    const resetScroll = previousCriteria.sort !== criteria.sort
      || previousCriteria.availabilityWeight !== criteria.availabilityWeight
      || previousCriteria.expiryWeight !== criteria.expiryWeight
      || previousCriteria.minimumCoverage !== criteria.minimumCoverage
      || previousCriteria.expiringWithinDays !== criteria.expiringWithinDays
      || previousCriteria.source !== criteria.source
      || previousCriteria.locale !== criteria.locale
    criteriaRef.current = criteria
    if (resetScroll) scrollPageToTop?.()
    setGeneration(activeGeneration)
    nextPageFlightRef.current = null
    setNextPageLoading(false)
    setNextPageRevision(0)
    setNextPageError(null)
    setHydrationState('idle')
    setError(null)

    let stale = false
    const timers = new Map<number, (current: boolean) => void>()
    const reducedMotion = prefersReducedMotion()
    const transitionDelay = (duration: number) => new Promise<boolean>((resolve) => {
      if (reducedMotion || duration === 0) {
        resolve(!stale && generationRef.current === activeGeneration)
        return
      }
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        resolve(!stale && generationRef.current === activeGeneration)
      }, duration)
      timers.set(timer, resolve)
    })
    const currentItemsVisible = itemsRef.current.length > 0 || total > 0 || error !== null
    const setPhase = (phase: RecipeCriteriaPhase) => {
      if (stale || generationRef.current !== activeGeneration) return
      phaseRef.current = phase
      setCriteriaPhase(phase)
    }

    setPhase(currentItemsVisible ? 'exiting' : 'loading')
    const request = Promise.resolve()
      .then(() => callRecipeService(
        callService,
        'recipe_query',
        recipeBrowseServiceData(criteria),
      ))
      .then(
        (value) => ({ ok: true as const, value }),
        (requestError: unknown) => ({ error: requestError, ok: false as const }),
      )

    void (async () => {
      if (currentItemsVisible) {
        if (!await transitionDelay(CRITERIA_CONTENT_EXIT_MS)) return
        setPhase('loading')
      }

      try {
        const outcome = await request
        if (stale || generationRef.current !== activeGeneration) return
        if (!outcome.ok) throw outcome.error
        const response = normalizeRecipeBrowseEnvelope(outcome.value)
        const unique = appendUniqueRecipes([], response.items).items
        setPhase('spinner-exiting')
        if (!await transitionDelay(CRITERIA_SPINNER_EXIT_MS)) return
        replaceItems(unique)
        updateHasMore(response.hasMore, response.nextCursor)
        setTotal(response.total)
        setError(null)
        setInitialResolved(true)
        announce(`${unique.length} recipes loaded.`)
      } catch (caughtError: unknown) {
        if (stale || generationRef.current !== activeGeneration) return
        setPhase('spinner-exiting')
        if (!await transitionDelay(CRITERIA_SPINNER_EXIT_MS)) return
        replaceItems([])
        updateHasMore(false, null)
        setTotal(0)
        setError(errorMessage(caughtError, 'Unable to load recipes'))
        setInitialResolved(true)
      }

      setPhase('entering')
      if (!await transitionDelay(CRITERIA_CONTENT_ENTER_MS)) return
      setPhase('idle')
    })()

    return () => {
      stale = true
      for (const [timer, resolve] of timers) {
        window.clearTimeout(timer)
        resolve(false)
      }
      timers.clear()
    }
  // `criteriaKey` intentionally represents every committed criterion without retriggering on object identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announce, callService, criteriaKey, preload, replaceItems, retryNonce, scrollPageToTop, updateHasMore])

  const loadNextPage = useCallback(() => {
    const activeGeneration = generationRef.current
    const cursor = nextCursorRef.current
    if (preload || phaseRef.current !== 'idle' || nextPageFlightRef.current || !hasMoreRef.current || !cursor) return

    const flight = { generation: activeGeneration }
    nextPageFlightRef.current = flight
    setNextPageLoading(true)
    setNextPageError(null)

    void callRecipeService(
      callService,
      'recipe_query',
      recipeBrowseServiceData(criteriaRef.current, cursor),
    ).then((result) => {
      if (generationRef.current !== activeGeneration || nextPageFlightRef.current !== flight) return
      const response = normalizeRecipeBrowseEnvelope(result)
      const merged = appendUniqueRecipes(itemsRef.current, response.items)
      if (merged.items !== itemsRef.current) replaceItems(merged.items)
      updateHasMore(response.hasMore, response.nextCursor)
      setTotal((current) => Math.max(current, response.total))
      announce(merged.added > 0
        ? `${merged.added} more recipes loaded; ${merged.items.length} total.`
        : 'No new recipes were added.')
    }).catch((caughtError: unknown) => {
      if (generationRef.current !== activeGeneration || nextPageFlightRef.current !== flight) return
      setNextPageError(errorMessage(caughtError, 'Unable to load more recipes'))
    }).finally(() => {
      if (generationRef.current !== activeGeneration || nextPageFlightRef.current !== flight) return
      nextPageFlightRef.current = null
      setNextPageRevision((current) => current + 1)
      setNextPageLoading(false)
    })
  }, [announce, callService, preload, replaceItems, updateHasMore])

  useEffect(() => {
    const query = normalizeRecipeQuery(criteria.q)
    if (preload || criteriaPhase !== 'idle' || error || query.length < 3) return undefined
    const activeGeneration = generationRef.current
    let stale = false
    let pollTimer: number | null = null
    queueMicrotask(() => {
      if (!stale && generationRef.current === activeGeneration) setHydrationState('waiting')
    })

    const appendHydratedItems = (incoming: RecipeCardSummary[]) => {
      const eligible = incoming.filter((recipe) => (
        recipeMatchesCriteriaFilters(recipe, criteriaRef.current)
      ))
      const merged = appendUniqueRecipes(itemsRef.current, eligible)
      if (merged.items !== itemsRef.current) replaceItems(merged.items)
      if (merged.added > 0) {
        announce(`${merged.added} more recipes hydrated; ${merged.items.length} total.`)
      }
    }

    const requestHydration = (serviceData: Record<string, unknown>, polling: boolean) => {
      if (stale || generationRef.current !== activeGeneration) return
      setHydrationState(polling ? 'polling' : 'loading')
      void callRecipeService(
        callService,
        'recipe_hydration',
        serviceData,
      ).then((result) => {
        if (stale || generationRef.current !== activeGeneration) return
        const response = normalizeRecipeHydrationEnvelope(result)
        appendHydratedItems(response.newItems)
        if (response.status.trim().toLowerCase() === 'failed') {
          setHydrationState('error')
          return
        }
        if (hydrationComplete(response.status, response.exhausted) || !response.searchId) {
          setHydrationState('complete')
          return
        }
        const nextPollMs = Math.max(0, Math.min(30_000, response.nextPollMs ?? 1_000))
        pollTimer = window.setTimeout(() => {
          pollTimer = null
          if (stale || generationRef.current !== activeGeneration) return
          requestHydration({ search_id: response.searchId }, true)
        }, nextPollMs)
      }).catch(() => {
        if (stale || generationRef.current !== activeGeneration) return
        setHydrationState('error')
      })
    }

    pollTimer = window.setTimeout(() => {
      pollTimer = null
      if (stale || generationRef.current !== activeGeneration) return
      requestHydration(recipeHydrationStartData(criteria), false)
    }, RECIPE_HYDRATION_SETTLE_MS)

    return () => {
      stale = true
      if (pollTimer !== null) window.clearTimeout(pollTimer)
    }
  // Hydration starts once after the committed generation reaches a painted idle phase.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announce, callService, criteriaKey, criteriaPhase, error, preload, replaceItems])

  return {
    announcement,
    criteriaPhase,
    error,
    generation,
    hasMore,
    hydrationState,
    initialResolved,
    items,
    loadNextPage,
    nextPageError,
    nextPageLoading,
    nextPageRevision,
    retryCriteria: () => setRetryNonce((current) => current + 1),
    retryNextPage: loadNextPage,
    total,
  }
}
