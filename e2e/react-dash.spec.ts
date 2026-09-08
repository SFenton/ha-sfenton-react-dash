import { expect, test, type FrameLocator, type Locator, type Page } from './layout/fixture'
import { valueToThermostatPoint } from '../src/components/hass/thermostatDialGeometry'

const DIALOG_SQUARE_TILE_SIZE = 168
const MODAL_SQUARE_GRID_MAX_COLUMNS = 4

type FreeSleepAlarmSnapshot = {
  enabled: boolean
  time: string
}

type FreeSleepSchedulesSnapshot = Partial<Record<'left' | 'right', Partial<Record<string, { alarms?: FreeSleepAlarmSnapshot[] }>>>>

type SleepypodPromptFrameSample = {
  promptMounted: boolean
  rangeValue: string | null
  readout: string | null
  regionLabel: string | null
  sliderValue: string | null
}

declare global {
  interface Window {
    __vacationPickerCalls?: number
    __setDashboardFakeKeyboardHeight?: (height: number, notify?: boolean) => void
    __setDashboardFakeViewport?: (height: number, offsetTop?: number, notify?: boolean) => void
    __setInventoryFakeKeyboardHeight?: (height: number) => void
  }
}

async function openBedAlarmDialog(page: Page, bedButtonName: RegExp) {
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: bedButtonName }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Alarms', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Alarms' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Schedule Control' })).toHaveCount(0)
  return dialog
}

async function openRoomsFromQuickLinks(scope: FrameLocator | Page) {
  await scope.getByRole('button', { name: 'Quick Links' }).click()
  const quickLinksDialog = scope.getByRole('dialog', { name: 'Quick Links' })
  await quickLinksDialog.getByRole('button', { name: 'Rooms' }).click()
  const roomsDialog = scope.getByRole('dialog', { name: 'Rooms' })
  await expect(roomsDialog).toBeVisible()
  return roomsDialog
}

async function openAddAlarmForm(dialog: Locator, sideTitle: string) {
  const addAlarmButton = dialog.getByRole('button', { exact: true, name: 'Add Alarm' })
  await expect(addAlarmButton).toHaveCSS('background-color', 'rgba(0, 150, 136, 0.2)')
  await addAlarmButton.click()
  await expect(dialog).toHaveAccessibleName(`Add ${sideTitle} Alarm`)
  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBe(0)
  await expect(dialog.getByRole('button', { name: 'Back to alarms' })).toBeVisible()
  await expect(dialog.getByRole('button', { exact: true, name: 'Add Alarm' })).toBeEnabled()
  await expect(dialog.getByRole('switch')).toHaveCount(0)
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    await expect(dialog.getByRole('button', { exact: true, name: day })).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(dialog.getByRole('button', { exact: true, name: 'Sunday' })).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog.getByRole('button', { exact: true, name: 'Saturday' })).toHaveAttribute('aria-pressed', 'false')
  return dialog
}

async function freeSleepSchedules(page: Page) {
  return page.evaluate(() => (window as unknown as { __mockHass: { freeSleepSchedules: () => FreeSleepSchedulesSnapshot } }).__mockHass.freeSleepSchedules())
}

async function roomAccessServiceCalls(page: Page) {
  return page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script' && call.target === 'script.increment_room_access')
  ))
}

async function clearMockHassCalls(page: Page) {
  await page.evaluate(() => {
    const calls = (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
    calls.splice(0, calls.length)
  })
}

async function startSleepypodPromptFrameSampler(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as {
      __sleepypodPromptFrameSamples?: SleepypodPromptFrameSample[]
    }
    state.__sleepypodPromptFrameSamples = []
    let frameCount = 0
    let mountedFrameCount = 0

    const sample = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][data-surface="hass-popup"]')]
      const promptMounted = dialogs.length >= 2 && dialogs.at(-1)?.getAttribute('data-state') === 'open'
      const region = [...document.querySelectorAll<HTMLElement>('[role="region"]')]
        .find((element) => element.getAttribute('aria-label')?.startsWith("Stephen's Bed thermostat"))
      const slider = [...document.querySelectorAll<HTMLElement>('[role="slider"]')]
        .find((element) => element.getAttribute('aria-label') === "Stephen's Bed target level")
      const range = region?.querySelector<HTMLInputElement>('input[type="range"]')
      state.__sleepypodPromptFrameSamples?.push({
        promptMounted,
        rangeValue: range?.value ?? null,
        readout: region?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        regionLabel: region?.getAttribute('aria-label') ?? null,
        sliderValue: slider?.getAttribute('aria-valuenow') ?? null,
      })
      frameCount += 1
      if (promptMounted) mountedFrameCount += 1
      if (frameCount < 120 && mountedFrameCount < 5) requestAnimationFrame(sample)
    }

    requestAnimationFrame(sample)
  })
}

async function sleepypodPromptFrameSamples(page: Page) {
  return page.evaluate(() => (
    (window as unknown as { __sleepypodPromptFrameSamples?: SleepypodPromptFrameSample[] })
      .__sleepypodPromptFrameSamples ?? []
  ))
}

async function openThermostatControls(page: Page, tab: 'Automation' | 'Rooms' | 'Tracking' = 'Rooms') {
  const openerName = tab === 'Automation'
    ? 'Advanced Configuration'
    : tab === 'Tracking'
      ? 'Room Tracking'
      : 'Room Thermostats'
  await page.getByRole('button', { exact: true, name: openerName }).click()
  await expect(page.getByRole('dialog', { name: 'Thermostat · Advanced Controls' })).toBeVisible()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
  return dialog
}

async function everShelfInventoryCalls(page: Page) {
  return page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'evershelf' && call.service !== 'list_inventory')
  ))
}

async function expectFreeSleepAlarms(page: Page, side: 'left' | 'right', day: string, expected: FreeSleepAlarmSnapshot[]) {
  await expect.poll(async () => {
    const schedules = await freeSleepSchedules(page)
    return (schedules[side]?.[day]?.alarms ?? []).map((alarm) => ({ enabled: alarm.enabled, time: alarm.time }))
  }).toEqual(expected)
}

async function setMockFreeSleepWakeDayAlarms(page: Page, side: 'left' | 'right', wakeDay: string, alarms: FreeSleepAlarmSnapshot[]) {
  const days: string[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const scheduleDay = days[(days.indexOf(wakeDay) + days.length - 1) % days.length]
  await page.evaluate(({ alarms: nextAlarms, scheduleDay: targetDay, side: targetSide }) => {
    const mock = (window as unknown as {
      __mockHass: {
        freeSleepSchedules: () => FreeSleepSchedulesSnapshot
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      }
    }).__mockHass
    const schedules = mock.freeSleepSchedules()
    const sideSchedule = (schedules[targetSide] ?? {}) as Record<string, Record<string, unknown>>
    const daySchedule = sideSchedule[targetDay] ?? {}
    mock.setEntityAttribute('sensor.nightcanvasrestful_schedules', targetSide, {
      ...sideSchedule,
      [targetDay]: {
        ...daySchedule,
        alarm: nextAlarms[0],
        alarms: nextAlarms,
      },
    })
  }, { alarms, scheduleDay, side })
}

async function expectInlineToggleBeforeChevron(toggle: Locator) {
  const rowShell = toggle.locator('xpath=ancestor::*[@data-schedule-list-row][1]')
  const controlSlot = rowShell.locator('[data-schedule-list-row-control]')
  const chevron = rowShell.locator('[data-schedule-list-row-chevron]')
  await expect(controlSlot).toHaveCount(1)
  await expect(chevron).toHaveCount(1)
  const toggleBox = await toggle.boundingBox()
  const controlBox = await controlSlot.boundingBox()
  const chevronBox = await chevron.boundingBox()
  if (!toggleBox || !controlBox || !chevronBox) throw new Error('Inline alarm toggle geometry is unavailable')
  expect(Math.round(toggleBox.width)).toBe(56)
  expect(Math.round(toggleBox.height)).toBe(34)
  expect(controlBox.x + controlBox.width).toBeLessThan(chevronBox.x)
  expect(Math.abs((controlBox.y + controlBox.height / 2) - (chevronBox.y + chevronBox.height / 2))).toBeLessThanOrEqual(2)
}

async function expectToggleChrome(toggle: Locator) {
  await expect(toggle).toHaveCSS('box-shadow', 'none')
  await expect(toggle).toHaveCSS('outline-style', 'none')
  await expect.poll(() => toggle.evaluate((element) => getComputedStyle(element).getPropertyValue('--ha-control-switch-padding').trim())).toBe('4px')
}

async function expectSharedDesktopFrame(dialog: Locator) {
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
  await expect.poll(() => dialog.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const width = Math.min(1100, innerWidth - 64)
    const height = Math.min(760, innerHeight - 64)
    return Math.max(
      Math.abs(box.width - width),
      Math.abs(box.height - height),
      Math.abs(box.x - (innerWidth - width) / 2),
      Math.abs(box.y - (innerHeight - height) / 2),
    )
  })).toBeLessThanOrEqual(1)
}

async function expectDesktopSquareGrid(dialog: Locator, sectionLabel: string) {
  const section = dialog.getByRole('region', { name: sectionLabel })
  await expect(section).toBeVisible()
  const openerCards = section.getByRole('button', { name: /^Open / })
  const cards = await openerCards.count() > 0 ? openerCards : section.getByRole('article')
  const cardCount = await cards.count()
  expect(cardCount).toBeGreaterThan(0)

  await expect.poll(async () => {
    return cards.evaluateAll((elements, expectedCardSize) => {
      const rects = elements.map((element) => element.getBoundingClientRect())
      return {
        allFixedHeight: rects.every((rect) => Math.round(rect.height) === expectedCardSize),
        allFixedWidth: rects.every((rect) => Math.round(rect.width) === expectedCardSize),
        cardCount: rects.length,
        squareCards: rects.every((rect) => Math.round(rect.width) === Math.round(rect.height)),
      }
    }, DIALOG_SQUARE_TILE_SIZE)
  }).toMatchObject({
    allFixedHeight: true,
    allFixedWidth: true,
    cardCount,
    squareCards: true,
  })

  await expectSharedDesktopFrame(dialog)
  const dialogBox = await dialog.boundingBox()
  const sectionBox = await section.boundingBox()
  expect(sectionBox?.x ?? 0).toBeGreaterThanOrEqual((dialogBox?.x ?? 0) + 23)
  expect((sectionBox?.x ?? 0) + (sectionBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) - 23)
  return section
}

async function installFakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const fakeVisualViewport = new EventTarget() as EventTarget & {
      height: number
      offsetTop: number
      pageLeft: number
      pageTop: number
      scale: number
      width: number
    }
    fakeVisualViewport.width = window.innerWidth
    fakeVisualViewport.height = window.innerHeight
    fakeVisualViewport.offsetTop = 0
    fakeVisualViewport.pageLeft = 0
    fakeVisualViewport.pageTop = 0
    fakeVisualViewport.scale = 1
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fakeVisualViewport })
    window.__setDashboardFakeViewport = (height: number, offsetTop = 0, notify = true) => {
      fakeVisualViewport.width = window.innerWidth
      fakeVisualViewport.height = height
      fakeVisualViewport.offsetTop = offsetTop
      if (!notify) return
      fakeVisualViewport.dispatchEvent(new Event('resize'))
      fakeVisualViewport.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
    }
    window.__setDashboardFakeKeyboardHeight = (height: number, notify = true) => {
      window.__setDashboardFakeViewport?.(height, 0, notify)
    }
  })
}

async function expectDesktopAdminSquareGrid(dialog: Locator, gridLabel: string) {
  const grid = dialog.getByRole('group', { name: gridLabel })
  await expect(grid).toBeVisible()
  const cardCount = await grid.getByRole('button').count()
  const expectedColumns = Math.max(1, Math.min(MODAL_SQUARE_GRID_MAX_COLUMNS, Math.ceil(Math.sqrt(cardCount))))
  const expectedRows = Math.ceil(cardCount / expectedColumns)

  await expect.poll(async () => {
    return grid.evaluate((gridElement) => {
      const cards = Array.from(gridElement.querySelectorAll<HTMLElement>(
        ':scope > button, :scope > article, :scope > [data-modal-detail-trigger] > button, :scope > [data-modal-detail-trigger] > article',
      ))
      const rects = cards.map((card) => card.getBoundingClientRect())
      const firstCardRect = rects[0]
      const columns = new Set(rects.map((rect) => Math.round(rect.left))).size
      const rows = new Set(rects.map((rect) => Math.round(rect.top))).size
      return {
        cardCount: gridElement.children.length,
        cardHeight: Math.round(firstCardRect?.height ?? 0),
        cardWidth: Math.round(firstCardRect?.width ?? 0),
        columns,
        fitsAllCards: columns * rows >= gridElement.children.length,
        rows,
        scrollsHorizontally: gridElement.scrollWidth > gridElement.clientWidth + 1,
        squareCard: Math.round(firstCardRect?.width ?? 0) === Math.round(firstCardRect?.height ?? 0),
      }
    })
  }).toMatchObject({
    cardCount,
    cardHeight: DIALOG_SQUARE_TILE_SIZE,
    cardWidth: DIALOG_SQUARE_TILE_SIZE,
    columns: expectedColumns,
    fitsAllCards: true,
    rows: expectedRows,
    scrollsHorizontally: false,
    squareCard: true,
  })

  await expectSharedDesktopFrame(dialog)
  const dialogBox = await dialog.boundingBox()
  const gridBox = await grid.boundingBox()
  expect(gridBox?.x ?? 0).toBeGreaterThanOrEqual((dialogBox?.x ?? 0) + 23)
  expect((gridBox?.x ?? 0) + (gridBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) - 23)
  return grid
}

async function clickWithPointerJitter(page: Page, target: Locator) {
  const box = await target.boundingBox()
  if (!box) throw new Error('Target was not measurable')
  const clickX = box.x + box.width / 2
  const clickY = box.y + box.height / 2
  await page.mouse.move(clickX, clickY)
  await page.mouse.down()
  await page.mouse.move(clickX, clickY + 4)
  await page.mouse.up()
}

async function swipeHorizontallyWithTouch(page: Page, startX: number, endX: number, y: number) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x: startX, y }] })
  for (let step = 1; step <= 8; step += 1) {
    const x = startX + ((endX - startX) * step) / 8
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x, y }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function expectRightChevron(opener: Locator) {
  const chevron = opener.locator('[data-modal-disclosure="right-chevron"]')
  await expect(chevron).toHaveCount(1)
  await expectVerticallyCenteredChevrons(chevron)
}

async function expectNoChevron(opener: Locator) {
  await expect(opener.locator('[data-modal-disclosure]')).toHaveCount(0)
}

test('cold Recipes refresh keeps the full app gate until the initial catalog resolves', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/recipes?__mockRecipeQueryDelayMs=3000')

  const appLoader = page.getByRole('status', { name: 'Loading dashboard' })
  const recipesHeader = page.getByRole('button', { name: 'Go back' })
  await expect(appLoader).toBeVisible()
  const preloadCache = page.locator('[data-dashboard-preload-cache="true"]')
  await expect(preloadCache).toBeAttached()
  await expect(preloadCache.locator('[data-preload-route="recipes"] [data-preload-geometry="route"]')).toBeAttached()
  await expect(preloadCache.locator('img, video, canvas')).toHaveCount(0)
  await expect(preloadCache).toHaveCSS('opacity', '0')
  await expect(recipesHeader).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Loading Recipes', exact: true })).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Loading recipes', exact: true })).toHaveCount(0)

  await page.waitForTimeout(1_800)
  await expect(appLoader).toBeVisible()
  await expect(recipesHeader).toHaveCount(0)
  await expect(page.locator('[data-recipe-card]')).toHaveCount(0)

  await expect(appLoader).toHaveAttribute('data-state', 'exiting', { timeout: 4_000 })
  await expect(appLoader).not.toBeVisible()
  await expect(recipesHeader).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading Recipes', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(50)
})

test('tall desktop Recipes primes enough rows for automatic infinite scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 })
  await page.goto('/at-a-glance/recipes?__mockRecipeTotal=350')

  const appLoader = page.getByRole('status', { name: 'Loading dashboard' })
  await expect(appLoader).toBeVisible()
  await expect(appLoader).not.toBeVisible({ timeout: 8_000 })
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(100)

  const pageScroller = page.locator('[class*="_scroller_"]').first()
  const preloadDistance = await pageScroller.evaluate((root) => {
    const sentinel = document.querySelector<HTMLElement>('[data-recipe-grid-sentinel="true"]')
    if (!sentinel) return -1
    return Math.round(sentinel.getBoundingClientRect().top - root.getBoundingClientRect().bottom)
  })
  expect(preloadDistance).toBeGreaterThan(240)

  const initialCursors = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'evershelf' && call.service === 'recipe_query')
      .map((call) => (call.serviceData as { cursor?: string } | undefined)?.cursor ?? null)
  ))
  expect(initialCursors.filter((cursor) => cursor === null).length).toBeGreaterThanOrEqual(1)
  expect(initialCursors.filter((cursor) => cursor === '50')).toHaveLength(1)

  await pageScroller.evaluate((element) => {
    element.scrollTo({ behavior: 'auto', top: element.scrollHeight })
  })
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(150)
  await page.waitForTimeout(1_000)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(150)
  await expect(page.getByRole('button', { name: 'Load More' })).toBeVisible()

  await pageScroller.evaluate((element) => {
    element.scrollTo({ behavior: 'auto', top: 0 })
  })
  await pageScroller.evaluate((element) => {
    element.scrollTo({ behavior: 'auto', top: element.scrollHeight })
  })
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(200)
  await page.waitForTimeout(1_000)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(200)
})

test('mobile suggested recipe opens the shared external-only detail sheet and keeps close content mounted', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/food?__mockRecipeDetailDelayMs=350')
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })

  const recipeButton = page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  })
  await recipeButton.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleName(
    'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  )
  await expect(dialog.getByRole('status', { name: 'Loading recipe details' })).toBeVisible()
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Yield Serves 4' })).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Freshness Current Aug 7, 2026' })).toHaveAttribute('data-tone', 'ok')
  await expect(dialog.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer')
  await expect(dialog.getByRole('heading', { name: 'Additional Equipment' })).toBeVisible()
  await expect(dialog.getByText(/Required Equipment/i)).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'Open in Cookidoo' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add to My Week' })).toBeVisible()
  await clearMockHassCalls(page)
  await dialog.getByRole('button', { name: 'Add to My Week' }).click()
  await expect(dialog.getByRole('heading', { name: 'Add to My Week' })).toBeVisible()
  const plannerDate = dialog.getByLabel('Cookidoo My Week date')
  await expect(plannerDate).toHaveAttribute('min', '2026-08-12')
  await expect(plannerDate).toHaveAttribute('max', '2027-08-12')
  await plannerDate.fill('2026-08-20')
  await dialog.getByRole('button', { name: 'Add to My Week' }).click()
  await expect(dialog.getByText('Recipe added to Cookidoo My Week.')).toBeVisible()
  const plannerCalls = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'evershelf' && call.service === 'recipe_planner_add')
  ))
  expect(plannerCalls).toHaveLength(1)
  expect(plannerCalls[0]).toMatchObject({
    serviceData: {
      recipe_id: 1,
      date: '2026-08-20',
      provider_action_token: 'b'.repeat(64),
    },
  })
  expect(plannerCalls[0].serviceData).not.toHaveProperty('external_id')
  await dialog.getByRole('button', { name: 'Back to recipe' }).click()
  await expect(dialog.getByRole('heading', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  })).toBeVisible()
  const navigation = dialog.locator('[data-modal-sheet-navigation="true"]')
  const tabList = navigation.getByRole('tablist', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables sections',
  })
  await expect(tabList).toBeVisible()
  const tabs = tabList.getByRole('tab')
  await expect(tabs).toHaveCount(3)
  expect(await tabs.evaluateAll((items) => items.map((item) => (item as HTMLElement).innerText))).toEqual(['', '', ''])
  expect(await tabs.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual([
    'General',
    'Ingredients',
    'Instructions',
  ])
  const anchoredFooter = await Promise.all([dialog.boundingBox(), navigation.boundingBox()])
  expect(Math.abs(
    ((anchoredFooter[1]?.y ?? 0) + (anchoredFooter[1]?.height ?? 0))
      - ((anchoredFooter[0]?.y ?? 0) + (anchoredFooter[0]?.height ?? 0)),
  )).toBeLessThanOrEqual(1)

  await dialog.getByRole('tab', { name: 'Ingredients' }).click()
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Section 1' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Section 2' })).toBeVisible()
  await expect(dialog.getByText('Canned tomatoes · 1 can', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Canned tomatoes · 1 can: Missing from inventory/ })).toHaveAttribute('data-status', 'unchecked')
  await expect(dialog.getByRole('button', { name: /Long-grain rice · 2 cups: Exact inventory match/ })).toHaveAttribute('data-status', 'checked')
  const uncertainIngredient = dialog.getByRole('button', {
    name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
  })
  await expect(uncertainIngredient).toHaveAttribute('data-status', 'unchecked')
  await expect(dialog.getByText('Optional', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Source: diced tomatoes, drained')).toBeVisible()
  await expect(dialog.getByText('Matched as Italian parsley')).toBeVisible()
  const modalBody = dialog.locator('[data-modal-sheet-body="true"]')
  const footerTopBeforeScroll = await navigation.evaluate((element) => element.getBoundingClientRect().top)
  await modalBody.evaluate((element) => element.scrollTo({ behavior: 'auto', top: element.scrollHeight }))
  await expect.poll(() => modalBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => navigation.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(
    Math.round(footerTopBeforeScroll),
  )

  await clearMockHassCalls(page)
  await uncertainIngredient.click()
  const inventorySearch = dialog.getByRole('searchbox', { name: 'Search inventory products' })
  await expect(inventorySearch).toBeVisible()
  const pickerTabList = dialog.getByRole('tablist', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables sections',
  })
  const [searchBox, pickerTabsBox] = await Promise.all([
    inventorySearch.locator('xpath=../..').boundingBox(),
    pickerTabList.boundingBox(),
  ])
  expect((searchBox?.y ?? 0) + (searchBox?.height ?? 0)).toBeLessThanOrEqual((pickerTabsBox?.y ?? 0) + 1)
  await inventorySearch.fill('beans')
  const product = dialog.getByRole('button', { name: /Canned Beans.*in inventory/ })
  await expect(product).toBeVisible()
  await expect(product).toHaveAttribute('data-product-id', '1002')
  await product.click()
  await expect(dialog.getByText('Product: Canned Beans')).toBeVisible()
  await expect(dialog.getByRole('button', {
    name: /Fresh herbs: Inventory match uncertain.*Activate to mark missing/,
  })).toHaveAttribute('data-status', 'checked')
  const decisionCalls = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'evershelf' && call.service === 'recipe_ingredient_decision')
  ))
  expect(decisionCalls).toHaveLength(1)
  expect(decisionCalls[0]).toMatchObject({
    serviceData: {
      action: 'select_inventory_product',
      selected_product_id: 1002,
    },
  })

  await dialog.getByRole('tab', { name: 'Instructions' }).click()
  await expect(dialog.getByRole('tabpanel', { name: 'Instructions' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Instructions are on Cookidoo' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Open in Cookidoo' })).toHaveAttribute(
    'href',
    'https://cookidoo.example.test/recipes/mock-1',
  )
  await expect(dialog.locator('ol')).toHaveCount(0)
  await expect(dialog.getByText(/Prohibited Cookidoo/)).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-closing', 'true')
  await expect(dialog.getByRole('link', { name: 'Open in Cookidoo' })).toBeAttached()
  await expect(dialog).not.toBeVisible({ timeout: 1_200 })
  await expect(recipeButton).toBeFocused()
})

test('recipe detail never renders a high-confidence taxonomy-rule closest match', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/food?__mockRecipeClosestMatchSource=taxonomy_rule')
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })

  await page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
  })
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  await dialog.getByRole('tab', { name: 'Ingredients' }).click()
  await expect(dialog.getByRole('button', { name: /Fresh herbs: Inventory match uncertain/ })).toBeVisible()
  await expect(dialog.getByText(/^Matched as /)).toHaveCount(0)
})

test('desktop browse recipe navigates all detail tabs and submits one missing-only grocery service call', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/at-a-glance/recipes')
  await expect(page.getByRole('button', { name: 'Open Catalog Recipe 1 recipe details' })).toBeVisible({ timeout: 12_000 })
  await clearMockHassCalls(page)

  await page.getByRole('button', { name: 'Open Catalog Recipe 1 recipe details' }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Catalog Recipe 1' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Makes 2 bowls')).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Yield Makes 2 bowls' })).toBeVisible()
  await expectSharedDesktopFrame(dialog)
  const dialogBox = await dialog.boundingBox()
  expect(Math.round((await dialog.locator('[data-modal-content-measure="true"]').boundingBox())?.width ?? 0)).toBe(670)
  const navigation = dialog.locator('[data-modal-sheet-navigation="true"]')
  const footerBox = await navigation.boundingBox()
  expect(Math.abs(
    ((footerBox?.y ?? 0) + (footerBox?.height ?? 0))
      - ((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)),
  )).toBeLessThanOrEqual(1)

  await dialog.getByRole('tab', { name: 'Ingredients' }).click()
  await expect(dialog.getByRole('tabpanel', { name: 'Ingredients' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Bowl Ingredients' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Finishing Ingredients' })).toBeVisible()
  await expect(dialog.getByText('Canned tomatoes · 1 can', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' }).click()
  await expect(dialog.getByText(/EverShelf: 2 added\./)).toBeVisible()

  const groceryCalls = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'evershelf' && call.service === 'recipe_grocery_add')
  ))
  expect(groceryCalls).toHaveLength(1)
  expect(groceryCalls[0]).toMatchObject({
    returnResponse: true,
    serviceData: {
      recipe_id: 1000,
      selections: [
        { key: 'ri:0:0000000000000001', position: 0 },
        { key: 'ri:5:0000000000000006', position: 5 },
      ],
      todo_entity_id: 'todo.shopping_list',
    },
  })
  expect((groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key).toMatch(
    /^[A-Za-z0-9._:-]{1,128}$/,
  )

  await dialog.getByRole('tab', { name: 'Instructions' }).click()
  const instructionsPanel = dialog.getByRole('tabpanel', { name: 'Instructions' })
  await expect(instructionsPanel).toBeVisible()
  await expect(instructionsPanel.getByRole('heading', { name: 'Prepare' })).toBeVisible()
  await expect(instructionsPanel.getByRole('heading', { name: 'Serve' })).toBeVisible()
  await expect(dialog.getByText('Combine the prepared ingredients in a large bowl.')).toBeVisible()
  await expect(dialog.getByText('Divide into bowls and serve.')).toBeVisible()
  await expect(instructionsPanel.getByText('1.', { exact: true })).toBeVisible()
  await expect(instructionsPanel.getByText('2.', { exact: true })).toBeVisible()
  await expect(instructionsPanel.getByText('3.', { exact: true })).toBeVisible()
  await expect(instructionsPanel.getByRole('listitem')).toHaveCount(3)
  await expect(instructionsPanel.getByRole('button')).toHaveCount(0)
  await expect(instructionsPanel.getByRole('checkbox')).toHaveCount(0)
  await expect(instructionsPanel.locator('[aria-pressed]')).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'Open in Cookidoo' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible({ timeout: 1_200 })
  await expect(page.getByRole('button', { name: 'Open Catalog Recipe 1 recipe details' })).toBeFocused()
})

test('recipe grocery empty and uncertain-only states use distinct reachable copy', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })

  for (const state of [
    {
      query: 'uncertain-only',
      message: "EverShelf can't yet tell which of these 2 ingredients you're missing.",
    },
    {
      query: 'none',
      message: 'No missing ingredients to add.',
    },
  ]) {
    await page.goto(`/at-a-glance/food?__mockRecipeGroceryState=${state.query}`)
    await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })
    await page.getByRole('button', {
      name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
    }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
    })
    await expect(dialog.getByText('Serves 4')).toBeVisible()
    await dialog.getByRole('tab', { name: 'Ingredients' }).click()
    await expect(dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })).toBeDisabled()
    await expect(dialog.getByText(state.message)).toBeVisible()
  }
})

