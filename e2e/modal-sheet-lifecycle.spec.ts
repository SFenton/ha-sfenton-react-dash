import { expect, test, type CDPSession, type Page } from '@playwright/test'
import {
  assertAnimatedDesktopModalOpen,
  assertAnimatedModalOpen,
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

function observedAddedAttribute(trace: ModalLifecycleTrace, attribute: string) {
  return trace.mutations.some((mutation) => mutation.attribute === attribute && mutation.value !== null)
}

function observedRemovedAttribute(trace: ModalLifecycleTrace, attribute: string) {
  return trace.mutations.some((mutation) => mutation.attribute === attribute && mutation.value === null)
}

async function waitForModalOpenSettled(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const popup = document.querySelector<HTMLElement>('[data-surface="hass-popup"]')
    const overlay = document.querySelector<HTMLElement>('[data-modal-sheet-overlay]')
    if (!popup || !overlay || popup.hasAttribute('data-starting-style')) return false

    const popupStyle = getComputedStyle(popup)
    const translateY = popupStyle.transform === 'none'
      ? 0
      : new DOMMatrixReadOnly(popupStyle.transform).m42

    return (
      Math.abs(translateY) <= 1
      && Number(popupStyle.opacity) >= 0.99
      && Number(getComputedStyle(overlay).opacity) >= 0.99
    )
  }), { timeout: 5_000 }).toBe(true)
}

test.describe('thermostat modal close lifecycle', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  test.beforeEach(async ({ page }) => {
    await installModalLifecycleProbe(page)
  })

  test('animates its first open from offscreen to the settled modal position', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')
    await startModalLifecycleProbe(page)

    await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
    const dialog = page.getByRole('dialog', { name: THERMOSTAT_TITLE })
    await expect(dialog).toBeVisible()
    await waitForModalOpenSettled(page)

    const trace = await readModalLifecycleProbe(page)
    expect(trace.historyPushCount).toBe(1)
    assertAnimatedModalOpen(trace)
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

  test('keeps a synthetic WebKit top-edge swipe terminal through the mounted exit window', async ({ browserName }) => {
    test.skip(browserName !== 'webkit', 'Constructed TouchEvent coverage targets the WebKit project')
    test.skip(
      true,
      'Playwright WebKit exposes no trusted touch-drag injection; constructed TouchEvents are untrusted and cannot drive Base UI dismissal. Chromium CDP covers trusted swipe dismissal.',
    )
  })
})

test.describe('direct hash-open thermostat modal lifecycle', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  test('animates when the modal is already requested during initial page load', async ({ page }) => {
    await installModalLifecycleProbe(page, { autoStart: true })
    await page.goto(THERMOSTAT_PATH)
    await expect(page.getByRole('dialog', { name: THERMOSTAT_TITLE })).toBeVisible()
    await waitForModalOpenSettled(page)

    const trace = await readModalLifecycleProbe(page)
    expect(trace.historyPushCount).toBe(0)
    expect(trace.historyReplaceCount).toBe(0)
    assertAnimatedModalOpen(trace)
  })
})

test.describe('desktop thermostat modal open lifecycle', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { height: 900, width: 1280 } })

  test('fades its first open without moving the centered dialog', async ({ page }) => {
    await installModalLifecycleProbe(page)
    await page.goto('/at-a-glance/ecobee')
    await startModalLifecycleProbe(page)

    await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
    const dialog = page.getByRole('dialog', { name: THERMOSTAT_TITLE })
    await expect(dialog).toBeVisible()
    await waitForModalOpenSettled(page)

    assertAnimatedDesktopModalOpen(await readModalLifecycleProbe(page))
    await expect.poll(() => dialog.evaluate((element) => {
      const overlay = document.querySelector<HTMLElement>('[data-modal-sheet-overlay]')
      return Boolean(
        overlay
        && Number.parseFloat(getComputedStyle(overlay).opacity) >= 0.99
        && Number.parseFloat(getComputedStyle(element).opacity) >= 0.99
      )
    })).toBe(true)
    const firstBox = await dialog.boundingBox()
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const settledBox = await dialog.boundingBox()
    expect(firstBox).not.toBeNull()
    expect(settledBox).not.toBeNull()
    expect(Math.abs((settledBox?.x ?? 0) - (firstBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((settledBox?.y ?? 0) - (firstBox?.y ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((settledBox?.width ?? 0) - (firstBox?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((settledBox?.height ?? 0) - (firstBox?.height ?? 0))).toBeLessThanOrEqual(1)
  })
})
