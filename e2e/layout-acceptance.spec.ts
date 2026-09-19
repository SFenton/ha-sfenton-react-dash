import { test, expect, type Locator, type Page } from './layout/fixture'
import { applyHostProfile, enterState, openHost, openSurface } from './layout/app'
import { SCENARIO_IDS, SURFACE_CONTRACTS, type ScenarioId } from './layout/contracts'
import { journey, obligationsFor, PRELOAD_ROUTES } from './layout/scenarios'
import { actualCapabilities, applyProfile, assertDeclaredTabs, checkpoint, closeMounted, contextForProject, modalFacts, runEnvironment, waitForModalReady, waitForNavigation, waitForRoute } from './layout/evidence'
import { layoutProfile } from './responsive-acceptance-data'
import { openQuickLinksTab, quickLinksLayout } from './quick-links'
import { MUSIC_ROOM_REMOTE_ENTITY_ID } from '../src/constants/mediaRemotes'
import { chatStateFacts, openChatState } from './chat-layout'
import { isWakeScenario, openWakeRoomState, wakeRoomFacts, wakeStateFacts } from './layout/wakeLight'

// @covers e2e/layout/app.ts
// @covers e2e/layout/contracts.ts
// @covers e2e/layout/scenarios.ts
// @covers src/constants/pageLayout.ts
// @covers src/pages/DashboardViewPage.tsx
// @covers src/pages/DashboardViewPage.module.css

async function recipeGroceryFacts(dialog: Locator, state: string) {
  const command = dialog.locator('[data-recipe-grocery-phase]')
  if (state === 'ready') {
    await expect(dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })).toBeEnabled()
    await expect(command).toHaveAttribute('data-recipe-grocery-phase', '0')
  } else if (state === 'loading') {
    await expect(dialog.locator('[data-recipe-grocery-spinner="true"]')).toBeVisible()
    await expect(command).toHaveAttribute('data-recipe-grocery-phase', '1')
  } else {
    await expect(dialog.locator('[data-recipe-grocery-check="true"]')).toBeVisible()
    await expect(command).toHaveAttribute('data-recipe-grocery-phase', '3')
    await expect(dialog.getByText('Missing ingredients were submitted.')).toHaveCount(0)
  }
  const facts = {
    state,
    commandHeight: await command.evaluate((element) => element.getBoundingClientRect().height),
    visibleStatusCopy: await dialog.locator('[data-recipe-grocery-success="true"]:not([class*="visuallyHidden"])').count(),
  }
  expect(facts.commandHeight).toBeCloseTo(50, 0)
  expect(facts.visibleStatusCopy).toBe(0)
  return facts
}

async function soloTripAwayChipFacts(dialog: Locator) {
  const chip = dialog.locator('[data-eight-sleep-away-chip="true"]')
  const powerActions = dialog.locator('[data-eight-sleep-power-actions="true"]')
  const panel = dialog.locator('[data-scroll-region="eight-sleep-panel"]')
  const schedule = panel.getByRole('heading', { name: 'Sleep Schedule' })

  await expect(chip).toHaveCount(1)
  await expect(dialog.getByRole('note', { name: 'Stephen Away' })).toHaveCount(1)
  const [chipBox, powerActionsBox, panelBox, scheduleBox] = await Promise.all([
    chip.boundingBox(),
    powerActions.boundingBox(),
    panel.boundingBox(),
    schedule.boundingBox(),
  ])
  if (!chipBox || !powerActionsBox || !panelBox || !scheduleBox) throw new Error('Solo Trip away-chip checkpoint requires visible geometry')

  const presentation = await dialog.getAttribute('data-modal-presentation')
  const bodyTier = await dialog.getAttribute('data-modal-body-tier')
  const rightPane = presentation === 'dialog'
    || (presentation === 'landscape-dialog' && (bodyTier === 'standard' || bodyTier === 'wide'))

  if (rightPane) {
    expect(Math.abs(chipBox.x - panelBox.x), 'Away chip aligns with the right pane').toBeLessThanOrEqual(1)
    expect(Math.abs(chipBox.width - panelBox.width), 'Away chip matches the right pane width').toBeLessThanOrEqual(1)
    expect(chipBox.y + chipBox.height, 'Away chip precedes Sleep Schedule').toBeLessThanOrEqual(scheduleBox.y + 1)
  } else {
    expect(chipBox.y, 'Away chip follows the Turn On/Turn Off container').toBeGreaterThanOrEqual(powerActionsBox.y + powerActionsBox.height - 1)
    expect(chipBox.y + chipBox.height, 'Away chip precedes the stacked schedule panel').toBeLessThanOrEqual(panelBox.y + 1)
  }

  return {
    bodyTier,
    placement: rightPane ? 'right-pane-above-schedule' : 'below-power-controls',
    presentation,
  }
}

