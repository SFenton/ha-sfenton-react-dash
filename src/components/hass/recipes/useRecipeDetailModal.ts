import { useCallback, useEffect, useRef, useState } from 'react'
import { useHass } from '@hakit/core'
import { MODAL_SHEET_EXIT_ANIMATION_MS } from '../../core/ModalSheet'
import {
  normalizeRecipeDetailServiceResult,
  normalizeRecipeGroceryServiceResult,
  recipeDetailServiceData,
  recipeGroceryServiceData,
  recipeIdentityFeedbackServiceData,
  recipeIngredientDecisionServiceData,
  recipeIngredientOverrideServiceData,
  recipePlannerServiceData,
  recipeServiceResponse,
  type RecipeCardSummary,
  type RecipeDetail,
  type RecipeDetailIngredient,
  type RecipeGroceryMirrorOutcome,
  type RecipeGroceryResult,
  type RecipeIngredientIdentityVerdict,
  type RecipeIngredientFeedbackTarget,
  type RecipeIngredientDecisionAction,
} from './recipeTypes'
import { callRecipeService, recipeServiceErrorIsUnavailable } from './recipeService'
import { recipeDetailIdempotencyKey } from './recipeDetailFormatting'
import {
  RECIPE_GROCERY_MAX_SELECTIONS,
  RECIPE_GROCERY_TODO_ENTITY_ID,
  RECIPE_GROCERY_UNSUPPORTED_MESSAGE,
  findMatchingGroceryTodoItem,
  recipeActionableMissingIngredients,
  recipeGroceryCapabilityBlockedReason,
  recipeGroceryDisabledReason,
  recipeIngredientIsGroceryEligible,
  type RecipeGroceryTodoItem,
} from './recipeGroceryState'
import type { RecipeDetailTab } from '../../../constants/surfaceSemantics'
import { useEverShelfInventoryControls } from '../EverShelfInventoryControls'
import { useCopy } from '../../../i18n/useCopy'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface HassConnection {
  sendMessagePromise?: <T>(message: Record<string, unknown>) => Promise<T>
}

type DetailLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; detail: RecipeDetail; session: number }
  | { status: 'error' | 'unsupported'; message: string }

type GroceryState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; completedAt: number; message: string }

type IngredientPickerLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: RecipeInventoryProduct[] }

type PlannerState =
  | { status: 'idle' | 'loading' }
  | { status: 'error' | 'success'; message: string }

export interface RecipeInventoryProduct {
  id: number
  name: string
  quantity: number | null
  unit: string | null
}

export interface RecipeDetailModalController {
  activeTab: RecipeDetailTab
  addedIngredientKeys: ReadonlySet<string>
  addIndividualIngredient: (ingredient: RecipeDetailIngredient) => void
  addMissingIngredients: () => void
  close: () => void
  detailState: DetailLoadState
  groceryState: GroceryState
  grocerySubmitted: boolean
  individualGroceryErrors: ReadonlyMap<string, string>
  individualGroceryPendingKeys: ReadonlySet<string>
  ingredientFeedbackMessage: string | null
  ingredientFeedbackPending: ReadonlySet<string>
  ingredientPickerIngredient: RecipeDetailIngredient | null
  ingredientPickerLoadState: IngredientPickerLoadState
  ingredientPickerQuery: string
  individualGroceryRemovingKeys: ReadonlySet<string>
  open: boolean
  openRecipe: (recipe: RecipeCardSummary) => void
  openIngredientPicker: (ingredient: RecipeDetailIngredient) => void
  cancelIngredientPicker: () => void
  assumeIngredientHave: () => void
  selectIngredientProduct: (product: RecipeInventoryProduct) => void
  rejectIngredientMatch: (ingredient: RecipeDetailIngredient) => void
  setIngredientPickerQuery: (query: string) => void
  cycleIngredientOverride: (ingredient: RecipeDetailIngredient) => void
  clearIngredientOverride: (ingredient: RecipeDetailIngredient) => void
  recordIdentityFeedback: (
    ingredient: RecipeDetailIngredient,
    verdict: RecipeIngredientIdentityVerdict,
    targetKind: RecipeIngredientFeedbackTarget,
  ) => void
  removeIndividualIngredient: (ingredientKey: string) => void
  selectedRecipe: RecipeCardSummary | null
  setActiveTab: (tab: RecipeDetailTab) => void
  plannerOpen: boolean
  plannerDate: string
  plannerState: PlannerState
  openPlanner: () => void
  cancelPlanner: () => void
  setPlannerDate: (value: string) => void
  submitPlanner: () => void
}

const RECIPE_DETAIL_UNSUPPORTED = 'The installed EverShelf/ha-evershelf version does not support recipe details yet. Recipe cards remain available.'
const MODAL_STATE_CLEAR_DELAY_MS = MODAL_SHEET_EXIT_ANIMATION_MS + 20
const RECIPE_I18N = { namespace: 'modalRecipe' } as const
const RECIPE_CONTROLLER_COPY_KEYS = {
  decisionAssumeSaved: 'decisionAssumeSaved',
  decisionRejectSaved: 'decisionRejectSaved',
  decisionSaveError: 'decisionSaveError',
  decisionSelectSaved: 'decisionSelectSaved',
  inventoryPickerSearchError: 'inventoryPickerSearchError',
  plannerAdded: 'plannerAdded',
  plannerAlreadyPresent: 'plannerAlreadyPresent',
  plannerError: 'plannerError',
} as const

function caughtMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  return fallback
}

