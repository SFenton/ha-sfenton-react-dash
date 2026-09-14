import { expect, test, type Browser, type Locator, type Page } from './layout/fixture'
import { waitForModalReady } from './layout/evidence'

async function dragHorizontally(page: Page, selector: string, distance: number) {
  const target = page.locator(selector)
  const box = await target.boundingBox()
  if (!box) throw new Error(`Missing carousel bounds for ${selector}`)
  const client = await page.context().newCDPSession(page)
  const start = { x: box.x + box.width * 0.72, y: box.y + box.height / 2 }
  const end = { x: start.x - distance, y: start.y }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: start.x, y: start.y }] })
  for (let step = 1; step <= 10; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        id: 1,
        x: start.x + ((end.x - start.x) * step) / 10,
        y: start.y,
      }],
    })
    await page.waitForTimeout(16)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

async function openDesktopPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    viewport: { height: 900, width: 1440 },
  })
  const page = await context.newPage()
  await page.goto(`${baseURL}/index.html?path=overview`)
  return { context, page }
}

async function expectAtPageBoundary(scroller: Locator) {
  await expect.poll(() => scroller.evaluate((element) => {
    const items = Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
    const firstOffset = items[0]?.offsetLeft ?? 0
    const pageOffsets = items
      .filter((item) => item.dataset.carouselPageStart === 'true')
      .map((item) => (
        item.offsetLeft
        - (Number.parseFloat(item.style.getPropertyValue('--weather-carousel-page-leading-space')) || 0)
        - firstOffset
        + (Number.parseFloat(items[0]?.style.getPropertyValue('--weather-carousel-page-leading-space') ?? '') || 0)
      ))
    pageOffsets.push(Math.max(0, element.scrollWidth - element.clientWidth))
    return Math.min(...pageOffsets.map((offset) => Math.abs(offset - element.scrollLeft)))
  })).toBeLessThanOrEqual(3)
}

async function expectFirstPageSettled(scroller: Locator) {
  // The nearest-page indicator can change before native smooth scrolling ends.
  await expect.poll(() => scroller.evaluate(async (element) => {
    const offsets = [element.scrollLeft]
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
      offsets.push(element.scrollLeft)
    }
    return offsets
  })).toEqual([0, 0, 0])
}

async function expectPageSettled(scroller: Locator) {
  await expectAtPageBoundary(scroller)
  await expect.poll(() => scroller.evaluate(async (element) => {
    const offsets = [element.scrollLeft]
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise<void>((done) => requestAnimationFrame(() => done()))
      offsets.push(element.scrollLeft)
    }
    return Math.max(...offsets) - Math.min(...offsets)
  })).toBeLessThanOrEqual(0.5)
}

async function expectCompleteItemsOnly(scroller: Locator) {
  await expect.poll(() => scroller.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const viewportLeft = bounds.left + Number.parseFloat(style.paddingLeft)
    const viewportRight = bounds.right - Number.parseFloat(style.paddingRight)
    return Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
      .map((item) => item.getBoundingClientRect())
      .filter((item) => item.right > viewportLeft + 0.5 && item.left < viewportRight - 0.5)
      .filter((item) => item.left < viewportLeft - 0.5 || item.right > viewportRight + 0.5)
      .length
  })).toBe(0)
}

async function expectPageCentered(scroller: Locator) {
  await expect.poll(() => scroller.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const viewportLeft = bounds.left + Number.parseFloat(style.paddingLeft)
    const viewportRight = bounds.right - Number.parseFloat(style.paddingRight)
    const visibleItems = Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
      .map((item) => item.getBoundingClientRect())
      .filter((item) => item.right > viewportLeft + 0.5 && item.left < viewportRight - 0.5)
    const firstVisible = visibleItems[0]
    const lastVisible = visibleItems.at(-1)
    return firstVisible && lastVisible
      ? Math.abs((firstVisible.left - viewportLeft) - (viewportRight - lastVisible.right))
      : Number.POSITIVE_INFINITY
  })).toBeLessThanOrEqual(3)
}

async function expectPageLeftAligned(scroller: Locator) {
  await expect.poll(() => scroller.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const viewportLeft = bounds.left + Number.parseFloat(style.paddingLeft)
    const firstVisible = Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
      .map((item) => item.getBoundingClientRect())
      .find((item) => item.right > viewportLeft + 0.5)
    return firstVisible ? Math.abs(firstVisible.left - viewportLeft) : Number.POSITIVE_INFINITY
  })).toBeLessThanOrEqual(3)
}

async function visibleItemCount(scroller: Locator) {
  return scroller.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const viewportLeft = bounds.left + Number.parseFloat(style.paddingLeft)
    const viewportRight = bounds.right - Number.parseFloat(style.paddingRight)
    return Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
      .map((item) => item.getBoundingClientRect())
      .filter((item) => item.right > viewportLeft + 0.5 && item.left < viewportRight - 0.5)
      .length
  })
}

