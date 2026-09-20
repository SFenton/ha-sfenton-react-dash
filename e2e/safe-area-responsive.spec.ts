// @covers src/components/shell/AppShell.module.css
import { expect, test, type Locator, type Page } from './layout/fixture'
import {
  MOBILE_GEOMETRY_PROFILES,
  RESPONSIVE_ROUTES,
  RESPONSIVE_ROUTE_TITLES,
  ROUTE_SAFE_AREA_PROFILES,
  type MobileGeometryProfile,
  type ResponsiveRoute,
  type SafeAreaInsets,
} from './responsive-acceptance-data'
import {
  installSafeAreaInsets,
  setBrowserSafeAreaInsets,
  setSafeAreaInsets,
} from './safe-area'

const profile = (name: string) => {
  const match = MOBILE_GEOMETRY_PROFILES.find((candidate) => candidate.name === name)
  if (!match) throw new Error(`Unknown mobile geometry profile: ${name}`)
  return match
}

async function waitForRoute(page: Page, route: ResponsiveRoute) {
  await expect(page.locator(`[data-route-path="${route}"]`)).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: RESPONSIVE_ROUTE_TITLES.get(route) })).toBeVisible({ timeout: 15_000 })
}

async function setRoute(page: Page, route: ResponsiveRoute) {
  await page.evaluate((nextRoute) => {
    const url = new URL(window.location.href)
    url.searchParams.set('path', nextRoute)
    url.hash = ''
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  await waitForRoute(page, route)
}

async function measureBottomChromeSpacing(page: Page) {
  return page.locator('[data-page-scroller="true"]:visible').last().evaluate((scroller) => {
    const content = scroller.querySelector<HTMLElement>('[data-page-content="true"]')
    const dock = document.querySelector<HTMLElement>('[data-floating-action-dock="true"]')
    const bottomNav = document.querySelector<HTMLElement>('[data-adaptive-navigation="bottom"]')
    if (!content || !dock || !bottomNav) throw new Error('Bottom chrome geometry is incomplete')

    scroller.scrollTop = scroller.scrollHeight
    const contentBounds = content.getBoundingClientRect()
    const dockBounds = dock.getBoundingClientRect()
    const bottomNavBounds = bottomNav.getBoundingClientRect()
    const actionBounds = Array.from(dock.querySelectorAll<HTMLElement>(':scope > button'))
      .map((action) => action.getBoundingClientRect())
    const terminal = Array.from(content.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .at(-1)?.getBoundingClientRect()

    return {
      actionCount: actionBounds.length,
      actionHeights: actionBounds.map((bounds) => bounds.height),
      actionTopSpread: actionBounds.length === 0
        ? 0
        : Math.max(...actionBounds.map((bounds) => bounds.top)) - Math.min(...actionBounds.map((bounds) => bounds.top)),
      contentToDockGap: dockBounds.top - contentBounds.bottom,
      dockHeight: dockBounds.height,
      dockToNavGap: bottomNavBounds.top - dockBounds.bottom,
      terminalScrollDelta: Math.abs(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop),
      terminalToWrapperGap: terminal ? contentBounds.bottom - terminal.bottom : null,
    }
  })
}

async function auditSafeArea(page: Page, route: ResponsiveRoute, geometry: MobileGeometryProfile) {
  const metrics = await page.evaluate(({ insets, routePath }) => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.top < innerHeight
        && rect.right > 0
        && rect.left < innerWidth
    }
    const horizontalScrollOwner = (element: HTMLElement) => {
      let current = element.parentElement
      while (current) {
        const style = getComputedStyle(current)
        if (['auto', 'scroll'].includes(style.overflowX)) return current
        current = current.parentElement
      }
      return null
    }
    const labelFor = (element: HTMLElement) => (
      element.getAttribute('aria-label')
      ?? element.textContent?.replaceAll(/\s+/g, ' ').trim().slice(0, 80)
      ?? element.tagName
    )
    const safeLeft = insets.left
    const safeRight = innerWidth - insets.right
    const activeRoute = document.querySelector<HTMLElement>(`[data-route-path="${routePath}"]:not([aria-hidden="true"])`)
    const shellRoots = [
      activeRoute,
      document.querySelector<HTMLElement>('[data-adaptive-navigation="bottom"]'),
      document.querySelector<HTMLElement>('[data-adaptive-navigation="rail"]'),
      document.querySelector<HTMLElement>('[data-floating-action-dock="true"]'),
    ].filter((element): element is HTMLElement => Boolean(element))
    const candidates = [...new Set(shellRoots.flatMap((root) => [
      ...root.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [role="button"], [role="tab"], [role="slider"]'),
    ]))].filter(visible)

    const horizontalViolations: string[] = []
    const targetViolations: string[] = []
    for (const element of candidates) {
      const rect = element.getBoundingClientRect()
      const visibleSafeWidth = Math.max(0, Math.min(rect.right, safeRight) - Math.max(rect.left, safeLeft))
      if (horizontalScrollOwner(element)) {
        if (visibleSafeWidth + 1 < Math.min(24, rect.width)) horizontalViolations.push(labelFor(element))
      } else if (rect.left < safeLeft - 1 || rect.right > safeRight + 1) {
        horizontalViolations.push(labelFor(element))
      }
      if (
        element.getAttribute('role') !== 'slider'
        && !(element instanceof HTMLInputElement && element.type === 'range')
        && (rect.width < 24 || rect.height < 24)
      ) {
        targetViolations.push(labelFor(element))
      }
    }

    const fixedSelectors = [
      '[data-app-header="true"] button',
      '[data-adaptive-navigation="bottom"] button',
      '[data-adaptive-navigation="rail"] button',
      '[data-floating-action-dock="true"] button',
    ]
    const fixedViolations = Array.from(document.querySelectorAll<HTMLElement>(fixedSelectors.join(',')))
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < safeLeft - 1
          || rect.right > safeRight + 1
          || rect.top < insets.top - 1
          || rect.bottom > innerHeight - insets.bottom + 1
      })
      .map(labelFor)
    const heading = activeRoute?.querySelector<HTMLElement>('h1')
    const headingRect = heading?.getBoundingClientRect()

    return {
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      fixedViolations,
      headingContained: !headingRect || (headingRect.left >= safeLeft - 1 && headingRect.right <= safeRight + 1),
      horizontalViolations,
      targetViolations,
    }
  }, { insets: geometry.insets, routePath: route })

  expect(metrics.documentOverflow, `${geometry.name} ${route} document overflow`).toBeLessThanOrEqual(1)
  expect(metrics.headingContained, `${geometry.name} ${route} heading containment`).toBe(true)
  expect(metrics.horizontalViolations, `${geometry.name} ${route} horizontal containment`).toEqual([])
  expect(metrics.fixedViolations, `${geometry.name} ${route} fixed-control containment`).toEqual([])
  expect(metrics.targetViolations, `${geometry.name} ${route} minimum target size`).toEqual([])
}

