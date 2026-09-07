import { expect, test, type Browser, type Page } from '@playwright/test'

const BASE_URL_PATH = '/at-a-glance/ecobee'
const MODAL_TITLE = 'Thermostat · Advanced Controls'
interface FrameMetrics {
  frames: number
  max: number
  median: number
  over33Ratio: number
  p95: number
}

interface DismissalMetrics {
  idle: FrameMetrics
  drag: FrameMetrics
  release: FrameMetrics
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function summarize(values: number[]): FrameMetrics {
  return {
    frames: values.length,
    max: Math.max(0, ...values),
    median: percentile(values, 0.5),
    over33Ratio: values.filter((value) => value > 33.3).length / Math.max(1, values.length),
    p95: percentile(values, 0.95),
  }
}

async function openThermostatAdvancedControls(page: Page) {
  await page.goto(BASE_URL_PATH)
  await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
  const dialog = page.getByRole('dialog', { name: MODAL_TITLE })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(500)
  return dialog
}

async function measureDismissal(browser: Browser, fullBackdrop: boolean): Promise<DismissalMetrics> {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { height: 852, width: 393 } })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  try {
    await page.goto(`${BASE_URL_PATH}${fullBackdrop ? '?modalBackdrop=full' : ''}`)
    await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
    const dialog = page.getByRole('dialog', { name: MODAL_TITLE })
    await expect(dialog).toBeVisible()
    const overlay = page.locator('[data-modal-sheet-overlay="true"]')
    await expect(overlay).toHaveAttribute('data-backdrop-policy', fullBackdrop ? 'full' : 'auto')
    if (fullBackdrop) await expect(overlay).toHaveCSS('backdrop-filter', 'blur(10px)')
    else await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const bodyBox = await body.boundingBox()
    const dialogBox = await dialog.boundingBox()
    if (!bodyBox || !dialogBox) throw new Error('Thermostat modal geometry was unavailable')

    await page.evaluate(() => {
      const state = { active: true, frames: [] as number[], handle: 0, marks: {} as Record<string, number> }
      const sample = (timestamp: number) => {
        if (!state.active) return
        state.frames.push(timestamp)
        state.handle = requestAnimationFrame(sample)
      }
      ;(window as unknown as { __modalFrameProbe: typeof state }).__modalFrameProbe = state
      state.marks.idleStart = performance.now()
      state.handle = requestAnimationFrame(sample)
    })
    await page.waitForTimeout(1_200)
    await page.evaluate(() => {
      ;(window as unknown as { __modalFrameProbe: { marks: Record<string, number> } }).__modalFrameProbe.marks.dragStart = performance.now()
    })

    const start = { x: bodyBox.x + 8, y: bodyBox.y + bodyBox.height * 0.25 }
    const send = (type: 'touchEnd' | 'touchMove' | 'touchStart', y?: number) => client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: typeof y === 'number' ? [{ id: 1, radiusX: 4, radiusY: 4, x: start.x, y }] : [],
    })
    await send('touchStart', start.y)
    // A p95 needs enough frames: a 12-step drag made one missed frame the entire tail estimate.
    const dragSteps = 36
    for (let step = 1; step <= dragSteps; step += 1) {
      await send('touchMove', start.y + dialogBox.height * 0.6 * step / dragSteps)
      await page.waitForTimeout(16)
    }
    await send('touchEnd')
    await page.evaluate(() => {
      ;(window as unknown as { __modalFrameProbe: { marks: Record<string, number> } }).__modalFrameProbe.marks.releaseStart = performance.now()
    })
    await page.waitForTimeout(620)

    const probe = await page.evaluate(() => {
      const state = (window as unknown as {
        __modalFrameProbe: { active: boolean; frames: number[]; handle: number; marks: Record<string, number> }
      }).__modalFrameProbe
      state.marks.end = performance.now()
      state.active = false
      cancelAnimationFrame(state.handle)
      return state
    })
    const intervals = (startTime: number, endTime: number) => {
      const frames = probe.frames.filter((timestamp) => timestamp >= startTime && timestamp <= endTime)
      return frames.slice(1).map((timestamp, index) => timestamp - frames[index])
    }
    return {
      idle: summarize(intervals(probe.marks.idleStart, probe.marks.dragStart)),
      drag: summarize(intervals(probe.marks.dragStart, probe.marks.releaseStart)),
      release: summarize(intervals(probe.marks.releaseStart, probe.marks.end)),
    }
  } finally {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined)
    await context.close()
  }
}

