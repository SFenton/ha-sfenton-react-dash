import { expect, test, type Locator, type Page } from './layout/fixture'

const WEATHER_ENTITY = 'weather.pirate_weather'
const WEATHER_MOTION_DURATION_MS = 390

interface ForecastPatch {
  wind_bearing: number | null
  wind_gust_speed: number
  wind_speed: number
}

async function openWeather(page: Page) {
  await page.goto('/index.html?path=overview')
  await page.waitForFunction(() => (
    document.querySelector<HTMLElement>('[data-weather-rail="temperature"] [data-weather-rail-fill]')
      ?.getBoundingClientRect().width ?? 0
  ) > 20)
  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function windGeometry(list: Locator) {
  return list.evaluate((element) => {
    const arrows = Array.from(element.querySelectorAll<HTMLElement>('[data-forecast-wind-arrow]'))
    const centers = arrows.map((arrow) => {
      const bounds = arrow.getBoundingClientRect()
      return bounds.left + bounds.width / 2
    })
    return {
      animationCount: arrows.reduce((count, arrow) => count + arrow.getAnimations().length, 0),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rowOverflow: Math.max(...Array.from(element.querySelectorAll<HTMLElement>('[data-mode="wind"]')).map((row) => row.scrollWidth - row.clientWidth)),
      spread: Math.max(...centers) - Math.min(...centers),
    }
  })
}

async function updateDailyForecast(page: Page, updates: ForecastPatch[], revision: number) {
  await page.evaluate(({ entityId, forecastUpdates, nextRevision }) => {
    const api = (window as unknown as {
      __mockHass?: {
        setDailyWeatherForecast: (index: number, patch: ForecastPatch) => void
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      }
    }).__mockHass
    forecastUpdates.forEach((patch, index) => api?.setDailyWeatherForecast(index, patch))
    api?.setEntityAttribute(entityId, 'forecast_revision', nextRevision)
  }, { entityId: WEATHER_ENTITY, forecastUpdates: updates, nextRevision: revision })
}

test('daily wind directions remain aligned across responsive and font geometry', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  const dialog = await openWeather(page)
  await dialog.getByRole('button', { name: 'Wind conditions' }).click()
  const list = dialog.locator('[class*="forecastList"][data-mode="wind"]')
  await expect(list.locator('[data-forecast-wind-arrow]')).toHaveCount(7)

  for (const viewport of [
    { height: 852, width: 393 },
    { height: 393, width: 852 },
    { height: 741, width: 1152 },
    { height: 836, width: 842 },
    { height: 1180, width: 820 },
    { height: 820, width: 1180 },
    { height: 900, width: 1440 },
  ]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => windGeometry(list)).toMatchObject({
      animationCount: 0,
      documentOverflow: 0,
      rowOverflow: 0,
    })
    expect((await windGeometry(list)).spread).toBeLessThanOrEqual(0.5)
  }

  await page.setViewportSize({ height: 852, width: 393 })
  await page.addStyleTag({
    content: '[data-forecast-wind-range="true"] { font-size: 1.35rem !important; }',
  })
  await expect.poll(async () => (await windGeometry(list)).spread).toBeLessThanOrEqual(0.5)
  await expect.poll(async () => (await windGeometry(list)).rowOverflow).toBeLessThanOrEqual(1)
})

