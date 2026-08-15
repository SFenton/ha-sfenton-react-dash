import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'

type Point = {
  x: number
  y: number
}

interface TouchSession {
  client: CDPSession
  page: Page
  point: Point
}

interface GestureSample {
  scrollTop: number
  translateY: number
}

const MOBILE_VIEWPORT = { width: 393, height: 852 }
const SHEET_OPEN_ANIMATION_MS = 500

async function openRoomsModal(page: Page) {
  await page.goto('/at-a-glance/overview')
  const opener = page.getByRole('button', { name: 'Rooms' })
  const openerBox = await opener.boundingBox()
  if (!openerBox) throw new Error('Rooms opener was not measurable')
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Rooms' })
  await expect(dialog).toBeVisible()
  return {
    dialog,
    openerPoint: {
      x: openerBox.x + openerBox.width / 2,
      y: openerBox.y + openerBox.height / 2,
    },
  }
}

async function openSleepypodScopePrompt(page: Page) {
  await page.goto('/at-a-glance/master-bedroom')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('climate.sleepypod_eight_pod_left_side', 'heat')
    mock.setEntityState('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2')
    mock.setEntityState('sensor.sleepypod_stephen_schedule_phase', 'bedtime')
  })
  await page.getByRole('button', { name: /Stephen's Bed Cooling/i }).click()
  const bedDialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  const targetSlider = bedDialog.getByRole('slider', { name: "Stephen's Bed target level" })
  await targetSlider.press('ArrowLeft')
  const dialog = page.getByRole('dialog', { name: 'Set Bed Temperature' })
  await expect(dialog).toBeVisible()
  return { dialog, targetSlider }
}

async function waitForSheetDragReady(page: Page) {
  await page.waitForTimeout(SHEET_OPEN_ANIMATION_MS + 150)
}

async function locatorPoint(locator: Locator, xRatio = 0.5, yRatio = 0.5): Promise<Point> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Gesture target was not measurable')
  return {
    x: box.x + box.width * xRatio,
    y: box.y + box.height * yRatio,
  }
}

async function modalBodyPaddingPoint(dialog: Locator, yRatio = 0.25): Promise<Point> {
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const box = await body.boundingBox()
  if (!box) throw new Error('Modal body was not measurable')
  return {
    x: box.x + 6,
    y: box.y + Math.max(12, Math.min(box.height - 12, box.height * yRatio)),
  }
}

async function installNestedScroller(dialog: Locator, axis: 'horizontal' | 'vertical') {
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  await body.evaluate((element, nestedAxis) => {
    element.replaceChildren()
    element.style.overflow = 'hidden'
    const scroller = document.createElement('div')
    scroller.dataset.nestedModalScroller = nestedAxis
    scroller.style.width = '100%'
    scroller.style.height = nestedAxis === 'vertical' ? '240px' : '120px'
    scroller.style.overflowX = nestedAxis === 'horizontal' ? 'auto' : 'hidden'
    scroller.style.overflowY = nestedAxis === 'vertical' ? 'auto' : 'hidden'
    scroller.style.overscrollBehavior = 'contain'
    const content = document.createElement('div')
    content.style.width = nestedAxis === 'horizontal' ? '1000px' : '100%'
    content.style.height = nestedAxis === 'vertical' ? '1000px' : '100%'
    scroller.append(content)
    element.append(scroller)
  }, axis)
  return body.locator(`[data-nested-modal-scroller="${axis}"]`)
}

async function beginTouch(page: Page, point: Point): Promise<TouchSession> {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x: point.x, y: point.y }],
  })
  return { client, page, point }
}

async function moveTouch(session: TouchSession, target: Point, steps = 10, stepDelayMs = 20, onStep?: () => Promise<void>) {
  const start = session.point
  for (let step = 1; step <= steps; step += 1) {
    const point = {
      x: start.x + ((target.x - start.x) * step) / steps,
      y: start.y + ((target.y - start.y) * step) / steps,
    }
    await session.client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x: point.x, y: point.y }],
    })
    if (stepDelayMs > 0) await session.page.waitForTimeout(stepDelayMs)
    await onStep?.()
  }
  session.point = target
}

async function finishTouch(session: TouchSession, type: 'touchCancel' | 'touchEnd' = 'touchEnd') {
  await session.client.send('Input.dispatchTouchEvent', { type, touchPoints: [] })
  await session.client.detach()
}

