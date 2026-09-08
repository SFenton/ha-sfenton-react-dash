import { expect, test, type Page } from './layout/fixture'
import { WEATHER_SCENES } from '../src/components/hass/weatherPresentation'
import type { MockHassDebugApi } from '../src/test/mocks/hakitCoreState'
import { setWeatherSceneDebug } from './weather-scene-debug'

async function openWeather(page: Page, debug = true) {
  await page.goto(`/index.html?path=overview&weatherScene=rainy&modalBackdrop=full${debug ? '&weatherSceneDebug=1' : ''}`)
  await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(650)
  return dialog
}

test('explicit scene URLs cover every background without controls or changed live readings', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openWeather(page)
  const atmosphere = dialog.locator('[data-weather-scene]')
  const readings = dialog.getByRole('region', { name: 'Current weather conditions' })
  const originalReadings = await readings.innerText()
  const originalCalls = await page.evaluate(() => (
    (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass.calls.length
  ))
  const modalId = await dialog.getAttribute('id')
  if (!modalId) throw new Error('Weather modal must retain its identity while switching scenes')
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'rain')
  await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)

  for (const scene of WEATHER_SCENES) {
    await setWeatherSceneDebug(page, scene)
    await expect(atmosphere).toHaveAttribute('data-weather-scene', scene)
    await expect(atmosphere).toHaveCSS('background-image', /linear-gradient/)
    await expect(atmosphere.locator('[data-weather-raindrop]')).toHaveCount(
      scene === 'storm' ? 44 : scene === 'rain' ? 34 : 0,
    )
    await expect(dialog).toHaveAttribute('id', modalId)
    expect(await readings.innerText()).toBe(originalReadings)
    expect(new URL(page.url()).searchParams.get('weatherScene')).toBe(scene)
    expect(new URL(page.url()).searchParams.get('modalBackdrop')).toBe('full')
  }
  expect(await page.evaluate(() => (
    (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass.calls.length
  ))).toBe(originalCalls)

  await setWeatherSceneDebug(page, 'live')
  expect(new URL(page.url()).searchParams.has('weatherScene')).toBe(false)
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setEntityState('sun.sun', 'below_horizon')
    api.setEntityState('weather.pirate_weather', 'sunny')
  })
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'night')
  await setWeatherSceneDebug(page, 'sunny')
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'sunny')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setWeatherSceneDebug(page, 'rain')
  await expect(atmosphere.locator('[data-weather-rain-field]')).toHaveCSS('display', 'none')
  await expect.poll(() => atmosphere.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
  await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'rain')
  await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)
})

