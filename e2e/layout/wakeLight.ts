import { expect, type Locator, type Page } from './fixture'
import { closeMounted, modalFacts, waitForModalReady, waitForRoute } from './evidence'
import type { ScenarioId } from './contracts'
import sourceSchedules from '../../home-assistant/tests/fixtures/sleepypod-alarm-v2.json' with { type: 'json' }

export const WAKE_LAYOUT_ENTITY = 'sensor.master_bedroom_wake_light'
export const WAKE_LAYOUT_TITLE = 'Master Bedroom Wake-Light Alarms'
const SOURCE_ROW = {
  id: 'source-right', label: 'SleepyPod Right Wake', source: 'sleepypod',
  source_ref: 'sleepypod:right', revision: 0, local_time: '07:00', kind: 'weekly',
  date: null, ramp_minutes: 30, enabled: true,
  weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
}

export function isWakeScenario(scenario: ScenarioId) {
  return scenario === 'wake-light' || scenario === 'wake-editor' || scenario === 'wake-source'
}

async function seed(page: Page, attributes: Record<string, unknown>, phase: string) {
  await page.evaluate(({ attributes, phase, entity }) => {
    const api = window.__mockHass
    if (!api?.getEntity) throw new Error('Wake layout states require the guarded mock backend')
    for (const [key, value] of Object.entries(attributes)) api.setEntityAttribute(entity, key, value)
    api.setEntityState(entity, phase)
  }, { attributes, phase, entity: WAKE_LAYOUT_ENTITY })
}

function active(phase: string) {
  return [{
    occurrence_id: 'layout-active-wake', alarm_id: 'weekday-wake', source_ref: null,
    wake_at: new Date().toISOString(), phase,
    snoozed_until: phase === 'snoozed' ? new Date(Date.now() + 300_000).toISOString() : null,
  }]
}

export async function openWakeRoomState(page: Page, state: string) {
  await page.goto('/index.html?path=master-bedroom')
  await waitForRoute(page, 'master-bedroom')
  if (state === 'no-enabled') {
    const current = await page.evaluate(entity => window.__mockHass!.getEntity(entity)!, WAKE_LAYOUT_ENTITY)
    const alarms = (current.attributes.alarms as Array<Record<string, unknown>>).map(alarm => ({ ...alarm, enabled: false }))
    await seed(page, { alarms, next_wake_at: null, next_ramp_minutes: null }, 'idle')
  }
  if (state === 'unavailable') await seed(page, { available: false, command_available: false }, 'unavailable')
  if (state === 'active') await seed(page, {
    progress: 50, commanded_brightness_pct: 50, episode_ref: 'room-tile-episode',
    active_occurrences: active('ramping'),
  }, 'ramping')
  await page.evaluate(() => { window.__mockHass!.calls.length = 0 })
}

export async function wakeRoomFacts(page: Page, state: string) {
  const tile = page.getByRole('button', { name: /^Wake-Light Alarms/ })
  await tile.scrollIntoViewIfNeeded()
  const before = (await tile.boundingBox())!
  await expect(tile).toHaveAttribute('data-action-kind', 'modal')
  await expect(tile).toHaveAttribute('data-variant', 'card')
  expect(before.height).toBe(120)
  const label = await tile.getAttribute('aria-label')
  if (state === 'ready') expect(label).toContain('Next')
  if (state === 'no-enabled') expect(label).toContain('None Enabled')
  if (state === 'unavailable') expect(label).toContain('Unavailable')
  if (state === 'active') expect(label).toContain('50%')
  await tile.click()
  const dialog = page.getByRole('dialog', { name: WAKE_LAYOUT_TITLE, exact: true })
  await waitForModalReady(dialog)
  await closeMounted(dialog)
  const after = (await tile.boundingBox())!
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[key] - after[key])).toBeLessThanOrEqual(1)
  const calls = await page.evaluate(() => window.__mockHass!.calls.filter(call => call.domain === 'wake_light' || call.domain === 'mqtt'))
  expect(calls).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  return { roomState: state, label, tile: after, semantics: 'modal', serviceWrites: 0, returnedGeometry: 'unchanged' }
}

