// @covers src/test/mocks/hakitCoreState.ts
// @covers src/test/mocks/hakitCoreWithRealControls.ts
// @covers src/test/mocks/realControlsIcons.ts
// @covers src/components/core/ModalSheet.module.css
import { expect, test } from './layout/fixture'
import { LAYOUT_JOURNEYS } from './responsive-acceptance-data'
import { openSurface, enterState } from './layout/app'
import { applyProfile } from './layout/evidence'
import { journey } from './layout/scenarios'
import { wakeStateFacts } from './layout/wakeLight'
import {
  auditWake, expectSameBox, expectWakeTargetAboveFooter, openWake, resizeWake, seedWake, settleWake,
  terminalVisible, WAKE_ENTITY, WAKE_PROFILES, WAKE_TITLE, wakeProfile, type WakeMockApi,
} from './wake-light-support'

for (const profile of WAKE_PROFILES) {
  test(`wake geometry and detail flow: ${profile.name}`, async ({ page }) => {
    await page.setViewportSize(profile)
    let dialog = await openWake(page)
    await resizeWake(page, profile)
    const original = await auditWake(page, dialog, profile)
    await terminalVisible(dialog, dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }))
    for (const name of ['Defaults', 'Wake Alarms']) {
      await dialog.getByRole('tab', { name, exact: true }).click()
      expectSameBox(await auditWake(page, dialog, profile), original)
      expect(await dialog.locator('[data-modal-sheet-body]').evaluate(element => element.scrollTop)).toBe(0)
    }
    await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
    expectSameBox(await auditWake(page, dialog, profile), original)
    await expect(dialog.getByLabel('Alarm Name', { exact: true })).toBeFocused()
    await terminalVisible(dialog, dialog.getByLabel('Alarm Name', { exact: true }))
    await expect(dialog.getByLabel('Alarm Type', { exact: true })).toHaveValue('once')
    expectSameBox(await auditWake(page, dialog, profile), original)
    await terminalVisible(dialog, dialog.getByLabel('Alarm Date', { exact: true }))
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
    await dialog.getByRole('button', { name: 'Back to Wake Alarms', exact: true }).click()
    dialog = page.getByRole('dialog', { name: WAKE_TITLE, exact: true })
    expectSameBox(await auditWake(page, dialog, profile), original)
    const old = await dialog.elementHandle()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    expect(await old!.getAttribute('data-closing')).toBe('true')
    await expect(dialog).toHaveCount(0, { timeout: 700 })
  })
}

test('Add Wake Alarm supports bed toggles for one-time naps and scheduled alarms', async ({ page }) => {
  await page.setViewportSize(wakeProfile('phone-portrait'))
  await page.goto('/at-a-glance/master-bedroom')
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as unknown as { __mockHass?: WakeMockApi }).__mockHass?.getEntity,
  ))).toBe(true)
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: WakeMockApi }).__mockHass
    const entity = 'sensor.master_bedroom_sleepypod_eight_pod_schedules'
    api.setEntityState(entity, 'ready')
    api.setEntityAttribute(entity, 'left', { monday: { alarms: [] } })
    api.setEntityAttribute(entity, 'right', { monday: { alarms: [] } })
  })
  await page.getByRole('button', { name: /Wake-Light Alarms Next/ }).click()
  const dialog = page.getByRole('dialog', { name: WAKE_TITLE, exact: true })
  await settleWake(dialog)
  await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
  const stephen = editor.getByRole('switch', { name: "Turn on Add to Stephen's Bed" })
  const steph = editor.getByRole('switch', { name: "Turn on Add to Steph's Bed" })
  await expect(stephen).toHaveAttribute('aria-checked', 'false')
  await expect(steph).toHaveAttribute('aria-checked', 'false')
  await expect(stephen).toHaveAttribute('aria-disabled', 'false')
  await expect(steph).toHaveAttribute('aria-disabled', 'false')
  const rampHeading = editor.getByRole('heading', { name: 'Light Ramp Duration', exact: true })
  await expect(rampHeading).toBeVisible()
  await expect(rampHeading.locator('..').locator('span[aria-hidden="true"]')).toBeVisible()
  await expect(editor.getByText(/Adds a temporary bed alarm/)).toHaveCount(0)
  await stephen.click()
  const selectedStephen = editor.getByRole('switch', { name: "Turn off Add to Stephen's Bed" })
  await expect(selectedStephen).toHaveAttribute('aria-checked', 'true')
  await editor.getByLabel('Alarm Type', { exact: true }).selectOption('weekly')
  await expect(selectedStephen).toHaveAttribute('aria-disabled', 'false')
  await expect(steph).toHaveAttribute('aria-disabled', 'false')
  await expect(editor.getByText(/Adds this wake time/)).toHaveCount(0)
})

