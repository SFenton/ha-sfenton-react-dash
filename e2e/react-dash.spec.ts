import { expect, test, type Locator, type Page } from '@playwright/test'

type FreeSleepAlarmSnapshot = {
  enabled: boolean
  time: string
}

type FreeSleepSchedulesSnapshot = Partial<Record<'left' | 'right', Partial<Record<string, { alarms?: FreeSleepAlarmSnapshot[] }>>>>

declare global {
  interface Window {
    __vacationPickerCalls?: number
    __setDashboardFakeKeyboardHeight?: (height: number, notify?: boolean) => void
    __setInventoryFakeKeyboardHeight?: (height: number) => void
  }
}

async function openBedAlarmDialog(page: Page, bedButtonName: RegExp) {
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: bedButtonName }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Alarms', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Alarms' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Alarm Schedule Disabled' }).click()
  await expect(dialog.getByRole('button', { name: 'Alarm Schedule Enabled' })).toBeVisible()
  return dialog
}

async function openAddAlarmForm(dialog: Locator, sideTitle: string) {
  const addAlarmButton = dialog.getByRole('button', { exact: true, name: 'Add Alarm' })
  await expect(addAlarmButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(addAlarmButton).toHaveCSS('border-top-style', 'none')
  await addAlarmButton.click()
  const addAlarm = dialog.getByRole('group', { name: `Add ${sideTitle} alarm` })
  await expect(addAlarm).toBeVisible()
  await expect(addAlarm.getByRole('button', { name: 'New alarm time 7:00 AM' }).locator('svg')).toHaveCount(1)
  return addAlarm
}

async function selectAlarmDays(addAlarm: Locator, days: string[]) {
  await addAlarm.getByRole('button', { name: /Alarm days Choose days/i }).click()
  for (const day of days) {
    const option = addAlarm.getByRole('option', { name: day })
    await option.click()
    await expect(option).toHaveAttribute('aria-selected', 'true')
    await expect(option).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(option.locator('svg')).toHaveCount(0)
  }
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

async function expectFreeSleepAlarms(page: Page, side: 'left' | 'right', day: string, expected: FreeSleepAlarmSnapshot[]) {
  await expect.poll(async () => {
    const schedules = await freeSleepSchedules(page)
    return (schedules[side]?.[day]?.alarms ?? []).map((alarm) => ({ enabled: alarm.enabled, time: alarm.time }))
  }).toEqual(expected)
}

async function expectDesktopSquareGrid(dialog: Locator, sectionLabel: string) {
  const section = dialog.getByRole('region', { name: sectionLabel })
  await expect(section).toBeVisible()
  const openerCards = section.getByRole('button', { name: /^Open / })
  const cards = await openerCards.count() > 0 ? openerCards : section.getByRole('article')
  const cardCount = await cards.count()
  expect(cardCount).toBeGreaterThan(0)

  await expect.poll(async () => {
    return cards.evaluateAll((elements) => {
      const rects = elements.map((element) => element.getBoundingClientRect())
      return {
        allFixedHeight: rects.every((rect) => Math.round(rect.height) === 168),
        allFixedWidth: rects.every((rect) => Math.round(rect.width) === 168),
        cardCount: rects.length,
        squareCards: rects.every((rect) => Math.round(rect.width) === Math.round(rect.height)),
      }
    })
  }).toMatchObject({
    allFixedHeight: true,
    allFixedWidth: true,
    cardCount,
    squareCards: true,
  })

  const dialogBox = await dialog.boundingBox()
  const sectionBox = await section.boundingBox()
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((sectionBox?.width ?? 0) + 52))
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
    window.__setDashboardFakeKeyboardHeight = (height: number, notify = true) => {
      fakeVisualViewport.height = height
      if (!notify) return
      fakeVisualViewport.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('resize'))
    }
  })
}

