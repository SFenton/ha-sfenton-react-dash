import { expect, test, type CDPSession, type Page } from '@playwright/test'
import {
  assertTerminalModalLifecycle,
  installModalLifecycleProbe,
  readModalLifecycleProbe,
  startModalLifecycleProbe,
  type ModalLifecycleTrace,
} from './modal-sheet-lifecycle'

const THERMOSTAT_PATH = '/at-a-glance/ecobee#thermostat-automation'
const THERMOSTAT_TITLE = 'Thermostat · Advanced Controls'

async function openThermostatAdvancedControls(page: Page) {
  await page.goto(THERMOSTAT_PATH)
  const dialog = page.getByRole('dialog', { name: THERMOSTAT_TITLE })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const metrics = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }))
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(metrics.scrollTop).toBe(0)
  return { body, dialog }
}

async function accelerateModalExit(page: Page) {
  await page.addStyleTag({
    content: `
      [data-surface="hass-popup"][data-ending-style],
      [data-modal-sheet-overlay][data-ending-style] {
        transition-duration: 40ms !important;
      }
    `,
  })
}

async function fastTouchFlick(page: Page, start: { x: number; y: number }) {
  const client: CDPSession = await page.context().newCDPSession(page)
  const send = (type: 'touchEnd' | 'touchMove' | 'touchStart', y?: number) => client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: typeof y === 'number' ? [{ id: 1, radiusX: 4, radiusY: 4, x: start.x, y }] : [],
  })

  try {
    await send('touchStart', start.y)
    for (const offset of [60, 120, 180]) {
      await send('touchMove', start.y + offset)
      await page.waitForTimeout(4)
    }
    await send('touchEnd')
  } finally {
    await client.detach()
  }
}

async function syntheticWebKitTouchFlick(page: Page) {
  await page.locator('[data-modal-sheet-body="true"]').evaluate(async (element) => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + 8
    const startY = rect.top + rect.height * 0.25
    const createTouch = (clientY: number) => ({
      clientX: x,
      clientY,
      force: 1,
      identifier: 1,
      pageX: x,
      pageY: clientY,
      radiusX: 4,
      radiusY: 4,
      rotationAngle: 0,
      screenX: x,
      screenY: clientY,
      target: element,
    })
    const dispatch = (type: 'touchend' | 'touchmove' | 'touchstart', clientY: number) => {
      const touch = createTouch(clientY)
      const activeTouches = type === 'touchend' ? [] : [touch]
      const event = new Event(type, {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperties(event, {
        changedTouches: { value: [touch] },
        targetTouches: { value: activeTouches },
        touches: { value: activeTouches },
      })
      element.dispatchEvent(event)
    }

    dispatch('touchstart', startY)
    for (const offset of [100, 200, 300, 450, 600]) {
      dispatch('touchmove', startY + offset)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    dispatch('touchend', startY + 600)
  })
}

function observedAddedAttribute(trace: ModalLifecycleTrace, attribute: string) {
  return trace.mutations.some((mutation) => mutation.attribute === attribute && mutation.value !== null)
}

function observedRemovedAttribute(trace: ModalLifecycleTrace, attribute: string) {
  return trace.mutations.some((mutation) => mutation.attribute === attribute && mutation.value === null)
}

test.describe('thermostat modal close lifecycle', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  test.beforeEach(async ({ page }) => {
    await installModalLifecycleProbe(page)
  })

  test('keeps the accelerated closed pose terminal through the mounted exit window', async ({ page }) => {
    const { dialog } = await openThermostatAdvancedControls(page)
    await accelerateModalExit(page)
    await startModalLifecycleProbe(page)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(650)

    const trace = await readModalLifecycleProbe(page)
    expect(trace.historyReplaceCount).toBe(1)
    expect(trace.frames.some((frame) => frame.animations.length > 0)).toBe(true)
    expect(observedAddedAttribute(trace, 'data-ending-style')).toBe(true)
    expect(observedRemovedAttribute(trace, 'data-ending-style')).toBe(true)
    expect(trace.frames.some((frame) => frame.popupPresent && frame.closed && !frame.ending)).toBe(true)
    assertTerminalModalLifecycle(trace)
    await expect(dialog).toHaveCount(0)
  })

  test('keeps a fast top-edge swipe terminal after Base UI finishes its velocity-scaled exit', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'Trusted multi-point touch injection is Chromium-only in Playwright')
    const { body, dialog } = await openThermostatAdvancedControls(page)
    const bodyBox = await body.boundingBox()
    if (!bodyBox) throw new Error('Thermostat modal body was not measurable')
    await accelerateModalExit(page)
    await startModalLifecycleProbe(page)

    await fastTouchFlick(page, { x: bodyBox.x + 8, y: bodyBox.y + bodyBox.height * 0.25 })
    await page.waitForTimeout(650)

    const trace = await readModalLifecycleProbe(page)
    expect(trace.historyReplaceCount).toBe(1)
    expect(trace.events.some((event) => event.type === 'touchend')).toBe(true)
    expect(trace.frames.some((frame) => frame.animations.length > 0)).toBe(true)
    expect(trace.frames.some((frame) => frame.swipeDismiss) || observedAddedAttribute(trace, 'data-swipe-dismiss')).toBe(true)
    expect(trace.frames.some((frame) => frame.popupPresent && frame.closed && !frame.ending)).toBe(true)
    assertTerminalModalLifecycle(trace)
    await expect(dialog).toHaveCount(0)
  })

  test('keeps a synthetic WebKit top-edge swipe terminal through the mounted exit window', async ({ browserName, page }) => {
    test.skip(browserName !== 'webkit', 'Constructed TouchEvent coverage targets the WebKit project')
    const { dialog } = await openThermostatAdvancedControls(page)
    await accelerateModalExit(page)
    await startModalLifecycleProbe(page)

    await syntheticWebKitTouchFlick(page)
    await page.waitForTimeout(650)

    const trace = await readModalLifecycleProbe(page)
    expect(trace.events.some((event) => event.type === 'touchstart')).toBe(true)
    expect(trace.events.some((event) => event.type === 'touchmove')).toBe(true)
    expect(trace.events.some((event) => event.type === 'touchend')).toBe(true)
    expect(trace.frames.some((frame) => frame.swiping) || observedAddedAttribute(trace, 'data-swiping')).toBe(true)
    assertTerminalModalLifecycle(trace)
    await expect(dialog).toHaveCount(0)
  })
})