async function expectFinalPageAlignment(scroller: Locator) {
  await expectCompleteItemsOnly(scroller)
  const pageItemCounts = await scroller.evaluate((element) => {
    const items = Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
    const starts = items
      .map((item, index) => item.dataset.carouselPageStart === 'true' ? index : -1)
      .filter((index) => index >= 0)
    return starts.map((start, index) => (starts[index + 1] ?? items.length) - start)
  })
  const finalCount = pageItemCounts.at(-1) ?? 0
  const pageCapacity = Math.max(...pageItemCounts)
  if (pageItemCounts.length > 1 && finalCount < pageCapacity) {
    await expectPageLeftAligned(scroller)
  } else {
    await expectPageCentered(scroller)
  }
}

async function carouselDotRhythm(scroller: Locator, dot: Locator, container: Locator) {
  const [scrollerBounds, dotBounds, containerBounds] = await Promise.all([
    scroller.boundingBox(),
    dot.boundingBox(),
    container.boundingBox(),
  ])
  if (!scrollerBounds || !dotBounds || !containerBounds) return null
  return {
    above: Math.round((dotBounds.y - scrollerBounds.y - scrollerBounds.height) * 2) / 2,
    below: Math.round((containerBounds.y + containerBounds.height - dotBounds.y - dotBounds.height) * 2) / 2,
  }
}

async function expectControlsOutsideContent(frame: Locator, scroller: Locator) {
  await expect.poll(async () => {
    const [contentBounds, controlBounds] = await Promise.all([
      scroller.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          left: bounds.left + Number.parseFloat(style.paddingLeft),
          right: bounds.right - Number.parseFloat(style.paddingRight),
        }
      }),
      frame.locator('[data-weather-carousel-controls] button').evaluateAll((buttons) => (
        buttons.map((button) => {
          const bounds = button.getBoundingClientRect()
          return { left: bounds.left, right: bounds.right }
        })
      )),
    ])
    return controlBounds.length === 2
      && controlBounds[0].right <= contentBounds.left
      && controlBounds[1].left >= contentBounds.right
  }).toBe(true)
}

test('weather carousels preserve native touch scrolling without arrow controls', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview')

  const heroFrame = page.locator('[class*="weatherCardFrame"]')
  await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
  const heroPagination = heroFrame.locator('[data-weather-carousel-pagination]')
  await expect(heroPagination).toBeVisible()
  await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '4')
  await expect(heroPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '1')
  const heroStrip = heroFrame.locator('[data-weather-carousel="hero"]')
  await expect(heroStrip).toHaveCSS('scroll-snap-type', 'x mandatory')
  await expectCompleteItemsOnly(heroStrip)
  await expectPageCentered(heroStrip)
  const heroActiveDot = heroPagination.locator('[aria-current="page"] > span')
  const heroDotRhythm = await carouselDotRhythm(
    heroStrip,
    heroActiveDot,
    heroFrame.getByRole('button', { name: /Open seven-day weather forecast/i }),
  )
  expect(heroDotRhythm).toEqual({ above: 10.5, below: 23.5 })
  await heroStrip.focus()
  await heroStrip.press('ArrowRight')
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(40)
  await heroPagination.locator('[data-weather-carousel-page="1"]').click()
  await expect(heroPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '1')
  await expectFirstPageSettled(heroStrip)
  const heroStart = await heroStrip.evaluate((element) => element.scrollLeft)
  await dragHorizontally(page, '[data-weather-carousel="hero"]', 210)
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(heroStart + 40)
  await expectAtPageBoundary(heroStrip)
  await expectCompleteItemsOnly(heroStrip)
  await expectPageCentered(heroStrip)
  await expect(heroPagination.locator('[aria-current="page"]')).not.toHaveAttribute('data-weather-carousel-page', '1')
  await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)

  await heroPagination.locator('[data-weather-carousel-page="4"]').click()
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(800)
  await expectFinalPageAlignment(heroStrip)
  await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)

  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await waitForModalReady(dialog)
  await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
  await expect(dialog.getByRole('region', { name: '24-hour weather conditions' })).toBeVisible()
  const modalFrame = dialog.locator('[class*="hourlyScrollerFrame"]')
  await expect(modalFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
  const modalPagination = modalFrame.locator('[data-weather-carousel-pagination]')
  await expect(modalPagination).toBeVisible()
  await expect(modalPagination).toHaveAttribute('data-weather-carousel-page-count', '6')
  const modalScroller = dialog.locator('[data-weather-carousel="hourly"]')
  await expect(modalScroller).toHaveCSS('scroll-snap-type', 'x mandatory')
  await page.waitForTimeout(650)
  await expect(await carouselDotRhythm(
    modalScroller,
    modalPagination.locator('[aria-current="page"] > span'),
    dialog.locator('[class*="hourlyPanel"]'),
  )).toEqual(heroDotRhythm)
  await modalPagination.locator('[data-weather-carousel-page="3"]').click()
  await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(500)
  await expectCompleteItemsOnly(modalScroller)
  await expect(modalPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '3')
  await modalPagination.locator('[data-weather-carousel-page="1"]').click()
  await expectPageCentered(modalScroller)
  await expectCompleteItemsOnly(modalScroller)
  await expect(modalPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '1')
  await expectFirstPageSettled(modalScroller)
  const modalStart = await modalScroller.evaluate((element) => element.scrollLeft)
  await dragHorizontally(page, '[data-weather-carousel="hourly"]', 210)
  await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(modalStart + 40)
  await expectAtPageBoundary(modalScroller)
  await expectCompleteItemsOnly(modalScroller)
  await expectPageCentered(modalScroller)
  await expect(modalPagination.locator('[aria-current="page"]')).not.toHaveAttribute('data-weather-carousel-page', '1')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize({ height: 1180, width: 820 })
  await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '2')
  await heroPagination.locator('[data-weather-carousel-page="1"]').click()
  await expectFirstPageSettled(heroStrip)
  await heroPagination.locator('[data-weather-carousel-page="2"]').click()
  await expectFinalPageAlignment(heroStrip)
})

