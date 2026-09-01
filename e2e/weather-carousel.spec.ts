import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'

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
      .map((item) => item.offsetLeft - firstOffset)
    pageOffsets.push(Math.max(0, element.scrollWidth - element.clientWidth))
    return Math.min(...pageOffsets.map((offset) => Math.abs(offset - element.scrollLeft)))
  })).toBeLessThanOrEqual(1)
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
  await heroStrip.focus()
  await heroStrip.press('ArrowRight')
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(40)
  await heroStrip.evaluate((element) => {
    element.scrollLeft = 0
    element.blur()
  })
  const heroStart = await heroStrip.evaluate((element) => element.scrollLeft)
  await dragHorizontally(page, '[data-weather-carousel="hero"]', 210)
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(heroStart + 40)
  await expectAtPageBoundary(heroStrip)
  await expect(heroPagination.locator('[aria-current="page"]')).not.toHaveAttribute('data-weather-carousel-page', '1')
  await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)

  await heroPagination.locator('[data-weather-carousel-page="4"]').click()
  await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(800)
  await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)

  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
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
  await modalPagination.locator('[data-weather-carousel-page="3"]').click()
  await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(500)
  await expect(modalPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '3')
  await modalScroller.evaluate((element) => element.scrollTo({ behavior: 'auto', left: 0 }))
  await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(2)
  await expect(modalPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '1')
  const modalStart = await modalScroller.evaluate((element) => element.scrollLeft)
  await dragHorizontally(page, '[data-weather-carousel="hourly"]', 210)
  await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(modalStart + 40)
  await expectAtPageBoundary(modalScroller)
  await expect(modalPagination.locator('[aria-current="page"]')).not.toHaveAttribute('data-weather-carousel-page', '1')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize({ height: 1180, width: 820 })
  await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '2')
})

test('weather carousels expose boundary-aware mouse and keyboard controls', async ({ browser, baseURL }) => {
  const { context, page } = await openDesktopPage(browser, baseURL ?? 'http://127.0.0.1:5174')
  try {
    const heroFrame = page.locator('[class*="weatherCardFrame"]')
    const heroStrip = heroFrame.locator('[data-weather-carousel="hero"]')
    const heroPrevious = heroFrame.locator('[data-weather-carousel-previous]')
    const heroNext = heroFrame.locator('[data-weather-carousel-next]')
    const heroPagination = heroFrame.locator('[data-weather-carousel-pagination]')
    await expect(heroStrip).toHaveCSS('scroll-snap-type', 'none')
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).toBeVisible()
    await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '2')
    await expect(heroPrevious).toHaveAttribute('aria-disabled', 'true')
    await expect(heroNext).toHaveAttribute('aria-disabled', 'false')

    await heroNext.click()
    await expect.poll(() => heroStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await expect(page.getByRole('dialog', { name: 'Weather' })).toHaveCount(0)
    await expect(heroNext).toHaveAttribute('aria-disabled', 'true')
    await expect(heroNext).toBeFocused()
    await expect(heroPagination.locator('[aria-current="page"]')).toHaveAttribute('data-weather-carousel-page', '2')

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
    await expect(modalFrame.locator('[data-weather-carousel-pagination]')).toHaveAttribute('data-weather-carousel-page-count', '2')
    await modalNext.click()
    await expect.poll(() => modalScroller.evaluate((element) => Math.abs(element.scrollLeft - (element.scrollWidth - element.clientWidth)))).toBeLessThanOrEqual(1)
    await expect(modalNext).toHaveAttribute('aria-disabled', 'true')
    const modalPosition = await modalScroller.evaluate((element) => element.scrollLeft)
    await dialog.getByRole('button', { name: 'Precipitation conditions' }).click()
    await expect.poll(() => modalScroller.evaluate((element) => element.scrollLeft)).toBeCloseTo(modalPosition, 0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.setViewportSize({ height: 1080, width: 1920 })
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).not.toBeVisible()
    await expect(heroPagination).not.toBeVisible()
    await expect(heroPagination).toHaveAttribute('data-weather-carousel-page-count', '1')
    await page.setViewportSize({ height: 900, width: 1440 })
    await expect(heroFrame.locator('[data-weather-carousel-controls]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  } finally {
    await context.close()
  }
})