test('Food & Recipes hub and recipe browse use approved 393px mobile geometry', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/food')

  const foodHubLoader = page.getByRole('status', { name: 'Loading Food & Recipes' })
  await expect(foodHubLoader).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('[data-content-visible="false"]').last()).toBeAttached()
  const loaderBox = await foodHubLoader.boundingBox()
  const viewport = page.viewportSize()
  const loaderCenter = (loaderBox?.y ?? 0) + ((loaderBox?.height ?? 0) / 2)
  expect(Math.abs(loaderCenter - ((viewport?.height ?? 0) / 2))).toBeLessThanOrEqual(1)
  await expect(foodHubLoader).not.toBeVisible({ timeout: 12_000 })
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Suggested Recipes' })).toBeVisible()
  const carousel = page.getByRole('region', { name: 'Suggested recipes' })
  await expect(carousel).toBeVisible()
  await expect(carousel.locator('[data-carousel-page]')).toHaveCount(5)
  await expect(carousel.locator('[data-carousel-card]')).toHaveCount(30)
  await expect(page.getByRole('group', { name: 'Suggested recipes pages' }).getByRole('button')).toHaveCount(5)

  const firstPage = carousel.locator('[data-carousel-page="1"]')
  await expect.poll(async () => firstPage.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const track = element.parentElement?.getBoundingClientRect()
    return {
      cardCount: element.querySelectorAll('[data-carousel-card]').length,
      pageWidth: Math.round(rect.width),
      trackWidth: Math.round(track?.width ?? 0),
    }
  })).toMatchObject({
    cardCount: 6,
    pageWidth: 393,
    trackWidth: 393,
  })
  await expect.poll(async () => carousel.evaluate((element) => {
    const trackRect = element.getBoundingClientRect()
    const secondPage = element.querySelector('[data-carousel-page="2"]')
    const secondPageRect = secondPage?.getBoundingClientRect()
    return Math.round(Math.max(0, trackRect.right - (secondPageRect?.left ?? trackRect.right)))
  })).toBe(0)
  const dotButtons = page.getByRole('group', { name: 'Suggested recipes pages' }).getByRole('button')
  const dotCenters = await dotButtons.evaluateAll((buttons) => buttons.slice(0, 2).map((button) => {
    const rect = button.getBoundingClientRect()
    return rect.x + (rect.width / 2)
  }))
  expect(Math.round(dotCenters[1] - dotCenters[0])).toBeLessThanOrEqual(32)
  const longTitle = firstPage.getByText('Suggested Citrus Pantry Bowl with Roasted Garden Vegetables')
  await expect(longTitle).toBeVisible()
  await expect(firstPage.locator('img')).toHaveCount(6)
  await expect.poll(async () => longTitle.evaluate((element) => {
    const titleRect = element.getBoundingClientRect()
    const cardRect = element.closest('[data-image-card]')?.getBoundingClientRect()
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    return Boolean(
      cardRect
      && titleRect.left >= cardRect.left
      && titleRect.right <= cardRect.right
      && titleRect.bottom <= cardRect.bottom
      && titleRect.height <= (lineHeight * 2) + 1,
    )
  })).toBe(true)
  const pageScroller = page.locator('[class*="_scroller_"]').first()
  const initialScrollTop = await pageScroller.evaluate((element) => element.scrollTop)
  const carouselBox = await carousel.boundingBox()
  const swipeY = (carouselBox?.y ?? 144) + Math.min(180, (carouselBox?.height ?? 360) / 2)
  await swipeHorizontallyWithTouch(page, 90, 300, swipeY)
  await expect(page.getByRole('button', { name: 'Go to page 5' })).toHaveAttribute('aria-current', 'page')
  await swipeHorizontallyWithTouch(page, 300, 90, swipeY)
  await expect(page.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page')
  const page2Dot = page.getByRole('button', { name: 'Go to page 2' })
  const page3Dot = page.getByRole('button', { name: 'Go to page 3' })
  await page.evaluate(async () => {
    const probeWindow = window as typeof window & {
      __carouselDotResizeProbe?: {
        count: number
        observers: ResizeObserver[]
      }
    }
    const probe = { count: 0, observers: [] as ResizeObserver[] }
    for (const dot of document.querySelectorAll('[aria-label="Suggested recipes pages"] button span')) {
      const observer = new ResizeObserver((entries) => {
        probe.count += entries.length
      })
      observer.observe(dot)
      probe.observers.push(observer)
    }
    probeWindow.__carouselDotResizeProbe = probe
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    probe.count = 0
  })
  await page2Dot.click()
  await page3Dot.click()
  await expect(page2Dot).not.toBeFocused()
  await expect.poll(() => page2Dot.evaluate((button) => {
    const dot = button.querySelector('span')
    const before = dot ? getComputedStyle(dot, '::before') : null
    const after = dot ? getComputedStyle(dot, '::after') : null
    return {
      afterVisibility: after?.visibility,
      beforeVisibility: before?.visibility,
      beforeWidth: before?.width,
      boxShadow: getComputedStyle(button).boxShadow,
      dotWidth: Math.round(dot?.getBoundingClientRect().width ?? 0),
    }
  })).toEqual({
    afterVisibility: 'hidden',
    beforeVisibility: 'visible',
    beforeWidth: '7px',
    boxShadow: 'none',
    dotWidth: 18,
  })
  expect(await page.evaluate(() => (
    (window as typeof window & {
      __carouselDotResizeProbe?: { count: number }
    }).__carouselDotResizeProbe?.count ?? -1
  ))).toBe(0)
  await page.evaluate(() => {
    const probeWindow = window as typeof window & {
      __carouselDotResizeProbe?: { observers: ResizeObserver[] }
    }
    probeWindow.__carouselDotResizeProbe?.observers.forEach((observer) => observer.disconnect())
    delete probeWindow.__carouselDotResizeProbe
  })
  await expect(page3Dot).toHaveAttribute('aria-current', 'page')
  expect(await pageScroller.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)

  const allRecipes = page.getByRole('button', { exact: true, name: 'All Recipes' })
  await expect(allRecipes).toBeVisible()
  const allFood = page.getByRole('button', { name: /^All Food / })
  const scanItem = page.getByRole('button', { name: 'Scan Item' })
  const allRecipesBox = await allRecipes.boundingBox()
  const allFoodBox = await allFood.boundingBox()
  const scanItemBox = await scanItem.boundingBox()
  expect(Math.round(allRecipesBox?.height ?? 0)).toBe(Math.round(allFoodBox?.height ?? 0))
  expect((allRecipesBox?.y ?? 0) + (allRecipesBox?.height ?? 0)).toBeLessThanOrEqual(scanItemBox?.y ?? 0)
  await page.evaluate(() => {
    (window as unknown as {
      __mockHass: { setRecipeQueryDelay: (delayMs: number) => void }
    }).__mockHass.setRecipeQueryDelay(1_600)
  })
  await allRecipes.click()
  await expect(page.getByRole('heading', { name: 'Recipes', exact: true })).toBeVisible()
  const recipesLoader = page.getByRole('status', { name: 'Loading Recipes', exact: true })
  await expect(recipesLoader).toBeVisible()
  await expect(page.locator('[data-content-visible="false"]').last()).toBeAttached()
  await expect(page.locator('[data-recipe-grid="true"]')).toHaveCount(0)
  await expect(page.getByText('No Recipes Found')).toHaveCount(0)
  await expect.poll(async () => {
    const recipesLoaderBox = await recipesLoader.boundingBox()
    const recipesViewport = page.viewportSize()
    const recipesLoaderCenter = (recipesLoaderBox?.y ?? 0) + ((recipesLoaderBox?.height ?? 0) / 2)
    return Math.abs(recipesLoaderCenter - ((recipesViewport?.height ?? 0) / 2))
  }).toBeLessThanOrEqual(1)
  await expect(recipesLoader).toHaveAttribute('data-state', 'exiting', { timeout: 4_000 })
  await expect(recipesLoader).not.toBeVisible()
  await expect(page.locator('[data-content-visible="true"]').last()).toBeAttached()
  await expect(page.getByRole('button', { name: 'Search recipes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sort' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Scan Item' })).toHaveCount(0)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(50)
  const floatingDockBox = await page.locator('[data-floating-action-dock="true"]').boundingBox()
  const collapsedSearchBox = await page.getByRole('button', { name: 'Search recipes' }).boundingBox()
  expect(Math.round(collapsedSearchBox?.x ?? 0)).toBe(Math.round(floatingDockBox?.x ?? 0))
  expect(Math.round(collapsedSearchBox?.width ?? 0)).toBeGreaterThanOrEqual(160)
  await expect(page.getByRole('button', { name: 'Search recipes' })).toHaveCSS('background-color', 'rgba(18, 24, 38, 0.96)')
  await expect(page.getByRole('button', { name: 'Search recipes' })).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.16)')
  await page.evaluate(() => {
    (window as unknown as {
      __mockHass: { setRecipeQueryDelay: (delayMs: number) => void }
    }).__mockHass.setRecipeQueryDelay(0)
  })
  await page.getByRole('button', { name: 'Load More' }).scrollIntoViewIfNeeded()
  const nextPageSpinner = page.getByRole('status', { name: 'Loading more recipes' })
  await expect(nextPageSpinner).toBeVisible()
  const spinnerBox = await nextPageSpinner.boundingBox()
  const searchBox = await page.getByRole('button', { name: 'Search recipes' }).boundingBox()
  expect((spinnerBox?.y ?? 0) + (spinnerBox?.height ?? 0)).toBeLessThanOrEqual(searchBox?.y ?? 0)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(100)
  await page.getByRole('button', { name: 'Sort' }).click()
  const sortDialog = page.getByRole('dialog', { name: 'Sort Recipes' })
  await sortDialog.getByRole('radio', { name: /Expiring Soon/i }).click()
  await sortDialog.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(() => pageScroller.evaluate((element) => Math.round(element.scrollTop))).toBe(0)
  const criteriaSpinner = page.getByRole('status', { name: 'Loading recipes' })
  await expect(criteriaSpinner).toBeVisible()
  const criteriaSpinnerBox = await criteriaSpinner.boundingBox()
  const scrollerBox = await pageScroller.boundingBox()
  expect((criteriaSpinnerBox?.y ?? 0) + ((criteriaSpinnerBox?.height ?? 0) / 2)).toBeGreaterThanOrEqual(scrollerBox?.y ?? 0)
  expect((criteriaSpinnerBox?.y ?? 0) + ((criteriaSpinnerBox?.height ?? 0) / 2)).toBeLessThanOrEqual(searchBox?.y ?? 0)
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(50)

  const firstRecipe = page.locator('[data-recipe-card]').first()
  await expect(firstRecipe).toHaveCSS('cursor', 'default')
  const firstRecipeButton = firstRecipe.getByRole('button', { name: /Open Catalog Recipe 1 recipe details/ })
  await expect(firstRecipeButton).toHaveCount(1)
  await expect(firstRecipeButton).toHaveCSS('transform', 'none')
  await expect(firstRecipeButton).toHaveCSS('transition-duration', '0s')
  const sortAction = page.getByRole('button', { name: 'Sort' })
  await sortAction.focus()
  await expect.poll(() => sortAction.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
  await page.getByRole('button', { name: 'Search recipes' }).click()
  const recipeSearchInput = page.getByRole('searchbox', { name: 'Search recipes' })
  await expect(recipeSearchInput).toBeFocused()
  const expandedSearchBox = await recipeSearchInput.locator('xpath=..').boundingBox()
  expect(Math.round(expandedSearchBox?.x ?? 0)).toBe(Math.round(floatingDockBox?.x ?? 0))
  expect(Math.round(expandedSearchBox?.width ?? 0)).toBe(Math.round(floatingDockBox?.width ?? 0))
  await expect(page.locator('button[aria-label="Quick Links"]')).toBeHidden()
  await expect(recipeSearchInput.locator('xpath=..')).toHaveCSS('background-color', 'rgba(18, 24, 38, 0.96)')
  await recipeSearchInput.fill('chicken')
  await expect(recipeSearchInput).toHaveValue('chicken')
  await expect(page.locator('button[aria-label="Sort"]').locator('xpath=..')).toHaveAttribute('inert', '')
  await expect(page.locator('button[aria-label="Filter"]').locator('xpath=..')).toHaveAttribute('aria-hidden', 'true')
})

test('desktop recipes use responsive bounded cards and five full-width carousel pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/at-a-glance/food')

  const carousel = page.getByRole('region', { name: 'Suggested recipes' })
  const pages = carousel.locator('[data-carousel-page]')
  await expect(pages).toHaveCount(5)
  const carouselColumns = Number(await page.locator('[data-card-carousel]').getAttribute('data-columns'))
  expect(carouselColumns).toBeGreaterThanOrEqual(5)
  expect(carouselColumns).toBeLessThanOrEqual(7)
  const cardsPerPage = carouselColumns * 2
  await expect(carousel.locator('[data-carousel-card]')).toHaveCount(cardsPerPage * 5)
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    await expect(pages.nth(pageIndex).locator('[data-carousel-card]')).toHaveCount(cardsPerPage)
  }
  await expect(page.getByRole('group', { name: 'Suggested recipes pages' }).getByRole('button')).toHaveCount(5)

  const geometry = await pages.first().evaluate((element) => {
    const pageRect = element.getBoundingClientRect()
    const trackRect = element.parentElement?.getBoundingClientRect()
    const columns = Number(element.closest('[data-card-carousel]')?.getAttribute('data-columns') ?? 0)
    const cards = Array.from(element.querySelectorAll('[data-carousel-card]')).map((card) => {
      const rect = card.getBoundingClientRect()
      return { x: Math.round(rect.x), y: Math.round(rect.y) }
    })
    return {
      cardColumns: new Set(cards.slice(0, columns).map((card) => card.x)).size,
      cardMaxWidth: Math.max(...Array.from(element.querySelectorAll('[data-carousel-card]')).map((card) => card.getBoundingClientRect().width)),
      columns,
      firstRowY: new Set(cards.slice(0, columns).map((card) => card.y)).size,
      pageWidth: Math.round(pageRect.width),
      rightDeadSpace: Math.round((trackRect?.right ?? 0) - pageRect.right),
      secondRowBelowFirst: cards[columns].y > cards[0].y,
      trackWidth: Math.round(trackRect?.width ?? 0),
      nextPageLeak: Math.max(0, Math.round(trackRect?.right ?? 0) - Math.round(element.nextElementSibling?.getBoundingClientRect().left ?? 0)),
    }
  })
  expect(geometry).toMatchObject({
    cardColumns: carouselColumns,
    columns: carouselColumns,
    firstRowY: 1,
    rightDeadSpace: 0,
    secondRowBelowFirst: true,
    nextPageLeak: 0,
  })
  expect(geometry.pageWidth).toBe(geometry.trackWidth)
  expect(geometry.pageWidth).toBeLessThan(1440)
  expect(geometry.cardMaxWidth).toBeLessThanOrEqual(220)

  const desktopAllRecipesBox = await page.getByRole('button', { exact: true, name: 'All Recipes' }).boundingBox()
  const desktopAllFoodBox = await page.getByRole('button', { name: /^All Food / }).boundingBox()
  expect(Math.round(desktopAllRecipesBox?.height ?? 0)).toBe(Math.round(desktopAllFoodBox?.height ?? 0))

  await page.getByRole('button', { name: 'Go to page 2' }).click()
  await expect(page.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('[data-card-carousel]')).toHaveAttribute('data-active-page', '2')
  await expect.poll(() => carousel.locator(':scope > div').evaluate((element) => getComputedStyle(element).transform)).not.toBe('none')

  await page.getByRole('button', { exact: true, name: 'All Recipes' }).click()
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]')).toHaveCount(50)
  const recipeGridGeometry = await page.locator('[data-recipe-grid="true"]').evaluate((wrapper) => {
    const grid = wrapper.querySelector('[data-dynamic-grid="true"]')
    const firstCard = grid?.querySelector('[data-recipe-card]')
    return {
      cardWidth: Math.round(firstCard?.getBoundingClientRect().width ?? 0),
      columns: Number(wrapper.getAttribute('data-recipe-grid-columns')),
      dynamicColumns: Number(grid?.getAttribute('data-dynamic-grid-columns')),
      gridWidth: Math.round(grid?.getBoundingClientRect().width ?? 0),
    }
  })
  expect(recipeGridGeometry.columns).toBe(recipeGridGeometry.dynamicColumns)
  expect(recipeGridGeometry.columns).toBeGreaterThanOrEqual(5)
  expect(recipeGridGeometry.gridWidth).toBeLessThanOrEqual(1_200)
  expect(recipeGridGeometry.cardWidth).toBeLessThanOrEqual(220)

  const desktopFloatingDockBox = await page.locator('[data-floating-action-dock="true"]').boundingBox()
  const desktopPageContentBox = await page.locator('[data-page-content="true"]').boundingBox()
  const desktopSearchButton = page.getByRole('button', { name: 'Search recipes' })
  const desktopSearchButtonBox = await desktopSearchButton.boundingBox()
  expect(Math.round(desktopSearchButtonBox?.x ?? 0)).toBe(Math.round(desktopFloatingDockBox?.x ?? 0))
  expect(Math.round(desktopFloatingDockBox?.x ?? 0)).toBe(Math.round(desktopPageContentBox?.x ?? 0))
  expect(Math.round(desktopFloatingDockBox?.width ?? 0)).toBe(Math.round(desktopPageContentBox?.width ?? 0))
  expect(Math.round(desktopSearchButtonBox?.width ?? 0)).toBeGreaterThan(700)
  await desktopSearchButton.click()
  const desktopSearchInput = page.getByRole('searchbox', { name: 'Search recipes' })
  await expect(desktopSearchInput).toBeFocused()
  const desktopSearchBarBox = await desktopSearchInput.locator('xpath=..').boundingBox()
  expect(Math.round(desktopSearchBarBox?.width ?? 0)).toBe(Math.round(desktopFloatingDockBox?.width ?? 0))
})

async function expectVerticallyCenteredChevrons(chevrons: Locator) {
  const offCenter = await chevrons.evaluateAll((nodes) => nodes.flatMap((node) => {
    const parent = node.parentElement
    if (!parent) return []
    const parentBox = parent.getBoundingClientRect()
    const box = node.getBoundingClientRect()
    if (!parentBox.height || !box.height) return []
    const drift = Math.abs((box.top - parentBox.top) - (parentBox.bottom - box.bottom))
    if (drift <= 1) return []
    return [{ drift: Math.round(drift), owner: parent.getAttribute('aria-label') ?? parent.className }]
  }))

  expect(offCenter).toEqual([])
}

async function swipeWithTouch(page: Page, x: number, startY: number, endY: number) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x, y: startY }] })
  for (let step = 1; step <= 8; step += 1) {
    const y = startY + ((endY - startY) * step) / 8
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x, y }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

function inventoryList(page: Page, listLabel: string) {
  return page.locator(`article[aria-label="${listLabel}"]`).filter({ visible: true }).first()
}

async function inventoryRowLabels(page: Page, listLabel: string) {
  return inventoryList(page, listLabel).evaluate((list) => (
    Array.from(list.querySelectorAll(':scope li > [role="group"]'))
      .map((row) => row.getAttribute('aria-label'))
  ))
}

test('overview renders with mock Home Assistant state', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  await expect(page).toHaveTitle('Home Assistant')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quick Links' })).toBeVisible()
})

test('Food quick link mirrors the All Food summary with the Kitchen Food orange', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/overview')

  await page.getByRole('button', { name: 'Quick Links' }).click()
  const dialog = page.getByRole('dialog', { name: 'Quick Links' })
  const foodQuickLink = dialog.getByRole('button', { name: 'Food & Recipes 35 Items • 6 Expiring Soon' })
  await expect(foodQuickLink).toContainText('Food & Recipes')
  await expect(foodQuickLink).toContainText('35 Items • 6 Expiring Soon')
  await expect(foodQuickLink).toHaveCSS('background-color', 'rgba(155, 110, 64, 0.72)')

  await foodQuickLink.click()
  await expect(page.getByRole('heading', { exact: true, name: 'Food & Recipes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All Food 35 Items • 6 Expiring Soon' })).toBeVisible()
})