test('weather carousel pages stay complete with incomplete final pages aligned left across touch viewports', async ({ baseURL, browser }) => {
  test.setTimeout(120_000)
  const viewports = [
    { height: 393, width: 852 },
    { height: 741, width: 1152 },
    { height: 836, width: 842 },
    { height: 1180, width: 820 },
    { height: 820, width: 1180 },
  ]

  for (const viewport of viewports) {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport,
    })
    const page = await context.newPage()
    try {
      await page.goto(`${baseURL ?? 'http://127.0.0.1:5174'}/index.html?path=overview`)
      const heroFrame = page.locator('[class*="weatherCardFrame"]')
      const heroStrip = heroFrame.locator('[data-weather-carousel="hero"]')
      const heroPagination = heroFrame.locator('[data-weather-carousel-pagination]')
      await expect(heroStrip.locator('[data-carousel-item="true"]').first()).toBeVisible()
      await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
      await expectCompleteItemsOnly(heroStrip)
      await expectPageCentered(heroStrip)
      const heroPageCount = Number(await heroPagination.getAttribute('data-weather-carousel-page-count'))
      if (heroPageCount > 1) {
        await heroPagination.locator(`[data-weather-carousel-page="${heroPageCount}"]`).click()
        await expectFinalPageAlignment(heroStrip)
      }

      await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
      const dialog = page.getByRole('dialog', { name: 'Weather' })
      const modalFrame = dialog.locator('[class*="hourlyScrollerFrame"]')
      const modalScroller = modalFrame.locator('[data-weather-carousel="hourly"]')
      const modalPagination = modalFrame.locator('[data-weather-carousel-pagination]')
      await expect(modalScroller.locator('[data-carousel-item="true"]').first()).toBeVisible()
      await expect(modalFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
      await expectCompleteItemsOnly(modalScroller)
      await expectPageCentered(modalScroller)
      const modalPageCount = Number(await modalPagination.getAttribute('data-weather-carousel-page-count'))
      await modalPagination.locator(`[data-weather-carousel-page="${modalPageCount}"]`).click()
      await expectFinalPageAlignment(modalScroller)
    } finally {
      await context.close()
    }
  }
})

test('incomplete desktop hero page aligns left while complete modal pages stay centered', async ({ browser, baseURL }) => {
  const { context, page } = await openDesktopPage(browser, baseURL ?? 'http://127.0.0.1:5174')
  try {
    const heroFrame = page.locator('[class*="weatherCardFrame"]')
    const heroStrip = heroFrame.locator('[data-weather-carousel="hero"]')
    const heroPagination = heroFrame.locator('[data-weather-carousel-pagination]')
    await expectCompleteItemsOnly(heroStrip)
    const heroFirstPageCount = await visibleItemCount(heroStrip)
    await heroPagination.locator('[data-weather-carousel-page="2"]').click()
    await expect(heroPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '2')
    await expectCompleteItemsOnly(heroStrip)
    expect(await visibleItemCount(heroStrip)).toBeLessThan(heroFirstPageCount)
    await expectPageLeftAligned(heroStrip)

    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await waitForModalReady(dialog)
    const modalFrame = dialog.locator('[class*="hourlyScrollerFrame"]')
    const modalScroller = modalFrame.locator('[data-weather-carousel="hourly"]')
    const modalPagination = modalFrame.locator('[data-weather-carousel-pagination]')
    await expectCompleteItemsOnly(modalScroller)
    const modalFirstPageCount = await visibleItemCount(modalScroller)
    await modalPagination.locator('[data-weather-carousel-page="2"]').click()
    await expect(modalPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '2')
    await expectPageSettled(modalScroller)
    await expectCompleteItemsOnly(modalScroller)
    expect(await visibleItemCount(modalScroller)).toBe(modalFirstPageCount)
    await expectPageCentered(modalScroller)
  } finally {
    await context.close()
  }
})

