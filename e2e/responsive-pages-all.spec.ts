import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from './layout/fixture'
import {
  RESPONSIVE_ROUTES,
  RESPONSIVE_ROUTE_TITLES,
  RESPONSIVE_VIEWPORTS,
  VIEWPORTS,
  type ResponsiveRoute,
  type ResponsiveViewport,
} from './responsive-acceptance-data'
import { navigationLayoutForViewport } from '../src/constants/navigationLayout'

type PageAudit = {
  boundedCellViolations: number
  cameraWidthViolations: number
  contentWidth: number
  documentOverflow: number
  duplicateBackMenu: boolean
  fixedControlOverlapViolations: number
  heading: string | null
  hasBack: boolean
  navigation: string[]
  pageMeasure: string | null
  route: ResponsiveRoute
  scrollerHeight: number
  scrollerOverflow: number
  scrollerOverflowY: string
  stage: string
  viewport: ResponsiveViewport
}

const manifest: PageAudit[] = []

function artifactPath(filename: string) {
  const directory = process.env.RESPONSIVE_ARTIFACT_DIR
  if (!directory) return null
  fs.mkdirSync(directory, { recursive: true })
  return path.join(directory, filename)
}

async function waitForDashboard(page: Page, route: ResponsiveRoute) {
  await expect(page.locator(`[data-route-path="${route}"]`)).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
  await expect(page.locator('[data-page-scroller="true"]:visible').last()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-app-shell="true"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const selectors = [
      '[data-adaptive-navigation="rail"]',
      '[data-adaptive-navigation="bottom"]',
      'button[aria-label="Open navigation menu"]',
      '[data-app-header-back="true"]',
    ]
    return selectors.some((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
  }), { timeout: 15_000 }).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name: RESPONSIVE_ROUTE_TITLES.get(route) })).toBeVisible()
}

async function setRoute(page: Page, route: ResponsiveRoute) {
  await page.evaluate((nextPath) => {
    const url = new URL(window.location.href)
    url.searchParams.set('path', nextPath)
    url.hash = ''
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  await waitForDashboard(page, route)
}

function listenForUnexpectedErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes("WebSocket connection to 'ws://mock-hass.local")) return
    if (text.startsWith('[StreamManager] WebSocket error for ')) return
    errors.push(`console: ${text}`)
  })
  return errors
}

