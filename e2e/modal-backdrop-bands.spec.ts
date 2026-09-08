import { expect, test, type Locator, type Page } from './layout/fixture'
import { waitForModalReady } from './layout/evidence'

const PHONE = { height: 852, width: 393 }
const CENTERED_QUERY = (width: number, height: number) => width >= 760 && height >= 560

async function openHarness(page: Page, harness: string, values: string[] = [], backdropPolicy?: 'auto' | 'full') {
  const search = new URLSearchParams({ __modalAcceptance: harness })
  for (const value of values) search.append('__modalValue', value)
  if (backdropPolicy) search.set('modalBackdrop', backdropPolicy)
  await page.goto(`/?${search.toString()}`)
  const dialog = page.getByRole('dialog').last()
  await expect(dialog).toBeVisible()
  return dialog
}

async function screenshotDifference(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(async ({ firstBase64, secondBase64 }) => {
    const load = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = `data:image/png;base64,${source}`
    })
    const [firstImage, secondImage] = await Promise.all([load(firstBase64), load(secondBase64)])
    const canvas = document.createElement('canvas')
    canvas.width = firstImage.width
    canvas.height = firstImage.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to compare modal backdrop screenshots')
    context.drawImage(firstImage, 0, 0)
    const firstPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(secondImage, 0, 0)
    const secondPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let differentPixels = 0
    let aboveRoundingPixels = 0
    let maxDelta = 0
    for (let index = 0; index < firstPixels.length; index += 4) {
      let delta = 0
      for (let channel = 0; channel < 4; channel += 1) {
        delta = Math.max(delta, Math.abs(firstPixels[index + channel] - secondPixels[index + channel]))
      }
      if (delta === 0) continue
      differentPixels += 1
      if (delta > 1) aboveRoundingPixels += 1
      maxDelta = Math.max(maxDelta, delta)
    }
    return {
      differentPixelRatio: differentPixels / (canvas.width * canvas.height),
      aboveRoundingPixelRatio: aboveRoundingPixels / (canvas.width * canvas.height),
      maxDelta,
    }
  }, {
    firstBase64: first.toString('base64'),
    secondBase64: second.toString('base64'),
  })
}

async function monitorBackdropCoverage(page: Page, duration: number) {
  return page.evaluate((monitorDuration) => new Promise<Array<{
    active: boolean
    elapsed: number
    uncoveredArea: number
  }>>((resolve) => {
    const started = performance.now()
    const samples: Array<{ active: boolean; elapsed: number; uncoveredArea: number }> = []
    const rectangleUnionArea = (rectangles: DOMRect[], bounds: DOMRect) => {
      const clipped = rectangles.map((rect) => ({
        bottom: Math.max(bounds.top, Math.min(bounds.bottom, rect.bottom)),
        left: Math.max(bounds.left, Math.min(bounds.right, rect.left)),
        right: Math.max(bounds.left, Math.min(bounds.right, rect.right)),
        top: Math.max(bounds.top, Math.min(bounds.bottom, rect.top)),
      })).filter((rect) => rect.right > rect.left && rect.bottom > rect.top)
      const xs = [...new Set([bounds.left, bounds.right, ...clipped.flatMap((rect) => [rect.left, rect.right])])].sort((first, second) => first - second)
      let area = 0
      for (let index = 0; index < xs.length - 1; index += 1) {
        const left = xs[index]
        const right = xs[index + 1]
        const midpoint = (left + right) / 2
        const intervals = clipped
          .filter((rect) => midpoint >= rect.left && midpoint < rect.right)
          .map((rect) => [rect.top, rect.bottom] as const)
          .sort((first, second) => first[0] - second[0])
        let coveredHeight = 0
        let currentTop = 0
        let currentBottom = 0
        let activeInterval = false
        for (const [top, bottom] of intervals) {
          if (!activeInterval || top > currentBottom) {
            if (activeInterval) coveredHeight += currentBottom - currentTop
            currentTop = top
            currentBottom = bottom
            activeInterval = true
          } else {
            currentBottom = Math.max(currentBottom, bottom)
          }
        }
        if (activeInterval) coveredHeight += currentBottom - currentTop
        area += (right - left) * coveredHeight
      }
      return area
    }
    const sample = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('[data-modal-sheet-overlay="true"]'))
        .filter((element) => element.getBoundingClientRect().width > 0)
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
        .filter((element) => element.getBoundingClientRect().width > 0)
      const overlay = overlays.at(-1)
      const dialog = dialogs.at(-1)
      const overlayStyle = overlay ? getComputedStyle(overlay) : null
      const active = Boolean(
        overlay
        && dialog
        && overlay.hasAttribute('data-exposed-backdrop-bands')
        && (
          overlayStyle?.backdropFilter === 'none'
          || overlayStyle?.getPropertyValue('-webkit-backdrop-filter') === 'none'
        ),
      )
      let uncoveredArea = 0
      if (active && overlay && dialog) {
        const overlayBounds = overlay.getBoundingClientRect()
        const rectangles = [
          dialog.getBoundingClientRect(),
          ...Array.from(overlay.querySelectorAll<HTMLElement>('[data-modal-backdrop-band]'))
            .filter((band) => getComputedStyle(band).visibility === 'visible')
            .map((band) => band.getBoundingClientRect()),
        ]
        uncoveredArea = Math.max(
          0,
          overlayBounds.width * overlayBounds.height - rectangleUnionArea(rectangles, overlayBounds),
        )
      }
      samples.push({ active, elapsed: performance.now() - started, uncoveredArea })
      if (performance.now() - started < monitorDuration) requestAnimationFrame(sample)
      else resolve(samples)
    }
    requestAnimationFrame(sample)
  }), duration)
}

