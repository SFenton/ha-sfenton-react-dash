import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from './layout/fixture'
import {
  EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD,
  FUTURE_VACUUM_OUTCOME_PAYLOAD,
  INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD,
  LEGACY_VACUUM_OUTCOMES,
  MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD,
  MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
  NINE_ROOM_VACUUM_OUTCOME_CONTRACT,
} from '../src/test/fixtures/vacuumOutcomes'
import { setSafeAreaInsets } from './safe-area'

// @covers src/hooks/useModalDetailPageScroll.ts
// @covers src/components/hass/VacuumOutcomes.module.css
// @covers src/components/hass/VacuumCard.module.css
const SESSION_ENTITY_ID = 'sensor.main_floor_vacuum_coordinator_session_state'
const EVIDENCE_DIRECTORY = 'artifacts/vacuum-outcomes'
const LOADING_CENTER_LANDSCAPE_PROFILES = [
  { name: '568x320 zero inset', viewport: { height: 320, width: 568 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: '667x375 zero inset', viewport: { height: 375, width: 667 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: '734x343 zero inset', viewport: { height: 343, width: 734 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: '852x393 left inset', viewport: { height: 393, width: 852 }, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
  { name: '852x393 right inset', viewport: { height: 393, width: 852 }, insets: { top: 0, right: 59, bottom: 21, left: 44 } },
] as const

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
  await expect(dialog.locator('[data-layout-preparation-phase]')).toHaveAttribute('data-layout-preparation-phase', 'content', { timeout: 15_000 })
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

async function expectVacuumLoadingCentered(dialog: Locator) {
  const loading = dialog.getByRole('status', { name: 'Loading vacuum controls' })
  await expect(loading).toBeVisible()
  const loadingGeometry = await dialog.evaluate((element) => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    const navigation = element.querySelector<HTMLElement>('[data-modal-sheet-navigation="true"]')
    const arc = element.querySelector<HTMLElement>('[role="status"][aria-label="Loading vacuum controls"] > span')
    if (!body || !navigation || !arc) throw new Error('Expected vacuum loading geometry')
    const bodyBox = body.getBoundingClientRect()
    const navigationBox = navigation.getBoundingClientRect()
    const arcBox = arc.getBoundingClientRect()
    return {
      arcCenter: arcBox.top + arcBox.height / 2,
      availableCenter: bodyBox.top + (navigationBox.top - bodyBox.top) / 2,
      bodyBottom: bodyBox.bottom,
      navigationTop: navigationBox.top,
    }
  })
  expect(Math.abs(loadingGeometry.bodyBottom - loadingGeometry.navigationTop)).toBeLessThanOrEqual(1)
  expect(Math.abs(loadingGeometry.arcCenter - loadingGeometry.availableCenter)).toBeLessThanOrEqual(1)
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
  await expectVacuumLoadingCentered(dialog)
  await expect(dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })).toBeFocused()
  await expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
  await expect(dialog.getByRole('tablist', { name: 'Main Floor modal sections' })).toBeVisible()
  expect(await vacuumActionCalls(page)).toEqual([])
})

for (const profile of LOADING_CENTER_LANDSCAPE_PROFILES) {
  test(`vacuum loading arc stays centered after outcome Back at ${profile.name}`, async ({ page }) => {
    await page.setViewportSize(profile.viewport)
    await page.goto('/at-a-glance/vacuums')
    await setSafeAreaInsets(page, profile.insets)
    await setOutcomeAttributes(page, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))
    const dialog = await openVacuum(page)

    await dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' }).click()
    await expect(dialog.locator('[data-vacuum-outcome-detail="true"]')).toBeVisible()
    await dialog.getByRole('button', { name: 'Back to Vacuum Controls' }).click()

    await expectVacuumLoadingCentered(dialog)
  })
}

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

