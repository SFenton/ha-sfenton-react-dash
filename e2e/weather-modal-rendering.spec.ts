import { expect, test, type Page } from './layout/fixture'

const WEATHER_ENTITY = 'weather.pirate_weather'

async function setWeatherCondition(page: Page, condition: string) {
  await page.evaluate(({ entityId, state }) => {
    const api = (window as unknown as {
      __mockHass: { setEntityState: (nextEntityId: string, nextState: string) => void }
    }).__mockHass
    api.setEntityState(entityId, state)
  }, { entityId: WEATHER_ENTITY, state: condition })
}

async function openWeather(page: Page) {
  const opener = page.getByRole('button', { name: /Open seven-day weather forecast/i })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(650)
  return { dialog, opener }
}

function maxChannelDelta(first: number[], second: number[]) {
  return Math.max(...first.slice(0, 3).map((channel, index) => Math.abs(channel - second[index])))
}

async function screenshotPixels(page: Page, points: Array<{ x: number; y: number }>) {
  const screenshot = await page.screenshot({ animations: 'disabled' })
  return page.evaluate(async ({ imageBase64, samplePoints }) => {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = reject
    })
    image.src = `data:image/png;base64,${imageBase64}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to sample weather modal screenshot')
    context.drawImage(image, 0, 0)
    const scaleX = image.width / window.innerWidth
    const scaleY = image.height / window.innerHeight
    return samplePoints.map(({ x, y }) => (
      Array.from(context.getImageData(
        Math.max(0, Math.min(image.width - 1, Math.round(x * scaleX))),
        Math.max(0, Math.min(image.height - 1, Math.round(y * scaleY))),
        1,
        1,
      ).data)
    ))
  }, { imageBase64: screenshot.toString('base64'), samplePoints: points })
}

async function screenshotDifference(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(async ({ firstBase64, secondBase64 }) => {
    const load = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = `data:image/png;base64,${source}`
    })
    const [firstImage, secondImage] = await Promise.all([load(firstBase64), load(secondBase64)])
    const canvas = document.createElement('canvas')
    canvas.width = firstImage.width
    canvas.height = firstImage.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to compare weather modal screenshots')
    context.drawImage(firstImage, 0, 0)
    const firstPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(secondImage, 0, 0)
    const secondPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let differentPixels = 0
    let maxDelta = 0
    for (let index = 0; index < firstPixels.length; index += 4) {
      let delta = 0
      for (let channel = 0; channel < 4; channel += 1) {
        delta = Math.max(delta, Math.abs(firstPixels[index + channel] - secondPixels[index + channel]))
      }
      if (delta === 0) continue
      differentPixels += 1
      maxDelta = Math.max(maxDelta, delta)
    }
    return {
      differentPixelRatio: differentPixels / (canvas.width * canvas.height),
      maxDelta,
    }
  }, {
    firstBase64: first.toString('base64'),
    secondBase64: second.toString('base64'),
  })
}

test('weather atmosphere preserves the original continuous animation and close lifecycle', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview')
  await setWeatherCondition(page, 'rainy')
  const { dialog, opener } = await openWeather(page)
  const atmosphere = dialog.locator('[data-weather-scene="rain"]')
  await expect(atmosphere.locator('[data-weather-raindrop="true"]')).toHaveCount(34)

  const timing = await atmosphere.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => {
    const effect = animation.effect as KeyframeEffect | null
    const specified = animation.effect?.getTiming()
    return {
      duration: specified?.duration,
      easing: effect?.getKeyframes()[0]?.easing,
      iterations: specified?.iterations,
    }
  }))
  expect(timing).toHaveLength(35)
  expect(timing.every(({ iterations }) => iterations === Number.POSITIVE_INFINITY)).toBe(true)
  expect(timing.filter(({ duration, easing }) => duration === 28_000 && easing === 'ease-in-out')).toHaveLength(1)
  expect(timing.filter(({ duration, easing }) => (
    Number(duration) >= 920
    && Number(duration) <= 1_640
    && easing === 'linear'
  ))).toHaveLength(34)

  await atmosphere.evaluate((element) => {
    ;(window as unknown as { __weatherAtmosphereBeforeRapidReopen?: Element }).__weatherAtmosphereBeforeRapidReopen = element
  })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-closing', 'true')
  await page.waitForTimeout(100)
  expect(await atmosphere.locator('[class*="light"], [class*="motion"], [data-weather-raindrop="true"]').evaluateAll((elements) => (
    elements.every((element) => getComputedStyle(element).animationPlayState === 'paused')
  ))).toBe(true)

  await opener.evaluate((element) => (element as HTMLButtonElement).click())
  await expect(dialog).toHaveAttribute('data-state', 'open')
  const reopenedAtmosphere = dialog.locator('[data-weather-scene="rain"]')
  await expect.poll(() => reopenedAtmosphere.evaluate((element) => (
    element === (window as unknown as { __weatherAtmosphereBeforeRapidReopen?: Element }).__weatherAtmosphereBeforeRapidReopen
  ))).toBe(true)
  expect(await reopenedAtmosphere.locator('[class*="light"]').evaluate((element) => {
    const animation = element.getAnimations()[0]
    return Boolean(animation && animation.playState === 'running')
  })).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(reopenedAtmosphere.locator('[data-weather-raindrop="true"]')).toHaveCount(34)
  await expect(reopenedAtmosphere.locator('[data-weather-rain-field="true"]')).toHaveCSS('display', 'none')
  await expect(reopenedAtmosphere.locator('[data-weather-atmosphere-motion="true"]')).toHaveCSS('animation-name', 'none')
  await expect.poll(() => reopenedAtmosphere.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
})

test('half-occluded weather panels keep the atmosphere visually continuous', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/index.html?path=overview')
  await setWeatherCondition(page, 'sunny')
  const { dialog } = await openWeather(page)
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const panel = dialog.locator('[class*="currentPanel"]')
  const narrative = panel.locator('[class*="currentNarrative"]')
  await expect(narrative).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(narrative.locator('li')).toHaveCount(4)

  const geometry = await body.evaluate((element) => {
    const target = element.querySelector<HTMLElement>('[class*="currentPanel"]')
    if (!target) throw new Error('Weather summary panel unavailable')
    const bodyBounds = element.getBoundingClientRect()
    const targetBounds = target.getBoundingClientRect()
    element.scrollTop += targetBounds.top - (bodyBounds.top - targetBounds.height / 2)
    const nextBodyBounds = element.getBoundingClientRect()
    const nextTargetBounds = target.getBoundingClientRect()
    const candidateX = [
      nextTargetBounds.left - 4,
      nextTargetBounds.left - 8,
      nextTargetBounds.left - 12,
      nextTargetBounds.right + 4,
    ].filter((x) => x > nextBodyBounds.left && x < nextBodyBounds.right)
    return {
      bodyTop: nextBodyBounds.top,
      sampleX: candidateX,
      tileTop: nextTargetBounds.top,
      tileHeight: nextTargetBounds.height,
    }
  })
  expect(Math.abs((geometry.bodyTop - geometry.tileTop) - geometry.tileHeight / 2)).toBeLessThanOrEqual(1)
  expect(await panel.evaluate((element) => {
    const shadow = getComputedStyle(element).boxShadow
    return shadow === 'none' || shadow.split(/,(?![^(]*\))/).every((part) => part.includes('inset'))
  })).toBe(true)

  const points = geometry.sampleX.flatMap((x) => [
    { x, y: geometry.bodyTop - 8 },
    { x, y: geometry.bodyTop + 8 },
    { x, y: geometry.bodyTop + 24 },
    { x, y: geometry.bodyTop + 40 },
  ])
  const pixels = await screenshotPixels(page, points)
  const excesses = geometry.sampleX.map((_, index) => {
    const [above, below, controlTop, controlBottom] = pixels.slice(index * 4, index * 4 + 4)
    return maxChannelDelta(above, below) - maxChannelDelta(controlTop, controlBottom)
  })
  expect(Math.max(...excesses)).toBeLessThanOrEqual(2)
})

test('opaque mobile Weather sheets blur only exposed backdrop bands without changing pixels', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview')
  await setWeatherCondition(page, 'rainy')
  const { dialog } = await openWeather(page)
  const overlay = page.locator('[data-modal-sheet-overlay="true"]')
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  await expect(overlay.locator('[data-modal-backdrop-scrim]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.58)')
  await expect(overlay).toHaveCSS('backdrop-filter', 'none')
  const bandAreaRatio = await overlay.locator('[data-modal-backdrop-band]').evaluateAll((bands) => (
    bands.reduce((area, band) => {
      const bounds = band.getBoundingClientRect()
      return area + bounds.width * bounds.height
    }, 0) / (window.innerWidth * window.innerHeight)
  ))
  expect(bandAreaRatio).toBeLessThanOrEqual(0.25)

  const atmosphere = dialog.locator('[data-weather-scene="rain"]')
  for (const timestamp of [0, 400, 800, 1_200]) {
    await atmosphere.evaluate((element, currentTime) => {
      element.getAnimations({ subtree: true }).forEach((animation) => {
        animation.currentTime = currentTime
        animation.pause()
      })
    }, timestamp)
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    const optimized = await page.screenshot({ animations: 'allow' })
    await overlay.evaluate((element) => element.removeAttribute('data-exposed-backdrop-bands'))
    const baseline = await page.screenshot({ animations: 'allow' })
    const difference = await screenshotDifference(page, optimized, baseline)
    expect(difference.maxDelta).toBeLessThanOrEqual(1)
    expect(difference.differentPixelRatio).toBeLessThanOrEqual(0.0015)
    await overlay.evaluate((element) => element.setAttribute('data-exposed-backdrop-bands', 'true'))
  }

  await page.setViewportSize({ height: 1180, width: 820 })
  await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.58)')
  await expect(overlay.locator('[data-modal-backdrop-band="top"]')).not.toBeVisible()
  await page.setViewportSize({ height: 852, width: 393 })
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true', { timeout: 2_000 })

  await page.emulateMedia({ forcedColors: 'active' })
  await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
})

test('weather full-backdrop preview control retains the original composition', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview&weatherBackdrop=full')
  await setWeatherCondition(page, 'rainy')
  const { dialog } = await openWeather(page)
  const overlay = page.locator('[data-modal-sheet-overlay="true"]')

  await expect(dialog).toHaveAttribute('data-backdrop-policy', 'full')
  await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
  await expect(overlay.locator('[data-modal-backdrop-layer="true"]')).toHaveCount(0)
})