test('weather carousels expose boundary-aware mouse and keyboard controls', async ({ browser, baseURL }) => {
  const { context, page } = await openDesktopPage(browser, baseURL ?? 'http://127.0.0.1:5174')
  try {
    const heroFrame = page.locator('[class*="weatherCardFrame"]')
    const heroStrip = heroFrame.locator('[data-weather-carousel="hero"]')
    const heroPrevious = heroFrame.locator('[data-weather-carousel-previous]')
    const heroNext = heroFrame.locator('[data-weather-carousel-next]')
    const heroPagination = heroFrame.locator('[data-weather-carousel-pagination]')
    await expect(heroStrip).toHaveCSS('scroll-snap-type', 'x mandatory')
    await expect(heroStrip).not.toHaveCSS('mask-image', 'none')
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).toBeVisible()
    await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '2')
    await expectControlsOutsideContent(heroFrame, heroStrip)
    await expectCompleteItemsOnly(heroStrip)
    await expectPageCentered(heroStrip)
    const heroDotRhythm = await carouselDotRhythm(
      heroStrip,
      heroPagination.locator('[aria-current="page"] > span'),
      heroFrame.getByRole('button', { name: /Open seven-day weather forecast/i }),
    )
    expect(heroDotRhythm).toEqual({ above: 10.5, below: 23.5 })
    await expect(heroPrevious).toHaveAttribute('aria-disabled', 'true')
    await expect(heroNext).toHaveAttribute('aria-disabled', 'false')

    await heroNext.click()
    await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)
    await expect(heroNext).toHaveAttribute('aria-disabled', 'true')
    await expect(heroNext).toBeFocused()
    await expect(heroPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '2')
    await expectPageLeftAligned(heroStrip)
    await expectCompleteItemsOnly(heroStrip)

    await heroPrevious.focus()
    await heroPrevious.press('Home')
    await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBe(0)
    await expect(heroPrevious).toHaveAttribute('aria-disabled', 'true')
    await expect(heroPrevious).toBeFocused()

    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
    await expect(dialog.getByRole('region', { name: '24-hour weather conditions' })).toBeVisible()
    const modalFrame = dialog.locator('[class*="hourlyScrollerFrame"]')
    const modalScroller = dialog.locator('[data-weather-carousel="hourly"]')
    const modalNext = modalFrame.locator('[data-weather-carousel-next]')
    await expect(modalFrame.locator('[data-weather-carousel-controls]')).toBeVisible()
    await expect(modalScroller).not.toHaveCSS('mask-image', 'none')
    await expect(modalFrame.locator('[data-weather-carousel-pagination]')).toHaveAttribute('data-weather-carousel-page-count', '2')
    await expect(await carouselDotRhythm(
      modalScroller,
      modalFrame.locator('[data-weather-carousel-pagination] [aria-current="page"] > span'),
      dialog.locator('[class*="hourlyPanel"]'),
    )).toEqual(heroDotRhythm)
    await expectControlsOutsideContent(modalFrame, modalScroller)
    await expectCompleteItemsOnly(modalScroller)
    await expectPageCentered(modalScroller)
    await modalNext.click()
    await expect.poll(() => modalScroller.evaluate((element) => Math.abs(element.scrollLeft - (element.scrollWidth - element.clientWidth)))).toBeLessThanOrEqual(1)
    await expect(modalNext).toHaveAttribute('aria-disabled', 'true')
    await expectPageCentered(modalScroller)
    await expectCompleteItemsOnly(modalScroller)
    const modalPosition = await modalScroller.evaluate((element) => element.scrollLeft)
    await dialog.getByRole('button', { name: 'Precipitation conditions' }).click()
    await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeCloseTo(modalPosition, 0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.setViewportSize({ height: 1080, width: 1920 })
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
    await expect(heroPagination).not.toBeVisible()
    await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '1')
    await expectPageCentered(heroStrip)
    await page.setViewportSize({ height: 900, width: 1440 })
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  } finally {
    await context.close()
  }
})
