// @covers src/Dashboard.tsx
// @covers src/components/core/FloatingActionButton.tsx
// @covers src/components/hass/EverShelfInventoryPanel.tsx
// @covers src/components/hass/StatusRail.module.css
// @covers src/components/hass/StatusRail.tsx
// @covers src/components/hass/recipes/RecipeFloatingActions.tsx
// @covers src/components/shell/AdaptiveNavigation.module.css
// @covers src/components/shell/AdaptiveNavigation.tsx
// @covers src/components/shell/AppHeader.module.css
// @covers src/components/shell/AppHeader.tsx
// @covers src/components/shell/AppShell.tsx
// @covers src/components/shell/AppShell.module.css
// @covers src/components/shell/DashboardFloatingAction.tsx
// @covers src/components/shell/DuoControlLaneContext.ts
// @covers src/components/shell/DuoPageActionHub.module.css
// @covers src/components/shell/DuoPageActionHub.tsx
// @covers src/components/shell/GlobalQuickLinksAction.module.css
// @covers src/hooks/useAdaptiveNavigationLayout.ts
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/food.json
// @covers src/i18n/locales/en/shell.json
// @covers src/pages/Page.module.css
// @covers src/styles/tokens.css
import { expect, test, type Page, type TestInfo } from './layout/fixture'
import { openQuickLinksTab } from './quick-links'
import { VIEWPORTS } from './responsive-acceptance-data'

type ExpectedNavigationLayout = 'bottom' | 'drawer-only' | 'duo' | 'rail'

const PROJECT_LAYOUTS: Record<string, {
  layout: ExpectedNavigationLayout
  rotatedLayout: ExpectedNavigationLayout
  rotatedViewport: { height: number, width: number }
  touch: boolean
  viewport: { height: number, width: number }
}> = {
  desktop: { layout: 'rail', rotatedLayout: 'drawer-only', rotatedViewport: { height: 741, width: 1152 }, touch: false, viewport: { height: 900, width: 1440 } },
  'passport-foldable': { layout: 'drawer-only', rotatedLayout: 'bottom', rotatedViewport: { height: 1152, width: 741 }, touch: true, viewport: { height: 741, width: 1152 } },
  'phone-navigation': { layout: 'bottom', rotatedLayout: 'drawer-only', rotatedViewport: { height: 393, width: 852 }, touch: true, viewport: { height: 852, width: 393 } },
  'square-foldable': { layout: 'bottom', rotatedLayout: 'bottom', rotatedViewport: { height: 842, width: 836 }, touch: true, viewport: { height: 836, width: 842 } },
  tablet: { layout: 'rail', rotatedLayout: 'bottom', rotatedViewport: { height: 1180, width: 820 }, touch: true, viewport: { height: 834, width: 1194 } },
}

const BOUNDARY_CASES = [
  { height: 819, layout: 'bottom', width: 1119 },
  { height: 820, layout: 'bottom', width: 1119 },
  { height: 819, layout: 'drawer-only', width: 1120 },
  { height: 820, layout: 'rail', width: 1120 },
  { height: 820, layout: 'rail', width: 1121 },
  { height: 500, layout: 'drawer-only', width: 1119 },
  { height: 501, layout: 'bottom', width: 1119 },
  { height: 500, layout: 'drawer-only', width: 1120 },
  { height: 501, layout: 'drawer-only', width: 1120 },
] as const

const DUO_OUTER_VIEWPORT = VIEWPORTS['iphone-duo-outer']
const DUO_INNER_VIEWPORT = VIEWPORTS['iphone-duo-inner']

function projectExpectation(testInfo: TestInfo) {
  const expectation = PROJECT_LAYOUTS[testInfo.project.name]
  if (!expectation) throw new Error(`No adaptive navigation expectation for ${testInfo.project.name}`)
  return expectation
}

async function waitForRoute(page: Page, route: string) {
  const routeRoot = page.locator(`[data-route-path="${route}"]`)
  await expect(routeRoot).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
  await expect(routeRoot.locator('[data-page-scroller="true"]:visible').last()).toBeVisible({ timeout: 15_000 })
}

async function expectNavigationLayout(page: Page, layout: ExpectedNavigationLayout) {
  const shell = page.locator('[data-app-shell="true"]')
  const rail = page.locator('[data-adaptive-navigation="rail"]')
  const duo = page.locator('[data-adaptive-navigation="duo"]')
  const bottom = page.locator('[data-adaptive-navigation="bottom"]')
  const hamburger = page.getByRole('button', { name: 'Open navigation menu' })

  await expect(shell).toHaveAttribute('data-navigation-layout', layout)
  await expect(rail).toBeVisible({ visible: layout === 'rail' })
  await expect(duo).toBeVisible({ visible: layout === 'duo' })
  await expect(bottom).toBeVisible({ visible: layout === 'bottom' })
  await expect(hamburger).toBeVisible({ visible: layout === 'bottom' || layout === 'drawer-only' })

  const main = await page.getByRole('main').boundingBox()
  const reservedWidth = layout === 'rail' ? 248 : layout === 'duo' ? 72 : 0
  expect(Math.round(main?.x ?? -1)).toBe(layout === 'rail' ? 248 : 0)
  expect(Math.round(main?.width ?? -1)).toBe(page.viewportSize()!.width - reservedWidth)
}

