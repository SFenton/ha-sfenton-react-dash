import { expect, test, type Locator, type Page } from './layout/fixture'

// @covers src/components/hass/recipes/RecipeDetailModal.tsx
// @covers src/components/hass/recipes/RecipeDetailModal.module.css
// @covers src/components/hass/recipes/recipeGroceryState.ts
// @covers src/components/hass/recipes/useRecipeDetailModal.ts
// @covers src/i18n/locales/en/modals/recipe.json
// @covers src/test/mocks/hakitCoreState.ts

async function gotoDashboardRoute(page: Page, path: string) {
  await page.goto('/')
  await page.evaluate((nextPath) => {
    window.history.replaceState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function openIngredientsTab(page: Page): Promise<Locator> {
  await gotoDashboardRoute(page, '/at-a-glance/food')
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })
  await page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Ingredients' }).click()
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  return dialog
}

async function groceryAddCalls(page: Page) {
  return page.evaluate(() => (window.__mockHass?.calls ?? []).filter((call) => (
    (call as { domain?: string }).domain === 'evershelf'
    && (call as { service?: string }).service === 'recipe_grocery_add'
  )))
}

async function groceryAddCallCount(page: Page) {
  return (await groceryAddCalls(page)).length
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => window.__mockHass?.calls.splice(0))
})

test('every ingredient row exposes an add-to-groceries control only for actionable missing ingredients', async ({ page }) => {
  const dialog = await openIngredientsTab(page)

  await expect(dialog.getByRole('button', { name: /^Add .+ to groceries$/ })).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add Yellow Onion · 1 small to groceries' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Remove .+ from groceries$/ })).toHaveCount(0)
})

test('adding a single ingredient shows its trash control, skips it from the bulk action, and removing it restores the cart control', async ({ page }) => {
  const dialog = await openIngredientsTab(page)

  const addTomato = dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })
  await addTomato.click()
  const removeTomato = dialog.getByRole('button', { name: 'Remove Canned tomatoes · 1 can from groceries' })
  await expect(removeTomato).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add Yellow Onion · 1 small to groceries' })).toBeVisible()

  const individualCalls = await groceryAddCalls(page)
  expect(individualCalls).toHaveLength(1)
  expect((individualCalls[0] as { serviceData?: { selections?: unknown[] } }).serviceData?.selections).toEqual([
    expect.objectContaining({ key: expect.stringContaining('ri:0:') }),
  ])

  const bulkButton = dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
  await expect(bulkButton).toBeEnabled()
  const callCountBeforeBulk = await groceryAddCallCount(page)
  await bulkButton.click()
  await expect(dialog.getByRole('button', { name: 'Remove Yellow Onion · 1 small from groceries' })).toBeVisible()

  const callsAfterBulk = await groceryAddCalls(page)
  const bulkCalls = callsAfterBulk.slice(callCountBeforeBulk)
  expect(bulkCalls).toHaveLength(1)
  const lastBulkCall = bulkCalls[0] as { serviceData?: { selections?: { key?: string }[] } }
  const bulkKeys = lastBulkCall.serviceData?.selections?.map((selection) => selection.key) ?? []
  expect(bulkKeys.some((key) => key?.startsWith('ri:0:'))).toBe(false)
  expect(bulkKeys.some((key) => key?.startsWith('ri:5:'))).toBe(true)

  await removeTomato.click()
  await expect(dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Remove Canned tomatoes · 1 can from groceries' })).toHaveCount(0)
})

test('removing every added ingredient fades the bulk action back in after a completed bulk add', async ({ page }) => {
  const dialog = await openIngredientsTab(page)

  // Install the mocked clock before the success feedback schedules its hold/fade/collapse timers
  // so fast-forwarding actually advances them deterministically instead of racing real timers.
  await page.clock.install()

  const bulkButton = dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
  await bulkButton.click()
  const removeTomato = dialog.getByRole('button', { name: 'Remove Canned tomatoes · 1 can from groceries' })
  const removeOnion = dialog.getByRole('button', { name: 'Remove Yellow Onion · 1 small from groceries' })
  await expect(removeTomato).toBeVisible()
  await expect(removeOnion).toBeVisible()

  // The bulk command stage collapses to height 0 once the success feedback finishes its hold and
  // fade-out.
  await page.clock.fastForward(4_000)
  await expect(dialog.locator('[data-recipe-grocery-complete="true"]')).toBeVisible()

  await removeOnion.click()
  await expect(dialog.getByRole('button', { name: 'Add Yellow Onion · 1 small to groceries' })).toBeVisible()
  const reopenedStage = dialog.locator('[data-recipe-grocery-phase]').first()
  await expect(reopenedStage).toHaveAttribute('data-recipe-grocery-phase', '0')
  await expect(dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })).toBeEnabled()

  await removeTomato.click()
  await expect(dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })).toBeVisible()
})