test('normal Weather ignores old dropdown URLs and follows live conditions on every open', async ({ page }) => {
  const dialog = await openWeather(page, false)
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setEntityState('sun.sun', 'below_horizon')
    api.setEntityState('weather.pirate_weather', 'sunny')
  })
  await expect(dialog.locator('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'night')
  await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)
  await setWeatherSceneDebug(page, 'snow')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
  await page.evaluate(() => {
    const url = new URL(location.href)
    url.searchParams.delete('weatherSceneDebug')
    history.replaceState(history.state, '', url)
  })
  await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  await expect(dialog.locator('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'night')
})

test('Pressure matches small highlight peers without clipping across units and mounted viewport roundtrips', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const dialog = await openWeather(page, false)
  const modalId = await dialog.getAttribute('id')
  const pressure = dialog.locator('[data-kind="pressure"]')
  const canonical = [
    { width: 393, height: 852 },
    { width: 852, height: 393 },
    { width: 1152, height: 741 },
    { width: 842, height: 836 },
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]
  const pressureCases = [
    { value: 29.92, unit: 'inHg', available: true },
    { value: 1013.25, unit: 'hPa', available: true },
    { value: 1013.25, unit: 'mbar', available: true },
    { value: 1013.25, unit: 'mb', available: true },
    { value: 101.325, unit: 'kPa', available: true },
    { value: 101325.25, unit: 'Pa', available: true },
    { value: null, unit: 'hPa', available: false },
    { value: 29.92, unit: 'unknown', available: false },
  ]
  const observations: unknown[] = []

  async function measure() {
    await expect(dialog).toHaveAttribute('id', modalId!)
    await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)
    const geometry = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!
      const bodyBounds = body.getBoundingClientRect()
      const pressure = element.querySelector<HTMLElement>('[data-kind="pressure"]')!
      const tile = pressure.getBoundingClientRect()
      const peerHeights = ['feels', 'uv', 'sun', 'visibility'].map((kind) => (
        element.querySelector(`[data-kind="${kind}"]`)!.getBoundingClientRect().height
      ))
      const labels = [...pressure.querySelectorAll<HTMLElement>('[class*="pressureGaugeReadout"], [class*="pressureGaugeLowLabel"], [class*="pressureGaugeHighLabel"], [class*="highlightTitle"]')]
        .map((label) => {
          const rect = label.getBoundingClientRect()
          return {
            text: label.textContent, fontSize: parseFloat(getComputedStyle(label).fontSize),
            contained: rect.left >= tile.left && rect.right <= tile.right && rect.top >= tile.top && rect.bottom <= tile.bottom,
          }
        })
      const svg = pressure.querySelector<SVGSVGElement>('[class*="pressureGaugeSvg"]')
      const ink = svg?.getBBox()
      const matrix = svg?.getScreenCTM()
      const painted = ink && matrix ? {
        left: matrix.e + ink.x * matrix.a, right: matrix.e + (ink.x + ink.width) * matrix.a,
        top: matrix.f + ink.y * matrix.d, bottom: matrix.f + (ink.y + ink.height) * matrix.d,
      } : null
      const readout = pressure.querySelector<HTMLElement>('[class*="pressureGaugeReadout"]')
      const value = pressure.querySelector<HTMLElement>('[class*="pressureGaugeValue"]')
      return {
        viewport: { width: innerWidth, height: innerHeight },
        height: tile.height, peerHeights, labels,
        bodyHeight: bodyBounds.height,
        bodyContained: bodyBounds.left >= bounds.left && bodyBounds.right <= bounds.right && bodyBounds.top >= bounds.top && bodyBounds.bottom <= bounds.bottom + 1,
        tileOverflow: pressure.scrollHeight - pressure.clientHeight,
        chartContained: !painted || (painted.left >= tile.left + 2 && painted.right <= tile.right - 2 && painted.top >= tile.top + 2 && painted.bottom <= tile.bottom - 2),
        svgPointerEvents: svg ? getComputedStyle(svg).pointerEvents : null,
        valueFont: value ? parseFloat(getComputedStyle(value).fontSize) : null,
        valueWidth: readout?.getBoundingClientRect().width ?? null,
        innerGaugeWidth: matrix ? matrix.a * 120 : null,
        finePointer: matchMedia('(pointer: fine)').matches,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    expect(geometry.height).toBeGreaterThan(140)
    expect(Math.max(...geometry.peerHeights.map((height) => Math.abs(height - geometry.height)))).toBeLessThanOrEqual(1)
    expect(geometry.labels.every((label) => label.contained)).toBe(true)
    expect(geometry.tileOverflow).toBeLessThanOrEqual(1)
    expect(geometry.chartContained).toBe(true)
    expect(geometry.bodyContained).toBe(true)
    expect(geometry.bodyHeight).toBeGreaterThan(64)
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    if (geometry.valueFont !== null) expect(geometry.valueFont).toBeGreaterThanOrEqual(16)
    if (geometry.valueWidth !== null) expect(geometry.valueWidth).toBeLessThanOrEqual(geometry.innerGaugeWidth! - 2)
    if (geometry.svgPointerEvents !== null) expect(geometry.svgPointerEvents).toBe('none')
    if (testInfo.project.name === 'desktop') expect(geometry.finePointer).toBe(true)
    observations.push(geometry)
  }

  for (const viewport of canonical) {
    await page.setViewportSize(viewport)
    for (const fixture of pressureCases) {
      await page.evaluate(({ value, unit }) => {
        const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
        api.setEntityAttribute('weather.pirate_weather', 'pressure', value)
        api.setEntityAttribute('weather.pirate_weather', 'pressure_unit', unit)
      }, fixture)
      const expectedValue = fixture.value?.toLocaleString([], { maximumFractionDigits: 2 })
      await expect(pressure).toHaveAttribute('aria-label', fixture.available ? `Pressure ${expectedValue} ${fixture.unit}` : 'Pressure Unavailable')
      await measure()
    }
  }

  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setEntityAttribute('weather.pirate_weather', 'pressure', 29.92)
    api.setEntityAttribute('weather.pirate_weather', 'pressure_unit', 'inHg')
  })
  await expect(pressure).toHaveAttribute('aria-label', 'Pressure 29.92 inHg')
  for (const viewport of [
    canonical[0], canonical[6], canonical[0],
    canonical[6], canonical[0], canonical[6],
    canonical[4], canonical[5], canonical[4],
    { width: 741, height: 1152 }, canonical[2], { width: 741, height: 1152 },
    canonical[5], canonical[2], canonical[5],
    { width: 836, height: 842 }, canonical[3], { width: 836, height: 842 },
    canonical[0], canonical[1], canonical[0],
  ]) {
    await page.setViewportSize(viewport)
    await measure()
    await pressure.scrollIntoViewIfNeeded()
    const reachable = await pressure.evaluate((element) => {
      const tile = element.getBoundingClientRect()
      const body = element.closest('[data-modal-sheet-body]')!.getBoundingClientRect()
      return tile.top >= body.top - 1 && tile.bottom <= body.bottom + 1
    })
    expect(reachable).toBe(true)
  }
  await testInfo.attach('pressure-geometry-matrix', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' })
})
