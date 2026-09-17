import type { RecipeDetail, RecipeDetailIngredient } from './recipeTypes'

export const RECIPE_GROCERY_MAX_SELECTIONS = 100
export const RECIPE_GROCERY_UNSUPPORTED_MESSAGE = 'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.'
// Home Assistant owns the mirrored grocery list; the recipe cart resolves and removes items
// from this same entity, matching the convention used by TodoListPanel and the food-page floating action.
export const RECIPE_GROCERY_TODO_ENTITY_ID = 'todo.shopping_list'

export type RecipeGroceryRequestStatus = 'error' | 'idle' | 'loading' | 'success'

const EMPTY_ADDED_KEYS: ReadonlySet<string> = new Set()

interface RecipeGroceryActionableCounts {
  actionableMissingCount: number
  addedSuppressedCount: number
  effectiveMissingCount: number
  overrideSuppressedCount: number
}

export function recipeGroceryRequestIsLoading(status: RecipeGroceryRequestStatus) {
  return status === 'loading'
}

// An ingredient can be added to groceries (individually or in bulk) when the effective UI state
// says it is missing: either EverShelf marked it missing or the user explicitly overrode it back
// to missing. A "have" override always suppresses grocery actions until that state is cleared.
export function recipeIngredientIsGroceryEligible(ingredient: RecipeDetailIngredient) {
  if (ingredient.userOverride?.availability === 'have') return false
  if (ingredient.userOverride?.availability === 'missing') return true
  return ingredient.inventory.state === 'missing'
}

export function recipeIngredientIsIndividualGroceryEligible(ingredient: RecipeDetailIngredient) {
  if (ingredient.userOverride?.availability === 'have') return false
  if (ingredient.userOverride?.availability === 'missing') return true
  return ingredient.inventory.state === 'missing' || ingredient.inventory.state === 'uncertain'
}

export function recipeActionableMissingIngredients(
  detail: RecipeDetail,
  addedIngredientKeys: ReadonlySet<string> = EMPTY_ADDED_KEYS,
) {
  return detail.ingredients.filter((ingredient) => (
    recipeIngredientIsGroceryEligible(ingredient)
    && !addedIngredientKeys.has(ingredient.key)
  ))
}

// Recipe-wide reasons the grocery feature is unavailable regardless of which ingredients are
// missing. These gate both the bulk action and every individual row control.
export function recipeGroceryCapabilityBlockedReason(detail: RecipeDetail, groceryStatus: RecipeGroceryRequestStatus) {
  if (recipeGroceryRequestIsLoading(groceryStatus)) return 'Adding missing ingredients…'
  if (
    detail.grocery.blockedReason === 'ingredients_truncated'
    || (detail.grocery.blockedReason !== 'no_ingredients' && detail.ingredientsTruncated)
  ) {
    return 'Ingredients are truncated, so groceries cannot be added safely.'
  }
  if (detail.grocery.blockedReason === 'no_ingredients') {
    return 'No ingredient data is available, so groceries cannot be added.'
  }
  if (detail.capabilities.groceryAddState === 'unavailable') {
    return 'Adding missing ingredients is temporarily unavailable. Try again later.'
  }
  if (
    detail.capabilities.groceryAddState === 'unsupported'
    || detail.capabilities.groceryAddReason === 'unsupported'
  ) {
    return RECIPE_GROCERY_UNSUPPORTED_MESSAGE
  }
  if (detail.capabilities.ingredients === 'none') {
    return 'No ingredient data is available, so groceries cannot be added.'
  }
  if (!detail.capabilities.groceryAdd) return 'Adding missing ingredients is unavailable for this recipe.'
  return null
}

export function recipeGroceryDisabledReason(
  detail: RecipeDetail,
  groceryStatus: RecipeGroceryRequestStatus,
  addedIngredientKeys: ReadonlySet<string> = EMPTY_ADDED_KEYS,
) {
  const capabilityBlocked = recipeGroceryCapabilityBlockedReason(detail, groceryStatus)
  if (capabilityBlocked) return capabilityBlocked

  const { actionableMissingCount } = recipeGroceryActionableCounts(detail, addedIngredientKeys)
  if (actionableMissingCount > RECIPE_GROCERY_MAX_SELECTIONS) return 'Too many missing ingredients to add in one request.'
  if (recipeGroceryAddedIngredientsExhausted(detail, addedIngredientKeys)) {
    return 'All missing ingredients have already been added to groceries.'
  }
  if (detail.grocery.confirmedMissingCount > 0 && actionableMissingCount === 0) {
    return 'All confirmed missing ingredients are marked as available by your overrides.'
  }
  if (actionableMissingCount === 0 && detail.grocery.uncertainCount > 0) {
    return `EverShelf can't yet tell which of these ${detail.grocery.uncertainCount} ingredients you're missing.`
  }
  if (actionableMissingCount === 0) return 'No missing ingredients to add.'
  return null
}