test.describe('modal dismissal performance', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  test('keeps page glass blurred while removing nested modal glass blur in WebKit', async ({ browserName, page }) => {
    test.skip(browserName !== 'webkit', 'Backdrop-filter computed styles are validated in WebKit')
    test.setTimeout(60_000)
    await page.goto(BASE_URL_PATH)
    const opener = page.locator('button[data-tone]').filter({ hasText: 'Advanced Configuration' }).first()
    await expect(opener).toBeVisible()
    const pageFilter = await opener.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-backdrop-filter'))
    expect(pageFilter).toContain('blur(15px)')

    await opener.click()
    const dialog = page.getByRole('dialog', { name: MODAL_TITLE })
    await expect(dialog).toBeVisible()
    const modalTile = dialog.getByRole('switch', { name: 'Turn off Automatic Thermostat' })
    const modalTabs = dialog.getByRole('tablist', { name: 'Thermostat sections' })
    await expect.poll(() => modalTile.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-backdrop-filter'))).toBe('none')
    await expect.poll(() => modalTabs.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-backdrop-filter'))).toBe('none')
    await expect(opener).toBeVisible()
    expect(await opener.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-backdrop-filter'))).toContain('blur(15px)')
  })

  test('compares automatic and full backdrop policies under throttled idle and trusted dismissal', async ({ browser, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'CPU throttling and trusted touch injection are Chromium-only')
    test.setTimeout(120_000)
    const baselineRuns: DismissalMetrics[] = []
    const optimizedRuns: DismissalMetrics[] = []
    for (let run = 0; run < 3; run += 1) {
      const order = run % 2 === 0 ? ['baseline', 'optimized'] : ['optimized', 'baseline']
      for (const variant of order) {
        const metrics = await measureDismissal(browser, variant === 'baseline')
        ;(variant === 'baseline' ? baselineRuns : optimizedRuns).push(metrics)
      }
    }
    const average = (runs: DismissalMetrics[], phase: keyof DismissalMetrics, metric: keyof FrameMetrics) => (
      runs.reduce((total, run) => total + run[phase][metric], 0) / runs.length
    )
    const report = {
      baseline: {
        idleP95: average(baselineRuns, 'idle', 'p95'),
        dragP95: average(baselineRuns, 'drag', 'p95'),
        dragMax: Math.max(...baselineRuns.map((run) => run.drag.max)),
        dragOver33Ratio: average(baselineRuns, 'drag', 'over33Ratio'),
        releaseP95: average(baselineRuns, 'release', 'p95'),
      },
      optimized: {
        idleP95: average(optimizedRuns, 'idle', 'p95'),
        dragP95: average(optimizedRuns, 'drag', 'p95'),
        dragMax: Math.max(...optimizedRuns.map((run) => run.drag.max)),
        dragOver33Ratio: average(optimizedRuns, 'drag', 'over33Ratio'),
        releaseP95: average(optimizedRuns, 'release', 'p95'),
      },
    }
    await testInfo.attach('modal-frame-metrics.json', {
      body: Buffer.from(JSON.stringify({ baselineRuns, optimizedRuns, report }, null, 2)),
      contentType: 'application/json',
    })

    expect(baselineRuns.every((run) => run.drag.frames > 40 && run.release.frames > 20)).toBe(true)
    expect(optimizedRuns.every((run) => run.drag.frames > 40 && run.release.frames > 20)).toBe(true)
    expect(baselineRuns.every((run) => run.idle.frames > 30)).toBe(true)
    expect(optimizedRuns.every((run) => run.idle.frames > 30)).toBe(true)
    expect(report.optimized.idleP95).toBeLessThanOrEqual(report.baseline.idleP95 * 1.1)
    expect(report.optimized.dragP95, JSON.stringify(report)).toBeLessThanOrEqual(report.baseline.dragP95 * 1.1)
    expect(report.optimized.releaseP95).toBeLessThanOrEqual(report.baseline.releaseP95 * 1.1)
  })

  test('keeps the optimized modal open geometry stable', async ({ page }) => {
    const dialog = await openThermostatAdvancedControls(page)
    const box = await dialog.boundingBox()
    expect(box?.width).toBeGreaterThan(380)
    expect(box?.height).toBeGreaterThan(700)
    await expect(dialog).toHaveCSS('background-color', 'rgb(24, 24, 24)')
    await expect(dialog).toHaveCSS('border-radius', '30px 30px 0px 0px')
  })
})
