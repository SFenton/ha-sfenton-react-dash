import { expect, test, type Browser, type Page } from './layout/fixture'
import { waitForModalReady } from './layout/evidence'

const BASE_URL_PATH = '/at-a-glance/thermostat'
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
  sampling: {
    frames: number[]
    marks: Record<string, number>
  }
}

type FramePhase = 'idle' | 'drag' | 'release'

function frameIntervals(frames: number[], startTime: number, endTime: number) {
  // Keep the preceding timestamp so the first completed frame includes boundary-spanning work.
  return frames.slice(1).flatMap((timestamp, index) => (
    timestamp > startTime && timestamp <= endTime ? [timestamp - frames[index]] : []
  ))
}

test('dismissal frame sampling retains the interval spanning each phase start', () => {
  expect(frameIntervals([0, 16, 96, 112, 128], 20, 120)).toEqual([80, 16])
  expect(frameIntervals([0, 16, 96, 112, 128], 96, 112)).toEqual([16])
  expect(frameIntervals([0, 16, 96, 112, 128], 17, 95)).toEqual([])
})

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

function phaseIntervals(run: DismissalMetrics, phase: FramePhase) {
  const boundaries: Record<FramePhase, [string, string]> = {
    idle: ['idleStart', 'dragStart'],
    drag: ['dragStart', 'releaseStart'],
    release: ['releaseStart', 'end'],
  }
  const [startMark, endMark] = boundaries[phase]
  return frameIntervals(
    run.sampling.frames,
    run.sampling.marks[startMark],
    run.sampling.marks[endMark],
  )
}

function aggregatePhaseP95(runs: DismissalMetrics[], phase: FramePhase) {
  return percentile(runs.flatMap((run) => phaseIntervals(run, phase)), 0.95)
}

function p95RatioLowerBound(
  baselineRuns: DismissalMetrics[],
  optimizedRuns: DismissalMetrics[],
  phase: FramePhase,
) {
  if (baselineRuns.length !== optimizedRuns.length || baselineRuns.length === 0) {
    throw new Error('Performance variants require the same non-zero number of paired runs')
  }
  const ratios: number[] = []
  const selection: number[] = []
  const sample = () => {
    if (selection.length === baselineRuns.length) {
      const baselineP95 = percentile(selection.flatMap((index) => phaseIntervals(baselineRuns[index], phase)), 0.95)
      const optimizedP95 = percentile(selection.flatMap((index) => phaseIntervals(optimizedRuns[index], phase)), 0.95)
      ratios.push(optimizedP95 / baselineP95)
      return
    }
    for (let index = 0; index < baselineRuns.length; index += 1) {
      selection.push(index)
      sample()
      selection.pop()
    }
  }
  sample()
  return percentile(ratios, 0.05)
}