async function stateFacts(page: Page, dialog: Locator, scenario: ScenarioId, state: string) {
  if (isWakeScenario(scenario)) return wakeStateFacts(dialog, scenario, state)
  if (scenario === 'vacuum') {
    await waitForModalReady(dialog, undefined, 'vacuum-tabs')
    await expect(dialog.locator('[data-layout-preparation-phase="content"]')).toHaveCount(1)
    await expect(dialog.locator('[class*="vacuumLayoutLoading"]')).toHaveCount(0)
  }
  const preferredScrollMode = scenario === 'remote'
    || scenario === 'vacuum'
    || (scenario === 'quick-links' && state === 'rooms')
    || (scenario === 'solo-trip-bed' && !state.startsWith('editor'))
    ? 'panes'
    : 'body'
  const facts: Record<string, unknown> = await modalFacts(dialog, preferredScrollMode)
  await expect(dialog).toHaveAttribute('data-layout-mounted', 'original')
  if (scenario === 'solo-trip-bed') {
    if (state.startsWith('editor')) {
      const travelerChoices = dialog.getByRole('group', { name: "Who's Traveling?" }).getByRole('button')
      await expect(travelerChoices).toHaveCount(2)
      const schedule = dialog.getByRole('button', { name: 'Schedule Solo Trip' })
      await expect(schedule).toBeVisible()
      if (state === 'editor-unavailable') {
        await expect(dialog.getByText('Solo Trip scheduling is unavailable. Complete Household Away setup, then try again.', { exact: true })).toBeVisible()
        await expect(schedule).toBeDisabled()
      }
      facts.soloTrip = {
        editor: true,
        travelerChoices: await travelerChoices.count(),
        unavailable: state === 'editor-unavailable',
      }
    } else {
      const homeSide = state.endsWith('home-side')
      const expectedScope = homeSide ? 'whole-bed' : 'read-only'
      const content = dialog.locator(`[data-solo-trip-bed-scope="${expectedScope}"]`)
      await expect(content).toBeVisible()
      const notice = dialog.getByRole('note', { name: 'Stephen Away' })
      await expect(notice).toBeVisible()
      const power = dialog.getByRole('button', {
        name: homeSide ? /Turn off Steph's Bed/ : /Stephen's Bed Power Control · Read-Only During Solo Trip/,
      })
      await expect(power).toBeVisible()
      if (homeSide) {
        await expect(power).toBeEnabled()
        await expect(dialog.getByRole('slider', { name: "Steph's Bed target level" })).toBeEnabled()
      } else {
        await expect(power).toBeDisabled()
        await expect(dialog.getByRole('slider', { name: "Stephen's Bed target level" })).toHaveCount(0)
      }
      const expectedNotice = state === 'home-side'
        ? "While you are away from home and the Solo Trip setting is enabled in settings, Steph's controls and alarms will control the entire bed."
        : state === 'away-side'
          ? "Your bed side is view-only during an active Solo Trip. Make changes from Steph's bed side."
          : state === 'home-viewer-home-side'
            ? 'While Stephen is away from home and the Solo Trip setting is enabled in settings, your controls and alarms will control the entire bed.'
            : "Stephen's bed side is view-only during an active Solo Trip. Make changes from your bed side."
      await expect(notice).toContainText(expectedNotice)
      facts.soloTrip = {
        awayChip: await soloTripAwayChipFacts(dialog),
        notice: expectedNotice,
        scope: expectedScope,
        statusTitle: 'Stephen Away',
        targetControl: state === 'home-side' ? 'enabled' : 'absent',
      }
    }
  }
  if (scenario === 'quick-links' && state !== 'rooms') {
    const layout = await quickLinksLayout(dialog)
    expect(layout.cards.length).toBeGreaterThan(0)
    for (const card of layout.cards) {
      expect(card.copyFits).toBe(true)
      expect(Math.abs(card.height - (facts.presentation === 'sheet' ? 120 : 88))).toBeLessThanOrEqual(0.1)
    }
    facts.links = layout
  }
  if (scenario === 'quick-links' && state === 'rooms') {
    const grids = await dialog.locator('[style*="--modal-square-card-size"]').evaluateAll((elements) => elements.map((grid) => {
      const style = getComputedStyle(grid)
      const box = grid.getBoundingClientRect()
      return {
        width: box.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
        left: box.left + Number.parseFloat(style.paddingLeft),
        cards: Array.from(grid.querySelectorAll('button')).map((card) => {
          const rect = card.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
      }
    }))
    expect(grids.length).toBeGreaterThan(0)
    for (const grid of grids) {
      expect(grid.cards.length).toBeGreaterThan(0)
      if (facts.presentation === 'landscape-dialog') {
        const columns = Math.max(1, Math.floor((grid.width + 10) / 142))
        const track = (grid.width - (columns - 1) * 10) / columns
        for (const card of grid.cards) {
          expect(Math.abs(card.width - track)).toBeLessThanOrEqual(1)
          expect(Math.abs(card.height - card.width)).toBeLessThanOrEqual(1)
        }
        const rows = new Map<number, typeof grid.cards>()
        for (const card of grid.cards) rows.set(Math.round(card.y), [...(rows.get(Math.round(card.y)) ?? []), card])
        for (const row of rows.values()) {
          expect(Math.abs(row[0].x - grid.left)).toBeLessThanOrEqual(1)
          if (row.length === columns) expect(Math.abs(row.at(-1)!.x + row.at(-1)!.width - row[0].x - grid.width)).toBeLessThanOrEqual(1)
        }
      }
    }
    facts.grids = grids
  }
  if (scenario === 'summary') {
    const label = state === 'overdue' ? 'Overdue Chores' : state === 'upcoming' ? 'Upcoming Chores' : 'Expired Food'
    const list = dialog.getByLabel(`${label} ${state === 'expired' ? 'inventory' : 'todo'} list`, { exact: true })
    await expect(list).toBeVisible()
    const rows = state === 'expired' ? list.locator('[data-expiry-tone="expired"]') : list.locator('li')
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    const expectedColumns = facts.tier === 'standard' || facts.tier === 'wide' ? Math.min(2, count) : 1
    const rowGeometry = () => rows.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }))
    await expect.poll(async () => new Set((await rowGeometry()).map((row) => Math.round(row.x))).size, {
      message: 'The incoming Summary rows, not just CSS column declarations, must reflow before capture',
    }).toBe(expectedColumns)
    const typography = await list.locator('strong, small').evaluateAll((elements) => elements.map((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return { tag: element.tagName, size: Number.parseFloat(getComputedStyle(element).fontSize), glyphHeight: range.getBoundingClientRect().height }
    }))
    expect(typography.length).toBeGreaterThan(0)
    for (const font of typography) expect(Math.abs(font.size - (font.tag === 'STRONG' ? 13.12 : 11.2))).toBeLessThan(0.01)
    facts.selectedState = label
    facts.typography = typography
    facts.rowGeometry = await rowGeometry()
    facts.columns = expectedColumns
  }
  if (scenario === 'filters') {
    const choices = dialog.getByRole('radio')
    expect(await choices.count()).toBeGreaterThan(0)
    const clipped = await choices.locator('strong, small').evaluateAll((elements) =>
      elements.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).length)
    expect(clipped).toBe(0)
    facts.clippedDescriptions = clipped
    facts.choiceCount = await choices.count()
  }
  if (scenario === 'recipe-grocery') {
    facts.recipeGrocery = await recipeGroceryFacts(dialog, state)
  }
  if (scenario === 'form') {
    await expect(dialog.getByRole('textbox', { name: 'Task' })).toHaveValue('Layout validation draft')
    facts.draft = 'preserved'
  }
  if (scenario === 'weather') {
    await expect(dialog.locator('[data-weather-scene-preview], select')).toHaveCount(0)
    const pressure = dialog.locator('[data-kind="pressure"]')
    await expect(pressure).toHaveAttribute('aria-label', state === 'pressure-unavailable'
      ? 'Pressure Unavailable'
      : state === 'pressure-long' ? 'Pressure 101,325.25 Pa' : 'Pressure 29.92 inHg')
    const heights = await dialog.locator('[data-kind="pressure"], [data-kind="feels"], [data-kind="uv"], [data-kind="sun"], [data-kind="visibility"]')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(heights).toHaveLength(5)
    for (const height of heights) expect(Math.abs(height - 154)).toBeLessThanOrEqual(1)
    const label = state === 'wind' ? 'Wind conditions' : state === 'precipitation' ? 'Precipitation conditions' : 'Conditions conditions'
    await expect(dialog.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    facts.weather = { state, pressureHeights: heights, previewControls: 0, selectedMode: label }
  }
  if (scenario === 'vacuum') {
    const pane = dialog.getByRole('group', { name: 'Main Floor map and status' })
    const map = pane.getByRole('region', { name: 'Main Floor Valetudo map' })
    await expect(pane).toHaveAttribute('data-map-status-layout-transition', 'idle')
    const modalBody = dialog.locator('[data-area-editor="false"]')
    const canShowTwoPanes = await modalBody.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length >= 2)
    const constrained = facts.presentation === 'landscape-dialog' && canShowTwoPanes
    const viewportLayout = await pane.getAttribute('data-vacuum-viewport-layout')
    const landscapeMap = viewportLayout === 'short-landscape' || viewportLayout === 'tall-landscape'
    await expect(pane).toHaveAttribute('data-map-status-layout', constrained ? 'split' : 'stacked')
    await expect(map).toHaveAttribute('data-map-display', landscapeMap ? 'fitted' : 'contained')
    if (landscapeMap) {
      await expect(pane.getByRole('heading', { name: 'Status' })).toHaveCount(0)
      await expect(pane.getByRole('heading', { name: 'Actions' })).toHaveCount(0)
      await expect(pane.getByRole('button', { name: 'Locate' })).toHaveCount(0)
      await expect(dialog.locator('[data-scroll-region="vacuum-panel"]').getByRole('button', { name: 'Locate' })).toBeVisible()
      const geometry = await pane.evaluate((element) => {
        const mapFrame = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
        const mapStage = element.querySelector<HTMLElement>('[data-vacuum-map-stage="true"]')
        const mapRect = mapFrame?.getBoundingClientRect()
        const naturalAspect = mapFrame ? Number.parseFloat(getComputedStyle(mapFrame).getPropertyValue('--map-aspect-ratio')) : 0
        return {
          mapAspect: mapRect ? mapRect.width / mapRect.height : 0,
          naturalAspect,
          mapStageWidth: mapStage?.getBoundingClientRect().width,
          overflow: element.scrollHeight - element.clientHeight,
          statusOverflow: (() => {
            const controls = element.querySelector<HTMLElement>('[data-vacuum-map-status-controls="true"]')
            return controls ? controls.scrollHeight - controls.clientHeight : 0
          })(),
          paneWidth: element.getBoundingClientRect().width,
        }
      })
      expect(geometry.overflow).toBeLessThanOrEqual(1)
      expect(geometry.statusOverflow).toBeLessThanOrEqual(1)
      expect(geometry.naturalAspect).toBeGreaterThan(0)
      expect(geometry.mapAspect).toBeCloseTo(geometry.naturalAspect, 1)
      expect(geometry.mapStageWidth).toBeLessThanOrEqual((geometry.paneWidth ?? 0) + 1)
      facts.vacuum = geometry
    } else {
      await expect(pane.getByRole('heading', { name: 'Status' })).toHaveCount(0)
      await expect(pane.getByRole('heading', { name: 'Actions' })).toHaveCount(0)
    }
  }
  if (scenario === 'remote') {
    const pad = dialog.locator('[role="group"][aria-label$=" remote controls"]')
    const body = dialog.locator('[data-modal-sheet-body]')
    await body.evaluate((element) => { element.scrollTop = 0 })
    const buttons = await pad.getByRole('button').evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect()
      const owner = element.closest('[data-modal-sheet-body]')!.getBoundingClientRect()
      return { width: box.width, height: box.height, visible: box.top >= owner.top - 1 && box.bottom <= owner.bottom + 1 }
    }))
    expect(buttons).toHaveLength(5)
    for (const button of buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44)
      expect(button.height).toBeGreaterThanOrEqual(44)
      expect(button.visible).toBe(true)
    }
    await page.evaluate(() => { window.__mockHass!.calls.length = 0 })
    const box = await pad.getByRole('button', { name: 'Down', exact: true }).boundingBox()
    if (!box) throw new Error('Missing coordinate target')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => page.evaluate(() => window.__mockHass!.calls)).toEqual([
      expect.objectContaining({ domain: 'remote', service: 'send_command', target: MUSIC_ROOM_REMOTE_ENTITY_ID, serviceData: { command: 'DPAD_DOWN' } }),
    ])
    expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
    facts.pad = buttons
    facts.command = 'remote.send_command / DPAD_DOWN; exactly once, without auto-scroll'
  }
  return facts
}

