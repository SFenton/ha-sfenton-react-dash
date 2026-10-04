// @covers src/components/hass/RtcPilotCamera.tsx
// @covers src/components/hass/RtcPilotCamera.module.css
// @covers src/components/hass/mockRtcCard.ts
// @covers src/pages/AtAGlancePage.tsx
// @covers src/components/hass/rtcCardPool.ts
import { expect, test, type Page } from './layout/fixture'
import { waitForNavigation } from './layout/evidence'

// Mock evidence only: the mock RTC card mirrors the vendored card's shared-stream behavior,
// reporting `connected` before its new video decodes a frame. Every animation frame the
// sampler records any camera surface a person could see as gray, black, or reloading.
const MOCK_CONNECT_MS = 300
const MOCK_FIRST_FRAME_MS = 150

interface ContinuityReport {
  blankTileSamples: number
  creations: number
  notLiveLabelSamples: number
  revealedWithoutFrame: number
  samples: number
  surfaceSamples: number
}

type ContinuityWindow = Window & {
  __cameraContinuity?: ContinuityReport & { running: boolean }
  __mockRtcCardCreations?: number
}

async function configureMockCameraTiming(page: Page) {
  await page.addInitScript(({ connectMs, frameMs }) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    const mockWindow = window as unknown as { __mockCameraDelayMs?: number; __mockCameraFrameDelayMs?: number }
    mockWindow.__mockCameraDelayMs = connectMs
    mockWindow.__mockCameraFrameDelayMs = frameMs
  }, { connectMs: MOCK_CONNECT_MS, frameMs: MOCK_FIRST_FRAME_MS })
}

function activeRoute(page: Page, path: string) {
  return page.locator('[data-route-path="' + path + '"]:visible').last()
}

async function navigateTo(page: Page, label: string) {
  const adaptiveNavigation = page.locator('[data-adaptive-navigation]:visible')
  if (await adaptiveNavigation.count()) {
    await adaptiveNavigation.getByRole('button', { name: label, exact: true }).click()
    return
  }
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.locator('aside[data-state="open"]').getByRole('menuitem', { name: label, exact: true }).click()
}

async function expectRouteCamerasLive(page: Page, path: string) {
  const root = activeRoute(page, path)
  const tiles = root.locator('[data-camera-transport="webrtc"][data-variant="tile"]')
  await expect(tiles.first()).toBeVisible({ timeout: 15_000 })
  const count = await tiles.count()
  expect(count).toBeGreaterThan(0)
  await expect(root.locator('[data-camera-transport="webrtc"][data-variant="tile"][data-loaded="true"]')).toHaveCount(count, { timeout: 15_000 })
  return count
}