test('deleting a wake alarm requires the native browser confirmation', async ({ page }) => {
  await page.setViewportSize(wakeProfile('phone-portrait'))
  const dialog = await openWake(page)
  await dialog.getByRole('button', { name: /Weekday Wake Weekdays/ }).click()
  const editor = page.getByRole('dialog', { name: 'Weekday Wake · Master Bedroom' })
  const deleteButton = editor.getByRole('button', { name: 'Delete', exact: true })

  let cancelledMessage = ''
  let cancelledType = ''
  page.once('dialog', async nativeDialog => {
    cancelledMessage = nativeDialog.message()
    cancelledType = nativeDialog.type()
    await nativeDialog.dismiss()
  })
  await deleteButton.click()
  expect(cancelledType).toBe('confirm')
  expect(cancelledMessage).toBe('Delete alarm set for 6:30 AM on Weekdays?')
  await expect(editor).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light'))).toEqual([])

  let confirmedMessage = ''
  page.once('dialog', async nativeDialog => {
    confirmedMessage = nativeDialog.message()
    await nativeDialog.accept()
  })
  await deleteButton.click()
  expect(confirmedMessage).toBe('Delete alarm set for 6:30 AM on Weekdays?')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light' && call.serviceData?.operation === 'delete_alarm').length)).toBe(1)
})

test('mounted rotations preserve the wake intent, selected tab, detail frame and portrait geometry', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(wakeProfile('phone-portrait'))
  let dialog = await openWake(page)
  const portrait = await auditWake(page, dialog, wakeProfile('phone-portrait'))
  await dialog.getByRole('tab', { name: 'Defaults', exact: true }).click()
  for (const name of LAYOUT_JOURNEYS.navigation) {
    await resizeWake(page, wakeProfile(name))
    await auditWake(page, dialog, wakeProfile(name))
    await expect(dialog.getByRole('tab', { name: 'Defaults' })).toHaveAttribute('aria-selected', 'true')
  }
  expectSameBox((await dialog.boundingBox())!, portrait)
  await dialog.getByRole('tab', { name: 'Wake Alarms', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
  for (const name of ['desktop', 'island-phone-landscape-left', 'rectangular-phone-landscape', 'phone-portrait']) {
    await resizeWake(page, wakeProfile(name))
    await auditWake(page, dialog, wakeProfile(name))
  }
  expectSameBox((await dialog.boundingBox())!, portrait)
})

test('empty, unavailable, incompatible, source-only and active states share one frame', async ({ page }) => {
  test.setTimeout(120_000)
  for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'rectangular-phone-landscape', 'ipad-portrait'].map(wakeProfile)) {
    await page.setViewportSize(profile)
    const dialog = await openWake(page)
    await resizeWake(page, profile)
    const original = await auditWake(page, dialog, profile)
    const baseline = await page.evaluate(id => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.getEntity(id)!, WAKE_ENTITY)
    const sourceAlarm = {
      id: 'source-right', label: 'SleepyPod Right Wake', source: 'sleepypod',
      source_ref: 'sleepypod:right', source_label: 'SleepyPod Right', revision: 0,
      local_time: '07:00', kind: 'weekly', date: null, ramp_minutes: 30, enabled: true,
      weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    }
    const variants = [
      { phase: 'idle', changes: { alarms: [], next_wake_at: null, next_ramp_minutes: null } },
      { phase: 'idle', changes: { alarms: [sourceAlarm], alarm_links: {}, next_wake_at: null, next_ramp_minutes: null } },
      { phase: 'unavailable', changes: { command_available: false, available: false, current_blockers: ['integration_unavailable'] } },
      { phase: 'idle', changes: { contract_version: 1, command_available: false } },
      { phase: 'degraded', changes: { current_blockers: ['source_identity_unavailable'] } },
      { phase: 'holding', changes: { commanded_brightness_pct: 100, episode_ref: 'active-episode', active_occurrences: [{
        occurrence_id: 'active', alarm_id: 'weekday-wake', wake_at: '2030-06-10T06:30:00-07:00',
        phase: 'holding', source_ref: null,
      }] } },
    ]
    for (const [index, variant] of variants.entries()) {
      await seedWake(page, { ...baseline.attributes, ...variant.changes, revision: 100 + index }, variant.phase)
      expectSameBox(await auditWake(page, dialog, profile), original)
    }
    await expect(dialog.getByRole('button', { name: 'Stop Wake-Light Episode', exact: true })).toBeEnabled()
  }
})

