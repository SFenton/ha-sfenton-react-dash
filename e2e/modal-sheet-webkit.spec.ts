import { expect, test } from './layout/fixture'
import { setSafeAreaInsets } from './safe-area'
import { openQuickLinksTab } from './quick-links'

test('WebKit modal scrolling does not depend on unsupported directional touch-action', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  expect(await page.evaluate(() => CSS.supports('touch-action', 'pan-down'))).toBe(false)

  await openQuickLinksTab(page)
  await page.getByRole('dialog', { name: 'Quick Links' }).getByRole('button', { name: 'Rooms' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rooms' })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  await expect(dialog).toBeVisible()
  await expect(body).toHaveCSS('touch-action', 'auto')
  await expect.poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
})

test('WebKit uses an inset non-draggable dialog in phone landscape', async ({ page }) => {
  const insets = { bottom: 21, left: 59, right: 44, top: 0 }
  await page.setViewportSize({ height: 393, width: 852 })
  await page.goto('/at-a-glance/overview')
  await setSafeAreaInsets(page, insets)
  await page.getByRole('button', { name: /Security Armed/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
  await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
  const box = await dialog.boundingBox()
  expect(Math.abs((box?.x ?? 0) - (insets.left + 12))).toBeLessThanOrEqual(1)
  expect(Math.abs((box?.width ?? 0) - (852 - insets.left - insets.right - 24))).toBeLessThanOrEqual(1)
  expect(Math.abs((box?.y ?? 0) - (insets.top + 8))).toBeLessThanOrEqual(1)
  expect(Math.abs((box?.height ?? 0) - (393 - insets.top - insets.bottom - 16))).toBeLessThanOrEqual(1)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
})
