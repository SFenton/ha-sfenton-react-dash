export type RecipeSort = 'availability' | 'expiry' | 'alphabetical'

export interface RecipeCardSummary {
  id: number
  dedupeKey: string
  title: string
  imageUrl: string | null
  thumbnailUrl: string | null
  source: string
  sourceUrl: string | null
  coverage: number
  matchedRequired: number
  requiredTotal: number
  expiryScore: number
  soonestExpiryDays: number | null
  score: number
  cookable: boolean
}

export interface RecipeBrowseCriteria {
  q: string
  sort: RecipeSort
  availabilityWeight: number
  expiryWeight: number
  minimumCoverage: number
  expiringWithinDays?: 7 | 30 | 90
  source?: string
  locale?: string
}

export interface RecipeBrowseEnvelope {
  kind: 'browse'
  criteriaHash: string
  snapshotId: string
  items: RecipeCardSummary[]
  nextCursor: string | null
  hasMore: boolean
  total: number
  rankingStatus: string
  catalogRevision: string | null
  inventoryRevision: string | null
}

export interface RecipeRecommendationsEnvelope {
  kind: 'recommendations'
  recommendationId: string
  items: RecipeCardSummary[]
}

export interface RecipeHydrationEnvelope {
  searchId: string
  status: string
  processedCount: number
  totalCount: number | null
  progress: number
  exhausted: boolean
  nextPollMs: number | null
  newItems: RecipeCardSummary[]
}

export type RecipeDetailGeneralCapability = 'full' | 'partial' | 'none'
export type RecipeDetailIngredientsCapability = 'checklist' | 'names_only' | 'none'
export type RecipeDetailInstructionsCapability = 'local' | 'external_link' | 'none'
export type RecipeDetailQuantitiesCapability = 'known' | 'display_only' | 'unknown'
export type RecipeGroceryAddCapabilityState = 'unsupported' | 'unavailable'
export type RecipeIngredientInventoryState = 'in_stock' | 'missing' | 'uncertain' | 'staple'
export type RecipeIngredientQuantityState = 'known' | 'display_only' | 'unknown'
export type RecipeIngredientQuantitySufficiency = 'sufficient' | 'insufficient' | 'unknown'

export interface RecipeDetailSource {
  connector: string
  label: string
  attribution: string
  externalId: string | null
  canonicalUrl: string | null
  locale: string | null
  rightsBasis: string
}

export interface RecipeDetailImages {
  primary: string | null
  thumbnail: string | null
}

export interface RecipeDetailGeneral {
  yield: {
    quantity: number | null
    unit: string | null
  }
  activeTimeSeconds: number | null
  totalTimeSeconds: number | null
  difficulty: string | null
  primaryCategory: string | null
  equipment: string[]
}

export type RecipeIngredientClosestMatchSource = 'taxonomy_alias' | 'taxonomy_slug' | 'canonical_slug'

export interface RecipeIngredientClosestMatch {
  label: string
  canonicalIngredientId: number | null
  taxonomyNodeId: number | null
  mappingSource: RecipeIngredientClosestMatchSource
  confidence: number | null
}

export type RecipeIngredientProviderMetadata = Readonly<Record<string, string | number | boolean | null>>

export interface RecipeDetailIngredient {
  key: string
  position: number
  name: string
  displayName: string
  sourceText: string | null
  optional: boolean | null
  providerMetadata: RecipeIngredientProviderMetadata | null
  closestMatch: RecipeIngredientClosestMatch | null
  amount: {
    quantity: number | null
    quantityMax: number | null
    unit: string | null
    text: string | null
  }
  inventory: {
    state: RecipeIngredientInventoryState
    relation: string | null
    confidence: number
    matchedProduct: {
      id: number
      name: string
    } | null
    quantityState: RecipeIngredientQuantityState
    quantitySufficiency: RecipeIngredientQuantitySufficiency
  }
}

export interface RecipeIngredientGroup {
  key: string
  index: number
  label: string | null
  ingredientKeys: string[]
  positions?: number[]
}

export interface RecipeDetailGrocery {
  confirmedMissingCount: number
  uncertainCount: number
  blockedReason: string | null
}

export interface RecipeInstructionStep {
  key: string
  index: number
  number: number | null
  text: string
}

export interface RecipeInstructionGroup {
  key: string
  index: number
  label: string | null
  steps: RecipeInstructionStep[]
}

export interface RecipeDetailInstructions {
  available: boolean
  reason: 'provider_external_only' | 'not_available' | null
  steps: string[]
  groups: RecipeInstructionGroup[]
  fallbackUrl: string | null
  truncated: boolean
}

export interface RecipeDetailUserState {
  favorite: boolean
  hidden: boolean
  rating: number | null
  note: string
  cookedCount: number
  lastCooked: string | null
}

export interface RecipeDetailFreshness {
  retrievedAt: string | null
  staleAt: string | null
  updatedAt: string | null
  isStale: boolean | null
}

export interface RecipeDetailRevision {
  inventory: number
  ranking: number | null
  catalog: number
}

export interface RecipeDetailCapabilities {
  general: RecipeDetailGeneralCapability
  ingredients: RecipeDetailIngredientsCapability
  instructions: RecipeDetailInstructionsCapability
  quantities: RecipeDetailQuantitiesCapability
  groceryAdd: boolean
  groceryAddState: RecipeGroceryAddCapabilityState | null
  groceryAddReason: string | null
}

export interface RecipeDetail {
  schemaVersion: 'recipe_detail_v1'
  id: number
  title: string
  source: RecipeDetailSource
  images: RecipeDetailImages
  general: RecipeDetailGeneral
  ingredients: RecipeDetailIngredient[]
  ingredientGroups: RecipeIngredientGroup[]
  ingredientsTruncated: boolean
  grocery: RecipeDetailGrocery
  instructions: RecipeDetailInstructions
  userState: RecipeDetailUserState
  freshness: RecipeDetailFreshness
  revision: RecipeDetailRevision
  capabilities: RecipeDetailCapabilities
}

