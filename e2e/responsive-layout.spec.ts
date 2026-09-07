import { expect, test, type Page } from './layout/fixture'
import { RESPONSIVE_ROUTES } from './responsive-acceptance-data'
import { setSafeAreaInsets } from './safe-area'

async function setRoute(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    const url = new URL(window.location.href)
    url.searchParams.set('path', nextPath)
    url.hash = ''
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForTimeout(220)
}

test('preserves the approved 393x852 Home geometry', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/index.html?path=overview')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  const geometry = await page.evaluate(() => {
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect()
      return rect ? {
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      } : null
    }
    return {
      bottomNav: box(document.querySelector('[data-adaptive-navigation="bottom"]')),
      camera: box(document.querySelector('button[aria-label$=" camera"]')),
      menu: box(document.querySelector('button[aria-label="Open navigation menu"]')),
      profile: box(document.querySelector('button[aria-label^="Open Stephen"]')),
      scroller: box(document.querySelector('[data-page-scroller="true"]')),
      weather: box(document.querySelector('button[aria-label^="Open seven-day weather forecast"]')),
    }
  })

  expect(geometry).toEqual({
    bottomNav: { height: 62, width: 365, x: 14, y: 778 },
    camera: { height: 135, width: 174, x: 17, y: 443 },
    menu: { height: 28, width: 28, x: 10, y: 30 },
    profile: { height: 38, width: 38, x: 339, y: 25 },
    scroller: { height: 612, width: 393, x: 0, y: 154 },
    weather: { height: 222, width: 361, x: 16, y: 166 },
  })
})

test('preserves the approved 393x852 Food tile geometry', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/index.html?path=food')
  await expect(page.getByRole('heading', { name: 'Suggested Recipes' })).toBeVisible({ timeout: 15_000 })

  const [allRecipes, allFood] = await Promise.all([
    page.getByRole('button', { exact: true, name: 'All Recipes' }).boundingBox(),
    page.getByRole('button', { name: /^All Food / }).boundingBox(),
  ])
  expect(allRecipes && {
    height: Math.round(allRecipes.height),
    width: Math.round(allRecipes.width),
    x: Math.round(allRecipes.x),
  }).toEqual({ height: 120, width: 361, x: 16 })
  expect(allFood && {
    height: Math.round(allFood.height),
    width: Math.round(allFood.width),
    x: Math.round(allFood.x),
  }).toEqual({ height: 120, width: 176, x: 16 })
})

test('requires both rail width and rail height before showing permanent navigation', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/index.html?path=overview')
  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  const tabletBottomNav = await page.locator('[data-adaptive-navigation="bottom"]').boundingBox()
  expect(Math.round(tabletBottomNav?.width ?? 0)).toBe(560)

  await page.setViewportSize({ width: 1119, height: 820 })
  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()

  await page.setViewportSize({ width: 1120, height: 819 })
  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
  expect(Math.round((await page.getByRole('main').boundingBox())?.x ?? -1)).toBe(0)

  await page.setViewportSize({ width: 1120, height: 820 })
  await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).not.toBeVisible()

  const mainBox = await page.getByRole('main').boundingBox()
  expect(Math.round(mainBox?.x ?? 0)).toBe(248)
  expect(Math.round(mainBox?.width ?? 0)).toBe(872)

  await page.setViewportSize({ width: 1180, height: 820 })
  await expect.poll(async () => Math.round((await page.getByRole('main').boundingBox())?.width ?? 0)).toBe(932)
})