test('live weather motion shares fixed timing and retargets from the painted state', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  const dialog = await openWeather(page)
  const rails = page.locator('[data-weather-rail]')
  await expect.poll(() => rails.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(0)

  await page.evaluate((entityId) => {
    const api = (window as unknown as {
      __mockHass?: { setEntityAttribute: (nextEntityId: string, attribute: string, value: unknown) => void }
    }).__mockHass
    api?.setEntityAttribute(entityId, 'temperature', 60)
  }, WEATHER_ENTITY)
  await expect.poll(() => rails.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(3)
  const railTiming = await rails.evaluateAll((elements) => elements.flatMap((element) => element.getAnimations().map((animation) => ({
    duration: animation.effect?.getTiming().duration,
    easing: animation.effect?.getTiming().easing,
    startTime: animation.startTime,
  }))))
  expect(new Set(railTiming.map(({ duration }) => duration))).toEqual(new Set([WEATHER_MOTION_DURATION_MS]))
  expect(new Set(railTiming.map(({ easing }) => easing))).toEqual(new Set(['cubic-bezier(0.32, 0.72, 0, 1)']))
  expect(new Set(railTiming.map(({ startTime }) => startTime)).size).toBe(1)
  await rails.evaluateAll((elements, duration) => {
    elements.forEach((element) => {
      const animation = element.getAnimations()[0]
      if (!animation) return
      animation.currentTime = duration * 0.35
      animation.pause()
    })
  }, WEATHER_MOTION_DURATION_MS)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const feelsRail = dialog.locator('[data-weather-rail="feels"]')
  const paintedFeelsMarker = await feelsRail.evaluate((element) => Number.parseFloat(
    getComputedStyle(element).getPropertyValue('--weather-rail-marker'),
  ))
  await page.waitForTimeout(10)
  await page.evaluate((entityId) => {
    const api = (window as unknown as {
      __mockHass?: { setEntityAttribute: (nextEntityId: string, attribute: string, value: unknown) => void }
    }).__mockHass
    api?.setEntityAttribute(entityId, 'temperature', 50)
  }, WEATHER_ENTITY)
  await expect.poll(() => rails.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(3)
  const feelsRetarget = await feelsRail.evaluate((element) => {
    const animation = element.getAnimations()[0]
    const firstFrame = animation.effect?.getKeyframes()[0]
    return {
      duration: animation.effect?.getTiming().duration,
      marker: Number.parseFloat(String(firstFrame?.['--weather-rail-marker'] ?? '')),
    }
  })
  expect(feelsRetarget.duration).toBe(WEATHER_MOTION_DURATION_MS)
  expect(Math.abs(feelsRetarget.marker - paintedFeelsMarker)).toBeLessThanOrEqual(0.5)
  await rails.evaluateAll((elements) => elements.forEach((element) => element.getAnimations()[0]?.finish()))

  await dialog.getByRole('button', { name: 'Wind conditions' }).click()
  const list = dialog.locator('[class*="forecastList"][data-mode="wind"]')
  const arrows = list.locator('[data-forecast-wind-arrow]')
  await expect(arrows).toHaveCount(7)
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(0)

  await updateDailyForecast(page, [
    { wind_bearing: 350, wind_gust_speed: 1000, wind_speed: 100 },
    { wind_bearing: 10, wind_gust_speed: 8, wind_speed: 4 },
    { wind_bearing: 120, wind_gust_speed: 9, wind_speed: 5 },
    { wind_bearing: 300, wind_gust_speed: 10, wind_speed: 6 },
    { wind_bearing: 45, wind_gust_speed: 11, wind_speed: 7 },
    { wind_bearing: 220, wind_gust_speed: 12, wind_speed: 8 },
    { wind_bearing: 80, wind_gust_speed: 13, wind_speed: 9 },
  ], 1)
  await expect(arrows.first()).toHaveAttribute('data-wind-destination-bearing', '170')
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(7)
  const firstTiming = await arrows.evaluateAll((elements) => elements.map((element) => {
    const animation = element.getAnimations()[0]
    return {
      duration: animation.effect?.getTiming().duration,
      easing: animation.effect?.getTiming().easing,
      startTime: animation.startTime,
    }
  }))
  expect(new Set(firstTiming.map(({ duration }) => duration))).toEqual(new Set([WEATHER_MOTION_DURATION_MS]))
  expect(new Set(firstTiming.map(({ easing }) => easing))).toEqual(new Set(['cubic-bezier(0.32, 0.72, 0, 1)']))
  expect(new Set(firstTiming.map(({ startTime }) => startTime)).size).toBe(1)

  await arrows.evaluateAll((elements, duration) => {
    elements.forEach((element) => {
      const animation = element.getAnimations()[0]
      animation.currentTime = duration * 0.35
      animation.pause()
    })
  }, WEATHER_MOTION_DURATION_MS)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const paintedCenters = await arrows.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.left + bounds.width / 2
  }))

  await page.waitForTimeout(10)
  await updateDailyForecast(page, [
    { wind_bearing: 20, wind_gust_speed: 8, wind_speed: 4 },
    { wind_bearing: 60, wind_gust_speed: 7, wind_speed: 3 },
    { wind_bearing: 160, wind_gust_speed: 6, wind_speed: 2 },
    { wind_bearing: 340, wind_gust_speed: 9, wind_speed: 5 },
    { wind_bearing: 90, wind_gust_speed: 10, wind_speed: 6 },
    { wind_bearing: 260, wind_gust_speed: 11, wind_speed: 7 },
    { wind_bearing: 130, wind_gust_speed: 12, wind_speed: 8 },
  ], 2)
  await expect(arrows.first()).toHaveAttribute('data-wind-destination-bearing', '200')
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(7)
  const interruption = await arrows.evaluateAll((elements) => elements.map((element) => {
    const animation = element.getAnimations()[0]
    const frames = animation.effect?.getKeyframes() ?? []
    const firstTransform = String(frames[0]?.transform ?? '')
    const lastTransform = String(frames.at(-1)?.transform ?? '')
    const startTranslate = Number(firstTransform.match(/translateX\((-?[\d.]+)px\)/)?.[1])
    const startRotation = Number(firstTransform.match(/rotate\((-?[\d.]+)deg\)/)?.[1])
    const endRotation = Number(lastTransform.match(/rotate\((-?[\d.]+)deg\)/)?.[1])
    const paintedMatrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    const bounds = element.getBoundingClientRect()
    const finalCenter = bounds.left + bounds.width / 2 - paintedMatrix.e
    return {
      predictedStartCenter: finalCenter + startTranslate,
      rotationDistance: Math.abs(endRotation - startRotation),
    }
  }))
  interruption.forEach((item, index) => {
    expect(Math.abs(item.predictedStartCenter - paintedCenters[index])).toBeLessThanOrEqual(1)
    expect(item.rotationDistance).toBeLessThanOrEqual(180)
  })
  expect((await windGeometry(list)).spread).toBeLessThanOrEqual(0.5)

  await arrows.evaluateAll((elements) => elements.forEach((element) => element.getAnimations()[0]?.finish()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(10)
  await updateDailyForecast(page, [
    { wind_bearing: 40, wind_gust_speed: 9, wind_speed: 5 },
    { wind_bearing: 80, wind_gust_speed: 8, wind_speed: 4 },
    { wind_bearing: 180, wind_gust_speed: 7, wind_speed: 3 },
    { wind_bearing: 0, wind_gust_speed: 10, wind_speed: 6 },
    { wind_bearing: 110, wind_gust_speed: 11, wind_speed: 7 },
    { wind_bearing: 280, wind_gust_speed: 12, wind_speed: 8 },
    { wind_bearing: 150, wind_gust_speed: 13, wind_speed: 9 },
  ], 3)
  await expect(arrows.first()).toHaveAttribute('data-wind-destination-bearing', '220')
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(0)

  await page.evaluate((entityId) => {
    const api = (window as unknown as {
      __mockHass?: { setEntityAttribute: (nextEntityId: string, attribute: string, value: unknown) => void }
    }).__mockHass
    api?.setEntityAttribute(entityId, 'temperature', 50)
  }, WEATHER_ENTITY)
  await expect.poll(() => rails.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(0)
})

test('resize recovery and calm rows preserve shared horizontal motion', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  const dialog = await openWeather(page)
  await dialog.getByRole('button', { name: 'Wind conditions' }).click()
  const arrows = dialog.locator('[data-forecast-wind-arrow]')
  await expect(arrows).toHaveCount(7)

  const initialWind = [
    { wind_bearing: 200, wind_gust_speed: 7.97, wind_speed: 3.56 },
    { wind_bearing: 169, wind_gust_speed: 5.18, wind_speed: 2.31 },
    { wind_bearing: 212, wind_gust_speed: 6.94, wind_speed: 3.18 },
    { wind_bearing: 183, wind_gust_speed: 9.06, wind_speed: 4.58 },
    { wind_bearing: 187, wind_gust_speed: 8.01, wind_speed: 4.08 },
    { wind_bearing: 149, wind_gust_speed: 5.09, wind_speed: 2.31 },
    { wind_bearing: 157, wind_gust_speed: 7.89, wind_speed: 3.96 },
  ]
  await updateDailyForecast(page, initialWind, 10)
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(1)
  await arrows.first().evaluate((element, duration) => {
    const animation = element.getAnimations()[0]
    animation.currentTime = duration * 0.35
    animation.pause()
  }, WEATHER_MOTION_DURATION_MS)
  await page.setViewportSize({ height: 1180, width: 820 })
  await page.waitForTimeout(100)
  await arrows.first().evaluate((element) => element.getAnimations()[0]?.finish())

  await page.waitForTimeout(10)
  await updateDailyForecast(page, [
    { ...initialWind[0], wind_gust_speed: 1000, wind_speed: 100 },
    ...initialWind.slice(1),
  ], 11)
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(7)
  const translatedStarts = await arrows.evaluateAll((elements) => elements.map((element) => {
    const firstFrame = element.getAnimations()[0]?.effect?.getKeyframes()[0]
    return Number(String(firstFrame?.transform ?? '').match(/translateX\((-?[\d.]+)px\)/)?.[1])
  }))
  expect(Math.max(...translatedStarts) - Math.min(...translatedStarts)).toBeLessThanOrEqual(0.5)
  await arrows.evaluateAll((elements) => elements.forEach((element) => element.getAnimations()[0]?.finish()))

  await page.waitForTimeout(10)
  await updateDailyForecast(page, [
    { wind_bearing: null, wind_gust_speed: 8, wind_speed: 4 },
    ...initialWind.slice(1),
  ], 12)
  await expect(arrows.first()).not.toHaveAttribute('data-wind-destination-bearing')
  await expect.poll(() => arrows.evaluateAll((elements) => elements.reduce((count, element) => count + element.getAnimations().length, 0))).toBe(7)
  const calmFrames = await arrows.first().evaluate((element) => (
    element.getAnimations()[0]?.effect?.getKeyframes().map((frame) => String(frame.transform)) ?? []
  ))
  expect(calmFrames).toHaveLength(2)
  expect(calmFrames.every((transform) => transform.endsWith('rotate(0deg)'))).toBe(true)
})
