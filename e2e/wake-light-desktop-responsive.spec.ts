import { expect, test } from './layout/fixture'
import {
  auditWake, expectSameBox, expectWakeTargetAboveFooter, openWake, resizeWake,
  wakeProfile, WAKE_ENTITY, WAKE_TITLE, type WakeMockApi,
} from './wake-light-support'

test.use({ hasTouch: false, isMobile: false })

test('master-bedroom Sleep & Wake and SleepyPod fill matching two-column sections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/at-a-glance/master-bedroom')

  const sleepWake = page.getByRole('group', { name: 'Master Bedroom Sleep & Wake' })
  const sleepypod = page.getByRole('group', { name: 'Master Bedroom SleepyPod' })
  const [sleepWakeBox, sleepypodBox, wakeBox, stephenBox, stephBox] = await Promise.all([
    sleepWake.boundingBox(),
    sleepypod.boundingBox(),
    sleepWake.getByRole('button').boundingBox(),
    sleepypod.getByRole('button', { name: /Stephen's Bed/ }).boundingBox(),
    sleepypod.getByRole('button', { name: /Steph's Bed/ }).boundingBox(),
  ])
  if (!sleepWakeBox || !sleepypodBox || !wakeBox || !stephenBox || !stephBox) {
    throw new Error('Master-bedroom section geometry was not measurable')
  }

  expect(Math.abs(sleepWakeBox.width - sleepypodBox.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(wakeBox.width - sleepWakeBox.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(stephenBox.width - stephBox.width)).toBeLessThanOrEqual(1)
  expect(Math.abs((stephBox.x + stephBox.width) - (sleepypodBox.x + sleepypodBox.width))).toBeLessThanOrEqual(1)
})

for (const profile of ['desktop', 'wide-desktop'].map(wakeProfile)) {
  test(`wake fine-pointer interaction and fixed frames at ${profile.width}`, async ({ page }) => {
    await page.setViewportSize(profile)
    let dialog = await openWake(page)
    await resizeWake(page, profile)
    expect(await page.evaluate(() => ({
      fine: matchMedia('(pointer: fine)').matches, hover: matchMedia('(hover: hover)').matches,
    }))).toEqual({ fine: true, hover: true })
    const original = await auditWake(page, dialog, profile)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0, { timeout: 2_000 })
    await page.getByRole('button', { name: /Wake-Light Alarms Next/ }).focus()
    await page.keyboard.press('Enter')
    dialog = page.getByRole('dialog', { name: WAKE_TITLE })
    expectSameBox(await auditWake(page, dialog, profile), original)
    await dialog.getByRole('tab', { name: 'Wake Alarms', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByRole('tab', { name: 'Defaults', exact: true })).toBeFocused()
    const rampOptions = dialog.getByRole('radiogroup', { name: 'Light Ramp Duration', exact: true })
    await expect(rampOptions).toBeVisible()
    await expect(rampOptions.getByRole('radio')).toHaveCount(5)
    await expect(dialog.getByRole('radiogroup', { name: 'Post-Wake Hold Time', exact: true }).getByRole('radio')).toHaveCount(4)
    expectSameBox(await auditWake(page, dialog, profile), original)
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByRole('tab', { name: 'Wake Alarms', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(dialog.getByRole('tab', { name: 'Wake Alarms', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: /Weekday Wake/ }).click()
    dialog = page.getByRole('dialog', { name: 'Weekday Wake · Master Bedroom', exact: true })
    expectSameBox(await auditWake(page, dialog, profile), original)
    await expect(dialog.locator('[data-scroll-region="wake-light-hero"]')).toHaveCount(0)
    const alarmName = dialog.getByLabel('Alarm Name', { exact: true })
    await alarmName.click()
    await expect(page.locator('html')).toHaveAttribute('data-rd-quiet-focus', '')
    expect(await alarmName.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none')
    await page.keyboard.press('Tab')
    await expect(page.locator('html')).not.toHaveAttribute('data-rd-quiet-focus')
    const keyboardFocusedOutline = await page.evaluate(() => {
      const focused = document.activeElement
      return focused instanceof HTMLElement ? getComputedStyle(focused).outlineStyle : ''
    })
    expect(keyboardFocusedOutline).toBe('solid')
    await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.setCallServiceOutcome('wake_light', 'command', 'pending'))
    await alarmName.fill('Desktop Draft')
    dialog = page.getByRole('dialog', { name: 'Desktop Draft · Master Bedroom', exact: true })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    expectSameBox(await auditWake(page, dialog, profile), original)
    await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.rejectWakeCommands())
    const alert = dialog.getByRole('alert')
    await expect(alert).toContainText('Home Assistant did not confirm')
    await expectWakeTargetAboveFooter(dialog, alert)
    await expect(dialog.getByLabel('Alarm Name')).toHaveValue('Desktop Draft')
    expectSameBox(await auditWake(page, dialog, profile), original)

    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0, { timeout: 2_000 })
    dialog = await openWake(page)
    await resizeWake(page, profile)
    await dialog.getByRole('button', { name: /^Weekday Wake/ }).click()
    dialog = page.getByRole('dialog', { name: 'Weekday Wake · Master Bedroom', exact: true })
    await dialog.getByLabel('Alarm Name', { exact: true }).fill('Desktop Conflict Draft')
    dialog = page.getByRole('dialog', { name: 'Desktop Conflict Draft · Master Bedroom', exact: true })
    await page.evaluate((entity) => {
      const api = (window as unknown as { __mockHass: WakeMockApi }).__mockHass
      const snapshot = api.getEntity(entity)!
      const alarms = snapshot.attributes.alarms as Array<Record<string, unknown>>
      api.setEntityAttribute(entity, 'alarms', alarms.map((alarm) => alarm.id === 'weekday-wake'
        ? { ...alarm, label: 'Latest saved wake', revision: Number(alarm.revision) + 1 }
        : alarm))
      api.setEntityAttribute(entity, 'revision', Number(snapshot.attributes.revision) + 1)
    }, WAKE_ENTITY)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const reload = dialog.getByRole('button', { name: 'Open Latest Alarm, Replace Draft', exact: true })
    await expect(reload).toBeVisible()
    await expectWakeTargetAboveFooter(dialog, reload)
    await expect(dialog.getByLabel('Alarm Name')).toHaveValue('Desktop Conflict Draft')
    expectSameBox(await auditWake(page, dialog, profile), original)
  })
}
// @covers src/components/core/NativePickerField.module.css
// @covers src/components/core/RadioRow.module.css
// @covers src/components/hass/wakeLights/WakeLightModalContent.tsx
// @covers src/components/hass/wakeLights/WakeLightModalContent.module.css
// @covers src/index.css
// @covers src/pages/DashboardViewPage.module.css