async function dragTouch(page: Page, start: Point, end: Point, steps = 10, stepDelayMs = 20) {
  const session = await beginTouch(page, start)
  try {
    await moveTouch(session, end, steps, stepDelayMs)
    await finishTouch(session)
  } catch (error) {
    await session.client.detach().catch(() => undefined)
    throw error
  }
}

async function translateY(locator: Locator) {
  return locator.evaluate((element) => {
    const transform = window.getComputedStyle(element).transform
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
  })
}

async function gestureSample(dialog: Locator, scroller: Locator): Promise<GestureSample> {
  return {
    scrollTop: await scroller.evaluate((element) => element.scrollTop),
    translateY: await translateY(dialog),
  }
}

function expectMonotonicSheetDrag(samples: GestureSample[]) {
  for (let index = 1; index < samples.length; index += 1) {
    expect(samples[index].translateY).toBeGreaterThanOrEqual(samples[index - 1].translateY - 1)
  }
}

function expectSheetStayedStill(samples: GestureSample[]) {
  for (const sample of samples) expect(Math.abs(sample.translateY)).toBeLessThanOrEqual(1)
}

async function cancelVisibleDrag(page: Page, dialog: Locator, start: Point) {
  const dialogBox = await dialog.boundingBox()
  if (!dialogBox) throw new Error('Modal was not measurable before touch cancellation')
  const session = await beginTouch(page, start)
  await moveTouch(session, { x: start.x, y: start.y + dialogBox.height * 0.3 }, 12, 28)
  expect(await translateY(dialog)).toBeGreaterThan(40)
  await finishTouch(session, 'touchCancel')
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)
  return dialogBox
}

