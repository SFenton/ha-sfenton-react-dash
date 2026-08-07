import {
  appendUniqueRecipes,
  normalizeRecipeBrowseEnvelope,
  normalizeRecipeHydrationEnvelope,
  normalizeRecipeRecommendationsEnvelope,
  recipeBrowseServiceData,
  recipeHydrationStartData,
  recipeMatchesCriteriaFilters,
  type RecipeBrowseCriteria,
  type RecipeCardSummary,
} from './recipeTypes'

function card(id: number, dedupeKey = `recipe:${id}`): RecipeCardSummary {
  return {
    id,
    dedupeKey,
    title: `Recipe ${id}`,
    imageUrl: null,
    thumbnailUrl: null,
    source: 'Test',
    sourceUrl: null,
    coverage: 80,
    matchedRequired: 8,
    requiredTotal: 10,
    expiryScore: 5,
    soonestExpiryDays: null,
    score: 90,
    cookable: true,
  }
}

const criteria: RecipeBrowseCriteria = {
  q: '  tomato   basil ',
  sort: 'availability',
  availabilityWeight: 100,
  expiryWeight: 25,
  minimumCoverage: 10,
  expiringWithinDays: 7,
}

describe('recipe response normalization', () => {
  it('normalizes wrapped snake-case browse cards defensively', () => {
    const response = normalizeRecipeBrowseEnvelope({
      response: {
        criteria_hash: 'criteria',
        snapshot_id: 'snapshot',
        items: [
          {
            id: '12',
            dedupe_key: 'provider:12',
            title: 'Tomato Soup',
            image_url: 'https://example.test/soup.jpg',
            thumbnail_url: null,
            source: 'Provider',
            source_url: 'https://example.test/recipe',
            coverage: 0.86,
            matched_required: 7,
            required_total: 6,
            expiry_score: '4.5',
            soonest_expiry_days: '3',
            score: 92,
            cookable: 'true',
          },
          { title: 'Missing id' },
        ],
        next_cursor: 'cursor-2',
        has_more: true,
        total: '125',
        ranking_status: 'ready',
        catalog_revision: 14,
        inventory_revision: 'inventory-9',
      },
    })

    expect(response).toMatchObject({
      criteriaHash: 'criteria',
      snapshotId: 'snapshot',
      nextCursor: 'cursor-2',
      hasMore: true,
      total: 125,
      rankingStatus: 'ready',
      catalogRevision: '14',
      inventoryRevision: 'inventory-9',
    })
    expect(response.items).toEqual([
      expect.objectContaining({
        id: 12,
        dedupeKey: 'provider:12',
        title: 'Tomato Soup',
        coverage: 86,
        matchedRequired: 6,
        requiredTotal: 6,
        expiryScore: 4.5,
        soonestExpiryDays: 3,
        cookable: true,
      }),
    ])
  })

  it('limits recommendations to thirty and normalizes hydration compact cards', () => {
    const rawCards = Array.from({ length: 35 }, (_, index) => ({ id: index + 1, title: `Recipe ${index + 1}`, dedupe_key: `key:${index + 1}` }))
    expect(normalizeRecipeRecommendationsEnvelope({ service_response: { items: rawCards } }).items).toHaveLength(30)

    expect(normalizeRecipeHydrationEnvelope({
      response: {
        search_id: 'search-1',
        status: 'running',
        processed_count: 5,
        total_count: 10,
        progress: 50,
        remote_exhausted: true,
        next_poll_ms: 750,
        new_items: rawCards.slice(0, 2),
      },
    })).toMatchObject({
      searchId: 'search-1',
      status: 'running',
      processedCount: 5,
      totalCount: 10,
      progress: 50,
      exhausted: true,
      nextPollMs: 750,
      newItems: expect.any(Array),
    })
  })

  it('builds the approved browse payload and deduplicates by server key', () => {
    expect(recipeBrowseServiceData(criteria, 'cursor-2')).toEqual({
      kind: 'browse',
      q: 'tomato basil',
      sort: 'availability',
      availability_weight: 100,
      expiry_weight: 25,
      minimum_coverage: 10,
      expiring_within_days: 7,
      limit: 50,
      cursor: 'cursor-2',
    })
    expect(recipeHydrationStartData(criteria)).toEqual({ query: 'tomato basil' })

    expect(appendUniqueRecipes([card(1, 'same')], [card(2, 'same'), card(3, 'new')])).toEqual({
      added: 1,
      items: [card(1, 'same'), card(3, 'new')],
    })
    expect(recipeMatchesCriteriaFilters(
      { ...card(4), coverage: 20, soonestExpiryDays: 3 },
      { ...criteria, minimumCoverage: 100 },
    )).toBe(false)
    expect(recipeMatchesCriteriaFilters(
      { ...card(5), coverage: 100, soonestExpiryDays: 30 },
      criteria,
    )).toBe(false)
  })
})