export interface RecipeServiceFailure {
  kind: 'error' | 'unsupported'
  errorKind: string | null
  requiredCapability: string | null
  message: string
}

export type RecipeDetailServiceResult =
  | { kind: 'detail'; detail: RecipeDetail }
  | RecipeServiceFailure

export interface RecipeGroceryBackendSummary {
  added: number
  alreadyListed: number
  nowInStock: number
  unresolved: number
  failed: number
}

export interface RecipeGroceryMirrorSummary {
  added: number
  alreadyPresent: number
  skipped: number
  failed: number
}

export interface RecipeGroceryResult {
  kind: 'result'
  success: boolean
  partialFailure: boolean
  replayed: boolean
  outcomesTruncated: boolean
  backend: RecipeGroceryBackendSummary
  backendMessage: string | null
  haMirror: RecipeGroceryMirrorSummary | null
  haMirrorMessage: string | null
}

export type RecipeGroceryServiceResult = RecipeGroceryResult | RecipeServiceFailure

export interface RecipeGrocerySelection {
  key: string
  position: number
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function recipeServiceResponse(result: unknown): unknown {
  if (!isRecord(result)) return result
  return result.response ?? result.service_response ?? result
}

function firstValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

function firstPresentValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) return record[key]
  }
  return undefined
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : fallback
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(finiteNumber(value, fallback)))
}

function strictNonNegativeInteger(value: unknown, fallback = 0) {
  const number = finiteNumber(value, Number.NaN)
  return Number.isInteger(number) && number >= 0 ? number : fallback
}

function boundedPercent(value: unknown, fallback = 0) {
  return Math.max(0, Math.min(100, finiteNumber(value, fallback)))
}

function coveragePercent(value: unknown) {
  const coverage = finiteNumber(value)
  return boundedPercent(coverage >= 0 && coverage <= 1 ? coverage * 100 : coverage)
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function boundedText(value: unknown, maximum: number, fallback = '') {
  const text = textValue(value, fallback)
  return text.slice(0, maximum)
}

function boundedNullableText(value: unknown, maximum: number) {
  const text = nullableText(value)
  return text === null ? null : text.slice(0, maximum)
}

function boundedVerbatimText(value: unknown, maximum: number) {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.slice(0, maximum)
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = finiteNumber(value, Number.NaN)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function nullableConfidence(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = finiteNumber(value, Number.NaN)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null
}

function nullableInteger(value: unknown, minimum = 0) {
  if (value === null || value === undefined || value === '') return null
  const number = finiteNumber(value, Number.NaN)
  return Number.isInteger(number) && number >= minimum ? number : null
}

function httpUrl(value: unknown, maximum = 2048) {
  const text = boundedNullableText(value, maximum)
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback
}

function nullableEnumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === 'string' && values.includes(value as T) ? value as T : null
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'on' || normalized === 'yes' || normalized === '1') return true
    if (normalized === 'false' || normalized === 'off' || normalized === 'no' || normalized === '0') return false
  }
  return fallback
}

function nullableBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'on' || normalized === 'yes' || normalized === '1') return true
    if (normalized === 'false' || normalized === 'off' || normalized === 'no' || normalized === '0') return false
  }
  return null
}

const RECIPE_SAFE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RECIPE_INGREDIENT_KEY_PATTERN = /^ri:\d+:[a-f0-9]{16}$/
const RECIPE_MAX_INGREDIENTS = 200
const RECIPE_MAX_INGREDIENT_GROUPS = 50
const RECIPE_MAX_INSTRUCTION_GROUPS = 50
const RECIPE_MAX_INSTRUCTION_STEPS = 100
const RECIPE_DETAIL_GENERAL_CAPABILITIES = ['full', 'partial', 'none'] as const
const RECIPE_DETAIL_INGREDIENT_CAPABILITIES = ['checklist', 'names_only', 'none'] as const
const RECIPE_DETAIL_INSTRUCTION_CAPABILITIES = ['local', 'external_link', 'none'] as const
const RECIPE_DETAIL_QUANTITY_CAPABILITIES = ['known', 'display_only', 'unknown'] as const
const RECIPE_GROCERY_ADD_CAPABILITY_STATES = ['unsupported', 'unavailable'] as const
const RECIPE_INVENTORY_STATES = ['in_stock', 'missing', 'uncertain', 'staple'] as const
const RECIPE_QUANTITY_STATES = ['known', 'display_only', 'unknown'] as const
const RECIPE_QUANTITY_SUFFICIENCY_STATES = ['sufficient', 'insufficient', 'unknown'] as const
const RECIPE_INSTRUCTION_REASONS = ['provider_external_only', 'not_available'] as const
const RECIPE_INGREDIENT_CLOSEST_MATCH_SOURCES = ['taxonomy_alias', 'taxonomy_slug', 'canonical_slug'] as const