async function transitionViewport(page: Page, overlay: Locator, width: number, height: number, expectActive?: boolean) {
  const monitor = monitorBackdropCoverage(page, 1_200)
  await page.waitForTimeout(50)
  await page.setViewportSize({ height, width })
  const samples = await monitor
  const activeGaps = samples.filter((sample) => sample.active && sample.uncoveredArea > 0.5)
  expect(activeGaps, `${width}x${height} active backdrop gaps`).toEqual([])
  const areaRatio = await overlay.locator('[data-modal-backdrop-band]').evaluateAll((bands) => (
    bands.reduce((area, band) => {
      const bounds = band.getBoundingClientRect()
      return area + bounds.width * bounds.height
    }, 0) / (window.innerWidth * window.innerHeight)
  ))
  const shouldActivate = expectActive ?? (!CENTERED_QUERY(width, height) && areaRatio <= 0.25)
  if (shouldActivate) {
    await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true', { timeout: 2_000 })
  } else {
    await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands', { timeout: 2_000 })
  }
}

function monitorBandUptime(overlay: Locator, duration: number) {
  return overlay.evaluate((element, durationMs) => new Promise<{
    activeFrames: number
    activeDuringInteraction: number
    frames: number
    restingFrames: number
    restingActiveFrames: number
    toggles: number
  }>((resolve) => {
    let activeFrames = 0
    let activeDuringInteraction = 0
    let frames = 0
    let restingFrames = 0
    let restingActiveFrames = 0
    let toggles = 0
    const pointers = new Set<number>()
    const touches = new Set<number>()
    const down = (event: PointerEvent) => pointers.add(event.pointerId)
    const up = (event: PointerEvent) => pointers.delete(event.pointerId)
    const touchStart = (event: TouchEvent) => {
      for (const touch of event.changedTouches) touches.add(touch.identifier)
    }
    const touchEnd = (event: TouchEvent) => {
      for (const touch of event.changedTouches) touches.delete(touch.identifier)
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('touchstart', touchStart, { capture: true, passive: true })
    document.addEventListener('touchend', touchEnd, true)
    document.addEventListener('touchcancel', touchEnd, true)
    let previous = element.hasAttribute('data-exposed-backdrop-bands')
    const observer = new MutationObserver(() => {
      const active = element.hasAttribute('data-exposed-backdrop-bands')
      if (active !== previous) {
        previous = active
        toggles += 1
      }
    })
    observer.observe(element, { attributeFilter: ['data-exposed-backdrop-bands'], attributes: true })
    const started = performance.now()
    const sample = () => {
      frames += 1
      const active = element.hasAttribute('data-exposed-backdrop-bands')
      const interacting = pointers.size > 0 || touches.size > 0
      if (active) activeFrames += 1
      if (interacting && active) activeDuringInteraction += 1
      if (!interacting && !element.hasAttribute('data-swiping')) {
        restingFrames += 1
        if (active) restingActiveFrames += 1
      }
      if (performance.now() - started < durationMs) requestAnimationFrame(sample)
      else {
        observer.disconnect()
        document.removeEventListener('pointerdown', down, true)
        document.removeEventListener('pointerup', up, true)
        document.removeEventListener('pointercancel', up, true)
        document.removeEventListener('touchstart', touchStart, true)
        document.removeEventListener('touchend', touchEnd, true)
        document.removeEventListener('touchcancel', touchEnd, true)
        resolve({ activeFrames, activeDuringInteraction, frames, restingFrames, restingActiveFrames, toggles })
      }
    }
    requestAnimationFrame(sample)
  }), duration)
}

test('default bands keep the full scrim above blur while full policy remains available', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const dialog = await openHarness(page, 'option-picker', ['Backdrop test', 'Automatic', 'Manual'])
  const overlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(overlay).toHaveCSS('backdrop-filter', 'none')
  await expect(dialog).toHaveCSS('background-color', 'rgb(24, 24, 24)')
  await expect(overlay.locator('[data-modal-backdrop-scrim]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.58)')
  await expect(overlay.locator('[data-modal-backdrop-scrim]')).toBeVisible()
  await expect(overlay.locator('[data-modal-backdrop-band="top"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  const fullSearch = new URLSearchParams({
    __modalAcceptance: 'option-picker',
    modalBackdrop: 'full',
  })
  for (const value of ['Backdrop test', 'Automatic', 'Manual']) fullSearch.append('__modalValue', value)
  await page.goto(`/?${fullSearch.toString()}`)
  const fullOverlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(page.getByRole('dialog')).toHaveAttribute('data-backdrop-policy', 'full')
  await expect(fullOverlay).not.toHaveAttribute('data-exposed-backdrop-bands')
  await expect(fullOverlay.locator('[data-modal-backdrop-layer="true"]')).toHaveCount(0)
  await expect(fullOverlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.58)')
  await expect(fullOverlay).toHaveCSS('backdrop-filter', 'blur(10px)')
})

test('rendered blur passes a positive control before checking automatic pixel parity', async ({ browserName, page }, testInfo) => {
  async function prepare(policy: 'auto' | 'full') {
    const dialog = await openHarness(page, 'option-picker', ['Backdrop test', 'Automatic', 'Manual'], policy)
    await waitForModalReady(dialog)
    await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.dataset.modalBackdropPixelProbe = 'true'
      Object.assign(probe.style, {
        background: 'repeating-conic-gradient(#fff 0 25%, #000 0 50%) 0 0 / 16px 16px',
        inset: '0', pointerEvents: 'none', position: 'fixed', zIndex: '39',
      })
      document.body.append(probe)
    })
    await dialog.locator('[data-modal-sheet-body="true"]').locator('..').evaluate((element) => {
      element.style.setProperty('visibility', 'hidden', 'important')
    })
    return page.locator('[data-modal-sheet-overlay="true"]').last()
  }
  for (const [viewport, bandsExpected] of [[PHONE, true], [{ height: 393, width: 852 }, false], [{ height: 1152, width: 741 }, true]] as const) {
    await page.setViewportSize(viewport)
    const automaticOverlay = await prepare('auto')
    if (bandsExpected) await expect(automaticOverlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
    else await expect(automaticOverlay).not.toHaveAttribute('data-exposed-backdrop-bands')
    const optimized = await page.screenshot({ animations: 'allow' })
    // Hold the documented ineligible fallback on the same surface while sampling.
    // Otherwise a resize-settlement callback can restore bands between captures.
    await page.getByRole('dialog').last().evaluate((element) => element.setAttribute('data-centered-layout', 'true'))
    await automaticOverlay.evaluate((element) => element.removeAttribute('data-exposed-backdrop-bands'))
    const overlay = automaticOverlay
    await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
    await expect(overlay.locator('[data-modal-backdrop-band="top"]')).toHaveCSS('visibility', 'hidden')
    await expect(overlay).toHaveCSS('backdrop-filter', 'blur(10px)')
    const full = await page.screenshot({ animations: 'allow' })
    await overlay.evaluate((element) => {
      element.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
      element.style.setProperty('backdrop-filter', 'none', 'important')
    })
    const filterFree = await page.screenshot({ animations: 'allow' })
    const positiveControl = await screenshotDifference(page, full, filterFree)
    await testInfo.attach(`blur-positive-control-${viewport.width}x${viewport.height}`, {
      body: JSON.stringify(positiveControl), contentType: 'application/json',
    })
    test.skip(
      browserName === 'webkit' && process.platform === 'linux' && positiveControl.maxDelta === 0,
      'This Linux WebKit renderer does not execute the blur-positive control; its pixel parity is unverified.',
    )
    expect(positiveControl.maxDelta, 'The renderer must visibly execute blur, not merely parse the CSS').toBeGreaterThan(10)
    expect(positiveControl.differentPixelRatio).toBeGreaterThan(0.00005)
    const parity = await screenshotDifference(page, optimized, full)
    await testInfo.attach(`blur-parity-${viewport.width}x${viewport.height}`, {
      body: JSON.stringify(parity), contentType: 'application/json',
    })
    expect(parity.maxDelta).toBeLessThanOrEqual(1)
    // Preserve the strict one-channel-unit bound; count only differences beyond
    // that declared rounding tolerance, not scattered one-unit compositor noise.
    expect(parity.aboveRoundingPixelRatio).toBeLessThanOrEqual(0.0015)
  }
})

