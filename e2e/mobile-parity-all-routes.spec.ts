import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { expect, test, type Browser, type Page } from './layout/fixture'
import { RESPONSIVE_ROUTES, type ResponsiveRoute } from './responsive-acceptance-data'
import { APPROVED_WEATHER_RENDER_MIGRATION_BASE, restoreSourceDeclaredBackdropFilters, selectedParityRoutes } from '../scripts/required-mobile-parity'
import type { RunIdentity } from './layout/types'
import { INTENTIONAL_NEW_ROUTES, INTENTIONAL_ROUTE_REDESIGNS } from './layout/contracts'
import { inspectRouteAddition, normalizeInspectedAddition } from './layout/routeAdditions'

type PixelRegion = { x: number; y: number; width: number; height: number }

type ElementSignature = {
  color: string
  display: string
  fontSize: string
  fontWeight: string
  height: number
  key: string
  lineHeight: string
  overflowX: string
  overflowY: string
  width: number
  x: number
  y: number
}

type RouteParityResult = {
  differentPixels: number
  differentPixelRatio: number
  geometryMatches: boolean
  geometryDifferences: Array<{ index: number; baseline?: ElementSignature; candidate?: ElementSignature }>
  maxChannelDelta: number
  meanChannelDelta: number
  intendedBackMenuRemoval: boolean
  intentionalAddition: Awaited<ReturnType<typeof inspectRouteAddition>>
  route: ResponsiveRoute
  signatureCount: number
  viewport: string
  rawDifferentPixelRatio: number
  rawMaxChannelDelta: number
  approvedHeroRailRegion?: PixelRegion
  intentionalNewRoute: null | {
    owner: string
    referenceRoute: string
    facts: {
      actionCount: number
      colorPickers: number
      rgbChannels: number
      sectionHeadings: string[]
      temperaturePickers: number
    }
  }
  intentionalRouteRedesign: null | {
    buttons: string[]
    heading: string
    owner: string
  }
}

const BASELINE_URL = process.env.RESPONSIVE_BASELINE_URL
const CANDIDATE_URL = process.env.RESPONSIVE_CANDIDATE_URL
const PARITY_REQUIRED = process.env.RESPONSIVE_PARITY_REQUIRED === '1'
const ARTIFACT_DIR = process.env.RESPONSIVE_ARTIFACT_DIR
const SELECTED_ROUTES = selectedParityRoutes(process.env.RESPONSIVE_PARITY_ROUTES, RESPONSIVE_ROUTES)
const RUN = process.env.LAYOUT_RUN_DIR
  ? JSON.parse(fs.readFileSync(path.resolve(process.env.LAYOUT_RUN_DIR, 'run.json'), 'utf8')) as RunIdentity
  : null
const APPROVED_RENDER_MIGRATION = RUN?.source.base === APPROVED_WEATHER_RENDER_MIGRATION_BASE
const PHONE_PARITY_VIEWPORTS = [
  { height: 852, name: 'phone-portrait', width: 393 },
  { height: 393, name: 'phone-landscape', width: 852 },
] as const
const BASELINE_NAVIGATION_LABELS = {
  thermostat: 'Climate',
} satisfies Partial<Record<ResponsiveRoute, string>>
const MOBILE_VIEWPORT = PHONE_PARITY_VIEWPORTS[0]
const SCREENSHOT_STYLE = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
  video, canvas, img {
    visibility: hidden !important;
  }
  [data-parity-background="true"] {
    visibility: hidden !important;
  }
  @media (orientation: landscape) and (max-height: 500px) {
    main header:has(button[aria-label="Go back"]) button[aria-label="Open navigation menu"] {
      visibility: hidden !important;
    }
  }