export function normalizeRecipeCard(value: unknown): RecipeCardSummary | null {
  if (!isRecord(value)) return null
  const rawId = finiteNumber(firstValue(value, 'id', 'recipe_id'), Number.NaN)
  const id = Math.round(rawId)
  const title = textValue(firstValue(value, 'title', 'name'))
  if (!Number.isFinite(id) || id <= 0 || !title) return null

  const requiredTotal = nonNegativeInteger(firstValue(value, 'required_total', 'requiredTotal'))
  const rawMatchedRequired = nonNegativeInteger(firstValue(value, 'matched_required', 'matchedRequired'))
  const matchedRequired = requiredTotal > 0 ? Math.min(requiredTotal, rawMatchedRequired) : rawMatchedRequired
  const soonestExpiryValue = firstValue(value, 'soonest_expiry_days', 'soonestExpiryDays')
  const soonestExpiryDays = soonestExpiryValue === undefined ? null : Math.round(finiteNumber(soonestExpiryValue, Number.NaN))

  return {
    id,
    dedupeKey: textValue(firstValue(value, 'dedupe_key', 'dedupeKey'), `recipe:${id}`),
    title,
    imageUrl: nullableText(firstValue(value, 'image_url', 'imageUrl')),
    thumbnailUrl: nullableText(firstValue(value, 'thumbnail_url', 'thumbnailUrl')),
    source: textValue(firstValue(value, 'source', 'provider'), 'Unknown source'),
    sourceUrl: nullableText(firstValue(value, 'source_url', 'sourceUrl')),
    coverage: coveragePercent(firstValue(value, 'coverage')),
    matchedRequired,
    requiredTotal,
    expiryScore: finiteNumber(firstValue(value, 'expiry_score', 'expiryScore')),
    soonestExpiryDays: Number.isFinite(soonestExpiryDays) ? soonestExpiryDays : null,
    score: finiteNumber(firstValue(value, 'score')),
    cookable: booleanValue(firstValue(value, 'cookable')),
  }
}

function normalizeRecipeItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeRecipeCard).filter((item): item is RecipeCardSummary => item !== null)
}

function revisionValue(record: UnknownRecord, snakeKey: string, camelKey: string) {
  const value = firstValue(record, snakeKey, camelKey)
  if (value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return nullableText(value)
}

export function normalizeRecipeBrowseEnvelope(result: unknown): RecipeBrowseEnvelope {
  const response = recipeServiceResponse(result)
  const record = isRecord(response) ? response : {}
  const items = normalizeRecipeItems(firstValue(record, 'items', 'recipes'))
  const nextCursor = nullableText(firstValue(record, 'next_cursor', 'nextCursor'))
  const hasMoreValue = firstValue(record, 'has_more', 'hasMore')

  return {
    kind: 'browse',
    criteriaHash: textValue(firstValue(record, 'criteria_hash', 'criteriaHash')),
    snapshotId: textValue(firstValue(record, 'snapshot_id', 'snapshotId')),
    items,
    nextCursor,
    hasMore: booleanValue(hasMoreValue, Boolean(nextCursor)),
    total: nonNegativeInteger(firstValue(record, 'total'), items.length),
    rankingStatus: textValue(firstValue(record, 'ranking_status', 'rankingStatus'), 'ready'),
    catalogRevision: revisionValue(record, 'catalog_revision', 'catalogRevision'),
    inventoryRevision: revisionValue(record, 'inventory_revision', 'inventoryRevision'),
  }
}

export function normalizeRecipeRecommendationsEnvelope(result: unknown): RecipeRecommendationsEnvelope {
  const response = recipeServiceResponse(result)
  const record = isRecord(response) ? response : {}
  return {
    kind: 'recommendations',
    recommendationId: textValue(firstValue(record, 'recommendation_id', 'recommendationId')),
    items: normalizeRecipeItems(firstValue(record, 'items', 'recipes')),
  }
}

export function normalizeRecipeHydrationEnvelope(result: unknown): RecipeHydrationEnvelope {
  const response = recipeServiceResponse(result)
  const record = isRecord(response) ? response : {}
  const totalValue = firstValue(record, 'total_count', 'totalCount', 'total')
  const nextPollValue = firstValue(record, 'next_poll_ms', 'nextPollMs')
  return {
    searchId: textValue(firstValue(record, 'search_id', 'searchId')),
    status: textValue(firstValue(record, 'status'), 'complete'),
    processedCount: nonNegativeInteger(firstValue(record, 'processed_count', 'processedCount', 'hydrated_count', 'hydratedCount')),
    totalCount: totalValue === undefined ? null : nonNegativeInteger(totalValue),
    progress: boundedPercent(firstValue(record, 'progress')),
    exhausted: booleanValue(firstValue(record, 'remote_exhausted', 'remoteExhausted', 'exhausted')),
    nextPollMs: nextPollValue === undefined ? null : Math.max(0, Math.round(finiteNumber(nextPollValue))),
    newItems: normalizeRecipeItems(firstValue(record, 'new_items', 'newItems', 'items')),
  }
}

function normalizeClosestIngredientMatch(value: unknown): RecipeIngredientClosestMatch | null {
  if (!isRecord(value)) return null
  const mappingSource = nullableEnumValue(
    firstValue(value, 'mapping_source', 'mappingSource'),
    RECIPE_INGREDIENT_CLOSEST_MATCH_SOURCES,
  )
  if (!mappingSource) return null
  const label = boundedText(firstValue(value, 'label'), 200)
  if (!label) return null
  return {
    label,
    canonicalIngredientId: nullableInteger(
      firstValue(value, 'canonical_ingredient_id', 'canonicalIngredientId'),
      1,
    ),
    taxonomyNodeId: nullableInteger(firstValue(value, 'taxonomy_node_id', 'taxonomyNodeId'), 1),
    mappingSource,
    confidence: nullableConfidence(firstValue(value, 'confidence')),
  }
}

function normalizeIngredientProviderMetadata(value: unknown): RecipeIngredientProviderMetadata | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.length > 20) return null
  const metadata: Record<string, string | number | boolean | null> = {}
  for (const [key, rawValue] of entries) {
    if (!RECIPE_SAFE_KEY_PATTERN.test(key) || key.length > 64) return null
    if (rawValue === null || typeof rawValue === 'boolean') {
      metadata[key] = rawValue
      continue
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      metadata[key] = rawValue
      continue
    }
    if (typeof rawValue === 'string') {
      metadata[key] = rawValue.slice(0, 500)
      continue
    }
    return null
  }
  return metadata
}