async function expectDesktopAdminSquareGrid(dialog: Locator, gridLabel: string) {
  const grid = dialog.getByRole('group', { name: gridLabel })
  await expect(grid).toBeVisible()
  const cardCount = await grid.locator('> button, > article').count()
  const expectedColumns = Math.max(1, Math.ceil(Math.sqrt(cardCount)))
  const expectedRows = Math.ceil(cardCount / expectedColumns)

  await expect.poll(async () => {
    return grid.evaluate((gridElement) => {
      const firstCard = gridElement.firstElementChild
      const firstCardRect = firstCard?.getBoundingClientRect()
      const gridStyle = window.getComputedStyle(gridElement)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
      const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
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
    cardHeight: 168,
    cardWidth: 168,
    columns: expectedColumns,
    fitsAllCards: true,
    rows: expectedRows,
    scrollsHorizontally: false,
    squareCard: true,
  })

  const dialogBox = await dialog.boundingBox()
  const gridBox = await grid.boundingBox()
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThan(900)
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))
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

async function expectRightChevron(opener: Locator) {
  const chevron = opener.locator('[data-modal-disclosure="right-chevron"]')
  await expect(chevron).toHaveCount(1)
  await expectVerticallyCenteredChevrons(chevron)
}

async function expectNoChevron(opener: Locator) {
  await expect(opener.locator('[data-modal-disclosure]')).toHaveCount(0)
}

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
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
})

test('room keyboard navigation signals one HA-owned increment without delaying the route', async ({ page }) => {
  await page.goto('/at-a-glance/overview')
  await page.getByRole('button', { name: 'Rooms' }).click()

  const livingRoom = page.getByRole('dialog', { name: 'Rooms' }).getByRole('button', { name: 'Living Room area' })
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
  await expectRightChevron(page.getByRole('button', { name: /^Security System /i }))
  await expectNoChevron(page.getByRole('button', { name: 'Open Front Door camera' }))
  for (const quickLink of ['Vacuums', 'Media', 'Custom Lights']) {
    const opener = page.getByRole('button', { exact: true, name: quickLink })
    await expectRightChevron(opener)
    await expect(opener).toHaveAttribute('data-navigation-opener', 'true')
  }
  await expect(page.getByRole('button', { name: 'Rooms' })).toHaveAttribute('data-modal-opener-exception', 'floating-action')

  await page.goto('/at-a-glance/living-room')
  await expectNoChevron(page.getByRole('button', { name: /^Climate /i }).first())
  await expectRightChevron(page.getByRole('button', { name: /^Vents /i }))

  await page.goto('/at-a-glance/admin')
  await expectRightChevron(page.getByRole('button', { name: 'Open Presence-Based Overrides' }))

  await page.goto('/at-a-glance/ecobee')
  await expectRightChevron(page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))

  await page.goto('/at-a-glance/pantry')
  await expectRightChevron(page.getByRole('button', { name: 'View Canned Beans individual items' }))
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

  const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
  await expect(nav).toHaveCSS('opacity', '1')
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-keyboard'))).toBeNull()

  const initialViewportHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
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
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dashboard-viewport-height').trim())).toBe(`${Math.round(keyboardViewportHeight)}px`)

  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), initialViewportHeight)
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-keyboard'))).toBeNull()
  await expect(nav).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.querySelector('[data-keyboard-test-input]')?.remove())
})

test('kitchen restores full height after closing the keyboard and reopening by touch navigation', async ({ page }) => {
  await installFakeVisualViewport(page)
  await page.goto('/sfenton-react-dash/home?path=kitchen')
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

  const initialViewportHeight = await page.evaluate(() => window.innerHeight)
  const keyboardViewportHeight = Math.max(320, initialViewportHeight - 300)
  const shellMetrics = () => app.locator('html').evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[class*="_shell_"]')
    return {
      cssHeight: getComputedStyle(document.documentElement).getPropertyValue('--dashboard-viewport-height').trim(),
      height: Math.round(shell?.getBoundingClientRect().height ?? 0),
      keyboard: document.documentElement.getAttribute('data-dashboard-keyboard'),
    }
  })

  await app.getByRole('button', { name: 'Scan Item' }).click()
  const dialog = app.getByRole('dialog', { name: /Add Item/i })
  await dialog.getByRole('button', { name: 'Manually Enter Name' }).click()
  const productName = dialog.getByRole('textbox', { name: 'Product name' })
  await productName.click()
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), keyboardViewportHeight)

  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${keyboardViewportHeight}px`,
    height: keyboardViewportHeight,
    keyboard: 'open',
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
  })

  await app.getByRole('button', { name: 'Scan Item' }).click()
  const routeDialog = app.getByRole('dialog', { name: /Add Item/i })
  await routeDialog.getByRole('button', { name: 'Manually Enter Name' }).click()
  const routeProductName = routeDialog.getByRole('textbox', { name: 'Product name' })
  await routeProductName.click()
  await page.evaluate((height) => window.__setDashboardFakeKeyboardHeight?.(height), keyboardViewportHeight)
  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${keyboardViewportHeight}px`,
    height: keyboardViewportHeight,
    keyboard: 'open',
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
  })
  await expect(app.getByRole('heading', { name: 'Home' })).toBeVisible()
  await app.getByRole('button', { name: 'Rooms' }).evaluate((button) => button.click())
  const roomsDialog = app.getByRole('dialog', { name: 'Rooms' })
  await roomsDialog.getByRole('button', { name: /Kitchen/i }).evaluate((button) => button.click())
  await expect(app.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  await expect.poll(shellMetrics).toEqual({
    cssHeight: `${initialViewportHeight}px`,
    height: initialViewportHeight,
    keyboard: null,
  })
})