test('global Quick Links opens from a non-Home route and preserves one-sheet detail navigation', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/settings')

  const trigger = page.getByRole('button', { name: 'Quick Links' })
  await trigger.focus()
  await trigger.press('Enter')
  let dialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()

  await trigger.click()
  dialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expect.poll(() => dialog.getByRole('group', { name: 'Quick Links', exact: true }).evaluate((grid) => {
    const rows = new Set(Array.from(grid.children).map((cell) => Math.round(cell.getBoundingClientRect().top)))
    return {
      columns: Number(grid.getAttribute('data-dynamic-grid-columns')),
      itemCount: grid.children.length,
      rows: rows.size,
      scrollsHorizontally: grid.scrollWidth > grid.clientWidth + 1,
    }
  })).toEqual({
    columns: 2,
    itemCount: 6,
    rows: 5,
    scrollsHorizontally: false,
  })
  const initialHash = await page.evaluate(() => window.location.hash)
  await dialog.getByRole('button', { name: /^Security System / }).click()
  dialog = page.getByRole('dialog', { name: 'Security System' })
  await expect(dialog.getByRole('heading', { exact: true, name: 'Security System' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Back' })).toBeVisible()
  expect(await page.evaluate(() => window.location.hash)).toBe(initialHash)
  await dialog.getByRole('button', { name: 'Back' }).click()
  dialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expect(dialog.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Vacuums' }).click()
  await expect(page.getByRole('heading', { name: 'Robot Vacuums' })).toBeVisible()
})

test('global Quick Links stays rightmost without overflowing representative mobile FAB rows', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })

  for (const route of ['overview', 'security', 'settings', 'chores', 'kitchen', 'fridge', 'recipes']) {
    await page.goto(`/at-a-glance/${route}`)
    const trigger = page.getByRole('button', { name: 'Quick Links' })
    const dock = page.locator('[data-floating-action-dock="true"]')
    const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
    await expect(trigger).toBeVisible()

    const geometry = await dock.evaluate((element) => {
      const dockRect = element.getBoundingClientRect()
      const quickLinks = element.querySelector<HTMLButtonElement>('button[aria-label="Quick Links"]')
      const quickLinksRect = quickLinks?.getBoundingClientRect()
      const visibleChildren = Array.from(element.children).filter((child) => {
        const rect = child.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      return {
        lastVisibleIsQuickLinks: visibleChildren.at(-1) === quickLinks,
        overflows: element.scrollWidth > element.clientWidth + 1,
        quickLinksRight: Math.round(quickLinksRect?.right ?? 0),
        dockRight: Math.round(dockRect.right),
      }
    })
    const triggerBox = await trigger.boundingBox()
    const navBox = await nav.boundingBox()

    expect(geometry.lastVisibleIsQuickLinks).toBe(true)
    expect(geometry.overflows).toBe(false)
    expect(geometry.quickLinksRight).toBe(geometry.dockRight)
    expect((triggerBox?.y ?? Number.POSITIVE_INFINITY) + (triggerBox?.height ?? 0)).toBeLessThanOrEqual(navBox?.y ?? Number.NEGATIVE_INFINITY)
  }
})

test('room keyboard navigation signals one HA-owned increment without delaying the route', async ({ page }) => {
  await page.goto('/at-a-glance/overview')
  const roomsDialog = await openRoomsFromQuickLinks(page)
  const livingRoom = roomsDialog.getByRole('button', { name: 'Living Room area' })
  await livingRoom.focus()
  await livingRoom.press('Enter')

  await expect.poll(() => page.evaluate(() => new URL(window.location.href).searchParams.get('path'))).toBe('living-room')
  await expect.poll(() => roomAccessServiceCalls(page)).toEqual([
    {
      domain: 'script',
      service: 'turn_on',
      serviceData: { variables: { room: 'living-room' } },
      target: 'script.increment_room_access',
    },
  ])
})

test('mobile modal opener families use shared disclosures and explicit action exceptions', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/overview')

  await expectRightChevron(page.getByRole('button', { name: /Open seven-day weather forecast/i }))
  await expectNoChevron(page.getByRole('button', { name: /^Lights /i }).first())
  await expectNoChevron(page.getByRole('button', { name: 'Open Front Door camera' }))
  const quickLinksTrigger = page.getByRole('button', { name: 'Quick Links' })
  await expect(quickLinksTrigger).toHaveAttribute('data-modal-opener-exception', 'floating-action')
  await quickLinksTrigger.click()
  const quickLinksDialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expectRightChevron(quickLinksDialog.getByRole('button', { name: 'Rooms' }))
  await expect(quickLinksDialog.getByRole('button', { name: 'Rooms' })).toHaveAttribute('data-modal-opener', 'true')
  await expectRightChevron(quickLinksDialog.getByRole('button', { name: /^Security System /i }))
  for (const quickLink of ['Food & Recipes 35 Items • 6 Expiring Soon', 'Vacuums', 'Media', 'Custom Lights']) {
    const opener = quickLinksDialog.getByRole('button', { exact: true, name: quickLink })
    await expectRightChevron(opener)
    await expect(opener).toHaveAttribute('data-navigation-opener', 'true')
  }
  await quickLinksDialog.getByRole('button', { name: 'Close' }).click()
  await expect(quickLinksDialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Rooms' })).toHaveCount(0)

  await page.goto('/at-a-glance/living-room')
  await expectNoChevron(page.getByRole('button', { name: /^Climate /i }).first())
  await expectRightChevron(page.getByRole('button', { name: /^Vents /i }))

  await page.goto('/at-a-glance/admin')
  await expectRightChevron(page.getByRole('button', { name: 'Open Presence-Based Overrides' }))

  await page.goto('/at-a-glance/settings')
  const adminSettings = page.getByRole('button', { name: /Admin Controls/i })
  await expectRightChevron(adminSettings)
  await expect(adminSettings).toHaveAttribute('data-action-kind', 'navigate')
  await expect(adminSettings).toHaveAttribute('data-navigation-opener', 'true')
  const homeAssistantSettings = page.getByRole('button', { name: /Home Assistant Settings/i })
  await expectNoChevron(homeAssistantSettings)
  await expect(homeAssistantSettings).toHaveAttribute('data-action-kind', 'external')
  await expect(homeAssistantSettings.locator('[data-surface-accessory="external"]')).toHaveCount(1)

  await page.goto('/at-a-glance/ecobee')
  await expectRightChevron(page.getByRole('button', { exact: true, name: 'Room Thermostats' }))
  await expectRightChevron(page.getByRole('button', { exact: true, name: 'Advanced Configuration' }))
  await expectRightChevron(page.getByRole('button', { exact: true, name: 'Room Tracking' }))
  const thermostatDialog = await openThermostatControls(page)
  await expectRightChevron(thermostatDialog.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))

  await page.goto('/at-a-glance/pantry')
  await expectRightChevron(page.getByRole('button', { name: 'Edit Canned Beans' }))
})

test('weather modal renders a live atmosphere and outdoor AQI without motion-only semantics', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/overview')
  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()

  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog).toHaveAttribute('data-has-surface-decoration', 'true')
  await expect(dialog.locator('[data-weather-scene="clouds"]')).toBeVisible()
  const aqiTile = dialog.getByRole('article', { name: 'Outdoor air quality 152, Unhealthy' })
  await expect(aqiTile).toHaveAttribute('data-aqi-tone', 'unhealthy')
  await expect(aqiTile.locator('[data-weather-rail="aqi"] [data-weather-rail-marker="true"]')).toBeVisible()
  await expect(aqiTile.getByText('Health effects are possible for everyone.')).toHaveCount(0)
  await expect(dialog.getByLabel('Current weather conditions')).toContainText(/High: 65°\s+Low: 48°/)
  await expect(dialog.getByLabel('Current weather conditions')).not.toContainText('Home')
  await expect(dialog.getByText('45° · Partly Cloudy', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Powered by Pirate Weather')).toHaveCount(0)
  await expect(dialog.getByText('Outdoor · Pirate Weather')).toHaveCount(0)
  const precipitationTiles = dialog.locator('[data-weather-precipitation-tile="true"]')
  const precipitationTile = dialog.getByRole('article', { name: 'Hourly precipitation chance over 6 hours, peaking at 94%' })
  const accumulationTile = dialog.getByRole('article', { name: 'Cumulative precipitation through 6 hours, totaling 0.04 in' })
  await expect(precipitationTiles.locator('[data-precipitation-sample]')).toHaveCount(2)
  await expect(precipitationTile).toContainText('Precipitation')
  await expect(accumulationTile).toContainText('Accumulation')
  await expect(precipitationTile.locator('[data-precipitation-bar="true"]')).toHaveCount(6)
  await expect(accumulationTile.locator('[data-cumulative-bar="true"]')).toHaveCount(6)
  await expect(precipitationTile.locator('[data-precipitation-grid-lines="chance"] > i')).toHaveCount(3)
  await expect(accumulationTile.locator('[data-precipitation-grid-lines="cumulative"] > i')).toHaveCount(3)
  await expect(precipitationTile.locator('[data-precipitation-y-axis="chance"]')).toHaveText('100%50%0%')
  await expect(accumulationTile.locator('[data-precipitation-y-axis="cumulative"]')).toHaveText('0.04 in0.02 in0 in')
  await expect(precipitationTiles).toHaveAttribute('data-precipitation-chance-domain', '100')
  await expect(precipitationTiles).toHaveAttribute('data-precipitation-amount-domain', '0.04')
  await expect(precipitationTile.locator('[data-precipitation-hour-label="chance"]')).toHaveCount(0)
  await expect(accumulationTile.locator('[data-cumulative-annotation="true"]')).toHaveCount(0)
  await expect.poll(() => accumulationTile.locator('[data-precipitation-hour-label="cumulative-time"]').count()).toBeGreaterThan(1)
  expect(await precipitationTile.locator('[data-precipitation-hour-label="time"]').allTextContents())
    .toEqual(await accumulationTile.locator('[data-precipitation-hour-label="cumulative-time"]').allTextContents())
  await expect(precipitationTile.locator('[data-precipitation-hour-label="time"]').first()).toHaveText('Now')
  await expect(precipitationTile.locator('[data-probability="94"][data-amount="0"]')).toHaveAttribute('data-measurable', 'false')
  await expect(precipitationTiles.getByRole('table', { name: '6-hour precipitation details' })).toHaveCount(1)
  const hourlyMetricTiles = dialog.locator('[data-weather-hourly-metric-tiles="true"]')
  const humidityTile = dialog.getByRole('article', { name: 'Hourly Humidity over 6 hours, ranging from 62% to 74%' })
  const cloudTile = dialog.getByRole('article', { name: 'Hourly Cloud Cover over 6 hours, ranging from 20% to 70%' })
  await expect(hourlyMetricTiles.locator('[data-hourly-metric-tile]')).toHaveCount(2)
  await expect(humidityTile.locator('[data-hourly-metric-bar="true"]')).toHaveCount(6)
  await expect(cloudTile.locator('[data-hourly-metric-bar="true"]')).toHaveCount(6)
  await expect(humidityTile.locator('[data-precipitation-y-axis="humidity"]')).toHaveText('80%40%0%')
  await expect(cloudTile.locator('[data-precipitation-y-axis="cloud"]')).toHaveText('70%35%0%')
  await expect(humidityTile.locator('[data-hourly-metric-plot="humidity"]')).not.toHaveAttribute('data-axis-truncated')
  expect(await humidityTile.locator('[data-hourly-metric-label="humidity"]').allTextContents())
    .toEqual(await cloudTile.locator('[data-hourly-metric-label="cloud"]').allTextContents())
  await expect(dialog.locator('[data-weather-highlight-rail="feels"]')).toBeVisible()
  await expect(dialog.locator('[data-weather-rail="feels"] [data-weather-rail-fill]')).toHaveCSS(
    'background-image',
    'linear-gradient(90deg, rgb(59, 130, 246), rgb(20, 184, 166) 42%, rgb(202, 138, 4) 70%, rgb(234, 88, 12))',
  )
  await expect(dialog.locator('[data-weather-highlight-rail="uv"]')).toBeVisible()
  const visibilityTile = dialog.getByRole('article', { name: /^Visibility / })
  await expect(visibilityTile.locator('[data-visibility-visual="distance-rail"]')).toBeVisible()
  await expect(visibilityTile.locator('[data-weather-rail-marker="true"]')).toBeVisible()
  const weatherRails = page.locator('[data-weather-rail]')
  await expect(weatherRails).toHaveCount(12)
  await expect(page.locator('[data-weather-rail="temperature"]')).toHaveCount(8)
  const weatherRailGeometry = await weatherRails.evaluateAll((rails) => ({
    classCount: new Set(rails.map((rail) => rail.className)).size,
    fillsMatch: rails.every((rail) => rail.querySelector<HTMLElement>('[data-weather-rail-fill]')?.getBoundingClientRect().height === 10),
    markersMatch: rails.every((rail) => {
      const marker = rail.querySelector<HTMLElement>('[data-weather-rail-marker]')
      if (!marker) return true
      const bounds = marker.getBoundingClientRect()
      return bounds.height === 12 && bounds.width === 12
    }),
    markersSolidWhite: rails.every((rail) => {
      const marker = rail.querySelector<HTMLElement>('[data-weather-rail-marker]')
      if (!marker) return true
      const style = getComputedStyle(marker)
      return style.backgroundColor === 'rgb(255, 255, 255)'
        && style.borderTopWidth === '0px'
        && style.boxShadow === 'none'
    }),
    railsMatch: rails.every((rail) => rail.getBoundingClientRect().height === 10),
  }))
  expect(weatherRailGeometry).toEqual({
    classCount: 1,
    fillsMatch: true,
    markersMatch: true,
    markersSolidWhite: true,
    railsMatch: true,
  })
  const windTile = dialog.locator('[data-kind="wind"]')
  await expect(windTile).toHaveAttribute('aria-label', 'Wind 4 mph; Gusts 8 mph; From southwest, 236 degrees')
  await expect(windTile).toHaveAttribute('data-wide', 'true')
  await expect(windTile.locator('[data-wind-compass="true"]')).toBeVisible()
  const windVector = windTile.locator('[data-wind-vector="true"]')
  await expect(windVector).toHaveAttribute('data-source-bearing', '236')
  await expect(windVector).toHaveAttribute('data-destination-bearing', '56')
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(0)
  const windTextColors = await windTile.locator('[data-wind-text="true"]').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element)
    return element instanceof SVGElement ? style.fill : style.color
  }))
  expect(new Set(windTextColors)).toEqual(new Set(['rgb(255, 255, 255)']))
  const windInstrumentColors = await windTile.evaluate((element) => ({
    destination: getComputedStyle(element.querySelector<SVGPathElement>('[data-wind-destination-arrow]')!).fill,
    source: getComputedStyle(element.querySelector<SVGCircleElement>('[data-wind-source-marker]')!).stroke,
  }))
  expect(windInstrumentColors.source).not.toBe(windInstrumentColors.destination)
  expect(windInstrumentColors.source).not.toBe('rgb(255, 255, 255)')
  expect(windInstrumentColors.destination).not.toBe('rgb(255, 255, 255)')
  await expect(windTile.locator('[class*="windCompassTick"]')).toHaveCount(47)
  await expect(windTile.locator('linearGradient')).toHaveCount(0)
  const windCompassClearance = await windTile.evaluate((element) => {
    const vectorParts = Array.from(element.querySelectorAll<SVGGraphicsElement>(
      '[data-wind-source-blade], [data-wind-source-marker], [data-wind-destination-arrow]',
    ))
    const cardinals = Array.from(element.querySelectorAll<SVGTextElement>('svg text[data-wind-text]'))
    if (vectorParts.length !== 3 || cardinals.length !== 4) return null
    const cornerRadii = (box: DOMRect | SVGRect) => [
      Math.hypot(box.x - 56, box.y - 56),
      Math.hypot(box.x + box.width - 56, box.y - 56),
      Math.hypot(box.x - 56, box.y + box.height - 56),
      Math.hypot(box.x + box.width - 56, box.y + box.height - 56),
    ]
    const maximumInstrumentRadius = Math.max(...vectorParts.flatMap((part) => {
      const stroke = getComputedStyle(part).stroke === 'none' ? 0 : Number.parseFloat(getComputedStyle(part).strokeWidth) / 2
      return cornerRadii(part.getBBox()).map((radius) => radius + stroke)
    }))
    const minimumCardinalRadius = Math.min(...cardinals.flatMap((cardinal) => cornerRadii(cardinal.getBBox())))
    return minimumCardinalRadius - maximumInstrumentRadius
  })
  expect(windCompassClearance).not.toBeNull()
  expect(windCompassClearance ?? 0).toBeGreaterThanOrEqual(2.5)

  const setWindBearing = (bearing: number) => page.evaluate((nextBearing) => {
    const mockHass = (window as unknown as {
      __mockHass?: { setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void }
    }).__mockHass
    mockHass?.setEntityAttribute('weather.pirate_weather', 'wind_bearing', nextBearing)
  }, bearing)
  const finishWindAnimation = () => windVector.evaluate((element) => {
    element.getAnimations().forEach((animation) => animation.finish())
  })

  await setWindBearing(350)
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(1)
  await finishWindAnimation()
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(0)

  await setWindBearing(10)
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(1)
  const wrapKeyframes = await windVector.evaluate((element) => {
    const effect = element.getAnimations()[0]?.effect as KeyframeEffect | null
    return effect?.getKeyframes().map((keyframe) => Number(String(keyframe.transform).match(/-?[\d.]+/)?.[0])) ?? []
  })
  expect(((wrapKeyframes[0] % 360) + 360) % 360).toBeCloseTo(350)
  expect(((wrapKeyframes[1] % 360) + 360) % 360).toBeCloseTo(10)
  expect(wrapKeyframes[1] - wrapKeyframes[0]).toBeCloseTo(20)
  await finishWindAnimation()

  await setWindBearing(0)
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(1)
  await finishWindAnimation()
  await setWindBearing(170)
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(1)
  const paintedBeforeRetarget = await windVector.evaluate(async (element) => {
    const animation = element.getAnimations()[0]
    const effect = animation.effect as KeyframeEffect
    const duration = Number(effect.getTiming().duration)
    animation.currentTime = duration * 0.35
    animation.pause()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  })
  await setWindBearing(300)
  await expect.poll(async () => {
    const frames = await windVector.evaluate((element) => {
      const effect = element.getAnimations()[0]?.effect as KeyframeEffect | null
      return effect?.getKeyframes().map((keyframe) => String(keyframe.transform)) ?? []
    })
    return frames.length
  }).toBe(2)
  const interruptedKeyframes = await windVector.evaluate((element) => {
    const effect = element.getAnimations()[0]?.effect as KeyframeEffect
    return effect.getKeyframes().map((keyframe) => Number(String(keyframe.transform).match(/-?[\d.]+/)?.[0]))
  })
  expect(Math.abs(interruptedKeyframes[0] - paintedBeforeRetarget)).toBeLessThanOrEqual(1)
  expect(Math.abs(interruptedKeyframes[1] - interruptedKeyframes[0])).toBeLessThanOrEqual(180)
  await finishWindAnimation()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setWindBearing(100)
  await expect.poll(() => windVector.evaluate((element) => element.getAnimations().length)).toBe(0)
  await expect(windVector).toHaveAttribute('data-source-bearing', '100')
  await expect(dialog.getByRole('article', { name: 'Cloud Cover 57%' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Visualization Lab/i })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Wind conditions' }).click()
  const dailyWindSummary = dialog.getByRole('article', { name: 'Today wind 4-8 mph' }).locator('[data-forecast-wind-summary]')
  await expect(dailyWindSummary).toBeVisible()
  const dailyWindGeometry = await dailyWindSummary.evaluate((element) => {
    const direction = element.querySelector<HTMLElement>('[data-wind-source-bearing]')?.getBoundingClientRect()
    const speed = element.querySelector<HTMLElement>('[class*="forecastWindRange"]')?.getBoundingClientRect()
    return {
      directionBeforeSpeed: Boolean(direction && speed && direction.right <= speed.left),
      gap: direction && speed ? speed.left - direction.right : Number.POSITIVE_INFINITY,
      railCount: element.querySelectorAll('[class*="windSparkline"]').length,
    }
  })
  expect(dailyWindGeometry).toMatchObject({
    directionBeforeSpeed: true,
    railCount: 0,
  })
  expect(dailyWindGeometry.gap).toBeLessThanOrEqual(12)
  const decorationCoverage = await dialog.evaluate((element) => {
    const decoration = element.querySelector<HTMLElement>('[data-modal-sheet-surface-decoration="true"]')
    if (!decoration) return null
    const dialogRect = element.getBoundingClientRect()
    const decorationRect = decoration.getBoundingClientRect()
    return {
      heightDelta: Math.abs(dialogRect.height - decorationRect.height),
      widthDelta: Math.abs(dialogRect.width - decorationRect.width),
      xDelta: Math.abs(dialogRect.x - decorationRect.x),
      yDelta: Math.abs(dialogRect.y - decorationRect.y),
    }
  })
  expect(decorationCoverage).not.toBeNull()
  expect(decorationCoverage?.heightDelta).toBeLessThanOrEqual(2)
  expect(decorationCoverage?.widthDelta).toBeLessThanOrEqual(2)
  expect(decorationCoverage?.xDelta).toBeLessThanOrEqual(2)
  expect(decorationCoverage?.yDelta).toBeLessThanOrEqual(2)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(dialog.locator('[data-weather-atmosphere-motion="true"]')).toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  const cumulativeBarColor = await accumulationTile.locator('[data-cumulative-bar="true"]').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(cumulativeBarColor).not.toBe('rgba(0, 0, 0, 0)')
  const humidityCapColor = await humidityTile.locator('[data-hourly-metric-bar="true"]').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(humidityCapColor).not.toBe('rgba(0, 0, 0, 0)')
  const forcedWindColors = await windTile.evaluate((element) => ({
    destination: getComputedStyle(element.querySelector<SVGPathElement>('[data-wind-destination-arrow]')!).fill,
    sourceFill: getComputedStyle(element.querySelector<SVGCircleElement>('[data-wind-source-marker]')!).fill,
    sourceStroke: getComputedStyle(element.querySelector<SVGCircleElement>('[data-wind-source-marker]')!).stroke,
  }))
  expect(forcedWindColors.destination).not.toBe('none')
  expect(forcedWindColors.sourceStroke).not.toBe('none')
  expect(forcedWindColors.sourceFill).not.toBe(forcedWindColors.sourceStroke)
})

test('mobile navigation chevrons stay vertically centered in their opener', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })

  for (const path of ['overview', 'security', 'living-room', 'master-bedroom', 'ecobee', 'vacuums', 'admin', 'pantry']) {
    await page.goto(`/at-a-glance/${path}`)
    const chevrons = page.locator('[data-modal-disclosure="right-chevron"]')
    await expect.poll(() => chevrons.count()).toBeGreaterThan(0)
    await expectVerticallyCenteredChevrons(chevrons)
  }
})

test('mobile header status chips never render a disclosure chevron', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })

  for (const path of ['overview', 'security', 'living-room', 'master-bedroom', 'kitchen', 'office']) {
    await page.goto(`/at-a-glance/${path}`)
    const chips = page.locator('[data-variant="header"]')
    await expect.poll(() => chips.count(), { message: `${path} header chips` }).toBeGreaterThan(0)
    await expect(chips.locator('[data-modal-disclosure]'), `${path} header chip chevrons`).toHaveCount(0)
  }
})

test('dashboard keyboard viewport hides bottom nav and publishes visible height', async ({ page }) => {
  await installFakeVisualViewport(page)
  await page.goto('/at-a-glance/overview')
  const initialViewportHeight = await page.evaluate(() => window.innerHeight)
  await page.evaluate((height) => window.__setDashboardFakeViewport?.(height, 0), initialViewportHeight)

  const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
  await expect(nav).toHaveCSS('opacity', '1')
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-keyboard'))).toBeNull()

  const keyboardViewportHeight = await page.evaluate(() => Math.max(320, window.innerHeight - 240))
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.setAttribute('data-keyboard-test-input', 'true')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.append(input)
    input.focus()
  })
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), keyboardViewportHeight)

  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-keyboard'))).toBe('open')
  await expect(nav).toHaveCSS('opacity', '0')
  await expect(nav).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dashboard-viewport-height').trim())).toBe(`${Math.round(initialViewportHeight)}px`)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dashboard-visible-height').trim())).toBe(`${Math.round(keyboardViewportHeight)}px`)

  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), initialViewportHeight)
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-keyboard'))).toBeNull()
  await expect(nav).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.querySelector('[data-keyboard-test-input]')?.remove())
})

test('kitchen restores full height after closing the keyboard and reopening by touch navigation', async ({ page }) => {
  await installFakeVisualViewport(page)
  await page.goto('/sfenton-react-dash/home?path=kitchen')
  const initialViewportHeight = await page.evaluate(() => window.innerHeight)
  await page.evaluate((height) => window.__setDashboardFakeViewport?.(height, 0), initialViewportHeight)
  await page.evaluate(() => {
    const iframe = document.createElement('iframe')
    iframe.dataset.dashboardWrapperTest = 'true'
    iframe.src = '/at-a-glance/kitchen'
    Object.assign(iframe.style, {
      border: '0',
      height: '100%',
      inset: '0',
      position: 'fixed',
      width: '100%',
      zIndex: '100',
    })
    document.body.append(iframe)
  })
  const app = page.frameLocator('iframe[data-dashboard-wrapper-test="true"]')
  await expect(app.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  const keyboardViewportHeight = Math.max(320, initialViewportHeight - 300)
  const shellMetrics = () => app.locator('html').evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[class*="_shell_"]')
    return {
      cssHeight: getComputedStyle(document.documentElement).getPropertyValue('--dashboard-viewport-height').trim(),
      height: Math.round(shell?.getBoundingClientRect().height ?? 0),
      keyboard: document.documentElement.getAttribute('data-dashboard-keyboard'),
      visibleCssHeight: getComputedStyle(document.documentElement).getPropertyValue('--dashboard-visible-height').trim(),
    }
  })

  await app.getByRole('button', { name: 'Scan Item' }).click()
  const dialog = app.getByRole('dialog', { name: /Add Item/i })
  await dialog.getByRole('button', { name: 'Manually Enter Name' }).click()
  const productName = dialog.getByRole('textbox', { name: 'Product name' })
  await productName.click()
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), keyboardViewportHeight)

  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: 'open',
    visibleCssHeight: `${keyboardViewportHeight}px`,
  })
  await page.waitForTimeout(160)

  await productName.press('Escape')
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await page.waitForTimeout(80)
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height, false), initialViewportHeight)

  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: null,
    visibleCssHeight: `${initialViewportHeight}px`,
  })

  await app.getByRole('button', { name: 'Scan Item' }).click()
  const routeDialog = app.getByRole('dialog', { name: /Add Item/i })
  await routeDialog.getByRole('button', { name: 'Manually Enter Name' }).click()
  const routeProductName = routeDialog.getByRole('textbox', { name: 'Product name' })
  await routeProductName.click()
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), keyboardViewportHeight)
  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: 'open',
    visibleCssHeight: `${keyboardViewportHeight}px`,
  })
  await page.waitForTimeout(160)
  await routeProductName.press('Escape')
  await expect(routeDialog).toHaveAttribute('data-state', 'closed')
  await page.waitForTimeout(80)
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height, false), initialViewportHeight)
  await app.getByRole('button', { name: 'Go back' }).evaluate((button) => button.click())
  await page.waitForTimeout(50)
  expect(await shellMetrics()).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: null,
    visibleCssHeight: `${initialViewportHeight}px`,
  })
  await expect(app.getByRole('heading', { name: 'Home' })).toBeVisible()
  const roomsDialog = await openRoomsFromQuickLinks(app)
  await roomsDialog.getByRole('button', { name: /Kitchen/i }).evaluate((button) => button.click())
  await expect(app.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: null,
    visibleCssHeight: `${initialViewportHeight}px`,
  })
})

test('embedded inventory search follows the top visual viewport without a guessed-position jump', async ({ page }) => {
  await installFakeVisualViewport(page)
  await page.goto('/sfenton-react-dash/home?path=fridge')
  const topViewportHeight = await page.evaluate(() => window.innerHeight)
  await page.evaluate((height) => window.__setDashboardFakeViewport?.(height, 0), topViewportHeight)
  await page.evaluate(() => {
    const iframe = document.createElement('iframe')
    iframe.dataset.inventoryWrapperTest = 'true'
    iframe.src = '/at-a-glance/fridge'
    Object.assign(iframe.style, {
      border: '0',
      height: '100%',
      inset: '0',
      position: 'fixed',
      width: '100%',
      zIndex: '100',
    })
    document.body.append(iframe)
  })

  const app = page.frameLocator('iframe[data-inventory-wrapper-test="true"]')
  await expect(app.getByRole('heading', { name: 'Fridge' })).toBeVisible()
  const dock = app.locator('[data-floating-action-dock="true"]')
  const searchButton = dock.getByRole('button', { name: 'Search inventory' })
  await expect(searchButton).toBeVisible()
  const initialViewportHeight = topViewportHeight
  const keyboardViewportHeight = Math.max(320, initialViewportHeight - 240)
  await app.locator('html').evaluate((_, { keyboardViewportHeight, viewportHeight }) => {
    const bucket = Math.round(viewportHeight / 25) * 25
    window.localStorage.setItem(`react-dash-keyboard-v1:portrait:${bucket}`, String(viewportHeight - keyboardViewportHeight))
  }, { keyboardViewportHeight, viewportHeight: initialViewportHeight })

  const dockMetrics = () => dock.evaluate((element) => {
    const dockRect = element.getBoundingClientRect()
    const frameRect = window.frameElement?.getBoundingClientRect()
    const viewport = window.top?.visualViewport
    const frameTop = frameRect?.top ?? 0
    const frameBottom = frameRect?.bottom ?? window.innerHeight
    const visibleBottom = viewport?.height ?? window.innerHeight
    const targetBottom = Math.min(frameBottom, visibleBottom) - 14
    return {
      bottom: frameTop + dockRect.bottom,
      keyboard: document.documentElement.getAttribute('data-dashboard-keyboard'),
      targetBottom,
      y: frameTop + dockRect.y,
    }
  })

  const before = await dockMetrics()
  await searchButton.click()
  await expect(app.getByLabel('Search inventory')).toBeFocused()
  const armed = await dockMetrics()
  expect(Math.abs(armed.y - before.y)).toBeGreaterThan(20)

  const input = app.getByLabel('Search inventory')
  await page.evaluate((height) => window.__setDashboardFakeViewport?.(height, 0), keyboardViewportHeight)
  await input.type('m')
  await expect(input).toHaveValue('m')
  await expect.poll(async () => {
    const metrics = await dockMetrics()
    return Math.abs(metrics.bottom - metrics.targetBottom)
  }, { timeout: 500 }).toBeLessThanOrEqual(4)
  await expect.poll(async () => Math.abs((await dockMetrics()).y - armed.y), { timeout: 500 }).toBeLessThanOrEqual(1)

  await input.press('Enter')
  await page.evaluate(() => window.__setDashboardFakeViewport?.(window.innerHeight, 0))
  await expect.poll(async () => (await dockMetrics()).keyboard).toBeNull()
  await expect.poll(async () => Math.round((await dockMetrics()).y)).toBe(Math.round(before.y))
})

test('scan item commits the product on Next before requesting and using a location suggestion', async ({ page }) => {
  await page.goto('/at-a-glance/kitchen')
  await page.getByRole('button', { name: 'Scan Item' }).click()
  const dialog = page.getByRole('dialog', { name: /Add Item/i })
  await dialog.getByRole('button', { name: 'Manually Enter Name' }).click()
  await clearMockHassCalls(page)

  const productName = dialog.getByRole('textbox', { name: 'Product name' })
  await productName.fill('Milk')
  expect(await everShelfInventoryCalls(page)).toEqual([])

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog).toContainText('Expiration Date · Step 2 of 3')
  await expect.poll(async () => (await everShelfInventoryCalls(page)).slice(0, 2)).toEqual([
    {
      domain: 'evershelf',
      returnResponse: true,
      service: 'prepare_scanned_product',
      serviceData: { name: 'Milk' },
    },
    {
      domain: 'evershelf',
      returnResponse: true,
      service: 'suggest_location',
      serviceData: {
        mode: 'manual',
        name: 'Milk',
        product_fingerprint: 'f'.repeat(64),
        product_id: 123,
      },
    },
  ])

  await dialog.getByRole('button', { name: 'Skip Expiration' }).click()
  await expect(dialog).toContainText('Review Item · Step 3 of 3')
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect.poll(() => everShelfInventoryCalls(page)).toContainEqual({
    domain: 'evershelf',
    returnResponse: true,
    service: 'add_scanned_item',
    serviceData: expect.objectContaining({
      idempotency_key: expect.stringMatching(/^scan-/),
      location: 'dispensa',
      name: 'Milk',
      product_id: 123,
      quantity: 1,
    }),
  })
})

test('inventory footer search moves above the mobile keyboard and clears results', async ({ page }) => {
  await page.goto('/at-a-glance/fridge')

  const dock = page.locator('[data-floating-action-dock="true"]')
  const inventoryListLabel = 'Fridge inventory list'
  const visibleInventoryList = inventoryList(page, inventoryListLabel)
  await expect(visibleInventoryList).toBeVisible()
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toHaveLength(3)
  const restBox = await dock.boundingBox()
  if (!restBox) throw new Error('Inventory floating action dock was not measurable')

  await page.evaluate(() => {
    const fakeVisualViewport = new EventTarget() as EventTarget & {
      height: number
      offsetTop: number
      pageLeft: number
      pageTop: number
      scale: number
      width: number
    }
    fakeVisualViewport.width = window.innerWidth
    fakeVisualViewport.height = window.innerHeight
    fakeVisualViewport.offsetTop = 0
    fakeVisualViewport.pageLeft = 0
    fakeVisualViewport.pageTop = 0
    fakeVisualViewport.scale = 1
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fakeVisualViewport })
    window.__setInventoryFakeKeyboardHeight = (height: number) => {
      fakeVisualViewport.height = height
      fakeVisualViewport.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('resize'))
    }
  })

  await page.evaluate(() => {
    const viewportHeight = window.innerHeight
    const keyboardViewportHeight = 520
    const bucket = Math.round(viewportHeight / 25) * 25
    window.localStorage.setItem(`react-dash-keyboard-v1:portrait:${bucket}`, String(viewportHeight - keyboardViewportHeight))
  })
  await dock.getByRole('button', { name: 'Search inventory' }).click()
  const input = page.getByLabel('Search inventory')
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate((element) => Boolean(element.closest('[data-floating-action-dock="true"]')))).toBe(true)
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-search-expanded'))).toBe('true')
  await expect(dock.locator('button[aria-label="Sort"]').locator('xpath=..')).toHaveAttribute('data-collapsed', 'true')
  await expect(dock.locator('button[aria-label="Filter"]').locator('xpath=..')).toHaveAttribute('data-collapsed', 'true')
  await expect(dock.getByRole('button', { name: 'Scan Item' })).toHaveCSS('opacity', '0')
  await expect(dock.locator('button[aria-label="Quick Links"]')).toBeHidden()

  await page.evaluate(() => window.__setInventoryFakeKeyboardHeight?.(520))
  await expect.poll(async () => {
    const box = await dock.boundingBox()
    return Math.round(520 - ((box?.y ?? 0) + (box?.height ?? 0)))
  }).toBeGreaterThanOrEqual(0)
  await expect.poll(async () => {
    const box = await dock.boundingBox()
    return Math.round(520 - ((box?.y ?? 0) + (box?.height ?? 0)))
  }).toBeLessThanOrEqual(20)

  await input.fill('dragonfruit')
  await expect(page.getByRole('heading', { name: 'No Matching Items' })).toBeVisible()
  await expect(page.getByText('Try a different search or clear the search to show all items.')).toBeVisible()
  await input.press('Enter')
  await page.evaluate(() => window.__setInventoryFakeKeyboardHeight?.(window.innerHeight))
  await expect.poll(async () => Math.round((await dock.boundingBox())?.y ?? 0)).toBe(Math.round(restBox.y))
  await expect(dock.getByRole('button', { name: 'Quick Links' })).toBeVisible()

  await dock.getByRole('button', { name: 'Search inventory' }).click()
  const reopenedInput = page.getByLabel('Search inventory')
  await reopenedInput.fill('milk')
  await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible()
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toEqual([
    expect.stringContaining('Milk'),
  ])

  await reopenedInput.press('Enter')
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-inventory-search-expanded'))).toBeNull()
  await expect(dock.getByRole('button', { name: 'Search inventory' })).toContainText('milk')
  await dock.getByRole('button', { name: 'Search inventory' }).click()
  const clearInput = page.getByLabel('Search inventory')
  await page.getByRole('button', { name: 'Clear Search' }).click()
  await expect(clearInput).toHaveValue('')
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toHaveLength(3)
})

test('inventory item edit modal adds and removes EverShelf stock from the quantity stepper', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/fridge')

  const inventoryListLabel = 'Fridge inventory list'
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toHaveLength(3)
  const yogurtRow = inventoryList(page, inventoryListLabel).getByRole('group', { name: /Greek Yogurt Quantity 2/i })
  await yogurtRow.getByRole('button', { name: 'Edit Greek Yogurt' }).click()

  const dialog = page.getByRole('dialog', { name: /Greek Yogurt/i })
  const quantity = dialog.getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })
  await expect(quantity).toHaveText('2')
  await expect(dialog.getByRole('button', { name: 'Save Greek Yogurt' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Add one Greek Yogurt' }).click()
  await dialog.getByRole('button', { name: 'Add one Greek Yogurt' }).click()
  await expect(quantity).toHaveText('4')
  await expect(dialog.getByText('Saving adds 2 items to the fridge.')).toBeVisible()

  await clearMockHassCalls(page)
  await dialog.getByRole('button', { name: 'Save Greek Yogurt' }).click()
  await expect.poll(() => everShelfInventoryCalls(page)).toContainEqual({
    domain: 'evershelf',
    service: 'add_scanned_item',
    serviceData: {
      expiry_date: expect.any(String),
      location: 'frigo',
      name: 'Greek Yogurt',
      product_id: 2003,
      quantity: 2,
      unit: 'pz',
      vacuum_sealed: false,
    },
  })
  await expect(dialog).toHaveCount(0)

  await yogurtRow.getByRole('button', { name: 'Edit Greek Yogurt' }).click()
  await dialog.getByRole('button', { name: 'Remove one Greek Yogurt' }).click()
  await expect(quantity).toHaveText('1')
  await expect(dialog.getByRole('button', { name: 'Remove one Greek Yogurt' })).toBeDisabled()
  await expect(dialog.getByText('Saving removes 1 item from the fridge.')).toBeVisible()

  await clearMockHassCalls(page)
  await dialog.getByRole('button', { name: 'Save Greek Yogurt' }).click()
  await expect.poll(() => everShelfInventoryCalls(page)).toContainEqual({
    domain: 'evershelf',
    service: 'delete_inventory',
    serviceData: { inventory_id: 203, quantity: 1 },
  })
})

test('thermostat room grid uses one equivalent column when any room label overflows', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/ecobee')

  const dialog = await openThermostatControls(page)
  const grid = dialog.getByRole('group', { name: 'Thermostat rooms' })
  const cells = grid.locator('[data-dynamic-grid-cell="true"]')
  await expect(grid).toHaveAttribute('data-dynamic-grid-columns', '1')
  await expect(cells).toHaveCount(11)

  const layout = await cells.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: Math.round(bounds.left),
      span: element.getAttribute('data-dynamic-grid-span'),
      width: Math.round(bounds.width),
    }
  }))
  expect(new Set(layout.map(({ left }) => left)).size).toBe(1)
  expect(new Set(layout.map(({ width }) => width)).size).toBe(1)
  expect(layout.every(({ span }) => span === '1')).toBe(true)
})

