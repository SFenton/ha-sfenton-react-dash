type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return
  params.set(key, String(value))
}

async function devRecipeQuery(serviceData: Record<string, unknown>) {
  const recommendations = serviceData.kind === 'recommendations'
  const params = new URLSearchParams({
    action: recommendations
      ? 'recipe_catalog_recommendations'
      : 'recipe_catalog_search',
  })
  for (const [key, value] of Object.entries(serviceData)) {
    if (key === 'kind') continue
    appendParam(params, key, value)
  }
  if (!recommendations) {
    params.set('fields', 'card')
    params.set('explain', 'false')
  }
  const response = await fetch(`/__evershelf/api/index.php?${params.toString()}`)
  const result = await response.json() as Record<string, unknown>
  if (!response.ok || result.success === false) {
    throw new Error(String(result.message ?? result.error ?? `EverShelf HTTP ${response.status}`))
  }
  return result
}

function devHydrationResult() {
  return {
    success: true,
    search_id: '',
    status: 'complete',
    imported_count: 0,
    updated_count: 0,
    pages_scanned: 0,
    remote_has_more: false,
    remote_exhausted: true,
    queue_position: null,
    next_poll_ms: 0,
    new_items: [],
    error: null,
  }
}

function isUnavailableRecipeService(
  error: unknown,
  service: 'recipe_hydration' | 'recipe_query',
) {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : error && typeof error === 'object'
      ? `${String((error as { code?: unknown }).code ?? '')} ${String((error as { message?: unknown }).message ?? '')}`.toLowerCase()
      : String(error).toLowerCase()
  return message.includes(service)
    || message.includes('recipe_catalog_v2')
    || message.includes('service not found')
    || message.includes('unknown service')
}

export async function callRecipeService(
  callService: CallService,
  service: 'recipe_hydration' | 'recipe_query',
  serviceData: Record<string, unknown>,
) {
  try {
    return await callService({
      domain: 'evershelf',
      service,
      serviceData,
      returnResponse: true,
    })
  } catch (error) {
    if (!import.meta.env.DEV || !isUnavailableRecipeService(error, service)) {
      throw error
    }
    return service === 'recipe_query'
      ? devRecipeQuery(serviceData)
      : devHydrationResult()
  }
}