function feedbackFailure(result: unknown) {
  const response = recipeServiceResponse(result)
  if (!response || typeof response !== 'object' || !('success' in response) || response.success !== false) {
    return null
  }
  const code = 'error' in response ? String(response.error ?? '') : ''
  const message = 'message' in response
    ? String(response.message ?? '')
    : code
  return { code, message: message || 'Recipe feedback request failed.' }
}

function feedbackErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code ?? '')
  }
  return ''
}

function feedbackRequestError(code: string, message: string) {
  const error = new Error(message) as Error & { code?: string }
  error.code = code
  return error
}

function inventoryPickerProducts(result: unknown, query: string): RecipeInventoryProduct[] {
  const response = recipeServiceResponse(result)
  if (!response || typeof response !== 'object') return []
  const rawItems = 'inventory' in response && Array.isArray(response.inventory)
    ? response.inventory
    : []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const products = new Map<number, RecipeInventoryProduct>()
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue
    const record = rawItem as Record<string, unknown>
    const id = Number(record.product_id)
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const quantityValue = Number(record.quantity)
    const quantity = Number.isFinite(quantityValue) ? quantityValue : null
    if (!Number.isFinite(id) || id <= 0 || !name || (quantity !== null && quantity <= 0)) continue
    if (normalizedQuery && !name.toLocaleLowerCase().includes(normalizedQuery)) {
      const responseSearch = typeof (response as { search?: unknown }).search === 'string'
        ? (response as { search: string }).search.trim()
        : ''
      if (responseSearch !== query.trim()) continue
    }
    const existing = products.get(id)
    if (existing) {
      products.set(id, {
        ...existing,
        quantity: existing.quantity === null || quantity === null
          ? existing.quantity ?? quantity
          : existing.quantity + quantity,
      })
      continue
    }
    products.set(id, {
      id,
      name,
      quantity,
      unit: typeof record.unit === 'string' && record.unit.trim()
        ? record.unit.trim()
        : null,
    })
  }
  return [...products.values()].sort((left, right) => (
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      || left.id - right.id
  ))
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

function successfulGroceryMirrors(
  result: RecipeGroceryResult,
  ingredients: readonly RecipeDetailIngredient[],
) {
  const ingredientByKey = new Map(ingredients.map((ingredient) => [ingredient.key, ingredient]))
  const successfulOutcomes = result.haMirrorOutcomes.filter(
    (outcome): outcome is RecipeGroceryMirrorOutcome => (
      outcome.outcome === 'added' || outcome.outcome === 'already_present'
    ),
  )
  if (successfulOutcomes.length > 0) {
    return successfulOutcomes.flatMap((outcome) => (
      ingredientByKey.has(outcome.key) ? [[outcome.key, outcome.name] as const] : []
    ))
  }
  if (!groceryFeedback(result).success) return []
  return ingredients.map((ingredient) => [ingredient.key, ingredient.displayName] as const)
}

