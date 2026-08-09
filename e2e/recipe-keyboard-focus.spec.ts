import { expect, test, type Locator, type Page } from '@playwright/test'

type FocusIndicator = {
  boxShadow: string
  outlineColor: string
  outlineStyle: string
  outlineWidth: number
}

type TabControlAuditResult = {
  checks: number
  transitionStates: string[]
  violations: string[]
}

async function focusIndicator(target: Locator): Promise<FocusIndicator> {
  return target.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    }
  })
}

function hasVisibleFocusIndicator(current: FocusIndicator, baseline: FocusIndicator) {
  const visibleOutline = current.outlineStyle !== 'none'
    && current.outlineWidth > 0
    && current.outlineColor !== 'transparent'
    && current.outlineColor !== 'rgba(0, 0, 0, 0)'
  const addedShadow = current.boxShadow !== 'none' && current.boxShadow !== baseline.boxShadow
  return visibleOutline || addedShadow
}

async function expectKeyboardFocusIndicator(page: Page, control: Locator, visualTarget = control) {
  await control.evaluate((element) => (element as HTMLElement).blur())
  const baseline = await focusIndicator(visualTarget)

  await control.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')

  await expect(control).toBeFocused()
  await expect.poll(() => control.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  await expect.poll(async () => hasVisibleFocusIndicator(await focusIndicator(visualTarget), baseline)).toBe(true)
}

async function expectCurrentKeyboardFocusIndicator(
  control: Locator,
  visualTarget: Locator,
  baseline: FocusIndicator,
) {
  await expect(control).toBeFocused()
  await expect.poll(() => control.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  await expect.poll(async () => hasVisibleFocusIndicator(await focusIndicator(visualTarget), baseline)).toBe(true)
}

async function expectSelectedTabControlsMountedPanel(dialog: Locator) {
  const relation = await dialog.evaluate((element) => {
    const selectedTabs = [...element.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')]
    const selectedTab = selectedTabs[0]
    const panelId = selectedTab?.getAttribute('aria-controls') ?? null
    const panel = panelId ? document.getElementById(panelId) : null
    return {
      panelId,
      panelIsInsideDialog: Boolean(panel && element.contains(panel)),
      panelRole: panel?.getAttribute('role') ?? null,
      selectedCount: selectedTabs.length,
      selectedName: selectedTab?.getAttribute('aria-label') ?? null,
    }
  })

  expect(relation.selectedCount).toBe(1)
  expect(relation.panelId).toBeTruthy()
  expect(relation.panelIsInsideDialog).toBe(true)
  expect(relation.panelRole).toBe('tabpanel')
  return relation
}

async function startSelectedTabControlAudit(dialog: Locator) {
  await dialog.evaluate((element) => {
    type AuditState = TabControlAuditResult & {
      check: () => void
      observer: MutationObserver
    }
    type AuditedElement = HTMLElement & { __recipeTabControlAudit?: AuditState }
    const auditedElement = element as AuditedElement
    auditedElement.__recipeTabControlAudit?.observer.disconnect()

    const audit = {
      checks: 0,
      transitionStates: [],
      violations: [],
    } as AuditState
    const check = () => {
      audit.checks += 1
      const selectedTabs = [...element.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')]
      if (selectedTabs.length !== 1) {
        audit.violations.push(`Expected one selected tab, found ${selectedTabs.length}`)
      }
      for (const tab of selectedTabs) {
        const panelId = tab.getAttribute('aria-controls')
        const panel = panelId ? document.getElementById(panelId) : null
        if (!panelId || !panel || !element.contains(panel) || panel.getAttribute('role') !== 'tabpanel') {
          audit.violations.push(`${tab.getAttribute('aria-label') ?? 'Unnamed tab'} controls missing panel ${panelId ?? '(none)'}`)
        }
      }
      const transitionState = element.querySelector<HTMLElement>('[role="tabpanel"]')
        ?.dataset.modalTabTransitionState
      if (transitionState && !audit.transitionStates.includes(transitionState)) {
        audit.transitionStates.push(transitionState)
      }
    }
    const observer = new MutationObserver(check)
    audit.check = check
    audit.observer = observer
    observer.observe(element, { attributes: true, childList: true, subtree: true })
    auditedElement.__recipeTabControlAudit = audit
    check()
  })
}

async function stopSelectedTabControlAudit(dialog: Locator): Promise<TabControlAuditResult> {
  return dialog.evaluate((element) => {
    type AuditState = TabControlAuditResult & {
      check: () => void
      observer: MutationObserver
    }
    type AuditedElement = HTMLElement & { __recipeTabControlAudit?: AuditState }
    const state = (element as AuditedElement).__recipeTabControlAudit
    if (!state) return { checks: 0, transitionStates: [], violations: ['Audit was not started'] }
    state.check()
    state.observer.disconnect()
    return {
      checks: state.checks,
      transitionStates: state.transitionStates,
      violations: state.violations,
    }
  })
}

async function gotoDashboardRoute(page: Page, path: string) {
  await page.goto('/')
  await page.evaluate((nextPath) => {
    window.history.replaceState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function openRecipeDetailWithKeyboard(page: Page) {
  await gotoDashboardRoute(page, '/at-a-glance/food')
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })

  const recipeButton = page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  })
  await expect(recipeButton).toBeVisible()
  await expectKeyboardFocusIndicator(page, recipeButton, recipeButton.locator('div').first())
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  return dialog
}

async function verifyRecipeKeyboardFocus(page: Page) {
  const dialog = await openRecipeDetailWithKeyboard(page)
  const closeButton = dialog.getByRole('button', { name: 'Close' })
  const generalTab = dialog.getByRole('tab', { name: 'General' })
  const ingredientsTab = dialog.getByRole('tab', { name: 'Ingredients' })
  const instructionsTab = dialog.getByRole('tab', { name: 'Instructions' })

  await expectKeyboardFocusIndicator(page, closeButton)
  await expectKeyboardFocusIndicator(page, generalTab)
  await expectKeyboardFocusIndicator(page, dialog.getByRole('link', { name: 'Open Source Recipe' }))

  const ingredientsBaseline = await focusIndicator(ingredientsTab)
  await generalTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  await expectCurrentKeyboardFocusIndicator(ingredientsTab, ingredientsTab, ingredientsBaseline)
  await expectKeyboardFocusIndicator(
    page,
    dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' }),
  )

  const instructionsBaseline = await focusIndicator(instructionsTab)
  await ingredientsTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tabpanel', { name: 'Instructions' })).toBeVisible()
  await expectCurrentKeyboardFocusIndicator(instructionsTab, instructionsTab, instructionsBaseline)
  await expectKeyboardFocusIndicator(page, dialog.getByRole('link', { name: 'Open in Cookidoo' }))
  return dialog
}

test('393x852 coarse-pointer recipe controls keep keyboard focus visible without touch rings', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await expect.poll(() => page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true)
  await gotoDashboardRoute(page, '/at-a-glance/food')
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })

  const recipeButton = page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  })
  await recipeButton.tap()

  const dialog = page.getByRole('dialog', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  const ingredientsTab = dialog.getByRole('tab', { name: 'Ingredients' })
  const tabBaseline = await focusIndicator(ingredientsTab)
  await ingredientsTab.tap()
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  await expect(ingredientsTab).toBeFocused()
  await expect.poll(() => ingredientsTab.evaluate((element) => element.matches(':focus-visible'))).toBe(false)
  expect(hasVisibleFocusIndicator(await focusIndicator(ingredientsTab), tabBaseline)).toBe(false)

  await verifyRecipeKeyboardFocus(page)
})