test('thermostat page keeps primary controls and three explained modal entry points compact', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/ecobee')

  const scroller = page.locator('main > div').nth(1)
  const dimensions = await scroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(dimensions.scrollHeight / dimensions.clientHeight).toBeLessThanOrEqual(2)
  await expect(page.getByRole('region', { name: /Whole Home thermostat/i })).toBeVisible()
  await expect(page.getByText(/View each room's temperature and occupancy/i)).toBeVisible()
  await expect(page.getByText('Manage Automatic Thermostat, Eco Mode, and Predictive Comfort settings.')).toBeVisible()
  await expect(page.getByText(/Choose which rooms participate in normal comfort/i)).toBeVisible()
  for (const label of ['Room Thermostats', 'Advanced Configuration', 'Room Tracking']) {
    const tile = page.getByRole('button', { exact: true, name: label })
    await expect(tile).toBeVisible()
    await expect(tile).toHaveAttribute('data-tone', 'switch')
    await expect(tile).toHaveAttribute('data-modal-opener', 'true')
    await expect(tile.locator('[data-dynamic-grid-label]')).toHaveCount(1)
  }
  await expect(page.getByRole('group', { name: 'Thermostat rooms' })).toHaveCount(0)
})

test('thermostat page entry points deep link to their matching modal tabs', async ({ page }) => {
  const cases = [
    { hash: '#thermostat-rooms', tab: 'Rooms' as const },
    { hash: '#thermostat-automation', tab: 'Automation' as const },
    { hash: '#thermostat-tracking', tab: 'Tracking' as const },
  ]

  for (const entry of cases) {
    await page.goto('/at-a-glance/ecobee')
    const dialog = await openThermostatControls(page, entry.tab)
    await expect(page).toHaveURL(new RegExp(`${entry.hash}$`))
    await expect(dialog.getByRole('tab', { name: entry.tab })).toHaveAttribute('aria-selected', 'true')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
  }

  for (const entry of cases) {
    await page.goto(`/at-a-glance/ecobee${entry.hash}`)
    const dialog = page.getByRole('dialog', { name: 'Thermostat · Advanced Controls' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('tab', { name: entry.tab })).toHaveAttribute('aria-selected', 'true')
  }

  await page.goto('/at-a-glance/ecobee')
  const dialog = await openThermostatControls(page, 'Automation')
  await dialog.getByRole('tab', { name: 'Tracking' }).click()
  await expect(page).toHaveURL(/#thermostat-tracking$/)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/at-a-glance\/ecobee$/)
  await page.goForward()
  await expect(page.getByRole('dialog', { name: 'Thermostat · Advanced Controls' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Tracking' })).toHaveAttribute('aria-selected', 'true')
})

test('thermostat modal uses root tabs and same-sheet detail pages', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/ecobee')

  const dialog = await openThermostatControls(page)
  await expect(dialog.getByText(/11 rooms/i)).toHaveCount(0)
  await expect(dialog.getByRole('tab', { name: 'Rooms' })).toHaveAttribute('aria-selected', 'true')
  const inactiveRoom = dialog.getByRole('button', { name: 'Living Room 70.2°F · Inactive' })
  const activeRoom = dialog.getByRole('button', { name: 'Office 71.6°F · Active' })
  await expect(inactiveRoom).toHaveAttribute('data-tone', 'switch')
  await expect(inactiveRoom).toHaveAttribute('data-muted', 'true')
  await expect(inactiveRoom).toHaveCSS('min-height', '120px')
  await expect(activeRoom).toHaveAttribute('data-tone', 'switch')
  await expect(activeRoom).toHaveAttribute('data-muted', 'false')
  await expect(activeRoom).toHaveCSS('min-height', '120px')
  await inactiveRoom.click()
  await expect(dialog).toHaveAccessibleName('Living Room')
  await dialog.getByRole('button', { name: 'Back to rooms' }).click()

  await dialog.getByRole('tab', { name: 'Automation' }).click()
  const automaticToggle = dialog.getByRole('switch', { name: 'Turn off Automatic Thermostat' })
  const ecoToggle = dialog.getByRole('switch', { name: 'Turn off Eco Mode' })
  const ecoNavigation = dialog.getByRole('button', { name: /Eco Mode Critical Tracking Track Select Critical/i })
  await expect(automaticToggle).toHaveAttribute('data-tone', 'switch')
  await expect(automaticToggle).toHaveAttribute('data-muted', 'false')
  await expect(automaticToggle).toHaveCSS('min-height', '120px')
  await expect(ecoToggle).toHaveAttribute('data-tone', 'switch')
  await expect(ecoToggle).toHaveAttribute('data-muted', 'false')
  await expect(ecoNavigation).toHaveAttribute('data-tone', 'switch')
  await expect(ecoNavigation).toHaveAttribute('data-modal-opener', 'true')
  await expect(ecoNavigation).toHaveCSS('min-height', '120px')
  await ecoNavigation.click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(dialog).toHaveAccessibleName('Eco Mode Critical Tracking')
  await expect(dialog.getByRole('group', { name: 'Eco Mode Critical Tracking options' })).not.toHaveAttribute('data-dynamic-grid')
  const selectedCriticalOption = dialog.getByRole('button', { name: /^Set Eco Mode Critical Tracking to Track Select Critical:/ })
  const unselectedCriticalOption = dialog.getByRole('button', { name: /^Set Eco Mode Critical Tracking to Track All Critical:/ })
  await expect(selectedCriticalOption).toHaveAttribute('data-tone', 'switch')
  await expect(selectedCriticalOption).toHaveAttribute('data-muted', 'false')
  await expect(selectedCriticalOption).toHaveCSS('min-height', '120px')
  await expect(selectedCriticalOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
  await expect(unselectedCriticalOption).toHaveAttribute('data-tone', 'switch')
  await expect(unselectedCriticalOption).toHaveAttribute('data-muted', 'true')
  await expect(unselectedCriticalOption).toHaveCSS('min-height', '120px')
  await expect(unselectedCriticalOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
  const criticalDescription = dialog.getByText('Protect only the unselected rooms chosen in Critical Protection.')
  await expect(criticalDescription).toBeVisible()
  await expect(selectedCriticalOption.getByText(/Protect only the unselected rooms/i)).toHaveCount(0)
  const criticalDescriptionBox = await criticalDescription.boundingBox()
  const selectedCriticalOptionBox = await selectedCriticalOption.boundingBox()
  expect((criticalDescriptionBox?.y ?? 0) + (criticalDescriptionBox?.height ?? 0)).toBeLessThanOrEqual(selectedCriticalOptionBox?.y ?? 0)
  await unselectedCriticalOption.click()
  await expect(dialog).toHaveAccessibleName('Eco Mode Critical Tracking')
  await expect(unselectedCriticalOption).toHaveAttribute('aria-pressed', 'true')
  await expect(unselectedCriticalOption).toHaveAttribute('data-muted', 'false')
  await expect(selectedCriticalOption).toHaveAttribute('aria-pressed', 'false')
  await expect(selectedCriticalOption).toHaveAttribute('data-muted', 'true')
  await dialog.getByRole('button', { name: 'Back to automation' }).click()
  await expect(dialog.getByRole('button', { name: /Eco Mode Critical Tracking Track Select Critical/i })).toBeFocused()
  await dialog.getByRole('button', { name: /Eco Behavior When Away Keep Eco Active/i }).click()
  const selectedAwayOption = dialog.getByRole('button', { name: /^Set Eco Behavior When Away to Keep Eco Active:/ })
  const unselectedAwayOption = dialog.getByRole('button', { name: /^Set Eco Behavior When Away to Disable Eco When Away:/ })
  await expect(selectedAwayOption).toHaveAttribute('data-tone', 'switch')
  await expect(selectedAwayOption).toHaveAttribute('data-muted', 'false')
  await expect(selectedAwayOption).toHaveCSS('min-height', '120px')
  await expect(selectedAwayOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
  await expect(unselectedAwayOption).toHaveAttribute('data-tone', 'switch')
  await expect(unselectedAwayOption).toHaveAttribute('data-muted', 'true')
  await expect(unselectedAwayOption).toHaveCSS('min-height', '120px')
  await expect(unselectedAwayOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
  const awayDescription = dialog.getByText('Keep normal Eco Mode behavior active while everyone is away.')
  await expect(awayDescription).toBeVisible()
  await expect(selectedAwayOption.getByText(/Keep normal Eco Mode behavior/i)).toHaveCount(0)
  const awayDescriptionBox = await awayDescription.boundingBox()
  const selectedAwayOptionBox = await selectedAwayOption.boundingBox()
  expect((awayDescriptionBox?.y ?? 0) + (awayDescriptionBox?.height ?? 0)).toBeLessThanOrEqual(selectedAwayOptionBox?.y ?? 0)
  await unselectedAwayOption.click()
  await expect(dialog).toHaveAccessibleName('Eco Behavior When Away')
  await expect(unselectedAwayOption).toHaveAttribute('aria-pressed', 'true')
  await expect(unselectedAwayOption).toHaveAttribute('data-muted', 'false')
  await expect(selectedAwayOption).toHaveAttribute('aria-pressed', 'false')
  await expect(selectedAwayOption).toHaveAttribute('data-muted', 'true')
  await dialog.getByRole('button', { name: 'Back to automation' }).click()

  await dialog.getByRole('tab', { name: 'Tracking' }).click()
  const selectedRooms = dialog.getByRole('button', { name: /Selected Rooms \d+ of 11 selected/i })
  const occupiedOnly = dialog.getByRole('button', { name: /Occupied Only 2 of 11 occupied only/i })
  await expect(selectedRooms).toHaveAttribute('data-tone', 'switch')
  await expect(selectedRooms).toHaveAttribute('data-modal-opener', 'true')
  await expect(selectedRooms).toHaveCSS('min-height', '120px')
  await expect(occupiedOnly).toHaveAttribute('data-tone', 'switch')
  await expect(occupiedOnly).toHaveCSS('min-height', '120px')
  await occupiedOnly.click()
  await expect(dialog).toHaveAccessibleName('Occupied Only')
  await expect(dialog.getByRole('button', { name: 'Guest Bathroom' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Back to tracking' }).click()
  await expect(dialog.getByRole('tab', { name: 'Tracking' })).toHaveAttribute('aria-selected', 'true')
})

test('thermostat page accepts the first mobile scroll gesture after closing a room modal', async ({ page }) => {
  await page.goto('/at-a-glance/ecobee')

  const dialog = await openThermostatControls(page)
  await dialog.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  await expect(dialog).toHaveAccessibleName('Living Room')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await expect(dialog).toHaveAttribute('inert')
  await expect(dialog).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => page.locator('[data-modal-sheet-overlay="true"]').evaluate((overlay) => getComputedStyle(overlay).pointerEvents)).toBe('none')
  await expect(dialog).toHaveCount(0, { timeout: 700 })

  const scroller = page.locator('main > div').nth(1)
  const { before, maxScrollTop } = await scroller.evaluate((element) => ({
    before: element.scrollTop,
    maxScrollTop: element.scrollHeight - element.clientHeight,
  }))
  const scrollerBox = await scroller.boundingBox()
  if (!scrollerBox) throw new Error('Ecobee page scroller was not measurable')
  const canScrollDown = before < maxScrollTop - 20
  const swipeX = scrollerBox.x + scrollerBox.width / 2
  const lowerSwipeY = scrollerBox.y + scrollerBox.height * 0.72
  const upperSwipeY = scrollerBox.y + scrollerBox.height * 0.28
  await swipeWithTouch(page, swipeX, canScrollDown ? lowerSwipeY : upperSwipeY, canScrollDown ? upperSwipeY : lowerSwipeY)
  if (canScrollDown) {
    await expect.poll(async () => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(before + 20)
  } else {
    await expect.poll(async () => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(before - 20)
  }
})

test('SleepyPod current marker aligns with a reached physical target', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('climate.sleepypod_eight_pod_left_side', 'heat')
    mock.setEntityAttribute('climate.sleepypod_eight_pod_left_side', 'current_temperature', 85)
    mock.setEntityState('number.master_bedroom_sleepypod_eight_pod_left_target_level', '1')
    mock.setEntityAttribute('number.master_bedroom_sleepypod_eight_pod_left_target_level', 'targetTemperature', 85)
    mock.setEntityState('sensor.sleepypod_stephen_schedule_phase', 'bedtime')
  })

  await page.getByRole('button', { name: /Stephen's Bed Heating • \+1/i }).click()

  const dial = page.getByRole('dialog').getByRole('region', { name: /Stephen's Bed thermostat Heating \+1 • 85°F/i })
  const target = dial.getByRole('slider', { name: "Stephen's Bed target level" })
  const current = dial.locator('[data-marker="current"]')
  expect(await dial.evaluate((element) => {
    const currentMarker = element.querySelector('[data-marker="current"]')
    const targetHandle = Array.from(element.querySelectorAll('[role="slider"]')).find((candidate) => !candidate.closest('[aria-hidden="true"]'))
    return Boolean(currentMarker && targetHandle && (currentMarker.compareDocumentPosition(targetHandle) & Node.DOCUMENT_POSITION_FOLLOWING))
  })).toBe(true)
  await expect.poll(async () => {
    const targetBox = await target.boundingBox()
    const currentBox = await current.boundingBox()
    if (!targetBox || !currentBox) return Number.POSITIVE_INFINITY
    const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }
    const currentCenter = { x: currentBox.x + currentBox.width / 2, y: currentBox.y + currentBox.height / 2 }
    return Math.hypot(currentCenter.x - targetCenter.x, currentCenter.y - targetCenter.y)
  }).toBeLessThanOrEqual(0.5)
})

test('SleepyPod hot flash keeps the cancel action stable from cooling through the hold', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('climate.sleepypod_eight_pod_left_side', 'heat')
    mock.setEntityState('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2')
    mock.setEntityState('sensor.sleepypod_stephen_schedule_phase', 'bedtime')
    mock.setEntityState('input_boolean.eight_sleep_stephen_hot_flash_active', 'off')
    mock.setEntityState('timer.eight_sleep_stephen_hot_flash', 'idle')
  })

  await page.getByRole('button', { name: /Stephen's Bed Cooling/i }).click()
  const dialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  await dialog.getByRole('tab', { name: 'Special Modes' }).click()
  await dialog.getByRole('button', { name: 'Hot Flash Mode Inactive' }).click()

  const dial = dialog.getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })
  const fixedTarget = dial.locator('[data-marker="target"]')
  const currentMarker = dial.locator('[data-marker="current"]')
  await expect(fixedTarget).toBeVisible()
  await expect(fixedTarget).toHaveAttribute('data-value', '-10')
  await expect(currentMarker).toBeVisible()
  expect(Number(await currentMarker.getAttribute('data-value'))).toBeCloseTo(-0.55, 2)
  await expect(dialog.getByRole('slider', { name: "Stephen's Bed target level" })).toHaveCount(0)
  await expect(page.locator("button[aria-label=\"Stephen's Bed Hot Flash Mode • Cooling\"]")).toHaveCount(1)

  const cancel = dialog.getByRole('button', { name: "Cancel Stephen's Bed hot flash mode" })
  const status = cancel.locator('..')
  const phase = status.locator('span')
  await expect(phase).toHaveText('Cooling Bed')
  await expect(cancel).toBeVisible()
  const coolingPhaseBox = await phase.boundingBox()
  const coolingCancelBox = await cancel.boundingBox()
  if (!coolingPhaseBox || !coolingCancelBox) throw new Error('Hot Flash cooling status was not measurable')

  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityAttribute('timer.eight_sleep_stephen_hot_flash', 'remaining', '0:15:00')
    mock.setEntityState('timer.eight_sleep_stephen_hot_flash', 'active')
  })

  await expect(phase).toHaveText('15:00')
  await expect(page.locator("button[aria-label=\"Stephen's Bed 15:00 Remaining\"]")).toHaveCount(1)
  const holdingPhaseBox = await phase.boundingBox()
  const holdingCancelBox = await cancel.boundingBox()
  if (!holdingPhaseBox || !holdingCancelBox) throw new Error('Hot Flash hold status was not measurable')
  expect(Math.abs(Math.round(holdingPhaseBox.width) - Math.round(coolingPhaseBox.width))).toBeLessThanOrEqual(1)
  expect(Math.abs(Math.round(holdingCancelBox.x) - Math.round(coolingCancelBox.x))).toBeLessThanOrEqual(1)

  await cancel.click()
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'input_button' && typeof call.target === 'string' && call.target.includes('eight_sleep_stephen'))
  ))).toEqual([
    { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_hot_flash' },
    { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_cancel_hot_flash' },
  ])
})

test("SleepyPod active alarm actions stay per-side and optimistic", async ({ page }) => {
  await page.goto("/at-a-glance/master-bedroom")
  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    mock.setEntityState("sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state", "ringing")
    mock.setEntityState("sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state", "ringing")
  })
  await page.getByRole("button", { name: /Steph.s Bed Off/i }).click()

  const dialog = page.getByRole("dialog", { name: /Steph.s Bed/ })
  const section = dialog.locator("[data-sleepypod-side=\"right\"]")
  const hero = dialog.locator("[data-section=\"eight-sleep-hero\"]")
  const panel = dialog.locator("[data-scroll-region=\"eight-sleep-panel\"]")
  await expect(section.getByRole("heading", { name: "Alarm Active" })).toBeVisible()
  await expect(section.getByText("Ringing")).toBeVisible()
  await expect(dialog.getByRole("group", { name: /Steph.s Bed active alarm controls/ })).toBeVisible()
  await expect(dialog.getByRole("group", { name: /Stephen.s Bed active alarm controls/ })).toHaveCount(0)
  await expect(panel.getByRole("heading", { name: "Sleep Schedule" })).toBeVisible()
  await expect(hero).toBeVisible()
  await expect.poll(() => section.evaluate((element) => ({
    followsHero: element.previousElementSibling?.getAttribute("data-section") === "eight-sleep-hero",
    panelFollowsSectionColumn: element.parentElement?.nextElementSibling?.getAttribute("data-scroll-region") === "eight-sleep-panel",
  }))).toEqual({ followsHero: true, panelFollowsSectionColumn: true })

  const snooze = section.getByRole("button", { name: "Snooze" })
  const stop = section.getByRole("button", { name: "Stop Alarm" })
  await expect.poll(() => snooze.evaluate((element) => getComputedStyle(element).getPropertyValue("--card-rgb").trim())).toBe("10 132 255")
  await expect.poll(() => stop.evaluate((element) => getComputedStyle(element).getPropertyValue("--card-rgb").trim())).toBe("229 57 53")

  await snooze.click()
  await expect(section).toHaveAttribute("data-alarm-state", "snoozed")
  const snoozing = section.getByRole("button", { name: /Snoozing, 5:00 Remaining/ })
  await expect(snoozing).toBeVisible()
  await expect(snoozing).toBeDisabled()
  await expect.poll(() => snoozing.evaluate((element) => getComputedStyle(element).getPropertyValue("--card-rgb").trim())).toBe("122 122 128")
  await expect(section.getByText("Snoozing")).toBeVisible()
  await expect(section.getByText("5:00 Remaining")).toBeVisible()
  await expect(section.getByText(/Snoozed until/i)).toHaveCount(0)
  await expect(section.getByText("Ringing")).toHaveCount(0)
  await expect.poll(() => section.evaluate((element) => {
    const actions = element.querySelector('[role="group"]')
    const heading = element.querySelector("h2")
    if (!actions || !heading) return null
    return Math.round(actions.getBoundingClientRect().top - heading.getBoundingClientRect().bottom)
  })).toBeLessThanOrEqual(24)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.filter((call) => call.domain === "button" && typeof call.target === "string" && call.target.includes("sleepypod_eight_pod_right_alarm_")))).toEqual([
    { domain: "button", service: "press", target: "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze" },
  ])

  await stop.click()
  await expect(dialog.getByRole("heading", { name: "Alarm Active" })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.filter((call) => call.domain === "button" && typeof call.target === "string" && call.target.includes("sleepypod_eight_pod_right_alarm_")))).toEqual([
    { domain: "button", service: "press", target: "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze" },
    { domain: "button", service: "press", target: "button.master_bedroom_sleepypod_eight_pod_right_alarm_stop" },
  ])
})


test.describe('desktop modal layout', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } })

  test("desktop SleepyPod active alarm controls scroll fully into view below the hero", async ({ page }) => {
    await page.goto("/at-a-glance/master-bedroom")
    await page.evaluate(() => {
      const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
      mock.setEntityState("sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state", "ringing")
    })
    await page.getByRole("button", { name: /Steph.s Bed Off/i }).click()

    const dialog = page.getByRole("dialog", { name: /Steph.s Bed/ })
    const heroColumn = dialog.locator("[data-scroll-region=\"eight-sleep-hero-column\"]")
    const section = heroColumn.locator("[data-sleepypod-side=\"right\"]")
    const controls = section.getByRole("group", { name: /Steph.s Bed active alarm controls/ })
    await expect(section.getByRole("heading", { name: "Alarm Active" })).toBeAttached()
    await expect.poll(() => heroColumn.evaluate((element) => ({
      boundedByBody: element.clientHeight <= (element.parentElement?.clientHeight ?? 0) + 1,
      overflowY: getComputedStyle(element).overflowY,
    }))).toEqual({ boundedByBody: true, overflowY: "auto" })
    await expect.poll(() => section.evaluate((element) => element.previousElementSibling?.getAttribute("data-section"))).toBe("eight-sleep-hero")

    await heroColumn.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(() => controls.evaluate((element) => {
      const column = element.closest("[data-scroll-region=\"eight-sleep-hero-column\"]")
      const columnBox = column?.getBoundingClientRect()
      const buttons = Array.from(element.querySelectorAll("button"))
      return Boolean(columnBox && buttons.length === 2 && buttons.every((button) => {
        const box = button.getBoundingClientRect()
        return box.top >= columnBox.top - 1 && box.bottom <= columnBox.bottom + 1
      }))
    })).toBe(true)
    await expect(controls.getByRole("button", { name: "Snooze" })).toBeVisible()
    await expect(controls.getByRole("button", { name: "Stop Alarm" })).toBeVisible()
  })

  test('rooms modal uses fixed 168px square room cards on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    const dialog = await openRoomsFromQuickLinks(page)

    await expect.poll(async () => {
      return dialog.locator('section[aria-label="Rooms"]').evaluate((grid) => {
        const rects = Array.from(grid.children)
          .map((child) => child.firstElementChild?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => Boolean(rect))
        const firstCardRect = rects[0]
        const columns = new Set(rects.map((rect) => Math.round(rect.left))).size
        const rows = new Set(rects.map((rect) => Math.round(rect.top))).size
        return {
          cardCount: grid.children.length,
          firstCardHeight: Math.round(firstCardRect?.height ?? 0),
          firstCardWidth: Math.round(firstCardRect?.width ?? 0),
          columns,
          fitsAllRooms: columns * rows >= grid.children.length,
          rows,
          scrollsHorizontally: grid.scrollWidth > grid.clientWidth + 1,
        }
      })
    }).toMatchObject({
      cardCount: 16,
      firstCardHeight: DIALOG_SQUARE_TILE_SIZE,
      firstCardWidth: DIALOG_SQUARE_TILE_SIZE,
      columns: 3,
      fitsAllRooms: true,
      rows: 6,
      scrollsHorizontally: false,
    })
    const firstCard = dialog.locator('section[aria-label="Rooms"] > div').first()
    const box = await firstCard.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.round(box?.height ?? 0))
    const dialogBox = await dialog.boundingBox()
    const gridBox = await dialog.locator('section[aria-label="Rooms"]').boundingBox()
    await expectSharedDesktopFrame(dialog)
    expect(Math.abs(
      Math.round((gridBox?.x ?? 0) - (dialogBox?.x ?? 0))
      - Math.round(((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)) - ((gridBox?.x ?? 0) + (gridBox?.width ?? 0))),
    )).toBeLessThanOrEqual(2)

  })

  test('Quick Links modal keeps compact text-aware navigation on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/at-a-glance/settings')
    await page.getByRole('button', { name: 'Quick Links' }).click()

    const dialog = page.getByRole('dialog', { name: 'Quick Links' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => dialog.getByRole('group', { name: 'Quick Links', exact: true }).evaluate((grid) => {
      const columns = Number(grid.getAttribute('data-dynamic-grid-columns'))
      const buttons = Array.from(grid.querySelectorAll('button'))
      return {
        cardCount: grid.children.length,
        centered: Math.abs(
          (grid.getBoundingClientRect().left + grid.getBoundingClientRect().right) / 2
          - (grid.parentElement!.getBoundingClientRect().left + grid.parentElement!.getBoundingClientRect().right) / 2,
        ) <= 1,
        columns,
        compactTiles: buttons.every((button) => {
          const rect = button.getBoundingClientRect()
          return rect.width <= grid.clientWidth + 1 && Math.round(rect.height) === 88
        }),
        contentFits: buttons.every((button) => button.scrollHeight <= button.clientHeight + 1 && button.scrollWidth <= button.clientWidth + 1),
        gridWidth: Math.round(grid.getBoundingClientRect().width),
        scrollsHorizontally: grid.scrollWidth > grid.clientWidth + 1,
      }
    })).toEqual({
      cardCount: 6,
      centered: true,
      columns: 4,
      compactTiles: true,
      contentFits: true,
      gridWidth: 670,
      scrollsHorizontally: false,
    })
  })

  test('desktop modal has no grabber and cannot be dragged', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    const dialog = await openRoomsFromQuickLinks(page)
    await page.waitForTimeout(250)
    await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)

    const before = await dialog.boundingBox()
    if (!before) throw new Error('Rooms modal was not measurable before drag')
    await page.mouse.move(before.x + before.width / 2, before.y + 36)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2, before.y + 180)
    await page.mouse.up()

    await expect(dialog).toBeVisible()
    const after = await dialog.boundingBox()
    expect(Math.abs(Math.round(after?.x ?? 0) - Math.round(before.x))).toBeLessThanOrEqual(8)
    expect(Math.abs(Math.round(after?.y ?? 0) - Math.round(before.y))).toBeLessThanOrEqual(8)
  })

  test('room-source vacuum zones tab scrolls above its constrained desktop modal nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 620 })
    await page.goto('/at-a-glance/living-room')

    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: 'Zones' }).click()
    await expect(dialog.getByRole('heading', { name: 'Zones' })).toBeVisible()

    const zonesPane = dialog.getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    const modalNav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
    const diningRoomZone = dialog.getByRole('button', { name: 'Dining Room' })
    await expect.poll(async () => zonesPane.evaluate((element) => {
      const style = window.getComputedStyle(element)
      element.scrollTop = element.scrollHeight
      return {
        canScroll: element.scrollTop > 0,
        overflows: element.scrollHeight > element.clientHeight + 1,
        overflowY: style.overflowY,
      }
    })).toEqual({
      canScroll: true,
      overflows: true,
      overflowY: 'auto',
    })
    await expect.poll(async () => diningRoomZone.evaluate((zoneElement) => {
      const zoneBox = zoneElement.getBoundingClientRect()
      const navBox = document.querySelector('[role="tablist"][aria-label="Main Floor modal sections"]')?.getBoundingClientRect()
      return Boolean(navBox && zoneBox.bottom <= navBox.top - 4)
    })).toBe(true)
    await expect(modalNav).toBeVisible()
  })

  test('media remote modal uses the stable workspace height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('/at-a-glance/living-room')
    await page.getByRole('button', { name: /^Living Room Remote Off$/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-size', 'workspace')
    await expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    await expect.poll(async () => Math.round((await dialog.boundingBox())?.height ?? 0)).toBe(696)
  })

  test('bed modal uses the shared landscape frame on a short wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.goto('/at-a-glance/master-bedroom')
    await page.getByRole('button', { name: /Steph's Bed Off/i }).click()

    const dialog = page.getByRole('dialog', { name: "Steph's Bed" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
    await expect(dialog).toHaveAttribute('data-size', 'workspace')
    await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      return { height: Math.round(box?.height ?? 0), width: Math.round(box?.width ?? 0) }
    }).toEqual({ height: 484, width: 1256 })

    await dialog.getByRole('tab', { name: 'Alarms' }).click()
    const body = dialog.locator('[data-layout="eight-sleep-modal-body"]')
    const modalBody = dialog.locator('[data-modal-sheet-body="true"]')
    const hero = dialog.locator('[data-section="eight-sleep-hero"]')
    const panel = dialog.locator('[data-scroll-region="eight-sleep-panel"]')
    const footer = dialog.getByRole('tablist', { name: "Steph's Bed modal sections" }).locator('..')
    await expect(hero.getByText('Use the power control to turn on the Pod.')).toBeVisible()
    const offHeroBox = await hero.boundingBox()
    await hero.getByRole('button', { name: "Turn on Steph's Bed" }).click()
    await expect(hero.getByText('Tap or drag the dial to set the target.')).toBeVisible()
    await modalBody.evaluate((element) => {
      element.scrollTop = 0
    })
    const onHeroBox = await hero.boundingBox()
    if (!offHeroBox) throw new Error('Eight Sleep hero was not measurable before toggling on')
    if (!onHeroBox) throw new Error('Eight Sleep hero was not measurable after toggling on')
    expect(Math.abs(Math.round(onHeroBox.height) - Math.round(offHeroBox.height))).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.round(onHeroBox.y) - Math.round(offHeroBox.y))).toBeLessThanOrEqual(1)
    await expect(panel).toHaveAttribute('aria-label', "Steph's Bed Alarms")
    await expect(body).toHaveCSS('overflow', 'visible')
    const modalBodyBox = await modalBody.boundingBox()
    const markerBox = await hero.locator('[data-target="value"]').boundingBox()
    const beforeScrollHeroBox = await hero.boundingBox()
    const beforeScrollFooterBox = await footer.boundingBox()
    if (!modalBodyBox || !markerBox) throw new Error('Eight Sleep marker clearance was not measurable')
    if (!beforeScrollHeroBox || !beforeScrollFooterBox) throw new Error('Eight Sleep scroll layout was not measurable')
    expect(markerBox.y).toBeGreaterThanOrEqual(modalBodyBox.y)
    expect(Math.round(markerBox.width)).toBe(64)
    expect(Math.round(markerBox.height)).toBe(64)

    await modalBody.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(async () => modalBody.evaluate((element) => Math.round(element.scrollTop))).toBeGreaterThan(0)

    const afterScrollHeroBox = await hero.boundingBox()
    const afterScrollFooterBox = await footer.boundingBox()
    expect(Math.round(afterScrollHeroBox?.y ?? 0)).toBeLessThan(Math.round(beforeScrollHeroBox.y))
    expect(Math.abs(Math.round(afterScrollFooterBox?.y ?? 0) - Math.round(beforeScrollFooterBox.y))).toBeLessThanOrEqual(1)

    await dialog.getByRole('tab', { name: 'Special Modes' }).click()
    await expect(panel).toHaveAttribute('aria-label', "Steph's Bed Special Modes")
    await expect.poll(async () => modalBody.evaluate((element) => Math.round(element.scrollTop))).toBe(0)
    await expect.poll(async () => {
      return panel.evaluate((element) => {
        const heading = element.querySelector('h2')
        const description = Array.from(element.querySelectorAll('div')).find((candidate) => candidate.textContent?.startsWith('Activating hot flash mode'))
        const button = element.querySelector('button')
        const headingBox = heading?.getBoundingClientRect()
        const descriptionBox = description?.getBoundingClientRect()
        const buttonBox = button?.getBoundingClientRect()
        const descriptionGap = Math.round((descriptionBox?.top ?? 0) - (headingBox?.bottom ?? 0))
        const buttonGap = Math.round((buttonBox?.top ?? 0) - (descriptionBox?.bottom ?? 0))
        return {
          compactNaturalGaps: descriptionGap > 0 && descriptionGap <= 24 && buttonGap > 0 && buttonGap <= 40,
          panelAlignItems: getComputedStyle(element).alignItems,
          sectionAlignContent: getComputedStyle(element.querySelector('section') as Element).alignContent,
        }
      })
    }).toEqual({
      compactNaturalGaps: true,
      panelAlignItems: 'normal',
      sectionAlignContent: 'normal',
    })
  })

  test('desktop modal preserves its size during the close fade', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    const dialog = await openRoomsFromQuickLinks(page)
    const roomGrid = dialog.locator('section[aria-label="Rooms"]')
    await expect(roomGrid).toBeVisible()
    await expect.poll(async () => {
      return roomGrid.evaluate((gridElement) => {
        const firstCard = gridElement.firstElementChild?.firstElementChild
        const firstCardRect = firstCard?.getBoundingClientRect()
        return {
          cardHeight: Math.round(firstCardRect?.height ?? 0),
          cardWidth: Math.round(firstCardRect?.width ?? 0),
        }
      })
    }).toEqual({
      cardHeight: DIALOG_SQUARE_TILE_SIZE,
      cardWidth: DIALOG_SQUARE_TILE_SIZE,
    })

    const before = await dialog.boundingBox()
    if (!before) throw new Error('Rooms modal was not measurable before closing')

    const frames = await page.evaluate(async () => {
      const dialogElement = document.querySelector('[role="dialog"]') as HTMLElement | null
      const closeButton = dialogElement?.querySelector('button[aria-label="Close"]') as HTMLButtonElement | null
      if (!dialogElement || !closeButton) return []

      const samples: Array<{ height: number; width: number }> = []
      closeButton.click()
      const start = performance.now()

      await new Promise<void>((resolve) => {
        const sample = () => {
          if (!document.body.contains(dialogElement)) {
            resolve()
            return
          }

          const rect = dialogElement.getBoundingClientRect()
          samples.push({ height: Math.round(rect.height), width: Math.round(rect.width) })
          if (performance.now() - start >= 150) {
            resolve()
            return
          }
          requestAnimationFrame(sample)
        }

        requestAnimationFrame(sample)
      })

      return samples
    })

    expect(frames.length).toBeGreaterThan(2)
    expect(Math.max(...frames.map((frame) => Math.abs(frame.width - Math.round(before.width))))).toBeLessThanOrEqual(2)
    expect(Math.max(...frames.map((frame) => Math.abs(frame.height - Math.round(before.height))))).toBeLessThanOrEqual(2)
  })

  test('home lights modal uses fixed 168px square room cards on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview#lights-overview')

    const dialog = page.getByRole('dialog', { name: /Lights/ })
    await expect(dialog).toBeVisible()

    const section = dialog.getByRole('region', { name: 'Lights by room' })
    const roomButtons = section.getByRole('button', { name: /^Open / })
    await expect.poll(async () => {
      return roomButtons.evaluateAll((elements, expectedCardSize) => {
        const rects = elements.map((element) => element.getBoundingClientRect())
        return {
          allFixedHeight: rects.every((rect) => Math.round(rect.height) === expectedCardSize),
          allFixedWidth: rects.every((rect) => Math.round(rect.width) === expectedCardSize),
          cardCount: rects.length,
          squareCards: rects.every((rect) => Math.round(rect.width) === Math.round(rect.height)),
        }
      }, DIALOG_SQUARE_TILE_SIZE)
    }).toMatchObject({
      allFixedHeight: true,
      allFixedWidth: true,
      cardCount: 17,
      squareCards: true,
    })
    const firstCard = roomButtons.first()
    const box = await firstCard.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.round(box?.height ?? 0))
    const dialogBox = await dialog.boundingBox()
    const gridBox = await section.boundingBox()
    await expectSharedDesktopFrame(dialog)
    expect(gridBox?.x ?? 0).toBeGreaterThanOrEqual((dialogBox?.x ?? 0) + 23)
    expect((gridBox?.x ?? 0) + (gridBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) - 23)

    const livingRoomButton = section.getByRole('button', { name: /Open Living Room Lights/i })
    const livingRoomBox = await livingRoomButton.boundingBox()
    if (!livingRoomBox) throw new Error('Living Room Lights button was not measurable')
    const clickX = livingRoomBox.x + livingRoomBox.width / 2
    const clickY = livingRoomBox.y + livingRoomBox.height / 2
    await page.mouse.move(clickX, clickY)
    await page.mouse.down()
    await page.mouse.move(clickX, clickY + 4)
    await page.mouse.up()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Living Room Lights' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to room lights' })).toBeVisible()
  })

  test('security system uses the shared desktop frame and full-width controls', async ({ page }) => {
    await page.goto('/at-a-glance/overview#security-system')

    const dialog = page.getByRole('dialog', { name: 'Security System' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Armed Home', { exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Current security system state Armed Home')).toHaveCount(0)

    await expectSharedDesktopFrame(dialog)
    await expect(dialog).toHaveAttribute('data-modal-content-width', 'full')
    expect(Math.round((await dialog.locator('[data-modal-content-measure="true"]').boundingBox())?.width ?? 0)).toBe(1050)
  })

  test('thermostat room modal keeps its reading measure inside the shared desktop frame', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee#living-room')

    const dialog = page.getByRole('dialog', { name: 'Living Room' })
    await expect(dialog).toBeVisible()
    const thermostatHero = dialog.getByLabel('Living Room thermostat control')
    const vents = dialog.getByLabel('Living Room Vents')
    await expect(thermostatHero).toBeVisible()
    await expect(vents).toBeVisible()
    const ventGrid = vents.locator(':scope > div').nth(1)

    await expectSharedDesktopFrame(dialog)
    const dialogBox = await dialog.boundingBox()
    const heroBox = await thermostatHero.boundingBox()
    const ventsBox = await vents.boundingBox()
    if (!dialogBox || !heroBox || !ventsBox) throw new Error('Thermostat modal layout was not measurable')

    expect(Math.round((await dialog.locator('[data-modal-content-measure="true"]').boundingBox())?.width ?? 0)).toBe(670)
    expect(heroBox.x).toBeLessThan(ventsBox.x)
    expect(Math.abs(heroBox.y - ventsBox.y)).toBeLessThanOrEqual(24)
    expect(heroBox.y + heroBox.height).toBeGreaterThan(ventsBox.y)
    await expect.poll(async () => ventGrid.evaluate((gridElement) => {
      const firstCardRect = gridElement.firstElementChild?.getBoundingClientRect()
      const gridRect = gridElement.getBoundingClientRect()
      const gridStyle = window.getComputedStyle(gridElement)
      return {
        cardFillsContainer: Math.round(firstCardRect?.width ?? 0) >= Math.round(gridRect.width) - 2,
        columns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
      }
    })).toEqual({ cardFillsContainer: true, columns: 1 })
  })

  test('thermostat hub mode uses security-style desktop picker without separator', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')

    await page.getByLabel(/Thermostat Hub Mode Off/i).click()
    const dialog = page.getByRole('dialog', { name: 'Thermostat Hub Mode' })
    await expect(dialog).toBeVisible()
    const options = dialog.getByRole('group', { name: 'Thermostat Hub Mode options' })
    await expect(options).toHaveAttribute('data-layout', 'compact-grid')
    await expect(dialog.locator('span[aria-hidden="true"][class*="separator"]')).toHaveCount(0)

    await expectSharedDesktopFrame(dialog)
    expect(Math.round((await options.boundingBox())?.width ?? 0)).toBeLessThanOrEqual(500)
    await expect.poll(async () => options.evaluate((optionsElement) => {
      const firstOption = optionsElement.querySelector(':scope > button')?.getBoundingClientRect()
      const style = window.getComputedStyle(optionsElement)
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        optionHeight: Math.round(firstOption?.height ?? 0),
      }
    })).toEqual({ columns: 2, optionHeight: 74 })
  })

  test('eco mode pickers use vertical GlassTile stacks without separators', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')
    const dialog = await openThermostatControls(page)
    await dialog.getByRole('tab', { name: 'Automation' }).click()

    const assertCardPicker = async (triggerName: RegExp, dialogName: string) => {
      await dialog.getByLabel(triggerName).click()
      await expect(dialog).toHaveAccessibleName(dialogName)
      const options = dialog.getByRole('group', { name: `${dialogName} options` })
      await expect(options).not.toHaveAttribute('data-dynamic-grid')
      await expect(dialog.locator('span[aria-hidden="true"][class*="separator"]')).toHaveCount(0)

      await expectSharedDesktopFrame(dialog)
      expect(Math.round((await options.boundingBox())?.width ?? 0)).toBeLessThanOrEqual(670)
      await expect.poll(async () => options.evaluate((optionsElement) => {
        const firstOption = optionsElement.firstElementChild?.querySelector('button')?.getBoundingClientRect()
        const style = window.getComputedStyle(optionsElement)
        return {
          columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
          optionHeight: Math.round(firstOption?.height ?? 0),
        }
      })).toEqual({ columns: 1, optionHeight: 120 })
      const selectedOption = options.getByRole('button', { pressed: true })
      const unselectedOption = options.getByRole('button', { pressed: false }).first()
      await expect(selectedOption).toHaveAttribute('data-tone', 'switch')
      await expect(selectedOption).toHaveAttribute('data-muted', 'false')
      await expect(selectedOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
      await expect(unselectedOption).toHaveAttribute('data-tone', 'switch')
      await expect(unselectedOption).toHaveAttribute('data-muted', 'true')
      await expect(unselectedOption.locator('[data-dynamic-grid-label]')).toHaveCount(1)
      await dialog.getByRole('button', { name: 'Back to automation' }).click()
      await expect(dialog).toHaveAccessibleName('Thermostat · Advanced Controls')
    }

    await assertCardPicker(/Eco Mode Critical Tracking Track Select Critical/i, 'Eco Mode Critical Tracking')
    await assertCardPicker(/Eco Behavior When Away Keep Eco Active/i, 'Eco Behavior When Away')
  })

  const squareOverviewCases = [
    {
      backButtonName: 'Back to room climates',
      buttonName: /Open Living Room Climate/i,
      detailHeading: 'Living Room Climate',
      dialogName: 'Climate',
      hash: '#climate-overview',
      sectionLabel: 'Climate by room',
    },
    {
      backButtonName: 'Back to room occupancy',
      buttonName: /Open Living Room Occupancy/i,
      detailHeading: 'Living Room Occupancy',
      dialogName: 'Occupancy',
      hash: '#occupancy-overview',
      sectionLabel: 'Occupancy by room',
    },
    {
      backButtonName: 'Back to room contact sensors',
      buttonName: /Open Living Room Contact Sensors/i,
      detailHeading: 'Living Room Contact Sensors',
      dialogName: 'Contact Sensors',
      hash: '#contact-sensors-overview',
      sectionLabel: 'Contact sensors by room',
    },
    {
      dialogName: 'Air Quality',
      hash: '#aqi-overview',
      sectionLabel: 'AQI by room',
    },
  ]

  for (const modalCase of squareOverviewCases) {
    test(`${modalCase.dialogName} modal uses compact fixed square room grid on desktop`, async ({ page }) => {
      await page.goto(`/at-a-glance/overview${modalCase.hash}`)

      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      const grid = await expectDesktopSquareGrid(dialog, modalCase.sectionLabel)
      const overviewDialogBox = await dialog.boundingBox()

      if ('buttonName' in modalCase) {
        await clickWithPointerJitter(page, grid.getByRole('button', { name: modalCase.buttonName }))
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('heading', { name: modalCase.detailHeading })).toBeVisible()
        await expect(dialog.getByRole('button', { name: modalCase.backButtonName })).toBeVisible()
        await expectSharedDesktopFrame(dialog)
        if (modalCase.dialogName === 'Contact Sensors') {
          const detailDialogBox = await dialog.boundingBox()
          expect(Math.abs(Math.round(detailDialogBox?.height ?? 0) - Math.round(overviewDialogBox?.height ?? 0))).toBeLessThanOrEqual(2)
        }
      }
    })
  }

  const adminSquareCases = [
    {
      dialogName: 'Presence-Based Overrides',
      gridLabel: 'Presence-Based Overrides by room',
      hash: '#presence-based-overrides',
    },
    {
      dialogName: 'Presence-Based Overrides Auto-Reset',
      gridLabel: 'Presence-Based Auto-Reset by room',
      hash: '#presence-based-overrides-auto',
    },
  ]

  for (const modalCase of adminSquareCases) {
    test(`${modalCase.dialogName} modal uses compact fixed square admin cards on desktop`, async ({ page }) => {
      await page.goto(`/at-a-glance/admin${modalCase.hash}`)

      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      await expectDesktopAdminSquareGrid(dialog, modalCase.gridLabel)
    })
  }

  test('security page contact chip opens the same desktop contact sensors modal as Home', async ({ page }) => {
    await page.goto('/at-a-glance/security')

    await page.getByRole('button', { name: /Contact Sensors\s*All Closed/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Contact Sensors' })
    await expect(dialog).toBeVisible()
    const grid = await expectDesktopSquareGrid(dialog, 'Contact sensors by room')
    const overviewDialogBox = await dialog.boundingBox()

    await clickWithPointerJitter(page, grid.getByRole('button', { name: /Open Living Room Contact Sensors/i }))
    await expect(dialog.getByRole('heading', { name: 'Living Room Contact Sensors' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to room contact sensors' })).toBeVisible()
    const detailDialogBox = await dialog.boundingBox()
    expect(Math.abs(Math.round(detailDialogBox?.height ?? 0) - Math.round(overviewDialogBox?.height ?? 0))).toBeLessThanOrEqual(2)
  })
})

test('Guest Controls settings uses a dynamic two-column grid with a full-width final control', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/settings?path=guests-staying-over')

  const grid = page.getByRole('group', { name: 'Guest controls' })
  const cells = grid.locator('[data-dynamic-grid-cell="true"]')
  await expect(cells).toHaveCount(3)
  await expect.poll(async () => cells.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-dynamic-grid-span')))).toEqual(['1', '1', '2'])

  const layout = await cells.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: Math.round(bounds.left),
      top: Math.round(bounds.top),
      width: Math.round(bounds.width),
    }
  }))
  expect(layout[0].top).toBe(layout[1].top)
  expect(layout[0].width).toBe(layout[1].width)
  expect(layout[2].left).toBe(layout[0].left)
  expect(layout[2].width).toBeGreaterThan(layout[0].width)
})