async function soloTripSettingsFacts(root: Locator, state: string) {
  const facts = await root.evaluate((element) => {
    const scroller = element.querySelector<HTMLElement>('[data-page-scroller]')
    const rect = element.getBoundingClientRect()
    return {
      frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollOwner: scroller ? getComputedStyle(scroller).overflowY : null,
    }
  })
  expect(facts.pageOverflow).toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).toContain(facts.scrollOwner)
  const page = root.page()
  const toggle = root.locator('button[role="switch"][aria-label^="Solo Trip"]')
  const travelerButtons = root.getByRole('button', { name: /^(You|Steph)$/ })
  const sectionGrid = root.locator('[data-responsive-section-grid="true"]')
  await expect(sectionGrid).toHaveCount(1)
  await expect(sectionGrid.locator('[data-responsive-section-item="true"]')).toHaveCount(2)
  const sectionColumns = await sectionGrid.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    width: element.getBoundingClientRect().width,
  }))
  expect(sectionColumns.columns).toBe(sectionColumns.width >= 744 ? 2 : 1)
  await expect(root.getByText('Enable or disable Solo Trip mode for the house.', { exact: true })).toBeVisible()
  await expect(root.getByText('Select the user that will be away from home', { exact: true })).toBeVisible()
  await expect(toggle).toHaveCount(1)

  if (state === 'idle') {
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle).toBeDisabled()
    await expect(travelerButtons).toHaveCount(2)
    return { ...facts, state, toggle: 'disabled-off', travelers: 'interactive-none-selected' }
  }
  if (state === 'idle-selected') {
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle).toBeEnabled()
    await expect(root.getByRole('button', { name: 'You', exact: true })).toHaveAttribute('aria-pressed', 'true')
    return { ...facts, state, toggle: 'enabled-off', travelers: 'stephen-selected' }
  }
  if (state === 'modal') {
    const dialog = page.getByRole('dialog', { name: 'Schedule Solo Trip' })
    await expect(dialog).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(travelerButtons).toHaveCount(0)
    await expect(dialog.getByLabel('Departure Date')).toBeVisible()
    await expect(dialog.getByLabel('Return Time')).toBeVisible()
    return { ...facts, state, modal: true, toggle: 'off-while-pending' }
  }
  if (state === 'unavailable') {
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle).toBeDisabled()
    await expect(root.getByText('Solo Trip scheduling is unavailable. Complete Household Away setup, then try again.', { exact: true })).toBeVisible()
    await expect(travelerButtons).toHaveCount(2)
    return { ...facts, state, toggle: 'disabled-off', setupGuidance: true }
  }

  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(root.getByText('Away', { exact: true })).toBeVisible()
  await expect(root.getByText('Home', { exact: true })).toBeVisible()
  await expect(root.getByLabel('Departure Date')).toBeVisible()
  await expect(root.getByLabel('Return Time')).toBeVisible()
  await expect(travelerButtons).toHaveCount(0)
  const viewerState = state === 'active-home-viewer' ? 'home' : state === 'active-unknown-viewer' ? 'unknown' : 'traveler'
  const awayTraveler = root.locator(`article[aria-label="${viewerState === 'traveler' ? 'You' : 'Stephen'} Away"]`)
  const homeResident = root.locator(`article[aria-label="${viewerState === 'home' ? 'You' : 'Steph'} Home"]`)
  await expect(awayTraveler).toHaveAttribute('data-disabled', 'true')
  await expect(awayTraveler).toHaveAttribute('data-muted', 'false')
  await expect(awayTraveler).not.toHaveAttribute('aria-pressed')
  await expect(homeResident).toHaveAttribute('data-disabled', 'true')
  await expect(homeResident).toHaveAttribute('data-muted', 'true')
  await expect(homeResident).not.toHaveAttribute('aria-pressed')
  const travelerCards = await Promise.all([awayTraveler, homeResident].map((card) => card.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    filter: getComputedStyle(element).filter,
  }))))
  expect(travelerCards).toEqual([
    { backgroundColor: 'rgba(91, 141, 239, 0.6)', filter: 'saturate(0.45)' },
    { backgroundColor: 'rgba(255, 255, 255, 0.1)', filter: 'saturate(0.45)' },
  ])

  if (state === 'scheduled') {
    await expect(toggle).toBeEnabled()
    await expect(root.getByRole('heading', { name: 'Solo Trip Scheduled' })).toBeVisible()
    await expect(root.getByRole('button', { name: 'Change' })).toBeVisible()
    return { ...facts, state, toggle: 'enabled-on', returnEditor: 'available', travelerCards }
  }
  if (state === 'activating') {
    await expect(toggle).toBeEnabled()
    await expect(root.getByRole('heading', { name: 'Starting Solo Trip' })).toBeVisible()
    await expect(root.getByRole('button', { name: 'End Solo Trip Now' })).toHaveCount(0)
    return { ...facts, state, toggle: 'enabled-on', emergencyEnd: 'toggle-only', travelerCards }
  }
  if (state === 'active' || state === 'active-home-viewer' || state === 'active-unknown-viewer') {
    const status = root.getByRole('note', { name: 'Stephen Away' })
    const description = root.getByText('Enable or disable Solo Trip mode for the house.', { exact: true })
    await expect(toggle).toBeEnabled()
    const activeCopy = state === 'active'
      ? "While you are away from home and the Solo Trip setting is enabled in settings, Steph's controls and alarms will control the entire bed."
      : 'While Stephen is away from home and the Solo Trip setting is enabled in settings, your controls and alarms will control the entire bed.'
    await expect(status).toContainText(activeCopy)
    await expect(status).toHaveCount(1)
    await expect(status.getByRole('heading', { name: 'Stephen Away' })).toHaveCount(1)
    const statusElement = await status.elementHandle()
    if (!statusElement) throw new Error('Active Solo Trip notice is missing')
    const statusPlacement = await description.evaluate((descriptionElement, noticeElement) => ({
      beforeDescription: Boolean(noticeElement.compareDocumentPosition(descriptionElement) & Node.DOCUMENT_POSITION_FOLLOWING),
      sameSection: noticeElement.closest('section') === descriptionElement.closest('section'),
    }), statusElement)
    expect(statusPlacement).toEqual({ beforeDescription: true, sameSection: true })
    await expect(root.getByRole('button', { name: 'Change' })).toBeVisible()
    return { ...facts, state, activeCopy, status: 'confirmed active before description', statusPlacement, returnEditor: 'available', travelerCards, viewerState }
  }
  if (state === 'degraded') {
    await expect(toggle).toBeEnabled()
    await expect(root.getByRole('heading', { name: 'Solo Trip Degraded' })).toBeVisible()
    await expect(root.getByText('sleepypod_schedule_diverged', { exact: true })).toHaveCount(0)
    await expect(root.getByRole('button', { name: 'End Solo Trip Now' })).toHaveCount(0)
    return { ...facts, state, diagnosticsExposed: false, toggle: 'enabled-on', travelerCards }
  }
  if (state === 'ending') {
    await expect(toggle).toBeDisabled()
    await expect(root.getByRole('heading', { name: 'Ending Solo Trip' })).toBeVisible()
    return { ...facts, state, toggle: 'disabled-on', travelerCards }
  }
  await expect(toggle).toBeDisabled()
  await expect(root.getByRole('heading', { name: 'Solo Trip Needs Attention' })).toBeVisible()
  await expect(root.getByText('sleepypod_schedule_diverged', { exact: true })).toHaveCount(0)
  await expect(root.getByRole('button', { name: 'Keep Current Schedule' })).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Restore Saved Schedule' })).toBeEnabled()
  return { ...facts, state, diagnosticsExposed: false, resolutionActions: 2, toggle: 'disabled-on', travelerCards }
}