async function sourceEntry(dialog: Locator, state: string) {
  const page = dialog.page()
  await seed(page, {
    alarms: [SOURCE_ROW], next_wake_at: null, next_ramp_minutes: null,
    alarm_links: {},
  }, 'idle')
  await page.evaluate(schedules => {
    const api = window.__mockHass!
    api.setEntityState('climate.sleepypod_eight_pod_right_side', 'heat')
    api.setEntityState('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0')
    api.setEntityState('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'ready')
    for (const [key, value] of Object.entries(schedules)) {
      api.setEntityAttribute('sensor.master_bedroom_sleepypod_eight_pod_schedules', key, value)
    }
    api.calls.length = 0
  }, sourceSchedules)
  const wakeNode = await dialog.elementHandle()
  await dialog.getByRole('button', { name: /^Steph's Alarms/ }).click()
  expect(await wakeNode!.getAttribute('data-closing')).toBe('true')
  await expect(page.getByRole('dialog', { name: "Steph's Bed", exact: true })).toBeVisible()
  await waitForModalReady(dialog)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(dialog.getByRole('tab', { name: 'Alarms', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('button', { name: 'Add Alarm', exact: true })).toBeVisible()
  if (state === 'pod-alarm-detail') {
    await dialog.getByRole('button', { name: /Sunday/ }).click()
    await waitForModalReady(dialog)
    await dialog.getByRole('button', { name: /7:00 AM/ }).first().click()
    await waitForModalReady(dialog)
    await expect(page.getByRole('dialog', { name: "Steph's Bed Sunday Alarm", exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Alarm time', { exact: true })).toHaveValue('07:00')
  } else if (state === 'back') {
    await closeMounted(dialog)
    await page.getByRole('button', { name: /^Wake-Light Alarms/ }).click()
    await expect(page.getByRole('dialog', { name: WAKE_LAYOUT_TITLE, exact: true })).toBeVisible()
    await waitForModalReady(dialog)
  }
  await dialog.evaluate(node => { node.dataset.layoutMounted = 'original' })
  expect(await page.evaluate(() => window.__mockHass!.calls.filter(call => call.domain === 'wake_light' || call.domain === 'mqtt'))).toEqual([])
}

export async function enterWakeState(dialog: Locator, scenario: ScenarioId, state: string) {
  const page = dialog.page()
  if (scenario === 'wake-source') {
    await sourceEntry(dialog, state)
    return
  }
  if (scenario === 'wake-editor') {
    const existing = ['unchanged', 'dirty', 'reverted', 'revision-conflict', 'legacy-ramp'].includes(state)
    if (state === 'legacy-ramp') {
      await page.evaluate(entity => {
        const api = window.__mockHass!
        const snapshot = api.getEntity(entity)!
        const alarms = snapshot.attributes.alarms as Array<Record<string, unknown>>
        api.setEntityAttribute(entity, 'alarms', alarms.map(alarm => alarm.id === 'weekday-wake'
          ? { ...alarm, ramp_minutes: 45 } : alarm))
      }, WAKE_LAYOUT_ENTITY)
    }
    if (existing) await dialog.getByRole('button', { name: /^Weekday Wake/ }).click()
    else await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
    await waitForModalReady(dialog)
    const name = dialog.getByLabel('Alarm Name', { exact: true })
    if (state === 'scheduled') await dialog.getByLabel('Alarm Type', { exact: true }).selectOption('weekly')
    if (['dirty', 'pending', 'rejected', 'revision-conflict'].includes(state)) await name.fill('Layout wake draft')
    if (state === 'reverted') {
      await name.fill('Temporary wake draft')
      await name.fill('Weekday Wake')
    }
    if (state === 'pending' || state === 'rejected') {
      await page.evaluate(() => window.__mockHass!.setCallServiceOutcome('wake_light', 'command', 'pending'))
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
      if (state === 'rejected') {
        await page.evaluate(() => window.__mockHass!.rejectWakeCommands())
        await expect(dialog.getByRole('alert')).toContainText('Home Assistant did not confirm')
      }
    }
    if (state === 'revision-conflict') {
      await page.evaluate(entity => {
        const api = window.__mockHass!
        const snapshot = api.getEntity(entity)!
        const alarms = snapshot.attributes.alarms as Array<Record<string, unknown>>
        api.setEntityAttribute(entity, 'alarms', alarms.map(alarm => alarm.id === 'weekday-wake'
          ? { ...alarm, label: 'Latest saved wake', revision: Number(alarm.revision) + 1 } : alarm))
        api.setEntityAttribute(entity, 'revision', Number(snapshot.attributes.revision) + 1)
      }, WAKE_LAYOUT_ENTITY)
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Open Latest Alarm, Replace Draft', exact: true })).toBeVisible()
    }
    await waitForModalReady(dialog)
    return
  }
  const original = await page.evaluate(entity => window.__mockHass!.getEntity(entity)!, WAKE_LAYOUT_ENTITY)
  const safety = original.attributes.safety as Record<string, unknown>
  if (state === 'empty') await seed(page, { alarms: [], next_wake_at: null, next_ramp_minutes: null }, 'idle')
  if (state === 'source-only') await seed(page, { alarms: [SOURCE_ROW], next_wake_at: null, next_ramp_minutes: null, alarm_links: {} }, 'idle')
  if (state === 'no-enabled') {
    const alarms = (original.attributes.alarms as Array<Record<string, unknown>>)
      .map(alarm => ({ ...alarm, enabled: false }))
    await seed(page, { alarms, next_wake_at: null, next_ramp_minutes: null }, 'idle')
  }
  if (state === 'vacation') await seed(page, { safety: { ...safety, vacation_state: 'on' }, current_blockers: ['vacation_not_off'] }, 'blocked_vacation')
  if (state === 'unavailable') await seed(page, { available: false, command_available: false, current_blockers: ['integration_unavailable'] }, 'unavailable')
  if (state === 'incompatible') await seed(page, { contract_version: 2, command_available: false }, 'idle')
  if (state === 'blocked') await seed(page, { current_blockers: ['source_identity_unavailable'] }, 'degraded')
  if (['active', 'source-snoozed', 'recovering'].includes(state)) {
    const phase = state === 'active' ? 'holding' : state === 'source-snoozed' ? 'snoozed' : state
    await seed(page, {
      commanded_brightness_pct: 100, episode_ref: 'layout-episode', active_occurrences: active(phase),
    }, phase)
  }
  if (state === 'spent-once') {
    const alarms = original.attributes.alarms as Array<Record<string, unknown>>
    await seed(page, { alarms: [{ ...alarms[1], label: 'Spent wake', date: '2020-06-15', enabled: false }], next_wake_at: null, next_ramp_minutes: null }, 'idle')
  }
  if (state === 'legacy-ramp') {
    await seed(page, {
      defaults: { post_wake_hold_minutes: 5, ramp_minutes: 45 },
    }, 'idle')
  }
  const selectedTab = state === 'defaults' || state === 'legacy-ramp' ? 'Defaults' : 'Wake Alarms'
  const tab = dialog.getByRole('tab', { name: selectedTab, exact: true })
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click()
  await waitForModalReady(dialog)
}

export async function wakeStateFacts(dialog: Locator, scenario: ScenarioId, state: string) {
  const editor = scenario === 'wake-editor' || (scenario === 'wake-source' && state === 'pod-alarm-detail')
  const facts: Record<string, unknown> = await modalFacts(dialog, editor ? 'body' : 'panes')
  await expect(dialog).toHaveAttribute('data-layout-mounted', 'original')
  await expect(dialog.page().getByRole('dialog')).toHaveCount(1)
  if (scenario === 'wake-editor') {
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
    const existing = ['unchanged', 'dirty', 'reverted', 'revision-conflict', 'legacy-ramp'].includes(state)
    if (!existing) {
      await expect(dialog).toHaveAccessibleName('Add Wake Alarm · Master Bedroom')
    } else {
      await expect(dialog).toHaveAccessibleName(/ · Master Bedroom$/)
      await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
    }
    const pending = state === 'pending'
    if (pending) await expect(dialog.getByLabel('Alarm Name', { exact: true })).toBeDisabled()
    else await expect(dialog.getByLabel('Alarm Name', { exact: true })).toBeEnabled()
    if (pending) await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    if (state === 'rejected') await expect(dialog.getByRole('alert')).toContainText('Home Assistant did not confirm')
    if (state === 'revision-conflict') await expect(dialog.getByRole('button', { name: 'Open Latest Alarm, Replace Draft', exact: true })).toBeVisible()
    if (state === 'one-time') {
      await expect(dialog.getByLabel('Alarm Type', { exact: true })).toHaveValue('once')
      await expect(dialog.getByLabel('Alarm Date', { exact: true })).toBeVisible()
    }
    if (state === 'scheduled') await expect(dialog.getByLabel('Alarm Type', { exact: true })).toHaveValue('weekly')
    if (state === 'unchanged' || state === 'reverted') await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    if (state === 'dirty') await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    if (state === 'legacy-ramp') {
      await expect(dialog.getByRole('alert')).toContainText('supported light ramp duration')
      await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0)
    }
    facts.draft = { retained: true, pending, conflict: state === 'revision-conflict', dirty: state === 'dirty' }
  }
  if (scenario === 'wake-source') {
    expect(await dialog.page().evaluate(() => window.__mockHass!.calls.filter(call => call.domain === 'wake_light' || call.domain === 'mqtt'))).toEqual([])
    if (state === 'pod-alarm-detail') {
      await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarm")
      await expect(dialog.getByLabel('Alarm time', { exact: true })).toHaveValue('07:00')
    }
    facts.sourceNavigation = { writes: 0, singleSheet: true, state }
  }
  if (scenario === 'wake-light') {
    await expect(dialog.getByRole('tab')).toHaveCount(2)
    await expect(dialog.getByRole('tab', { name: 'Wake Light Overview', exact: true })).toHaveCount(0)
    if (state === 'alarms') await expect(dialog.getByRole('switch', { name: /Weekday Wake$/ })).toBeVisible()
    if (state === 'defaults') {
      const ramp = dialog.getByRole('radiogroup', { name: 'Light Ramp Duration', exact: true })
      await expect(ramp.getByRole('radio')).toHaveCount(5)
      for (const option of ['None', '5 Minutes', '10 Minutes', '15 Minutes', '30 Minutes']) {
        await expect(ramp.getByRole('radio', { name: option, exact: true })).toBeVisible()
      }
      await expect(dialog.getByText(/Any manual or Siri light command ends the hold immediately/)).toBeVisible()
    }
    if (state === 'no-enabled') await expect(dialog.getByRole('switch').first()).toHaveAttribute('aria-checked', 'false')
    if (state === 'source-only') await expect(dialog.getByText('Idle', { exact: true })).toBeVisible()
    if (['active', 'source-snoozed', 'recovering'].includes(state)) {
      await expect(dialog.getByRole('button', { name: 'Stop Wake-Light Episode', exact: true })).toBeEnabled()
      await expect(dialog.getByRole('button', { name: 'Snooze', exact: true })).toHaveCount(0)
    }
    if (state === 'source-only') await expect(dialog.getByRole('button', { name: /^Steph's Alarms/ })).toBeVisible()
    if (state === 'incompatible' || state === 'unavailable' || state === 'blocked' || state === 'vacation' || state === 'legacy-ramp') await expect(dialog.getByRole('alert').first()).toBeVisible()
    if (state === 'unavailable') await expect(dialog.getByRole('alert')).toHaveCount(1)
    if (state === 'legacy-ramp') {
      await expect(dialog.getByRole('radiogroup', { name: 'Light Ramp Duration' }).getByRole('radio', { checked: true })).toHaveCount(0)
    }
    if (state === 'spent-once') await expect(dialog.getByRole('button', { name: /^Spent wake/ })).toBeVisible()
    facts.wakeState = { state, selectedTab: await dialog.getByRole('tab', { selected: true }).getAttribute('aria-label') }
  }
  return facts
}