test('desktop recipe controls keep keyboard focus visible without mouse rings', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5174',
    hasTouch: false,
    isMobile: false,
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()

  try {
    await expect.poll(() => page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(false)
    const dialog = await verifyRecipeKeyboardFocus(page)
    const generalTab = dialog.getByRole('tab', { name: 'General' })
    const tabBaseline = await focusIndicator(generalTab)
    await generalTab.click()
    await expect(dialog.getByRole('tabpanel', { name: 'General' })).toBeVisible()
    await expect(generalTab).toBeFocused()
    await expect.poll(() => generalTab.evaluate((element) => element.matches(':focus-visible'))).toBe(false)
    expect(hasVisibleFocusIndicator(await focusIndicator(generalTab), tabBaseline)).toBe(false)
  } finally {
    await context.close()
  }
})

test('recipe tab aria-controls target stays mounted through animated Arrow, Home, and End navigation', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openRecipeDetailWithKeyboard(page)
  const tabs = dialog.getByRole('tab')
  await expect(tabs).toHaveCount(3)

  const initialRelations = await tabs.evaluateAll((items) => items.map((item) => {
    const panelId = item.getAttribute('aria-controls')
    const panel = panelId ? document.getElementById(panelId) : null
    return {
      panelExists: Boolean(panel),
      panelId,
      panelRole: panel?.getAttribute('role') ?? null,
    }
  }))
  expect(new Set(initialRelations.map(({ panelId }) => panelId)).size).toBe(1)
  expect(initialRelations.every(({ panelExists, panelRole }) => panelExists && panelRole === 'tabpanel')).toBe(true)

  await startSelectedTabControlAudit(dialog)
  const generalTab = dialog.getByRole('tab', { name: 'General' })
  const ingredientsTab = dialog.getByRole('tab', { name: 'Ingredients' })
  const instructionsTab = dialog.getByRole('tab', { name: 'Instructions' })

  await generalTab.focus()
  await page.keyboard.press('ArrowRight')
  expect((await expectSelectedTabControlsMountedPanel(dialog)).selectedName).toBe('Ingredients')
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  await expectSelectedTabControlsMountedPanel(dialog)

  await ingredientsTab.focus()
  await page.keyboard.press('Home')
  expect((await expectSelectedTabControlsMountedPanel(dialog)).selectedName).toBe('General')
  await expect(dialog.getByRole('tabpanel', { name: 'General' })).toBeVisible()
  await expectSelectedTabControlsMountedPanel(dialog)

  await generalTab.focus()
  await page.keyboard.press('End')
  expect((await expectSelectedTabControlsMountedPanel(dialog)).selectedName).toBe('Instructions')
  await expect(dialog.getByRole('tabpanel', { name: 'Instructions' })).toBeVisible()
  await expectSelectedTabControlsMountedPanel(dialog)

  await instructionsTab.focus()
  await page.keyboard.press('ArrowLeft')
  expect((await expectSelectedTabControlsMountedPanel(dialog)).selectedName).toBe('Ingredients')
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()

  const audit = await stopSelectedTabControlAudit(dialog)
  expect(audit.checks).toBeGreaterThan(4)
  expect(audit.transitionStates).toContain('exiting')
  expect(audit.violations).toEqual([])
})
