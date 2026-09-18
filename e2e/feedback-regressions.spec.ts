// @covers src/pages/DashboardViewPage.tsx
// @covers src/components/hass/TodoListPanel.tsx
// @covers src/components/hass/EditTodoItemSheet.tsx
// @covers src/components/hass/EditTodoItemSheet.module.css
// @covers src/components/core/ModalSheet.tsx
import { expect, test, type Locator, type Page } from './layout/fixture'
import { navigationLayoutForViewport } from '../src/constants/navigationLayout'
import { installSafeAreaInsets, setSafeAreaInsets } from './safe-area'
import { waitForModalReady, waitForNavigation } from './layout/evidence'
import { openQuickLinksTab } from './quick-links'

const PHONE = { width: 393, height: 852 }
const TABLET_PORTRAIT = { width: 820, height: 1180 }
const TABLET_LANDSCAPE = { width: 1180, height: 820 }
const DESKTOP = { width: 1440, height: 900 }

async function expectViewportCentered(locator: Locator, page: Page) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2)).toBeLessThanOrEqual(1)
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - (viewport?.height ?? 0) / 2)).toBeLessThanOrEqual(1)
}

async function openQuickLinks(page: Page) {
  await page.goto('/at-a-glance/overview')
  const menu = page.locator('[data-page-header="true"]:visible button[aria-label="Open navigation menu"]').first()
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  const dialog = await openQuickLinksTab(page)
  await expect(dialog).toBeVisible()
  return { dialog, menuBox }
}

test('Admin To-Do edits by UID with a title-only responsive modal', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/index.html?path=to-do')
  await page.evaluate(() => {
    const mock = window.__mockHass!
    mock.setEntityState('todo.groceries', '2')
    mock.setTodoItems('todo.groceries', [
      { status: 'needs_action', summary: 'Duplicate title', uid: 'admin-one' },
      { status: 'needs_action', summary: 'Duplicate title', uid: 'admin-two' },
    ])
  })

  const list = page.getByLabel('Admin To-Do todo list')
  await expect(list.getByRole('button', { name: 'Edit Duplicate title' })).toHaveCount(2)
  await list.getByRole('button', { name: 'Edit Duplicate title' }).nth(1).click()

  const dialog = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(dialog.getByLabel('Task Name')).toHaveValue('Duplicate title')
  await expect(dialog.getByRole('button', { name: 'Reset' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
  await dialog.getByLabel('Task Name').fill('  Renamed task  ')
  await expect(dialog.getByRole('button', { name: 'Reset' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled()
  const box = await dialog.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(PHONE.width)
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)

  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'todo' && call.service === 'update_item'))).toEqual([
    {
      domain: 'todo',
      service: 'update_item',
      target: 'todo.groceries',
      serviceData: { item: 'admin-two', rename: 'Renamed task' },
    },
  ])
  await expect(dialog).toHaveAttribute('data-state', 'closed')
})

test('Admin To-Do preserves modal semantics, failure retry, and responsive action geometry', async ({ page }) => {
  const viewports = [
    { height: 852, name: 'phone portrait', width: 393 },
    { height: 393, name: 'phone landscape', width: 852 },
    { height: 900, name: 'centered desktop', width: 1440 },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize({ height: viewport.height, width: viewport.width })
    await page.goto(`/index.html?path=to-do&feedback-admin-edit=${viewport.name.replaceAll(' ', '-')}`)
    await page.evaluate(() => {
      const mock = window.__mockHass!
      mock.setEntityState('todo.groceries', '1')
      mock.setTodoItems('todo.groceries', [
        { status: 'needs_action', summary: 'Responsive admin task', uid: 'admin-responsive' },
      ])
    })

    const list = page.getByLabel('Admin To-Do todo list')
    const opener = list.getByRole('button', { name: 'Edit Responsive admin task' })
    await expect(opener).toBeVisible()
    const rowGeometry = await list.locator('li').evaluateAll((rows) => rows.map((row) => {
      const rowBox = row.getBoundingClientRect()
      const trigger = row.querySelector<HTMLElement>('button[data-action-kind="modal"][aria-label^="Edit "]')
      const triggerBox = trigger?.getBoundingClientRect()
      const task = row.querySelector<HTMLElement>('button[aria-pressed]')
      const taskBox = task?.getBoundingClientRect()
      return {
        row: { left: rowBox.left, right: rowBox.right, top: rowBox.top, bottom: rowBox.bottom },
        trigger: triggerBox
          ? { left: triggerBox.left, right: triggerBox.right, top: triggerBox.top, bottom: triggerBox.bottom, width: triggerBox.width, height: triggerBox.height }
          : null,
        task: taskBox
          ? { left: taskBox.left, right: taskBox.right, top: taskBox.top, bottom: taskBox.bottom }
          : null,
        triggerCount: row.querySelectorAll('button[data-action-kind="modal"][aria-label^="Edit "]').length,
        rowScrollWidth: row.scrollWidth,
        rowClientWidth: row.clientWidth,
        triggerScrollWidth: trigger?.scrollWidth ?? null,
        triggerClientWidth: trigger?.clientWidth ?? null,
      }
    }))
    expect(rowGeometry).toHaveLength(1)
    for (const geometry of rowGeometry) {
      expect(geometry.triggerCount).toBe(1)
      expect(geometry.trigger).not.toBeNull()
      expect(Math.round(geometry.trigger!.width)).toBeGreaterThanOrEqual(44)
      expect(Math.round(geometry.trigger!.height)).toBeGreaterThanOrEqual(44)
      expect(geometry.trigger!.right).toBeLessThanOrEqual(geometry.row.right + 1)
      expect(Math.abs(geometry.trigger!.right - geometry.row.right)).toBeLessThanOrEqual(1)
      expect(geometry.trigger!.bottom).toBeLessThanOrEqual(geometry.row.bottom + 1)
      expect(geometry.trigger!.left).toBeGreaterThanOrEqual(geometry.row.left - 1)
      expect(geometry.trigger!.top).toBeGreaterThanOrEqual(geometry.row.top - 1)
      expect(geometry.rowScrollWidth).toBeLessThanOrEqual(geometry.rowClientWidth + 1)
      expect(geometry.triggerScrollWidth).toBeLessThanOrEqual(geometry.triggerClientWidth! + 1)
      expect(geometry.task).not.toBeNull()
      expect(geometry.task!.right).toBeLessThanOrEqual(geometry.trigger!.left + 1)
      expect(geometry.task!.bottom).toBeLessThanOrEqual(geometry.row.bottom + 1)
    }
    await opener.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Edit Task' })
    const input = dialog.getByLabel('Task Name')
    await expect(input).toHaveValue('Responsive admin task')
    await expect(dialog.getByRole('button', { name: 'Reset' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
    await input.focus()
    await page.keyboard.press('Tab')
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

    await input.fill('Retry responsive task')
    await input.press('Enter')
    await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'todo'))).toHaveLength(1)
    await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'todo' && call.service === 'update_item'))).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        target: 'todo.groceries',
        serviceData: { item: 'admin-responsive', rename: 'Retry responsive task' },
      },
    ])
    await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'script'))).toHaveLength(0)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await opener.focus()
    await opener.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect(dialog).toHaveCount(0, { timeout: 700 })
    await expect(opener).toBeFocused()

    await opener.click()
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(viewport.width)
    expect(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(dialog.getByRole('button', { name: 'Reset' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible()
    const resetBox = await dialog.getByRole('button', { name: 'Reset' }).boundingBox()
    const saveBox = await dialog.getByRole('button', { name: 'Save' }).boundingBox()
    expect(resetBox).not.toBeNull()
    expect(saveBox).not.toBeNull()
    expect(resetBox!.height).toBeGreaterThanOrEqual(48)
    expect(saveBox!.height).toBeGreaterThanOrEqual(48)
    expect(Math.abs(resetBox!.y - saveBox!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(resetBox!.height - saveBox!.height)).toBeLessThanOrEqual(1)
    expect(saveBox!.x - (resetBox!.x + resetBox!.width)).toBeGreaterThanOrEqual(9)
    expect(saveBox!.x - (resetBox!.x + resetBox!.width)).toBeLessThanOrEqual(11)
    expect(saveBox!.width).toBeGreaterThan(resetBox!.width)
  }
})

test('Admin To-Do failure retains the draft and retries through the same update service', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/index.html?path=to-do&feedback-admin-edit=failure')
  await page.evaluate(() => {
    const mock = window.__mockHass!
    mock.setEntityState('todo.groceries', '1')
    mock.setTodoItems('todo.groceries', [
      { status: 'needs_action', summary: 'Failure task', uid: 'admin-failure' },
    ])
    mock.setCallServiceOutcome('todo', 'update_item', 'reject')
  })

  const opener = page.getByLabel('Admin To-Do todo list').getByRole('button', { name: 'Edit Failure task' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Edit Task' })
  const input = dialog.getByLabel('Task Name')
  await input.fill('Retained failure draft')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Mock service rejection')
  await expect(input).toHaveValue('Retained failure draft')
  await expect(dialog).toBeVisible()

  await page.evaluate(() => window.__mockHass!.setCallServiceOutcome('todo', 'update_item', 'resolve'))
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'todo' && call.service === 'update_item'))).toHaveLength(2)
})