// Samples once per animation frame, so it sees exactly the states the browser paints.
async function startContinuitySampler(page: Page, scope: { kind: 'dialog' } | { kind: 'route'; path: string }) {
  await page.evaluate((target) => {
    const continuityWindow = window as ContinuityWindow
    const report = {
      blankTileSamples: 0,
      creations: continuityWindow.__mockRtcCardCreations ?? 0,
      notLiveLabelSamples: 0,
      revealedWithoutFrame: 0,
      running: true,
      samples: 0,
      surfaceSamples: 0,
    }
    continuityWindow.__cameraContinuity = report
    const visible = (element: Element) => element.getClientRects().length > 0
    const scopeRoot = () => {
      if (target.kind === 'dialog') return [...document.querySelectorAll('[role="dialog"]')].filter(visible).at(-1) ?? null
      return [...document.querySelectorAll(`[data-route-path="${target.path}"]`)].filter(visible).at(-1) ?? null
    }
    const showsFrame = (frame: Element) => (
      frame.getAttribute('data-loaded') === 'true' || frame.querySelector('[data-camera-poster="true"]') !== null
    )
    const sample = () => {
      if (!report.running) return
      report.samples += 1
      for (const card of document.querySelectorAll('webrtc-camera-sfenton[data-dashboard-visible="true"]')) {
        const video = (card as HTMLElement & { video?: HTMLVideoElement | null }).video
        if (card.isConnected && video && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) report.revealedWithoutFrame += 1
      }
      const root = scopeRoot()
      if (root) {
        if (target.kind === 'dialog') {
          const frame = root.querySelector('[data-camera-transport="webrtc"][data-variant="modal"]')
          if (frame || root.querySelector('[data-modal-landscape-layout="media-split"]')) {
            report.surfaceSamples += 1
            if (!frame || !showsFrame(frame)) report.blankTileSamples += 1
          }
        } else {
          for (const button of root.querySelectorAll('button[aria-label^="Open "][aria-label$=" camera"]')) {
            const tile = button.parentElement
            if (!tile || !visible(tile)) continue
            report.surfaceSamples += 1
            const frame = tile.querySelector('[data-camera-transport="webrtc"]')
            if (!frame || !showsFrame(frame)) report.blankTileSamples += 1
            const label = button.querySelectorAll('[data-dynamic-grid-label="true"]')[1]?.textContent
            if (label !== 'Live') report.notLiveLabelSamples += 1
          }
        }
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, scope)
}

async function stopContinuitySampler(page: Page) {
  return page.evaluate(() => {
    const continuityWindow = window as ContinuityWindow
    const report = continuityWindow.__cameraContinuity
    if (!report) throw new Error('The camera continuity sampler was not started.')
    report.running = false
    return {
      blankTileSamples: report.blankTileSamples,
      creations: (continuityWindow.__mockRtcCardCreations ?? 0) - report.creations,
      notLiveLabelSamples: report.notLiveLabelSamples,
      revealedWithoutFrame: report.revealedWithoutFrame,
      samples: report.samples,
      surfaceSamples: report.surfaceSamples,
    } satisfies ContinuityReport
  })
}

async function settleFrames(page: Page, durationMs: number) {
  await page.evaluate((duration) => new Promise<void>((resolve) => {
    const started = performance.now()
    const tick = () => (performance.now() - started >= duration ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  }), durationMs)
}

for (const surface of [
  { heading: 'Home', path: 'overview', url: '/at-a-glance/overview' },
  { heading: 'Security', path: 'security', url: '/at-a-glance/security' },
]) {
  test(`${surface.heading} cameras stay live through ${surface.heading} → Settings → ${surface.heading}`, async ({ page }) => {
    await configureMockCameraTiming(page)

    for (const viewport of [{ height: 852, width: 393 }, { height: 900, width: 1440 }]) {
      await test.step(`${viewport.width}×${viewport.height}`, async () => {
        await page.setViewportSize(viewport)
        await page.goto(`${surface.url}?camera-continuity=${viewport.width}`)
        await waitForNavigation(page)
        const cameraCount = await expectRouteCamerasLive(page, surface.path)

        await navigateTo(page, 'Settings')
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 15_000 })

        await startContinuitySampler(page, { kind: 'route', path: surface.path })
        await navigateTo(page, surface.heading)
        await expect(activeRoute(page, surface.path).getByRole('heading', { level: 1, name: surface.heading })).toBeVisible()
        await expectRouteCamerasLive(page, surface.path)
        // Outlast the warm heavy-content delay and the mock first-frame delay.
        await settleFrames(page, MOCK_FIRST_FRAME_MS + 450)
        const report = await stopContinuitySampler(page)

        expect(report.surfaceSamples).toBeGreaterThanOrEqual(cameraCount)
        expect(report, 'a returning camera tile painted gray, black, or reconnecting').toMatchObject({
          blankTileSamples: 0,
          creations: 0,
          notLiveLabelSamples: 0,
          revealedWithoutFrame: 0,
        })
      })
    }
  })
}

test('camera modals open on a frame from the live tile stream and reopen without reconnecting', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await configureMockCameraTiming(page)

  for (const surface of [
    { path: 'overview', url: '/at-a-glance/overview?camera-continuity=modal-home' },
    { path: 'security', url: '/at-a-glance/security?camera-continuity=modal-security' },
  ]) {
    await test.step(surface.path, async () => {
      await page.goto(surface.url)
      await waitForNavigation(page)
      await expectRouteCamerasLive(page, surface.path)
      const root = activeRoute(page, surface.path)
      const dialog = page.getByRole('dialog')
      const modalFrame = dialog.locator('[data-camera-transport="webrtc"][data-variant="modal"]')

      for (const attempt of ['first open', 'reopen']) {
        await test.step(attempt, async () => {
          await startContinuitySampler(page, { kind: 'dialog' })
          await root.getByRole('button', { name: 'Open Front Door camera' }).click()
          await expect(modalFrame).toHaveAttribute('data-loaded', 'true')
          await expect(modalFrame.locator('[data-camera-poster="true"]')).toHaveCount(0)
          await settleFrames(page, 200)
          const report = await stopContinuitySampler(page)

          expect(report.surfaceSamples).toBeGreaterThan(0)
          expect(report, `the ${attempt} camera modal painted a blank or black stream`).toMatchObject({
            blankTileSamples: 0,
            revealedWithoutFrame: 0,
          })
          if (attempt === 'reopen') expect(report.creations).toBe(0)

          await page.keyboard.press('Escape')
          await expect(dialog).toHaveCount(0)
        })
      }
    })
  }
})
