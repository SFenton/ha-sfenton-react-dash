import { expect, test } from '@playwright/test'

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

  test('fan modal exposes status, controls, timer intent, and mounted close behavior', async ({ page }) => {
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()

    const dialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Room occupancy')).toBeVisible()
    await expect(dialog.getByText('Room temperature range')).toBeVisible()
    await expect(dialog.getByText('Humidity')).toBeVisible()
    await expect(dialog.locator('[data-icon="mdi:motion-sensor-off"]')).toBeVisible()
    await expect(dialog.locator('[data-icon="mdi:thermometer"]')).toBeVisible()
    await expect(dialog.locator('[data-icon="mdi:water-percent"]')).toBeVisible()
    await expect(dialog.getByRole('navigation')).toHaveCount(0)
    await expect(dialog.getByRole('note', { name: 'Hint' })).toContainText('Double tapping On on the fan switch will lock the fan on')

    await dialog.getByRole('switch', { name: 'Power Off' }).click()
    await expect(dialog.getByRole('heading', { name: 'Timer' })).toBeVisible()
    await dialog.getByRole('switch', { name: 'Lock Unlocked' }).click()

    const autoUnlock = dialog.getByRole('checkbox', { name: 'Auto-disable lock' })
    await expect(autoUnlock).toHaveAttribute('aria-checked', 'true')
    await dialog.getByRole('combobox', { name: 'Timer' }).selectOption('10')
    await dialog.getByRole('button', { name: 'Set' }).click()
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

  test('fan modal keeps the desktop status and timer rows aligned without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()

    const dialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    await dialog.getByRole('switch', { name: 'Power Off' }).click()
    const select = dialog.getByRole('combobox', { name: 'Timer' })
    const set = dialog.getByRole('button', { name: 'Set' })
    const hint = dialog.getByRole('note', { name: 'Hint' })
    await select.selectOption('10')
    const selectBox = await select.boundingBox()
    const setBox = await set.boundingBox()
    const hintSetupBox = await hint.boundingBox()
    if (!selectBox || !setBox || !hintSetupBox) throw new Error('Desktop timer setup controls were not measurable')
    expect(Math.abs(selectBox.y - setBox.y)).toBeLessThanOrEqual(2)
    expect(hintSetupBox.y - (setBox.y + setBox.height)).toBeLessThanOrEqual(20)
    await set.click()

    const statuses = dialog.locator('[data-icon="mdi:motion-sensor-off"], [data-icon="mdi:thermometer"], [data-icon="mdi:water-percent"]')
    await expect(statuses).toHaveCount(3)
    const statusBoxes = await statuses.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { height: box.height, width: box.width, y: box.y }
    }))
    expect(Math.round(statusBoxes[0].y)).toBe(Math.round(statusBoxes[1].y))
    expect(statusBoxes[2].y).toBeGreaterThan(statusBoxes[0].y)
    expect(statusBoxes[2].width).toBeGreaterThan(statusBoxes[0].width * 1.8)

    const timerBox = await dialog.locator('[data-timer-row="true"]').boundingBox()
    const hintTimerBox = await hint.boundingBox()
    if (!timerBox || !hintTimerBox) throw new Error('Desktop timer row was not measurable')
    expect(timerBox.width).toBeGreaterThan(selectBox.width)
    expect(hintTimerBox.y - (timerBox.y + timerBox.height)).toBeLessThanOrEqual(20)
    const timerHeading = dialog.getByRole('heading', { name: 'Timer' })
    await expect(timerHeading.locator('xpath=..').locator('span')).toHaveCount(1)

    expect(await dialog.evaluate((element) => element.scrollWidth)).toBe(await dialog.evaluate((element) => element.clientWidth))
  })

  test('shared fan and vacuum status titles render white', async ({ page }) => {
    await page.goto('/at-a-glance/guest-bathroom')
    await page.getByRole('button', { name: 'Fan Off' }).click()
    const fanDialog = page.getByRole('dialog', { name: 'Guest Bathroom Fan' })
    await expect(fanDialog.getByText('Room occupancy', { exact: true })).toHaveCSS('color', 'rgb(247, 251, 255)')

    await fanDialog.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(650)
    await page.goto('/at-a-glance/vacuums')
    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const vacuumDialog = page.getByRole('dialog', { name: /Main Floor Robot Vacuum/ })
    await expect(vacuumDialog.getByText('Status', { exact: true }).first()).toHaveCSS('color', 'rgb(247, 251, 255)')
  })
})
