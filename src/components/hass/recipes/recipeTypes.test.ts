import {
  appendUniqueRecipes,
  normalizeRecipeBrowseEnvelope,
  normalizeRecipeDetailServiceResult,
  normalizeRecipeGroceryServiceResult,
  normalizeRecipeHydrationEnvelope,
  normalizeRecipeRecommendationsEnvelope,
  recipeBrowseServiceData,
  recipeDetailServiceData,
  recipeGroceryServiceData,
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

function minimalRecipeDetail({
  capabilities = {},
  grocery,
  ingredients = [],
}: {
  capabilities?: Record<string, unknown>
  grocery?: unknown
  ingredients?: unknown[]
} = {}) {
  return {
    schema_version: 'recipe_detail_v1',
    id: 99,
    title: 'Defensive Grocery Detail',
    source: {},
    images: {},
    general: {},
    ingredients,
    grocery,
    instructions: {},
    capabilities,
  }
}

function detailIngredient(position: number, overrides: Record<string, unknown> = {}) {
  return {
    key: `ri:${position}:${String(position + 1).padStart(16, '0')}`,
    position,
    name: `Ingredient ${position + 1}`,
    amount: {},
    inventory: { state: 'missing' },
    ...overrides,
  }
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

  it('preserves responsive recommendation counts and normalizes hydration compact cards', () => {
    const rawCards = Array.from({ length: 35 }, (_, index) => ({ id: index + 1, title: `Recipe ${index + 1}`, dedupe_key: `key:${index + 1}` }))
    expect(normalizeRecipeRecommendationsEnvelope({ service_response: { items: rawCards } }).items).toHaveLength(35)

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

  describe('recipe detail normalization', () => {
    it('normalizes bounded snake/camel detail fields and drops malformed ingredient rows', () => {
      const result = normalizeRecipeDetailServiceResult({
        service_response: {
          success: true,
          detail: {
            schemaVersion: 'recipe_detail_v1',
            recipeId: '42',
            title: '  Pantry Bowl  ',
            source: {
              connector: 'manual',
              label: 'User',
              attribution: 'Household',
              externalId: 99,
              canonicalUrl: 'https://example.test/recipes/42',
              locale: 'en-US',
              rightsBasis: 'user_authorized',
            },
            images: {
              primary: 'javascript:alert(1)',
              thumbnail: 'https://example.test/recipes/42-thumb.jpg',
            },
            general: {
              yield: { quantity: '2.5', unit: 'bowls' },
              prep_time_seconds: '600',
              cookTimeSeconds: 1_200,
              activeTimeSeconds: '900',
              inactive_time_seconds: '300',
              total_time_seconds: -5,
              difficulty: 'Easy',
              primaryCategory: 'Dinner',
              devices: ['TM6', 'Oven', '', 7, 'tm6'],
              optionalDevices: ['Slow cooker', 'OVEN', { invalid: true }],
              equipment: ['Large bowl', '', 7],
            },
            ingredients: [
              {
                key: 'ri:2:0123456789abcdef',
                position: 2,
                name: 'Tomatoes',
                amount: { quantity: '2', quantityMax: 3, unit: 'cups', text: null },
                inventory: {
                  state: 'missing',
                  relation: null,
                  confidence: 3,
                  matchedProduct: null,
                  quantityState: 'known',
                  quantitySufficiency: 'insufficient',
                },
              },
              { key: 'invalid', position: 0, name: 'Unsafe row' },
              {
                key: 'ri:2:0123456789abcdef',
                position: 9,
                name: 'Duplicate',
                amount: {},
                inventory: {},
              },
            ],
            ingredientsTruncated: false,
            instructions: {
              available: true,
              reason: null,
              steps: ['Mix exactly as written.\nKeep the line break.', { malformed: true }],
              fallbackUrl: null,
              truncated: false,
            },
            userState: {
              favorite: 1,
              hidden: 0,
              rating: '4',
              note: 'Personal note',
              cookedCount: '3',
              lastCooked: '2026-08-01',
            },
            freshness: {
              retrievedAt: '2026-08-07T18:00:00Z',
              staleAt: null,
              updatedAt: '2026-08-07T18:00:00Z',
              isStale: false,
            },
            revision: { inventory: '12', ranking: '4', catalog: 8 },
            capabilities: {
              general: 'partial',
              ingredients: 'checklist',
              instructions: 'local',
              quantities: 'known',
              groceryAdd: true,
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail).toMatchObject({
        id: 42,
        title: 'Pantry Bowl',
        images: {
          primary: null,
          thumbnail: 'https://example.test/recipes/42-thumb.jpg',
        },
        general: {
          yield: { quantity: 2.5, unit: 'bowls' },
          prepTimeSeconds: 600,
          cookTimeSeconds: 1_200,
          activeTimeSeconds: 900,
          inactiveTimeSeconds: 300,
          totalTimeSeconds: null,
          devices: ['TM6', 'Oven'],
          optionalDevices: ['Slow cooker'],
          equipment: ['Large bowl'],
        },
        ingredientsTruncated: true,
        capabilities: {
          general: 'partial',
          ingredients: 'checklist',
          instructions: 'local',
          quantities: 'known',
          groceryAdd: true,
          groceryAddState: null,
          groceryAddReason: null,
        },
      })
      expect(result.detail.ingredients).toHaveLength(1)
      expect(result.detail.ingredients[0]).toMatchObject({
        key: 'ri:2:0123456789abcdef',
        position: 2,
        name: 'Tomatoes',
        displayName: 'Tomatoes',
        sourceText: null,
        closestMatch: null,
        inventory: { confidence: 1, state: 'missing' },
      })
      expect(result.detail.grocery).toEqual({
        confirmedMissingCount: 1,
        uncertainCount: 0,
        blockedReason: null,
      })
      expect(result.detail.instructions.steps).toEqual(['Mix exactly as written.\nKeep the line break.'])
      expect(result.detail.instructions.truncated).toBe(true)
    })

    it('normalizes additive ingredient identity and grocery state fields without changing recipe_detail_v1', () => {
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            schema_version: 'recipe_detail_v1',
            id: 44,
            title: 'Identity-safe Bowl',
            source: {},
            images: {},
            general: {},
            ingredients: [
              {
                key: 'ri:0:0123456789abcdef',
                position: 0,
                name: 'tomato',
                display_name: 'Diced Tomatoes',
                source_text: '1 can diced tomatoes, drained',
                closest_match: {
                  label: 'Canned diced tomato',
                  canonical_ingredient_id: '42',
                  taxonomy_node_id: 77,
                  mapping_source: 'taxonomy_alias',
                  confidence: 0.83,
                  ignored_private_field: 'must not escape the allowlist',
                },
                amount: {},
                inventory: { state: 'uncertain' },
              },
            ],
            grocery: {
              confirmed_missing_count: '0',
              uncertain_count: 1,
              blocked_reason: 'uncertain_only',
            },
            instructions: {},
            capabilities: {
              ingredients: 'checklist',
              grocery_add: true,
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.schemaVersion).toBe('recipe_detail_v1')
      expect(result.detail.ingredients[0]).toMatchObject({
        name: 'tomato',
        displayName: 'Diced Tomatoes',
        sourceText: '1 can diced tomatoes, drained',
        closestMatch: {
          label: 'Canned diced tomato',
          canonicalIngredientId: 42,
          taxonomyNodeId: 77,
          mappingSource: 'taxonomy_alias',
          confidence: 0.83,
        },
      })
      expect(result.detail.ingredients[0].closestMatch).not.toHaveProperty('ignored_private_field')
      expect(result.detail.grocery).toEqual({
        confirmedMissingCount: 0,
        uncertainCount: 1,
        blockedReason: 'uncertain_only',
      })
      expect(result.detail.capabilities.groceryAdd).toBe(true)
    })

    it('normalizes ordered ingredient groups, optional state, provider metadata, and authorized instruction groups', () => {
      const ingredients = [
        detailIngredient(4, {
          display_name: 'First ingredient',
          source_optional: true,
          provider: { aisle: 'produce', rank: 1, verified: true, note: null },
        }),
        detailIngredient(1, {
          displayName: 'Second ingredient',
          optional: false,
          providerMetadata: { aisle: 'pantry' },
        }),
        detailIngredient(8, {
          display_name: 'Third ingredient',
          source_optional: null,
          optional: true,
        }),
      ]
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            ...minimalRecipeDetail({
              ingredients,
              capabilities: { ingredients: 'checklist', instructions: 'local' },
            }),
            ingredientGroups: [
              {
                key: 'ingredient-group:first',
                index: 0,
                label: 'Produce',
                ingredient_keys: [ingredients[0].key, ingredients[1].key],
                positions: [4, 1],
              },
              {
                key: 'ingredient-group:second',
                index: 1,
                label: '',
                ingredientKeys: [ingredients[2].key],
              },
            ],
            instructions: {
              available: true,
              steps: ['Flat fallback remains available.'],
              instruction_groups: [
                {
                  key: 'instruction-group:prepare',
                  index: 0,
                  label: 'Prepare',
                  steps: [
                    { key: 'instruction-step:one', index: 0, number: 1, text: 'Prepare the ingredients.' },
                  ],
                },
                {
                  key: 'instruction-group:finish',
                  index: 1,
                  label: null,
                  steps: [
                    { key: 'instruction-step:two', index: 0, text: 'Finish the dish.' },
                  ],
                },
              ],
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.ingredients.map((ingredient) => ingredient.position)).toEqual([4, 1, 8])
      expect(result.detail.ingredients.map((ingredient) => ingredient.optional)).toEqual([true, false, null])
      expect(result.detail.ingredients[0].providerMetadata).toEqual({
        aisle: 'produce',
        rank: 1,
        verified: true,
        note: null,
      })
      expect(result.detail.ingredients[1].providerMetadata).toEqual({ aisle: 'pantry' })
      expect(result.detail.ingredientGroups).toEqual([
        {
          key: 'ingredient-group:first',
          index: 0,
          label: 'Produce',
          ingredientKeys: [ingredients[0].key, ingredients[1].key],
          positions: [4, 1],
        },
        {
          key: 'ingredient-group:second',
          index: 1,
          label: null,
          ingredientKeys: [ingredients[2].key],
        },
      ])
      expect(result.detail.instructions.steps).toEqual(['Flat fallback remains available.'])
      expect(result.detail.instructions.groups).toEqual([
        {
          key: 'instruction-group:prepare',
          index: 0,
          label: 'Prepare',
          steps: [{
            key: 'instruction-step:one',
            index: 0,
            number: 1,
            text: 'Prepare the ingredients.',
          }],
        },
        {
          key: 'instruction-group:finish',
          index: 1,
          label: null,
          steps: [{
            key: 'instruction-step:two',
            index: 0,
            number: null,
            text: 'Finish the dish.',
          }],
        },
      ])
    })

    it.each([
      {
        label: 'duplicate ingredient reference',
        groups: (keys: string[]) => [
          { key: 'group:first', index: 0, label: 'First', ingredient_keys: [keys[0]] },
          { key: 'group:second', index: 1, label: 'Second', ingredient_keys: [keys[0]] },
        ],
      },
      {
        label: 'missing ingredient reference',
        groups: (keys: string[]) => [
          { key: 'group:first', index: 0, label: 'First', ingredient_keys: [keys[0], 'ri:9:9999999999999999'] },
        ],
      },
      {
        label: 'invalid group order',
        groups: (keys: string[]) => [
          { key: 'group:first', index: 1, label: 'First', ingredient_keys: [keys[0]] },
          { key: 'group:second', index: 0, label: 'Second', ingredient_keys: [keys[1]] },
        ],
      },
      {
        label: 'invalid ingredient order',
        groups: (keys: string[]) => [
          { key: 'group:first', index: 0, label: 'First', ingredient_keys: [keys[1], keys[0]] },
        ],
      },
      {
        label: 'unsafe group count',
        groups: (keys: string[]) => Array.from({ length: 51 }, (_, index) => ({
          key: `group:${index}`,
          index,
          label: null,
          ingredient_keys: [keys[index % keys.length]],
        })),
      },
    ])('rejects $label while preserving the flat ingredient fallback', ({ groups }) => {
      const ingredients = [detailIngredient(0), detailIngredient(1)]
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            ...minimalRecipeDetail({
              ingredients,
              capabilities: { ingredients: 'checklist' },
            }),
            ingredient_groups: groups(ingredients.map((ingredient) => ingredient.key)),
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.ingredients.map((ingredient) => ingredient.key)).toEqual(
        ingredients.map((ingredient) => ingredient.key),
      )
      expect(result.detail.ingredientGroups).toEqual([])
      expect(result.detail.ingredientsTruncated).toBe(false)
    })

    it('rejects malformed instruction groups while retaining authorized flat steps', () => {
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            ...minimalRecipeDetail({
              capabilities: { instructions: 'local' },
            }),
            instructions: {
              available: true,
              steps: ['Use the safe flat instruction.'],
              groups: [{
                key: 'group:bad-order',
                index: 1,
                label: 'Unsafe',
                steps: [{ key: 'step:bad-order', index: 0, text: 'Do not use this group.' }],
              }],
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.instructions.groups).toEqual([])
      expect(result.detail.instructions.steps).toEqual(['Use the safe flat instruction.'])
      expect(result.detail.instructions.available).toBe(true)
      expect(result.detail.instructions.truncated).toBe(true)
    })

    it('normalizes backend step_positions into nested local instruction groups', () => {
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            ...minimalRecipeDetail({
              capabilities: { instructions: 'local' },
            }),
            instructions: {
              available: true,
              steps: ['Prepare locally.', 'Finish locally.'],
              groups: [
                {
                  key: 'group:prepare',
                  index: 0,
                  label: 'Prepare',
                  step_positions: [0],
                },
                {
                  key: 'group:finish',
                  index: 1,
                  label: 'Finish',
                  step_positions: [1],
                },
              ],
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.instructions.groups).toEqual([
        {
          key: 'group:prepare',
          index: 0,
          label: 'Prepare',
          steps: [{
            key: 'instruction-step-0-0',
            index: 0,
            number: 1,
            text: 'Prepare locally.',
          }],
        },
        {
          key: 'group:finish',
          index: 1,
          label: 'Finish',
          steps: [{
            key: 'instruction-step-1-1',
            index: 1,
            number: 2,
            text: 'Finish locally.',
          }],
        },
      ])
    })

    it('falls back to the complete flat list when position groups omit steps', () => {
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            ...minimalRecipeDetail({
              capabilities: { instructions: 'local' },
            }),
            instructions: {
              available: true,
              steps: ['Prepare locally.', 'Finish locally.'],
              groups: [{
                key: 'group:prepare',
                index: 0,
                label: 'Prepare',
                step_positions: [0],
              }],
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.instructions.groups).toEqual([])
      expect(result.detail.instructions.steps).toEqual([
        'Prepare locally.',
        'Finish locally.',
      ])
      expect(result.detail.instructions.truncated).toBe(true)
    })

    it('preserves bounded grocery capability metadata and backend blocked reasons', () => {
      const longReason = `maintenance:${'x'.repeat(200)}`
      const longBlockedReason = `future_block:${'y'.repeat(200)}`
      const unavailable = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: minimalRecipeDetail({
            grocery: { blocked_reason: longBlockedReason },
            capabilities: {
              grocery_add: false,
              grocery_add_state: 'unavailable',
              grocery_add_reason: longReason,
            },
          }),
        },
      })

      expect(unavailable.kind).toBe('detail')
      if (unavailable.kind !== 'detail') return
      expect(unavailable.detail.capabilities).toMatchObject({
        groceryAdd: false,
        groceryAddState: 'unavailable',
        groceryAddReason: longReason.slice(0, 160),
      })
      expect(unavailable.detail.grocery.blockedReason).toBe(longBlockedReason.slice(0, 160))

      const unsupported = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: minimalRecipeDetail({
            grocery: { blockedReason: 'no_ingredients' },
            capabilities: {
              groceryAdd: false,
              groceryAddState: 'unsupported',
              groceryAddReason: 'unsupported',
            },
          }),
        },
      })

      expect(unsupported.kind).toBe('detail')
      if (unsupported.kind !== 'detail') return
      expect(unsupported.detail.capabilities).toMatchObject({
        groceryAdd: false,
        groceryAddState: 'unsupported',
        groceryAddReason: 'unsupported',
      })
      expect(unsupported.detail.grocery.blockedReason).toBe('no_ingredients')
    })

    it('drops hostile grocery metadata and keeps old partial capability responses safe', () => {
      const hostile = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: minimalRecipeDetail({
            grocery: { blocked_reason: { hostile: true } },
            capabilities: {
              grocery_add: false,
              grocery_add_state: 'enabled',
              grocery_add_reason: ['unsupported'],
            },
          }),
        },
      })

      expect(hostile.kind).toBe('detail')
      if (hostile.kind !== 'detail') return
      expect(hostile.detail.capabilities).toMatchObject({
        groceryAdd: false,
        groceryAddState: null,
        groceryAddReason: null,
      })
      expect(hostile.detail.grocery.blockedReason).toBeNull()

      const oldBackend = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: minimalRecipeDetail({
            capabilities: {
              ingredients: 'checklist',
              grocery_add: false,
            },
          }),
        },
      })

      expect(oldBackend.kind).toBe('detail')
      if (oldBackend.kind !== 'detail') return
      expect(oldBackend.detail.capabilities).toMatchObject({
        groceryAdd: false,
        groceryAddState: null,
        groceryAddReason: null,
      })
      expect(oldBackend.detail.grocery.blockedReason).toBeNull()
    })

    it.each(['taxonomy_alias', 'taxonomy_slug', 'canonical_slug'] as const)(
      'accepts closest_match only from allowlisted identity source %s',
      (mappingSource) => {
        const result = normalizeRecipeDetailServiceResult({
          response: {
            success: true,
            detail: {
              schema_version: 'recipe_detail_v1',
              id: 45,
              title: 'Allowlisted Identity',
              source: {},
              images: {},
              general: {},
              ingredients: [{
                key: 'ri:0:0123456789abcdef',
                position: 0,
                name: 'herbs',
                closest_match: {
                  label: 'Italian parsley',
                  mapping_source: mappingSource,
                  confidence: 0,
                },
                amount: {},
                inventory: { state: 'uncertain' },
              }],
              instructions: {},
              capabilities: {},
            },
          },
        })

        expect(result.kind).toBe('detail')
        if (result.kind !== 'detail') return
        expect(result.detail.ingredients[0].closestMatch).toMatchObject({
          label: 'Italian parsley',
          mappingSource,
          confidence: 0,
        })
      },
    )

    it.each([
      ['taxonomy_rule', 1],
      ['recipe_taxonomy', 1],
      ['semantic_similarity', 0.999],
      [undefined, 1],
    ])('drops hostile or unallowlisted closest_match source %s regardless of confidence', (mappingSource, confidence) => {
      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            schema_version: 'recipe_detail_v1',
            id: 46,
            title: 'Broad Taxonomy Label',
            source: {},
            images: {},
            general: {},
            ingredients: [{
              key: 'ri:0:0123456789abcdef',
              position: 0,
              name: 'herbs',
              closest_match: {
                label: 'High-confidence broad label',
                mapping_source: mappingSource,
                confidence,
              },
              amount: {},
              inventory: { state: 'uncertain' },
            }],
            instructions: {},
            capabilities: {},
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.ingredients[0].closestMatch).toBeNull()
    })

    it('enforces Cookidoo external-only instructions without reading a steps fixture', () => {
      const inaccessibleSteps: unknown[] = []
      Object.defineProperty(inaccessibleSteps, '0', {
        configurable: true,
        get: () => {
          throw new Error('Cookidoo step text must not be read')
        },
      })
      inaccessibleSteps.length = 1
      const hostileInstructions: Record<string, unknown> = {
        available: true,
        steps: inaccessibleSteps,
        fallback_url: 'https://cookidoo.example.test/recipes/7',
      }
      Object.defineProperty(hostileInstructions, 'instruction_groups', {
        configurable: true,
        get: () => {
          throw new Error('Cookidoo instruction groups must not be read')
        },
      })

      const result = normalizeRecipeDetailServiceResult({
        response: {
          success: true,
          detail: {
            schema_version: 'recipe_detail_v1',
            id: 7,
            title: 'Provider Recipe',
            source: {
              connector: 'cookidoo',
              label: 'Cookidoo',
              attribution: 'Cookidoo',
              canonical_url: 'https://cookidoo.example.test/recipes/7',
            },
            images: {},
            general: {},
            ingredients: [],
            instructions: hostileInstructions,
            capabilities: {
              general: 'none',
              ingredients: 'none',
              instructions: 'local',
              quantities: 'unknown',
              grocery_add: false,
            },
          },
        },
      })

      expect(result.kind).toBe('detail')
      if (result.kind !== 'detail') return
      expect(result.detail.capabilities.instructions).toBe('external_link')
      expect(result.detail.instructions).toMatchObject({
        available: false,
        reason: 'provider_external_only',
        steps: [],
        groups: [],
        fallbackUrl: 'https://cookidoo.example.test/recipes/7',
      })
    })

    it('returns structured unsupported and invalid-response states safely', () => {
      expect(normalizeRecipeDetailServiceResult({
        response: {
          success: false,
          error_kind: 'unsupported',
          required_capability: 'recipe_detail_v1',
          message: 'Backend capability is missing',
        },
      })).toEqual({
        kind: 'unsupported',
        errorKind: 'unsupported',
        requiredCapability: 'recipe_detail_v1',
        message: 'Backend capability is missing',
      })

      expect(normalizeRecipeDetailServiceResult({ response: { success: true, detail: [] } })).toMatchObject({
        kind: 'error',
        errorKind: 'invalid_response',
      })
    })

    it('gives explicit transient error kinds precedence over capability hints and hostile codes', () => {
      expect(normalizeRecipeDetailServiceResult({
        response: {
          success: false,
          error_kind: 'unavailable',
          error: 'unsupported_capability',
          required_capability: 'recipe_detail_v1',
          message: 'Capability probe timed out',
        },
      })).toEqual({
        kind: 'error',
        errorKind: 'unavailable',
        requiredCapability: 'recipe_detail_v1',
        message: 'Capability probe timed out',
      })

      expect(normalizeRecipeDetailServiceResult({
        response: {
          success: false,
          errorKind: 'error',
          error: 'unsupported_capability',
          requiredCapability: 'recipe_detail_v1',
          message: 'Temporary backend failure',
        },
      })).toMatchObject({
        kind: 'error',
        errorKind: 'error',
      })

      expect(normalizeRecipeDetailServiceResult({
        response: {
          success: false,
          required_capability: 'recipe_detail_v1',
        },
      })).toMatchObject({
        kind: 'error',
        errorKind: null,
        requiredCapability: 'recipe_detail_v1',
      })

      expect(normalizeRecipeDetailServiceResult({
        response: {
          success: false,
          error: 'unsupported_capability',
          required_capability: 'recipe_detail_v1',
        },
      })).toMatchObject({
        kind: 'unsupported',
        errorKind: null,
      })

      expect(normalizeRecipeGroceryServiceResult({
        response: {
          success: false,
          error_kind: 'unavailable',
          error: 'unsupported_capability',
          required_capability: 'recipe_grocery_v1',
          message: 'Grocery capability probe timed out',
        },
      })).toEqual({
        kind: 'error',
        errorKind: 'unavailable',
        requiredCapability: 'recipe_grocery_v1',
        message: 'Grocery capability probe timed out',
      })
    })

    it('normalizes full and partial grocery summaries and builds missing-only service data', () => {
      expect(normalizeRecipeGroceryServiceResult({
        response: {
          success: false,
          partial_failure: true,
          replayed: false,
          summary: {
            backend: { added: 2, already_listed: 1, failed: 0 },
            ha_mirror: { added: 1, already_present: 1, skipped: 0, failed: 1 },
          },
          ha_mirror: {
            message: 'One mirror failed',
            outcomes: [
              {
                key: 'ri:2:0123456789abcdef',
                name: 'Yellow onion',
                outcome: 'already_present',
              },
              {
                key: '!invalid',
                name: 'Ignored',
                outcome: 'added',
              },
            ],
          },
        },
      })).toEqual({
        kind: 'result',
        success: false,
        partialFailure: true,
        replayed: false,
        outcomesTruncated: false,
        backend: {
          added: 2,
          alreadyListed: 1,
          nowInStock: 0,
          unresolved: 0,
          failed: 0,
        },
        backendMessage: null,
        haMirror: {
          added: 1,
          alreadyPresent: 1,
          skipped: 0,
          failed: 1,
        },
        haMirrorOutcomes: [{
          key: 'ri:2:0123456789abcdef',
          name: 'Yellow onion',
          outcome: 'already_present',
        }],
        haMirrorMessage: 'One mirror failed',
      })

      const backendMessage = `Backend partial failure: ${'x'.repeat(600)}`
      const mirrorMessage = `Mirror partial failure: ${'y'.repeat(600)}`
      expect(normalizeRecipeGroceryServiceResult({
        response: {
          success: false,
          partial_failure: true,
          backend_message: backendMessage,
          summary: {
            backend: { added: 1, failed: 0 },
            ha_mirror: { added: 1, failed: 0 },
          },
          ha_mirror: { message: mirrorMessage },
        },
      })).toMatchObject({
        kind: 'result',
        backendMessage: backendMessage.slice(0, 500),
        haMirrorMessage: mirrorMessage.slice(0, 500),
      })

      expect(recipeDetailServiceData(42)).toEqual({ recipe_id: 42 })
      expect(recipeGroceryServiceData(42, [
        { key: 'ri:2:0123456789abcdef', position: 2 },
        { key: 'invalid', position: 3 },
      ], 'react-recipe:42:one')).toEqual({
        recipe_id: 42,
        selections: [{ key: 'ri:2:0123456789abcdef', position: 2 }],
        idempotency_key: 'react-recipe:42:one',
        todo_entity_id: 'todo.shopping_list',
      })
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
