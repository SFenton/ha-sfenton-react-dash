// @covers src/components/core/InfoBox.module.css
// @covers src/i18n/locales/en/pages/chores.json
// @covers src/components/core/DynamicGrid.module.css
// @covers src/components/hass/BathroomFanModalContent.tsx
// @covers src/components/hass/SecurityDashboard.tsx
// @covers src/components/hass/VacuumCard.tsx
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
        const textReducedUniformGrid = grid.dataset.dynamicGridItemSizing === 'uniform'
          && Number(grid.dataset.dynamicGridColumns) < Number(grid.dataset.dynamicGridAvailableColumns)
        if (textReducedUniformGrid) return []
        return Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-dynamic-grid-cell="true"]'))
          .filter((cell) => Number.parseFloat(getComputedStyle(cell).getPropertyValue('--dynamic-grid-span')) <= 1)
          .filter((cell) => cell.getBoundingClientRect().width > maxCellWidth + 2)
      }).length
    const uniformTextViolations = Array.from(document.querySelectorAll<HTMLElement>('[data-dynamic-grid-item-sizing="uniform"]'))
      .filter(isVisible)
      .filter((grid) => Number(grid.dataset.dynamicGridColumns) > 1)
      .flatMap((grid) => Array.from(grid.querySelectorAll<HTMLElement>('[data-dynamic-grid-label="true"]')))
      .filter(isVisible)
      .filter((label) => label.scrollWidth > label.clientWidth + 1)
      .length
    const contentAwareTextViolations = Array.from(document.querySelectorAll<HTMLElement>('[data-dynamic-grid-item-sizing="content-aware"]'))
      .filter(isVisible)
      .flatMap((grid) => Array.from(grid.querySelectorAll<HTMLElement>('[data-dynamic-grid-label-container="true"]')))
      .filter(isVisible)
      .filter((labelContainer) => labelContainer.scrollWidth > labelContainer.clientWidth + 1)
      .map((labelContainer) => ({
        clientWidth: labelContainer.clientWidth,
        gridLabel: labelContainer.closest<HTMLElement>('[data-dynamic-grid="true"]')?.getAttribute('aria-label') ?? null,
        scrollWidth: labelContainer.scrollWidth,
        text: labelContainer.textContent?.trim() ?? '',
      }))
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
      contentAwareTextViolations,
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
      uniformTextViolations,
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
  expect(metrics.contentAwareTextViolations, `${route} ${stage} content-aware grid text fit`).toEqual([])
  expect(metrics.fixedControlOverlapViolations, `${route} ${stage} fixed control overlap`).toBe(0)
  expect(metrics.uniformTextViolations, `${route} ${stage} uniform grid text fit`).toBe(0)

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

  test('keeps the active Solo Trip traveler blue while locked', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['phone-portrait'])
    await page.goto('/index.html?path=solo-trip')
    await waitForDashboard(page, 'solo-trip')
    await page.evaluate(() => {
      const api = window.__mockHass
      if (!api) throw new Error('Mock preflight failed')
      api.setEntityState('sensor.household_away_status', 'active')
      api.setEntityAttribute('sensor.household_away_status', 'mode', 'solo_trip')
      api.setEntityAttribute('sensor.household_away_status', 'traveler', 'stephen')
      api.setEntityAttribute('sensor.household_away_status', 'home_resident', 'steph')
      api.setEntityAttribute('sensor.household_away_status', 'starts_at', '2099-01-01T09:00:00')
      api.setEntityAttribute('sensor.household_away_status', 'ends_at', '2099-01-03T17:00:00')
      api.setEntityAttribute('sensor.household_away_status', 'effects', {
        sleepypod_live_follow: true,
        sleepypod_schedule: true,
        wake_light_source: true,
      })
      api.setEntityAttribute('sensor.household_away_status', 'blockers', [])
      api.calls.splice(0)
    })

    const root = page.locator('[data-route-path="solo-trip"]:not([aria-hidden="true"]) main')
    const awayTraveler = root.locator('article[aria-label="You Away"]')
    const homeResident = root.locator('article[aria-label="Steph Home"]')
    const activeNotice = root.getByRole('note', { name: 'Stephen Away' })
    const description = root.getByText('Enable or disable Solo Trip mode for the house.', { exact: true })
    await expect(awayTraveler).toBeVisible()

    for (const viewport of [VIEWPORTS['phone-portrait'], VIEWPORTS['phone-landscape']]) {
      await page.setViewportSize(viewport)
      await expect(activeNotice).toHaveCount(1)
      await expect(activeNotice).toContainText("While you are away from home and the Solo Trip setting is enabled in settings, Steph's controls and alarms will control the entire bed.")
      await expect.poll(() => activeNotice.getByRole('heading', { name: 'Stephen Away' }).evaluate((element) => getComputedStyle(element).color)).toBe('rgb(247, 251, 255)')
      const noticeElement = await activeNotice.elementHandle()
      if (!noticeElement) throw new Error('Active Solo Trip notice is missing')
      await expect.poll(() => description.evaluate((descriptionElement, currentNotice) => ({
        beforeDescription: Boolean(currentNotice.compareDocumentPosition(descriptionElement) & Node.DOCUMENT_POSITION_FOLLOWING),
        sameSection: currentNotice.closest('section') === descriptionElement.closest('section'),
      }), noticeElement)).toEqual({ beforeDescription: true, sameSection: true })
      await expect(awayTraveler).toHaveAttribute('data-disabled', 'true')
      await expect(awayTraveler).toHaveAttribute('data-muted', 'false')
      await expect(awayTraveler).not.toHaveAttribute('aria-pressed')
      await expect(homeResident).toHaveAttribute('data-disabled', 'true')
      await expect(homeResident).toHaveAttribute('data-muted', 'true')
      await expect(homeResident).not.toHaveAttribute('aria-pressed')
      await expect(root.getByRole('button', { name: /^(Stephen|Steph)$/ })).toHaveCount(0)
      await expect.poll(() => Promise.all([awayTraveler, homeResident].map((card) => card.evaluate((element) => ({
        backgroundColor: getComputedStyle(element).backgroundColor,
        filter: getComputedStyle(element).filter,
      }))))).toEqual([
        { backgroundColor: 'rgba(91, 141, 239, 0.6)', filter: 'saturate(0.45)' },
        { backgroundColor: 'rgba(255, 255, 255, 0.1)', filter: 'saturate(0.45)' },
      ])
    }

    await expect.poll(() => page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])
  })

  test('personalizes household controls from the signed-in Home Assistant user', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['phone-portrait'])
    await page.goto('/index.html?path=master-bedroom')
    await waitForDashboard(page, 'master-bedroom')

    await expect(page.getByRole('button', { name: /Your Side/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Steph's Side/ })).toBeVisible()

    await page.evaluate(() => window.__mockHass?.setUser({ id: '43cb71bbd1cb4860b2a7de4c829020f0', name: 'Steph' }))
    await expect(page.getByRole('button', { name: /Stephen's Side/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Your Side/ })).toBeVisible()
    await page.getByRole('button', { name: /^Lights / }).click()
    const lightsDialog = page.getByRole('dialog', { name: /Master Bedroom Light/ })
    await expect(lightsDialog.getByRole('button', { name: /Stephen Nightstand/ })).toBeVisible()
    await expect(lightsDialog.getByRole('button', { name: /Your Nightstand/ })).toBeVisible()
    await lightsDialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(lightsDialog).toHaveCount(0)

    await setRoute(page, 'office')
    await expect(page.getByRole('button', { name: /Stephen's PC/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Your PC/ })).toBeVisible()

    await page.setViewportSize(VIEWPORTS['phone-landscape'])
    await expect(page.getByRole('button', { name: /Stephen's PC/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Your PC/ })).toBeVisible()

    await setRoute(page, 'chores')
    await expect(page.getByRole('button', { name: /Stephen's Chores/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Your Chores/ })).toBeVisible()
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const taskDialog = page.getByRole('dialog', { name: 'Create Task' })
    await expect(taskDialog.getByRole('option', { name: 'Stephen' })).toHaveAttribute('value', '1')
    await expect(taskDialog.getByRole('option', { name: 'You' })).toHaveAttribute('value', '2')
    await taskDialog.getByRole('button', { name: 'Close' }).click()
    await expect(taskDialog).toHaveCount(0)

    await page.evaluate(() => window.__mockHass?.setUser({ id: 'unknown-user', name: 'Unknown' }))
    await expect(page.getByRole('button', { name: /Stephen's Tasks/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Steph's Tasks/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Your Chores/ })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])
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
