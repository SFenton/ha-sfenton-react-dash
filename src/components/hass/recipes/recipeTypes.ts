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

function finiteNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : fallback
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(finiteNumber(value, fallback)))
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

export function normalizeRecipeCard(value: unknown): RecipeCardSummary | null {
  if (!isRecord(value)) return null
  const rawId = finiteNumber(firstValue(value, 'id', 'recipe_id'), Number.NaN)
  const id = Math.round(rawId)
  const title = textValue(firstValue(value, 'title', 'name'))
  if (!Number.isFinite(id) || id < 0 || !title) return null

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
    items: normalizeRecipeItems(firstValue(record, 'items', 'recipes')).slice(0, 30),
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

export function recipeRecommendationServiceData(options: Pick<RecipeBrowseCriteria, 'locale' | 'source'> = {}) {
  return {
    kind: 'recommendations' as const,
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