test('inventory footer search moves above the mobile keyboard and clears results', async ({ page }) => {
  await page.goto('/at-a-glance/fridge')

  const dock = page.locator('[data-floating-action-dock="true"]')
  const inventoryListLabel = 'Fridge inventory list'
  const visibleInventoryList = inventoryList(page, inventoryListLabel)
  await expect(visibleInventoryList).toBeVisible()
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toHaveLength(3)

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

  await dock.getByRole('button', { name: 'Search inventory' }).click()
  const input = page.getByLabel('Search inventory')
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate((element) => Boolean(element.closest('[data-floating-action-dock="true"]')))).toBe(true)
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-inventory-search-expanded'))).toBe('true')
  await expect(dock.getByRole('button', { name: 'Sort' }).locator('xpath=..')).toHaveAttribute('data-collapsed', 'true')
  await expect(dock.getByRole('button', { name: 'Filter' }).locator('xpath=..')).toHaveAttribute('data-collapsed', 'true')
  await expect(dock.getByRole('button', { name: 'Scan Item' })).toHaveCSS('opacity', '0')

  const beforeBox = await dock.boundingBox()
  if (!beforeBox) throw new Error('Inventory floating action dock was not measurable')
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
  await expect(page.getByRole('heading', { name: 'No matching items' })).toBeVisible()
  await expect(page.getByText('Try a different search or clear the search to show all items.')).toBeVisible()
  await page.evaluate(() => window.__setInventoryFakeKeyboardHeight?.(window.innerHeight))
  await expect.poll(async () => Math.round((await dock.boundingBox())?.y ?? 0)).toBe(Math.round(beforeBox.y))

  await input.fill('milk')
  await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible()
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toEqual([
    expect.stringContaining('Milk'),
  ])

  await input.press('Enter')
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-inventory-search-expanded'))).toBeNull()
  await expect(dock.getByRole('button', { name: 'Search inventory' })).toContainText('milk')
  await dock.getByRole('button', { name: 'Search inventory' }).click()
  await page.getByRole('button', { name: 'Clear Search' }).click()
  await expect(input).toHaveValue('')
  await expect.poll(() => inventoryRowLabels(page, inventoryListLabel)).toHaveLength(3)
})