function normalizeRecipeDetailIngredient(value: unknown): RecipeDetailIngredient | null {
  if (!isRecord(value)) return null
  const key = boundedText(firstValue(value, 'key', 'ingredient_key', 'ingredientKey'), 128)
  const position = nullableInteger(firstValue(value, 'position'), 0)
  const name = boundedText(firstValue(value, 'name'), 200)
  if (!RECIPE_INGREDIENT_KEY_PATTERN.test(key) || position === null || !name) return null
  const displayName = boundedText(firstValue(value, 'display_name', 'displayName'), 200, name)

  const amountRecord = isRecord(firstValue(value, 'amount')) ? firstValue(value, 'amount') as UnknownRecord : {}
  const inventoryRecord = isRecord(firstValue(value, 'inventory')) ? firstValue(value, 'inventory') as UnknownRecord : {}
  const matchedProductRecord = isRecord(firstValue(inventoryRecord, 'matched_product', 'matchedProduct'))
    ? firstValue(inventoryRecord, 'matched_product', 'matchedProduct') as UnknownRecord
    : null
  const matchedProductId = matchedProductRecord
    ? nullableInteger(firstValue(matchedProductRecord, 'id', 'product_id', 'productId'), 1)
    : null
  const matchedProductName = matchedProductRecord
    ? boundedText(firstValue(matchedProductRecord, 'name'), 200)
    : ''

  return {
    key,
    position,
    name,
    displayName,
    sourceText: boundedNullableText(firstValue(value, 'source_text', 'sourceText'), 500),
    optional: nullableBoolean(firstPresentValue(value, 'source_optional', 'sourceOptional', 'optional')),
    providerMetadata: normalizeIngredientProviderMetadata(
      firstValue(value, 'provider_metadata', 'providerMetadata'),
    ),
    closestMatch: normalizeClosestIngredientMatch(firstValue(value, 'closest_match', 'closestMatch')),
    amount: {
      quantity: nullableNonNegativeNumber(firstValue(amountRecord, 'quantity')),
      quantityMax: nullableNonNegativeNumber(firstValue(amountRecord, 'quantity_max', 'quantityMax')),
      unit: boundedNullableText(firstValue(amountRecord, 'unit'), 80),
      text: boundedNullableText(firstValue(amountRecord, 'text'), 160),
    },
    inventory: {
      state: enumValue(firstValue(inventoryRecord, 'state'), RECIPE_INVENTORY_STATES, 'uncertain'),
      relation: boundedNullableText(firstValue(inventoryRecord, 'relation'), 80),
      confidence: Math.max(0, Math.min(1, finiteNumber(firstValue(inventoryRecord, 'confidence')))),
      matchedProduct: matchedProductId !== null && matchedProductName
        ? { id: matchedProductId, name: matchedProductName }
        : null,
      quantityState: enumValue(firstValue(inventoryRecord, 'quantity_state', 'quantityState'), RECIPE_QUANTITY_STATES, 'unknown'),
      quantitySufficiency: enumValue(
        firstValue(inventoryRecord, 'quantity_sufficiency', 'quantitySufficiency'),
        RECIPE_QUANTITY_SUFFICIENCY_STATES,
        'unknown',
      ),
    },
  }
}

function normalizeRecipeIngredients(value: unknown) {
  if (!Array.isArray(value)) return { ingredients: [] as RecipeDetailIngredient[], unsafe: value !== undefined }
  const keys = new Set<string>()
  const positions = new Set<number>()
  let unsafe = value.length > RECIPE_MAX_INGREDIENTS
  const ingredients = value
    .slice(0, RECIPE_MAX_INGREDIENTS)
    .map((candidate) => {
      const ingredient = normalizeRecipeDetailIngredient(candidate)
      if (!ingredient || keys.has(ingredient.key) || positions.has(ingredient.position)) {
        unsafe = true
        return null
      }
      keys.add(ingredient.key)
      positions.add(ingredient.position)
      return ingredient
    })
    .filter((ingredient): ingredient is RecipeDetailIngredient => ingredient !== null)
  return { ingredients, unsafe }
}

function normalizeRecipeIngredientGroups(
  value: unknown,
  ingredients: RecipeDetailIngredient[],
): RecipeIngredientGroup[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length === 0 || value.length > RECIPE_MAX_INGREDIENT_GROUPS) return []

  const ingredientByKey = new Map(ingredients.map((ingredient, flatIndex) => (
    [ingredient.key, { ingredient, flatIndex }] as const
  )))
  const seenGroupKeys = new Set<string>()
  const seenIngredientKeys = new Set<string>()
  const groups: RecipeIngredientGroup[] = []
  let priorFlatIndex = -1
  let referenceCount = 0

  for (const [arrayIndex, candidate] of value.entries()) {
    if (!isRecord(candidate)) return []
    const key = boundedText(firstValue(candidate, 'key', 'group_key', 'groupKey'), 128)
    const index = nullableInteger(firstValue(candidate, 'index'), 0)
    const rawIngredientKeys = firstValue(candidate, 'ingredient_keys', 'ingredientKeys')
    const rawPositions = firstValue(candidate, 'positions')
    if (
      !RECIPE_SAFE_KEY_PATTERN.test(key)
      || seenGroupKeys.has(key)
      || index !== arrayIndex
      || !Array.isArray(rawIngredientKeys)
      || rawIngredientKeys.length === 0
      || rawIngredientKeys.length > RECIPE_MAX_INGREDIENTS
      || (rawPositions !== undefined && !Array.isArray(rawPositions))
      || (Array.isArray(rawPositions) && rawPositions.length !== rawIngredientKeys.length)
    ) return []

    const ingredientKeys: string[] = []
    const positions: number[] = []
    for (const [referenceIndex, rawIngredientKey] of rawIngredientKeys.entries()) {
      const ingredientKey = boundedText(rawIngredientKey, 128)
      const match = ingredientByKey.get(ingredientKey)
      if (
        !RECIPE_INGREDIENT_KEY_PATTERN.test(ingredientKey)
        || !match
        || seenIngredientKeys.has(ingredientKey)
        || match.flatIndex <= priorFlatIndex
      ) return []
      if (Array.isArray(rawPositions)) {
        const position = nullableInteger(rawPositions[referenceIndex], 0)
        if (position === null || position !== match.ingredient.position) return []
        positions.push(position)
      }
      ingredientKeys.push(ingredientKey)
      seenIngredientKeys.add(ingredientKey)
      priorFlatIndex = match.flatIndex
      referenceCount += 1
      if (referenceCount > RECIPE_MAX_INGREDIENTS) return []
    }

    seenGroupKeys.add(key)
    groups.push({
      key,
      index,
      label: boundedNullableText(firstPresentValue(candidate, 'label', 'title'), 160),
      ingredientKeys,
      ...(Array.isArray(rawPositions) ? { positions } : {}),
    })
  }

  return groups
}