test('CSS proxy bands cover every active frame across resize and orientation changes', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openHarness(page, 'option-picker', ['Geometry test', 'Automatic', 'Manual'])
  const overlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')

  for (const viewport of [
    { height: 393, width: 852 },
    { height: 1152, width: 741 },
    { height: 741, width: 1152 },
    { height: 842, width: 836 },
    { height: 836, width: 842 },
    { height: 1180, width: 820 },
    { height: 820, width: 1180 },
    { height: 900, width: 1440 },
    { height: 1080, width: 1920 },
    PHONE,
    { height: 559, width: 759 },
    { height: 560, width: 759 },
    { height: 560, width: 760 },
    { height: 560, width: 759 },
    { height: 520, width: 393 },
    PHONE,
  ]) {
    await transitionViewport(page, overlay, viewport.width, viewport.height)
  }

  await page.setViewportSize(PHONE)
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  await page.addStyleTag({ content: ':root { --dashboard-viewport-width: 393px !important; }' })
  await transitionViewport(page, overlay, 852, 393, false)
})

test('descendant modal transitions do not disable settled bands', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/index.html?path=vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  const overlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')

  const monitor = monitorBandUptime(overlay, 2_400)
  for (const name of ['Zones', 'Auto-Clean', 'Actions', 'Info']) {
    await dialog.getByRole('tab', { name }).evaluate((element) => (element as HTMLElement).click())
    await page.waitForTimeout(320)
  }
  const result = await monitor
  expect(result.toggles).toBe(0)
  expect(result.activeFrames / result.frames).toBeGreaterThanOrEqual(0.98)
})

