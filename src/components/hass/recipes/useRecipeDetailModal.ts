import { useCallback, useEffect, useRef, useState } from 'react'
import { useHass } from '@hakit/core'
import { MODAL_SHEET_EXIT_ANIMATION_MS } from '../../core/ModalSheet'
import {
  normalizeRecipeDetailServiceResult,
  normalizeRecipeGroceryServiceResult,
  recipeDetailServiceData,
  recipeGroceryServiceData,
  type RecipeCardSummary,
  type RecipeDetail,
  type RecipeGroceryResult,
} from './recipeTypes'
import { callRecipeService, recipeServiceErrorIsUnavailable } from './recipeService'
import { recipeDetailIdempotencyKey } from './recipeDetailFormatting'
import {
  RECIPE_GROCERY_MAX_SELECTIONS,
  RECIPE_GROCERY_UNSUPPORTED_MESSAGE,
  recipeGroceryDisabledReason,
} from './recipeGroceryState'
import type { RecipeDetailTab } from '../../../constants/surfaceSemantics'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

type DetailLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; detail: RecipeDetail; session: number }
  | { status: 'error' | 'unsupported'; message: string }

type GroceryState =
  | { status: 'idle' | 'loading' }
  | { status: 'error' | 'success'; message: string }

export interface RecipeDetailModalController {
  activeTab: RecipeDetailTab
  addMissingIngredients: () => void
  close: () => void
  detailState: DetailLoadState
  groceryState: GroceryState
  grocerySubmitted: boolean
  open: boolean
  openRecipe: (recipe: RecipeCardSummary) => void
  selectedRecipe: RecipeCardSummary | null
  setActiveTab: (tab: RecipeDetailTab) => void
}

const RECIPE_DETAIL_UNSUPPORTED = 'The installed EverShelf/ha-evershelf version does not support recipe details yet. Recipe cards remain available.'
const MODAL_STATE_CLEAR_DELAY_MS = MODAL_SHEET_EXIT_ANIMATION_MS + 20

function caughtMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  return fallback
}

function groceryFeedback(result: RecipeGroceryResult) {
  const backendParts = [
    result.backend.added > 0 ? `${result.backend.added} added` : '',
    result.backend.alreadyListed > 0 ? `${result.backend.alreadyListed} already listed` : '',
    result.backend.nowInStock > 0 ? `${result.backend.nowInStock} now in stock` : '',
    result.backend.unresolved > 0 ? `${result.backend.unresolved} unresolved` : '',
    result.backend.failed > 0 ? `${result.backend.failed} failed` : '',
  ].filter(Boolean)
  const backendText = backendParts.length > 0
    ? `EverShelf: ${backendParts.join(', ')}.`
    : 'EverShelf: no grocery changes.'
  const success = result.success
    && !result.outcomesTruncated
    && result.backend.failed === 0
    && result.backend.unresolved === 0
    && (result.haMirror?.failed ?? 0) === 0
  const backendFailure = result.backend.failed > 0
    || result.backend.unresolved > 0
    || result.outcomesTruncated
    || Boolean(result.backendMessage)
  const mirrorFailure = (result.haMirror?.failed ?? 0) > 0
    || Boolean(result.haMirrorMessage)
  const backendNotes = [
    !result.success && backendFailure ? 'EverShelf did not report service success.' : '',
    result.outcomesTruncated ? 'EverShelf outcome details were truncated.' : '',
    result.backendMessage ? `EverShelf message: ${result.backendMessage}` : '',
  ].filter(Boolean)
  const mirrorNotes = [
    !result.success && mirrorFailure ? 'Home Assistant mirror did not report service success.' : '',
    result.haMirrorMessage ? `Home Assistant mirror message: ${result.haMirrorMessage}` : '',
  ].filter(Boolean)
  const aggregateNote = !result.success && !backendFailure && !mirrorFailure
    ? 'Recipe grocery service did not report complete success.'
    : ''

  if (!result.haMirror) {
    return {
      success,
      message: [
        backendText,
        ...backendNotes,
        'Home Assistant mirror: unavailable in the development fallback.',
        aggregateNote,
      ].filter(Boolean).join(' '),
    }
  }

  const mirrorParts = [
    result.haMirror.added > 0 ? `${result.haMirror.added} added` : '',
    result.haMirror.alreadyPresent > 0 ? `${result.haMirror.alreadyPresent} already present` : '',
    result.haMirror.skipped > 0 ? `${result.haMirror.skipped} skipped` : '',
    result.haMirror.failed > 0 ? `${result.haMirror.failed} failed` : '',
  ].filter(Boolean)
  const mirrorText = mirrorParts.length > 0
    ? `Home Assistant mirror: ${mirrorParts.join(', ')}.`
    : 'Home Assistant mirror: no grocery changes.'
  return {
    success,
    message: [
      backendText,
      ...backendNotes,
      mirrorText,
      ...mirrorNotes,
      aggregateNote,
    ].filter(Boolean).join(' '),
  }
}