test('v2 uncertainty overrides legacy issues and exposes qualified evidence', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(
    page,
    structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD),
    MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
  )
  const dialog = await openVacuum(page)
  const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Sep 18, 2026' })

  await expect(summary).toContainText('2 Rooms Unverified • 3 Rooms Need Attention')
  await expect(dialog.getByText(MISLEADING_V2_LEGACY_VACUUM_OUTCOMES.while_away_issues[0])).toHaveCount(0)
  await summary.click()

  expect(await dialog.locator('[data-group]').evaluateAll((groups) => groups.map((group) => group.getAttribute('data-group')))).toEqual([
    'unverified',
    'stillDue',
  ])
  const gym = dialog.locator('[data-room-id="gym"]')
  await expect(gym).toContainText('Completion Unverified')
  await expect(gym).toContainText('Vacuuming completion could not be verified.')
  await expect(gym).toContainText('Observed 1 of 2 requested iterations.')
  await expect(gym).toContainText('Physical Work')
  await expect(gym).toContainText('Substantial')
  await expect(gym).not.toContainText('Failed')

  const gymEvidence = gym.getByRole('button', { name: 'Show Gym Cleaning Evidence' })
  const gymEvidenceBox = await gymEvidence.boundingBox()
  expect(Math.round(gymEvidenceBox?.height ?? 0)).toBeGreaterThanOrEqual(44)
  await gymEvidence.click()
  await expect(gym.getByText('Duration').locator('xpath=following-sibling::dd')).toContainText(
    'Passed • Observed: 1,500 seconds • Minimum: 120 seconds • Reset Count: 1',
  )
  await expect(gym.getByText('Iterations').locator('xpath=following-sibling::dd')).toContainText(
    'Unverified • Observed: 1 • Requested: 2',
  )

  const office = dialog.locator('[data-room-id="office"]')
  await office.getByRole('button', { name: 'Show Office Cleaning Evidence' }).click()
  await expect(office.getByText('Duration', { exact: true }).locator('xpath=following-sibling::dd')).toContainText(
    'Passed Lower Bound • Lower Bound: 1,440 seconds • Minimum: 120 seconds • Reset Count: 1 • Attribution Uncertain',
  )
  await expect(office.getByText('Telemetry').locator('xpath=following-sibling::dd')).toHaveText('Unresolved')
  await expect(office.getByText('Source Outage Duration').locator('xpath=following-sibling::dd')).toHaveText('258 seconds')

  const livingRoom = dialog.locator('[data-room-id="living_room"]')
  await expect(livingRoom).toContainText('Partially Complete')
  await expect(livingRoom).toContainText('Home Assistant credited vacuuming; work may remain.')
  await expect(livingRoom).toContainText('Mopping remains due.')
  await expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
  expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-v2-evidence-detail', {
    dialogHorizontalOverflow: await horizontalOverflow(dialog),
    gymEvidenceTarget: gymEvidenceBox,
    viewport: { height: 852, width: 393 },
  })
})

test('retained evidence-free v2 outcomes stay unverified without legacy failure wording', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(
    page,
    structuredClone(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD),
    MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
  )
  const dialog = await openVacuum(page)
  const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Sep 17, 2026' })

  await expect(summary).toContainText('1 Room Unverified • 1 Room Needs Attention')
  await expect(dialog.getByText(MISLEADING_V2_LEGACY_VACUUM_OUTCOMES.while_away_issues[0])).toHaveCount(0)
  await summary.click()

  const office = dialog.locator('[data-room-id="office"]')
  await expect(office).toContainText('Completion Unverified')
  await expect(office).toContainText('Vacuuming completion could not be verified.')
  await expect(office).toContainText('Vacuuming remains due.')
  await expect(office).not.toContainText('Could not clean')
  await expect(office.getByRole('button', { name: /Cleaning Evidence/ })).toHaveCount(0)
  await expect(office.getByText('Floor completion time was unavailable during dock servicing after error sensor is unavailable')).toBeHidden()
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-v2-evidence-free')
})

test('incomplete typed data shows a preparing state instead of authoritative legacy results', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, structuredClone(INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD), LEGACY_VACUUM_OUTCOMES)
  const dialog = await openVacuum(page)

  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeVisible()
  await expect(dialog.getByText('Report Still Being Prepared')).toBeVisible()
  await expect(dialog.getByText('Final counts are not available.')).toBeVisible()
  await expect(dialog.getByText('Cleaned Gym')).toBeHidden()
  await expect(dialog.getByText('Could not clean Dining Room because the clean water tank is empty')).toBeHidden()
  await expect(dialog.getByRole('button', { name: /Automatic Cleaning Report for/ })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Show Main Floor Unstructured Report Details' }).click()
  await expect(dialog.getByText('Cleaned Gym')).toBeVisible()
  await expect(dialog.getByText('Could not clean Dining Room because the clean water tank is empty')).toBeVisible()
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-incomplete')
})

test('malformed typed data shows an unreadable state without legacy substitution', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, structuredClone(MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD), LEGACY_VACUUM_OUTCOMES)
  const dialog = await openVacuum(page)

  await expect(dialog.getByText('Report Could Not Be Read')).toBeVisible()
  await expect(dialog.getByText('Structured cleaning results are unavailable.')).toBeVisible()
  await expect(dialog.getByText('Cleaned Gym')).toBeHidden()
  await expect(dialog.getByText('Could not clean Dining Room because the clean water tank is empty')).toBeHidden()
  await expect(dialog.getByRole('button', { name: /Automatic Cleaning Report for/ })).toHaveCount(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-malformed')
})

