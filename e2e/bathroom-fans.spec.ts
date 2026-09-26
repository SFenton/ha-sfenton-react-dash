import { devices, expect, test } from './layout/fixture'
import { setSafeAreaInsets } from './safe-area'

test.describe('bathroom fan controls', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  for (const room of [
    { id: 'guest', name: 'Guest Bathroom', path: 'guest-bathroom' },
    { id: 'master', name: 'Master Bathroom', path: 'master-bathroom' },
  ] as const) {
    test(`${room.name} fan tile is full-width with isolated controls`, async ({ page }) => {
      await page.goto(`/at-a-glance/${room.path}`)

      const grid = page.getByRole('group', { exact: true, name: `${room.name} Climate` })
      const tile = page.locator(`[data-bathroom-fan-tile="${room.id}"]`)
      const main = tile.getByRole('button', { name: 'Fan Off' })
      const lock = tile.getByRole('switch', { name: 'Lock' })
      const power = tile.getByRole('switch', { name: 'Power' })

      await expect(main).toHaveAttribute('data-modal-opener', 'true')
      await expect(lock).toHaveAttribute('aria-checked', 'false')
      await expect(power).toHaveAttribute('aria-checked', 'false')

      const [gridBox, tileBox, labelBox, lockBox, powerBox] = await Promise.all([
        grid.boundingBox(),
        tile.boundingBox(),
        main.locator('[data-dynamic-grid-label-container="true"]').boundingBox(),
        lock.boundingBox(),
        power.boundingBox(),
      ])
      if (!gridBox || !tileBox || !labelBox || !lockBox || !powerBox) throw new Error('Bathroom fan tile was not measurable')

      expect(tileBox.width).toBeGreaterThan(gridBox.width * 0.9)
      expect(lockBox.width).toBeGreaterThanOrEqual(44)
      expect(lockBox.height).toBeGreaterThanOrEqual(44)
      expect(powerBox.width).toBeGreaterThanOrEqual(44)
      expect(powerBox.height).toBeGreaterThanOrEqual(44)
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(Math.min(lockBox.x, powerBox.x) - 8)
    })
  }

  test('fan modal exposes controls, timer intent, and mounted close behavior', async ({ page }) => {
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()

    const dialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Room occupancy')).toHaveCount(0)
    await expect(dialog.getByText('Room temperature range')).toHaveCount(0)
    await expect(dialog.getByText('Humidity')).toHaveCount(0)
    await expect(dialog.locator('[data-dynamic-grid="true"]')).toHaveCount(0)
    await expect(dialog.getByRole('navigation')).toHaveCount(0)

    await expect(dialog.getByRole('heading', { name: 'Timer' })).toBeVisible()
    const select = dialog.getByRole('combobox', { name: 'Timer' })
    const set = dialog.getByRole('button', { name: 'Set' })
    await expect(select).toBeVisible()
    await expect(set).toBeVisible()
    await expect(set).toBeDisabled()
    const [dialogBox, selectBox, setBox] = await Promise.all([
      dialog.boundingBox(),
      select.boundingBox(),
      set.boundingBox(),
    ])
    if (!dialogBox || !selectBox || !setBox) throw new Error('Off-state portrait fan timer controls were not measurable')
    expect(selectBox.y).toBeGreaterThanOrEqual(dialogBox.y)
    expect(setBox.y + setBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height)
    await select.selectOption('10')

    await dialog.getByRole('switch', { name: 'Power Off' }).click()
    await expect(set).toBeEnabled()
    await dialog.getByRole('switch', { name: 'Lock Unlocked' }).click()

    const autoUnlock = dialog.getByRole('checkbox', { name: 'Auto-disable lock' })
    await expect(autoUnlock).toHaveAttribute('aria-checked', 'true')
    await expect(select).toHaveValue('10')
    await set.click()
    await page.waitForTimeout(2_200)
    await expect(dialog.getByRole('combobox', { name: 'Timer' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Set' })).toHaveCount(0)
    const timerRow = dialog.locator('[data-timer-row="true"]')
    await expect(dialog.getByRole('group', { name: /Timer 09:5[67-9]/ })).toBeVisible()
    await expect(timerRow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(timerRow).toHaveCSS('border-top-width', '0px')
    await expect(timerRow.locator('svg')).toHaveCSS('color', 'rgb(255, 159, 10)')
    await expect(timerRow.locator('strong')).toHaveCSS('color', 'rgb(255, 159, 10)')
    const clear = dialog.getByRole('button', { name: 'Clear' })
    await expect(clear).toHaveAttribute('data-tone', 'danger')
    await expect(clear).toHaveCSS('background-color', 'rgb(198, 40, 40)')
    await expect(autoUnlock).toHaveAttribute('aria-checked', 'true')

    const calls = await page.evaluate(() => (
      (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
    ))
    expect(calls).toContainEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: {
        auto_unlock: true,
        command: 'timer_start',
        minutes: 10,
      },
    })

    await clear.click()
    await expect(dialog.getByRole('group', { name: /Timer \d/ })).toHaveCount(0)
    expect(await page.evaluate(() => (
      (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
    ))).toContainEqual({
      domain: 'script',
      service: 'guest_bathroom_fan_command',
      serviceData: { command: 'timer_cancel' },
    })

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(1)
    await page.waitForTimeout(650)
    await expect(dialog).toHaveCount(0)
  })

  test('keeps the fan timer reachable through portrait, short landscape, and mirrored safe areas', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()

    const dialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const select = dialog.getByRole('combobox', { name: 'Timer' })
    const set = dialog.getByRole('button', { name: 'Set' })
    const profiles = [
      { height: 852, width: 393, insets: { top: 59, right: 0, bottom: 34, left: 0 }, presentation: 'sheet' },
      { height: 320, width: 568, insets: { top: 0, right: 0, bottom: 0, left: 0 }, presentation: 'landscape-dialog' },
      { height: 375, width: 667, insets: { top: 0, right: 0, bottom: 0, left: 0 }, presentation: 'landscape-dialog' },
      { height: 343, width: 734, insets: { top: 0, right: 0, bottom: 0, left: 0 }, presentation: 'landscape-dialog' },
      { height: 393, width: 852, insets: { top: 0, right: 44, bottom: 21, left: 59 }, presentation: 'landscape-dialog' },
      { height: 393, width: 852, insets: { top: 0, right: 59, bottom: 21, left: 44 }, presentation: 'landscape-dialog' },
      { height: 393, width: 852, insets: { top: 0, right: 0, bottom: 0, left: 0 }, presentation: 'landscape-dialog' },
    ]

    for (const profile of profiles) {
      await page.setViewportSize({ height: profile.height, width: profile.width })
      await setSafeAreaInsets(page, profile.insets)
      await expect(dialog).toHaveAttribute('data-modal-presentation', profile.presentation)
      await expect(dialog.getByRole('heading', { name: 'Timer' })).toBeVisible()
      await expect(select).toBeVisible()
      await expect(set).toBeDisabled()
      await set.scrollIntoViewIfNeeded()

      const [bodyBox, selectBox, setBox] = await Promise.all([
        body.boundingBox(),
        select.boundingBox(),
        set.boundingBox(),
      ])
      if (!bodyBox || !selectBox || !setBox) throw new Error('Fan timer was not measurable after rotation')
      expect(selectBox.x).toBeGreaterThanOrEqual(bodyBox.x - 1)
      expect(setBox.x + setBox.width).toBeLessThanOrEqual(bodyBox.x + bodyBox.width + 1)
      expect(setBox.y + setBox.height).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 1)

      if (profile.width === 852) {
        const dialogBox = await dialog.boundingBox()
        if (!dialogBox) throw new Error('Landscape fan dialog was not measurable')
        expect(dialogBox.x).toBeGreaterThanOrEqual(profile.insets.left + 11)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(profile.width - profile.insets.right - 11)
      }
    }

    await select.selectOption('10')
    await dialog.getByRole('switch', { name: 'Power Off' }).click()
    await dialog.getByRole('switch', { name: 'Lock Unlocked' }).click()
    await page.setViewportSize({ height: 320, width: 568 })
    await setSafeAreaInsets(page, { top: 0, right: 0, bottom: 0, left: 0 })
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    const autoUnlock = dialog.getByRole('checkbox', { name: 'Auto-disable lock' })
    await autoUnlock.scrollIntoViewIfNeeded()
    await expect(autoUnlock).toBeVisible()
    await set.scrollIntoViewIfNeeded()
    await expect(set).toBeEnabled()
    await set.click()
    const clear = dialog.getByRole('button', { name: 'Clear' })
    await clear.scrollIntoViewIfNeeded()
    await expect(clear).toBeVisible()
    await expect(select).toHaveCount(0)

    await page.setViewportSize({ height: 852, width: 393 })
    await setSafeAreaInsets(page, profiles[0].insets)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await expect(clear).toBeVisible()
  })

  test('fan modal keeps fine-pointer desktop controls and timer rows aligned without overflow', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Desktop Chrome'],
      hasTouch: false,
      isMobile: false,
      viewport: { width: 1280, height: 900 },
    })
    try {
      const page = await context.newPage()
      await page.goto('/at-a-glance/guest-bathroom')
      expect(await page.evaluate(() => ({
        fine: matchMedia('(pointer: fine)').matches,
        touchPoints: navigator.maxTouchPoints,
      }))).toEqual({ fine: true, touchPoints: 0 })
      await page.getByRole('button', { name: 'Fan Off' }).click()

      const dialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
      const power = dialog.getByRole('switch', { name: 'Power Off' })
      const lock = dialog.getByRole('switch', { name: 'Lock Unlocked' })
      const [powerBox, lockBox] = await Promise.all([power.boundingBox(), lock.boundingBox()])
      if (!powerBox || !lockBox) throw new Error('Desktop fan controls were not measurable')
      expect(Math.abs(powerBox.y - lockBox.y)).toBeLessThanOrEqual(2)
      expect(Math.abs(powerBox.height - lockBox.height)).toBeLessThanOrEqual(2)

      const select = dialog.getByRole('combobox', { name: 'Timer' })
      const set = dialog.getByRole('button', { name: 'Set' })
      await expect(select).toBeVisible()
      await expect(set).toBeDisabled()
      await power.click()
      await expect(set).toBeEnabled()
      await select.selectOption('10')
      const selectBox = await select.boundingBox()
      const setBox = await set.boundingBox()
      if (!selectBox || !setBox) throw new Error('Desktop timer setup controls were not measurable')
      expect(Math.abs(selectBox.y - setBox.y)).toBeLessThanOrEqual(2)
      await set.click()

      const timerBox = await dialog.locator('[data-timer-row="true"]').boundingBox()
      if (!timerBox) throw new Error('Desktop timer row was not measurable')
      expect(timerBox.width).toBeGreaterThan(selectBox.width)
      const timerHeading = dialog.getByRole('heading', { name: 'Timer' })
      await expect(timerHeading.locator('xpath=..').locator('span')).toHaveCount(1)

      expect(await dialog.evaluate((element) => element.scrollWidth))
        .toBe(await dialog.evaluate((element) => element.clientWidth))
    } finally {
      await context.close()
    }
  })

  test('shared fan control and vacuum status titles render white', async ({ page }) => {
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()
    const fanDialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    await expect(fanDialog.getByText('Power', { exact: true })).toHaveCSS('color', 'rgb(247, 251, 255)')

    await fanDialog.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(650)
    await page.goto('/at-a-glance/vacuums')
    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const vacuumDialog = page.getByRole('dialog', { name: /Main Floor Robot Vacuum/ })
    await expect(vacuumDialog.getByText('Status', { exact: true }).first()).toHaveCSS('color', 'rgb(247, 251, 255)')
  })
})
