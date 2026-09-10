import { expect, test, type Locator, type TestInfo } from './layout/fixture'
import { expectSameBox, openWake, seedWake, settleWake, WAKE_TITLE, type WakeMockApi } from './wake-light-support'

async function capture(testInfo: TestInfo, dialog: Locator, name: string) {
  const path = testInfo.outputPath(name)
  await dialog.screenshot({ path, animations: 'disabled' })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('native input contexts retain one editor and navigate to the authoritative Pod schedule without a room-level Wake section', async ({ page }, testInfo) => {
  const finePointer = await page.evaluate(() => matchMedia('(pointer: fine)').matches)
  expect(finePointer).toBe(testInfo.project.name === 'desktop')
  let dialog = await openWake(page)
  const initialBox = (await dialog.boundingBox())!
  const originalNode = await dialog.elementHandle()
  await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls.splice(0))
  const alarmToggle = dialog.getByRole('switch', { name: /Weekday Wake$/ })
  await alarmToggle.focus()
  await page.keyboard.press('Space')
  await expect(alarmToggle).toHaveAttribute('aria-checked', 'false')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light').length)).toBe(1)
  await alarmToggle.click()
  await expect(alarmToggle).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light').length)).toBe(2)
  expectSameBox((await dialog.boundingBox())!, initialBox)
  await capture(testInfo, dialog, 'wake-overview.png')
  await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Alarm Name', { exact: true })).toBeFocused()
  await dialog.getByLabel('Alarm Name', { exact: true }).fill('Native Context Alarm')
  await settleWake(dialog)
  expectSameBox((await dialog.boundingBox())!, initialBox)
  expect(await originalNode!.evaluate(node => node === document.querySelector('[role="dialog"]'))).toBe(true)
  await capture(testInfo, dialog, 'wake-editor.png')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  dialog = page.getByRole('dialog', { name: WAKE_TITLE, exact: true })
  await settleWake(dialog)
  await expect(dialog.getByRole('button', { name: /^Native Context Alarm/ })).toBeVisible()
  expectSameBox((await dialog.boundingBox())!, initialBox)

  await seedWake(page, {
    alarms: [{
      id: 'source-right', label: 'SleepyPod Right Wake', source: 'sleepypod',
      source_ref: 'sleepypod:right', revision: 0, local_time: '07:00',
      kind: 'weekly', date: null, ramp_minutes: 30, enabled: true,
      weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    }],
    alarm_links: {},
  }, 'idle')
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: WakeMockApi }).__mockHass
    api.setEntityState('climate.sleepypod_eight_pod_right_side', 'heat')
    api.setEntityState('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0')
    api.calls.splice(0)
  })
  await dialog.getByRole('button', { name: /^Steph's Alarms/ }).click()
  expect(await originalNode!.getAttribute('data-closing')).toBe('true')
  const source = page.getByRole('dialog', { name: "Steph's Bed", exact: true })
  await settleWake(source)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(source.getByRole('tab', { name: 'Alarms', exact: true })).toHaveAttribute('aria-selected', 'true')
  await capture(testInfo, source, 'authoritative-source-editor.png')
  await expect(source.getByRole('button', { name: 'Open Room Wake-Light Controls', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light' || call.domain === 'mqtt'))).toEqual([])
})
