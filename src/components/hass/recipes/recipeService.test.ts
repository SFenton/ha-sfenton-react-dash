import { callRecipeService } from './recipeService'

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
})