`

function sanitizeRoute(route: string) {
  return route.replaceAll(/[^a-z0-9-]+/gi, '-')
}

async function waitForPrimaryNavigation(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const selectors = [
      '[data-adaptive-navigation="rail"]',
      '[data-adaptive-navigation="bottom"]',
      'button[aria-label="Open navigation menu"]',
      '[data-app-header-back="true"]',
      'button[aria-label="Go back"]',
    ]
    return selectors.some((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
    })
  }), { timeout: 20_000 }).toBe(true)
}

async function preparePage(
  browser: Browser,
  baseURL: string,
  viewport: { height: number; width: number } = MOBILE_VIEWPORT,
  restoreDeclaredFilters = false,
) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    viewport,
  })
  const filterRepairs: Array<{ url: string; originalHash: string; restoredHash: string; declarations: number }> = []
  if (restoreDeclaredFilters) {
    if (!APPROVED_RENDER_MIGRATION || baseURL !== BASELINE_URL) throw new Error('Only the attested approved baseline may receive the declared-filter replay')
    await context.route(`${baseURL}/assets/*.css`, async (route) => {
      const response = await route.fetch()
      const original = await response.text()
      const restored = restoreSourceDeclaredBackdropFilters(original)
      filterRepairs.push({
        url: route.request().url(),
        originalHash: createHash('sha256').update(original).digest('hex'),
        restoredHash: createHash('sha256').update(restored.css).digest('hex'),
        declarations: restored.repairs.length,
      })
      await route.fulfill({ response, body: restored.css })
    })
  }
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('WebSocket connection to ')) return
    if (text.startsWith('[StreamManager] WebSocket error for ')) return
    if (text === 'Failed to load resource: net::ERR_NETWORK_CHANGED') return
    errors.push(`console: ${text}`)
  })
  await page.goto(`${baseURL}/index.html?path=overview`)
  await waitForPrimaryNavigation(page)
  await page.addStyleTag({ content: SCREENSHOT_STYLE })
  await page.evaluate(() => document.fonts.ready)
  return { context, errors, page, filterRepairs }
}

async function settleOpenedRoute(page: Page) {
  await page.addStyleTag({ content: SCREENSHOT_STYLE })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')) {
      const rect = element.getBoundingClientRect()
      if (getComputedStyle(element).position === 'fixed' && rect.width >= innerWidth && rect.height >= innerHeight) {
        element.dataset.parityBackground = 'true'
      }
    }
    for (const animation of document.getAnimations()) animation.finish()
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish()
  })
  await page.waitForTimeout(50)
}

async function openRoute(page: Page, route: ResponsiveRoute) {
  let ready = false
  for (let attempt = 0; attempt < 3 && !ready; attempt += 1) {
    await page.evaluate((nextRoute) => {
      const url = new URL(window.location.href)
      url.searchParams.set('path', nextRoute)
      url.hash = ''
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, route)
    try {
      await waitForPrimaryNavigation(page)
      ready = true
    } catch (error) {
      if (attempt === 2) throw error
      await page.reload()
    }
  }
  await settleOpenedRoute(page)
}

async function openBaselineRoute(page: Page, route: ResponsiveRoute) {
  const navigationLabel = BASELINE_NAVIGATION_LABELS[route]
  if (!navigationLabel) {
    await openRoute(page, route)
    return
  }

  await openRoute(page, 'overview')
  const navigationButtons = page.getByRole('button', { name: navigationLabel, exact: true })
  for (let index = 0; index < await navigationButtons.count(); index += 1) {
    const button = navigationButtons.nth(index)
    if (!await button.isVisible()) continue
    await button.click()
    await waitForPrimaryNavigation(page)
    await settleOpenedRoute(page)
    return
  }

  const menuButton = page.getByRole('button', { name: 'Open navigation menu' })
  if (await menuButton.isVisible()) {
    await menuButton.click()
    const drawer = page.locator('[data-adaptive-navigation="drawer"][data-state="open"]')
    await drawer.getByRole('menuitem', { name: navigationLabel, exact: true }).click()
    await waitForPrimaryNavigation(page)
    await settleOpenedRoute(page)
    return
  }

  throw new Error(`No visible baseline navigation button found for ${route}`)
}

async function ensureInventoryContent(page: Page, route: ResponsiveRoute) {
  if (!['all-food', 'pantry', 'fridge', 'freezer', 'spice-rack', 'cabinet'].includes(route)) return
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await page.locator('[aria-label$=" inventory list"]:visible').count() > 0) return
    await openRoute(page, 'overview')
    await openRoute(page, route)
  }
  throw new Error(`${route} inventory did not reach its content state`)
}

async function ensureRouteContent(page: Page, route: ResponsiveRoute) {
  const readiness = route === 'food'
    ? page.getByRole('heading', { name: 'Suggested Recipes' })
    : route === 'recipes'
      ? page.locator('[data-recipe-card]:visible').first()
      : null
  if (!readiness) return

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await readiness.waitFor({ state: 'visible', timeout: 15_000 })
      return
    } catch (error) {
      if (attempt === 2) throw error
      await openRoute(page, 'overview')
      await openRoute(page, route)
    }
  }
}

async function settleStableVisual(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    const target = document.querySelector('main') ?? document.body
    let quietTimer = window.setTimeout(finish, 300)
    const maximumTimer = window.setTimeout(finish, 3_000)
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer)
      quietTimer = window.setTimeout(finish, 300)
    })
    function finish() {
      window.clearTimeout(quietTimer)
      window.clearTimeout(maximumTimer)
      observer.disconnect()
      resolve()
    }
    observer.observe(target, { attributes: true, childList: true, subtree: true })
  }))
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish()
  })
  await page.waitForTimeout(50)
}

async function pageSignature(page: Page): Promise<ElementSignature[]> {
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const round = (value: number) => Math.round(value * 10) / 10
    const main = document.querySelector<HTMLElement>('main')
    const header = main?.querySelector<HTMLElement>('header') ?? null
    const scroller = main
      ? Array.from(main.querySelectorAll<HTMLElement>('div'))
          .filter(visible)
          .filter((element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
          .sort((left, right) => right.getBoundingClientRect().height - left.getBoundingClientRect().height)[0] ?? null
      : null
    const bottomNavigation = Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="Dashboard sections"]')).find(visible) ?? null
    const quickLinks = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Quick Links"], button[aria-label="Open Chat and Quick Links"]')).find(visible) ?? null
    let floatingDock = quickLinks?.parentElement ?? null
    while (floatingDock && getComputedStyle(floatingDock).position !== 'fixed') floatingDock = floatingDock.parentElement

    const entries: Array<{ element: HTMLElement; key: string }> = []
    const add = (key: string, element: HTMLElement | null | undefined) => {
      if (element && visible(element)) entries.push({ element, key })
    }
    add('root:main', main)
    add('root:header', header)
    add('root:scroller', scroller)
    add('root:bottom-navigation', bottomNavigation)
    add('root:floating-dock', floatingDock)

    const roots = new Set(entries.map(({ element }) => element))
    const occurrences = new Map<string, number>()
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(
      'main h1, main h2, main h3, main header button, '
      + 'nav[aria-label="Dashboard sections"] button, button[aria-label="Quick Links"], button[aria-label="Open Chat and Quick Links"]',
    )).filter(visible)) {
      if (roots.has(element)) continue
      const label = (
        element.getAttribute('aria-label')
        ?? element.getAttribute('data-section')
        ?? element.textContent?.replaceAll(/\s+/g, ' ').trim().slice(0, 80)
        ?? ''
      ).replaceAll(/-?\d+(?:\.\d+)?/g, '#')
      // The global action intentionally gains Chat in its name; retain its geometry comparison.
      const identity = element === quickLinks ? 'global-quick-links-action' : label
      const baseKey = `${element.tagName}:${element.getAttribute('role') ?? ''}:${identity}`
      const occurrence = occurrences.get(baseKey) ?? 0
      occurrences.set(baseKey, occurrence + 1)
      entries.push({ element, key: `${baseKey}:${occurrence}` })
    }

    return entries.map(({ element, key }) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        color: style.color,
        display: style.display,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        height: round(rect.height),
        key,
        lineHeight: style.lineHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        width: round(rect.width),
        x: round(rect.x),
        y: round(rect.y),
      }
    })
  })
}

async function comparePngs(page: Page, baseline: Buffer, candidate: Buffer, ignoredRegions: PixelRegion[] = []) {
  return page.evaluate(async ({ baselineBase64, candidateBase64, ignoredRegions }) => {
    const load = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = `data:image/png;base64,${source}`
    })
    const [baselineImage, candidateImage] = await Promise.all([
      load(baselineBase64),
      load(candidateBase64),
    ])
    if (baselineImage.width !== candidateImage.width || baselineImage.height !== candidateImage.height) {
      return {
        differentPixels: baselineImage.width * baselineImage.height,
        maxChannelDelta: 255,
        meanChannelDelta: 255,
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = baselineImage.width
    canvas.height = baselineImage.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to create screenshot comparison canvas')
    context.drawImage(baselineImage, 0, 0)
    const baselineData = context.getImageData(0, 0, canvas.width, canvas.height).data
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(candidateImage, 0, 0)
    const candidateData = context.getImageData(0, 0, canvas.width, canvas.height).data

    let differentPixels = 0
    let maxChannelDelta = 0
    let totalDelta = 0
    for (let index = 0; index < baselineData.length; index += 4) {
      const x = (index / 4) % canvas.width
      const y = Math.floor(index / 4 / canvas.width)
      if (ignoredRegions.some((region) => x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height)) continue
      let pixelDelta = 0
      for (let channel = 0; channel < 4; channel += 1) {
        pixelDelta = Math.max(pixelDelta, Math.abs(baselineData[index + channel] - candidateData[index + channel]))
      }
      if (pixelDelta === 0) continue
      differentPixels += 1
      maxChannelDelta = Math.max(maxChannelDelta, pixelDelta)
      totalDelta += pixelDelta
    }
    return {
      differentPixels,
      maxChannelDelta,
      meanChannelDelta: totalDelta / (canvas.width * canvas.height),
    }
  }, {
    baselineBase64: baseline.toString('base64'),
    candidateBase64: candidate.toString('base64'),
    ignoredRegions,
  })
}

async function approvedHeroRailRegion(baseline: Page, candidate: Page): Promise<PixelRegion | undefined> {
  if (!APPROVED_RENDER_MIGRATION) return undefined
  const beforeHero = baseline.locator('[class*="heroDayForecast"]:visible').first()
  const afterHero = candidate.locator('[class*="heroDayForecast"]:visible').first()
  const before = beforeHero.locator('[class*="heroDayRangeTrack"]')
  const after = afterHero.locator('[data-weather-rail="temperature"]')
  if (await before.count() === 0 || await after.count() === 0) return undefined
  await expect(before).toHaveCount(1)
  await expect(after).toHaveCount(1)
  const beforeBox = await before.boundingBox()
  const afterBox = await after.boundingBox()
  if (!beforeBox || !afterBox) throw new Error('Approved rail migration must retain measurable geometry')
  for (const key of ['x', 'width'] as const) expect(Math.abs(beforeBox[key] - afterBox[key])).toBeLessThanOrEqual(1)
  expect(Math.abs(beforeBox.height - 8)).toBeLessThanOrEqual(0.1)
  expect(Math.abs(afterBox.height - 10)).toBeLessThanOrEqual(0.1)
  expect(Math.abs(beforeBox.y + beforeBox.height / 2 - afterBox.y - afterBox.height / 2)).toBeLessThanOrEqual(1)
  const labels = (page: Page) => page.locator('[class*="heroDayForecast"]:visible [class*="heroDayLow"], [class*="heroDayForecast"]:visible [class*="heroDayHigh"]')
    .evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return { text: element.textContent, color: style.color, font: style.font, x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 }
    }))
  expect(await labels(candidate)).toEqual(await labels(baseline))
  expect(await afterHero.getAttribute('aria-label')).toBe(await beforeHero.getAttribute('aria-label'))
  const region = { x: Math.floor(beforeBox.x - 12), y: Math.floor(Math.min(beforeBox.y, afterBox.y) - 12), width: Math.ceil(beforeBox.width + 24), height: Math.ceil(Math.max(beforeBox.height, afterBox.height) + 24) }
  expect(region.height).toBeLessThanOrEqual(40)
  const viewport = candidate.viewportSize()!
  expect(region.width * region.height / (viewport.width * viewport.height)).toBeLessThan(0.08)
  return region
}

for (const parityViewport of PHONE_PARITY_VIEWPORTS) {
  test(`all ${SELECTED_ROUTES.length} routes preserve the clean ${parityViewport.width}x${parityViewport.height} ${parityViewport.name} presentation`, async ({ browser }) => {
    if (!BASELINE_URL || !CANDIDATE_URL) {
      test.skip(!PARITY_REQUIRED, 'Set responsive baseline and candidate URLs')
      throw new Error('Required mobile parity needs RESPONSIVE_BASELINE_URL and RESPONSIVE_CANDIDATE_URL')
    }
    expect(BASELINE_URL, 'Baseline and candidate cannot be the same server').not.toBe(CANDIDATE_URL)
    expect(SELECTED_ROUTES.length, 'Required route loop cannot be empty').toBeGreaterThan(0)
    test.setTimeout(600_000)

    const baseline = await preparePage(browser, BASELINE_URL!, parityViewport, APPROVED_RENDER_MIGRATION)
    const rawBaseline = APPROVED_RENDER_MIGRATION ? await preparePage(browser, BASELINE_URL!, parityViewport) : null
    const candidate = await preparePage(browser, CANDIDATE_URL!, parityViewport)
    const comparisonPage = await browser.newPage()
    const results: RouteParityResult[] = []
    const screenshotDirectory = ARTIFACT_DIR
      ? path.join(ARTIFACT_DIR, 'phase3-mobile-parity-screenshots', parityViewport.name)
      : null
    if (screenshotDirectory) fs.mkdirSync(screenshotDirectory, { recursive: true })

    try {
      for (const route of SELECTED_ROUTES) {
        await test.step(route, async () => {
          const newRouteContract = INTENTIONAL_NEW_ROUTES[route]
          const redesignContract = INTENTIONAL_ROUTE_REDESIGNS[route]
          const baselineRoute = (newRouteContract?.referenceRoute ?? route) as ResponsiveRoute
          if (rawBaseline) {
            await openBaselineRoute(rawBaseline.page, baselineRoute)
            await ensureRouteContent(rawBaseline.page, baselineRoute)
            await ensureInventoryContent(rawBaseline.page, baselineRoute)
            await settleStableVisual(rawBaseline.page)
          }
          await openBaselineRoute(baseline.page, baselineRoute)
          await ensureRouteContent(baseline.page, baselineRoute)
          await ensureInventoryContent(baseline.page, baselineRoute)
          await settleStableVisual(baseline.page)
          await openRoute(candidate.page, route)
          await ensureRouteContent(candidate.page, route)
          await ensureInventoryContent(candidate.page, route)
          await settleStableVisual(candidate.page)
          const backHeaderSelector = 'main header:has(button[aria-label="Go back"])'
          const oldBackMenuSelector = `${backHeaderSelector} button[aria-label="Open navigation menu"]`
          const baselineBackMenus = await baseline.page.locator(oldBackMenuSelector).count()
          await expect(candidate.page.locator(oldBackMenuSelector), `${route}: Back replaces the menu in the DOM`).toHaveCount(0)
          const intentionalAddition = await inspectRouteAddition(baseline.page, candidate.page, route, parityViewport.name)
          if (intentionalAddition && screenshotDirectory) {
            await candidate.page.screenshot({
              path: path.join(screenshotDirectory, `${sanitizeRoute(route)}-with-declared-addition.png`),
              animations: 'disabled',
            })
          }
          const restoreAddition = intentionalAddition
            ? await normalizeInspectedAddition(candidate.page, intentionalAddition)
            : null
          try {
          const [rawBaselineSignature, rawCandidateSignature] = await Promise.all([
            pageSignature(baseline.page),
            pageSignature(candidate.page),
          ])
          let intentionalNewRoute: RouteParityResult['intentionalNewRoute'] = null
          let intentionalRouteRedesign: RouteParityResult['intentionalRouteRedesign'] = null
          let baselineSignature = rawBaselineSignature
          let candidateSignature = rawCandidateSignature
          if (newRouteContract) {
            const root = candidate.page.locator(newRouteContract.root)
            await expect(root).toHaveCount(1)
            await expect(candidate.page.getByRole('heading', { level: 1, name: newRouteContract.heading })).toHaveCount(1)
            const back = candidate.page.locator('main header button[aria-label="Go back"]')
            await expect(back).toContainText(newRouteContract.backLabel)
            expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(24)
            const facts = await root.evaluate((element) => ({
              actionCount: element.querySelectorAll('button, a, [role="button"]').length,
              colorPickers: element.querySelectorAll('[data-light-color-picker="true"]').length,
              rgbChannels: element.querySelectorAll('input[aria-label$=" channel"]').length,
              sectionHeadings: [...element.querySelectorAll('h2')].map((heading) => heading.textContent?.trim() ?? ''),
              temperaturePickers: element.querySelectorAll('[data-light-temperature-picker="true"]').length,
            }))
            expect(facts, `${route}: declared new-route controls`).toEqual(newRouteContract.expected)
            const sharedShell = (entry: ElementSignature) => !/^H[1-3]:/.test(entry.key) && entry.key !== 'BUTTON::Go back:0'
            baselineSignature = rawBaselineSignature.filter(sharedShell)
            candidateSignature = rawCandidateSignature.filter(sharedShell)
            intentionalNewRoute = {
              owner: newRouteContract.owner,
              referenceRoute: newRouteContract.referenceRoute,
              facts,
            }
          }
          if (redesignContract) {
            await expect(candidate.page.getByRole('heading', { level: 1, name: redesignContract.heading })).toHaveCount(1)
            const buttonNames = await candidate.page.getByRole('button')
              .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''))
            const matchedButtons = redesignContract.expectedButtons.map((pattern) => {
              const match = buttonNames.find((name) => pattern.test(name))
              if (!match) throw new Error(`Missing intentional redesign button for ${route}: ${pattern}`)
              return match
            })
            intentionalRouteRedesign = {
              buttons: matchedButtons,
              heading: redesignContract.heading,
              owner: redesignContract.owner,
            }
          }
          const geometryMatches = JSON.stringify(candidateSignature) === JSON.stringify(baselineSignature)
          const geometryDifferences = Array.from(
            { length: Math.max(baselineSignature.length, candidateSignature.length) },
            (_, index) => ({ index, baseline: baselineSignature[index], candidate: candidateSignature[index] }),
          ).filter((entry) => JSON.stringify(entry.baseline) !== JSON.stringify(entry.candidate))

          const [baselineScreenshot, candidateScreenshot] = await Promise.all([
            baseline.page.screenshot({ animations: 'disabled', mask: [baseline.page.locator('button[aria-label$=" camera"]')] }),
            candidate.page.screenshot({ animations: 'disabled', mask: [candidate.page.locator('button[aria-label$=" camera"]')] }),
          ])
          const rawBaselineScreenshot = rawBaseline
            ? await rawBaseline.page.screenshot({ animations: 'disabled', mask: [rawBaseline.page.locator('button[aria-label$=" camera"]')] })
            : baselineScreenshot
          if (screenshotDirectory) {
            fs.writeFileSync(path.join(screenshotDirectory, `${sanitizeRoute(route)}-baseline.png`), baselineScreenshot)
            fs.writeFileSync(path.join(screenshotDirectory, `${sanitizeRoute(route)}-candidate.png`), candidateScreenshot)
            if (rawBaseline) fs.writeFileSync(path.join(screenshotDirectory, `${sanitizeRoute(route)}-raw-baseline.png`), rawBaselineScreenshot)
          }
          const rawDifference = await comparePngs(comparisonPage, rawBaselineScreenshot, candidateScreenshot)
          const railRegion = route === 'overview' ? await approvedHeroRailRegion(baseline.page, candidate.page) : undefined
          const difference = await comparePngs(comparisonPage, baselineScreenshot, candidateScreenshot, railRegion ? [railRegion] : [])
          results.push({
            route,
            differentPixelRatio: difference.differentPixels / (parityViewport.width * parityViewport.height),
            geometryMatches,
            geometryDifferences,
            intendedBackMenuRemoval: baselineBackMenus > 0,
            intentionalAddition,
            signatureCount: baselineSignature.length,
            viewport: parityViewport.name,
            rawDifferentPixelRatio: rawDifference.differentPixels / (parityViewport.width * parityViewport.height),
            rawMaxChannelDelta: rawDifference.maxChannelDelta,
            approvedHeroRailRegion: railRegion,
            intentionalNewRoute,
            intentionalRouteRedesign,
            ...difference,
          })
          } finally {
            await restoreAddition?.()
          }
        })
      }

      if (ARTIFACT_DIR) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
        const artifactName = parityViewport.name === 'phone-portrait'
          ? 'phase3-mobile-parity.json'
          : `phase3-mobile-parity-${parityViewport.name}.json`
        fs.writeFileSync(path.join(ARTIFACT_DIR, artifactName), `${JSON.stringify({
          baselineURL: BASELINE_URL,
          candidateURL: CANDIDATE_URL,
          generatedAt: new Date().toISOString(),
          screenshotNormalization: 'Obsolete Back-page menu glyphs are hidden without changing layout. Only for the attested ab84f9a approved rendering migration, baseline-browser CSS replays its source-declared filters and the approved decorative hero rail region is compared by unchanged geometry/labels plus focused rail guards. A registry-declared added section is hidden only after its exact geometry/semantics and every inherited section are asserted; its visible layout is captured separately. Raw baseline/candidate PNGs and raw deltas are retained. No candidate filter is repaired and numeric parity tolerances are unchanged.',
          baselineFilterRepairs: baseline.filterRepairs,
          routeCount: SELECTED_ROUTES.length,
          results,
          viewport: parityViewport,
        }, null, 2)}\n`)
      }

      expect(baseline.errors).toEqual([])
      if (rawBaseline) expect(rawBaseline.errors).toEqual([])
      expect(candidate.errors).toEqual([])
      expect(results.filter((result) => result.intentionalNewRoute === null && result.intentionalRouteRedesign === null && !result.geometryMatches).map((result) => result.route), 'geometry/style parity').toEqual([])
      const comparableResults = results.filter((result) => result.intentionalNewRoute === null && result.intentionalRouteRedesign === null)
      expect(
        comparableResults.filter((result) => result.differentPixelRatio > 0.12 || result.meanChannelDelta > 2)
          .map((result) => ({
            differentPixelRatio: result.differentPixelRatio,
            meanChannelDelta: result.meanChannelDelta,
            route: result.route,
          })),
        'screenshot perceptual parity',
      ).toEqual([])
      expect(comparableResults.filter((result) => result.maxChannelDelta > 128).map((result) => ({
        maxChannelDelta: result.maxChannelDelta,
        route: result.route,
      })), 'screenshot maximum channel parity').toEqual([])
    } finally {
      await baseline.context.close()
      await rawBaseline?.context.close()
      await candidate.context.close()
      await comparisonPage.close()
    }
  })
}

test('Food and Recipes preserves narrow mobile tile geometry', async ({ browser }) => {
  if (!BASELINE_URL || !CANDIDATE_URL) {
    test.skip(!PARITY_REQUIRED, 'Set responsive baseline and candidate URLs')
    throw new Error('Required mobile parity needs RESPONSIVE_BASELINE_URL and RESPONSIVE_CANDIDATE_URL')
  }

  const baseline = await preparePage(browser, BASELINE_URL)
  const candidate = await preparePage(browser, CANDIDATE_URL)
  try {
    await openRoute(baseline.page, 'food')
    await ensureRouteContent(baseline.page, 'food')
    await settleStableVisual(baseline.page)
    await openRoute(candidate.page, 'food')
    await ensureRouteContent(candidate.page, 'food')
    await settleStableVisual(candidate.page)

    const geometry = async (page: Page) => {
      const allRecipes = page.getByRole('button', { exact: true, name: 'All Recipes' })
      const allFood = page.getByRole('button', { name: /^All Food / })
      const [allRecipesBox, allFoodBox] = await Promise.all([allRecipes.boundingBox(), allFood.boundingBox()])
      return {
        allFood: allFoodBox && {
          height: Math.round(allFoodBox.height),
          width: Math.round(allFoodBox.width),
          x: Math.round(allFoodBox.x),
        },
        allRecipes: allRecipesBox && {
          height: Math.round(allRecipesBox.height),
          width: Math.round(allRecipesBox.width),
          x: Math.round(allRecipesBox.x),
        },
      }
    }

    const candidateGeometry = await geometry(candidate.page)
    expect(candidateGeometry).toEqual({
      allFood: { height: 120, width: 176, x: 16 },
      allRecipes: { height: 120, width: 361, x: 16 },
    })
  } finally {
    await baseline.context.close()
    await candidate.context.close()
  }
})