async function auditPage(page: Page, route: ResponsiveRoute, viewport: ResponsiveViewport, stage: string) {
  const metrics = await page.evaluate(() => {
    const isVisible = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const overlapArea = (left: DOMRect, right: DOMRect) =>
      Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
      * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))

    const scroller = Array.from(document.querySelectorAll<HTMLElement>('[data-page-scroller="true"]')).find(isVisible) ?? null
    const content = Array.from(document.querySelectorAll<HTMLElement>('[data-page-content="true"]')).find(isVisible) ?? null
    const main = Array.from(document.querySelectorAll<HTMLElement>('main[data-page-measure]')).find(isVisible) ?? null
    const rail = document.querySelector<HTMLElement>('[data-adaptive-navigation="rail"]')
    const bottom = document.querySelector<HTMLElement>('[data-adaptive-navigation="bottom"]')
    const menu = document.querySelector<HTMLElement>('button[aria-label="Open navigation menu"]')
    const back = main?.querySelector<HTMLElement>('[data-app-header-back="true"]') ?? null
    const navigation = [
      isVisible(rail) ? 'rail' : null,
      isVisible(bottom) ? 'bottom' : null,
      isVisible(menu) ? 'drawer' : null,
    ].filter((value): value is string => Boolean(value))

    const boundedCellViolations = Array.from(document.querySelectorAll<HTMLElement>('[data-dynamic-grid-layout="bounded"]'))
      .flatMap((grid) => {
        const maxCellWidth = Number.parseFloat(grid.dataset.dynamicGridMaxCellWidth ?? '')
        if (!Number.isFinite(maxCellWidth)) return []
        return Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-dynamic-grid-cell="true"]'))
          .filter((cell) => Number.parseFloat(getComputedStyle(cell).getPropertyValue('--dynamic-grid-span')) <= 1)
          .filter((cell) => cell.getBoundingClientRect().width > maxCellWidth + 2)
      }).length
    const cameraWidthViolations = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label$=" camera"]'))
      .filter(isVisible)
      .filter((camera) => camera.getBoundingClientRect().width > 462)
      .length

    const fixedControls = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-floating-action-dock="true"] button, [data-adaptive-navigation="bottom"] button, [data-adaptive-navigation="rail"] button',
    )).filter(isVisible)
    let fixedControlOverlapViolations = 0
    for (let leftIndex = 0; leftIndex < fixedControls.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < fixedControls.length; rightIndex += 1) {
        if (fixedControls[leftIndex].closest('[data-floating-action-dock]') === fixedControls[rightIndex].closest('[data-floating-action-dock]')) continue
        if (fixedControls[leftIndex].closest('[data-adaptive-navigation]') === fixedControls[rightIndex].closest('[data-adaptive-navigation]')) continue
        if (overlapArea(fixedControls[leftIndex].getBoundingClientRect(), fixedControls[rightIndex].getBoundingClientRect()) > 1) {
          fixedControlOverlapViolations += 1
        }
      }
    }

    const scrollerStyle = scroller ? getComputedStyle(scroller) : null
    return {
      boundedCellViolations,
      cameraWidthViolations,
      contentWidth: Math.round(content?.getBoundingClientRect().width ?? 0),
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      fixedControlOverlapViolations,
      heading: document.querySelector('main h1')?.textContent?.trim() ?? null,
      hasBack: isVisible(back),
      duplicateBackMenu: isVisible(back) && Boolean(main?.querySelector('[data-app-header="true"] button[aria-label="Open navigation menu"]')),
      navigation,
      pageMeasure: main?.dataset.pageMeasure ?? null,
      scrollerHeight: Math.round(scroller?.getBoundingClientRect().height ?? 0),
      scrollerOverflow: scroller ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : -1,
      scrollerOverflowY: scrollerStyle?.overflowY ?? '',
    }
  })

  expect(metrics.navigation.length > 0 || metrics.hasBack, `${route} ${stage} has no navigation`).toBe(true)
  expect(metrics.duplicateBackMenu, `${route} ${stage} duplicates Back with a menu`).toBe(false)
  expect(metrics.heading, `${route} ${stage} heading`).toBe(RESPONSIVE_ROUTE_TITLES.get(route))
  const navigationLayout = navigationLayoutForViewport(viewport)
  if (navigationLayout === 'rail') {
    expect(metrics.navigation, `${route} ${stage} desktop navigation`).toEqual(['rail'])
  } else if (navigationLayout === 'drawer-only') {
    expect(metrics.navigation, `${route} ${stage} short-landscape navigation`).toEqual(metrics.hasBack ? [] : ['drawer'])
  } else {
    expect(metrics.navigation, `${route} ${stage} mobile/tablet navigation`).toContain('bottom')
  }

  expect(metrics.documentOverflow, `${route} ${stage} document overflow`).toBeLessThanOrEqual(1)
  expect(metrics.scrollerOverflow, `${route} ${stage} scroller overflow`).toBeLessThanOrEqual(1)
  expect(metrics.scrollerHeight, `${route} ${stage} scroller height`).toBeGreaterThan(100)
  expect(['auto', 'scroll']).toContain(metrics.scrollerOverflowY)
  expect(metrics.boundedCellViolations, `${route} ${stage} bounded cards`).toBe(0)
  expect(metrics.cameraWidthViolations, `${route} ${stage} camera caps`).toBe(0)
  expect(metrics.fixedControlOverlapViolations, `${route} ${stage} fixed control overlap`).toBe(0)

  const measureCap = metrics.pageMeasure === 'reading' ? 960 : metrics.pageMeasure === 'media' ? 1440 : 1280
  expect(metrics.contentWidth, `${route} ${stage} content measure`).toBeLessThanOrEqual(Math.min(measureCap, viewport.width))

  const scrollResult = await page.locator('[data-page-scroller="true"]:visible').last().evaluate((scroller) => {
    const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTop = maximum
    const reached = scroller.scrollTop
    scroller.scrollTop = 0
    return { maximum, reached }
  })
  if (scrollResult.maximum > 1) expect(scrollResult.reached, `${route} ${stage} vertical scrolling`).toBeGreaterThan(0)

  manifest.push({ route, stage, viewport, ...metrics })
}

