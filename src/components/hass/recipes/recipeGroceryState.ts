import type { RecipeDetail } from './recipeTypes'

export const RECIPE_GROCERY_MAX_SELECTIONS = 100
export const RECIPE_GROCERY_UNSUPPORTED_MESSAGE = 'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.'

export type RecipeGroceryRequestStatus = 'error' | 'idle' | 'loading' | 'success'

export function recipeGroceryDisabledReason(
  detail: RecipeDetail,
  groceryStatus: RecipeGroceryRequestStatus,
  grocerySubmitted: boolean,
) {
  if (groceryStatus === 'loading') return 'Adding missing ingredients…'
  if (grocerySubmitted) return 'Missing ingredients were submitted.'
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
  if (detail.grocery.confirmedMissingCount > RECIPE_GROCERY_MAX_SELECTIONS) return 'Too many missing ingredients to add in one request.'
  if (detail.grocery.confirmedMissingCount === 0 && detail.grocery.uncertainCount > 0) {
    return `EverShelf can't yet tell which of these ${detail.grocery.uncertainCount} ingredients you're missing.`
  }
  if (detail.grocery.confirmedMissingCount === 0) return 'No missing ingredients to add.'
  return null
}
