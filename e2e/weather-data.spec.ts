import { expect, test, type Page } from '@playwright/test'
import type { MockHassDebugApi } from '../src/test/mocks/hakitCoreState'

const WEATHER_ENTITY = 'weather.pirate_weather'

async function forecastCalls(page: Page) {
  return page.evaluate(() => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    const calls = api.calls.filter((call) => call.domain === 'weather' && call.service === 'get_forecasts')
    const kind = (call: Record<string, unknown>) => (
      call.serviceData && typeof call.serviceData === 'object' && 'type' in call.serviceData
        ? call.serviceData.type
        : undefined
    )
    return {
      daily: calls.filter((call) => kind(call) === 'daily').length,
      hourly: calls.filter((call) => kind(call) === 'hourly').length,
    }
  })
}

async function openWeather(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-09-05T12:30:00Z') })
  await page.goto('/index.html?path=overview')
  await expect.poll(() => forecastCalls(page)).toEqual({ daily: 1, hourly: 1 })
  await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[class*="hourlyTemperature"]').first()).toBeVisible()
  return dialog
}

test('a long-open Weather modal refreshes daily and hourly UI at TTL and on source updates', async ({ page }) => {
  const dialog = await openWeather(page)
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setHourlyWeatherForecast(0, { temperature: 77 })
    api.setDailyWeatherForecast(0, { temperature: 88 })
  })
  await page.clock.fastForward(5 * 60_000)
  await expect.poll(() => forecastCalls(page)).toEqual({ daily: 2, hourly: 2 })
  await expect(dialog.locator('[class*="hourlyTemperature"]').first()).toHaveText('77°F')
  await expect(dialog.locator('[class*="forecastHigh"]').first()).toHaveText('88°')

  await page.evaluate((entityId) => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setHourlyWeatherForecast(0, { temperature: 66 })
    api.setDailyWeatherForecast(0, { temperature: 79 })
    api.setEntityAttribute(entityId, 'temperature', 61)
  }, WEATHER_ENTITY)
  await expect.poll(() => forecastCalls(page)).toEqual({ daily: 3, hourly: 3 })
  await expect(dialog.locator('[class*="hourlyTemperature"]').first()).toHaveText('66°F')
  await expect(dialog.locator('[class*="forecastHigh"]').first()).toHaveText('79°')
})

test('unknown precipitation stays unavailable and temperature rails remain bounded at the maximum', async ({ page }) => {
  const dialog = await openWeather(page)
  await page.evaluate((entityId) => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setDailyWeatherForecast(0, { temperature: 100, templow: 100, precipitation: null, precipitation_probability: null })
    api.setHourlyWeatherForecast(1, { precipitation: null })
    api.setEntityAttribute(entityId, 'precipitation_unit', 'mm')
  }, WEATHER_ENTITY)
  await expect(dialog.locator('[class*="forecastHigh"]').first()).toHaveText('100°')
  const rail = dialog.locator('[class*="forecastList"] [data-weather-rail="temperature"]').first()
  expect(await rail.evaluate((element) => {
    const fill = element.querySelector('[data-weather-rail-fill]')!
    return fill.getBoundingClientRect().right - element.getBoundingClientRect().right
  })).toBeLessThanOrEqual(0.5)
  await expect(dialog.locator('[data-precipitation-sample="cumulative"]')).toHaveAttribute('data-unavailable', 'true')

  await dialog.getByRole('button', { name: 'Precipitation conditions', exact: true }).click()
  const row = dialog.locator('[class*="forecastList"] [data-mode="precipitation"]').first()
  await expect(row).toHaveAttribute('aria-label', 'Today precipitation Unavailable Unavailable')
  await expect(row).not.toContainText('0 in')

  await page.clock.fastForward(20)
  await page.evaluate((entityId) => {
    const api = (window as unknown as { __mockHass: MockHassDebugApi }).__mockHass
    api.setDailyWeatherForecast(0, { precipitation: 0, precipitation_probability: 0 })
    api.setEntityAttribute(entityId, 'forecast_revision', 2)
  }, WEATHER_ENTITY)
  await expect(row).toContainText('0 mm')
  await expect(row).toContainText('0%')
})