test('Admin To-Do without a UID has no update or completion call', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/index.html?path=to-do&feedback-admin-edit=missing-uid')
  await page.evaluate(() => {
    const mock = window.__mockHass!
    mock.setEntityState('todo.groceries', '1')
    mock.setTodoItems('todo.groceries', [
      { status: 'needs_action', summary: 'Missing identity' },
    ])
  })

  const opener = page.getByLabel('Admin To-Do todo list').getByRole('button', { name: 'Edit Missing identity' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(dialog.getByRole('alert')).toHaveText(/identity is unavailable/)
  await dialog.getByLabel('Task Name').fill('Should not save')
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(await page.evaluate(() => window.__mockHass!.calls)).toEqual([])
})

async function waitForAppReady(page: Page) {
  await expect(page.locator('[data-page-scroller="true"]:visible').last()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(240)
}

test('page loaders stay centered in the full viewport', async ({ page }) => {
  for (const viewport of [PHONE, TABLET_LANDSCAPE, DESKTOP]) {
    await page.setViewportSize(viewport)
    await page.goto(`/at-a-glance/food?feedback-loader=${viewport.width}`)
    await expectViewportCentered(page.getByRole('status', { name: 'Loading Food & Recipes' }), page)
    await expect(page.getByRole('status', { name: 'Loading Food & Recipes' })).not.toBeVisible({ timeout: 12_000 })
  }
})

test('Summary tabs switch without a blank flash or desktop dialog resize', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/index.html?path=overview&user=stephen#daily-report')

  const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
  const nav = dialog.getByRole('tablist', { name: 'Daily report sections' })
  const panel = dialog.getByRole('tabpanel')
  await expect(dialog).toBeVisible()

  await nav.getByRole('tab', { name: /^Expired Food/ }).click()
  await expect(dialog.getByLabel('Expired Food inventory list')).toBeVisible()
  const expiredBox = await dialog.boundingBox()

  await nav.getByRole('tab', { name: 'Upcoming Chores' }).click()
  await expect(dialog.getByRole('region', { name: 'Upcoming Chores' })).toBeVisible()
  await expect(panel).not.toHaveAttribute('data-modal-tab-transition-state')
  await expect(panel).toHaveCSS('opacity', '1')
  const upcomingBox = await dialog.boundingBox()

  expect(Math.round(upcomingBox?.width ?? 0)).toBe(Math.round(expiredBox?.width ?? 0))
  expect(Math.round(upcomingBox?.height ?? 0)).toBe(Math.round(expiredBox?.height ?? 0))
})

test('the Lights modal scrolls to its terminal controls on tablet', async ({ page }) => {
  const entityId = 'light.front_door_bollard_1'
  await page.setViewportSize(TABLET_LANDSCAPE)
  await page.goto(`/?__modalAcceptance=light-more-info&__modalValue=Bollard%201&__modalValue=${entityId}`)
  await page.evaluate((target) => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState(target, 'on')
    mock.setEntityAttribute(target, 'supported_color_modes', ['color_temp', 'xy'])
    mock.setEntityAttribute(target, 'color_mode', 'xy')
    mock.setEntityAttribute(target, 'rgb_color', [10, 20, 30])
  }, entityId)

  const dialog = page.getByRole('dialog', { name: 'Bollard 1' })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const terminalAction = dialog.getByRole('button', { name: 'Apply to All Lights' })
  await expect(terminalAction).toBeAttached()
  await expect.poll(() => body.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0)
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(terminalAction).toBeVisible()
  await expect.poll(() => body.evaluate((element) => Math.round(element.scrollTop + element.clientHeight - element.scrollHeight))).toBeGreaterThanOrEqual(-1)
})