function recipeGroceryActionableCounts(
  detail: RecipeDetail,
  addedIngredientKeys: ReadonlySet<string>,
): RecipeGroceryActionableCounts {
  const confirmedMissingIngredients = detail.ingredients.filter((ingredient) => ingredient.inventory.state === 'missing')
  const derivedEffectiveMissingIngredients = detail.ingredients.filter(recipeIngredientIsGroceryEligible)
  const overrideSuppressedCount = confirmedMissingIngredients.filter(
    (ingredient) => ingredient.userOverride?.availability === 'have',
  ).length
  const overridePromotedCount = detail.ingredients.filter((ingredient) => (
    ingredient.inventory.state !== 'missing'
    && ingredient.userOverride?.availability === 'missing'
  )).length
  const effectiveMissingCount = Math.max(0, detail.grocery.confirmedMissingCount - overrideSuppressedCount)
    + overridePromotedCount
  const addedSuppressedCount = derivedEffectiveMissingIngredients.filter(
    (ingredient) => addedIngredientKeys.has(ingredient.key),
  ).length
  const actionableMissingCount = Math.max(
    0,
    effectiveMissingCount - addedSuppressedCount,
  )
  return {
    actionableMissingCount,
    addedSuppressedCount,
    effectiveMissingCount,
    overrideSuppressedCount,
  }
}

export function recipeGroceryAddedIngredientsExhausted(
  detail: RecipeDetail,
  addedIngredientKeys: ReadonlySet<string> = EMPTY_ADDED_KEYS,
) {
  const {
    actionableMissingCount,
    addedSuppressedCount,
    effectiveMissingCount,
    overrideSuppressedCount,
  } = recipeGroceryActionableCounts(detail, addedIngredientKeys)
  return (
    effectiveMissingCount > 0
    && actionableMissingCount === 0
    && addedSuppressedCount > 0
    && overrideSuppressedCount === 0
  )
}

export type RecipeIngredientGroceryRowState = 0 | 1 | 2 | 3 | 4
export const RECIPE_INGREDIENT_GROCERY_ROW_STATE = {
  IDLE: 0,
  ADDING: 1,
  ADDED: 2,
  INELIGIBLE: 3,
  REMOVING: 4,
} as const satisfies Record<string, RecipeIngredientGroceryRowState>

// Every ingredient row gets a slot for the add/remove control, but the control is only
// interactive while the row-level policy allows it (confirmed/override-missing plus uncertain
// matches) and the recipe-wide grocery capability is not blocked.
export function recipeIngredientGroceryRowState(
  ingredient: RecipeDetailIngredient,
  detail: RecipeDetail,
  groceryStatus: RecipeGroceryRequestStatus,
  addedIngredientKeys: ReadonlySet<string>,
  individualGroceryPendingKeys: ReadonlySet<string>,
  individualGroceryRemovingKeys: ReadonlySet<string> = EMPTY_ADDED_KEYS,
): RecipeIngredientGroceryRowState {
  // A row stays "added" (trash control) while its Home Assistant removal is confirming, and only
  // reverts to the cart control after the remove_item call actually succeeds.
  if (individualGroceryRemovingKeys.has(ingredient.key)) return RECIPE_INGREDIENT_GROCERY_ROW_STATE.REMOVING
  if (addedIngredientKeys.has(ingredient.key)) return RECIPE_INGREDIENT_GROCERY_ROW_STATE.ADDED
  if (individualGroceryPendingKeys.has(ingredient.key)) return RECIPE_INGREDIENT_GROCERY_ROW_STATE.ADDING
  if (!recipeIngredientIsIndividualGroceryEligible(ingredient)) return RECIPE_INGREDIENT_GROCERY_ROW_STATE.INELIGIBLE
  if (recipeGroceryCapabilityBlockedReason(detail, groceryStatus)) return RECIPE_INGREDIENT_GROCERY_ROW_STATE.INELIGIBLE
  return RECIPE_INGREDIENT_GROCERY_ROW_STATE.IDLE
}

export interface RecipeGroceryTodoItem {
  uid?: string
  summary?: string
  status?: string
}

function normalizedGroceryText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

// Only normalized exact matches are safe here: substring matching could remove a different item
// when the Grocery List contains overlapping names such as "onion" and "onion powder".
export function recipeGroceryTodoItemMatchesIngredient(
  item: RecipeGroceryTodoItem,
  ingredient: RecipeDetailIngredient,
  mirroredName?: string,
) {
  const summary = typeof item.summary === 'string' ? normalizedGroceryText(item.summary) : ''
  if (!summary) return false
  const candidates = [mirroredName, ingredient.displayName, ingredient.name]
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map((candidate) => normalizedGroceryText(candidate))
    .filter(Boolean)
  return candidates.some((candidate) => candidate === summary)
}

export function findMatchingGroceryTodoItem(
  items: readonly RecipeGroceryTodoItem[],
  ingredient: RecipeDetailIngredient,
  mirroredName?: string,
) {
  return items.find((item) => (
    item.status !== 'completed'
    && recipeGroceryTodoItemMatchesIngredient(item, ingredient, mirroredName)
  )) ?? null
}