async function openLandscapeModal(
  page: Page,
  geometry: MobileGeometryProfile,
  route: string,
  opener: (page: Page) => Promise<void>,
) {
  await page.setViewportSize(geometry.viewport)
  await page.goto(`/index.html?path=${route}`)
  await setSafeAreaInsets(page, geometry.insets)
  await opener(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
  await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
  await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
  return dialog
}

async function expectLandscapeModalContained(
  page: Page,
  dialog: Locator,
  insets: SafeAreaInsets,
) {
  const metrics = await dialog.evaluate((element, safe) => {
    const rect = element.getBoundingClientRect()
    const close = element.querySelector<HTMLElement>('button[aria-label="Close"]')?.getBoundingClientRect()
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    return {
      bodyClientHeight: body?.clientHeight ?? 0,
      bodyScrollHeight: body?.scrollHeight ?? 0,
      bottom: rect.bottom,
      close: close && { bottom: close.bottom, left: close.left, right: close.right, top: close.top },
      height: rect.height,
      left: rect.left,
      right: rect.right,
      safeBottom: innerHeight - safe.bottom,
      safeRight: innerWidth - safe.right,
      top: rect.top,
      width: rect.width,
    }
  }, insets)

  expect(Math.abs(metrics.left - (insets.left + 12))).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.width - (page.viewportSize()!.width - insets.left - insets.right - 24))).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.top - (insets.top + 8))).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.height - (page.viewportSize()!.height - insets.top - insets.bottom - 16))).toBeLessThanOrEqual(1)
  expect(metrics.close).not.toBeNull()
  expect(metrics.close?.left ?? 0).toBeGreaterThanOrEqual(insets.left)
  expect(metrics.close?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(metrics.safeRight)
  expect(metrics.close?.top ?? 0).toBeGreaterThanOrEqual(insets.top)
  expect(metrics.close?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(metrics.safeBottom)
  expect(metrics.bodyClientHeight).toBeGreaterThan(80)

  if (metrics.bodyScrollHeight > metrics.bodyClientHeight + 1) {
    await expect.poll(() => dialog.locator('[data-modal-sheet-body="true"]').evaluate((body) => {
      body.scrollTop = body.scrollHeight
      return body.scrollTop
    })).toBeGreaterThan(0)
  }

  const closeReceivesPointer = await dialog.getByRole('button', { exact: true, name: 'Close' }).evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return hit === button || button.contains(hit)
  })
  expect(closeReceivesPointer).toBe(true)
}