async function markAfterFrames(page: Page, mark: string, minimumFrames: number) {
  await page.evaluate(({ mark, minimumFrames }) => new Promise<void>((resolve) => {
    const state = (window as unknown as {
      __modalFrameProbe: { frames: number[]; marks: Record<string, number> }
    }).__modalFrameProbe
    const initialFrames = state.frames.length
    const waitForFrames = () => {
      if (state.frames.length - initialFrames >= minimumFrames) {
        state.marks[mark] = performance.now()
        resolve()
        return
      }
      requestAnimationFrame(waitForFrames)
    }
    requestAnimationFrame(waitForFrames)
  }), { mark, minimumFrames })
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
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }))).toEqual({ visibility: 'visible', focused: true })
    await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
    const dialog = page.getByRole('dialog', { name: MODAL_TITLE })
    await waitForModalReady(dialog)
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
    await markAfterFrames(page, 'dragStart', 32)

    const start = { x: bodyBox.x + 8, y: bodyBox.y + bodyBox.height * 0.25 }
    const send = (type: 'touchEnd' | 'touchMove' | 'touchStart', y?: number) => client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: typeof y === 'number' ? [{ id: 1, radiusX: 4, radiusY: 4, x: start.x, y }] : [],
    })
    await send('touchStart', start.y)
    // Drive the trusted gesture by rendered frames so host load cannot reduce the p95 sample.
    const dragSteps = 44
    for (let step = 1; step <= dragSteps; step += 1) {
      await send('touchMove', start.y + dialogBox.height * 0.6 * step / dragSteps)
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    }
    await page.evaluate(() => {
      ;(window as unknown as { __modalFrameProbe: { marks: Record<string, number> } }).__modalFrameProbe.marks.releaseStart = performance.now()
    })
    await send('touchEnd')
    await markAfterFrames(page, 'end', 22)

    const probe = await page.evaluate(() => {
      const state = (window as unknown as {
        __modalFrameProbe: { active: boolean; frames: number[]; handle: number; marks: Record<string, number> }
      }).__modalFrameProbe
      state.active = false
      cancelAnimationFrame(state.handle)
      return state
    })
    return {
      idle: summarize(frameIntervals(probe.frames, probe.marks.idleStart, probe.marks.dragStart)),
      drag: summarize(frameIntervals(probe.frames, probe.marks.dragStart, probe.marks.releaseStart)),
      release: summarize(frameIntervals(probe.frames, probe.marks.releaseStart, probe.marks.end)),
      sampling: { frames: probe.frames, marks: probe.marks },
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
    for (let run = 0; run < 4; run += 1) {
      const order = run % 2 === 0 ? ['baseline', 'optimized'] : ['optimized', 'baseline']
      for (const variant of order) {
        const metrics = await measureDismissal(browser, variant === 'baseline')
        ;(variant === 'baseline' ? baselineRuns : optimizedRuns).push(metrics)
      }
    }
    const average = (runs: DismissalMetrics[], phase: FramePhase, metric: keyof FrameMetrics) => (
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
      aggregate: {
        baseline: {
          idleP95: aggregatePhaseP95(baselineRuns, 'idle'),
          dragP95: aggregatePhaseP95(baselineRuns, 'drag'),
          releaseP95: aggregatePhaseP95(baselineRuns, 'release'),
        },
        optimized: {
          idleP95: aggregatePhaseP95(optimizedRuns, 'idle'),
          dragP95: aggregatePhaseP95(optimizedRuns, 'drag'),
          releaseP95: aggregatePhaseP95(optimizedRuns, 'release'),
        },
      },
      p95RatioLowerBound: {
        idle: p95RatioLowerBound(baselineRuns, optimizedRuns, 'idle'),
        drag: p95RatioLowerBound(baselineRuns, optimizedRuns, 'drag'),
        release: p95RatioLowerBound(baselineRuns, optimizedRuns, 'release'),
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
    expect(report.p95RatioLowerBound.idle, JSON.stringify(report)).toBeLessThanOrEqual(1.1)
    expect(report.p95RatioLowerBound.drag, JSON.stringify(report)).toBeLessThanOrEqual(1.1)
    expect(report.p95RatioLowerBound.release, JSON.stringify(report)).toBeLessThanOrEqual(1.1)
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

test('aggregate performance comparison rejects a consistently degraded automatic backdrop', () => {
  const metrics = (intervals: number[]): DismissalMetrics => {
    const frames = intervals.reduce<number[]>((timestamps, interval) => (
      [...timestamps, timestamps[timestamps.length - 1] + interval]
    ), [0])
    return {
      idle: summarize(intervals),
      drag: summarize(intervals),
      release: summarize(intervals),
      sampling: {
        frames,
        marks: { dragStart: 0, end: frames[frames.length - 1], idleStart: 0, releaseStart: 0 },
      },
    }
  }
  const baselineRuns = Array.from({ length: 5 }, () => metrics(Array.from({ length: 36 }, () => 16.7)))
  const noisyOptimizedRuns = baselineRuns.map((run, index) => (
    index === 2 ? metrics(Array.from({ length: 36 }, () => 33.3)) : run
  ))
  const degradedOptimizedRuns = Array.from({ length: 5 }, () => metrics(Array.from({ length: 36 }, () => 20.1)))

  expect(p95RatioLowerBound(baselineRuns, noisyOptimizedRuns, 'release')).toBeLessThanOrEqual(1.1)
  expect(p95RatioLowerBound(baselineRuns, degradedOptimizedRuns, 'release')).toBeGreaterThan(1.1)
})