async function pageFacts(page: Page, back: boolean) {
  await waitForNavigation(page)
  const facts = await page.evaluate((route) => {
    const main = document.querySelector(`[data-route-path="${route}"]:not([aria-hidden="true"]) main`)!
    if (!main) throw new Error(`Missing active route main: ${route}`)
    const scroller = main.querySelector<HTMLElement>('[data-page-scroller]')!
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
    }
    const buttons = Array.from(document.querySelectorAll('[data-app-header] button, [data-adaptive-navigation] button, [data-floating-action-dock] button')).filter(visible)
    const overlaps = buttons.filter((button) => {
      const rect = button.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return rect.top >= 0 && rect.bottom <= innerHeight && !(hit === button || button.contains(hit))
    }).length
    return {
      heading: main.querySelector('h1')?.textContent,
      navigation: document.querySelector<HTMLElement>('[data-app-shell]')?.dataset.navigationLayout,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollOwner: getComputedStyle(scroller).overflowY,
      back: main.querySelectorAll('[data-app-header-back]').length,
      menu: main.querySelectorAll('button[aria-label="Open navigation menu"]').length,
      overlaps,
    }
  }, back ? 'living-room' : 'overview')
  expect(facts.heading).toBe(back ? 'Living Room' : 'Home')
  expect(facts.overflow).toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).toContain(facts.scrollOwner)
  expect(facts.overlaps).toBe(0)
  if (back) { expect(facts.back).toBe(1); expect(facts.menu).toBe(0) }
  return facts
}