test.describe('safe-area responsive acceptance', () => {
  for (const geometry of ROUTE_SAFE_AREA_PROFILES) {
    test(`keeps every route usable in ${geometry.name}`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize(geometry.viewport)
      await installSafeAreaInsets(page, geometry.insets)
      await page.goto('/index.html?path=overview')
      await setSafeAreaInsets(page, geometry.insets)
      await waitForRoute(page, 'overview')

      for (const route of RESPONSIVE_ROUTES) {
        if (route !== 'overview') await setRoute(page, route)
        await auditSafeArea(page, route, geometry)
      }
    })
  }

  test('keeps terminal page content evenly spaced around the bottom action dock', async ({ page }) => {
    const portraitProfiles = [
      profile('island-phone-portrait'),
      profile('rectangular-phone-portrait'),
    ]
    await page.setViewportSize(portraitProfiles[0].viewport)
    await installSafeAreaInsets(page, portraitProfiles[0].insets)
    await page.goto('/index.html?path=overview')

    for (const geometry of portraitProfiles) {
      await page.setViewportSize(geometry.viewport)
      await setSafeAreaInsets(page, geometry.insets)

      for (const [route, expectedActionCount] of [['overview', 1], ['groceries', 2]] as const) {
        await setRoute(page, route)
        await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'bottom')
        const metrics = await measureBottomChromeSpacing(page)

        expect(metrics.terminalScrollDelta, `${geometry.name} ${route} terminal scroll`).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.contentToDockGap - 20), `${geometry.name} ${route} content-to-dock gap`).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.dockToNavGap - 20), `${geometry.name} ${route} dock-to-nav gap`).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.contentToDockGap - metrics.dockToNavGap), `${geometry.name} ${route} balanced gaps`).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.dockHeight - 56), `${geometry.name} ${route} dock height`).toBeLessThanOrEqual(1)
        expect(metrics.actionCount, `${geometry.name} ${route} dock action count`).toBe(expectedActionCount)
        expect(metrics.actionHeights.every((height) => Math.abs(height - 56) <= 1), `${geometry.name} ${route} action heights`).toBe(true)
        expect(metrics.actionTopSpread, `${geometry.name} ${route} action alignment`).toBeLessThanOrEqual(1)
        if (route === 'overview') {
          expect(metrics.terminalToWrapperGap, `${geometry.name} visible terminal content`).not.toBeNull()
          expect(Math.abs(metrics.terminalToWrapperGap ?? 0), `${geometry.name} visible terminal content`).toBeLessThanOrEqual(1)
        }
      }
    }

    for (const geometry of [
      profile('island-phone-landscape-left'),
      profile('island-phone-landscape-right'),
    ]) {
      await page.setViewportSize(geometry.viewport)
      await setSafeAreaInsets(page, geometry.insets)
      await setRoute(page, 'overview')
      await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'drawer-only')
      await expect(page.locator('[data-adaptive-navigation="bottom"]')).toBeHidden()
      const geometryFacts = await page.evaluate((insets) => {
        const scroller = document.querySelector<HTMLElement>('[data-page-scroller="true"]')
        const content = scroller?.querySelector<HTMLElement>('[data-page-content="true"]')
        const dock = document.querySelector<HTMLElement>('[data-floating-action-dock="true"]')
        if (!scroller || !content || !dock) throw new Error('Drawer-only geometry is incomplete')
        scroller.scrollTop = scroller.scrollHeight
        const contentBounds = content.getBoundingClientRect()
        const dockBounds = dock.getBoundingClientRect()
        return {
          contentToDockGap: dockBounds.top - contentBounds.bottom,
          dockLeft: dockBounds.left,
          dockRight: dockBounds.right,
          safeLeft: insets.left,
          safeRight: innerWidth - insets.right,
        }
      }, geometry.insets)
      expect(geometryFacts.contentToDockGap, `${geometry.name} content-to-dock overlap`).toBeGreaterThanOrEqual(-1)
      expect(geometryFacts.dockLeft, `${geometry.name} dock left containment`).toBeGreaterThanOrEqual(geometryFacts.safeLeft - 1)
      expect(geometryFacts.dockRight, `${geometry.name} dock right containment`).toBeLessThanOrEqual(geometryFacts.safeRight + 1)
    }
  })

  test('keeps Chores adaptive across safe-area and rectangular phone profiles', async ({ page }) => {
    const expectedColumns = new Map([
      ['island-phone-portrait', '2'],
      ['island-phone-landscape-left', '2'],
      ['island-phone-landscape-right', '2'],
      ['rectangular-phone-landscape', '2'],
      ['android-punch-landscape-right', '3'],
    ])

    for (const geometry of ROUTE_SAFE_AREA_PROFILES) {
      await page.setViewportSize(geometry.viewport)
      await page.goto('/index.html?path=chores')
      await setSafeAreaInsets(page, geometry.insets)
      await waitForRoute(page, 'chores')
      const grid = page.getByRole('group', { name: 'Chore quick links' })
      await expect(grid).toHaveAttribute('data-dynamic-grid-columns', expectedColumns.get(geometry.name)!)
      const bounds = await grid.boundingBox()
      expect(bounds?.x ?? 0).toBeGreaterThanOrEqual(geometry.insets.left)
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(geometry.viewport.width - geometry.insets.right + 1)
      expect(await grid.locator(':scope > [data-dynamic-grid-cell]').evaluateAll((cells) =>
        cells.some((cell) => cell.scrollWidth > cell.clientWidth + 1),
      )).toBe(false)
    }
  })

  test('uses inset dismissible dialogs for landscape compact, form, and workspace modals', async ({ page }) => {
    for (const geometry of [
      profile('island-phone-landscape-left'),
      profile('island-phone-landscape-right'),
    ]) {
      let dialog = await openLandscapeModal(page, geometry, 'overview', (currentPage) =>
        currentPage.getByRole('button', { name: /Security Armed/i }).click())
      await expectLandscapeModalContained(page, dialog, geometry.insets)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })

      dialog = await openLandscapeModal(page, geometry, 'grocery-list', (currentPage) =>
        currentPage.getByRole('button', { exact: true, name: 'Add Groceries' }).click())
      await expectLandscapeModalContained(page, dialog, geometry.insets)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })

      dialog = await openLandscapeModal(page, geometry, 'vacuums', (currentPage) =>
        currentPage.getByRole('button', { name: /Main Floor Docked/i }).click())
      await expectLandscapeModalContained(page, dialog, geometry.insets)
      const dialogBox = await dialog.boundingBox()
      await page.mouse.click(geometry.insets.left + 5, Math.round(dialogBox?.y ?? 20))
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }
  })

  test('keeps centered tablet dialogs and navigation inside nonzero insets', async ({ page }) => {
    const geometry = profile('tablet-inset-portrait')
    await page.setViewportSize(geometry.viewport)
    await page.goto('/index.html?path=overview')
    await setSafeAreaInsets(page, geometry.insets)
    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
    const box = await dialog.boundingBox()
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(geometry.insets.left)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(geometry.viewport.width - geometry.insets.right)
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(geometry.insets.top)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(geometry.viewport.height - geometry.insets.bottom)

    const bottomNav = page.locator('[data-adaptive-navigation="bottom"]')
    const navBox = await bottomNav.boundingBox()
    expect(navBox?.x ?? 0).toBeGreaterThanOrEqual(geometry.insets.left)
    expect((navBox?.x ?? 0) + (navBox?.width ?? 0)).toBeLessThanOrEqual(geometry.viewport.width - geometry.insets.right)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })
    await page.setViewportSize({ height: 700, width: 600 })
    await setSafeAreaInsets(page, { bottom: 24, left: 44, right: 44, top: 24 })
    const narrowTabletNav = page.locator('[data-adaptive-navigation="bottom"]')
    const narrowNavBox = await narrowTabletNav.boundingBox()
    expect(Math.round(narrowNavBox?.x ?? 0)).toBe(44)
    expect(Math.round((narrowNavBox?.x ?? 0) + (narrowNavBox?.width ?? 0))).toBe(556)
  })

  test('preserves modal identity and close presentation through phone rotation', async ({ page }) => {
    const portrait = profile('island-phone-portrait')
    const landscape = profile('island-phone-landscape-left')
    await page.setViewportSize(portrait.viewport)
    await installSafeAreaInsets(page, portrait.insets)
    await page.goto('/index.html?path=overview')
    await setSafeAreaInsets(page, portrait.insets)
    await page.getByRole('button', { name: /Security Armed/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await dialog.evaluate((element) => {
      element.dataset.rotationIdentity = 'preserved'
    })

    await page.setViewportSize(landscape.viewport)
    await setSafeAreaInsets(page, landscape.insets)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    await expect(dialog).toHaveAttribute('data-rotation-identity', 'preserved')
    await expectLandscapeModalContained(page, dialog, landscape.insets)

    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await page.setViewportSize(portrait.viewport)
    await setSafeAreaInsets(page, portrait.insets)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    await expect(dialog).toHaveCount(0, { timeout: 700 })
  })

  test('keeps the raw browser env fallback covered through Chromium CDP', async ({ page }) => {
    const geometry = profile('island-phone-landscape-left')
    await page.setViewportSize(geometry.viewport)
    const clear = await setBrowserSafeAreaInsets(page, geometry.insets)
    try {
      await page.goto('/index.html?path=overview')
      await waitForRoute(page, 'overview')
      const menu = page.getByRole('button', { name: 'Open navigation menu' })
      await expect.poll(async () => Math.round((await menu.boundingBox())?.x ?? 0)).toBe(geometry.insets.left)
      await auditSafeArea(page, 'overview', geometry)
    } finally {
      await clear()
    }
  })
})
