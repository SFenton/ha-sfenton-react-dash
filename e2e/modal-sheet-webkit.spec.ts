import { expect, test } from '@playwright/test'

test('WebKit modal scrolling does not depend on unsupported directional touch-action', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  expect(await page.evaluate(() => CSS.supports('touch-action', 'pan-down'))).toBe(false)

  await page.getByRole('button', { name: 'Rooms' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rooms' })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  await expect(dialog).toBeVisible()
  await expect(body).toHaveCSS('touch-action', 'auto')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 1_000 })
})