test('settings links to Vacation mode controls', async ({ page }) => {
  await page.goto('/at-a-glance/settings')
  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    mock.setEntityState('input_boolean.vacation_mode', 'on')
  })

  await expect(page.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i })).toBeVisible()
  await page.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i }).click()

  await expect(page).toHaveURL(/\/at-a-glance\/settings\?path=vacation/)
  await expect(page.getByRole('heading', { name: 'Vacation Mode', exact: true })).toBeVisible()
  await expect(page.getByText('Enable or disable vacation mode for the house')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vacation Mode On' })).toHaveCSS('outline-style', 'none')
  await expect(page.getByRole('heading', { name: 'Vacation Dates' })).toBeVisible()
  await expect(page.getByText('Set the start and end time for your vacation. Vacation mode will automatically be turned off at the set end date and time.')).toBeVisible()
  await expect(page.getByLabel('Start Date')).toHaveAttribute('type', 'date')
  await expect(page.getByLabel('End Time')).toHaveAttribute('type', 'time')
  for (const label of ['Start Date', 'Start Time', 'End Date', 'End Time']) {
    await expect(page.getByText(label, { exact: true })).toHaveCSS('text-align', 'start')
    await expect(page.getByLabel(label)).toHaveCSS('text-align', 'start')
  }
  await page.evaluate(() => {
    window.__vacationPickerCalls = 0
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value() {
        window.__vacationPickerCalls = (window.__vacationPickerCalls ?? 0) + 1
      },
    })
  })
  const endDateCard = page.getByText('End Date', { exact: true }).locator('..')
  await expect(endDateCard).toHaveCSS('cursor', 'default')
  await endDateCard.click({ position: { x: 8, y: 8 } })
  await expect.poll(() => page.evaluate(() => window.__vacationPickerCalls ?? 0)).toBe(1)
  await page.getByLabel('Start Date').click()
  await expect(page.getByLabel('Start Date').locator('..')).toHaveCSS('outline-style', 'none')
})

test('settings links to Special Device Modes and toggles High AQI intent', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/settings')

  const settingsPages = page.getByRole('navigation', { name: 'Settings pages' })
  const specialDeviceModes = page.getByRole('button', { name: /Special Device Modes Allows enabling special device modes, such as High AQI Mode\./i })
  await expect(settingsPages.getByRole('button').nth(1)).toHaveAccessibleName(/Special Device Modes Allows enabling special device modes, such as High AQI Mode\./i)
  await expect(specialDeviceModes).toHaveAttribute('data-action-kind', 'navigate')
  await specialDeviceModes.click()

  await expect(page).toHaveURL(/\/at-a-glance\/settings\?path=special-device-modes/)
  await expect(page.getByRole('heading', { name: 'Special Device Modes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'High AQI Mode' })).toBeVisible()
  await expect(page.getByText('Toggling High AQI Mode sets all air purifiers in the house to their highest setting to ward off smoke and other inhalation hazards.')).toBeVisible()

  const mode = page.getByRole('switch', { name: /High AQI Mode/ })
  await expect(mode).toHaveAccessibleName('High AQI Mode Off')
  await expect(mode).toHaveAttribute('aria-checked', 'false')
  await expect(mode).toHaveAttribute('data-action-kind', 'toggle')
  await expectNoChevron(mode)
  await clearMockHassCalls(page)
  await mode.click()
  await expect(mode).toHaveAttribute('aria-checked', 'true')
  await expect(mode).toHaveAccessibleName('High AQI Mode On')
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
  ))).toEqual([
    { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.high_aqi_mode' },
  ])
})

test('chores page shows source sections and checkbox todo rows for the logged-in user', async ({ page }) => {
  await page.goto('/at-a-glance/chores')

  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groceries 2 items/i })).toBeVisible()
  for (const heading of ['Past Due', 'Evening Tasks', 'No Due Date', 'Upcoming']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'Past Due' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Evening Tasks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Afternoon Tasks' })).toHaveCount(0)
  const pastDueList = page.getByLabel('Past Due todo list')
  const firstTask = pastDueList.locator('button[aria-pressed]').filter({ hasText: 'Mock task one' })
  await expect(firstTask).toHaveAttribute('aria-pressed', 'false')

  await firstTask.click()

  await expect(firstTask).toHaveCount(0)
  await expect(page.getByText('Unable to update task')).toHaveCount(0)
})