function normalizeRecipeInstructionSteps(value: unknown) {
  if (value === undefined || value === null) return { steps: [] as string[], unsafe: false }
  if (!Array.isArray(value)) return { steps: [] as string[], unsafe: true }
  let unsafe = value.length > RECIPE_MAX_INSTRUCTION_STEPS
  const steps: string[] = []
  for (const candidate of value.slice(0, RECIPE_MAX_INSTRUCTION_STEPS)) {
    const rawText = isRecord(candidate) ? firstValue(candidate, 'text') : candidate
    const step = boundedVerbatimText(rawText, 2000)
    if (step === null) {
      unsafe = true
      continue
    }
    if (typeof rawText === 'string' && rawText.length > 2000) unsafe = true
    steps.push(step)
  }
  return { steps, unsafe }
}

function normalizeRecipeInstructionGroups(value: unknown) {
  if (value === undefined || value === null) {
    return { groups: [] as RecipeInstructionGroup[], unsafe: false }
  }
  if (!Array.isArray(value) || value.length > RECIPE_MAX_INSTRUCTION_GROUPS) {
    return { groups: [] as RecipeInstructionGroup[], unsafe: true }
  }
  if (value.length === 0) return { groups: [] as RecipeInstructionGroup[], unsafe: false }

  const seenGroupKeys = new Set<string>()
  const seenStepKeys = new Set<string>()
  const groups: RecipeInstructionGroup[] = []
  let totalSteps = 0

  for (const [groupArrayIndex, candidate] of value.entries()) {
    if (!isRecord(candidate)) return { groups: [], unsafe: true }
    const key = boundedText(firstValue(candidate, 'key', 'group_key', 'groupKey'), 128)
    const index = nullableInteger(firstValue(candidate, 'index'), 0)
    const rawSteps = firstValue(candidate, 'steps')
    if (
      !RECIPE_SAFE_KEY_PATTERN.test(key)
      || seenGroupKeys.has(key)
      || index !== groupArrayIndex
      || !Array.isArray(rawSteps)
      || rawSteps.length === 0
    ) return { groups: [], unsafe: true }

    const steps: RecipeInstructionStep[] = []
    for (const [stepArrayIndex, rawStep] of rawSteps.entries()) {
      if (!isRecord(rawStep)) return { groups: [], unsafe: true }
      const stepKey = boundedText(firstValue(rawStep, 'key', 'step_key', 'stepKey'), 128)
      const stepIndex = nullableInteger(firstValue(rawStep, 'index'), 0)
      const rawNumber = firstPresentValue(rawStep, 'number')
      const number = nullableInteger(rawNumber, 1)
      const rawText = firstValue(rawStep, 'text')
      const text = boundedVerbatimText(rawText, 2000)
      if (
        !RECIPE_SAFE_KEY_PATTERN.test(stepKey)
        || seenStepKeys.has(stepKey)
        || stepIndex !== stepArrayIndex
        || (rawNumber !== undefined && rawNumber !== null && rawNumber !== '' && number === null)
        || text === null
        || (typeof rawText === 'string' && rawText.length > 2000)
      ) return { groups: [], unsafe: true }

      totalSteps += 1
      if (totalSteps > RECIPE_MAX_INSTRUCTION_STEPS) return { groups: [], unsafe: true }
      seenStepKeys.add(stepKey)
      steps.push({ key: stepKey, index: stepIndex, number, text })
    }

    seenGroupKeys.add(key)
    groups.push({
      key,
      index,
      label: boundedNullableText(firstPresentValue(candidate, 'label', 'title'), 160),
      steps,
    })
  }

  return { groups, unsafe: false }
}

function normalizeRecipeDetailGrocery(value: unknown, ingredients: RecipeDetailIngredient[]): RecipeDetailGrocery {
  const record = isRecord(value) ? value : {}
  const counts = isRecord(firstValue(record, 'state_counts', 'stateCounts', 'counts'))
    ? firstValue(record, 'state_counts', 'stateCounts', 'counts') as UnknownRecord
    : {}
  const derivedMissingCount = ingredients.filter((ingredient) => ingredient.inventory.state === 'missing').length
  const derivedUncertainCount = ingredients.filter((ingredient) => ingredient.inventory.state === 'uncertain').length
  const missingCount = nullableInteger(
    firstValue(
      record,
      'confirmed_missing_count',
      'confirmedMissingCount',
      'missing_count',
      'missingCount',
      'confirmed_missing',
      'confirmedMissing',
      'missing',
    ) ?? firstValue(counts, 'confirmed_missing', 'confirmedMissing', 'missing'),
    0,
  )
  const uncertainCount = nullableInteger(
    firstValue(record, 'uncertain_count', 'uncertainCount', 'uncertain')
      ?? firstValue(counts, 'uncertain'),
    0,
  )
  return {
    confirmedMissingCount: missingCount ?? derivedMissingCount,
    uncertainCount: uncertainCount ?? derivedUncertainCount,
    blockedReason: boundedNullableText(firstValue(record, 'blocked_reason', 'blockedReason'), 160),
  }
}