test('pending and rejected saves retain drafts and do not resize the sheet', async ({ page }) => {
  for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'rectangular-phone-landscape'].map(wakeProfile)) {
    await page.setViewportSize(profile)
    let dialog = await openWake(page)
    await resizeWake(page, profile)
    const original = await auditWake(page, dialog, profile)
    await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
    await dialog.getByLabel('Alarm Name', { exact: true }).fill('Retain This Draft')
    await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.setCallServiceOutcome('wake_light', 'command', 'pending'))
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    expectSameBox(await auditWake(page, dialog, profile), original)
    await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.rejectWakeCommands())
    const alert = dialog.getByRole('alert')
    await expect(alert).toContainText('Home Assistant did not confirm')
    await expect(dialog.getByLabel('Alarm Name', { exact: true })).toHaveValue('Retain This Draft')
    await expectWakeTargetAboveFooter(dialog, alert)
    await terminalVisible(dialog, alert)
    expectSameBox(await auditWake(page, dialog, profile), original)
  }
})

test('revision conflict recovery remains above the footer through rotation', async ({ page }) => {
  test.setTimeout(90_000)
  const portrait = wakeProfile('phone-portrait')
  await page.setViewportSize(portrait)
  let dialog = await openWake(page)
  const original = await auditWake(page, dialog, portrait)
  await dialog.getByRole('button', { name: /^Weekday Wake/ }).click()
  dialog = page.getByRole('dialog', { name: 'Weekday Wake · Master Bedroom', exact: true })
  await dialog.getByLabel('Alarm Name', { exact: true }).fill('Conflict Draft')
  dialog = page.getByRole('dialog', { name: 'Conflict Draft · Master Bedroom', exact: true })
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
  for (const profile of [portrait, wakeProfile('island-phone-landscape-left'), portrait]) {
    await resizeWake(page, profile)
    await expectWakeTargetAboveFooter(dialog, reload)
    const frame = await auditWake(page, dialog, profile)
    if (profile.name === portrait.name) expectSameBox(frame, original)
  }
  await expect(dialog.getByLabel('Alarm Name', { exact: true })).toHaveValue('Conflict Draft')
})

test('a pending alarm toggle leaves other wake alarms operable and queues their commands', async ({ page }) => {
  await page.setViewportSize(wakeProfile('phone-portrait'))
  const dialog = await openWake(page)
  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: WakeMockApi }).__mockHass
    const entity = api.getEntity('sensor.master_bedroom_wake_light')
    const alarms = entity?.attributes.alarms as Record<string, unknown>[]
    api.setEntityAttribute('sensor.master_bedroom_wake_light', 'alarms', [
      ...alarms,
      { ...alarms[0], id: 'weekend-wake', label: 'Weekend Wake', revision: 1, weekdays: ['saturday', 'sunday'] },
    ])
    api.calls.splice(0)
    api.setCallServiceOutcome('wake_light', 'command', 'pending')
  })

  const weekday = dialog.getByRole('switch', { name: 'Turn off Weekday Wake' })
  const weekend = dialog.getByRole('switch', { name: 'Turn off Weekend Wake' })
  await weekday.click()
  await expect(dialog.getByRole('switch', { name: 'Turn on Weekday Wake' })).toHaveAttribute('aria-disabled', 'true')
  await expect(weekend).toHaveAttribute('aria-disabled', 'false')
  await expect(dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true })).toBeEnabled()

  await weekend.click()
  await expect(dialog.getByRole('switch', { name: 'Turn on Weekend Wake' })).toHaveAttribute('aria-disabled', 'true')
  expect(await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light').length)).toBe(1)

  await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.resolveWakeCommands())
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls
    .filter(call => call.domain === 'wake_light').length)).toBe(2)
  await expect(dialog.getByRole('switch', { name: 'Turn on Weekend Wake' })).toHaveAttribute('aria-disabled', 'true')

  await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.resolveWakeCommands())
  await expect(dialog.getByRole('switch', { name: 'Turn on Weekday Wake' })).toHaveAttribute('aria-disabled', 'false')
  await expect(dialog.getByRole('switch', { name: 'Turn on Weekend Wake' })).toHaveAttribute('aria-disabled', 'false')
})