test('keeps the menu on root pages and never duplicates Back with a trailing hamburger', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 852, height: 393 })
  await page.goto('/index.html?path=overview')

  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  const drawer = page.locator('aside[data-state="open"]')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('menuitem', { name: 'Security' })).toBeVisible()

  const scrollerBox = await page.locator('[data-page-scroller="true"]').boundingBox()
  expect(Math.round(scrollerBox?.height ?? 0)).toBeGreaterThanOrEqual(250)

  await page.goto('/index.html?path=living-room')
  const header = page.locator('[data-app-header="true"]')
  const back = header.getByRole('button', { name: 'Go back' })
  const profile = header.getByRole('button', { name: /^Open .*Summary/ })
  for (const viewport of [
    { width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
    { width: 852, height: 393, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
    { width: 852, height: 393, insets: { top: 0, right: 59, bottom: 21, left: 44 } },
    { width: 667, height: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 820, height: 1180, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1180, height: 820, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1119, height: 500, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1120, height: 500, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1920, height: 1080, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await setSafeAreaInsets(page, viewport.insets)
    await expect(back).toBeVisible()
    await expect(profile).toBeVisible()
    await expect(header.locator('button[aria-label="Open navigation menu"]')).toHaveCount(0)
  }
  await profile.click()
  const summary = page.getByRole('dialog', { name: /Summary/ })
  await expect(summary).toBeVisible()
  await summary.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(summary).toHaveCount(0)
  await page.setViewportSize({ width: 852, height: 393 })
  await back.click()
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
})

test('uses the root drawer and Back on wide compact routes', async ({ page }) => {
  await page.setViewportSize({ width: 1152, height: 741 })
  await page.goto('/index.html?path=overview')

  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'drawer-only')
  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
  expect(Math.round((await page.getByRole('main').boundingBox())?.x ?? -1)).toBe(0)

  await page.goto('/index.html?path=living-room')
  await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu', includeHidden: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await expect(page.locator('[data-adaptive-navigation="drawer"][data-state="open"]').getByRole('menuitem', { name: 'Home' })).toBeVisible()
})

test('bounds representative dashboard, settings, room and reading layouts on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/index.html?path=overview')

  const cameraButtons = page.getByRole('main').locator('button[aria-label$=" camera"]')
  await expect(cameraButtons).toHaveCount(4, { timeout: 12_000 })
  const cameraWidths = await cameraButtons.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().width)),
  )
  expect(cameraWidths).toHaveLength(4)
  expect(Math.max(...cameraWidths)).toBeLessThanOrEqual(400)

  await setRoute(page, 'settings')
  const settingsGeometry = await page.getByRole('navigation', { name: 'Settings pages' }).evaluate((navigation) => {
    const items = Array.from(navigation.querySelectorAll('button'))
    return {
      columns: new Set(items.map((item) => Math.round(item.getBoundingClientRect().x))).size,
      maxWidth: Math.max(...items.map((item) => item.getBoundingClientRect().width)),
    }
  })
  expect(settingsGeometry.columns).toBe(2)
  expect(settingsGeometry.maxWidth).toBeLessThanOrEqual(480)

  await setRoute(page, 'living-room')
  const roomGridWidths = await page.locator('[data-dynamic-grid-layout="bounded"]').evaluateAll((grids) =>
    grids.flatMap((grid) => Array.from(grid.querySelectorAll(':scope > [data-dynamic-grid-cell]')).map((cell) => Math.round(cell.getBoundingClientRect().width))),
  )
  expect(Math.max(...roomGridWidths)).toBeLessThanOrEqual(280)

  await setRoute(page, 'groceries')
  const readingContent = await page.locator('[data-page-content="true"]').boundingBox()
  expect(Math.round(readingContent?.width ?? 0)).toBeLessThanOrEqual(960)
})

test('keeps every configured route horizontally contained at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/index.html?path=overview')

  for (const path of RESPONSIVE_ROUTES) {
    await setRoute(page, path)
    await expect(page.getByRole('main')).toBeVisible()
    const overflow = await page.getByRole('main').locator('[data-page-scroller="true"]').evaluate((scroller) => ({
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
    }))
    expect(overflow.scrollWidth, path).toBeLessThanOrEqual(overflow.clientWidth + 1)
  }
})

test('reflows both directions without changing the narrow Home geometry', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/index.html?path=overview')
  const mobileCamera = page.locator('button[aria-label$=" camera"]').first()
  await expect.poll(async () => Math.round((await mobileCamera.boundingBox())?.width ?? 0)).toBe(174)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible()
  await expect.poll(async () => Math.round((await mobileCamera.boundingBox())?.width ?? 0)).toBeLessThanOrEqual(400)

  await page.setViewportSize({ width: 393, height: 852 })
  await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()
  await expect.poll(async () => Math.round((await mobileCamera.boundingBox())?.width ?? 0)).toBe(174)
})