function normalizeRecipeServiceFailure(record: UnknownRecord): RecipeServiceFailure {
  const errorKind = boundedNullableText(firstValue(record, 'error_kind', 'errorKind'), 80)
  const requiredCapability = boundedNullableText(firstValue(record, 'required_capability', 'requiredCapability'), 80)
  const errorCode = boundedNullableText(firstValue(record, 'error'), 120)
  const unsupported = errorKind === 'unsupported'
    || (errorKind === null && errorCode === 'unsupported_capability')
  return {
    kind: unsupported ? 'unsupported' : 'error',
    errorKind,
    requiredCapability,
    message: boundedText(
      firstValue(record, 'message', 'error'),
      500,
      unsupported
        ? 'The installed EverShelf/ha-evershelf version does not support this recipe feature.'
        : 'EverShelf could not complete the recipe request.',
    ),
  }
}

export function normalizeRecipeDetail(value: unknown): RecipeDetail | null {
  if (!isRecord(value)) return null
  const schemaVersion = boundedText(firstValue(value, 'schema_version', 'schemaVersion'), 40)
  const id = nullableInteger(firstValue(value, 'id', 'recipe_id', 'recipeId'), 1)
  const title = boundedText(firstValue(value, 'title', 'name'), 400)
  if (schemaVersion !== 'recipe_detail_v1' || id === null || !title) return null

  const sourceRecord = isRecord(firstValue(value, 'source')) ? firstValue(value, 'source') as UnknownRecord : {}
  const imagesRecord = isRecord(firstValue(value, 'images')) ? firstValue(value, 'images') as UnknownRecord : {}
  const generalRecord = isRecord(firstValue(value, 'general')) ? firstValue(value, 'general') as UnknownRecord : {}
  const yieldRecord = isRecord(firstValue(generalRecord, 'yield')) ? firstValue(generalRecord, 'yield') as UnknownRecord : {}
  const instructionRecord = isRecord(firstValue(value, 'instructions')) ? firstValue(value, 'instructions') as UnknownRecord : {}
  const userStateRecord = isRecord(firstValue(value, 'user_state', 'userState'))
    ? firstValue(value, 'user_state', 'userState') as UnknownRecord
    : {}
  const freshnessRecord = isRecord(firstValue(value, 'freshness')) ? firstValue(value, 'freshness') as UnknownRecord : {}
  const revisionRecord = isRecord(firstValue(value, 'revision')) ? firstValue(value, 'revision') as UnknownRecord : {}
  const capabilityRecord = isRecord(firstValue(value, 'capabilities')) ? firstValue(value, 'capabilities') as UnknownRecord : {}

  const connector = boundedText(firstValue(sourceRecord, 'connector'), 80)
  const canonicalUrl = httpUrl(firstValue(sourceRecord, 'canonical_url', 'canonicalUrl'))
  const fallbackUrl = httpUrl(firstValue(instructionRecord, 'fallback_url', 'fallbackUrl'))
  const cookidoo = connector.toLowerCase() === 'cookidoo'
  const requestedInstructionCapability = enumValue(
    firstValue(capabilityRecord, 'instructions'),
    RECIPE_DETAIL_INSTRUCTION_CAPABILITIES,
    'none',
  )
  const instructionCapability: RecipeDetailInstructionsCapability = cookidoo
    ? (fallbackUrl ?? canonicalUrl ? 'external_link' : 'none')
    : requestedInstructionCapability
  let instructionPayloadTruncated = false
  let steps: string[] = []
  let instructionGroups: RecipeInstructionGroup[] = []
  if (!cookidoo && instructionCapability === 'local') {
    const normalizedSteps = normalizeRecipeInstructionSteps(firstValue(instructionRecord, 'steps'))
    const normalizedGroups = normalizeRecipeInstructionGroups(
      firstValue(
        instructionRecord,
        'groups',
        'instruction_groups',
        'instructionGroups',
        'authorized_groups',
        'authorizedGroups',
      ) ?? firstValue(value, 'instruction_groups', 'instructionGroups'),
    )
    steps = normalizedSteps.steps
    instructionGroups = normalizedGroups.groups
    instructionPayloadTruncated = normalizedSteps.unsafe || normalizedGroups.unsafe
  }
  const normalizedIngredients = normalizeRecipeIngredients(firstValue(value, 'ingredients'))
  const ingredientGroups = normalizeRecipeIngredientGroups(
    firstValue(value, 'ingredient_groups', 'ingredientGroups'),
    normalizedIngredients.ingredients,
  )
  const grocery = normalizeRecipeDetailGrocery(
    firstValue(value, 'grocery', 'grocery_state', 'groceryState'),
    normalizedIngredients.ingredients,
  )
  const equipment = Array.isArray(firstValue(generalRecord, 'equipment'))
    ? (firstValue(generalRecord, 'equipment') as unknown[])
      .slice(0, 50)
      .map((item) => boundedText(item, 120))
      .filter(Boolean)
    : []

  return {
    schemaVersion: 'recipe_detail_v1',
    id,
    title,
    source: {
      connector,
      label: boundedText(firstValue(sourceRecord, 'label'), 160),
      attribution: boundedText(firstValue(sourceRecord, 'attribution'), 160),
      externalId: boundedNullableText(firstValue(sourceRecord, 'external_id', 'externalId'), 160),
      canonicalUrl,
      locale: boundedNullableText(firstValue(sourceRecord, 'locale'), 16),
      rightsBasis: boundedText(firstValue(sourceRecord, 'rights_basis', 'rightsBasis'), 160),
    },
    images: {
      primary: httpUrl(firstValue(imagesRecord, 'primary')),
      thumbnail: httpUrl(firstValue(imagesRecord, 'thumbnail')),
    },
    general: {
      yield: {
        quantity: nullableNonNegativeNumber(firstValue(yieldRecord, 'quantity')),
        unit: boundedNullableText(firstValue(yieldRecord, 'unit'), 80),
      },
      activeTimeSeconds: nullableInteger(firstValue(generalRecord, 'active_time_seconds', 'activeTimeSeconds'), 0),
      totalTimeSeconds: nullableInteger(firstValue(generalRecord, 'total_time_seconds', 'totalTimeSeconds'), 0),
      difficulty: boundedNullableText(firstValue(generalRecord, 'difficulty'), 80),
      primaryCategory: boundedNullableText(firstValue(generalRecord, 'primary_category', 'primaryCategory'), 160),
      equipment,
    },
    ingredients: normalizedIngredients.ingredients,
    ingredientGroups,
    ingredientsTruncated: normalizedIngredients.unsafe
      || booleanValue(firstValue(value, 'ingredients_truncated', 'ingredientsTruncated')),
    grocery,
    instructions: {
      available: instructionCapability === 'local' && (instructionGroups.length > 0 || steps.length > 0)
        && booleanValue(firstValue(instructionRecord, 'available'), true),
      reason: cookidoo
        ? 'provider_external_only'
        : nullableEnumValue(firstValue(instructionRecord, 'reason'), RECIPE_INSTRUCTION_REASONS)
          ?? (instructionGroups.length > 0 || steps.length > 0 ? null : 'not_available'),
      steps,
      groups: instructionGroups,
      fallbackUrl: cookidoo ? (fallbackUrl ?? canonicalUrl) : fallbackUrl,
      truncated: cookidoo
        ? false
        : instructionPayloadTruncated || booleanValue(firstValue(instructionRecord, 'truncated')),
    },
    userState: {
      favorite: booleanValue(firstValue(userStateRecord, 'favorite')),
      hidden: booleanValue(firstValue(userStateRecord, 'hidden')),
      rating: nullableInteger(firstValue(userStateRecord, 'rating'), 0),
      note: boundedVerbatimText(firstValue(userStateRecord, 'note'), 2000) ?? '',
      cookedCount: strictNonNegativeInteger(firstValue(userStateRecord, 'cooked_count', 'cookedCount')),
      lastCooked: boundedNullableText(firstValue(userStateRecord, 'last_cooked', 'lastCooked'), 80),
    },
    freshness: {
      retrievedAt: boundedNullableText(firstValue(freshnessRecord, 'retrieved_at', 'retrievedAt'), 80),
      staleAt: boundedNullableText(firstValue(freshnessRecord, 'stale_at', 'staleAt'), 80),
      updatedAt: boundedNullableText(firstValue(freshnessRecord, 'updated_at', 'updatedAt'), 80),
      isStale: nullableBoolean(firstValue(freshnessRecord, 'is_stale', 'isStale')),
    },
    revision: {
      inventory: strictNonNegativeInteger(firstValue(revisionRecord, 'inventory')),
      ranking: nullableInteger(firstValue(revisionRecord, 'ranking'), 1),
      catalog: strictNonNegativeInteger(firstValue(revisionRecord, 'catalog')),
    },
    capabilities: {
      general: enumValue(firstValue(capabilityRecord, 'general'), RECIPE_DETAIL_GENERAL_CAPABILITIES, 'none'),
      ingredients: enumValue(firstValue(capabilityRecord, 'ingredients'), RECIPE_DETAIL_INGREDIENT_CAPABILITIES, 'none'),
      instructions: instructionCapability,
      quantities: enumValue(firstValue(capabilityRecord, 'quantities'), RECIPE_DETAIL_QUANTITY_CAPABILITIES, 'unknown'),
      groceryAdd: booleanValue(firstValue(capabilityRecord, 'grocery_add', 'groceryAdd')),
      groceryAddState: nullableEnumValue(
        firstValue(capabilityRecord, 'grocery_add_state', 'groceryAddState'),
        RECIPE_GROCERY_ADD_CAPABILITY_STATES,
      ),
      groceryAddReason: boundedNullableText(
        firstValue(capabilityRecord, 'grocery_add_reason', 'groceryAddReason'),
        160,
      ),
    },
  }
}

