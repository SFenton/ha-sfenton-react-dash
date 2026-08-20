import { expect, test } from '@playwright/test'

test.describe('real HAKit dial integration', () => {
  test.skip(process.env.PLAYWRIGHT_REAL_HAKIT !== '1', 'Requires the env-backed live HA connection and real HAKit package.')

  test('uses app-owned current markers and one keyboard slider', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/at-a-glance/master-bedroom')

    const humidifier = page.getByRole('button', { name: /Humidifier/i })
    await expect(humidifier).toBeVisible({ timeout: 20_000 })
    await humidifier.click()

    const dialog = page.getByRole('dialog')
    const mistDial = dialog.getByRole('region', { name: /Humidifier mist level/i })
    const currentMarker = mistDial.locator('[data-marker="current"]')

    await expect(currentMarker).toBeVisible({ timeout: 10_000 })
    await expect(mistDial.locator('path.current:not(.arc-current)')).toHaveCount(0)
    const markerStyle = await currentMarker.evaluate((marker) => {
      const style = getComputedStyle(marker)
      const rect = marker.getBoundingClientRect()
      return {
        height: rect.height,
        pointerEvents: style.pointerEvents,
        width: rect.width,
      }
    })
    expect(markerStyle).toEqual({ height: 18, pointerEvents: 'none', width: 18 })

    const sliderState = await mistDial.evaluate((dial) => ({
      exposed: Array.from(dial.querySelectorAll('[role="slider"]')).filter((element) => !element.closest('[aria-hidden="true"]')).length,
      hiddenWithoutInert: Array.from(dial.querySelectorAll('[aria-hidden="true"] [role="slider"]')).filter((element) => !element.closest('[inert]')).length,
    }))
    expect(sliderState.hiddenWithoutInert).toBe(0)
    expect(sliderState.exposed).toBeLessThanOrEqual(1)

    const adjustableSlider = mistDial.getByRole('slider', { name: 'Mist level' })
    if (await adjustableSlider.count()) {
      await dialog.getByRole('button', { name: 'Close' }).focus()
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => ({
        ariaHiddenAncestor: Boolean(document.activeElement?.closest?.('[aria-hidden="true"]')),
        ariaLabel: document.activeElement?.getAttribute?.('aria-label'),
      }))
      expect(focused).toEqual({ ariaHiddenAncestor: false, ariaLabel: 'Mist level' })
    }
  })
})
