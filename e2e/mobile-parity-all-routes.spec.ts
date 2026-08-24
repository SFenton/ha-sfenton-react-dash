import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { RESPONSIVE_ROUTES, type ResponsiveRoute } from './responsive-acceptance-data'

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
  maxChannelDelta: number
  meanChannelDelta: number
  route: ResponsiveRoute
  signatureCount: number
}

const BASELINE_URL = process.env.RESPONSIVE_BASELINE_URL
const CANDIDATE_URL = process.env.RESPONSIVE_CANDIDATE_URL
const ARTIFACT_DIR = process.env.RESPONSIVE_ARTIFACT_DIR
const SELECTED_ROUTES = process.env.RESPONSIVE_PARITY_ROUTES
  ? RESPONSIVE_ROUTES.filter((route) => process.env.RESPONSIVE_PARITY_ROUTES?.split(',').includes(route))
  : RESPONSIVE_ROUTES
const MOBILE_VIEWPORT = { height: 852, width: 393 }
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
`

function sanitizeRoute(route: string) {
  return route.replaceAll(/[^a-z0-9-]+/gi, '-')
}

async function preparePage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    viewport: MOBILE_VIEWPORT,
  })
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
  await page.getByRole('navigation', { name: 'Dashboard sections' }).waitFor({ state: 'visible', timeout: 20_000 })
  await page.addStyleTag({ content: SCREENSHOT_STYLE })
  await page.evaluate(() => document.fonts.ready)
  return { context, errors, page }
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
      await page.getByRole('navigation', { name: 'Dashboard sections' }).waitFor({ state: 'visible', timeout: 15_000 })
      ready = true
    } catch (error) {
      if (attempt === 2) throw error
      await page.reload()
    }
  }
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
    const quickLinks = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Quick Links"]')).find(visible) ?? null
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
      + 'nav[aria-label="Dashboard sections"] button, button[aria-label="Quick Links"]',
    )).filter(visible)) {
      if (roots.has(element)) continue
      const label = (
        element.getAttribute('aria-label')
        ?? element.getAttribute('data-section')
        ?? element.textContent?.replaceAll(/\s+/g, ' ').trim().slice(0, 80)
        ?? ''
      ).replaceAll(/-?\d+(?:\.\d+)?/g, '#')
      const baseKey = `${element.tagName}:${element.getAttribute('role') ?? ''}:${label}`
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

async function comparePngs(page: Page, baseline: Buffer, candidate: Buffer) {
  return page.evaluate(async ({ baselineBase64, candidateBase64 }) => {
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
  })
}

test('all 45 routes preserve the clean 393x852 presentation', async ({ browser }) => {
  test.skip(!BASELINE_URL || !CANDIDATE_URL, 'Set responsive baseline and candidate URLs')
  test.setTimeout(600_000)

  const baseline = await preparePage(browser, BASELINE_URL!)
  const candidate = await preparePage(browser, CANDIDATE_URL!)
  const comparisonPage = await browser.newPage()
  const results: RouteParityResult[] = []
  const screenshotDirectory = ARTIFACT_DIR ? path.join(ARTIFACT_DIR, 'phase3-mobile-parity-screenshots') : null
  if (screenshotDirectory) fs.mkdirSync(screenshotDirectory, { recursive: true })

  try {
    for (const route of SELECTED_ROUTES) {
      await test.step(route, async () => {
        await openRoute(baseline.page, route)
        await ensureRouteContent(baseline.page, route)
        await ensureInventoryContent(baseline.page, route)
        await settleStableVisual(baseline.page)
        await openRoute(candidate.page, route)
        await ensureRouteContent(candidate.page, route)
        await ensureInventoryContent(candidate.page, route)
        await settleStableVisual(candidate.page)
        const [baselineSignature, candidateSignature] = await Promise.all([
          pageSignature(baseline.page),
          pageSignature(candidate.page),
        ])
        const geometryMatches = JSON.stringify(candidateSignature) === JSON.stringify(baselineSignature)

        const [baselineScreenshot, candidateScreenshot] = await Promise.all([
          baseline.page.screenshot({ animations: 'disabled', mask: [baseline.page.locator('button[aria-label$=" camera"]')] }),
          candidate.page.screenshot({ animations: 'disabled', mask: [candidate.page.locator('button[aria-label$=" camera"]')] }),
        ])
        if (screenshotDirectory) {
          fs.writeFileSync(path.join(screenshotDirectory, `${sanitizeRoute(route)}-baseline.png`), baselineScreenshot)
          fs.writeFileSync(path.join(screenshotDirectory, `${sanitizeRoute(route)}-candidate.png`), candidateScreenshot)
        }
        const difference = await comparePngs(comparisonPage, baselineScreenshot, candidateScreenshot)
        results.push({
          route,
          differentPixelRatio: difference.differentPixels / (MOBILE_VIEWPORT.width * MOBILE_VIEWPORT.height),
          geometryMatches,
          signatureCount: baselineSignature.length,
          ...difference,
        })
      })
    }

    if (ARTIFACT_DIR) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase3-mobile-parity.json'), `${JSON.stringify({
        baselineURL: BASELINE_URL,
        candidateURL: CANDIDATE_URL,
        generatedAt: new Date().toISOString(),
        routeCount: SELECTED_ROUTES.length,
        results,
        viewport: MOBILE_VIEWPORT,
      }, null, 2)}\n`)
    }

    expect(baseline.errors).toEqual([])
    expect(candidate.errors).toEqual([])
    expect(results.filter((result) => !result.geometryMatches).map((result) => result.route), 'geometry/style parity').toEqual([])
    expect(
      results.filter((result) => result.differentPixelRatio > 0.12 || result.meanChannelDelta > 2)
        .map((result) => ({
          differentPixelRatio: result.differentPixelRatio,
          meanChannelDelta: result.meanChannelDelta,
          route: result.route,
        })),
      'screenshot perceptual parity',
    ).toEqual([])
    expect(results.filter((result) => result.maxChannelDelta > 128).map((result) => ({
      maxChannelDelta: result.maxChannelDelta,
      route: result.route,
    })), 'screenshot maximum channel parity').toEqual([])
  } finally {
    await baseline.context.close()
    await candidate.context.close()
    await comparisonPage.close()
  }
})
