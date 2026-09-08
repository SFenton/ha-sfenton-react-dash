import { expect, type Page } from '@playwright/test'
import type { WeatherScene } from '../src/components/hass/weatherPresentation'

export async function setWeatherSceneDebug(page: Page, scene: WeatherScene | 'live') {
  await page.evaluate((value) => {
    const url = new URL(location.href)
    url.searchParams.set('weatherSceneDebug', '1')
    if (value === 'live') url.searchParams.delete('weatherScene')
    else url.searchParams.set('weatherScene', value)
    history.replaceState(history.state, '', url)
  }, scene)
  // Reuse the existing opener to read the URL without adding an app-side listener.
  await page.getByRole('button', { name: /Open seven-day weather forecast/, includeHidden: true })
    .evaluate((element) => (element as HTMLButtonElement).click())
  const dialog = page.getByRole('dialog', { name: 'Weather', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)
  if (scene !== 'live') await expect(dialog.locator('[data-weather-scene]')).toHaveAttribute('data-weather-scene', scene)
}