test('source navigation closes before opening the existing Pod alarm editor', async ({ page }) => {
  await page.setViewportSize(wakeProfile('phone-portrait'))
  const dialog = await openWake(page)
  await seedWake(page, {
    alarms: [{
      id: 'source-right', label: 'SleepyPod Right Wake', source: 'sleepypod', source_ref: 'sleepypod:right',
      revision: 0, local_time: '07:00', kind: 'weekly', date: null, ramp_minutes: 30, enabled: true,
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
  const old = await dialog.elementHandle()
  await dialog.getByRole('button', { name: /Steph's Alarms/ }).click()
  expect(await old!.getAttribute('data-closing')).toBe('true')
  const source = page.getByRole('dialog', { name: "Steph's Bed", exact: true })
  await expect(source).toBeVisible()
  await settleWake(source)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(source.getByRole('tab', { name: 'Alarms', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(source.getByRole('heading', { name: 'Wake Light' })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: WakeMockApi }).__mockHass.calls.filter(call => call.domain === 'wake_light'))).toEqual([])
})

test('keyboard-reduced landscape keeps the focused editor and fixed actions inside the visible rectangle', async ({ page }) => {
  const profile = wakeProfile('island-phone-landscape-left')
  await page.setViewportSize(profile)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        width: 852, height: 393, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
      }),
    })
  })
  let dialog = await openWake(page)
  await resizeWake(page, profile)
  await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
  await dialog.getByLabel('Alarm Name', { exact: true }).focus()
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 263 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('130px')
  await settleWake(dialog)
  expectSameBox((await dialog.boundingBox())!, { x: 71, y: 8, width: 725, height: 356 })
  for (const name of ['Close', 'Save']) {
    const box = await dialog.getByRole('button', { name, exact: true }).boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(242)
  }
  await terminalVisible(dialog, dialog.getByLabel('Alarm Name', { exact: true }))
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 393 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await auditWake(page, dialog, profile)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0, { timeout: 700 })
})

test('landscape defaults preserve actual terminal padding and backdrop dismissal', async ({ page }, testInfo) => {
  const profile = wakeProfile('rectangular-phone-landscape')
  await page.setViewportSize(profile)
  const dialog = await openWake(page)
  await resizeWake(page, profile)
  await dialog.getByRole('tab', { name: 'Defaults', exact: true }).click()
  await settleWake(dialog)
  await dialog.evaluate(element => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')!
    body.scrollTop = body.scrollHeight
  })
  await expect.poll(() => dialog.evaluate(element => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')!
    const measure = body.querySelector<HTMLElement>('[data-modal-content-measure="true"]')!
    return Math.abs(body.getBoundingClientRect().bottom - measure.getBoundingClientRect().bottom
      - parseFloat(getComputedStyle(body).paddingBottom))
  })).toBeLessThanOrEqual(1)
  const screenshotPath = testInfo.outputPath('wake-terminal-padding.png')
  await dialog.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('wake-terminal-padding.png', { path: screenshotPath, contentType: 'image/png' })
  await page.mouse.click(3, 3)
  await expect(dialog).toHaveCount(0, { timeout: 700 })
})

test('blocked readiness preserves intrinsic end clearance through repeated body reflow', async ({ page }) => {
  test.setTimeout(120_000)
  for (let round = 0; round < 4; round += 1) {
    await page.setViewportSize(wakeProfile('phone-portrait'))
    const dialog = await openSurface(page, 'wake-light')
    await enterState(dialog, 'wake-light', 'blocked')
    for (const profile of journey('wake-light', 'touch-webkit')) {
      await applyProfile(page, profile)
      await wakeStateFacts(dialog, 'wake-light', 'blocked')
    }
  }
})