export function normalizeRecipeDetailServiceResult(result: unknown): RecipeDetailServiceResult {
  const response = recipeServiceResponse(result)
  if (!isRecord(response)) {
    return {
      kind: 'error',
      errorKind: 'invalid_response',
      requiredCapability: null,
      message: 'EverShelf returned an invalid recipe detail response.',
    }
  }
  if (firstValue(response, 'success') === false) return normalizeRecipeServiceFailure(response)
  const detail = normalizeRecipeDetail(firstValue(response, 'detail', 'recipe_detail', 'recipeDetail'))
  return detail
    ? { kind: 'detail', detail }
    : {
        kind: 'error',
        errorKind: 'invalid_response',
        requiredCapability: null,
        message: 'EverShelf returned an invalid recipe detail response.',
      }
}

function summaryRecord(record: UnknownRecord, ...keys: string[]) {
  const value = firstValue(record, ...keys)
  return isRecord(value) ? value : {}
}

function normalizeRecipeGroceryBackendSummary(record: UnknownRecord): RecipeGroceryBackendSummary {
  return {
    added: nonNegativeInteger(firstValue(record, 'added')),
    alreadyListed: nonNegativeInteger(firstValue(record, 'already_listed', 'alreadyListed')),
    nowInStock: nonNegativeInteger(firstValue(record, 'now_in_stock', 'nowInStock')),
    unresolved: nonNegativeInteger(firstValue(record, 'unresolved')),
    failed: nonNegativeInteger(firstValue(record, 'failed')),
  }
}

function normalizeRecipeGroceryMirrorSummary(record: UnknownRecord): RecipeGroceryMirrorSummary {
  return {
    added: nonNegativeInteger(firstValue(record, 'added')),
    alreadyPresent: nonNegativeInteger(firstValue(record, 'already_present', 'alreadyPresent')),
    skipped: nonNegativeInteger(firstValue(record, 'skipped')),
    failed: nonNegativeInteger(firstValue(record, 'failed')),
  }
}