test.describe('all-route responsive acceptance', () => {
  test.beforeEach(() => { manifest.length = 0 })
  test.afterEach(async ({ browserName }, testInfo) => {
    const data = {
      scope: 'Per-test legacy audit, not a complete matrix or checkpoint certificate',
      testId: testInfo.testId, title: testInfo.title, status: testInfo.status, browserName,
      routeCount: RESPONSIVE_ROUTES.length, viewportCount: RESPONSIVE_VIEWPORTS.length,
      auditCount: manifest.length, results: manifest,
    }
    const attached = testInfo.outputPath('page-acceptance.json')
    fs.writeFileSync(attached, `${JSON.stringify(data, null, 2)}\n`)
    await testInfo.attach('legacy-page-acceptance', { path: attached, contentType: 'application/json' })
    const output = artifactPath(`phase3-page-acceptance-${testInfo.testId}.json`)
    if (output) {
      fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`)
    }
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`validates all routes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.setTimeout(180_000)
      const errors = listenForUnexpectedErrors(page)
      await page.setViewportSize(viewport)
      await page.goto('/index.html?path=overview')
      await waitForDashboard(page, 'overview')

      for (const route of RESPONSIVE_ROUTES) {
        if (route !== 'overview') await setRoute(page, route)
        await auditPage(page, route, viewport, viewport.name)
      }

      expect(errors).toEqual([])
    })
  }

  const sequences = [
    {
      name: 'mobile-desktop-mobile',
      viewports: [VIEWPORTS['phone-portrait'], VIEWPORTS.desktop, VIEWPORTS['phone-portrait']],
    },
    {
      name: 'desktop-mobile-desktop',
      viewports: [VIEWPORTS.desktop, VIEWPORTS['phone-portrait'], VIEWPORTS.desktop],
    },
    {
      name: 'phone-portrait-landscape-portrait',
      viewports: [VIEWPORTS['phone-portrait'], VIEWPORTS['phone-landscape'], VIEWPORTS['phone-portrait']],
    },
    {
      name: 'phone-landscape-portrait-landscape',
      viewports: [VIEWPORTS['phone-landscape'], VIEWPORTS['phone-portrait'], VIEWPORTS['phone-landscape']],
    },
    {
      name: 'ipad-portrait-landscape-portrait',
      viewports: [VIEWPORTS['ipad-portrait'], VIEWPORTS['ipad-landscape'], VIEWPORTS['ipad-portrait']],
    },
    {
      name: 'tablet-passport-tablet',
      viewports: [VIEWPORTS['ipad-landscape'], VIEWPORTS['passport-foldable-landscape'], VIEWPORTS['ipad-landscape']],
    },
  ] as const

  for (const sequence of sequences) {
    test(`keeps every route usable through ${sequence.name}`, async ({ page }) => {
      test.setTimeout(240_000)
      const errors = listenForUnexpectedErrors(page)
      await page.setViewportSize(sequence.viewports[0])
      await page.goto('/index.html?path=overview')
      await waitForDashboard(page, 'overview')

      for (const route of RESPONSIVE_ROUTES) {
        if (route !== 'overview') await setRoute(page, route)
        for (const [index, viewport] of sequence.viewports.entries()) {
          await page.setViewportSize(viewport)
          await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', navigationLayoutForViewport(viewport))
          await auditPage(page, route, viewport, `${sequence.name}-${index}`)
        }
      }

      expect(errors).toEqual([])
    })
  }
})