test('chores render HA-supplied vacation lists exactly and omit empty sections on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/overview')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        reset: () => void
        setEntityState: (entityId: string, state: string) => void
        setTodoItems: (entityId: string, items: { status: string; summary: string; uid: string }[]) => void
      }
    }).__mockHass
    mock.reset()
    mock.setEntityState('input_boolean.vacation_mode', 'on')

    const mainLists = [
      'todo.stephen_s_past_due_with_unassigned',
      'todo.stephen_s_evening_with_unassigned',
      'todo.stephen_s_afternoon_with_unassigned',
      'todo.stephen_s_morning_with_unassigned',
      'todo.stephen_s_all_day_with_unassigned',
      'todo.stephen_s_no_due_date_with_unassigned',
      'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned',
    ]
    for (const entityId of mainLists) {
      mock.setEntityState(entityId, '0')
      mock.setTodoItems(entityId, [])
    }
    mock.setEntityState('todo.stephen_s_no_due_date_with_unassigned', '2')
    mock.setTodoItems('todo.stephen_s_no_due_date_with_unassigned', [
      { uid: 'ha-alpha', summary: 'HA supplied vacation task alpha', status: 'needs_action' },
      { uid: 'ha-beta', summary: 'HA supplied vacation task beta', status: 'needs_action' },
    ])

    for (const entityId of [
      'todo.stephen_s_past_due',
      'todo.stephen_s_due_today',
      'todo.stephen_s_upcoming',
      'todo.stephen_s_no_due_date',
    ]) {
      mock.setEntityState(entityId, '0')
      mock.setTodoItems(entityId, [])
    }
  })

  await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' }).click()

  const noDueDateList = page.getByLabel('No Due Date todo list')
  await expect(noDueDateList.locator('button[aria-pressed]')).toHaveCount(2)
  await expect(noDueDateList.getByRole('button', { name: 'HA supplied vacation task alpha' })).toBeVisible()
  await expect(noDueDateList.getByRole('button', { name: 'HA supplied vacation task beta' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Past Due' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No Due Date' })).toBeVisible()

  await page.getByRole('button', { name: /Stephen's Tasks/i }).click()

  await expect(page.getByRole('heading', { name: "Stephen's Chores" })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No Chores Due' })).toBeVisible()
  // Vacation mode is on for this scenario, so the copy must credit vacation, not Stephen.
  await expect(page.getByText('Enjoy vacation!')).toBeVisible()
  await expect(page.getByText('Stephen has no chores due- nice job!')).toHaveCount(0)
  await expect(page.locator('[data-empty-layout="centered"]')).toBeVisible()
  await expect(page.getByLabel(/todo list$/)).toHaveCount(0)
})

test('chores create task FAB opens the source-shaped task modal', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/chores')

  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Task' })).toHaveCSS('background-color', 'rgb(0, 154, 199)')
  await page.getByRole('button', { name: 'Add Task' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Create Task' })).toBeVisible()
  await expect(dialog.getByText('Create Donetick Task')).toHaveCount(0)
  expect(await page.evaluate(() => (document.activeElement instanceof HTMLInputElement ? document.activeElement.name : ''))).not.toBe('name')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect(dialog.getByLabel('Task Name')).toBeVisible()
  await expect(dialog.getByLabel('Due Date')).toHaveAttribute('type', 'date')
  await expect(dialog.getByLabel('Due Time')).toHaveAttribute('type', 'time')
  await expect(dialog.getByLabel('Assignee')).toHaveValue('')
  await expect(dialog.getByText('Hide On Vacation', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Hide While On Vacation', { exact: true })).toBeVisible()
  await expect(dialog.getByText('This task will not show up in your chores lists while Vacation Mode is active.', { exact: true })).toBeVisible()
  const hideOnVacation = dialog.getByRole('button', { name: 'Hide While On Vacation' })
  await expect(hideOnVacation).toHaveAttribute('aria-pressed', 'true')
  await expect(hideOnVacation).toHaveCSS('outline-style', 'none')
  await hideOnVacation.click()
  await expect(hideOnVacation).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog.getByLabel('Priority')).toHaveValue('critical')
  await expect(dialog.getByLabel('Recurrence')).toHaveValue('no_repeat')
  await expect(dialog.getByRole('option', { name: /Adaptive/i })).toHaveCount(0)
  await expect(dialog.getByLabel('Repeat Every')).toHaveCount(0)
  await dialog.getByLabel('Recurrence').selectOption('interval')
  await expect(dialog.getByLabel('Repeat Every')).toBeVisible()
  await expect(dialog.getByLabel('Repeat Every')).toHaveAttribute('inputmode', 'numeric')
  await dialog.getByLabel('Repeat Every').focus()
  await expect.poll(() => dialog.evaluate((element) => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
  })).toBe(0)
  await expect(dialog.getByLabel('Interval Unit')).toBeVisible()
  await expect(dialog.getByLabel('Days of Week', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await page.getByRole('button', { name: 'Add Task' }).click()
  await expect(dialog.getByRole('button', { name: 'Hide While On Vacation' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByLabel('Recurrence')).toHaveValue('no_repeat')
  await expect(dialog.getByLabel('Repeat Every')).toHaveCount(0)
})

test('chore subpages keep the Chores bottom nav item active', async ({ page }) => {
  await page.goto('/at-a-glance/stephs-chores')

  await expect(page.getByRole('heading', { name: "Steph's Chores" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Task' }).click()
  await expect(page.getByRole('dialog').getByLabel('Assignee')).toHaveValue('2')
})

test('chore rows edit, save, and delete through the shared task sheet', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/overview')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        reset: () => void
        setDonetickTask: (taskId: number, task: {
          assignees: number[]
          assigned_to: number | null
          description: string
          frequency: number
          frequency_metadata: Record<string, unknown>
          frequency_type: string
          hide_on_vacation: boolean
          id: number
          name: string
          next_due_date: string | null
          priority: number
        }) => void
        setEntityState: (entityId: string, state: string) => void
        setTodoItems: (entityId: string, items: { due?: string; status: string; summary: string; uid: string }[]) => void
      }
    }).__mockHass
    mock.reset()
    for (const entityId of [
      'todo.stephen_s_past_due_with_unassigned',
      'todo.stephen_s_evening_with_unassigned',
      'todo.stephen_s_afternoon_with_unassigned',
      'todo.stephen_s_morning_with_unassigned',
      'todo.stephen_s_all_day_with_unassigned',
      'todo.stephen_s_no_due_date_with_unassigned',
      'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned',
    ]) {
      mock.setEntityState(entityId, '0')
      mock.setTodoItems(entityId, [])
    }
    mock.setEntityState('todo.stephen_s_past_due_with_unassigned', '1')
    mock.setTodoItems('todo.stephen_s_past_due_with_unassigned', [
      { uid: '240--None', summary: 'Clean the gutters', status: 'needs_action' },
    ])
    mock.setDonetickTask(240, {
      assignees: [1],
      assigned_to: 1,
      description: 'Use the tall ladder',
      frequency: 1,
      frequency_metadata: {},
      frequency_type: 'once',
      hide_on_vacation: true,
      id: 240,
      name: 'Clean the gutters',
      next_due_date: null,
      priority: 2,
    })
  })

  await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' }).click()
  const pastDueList = page.getByLabel('Past Due todo list')
  const editButton = pastDueList.getByRole('button', { name: 'Edit Clean the gutters' })
  await expect(editButton).toBeVisible()
  await editButton.click()

  const dialog = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Task Name')).toHaveValue('Clean the gutters')
  await expect(dialog.getByLabel('Assignee')).toHaveValue('1')
  await expect(dialog.getByLabel('Description')).toHaveValue('Use the tall ladder')
  const deleteButton = dialog.getByRole('button', { name: 'Delete Task' })
  const saveButton = dialog.getByRole('button', { name: 'Save Task' })
  await expect(deleteButton).toBeVisible()
  await expect(saveButton).toBeVisible()
  await expect(deleteButton.locator('..')).toHaveCSS('display', 'grid')
  await expect(deleteButton.locator('..')).toHaveCSS('grid-template-columns', /.+ .+/)

  await dialog.getByLabel('Assignee').selectOption('3')
  await dialog.getByLabel('Recurrence').selectOption('interval')
  await dialog.getByLabel('Repeat Every').fill('2')
  await dialog.getByLabel('Interval Unit').selectOption('weeks')
  await saveButton.click()

  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await expect.poll(() => page.evaluate(() => {
    const calls = (window as unknown as { __mockHass: { calls: Array<Record<string, unknown>> } }).__mockHass.calls
    return calls.some((call) => call.domain === 'donetick' && call.service === 'update_task_form'
      && (call.serviceData as { assignees?: string; recurrence?: string } | undefined)?.assignees === '3'
      && (call.serviceData as { recurrence?: string } | undefined)?.recurrence === 'interval')
  })).toBe(true)

  await editButton.click()
  await expect(dialog).toBeVisible()
  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Delete Task' }).click()

  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await expect(pastDueList.getByRole('button', { name: 'Edit Clean the gutters' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const calls = (window as unknown as { __mockHass: { calls: Array<Record<string, unknown>> } }).__mockHass.calls
    return calls.some((call) => call.domain === 'todo' && call.service === 'remove_item')
  })).toBe(true)
})

test('groceries page opens a shopping-list add item modal', async ({ page }) => {
  await page.goto('/at-a-glance/groceries')

  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Groceries' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Groceries' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Add Grocery Item' })).toBeVisible()
  await expect(dialog.getByLabel('Item')).toBeVisible()
  await expect(dialog.getByLabel('Assignee')).toHaveCount(0)
  await expect(dialog.getByLabel('Priority')).toHaveCount(0)
  await expect(dialog.getByLabel('Recurrence')).toHaveCount(0)
  await expect(dialog.getByLabel('Description')).toHaveCount(0)
})

test('room pages are statically ported React pages', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await expect(page.getByRole('heading', { name: 'Living Room', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Room Status' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Window/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Air Quality/i }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Climate' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
})

test('room sections keep popup-only grill controls out of the Back Deck page', async ({ page }) => {
  await page.goto('/at-a-glance/back-deck')

  await expect(page.getByRole('heading', { name: 'Grill' })).toBeVisible()
  await expect(page.getByText('Bear Grills')).toBeVisible()
  await expect(page.getByRole('button', { name: /Bear Grills Off/i })).toHaveCount(0)
  await expect(page.getByText('Pellet Level')).toHaveCount(0)
  await expect(page.getByText('Keep Warm')).toHaveCount(0)
})

test('room status chips open direct reusable modal sheets', async ({ page }) => {
  await page.goto('/at-a-glance/kitchen')

  await expect(page.getByRole('button', { name: 'Rooms' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quick Links' })).toBeVisible()
  await page.getByRole('button', { name: /Lights/i }).first().click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kitchen Lights' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Rooms')).toHaveCount(0)
})

test('living room header chips open climate occupancy and air quality popups', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await page.getByRole('button', { name: /Climate/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Climate' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Occupancy/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Occupancy' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Air Quality/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Air Quality' })).toBeVisible()
  await expect(page.getByText('Fan Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Auto Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('PM2.5')).toHaveCount(0)
  await expect(page.getByText('AQI')).toHaveCount(0)
})

test('guest room page opens source-aligned header popups', async ({ page }) => {
  await page.goto('/at-a-glance/guest-room')

  await expect(page.getByRole('heading', { name: 'Guest Room' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Lights On$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Climate 69°F - 71°F$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Occupancy Detected$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Window Closed$/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Climate' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Vent Open$/i })).toHaveAttribute('data-tone', 'climate')
  await expect(page.getByRole('button', { name: /^Vent Open$/i })).not.toHaveAttribute('data-size')
  await expect(page.getByRole('button', { name: /^Air Purifier Auto • On$/i })).toHaveAttribute('data-tone', 'air')
  await expect(page.getByRole('button', { name: /^Air Purifier Auto • On$/i })).not.toHaveAttribute('data-size')

  await page.getByRole('button', { name: /^Lights On$/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Guest Room Lights' })).toBeVisible()
  await expect(page.getByRole('button', { name: /TV Light On/i })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /^Climate 69°F - 71°F$/i }).click()
  await expect(page.getByRole('heading', { name: 'Guest Room Climate' })).toBeVisible()
  await expect(page.getByText('69.5°F')).toBeVisible()
  await expect(page.getByText('70.2°F')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /^Air Quality 1 • 2 μg\/m³$/i }).click()
  await expect(page.getByRole('heading', { name: 'Guest Room Air Quality' })).toBeVisible()
  await expect(page.getByText('Fan Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Auto Modes')).toBeVisible()
})

test('room media cards open ported remote modals', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')
  await page.getByRole('button', { name: /^Living Room Remote Off$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect.poll(async () => {
    return dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return Math.round((rect.height / window.innerHeight) * 100)
    })
  }).toBe(90)
  await expect(page.getByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sonos Volume' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disney+' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /^Apple TV Paused$/i }).click()
  await expect(page.getByRole('heading', { name: 'Apple TV Remote' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await page.getByRole('dialog').getByRole('tab', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/theater-room')
  await page.getByRole('button', { name: /^Theater Room Remote Off$/i }).click()
  await expect(page.getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeVisible()
  await page.getByRole('dialog').getByRole('tab', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Prime Video' })).toBeVisible()
  await page.getByRole('dialog').getByRole('tab', { name: 'Devices' }).click()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Projector Off/i })).toBeVisible()
})

test('theater remote leads a full-width row above its source control grid', async ({ page }) => {
  await page.goto('/at-a-glance/theater-room')

  const opener = page.getByRole('group', { exact: true, name: 'Theater Room Remote' })
  const controls = page.getByRole('group', { exact: true, name: 'Theater Room Remote Controls' })
  await expect(opener.getByRole('button', { name: /^Theater Room Remote/ })).toBeVisible()
  await expect(opener.getByRole('button', { name: /^Nintendo Switch/ })).toHaveCount(0)
  await expect(controls.getByRole('button', { name: /^Nintendo Switch/ })).toBeVisible()
  await expect(controls.getByRole('button', { name: /^Theater SHIELD/ })).toBeVisible()
  await expect(page.getByRole('group', { exact: true, name: 'Theater Room Quick App Launch' }).getByRole('button')).toHaveCount(6)

  await page.setViewportSize({ width: 1280, height: 900 })
  const remoteCell = opener.locator('[data-dynamic-grid-cell="true"]').first()
  const switchCell = controls.locator('[data-dynamic-grid-cell="true"]').first()
  const shieldCell = controls.locator('[data-dynamic-grid-cell="true"]').last()
  await expect(remoteCell).toHaveAttribute('data-dynamic-grid-span', '2')
  await expect(switchCell).toHaveAttribute('data-dynamic-grid-span', '1')
  await expect(shieldCell).toHaveAttribute('data-dynamic-grid-span', '1')

  // The dynamic grid remeasures asynchronously after the viewport change, so poll the geometry.
  await expect.poll(async () => {
    const remoteBox = await remoteCell.boundingBox()
    const switchBox = await switchCell.boundingBox()
    const shieldBox = await shieldCell.boundingBox()
    if (!remoteBox || !switchBox || !shieldBox) return null
    return {
      shieldAfterSwitch: shieldBox.x > switchBox.x + switchBox.width - 1,
      remoteWiderThanSource: remoteBox.width > switchBox.width * 1.8,
      sourcesBelowRemote: switchBox.y >= remoteBox.y + remoteBox.height - 1,
      sourcesShareRow: Math.round(switchBox.y) === Math.round(shieldBox.y),
    }
  }).toEqual({
    shieldAfterSwitch: true,
    remoteWiderThanSource: true,
    sourcesBelowRemote: true,
    sourcesShareRow: true,
  })
})

test('Music Room route keeps source controls and moves Fortnite into the remote modal', async ({ page }) => {
  await page.goto('/at-a-glance/music-room')

  const remoteHeading = page.getByRole('heading', { exact: true, name: 'Remote' })
  const devicesHeading = page.getByRole('heading', { exact: true, name: 'Devices' })
  await expect(remoteHeading).toBeVisible()
  await expect(devicesHeading).toBeVisible()
  const [remoteBox, devicesBox] = await Promise.all([
    remoteHeading.boundingBox(),
    devicesHeading.boundingBox(),
  ])
  expect((devicesBox?.y ?? 0) > (remoteBox?.y ?? 0)).toBe(true)
  await expect(page.getByRole('heading', { exact: true, name: 'Quick App Launch' })).toHaveCount(0)
  await expect(page.getByRole('button', { exact: true, name: 'Fortnite' })).toHaveCount(0)

  const opener = page.getByRole('group', { exact: true, name: 'Music Room Remote' })
  const controls = page.getByRole('group', { exact: true, name: 'Music Room Remote Controls' })
  const remote = opener.getByRole('button', { name: 'Music Room Remote Off' })
  const xbox = controls.getByRole('button', { name: 'Xbox Off' })
  const server = controls.getByRole('button', { name: 'Server Off' })
  await expect(remote).toHaveAttribute('data-action-kind', 'modal')
  await expect(xbox).toHaveAttribute('data-action-kind', 'selection')
  await expect(xbox).toHaveAttribute('aria-pressed', 'false')
  await expect(server).toHaveAttribute('data-action-kind', 'selection')

  await xbox.click()
  const selectedXbox = controls.getByRole('button', { name: 'Xbox On' })
  await expect(selectedXbox).toHaveAttribute('aria-pressed', 'true')
  await selectedXbox.click()
  await expect(controls.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
  await server.click()
  await expect(controls.getByRole('button', { name: 'Server On' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([
    { domain: 'script', returnResponse: true, service: 'music_room_xbox' },
    { domain: 'script', returnResponse: true, service: 'music_room_tv_off' },
    { domain: 'script', returnResponse: true, service: 'music_room_server' },
  ])

  await page.reload()
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        calls: Record<string, unknown>[]
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.calls.splice(0, mock.calls.length)
    mock.setEntityState('media_player.music_room_tv_android', 'on')
    mock.setEntityState('media_player.xbox', 'off')
    mock.setEntityState('sensor.music_room_music_room_sync_box_hdmi1_status', 'linked')
  })
  await page.getByRole('button', { name: 'Music Room Remote On' }).click()
  const dialog = page.getByRole('dialog', { name: 'Music Room Remote' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Sonos Beam Volume' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keyboard' })).toHaveCount(0)
  await dialog.getByRole('button', { exact: true, name: 'Up' }).click()

  await dialog.getByRole('tab', { name: 'Apps' }).click()
  const fortnite = dialog.getByRole('button', { name: 'Fortnite' })
  await expect(fortnite).toBeVisible()
  await expect.poll(() => fortnite.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await dialog.getByRole('tab', { name: 'Hue Sync' }).click()
  await expect(dialog.getByRole('switch', { name: 'Sync Box Power On' })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Light Sync Off' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('button', { name: /^HDMI 1 Selected • / })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('slider', { name: 'Brightness' })).toHaveValue('100')
  await expect(dialog.getByText('Entertainment Area')).toHaveCount(0)
  await expect(dialog.getByText('LED Indicator')).toHaveCount(0)
  await expect(dialog.getByText('Entertainment Stream')).toHaveCount(0)
  await dialog.getByRole('tab', { name: 'Devices' }).click()
  await expect(dialog.getByRole('switch', { name: 'TV On' })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Xbox On' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Server Off' })).toBeVisible()
  await expect(dialog.getByLabel('Sonos Beam Playing')).toHaveAttribute('data-action-kind', 'state')
  await expect(dialog.getByRole('button', { name: 'Sonos Beam Playing' })).toHaveCount(0)
  await dialog.getByRole('switch', { name: 'Xbox On' }).click()
  await expect(dialog.getByRole('switch', { name: 'Xbox Off' })).toBeVisible()
  await dialog.getByRole('switch', { name: 'Power' }).click()
  await expect(dialog.getByRole('switch', { name: 'Xbox Off' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([
    {
      domain: 'remote',
      service: 'send_command',
      target: 'remote.music_room_tv_android',
      serviceData: { command: 'DPAD_UP' },
    },
    { domain: 'script', returnResponse: true, service: 'music_room_xbox_off' },
    { domain: 'script', returnResponse: true, service: 'music_room_tv_off' },
  ])
})

test('Media page includes the Music Room remote, Xbox, Server, and Fortnite controls', async ({ page }) => {
  await page.goto('/at-a-glance/media')

  const musicSection = page.getByRole('heading', { exact: true, name: 'Music Room' }).locator('xpath=ancestor::section[1]')
  await expect(musicSection.getByRole('button', { name: 'Music Room Remote Off' })).toBeVisible()
  await expect(musicSection.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('data-action-kind', 'selection')
  await expect(musicSection.getByRole('button', { name: 'Server Off' })).toBeVisible()
  const fortnite = musicSection.getByRole('button', { name: 'Fortnite' })
  await expect(fortnite).toBeVisible()
  await expect.poll(() => fortnite.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)

  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    mock.setEntityState('media_player.xbox', 'on')
    mock.setEntityState('sensor.music_room_music_room_sync_box_hdmi1_status', 'linked')
  })
  await musicSection.getByRole('button', { name: 'Music Room Remote Off' }).click()
  const dialog = page.getByRole('dialog', { name: 'Music Room Remote' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Devices' }).click()
  await expect(dialog.getByRole('switch', { name: 'Xbox On' })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Hue Sync' }).click()
  await dialog.getByRole('button', { name: 'Game' }).click()
  await expect(dialog.getByRole('button', { name: 'Game' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.at(-1))).toEqual({
    domain: 'select',
    service: 'select_option',
    target: 'select.music_room_music_room_sync_box_sync_mode',
    serviceData: { option: 'game' },
  })
})

test('Music Room source tiles follow external routed-source truth without simultaneous selection', async ({ page }) => {
  await page.goto('/at-a-glance/music-room')
  const controls = page.getByRole('group', { exact: true, name: 'Music Room Remote Controls' })
  const setSource = (state: string) => page.evaluate((nextState) => {
    window.__mockHass?.setEntityState('sensor.music_room_active_media_source', nextState)
  }, state)

  await setSource('Xbox')
  await expect(controls.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')
  await expect(controls.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')

  await setSource('Server')
  await expect(controls.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
  await expect(controls.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => {
    const mock = window.__mockHass
    mock?.setEntityState('media_player.music_room_tv_android', 'on')
    mock?.setEntityState('switch.music_room_music_room_sync_box_power', 'on')
    mock?.setEntityState('select.music_room_music_room_sync_box_hdmi_input', 'HDMI 1')
    mock?.setEntityState('sensor.music_room_music_room_sync_box_hdmi1_status', 'plugged')
    mock?.setEntityState('sensor.music_room_active_media_source', 'Off')
  })
  await expect(controls.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
  await expect(controls.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
})

test('Free Sleep global Add Alarm defaults to weekdays and writes enabled backend records', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  const addAlarm = await openAddAlarmForm(dialog, "Steph's Bed")

  await addAlarm.getByLabel('Alarm time').fill('08:00')
  await addAlarm.getByRole('button', { exact: true, name: 'Add Alarm' }).click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed")
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    await expect(dialog.getByRole('button', { name: new RegExp(`Steph.s Bed ${day} Alarm Enabled`, 'i') })).toBeVisible()
  }
  for (const scheduleDay of ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']) {
    await expectFreeSleepAlarms(page, 'right', scheduleDay, [{ enabled: true, time: '08:00' }])
  }
})

test('humidifier Sleep readout matches SleepyPod OFF typography and keeps mobile dial breathing room', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    mock.setEntityState('select.lv600s_humidifier_mode', 'Sleep')
  })
  await page.getByRole('button', { name: /Humidifier Humidifying.*46%/i }).click()

  const dialog = page.getByRole('dialog')
  const sleepDial = dialog.getByRole('region', { name: 'Humidifier mist level Sleep • 5' })
  const sleepText = sleepDial.getByText('Sleep', { exact: true })
  await expect(sleepText).toHaveCSS('font-weight', '420')
  await expect(sleepText).toHaveCSS('text-transform', 'uppercase')
  await expect(sleepDial).not.toHaveAttribute('aria-disabled')
  await expect(sleepDial.locator('[data-marker="current"]')).toHaveAttribute('data-value', '5')
  await expect(sleepDial.getByRole('slider', { name: 'Mist level' })).toHaveCount(0)

  const sleepReadout = await sleepText.evaluate((element) => {
    const dial = element.closest<HTMLElement>('[role="region"]')
    if (!dial) throw new Error('Humidifier dial region is missing.')
    const dialRect = dial.getBoundingClientRect()
    const textRect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      fontSize: Number.parseFloat(style.fontSize),
      gaps: {
        above: textRect.top - dialRect.top,
        left: textRect.left - dialRect.left,
        right: dialRect.right - textRect.right,
      },
      typography: {
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
      },
    }
  })

  expect(sleepReadout.gaps.above).toBeGreaterThanOrEqual(90)
  expect(sleepReadout.gaps.left).toBeGreaterThanOrEqual(48)
  expect(sleepReadout.gaps.right).toBeGreaterThanOrEqual(48)

  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /Steph.s Bed Off/i }).click()
  const sleepypodDialog = page.getByRole('dialog')
  const offText = sleepypodDialog.getByRole('region', { name: /Steph.s Bed thermostat Off/i }).getByText('OFF', { exact: true })
  const offReadout = await offText.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontSize: Number.parseFloat(style.fontSize),
      typography: {
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
      },
    }
  })

  expect(sleepReadout.typography).toEqual(offReadout.typography)
  expect(sleepReadout.fontSize).toBeLessThan(offReadout.fontSize)
})

test('selecting a humidifier mode while off powers on through the HA profile command', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        calls: Record<string, unknown>[]
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.calls.splice(0, mock.calls.length)
    mock.setEntityState('switch.lv600s_humidifier_power', 'off')
  })
  await page.getByRole('button', { name: /Humidifier Off.*46%/i }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Auto Humidity' }).click()
  await expect(dialog.getByRole('button', { name: 'Turn Off' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script' && call.service === 'master_bedroom_humidifier_apply_profile')
  ))).toEqual([{
    domain: 'script',
    service: 'master_bedroom_humidifier_apply_profile',
    serviceData: {
      display: true,
      mist_level: 5,
      mode: 'Target Humidity',
      target_humidity: 50,
      warm_level: 1,
    },
  }])
})

test('schedule detail pages keep the outer modal sheet anchored', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /Humidifier Humidifying.*46%/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Schedules', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Scheduled Activity' }).click()

  await expect(dialog).toHaveAccessibleName('Add Master Bedroom Humidifier Schedule')
  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBe(0)
  await expect(dialog.getByLabel('Name')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Back to schedules' })).toBeVisible()
})

test('Free Sleep day Add Alarm is locked to that day and returns to day management', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")

  await dialog.getByRole('button', { exact: true, name: 'Add Alarm' }).click()
  await expect(dialog).toHaveAccessibleName("Add Steph's Bed Sunday Alarm")
  await expect(dialog.getByText('Days')).toHaveCount(0)
  await expect(dialog.getByRole('button', { exact: true, name: 'Sunday' })).toHaveCount(0)
  await expect(dialog.getByRole('switch')).toHaveCount(0)
  await dialog.getByLabel('Alarm time').fill('08:10')
  await dialog.getByRole('button', { exact: true, name: 'Add Alarm' }).click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  await expect(dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 8:10 AM, Enabled/i })).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
    { enabled: true, time: '08:10' },
  ])
})

test('SleepyPod inline toggle updates a single main row without opening edit', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await setMockFreeSleepWakeDayAlarms(page, 'right', 'sunday', [{ enabled: true, time: '06:30' }])
  await page.getByRole('button', { name: /Steph.s Bed Off/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Alarms', exact: true }).click()

  const row = dialog.getByRole('button', { name: 'Steph\u0027s Bed Sunday Alarm Enabled' })
  const toggle = dialog.getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' })
  await expect(row).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expectInlineToggleBeforeChevron(toggle)
  await expectToggleChrome(toggle)
  const rowBoxBefore = await row.boundingBox()

  await toggle.click()

  await expect(dialog).toHaveAccessibleName('Steph\u0027s Bed')
  const disabledRow = dialog.getByRole('button', { name: 'Steph\u0027s Bed Sunday Alarm Disabled' })
  await expect(disabledRow).toHaveAttribute('data-active', 'false')
  const disabledToggle = dialog.getByRole('switch', { name: 'Turn on Steph\u0027s Bed Sunday alarm at 6:30 AM' })
  await expect(disabledToggle).toHaveAttribute('aria-checked', 'false')
  await expectToggleChrome(disabledToggle)
  await expect(dialog.getByLabel('Alarm time')).toHaveCount(0)
  await expectFreeSleepAlarms(page, 'right', 'saturday', [{ enabled: false, time: '06:30' }])
  const rowBoxAfter = await disabledRow.boundingBox()
  if (!rowBoxBefore || !rowBoxAfter) throw new Error('Single alarm row geometry is unavailable')
  expect(Math.round(rowBoxAfter.width)).toBe(Math.round(rowBoxBefore.width))
  expect(Math.round(rowBoxAfter.height)).toBe(Math.round(rowBoxBefore.height))
})

test('SleepyPod inline toggle updates one multi-alarm day row without opening edit', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  const dayGroup = dialog.getByRole('button', { name: 'Steph\u0027s Bed Sunday Alarms 2 Enabled' })
  await expect(dialog.getByRole('switch', { name: /Sunday alarm/i })).toHaveCount(0)
  await dayGroup.click()
  await expect(dialog).toHaveAccessibleName('Steph\u0027s Bed Sunday Alarms')

  const firstRow = dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i })
  const toggle = dialog.getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' })
  await expect(dialog.getByRole('switch')).toHaveCount(2)
  await expectInlineToggleBeforeChevron(toggle)
  await expectToggleChrome(toggle)
  const rowBoxBefore = await firstRow.boundingBox()

  await toggle.click()

  await expect(dialog).toHaveAccessibleName('Steph\u0027s Bed Sunday Alarms')
  const disabledRow = dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Disabled/i })
  await expect(disabledRow).toHaveAttribute('data-active', 'false')
  await expectToggleChrome(dialog.getByRole('switch', { name: 'Turn on Steph\u0027s Bed Sunday alarm at 6:30 AM' }))
  await expect(dialog.getByLabel('Alarm time')).toHaveCount(0)
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
  const rowBoxAfter = await disabledRow.boundingBox()
  if (!rowBoxBefore || !rowBoxAfter) throw new Error('Day alarm row geometry is unavailable')
  expect(Math.round(rowBoxAfter.width)).toBe(Math.round(rowBoxBefore.width))
  expect(Math.round(rowBoxAfter.height)).toBe(Math.round(rowBoxBefore.height))
})

test('Free Sleep alarm active state is edited from its day page', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i }).click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarm")
  await expect(dialog.getByText('Alarm Enabled')).toBeVisible()
  await expect(dialog.getByRole('button', { exact: true, name: 'Sunday' })).toHaveCount(0)
  await dialog.getByRole('switch', { name: 'Turn off Alarm Enabled' }).click()
  await dialog.getByRole('button', { exact: true, name: 'Save Alarm' }).click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  const disabledAlarm = dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Disabled/i })
  await expect(disabledAlarm).toBeVisible()
  await expect(disabledAlarm).toHaveAttribute('data-active', 'false')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm time edit preserves enabled state and payload fields', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i }).click()

  await dialog.getByLabel('Alarm time').fill('06:35')
  await dialog.getByRole('button', { exact: true, name: 'Save Alarm' }).click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  await expect(dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:35 AM, Enabled/i })).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:35' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm delete returns to the day page and keeps the remaining alarm normalized', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i }).click()

  const deleteAlarm = dialog.getByRole('button', { exact: true, name: 'Delete Alarm' })
  await expect(deleteAlarm.locator('xpath=ancestor::*[@data-modal-sheet-footer="true"]')).toHaveCount(1)
  await dialog.getByLabel('Alarm time').fill('06:40')
  const dismissPrompt = page.waitForEvent('dialog')
  const dismissClick = deleteAlarm.click()
  const dismissedDialog = await dismissPrompt
  expect(dismissedDialog.type()).toBe('confirm')
  expect(dismissedDialog.message()).toBe('Delete alarm set for 6:30 AM on Sunday?')
  await dismissedDialog.dismiss()
  await dismissClick

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarm")
  await expect(deleteAlarm).toBeVisible()
  await expect(dialog.getByLabel('Alarm time')).toHaveValue('06:40')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])

  const acceptPrompt = page.waitForEvent('dialog')
  const acceptClick = deleteAlarm.click()
  const acceptedDialog = await acceptPrompt
  expect(acceptedDialog.type()).toBe('confirm')
  expect(acceptedDialog.message()).toBe('Delete alarm set for 6:30 AM on Sunday?')
  await acceptedDialog.accept()
  await acceptClick

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarm")
  await expect(dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 7:15 AM, Enabled/i })).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep grouped day navigation restores nested scroll and focus in one mobile sheet', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const dialog = await openBedAlarmDialog(page, /Steph.s Bed Off/i)
  const modalBody = dialog.locator('[data-modal-sheet-body="true"]')
  await modalBody.evaluate((element) => {
    element.style.height = '160px'
    element.style.maxHeight = '160px'
    element.style.overflowY = 'auto'
    element.scrollTop = 80
  })
  const dayGroup = dialog.getByRole('button', { name: "Steph's Bed Sunday Alarms 2 Enabled" })
  await expect(dayGroup).toBeVisible()
  await expect(dialog.getByText('Sunday Alarm 2')).toHaveCount(0)
  await dayGroup.scrollIntoViewIfNeeded()
  const mainScrollBeforeOpen = await modalBody.evaluate((element) => element.scrollTop)
  await dayGroup.click()

  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  await expect(page.getByRole('dialog')).toHaveCount(1)
  const firstAlarm = dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i })
  await expect(firstAlarm).toBeFocused()
  const dayAdd = dialog.getByRole('button', { exact: true, name: 'Add Alarm' })
  await dayAdd.scrollIntoViewIfNeeded()
  const dayScrollBeforeOpen = await modalBody.evaluate((element) => element.scrollTop)
  await dayAdd.click()

  await expect(dialog).toHaveAccessibleName("Add Steph's Bed Sunday Alarm")
  await expect(dialog.getByLabel('Alarm time')).toBeFocused()
  await dialog.getByRole('button', { name: 'Back to Sunday alarms' }).click()
  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  await expect(dayAdd).toBeFocused()
  await expect.poll(() => modalBody.evaluate((element) => element.scrollTop)).toBe(dayScrollBeforeOpen)

  await dialog.getByRole('button', { name: 'Back to alarms' }).click()
  await expect(dialog).toHaveAccessibleName("Steph's Bed")
  await expect(dayGroup).toBeFocused()
  await expect.poll(() => modalBody.evaluate((element) => element.scrollTop)).toBe(mainScrollBeforeOpen)
  await expect(dialog.getByText(/Alarm Schedule (Enabled|Disabled)/)).toHaveCount(0)
})