test('trusted tab taps and clicks recover automatic bands without transition churn', async ({ page }, testInfo) => {
  await page.setViewportSize(PHONE)
  await page.goto('/index.html?path=vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  const overlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  const monitor = monitorBandUptime(overlay, 3_400)
  for (const name of ['Zones', 'Auto-Clean', 'Actions', 'Info']) {
    const tab = dialog.getByRole('tab', { name })
    if (testInfo.project.use.hasTouch) await tab.tap()
    else await tab.click()
    await expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
    await page.waitForTimeout(320)
  }
  const result = await monitor
  await testInfo.attach('trusted-backdrop-uptime.json', {
    body: JSON.stringify({
      ...result,
      activeRatio: result.activeFrames / result.frames,
      restingActiveRatio: result.restingActiveFrames / result.restingFrames,
    }),
    contentType: 'application/json',
  })
  expect(result.toggles).toBeGreaterThan(0)
  expect(result.activeDuringInteraction).toBe(0)
  expect(result.restingActiveFrames / result.restingFrames).toBeGreaterThanOrEqual(0.9)
})

test('low-ROI sheets retain the full overlay', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openHarness(page, 'bed-temperature-scope', ["Stephen's Bed", '-3', 'bedtime'])
  const overlay = page.locator('[data-modal-sheet-overlay="true"]').last()
  await expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
  const areaRatio = await overlay.locator('[data-modal-backdrop-band]').evaluateAll((bands) => {
    const overlayBounds = bands[0]?.parentElement?.parentElement?.getBoundingClientRect()
    if (!overlayBounds) return 1
    return bands.reduce((area, band) => {
      const bounds = band.getBoundingClientRect()
      return area + bounds.width * bounds.height
    }, 0) / (overlayBounds.width * overlayBounds.height)
  })
  expect(areaRatio).toBeGreaterThan(0.25)
})

test('stacked ModalSheet portals keep every overlay on the full composition', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const parent = await openHarness(page, 'nested-modal', ['Parent modal', 'Child modal', 'Open child modal', 'Nested modal content'])
  const overlays = page.locator('[data-modal-sheet-overlay="true"]')
  await expect(overlays).toHaveCount(1)
  await expect(overlays.first()).toHaveAttribute('data-exposed-backdrop-bands', 'true')

  await parent.getByRole('button', { name: 'Open child modal' }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(2)
  await expect(overlays).toHaveCount(2)
  await expect.poll(async () => overlays.evaluateAll((items) => (
    items.filter((item) => item.hasAttribute('data-exposed-backdrop-bands')).length
  ))).toBe(0)

  const child = page.getByRole('dialog', { name: 'Child modal' })
  await child.getByRole('button', { name: 'Close' }).click()
  await expect(child).toHaveCount(0, { timeout: 700 })
  await expect(overlays).toHaveCount(1)
  await expect(overlays.first()).toHaveAttribute('data-exposed-backdrop-bands', 'true', { timeout: 2_000 })
})