test('thermostat page accepts the first mobile scroll gesture after closing a room modal', async ({ page }) => {
  await page.goto('/at-a-glance/ecobee')

  await page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  const dialog = page.getByRole('dialog', { name: 'Living Room' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')

  await expect.poll(async () => page.evaluate(() => ({
    bodyPointerEvents: document.body.style.pointerEvents,
    scrollLocked: document.body.getAttribute('data-scroll-locked'),
    modalOverlays: document.querySelectorAll('[data-modal-sheet-overlay]').length,
    closingDialogPointerEvents: window.getComputedStyle(document.querySelector('[role="dialog"]') as Element).pointerEvents,
    closingDialogInert: document.querySelector('[role="dialog"]')?.hasAttribute('inert') ?? false,
  }))).toEqual({
    bodyPointerEvents: 'auto',
    scrollLocked: null,
    modalOverlays: 0,
    closingDialogPointerEvents: 'none',
    closingDialogInert: true,
  })

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

test.describe('desktop modal layout', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } })

  test('rooms modal uses fixed 168px square room cards on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()

    await expect.poll(async () => {
      return dialog.locator('section[aria-label="Rooms"]').evaluate((grid) => {
        const firstCard = grid.firstElementChild?.firstElementChild
        const firstCardRect = firstCard?.getBoundingClientRect()
        const gridStyle = window.getComputedStyle(grid)
        const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
        const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
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
      firstCardHeight: 168,
      firstCardWidth: 168,
      columns: 4,
      fitsAllRooms: true,
      rows: 4,
      scrollsHorizontally: false,
    })
    const firstCard = dialog.locator('section[aria-label="Rooms"] > div').first()
    const box = await firstCard.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.round(box?.height ?? 0))
    const dialogBox = await dialog.boundingBox()
    const gridBox = await dialog.locator('section[aria-label="Rooms"]').boundingBox()
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThan(900)
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))

  })

  test('desktop modal has no grabber and cannot be dragged', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
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
    await dialog.getByRole('button', { name: 'Zones' }).click()
    await expect(dialog.getByRole('heading', { name: 'Zones' })).toBeVisible()

    const zonesPane = dialog.getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    const modalNav = dialog.getByRole('navigation', { name: 'Main Floor modal sections' })
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
      const navBox = document.querySelector('nav[aria-label="Main Floor modal sections"]')?.getBoundingClientRect()
      return Boolean(navBox && zoneBox.bottom <= navBox.top - 4)
    })).toBe(true)
    await expect(modalNav).toBeVisible()
  })

  test('media remote modal uses the shared desktop sheet height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('/at-a-glance/living-room')
    await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect.poll(async () => {
      return dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return Math.round((rect.height / window.innerHeight) * 100)
      })
    }).toBe(90)
  })

  test('bed modal keeps its short-desktop footer fixed while the unclipped hero scrolls with content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.goto('/at-a-glance/master-bedroom')
    await page.getByRole('button', { name: /Steph's Bed Off/i }).click()

    const dialog = page.getByRole('dialog', { name: "Steph's Bed" })
    await expect(dialog).toBeVisible()
    await expect.poll(async () => {
      return dialog.evaluate((element) => ({
        boxWidth: Math.round(element.getBoundingClientRect().width),
        boxHeight: Math.round(element.getBoundingClientRect().height),
        heightVar: getComputedStyle(element).getPropertyValue('--modal-desktop-height').trim(),
        maxHeightVar: getComputedStyle(element).getPropertyValue('--modal-desktop-max-height').trim(),
        maxWidthVar: getComputedStyle(element).getPropertyValue('--modal-desktop-max-width').trim(),
        widthVar: getComputedStyle(element).getPropertyValue('--modal-desktop-width').trim(),
      }))
    }).toEqual({
      boxHeight: 350,
      boxWidth: 700,
      heightVar: '70vh',
      maxHeightVar: '70vh',
      maxWidthVar: '700px',
      widthVar: '700px',
    })

    await dialog.getByRole('button', { name: 'Alarms' }).click()
    const body = dialog.locator('[data-layout="eight-sleep-modal-body"]')
    const modalBody = dialog.locator('[data-modal-sheet-body="true"]')
    const hero = dialog.locator('[data-section="eight-sleep-hero"]')
    const panel = dialog.locator('[data-scroll-region="eight-sleep-panel"]')
    const footer = dialog.getByRole('navigation', { name: "Steph's Bed modal sections" }).locator('..')
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

    await dialog.getByRole('button', { name: 'Special Modes' }).click()
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
      panelAlignItems: 'start',
      sectionAlignContent: 'start',
    })
  })

  test('desktop modal preserves its size during the close fade', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
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
    }).toEqual({ cardHeight: 168, cardWidth: 168 })

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
      return roomButtons.evaluateAll((elements) => {
        const rects = elements.map((element) => element.getBoundingClientRect())
        return {
          allFixedHeight: rects.every((rect) => Math.round(rect.height) === 168),
          allFixedWidth: rects.every((rect) => Math.round(rect.width) === 168),
          cardCount: rects.length,
          squareCards: rects.every((rect) => Math.round(rect.width) === Math.round(rect.height)),
        }
      })
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
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(940)
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))

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

  test('security system modal is capped at 500px width with adaptive height on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview#security-system')

    const dialog = page.getByRole('dialog', { name: 'Security System' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Armed Home', { exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Current security system state Armed Home')).toHaveCount(0)

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
    const box = await dialog.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBeLessThanOrEqual(500)
    expect(Math.round(box?.height ?? 0)).toBeLessThan(720)
  })

  test('thermostat room modal uses 600px desktop split layout', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee#living-room')

    const dialog = page.getByRole('dialog', { name: 'Living Room' })
    await expect(dialog).toBeVisible()
    const thermostatHero = dialog.getByLabel('Living Room thermostat control')
    const vents = dialog.getByLabel('Living Room Vents')
    await expect(thermostatHero).toBeVisible()
    await expect(vents).toBeVisible()
    const ventGrid = vents.locator(':scope > div').nth(1)

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(595)
    const dialogBox = await dialog.boundingBox()
    const heroBox = await thermostatHero.boundingBox()
    const ventsBox = await vents.boundingBox()
    if (!dialogBox || !heroBox || !ventsBox) throw new Error('Thermostat modal layout was not measurable')

    expect(Math.round(dialogBox.width)).toBeLessThanOrEqual(600)
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

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
    const dialogBox = await dialog.boundingBox()
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(500)
    await expect.poll(async () => options.evaluate((optionsElement) => {
      const firstOption = optionsElement.firstElementChild?.getBoundingClientRect()
      const style = window.getComputedStyle(optionsElement)
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        optionHeight: Math.round(firstOption?.height ?? 0),
      }
    })).toEqual({ columns: 2, optionHeight: 74 })
  })

  test('eco mode pickers use security-style desktop layout without separators', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')

    const assertCardPicker = async (triggerName: RegExp, dialogName: string) => {
      await page.getByLabel(triggerName).click()
      const dialog = page.getByRole('dialog', { name: dialogName })
      await expect(dialog).toBeVisible()
      const options = dialog.getByRole('group', { name: `${dialogName} options` })
      await expect(options).toHaveAttribute('data-layout', 'card-grid')
      await expect(dialog.locator('span[aria-hidden="true"][class*="separator"]')).toHaveCount(0)

      await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
      const dialogBox = await dialog.boundingBox()
      expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(500)
      await expect.poll(async () => options.evaluate((optionsElement) => {
        const firstOption = optionsElement.firstElementChild?.getBoundingClientRect()
        const style = window.getComputedStyle(optionsElement)
        return {
          columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
          optionHeight: Math.round(firstOption?.height ?? 0),
        }
      })).toEqual({ columns: 1, optionHeight: 120 })
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
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
      adaptiveHeight: true,
      backButtonName: 'Back to room contact sensors',
      buttonName: /Open Living Room Contact Sensors/i,
      detailHeading: 'Living Room Contact Sensors',
      dialogName: 'Contact Sensors',
      hash: '#contact-sensors-overview',
      sectionLabel: 'Contact sensors by room',
    },
    {
      adaptiveHeight: true,
      dialogName: 'Air Quality',
      hash: '#aqi-overview',
      sectionLabel: 'AQI by room',
    },
  ]

  for (const modalCase of squareOverviewCases) {
    test(`${modalCase.dialogName} modal uses fixed 168px square room grid on desktop`, async ({ page }) => {
      await page.goto(`/at-a-glance/overview${modalCase.hash}`)

      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      const grid = await expectDesktopSquareGrid(dialog, modalCase.sectionLabel)
      const overviewDialogBox = await dialog.boundingBox()

      if ('adaptiveHeight' in modalCase) {
        const gridBox = await grid.boundingBox()
        expect(Math.round(overviewDialogBox?.height ?? 0)).toBeLessThan(760)
        expect(Math.round(overviewDialogBox?.height ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.height ?? 0) + 180))
      }

      if ('buttonName' in modalCase) {
        await clickWithPointerJitter(page, grid.getByRole('button', { name: modalCase.buttonName }))
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('heading', { name: modalCase.detailHeading })).toBeVisible()
        await expect(dialog.getByRole('button', { name: modalCase.backButtonName })).toBeVisible()
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
    test(`${modalCase.dialogName} modal uses fixed 168px square admin cards on desktop`, async ({ page }) => {
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
  await expect(pastDueList.getByRole('button', { name: /Mock task one/i })).toHaveAttribute('aria-pressed', 'false')

  await pastDueList.getByRole('button', { name: /Mock task one/i }).click()

  await expect(pastDueList.getByRole('button', { name: /Mock task one/i })).toHaveCount(0)
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
  await expect(noDueDateList.getByRole('button')).toHaveCount(2)
  await expect(noDueDateList.getByRole('button', { name: 'HA supplied vacation task alpha' })).toBeVisible()
  await expect(noDueDateList.getByRole('button', { name: 'HA supplied vacation task beta' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Past Due' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No Due Date' })).toBeVisible()

  await page.getByRole('button', { name: /Stephen's Tasks/i }).click()

  await expect(page.getByRole('heading', { name: "Stephen's Chores" })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No Tasks!' })).toBeVisible()
  await expect(page.getByText('You have no tasks due- nice job!')).toBeVisible()
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
  await expect(dialog).toHaveCSS('transform', 'none')
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

  await expect(page.getByRole('button', { name: 'Rooms' })).toBeVisible()
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
  await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()
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
  await dialog.getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disney+' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /^Apple TV Paused$/i }).click()
  await expect(page.getByRole('heading', { name: 'Apple TV Remote' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/theater-room')
  await page.getByRole('button', { name: /^Theater Room Off$/i }).click()
  await expect(page.getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Prime Video' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Devices' }).click()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Projector Off/i })).toBeVisible()
})

test('Free Sleep Add Alarm writes the expected alarm into the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const addAlarm = await openAddAlarmForm(dialog, "Steph's Bed")

  await selectAlarmDays(addAlarm, ['Sunday'])
  await addAlarm.getByRole('textbox', { name: 'New alarm time' }).fill('08:00', { force: true })
  await addAlarm.getByRole('button', { exact: true, name: 'Add Alarm' }).click()

  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })
  await expect(sundaySection.getByText('3 alarms')).toBeVisible()
  await expect(sundaySection.getByRole('article', { name: /Steph's Bed Sunday alarm 3 enabled/i })).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
    { enabled: true, time: '08:00' },
  ])
})

test('Free Sleep individual alarm toggle only disables that alarm in the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" }).click()

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm 2" })).toHaveAttribute('aria-checked', 'true')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm time edit keeps the alarm enabled in the UI and backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
  await sundaySection.getByRole('textbox', { name: "Steph's Bed Sunday alarm time" }).fill('06:35', { force: true })

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:35' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm delete confirms and removes only that alarm from the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })
  const deleteFirstAlarm = sundaySection.getByRole('button', { exact: true, name: "Delete Steph's Bed Sunday alarm" })

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.type()).toBe('confirm')
    expect(confirmDialog.message()).toBe("Delete Steph's Bed Sunday alarm at 6:30 AM?")
    await confirmDialog.dismiss()
  })
  await deleteFirstAlarm.click()

  await expect(sundaySection.getByText('2 alarms')).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toBe("Delete Steph's Bed Sunday alarm at 6:30 AM?")
    await confirmDialog.accept()
  })
  await deleteFirstAlarm.click()

  await expect(sundaySection.getByText('1 alarm')).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep day toggle disables every alarm for that day in the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await sundaySection.getByRole('switch', { name: "Disable Steph's Bed Sunday alarms" }).click()

  await expect(sundaySection.getByRole('switch', { name: "Enable Steph's Bed Sunday alarms" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm 2" })).toHaveAttribute('aria-checked', 'false')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: false, time: '07:15' },
  ])
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
  await expect(page.getByRole('heading', { name: 'Power Settings' })).toBeVisible()
  await expect(page.getByText('Choose whether the robot vacuums, mops, or combines both for the next run.')).toBeVisible()
  await expect(page.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toHaveCount(0)
  await expect(page.getByText('Choose how many passes the vacuum should make, then start cleaning with the selected zones.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Cleaning Passes 1x/i })).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveAttribute('data-icon', 'mdi:play')
  await expect(page.getByRole('button', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Consumables' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mode options' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zones' }).click()
  await expect(page.getByRole('button', { name: /living room/i })).toBeVisible()
  await page.getByRole('button', { name: 'Auto-Clean' }).click()
  await expect(page.getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })).toBeVisible()
  await expect(page.getByText('Check rooms that should be skipped when the coordinator starts an automatic away clean.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Living Room auto-clean enabled' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Closet auto-clean enabled' })).toBeVisible()
  await page.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
  await page.getByRole('button', { name: 'Info' }).click()
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
  await expect(page.getByRole('button', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zones' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Brush 245h left' })).toBeVisible()
  await expect(page.getByText(/Entity not available/i)).toHaveCount(0)
})

test('vacuums page renders without live HASS backend', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
  await expect(page.getByLabel('Music Room', { exact: true })).toHaveAttribute('data-icon', 'mdi:robot-vacuum-off')
  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  await expect(mainFloorVacuum).toBeVisible()
  await expect(mainFloorVacuum).toHaveAttribute('data-tone', 'vacuum')
  await expect(mainFloorVacuum).toHaveAttribute('data-icon', 'mdi:home')
})

test('available vacuum cards open source-style modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zones' }).click()
  await expect(page.getByText('Zones').first()).toBeVisible()
  await page.getByRole('button', { name: 'Auto-Clean' }).click()
  const officeAutoClean = page.getByRole('button', { name: 'Office auto-clean enabled' })
  await expect(officeAutoClean).toHaveAttribute('aria-pressed', 'false')
  await officeAutoClean.click()
  await expect(page.getByRole('button', { name: 'Office auto-clean disabled' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
  await page.getByRole('button', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Filter 54h left' })).toHaveAttribute('data-icon', 'mdi:air-filter')
  await expect(page.getByRole('group', { name: 'Detergent OK' })).toHaveAttribute('data-icon', 'mdi:bottle-tonic')
  await expect(page.getByRole('group', { name: 'Sensors 2h left' })).toHaveAttribute('data-icon', 'mdi:timer-alert-outline')
  const mapCanvas = page.locator('[data-valetudo-map-canvas="true"]')
  await expect(mapCanvas).toBeVisible()
  expect(await mapCanvas.getAttribute('width')).not.toBe('0')
  expect(await mapCanvas.getAttribute('height')).not.toBe('0')
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

  const rapidReopenState = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const select = document.querySelector<HTMLSelectElement>('select[aria-label^="Cleaning Passes"]')
    const rect = select?.getBoundingClientRect()
    const style = dialog ? getComputedStyle(dialog) : null
    const selectStyle = select ? getComputedStyle(select) : null

    return {
      animationName: style?.animationName,
      pointerEvents: selectStyle?.pointerEvents,
      rapidReopen: dialog?.getAttribute('data-rapid-reopen'),
      selectRect: rect ? { y: rect.y, height: rect.height } : null,
      transform: style?.transform,
      value: select?.value,
    }
  })

  expect(rapidReopenState.rapidReopen).toBe('true')
  expect(rapidReopenState.animationName).toBe('none')
  expect(rapidReopenState.transform).toBe('none')
  expect(rapidReopenState.pointerEvents).toBe('auto')
  expect(rapidReopenState.selectRect?.y).toBeLessThan(720)
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
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('combobox', { name: /Mode/i }).selectOption('mop')

  const closeBox = await page.getByRole('button', { name: 'Close' }).boundingBox()
  if (!closeBox) throw new Error('Vacuum modal close button was not measurable')

  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
  await page.waitForTimeout(50)
  await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)

  const modeOptions = await page.getByRole('combobox', { name: /Mode Mop/i }).evaluate((select) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const style = dialog ? getComputedStyle(dialog) : null
    return {
      animationName: style?.animationName,
      options: Array.from((select as HTMLSelectElement).options).map((option) => ({ label: option.label, value: option.value })),
      rapidReopen: dialog?.getAttribute('data-rapid-reopen'),
      transform: style?.transform,
      value: (select as HTMLSelectElement).value,
    }
  })

  expect(modeOptions.rapidReopen).toBe('true')
  expect(modeOptions.animationName).toBe('none')
  expect(modeOptions.transform).toBe('none')
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
  const footer = dialog.getByRole('navigation', { name: "Steph's Bed modal sections" }).locator('..')
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

test('mobile SleepyPod target prompt routes Tonight and swipes closed without a second command', async ({ page }) => {
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
  const targetSlider = bedDialog.getByRole('slider', { name: "Stephen's Bed target level" })
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-2')
  await targetSlider.press('ArrowLeft')

  const scopeDialog = page.getByRole('dialog', { name: 'Set Bed Temperature' })
  await expect(scopeDialog).toBeVisible()
  await expect(scopeDialog).toHaveAttribute('data-surface', 'hass-popup')
  await expect(scopeDialog).toContainText("Stephen's Bed • Bedtime • -3")
  await expect(scopeDialog.getByRole('button', { name: 'Tonight' })).toBeFocused()
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
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
  await expect(targetSlider).toBeFocused()
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'script')
  ))).toEqual([{
    domain: 'script',
    service: 'sleepypod_stephen_temperature_tonight',
    serviceData: { level: -3 },
  }])

  await targetSlider.press('ArrowLeft')
  await expect(scopeDialog).toBeVisible()
  await expect(scopeDialog).toContainText("Stephen's Bed • Bedtime • -4")
  await page.waitForTimeout(500)
  const handle = scopeDialog.locator('[data-mobile-drag-handle="true"]')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('SleepyPod scope prompt drag handle was not measurable')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 320, { steps: 10 })
  await page.mouse.up()

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
  ))).toHaveLength(1)
  await expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
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
  await page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
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

  await page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
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
  await page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
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
  const highArc = heroDial.locator('[data-target="high-arc"]')
  await expect(highArc).toHaveCount(1)
  await expect(highArc).toHaveCSS('stroke', 'rgb(44, 142, 152)')
  const highArcBefore = await highArc.getAttribute('d')
  const highHandleEnd = pointForTemperature(box!, 78)
  await mouseDrag(highHandleBox!.x + highHandleBox!.width / 2, highHandleBox!.y + highHandleBox!.height / 2, highHandleEnd.x, highHandleEnd.y)
  await expect(heroDial).not.toHaveAttribute('aria-label', beforeLabel!)
  await expect.poll(async () => (await highHandle.boundingBox())?.x ?? 0).toBeGreaterThan(highHandleBox!.x + 20)
  const highHandleBoxAfter = await highHandle.boundingBox()
  expect(highHandleBoxAfter).not.toBeNull()
  await expect(highArc).not.toHaveAttribute('d', highArcBefore!)
  const lowHandle = heroDial.locator('[data-target="low"]')
  await expect(lowHandle).toHaveCount(1)
  const lowHandleBox = await lowHandle.boundingBox()
  expect(lowHandleBox).not.toBeNull()
  const lowArc = heroDial.locator('[data-target="low-arc"]')
  await expect(lowArc).toHaveCount(1)
  await expect(lowArc).toHaveCSS('stroke', 'rgb(205, 84, 1)')
  const lowArcBefore = await lowArc.getAttribute('d')
  const lowHandleEnd = pointForTemperature(box!, 68)
  await mouseDrag(lowHandleBox!.x + lowHandleBox!.width / 2, lowHandleBox!.y + lowHandleBox!.height / 2, lowHandleEnd.x, lowHandleEnd.y)
  await expect(lowArc).not.toHaveAttribute('d', lowArcBefore!)
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

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: "Stephen's Summary" })).toBeVisible()
  await expect(dialog).toHaveAttribute('data-has-subtitle', 'false')

  const nav = dialog.getByRole('navigation', { name: 'Daily report sections' })
  const tabs = nav.getByRole('button')
  await expect(tabs).toHaveCount(3)
  for (const tab of await tabs.all()) await expect(tab).toHaveText('')

  await expect(dialog.getByRole('region', { name: 'Overdue Chores' })).toBeVisible()

  const bodyHeader = dialog.locator('[data-modal-sheet-body-header="true"]')
  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeVisible()

  await nav.getByRole('button', { name: 'Upcoming Chores' }).click()
  await expect(dialog.getByRole('region', { name: 'Upcoming Chores' })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Overdue Chores' })).toHaveCount(0)

  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Upcoming Chores' })).toBeVisible()

  await nav.getByRole('button', { name: 'Expired Food' }).click()
  await expect(bodyHeader.getByRole('heading', { level: 2, name: 'Expired Food' })).toBeVisible()
  await expect(dialog.getByLabel('Expired Food inventory list')).toBeVisible()
  const expiredRow = dialog.locator('[data-expiry-tone="expired"]').first()
  await expect(expiredRow).toBeVisible()
  await expect(expiredRow.getByRole('button', { name: /^Edit / })).toBeVisible()
  await expect(expiredRow.getByRole('button', { name: /^Delete / })).toBeVisible()
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

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary$/ })
  await expect(profileButton).toBeVisible()
  await profileButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: "Stephen's Summary" })).toBeVisible()
  await expect(dialog.getByRole('navigation', { name: 'Daily report sections' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('#daily-report')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
})

test('header profile button stays visible and opaque across route changes', async ({ page }) => {
  await page.goto('/index.html?path=overview')

  const profileButton = page.getByRole('button', { name: /^Open .+'s Summary$/ })
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