test('security page opens ported security, contact, and camera modals', async ({ page }) => {
  await page.goto('/at-a-glance/security')

  await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Security System Armed Home/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Front Door Locked/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cameras' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Front Door camera' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mach-E' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Doors Locked/i })).toHaveCount(0)

  await page.getByRole('button', { name: /Security System Armed Home/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Security System' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set security system to Away' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Contact Sensors\s*All Closed/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Contact sensors by room')).toBeVisible()
  await expect(page.getByRole('button', { name: /Open Living Room Contact Sensors/i })).toBeVisible()
  await page.getByRole('button', { name: /Open Living Room Contact Sensors/i }).click()
  await expect(page.getByRole('heading', { name: 'Living Room Contact Sensors' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to room contact sensors' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Open Front Door camera' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Front Door Camera' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Snapshot' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Muted' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Record' })).toBeVisible()
})

test('room vacuum cards open reusable vacuum modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Main Floor Robot Vacuum')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Vacuum Controls' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Docked' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Dock Status Idle' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Power Settings' })).toBeVisible()
  await expect(page.getByText('Choose whether the robot vacuums, mops, or combines both for the next run.')).toBeVisible()
  await expect(page.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Bin' })).toHaveCount(0)
  await expect(page.getByText('Choose how many passes the vacuum should make, then start cleaning with the selected rooms.')).toBeVisible()
  await expect(page.getByText('No rooms are selected. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Cleaning Passes 1x/i })).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveAttribute('data-icon', 'mdi:play')
  await expect(page.getByRole('tab', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Consumables' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mode options' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Zones' }).click()
  await expect(page.getByText('Rooms are cleaned in the order you select them. The numbered badges show the current cleaning sequence.')).toBeVisible()
  const kitchenZone = page.getByRole('button', { name: /^Kitchen/ })
  const livingRoomZone = page.getByRole('button', { name: /^Living Room/ })
  await kitchenZone.click()
  await livingRoomZone.click()
  await expect(kitchenZone).toHaveAccessibleName('Kitchen, cleaning order 1')
  await expect(livingRoomZone).toHaveAccessibleName('Living Room, cleaning order 2')
  await expect(kitchenZone.getByText('1')).toBeVisible()
  await expect(livingRoomZone.getByText('2')).toBeVisible()
  await page.getByRole('tab', { name: 'Auto-Clean' }).click()
  await expect(page.getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })).toBeVisible()
  await expect(page.getByText('Check rooms that should be skipped when the coordinator starts an automatic away clean.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Living Room auto-clean enabled' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Closet auto-clean enabled' })).toBeVisible()
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('heading', { name: 'Dock Controls' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clean Mop Dock' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dry Mops' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Bin' })).toBeVisible()
  await page.getByRole('tab', { name: 'Info' }).click()
  await expect(page.getByRole('heading', { name: 'Consumables' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Main Brush 204h left' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Dustbag OK' })).toBeVisible()
})

test('theater room vacuum opens with map and Valetudo power controls', async ({ page }) => {
  await page.goto('/at-a-glance/theater-room')

  await page.getByRole('button', { name: /Theater Room Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Zones' })).toHaveCount(0)
  await expect(page.getByText('No rooms are selected. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Brush 245h left' })).toBeVisible()
  await expect(page.getByText(/Entity not available/i)).toHaveCount(0)
})

test('vacuums page renders without live HASS backend', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
  const robotGrid = page.getByRole('group', { name: 'Robot vacuums' })
  await expect(robotGrid).toHaveAttribute('data-dynamic-grid', 'true')
  await expect(robotGrid.locator('[data-dynamic-grid-cell="true"]').last()).toHaveAttribute('data-dynamic-grid-span', '2')
  const autoCleanGrid = page.getByRole('group', { name: 'Vacuum auto-clean controls' })
  await expect(autoCleanGrid).toHaveAttribute('data-dynamic-grid', 'true')
  await expect(autoCleanGrid.locator('[data-dynamic-grid-cell="true"]').last()).toHaveAttribute('data-dynamic-grid-span', '2')
  const musicRoomVacuum = page.getByRole('button', { name: 'Music Room Unavailable', exact: true })
  await expect(musicRoomVacuum).toHaveAttribute('data-icon', 'mdi:robot-vacuum-off')
  await expect(musicRoomVacuum).toHaveAttribute('data-modal-opener', 'true')
  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  await expect(mainFloorVacuum).toBeVisible()
  await expect(mainFloorVacuum).toHaveAttribute('data-tone', 'vacuum')
  await expect(mainFloorVacuum).toHaveAttribute('data-icon', 'mdi:home')
})

test('offline vacuum cards open their status modal', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: 'Music Room Unavailable', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Music Room Robot Vacuum' })).toBeVisible()
  const statusPill = dialog.locator('[data-icon="mdi:robot-vacuum-off"][data-tone="unavailable"]')
  await expect(statusPill).toContainText('Unavailable')
  await expect(statusPill).toHaveAttribute('data-tone', 'unavailable')
  await expect(dialog.getByLabel('Unavailable')).toHaveCount(0)
  await expect(dialog.getByText('Battery').locator('xpath=ancestor::*[@data-icon][1]')).toHaveAttribute('data-tone', 'unavailable')
  await expect(dialog.getByRole('region', { name: 'Music Room Valetudo map' })).toHaveAttribute('data-map-provenance', 'reported')
  await expect(dialog.locator('[data-map-reported-note="true"]')).toContainText('Last Reported Position')
  await expect(dialog.getByText('Map Unavailable')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
})

test('music room focused map hides the phantom area without scope controls or coordinate changes', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'docked')
    mock.setEntityState('sensor.valetudo_elatedusedram_battery_level', '100')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'No error')
    mock.setEntityState('sensor.valetudo_elatedusedram_status_flag', 'none')
    mock.setEntityState('camera.valetudo_elatedusedram_map_data', 'idle')
    mock.setEntityState('select.valetudo_elatedusedram_mode', 'vacuum')
    mock.setEntityState('select.valetudo_elatedusedram_fan', 'balanced')
    mock.setEntityState('select.valetudo_elatedusedram_water', 'medium')
  })

  await page.getByRole('button', { name: /Music Room Docked/i }).click()
  const dialog = page.getByRole('dialog')
  const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })

  await expect(map).toHaveAttribute('data-map-scope', 'focused')
  await expect(map).toHaveAttribute('data-map-focus-reason', 'focused')
  await expect(map).toHaveAttribute('data-map-render-clipped', 'true')
  await expect(map).toHaveAttribute('data-view-min-x', '634')
  await expect(map).toHaveAttribute('data-view-max-x', '782')
  await expect(dialog.getByRole('button', { name: 'Full Map' })).toHaveCount(0)
  await expect(dialog.getByText('Reachable Area Only')).toHaveCount(0)

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await dialog.getByRole('button', { name: 'Draw Area' }).click()
  const overlay = dialog.locator('[data-map-editor-overlay="true"]')
  const overlayBox = await overlay.boundingBox()
  if (!overlayBox) throw new Error('Music Room vacuum map editor overlay was not measurable')

  await page.mouse.move(overlayBox.x + overlayBox.width * 0.08, overlayBox.y + overlayBox.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.16, overlayBox.y + overlayBox.height * 0.58, { steps: 6 })
  await page.mouse.up()

  const selection = dialog.locator('[data-map-rect="true"]')
  await expect(selection).toBeVisible()
  const selectedRect = await selection.evaluate((element) => ({
    x0: Number(element.getAttribute('data-x0')),
    x1: Number(element.getAttribute('data-x1')),
    y0: Number(element.getAttribute('data-y0')),
    y1: Number(element.getAttribute('data-y1')),
  }))
  expect(selectedRect.x0).toBeGreaterThanOrEqual(638)
  expect(selectedRect.x1).toBeLessThanOrEqual(782)
  await expect(map).toHaveAttribute('data-selection-allowed', 'true')

  await dialog.getByRole('button', { name: 'Use This Area' }).click()
  await dialog.getByRole('button', { name: 'Start Area Clean' }).click()
  const calls = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script' && call.service === 'music_room_vacuum_clean_zone')
  ))
  expect(calls).toEqual([{
    domain: 'script',
    service: 'music_room_vacuum_clean_zone',
    serviceData: {
      x_max_cm: selectedRect.x1 * 5,
      x_min_cm: selectedRect.x0 * 5,
      y_max_cm: selectedRect.y1 * 5,
      y_min_cm: selectedRect.y0 * 5,
    },
  }])
})

test('music room focused map recovers when availability changes during a gesture', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'docked')
    mock.setEntityState('sensor.valetudo_elatedusedram_battery_level', '100')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'No error')
    mock.setEntityState('sensor.valetudo_elatedusedram_status_flag', 'none')
    mock.setEntityState('camera.valetudo_elatedusedram_map_data', 'idle')
    mock.setEntityState('select.valetudo_elatedusedram_mode', 'vacuum')
    mock.setEntityState('select.valetudo_elatedusedram_fan', 'balanced')
    mock.setEntityState('select.valetudo_elatedusedram_water', 'medium')
  })

  await page.getByRole('button', { name: /Music Room Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await dialog.getByRole('button', { name: 'Draw Area' }).click()
  const overlay = dialog.locator('[data-map-editor-overlay="true"]')
  const overlayBox = await overlay.boundingBox()
  if (!overlayBox) throw new Error('Music Room vacuum map editor overlay was not measurable')
  await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2)
  await page.mouse.down()

  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'unavailable')
  })
  await expect(dialog.getByRole('heading', { name: 'Music Room Robot Vacuum' })).toBeVisible()
  await page.mouse.up()

  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'docked')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'No error')
  })

  const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })
  await expect(map).toHaveAttribute('data-map-scope', 'focused')
  await expect(dialog.getByRole('button', { name: 'Full Map' })).toHaveCount(0)
  await expect(dialog.getByText('Reachable Area Only')).toHaveCount(0)
  await expect(dialog.locator('[data-map-rect="true"]')).toHaveCount(0)
})

test('current vacuum issues use coherent raw state without assertive helper prose', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', 'error')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_error', 'Brush stuck')
    mock.setEntityState('input_text.main_floor_vacuum_error_message', 'Main brush is stuck under the sofa')
  })

  await page.getByRole('button', { name: /Main Floor Error/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Current Issue')).toContainText('Brush stuck')
  await expect(dialog.getByText('Main brush is stuck under the sofa')).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Stop' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Dock' })).toBeEnabled()
})

test('available vacuum cards open source-style modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Zones' }).click()
  await expect(page.getByText('Zones').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Auto-Clean' }).click()
  const officeAutoClean = page.getByRole('button', { name: 'Office auto-clean enabled' })
  await expect(officeAutoClean).toHaveAttribute('aria-pressed', 'false')
  await officeAutoClean.click()
  await expect(page.getByRole('button', { name: 'Office auto-clean disabled' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Clean Mop Dock' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dry Mops' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Bin' })).toBeVisible()
  await page.getByRole('tab', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Filter 54h left' })).toHaveAttribute('data-icon', 'mdi:air-filter')
  await expect(page.getByRole('group', { name: 'Detergent OK' })).toHaveAttribute('data-icon', 'mdi:bottle-tonic')
  await expect(page.getByRole('group', { name: 'Sensors 2h left' })).toHaveAttribute('data-icon', 'mdi:timer-alert-outline')
  const mapCanvas = page.locator('[data-valetudo-map-canvas="true"]')
  await expect(mapCanvas).toBeVisible()
  expect(await mapCanvas.getAttribute('width')).not.toBe('0')
  expect(await mapCanvas.getAttribute('height')).not.toBe('0')
})

test('vacuum area editor draws, moves, resizes, zooms, and sends exact script geometry', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await expect(dialog.getByText('No area selected')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Draw Area' }).click()
  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeVisible()

  const overlay = dialog.locator('[data-map-editor-overlay="true"]')
  await expect(overlay).toBeVisible()
  const overlayBox = await overlay.boundingBox()
  if (!overlayBox) throw new Error('Vacuum map editor overlay was not measurable')
  const modalBody = dialog.locator('[data-modal-sheet-body="true"]')
  const initialScrollTop = await modalBody.evaluate((element) => element.scrollTop)

  await page.mouse.move(overlayBox.x + overlayBox.width * 0.34, overlayBox.y + overlayBox.height * 0.32)
  await page.mouse.down()
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.68, overlayBox.y + overlayBox.height * 0.62, { steps: 8 })
  await page.mouse.up()

  const selection = dialog.locator('[data-map-rect="true"]')
  await expect(selection).toBeVisible()
  const initialRect = await selection.evaluate((element) => ({
    x0: Number(element.getAttribute('data-x0')),
    x1: Number(element.getAttribute('data-x1')),
    y0: Number(element.getAttribute('data-y0')),
    y1: Number(element.getAttribute('data-y1')),
  }))
  expect(initialRect.x1 - initialRect.x0).toBeGreaterThanOrEqual(5)
  expect(initialRect.y1 - initialRect.y0).toBeGreaterThanOrEqual(5)
  expect(await modalBody.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)

  const selectionBox = await selection.boundingBox()
  if (!selectionBox) throw new Error('Vacuum area selection was not measurable')
  await page.mouse.move(selectionBox.x + selectionBox.width / 2, selectionBox.y + selectionBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(selectionBox.x + selectionBox.width / 2 + 28, selectionBox.y + selectionBox.height / 2 + 18, { steps: 6 })
  await page.mouse.up()

  const movedRect = await selection.evaluate((element) => ({
    x0: Number(element.getAttribute('data-x0')),
    x1: Number(element.getAttribute('data-x1')),
    y0: Number(element.getAttribute('data-y0')),
    y1: Number(element.getAttribute('data-y1')),
  }))
  expect(movedRect.x1 - movedRect.x0).toBe(initialRect.x1 - initialRect.x0)
  expect(movedRect.y1 - movedRect.y0).toBe(initialRect.y1 - initialRect.y0)
  expect(`${movedRect.x0},${movedRect.y0}`).not.toBe(`${initialRect.x0},${initialRect.y0}`)

  const resizeHandles = dialog.getByRole('button', { name: /Resize cleaning area corner/ })
  await expect(resizeHandles).toHaveCount(4)
  await expect(dialog.getByRole('button', { name: 'Resize cleaning area corner A' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Resize cleaning area corner B' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Resize cleaning area corner C' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Resize cleaning area corner D' })).toBeVisible()
  const resizeHandle = dialog.getByRole('button', { name: 'Resize cleaning area corner C' })
  const handleBox = await resizeHandle.boundingBox()
  if (!handleBox) throw new Error('Vacuum area resize handle was not measurable')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 34, handleBox.y + handleBox.height / 2 - 24, { steps: 6 })
  await page.mouse.up()

  const resizedRect = await selection.evaluate((element) => ({
    x0: Number(element.getAttribute('data-x0')),
    x1: Number(element.getAttribute('data-x1')),
    y0: Number(element.getAttribute('data-y0')),
    y1: Number(element.getAttribute('data-y1')),
  }))
  expect(resizedRect.x1 - resizedRect.x0).toBeGreaterThanOrEqual(5)
  expect(resizedRect.y1 - resizedRect.y0).toBeGreaterThanOrEqual(5)
  expect(`${resizedRect.x1},${resizedRect.y1}`).not.toBe(`${movedRect.x1},${movedRect.y1}`)

  const beforeZoomBox = await selection.boundingBox()
  await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2)
  await page.mouse.wheel(0, -700)
  await expect.poll(async () => {
    const afterZoomBox = await selection.boundingBox()
    return Math.round(afterZoomBox?.width ?? 0)
  }).not.toBe(Math.round(beforeZoomBox?.width ?? 0))
  await expect(selection).toHaveAttribute('data-x0', String(resizedRect.x0))
  await expect(selection).toHaveAttribute('data-x1', String(resizedRect.x1))
  await expect(selection).toHaveAttribute('data-y0', String(resizedRect.y0))
  await expect(selection).toHaveAttribute('data-y1', String(resizedRect.y1))
  expect(consoleErrors.some((message) => message.includes('passive event listener'))).toBe(false)

  await dialog.getByRole('button', { name: 'Use This Area' }).click()
  await expect(dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('button', { name: 'Edit Area' })).toBeVisible()
  const mainMapOverlay = dialog.locator('[data-map-editor-overlay="true"][data-interactive="false"]')
  await expect(mainMapOverlay).toBeVisible()
  await expect(mainMapOverlay.locator('[data-map-rect="true"]')).toHaveAttribute('data-x0', String(resizedRect.x0))
  await expect(mainMapOverlay.locator('[data-map-rect="true"]')).toHaveAttribute('data-y1', String(resizedRect.y1))
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Rooms' }).click()
  await expect(dialog.locator('[data-map-editor-overlay="true"][data-interactive="false"]')).toHaveCount(0)
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await expect(dialog.locator('[data-map-editor-overlay="true"][data-interactive="false"] [data-map-rect="true"]')).toBeVisible()
  const startButton = dialog.getByRole('button', { name: 'Start Area Clean' })
  await expect(startButton).toBeEnabled()
  await startButton.click()

  const areaCalls = await page.evaluate(() => {
    const debug = (window as unknown as { __mockHass?: { calls: Record<string, unknown>[] } }).__mockHass
    return debug?.calls.filter((call) => call.domain === 'script' && call.service === 'main_floor_vacuum_clean_zone') ?? []
  })
  expect(areaCalls).toEqual([
    {
      domain: 'script',
      service: 'main_floor_vacuum_clean_zone',
      serviceData: {
        x_min_cm: resizedRect.x0 * 5,
        x_max_cm: resizedRect.x1 * 5,
        y_min_cm: resizedRect.y0 * 5,
        y_max_cm: resizedRect.y1 * 5,
      },
    },
  ])
})

test('vacuum area controls remain usable at the narrow mobile target', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const modalNavButtons = dialog.getByRole('tablist', { name: 'Main Floor modal sections' }).getByRole('tab')
  const navWidths = await modalNavButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width))
  expect(Math.min(...navWidths)).toBeGreaterThanOrEqual(44)

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await dialog.getByRole('button', { name: 'Draw Area' }).click()
  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Draw an Area to Continue' })).toBeVisible()
  const overlay = dialog.locator('[data-map-editor-overlay="true"]')
  const overlayBox = await overlay.boundingBox()
  if (!overlayBox) throw new Error('Narrow vacuum map editor overlay was not measurable')
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.35, overlayBox.y + overlayBox.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.62, overlayBox.y + overlayBox.height * 0.58, { steps: 6 })
  await page.mouse.up()
  await expect(dialog.locator('[data-map-rect="true"]')).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear' }).click()
  await expect(dialog.locator('[data-map-rect="true"]')).toHaveCount(0)
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.45, overlayBox.y + overlayBox.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.65, overlayBox.y + overlayBox.height * 0.55, { steps: 6 })
  await page.mouse.up()
  await expect(dialog.locator('[data-map-rect="true"]')).toHaveCount(0)
  const editorGeometry = await dialog.evaluate((element) => {
    const map = element.querySelector<HTMLElement>('[aria-label="Main Floor Valetudo map"]')
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    const mapRect = map?.getBoundingClientRect()
    return {
      bodyOverflowY: body ? getComputedStyle(body).overflowY : null,
      mapHeight: Math.round(mapRect?.height ?? 0),
      mapWidth: Math.round(mapRect?.width ?? 0),
    }
  })
  expect(editorGeometry.bodyOverflowY).toBe('auto')
  expect(editorGeometry.mapWidth).toBeGreaterThanOrEqual(280)
  expect(editorGeometry.mapHeight).toBeGreaterThanOrEqual(200)
})

test('vacuum map keeps stable desktop dimensions across targets and tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(map).toBeVisible()
  const roomsBox = await map.boundingBox()

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  const areaBox = await map.boundingBox()
  await dialog.getByRole('tab', { name: 'Zones' }).click()
  const zonesBox = await map.boundingBox()

  expect(Math.abs((areaBox?.width ?? 0) - (roomsBox?.width ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((areaBox?.height ?? 0) - (roomsBox?.height ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((zonesBox?.width ?? 0) - (roomsBox?.width ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((zonesBox?.height ?? 0) - (roomsBox?.height ?? 0))).toBeLessThanOrEqual(1)
})

test('vacuum modal navigation stays pinned while mobile content scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 568 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Zones' }).click()
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const before = await nav.boundingBox()

  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  const after = await nav.boundingBox()
  const viewportHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1)
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeLessThanOrEqual(viewportHeight + 1)
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  await dialog.getByRole('tab', { name: 'Controls' }).click()
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0)
})

test('vacuum native dropdown stays aligned after rapid close and reopen', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  const cardBox = await mainFloorVacuum.boundingBox()
  if (!cardBox) throw new Error('Main Floor vacuum card was not measurable')

  await mainFloorVacuum.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(450)

  await page.getByRole('combobox', { name: /Cleaning Passes/i }).selectOption('3')
  const closeBox = await page.getByRole('button', { name: 'Close' }).boundingBox()
  if (!closeBox) throw new Error('Vacuum modal close button was not measurable')

  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
  await page.waitForTimeout(50)
  await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.getByRole('combobox', { name: /Cleaning Passes/i }).scrollIntoViewIfNeeded()

  const rapidReopenState = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const select = document.querySelector<HTMLSelectElement>('select[aria-label^="Cleaning Passes"]')
    const rect = select?.getBoundingClientRect()
    const style = dialog ? getComputedStyle(dialog) : null
    const selectStyle = select ? getComputedStyle(select) : null
    const transform = style?.transform
    const translateY = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0

    return {
      animationName: style?.animationName,
      movementY: dialog?.style.getPropertyValue('--drawer-swipe-movement-y'),
      pointerEvents: selectStyle?.pointerEvents,
      selectRect: rect ? { y: rect.y, height: rect.height } : null,
      state: dialog?.getAttribute('data-state'),
      translateY,
      value: select?.value,
    }
  })

  expect(rapidReopenState.animationName).toBe('none')
  expect(rapidReopenState.movementY).toBe('0px')
  expect(rapidReopenState.pointerEvents).toBe('auto')
  expect(rapidReopenState.selectRect?.y).toBeLessThan(720)
  expect(rapidReopenState.state).toBe('open')
  expect(Math.abs(rapidReopenState.translateY)).toBeLessThanOrEqual(1)
  expect(rapidReopenState.value).toBe('3')

  await page.getByRole('combobox', { name: /Cleaning Passes/i }).selectOption('2')
  await expect(page.getByRole('combobox', { name: /Cleaning Passes/i })).toHaveValue('2')
})

test('vacuum mode dropdown keeps source option labels while optimistic', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  const cardBox = await mainFloorVacuum.boundingBox()
  if (!cardBox) throw new Error('Main Floor vacuum card was not measurable')

  await mainFloorVacuum.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await page.getByRole('combobox', { name: /Mode/i }).selectOption('mop')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await page.waitForTimeout(50)
  await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(page.getByRole('combobox', { name: /Mode Mop/i })).toBeVisible()

  const modeOptions = await page.getByRole('combobox', { name: /Mode Mop/i }).evaluate((select) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const style = dialog ? getComputedStyle(dialog) : null
    const transform = style?.transform
    return {
      animationName: style?.animationName,
      movementY: dialog?.style.getPropertyValue('--drawer-swipe-movement-y'),
      options: Array.from((select as HTMLSelectElement).options).map((option) => ({ label: option.label, value: option.value })),
      state: dialog?.getAttribute('data-state'),
      translateY: transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0,
      value: (select as HTMLSelectElement).value,
    }
  })

  expect(modeOptions.animationName).toBe('none')
  expect(modeOptions.movementY).toBe('0px')
  expect(modeOptions.state).toBe('open')
  expect(Math.abs(modeOptions.translateY)).toBeLessThanOrEqual(1)
  expect(modeOptions.value).toBe('mop')
  expect(modeOptions.options).toEqual([
    { label: 'Vacuum And Mop', value: 'vacuum_and_mop' },
    { label: 'Mop', value: 'mop' },
    { label: 'Vacuum', value: 'vacuum' },
    { label: 'Vacuum Then Mop', value: 'vacuum_then_mop' },
  ])

  await page.getByRole('combobox', { name: /Mode Mop/i }).selectOption('vacuum')
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
})

test('vacuum clean start shows disabled optimistic controls while backend is stale', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('button', { name: 'Clean', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Cleaning' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeDisabled()
})

test('thermostat modal contains full-size heat and cool markers at all mobile target extremes', async ({ page }) => {
  const viewportCases = [
    { width: 320, height: 568 },
    { width: 393, height: 852 },
  ]
  const targetCases = [
    { high: 95, low: 45 },
    { high: 72, low: 70 },
    { high: 70, low: 68 },
  ]

  for (const viewport of viewportCases) {
    await page.setViewportSize(viewport)
    await page.goto('/at-a-glance/ecobee#living-room')

    const dialog = page.getByRole('dialog', { name: 'Living Room' })
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const shell = dialog.locator('[data-thermostat-modal-dial-shell="true"]')
    const dial = dialog.locator('[role="region"][data-size="modal"]')
    const inputs = dial.locator('input[type="range"]')
    await expect(dialog).toBeVisible()
    await expect(shell).toHaveCSS('padding-top', '20px')

    for (const targets of targetCases) {
      await inputs.nth(0).fill(String(targets.low))
      await inputs.nth(1).fill(String(targets.high))
      await expect(dial).toHaveAttribute('aria-label', new RegExp(`${targets.low}\\.0 · ${targets.high}\\.0`))

      const metrics = await dial.evaluate((dialElement) => {
        const modalBody = dialElement.closest('[role="dialog"]')?.querySelector('[data-modal-sheet-body="true"]')
        const bodyRect = modalBody?.getBoundingClientRect()
        const handles = Array.from(dialElement.querySelectorAll<HTMLElement>('span[data-target="low"], span[data-target="high"]')).map((handle) => {
          const handleRect = handle.getBoundingClientRect()
          const markerStyle = getComputedStyle(handle, '::before')
          const markerOuterSize = Number.parseFloat(markerStyle.width) + 2 * Number.parseFloat(markerStyle.borderWidth)
          const markerTop = handleRect.top + handleRect.height / 2 - markerOuterSize / 2
          return {
            bottom: handleRect.bottom,
            height: handleRect.height,
            left: handleRect.left,
            markerTop,
            right: handleRect.right,
            target: handle.dataset.target,
            top: handleRect.top,
            width: handleRect.width,
          }
        })
        return {
          body: bodyRect && { bottom: bodyRect.bottom, left: bodyRect.left, right: bodyRect.right, top: bodyRect.top },
          handles,
        }
      })

      expect(metrics.body).not.toBeNull()
      for (const handle of metrics.handles) {
        expect(Math.round(handle.width)).toBe(64)
        expect(Math.round(handle.height)).toBe(64)
        expect(handle.top).toBeGreaterThanOrEqual(metrics.body!.top)
        expect(handle.markerTop).toBeGreaterThanOrEqual(metrics.body!.top)
        expect(handle.left).toBeGreaterThanOrEqual(metrics.body!.left)
        expect(handle.right).toBeLessThanOrEqual(metrics.body!.right)
        expect(handle.bottom).toBeLessThanOrEqual(metrics.body!.bottom)
      }
    }

    const maxScrollTop = await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return element.scrollHeight - element.clientHeight
    })
    await expect.poll(async () => body.evaluate((element) => Math.round(element.scrollTop))).toBe(Math.round(maxScrollTop))
    const closeButton = dialog.getByRole('button', { name: 'Close' })
    await expect(closeButton).toBeVisible()
    await closeButton.click()
    await expect(dialog).toHaveAttribute('data-state', 'closed')
  }
})

test('mobile bed thermostat keeps its top-arc hit target inside the scroller and its footer fixed', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /Steph's Bed Off/i }).click()

  const dialog = page.getByRole('dialog', { name: "Steph's Bed" })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const hero = dialog.locator('[data-section="eight-sleep-hero"]')
  const footer = dialog.getByRole('tablist', { name: "Steph's Bed modal sections" }).locator('..')
  await hero.getByRole('button', { name: "Turn on Steph's Bed" }).click()
  const marker = hero.locator('[data-target="value"]')
  await expect(marker).toBeVisible()

  const bodyBox = await body.boundingBox()
  const markerBox = await marker.boundingBox()
  const footerBefore = await footer.boundingBox()
  if (!bodyBox || !markerBox || !footerBefore) throw new Error('Mobile bed thermostat geometry was not measurable')
  expect(Math.round(markerBox.width)).toBe(64)
  expect(Math.round(markerBox.height)).toBe(64)
  expect(markerBox.y).toBeGreaterThanOrEqual(bodyBox.y)

  const maxScrollTop = await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return element.scrollHeight - element.clientHeight
  })
  await expect.poll(async () => body.evaluate((element) => Math.round(element.scrollTop))).toBe(Math.round(maxScrollTop))
  const footerAfter = await footer.boundingBox()
  expect(Math.abs(Math.round(footerAfter?.y ?? 0) - Math.round(footerBefore.y))).toBeLessThanOrEqual(1)
  expect(Math.abs(Math.round((footerAfter?.y ?? 0) + (footerAfter?.height ?? 0)) - Math.round(footerBefore.y + footerBefore.height))).toBeLessThanOrEqual(1)
})