for (const scenario of SCENARIO_IDS) {
  test(`layout contract: ${scenario}`, { annotation: { type: 'layout-scenario', description: scenario } }, async ({ page, browser, browserName, isMobile, hasTouch }, testInfo) => {
    test.setTimeout(scenario === 'chat' ? 480_000 : 240_000)
    const context = contextForProject(testInfo.project.name)
    const environment = runEnvironment()
    const obligations = environment
      ? environment.plan.obligations.filter((entry) => entry.scenario === scenario && entry.context === context)
      : obligationsFor([scenario], [context])
    expect(obligations.length, 'Required runtime loop is nonempty').toBeGreaterThan(0)
    await page.setViewportSize(layoutProfile(journey(scenario, context)[0]).viewport)
    const capabilities = await actualCapabilities(page, browserName, browser.version(), isMobile, hasTouch)
    if (scenario === 'wake-room') {
      for (const state of SURFACE_CONTRACTS[scenario].states) {
        await openWakeRoomState(page, state)
        for (const obligation of obligations.filter(entry => entry.state === state)) {
          await applyProfile(page, obligation.profile)
          const facts = await wakeRoomFacts(page, state)
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        }
      }
      return
    }
    if (scenario === 'form' && isMobile) await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
      const viewport = Object.assign(new EventTarget(), { layoutSynthetic: true, width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 })
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    })

    if (scenario === 'host') {
      for (const state of SURFACE_CONTRACTS.host.states) {
        const frame = await openHost(page, state)
        const origin = await frame.evaluate(() => performance.timeOrigin)
        for (const obligation of obligations.filter((entry) => entry.state === state)) {
          await applyHostProfile(page, frame, state, obligation.profile)
          await openQuickLinksTab(frame)
          const dialog = frame.getByRole('dialog')
          const facts = await modalFacts(dialog)
          expect(await frame.evaluate(() => performance.timeOrigin)).toBe(origin)
          await checkpoint(page, frame, testInfo, obligation, await actualCapabilities(frame, browserName, browser.version(), isMobile, hasTouch), {
            ...facts, host: `Actual ${state} bridge in a synthetic host, not deployed HA`,
            insetDelivery: 'outer document → product bridge → React document',
            event: 'resize without HA replacing the host element', retainedTimeOrigin: true,
          })
          await closeMounted(dialog)
        }
      }
      return
    }
    if (scenario === 'chat') {
      for (const state of SURFACE_CONTRACTS.chat.states) {
        const dialog = await openChatState(page, state)
        let firstFrame: Record<string, number> | undefined
        const selected = obligations.filter((entry) => entry.state === state)
        for (const obligation of selected) {
          await applyProfile(page, obligation.profile)
          const facts = await chatStateFacts(dialog, state)
          if (obligation.step === 0) firstFrame = facts.frame
          const stages = journey(scenario, context)
          if (obligation.step === stages.length - 1 && stages[0] === stages.at(-1)) {
            for (const key of ['x', 'y', 'width', 'height'] as const) {
              expect(Math.abs(firstFrame![key] - facts.frame[key]), 'Mounted Chat return geometry').toBeLessThanOrEqual(1)
            }
          }
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        }
        await closeMounted(dialog)
      }
      return
    }
    if (scenario === 'preload') {
      await page.goto('/index.html?path=overview')
      const cache = page.locator('[data-dashboard-preload-cache]')
      await expect(cache).toBeAttached()
      const facts = await cache.evaluate((element) => ({
        routes: element.querySelectorAll('[data-preload-route]').length,
        mediaElements: element.querySelectorAll('img,video,canvas').length,
        hidden: element.getAttribute('aria-hidden'),
        services: window.__mockHass?.calls.length,
        chatMessages: window.__mockHass?.chat.messages.length,
        chatSubscriptions: window.__mockHass?.chat.subscriptions(),
      }))
      expect(facts).toEqual({ routes: PRELOAD_ROUTES.length, mediaElements: 0, hidden: 'true', services: 0, chatMessages: 0, chatSubscriptions: 0 })
      await checkpoint(page, page, testInfo, obligations[0], capabilities, { ...facts, phase: 'Initial hydration; the inert cache is intentionally removed once the app is ready' })
      await waitForRoute(page, 'overview')
      return
    }
    if (scenario === 'navigation') {
      for (const state of SURFACE_CONTRACTS.navigation.states) {
        const route = state === 'home' ? 'overview' : 'living-room'
        await page.goto(`/index.html?path=${route}`)
        await waitForRoute(page, route)
        for (const obligation of obligations.filter((entry) => entry.state === state)) {
          await applyProfile(page, obligation.profile)
          const facts = await pageFacts(page, state === 'back-page')
          if (!hasTouch && state === 'home' && facts.navigation === 'rail') {
            const home = page.locator('[data-adaptive-navigation="rail"]').getByRole('button', { name: 'Home' })
            await home.focus()
            await expect(home).toBeFocused()
          }
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        }
        if (state === 'back-page') {
          await page.getByRole('button', { name: 'Go back' }).click()
          await waitForRoute(page, 'overview')
        }
      }
      return
    }
    if (scenario === 'solo-trip-settings') {
      for (const state of SURFACE_CONTRACTS[scenario].states) {
        const root = await openSurface(page, scenario, state)
        let firstFrame: Record<string, number> | undefined
        const selected = obligations.filter((entry) => entry.state === state)
        for (const obligation of selected) {
          await applyProfile(page, obligation.profile)
          const facts = await soloTripSettingsFacts(root, state)
          if (obligation.step === 0) firstFrame = facts.frame
          const stages = journey(scenario, context)
          if (obligation.step === stages.length - 1 && stages[0] === stages.at(-1)) {
            for (const key of ['x', 'y', 'width', 'height'] as const) {
              expect(Math.abs(firstFrame![key] - facts.frame[key]), 'Mounted Solo Trip settings return geometry').toBeLessThanOrEqual(1)
            }
          }
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        }
      }
      return
    }
    if (scenario === 'solo-trip-bed') {
      for (const state of SURFACE_CONTRACTS[scenario].states) {
        const dialog = await openSurface(page, scenario, state)
        if (!state.startsWith('editor')) assertDeclaredTabs(await dialog.getByRole('tab').evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '')),
        ['^Temperature$', '^Special Modes$', '^Alarms$', '^Status$'])
        let firstFrame: Record<string, number> | undefined
        const selected = obligations.filter((entry) => entry.state === state)
        for (const obligation of selected) {
          await applyProfile(page, obligation.profile)
          const facts = await stateFacts(page, dialog, scenario, state)
          if (obligation.step === 0) firstFrame = facts.frame as Record<string, number>
          const stages = journey(scenario, context)
          if (obligation.step === stages.length - 1 && stages[0] === stages.at(-1)) {
            const end = facts.frame as Record<string, number>
            for (const key of ['x', 'y', 'width', 'height'] as const) {
              expect(Math.abs(firstFrame![key] - end[key]), 'Mounted Solo Trip modal return geometry').toBeLessThanOrEqual(1)
            }
          }
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        }
        await closeMounted(dialog)
      }
      return
    }
    if (scenario === 'recipe-grocery') {
      for (const state of SURFACE_CONTRACTS[scenario].states) {
        for (const obligation of obligations.filter((entry) => entry.state === state)) {
          const dialog = await openSurface(page, scenario, state)
          await applyProfile(page, obligation.profile)
          let facts: Record<string, unknown>
          if (state === 'success') {
            facts = await stateFacts(page, dialog, scenario, 'ready')
            await enterState(dialog, scenario, state)
            facts.recipeGrocery = await recipeGroceryFacts(dialog, state)
          } else {
            await enterState(dialog, scenario, state)
            facts = await stateFacts(page, dialog, scenario, state)
          }
          await checkpoint(page, page, testInfo, obligation, capabilities, facts)
          await closeMounted(dialog)
        }
      }
      return
    }
    let dialog = await openSurface(page, scenario)
    const tabs = SURFACE_CONTRACTS[scenario].tabs
    if (tabs) assertDeclaredTabs(await dialog.getByRole('tab').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '')), tabs)
    for (const state of SURFACE_CONTRACTS[scenario].states) {
      const stateObligations = obligations.filter((entry) => entry.state === state)
      if (isWakeScenario(scenario)) {
        if (state !== SURFACE_CONTRACTS[scenario].states[0]) {
          await closeMounted(dialog)
          dialog = await openSurface(page, scenario)
        }
        const initialProfile = stateObligations[0]?.profile
        if (initialProfile) await applyProfile(page, initialProfile)
        await enterState(dialog, scenario, state)
      } else if (scenario === 'weather') await enterState(dialog, scenario, state)
      if (scenario === 'quick-links' && state === 'rooms') await dialog.getByRole('button', { name: 'Rooms', exact: true }).click()
      if (scenario === 'quick-links' && state === 'back') await dialog.getByRole('button', { name: 'Back', exact: true }).click()
      if (scenario === 'summary') await dialog.getByRole('tab', { name: state === 'overdue' ? /^Overdue Chores/ : state === 'upcoming' ? 'Upcoming Chores' : /^Expired Food/ }).click()
      let firstFrame: unknown
      for (const obligation of stateObligations) {
        await applyProfile(page, obligation.profile)
        try {
        const facts = await stateFacts(page, dialog, scenario, state)
        if (obligation.step === 0) firstFrame = facts.frame
        const stages = journey(scenario, context)
        if (obligation.step === stages.length - 1 && stages[0] === stages.at(-1)) {
          const start = firstFrame as Record<string, number>
          const end = facts.frame as Record<string, number>
          for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(start[key] - end[key]), 'Mounted return geometry').toBeLessThanOrEqual(1)
          facts.returnGeometry = 'unchanged within 1 CSS pixel'
        }
        if (scenario === 'form' && isMobile && obligation.profile === 'island-phone-landscape-left') {
          await dialog.getByRole('textbox').focus()
          await page.evaluate(() => {
            Object.assign(window.visualViewport!, { height: 263 })
            window.visualViewport!.dispatchEvent(new Event('resize'))
          })
          await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('130px')
          const close = await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox()
          expect(close!.y + close!.height).toBeLessThanOrEqual(263)
          facts.keyboard = { synthetic: true, touchPointsHint: 1, visibleHeight: 263, closeBottom: close!.y + close!.height }
          await applyProfile(page, obligation.profile)
          await dialog.getByRole('textbox').blur()
          await waitForModalReady(dialog)
        }
        await checkpoint(page, page, testInfo, obligation, capabilities, facts)
        } catch (error) {
          const failure = error instanceof Error ? error.message : String(error)
          const body = dialog.locator('[data-modal-sheet-body]')
          if (failure.includes('Intrinsic body measure') && await body.count()) {
            await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }))
          }
          const observed = await page.evaluate(() => {
            const modal = document.querySelector<HTMLElement>('[role="dialog"]')
            return { title: modal?.querySelector('h2')?.textContent, intent: modal?.dataset.modalGeometryIntent, presentation: modal?.dataset.modalPresentation }
          })
          await checkpoint(page, page, testInfo, obligation, capabilities, { failure, observed, capture: 'Failure diagnostic; intended-state acceptance is not proven' }, 'failed')
          expect.soft(false, `${obligation.id}: ${failure}`).toBe(true)
          if (await body.count()) await body.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
        }
      }
    }
    if (scenario === 'form') {
      await page.evaluate(() => window.__mockHass!.setCallServiceOutcome('todo', 'add_item', 'reject'))
      await dialog.getByRole('button', { name: 'Add Task', exact: true }).click()
      await expect(dialog).toContainText('Mock service rejection')
      await expect(dialog.getByRole('textbox')).toHaveValue('Layout validation draft')
    }
    await closeMounted(dialog)
  })
}
