import { expect, test, type Locator, type Page } from '@playwright/test'
import { RESPONSIVE_ROUTES, RESPONSIVE_ROUTE_TITLES } from './responsive-acceptance-data'

const DESKTOP_VIEWPORTS = [
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
] as const

async function waitForRoute(page: Page, route: string) {
  const root = page.locator(`[data-route-path="${route}"]`)
  await expect(root).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
  await expect(root.getByRole('heading', { level: 1, name: RESPONSIVE_ROUTE_TITLES.get(route) })).toBeVisible()
  return root
}

async function navigateRoute(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    const url = new URL(window.location.href)
    url.searchParams.set('path', nextRoute)
    url.hash = ''
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  return waitForRoute(page, route)
}

async function visibleFocusIndicator(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return (
      (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
      || style.boxShadow !== 'none'
    )
  })
}

test('all routes remain contained in a fine-pointer desktop context', async ({ page }) => {
  test.setTimeout(180_000)
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
    await waitForRoute(page, 'overview')

    for (const route of RESPONSIVE_ROUTES) {
      const root = route === 'overview' ? await waitForRoute(page, route) : await navigateRoute(page, route)
      const overflow = await root.evaluate((element) => {
        const scroller = element.querySelector<HTMLElement>('[data-page-scroller="true"]')
        return {
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fallback: element.textContent?.includes('is not available in the React dashboard yet.') ?? false,
          scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
        }
      })
      expect(overflow.document, `${route} document overflow`).toBeLessThanOrEqual(1)
      expect(overflow.scroller, `${route} page overflow`).toBeLessThanOrEqual(1)
      expect(overflow.fallback, `${route} fallback content`).toBe(false)
    }
  }
})

test('floating action docks align to reading, dashboard, and media content measures', async ({ page }) => {
  const routes = ['overview', 'groceries', 'food'] as const

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })

    for (const route of routes) {
      const root = route === 'overview' ? await waitForRoute(page, route) : await navigateRoute(page, route)
      const content = root.locator('[data-page-content="true"]')
      const dock = page.locator('[data-floating-action-dock="true"]')
      const [contentBox, dockBox] = await Promise.all([content.boundingBox(), dock.boundingBox()])
      expect(contentBox).not.toBeNull()
      expect(dockBox).not.toBeNull()
      expect(Math.abs((dockBox?.x ?? 0) - (contentBox?.x ?? 0)), `${route} dock left edge`).toBeLessThanOrEqual(1)
      expect(Math.abs((dockBox?.x ?? 0) + (dockBox?.width ?? 0) - ((contentBox?.x ?? 0) + (contentBox?.width ?? 0))), `${route} dock right edge`).toBeLessThanOrEqual(1)
    }
  }
})

test('Food and Recipes keeps All Recipes full-width and issues one measured recommendation query', async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
    await page.evaluate(() => {
      window.__mockHass?.calls.splice(0)
    })
    const root = await navigateRoute(page, 'food')
    await expect(root.getByRole('heading', { name: 'Suggested Recipes' })).toBeVisible({ timeout: 15_000 })

    const content = root.locator('[data-page-content="true"]')
    const allRecipes = root.getByRole('region', { name: 'All Recipes' })
    const [contentBox, allRecipesBox] = await Promise.all([content.boundingBox(), allRecipes.boundingBox()])
    expect(contentBox).not.toBeNull()
    expect(allRecipesBox).not.toBeNull()
    expect(Math.abs((allRecipesBox?.x ?? 0) - (contentBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((allRecipesBox?.width ?? 0) - (contentBox?.width ?? 0))).toBeLessThanOrEqual(1)

    const carousel = root.locator('[data-card-carousel="true"]')
    const columns = Number(await carousel.getAttribute('data-columns'))
    const expectedLimit = columns * 2 * 5
    await expect.poll(() => page.evaluate(() => (
      window.__mockHass?.calls.filter((call) =>
        call.domain === 'evershelf'
        && call.service === 'recipe_query'
        && call.serviceData?.kind === 'recommendations'
      ).map((call) => call.serviceData?.limit) ?? []
    ))).toEqual([expectedLimit])
  }
})

test('permanent navigation and modal controls retain keyboard focus indicators', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
  const home = page.locator('[data-adaptive-navigation="rail"]').getByRole('button', { name: 'Home' })
  await page.keyboard.press('Tab')
  await expect(home).toBeFocused()
  await expect.poll(() => visibleFocusIndicator(home)).toBe(true)

  const quickLinks = page.getByRole('button', { name: 'Quick Links' })
  await quickLinks.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expect(dialog).toBeVisible()
  const close = dialog.getByRole('button', { name: 'Close' })
  await close.focus()
  await expect(close).toBeFocused()
  await expect.poll(() => visibleFocusIndicator(close)).toBe(true)
})

test('unavailable vacuum status stays truthful in a fine-pointer desktop context', async ({ page }) => {
  await page.goto('/index.html?path=vacuums')
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })
  await page.evaluate(() => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'unavailable')
    mock.setEntityState('camera.valetudo_elatedusedram_map_data', 'unavailable')
    mock.setEntityState('input_text.music_room_vacuum_error_message', 'The battery is critically low and the vacuum will shut down soon.')
    mock.calls.splice(0, mock.calls.length)
  })

  await page.getByRole('button', { name: 'Music Room', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Unavailable')).toContainText('Home Assistant does not have a current status for the vacuum.')
  await expect(dialog.getByRole('region', { name: 'Music Room Valetudo map' })).toHaveAttribute('data-source-available', 'false')
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
  expect(await page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])

  const close = dialog.getByRole('button', { name: 'Close' })
  await expect(close).toBeVisible()
})