test('mobile bed dial maps taps, drag, and keyboard to targets without invoking power confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  let confirmationCount = 0
  page.on('dialog', async (dialog) => {
    confirmationCount += 1
    await dialog.dismiss()
  })
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /Stephen's Bed (?:Cooling|Heating)/i }).click()

  const dialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  const dial = dialog.locator('[role="region"][data-size="modal"]')
  const powerButton = dialog.getByRole('button', { name: "Turn off Stephen's Bed" })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(powerButton).toBeVisible()
  await expect(dialog.getByText('Tap or drag the dial to set the target.')).toBeVisible()

  const dialBox = await dial.boundingBox()
  if (!dialBox) throw new Error('Bed dial was not measurable')
  await dial.click({ position: { x: dialBox.width * 0.8203, y: dialBox.height * 0.8203 } })

  await expect(dial).toHaveAttribute('aria-label', /Stephen's Bed thermostat Heating \+10/i)
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'number' && call.service === 'set_value' && call.target === 'number.nightcanvasrestful_left_target_temperature')
      .at(-1)
  ))).toMatchObject({ serviceData: { value: 10 } })
  expect(confirmationCount).toBe(0)

  const slider = dialog.getByRole('slider', { name: "Stephen's Bed target level" })
  await expect(dial.locator('[aria-hidden="true"][inert]')).toHaveCount(1)
  await expect(slider).toHaveAttribute('aria-valuenow', '10')
  await powerButton.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(slider).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await slider.focus()
  await slider.press('ArrowLeft')
  await expect(slider).toHaveAttribute('aria-valuenow', '9')
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'number' && call.service === 'set_value' && call.target === 'number.nightcanvasrestful_left_target_temperature')
      .at(-1)
  ))).toMatchObject({ serviceData: { value: 9 } })
  expect(confirmationCount).toBe(0)

  const markerBox = await slider.boundingBox()
  const dragDialBox = await dial.boundingBox()
  if (!markerBox || !dragDialBox) throw new Error('Bed target drag geometry was not measurable')
  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(dragDialBox.x + dragDialBox.width / 2, dragDialBox.y + dragDialBox.height * 0.0469, { steps: 8 })
  await page.mouse.up()

  await expect(slider).toHaveAttribute('aria-valuenow', '0')
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'number' && call.service === 'set_value' && call.target === 'number.nightcanvasrestful_left_target_temperature')
      .at(-1)
  ))).toMatchObject({ serviceData: { value: 0 } })
  expect(confirmationCount).toBe(0)

  await powerButton.click()
  expect(confirmationCount).toBe(1)
  const powerOffCalls = await page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'switch' && call.service === 'turn_off' && call.target === 'switch.nightcanvasrestful_left_power')
  ))
  expect(powerOffCalls).toHaveLength(0)
})

test('mobile SleepyPod target prompt keeps current-target commands separate from All Nights persistence', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    mock.setEntityState('climate.sleepypod_eight_pod_left_side', 'heat')
    mock.setEntityState('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2')
    mock.setEntityState('sensor.sleepypod_stephen_schedule_phase', 'bedtime')
  })

  await page.getByRole('button', { name: /Stephen's Bed Cooling/i }).click()
  const bedDialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  const dial = bedDialog.getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })
  const targetSlider = bedDialog.getByRole('slider', { name: "Stephen's Bed target level" })
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-2')
  const dialBox = await dial.boundingBox()
  if (!dialBox) throw new Error('SleepyPod target dial geometry was not measurable')
  const targetPoint = valueToThermostatPoint(-5, -10, 10)
  await startSleepypodPromptFrameSampler(page)
  await dial.click({
    position: {
      x: (targetPoint.x / 100) * dialBox.width,
      y: (targetPoint.y / 100) * dialBox.height,
    },
  })

  const scopeDialog = page.getByRole('dialog', { name: 'Set Bed Temperature' })
  await expect(scopeDialog).toBeVisible()
  await expect.poll(async () => (
    (await sleepypodPromptFrameSamples(page)).filter((sample) => sample.promptMounted).length
  )).toBeGreaterThanOrEqual(3)
  const mountedPromptFrames = (await sleepypodPromptFrameSamples(page)).filter((sample) => sample.promptMounted)
  expect(mountedPromptFrames.length).toBeGreaterThanOrEqual(3)
  for (const frame of mountedPromptFrames) {
    expect(frame.rangeValue).toBe('-5')
    expect(frame.readout).toContain('-5')
    expect(frame.regionLabel).toMatch(/Stephen's Bed thermostat Cooling -5/i)
    expect(frame.sliderValue).toBe('-5')
  }
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script')
  ))).toEqual([{
    domain: 'script',
    service: 'sleepypod_stephen_temperature_tonight',
    serviceData: { level: -5 },
  }])
  await expect(scopeDialog).toHaveAttribute('data-surface', 'hass-popup')
  await expect(scopeDialog).toContainText("Stephen's Bed • Bedtime • -5")
  await expect(scopeDialog.getByRole('button', { name: 'Tonight' })).toBeFocused()
  await expect(scopeDialog.locator('[data-modal-disclosure]')).toHaveCount(0)
  await expect.poll(async () => scopeDialog.evaluate((element) => Math.round(window.innerHeight - element.getBoundingClientRect().bottom))).toBe(0)
  const promptLayout = await scopeDialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const choices = [...element.querySelectorAll('button[aria-label="Tonight"], button[aria-label="All Nights"]')]
    return {
      backgroundColor: getComputedStyle(element).backgroundColor,
      bottomGap: Math.round(window.innerHeight - rect.bottom),
      borderRadius: getComputedStyle(element).borderRadius,
      choiceHeights: choices.map((choice) => Math.round(choice.getBoundingClientRect().height)),
      height: Math.round(rect.height),
      width: Math.round(rect.width),
    }
  })
  expect(promptLayout).toMatchObject({
    bottomGap: 0,
    borderRadius: '30px 30px 0px 0px',
    height: 430,
    width: 393,
  })
  expect(promptLayout.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(promptLayout.choiceHeights.every((height) => height >= 78)).toBe(true)

  await scopeDialog.getByRole('button', { name: 'Tonight' }).click()
  await expect(scopeDialog).toHaveAttribute('data-state', 'closed')
  await expect(scopeDialog).toHaveAttribute('data-closing', 'true')
  await expect(scopeDialog).toBeHidden()
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-5')
  await expect(targetSlider).toBeFocused()
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script')
  ))).toEqual([{
    domain: 'script',
    service: 'sleepypod_stephen_temperature_tonight',
    serviceData: { level: -5 },
  }])

  await targetSlider.press('ArrowLeft')
  await expect(scopeDialog).toBeVisible()
  await expect(scopeDialog).toContainText("Stephen's Bed • Bedtime • -6")
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script')
  ))).toEqual([
    {
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -5 },
    },
    {
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -6 },
    },
  ])
  await scopeDialog.getByRole('button', { name: 'All Nights' }).click()

  await expect(scopeDialog).toHaveAttribute('data-state', 'closed')
  await expect(scopeDialog).toHaveAttribute('data-closing', 'true')
  await page.waitForTimeout(350)
  await expect(scopeDialog).toHaveCount(1)
  await page.waitForTimeout(250)
  await expect(scopeDialog).toHaveCount(0)
  await expect(targetSlider).toBeFocused()
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script')
  ))).toHaveLength(2)
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'number' || call.domain === 'climate')
  ))).toEqual([])
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'input_number' && call.service === 'set_value')
  ))).toEqual([{
    domain: 'input_number',
    service: 'set_value',
    target: 'input_number.eight_sleep_stephen_bedtime_level',
    serviceData: { value: -6 },
  }])
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-6')
})

test('thermostat Vacation end transitions to Away or Home with correct dial ranges on mobile', async ({ page }) => {
  const expectRangeValues = async (dial: Locator, low: number, high: number) => {
    const sliders = dial.locator('input[type="range"]')
    await expect(sliders).toHaveCount(2)
    await expect(sliders.nth(0)).toHaveValue(String(low))
    await expect(sliders.nth(1)).toHaveValue(String(high))
  }

  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/ecobee')
  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: {
      calls: Record<string, unknown>[]
      setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      setEntityState: (entityId: string, state: string) => void
    } }).__mockHass
    mock.setEntityState('input_boolean.vacation_mode', 'on')
    mock.setEntityState('binary_sensor.thermostat_contact_sensors_away_mode_active', 'on')
    mock.setEntityState('sensor.thermostat_effective_home_away', 'Away')
    mock.setEntityState('sensor.thermostat_home_away_reason', 'Vacation Mode is active and everyone is away; TCS is keeping Eco active without heating or cooling.')
    mock.setEntityAttribute('climate.thermostat_contact_sensors_living_room_virtual_thermostat', 'away_mode_active', true)
  })
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.mouse.click(390, 500)

  const hero = page.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/ })
  const wholeHomeVacationMode = page.getByRole('region', { name: 'Whole Home Vacation Mode' })
  await expect(hero).toBeVisible()
  await expectRangeValues(hero, 62, 78)
  await expect(wholeHomeVacationMode).toBeVisible()
  await expect(page.getByLabel('Vacation Mode On')).toHaveCount(0)
  await expect(page.getByText('Vacation Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const heroElement = document.querySelector('[aria-label^="Whole Home thermostat"]')
    const hubElement = document.querySelector('[aria-label="Thermostat Hub Off"]')
    const awayElement = document.querySelector('[aria-label="Whole Home Vacation Mode"]')
    return Boolean(
      heroElement
      && hubElement
      && awayElement
      && (heroElement.compareDocumentPosition(hubElement) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (hubElement.compareDocumentPosition(awayElement) & Node.DOCUMENT_POSITION_FOLLOWING),
    )
  })).toBe(true)
  const vacationControls = await openThermostatControls(page)
  await vacationControls.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  const dialog = page.getByRole('dialog', { name: 'Living Room' })
  const roomDial = dialog.getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/ })
  await expectRangeValues(roomDial, 72, 74)
  await expect(dialog.getByRole('region', { name: 'Living Room Vacation Mode' })).toBeVisible()
  await expect(dialog.getByLabel('Vacation Mode On')).toHaveCount(0)

  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: {
      setEntityState: (entityId: string, state: string) => void
    } }).__mockHass
    mock.setEntityState('input_boolean.vacation_mode', 'off')
    mock.setEntityState('sensor.thermostat_home_away_reason', 'Everyone is away; TCS is keeping Eco active without heating or cooling.')
  })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
  const awayHero = page.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/ })
  await expectRangeValues(awayHero, 62, 78)
  await expect(page.getByRole('region', { name: 'Whole Home Away Mode' })).toBeVisible()

  const awayControls = await openThermostatControls(page)
  await awayControls.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  const awayDialog = page.getByRole('dialog', { name: 'Living Room' })
  const awayRoomDial = awayDialog.getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/ })
  await expectRangeValues(awayRoomDial, 72, 74)
  await expect(awayDialog.getByRole('region', { name: 'Living Room Away Mode' })).toBeVisible()
  await expect(awayDialog.getByText('Away Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeVisible()
  await awayDialog.getByRole('button', { name: 'Close' }).click()
  await expect(awayDialog).toHaveCount(0)

  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: {
      setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      setEntityState: (entityId: string, state: string) => void
    } }).__mockHass
    mock.setEntityState('binary_sensor.thermostat_contact_sensors_away_mode_active', 'off')
    mock.setEntityState('sensor.thermostat_effective_home_away', 'Home')
    mock.setEntityState('sensor.thermostat_home_away_reason', 'A resident is home, so TCS is using home behavior.')
    mock.setEntityAttribute('climate.thermostat_contact_sensors_living_room_virtual_thermostat', 'away_mode_active', false)
  })
  const homeControls = await openThermostatControls(page)
  await homeControls.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  const homeDialog = page.getByRole('dialog', { name: 'Living Room' })
  const homeRoomDial = homeDialog.getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/ })
  await expectRangeValues(homeRoomDial, 72, 74)
  await expect(homeDialog.getByRole('region', { name: /Living Room (?:Away|Vacation) Mode/ })).toHaveCount(0)
  await homeDialog.getByRole('button', { name: 'Close' }).click()
  await expect(homeDialog).toHaveCount(0)

  const homeHero = page.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/ })
  await expectRangeValues(homeHero, 72, 74)
  await expect(page.getByRole('region', { name: /Whole Home (?:Away|Vacation) Mode/ })).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.filter((call) => call.domain === 'climate' && call.service === 'set_temperature'))).toEqual([])
})

test('thermostat hero dial allows vertical swipe scrolling', async ({ page, browserName }) => {
  await page.goto('/at-a-glance/ecobee')

  await expect(page.getByRole('heading', { level: 1, name: 'Thermostat' })).toBeVisible()
  await expect(page.getByText(/manually reviewed/i)).toHaveCount(0)

  const heroDial = page.getByRole('region', { name: /Whole Home thermostat/i })
  await expect(heroDial).toBeVisible()
  await expect(heroDial.locator('[data-testid="control-slider-circular"]')).toHaveCSS('touch-action', 'pan-y')
  const beforeLabel = await heroDial.getAttribute('aria-label')
  expect(beforeLabel).toContain('Whole Home thermostat')

  const touchDrag = async (startX: number, startY: number, endX: number, endY: number) => {
    if (browserName === 'chromium') {
      const client = await page.context().newCDPSession(page)
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] })
      for (let step = 1; step <= 8; step += 1) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + ((endX - startX) * step) / 8, y: startY + ((endY - startY) * step) / 8 }] })
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await client.detach()
      return
    }

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()
  }

  const mouseDrag = async (startX: number, startY: number, endX: number, endY: number) => {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()
  }

  const pointForTemperature = (box: NonNullable<Awaited<ReturnType<typeof heroDial.boundingBox>>>, value: number) => {
    const percentage = (value - 45) / (95 - 45)
    const angle = percentage * 270
    const radians = ((angle - 225) * Math.PI) / 180
    const radius = box.width * (145 / 320)
    return {
      x: box.x + box.width / 2 + Math.cos(radians) * radius,
      y: box.y + box.height / 2 + Math.sin(radians) * radius,
    }
  }

  const scrollTop = () => heroDial.evaluate((element) => {
    let current = element.parentElement
    while (current) {
      const style = window.getComputedStyle(current)
      if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current.scrollTop
      current = current.parentElement
    }
    return window.scrollY
  })

  const before = await scrollTop()
  const box = await heroDial.boundingBox()
  expect(box).not.toBeNull()

  const highHandle = heroDial.locator('[data-target="high"]')
  await expect(highHandle).toHaveCount(1)
  const highHandleBox = await highHandle.boundingBox()
  expect(highHandleBox).not.toBeNull()
  const highHandleEnd = pointForTemperature(box!, 78)
  await mouseDrag(highHandleBox!.x + highHandleBox!.width / 2, highHandleBox!.y + highHandleBox!.height / 2, highHandleEnd.x, highHandleEnd.y)
  await expect(heroDial).not.toHaveAttribute('aria-label', beforeLabel!)
  await expect.poll(async () => (await highHandle.boundingBox())?.x ?? 0).toBeGreaterThan(highHandleBox!.x + 20)
  const lowHandle = heroDial.locator('[data-target="low"]')
  await expect(lowHandle).toHaveCount(1)
  const lowHandleBox = await lowHandle.boundingBox()
  expect(lowHandleBox).not.toBeNull()
  const labelBeforeLowDrag = await heroDial.getAttribute('aria-label')
  const lowHandleEnd = pointForTemperature(box!, 68)
  await mouseDrag(lowHandleBox!.x + lowHandleBox!.width / 2, lowHandleBox!.y + lowHandleBox!.height / 2, lowHandleEnd.x, lowHandleEnd.y)
  await expect(heroDial).not.toHaveAttribute('aria-label', labelBeforeLowDrag!)
  await page.waitForTimeout(300)
  const labelBeforeRingSwipe = (await heroDial.getAttribute('aria-label')) ?? beforeLabel!

  const ringX = box!.x + box!.width * 0.86
  const ringY = box!.y + box!.height * 0.5
  await touchDrag(ringX, ringY, ringX, ringY - 224)

  await expect.poll(scrollTop).toBeGreaterThan(before + 40)
  await expect(heroDial).toHaveAttribute('aria-label', labelBeforeRingSwipe)
})

test('daily summary deep link opens the tabbed modal for the requested user', async ({ page }) => {
  await page.goto('/index.html?path=overview&user=stephen#daily-report')

  const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
  await expect(dialog.getByRole('heading', { name: "Stephen's Summary" })).toBeVisible()
  await expect(dialog).toHaveAttribute('data-has-subtitle', 'false')

  const nav = dialog.getByRole('tablist', { name: 'Daily report sections' })
  const tabs = nav.getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await expect(tabs.nth(0)).toContainText('Overdue Chores')
  await expect(tabs.nth(1)).toContainText('Upcoming Chores')
  await expect(tabs.nth(2)).toContainText('Expired Food')
  await expect(nav.getByRole('tab', { name: /^Overdue Chores/ }).locator('[data-count]')).toHaveText('1')
  await expect(nav.getByRole('tab', { name: 'Upcoming Chores' }).locator('[data-count]')).toHaveCount(0)

  await expect(dialog.getByRole('region', { name: 'Overdue Chores' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Edit Mock task one' })).toBeVisible()

  await page.evaluate(() => {
    const mock = (window as unknown as { __mockHass: { setDonetickTaskLoadDelay: (delayMs: number) => void } }).__mockHass
    mock.setDonetickTaskLoadDelay(800)
  })
  await dialog.getByRole('button', { name: 'Edit Mock task one' }).click()
  const editPage = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(editPage).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  const loadingTask = editPage.getByRole('status', { name: 'Loading task' })
  await expect(loadingTask).toBeVisible()
  const loadingAlignment = await loadingTask.evaluate((element) => {
    const body = element.closest('[data-modal-sheet-body="true"]')
    const spinner = element.querySelector('span')
    if (!(body instanceof HTMLElement) || !(spinner instanceof HTMLElement)) return null
    const bodyBox = body.getBoundingClientRect()
    const spinnerBox = spinner.getBoundingClientRect()
    const bodyStyle = window.getComputedStyle(body)
    const paddingTop = Number.parseFloat(bodyStyle.paddingTop) || 0
    const paddingBottom = Number.parseFloat(bodyStyle.paddingBottom) || 0
    const expectedCenter = bodyBox.top + paddingTop + (bodyBox.height - paddingTop - paddingBottom) / 2
    return {
      actualCenter: spinnerBox.top + spinnerBox.height / 2,
      expectedCenter,
    }
  })
  expect(loadingAlignment).not.toBeNull()
  expect(Math.abs((loadingAlignment?.actualCenter ?? 0) - (loadingAlignment?.expectedCenter ?? 0))).toBeLessThanOrEqual(2)
  await expect(editPage.getByLabel('Task Name')).toHaveValue('Mock task one')
  await expect(editPage.getByRole('button', { name: 'Back to daily summary' })).toBeVisible()
  await expect(editPage.getByRole('tablist', { name: 'Daily report sections' })).toHaveCount(0)
  await editPage.getByRole('button', { name: 'Back to daily summary' }).click()
  await expect(dialog).toBeVisible()

  const bodyHeader = dialog.locator('[data-modal-sheet-body-header="true"]')
  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeVisible()

  await nav.getByRole('tab', { name: /^Upcoming Chores/ }).click()
  await expect(dialog.getByRole('region', { name: 'Upcoming Chores' })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Upcoming Chores' }).getByRole('button', { name: 'Edit Mock task one' })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Overdue Chores' })).toHaveCount(0)

  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Upcoming Chores' })).toBeVisible()

  await nav.getByRole('tab', { name: /^Expired Food/ }).click()
  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Expired Food' })).toBeVisible()
  await expect(dialog.getByLabel('Expired Food inventory list')).toBeVisible()
  const expiredRow = dialog.locator('[data-expiry-tone="expired"]').first()
  await expect(expiredRow).toBeVisible()
  await expect(expiredRow.getByRole('button', { name: /^Edit / })).toBeVisible()
  await expect(expiredRow.getByRole('button', { name: /^Delete / })).toBeVisible()

  await expiredRow.getByRole('button', { name: 'Edit Milk' }).click()
  const inventoryPage = page.getByRole('dialog', { name: 'Milk' })
  await expect(inventoryPage).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(inventoryPage.getByRole('button', { name: 'Back to expired food' })).toBeVisible()
  await expect(inventoryPage.getByRole('button', { name: 'Delete Milk' })).toBeVisible()
  await expect(inventoryPage.getByRole('tablist', { name: 'Daily report sections' })).toHaveCount(0)

  await inventoryPage.getByRole('button', { name: 'Back to expired food' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Expired Food inventory list')).toBeVisible()
})

test('daily summary deep link titles the modal for the other household user', async ({ page }) => {
  await page.goto('/index.html?path=overview&user=steph#daily-report')

  await expect(page.getByRole('dialog').getByRole('heading', { name: "Steph's Summary" })).toBeVisible()
})

test('daily summary modal closes back to the home dashboard', async ({ page }) => {
  await page.goto('/index.html?path=overview&user=stephen#daily-report')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
})

test('header profile button opens the summary modal from any page', async ({ page }) => {
  await page.goto('/index.html?path=vacuums')

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()
  await profileButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: "Stephen's Summary" })).toBeVisible()
  await expect(dialog.getByRole('tablist', { name: 'Daily report sections' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('#daily-report')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
})

test('header profile button stays visible and opaque across route changes', async ({ page }) => {
  await page.goto('/index.html?path=overview')

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary/ })
  await expect(profileButton).toBeVisible()

  await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Security' }).click()

  // The profile button is persistent chrome, so it must never fade during the route transition.
  for (let sample = 0; sample < 6; sample += 1) {
    await expect(profileButton).toHaveCSS('opacity', '1')
    await page.waitForTimeout(40)
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
  await expect(profileButton).toHaveCSS('opacity', '1')
})

test('daily summary empty tabs centre without scrolling the sheet', async ({ page }) => {
  await page.goto('/index.html?path=overview&user=stephen')

  await page.evaluate(() => {
    const api = (window as unknown as { __mockHass: { setTodoItems: (id: string, items: unknown[]) => void; setEntityState: (id: string, state: string) => void } }).__mockHass
    api.setTodoItems('todo.stephen_s_past_due_with_unassigned', [])
    api.setEntityState('todo.stephen_s_past_due_with_unassigned', '0')
    api.setEntityState('input_boolean.vacation_mode', 'on')
  })

  await page.getByRole('button', { name: /^Open .+'s Summary/ }).click()
  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { level: 2, name: 'No Chores Due' })).toBeVisible()
  await expect(dialog.locator('[data-empty-layout="modal"]')).toHaveCount(1)
  await expect(dialog.getByText('Enjoy vacation!')).toBeVisible()

  const body = dialog.locator('[data-modal-sheet-body="true"]')
  await expect.poll(() => body.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0)

  await dialog.getByRole('tablist', { name: 'Daily report sections' }).getByRole('tab', { name: /^Expired Food/ }).click()
  await expect(dialog.getByRole('heading', { level: 2, name: 'Expired Food Hidden' })).toBeVisible()
  await expect(dialog.getByLabel('Expired Food inventory list')).toHaveCount(0)
  await expect.poll(() => body.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0)
})

test('daily summary keeps the last expired-food empty state centred while the sensor catches up', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/index.html?path=overview&user=stephen')

  await page.getByRole('button', { name: /^Open .+'s Summary/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tablist', { name: 'Daily report sections' }).getByRole('tab', { name: /^Expired Food/ }).click()

  page.once('dialog', (confirmation) => void confirmation.accept())
  await dialog.getByRole('button', { name: 'Delete Almond Flour' }).click()
  await expect(dialog.getByRole('button', { name: 'Delete Almond Flour' })).toHaveCount(0)

  page.once('dialog', (confirmation) => void confirmation.accept())
  await dialog.getByRole('button', { name: 'Delete Milk' }).click()
  await expect(dialog.getByLabel('Expired Food inventory list')).toBeVisible()
  await expect(dialog.getByRole('heading', { level: 2, name: 'No Expired Food' })).toBeVisible()

  const measureEmptyCopy = () => dialog.getByRole('heading', { level: 2, name: 'No Expired Food' }).evaluate((heading) => {
    const emptyState = heading.closest('[data-empty-layout="modal"]')
    const modalBody = heading.closest('[role="dialog"]')?.querySelector('[data-modal-sheet-body="true"]')
    if (!(emptyState instanceof HTMLElement) || !(modalBody instanceof HTMLElement)) return null

    const copyBoxes = [...emptyState.children]
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map((child) => child.getBoundingClientRect())
    const bodyBox = modalBody.getBoundingClientRect()
    const bodyStyle = getComputedStyle(modalBody)
    const paddingTop = Number.parseFloat(bodyStyle.paddingTop) || 0
    const paddingBottom = Number.parseFloat(bodyStyle.paddingBottom) || 0
    const copyTop = Math.min(...copyBoxes.map((box) => box.top))
    const copyBottom = Math.max(...copyBoxes.map((box) => box.bottom))

    return {
      actualCenter: (copyTop + copyBottom) / 2,
      expectedCenter: bodyBox.top + paddingTop + (bodyBox.height - paddingTop - paddingBottom) / 2,
    }
  })

  const optimisticAlignment = await measureEmptyCopy()
  expect(optimisticAlignment).not.toBeNull()
  expect(Math.abs((optimisticAlignment?.actualCenter ?? 0) - (optimisticAlignment?.expectedCenter ?? 0))).toBeLessThanOrEqual(2)

  await page.evaluate(() => {
    const api = (window as unknown as {
      __mockHass: {
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    api.setEntityAttribute('sensor.evershelf_expired_items', 'expired_list', [])
    api.setEntityState('sensor.evershelf_expired_items', '0')
    const url = new URL(window.location.href)
    url.searchParams.set('refresh', 'expired-food-empty')
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(dialog.getByLabel('Expired Food inventory list')).toHaveCount(0)
  const confirmedAlignment = await measureEmptyCopy()
  expect(confirmedAlignment).not.toBeNull()
  expect(Math.abs((confirmedAlignment?.actualCenter ?? 0) - (confirmedAlignment?.expectedCenter ?? 0))).toBeLessThanOrEqual(2)
  expect(Math.abs((confirmedAlignment?.actualCenter ?? 0) - (optimisticAlignment?.actualCenter ?? 0))).toBeLessThanOrEqual(2)
})

test('profile button badges overdue chores plus expired food, capped at 9+', async ({ page }) => {
  await page.goto('/index.html?path=overview')

  const profile = page.getByRole('button', { name: /^Open .+'s Summary/ })
  const badge = profile.locator('[data-count]')

  const setCounts = async (overdue: number, expired: number, upcoming: number) => {
    await page.evaluate(([o, e, u]) => {
      const api = (window as unknown as {
        __mockHass: {
          setEntityState: (id: string, state: string) => void
          setEntityAttribute: (id: string, attribute: string, value: unknown) => void
        }
      }).__mockHass
      api.setEntityState('todo.stephen_s_past_due_with_unassigned', String(o))
      api.setEntityState('todo.stephen_s_due_today_with_unassigned', String(u))
      // Expired food is counted from the list on the local calendar, not the UTC-derived state.
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const expiryDate = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
      api.setEntityAttribute('sensor.evershelf_expired_items', 'expired_list', Array.from({ length: e }, (_, index) => ({
        expiry_date: expiryDate,
        inventory_id: 900 + index,
        name: `Expired Item ${index + 1}`,
      })))
      api.setEntityState('sensor.evershelf_expired_items', String(e))
    }, [overdue, expired, upcoming])
    const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
    await nav.getByRole('button', { name: 'Security' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
    await nav.getByRole('button', { name: 'Home' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  }

  // Upcoming chores are deliberately excluded from the count.
  await setCounts(2, 1, 6)
  await expect(badge).toHaveText('3')
  await expect(profile).toHaveAttribute('aria-label', /3 items need attention$/)

  await setCounts(4, 32, 0)
  await expect(badge).toHaveText('9+')

  await setCounts(0, 0, 4)
  await expect(badge).toHaveCount(0)
  await expect(profile).toHaveAttribute('aria-label', /Summary$/)
})

test('bottom nav badges the Chores tab with overdue chores only', async ({ page }) => {
  await page.goto('/index.html?path=overview')

  const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
  const setOverdue = async (count: number) => {
    await page.evaluate((value) => {
      const api = (window as unknown as { __mockHass: { setEntityState: (id: string, state: string) => void } }).__mockHass
      api.setEntityState('todo.stephen_s_past_due_with_unassigned', String(value))
    }, count)
    await nav.getByRole('button', { name: 'Security' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
    await nav.getByRole('button', { name: 'Home' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
  }

  await setOverdue(3)
  await expect(nav.getByRole('button', { name: /^Chores/ }).locator('[data-count]')).toHaveText('3')
  // Expired food feeds the summary badge, not this one.
  for (const label of ['Home', 'Security', 'Climate', 'Settings']) {
    await expect(nav.getByRole('button', { name: label }).locator('[data-count]')).toHaveCount(0)
  }

  await setOverdue(0)
  await expect(nav.getByRole('button', { name: 'Chores' }).locator('[data-count]')).toHaveCount(0)
})
