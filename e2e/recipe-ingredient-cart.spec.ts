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

async function readComputedButtonStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.backgroundColor,
      boxShadow: style.boxShadow,
      color: style.color,
      opacity: style.opacity,
      transform: style.transform,
    }
  })
}

async function waitTwoAnimationFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
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

test('removing every added ingredient restores the bulk action after a completed bulk add', async ({ page }) => {
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

test('preserves the bulk button\'s enabled computed style through pending individual add and removal interlocks', async ({ page }) => {
  // Reuse the existing `__mockRecipeGroceryDelayMs` mock delay infrastructure so the individual
  // add call can be held pending deterministically instead of racing a real HA round trip.
  await gotoDashboardRoute(page, '/at-a-glance/food?__mockRecipeGroceryDelayMs=1200')
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

  const bulkButton = dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
  const bulkStage = dialog.locator('[data-recipe-grocery-phase="0"]')
  await expect(bulkButton).toBeEnabled()
  await expect(bulkButton).not.toHaveAttribute('data-preserve-disabled-visual')
  await expect(bulkButton).not.toHaveAttribute('aria-busy')

  const enabledStyle = await readComputedButtonStyle(bulkButton)
  const buttonHandleBeforeAdd = await bulkButton.elementHandle()

  const addTomato = dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })
  await addTomato.click()
  await expect(dialog.getByRole('button', { name: 'Adding Canned tomatoes · 1 can to groceries' })).toBeVisible()

  // Same phase-0 stage/button node, natively disabled, but visually preserved and with no bulk
  // aria-busy of its own while the individual row add is in flight.
  await expect(bulkStage).toHaveCount(1)
  const buttonHandleDuringAdd = await bulkButton.elementHandle()
  expect(await page.evaluate(
    ([before, during]) => before === during,
    [buttonHandleBeforeAdd, buttonHandleDuringAdd] as const,
  )).toBe(true)
  await expect(bulkButton).toBeDisabled()
  await expect(bulkButton).toHaveAttribute('data-preserve-disabled-visual', 'true')
  await expect(bulkButton).not.toHaveAttribute('aria-busy')

  const duringAddStyle1 = await readComputedButtonStyle(bulkButton)
  await waitTwoAnimationFrames(page)
  const duringAddStyle2 = await readComputedButtonStyle(bulkButton)
  expect(duringAddStyle1).toEqual(enabledStyle)
  expect(duringAddStyle2).toEqual(enabledStyle)
  expect(await bulkButton.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  expect(await groceryAddCallCount(page)).toBe(1)

  await expect(dialog.getByRole('button', { name: 'Remove Canned tomatoes · 1 can from groceries' })).toBeVisible({ timeout: 3_000 })
  await expect(bulkButton).toBeEnabled()
  await expect(bulkButton).not.toHaveAttribute('data-preserve-disabled-visual')

  // Hold the removal pending deterministically via the generic mock call-service interlock, then
  // resolve it explicitly once the pending-state assertions are captured.
  await page.evaluate(() => window.__mockHass?.setCallServiceOutcome('todo', 'remove_item', 'pending'))
  const buttonHandleBeforeRemove = await bulkButton.elementHandle()
  const removeTomato = dialog.getByRole('button', { name: 'Remove Canned tomatoes · 1 can from groceries' })
  await removeTomato.click()
  await expect(dialog.getByRole('button', { name: 'Removing Canned tomatoes · 1 can from groceries…' })).toBeVisible()

  await expect(bulkStage).toHaveCount(1)
  const buttonHandleDuringRemove = await bulkButton.elementHandle()
  expect(await page.evaluate(
    ([before, during]) => before === during,
    [buttonHandleBeforeRemove, buttonHandleDuringRemove] as const,
  )).toBe(true)
  await expect(bulkButton).toBeDisabled()
  await expect(bulkButton).toHaveAttribute('data-preserve-disabled-visual', 'true')
  await expect(bulkButton).not.toHaveAttribute('aria-busy')

  const duringRemoveStyle1 = await readComputedButtonStyle(bulkButton)
  await waitTwoAnimationFrames(page)
  const duringRemoveStyle2 = await readComputedButtonStyle(bulkButton)
  expect(duringRemoveStyle1).toEqual(enabledStyle)
  expect(duringRemoveStyle2).toEqual(enabledStyle)
  expect(await bulkButton.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  // No duplicate/extra bulk service call was issued while the sibling removal was pending.
  expect(await groceryAddCallCount(page)).toBe(1)

  await page.evaluate(() => window.__mockHass?.resolveCallService('todo', 'remove_item'))
  await expect(dialog.getByRole('button', { name: 'Add Canned tomatoes · 1 can to groceries' })).toBeVisible()
  await expect(bulkButton).toBeEnabled()
  await expect(bulkButton).not.toHaveAttribute('data-preserve-disabled-visual')
})
