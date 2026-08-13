type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown
export type RecipeServiceName =
  | 'recipe_detail'
  | 'recipe_grocery_add'
  | 'recipe_hydration'
  | 'recipe_identity_feedback'
  | 'recipe_ingredient_decision'
  | 'recipe_ingredient_override'
  | 'recipe_planner_add'
  | 'recipe_query'

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

async function devRecipeDetail(serviceData: Record<string, unknown>) {
  const params = new URLSearchParams({ action: 'recipe_catalog_detail' })
  appendParam(params, 'id', serviceData.recipe_id)
  return devRecipeFetch(`/__evershelf/api/index.php?${params.toString()}`)
}

async function devRecipeGroceryAdd(serviceData: Record<string, unknown>) {
  const payload = {
    recipe_id: serviceData.recipe_id,
    selections: serviceData.selections,
    idempotency_key: serviceData.idempotency_key,
  }
  return devRecipeFetch('/__evershelf/api/index.php?action=recipe_catalog_grocery_add', {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

async function devRecipeFeedback(
  service: 'recipe_identity_feedback' | 'recipe_ingredient_decision' | 'recipe_ingredient_override',
  serviceData: Record<string, unknown>,
) {
  const action = service === 'recipe_ingredient_override'
    ? 'recipe_catalog_ingredient_override'
    : service === 'recipe_ingredient_decision'
      ? 'recipe_catalog_ingredient_decision'
      : 'recipe_catalog_identity_feedback'
  return devRecipeFetch(`/__evershelf/api/index.php?action=${action}`, {
    body: JSON.stringify(serviceData),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

async function devRecipePlannerAdd(serviceData: Record<string, unknown>) {
  return devRecipeFetch('/__evershelf/api/index.php?action=recipe_catalog_planner_add', {
    body: JSON.stringify(serviceData),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

async function devRecipeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
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

export function recipeServiceErrorIsUnavailable(
  error: unknown,
  service: RecipeServiceName,
) {
  const record = error && typeof error === 'object'
    ? (
        'response' in error && error.response && typeof error.response === 'object'
          ? error.response as Record<string, unknown>
          : 'service_response' in error && error.service_response && typeof error.service_response === 'object'
            ? error.service_response as Record<string, unknown>
            : error as Record<string, unknown>
      )
    : null
  const errorKindValue = record?.error_kind ?? record?.errorKind
  const errorKind = typeof errorKindValue === 'string' ? errorKindValue.trim() : ''
  const errorCodeValue = record?.error
  const errorCode = typeof errorCodeValue === 'string' ? errorCodeValue.trim() : ''
  if (errorKind) return errorKind === 'unsupported'
  if (errorCode === 'unsupported_capability') return true

  const message = error instanceof Error
    ? error.message.toLowerCase()
    : error && typeof error === 'object'
      ? `${String((error as { code?: unknown }).code ?? '')} ${String((error as { message?: unknown }).message ?? '')}`.toLowerCase()
      : String(error).toLowerCase()
  const serviceMentioned = message.includes(service) || message.includes(`evershelf.${service}`)
  const namedServiceNotFound = message.includes(`service evershelf.${service} not found`)
    || message.includes(`service ${service} not found`)
    || message.includes(`evershelf.${service} service not found`)
    || message.includes(`${service} service not found`)
  const unavailableLanguage = message.includes('does not exist')
    || message.includes('unknown service')
    || message.includes('unsupported service')
  return namedServiceNotFound
    || (serviceMentioned && unavailableLanguage)
    || message.includes('service not found')
    || message.includes('unknown service')
}

export async function callRecipeService(
  callService: CallService,
  service: RecipeServiceName,
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
    if (!import.meta.env.DEV || !recipeServiceErrorIsUnavailable(error, service)) {
      throw error
    }
    if (service === 'recipe_query') return devRecipeQuery(serviceData)
    if (service === 'recipe_hydration') return devHydrationResult()
    if (service === 'recipe_detail') return devRecipeDetail(serviceData)
    if (service === 'recipe_grocery_add') return devRecipeGroceryAdd(serviceData)
    if (service === 'recipe_planner_add') return devRecipePlannerAdd(serviceData)
    return devRecipeFeedback(service, serviceData)
  }
}
