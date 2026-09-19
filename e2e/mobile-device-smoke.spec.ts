import { devices, expect, test } from './layout/fixture'
import { modalSheetPresentationForViewport } from '../src/components/core/modalSheetPresentation'
import { MOBILE_GEOMETRY_PROFILES } from './responsive-acceptance-data'
import { installSafeAreaInsets, setSafeAreaInsets } from './safe-area'

const cases = [
  { descriptor: 'iPhone 15 Pro', profile: 'island-phone-portrait' },
  { descriptor: 'iPhone 15 Pro landscape', profile: 'island-phone-landscape-left' },
  { descriptor: 'iPhone 13', profile: 'notched-phone-portrait' },
  { descriptor: 'iPhone 13 landscape', profile: 'notched-phone-landscape' },
  { descriptor: 'iPhone SE (3rd gen)', profile: 'rectangular-phone-portrait' },
  { descriptor: 'iPhone SE (3rd gen) landscape', profile: 'rectangular-phone-landscape' },
  { descriptor: 'Galaxy S24', profile: 'android-punch-portrait' },
  { descriptor: 'Galaxy S24 landscape', profile: 'android-punch-landscape-left' },
] as const

for (const deviceCase of cases) {
  test(`${deviceCase.descriptor} descriptor remains usable with ${deviceCase.profile}`, async ({ browser }) => {
    const descriptor = devices[deviceCase.descriptor]
    const geometry = MOBILE_GEOMETRY_PROFILES.find((candidate) => candidate.name === deviceCase.profile)
    if (!geometry) throw new Error(`Unknown mobile geometry profile: ${deviceCase.profile}`)

    const context = await browser.newContext({
      deviceScaleFactor: descriptor.deviceScaleFactor,
      hasTouch: descriptor.hasTouch,
      isMobile: descriptor.isMobile,
      screen: descriptor.screen,
      viewport: descriptor.viewport,
    })
    const page = await context.newPage()
    await installSafeAreaInsets(page, geometry.insets)

    try {
      await page.goto('/index.html?path=overview')
      await setSafeAreaInsets(page, geometry.insets)
      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

      const shell = await page.evaluate((insets) => {
        const menu = document.querySelector<HTMLElement>('button[aria-label="Open navigation menu"]')?.getBoundingClientRect()
        const profileButton = document.querySelector<HTMLElement>('button[aria-label^="Open Your Summary"]')?.getBoundingClientRect()
        const bottomNav = document.querySelector<HTMLElement>('[data-adaptive-navigation="bottom"]')?.getBoundingClientRect()
        return {
          bottomNav: bottomNav && bottomNav.width > 0 && bottomNav.height > 0
            ? { bottom: bottomNav.bottom, left: bottomNav.left, right: bottomNav.right }
            : null,
          menu: menu && { left: menu.left, top: menu.top },
          profile: profileButton && { right: profileButton.right, top: profileButton.top },
          safeBottom: innerHeight - insets.bottom,
          safeRight: innerWidth - insets.right,
        }
      }, geometry.insets)
      expect(shell.menu?.left ?? 0).toBeGreaterThanOrEqual(geometry.insets.left)
      expect(shell.menu?.top ?? 0).toBeGreaterThanOrEqual(geometry.insets.top)
      expect(shell.profile?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(shell.safeRight)
      expect(shell.profile?.top ?? 0).toBeGreaterThanOrEqual(geometry.insets.top)
      if (shell.bottomNav) {
        expect(shell.bottomNav.left).toBeGreaterThanOrEqual(geometry.insets.left)
        expect(shell.bottomNav.right).toBeLessThanOrEqual(shell.safeRight)
        expect(shell.bottomNav.bottom).toBeLessThanOrEqual(shell.safeBottom)
      }

      if (descriptor.viewport.width > descriptor.viewport.height) {
        await page.getByRole('button', { name: /Security Armed/i }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toHaveAttribute(
          'data-modal-presentation',
          modalSheetPresentationForViewport(descriptor.viewport.width, descriptor.viewport.height),
        )
        await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
        await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
        await expect(dialog).toHaveCount(0, { timeout: 700 })
      }
    } finally {
      await context.close()
    }
  })
}