export function useRecipeDetailModalController({ enabled = true }: { enabled?: boolean } = {}): RecipeDetailModalController {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeCardSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RecipeDetailTab>('general')
  const [detailState, setDetailState] = useState<DetailLoadState>({ status: 'idle' })
  const [groceryState, setGroceryState] = useState<GroceryState>({ status: 'idle' })
  const [grocerySubmitted, setGrocerySubmitted] = useState(false)
  const clearTimerRef = useRef<number | null>(null)
  const modalSessionRef = useRef(0)
  const groceryCommandKeyRef = useRef<string | null>(null)
  const groceryInFlightRef = useRef(false)
  const groceryRequestRef = useRef(0)
  const grocerySubmittedRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = null
  }, [])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  const openRecipe = useCallback((recipe: RecipeCardSummary) => {
    if (!enabled) return
    clearCloseTimer()
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    modalSessionRef.current += 1
    groceryRequestRef.current += 1
    groceryCommandKeyRef.current = null
    groceryInFlightRef.current = false
    grocerySubmittedRef.current = false
    setSelectedRecipe({ ...recipe })
    setActiveTab('general')
    setDetailState({ status: 'loading' })
    setGroceryState({ status: 'idle' })
    setGrocerySubmitted(false)
    setOpen(true)
  }, [clearCloseTimer, enabled])

  const close = useCallback(() => {
    const returnFocus = returnFocusRef.current
    setOpen(false)
    clearCloseTimer()
    modalSessionRef.current += 1
    groceryRequestRef.current += 1
    groceryCommandKeyRef.current = null
    groceryInFlightRef.current = false
    grocerySubmittedRef.current = false
    clearTimerRef.current = window.setTimeout(() => {
      setSelectedRecipe(null)
      setDetailState({ status: 'idle' })
      setGroceryState({ status: 'idle' })
      setGrocerySubmitted(false)
      setActiveTab('general')
      if (returnFocus?.isConnected && returnFocusRef.current === returnFocus) {
        returnFocus.focus({ preventScroll: true })
      }
      returnFocusRef.current = null
      clearTimerRef.current = null
    }, MODAL_STATE_CLEAR_DELAY_MS)
  }, [clearCloseTimer])

  useEffect(() => {
    if (!enabled || !open || !selectedRecipe) return undefined
    let stale = false
    const modalSession = modalSessionRef.current
    void callRecipeService(
      callService,
      'recipe_detail',
      recipeDetailServiceData(selectedRecipe.id),
    ).then((result) => {
      if (stale || modalSession !== modalSessionRef.current) return
      const normalized = normalizeRecipeDetailServiceResult(result)
      if (normalized.kind === 'detail') {
        setDetailState(normalized.detail.id === selectedRecipe.id
          ? { status: 'ready', detail: normalized.detail, session: modalSession }
          : { status: 'error', message: 'EverShelf returned details for a different recipe.' })
        return
      }
      setDetailState({
        status: normalized.kind,
        message: normalized.kind === 'unsupported' ? RECIPE_DETAIL_UNSUPPORTED : normalized.message,
      })
    }).catch((error: unknown) => {
      if (stale || modalSession !== modalSessionRef.current) return
      const unsupported = recipeServiceErrorIsUnavailable(error, 'recipe_detail')
      setDetailState({
        status: unsupported ? 'unsupported' : 'error',
        message: unsupported ? RECIPE_DETAIL_UNSUPPORTED : caughtMessage(error, 'Unable to load recipe details.'),
      })
    })
    return () => {
      stale = true
    }
  }, [callService, enabled, open, selectedRecipe])

  const addMissingIngredients = useCallback(() => {
    if (
      groceryInFlightRef.current
      || grocerySubmittedRef.current
      || detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
    ) return
    if (recipeGroceryDisabledReason(detailState.detail, 'idle', false)) return
    const missing = detailState.detail.ingredients.filter((ingredient) => ingredient.inventory.state === 'missing')
    if (missing.length === 0 || missing.length > RECIPE_GROCERY_MAX_SELECTIONS) return

    groceryInFlightRef.current = true
    const groceryRequest = ++groceryRequestRef.current
    const idempotencyKey = groceryCommandKeyRef.current
      ?? recipeDetailIdempotencyKey(detailState.detail.id)
    groceryCommandKeyRef.current = idempotencyKey
    setGroceryState({ status: 'loading' })
    void callRecipeService(
      callService,
      'recipe_grocery_add',
      recipeGroceryServiceData(
        detailState.detail.id,
        missing.map(({ key, position }) => ({ key, position })),
        idempotencyKey,
      ),
    ).then((result) => {
      if (groceryRequest !== groceryRequestRef.current) return
      const normalized = normalizeRecipeGroceryServiceResult(result)
      if (normalized.kind !== 'result') {
        setGroceryState({
          status: 'error',
          message: normalized.kind === 'unsupported' ? RECIPE_GROCERY_UNSUPPORTED_MESSAGE : normalized.message,
        })
        return
      }
      if (normalized.backend.failed > 0 || normalized.backend.unresolved > 0) {
        groceryCommandKeyRef.current = null
      }
      const feedback = groceryFeedback(normalized)
      if (feedback.success) {
        grocerySubmittedRef.current = true
        groceryCommandKeyRef.current = null
      }
      setGroceryState({ status: feedback.success ? 'success' : 'error', message: feedback.message })
      setGrocerySubmitted(feedback.success)
    }).catch((error: unknown) => {
      if (groceryRequest !== groceryRequestRef.current) return
      setGroceryState({
        status: 'error',
        message: recipeServiceErrorIsUnavailable(error, 'recipe_grocery_add')
          ? RECIPE_GROCERY_UNSUPPORTED_MESSAGE
          : caughtMessage(error, 'Unable to add missing ingredients to groceries.'),
      })
    }).finally(() => {
      if (groceryRequest === groceryRequestRef.current) groceryInFlightRef.current = false
    })
  }, [callService, detailState])

  return {
    activeTab,
    addMissingIngredients,
    close,
    detailState,
    groceryState,
    grocerySubmitted,
    open,
    openRecipe,
    selectedRecipe,
    setActiveTab,
  }
}