test('selects the expected navigation layout on first commit', async ({ page }, testInfo) => {
  const expected = projectExpectation(testInfo)
  expect(page.viewportSize()).toEqual(expected.viewport)
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')

  await expectNavigationLayout(page, expected.layout)
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
    touchPoints: navigator.maxTouchPoints,
  }))).toEqual(expected.touch
    ? { coarse: true, hover: false, touchPoints: 1 }
    : { coarse: false, hover: true, touchPoints: 0 })
})

test('preserves the standard non-Duo profile and notification sizing', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')
  await expect(page.locator('[data-app-shell="true"]')).not.toHaveAttribute('data-navigation-layout', 'duo')

  const headerBox = await page.locator('[data-app-header="true"]').boundingBox()
  const profileBox = await page.getByRole('button', { name: /^Open .+'s Summary/ }).boundingBox()
  const profileIconBox = await page.locator('[data-app-header-profile="true"] svg').first().boundingBox()
  const profileBadge = page.locator('[data-app-header-profile="true"] [data-count]')
  const profileBadgeBox = await profileBadge.boundingBox()

  expect(headerBox!.height).toBe(48)
  expect(profileBox!.width).toBe(38)
  expect(profileBox!.height).toBe(38)
  expect(profileIconBox!.width).toBe(22)
  expect(profileIconBox!.height).toBe(22)
  expect(profileBadgeBox!.width).toBeGreaterThanOrEqual(18)
  expect(profileBadgeBox!.height).toBe(18)
  expect(await profileBadge.evaluate((element) => getComputedStyle(element).fontSize)).toBe('10.56px')
})

test('preserves the expected mode through representative form-factor rotation', async ({ page }, testInfo) => {
  const expected = projectExpectation(testInfo)
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')
  await expectNavigationLayout(page, expected.layout)

  await page.setViewportSize(expected.rotatedViewport)
  await expectNavigationLayout(page, expected.rotatedLayout)

  await page.setViewportSize(expected.viewport)
  await expectNavigationLayout(page, expected.layout)
})

test('keeps root and back-path navigation usable', async ({ page }, testInfo) => {
  const expected = projectExpectation(testInfo)
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')

  if (expected.layout !== 'rail') {
    const opener = page.getByRole('button', { name: 'Open navigation menu' })
    await opener.click()
    const drawer = page.locator('[data-adaptive-navigation="drawer"]')
    await expect(drawer).toHaveAttribute('data-state', 'open')
    await expect(drawer.getByRole('menuitem', { name: 'Home' })).toBeFocused()
    await drawer.getByRole('menuitem', { name: 'Settings' }).focus()
    await page.keyboard.press('Tab')
    await expect(drawer.getByRole('menuitem', { name: 'Home' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(drawer.getByRole('menuitem', { name: 'Settings' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveAttribute('data-state', 'closed')
    await expect(drawer).toHaveCount(0, { timeout: 700 })
    await expect(opener).toBeFocused()
  }

  await page.goto('/index.html?path=living-room')
  await waitForRoute(page, 'living-room')
  await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation menu', includeHidden: true })).toHaveCount(0)

  if (expected.layout === 'bottom') {
    await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()
  } else if (expected.layout === 'rail') {
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible()
  } else if (expected.layout === 'duo') {
    await expect(page.locator('[data-adaptive-navigation="duo"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-adaptive-navigation="bottom"]')).not.toBeVisible()
    await expect(page.locator('[data-adaptive-navigation="rail"]')).not.toBeVisible()
  }
  await page.getByRole('button', { name: 'Go back' }).click()
  await waitForRoute(page, 'overview')
  await expectNavigationLayout(page, expected.layout)
})

test('honors every changed width and height boundary', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')

  for (const boundary of BOUNDARY_CASES) {
    await page.setViewportSize(boundary)
    await expectNavigationLayout(page, boundary.layout)
  }
})

test('transitions an open wide drawer into the rail without stale chrome', async ({ page }) => {
  await page.setViewportSize({ height: 741, width: 1152 })
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')
  await expectNavigationLayout(page, 'drawer-only')

  await page.evaluate(() => {
    type NavigationSample = {
      bottom: boolean
      drawer: boolean
      expected: string
      height: number
      hamburger: boolean
      layout: string
      mainX: number
      rail: boolean
      width: number
    }
    const target = window as typeof window & {
      __navigationResizeProbe?: {
        disconnect: () => void
        samples: NavigationSample[]
      }
    }
    const visible = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const samples: NavigationSample[] = []
    let running = true
    const capture = () => {
      if (running) requestAnimationFrame(capture)
      const shell = document.querySelector<HTMLElement>('[data-app-shell="true"]')
      const main = Array.from(document.querySelectorAll<HTMLElement>('main')).find((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      if (!shell || !main) return
      const expected = innerWidth >= 1120
        ? innerHeight >= 820 ? 'rail' : 'drawer-only'
        : innerWidth > innerHeight && innerHeight <= 500 ? 'drawer-only' : 'bottom'
      samples.push({
        bottom: visible('[data-adaptive-navigation="bottom"]'),
        drawer: visible('[data-adaptive-navigation="drawer"]'),
        expected,
        hamburger: visible('button[aria-label="Open navigation menu"]'),
        height: innerHeight,
        layout: shell.dataset.navigationLayout ?? 'missing',
        mainX: Math.round(main.getBoundingClientRect().x),
        rail: visible('[data-adaptive-navigation="rail"]'),
        width: innerWidth,
      })
    }
    requestAnimationFrame(capture)
    target.__navigationResizeProbe = {
      disconnect: () => {
        running = false
      },
      samples,
    }
  })

  const closedDrawerOpener = page.getByRole('button', { name: 'Open navigation menu' })
  await closedDrawerOpener.focus()
  await page.setViewportSize({ height: 820, width: 1180 })
  await expectNavigationLayout(page, 'rail')
  await expect(page.locator('[data-adaptive-navigation="rail"]').getByRole('button', { name: 'Home' })).toBeFocused()

  await page.setViewportSize({ height: 741, width: 1152 })
  await expectNavigationLayout(page, 'drawer-only')
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await expect(page.locator('[data-adaptive-navigation="drawer"]')).toHaveAttribute('data-state', 'open')

  await page.setViewportSize({ height: 820, width: 1180 })
  await expectNavigationLayout(page, 'rail')
  await expect(page.locator('[data-adaptive-navigation="drawer"]')).toHaveCount(0)
  await expect(page.locator('[data-adaptive-navigation="rail"]').getByRole('button', { name: 'Home' })).toBeFocused()

  await page.setViewportSize({ height: 741, width: 1152 })
  await expectNavigationLayout(page, 'drawer-only')
  await expect(page.locator('[data-adaptive-navigation="drawer"]')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))

  const samples = await page.evaluate(() => {
    const probe = (window as typeof window & {
      __navigationResizeProbe?: {
        disconnect: () => void
        samples: Array<{ bottom: boolean, drawer: boolean, expected: string, hamburger: boolean, height: number, layout: string, mainX: number, rail: boolean, width: number }>
      }
    }).__navigationResizeProbe
    probe?.disconnect()
    return probe?.samples ?? []
  })
  expect(samples.length).toBeGreaterThan(0)
  expect(samples.filter((sample) =>
    sample.layout !== sample.expected
    || (sample.expected === 'rail' && (!sample.rail || sample.bottom || sample.drawer || sample.hamburger || sample.mainX !== 248))
    || (sample.expected === 'bottom' && (sample.rail || !sample.bottom || sample.mainX !== 0))
    || (sample.expected === 'drawer-only' && (sample.rail || sample.bottom || !sample.hamburger || sample.mainX !== 0))
  )).toEqual([])
})

test.describe('iPhone Duo preview', () => {
test('keeps all Duo edge controls visible in the unified right lane', async ({ page }) => {
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=overview&duo=auto')
  await waitForRoute(page, 'overview')
  await expectNavigationLayout(page, 'duo')
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-duo-display', 'outer')

  await page.setViewportSize(DUO_INNER_VIEWPORT)
  await expectNavigationLayout(page, 'duo')
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-duo-display', 'inner')

  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await expectNavigationLayout(page, 'duo')
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-duo-display', 'outer')

  const duoNavigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(duoNavigation.getByRole('button')).toHaveCount(5)
  for (const label of ['Home', 'Security', 'Climate', 'Chores', 'Settings']) {
    await expect(duoNavigation.getByRole('button', { name: label })).toBeVisible()
  }
  expect(await duoNavigation.locator('[data-navigation-label="true"]').evaluateAll((labels) => labels.every((label) => getComputedStyle(label).display === 'none'))).toBe(true)

  const quickLinks = page.getByRole('button', { name: 'Open Chat and Quick Links' })
  const statusHub = page.getByRole('button', { name: 'Open page status' })
  const navigationBox = await duoNavigation.boundingBox()
  const selectedBox = await duoNavigation.getByRole('button', { name: 'Home' }).boundingBox()
  const quickLinksBox = await quickLinks.boundingBox()
  const statusBox = await statusHub.boundingBox()
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toHaveCount(0)
  expect(Math.round(statusBox!.x + statusBox!.width)).toBe(page.viewportSize()!.width - 12)
  expect(statusBox!.width).toBe(48)
  expect(statusBox!.height).toBe(48)
  expect(statusBox!.y + statusBox!.height).toBeLessThan(quickLinksBox!.y)
  expect(quickLinksBox!.y + quickLinksBox!.height).toBeLessThan(navigationBox!.y)
  expect(Math.abs((selectedBox!.x + selectedBox!.width / 2) - (navigationBox!.x + navigationBox!.width / 2))).toBeLessThanOrEqual(0.5)
  expect(navigationBox!.height).toBe(238)

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()
  expect(await profileButton.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const profileBox = await profileButton.boundingBox()
  expect(profileBox!.width).toBe(48)
  expect(profileBox!.height).toBe(48)
  expect(Math.round(profileBox!.y)).toBe(14)
  expect(Math.round(profileBox!.x + profileBox!.width)).toBe(page.viewportSize()!.width - 12)
  expect((await profileButton.locator('[data-count]').boundingBox())!.height).toBe(22)
  expect(Math.abs((profileBox!.x + profileBox!.width / 2) - (navigationBox!.x + navigationBox!.width / 2))).toBeLessThanOrEqual(0.5)
  expect(profileBox!.y + profileBox!.height).toBeLessThan(statusBox!.y)

  await statusHub.click()
  const statusDialog = page.getByRole('dialog', { name: 'Page Status' })
  await expect(statusDialog).toBeVisible()
  await expect(statusDialog.locator('[data-status-hub-grid="true"] [data-status-chip]')).not.toHaveCount(0)
  await expect(statusDialog.locator('[data-status-grid-chip="true"] button').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(statusDialog).toHaveCount(0, { timeout: 700 })
  await expect(statusHub).toBeFocused()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('uses standard phone chrome for unfolded portrait and Duo chrome for unfolded landscape', async ({ page }) => {
  await page.setViewportSize({ height: DUO_INNER_VIEWPORT.width, width: DUO_INNER_VIEWPORT.height })
  await page.goto('/index.html?path=all-food&duo=inner')
  await waitForRoute(page, 'all-food')

  const shell = page.locator('[data-app-shell="true"]')
  const profile = page.getByRole('button', { name: /^Open .+'s Summary/ })
  const back = page.getByRole('button', { name: 'Go back' })
  const quickLinks = page.getByRole('button', { name: 'Open Chat and Quick Links' })
  const dock = page.locator('[data-floating-action-dock="true"]')

  await expect(shell).toHaveAttribute('data-duo-display', 'inner')
  await expect(shell).toHaveAttribute('data-navigation-layout', 'bottom')
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="duo"]')).toBeHidden()
  expect((await page.getByRole('main').boundingBox())!.width).toBe(DUO_INNER_VIEWPORT.height)
  expect((await profile.boundingBox())!.width).toBe(38)
  expect((await profile.locator('[data-count]').boundingBox())!.height).toBe(18)
  expect((await quickLinks.boundingBox())!.width).toBe(56)
  expect(await back.evaluate((element) => getComputedStyle(element).position)).not.toBe('fixed')
  expect(await dock.evaluate((element) => getComputedStyle(element).flexDirection)).toBe('row')
  const bottomNavigationBox = await page.locator('[data-adaptive-navigation="bottom"]').boundingBox()
  const dockBox = await dock.boundingBox()
  expect(Math.round(dockBox!.x)).toBe(Math.round(bottomNavigationBox!.x))
  expect(Math.round(dockBox!.x + dockBox!.width)).toBe(Math.round(bottomNavigationBox!.x + bottomNavigationBox!.width))
  expect(await dock.locator('button:visible').evaluateAll((buttons, bounds) => buttons.every((button) => {
    const rect = button.getBoundingClientRect()
    return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
  }), { left: bottomNavigationBox!.x, right: bottomNavigationBox!.x + bottomNavigationBox!.width })).toBe(true)

  await page.setViewportSize(DUO_INNER_VIEWPORT)
  await expectNavigationLayout(page, 'duo')
  await expect(shell).toHaveAttribute('data-duo-display', 'inner')
  expect((await profile.boundingBox())!.width).toBe(48)
  expect((await profile.locator('[data-count]').boundingBox())!.height).toBe(22)
  expect((await quickLinks.boundingBox())!.width).toBe(48)
  expect(await back.evaluate((element) => getComputedStyle(element).position)).toBe('fixed')
  expect(await dock.evaluate((element) => getComputedStyle(element).flexDirection)).toBe('column')

  await page.setViewportSize({ height: DUO_INNER_VIEWPORT.width, width: DUO_INNER_VIEWPORT.height })
  await expect(shell).toHaveAttribute('data-navigation-layout', 'bottom')
  await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()
  await expect(page.locator('[data-adaptive-navigation="duo"]')).toBeHidden()
  expect((await profile.boundingBox())!.width).toBe(38)
  expect((await profile.locator('[data-count]').boundingBox())!.height).toBe(18)
})

test('animates mounted Duo controls into their rotated layout', async ({ page }) => {
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=all-food&duo=auto')
  await waitForRoute(page, 'all-food')

  const lane = page.locator('[data-duo-control-lane="true"]')
  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  const initialLaneHeight = (await lane.boundingBox())!.height
  const initialBackY = (await page.getByRole('button', { name: 'Go back' }).boundingBox())!.y
  const initialProfileY = (await page.getByRole('button', { name: /^Open .+'s Summary/ }).boundingBox())!.y

  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  const landscapeSamples = await lane.evaluate(async (element) => {
    const samples: Array<{ backY: number, height: number, navigationY: number, profileY: number }> = []
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const navigation = document.querySelector<HTMLElement>('[data-adaptive-navigation="duo"]')
      const back = document.querySelector<HTMLElement>('[data-app-header-back="true"]')
      const profile = document.querySelector<HTMLElement>('[data-app-header-profile="true"]')
      samples.push({
        backY: back?.getBoundingClientRect().y ?? -1,
        height: element.getBoundingClientRect().height,
        navigationY: navigation?.getBoundingClientRect().y ?? -1,
        profileY: profile?.getBoundingClientRect().y ?? -1,
      })
    }
    return samples
  })

  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
  const landscapeLaneHeight = (await lane.boundingBox())!.height
  const landscapeBackY = (await page.getByRole('button', { name: 'Go back' }).boundingBox())!.y
  const landscapeProfileY = (await page.getByRole('button', { name: /^Open .+'s Summary/ }).boundingBox())!.y
  expect(initialLaneHeight - landscapeLaneHeight).toBeGreaterThan(150)
  expect(landscapeSamples.some((sample) =>
    sample.height < initialLaneHeight - 2
    && sample.height > landscapeLaneHeight + 2)).toBe(true)
  expect(new Set(landscapeSamples.map((sample) => Math.round(sample.navigationY))).size).toBeGreaterThan(2)
  expect(landscapeSamples.some((sample) =>
    sample.backY < initialBackY - 1
    && sample.backY > landscapeBackY + 1)).toBe(true)
  expect(landscapeSamples.some((sample) =>
    sample.profileY < initialProfileY - 1
    && sample.profileY > landscapeProfileY + 1)).toBe(true)

  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  const portraitSamples = await lane.evaluate(async (element) => {
    const samples: number[] = []
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      samples.push(element.getBoundingClientRect().height)
    }
    return samples
  })

  await expect(navigation).toHaveAttribute('data-duo-route-count', '5')
  const restoredLaneHeight = (await lane.boundingBox())!.height
  expect(Math.abs(restoredLaneHeight - initialLaneHeight)).toBeLessThanOrEqual(1)
  expect(portraitSamples.some((height) =>
    height > landscapeLaneHeight + 2
    && height < restoredLaneHeight - 2)).toBe(true)
})

test('skips mounted Duo rotation motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=all-food&duo=auto')
  await waitForRoute(page, 'all-food')

  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))

  const lane = page.locator('[data-duo-control-lane="true"]')
  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
  expect(await lane.evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await navigation.evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await page.getByRole('button', { name: 'Go back' }).evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await page.getByRole('button', { name: /^Open .+'s Summary/ }).evaluate((element) => element.getAnimations().length)).toBe(0)
})

test('keeps Back pinned at the Duo lane top with profile fixed below it on back-navigation pages', async ({ page }) => {
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=living-room&duo=auto')
  await waitForRoute(page, 'living-room')
  await expectNavigationLayout(page, 'duo')

  const backButton = page.getByRole('button', { name: 'Go back' })
  await expect(backButton).toBeVisible()
  expect(await backButton.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const backBox = await backButton.boundingBox()
  expect(Math.round(backBox!.y)).toBe(20)
  expect(Math.round(backBox!.x + backBox!.width)).toBe(page.viewportSize()!.width - 12)

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()
  expect(await profileButton.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const profileBox = await profileButton.boundingBox()
  expect(profileBox!.width).toBe(48)
  expect(profileBox!.height).toBe(48)
  expect(Math.round(profileBox!.y)).toBe(71)
  expect(profileBox!.y).toBeGreaterThan(backBox!.y + backBox!.height - 3)
})

test('animates the Duo profile between root and Back positions across a route transition (root to Back)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=overview&duo=auto')
  await waitForRoute(page, 'overview')
  await expectNavigationLayout(page, 'duo')

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()
  expect(Math.round((await profileButton.boundingBox())!.y)).toBe(14)

  const quickLinksDialog = await openQuickLinksTab(page)
  await quickLinksDialog.getByRole('button', { name: 'Rooms' }).click()
  const roomsDialog = page.getByRole('dialog', { name: 'Rooms' })
  await expect(roomsDialog).toBeVisible()
  await roomsDialog.getByRole('button', { name: 'Living Room area' }).click()

  // While the outgoing (root) header is still mounted and the route is
  // exiting, the profile must be visibly animating toward the Back position
  // rather than snapping once the header remounts.
  const outlet = page.locator('[data-route-path="overview"]')
  await expect(outlet).toHaveAttribute('data-route-leading-chrome-transition', 'changing', { timeout: 2_000 })
  await expect(outlet).toHaveAttribute('data-route-transition-state', 'exiting')
  await expect.poll(() => profileButton.evaluate((el) => getComputedStyle(el).animationName)).toContain('duoProfileRootToBack')

  await waitForRoute(page, 'living-room')
  expect(Math.round((await profileButton.boundingBox())!.y)).toBe(71)
})

test('animates the Duo profile between root and Back positions across a route transition (Back to root)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=living-room&duo=auto')
  await waitForRoute(page, 'living-room')
  await expectNavigationLayout(page, 'duo')

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()
  expect(Math.round((await profileButton.boundingBox())!.y)).toBe(71)

  await page.getByRole('button', { name: 'Go back' }).click()

  // The outgoing (Back) header is still mounted here; the profile must be
  // visibly animating back toward the root position, not remaining pinned
  // at the Back offset until the new header appears.
  const outlet = page.locator('[data-route-path="living-room"]')
  await expect(outlet).toHaveAttribute('data-route-leading-chrome-transition', 'changing', { timeout: 2_000 })
  await expect(outlet).toHaveAttribute('data-route-transition-state', 'exiting')
  await expect.poll(() => profileButton.evaluate((el) => getComputedStyle(el).animationName)).toContain('duoProfileBackToRoot')

  await waitForRoute(page, 'overview')
  expect(Math.round((await profileButton.boundingBox())!.y)).toBe(14)
})

test('cycles the compact Duo status preview without moving its control', async ({ page }) => {
  await page.setViewportSize(DUO_INNER_VIEWPORT)
  await page.goto('/index.html?path=overview&duo=auto')
  await waitForRoute(page, 'overview')

  const statusHub = page.getByRole('button', { name: 'Open page status' })
  const initialTitle = await statusHub.getAttribute('title')
  const initialBox = await statusHub.boundingBox()
  await page.waitForTimeout(5_200)
  await expect.poll(() => statusHub.getAttribute('title')).not.toBe(initialTitle)
  await expect(statusHub.locator('[class*="hubVisual"][data-active="true"]')).toHaveCount(1)
  await expect(statusHub.locator('[class*="hubVisual"][data-active="false"]')).toHaveCount(1)
  expect(await statusHub.boundingBox()).toEqual(initialBox)
})

test('sequences and safely retargets Duo page controls during rapid navigation', async ({ page }) => {
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=overview&duo=auto')
  await waitForRoute(page, 'overview')
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'duo')
  await expect(page.locator('[data-duo-route-actions="true"]')).toHaveAttribute('data-duo-route-action-phase', 'visible')
  await expect(page.locator('[data-duo-quick-links="true"]')).toBeVisible()

  const samples = await page.evaluate(async () => {
    const captured: Array<{
      actionsOpacity: number
      buttons: string[]
      navHeight: number
      navRouteCount: string | null
      phase: string | null
      quickOpacity: number
      route: string | null
    }> = []
    let retargeted = false
    let settledFrames = 0
    const startedAt = performance.now()
    const navigate = (path: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('path', path)
      window.history.pushState({}, '', url)
      window.dispatchEvent(new Event('dashboard-route-change'))
    }

    return new Promise<typeof captured>((resolve) => {
      const sample = () => {
        const shell = document.querySelector<HTMLElement>('[data-app-shell="true"]')
        const lane = document.querySelector<HTMLElement>('[data-duo-control-lane="true"]')
        const routeActions = document.querySelector<HTMLElement>('[data-duo-route-actions="true"]')
        const quickLinks = document.querySelector<HTMLElement>('[data-duo-quick-links="true"]')
        const navigation = document.querySelector<HTMLElement>('[data-adaptive-navigation="duo"]')
        const phase = routeActions?.dataset.duoRouteActionPhase ?? null
        const route = shell?.dataset.routeDisplayedPath ?? null
        const actionsOpacity = Number(routeActions ? getComputedStyle(routeActions).opacity : 0)
        const sampleValue = {
          actionsOpacity,
          buttons: Array.from(routeActions?.querySelectorAll<HTMLButtonElement>('button') ?? [], (button) => button.getAttribute('aria-label') ?? ''),
          navHeight: navigation?.getBoundingClientRect().height ?? 0,
          navRouteCount: lane?.dataset.duoNavigationRoutes ?? null,
          phase,
          quickOpacity: Number(quickLinks ? getComputedStyle(quickLinks).opacity : 0),
          route,
        }
        captured.push(sampleValue)

        if (!retargeted && route === 'kitchen' && phase === 'entering' && actionsOpacity > 0.05) {
          retargeted = true
          navigate('pantry')
          window.setTimeout(() => navigate('overview'), 35)
          window.setTimeout(() => navigate('all-food'), 70)
        }

        const settled = retargeted
          && route === 'all-food'
          && phase === 'visible'
          && sampleValue.navRouteCount === '2'
          && Math.abs(sampleValue.navHeight - 146) <= 1
        settledFrames = settled ? settledFrames + 1 : 0
        if (settledFrames >= 2 || performance.now() - startedAt > 4_000) {
          resolve(captured)
          return
        }
        window.requestAnimationFrame(sample)
      }

      navigate('kitchen')
      window.requestAnimationFrame(sample)
    })
  })

  expect(
    samples.every((sample) => sample.quickOpacity === 1),
    `Quick Links opacity changed during route navigation: ${JSON.stringify(samples.filter((sample) => sample.quickOpacity !== 1).slice(0, 12))}`,
  ).toBe(true)
  expect(samples.some((sample) => sample.route === 'overview' && sample.phase === 'exiting' && sample.actionsOpacity <= 0.05)).toBe(true)
  expect(samples.some((sample) => sample.route === 'kitchen' && sample.phase === 'entering' && sample.actionsOpacity > 0.05)).toBe(true)
  expect(samples.some((sample) => sample.route === 'kitchen' && sample.phase === 'exiting' && sample.actionsOpacity < 0.95)).toBe(true)
  expect(samples.some((sample) => sample.route === 'all-food' && sample.phase === 'resizing' && sample.actionsOpacity === 0 && Math.abs(sample.navHeight - 146) <= 1)).toBe(true)

  const firstIncomingVisible = samples.find((sample) => sample.route === 'all-food' && sample.actionsOpacity > 0.05)
  expect(firstIncomingVisible?.navRouteCount).toBe('2')
  expect(Math.abs((firstIncomingVisible?.navHeight ?? 0) - 146)).toBeLessThanOrEqual(1)

  await waitForRoute(page, 'all-food')
  const routeActions = page.locator('[data-duo-route-actions="true"]')
  await expect(routeActions).toHaveAttribute('data-duo-route-action-phase', 'visible')
  await expect(routeActions).not.toHaveAttribute('aria-hidden', 'true')
  await expect(routeActions).not.toHaveAttribute('inert', '')
  await expect(routeActions.getByRole('button')).toHaveCount(2)
  await expect(routeActions.getByRole('button', { name: 'Search inventory' })).toBeVisible()
  await expect(routeActions.getByRole('button', { name: 'More page actions' })).toBeVisible()
  await expect(routeActions.getByRole('button', { name: 'Open page status' })).toHaveCount(0)
})

test('switches Duo page controls immediately when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=overview&duo=auto')
  await waitForRoute(page, 'overview')
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'duo')
  await expect(page.locator('[data-duo-route-actions="true"]')).toHaveAttribute('data-duo-route-action-phase', 'visible')

  const phases = await page.evaluate(async () => {
    const captured: string[] = []
    const url = new URL(window.location.href)
    url.searchParams.set('path', 'all-food')
    window.history.pushState({}, '', url)
    window.dispatchEvent(new Event('dashboard-route-change'))

    await new Promise<void>((resolve) => {
      let frames = 0
      const sample = () => {
        const actions = document.querySelector<HTMLElement>('[data-duo-route-actions="true"]')
        const phase = actions?.dataset.duoRouteActionPhase
        if (phase) captured.push(phase)
        frames += 1
        if (
          frames >= 90
          || (
            document.querySelector<HTMLElement>('[data-app-shell="true"]')?.dataset.routeDisplayedPath === 'all-food'
            && actions?.querySelectorAll('button').length === 2
          )
        ) {
          resolve()
          return
        }
        window.requestAnimationFrame(sample)
      }
      window.requestAnimationFrame(sample)
    })
    return captured
  })

  expect(new Set(phases)).toEqual(new Set(['visible']))
  await waitForRoute(page, 'all-food')
  const routeActions = page.locator('[data-duo-route-actions="true"]')
  await expect(routeActions).toHaveAttribute('data-duo-route-action-phase', 'visible')
  await expect(routeActions).not.toHaveAttribute('aria-hidden', 'true')
  await expect(routeActions).not.toHaveAttribute('inert', '')
  await expect(routeActions.getByRole('button')).toHaveCount(2)
  await expect(page.locator('[data-adaptive-navigation="duo"]')).toHaveAttribute('data-duo-route-count', '2')
})

test('uses three routes plus Chevron when that is the largest Duo navbar that fits', async ({ page }) => {
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=living-room&duo=auto')
  await waitForRoute(page, 'living-room')

  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '3')
  await expect(navigation.getByRole('button')).toHaveCount(4)
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Security' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Show all navigation' })).toBeVisible()
  expect((await navigation.boundingBox())!.height).toBe(192)
})

test('uses one route plus Chevron when only the minimum Duo navbar fits', async ({ page }) => {
  await page.setViewportSize({ height: 400, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=all-food&duo=auto')
  await waitForRoute(page, 'all-food')

  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '1')
  await expect(navigation.getByRole('button')).toHaveCount(2)
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Settings' })).toHaveCount(0)
  await expect(navigation.getByRole('button', { name: 'Show all navigation' })).toBeVisible()
  expect((await navigation.boundingBox())!.height).toBe(100)
})

test('compresses an overflowing Duo lane and swaps navigation with page controls', async ({ page }) => {
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=kitchen&duo=auto')
  await waitForRoute(page, 'kitchen')

  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  const quickLinks = page.getByRole('button', { name: 'Open Chat and Quick Links' })
  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
  await expect(navigation.getByRole('button')).toHaveCount(3)
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(quickLinks).toBeVisible()
  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  expect(await profileButton.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const profileBox = await profileButton.boundingBox()
  expect(Math.round(profileBox!.y)).toBe(59)

  await navigation.getByRole('button', { name: 'Show all navigation' }).click()
  await expect(navigation).toHaveAttribute('data-duo-route-count', '5')
  await expect(navigation.getByRole('button')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Show page actions' })).toBeVisible()
  await expect(quickLinks).toBeHidden()

  await page.getByRole('button', { name: 'Show page actions' }).click()
  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
  await expect(quickLinks).toBeVisible()
})

test('uses two routes plus Chevron after All Food moves secondary actions into overflow', async ({ page }) => {
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=all-food&duo=auto')
  await waitForRoute(page, 'all-food')

  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
  await expect(navigation.getByRole('button')).toHaveCount(3)
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Show all navigation' })).toBeVisible()

  const duoLane = page.locator('[data-duo-control-lane="true"]')
  await expect(duoLane).toHaveAttribute('data-duo-action-gap', 'default')

  const backButton = page.getByRole('button', { name: 'Go back' })
  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  const dock = page.locator('[data-floating-action-dock="true"]')
  const routeActions = page.locator('[data-duo-route-actions="true"]')
  await expect(routeActions.getByRole('button')).toHaveCount(2)
  await expect(routeActions.getByRole('button', { name: 'Search inventory' })).toBeVisible()
  await expect(routeActions.getByRole('button', { name: 'More page actions' })).toBeVisible()

  expect(await profileButton.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const backBox = await backButton.boundingBox()
  const profileBox = await profileButton.boundingBox()
  const dockBox = await dock.boundingBox()
  const navigationBox = await navigation.boundingBox()

  expect(Math.round(backBox!.y)).toBe(8)
  expect(Math.round(profileBox!.y)).toBe(59)
  // Profile sits directly below Back with only its 3px hit-area slop meeting Back's target.
  expect(profileBox!.y).toBeGreaterThanOrEqual(backBox!.y + backBox!.height - 3)
  // No collision between the pinned profile, prioritized actions, Quick Links, and nav.
  expect(profileBox!.y + profileBox!.height).toBeLessThanOrEqual(dockBox!.y)
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(navigationBox!.y - 11.5)
})

test('holds the Food navbar size until All Food actions are ready', async ({ page }) => {
  await page.setViewportSize({ height: DUO_OUTER_VIEWPORT.width, width: DUO_OUTER_VIEWPORT.height })
  await page.goto('/index.html?path=food&duo=auto')
  await waitForRoute(page, 'food')

  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '3')
  await expect(page.getByRole('button', { name: /^All Food / })).toBeVisible()

  const samples = await navigation.evaluate(async (nav) => {
    const captured: Array<{ height: number, routeCount: string | undefined }> = []
    const allFood = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.getAttribute('aria-label')?.startsWith('All Food '))
    if (!allFood) throw new Error('All Food navigation button was not found')
    allFood.click()

    await new Promise<void>((resolve) => {
      const startedAt = performance.now()
      let settledFrames = 0
      const sample = () => {
        const routeCount = nav.dataset.duoRouteCount
        captured.push({
          height: nav.getBoundingClientRect().height,
          routeCount,
        })
        const shell = document.querySelector<HTMLElement>('[data-app-shell="true"]')
        const routeActions = document.querySelector<HTMLElement>('[data-duo-route-actions="true"]')
        const settled = shell?.dataset.routeDisplayedPath === 'all-food'
          && shell.dataset.routeTransitionState === 'idle'
          && routeCount === '2'
          && routeActions?.dataset.duoRouteActionPhase === 'visible'
          && routeActions.querySelectorAll('button').length === 2
        settledFrames = settled ? settledFrames + 1 : 0
        if (settledFrames >= 2 || performance.now() - startedAt > 4_000) {
          resolve()
          return
        }
        window.requestAnimationFrame(sample)
      }
      window.requestAnimationFrame(sample)
    })

    return captured
  })

  expect(samples.some((sample) => sample.routeCount === '2')).toBe(true)
  expect(samples.every((sample) => sample.routeCount === '2' || sample.routeCount === '3')).toBe(true)
  expect(Math.max(...samples.map((sample) => sample.height))).toBeLessThanOrEqual(192)
  await waitForRoute(page, 'all-food')
  await expect(navigation).toHaveAttribute('data-duo-route-count', '2')
})

test('groups secondary inventory actions and expands search across the Duo content area', async ({ page }) => {
  await page.setViewportSize(DUO_OUTER_VIEWPORT)
  await page.goto('/index.html?path=pantry&duo=auto')
  await waitForRoute(page, 'pantry')

  const dock = page.locator('[data-floating-action-dock="true"]')
  const navigation = page.locator('[data-adaptive-navigation="duo"]')
  const buttons = dock.getByRole('button')
  await expect(buttons).toHaveCount(3)
  const buttonBoxes = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(buttonBoxes.every((box) => Math.round(box.width) === 48 && Math.round(box.height) === 48)).toBe(true)
  const dockBox = await dock.boundingBox()
  const navigationBox = await navigation.boundingBox()
  expect(dockBox!.y).toBeGreaterThanOrEqual(14)
  expect(dockBox!.y + dockBox!.height).toBeLessThan(navigationBox!.y)
  expect(navigationBox!.height).toBe(238)

  await page.getByRole('button', { name: 'More page actions' }).click()
  const actionDialog = page.getByRole('dialog', { name: 'Page actions' })
  await expect(actionDialog).toBeVisible()
  await expect(actionDialog.getByRole('button', { name: 'Sort' })).toBeFocused()
  await expect(actionDialog.getByRole('button', { name: 'Filter' })).toBeVisible()
  await expect(actionDialog.getByRole('button', { name: 'Scan Item' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(actionDialog).toHaveCount(0, { timeout: 700 })
  await expect(page.getByRole('button', { name: 'More page actions' })).toBeFocused()

  await page.getByRole('button', { name: 'Search inventory' }).click()
  const search = page.getByRole('searchbox', { name: 'Search inventory' })
  await expect(search).toBeFocused()
  const searchBox = await search.boundingBox()
  expect(searchBox!.width).toBeGreaterThan(240)
  expect(searchBox!.x + searchBox!.width).toBeLessThan(394)
})
})