test.describe('mobile ModalSheet gestures', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('trusted touch from the grab bar closes with the mounted exit lifecycle and reopens cleanly', async ({ page }) => {
    const { dialog, openerPoint } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    const handle = dialog.locator('[data-mobile-drag-handle="true"]')
    const start = await locatorPoint(handle)
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rooms modal was not measurable')
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect(dialog).toHaveAttribute('data-closing', 'true')
    await expect(dialog).toHaveAttribute('inert')
    await expect(page.locator('[data-modal-sheet-overlay="true"]')).toHaveAttribute('data-ending-style', '')
    expect(await dialog.count()).toBe(1)
    await page.waitForTimeout(600)
    expect(await dialog.count()).toBe(0)

    await page.mouse.click(openerPoint.x, openerPoint.y)
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toBeVisible()
    await expect.poll(() => dialog.locator('[data-modal-sheet-body="true"]').evaluate((element) => element.scrollTop)).toBe(0)
    await waitForSheetDragReady(page)
    expect(Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)
  })

  test('trusted touch can dismiss from non-scrollable modal content without firing its command', async ({ page }) => {
    const { dialog } = await openSleepypodScopePrompt(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const overflow = await body.evaluate((element) => element.scrollHeight - element.clientHeight)
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(body).toHaveCSS('touch-action', 'auto')

    await waitForSheetDragReady(page)
    const start = await locatorPoint(dialog.getByRole('button', { name: 'Tonight' }))
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('SleepyPod scope modal was not measurable')
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 14, 24)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect.poll(async () => page.evaluate(() => (
      (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
        .filter((call) => call.domain === 'script')
    ))).toEqual([])
  })

  test('trusted touch can dismiss from scrollable content already at the top', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const metrics = await body.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }))
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    expect(metrics.scrollTop).toBe(0)
    await expect(body).toHaveCSS('touch-action', 'auto')

    await waitForSheetDragReady(page)
    const start = await modalBodyPaddingPoint(dialog)
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rooms modal was not measurable')
    const session = await beginTouch(page, start)
    const samples: GestureSample[] = []
    await moveTouch(session, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, body))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
    expect(samples.every((sample) => Math.abs(sample.scrollTop) <= 1)).toBe(true)
    expectMonotonicSheetDrag(samples)
  })

  test('near-top positive scroll first reaches exact top, then a new downward gesture dismisses', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const nearTop = await body.evaluate((element) => {
      element.scrollTop = 1
      return element.scrollTop
    })
    expect(nearTop).toBe(1)
    await waitForSheetDragReady(page)
    let start = await modalBodyPaddingPoint(dialog, 0.45)

    await dragTouch(page, start, { x: start.x, y: start.y + 80 }, 10, 24)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0)
    await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)

    start = await modalBodyPaddingPoint(dialog)
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Near-top Rooms modal was not measurable')
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  test('trusted upward touch from scrollable content at the top performs native scrolling', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    await waitForSheetDragReady(page)
    const start = await modalBodyPaddingPoint(dialog, 0.55)
    const session = await beginTouch(page, start)
    const samples: GestureSample[] = []
    await moveTouch(session, { x: start.x, y: start.y - 180 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, body))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(40)
    expectSheetStayedStill(samples)
  })

  test('trusted touch preserves native scrolling when content starts below the top', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const before = await body.evaluate((element) => {
      element.scrollTop = Math.min(240, element.scrollHeight - element.clientHeight)
      return element.scrollTop
    })
    expect(before).toBeGreaterThan(0)

    await waitForSheetDragReady(page)
    const start = await modalBodyPaddingPoint(dialog, 0.45)
    const session = await beginTouch(page, start)
    const samples: GestureSample[] = []
    await moveTouch(session, { x: start.x, y: start.y + 140 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, body))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeLessThan(before)
    expectSheetStayedStill(samples)
  })

  test('sub-slop movement stays still before a downward top-edge drag takes ownership', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    await waitForSheetDragReady(page)
    const start = await modalBodyPaddingPoint(dialog)
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rooms modal was not measurable')
    const session = await beginTouch(page, start)

    await moveTouch(session, { x: start.x + 1, y: start.y + 3 }, 1, 0)
    expect(Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)

    const samples: GestureSample[] = []
    await moveTouch(session, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, body))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
    expectMonotonicSheetDrag(samples)
  })

  test('nested scrollable content scrolls natively without moving the sheet', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const nested = await installNestedScroller(dialog, 'vertical')
    const before = await nested.evaluate((element) => {
      element.scrollTop = 180
      return element.scrollTop
    })
    expect(before).toBe(180)
    await waitForSheetDragReady(page)
    const start = await locatorPoint(nested, 0.5, 0.5)
    const session = await beginTouch(page, start)
    const samples: GestureSample[] = []

    await moveTouch(session, { x: start.x, y: start.y + 120 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, nested))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(() => nested.evaluate((element) => element.scrollTop)).toBeLessThan(before)
    expectSheetStayedStill(samples)
  })

  test('nested scrollable content at its top can dismiss the sheet smoothly', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const nested = await installNestedScroller(dialog, 'vertical')
    await waitForSheetDragReady(page)
    const start = await locatorPoint(nested, 0.5, 0.35)
    const dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rooms modal was not measurable')
    const session = await beginTouch(page, start)
    const samples: GestureSample[] = []

    await moveTouch(session, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24, async () => {
      samples.push(await gestureSample(dialog, nested))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
    expect(samples.every((sample) => Math.abs(sample.scrollTop) <= 1)).toBe(true)
    expectMonotonicSheetDrag(samples)
  })

  test('nested horizontal scrolling wins over vertical sheet dismissal', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    const nested = await installNestedScroller(dialog, 'horizontal')
    await waitForSheetDragReady(page)
    const start = await locatorPoint(nested, 0.75, 0.5)
    const session = await beginTouch(page, start)
    const sheetOffsets: number[] = []

    await moveTouch(session, { x: start.x - 180, y: start.y + 2 }, 12, 24, async () => {
      sheetOffsets.push(await translateY(dialog))
    })
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(() => nested.evaluate((element) => element.scrollLeft)).toBeGreaterThan(40)
    expect(sheetOffsets.every((offset) => Math.abs(offset) <= 1)).toBe(true)
  })

  test('a short fast downward flick dismisses without crossing the distance threshold', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    const start = await locatorPoint(dialog.locator('[data-mobile-drag-handle="true"]'))
    const session = await beginTouch(page, start)

    await moveTouch(session, { x: start.x, y: start.y + 120 }, 2, 0)
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  test('upward, horizontal, and slow sub-threshold handle gestures do not dismiss', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    const handle = dialog.locator('[data-mobile-drag-handle="true"]')

    let start = await locatorPoint(handle)
    await dragTouch(page, start, { x: start.x, y: start.y - 120 }, 10, 24)
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)

    await page.waitForTimeout(120)
    start = await locatorPoint(handle)
    await dragTouch(page, start, { x: start.x + 150, y: start.y + 6 }, 12, 24)
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)

    await page.waitForTimeout(120)
    start = await locatorPoint(handle)
    const session = await beginTouch(page, start)
    await moveTouch(session, { x: start.x, y: start.y + 82 }, 12, 60)
    expect(await translateY(dialog)).toBeGreaterThan(35)
    await finishTouch(session)

    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)
  })

  test('swipe close and rapid reopen starts at zero translation and remains swipeable', async ({ page }) => {
    const { dialog, openerPoint } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    let handle = dialog.locator('[data-mobile-drag-handle="true"]')
    let start = await locatorPoint(handle)
    let dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rooms modal was not measurable before swipe close')
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)
    await expect(dialog).toHaveAttribute('data-state', 'closed')

    await page.waitForTimeout(50)
    await page.mouse.click(openerPoint.x, openerPoint.y)
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect.poll(async () => Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)

    await waitForSheetDragReady(page)
    handle = dialog.locator('[data-mobile-drag-handle="true"]')
    start = await locatorPoint(handle)
    dialogBox = await dialog.boundingBox()
    if (!dialogBox) throw new Error('Rapidly reopened modal was not measurable')
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)

    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  test('touch cancellation resets a partial handle drag and allows the next swipe', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    const handle = dialog.locator('[data-mobile-drag-handle="true"]')
    const start = await locatorPoint(handle)
    const dialogBox = await cancelVisibleDrag(page, dialog, start)

    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  test('touch cancellation resets a partial non-scrollable content drag and allows the next swipe', async ({ page }) => {
    const { dialog } = await openSleepypodScopePrompt(page)
    await waitForSheetDragReady(page)
    let start = await locatorPoint(dialog.getByRole('button', { name: 'Tonight' }))
    const dialogBox = await cancelVisibleDrag(page, dialog, start)
    expect(await page.evaluate(() => (
      (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
        .filter((call) => call.domain === 'script').length
    ))).toBe(0)

    start = await locatorPoint(dialog.getByRole('button', { name: 'Tonight' }))
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 14, 24)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    expect(await page.evaluate(() => (
      (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
        .filter((call) => call.domain === 'script').length
    ))).toBe(0)
  })

  test('touch cancellation resets a partial scrollable-top content drag and allows the next swipe', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    await waitForSheetDragReady(page)
    let start = await modalBodyPaddingPoint(dialog)
    const dialogBox = await cancelVisibleDrag(page, dialog, start)

    start = await modalBodyPaddingPoint(dialog)
    await dragTouch(page, start, { x: start.x, y: start.y + dialogBox.height * 0.6 }, 12, 24)
    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  test('vacuum map editor owns its pointer drag without moving or dismissing the sheet', async ({ page }) => {
    await page.goto('/at-a-glance/vacuums')
    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
    await dialog.getByRole('button', { name: 'Draw Area' }).click()
    await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeVisible()
    const overlay = dialog.locator('[data-map-editor-overlay="true"]')
    await expect(overlay).toBeVisible()
    const start = await locatorPoint(overlay, 0.34, 0.32)
    const end = await locatorPoint(overlay, 0.68, 0.62)

    await dragTouch(page, start, end, 12, 24)

    await expect(dialog.locator('[data-map-rect="true"]')).toBeVisible()
    await expect(dialog).toHaveAttribute('data-state', 'open')
    expect(Math.abs(await translateY(dialog))).toBeLessThanOrEqual(1)
  })

  test('X, backdrop, and hash-backed close paths remain functional', async ({ page }) => {
    let { dialog } = await openRoomsModal(page)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveAttribute('data-state', 'closed')
    await expect(dialog).toHaveCount(0, { timeout: 1_000 })

    await page.getByRole('button', { name: 'Rooms' }).click()
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await page.mouse.click(8, 8)
    await expect(dialog).toHaveCount(0, { timeout: 1_000 })

    await page.goto('/at-a-glance/overview#lights-overview')
    dialog = page.getByRole('dialog', { name: /Lights/ })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => new URL(page.url()).hash).toBe('')
    await expect(dialog).toHaveAttribute('data-state', 'closed')
  })
})

test.describe('desktop ModalSheet gestures', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } })

  test('desktop has no handle and body drag preserves centered, open geometry', async ({ page }) => {
    const { dialog } = await openRoomsModal(page)
    await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
    const before = await dialog.boundingBox()
    if (!before) throw new Error('Desktop Rooms modal was not measurable')
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const start = await locatorPoint(body, 0.5, 0.25)

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x, start.y + 180, { steps: 10 })
    await page.mouse.up()

    await expect(dialog).toHaveAttribute('data-state', 'open')
    const after = await dialog.boundingBox()
    if (!after) throw new Error('Desktop Rooms modal was not measurable after drag')
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.x + after.width / 2 - 640)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.y + after.height / 2 - 450)).toBeLessThanOrEqual(1)
  })
})