test('future outcome versions show the update-required state without legacy substitution', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/vacuums')
  await setOutcomeAttributes(page, structuredClone(FUTURE_VACUUM_OUTCOME_PAYLOAD), LEGACY_VACUUM_OUTCOMES)
  const dialog = await openVacuum(page)

  await expect(dialog.getByText('Dashboard Update Required')).toBeVisible()
  await expect(dialog.getByText('This cleaning report uses an unsupported version.')).toBeVisible()
  await expect(dialog.getByText('Cleaned Gym')).toBeHidden()
  await expect(dialog.getByText('Could not clean Dining Room because the clean water tank is empty')).toBeHidden()
  await expect(dialog.getByRole('button', { name: /Automatic Cleaning Report for/ })).toHaveCount(0)
  expect(await vacuumActionCalls(page)).toEqual([])
  await saveEvidence(page, dialog, 'vacuum-outcomes-incompatible')
})

test.describe('fine-pointer outcome details', () => {
  test.use({ hasTouch: false, isMobile: false })

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
      await expect.poll(() => page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true)
      await dialog.evaluate((element) => { element.setAttribute('data-outcome-flow-node', 'original') })
      const initialFrame = await dialog.boundingBox()
      const body = dialog.locator('[data-modal-sheet-body="true"]')
      const summary = dialog.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
      const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
      const panel = dialog.getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })

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
      const mapStatusLayout = await mapPane.getAttribute('data-map-status-layout')
      expect(bodyGeometry.overflowY).toBe('hidden')
      // Landscape always anchors the map; portrait keeps the existing measured split behavior.
      expect(mapPaneGeometry.overflowY).toBe(viewport.width > viewport.height || mapStatusLayout === 'split' ? 'hidden' : 'auto')
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
      await summary.click()
      await expect(dialog.locator('[data-vacuum-outcome-detail="true"]')).toBeVisible()
      await expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
      const office = dialog.locator('[data-room-id="office"]')
      await office.getByRole('button', { name: 'Show Office History' }).click()
      await office.getByRole('button', { name: 'Show Office Technical Vacuum Diagnostics' }).click()
      await expect(office.locator('ol > li')).toHaveCount(2)
      await expect(office.getByText('Auto-Empty Dock dust bag full or dust duct clogged')).toBeVisible()

      for (const profile of [
        { width: 852, height: 393, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
        { width: 667, height: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
        { width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
        { width: viewport.width, height: viewport.height, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      ]) {
        await page.setViewportSize({ width: profile.width, height: profile.height })
        await setSafeAreaInsets(page, profile.insets)
        const presentation = profile.height < 560 ? 'landscape-dialog' : profile.width < 760 ? 'sheet' : 'dialog'
        await expect(dialog).toHaveAttribute('data-modal-presentation', presentation)
        await expect(dialog).toHaveAttribute('data-outcome-flow-node', 'original')
        await expect(office.getByRole('button', { name: 'Hide Office History' })).toHaveAttribute('aria-expanded', 'true')
        expect(await horizontalOverflow(dialog)).toBeLessThanOrEqual(0)
        if (presentation === 'landscape-dialog') {
          const box = await dialog.boundingBox()
          expect(Math.abs((box?.width ?? 0) - (profile.width - profile.insets.left - profile.insets.right - 24))).toBeLessThanOrEqual(1)
          expect(Math.abs((box?.height ?? 0) - (profile.height - profile.insets.bottom - 16))).toBeLessThanOrEqual(1)
        }
        const terminal = dialog.locator('[data-vacuum-outcome-detail="true"] [data-room-id]').last()
        await terminal.scrollIntoViewIfNeeded()
        await expect(terminal).toBeInViewport()
      }
      const detailFrame = await dialog.boundingBox()
      expect(Math.abs((detailFrame?.width ?? 0) - (initialFrame?.width ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((detailFrame?.height ?? 0) - (initialFrame?.height ?? 0))).toBeLessThanOrEqual(1)
      await saveEvidence(page, dialog, `vacuum-outcomes-desktop-${viewport.name}-expanded-detail`)
      await dialog.getByRole('button', { name: 'Back to Vacuum Controls' }).click()
      await expectVacuumLoadingCentered(dialog)
      await expect(summary).toBeFocused()
      await expect(dialog).toHaveAttribute('data-outcome-flow-node', 'original')
      expect(await vacuumActionCalls(page)).toEqual([])
    })
  }
})
