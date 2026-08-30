import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { LEGACY_VACUUM_OUTCOMES, NINE_ROOM_VACUUM_OUTCOME_CONTRACT } from '../src/test/fixtures/vacuumOutcomes'

const SESSION_ENTITY_ID = 'sensor.main_floor_vacuum_coordinator_session_state'
const EVIDENCE_DIRECTORY = 'artifacts/vacuum-outcomes'

type MockHassApi = {
  calls: Record<string, unknown>[]
  setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
}

async function setOutcomeAttributes(page: Page, contract: unknown, legacy?: typeof LEGACY_VACUUM_OUTCOMES) {
  await page.evaluate(({ contractValue, entityId, legacyValue }) => {
    const api = (window as unknown as { __mockHass: MockHassApi }).__mockHass
    api.setEntityAttribute(entityId, 'while_away_outcomes', contractValue)
    api.setEntityAttribute(entityId, 'while_away_cleaned', legacyValue?.while_away_cleaned ?? [])
    api.setEntityAttribute(entityId, 'while_away_issues', legacyValue?.while_away_issues ?? [])
    api.calls.splice(0, api.calls.length)
  }, { contractValue: contract, entityId: SESSION_ENTITY_ID, legacyValue: legacy })
}

async function openVacuum(page: Page) {
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function mockCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { __mockHass: MockHassApi }).__mockHass.calls)
}

async function vacuumActionCalls(page: Page) {
  const actionDomains = new Set(['button', 'input_boolean', 'input_select', 'mqtt', 'script', 'select', 'vacuum'])
  return (await mockCalls(page)).filter((call) => actionDomains.has(String(call.domain)))
}

async function saveEvidence(page: Page, dialog: Locator, name: string, measurements?: Record<string, unknown>) {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true })
  await page.screenshot({ path: `${EVIDENCE_DIRECTORY}/${name}.png` })
  await writeFile(`${EVIDENCE_DIRECTORY}/${name}.aria.txt`, await dialog.ariaSnapshot(), 'utf8')
  if (measurements) {
    await writeFile(`${EVIDENCE_DIRECTORY}/${name}.measurements.json`, JSON.stringify(measurements, null, 2), 'utf8')
  }
}

async function horizontalOverflow(dialog: Locator) {
  return dialog.evaluate((element) => element.scrollWidth - element.clientWidth)
}

test('typed vacuum outcomes stay compact and use one same-sheet detail at 393x852', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))
  const dialog = await openVacuum(page)
  const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
  const summarySection = dialog.getByRole('heading', { name: 'Main Floor Cleaning Report' }).locator('xpath=ancestor::section[1]')
  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })

  await expect(summary).toBeVisible()
  await expect(summary).toContainText('4 Rooms Completed • 4 Rooms Need Attention • 1 Error')
  await expect(nav).toBeVisible()
  await expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
  const summaryHeight = Math.round((await summary.boundingBox())?.height ?? 0)
  const summarySectionHeight = Math.round((await summarySection.boundingBox())?.height ?? 0)
  expect(summaryHeight).toBe(120)
  expect(summarySectionHeight).toBe(182)
  expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
  await saveEvidence(page, dialog, 'vacuum-outcomes-393-overview', {
    dialogHorizontalOverflow: await horizontalOverflow(dialog),
    summaryHeight,
    summarySectionHeight,
    viewport: { height: 852, width: 393 },
  })

  await summary.click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(dialog.getByRole('heading', { name: 'Main Floor · Automatic Cleaning Report' })).toBeVisible()
  await expect(nav).toHaveCount(0)
  await expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
  await expect(dialog.locator('[data-vacuum-outcome-detail="true"]')).toBeVisible()
  expect(await dialog.locator('[data-group]').evaluateAll((groups) => groups.map((group) => group.getAttribute('data-group')))).toEqual([
    'needsAttention',
    'interrupted',
    'stillDue',
    'done',
  ])
  await expect(dialog.getByRole('heading', { name: 'Error' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Interrupted' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Completed' })).toBeVisible()
  await expect(dialog.locator('[data-group] > div:first-child strong')).toHaveCount(0)
  await expect(dialog.locator('[data-vacuum-outcome-detail="true"]')).toBeFocused()

  const interrupted = dialog.locator('[data-room-id="hallway"]')
  await expect(interrupted).toContainText('Cleaning was interrupted because someone returned home.')
  await expect(interrupted).not.toContainText('The vacuum-only attempt was interrupted before completion.')
  await expect(interrupted).not.toContainText('Vacuuming remains due.')
  await expect(interrupted.getByText('Room Event History')).toHaveCount(0)
  await expect(interrupted.getByRole('button')).toHaveCount(0)

  const dining = dialog.locator('[data-room-id="dining_room"]')
  await expect(dining).toHaveCount(1)
  await expect(dining.getByText('Failed', { exact: true })).toHaveClass(/visuallyHidden/)
  await expect(dining).not.toContainText('Vacuuming and mopping the room failed.')
  await expect(dining).toContainText("The mop dock's clean-water tank was empty; refill it.")
  const diningProgress = dining.getByText('Vacuuming and mopping remain.')
  await expect(diningProgress).toBeVisible()
  expect(await diningProgress.evaluate((element) => getComputedStyle(element).color))
    .toBe(await dining.getByText("The mop dock's clean-water tank was empty; refill it.").evaluate((element) => getComputedStyle(element).color))
  await expect(dining).not.toContainText('Combined vacuuming and mopping remain due.')
  await expect(dining.getByText('Room Event History')).toHaveCount(0)
  await expect(dining.getByRole('button')).toHaveCount(0)

  const office = dialog.locator('[data-room-id="office"]')
  await expect(office.getByText('Completed', { exact: true })).toHaveClass(/visuallyHidden/)
  const officeHistory = office.getByRole('button', { name: 'Show Office History' })
  const officeHistoryBox = await officeHistory.boundingBox()
  expect(Math.round(officeHistoryBox?.width ?? 0)).toBeGreaterThanOrEqual(44)
  expect(Math.round(officeHistoryBox?.height ?? 0)).toBeGreaterThanOrEqual(44)
  await officeHistory.click()
  await expect(office.locator('ol > li')).toHaveCount(2)
  await expect(office.getByText('The auto-empty dock dust bag was full or its dust duct was blocked.')).toBeVisible()
  const diagnostics = office.getByRole('button', { name: 'Show Office Technical Vacuum Diagnostics' })
  await expect(office.getByText('Auto-Empty Dock dust bag full or dust duct clogged')).toBeHidden()
  await diagnostics.click()
  await expect(office.getByText('Auto-Empty Dock dust bag full or dust duct clogged')).toBeVisible()
  expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-393-detail', {
    dialogHorizontalOverflow: await horizontalOverflow(dialog),
    officeHistoryEvents: await office.locator('ol > li').count(),
    officeHistoryTarget: officeHistoryBox,
    viewport: { height: 852, width: 393 },
  })

  await dialog.getByRole('button', { name: 'Back to Vacuum Controls' }).click()
  await expect(dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })).toBeFocused()
  await expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
  await expect(dialog.getByRole('tablist', { name: 'Main Floor modal sections' })).toBeVisible()
  expect(await vacuumActionCalls(page)).toEqual([])
})