test('modal dismissal does not leak the tap to covered navigation controls', async ({ page }) => {
  for (const viewport of [PHONE, TABLET_PORTRAIT]) {
    await page.setViewportSize(viewport)
    const { dialog, menuBox } = await openQuickLinks(page)
    const dialogBox = await dialog.boundingBox()
    expect(menuBox).not.toBeNull()
    expect(dialogBox).not.toBeNull()

    const point = {
      x: (menuBox?.x ?? 0) + (menuBox?.width ?? 0) / 2,
      y: (menuBox?.y ?? 0) + (menuBox?.height ?? 0) / 2,
    }
    expect(
      point.x < (dialogBox?.x ?? 0)
      || point.x > (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)
      || point.y < (dialogBox?.y ?? 0)
      || point.y > (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0),
    ).toBe(true)

    await page.touchscreen.tap(point.x, point.y)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect(dialog).toHaveCount(0, { timeout: 700 })
    await expect(page.getByRole('complementary', { name: 'Navigation menu' })).toHaveCount(0)
    expect(new URL(page.url()).hash).toBe('')
  }
})

test('modal content taps stay owned by the topmost modal', async ({ page }) => {
  await page.setViewportSize(TABLET_PORTRAIT)
  const { dialog } = await openQuickLinks(page)
  const rooms = dialog.getByRole('button', { name: 'Rooms' })
  const roomsBox = await rooms.boundingBox()
  expect(roomsBox).not.toBeNull()

  await page.touchscreen.tap(
    (roomsBox?.x ?? 0) + (roomsBox?.width ?? 0) / 2,
    (roomsBox?.y ?? 0) + (roomsBox?.height ?? 0) / 2,
  )

  await expect(page.getByRole('dialog', { name: 'Rooms' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(new URL(page.url()).hash).toBe('')
})

test('wide navigation is transparent and keeps every route entry bright', async ({ page }) => {
  await page.setViewportSize(TABLET_LANDSCAPE)
  await page.goto('/at-a-glance/overview')

  const rail = page.getByRole('complementary', { name: 'Navigation menu' })
  await expect(rail).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(rail).toHaveCSS('border-right-width', '0px')
  const items = rail.getByRole('button')
  await expect(items).toHaveCount(5)
  for (const item of await items.all()) await expect(item).toHaveCSS('color', 'rgb(247, 251, 255)')
  await expect(rail.getByRole('button', { name: 'Home' })).toHaveCSS('box-shadow', 'none')
})

test('sidebars place the Chores count at the trailing edge of its row', async ({ page }) => {
  for (const viewport of [PHONE, DESKTOP]) {
    await page.setViewportSize(viewport)
    await page.goto(`/at-a-glance/overview?feedback-sidebar-badge=${viewport.width}`)
    await waitForNavigation(page)
    let navigation: Locator
    const navigationLayout = navigationLayoutForViewport(viewport)
    if (navigationLayout !== 'rail') {
      await page.locator('[data-page-header="true"]:visible button[aria-label="Open navigation menu"]').click()
      navigation = page.locator('[data-adaptive-navigation="drawer"]')
      await expect(navigation).toHaveAttribute('data-state', 'open')
    } else {
      navigation = page.locator('[data-adaptive-navigation="rail"]')
    }

    await expect(navigation).toBeVisible()
    await expect.poll(() => navigation.evaluate((element) => !element.getAnimations({ subtree: true }).some((animation) =>
      animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity,
    ))).toBe(true)
    const chores = navigation.getByRole(navigationLayout === 'rail' ? 'button' : 'menuitem', { name: /Chores/ })
    await expect.poll(async () => {
      const metrics = await chores.evaluate((row) => {
        const icon = row.querySelector('svg')
        const badge = row.querySelector('[data-count]')
        if (!icon || !badge) throw new Error('Chores row requires its actual icon and count badge')
        const measure = (element: Element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          if (!element.getClientRects().length || rect.width <= 0 || rect.height <= 0
            || style.visibility !== 'visible' || Number(style.opacity) <= 0) throw new Error('Chores geometry requires visible nonzero elements')
          return { left: rect.left, right: rect.right }
        }
        return { row: measure(row), icon: measure(icon), badge: measure(badge) }
      })
      expect(metrics.badge.left).toBeGreaterThan(metrics.icon.right)
      return Math.abs(metrics.row.right - metrics.badge.right - 11)
    }).toBeLessThanOrEqual(2)
  }
})

const PAGE_LAYOUT_VIEWPORTS = [
  { appColumns: 2, cameraColumns: 2, choreColumns: 2, customColumns: 2, height: 852, remoteColumns: 2, securityCellWidth: 175.5, width: 393 },
  { appColumns: 3, cameraColumns: 4, choreColumns: 3, customColumns: 3, height: 393, remoteColumns: 3, securityCellWidth: 197.5, width: 852 },
  { appColumns: 3, cameraColumns: 4, choreColumns: 3, customColumns: 3, height: 1180, remoteColumns: 3, securityCellWidth: 189.5, width: 820 },
  { appColumns: 3, cameraColumns: 4, choreColumns: 3, customColumns: 4, height: 820, remoteColumns: 3, securityCellWidth: 217.5, width: 1180 },
  { appColumns: 3, cameraColumns: 4, choreColumns: 3, customColumns: 4, height: 900, remoteColumns: 3, securityCellWidth: 282.5, width: 1440 },
  { appColumns: 3, cameraColumns: 4, choreColumns: 3, customColumns: 4, height: 1080, remoteColumns: 3, securityCellWidth: 312.5, width: 1920 },
] as const

function activeRoute(page: Page, path: string) {
  return page.locator('[data-route-path="' + path + '"]:visible').last()
}

async function setMockStates(page: Page, states: Record<string, string>) {
  await page.evaluate((entries) => {
    const mock = (window as unknown as {
      __mockHass: { setEntityState: (entityId: string, state: string) => void }
    }).__mockHass
    for (const [entityId, state] of entries) mock.setEntityState(entityId, state)
  }, Object.entries(states))
}

async function openTheaterRemote(page: Page) {
  const root = activeRoute(page, 'media')
  await root.getByRole('button', { name: /^Theater Room Off$/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Theater Room SHIELD Remote' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('Home cameras and Security tiles use content-aware spans at every tier', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of PAGE_LAYOUT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/at-a-glance/security?feedback-layout=' + viewport.width)
    const root = activeRoute(page, 'security')
    await expect(root.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()

    const controlGrid = root.getByRole('button', { name: /Security System Armed Home/i })
      .locator('xpath=ancestor::*[@data-dynamic-grid="true"][1]')
    const cameraGrid = root.getByRole('button', { name: 'Open Front Door camera' })
      .locator('xpath=ancestor::*[@data-dynamic-grid="true"][1]')
    await expect(controlGrid).toHaveAttribute('data-dynamic-grid-columns', String(viewport.cameraColumns))
    await expect(cameraGrid).toHaveAttribute('data-dynamic-grid-columns', String(viewport.cameraColumns))
    await expect(controlGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(cameraGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(controlGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    await expect(cameraGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')

    for (const grid of [controlGrid, cameraGrid]) {
      const section = grid.locator('xpath=ancestor::section[1]')
      const item = section.locator('xpath=..')
      const pageContent = root.locator('[data-page-content="true"]')
      await expect(item).toHaveAttribute('data-span', 'full')
      const geometry = await Promise.all([grid.boundingBox(), section.boundingBox(), pageContent.boundingBox()])
      expect(geometry.every(Boolean)).toBe(true)
      expect(Math.abs((geometry[0]?.width ?? 0) - (geometry[1]?.width ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((geometry[0]?.width ?? 0) - (geometry[2]?.width ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((geometry[0]?.x ?? 0) + (geometry[0]?.width ?? 0) - ((geometry[1]?.x ?? 0) + (geometry[1]?.width ?? 0)))).toBeLessThanOrEqual(1)
      const cells = await grid.locator(':scope > [data-dynamic-grid-cell]').evaluateAll((elements) =>
        elements.map((cell) => ({
          span: Number(cell.getAttribute('data-dynamic-grid-span')),
          width: cell.getBoundingClientRect().width,
        })),
      )
      for (const cell of cells) {
        const expectedWidth = viewport.securityCellWidth * cell.span + 10 * (cell.span - 1)
        expect(Math.abs(cell.width - expectedWidth)).toBeLessThanOrEqual(1)
      }
    }

    if (viewport.width === 820) {
      await setMockStates(page, { 'input_boolean.guests_staying_in_music_room': 'on' })
      const guestSection = root.getByRole('heading', { name: 'Guest Presence Security' }).locator('xpath=ancestor::*[@data-responsive-section-item="true"][1]')
      await expect(guestSection).toHaveAttribute('data-span', 'full')
      await expect(controlGrid.locator('xpath=ancestor::*[@data-responsive-section-item="true"][1]')).toHaveAttribute('data-span', 'full')
    }

    await page.goto('/at-a-glance/overview?feedback-layout=' + viewport.width)
    const homeRoot = activeRoute(page, 'overview')
    await expect(homeRoot.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
    const homeCameraGrid = homeRoot.getByRole('button', { name: 'Open Front Door camera' })
      .locator('xpath=ancestor::*[@data-dynamic-grid="true"][1]')
    await expect(homeCameraGrid).toHaveAttribute('data-dynamic-grid-columns', String(viewport.cameraColumns))
    await expect(homeCameraGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(homeCameraGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    await expect(homeCameraGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
    await expect(homeCameraGrid).toHaveAttribute('data-dynamic-grid-max-columns', '4')
    const homeCells = await homeCameraGrid.locator(':scope > [data-dynamic-grid-cell]').evaluateAll((cells) =>
      cells.map((cell) => ({
        span: Number(cell.getAttribute('data-dynamic-grid-span')),
        width: cell.getBoundingClientRect().width,
      })),
    )
    for (const cell of homeCells) {
      const expectedWidth = viewport.securityCellWidth * cell.span + 10 * (cell.span - 1)
      expect(Math.abs(cell.width - expectedWidth)).toBeLessThanOrEqual(1)
    }
  }
})

// @covers src/components/hass/EditTodoItemSheet.tsx
// @covers src/components/hass/EditTodoItemSheet.module.css
// @covers src/components/hass/TodoListPanel.tsx
test('Chores uses content-aware Quick Links and reflows task rows without reordering', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of PAGE_LAYOUT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview&feedback-chores=' + viewport.width)
    await page.evaluate(() => {
      const mock = (window as unknown as {
        __mockHass: {
          setEntityState: (entityId: string, state: string) => void
          setTodoItems: (entityId: string, items: { status: string; summary: string; uid: string }[]) => void
        }
      }).__mockHass
      const entityId = 'todo.stephen_s_past_due_with_unassigned'
      mock.setEntityState(entityId, '2')
      mock.setTodoItems(entityId, [
        { status: 'needs_action', summary: 'First layout task', uid: 'layout-one' },
        { status: 'needs_action', summary: 'Second layout task', uid: 'layout-two' },
      ])
      const url = new URL(window.location.href)
      url.searchParams.set('path', 'chores')
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    const root = activeRoute(page, 'chores')
    await expect(root.getByRole('heading', { level: 1, name: 'Chores' })).toBeVisible()
    const quickLinks = root.getByRole('group', { name: 'Chore quick links' })
    await expect(quickLinks).toHaveAttribute('data-dynamic-grid-columns', String(viewport.choreColumns))
    await expect(quickLinks).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    const quickLinkLayout = await quickLinks.locator(':scope > [data-dynamic-grid-cell]').evaluateAll((cells) =>
      cells.map((cell) => ({
        labelsFit: Array.from(cell.querySelectorAll<HTMLElement>('[data-dynamic-grid-label="true"]'))
          .every((label) => label.scrollWidth <= label.clientWidth + 1),
        span: Number(cell.getAttribute('data-dynamic-grid-span')),
      })),
    )
    expect(quickLinkLayout).toHaveLength(5)
    expect(quickLinkLayout.every(({ labelsFit, span }) => labelsFit && span >= 1 && span <= viewport.choreColumns)).toBe(true)
    if (viewport.width === 393) expect(quickLinkLayout.every(({ span }) => span === 2)).toBe(true)

    const list = root.getByLabel('Past Due todo list')
    await expect(list).toHaveAttribute('data-layout', 'responsive-grid')
    await expect(list.locator('li')).toHaveCount(2)
    const columns = await list.locator('li').evaluateAll((items) =>
      new Set(items.map((item) => Math.round(item.getBoundingClientRect().x))).size,
    )
    expect(columns).toBe(viewport.width === 393 ? 1 : 2)
    expect(await list.locator('li').allTextContents()).toEqual(['First layout task', 'Second layout task'])
  }
})

test('long battery task titles remain fully visible across dashboard viewports', async ({ page }) => {
  test.setTimeout(120_000)
  const title = 'Replace Hallway/Entryway/Living Room Presence Sensor Battery · 20%'
  const viewports = [
    { width: 393, height: 852 },
    { width: 852, height: 393 },
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto(`/index.html?path=overview&battery-title=${viewport.width}`)
    await page.evaluate((taskTitle) => {
      const mock = (window as unknown as {
        __mockHass: {
          reset: () => void
          setEntityState: (entityId: string, state: string) => void
          setTodoItems: (entityId: string, items: {
            description?: string
            due?: string
            status: string
            summary: string
            uid: string
          }[]) => void
        }
      }).__mockHass
      mock.reset()
      const entityId = 'todo.stephen_s_past_due_with_unassigned'
      mock.setTodoItems(entityId, [{
        description: [
          'The Hallway/Entryway/Living Room Presence Sensor battery is at 20%.',
          '',
          'Maintenance reference: BATT-LONG1234.',
        ].join('\n'),
        due: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'needs_action',
        summary: taskTitle,
        uid: '540--2026-08-31 00:00:00+00:00',
      }])
      mock.setEntityState(entityId, '1')
      const url = new URL(window.location.href)
      url.searchParams.set('path', 'chores')
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, title)

    const root = activeRoute(page, 'chores')
    const titleElement = root.getByText(title, { exact: true })
    await expect(titleElement).toBeVisible()
    const metrics = await titleElement.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        lineHeight: Number.parseFloat(style.lineHeight),
        overflowWrap: style.overflowWrap,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
      }
    })

    expect(metrics.whiteSpace).toBe('normal')
    expect(metrics.overflowWrap).toBe('anywhere')
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.pageOverflow).toBeLessThanOrEqual(1)
    if (viewport.width === 393) {
      expect(metrics.clientHeight).toBeGreaterThan(metrics.lineHeight * 1.5)
    }
  }

  const resizeSequences = [
    [{ width: 393, height: 852 }, { width: 1440, height: 900 }, { width: 393, height: 852 }],
    [{ width: 1440, height: 900 }, { width: 393, height: 852 }, { width: 1440, height: 900 }],
    [{ width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }],
  ]
  const activeTitle = activeRoute(page, 'chores').getByText(title, { exact: true })
  for (const sequence of resizeSequences) {
    for (const viewport of sequence) {
      await page.setViewportSize(viewport)
      await expect(activeTitle).toBeVisible()
      await expect.poll(() => activeTitle.evaluate((element) => (
        element.scrollHeight <= element.clientHeight + 1
        && element.scrollWidth <= element.clientWidth + 1
        && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      ))).toBe(true)
    }
  }
})

test('Custom Lights keeps two phone columns and uses bounded content-aware wider grids', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of PAGE_LAYOUT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/at-a-glance/custom-lights?feedback-layout=' + viewport.width)
    await setMockStates(page, {
      'input_boolean.manually_control_front_yard_lights': 'on',
      'input_select.front_yard_custom_lights': 'Custom',
    })
    const root = activeRoute(page, 'custom-lights')
    const firstLight = root.getByRole('group', { name: 'Left Door Light' })
    await expect(firstLight).toBeVisible()
    const grid = firstLight.locator('xpath=ancestor::*[@data-dynamic-grid="true"][1]')
    await expect(grid).toHaveAttribute('data-dynamic-grid-columns', String(viewport.customColumns))
    await expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')

    const modeToggle = root.getByRole('button', { name: 'Manually control front yard lights' })
    const modeCard = modeToggle.locator('..')
    const modeSelect = root.getByRole('button', { name: 'Select lighting mode' })
    const modeWidth = Math.round((await modeToggle.boundingBox())?.width ?? 0)
    const resetWidth = Math.round((await root.getByRole('button', { name: 'Reset All Lights' }).boundingBox())?.width ?? 0)
    const pageContentBox = await root.locator('[data-page-content="true"]').boundingBox()
    const frontYardSectionBox = await root.getByRole('heading', { name: 'Front Yard' }).locator('xpath=ancestor::section[1]').boundingBox()
    expect(pageContentBox).not.toBeNull()
    expect(frontYardSectionBox).not.toBeNull()
    expect(Math.abs((pageContentBox?.width ?? 0) - (frontYardSectionBox?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((pageContentBox?.x ?? 0) + (pageContentBox?.width ?? 0) - ((frontYardSectionBox?.x ?? 0) + (frontYardSectionBox?.width ?? 0)))).toBeLessThanOrEqual(1)
    if (viewport.width === 393) {
      expect(Math.round((await modeCard.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(345)
      expect(resetWidth).toBeGreaterThanOrEqual(355)
    } else {
      const contentWidth = Math.round((await root.locator('[data-page-content="true"]').boundingBox())?.width ?? 0)
      const modeSelectWidth = Math.round((await modeSelect.boundingBox())?.width ?? 0)
      expect(modeWidth).toBeGreaterThanOrEqual(Math.floor(contentWidth * 0.45))
      expect(modeWidth).toBeLessThanOrEqual(Math.ceil(contentWidth * 0.51))
      expect(Math.abs(modeWidth - modeSelectWidth)).toBeLessThanOrEqual(1)
      expect(Math.abs(modeWidth - resetWidth)).toBeLessThanOrEqual(1)
      await expect(modeSelect).toContainText('Lighting Mode')
      await expect(modeSelect).toContainText('Custom')
    }
  }
})

test('Media source groups preserve order and fill the Theater follow-up row', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of PAGE_LAYOUT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/at-a-glance/media?feedback-layout=' + viewport.width)
    const root = activeRoute(page, 'media')
    await expect(root.getByRole('heading', { level: 1, name: 'Media' })).toBeVisible()
    const livingSection = root.getByRole('heading', { level: 2, name: 'Living Room' }).locator('xpath=ancestor::section[1]')
    const musicSection = root.getByRole('heading', { level: 2, name: 'Music Room' }).locator('xpath=ancestor::section[1]')
    const theaterSection = root.getByRole('heading', { level: 2, name: 'Theater Room' }).locator('xpath=ancestor::section[1]')
    const livingBox = await livingSection.boundingBox()
    const musicBox = await musicSection.boundingBox()
    const theaterBox = await theaterSection.boundingBox()
    const theaterControls = root.getByRole('group', { name: 'Theater Room Controls' })
    const theaterControlsBox = await theaterControls.boundingBox()
    expect(livingBox).not.toBeNull()
    expect(musicBox).not.toBeNull()
    expect(theaterBox).not.toBeNull()
    expect(theaterControlsBox).not.toBeNull()
    expect(Math.abs((theaterControlsBox?.x ?? 0) - (theaterBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((theaterControlsBox?.width ?? 0) - (theaterBox?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((theaterControlsBox?.x ?? 0) + (theaterControlsBox?.width ?? 0) - ((theaterBox?.x ?? 0) + (theaterBox?.width ?? 0)))).toBeLessThanOrEqual(1)

    if (viewport.width === 393) {
      expect(Math.round(livingBox?.x ?? 0)).toBe(16)
      expect(Math.round(livingBox?.width ?? 0)).toBe(361)
      expect(Math.round(theaterBox?.height ?? 0)).toBe(444)
      expect(musicBox?.y ?? 0).toBeGreaterThan((livingBox?.y ?? 0) + (livingBox?.height ?? 0))
      expect(theaterBox?.y ?? 0).toBeGreaterThan((musicBox?.y ?? 0) + (musicBox?.height ?? 0))
    } else {
      expect(Math.abs((livingBox?.y ?? 0) - (musicBox?.y ?? 0))).toBeLessThanOrEqual(1)
      expect(theaterBox?.y ?? 0).toBeGreaterThan(Math.max(
        (livingBox?.y ?? 0) + (livingBox?.height ?? 0),
        (musicBox?.y ?? 0) + (musicBox?.height ?? 0),
      ))
      expect(Math.abs((livingBox?.x ?? 0) - (theaterBox?.x ?? 0))).toBeLessThanOrEqual(1)
    }

    if (viewport.width === 1440) {
      const livingWidth = Math.round((await root.getByRole('button', { name: /^Living Room SHIELD Off$/i }).boundingBox())?.width ?? 0)
      const theaterWidth = Math.round((await root.getByRole('button', { name: /^Theater Room Off$/i }).boundingBox())?.width ?? 0)
      expect(Math.abs(livingWidth - Math.round(livingBox?.width ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs(theaterWidth - Math.round(theaterBox?.width ?? 0))).toBeLessThanOrEqual(1)
    }
  }
})

test('Theater Remote stays visible while Apps and Devices use their available pane', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of PAGE_LAYOUT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/at-a-glance/media?feedback-remote=' + viewport.width)
    await page.evaluate(() => {
      const calls = (window as unknown as { __mockHass: { calls: unknown[] } }).__mockHass.calls
      calls.splice(0, calls.length)
    })
    const dialog = await openTheaterRemote(page)
    const remote = dialog.getByRole('group', { name: 'Theater Room SHIELD remote controls' })
    await expect(remote).toBeVisible()

    await dialog.getByRole('tab', { name: 'Apps' }).click()
    await expect(dialog.getByRole('heading', { name: 'Media' })).toBeVisible()
    await waitForModalReady(dialog)
    await expect(remote).toBeVisible()
    const appButtons = dialog.locator('button[class*="appButton"]')
    await expect(appButtons).toHaveCount(6)
    const appColumns = await appButtons.evaluateAll((buttons) =>
      new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().x))).size,
    )
    expect(appColumns).toBe(viewport.appColumns)
    await dialog.locator('[data-modal-sheet-body="true"], [data-scroll-region="media-remote-panel"]').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = element.scrollHeight
    })
    const finalAppBox = await dialog.getByRole('button', { name: 'Disney+' }).boundingBox()
    const navBox = await dialog.getByRole('tablist').boundingBox()
    expect((finalAppBox?.y ?? 0) + (finalAppBox?.height ?? 0)).toBeLessThanOrEqual((navBox?.y ?? 0) + 1)

    await dialog.getByRole('tab', { name: 'Devices' }).click()
    await expect(dialog.getByRole('heading', { name: 'Devices' })).toBeVisible()
    await waitForModalReady(dialog)
    await expect(remote).toBeVisible()
    const deviceGrid = dialog.getByRole('button', { name: /Projector Off/i })
      .locator('xpath=ancestor::*[@data-dynamic-grid="true"][1]')
    await expect(deviceGrid).toHaveAttribute('data-dynamic-grid-columns', String(viewport.remoteColumns))
    await expect(deviceGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    const gridBox = await deviceGrid.boundingBox()
    expect(gridBox).not.toBeNull()

    if (viewport.width === 820) {
      expect(Math.round(gridBox?.width ?? 0)).toBeGreaterThan(600)
      const stackedScroller = dialog.locator('[data-scroll-region="media-remote-panel"]')
      await expect.poll(() => stackedScroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight
        return Math.abs(element.scrollTop - Math.max(0, element.scrollHeight - element.clientHeight))
      })).toBeLessThanOrEqual(1)
      const pcBox = await dialog.getByRole('button', { name: /Theater Room PC Off/i }).boundingBox()
      expect((pcBox?.y ?? 0) + (pcBox?.height ?? 0)).toBeLessThanOrEqual(navBox?.y ?? 0)
    } else if (viewport.width >= 1180) {
      expect(Math.round(gridBox?.width ?? 0)).toBeGreaterThanOrEqual(630)
      expect(Math.round(gridBox?.width ?? 0)).toBeLessThanOrEqual(634)
      expect(Math.round((await remote.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(389)
      expect(Math.round((await remote.boundingBox())?.width ?? 0)).toBeLessThanOrEqual(391)
    }

    const commandCalls = await page.evaluate(() => {
      const calls = (window as unknown as { __mockHass: { calls: { domain?: string; service?: string }[] } }).__mockHass.calls
      return calls.filter((call) => ['androidtv', 'input_button', 'media_player', 'remote'].includes(call.domain ?? '')
        || (call.domain === 'script' && ['toggle_on_off_theater_room'].includes(call.service ?? '')))
    })
    expect(commandCalls).toEqual([])
  }
})

const ROOM_OVERVIEW_MODALS = [
  { dialogName: /Lights/, hash: '#lights-overview', sectionLabel: 'Lights by room' },
  { dialogName: 'Climate', hash: '#climate-overview', sectionLabel: 'Climate by room' },
  { dialogName: 'Occupancy', hash: '#occupancy-overview', sectionLabel: 'Occupancy by room' },
  { dialogName: 'Contact Sensors', hash: '#contact-sensors-overview', sectionLabel: 'Contact sensors by room' },
  { dialogName: 'Air Quality', hash: '#aqi-overview', sectionLabel: 'AQI by room' },
] as const

async function terminalOverviewGeometry(dialog: Locator, sectionLabel: string) {
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const section = dialog.getByLabel(sectionLabel)
  const grids = section.locator('[style*="--modal-square-cols"]')
  const finalGrid = grids.last()
  const finalCard = finalGrid.locator(':scope > *').last()
  await dialog.evaluate((element) => {
    for (const candidate of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
      const overflowY = getComputedStyle(candidate).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') candidate.scrollTop = candidate.scrollHeight
    }
  })
  const [dialogBox, bodyBox, finalGridBox, finalCardBox] = await Promise.all([
    dialog.boundingBox(),
    body.boundingBox(),
    finalGrid.boundingBox(),
    finalCard.boundingBox(),
  ])
  expect(dialogBox).not.toBeNull()
  expect(bodyBox).not.toBeNull()
  expect(finalGridBox).not.toBeNull()
  expect(finalCardBox).not.toBeNull()
  return {
    finalGap: (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0) - ((finalCardBox?.y ?? 0) + (finalCardBox?.height ?? 0)),
    fullyVisible: (finalCardBox?.y ?? 0) >= (bodyBox?.y ?? 0) - 1
      && (finalCardBox?.y ?? 0) + (finalCardBox?.height ?? 0) <= (bodyBox?.y ?? 0) + (bodyBox?.height ?? 0) + 1,
    horizontalCenterDelta: Math.abs(
      (finalGridBox?.x ?? 0) + (finalGridBox?.width ?? 0) / 2
      - ((bodyBox?.x ?? 0) + (bodyBox?.width ?? 0) / 2),
    ),
  }
}

test('room overview modals keep portrait padding and centered dialog grids', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await installSafeAreaInsets(page, { bottom: 34, left: 0, right: 0, top: 59 })
  await page.goto('/at-a-glance/overview?feedback-lights=393#lights-overview')
  const mobileLights = page.getByRole('dialog', { name: /Lights/ })
  await expect(mobileLights).toBeVisible()
  await page.waitForTimeout(540)
  const mobileGeometry = await terminalOverviewGeometry(mobileLights, 'Lights by room')
  expect(mobileGeometry.fullyVisible).toBe(true)
  await expect(mobileLights.locator('[data-modal-sheet-body="true"]')).toHaveCSS('padding-bottom', '58px')

  for (const viewport of [TABLET_PORTRAIT, TABLET_LANDSCAPE, DESKTOP]) {
    for (const modalCase of ROOM_OVERVIEW_MODALS) {
      await page.setViewportSize(viewport)
      await page.goto(`/at-a-glance/overview?feedback-overview=${viewport.width}${modalCase.hash}`)
      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(540)
      const geometry = await terminalOverviewGeometry(dialog, modalCase.sectionLabel)
      expect(geometry.fullyVisible, `${modalCase.sectionLabel} ${viewport.width}x${viewport.height}`).toBe(true)
      expect(geometry.horizontalCenterDelta, `${modalCase.sectionLabel} horizontal centering`).toBeLessThanOrEqual(1)
    }
  }
})

test('Lights room cards pass wheel scrolling to the modal body', async ({ page }) => {
  await page.setViewportSize({ width: 949, height: 860 })
  await page.goto('/at-a-glance/overview?feedback-lights-wheel=true#lights-overview')
  const dialog = page.getByRole('dialog', { name: /Lights/ })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const roomGrid = dialog.getByLabel(/rooms$/).first().locator('[style*="--modal-square-cols"]')
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(540)
  await body.evaluate((element) => { element.scrollTop = 0 })
  const gridBox = await roomGrid.boundingBox()
  expect(gridBox).not.toBeNull()
  await page.mouse.move((gridBox?.x ?? 0) + (gridBox?.width ?? 0) / 2, (gridBox?.y ?? 0) + Math.min(100, (gridBox?.height ?? 0) / 2))
  await page.mouse.wheel(0, 500)
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(40)
  await page.mouse.wheel(0, 2_000)
  const geometry = await terminalOverviewGeometry(dialog, 'Lights by room')
  expect(geometry.fullyVisible).toBe(true)
  expect([40, 41]).toContain(Math.round(geometry.finalGap))
})

test('body-scrolling modal measures retain their bottom padding at every presentation', async ({ page }) => {
  test.setTimeout(90_000)
  for (const profile of [
    { width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
    { width: 852, height: 393, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
    { width: 667, height: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 949, height: 860, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  ]) {
    for (const title of ['Lights', 'Rooms']) {
      await page.setViewportSize(profile)
      await page.goto(`/index.html?path=overview${title === 'Lights' ? '#lights-overview' : ''}`)
      await setSafeAreaInsets(page, profile.insets)
      if (title === 'Rooms') {
        await openQuickLinksTab(page)
        await page.getByRole('dialog', { name: 'Quick Links' }).getByRole('button', { name: 'Rooms', exact: true }).click()
      }
      const dialog = page.getByRole('dialog', { name: title === 'Lights' ? /Lights/ : 'Rooms' })
      await expect(dialog).toBeVisible()
      await expect.poll(() => dialog.evaluate((element) => {
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')!
        const measure = element.querySelector<HTMLElement>('[data-modal-content-measure="true"]')!
        body.scrollTop = body.scrollHeight
        const gap = body.getBoundingClientRect().bottom - measure.getBoundingClientRect().bottom
        return Math.abs(gap - Number.parseFloat(getComputedStyle(body).paddingBottom))
      }), { message: `${title} ${profile.width}x${profile.height}: intrinsic content must retain the real end inset` }).toBeLessThanOrEqual(1)
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
  }
})

test('Presence Overrides keeps one stable sheet and one scroll owner', async ({ page }) => {
  const viewports = [
    { expectedHeight: 767, ...PHONE },
    { expectedHeight: 760, ...TABLET_PORTRAIT },
    { expectedHeight: 756, ...TABLET_LANDSCAPE },
    { expectedHeight: 760, ...DESKTOP },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto(`/at-a-glance/admin?feedback-presence=${viewport.width}#presence-based-overrides`)
    const dialog = page.getByRole('dialog', { name: 'Presence-Based Overrides' })
    await expect(dialog).toBeVisible()
    const overviewHeight = (await dialog.boundingBox())?.height ?? 0
    expect(Math.abs(overviewHeight - viewport.expectedHeight)).toBeLessThanOrEqual(1)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    await expect(body).toHaveCSS('overflow-y', 'auto')
    const nestedScrollOwners = await body.evaluate((element) =>
      Array.from(element.querySelectorAll<HTMLElement>('*')).filter((candidate) => {
        const overflowY = getComputedStyle(candidate).overflowY
        return candidate.scrollHeight > candidate.clientHeight + 1 && (overflowY === 'auto' || overflowY === 'scroll')
      }).length,
    )
    expect(nestedScrollOwners).toBe(0)
    const overviewGrid = dialog.getByLabel('Presence-Based Overrides by room')
    const finalCard = overviewGrid.getByRole('button').last()
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight })
    const [bodyBox, finalCardBox] = await Promise.all([body.boundingBox(), finalCard.boundingBox()])
    expect((finalCardBox?.y ?? 0) + (finalCardBox?.height ?? 0)).toBeLessThanOrEqual((bodyBox?.y ?? 0) + (bodyBox?.height ?? 0) + 1)

    await overviewGrid.getByRole('button').first().click()
    const detail = page.getByRole('dialog', { name: 'Living Room Presence Lighting' })
    await expect(detail).toBeVisible()
    const detailHeight = (await detail.boundingBox())?.height ?? 0
    expect(Math.abs(detailHeight - overviewHeight)).toBeLessThanOrEqual(1)
    const detailAlignment = await detail.evaluate((element) => {
      const modalBody = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
      const detailPage = element.querySelector<HTMLElement>('[aria-label$="presence lighting controls"]')
      if (!modalBody || !detailPage) return null
      const bodyBox = modalBody.getBoundingClientRect()
      const detailBox = detailPage.getBoundingClientRect()
      const bodyStyle = getComputedStyle(modalBody)
      const contentTop = bodyBox.top + (Number.parseFloat(bodyStyle.paddingTop) || 0)
      const contentBottom = bodyBox.bottom - (Number.parseFloat(bodyStyle.paddingBottom) || 0)
      return {
        centerDelta: Math.abs((detailBox.top + detailBox.bottom) / 2 - (contentTop + contentBottom) / 2),
        paddingBottom: getComputedStyle(detailPage).paddingBottom,
      }
    })
    expect(detailAlignment).not.toBeNull()
    expect(detailAlignment?.centerDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1)
    expect(detailAlignment?.paddingBottom).toBe('0px')
  }
})

test('task editors use the common stable desktop frame', async ({ page }) => {
  for (const viewport of [TABLET_PORTRAIT, TABLET_LANDSCAPE, DESKTOP]) {
    await page.setViewportSize(viewport)
    await page.goto(`/at-a-glance/chores?feedback-edit=${viewport.width}`)
    await page.evaluate(() => {
      const mock = (window as unknown as { __mockHass: { setDonetickTaskLoadDelay: (delayMs: number) => void } }).__mockHass
      mock.setDonetickTaskLoadDelay(600)
    })
    await page.getByRole('button', { name: /^Edit / }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Edit Task' })
    const loading = dialog.getByRole('status', { name: 'Loading task' })
    await expect(loading).toBeVisible()
    const initialHeight = (await dialog.boundingBox())?.height ?? 0
    await expect(dialog.getByLabel('Task Name')).toBeVisible()
    const finalHeight = (await dialog.boundingBox())?.height ?? 0
    const expectedHeight = Math.min(760, viewport.height - 64)
    expect(Math.abs(initialHeight - expectedHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(finalHeight - initialHeight)).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize(TABLET_PORTRAIT)
  await page.goto('/at-a-glance/chores?feedback-add-task=true')
  await page.getByRole('button', { name: 'Add Task' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Create Task' })
  await expect(addDialog).toBeVisible()
  expect(Math.abs(((await addDialog.boundingBox())?.height ?? 0) - 760)).toBeLessThanOrEqual(1)
})

test('Daily Summary keeps its host height through task and inventory detail pages', async ({ page }) => {
  for (const viewport of [TABLET_PORTRAIT, TABLET_LANDSCAPE, DESKTOP]) {
    await page.setViewportSize(viewport)
    await page.goto(`/index.html?path=overview&user=stephen&feedback-summary=${viewport.width}#daily-report`)
    const summary = page.getByRole('dialog', { name: "Stephen's Summary" })
    await expect(summary).toBeVisible()
    const expectedHeight = Math.min(760, viewport.height - 64)
    expect(Math.abs(((await summary.boundingBox())?.height ?? 0) - expectedHeight)).toBeLessThanOrEqual(1)
    await page.evaluate(() => {
      const mock = (window as unknown as { __mockHass: { setDonetickTaskLoadDelay: (delayMs: number) => void } }).__mockHass
      mock.setDonetickTaskLoadDelay(500)
    })
    await summary.getByRole('button', { name: 'Edit Mock task one' }).first().click()
    const edit = page.getByRole('dialog', { name: 'Edit Task' })
    await expect(edit.getByRole('status', { name: 'Loading task' })).toBeVisible()
    expect(Math.abs(((await edit.boundingBox())?.height ?? 0) - expectedHeight)).toBeLessThanOrEqual(1)
    await expect(edit.getByLabel('Task Name')).toBeVisible()
    expect(Math.abs(((await edit.boundingBox())?.height ?? 0) - expectedHeight)).toBeLessThanOrEqual(1)
    await edit.getByRole('button', { name: 'Back to daily summary' }).click()
    await summary.getByRole('tab', { name: /^Expired Food/ }).click()
    const expiredRow = summary.locator('[data-expiry-tone="expired"]').first()
    await expiredRow.getByRole('button', { name: 'Edit Milk' }).click()
    const inventory = page.getByRole('dialog', { name: 'Milk' })
    await expect(inventory).toBeVisible()
    expect(Math.abs(((await inventory.boundingBox())?.height ?? 0) - expectedHeight)).toBeLessThanOrEqual(1)
  }
})

test('Settings and its subpages share the two-column reading layout', async ({ page }) => {
  test.setTimeout(120_000)
  const settingsPaths = ['settings', 'admin', 'special-device-modes', 'guests-staying-over', 'vacation', 'to-do', 'mach-e']

  for (const viewport of [PHONE, TABLET_PORTRAIT, DESKTOP]) {
    await page.setViewportSize(viewport)
    await page.goto(`/at-a-glance/settings?feedback-settings=${viewport.width}`)
    await waitForAppReady(page)
    const settingsRoot = activeRoute(page, 'settings')
    const settingsLinks = settingsRoot.getByRole('navigation', { name: 'Settings pages' }).getByRole('button')
    await expect(settingsLinks).toHaveCount(7)
    const xPositions = await settingsLinks.evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().x))).size)
    expect(xPositions).toBe(viewport.width === 393 ? 1 : 2)

    for (const path of settingsPaths) {
      await page.goto(`/at-a-glance/${path}?feedback-settings=${viewport.width}`)
      await waitForAppReady(page)
      const root = activeRoute(page, path)
      const main = root.getByRole('main')
      await expect(main).toBeVisible()
      await expect(main).toHaveAttribute('data-page-measure', 'reading')
      const contentWidth = Math.round((await root.locator('[data-page-content="true"]').boundingBox())?.width ?? 0)
      expect(contentWidth).toBeLessThanOrEqual(Math.min(960, viewport.width))
    }
  }

  await page.setViewportSize(DESKTOP)
  for (const path of ['admin', 'special-device-modes']) {
    await page.goto(`/at-a-glance/${path}?feedback-settings-section=true`)
    const sections = activeRoute(page, path).locator('[data-settings-section="true"]')
    await expect.poll(() => sections.count(), { timeout: 15_000 }).toBeGreaterThan(0)
    const sectionMetrics = await sections.evaluateAll((sections) => sections
      .map((section) => {
        const description = section.querySelector('p')
        const controls = section.querySelector<HTMLElement>('[data-settings-section-controls="true"]')
        const descriptionBox = description?.getBoundingClientRect()
        const controlsBox = controls?.getBoundingClientRect()
        return {
          controls: controlsBox ? { width: controlsBox.width, x: controlsBox.x } : null,
          description: descriptionBox ? { width: descriptionBox.width, x: descriptionBox.x } : null,
        }
      }))
    expect(sectionMetrics.length, `${path} settings sections`).toBeGreaterThan(0)
    for (const metric of sectionMetrics) {
      expect(metric.description).not.toBeNull()
      expect(metric.controls).not.toBeNull()
      expect(metric.controls?.x ?? 0).toBeGreaterThan((metric.description?.x ?? 0) + (metric.description?.width ?? 0))
      expect(Math.round(metric.controls?.width ?? 0)).toBeLessThanOrEqual(460)
    }
  }
})
