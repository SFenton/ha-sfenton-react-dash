import { expect, test, type Page, type TestInfo } from '@playwright/test'

type ExpectedNavigationLayout = 'bottom' | 'drawer-only' | 'rail'

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
  const bottom = page.locator('[data-adaptive-navigation="bottom"]')
  const hamburger = page.getByRole('button', { name: 'Open navigation menu' })

  await expect(shell).toHaveAttribute('data-navigation-layout', layout)
  await expect(rail).toBeVisible({ visible: layout === 'rail' })
  await expect(bottom).toBeVisible({ visible: layout === 'bottom' })
  await expect(hamburger).toBeVisible({ visible: layout !== 'rail' })

  const main = await page.getByRole('main').boundingBox()
  expect(Math.round(main?.x ?? -1)).toBe(layout === 'rail' ? 248 : 0)
  expect(Math.round(main?.width ?? -1)).toBe(page.viewportSize()!.width - (layout === 'rail' ? 248 : 0))
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

  if (expected.layout === 'drawer-only') {
    const opener = page.getByRole('button', { name: 'Open navigation menu' })
    await expect(opener).toBeVisible()
    await opener.click()
    const drawer = page.locator('[data-adaptive-navigation="drawer"]')
    await drawer.getByRole('menuitem', { name: 'Home' }).click()
    await waitForRoute(page, 'overview')
  } else if (expected.layout === 'bottom') {
    await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).not.toBeVisible()
  } else {
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).not.toBeVisible()
  }
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