test('typed vacuum outcomes preserve narrow touch targets and wrapping at 320x568', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))
  const dialog = await openVacuum(page)
  const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
  const summarySection = dialog.getByRole('heading', { name: 'Main Floor Cleaning Report' }).locator('xpath=ancestor::section[1]')

  const summaryHeight = Math.round((await summary.boundingBox())?.height ?? 0)
  const summarySectionHeight = Math.round((await summarySection.boundingBox())?.height ?? 0)
  expect(summaryHeight).toBe(120)
  expect(summarySectionHeight).toBe(182)
  expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
  await summary.click()

  const office = dialog.locator('[data-room-id="office"]')
  await office.getByRole('button', { name: 'Show Office History' }).click()
  const commandTargets = [
    office.getByRole('button', { name: 'Hide Office History' }),
    office.getByRole('button', { name: 'Show Office Technical Vacuum Diagnostics' }),
  ]
  for (const target of commandTargets) {
    const box = await target.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44)
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44)
  }
  await expect(dialog.getByText('Master Bedroom Closet')).toBeVisible()
  await expect(dialog.locator('[data-room-id="hallway"]').getByText('Interrupted', { exact: true })).toHaveClass(/visuallyHidden/)
  expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-320-detail', {
    dialogHorizontalOverflow: await horizontalOverflow(dialog),
    summaryHeight,
    summarySectionHeight,
    viewport: { height: 568, width: 320 },
  })
})

test('incomplete typed data stays on the whole legacy branch', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, {
    ...structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
    complete: false,
  }, LEGACY_VACUUM_OUTCOMES)
  const dialog = await openVacuum(page)

  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeVisible()
  await expect(dialog.getByRole('note', { name: 'Cleaned' })).toContainText('Cleaned Gym')
  await expect(dialog.getByRole('note', { name: 'Issues' })).toContainText('Could not clean Dining Room because the clean water tank is empty')
  await expect(dialog.getByRole('button', { name: /Automatic Cleaning Report for/ })).toHaveCount(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-legacy')
})

for (const viewport of [
  { height: 700, name: '820x700', width: 820 },
  { height: 720, name: '1280x720', width: 1280 },
  { height: 1180, name: '820x1180', width: 820 },
]) {
  test(`desktop vacuum status and outcomes remain reachable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/at-a-glance/vacuums')
    await setOutcomeAttributes(page, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))
    const dialog = await openVacuum(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
    const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
    const panel = dialog.getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })

    await expect(summary).toBeVisible()
    const bodyGeometry = await body.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }))
    const mapPaneGeometry = await mapPane.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }))
    expect(bodyGeometry.overflowY).toBe('hidden')
    expect(mapPaneGeometry.overflowY).toBe('auto')
    expect(await panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto')
    await summary.scrollIntoViewIfNeeded()
    await expect(summary).toBeInViewport()
    expect(await dialog.locator('[class*="modalBody"]').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2)
    expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
    expect(await vacuumActionCalls(page)).toEqual([])
    await saveEvidence(page, dialog, `vacuum-outcomes-desktop-${viewport.name}`, {
      body: bodyGeometry,
      dialogHorizontalOverflow: await horizontalOverflow(dialog),
      mapPane: mapPaneGeometry,
      panelOverflowY: await panel.evaluate((element) => getComputedStyle(element).overflowY),
      viewport,
    })
  })
}
