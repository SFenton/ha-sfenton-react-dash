import { callRecipeService, recipeServiceErrorIsUnavailable } from './recipeService'

describe('recipeService development fallback', () => {
  it('uses the same-origin EverShelf proxy when HA lacks recipe services', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => ({
        success: true,
        kind: 'browse',
        items: [{ id: 1, title: 'Proxy Recipe' }],
      }),
      ok: true,
      status: 200,
      url: String(input),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await callRecipeService(
        () => Promise.reject({
          code: 'not_found',
          message: 'Service evershelf.recipe_query not found.',
        }),
        'recipe_query',
        {
          kind: 'browse',
          q: 'chicken',
          sort: 'availability',
          limit: 50,
        },
      )

      expect(result).toMatchObject({ success: true, kind: 'browse' })
      expect(String(fetchMock.mock.calls[0][0])).toContain('/__evershelf/api/index.php?')
      expect(String(fetchMock.mock.calls[0][0])).toContain('q=chicken')
      expect(String(fetchMock.mock.calls[0][0])).toContain('fields=card')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps development hydration nonblocking when the local proxy has no connector', async () => {
    await expect(callRecipeService(
      () => Promise.reject(new Error('Service evershelf.recipe_hydration not found')),
      'recipe_hydration',
      { query: 'chicken' },
    )).resolves.toMatchObject({
      status: 'complete',
      remote_exhausted: true,
      new_items: [],
    })
  })

  it('does not mistake ordinary named-service failures for missing capabilities', () => {
    expect(recipeServiceErrorIsUnavailable(
      new Error('evershelf.recipe_detail failed because the recipe was not found'),
      'recipe_detail',
    )).toBe(false)
    expect(recipeServiceErrorIsUnavailable(
      new Error('evershelf.recipe_detail failed because the backend timed out'),
      'recipe_detail',
    )).toBe(false)
    expect(recipeServiceErrorIsUnavailable(
      new Error('Service evershelf.recipe_detail not found'),
      'recipe_detail',
    )).toBe(true)
    expect(recipeServiceErrorIsUnavailable({
      error_kind: 'unavailable',
      error: 'unsupported_capability',
      required_capability: 'recipe_detail_v1',
      message: 'recipe_detail_v1 capability probe timed out',
    }, 'recipe_detail')).toBe(false)
    expect(recipeServiceErrorIsUnavailable({
      error_kind: 'error',
      error: 'unsupported_capability',
      message: 'Service evershelf.recipe_detail not found',
    }, 'recipe_detail')).toBe(false)
    expect(recipeServiceErrorIsUnavailable({
      error: 'unsupported_capability',
      required_capability: 'recipe_detail_v1',
    }, 'recipe_detail')).toBe(true)
  })

  it('uses bounded GET and POST proxy contracts for detail and grocery services', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => String(input).includes('recipe_catalog_detail')
        ? { success: true, detail: { schema_version: 'recipe_detail_v1', id: 17 } }
        : { success: true, outcomes: [], summary: {} },
      ok: true,
      status: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      await callRecipeService(
        () => Promise.reject(new Error('Service evershelf.recipe_detail not found')),
        'recipe_detail',
        { recipe_id: 17 },
      )
      await callRecipeService(
        () => Promise.reject(new Error('Service evershelf.recipe_grocery_add not found')),
        'recipe_grocery_add',
        {
          recipe_id: 17,
          selections: [{ key: 'ri:0:0123456789abcdef', position: 0 }],
          idempotency_key: 'react-recipe:17:test',
          todo_entity_id: 'todo.shopping_list',
        },
      )

      expect(String(fetchMock.mock.calls[0][0])).toContain('action=recipe_catalog_detail')
      expect(String(fetchMock.mock.calls[0][0])).toContain('id=17')
      expect(fetchMock.mock.calls[1][1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
        recipe_id: 17,
        selections: [{ key: 'ri:0:0123456789abcdef', position: 0 }],
        idempotency_key: 'react-recipe:17:test',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