export function normalizeRecipeGroceryServiceResult(result: unknown): RecipeGroceryServiceResult {
  const response = recipeServiceResponse(result)
  if (!isRecord(response)) {
    return {
      kind: 'error',
      errorKind: 'invalid_response',
      requiredCapability: null,
      message: 'EverShelf returned an invalid grocery response.',
    }
  }
  const partialFailure = booleanValue(firstValue(response, 'partial_failure', 'partialFailure'))
  if (firstValue(response, 'success') === false && !partialFailure) {
    return normalizeRecipeServiceFailure(response)
  }

  const rawSummary = summaryRecord(response, 'summary')
  const rawBackend = isRecord(firstValue(rawSummary, 'backend'))
    ? firstValue(rawSummary, 'backend') as UnknownRecord
    : rawSummary
  const rawMirror = isRecord(firstValue(rawSummary, 'ha_mirror', 'haMirror'))
    ? firstValue(rawSummary, 'ha_mirror', 'haMirror') as UnknownRecord
    : summaryRecord(summaryRecord(response, 'ha_mirror', 'haMirror'), 'summary')
  const backendRecord = summaryRecord(response, 'backend')
  const haMirrorRecord = summaryRecord(response, 'ha_mirror', 'haMirror')
  const hasMirror = Object.keys(rawMirror).length > 0 || Object.keys(haMirrorRecord).length > 0

  return {
    kind: 'result',
    success: booleanValue(firstValue(response, 'success')),
    partialFailure,
    replayed: booleanValue(firstValue(response, 'replayed')),
    outcomesTruncated: booleanValue(firstValue(response, 'outcomes_truncated', 'outcomesTruncated')),
    backend: normalizeRecipeGroceryBackendSummary(rawBackend),
    backendMessage: boundedNullableText(
      firstValue(backendRecord, 'message', 'error')
        ?? firstValue(rawBackend, 'message', 'error')
        ?? firstValue(
          response,
          'backend_message',
          'backendMessage',
          'backend_error',
          'backendError',
        ),
      500,
    ),
    haMirror: hasMirror ? normalizeRecipeGroceryMirrorSummary(rawMirror) : null,
    haMirrorMessage: boundedNullableText(
      firstValue(haMirrorRecord, 'message', 'error')
        ?? firstValue(rawMirror, 'message', 'error')
        ?? firstValue(response, 'ha_mirror_message', 'haMirrorMessage'),
      500,
    ),
  }
}

export function normalizeRecipeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ')
}

export function recipeCriteriaKey(criteria: RecipeBrowseCriteria) {
  return JSON.stringify({
    ...criteria,
    q: normalizeRecipeQuery(criteria.q),
  })
}

export function recipeBrowseServiceData(criteria: RecipeBrowseCriteria, cursor?: string | null) {
  const q = normalizeRecipeQuery(criteria.q)
  return {
    kind: 'browse' as const,
    q,
    sort: criteria.sort,
    availability_weight: boundedPercent(criteria.availabilityWeight),
    expiry_weight: boundedPercent(criteria.expiryWeight),
    minimum_coverage: boundedPercent(criteria.minimumCoverage),
    ...(criteria.expiringWithinDays ? { expiring_within_days: criteria.expiringWithinDays } : {}),
    ...(criteria.source ? { source: criteria.source } : {}),
    ...(criteria.locale ? { locale: criteria.locale } : {}),
    limit: 50,
    ...(cursor ? { cursor } : {}),
  }
}

export function recipeRecommendationServiceData(
  options: Pick<RecipeBrowseCriteria, 'locale' | 'source'> & { limit?: number } = {},
) {
  return {
    kind: 'recommendations' as const,
    ...(options.limit ? { limit: options.limit } : {}),
    ...(options.source ? { source: options.source } : {}),
    ...(options.locale ? { locale: options.locale } : {}),
  }
}

export function recipeHydrationStartData(criteria: RecipeBrowseCriteria) {
  return {
    query: normalizeRecipeQuery(criteria.q),
    ...(criteria.source ? { source: criteria.source } : {}),
    ...(criteria.locale ? { locale: criteria.locale } : {}),
  }
}

export function recipeDetailServiceData(recipeId: number) {
  return { recipe_id: Math.max(1, Math.round(recipeId)) }
}

export function recipeGroceryServiceData(
  recipeId: number,
  selections: RecipeGrocerySelection[],
  idempotencyKey: string,
) {
  return {
    recipe_id: Math.max(1, Math.round(recipeId)),
    selections: selections
      .filter((selection) => RECIPE_INGREDIENT_KEY_PATTERN.test(selection.key) && selection.position >= 0)
      .slice(0, 100)
      .map((selection) => ({
        key: selection.key,
        position: Math.round(selection.position),
      })),
    idempotency_key: idempotencyKey.slice(0, 128),
    todo_entity_id: 'todo.shopping_list',
  }
}

export function recipeMatchesCriteriaFilters(
  recipe: RecipeCardSummary,
  criteria: RecipeBrowseCriteria,
) {
  if (recipe.coverage < criteria.minimumCoverage) return false
  if (criteria.expiringWithinDays !== undefined) {
    return recipe.soonestExpiryDays !== null
      && recipe.soonestExpiryDays >= 0
      && recipe.soonestExpiryDays <= criteria.expiringWithinDays
  }
  return true
}

export function appendUniqueRecipes(current: RecipeCardSummary[], incoming: RecipeCardSummary[]) {
  if (incoming.length === 0) return { added: 0, items: current }
  const keys = new Set(current.map((item) => item.dedupeKey))
  const additions = incoming.filter((item) => {
    if (keys.has(item.dedupeKey)) return false
    keys.add(item.dedupeKey)
    return true
  })
  return additions.length === 0 ? { added: 0, items: current } : { added: additions.length, items: [...current, ...additions] }
}