export function useRecipeDetailModalController({ enabled = true }: { enabled?: boolean } = {}): RecipeDetailModalController {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const connection = useHass((state) => state.connection) as unknown as HassConnection | undefined
  const copy = useCopy(RECIPE_I18N.namespace)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeCardSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RecipeDetailTab>('general')
  const [detailState, setDetailState] = useState<DetailLoadState>({ status: 'idle' })
  const [groceryState, setGroceryState] = useState<GroceryState>({ status: 'idle' })
  const [grocerySubmitted, setGrocerySubmitted] = useState(false)
  const [addedIngredientKeys, setAddedIngredientKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [addedIngredientTodoNames, setAddedIngredientTodoNames] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [individualGroceryPendingKeys, setIndividualGroceryPendingKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [individualGroceryRemovingKeys, setIndividualGroceryRemovingKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [individualGroceryErrors, setIndividualGroceryErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [ingredientFeedbackMessage, setIngredientFeedbackMessage] = useState<string | null>(null)
  const [ingredientFeedbackPending, setIngredientFeedbackPending] = useState<ReadonlySet<string>>(() => new Set())
  const [ingredientPickerIngredient, setIngredientPickerIngredient] = useState<RecipeDetailIngredient | null>(null)
  const [ingredientPickerLoadState, setIngredientPickerLoadState] = useState<IngredientPickerLoadState>({ status: 'idle' })
  const ingredientPickerControls = useEverShelfInventoryControls(
    'recipe-ingredient-picker',
    Boolean(open && ingredientPickerIngredient),
  )
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [plannerDate, setPlannerDateState] = useState('')
  const [plannerState, setPlannerState] = useState<PlannerState>({ status: 'idle' })
  const [detailReloadKey, setDetailReloadKey] = useState(0)
  const clearTimerRef = useRef<number | null>(null)
  const modalSessionRef = useRef(0)
  const groceryCommandKeyRef = useRef<string | null>(null)
  const grocerySelectionFingerprintRef = useRef<string | null>(null)
  const groceryInFlightRef = useRef(false)
  const groceryRequestRef = useRef(0)
  const grocerySubmittedRef = useRef(false)
  const individualGroceryRequestRef = useRef<Map<string, number>>(new Map())
  const individualGroceryCommandKeysRef = useRef<Map<string, string>>(new Map())
  const individualGroceryRemoveRequestRef = useRef<Map<string, number>>(new Map())
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const feedbackCommandKeysRef = useRef<Map<string, string>>(new Map())
  const ingredientPickerRequestRef = useRef(0)
  const ingredientPickerRawQueryRef = useRef('')
  const plannerCommandKeyRef = useRef<string | null>(null)
  const plannerFingerprintRef = useRef<string | null>(null)

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
    grocerySelectionFingerprintRef.current = null
    groceryInFlightRef.current = false
    grocerySubmittedRef.current = false
    individualGroceryRequestRef.current.clear()
    individualGroceryCommandKeysRef.current.clear()
    individualGroceryRemoveRequestRef.current.clear()
    setSelectedRecipe({ ...recipe })
    setActiveTab('general')
    setDetailState({ status: 'loading' })
    setGroceryState({ status: 'idle' })
    setGrocerySubmitted(false)
    setAddedIngredientKeys(new Set())
    setAddedIngredientTodoNames(new Map())
    setIndividualGroceryPendingKeys(new Set())
    setIndividualGroceryRemovingKeys(new Set())
    setIndividualGroceryErrors(new Map())
    setIngredientFeedbackMessage(null)
    setIngredientFeedbackPending(new Set())
    setIngredientPickerIngredient(null)
    setIngredientPickerLoadState({ status: 'idle' })
    ingredientPickerControls.setSearchQuery('')
    ingredientPickerRequestRef.current += 1
    setPlannerOpen(false)
    setPlannerDateState('')
    setPlannerState({ status: 'idle' })
    plannerCommandKeyRef.current = null
    plannerFingerprintRef.current = null
    feedbackCommandKeysRef.current.clear()
    setOpen(true)
  }, [clearCloseTimer, enabled, ingredientPickerControls])

  const close = useCallback(() => {
    const returnFocus = returnFocusRef.current
    setOpen(false)
    clearCloseTimer()
    modalSessionRef.current += 1
    groceryRequestRef.current += 1
    groceryCommandKeyRef.current = null
    grocerySelectionFingerprintRef.current = null
    groceryInFlightRef.current = false
    grocerySubmittedRef.current = false
    individualGroceryRequestRef.current.clear()
    individualGroceryCommandKeysRef.current.clear()
    individualGroceryRemoveRequestRef.current.clear()
    ingredientPickerRequestRef.current += 1
    setIngredientPickerIngredient(null)
    setIngredientPickerLoadState({ status: 'idle' })
    ingredientPickerControls.setSearchQuery('')
    setPlannerOpen(false)
    setPlannerState({ status: 'idle' })
    plannerCommandKeyRef.current = null
    plannerFingerprintRef.current = null
    clearTimerRef.current = window.setTimeout(() => {
      setSelectedRecipe(null)
      setDetailState({ status: 'idle' })
      setGroceryState({ status: 'idle' })
      setGrocerySubmitted(false)
      setAddedIngredientKeys(new Set())
      setAddedIngredientTodoNames(new Map())
      setIndividualGroceryPendingKeys(new Set())
      setIndividualGroceryRemovingKeys(new Set())
      setIndividualGroceryErrors(new Map())
      setIngredientFeedbackMessage(null)
      setIngredientFeedbackPending(new Set())
      setIngredientPickerIngredient(null)
      setIngredientPickerLoadState({ status: 'idle' })
      ingredientPickerControls.setSearchQuery('')
      setPlannerOpen(false)
      setPlannerDateState('')
      setPlannerState({ status: 'idle' })
      feedbackCommandKeysRef.current.clear()
      setActiveTab('general')
      if (returnFocus?.isConnected && returnFocusRef.current === returnFocus) {
        returnFocus.focus({ preventScroll: true })
      }
      returnFocusRef.current = null
      clearTimerRef.current = null
    }, MODAL_STATE_CLEAR_DELAY_MS)
  }, [clearCloseTimer, ingredientPickerControls])

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
  }, [callService, detailReloadKey, enabled, open, selectedRecipe])

  useEffect(() => {
    ingredientPickerRawQueryRef.current = ingredientPickerControls.searchQuery.trim()
  }, [ingredientPickerControls.searchQuery])

  useEffect(() => {
    if (!open || !ingredientPickerIngredient) return undefined
    const requestId = ingredientPickerRequestRef.current + 1
    ingredientPickerRequestRef.current = requestId
    const modalSession = modalSessionRef.current
    const ingredientKey = ingredientPickerIngredient.key
    const query = ingredientPickerControls.debouncedSearchQuery.trim()
    let cancelled = false
    queueMicrotask(() => {
      if (
        !cancelled
        && requestId === ingredientPickerRequestRef.current
      ) {
        setIngredientPickerLoadState({ status: 'loading' })
      }
    })
    void Promise.resolve(callService({
      domain: 'evershelf',
      service: 'list_inventory',
      serviceData: query ? { q: query } : {},
      returnResponse: true,
    })).then((result) => {
      if (
        cancelled
        || requestId !== ingredientPickerRequestRef.current
        || modalSession !== modalSessionRef.current
        || ingredientPickerRawQueryRef.current !== query
      ) return
      setIngredientPickerLoadState({
        status: 'ready',
        items: inventoryPickerProducts(result, query),
      })
    }).catch((error: unknown) => {
      if (
        cancelled
        || requestId !== ingredientPickerRequestRef.current
        || modalSession !== modalSessionRef.current
      ) return
      setIngredientPickerLoadState({
        status: 'error',
        message: caughtMessage(error, copy(RECIPE_CONTROLLER_COPY_KEYS.inventoryPickerSearchError)),
      })
    })
    return () => {
      cancelled = true
      if (
        ingredientPickerIngredient.key === ingredientKey
        && requestId === ingredientPickerRequestRef.current
      ) {
        ingredientPickerRequestRef.current += 1
      }
    }
  }, [
    callService,
    copy,
    ingredientPickerControls.debouncedSearchQuery,
    ingredientPickerIngredient,
    open,
  ])

  const updateIngredient = useCallback((
    ingredientKey: string,
    update: (ingredient: RecipeDetailIngredient) => RecipeDetailIngredient,
  ) => {
    setDetailState((current) => {
      if (current.status !== 'ready') return current
      return {
        ...current,
        detail: {
          ...current.detail,
          ingredients: current.detail.ingredients.map((ingredient) => (
            ingredient.key === ingredientKey ? update(ingredient) : ingredient
          )),
        },
      }
    })
  }, [])

  const setFeedbackPending = useCallback((ingredientKey: string, pending: boolean) => {
    setIngredientFeedbackPending((current) => {
      const next = new Set(current)
      if (pending) next.add(ingredientKey)
      else next.delete(ingredientKey)
      return next
    })
  }, [])

  const clearFeedbackCommandFamily = useCallback((prefix: string) => {
    for (const key of feedbackCommandKeysRef.current.keys()) {
      if (key.startsWith(prefix)) {
        feedbackCommandKeysRef.current.delete(key)
      }
    }
  }, [])

  const resetGroceryCommandState = useCallback(() => {
    groceryRequestRef.current += 1
    groceryCommandKeyRef.current = null
    grocerySelectionFingerprintRef.current = null
    groceryInFlightRef.current = false
    grocerySubmittedRef.current = false
    setGroceryState({ status: 'idle' })
    setGrocerySubmitted(false)
  }, [])

  const cancelIngredientPicker = useCallback(() => {
    ingredientPickerRequestRef.current += 1
    setIngredientPickerIngredient(null)
    setIngredientPickerLoadState({ status: 'idle' })
    ingredientPickerControls.setSearchQuery('')
  }, [ingredientPickerControls])

  const submitIngredientDecision = useCallback((
    ingredient: RecipeDetailIngredient,
    action: RecipeIngredientDecisionAction,
    options: {
      expectedTargetProductId?: number | null
      selectedProduct?: RecipeInventoryProduct | null
    } = {},
  ) => {
    if (
      detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
      || !detailState.detail.capabilities.ingredientFeedbackV2
      || !ingredient.feedbackCapabilities.decision
      || !ingredient.feedbackToken
      || ingredientFeedbackPending.has(ingredient.key)
      || (action === 'assume_have' && !ingredient.feedbackCapabilities.assumeHave)
      || (action === 'select_inventory_product' && !ingredient.feedbackCapabilities.selectInventoryProduct)
      || (action === 'reject_current_match' && !ingredient.feedbackCapabilities.rejectCurrentMatch)
    ) return
    const modalSession = modalSessionRef.current
    const selectedProduct = options.selectedProduct ?? null
    const selectedProductId = selectedProduct?.id
    const commandIdentity = [
      'decision',
      ingredient.key,
      action,
      selectedProductId ?? '',
      options.expectedTargetProductId ?? '',
    ].join(':')
    const idempotencyKey = feedbackCommandKeysRef.current.get(commandIdentity)
      ?? recipeDetailIdempotencyKey(detailState.detail.id)
    feedbackCommandKeysRef.current.set(commandIdentity, idempotencyKey)
    const previous = ingredient.userOverride
    const previousCapabilities = ingredient.feedbackCapabilities
    const availability = action === 'reject_current_match' ? 'missing' : 'have'
    updateIngredient(ingredient.key, (current) => ({
      ...current,
      userOverride: {
        availability,
        decisionAction: action,
        selectedProduct: selectedProduct
          ? { id: selectedProduct.id, name: selectedProduct.name }
          : null,
        updatedAt: new Date().toISOString(),
      },
      feedbackCapabilities: {
        ...current.feedbackCapabilities,
        rejectCurrentMatch: availability === 'have'
          ? true
          : current.feedbackCapabilities.rejectCurrentMatch,
        negativeIdentity: selectedProduct
          ? true
          : current.feedbackCapabilities.negativeIdentity,
      },
    }))
    resetGroceryCommandState()
    setFeedbackPending(ingredient.key, true)
    setIngredientFeedbackMessage(null)
    if (ingredientPickerIngredient?.key === ingredient.key) cancelIngredientPicker()
    void callRecipeService(
      callService,
      'recipe_ingredient_decision',
      recipeIngredientDecisionServiceData(
        detailState.detail.id,
        ingredient,
        action,
        idempotencyKey,
        {
          expectedTargetProductId: options.expectedTargetProductId,
          selectedProductId,
        },
      ),
    ).then((result) => {
      if (modalSession !== modalSessionRef.current) return
      const failure = feedbackFailure(result)
      if (failure) throw feedbackRequestError(failure.code, failure.message)
      clearFeedbackCommandFamily(`decision:${ingredient.key}:`)
      setIngredientFeedbackMessage(
        action === 'select_inventory_product'
          ? copy(RECIPE_CONTROLLER_COPY_KEYS.decisionSelectSaved)
          : action === 'reject_current_match'
            ? copy(RECIPE_CONTROLLER_COPY_KEYS.decisionRejectSaved)
            : copy(RECIPE_CONTROLLER_COPY_KEYS.decisionAssumeSaved),
      )
    }).catch((error: unknown) => {
      if (modalSession !== modalSessionRef.current) return
      updateIngredient(ingredient.key, (current) => ({
        ...current,
        userOverride: previous,
        feedbackCapabilities: previousCapabilities,
      }))
      const code = feedbackErrorCode(error)
      if (code === 'ingredient_feedback_stale') {
        feedbackCommandKeysRef.current.delete(commandIdentity)
        setDetailState({ status: 'loading' })
        setDetailReloadKey((current) => current + 1)
      } else if (
        code === 'idempotency_key_conflict'
        || code === 'unsupported_capability'
      ) {
        feedbackCommandKeysRef.current.delete(commandIdentity)
      }
      setIngredientFeedbackMessage(
        caughtMessage(error, copy(RECIPE_CONTROLLER_COPY_KEYS.decisionSaveError)),
      )
    }).finally(() => {
      if (modalSession === modalSessionRef.current) {
        setFeedbackPending(ingredient.key, false)
      }
    })
  }, [
    callService,
    cancelIngredientPicker,
    clearFeedbackCommandFamily,
    copy,
    detailState,
    ingredientFeedbackPending,
    ingredientPickerIngredient,
    resetGroceryCommandState,
    setFeedbackPending,
    updateIngredient,
  ])

  const openIngredientPicker = useCallback((ingredient: RecipeDetailIngredient) => {
    if (
      detailState.status !== 'ready'
      || !detailState.detail.capabilities.ingredientFeedbackV2
      || !ingredient.feedbackCapabilities.selectInventoryProduct
      || !ingredient.feedbackToken
      || ingredientFeedbackPending.has(ingredient.key)
    ) return
    ingredientPickerControls.setSearchQuery('')
    setIngredientPickerLoadState({ status: 'loading' })
    setIngredientPickerIngredient(ingredient)
  }, [detailState, ingredientFeedbackPending, ingredientPickerControls])

  const assumeIngredientHave = useCallback(() => {
    if (!ingredientPickerIngredient) return
    submitIngredientDecision(
      ingredientPickerIngredient,
      'assume_have',
    )
  }, [ingredientPickerIngredient, submitIngredientDecision])

  const selectIngredientProduct = useCallback((product: RecipeInventoryProduct) => {
    if (!ingredientPickerIngredient) return
    submitIngredientDecision(
      ingredientPickerIngredient,
      'select_inventory_product',
      { selectedProduct: product },
    )
  }, [ingredientPickerIngredient, submitIngredientDecision])

  const rejectIngredientMatch = useCallback((ingredient: RecipeDetailIngredient) => {
    const expectedTargetProductId = ingredient.userOverride?.selectedProduct?.id
      ?? ingredient.inventory.matchedProduct?.id
      ?? null
    submitIngredientDecision(
      ingredient,
      'reject_current_match',
      { expectedTargetProductId },
    )
  }, [submitIngredientDecision])

  const cancelPlanner = useCallback(() => {
    setPlannerOpen(false)
    setPlannerState({ status: 'idle' })
  }, [])

  const openPlanner = useCallback(() => {
    if (
      detailState.status !== 'ready'
      || !detailState.detail.capabilities.planner
      || !detailState.detail.planner.available
      || !detailState.detail.planner.providerActionToken
    ) return
    setPlannerDateState(
      detailState.detail.planner.minimumDate
        ?? new Date().toISOString().slice(0, 10),
    )
    setPlannerState({ status: 'idle' })
    setPlannerOpen(true)
  }, [detailState])

  const setPlannerDate = useCallback((value: string) => {
    setPlannerDateState(value)
    setPlannerState({ status: 'idle' })
    const fingerprint = plannerFingerprintRef.current
    if (fingerprint !== null && !fingerprint.endsWith(`:${value}`)) {
      plannerCommandKeyRef.current = null
      plannerFingerprintRef.current = null
    }
  }, [])

  const submitPlanner = useCallback(() => {
    if (
      plannerState.status === 'loading'
      || detailState.status !== 'ready'
      || !plannerOpen
      || !detailState.detail.capabilities.planner
      || !detailState.detail.planner.available
      || !detailState.detail.planner.providerActionToken
      || !plannerDate
      || (
        detailState.detail.planner.minimumDate
        && plannerDate < detailState.detail.planner.minimumDate
      )
      || (
        detailState.detail.planner.maximumDate
        && plannerDate > detailState.detail.planner.maximumDate
      )
    ) return
    const modalSession = modalSessionRef.current
    const fingerprint = `${detailState.detail.id}:${plannerDate}`
    if (
      plannerFingerprintRef.current !== null
      && plannerFingerprintRef.current !== fingerprint
    ) {
      plannerCommandKeyRef.current = null
    }
    plannerFingerprintRef.current = fingerprint
    const idempotencyKey = plannerCommandKeyRef.current
      ?? recipeDetailIdempotencyKey(detailState.detail.id)
    plannerCommandKeyRef.current = idempotencyKey
    setPlannerState({ status: 'loading' })
    void callRecipeService(
      callService,
      'recipe_planner_add',
      recipePlannerServiceData(
        detailState.detail.id,
        plannerDate,
        detailState.detail.planner.providerActionToken,
        idempotencyKey,
      ),
    ).then((result) => {
      if (modalSession !== modalSessionRef.current) return
      const failure = feedbackFailure(result)
      if (failure) throw feedbackRequestError(failure.code, failure.message)
      const response = recipeServiceResponse(result)
      const alreadyPresent = Boolean(
        response
        && typeof response === 'object'
        && 'already_present' in response
        && response.already_present,
      )
      setPlannerState({
        status: 'success',
        message: alreadyPresent
          ? copy(RECIPE_CONTROLLER_COPY_KEYS.plannerAlreadyPresent)
          : copy(RECIPE_CONTROLLER_COPY_KEYS.plannerAdded),
      })
    }).catch((error: unknown) => {
      if (modalSession !== modalSessionRef.current) return
      const code = feedbackErrorCode(error)
      if (code === 'recipe_planner_stale') {
        plannerCommandKeyRef.current = null
        plannerFingerprintRef.current = null
        setDetailState({ status: 'loading' })
        setDetailReloadKey((current) => current + 1)
        setPlannerOpen(false)
      } else if (
        code === 'idempotency_key_conflict'
        || code === 'unsupported_capability'
      ) {
        plannerCommandKeyRef.current = null
        plannerFingerprintRef.current = null
      }
      setPlannerState({
        status: 'error',
        message: caughtMessage(error, copy(RECIPE_CONTROLLER_COPY_KEYS.plannerError)),
      })
    })
  }, [
    callService,
    copy,
    detailState,
    plannerDate,
    plannerOpen,
    plannerState.status,
  ])

  const setIngredientOverride = useCallback((
    ingredient: RecipeDetailIngredient,
    availability: 'have' | 'missing' | 'clear',
  ) => {
    if (
      detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
      || !detailState.detail.capabilities.ingredientFeedback
      || !ingredient.feedbackCapabilities.availabilityOverride
      || !ingredient.feedbackToken
      || ingredientFeedbackPending.has(ingredient.key)
    ) return
    const modalSession = modalSessionRef.current
    const previous = ingredient.userOverride
    const commandIdentity = `override:${ingredient.key}:${availability}`
    const idempotencyKey = feedbackCommandKeysRef.current.get(commandIdentity)
      ?? recipeDetailIdempotencyKey(detailState.detail.id)
    feedbackCommandKeysRef.current.set(commandIdentity, idempotencyKey)
    const optimistic = availability === 'clear'
      ? null
      : {
          availability,
          decisionAction: null,
          selectedProduct: null,
          updatedAt: new Date().toISOString(),
        } as const
    updateIngredient(ingredient.key, (current) => ({
      ...current,
      userOverride: optimistic,
    }))
    resetGroceryCommandState()
    setFeedbackPending(ingredient.key, true)
    setIngredientFeedbackMessage(null)
    void callRecipeService(
      callService,
      'recipe_ingredient_override',
      recipeIngredientOverrideServiceData(
        detailState.detail.id,
        ingredient,
        availability,
        idempotencyKey,
      ),
    ).then((result) => {
      if (modalSession !== modalSessionRef.current) return
      const failure = feedbackFailure(result)
      if (failure) throw feedbackRequestError(failure.code, failure.message)
      clearFeedbackCommandFamily(
        `override:${ingredient.key}:`,
      )
      setIngredientFeedbackMessage(
        availability === 'clear'
          ? 'Using EverShelf availability again.'
          : 'Ingredient availability override saved.',
      )
    }).catch((error: unknown) => {
      if (modalSession !== modalSessionRef.current) return
      updateIngredient(ingredient.key, (current) => ({
        ...current,
        userOverride: previous,
      }))
      const code = feedbackErrorCode(error)
      if (code === 'ingredient_feedback_stale') {
        feedbackCommandKeysRef.current.delete(commandIdentity)
        setDetailState({ status: 'loading' })
        setDetailReloadKey((current) => current + 1)
      } else if (
        code === 'idempotency_key_conflict'
        || code === 'unsupported_capability'
      ) {
        feedbackCommandKeysRef.current.delete(commandIdentity)
      }
      setIngredientFeedbackMessage(
        caughtMessage(error, 'Unable to save ingredient override.'),
      )
    }).finally(() => {
      if (modalSession === modalSessionRef.current) {
        setFeedbackPending(ingredient.key, false)
      }
    })
  }, [
    callService,
    detailState,
    ingredientFeedbackPending,
    setFeedbackPending,
    clearFeedbackCommandFamily,
    resetGroceryCommandState,
    updateIngredient,
  ])

  const cycleIngredientOverride = useCallback((ingredient: RecipeDetailIngredient) => {
    const next = ingredient.userOverride?.availability === 'have'
      ? 'missing'
      : 'have'
    setIngredientOverride(ingredient, next)
  }, [setIngredientOverride])

  const clearIngredientOverride = useCallback((ingredient: RecipeDetailIngredient) => {
    setIngredientOverride(ingredient, 'clear')
  }, [setIngredientOverride])

  const recordIdentityFeedback = useCallback((
    ingredient: RecipeDetailIngredient,
    verdict: RecipeIngredientIdentityVerdict,
    targetKind: RecipeIngredientFeedbackTarget,
  ) => {
    if (
      detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
      || !detailState.detail.capabilities.ingredientFeedback
      || !ingredient.feedbackCapabilities.identity
      || !ingredient.feedbackToken
      || ingredientFeedbackPending.has(ingredient.key)
    ) return
    const modalSession = modalSessionRef.current
    const previous = ingredient.identityFeedback
    const commandIdentity = `identity:${ingredient.key}:${targetKind}:${verdict}`
    const idempotencyKey = feedbackCommandKeysRef.current.get(commandIdentity)
      ?? recipeDetailIdempotencyKey(detailState.detail.id)
    feedbackCommandKeysRef.current.set(commandIdentity, idempotencyKey)
    const optimistic = {
      verdict,
      targetKind,
      settleAfter: null,
      updatedAt: new Date().toISOString(),
    }
    updateIngredient(ingredient.key, (current) => ({
      ...current,
      identityFeedback: optimistic,
    }))
    setFeedbackPending(ingredient.key, true)
    setIngredientFeedbackMessage(null)
    void callRecipeService(
      callService,
      'recipe_identity_feedback',
      recipeIdentityFeedbackServiceData(
        detailState.detail.id,
        ingredient,
        verdict,
        targetKind,
        idempotencyKey,
      ),
    ).then((result) => {
      if (modalSession !== modalSessionRef.current) return
      const failure = feedbackFailure(result)
      if (failure) throw feedbackRequestError(failure.code, failure.message)
      clearFeedbackCommandFamily(
        `identity:${ingredient.key}:${targetKind}:`,
      )
      setIngredientFeedbackMessage(
        'Match feedback saved for ontology review.',
      )
    }).catch((error: unknown) => {
      if (modalSession !== modalSessionRef.current) return
      updateIngredient(ingredient.key, (current) => ({
        ...current,
        identityFeedback: previous,
      }))
      const code = feedbackErrorCode(error)
      if (code === 'ingredient_feedback_stale') {
        feedbackCommandKeysRef.current.delete(commandIdentity)
        setDetailState({ status: 'loading' })
        setDetailReloadKey((current) => current + 1)
      } else if (
        code === 'idempotency_key_conflict'
        || code === 'unsupported_capability'
      ) {
        feedbackCommandKeysRef.current.delete(commandIdentity)
      }
      setIngredientFeedbackMessage(
        caughtMessage(error, 'Unable to save identity feedback.'),
      )
    }).finally(() => {
      if (modalSession === modalSessionRef.current) {
        setFeedbackPending(ingredient.key, false)
      }
    })
  }, [
    callService,
    detailState,
    ingredientFeedbackPending,
    setFeedbackPending,
    clearFeedbackCommandFamily,
    updateIngredient,
  ])

  const addMissingIngredients = useCallback(() => {
    if (
      groceryInFlightRef.current
      || grocerySubmittedRef.current
      || individualGroceryPendingKeys.size > 0
      || individualGroceryRemovingKeys.size > 0
      || detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
    ) return
    if (recipeGroceryDisabledReason(detailState.detail, 'idle', addedIngredientKeys)) return
    const missing = recipeActionableMissingIngredients(
      detailState.detail,
      addedIngredientKeys,
    )
    if (missing.length === 0 || missing.length > RECIPE_GROCERY_MAX_SELECTIONS) return

    const selectionFingerprint = missing
      .map(({ key, position }) => `${key}:${position}`)
      .join('|')
    if (
      grocerySelectionFingerprintRef.current !== null
      && grocerySelectionFingerprintRef.current
          !== selectionFingerprint
    ) {
      groceryCommandKeyRef.current = null
      grocerySubmittedRef.current = false
      setGrocerySubmitted(false)
    }
    grocerySelectionFingerprintRef.current =
      selectionFingerprint
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
      const addedEntries = successfulGroceryMirrors(normalized, missing)
      if (addedEntries.length > 0) {
        setAddedIngredientKeys((current) => {
          const next = new Set(current)
          for (const [key] of addedEntries) next.add(key)
          return next
        })
        setAddedIngredientTodoNames((current) => {
          const next = new Map(current)
          for (const [key, name] of addedEntries) next.set(key, name)
          return next
        })
      }
      if (feedback.success) {
        grocerySubmittedRef.current = true
        groceryCommandKeyRef.current = null
      }
      setGroceryState(feedback.success
        ? { status: 'success', completedAt: Date.now(), message: feedback.message }
        : { status: 'error', message: feedback.message })
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
  }, [
    addedIngredientKeys,
    callService,
    detailState,
    individualGroceryPendingKeys,
    individualGroceryRemovingKeys,
  ])

  const addIndividualIngredient = useCallback((ingredient: RecipeDetailIngredient) => {
    if (
      detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
      || groceryInFlightRef.current
      || individualGroceryPendingKeys.has(ingredient.key)
      || addedIngredientKeys.has(ingredient.key)
      || !recipeIngredientIsGroceryEligible(ingredient)
      || recipeGroceryCapabilityBlockedReason(detailState.detail, 'idle')
    ) return

    const modalSession = modalSessionRef.current
    const ingredientKey = ingredient.key
    const requestGeneration = (individualGroceryRequestRef.current.get(ingredientKey) ?? 0) + 1
    individualGroceryRequestRef.current.set(ingredientKey, requestGeneration)
    const idempotencyKey = individualGroceryCommandKeysRef.current.get(ingredientKey)
      ?? `${recipeDetailIdempotencyKey(detailState.detail.id)}:${ingredientKey}`
    individualGroceryCommandKeysRef.current.set(ingredientKey, idempotencyKey)
    setIndividualGroceryPendingKeys((current) => new Set(current).add(ingredientKey))
    setIndividualGroceryErrors((current) => {
      if (!current.has(ingredientKey)) return current
      const next = new Map(current)
      next.delete(ingredientKey)
      return next
    })

    const detail = detailState.detail
    void callRecipeService(
      callService,
      'recipe_grocery_add',
      recipeGroceryServiceData(
        detail.id,
        [{ key: ingredientKey, position: ingredient.position }],
        idempotencyKey,
      ),
    ).then((result) => {
      if (
        modalSession !== modalSessionRef.current
        || individualGroceryRequestRef.current.get(ingredientKey) !== requestGeneration
      ) return
      const normalized = normalizeRecipeGroceryServiceResult(result)
      if (normalized.kind !== 'result') {
        setIndividualGroceryErrors((current) => new Map(current).set(
          ingredientKey,
          normalized.kind === 'unsupported' ? RECIPE_GROCERY_UNSUPPORTED_MESSAGE : normalized.message,
        ))
        return
      }
      const feedback = groceryFeedback(normalized)
      const [addedEntry] = successfulGroceryMirrors(normalized, [ingredient])
      if (addedEntry) {
        const [addedKey, todoName] = addedEntry
        individualGroceryCommandKeysRef.current.delete(ingredientKey)
        setAddedIngredientKeys((current) => new Set(current).add(addedKey))
        setAddedIngredientTodoNames((current) => new Map(current).set(addedKey, todoName))
        resetGroceryCommandState()
      }
      if (!feedback.success) {
        setIndividualGroceryErrors((current) => new Map(current).set(ingredientKey, feedback.message))
        return
      }
    }).catch((error: unknown) => {
      if (
        modalSession !== modalSessionRef.current
        || individualGroceryRequestRef.current.get(ingredientKey) !== requestGeneration
      ) return
      setIndividualGroceryErrors((current) => new Map(current).set(
        ingredientKey,
        recipeServiceErrorIsUnavailable(error, 'recipe_grocery_add')
          ? RECIPE_GROCERY_UNSUPPORTED_MESSAGE
          : caughtMessage(error, 'Unable to add this ingredient to groceries.'),
      ))
    }).finally(() => {
      if (modalSession !== modalSessionRef.current) return
      setIndividualGroceryPendingKeys((current) => {
        if (!current.has(ingredientKey)) return current
        const next = new Set(current)
        next.delete(ingredientKey)
        return next
      })
    })
  }, [addedIngredientKeys, callService, detailState, individualGroceryPendingKeys, resetGroceryCommandState])

  const removeIndividualIngredient = useCallback((ingredientKey: string) => {
    if (
      detailState.status !== 'ready'
      || detailState.session !== modalSessionRef.current
      || groceryInFlightRef.current
      || individualGroceryRemovingKeys.has(ingredientKey)
      || !addedIngredientKeys.has(ingredientKey)
    ) return
    const ingredient = detailState.detail.ingredients.find((candidate) => candidate.key === ingredientKey)
    if (!ingredient) return

    const modalSession = modalSessionRef.current
    const requestGeneration = (individualGroceryRemoveRequestRef.current.get(ingredientKey) ?? 0) + 1
    individualGroceryRemoveRequestRef.current.set(ingredientKey, requestGeneration)
    const stale = () => (
      modalSession !== modalSessionRef.current
      || individualGroceryRemoveRequestRef.current.get(ingredientKey) !== requestGeneration
    )

    setIndividualGroceryRemovingKeys((current) => new Set(current).add(ingredientKey))
    setIndividualGroceryErrors((current) => {
      if (!current.has(ingredientKey)) return current
      const next = new Map(current)
      next.delete(ingredientKey)
      return next
    })

    if (!connection?.sendMessagePromise) {
      setIndividualGroceryErrors((current) => new Map(current).set(
        ingredientKey,
        'Unable to reach Home Assistant to remove this item from the Grocery List.',
      ))
      setIndividualGroceryRemovingKeys((current) => {
        if (!current.has(ingredientKey)) return current
        const next = new Set(current)
        next.delete(ingredientKey)
        return next
      })
      return
    }

    void connection.sendMessagePromise<{ items?: RecipeGroceryTodoItem[] }>({
      type: 'todo/item/list',
      entity_id: RECIPE_GROCERY_TODO_ENTITY_ID,
    }).then((response) => {
      if (stale()) return
      const items = Array.isArray(response?.items) ? response.items : []
      const match = findMatchingGroceryTodoItem(
        items,
        ingredient,
        addedIngredientTodoNames.get(ingredientKey),
      )
      const identity = match?.uid ?? match?.summary
      if (!match || !identity) {
        throw new Error(`${ingredient.displayName} was not found on the Grocery List.`)
      }
      return Promise.resolve(callService({
        domain: 'todo',
        service: 'remove_item',
        target: RECIPE_GROCERY_TODO_ENTITY_ID,
        serviceData: { item: identity },
      })).then(() => {
        if (stale()) return
        // Clear the idempotency key/request bookkeeping so a later re-add issues a fresh
        // `recipe_grocery_add` call instead of relying on a stale replay of the earlier add.
        individualGroceryCommandKeysRef.current.delete(ingredientKey)
        individualGroceryRequestRef.current.delete(ingredientKey)
        setAddedIngredientKeys((current) => {
          if (!current.has(ingredientKey)) return current
          const next = new Set(current)
          next.delete(ingredientKey)
          return next
        })
        setAddedIngredientTodoNames((current) => {
          if (!current.has(ingredientKey)) return current
          const next = new Map(current)
          next.delete(ingredientKey)
          return next
        })
        // Re-adding this key back to the actionable pool must let the bulk action reappear/re-fade in
        // rather than staying collapsed from an earlier success.
        resetGroceryCommandState()
      })
    }).catch((error: unknown) => {
      if (stale()) return
      setIndividualGroceryErrors((current) => new Map(current).set(
        ingredientKey,
        caughtMessage(error, 'Unable to remove this ingredient from the Grocery List.'),
      ))
    }).finally(() => {
      if (stale()) return
      setIndividualGroceryRemovingKeys((current) => {
        if (!current.has(ingredientKey)) return current
        const next = new Set(current)
        next.delete(ingredientKey)
        return next
      })
    })
  }, [
    addedIngredientKeys,
    addedIngredientTodoNames,
    callService,
    connection,
    detailState,
    individualGroceryRemovingKeys,
    resetGroceryCommandState,
  ])

  return {
    activeTab,
    addedIngredientKeys,
    addIndividualIngredient,
    addMissingIngredients,
    close,
    detailState,
    groceryState,
    grocerySubmitted,
    individualGroceryErrors,
    individualGroceryPendingKeys,
    individualGroceryRemovingKeys,
    ingredientFeedbackMessage,
    ingredientFeedbackPending,
    ingredientPickerIngredient,
    ingredientPickerLoadState,
    ingredientPickerQuery: ingredientPickerControls.searchQuery,
    open,
    openRecipe,
    openIngredientPicker,
    cancelIngredientPicker,
    assumeIngredientHave,
    selectIngredientProduct,
    rejectIngredientMatch,
    setIngredientPickerQuery: ingredientPickerControls.setSearchQuery,
    cycleIngredientOverride,
    clearIngredientOverride,
    recordIdentityFeedback,
    removeIndividualIngredient,
    selectedRecipe,
    setActiveTab,
    plannerOpen,
    plannerDate,
    plannerState,
    openPlanner,
    cancelPlanner,
    setPlannerDate,
    submitPlanner,
  }
}
