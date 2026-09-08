import { expect, test, type Locator, type Page } from './layout/fixture'
import { modalSheetPresentationForViewport } from '../src/components/core/modalSheetPresentation'
import { OCCUPANCY_GROUPS } from '../src/constants/atAGlance'
import { SHOW_OUTDOOR_FAUCETS_ENTITY_ID } from '../src/constants/sprinklers'
import { setSafeAreaInsets } from './safe-area'
import { openQuickLinksTab, quickLinksLayout } from './quick-links'

const DIALOG_SQUARE_TILE_SIZE = 168
const PORTRAIT_TILE_WIDTH = 174.5
const PORTRAIT_TILE_HEIGHT = 147.875

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
  { height: 741, width: 1152 },
] as const

const HUE_SYNC_VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 741, width: 1152 },
  { height: 836, width: 842 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
] as const

const HUE_SYNC_RESIZE_SEQUENCES = [
  [{ height: 852, width: 393 }, { height: 900, width: 1440 }, { height: 852, width: 393 }],
  [{ height: 900, width: 1440 }, { height: 852, width: 393 }, { height: 900, width: 1440 }],
  [{ height: 1180, width: 820 }, { height: 820, width: 1180 }, { height: 1180, width: 820 }],
  [{ height: 1152, width: 741 }, { height: 741, width: 1152 }, { height: 1152, width: 741 }],
  [{ height: 820, width: 1180 }, { height: 741, width: 1152 }, { height: 820, width: 1180 }],
] as const

async function closeModal(dialog: Locator) {
  await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
}

async function expectOutgoingTabScrollPreserved({
  dialog,
  panelSelector,
  requireOutgoingFrame = true,
  scrollOwnerSelector,
  targetTab,
}: {
  dialog: Locator
  panelSelector: string
  requireOutgoingFrame?: boolean
  scrollOwnerSelector: string
  targetTab: string
}) {
  const panel = dialog.locator(panelSelector)
  await expect(panel).toHaveAttribute('data-modal-tab-transition-state', 'idle')
  const scrollOwner = dialog.locator(scrollOwnerSelector)
  const preClickScrollTop = await scrollOwner.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return element.scrollTop
  })
  expect(preClickScrollTop).toBeGreaterThan(0)
  const outgoingLabel = await panel.evaluate((element) => (
    element.getAttribute('data-tab')
    ?? element.getAttribute('aria-labelledby')
    ?? element.getAttribute('aria-label')
  ))
  expect(outgoingLabel).toBeTruthy()

  const samples = await dialog.getByRole('tab', { name: targetTab }).evaluate((tab, selectors) => new Promise<Array<{
    label: string | null
    opacity: number
    scrollTop: number
  }>>((resolve) => {
    const dialogElement = tab.closest('[role="dialog"]')
    const currentPanel = dialogElement?.querySelector<HTMLElement>(selectors.panelSelector)
    const currentScrollOwner = dialogElement?.querySelector<HTMLElement>(selectors.scrollOwnerSelector)
    const frames: Array<{ label: string | null; opacity: number; scrollTop: number }> = []
    const started = performance.now()
    const sample = () => {
      if (!currentPanel || !currentScrollOwner) {
        resolve(frames)
        return
      }
      frames.push({
        label: currentPanel.getAttribute('data-tab')
          ?? currentPanel.getAttribute('aria-labelledby')
          ?? currentPanel.getAttribute('aria-label'),
        opacity: Number.parseFloat(getComputedStyle(currentPanel).opacity),
        scrollTop: currentScrollOwner.scrollTop,
      })
      if (performance.now() - started < 360) requestAnimationFrame(sample)
      else resolve(frames)
    }
    requestAnimationFrame(sample)
    ;(tab as HTMLElement).click()
  }), { panelSelector, scrollOwnerSelector })

  const outgoingSamples = samples.filter((sample) => sample.label === outgoingLabel)
  if (requireOutgoingFrame) expect(outgoingSamples.length).toBeGreaterThan(0)
  expect(outgoingSamples.every((sample) => Math.abs(sample.scrollTop - preClickScrollTop) <= 1)).toBe(true)
  const visibleIncomingSamples = samples.filter((sample) => sample.label !== outgoingLabel && sample.opacity > 0.01)
  expect(visibleIncomingSamples.length).toBeGreaterThan(0)
  expect(visibleIncomingSamples.every((sample) => Math.abs(sample.scrollTop) <= 1)).toBe(true)
  await expect.poll(() => scrollOwner.evaluate((element) => element.scrollTop)).toBe(0)
}

async function expectScrollSafe(dialog: Locator) {
  const violations = await dialog.evaluate((element) => {
    const regions = [
      element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]'),
      ...element.querySelectorAll<HTMLElement>('[data-scroll-region]'),
    ].filter((region): region is HTMLElement => Boolean(region && region.clientHeight > 0))

    return regions.flatMap((region) => {
      const overflow = getComputedStyle(region).overflowY
      const clipped = region.scrollHeight > region.clientHeight + 1
        && overflow !== 'auto'
        && overflow !== 'scroll'
      return clipped
        ? [{
            clientHeight: region.clientHeight,
            name: region.dataset.scrollRegion ?? 'modal-body',
            overflow,
            scrollHeight: region.scrollHeight,
          }]
        : []
    })
  })
  expect(violations).toEqual([])
}

async function openMainFloorVacuum(page: Page) {
  await page.goto('/index.html?path=vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function openMusicRoomVacuum(page: Page) {
  await page.goto('/index.html?path=vacuums')
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
  await expect(dialog).toBeVisible()
  return dialog
}

async function openMusicRoomHueSync(page: Page) {
  await page.goto('/index.html?path=music-room')
  await page.getByRole('button', { name: /^Music Room Remote / }).click()
  const dialog = page.getByRole('dialog', { name: 'Music Room Remote' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Hue Sync' }).click()
  await expect(dialog.locator('[data-hue-sync-tab="true"]')).toBeVisible()
  return dialog
}

async function expectHueSyncReachable(dialog: Locator) {
  await expect(dialog.getByRole('tab', { name: 'Hue Sync' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('switch', { name: /^Sync Box Power / })).toBeAttached()
  await expect(dialog.getByRole('switch', { name: /^Light Sync / })).toBeAttached()
  await expect(dialog.getByRole('button', { name: 'Music' })).toBeAttached()
  await expect(dialog.getByRole('button', { name: 'High' })).toBeAttached()
  await expect(dialog.getByRole('slider', { name: 'Brightness' })).toBeAttached()
  const terminalInput = dialog.getByRole('button', { name: /^HDMI 4 / })
  await terminalInput.scrollIntoViewIfNeeded()
  await expect(terminalInput).toBeVisible()
  await expect(terminalInput).toBeDisabled()
  await expect(terminalInput).toHaveAttribute('data-icon', 'mdi:television-off')
  await expect(terminalInput.locator('..')).toHaveCSS('opacity', '0.48')
  await expect(dialog.getByRole('button', { name: /^HDMI 2 / })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: /^HDMI 2 / })).toHaveAttribute('data-icon', 'mdi:television')
  await expect(dialog.getByRole('button', { name: /^HDMI 2 / }).locator('..')).toHaveCSS('opacity', '1')
  const [dialogBox, terminalInputBox, navBox] = await Promise.all([
    dialog.boundingBox(),
    terminalInput.boundingBox(),
    dialog.locator('[data-modal-tab-nav="true"]').boundingBox(),
  ])
  expect(terminalInputBox?.x ?? -1).toBeGreaterThanOrEqual((dialogBox?.x ?? 0) - 1)
  expect((terminalInputBox?.x ?? 0) + (terminalInputBox?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1)
  expect((terminalInputBox?.y ?? 0) + (terminalInputBox?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual((navBox?.y ?? ((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0))) + 1)
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
}

test('Hue Sync tab stays reachable across the canonical viewport and resize matrix', async ({ page }) => {
  test.setTimeout(180_000)

  for (const viewport of HUE_SYNC_VIEWPORTS) {
    await page.setViewportSize(viewport)
    const dialog = await openMusicRoomHueSync(page)
    await expectHueSyncReachable(dialog)
    await closeModal(dialog)
  }

  for (const sequence of HUE_SYNC_RESIZE_SEQUENCES) {
    await page.setViewportSize(sequence[0])
    const dialog = await openMusicRoomHueSync(page)
    for (const viewport of sequence) {
      await page.setViewportSize(viewport)
      await expectHueSyncReachable(dialog)
    }
    await closeModal(dialog)
  }

})

async function expectShortLandscapeFluidGrid(dialog: Locator) {
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
  await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
  await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
  const grid = dialog.locator('[style*="--modal-square-cols"]').first()
  await expect(grid).toBeVisible()

  const gridMetrics = await grid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect()
    const gridStyle = getComputedStyle(element)
    const usableWidth = gridRect.width - Number.parseFloat(gridStyle.paddingLeft) - Number.parseFloat(gridStyle.paddingRight)
    const capacity = Math.max(1, Math.floor((usableWidth + 10) / 142))
    const trackWidth = (usableWidth - (capacity - 1) * 10) / capacity
    const items = Array.from(element.children)
      .map((child) => child.querySelector<HTMLElement>('button, article') ?? (child instanceof HTMLElement ? child : null))
      .filter((child): child is HTMLElement => Boolean(child))
    const rects = items.map((item) => item.getBoundingClientRect())
    const rows = new Map<number, DOMRect[]>()
    for (const rect of rects) {
      const key = Math.round(rect.top)
      rows.set(key, [...(rows.get(key) ?? []), rect])
    }
    return {
      trackWidth: Math.round(trackWidth),
      everyTrackFills: rects.every((rect) => Math.abs(rect.width - trackWidth) <= 1 && Math.abs(rect.height - trackWidth) <= 1),
      columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
      firstHeight: Math.round(rects[0]?.height ?? 0),
      firstWidth: Math.round(rects[0]?.width ?? 0),
      maximumRowStartDelta: Math.max(0, ...[...rows.values()].map((row) => {
        const rowLeft = Math.min(...row.map((rect) => rect.left))
        return Math.abs(rowLeft - gridRect.left - Number.parseFloat(gridStyle.paddingLeft))
      })),
    }
  })
  expect(gridMetrics.columns).toBeGreaterThanOrEqual(1)
  expect(gridMetrics.firstWidth).toBeGreaterThan(0)
  expect(gridMetrics.firstHeight).toBeGreaterThan(0)
  expect(gridMetrics.firstWidth).toBe(gridMetrics.trackWidth)
  expect(gridMetrics.firstHeight).toBe(gridMetrics.trackWidth)
  expect(gridMetrics.everyTrackFills).toBe(true)
  expect(gridMetrics.maximumRowStartDelta).toBeLessThanOrEqual(1)

  const reachability = await dialog.evaluate((element) => {
    const grids = Array.from(element.querySelectorAll<HTMLElement>('[style*="--modal-square-cols"]'))
    const terminalGrid = grids.at(-1)
    const terminal = Array.from(terminalGrid?.querySelectorAll<HTMLElement>('button, article') ?? [])
      .filter((candidate) => candidate.getClientRects().length > 0)
      .at(-1)
    if (!terminal) return null

    let scrollOwner: HTMLElement | null = terminal.parentElement
    while (scrollOwner && scrollOwner !== element) {
      const style = getComputedStyle(scrollOwner)
      if (['auto', 'scroll'].includes(style.overflowY) && scrollOwner.scrollHeight > scrollOwner.clientHeight + 1) break
      scrollOwner = scrollOwner.parentElement
    }
    const modalBody = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    scrollOwner = scrollOwner && scrollOwner !== element ? scrollOwner : modalBody
    if (!scrollOwner) return null
    scrollOwner.scrollTop = scrollOwner.scrollHeight
    const ownerRect = scrollOwner.getBoundingClientRect()
    const terminalRect = terminal.getBoundingClientRect()
    return {
      ownerBottom: ownerRect.bottom,
      ownerTop: ownerRect.top,
      terminalBottom: terminalRect.bottom,
      terminalTop: terminalRect.top,
    }
  })
  expect(reachability).not.toBeNull()
  expect(reachability?.terminalTop ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual((reachability?.ownerTop ?? 0) - 1)
  expect(reachability?.terminalBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((reachability?.ownerBottom ?? 0) + 1)
}

test('media sheets choose portrait sheet, landscape dialog, or full dialog presentation', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)

    const presentation = modalSheetPresentationForViewport(viewport.width, viewport.height)
    const centered = presentation !== 'sheet'
    await expect(dialog).toHaveAttribute('data-modal-presentation', presentation)
    await expect(dialog).toHaveAttribute('data-centered-layout', centered ? 'true' : 'false')
    await expect(dialog).toHaveAttribute('data-size', 'media')
    if (centered) await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
    else await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toBeVisible()
    const precipitationTiles = dialog.locator('[data-weather-precipitation-tile="true"]')
    await expect(precipitationTiles.locator('[data-precipitation-sample]')).toHaveCount(2)
    await expect(precipitationTiles.locator('[data-precipitation-bar="true"]')).toHaveCount(6)
    await expect(precipitationTiles.locator('[data-cumulative-bar="true"]')).toHaveCount(6)
    await expect.poll(() => precipitationTiles.locator('[data-precipitation-hour-label="time"]').count()).toBeGreaterThan(1)
    const precipitationMetrics = await precipitationTiles.evaluate((tiles) => {
      const chanceTile = tiles.querySelector<HTMLElement>('[data-precipitation-sample="chance"]')
      const cumulativeTile = tiles.querySelector<HTMLElement>('[data-precipitation-sample="cumulative"]')
      const chanceLabels = Array.from(tiles.querySelectorAll<HTMLElement>('[data-precipitation-hour-label="time"]'))
      const cumulativeLabels = Array.from(tiles.querySelectorAll<HTMLElement>('[data-precipitation-hour-label="cumulative-time"]'))
      const chanceSlots = Array.from(tiles.querySelectorAll<HTMLElement>('[data-precipitation-bar-slot="true"]'))
      const cumulativeSlots = Array.from(tiles.querySelectorAll<HTMLElement>('[data-cumulative-bar-slot="true"]'))
      const chanceLines = Array.from(tiles.querySelectorAll<HTMLElement>('[data-precipitation-grid-lines="chance"] > i'))
      const cumulativeLines = Array.from(tiles.querySelectorAll<HTMLElement>('[data-precipitation-grid-lines="cumulative"] > i'))
      const aligned = (labels: HTMLElement[], slots: HTMLElement[]) => labels.every((label) => {
        const slot = slots[Number(label.dataset.index)]
        if (!slot) return false
        const labelRect = label.getBoundingClientRect()
        const slotRect = slot.getBoundingClientRect()
        return Math.abs((labelRect.left + labelRect.width / 2) - (slotRect.left + slotRect.width / 2)) <= 1
      })
      return {
        cardHeightDelta: Math.abs((chanceTile?.getBoundingClientRect().height ?? 0) - (cumulativeTile?.getBoundingClientRect().height ?? 0)),
        columns: getComputedStyle(tiles).gridTemplateColumns.split(' ').filter(Boolean).length,
        combinedAbsent: !tiles.querySelector('[data-kind="precipitation-timeline"]'),
        guideRowsAligned: chanceLines.length === 3
          && cumulativeLines.length === 3
          && chanceLines.every((line, index) => Math.abs(line.getBoundingClientRect().top - cumulativeLines[index].getBoundingClientRect().top) <= 1),
        labelsAligned: aligned(chanceLabels, chanceSlots) && aligned(cumulativeLabels, cumulativeSlots),
        labelsMatch: chanceLabels.map((label) => label.textContent).join('|') === cumulativeLabels.map((label) => label.textContent).join('|'),
        labelsUseNow: chanceLabels[0]?.textContent === 'Now' && cumulativeLabels[0]?.textContent === 'Now',
        overflow: tiles.scrollWidth > tiles.clientWidth + 1
          || [chanceTile, cumulativeTile].some((tile) => Boolean(tile && tile.scrollWidth > tile.clientWidth + 1)),
      }
    })
    expect(precipitationMetrics.columns).toBe(2)
    expect(precipitationMetrics.combinedAbsent).toBe(true)
    expect(precipitationMetrics.cardHeightDelta).toBeLessThanOrEqual(1)
    expect(precipitationMetrics.guideRowsAligned).toBe(true)
    expect(precipitationMetrics.labelsAligned).toBe(true)
    expect(precipitationMetrics.labelsMatch).toBe(true)
    expect(precipitationMetrics.labelsUseNow).toBe(true)
    expect(precipitationMetrics.overflow).toBe(false)
    const hourlyMetricTiles = dialog.locator('[data-weather-hourly-metric-tiles="true"]')
    await expect(hourlyMetricTiles.locator('[data-hourly-metric-tile]')).toHaveCount(2)
    await expect(hourlyMetricTiles.locator('[data-hourly-metric-bar="true"]')).toHaveCount(12)
    const hourlyMetricMetrics = await hourlyMetricTiles.evaluate((tiles) => {
      const humidityLabels = Array.from(tiles.querySelectorAll<HTMLElement>('[data-hourly-metric-label="humidity"]'))
      const cloudLabels = Array.from(tiles.querySelectorAll<HTMLElement>('[data-hourly-metric-label="cloud"]'))
      return {
        columns: getComputedStyle(tiles).gridTemplateColumns.split(' ').filter(Boolean).length,
        labelsMatch: humidityLabels.map((label) => label.textContent).join('|') === cloudLabels.map((label) => label.textContent).join('|'),
        usesNow: humidityLabels[0]?.textContent === 'Now' && cloudLabels[0]?.textContent === 'Now',
        overflow: tiles.scrollWidth > tiles.clientWidth + 1
          || Array.from(tiles.querySelectorAll<HTMLElement>('[data-hourly-metric-tile]')).some((tile) => tile.scrollWidth > tile.clientWidth + 1),
        tracks: tiles.querySelectorAll('[class*="metricTrack"]').length,
        columnRadii: Array.from(tiles.querySelectorAll<HTMLElement>('[data-hourly-metric-bar="true"]'))
          .map((bar) => getComputedStyle(bar).borderTopLeftRadius),
      }
    })
    expect(hourlyMetricMetrics.columns).toBe(2)
    expect(hourlyMetricMetrics.labelsMatch).toBe(true)
    expect(hourlyMetricMetrics.usesNow).toBe(true)
    expect(hourlyMetricMetrics.overflow).toBe(false)
    expect(hourlyMetricMetrics.tracks).toBe(0)
    expect(hourlyMetricMetrics.columnRadii.every((radius) => radius === '3px')).toBe(true)
    const paintedColumnGaps = await dialog.evaluate((element) => (
      Array.from(element.querySelectorAll<HTMLElement>(
        '[data-precipitation-hourly-plot="true"], [data-precipitation-cumulative-plot="true"], [data-hourly-metric-plot]',
      )).map((plot) => {
        const bars = Array.from(plot.querySelectorAll<HTMLElement>(
          '[data-precipitation-bar="true"], [data-cumulative-bar="true"], [data-hourly-metric-bar="true"]',
        ))
        const boxes = bars.map((bar) => bar.getBoundingClientRect())
        return boxes.slice(1).map((box, index) => box.left - boxes[index].right)
      })
    ))
    expect(paintedColumnGaps).toHaveLength(4)
    expect(paintedColumnGaps.every((gaps) => gaps.length === 5 && gaps.every((gap) => Math.abs(gap - 2) <= 0.05))).toBe(true)
    await expectScrollSafe(dialog)
    await closeModal(dialog)
  }
})

test('standalone precipitation tiles reflow while the weather modal stays mounted', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/index.html?path=overview')
  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  const precipitationTiles = dialog.locator('[data-weather-precipitation-tile="true"]')
  const labelCount = () => precipitationTiles.locator('[data-precipitation-hour-label="time"]').count()

  await dialog.getByRole('button', { name: 'Precipitation conditions' }).click()
  const dailyPrecipitationRails = dialog.locator('[class*="forecastPanel"] [data-weather-rail="precipitation"]')
  await expect(dailyPrecipitationRails).toHaveCount(7)
  await expect.poll(() => dailyPrecipitationRails.evaluateAll((rails) => rails.every((rail) => {
    const bounds = rail.getBoundingClientRect()
    const fill = rail.querySelector<HTMLElement>('[data-weather-rail-fill]')?.getBoundingClientRect()
    const marker = rail.querySelector<HTMLElement>('[data-weather-rail-marker]')?.getBoundingClientRect()
    return Math.abs(bounds.height - 10) <= 0.5
      && Boolean(fill && Math.abs(fill.height - 10) <= 0.5)
      && (!marker || (Math.abs(marker.height - 12) <= 0.5 && Math.abs(marker.width - 12) <= 0.5))
  }))).toBe(true)

  await expect.poll(labelCount).toBeGreaterThan(1)
  const mobileCount = await labelCount()
  await page.setViewportSize({ height: 1180, width: 820 })
  await expect.poll(labelCount).toBe(6)
  await page.setViewportSize({ height: 900, width: 1440 })
  await expect.poll(labelCount).toBe(6)
  await page.setViewportSize({ height: 852, width: 393 })
  await expect.poll(labelCount).toBe(mobileCount)
  await expect(precipitationTiles.locator('[data-precipitation-sample]')).toHaveCount(2)
  await expect(dialog).toBeVisible()
})

test('weather highlight values and visuals align across the viewport matrix', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Visualization Lab/i })).toHaveCount(0)
    const tiles = dialog.locator('[data-kind="feels"], [data-kind="uv"], [data-kind="sun"], [data-kind="visibility"]')
    await expect(tiles).toHaveCount(4)

    const metrics = await tiles.evaluateAll((elements) => elements.map((element) => {
      const tile = element.getBoundingClientRect()
      const value = element.querySelector<HTMLElement>('[data-highlight-value]')?.getBoundingClientRect()
      const visual = element.querySelector<HTMLElement>('[data-highlight-visual]')?.getBoundingClientRect()
      const visualContent = element.querySelector<HTMLElement>('[data-highlight-visual] > *')?.getBoundingClientRect()
      const sunArc = element.querySelector<SVGPathElement>('[class*="sunArcPath"]')?.getBoundingClientRect()
      return {
        height: tile.height,
        paintedCenter: sunArc
          ? sunArc.top + sunArc.height / 2 - tile.top
          : visualContent
            ? visualContent.top + visualContent.height / 2 - tile.top
            : null,
        valueTop: value ? value.top - tile.top : null,
        visualCenter: visual ? visual.top + visual.height / 2 - tile.top : null,
      }
    }))
    const paintedCenters = metrics.map(({ paintedCenter }) => paintedCenter).filter((value): value is number => value !== null)
    const valueTops = metrics.map(({ valueTop }) => valueTop).filter((value): value is number => value !== null)
    const visualCenters = metrics.map(({ visualCenter }) => visualCenter).filter((value): value is number => value !== null)
    const heights = metrics.map(({ height }) => height)
    expect(Math.max(...paintedCenters) - Math.min(...paintedCenters)).toBeLessThanOrEqual(0.5)
    expect(Math.max(...valueTops) - Math.min(...valueTops)).toBeLessThanOrEqual(0.5)
    expect(Math.max(...visualCenters) - Math.min(...visualCenters)).toBeLessThanOrEqual(0.5)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(0.5)

    const windTile = dialog.locator('[data-kind="wind"]')
    const windMetrics = await windTile.evaluate((element) => {
      const tile = element.getBoundingClientRect()
      const readout = element.querySelector<HTMLElement>('[class*="windReadout"]')?.getBoundingClientRect()
      const dial = element.querySelector<HTMLElement>('[data-wind-compass]')?.getBoundingClientRect()
      const source = element.querySelector<SVGCircleElement>('[data-wind-source-marker]')?.getBoundingClientRect()
      const destination = element.querySelector<SVGPathElement>('[data-wind-destination-arrow]')?.getBoundingClientRect()
      const vector = element.querySelector<SVGGElement>('[data-wind-vector]')?.getBBox()
      const insideDial = (rect: DOMRect | undefined) => Boolean(dial && rect
        && rect.left >= dial.left - 1
        && rect.right <= dial.right + 1
        && rect.top >= dial.top - 1
        && rect.bottom <= dial.bottom + 1)
      return {
        destinationInside: insideDial(destination),
        dialCenter: dial ? dial.top + dial.height / 2 - tile.top : 0,
        dialHeight: dial?.height ?? 0,
        dialWidth: dial?.width ?? 0,
        height: tile.height,
        noOverlap: Boolean(readout && dial && readout.right <= dial.left),
        overflow: element.scrollWidth > element.clientWidth + 1,
        readoutCenter: readout ? readout.top + readout.height / 2 - tile.top : 0,
        ringCount: element.querySelectorAll('[class*="windCompassRing"]').length,
        sourceInside: insideDial(source),
        tickCount: element.querySelectorAll('[class*="windCompassTick"]').length,
        vectorSpan: vector ? Math.max(vector.width, vector.height) : 0,
      }
    })
    expect(windMetrics).toMatchObject({
      destinationInside: true,
      noOverlap: true,
      overflow: false,
      ringCount: 0,
      sourceInside: true,
      tickCount: 47,
    })
    expect(Math.abs(windMetrics.dialCenter - windMetrics.readoutCenter)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(windMetrics.dialHeight - 102)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(windMetrics.dialWidth - 102)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(windMetrics.height - 158)).toBeLessThanOrEqual(0.5)
    expect(windMetrics.vectorSpan).toBeLessThanOrEqual(53)
    await closeModal(dialog)
  }
})

test('phone landscape uses one outer frame with size-appropriate centered content measures', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ height: 393, width: 852 })
  const insets = { bottom: 21, left: 59, right: 44, top: 0 }
  const cases = [
    {
      expectedMeasure: 468,
      expectedTier: 'compact',
      open: async () => {
        await page.goto('/index.html?path=master-bedroom')
        await setSafeAreaInsets(page, insets)
        await page.getByRole('button', { name: /^Climate /i }).click()
        return page.getByRole('dialog', { name: 'Master Bedroom Climate' })
      },
    },
    {
      expectedMeasure: 528,
      expectedTier: 'fields',
      footer: true,
      open: async () => {
        await page.goto('/index.html?path=to-do')
        await setSafeAreaInsets(page, insets)
        await page.getByRole('button', { name: 'Add Task' }).click()
        return page.getByRole('dialog', { name: 'Add Task' })
      },
    },
    {
      expectedMeasure: 688,
      expectedTier: 'wide',
      open: async () => {
        await page.goto('/index.html?path=overview&user=stephen#daily-report')
        await setSafeAreaInsets(page, insets)
        return page.getByRole('dialog', { name: "Stephen's Summary" })
      },
    },
    {
      expectedMeasure: 691,
      expectedTier: 'wide',
      open: async () => {
        await page.goto('/index.html?path=master-bedroom')
        await setSafeAreaInsets(page, insets)
        await page.getByRole('button', { name: /Humidifier .*46%/i }).click()
        return page.getByRole('dialog')
      },
    },
    {
      expectedMeasure: 468,
      expectedTier: 'compact',
      open: async () => {
        await page.goto('/index.html?path=custom-lights')
        await setSafeAreaInsets(page, insets)
        await page.evaluate(() => {
          window.__mockHass?.setEntityState('input_boolean.manually_control_front_yard_lights', 'on')
          window.__mockHass?.setEntityState('input_select.front_yard_custom_lights', 'Custom')
        })
        await page.getByRole('button', { name: 'Select lighting mode' }).click()
        return page.getByRole('dialog', { name: 'Lighting Mode' })
      },
    },
  ]

  for (const modalCase of cases) {
    const dialog = await modalCase.open()
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    await expect(dialog).toHaveAttribute('data-modal-body-tier', modalCase.expectedTier)
    const metrics = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const bodyMeasure = element.querySelector<HTMLElement>('[data-modal-content-measure="true"]')
      const footerMeasure = element.querySelector<HTMLElement>('[data-modal-sheet-footer="true"] > div')
      const bodyRect = bodyMeasure?.getBoundingClientRect()
      const footerRect = footerMeasure?.getBoundingClientRect()
      return {
        bodyCenter: bodyRect ? (bodyRect.left + bodyRect.right) / 2 : null,
        footerCenter: footerRect ? (footerRect.left + footerRect.right) / 2 : null,
        footerWidth: footerRect?.width ?? null,
        height: rect.height,
        left: rect.left,
        measureWidth: bodyRect?.width ?? 0,
        top: rect.top,
        width: rect.width,
      }
    })
    expect(Math.abs(metrics.left - 71)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.top - 8)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.width - 725)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.height - 356)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.measureWidth - modalCase.expectedMeasure)).toBeLessThanOrEqual(1)
    if (modalCase.footer) {
      expect(Math.abs((metrics.footerWidth ?? 0) - modalCase.expectedMeasure)).toBeLessThanOrEqual(1)
      expect(Math.abs((metrics.footerCenter ?? 0) - (metrics.bodyCenter ?? 0))).toBeLessThanOrEqual(1)
    }
    await closeModal(dialog)
  }
})

test('Quick Links fills text-aware rows and keeps its conditional destination reachable', async ({ page }) => {
  const profiles = [
    { columns: 2, height: 852, insets: { bottom: 34, left: 0, right: 0, top: 59 }, width: 393 },
    { columns: 3, height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 568 },
    { columns: 3, height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 667 },
    { columns: 4, height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, width: 852 },
    { columns: 4, height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, width: 852 },
    { columns: 4, height: 1180, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 820 },
    { columns: 6, height: 900, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 1440 },
  ]

  for (const profile of profiles) {
    await page.setViewportSize(profile)
    await page.goto('/index.html?path=overview')
    await setSafeAreaInsets(page, profile.insets)
    await page.evaluate((entityId) => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      mock.setEntityState(entityId, 'on')
    }, SHOW_OUTDOOR_FAUCETS_ENTITY_ID)
    await openQuickLinksTab(page)

    const dialog = page.getByRole('dialog', { name: 'Quick Links' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute(
      'data-modal-presentation',
      modalSheetPresentationForViewport(profile.width, profile.height),
    )
    const grid = dialog.getByRole('group', { name: 'Quick Links', exact: true })
    const portrait = profile.width === 393
    await expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(grid).toHaveAttribute('data-dynamic-grid-fill-rows', portrait ? 'true' : 'except-last')
    await expect.poll(async () => (await quickLinksLayout(dialog)).columns).toBe(profile.columns)
    await expect.poll(async () => (await quickLinksLayout(dialog)).cards.every((card) => card.copyFits)).toBe(true)
    const metrics = await quickLinksLayout(dialog)
    expect(['auto', 'scroll']).toContain(metrics.bodyOverflow)
    expect(metrics.cards).toHaveLength(7)
    expect(Math.abs(metrics.gridWidth - metrics.measureWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.gridTop - metrics.bodyTop)).toBeLessThanOrEqual(1)
    const rows = new Map<number, typeof metrics.cards>()
    for (const card of metrics.cards) {
      expect(card.insideBody).toBe(true)
      expect(card.height).toBeCloseTo(portrait ? 120 : 88, 2)
      rows.set(card.y, [...(rows.get(card.y) ?? []), card])
    }
    const rowEntries = [...rows.values()]
    for (const [index, row] of rowEntries.entries()) {
      expect(Math.abs(row[0].x)).toBeLessThanOrEqual(1)
      if (portrait || index < rowEntries.length - 1) expect(row.reduce((sum, card) => sum + card.span, 0)).toBe(profile.columns)
    }
    const terminal = grid.getByRole('button', { name: 'Sprinklers', exact: true })
    await terminal.scrollIntoViewIfNeeded()
    await expect(terminal).toBeInViewport()
    await closeModal(dialog)
  }
})

test('Daily Summary uses compact type and responsive chore and expired-food grids', async ({ page }) => {
  test.setTimeout(120_000)
  const profiles = [
    { columns: 1, height: 852, insets: { bottom: 34, left: 0, right: 0, top: 59 }, tier: 'compact', width: 393 },
    { columns: 1, height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tier: 'fields', width: 568 },
    { columns: 1, height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tier: 'fields', width: 667 },
    { columns: 2, height: 343, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tier: 'standard', width: 734 },
    { columns: 2, height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, tier: 'wide', width: 852 },
    { columns: 2, height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, tier: 'wide', width: 852 },
    { columns: 2, height: 1180, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tier: 'wide', width: 820 },
    { columns: 2, height: 900, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tier: 'wide', width: 1440 },
  ] as const

  for (const profile of profiles) {
    await page.setViewportSize(profile)
    await page.goto('/index.html?path=overview&user=stephen')
    await setSafeAreaInsets(page, profile.insets)
    await page.evaluate(() => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      const entityId = 'todo.stephen_s_past_due_with_unassigned'
      const due = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      mock.setTodoItems(entityId, [
        { due, status: 'needs_action', summary: 'First summary chore', uid: '401--summary-one' },
        { due, status: 'needs_action', summary: 'Replace Hallway and Entryway Presence Sensor Batteries', uid: '402--summary-two' },
        { due, status: 'needs_action', summary: 'Third summary chore', uid: '403--summary-three' },
        { due, status: 'needs_action', summary: 'Fourth summary chore', uid: '404--summary-four' },
      ])
      mock.setEntityState(entityId, '4')
      const past = new Date()
      past.setDate(past.getDate() - 5)
      const expiryDate = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
      mock.setEntityAttribute('sensor.evershelf_expired_items', 'expired_list', [
        { expiry_date: expiryDate, inventory_id: 901, name: 'Milk' },
        { expiry_date: expiryDate, inventory_id: 902, name: 'Almond Flour' },
      ])
      mock.setEntityState('sensor.evershelf_expired_items', '2')
      window.location.hash = '#daily-report'
    })

    const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-modal-body-tier', profile.tier)
    await expect(dialog).toHaveAttribute(
      'data-modal-presentation',
      modalSheetPresentationForViewport(profile.width, profile.height),
    )
    await expect(dialog.locator('h2').first()).toHaveCSS('font-size', '16px')
    await expect(dialog.locator('[data-modal-sheet-body-header="true"] h2')).toHaveCSS('font-size', '12.8px')

    const todoList = dialog.getByLabel('Overdue Chores todo list')
    await expect(todoList).toHaveAttribute('data-layout', 'responsive-grid')
    await expect(todoList).toHaveAttribute('data-row-variant', 'summary')
    await expect(todoList.locator('li')).toHaveCount(4)
    const todoMetrics = await todoList.evaluate((element) => {
      const rows = Array.from(element.querySelectorAll<HTMLElement>('li'))
      const rects = rows.map((row) => row.getBoundingClientRect())
      const titles = rows.map((row) => row.querySelector<HTMLElement>('strong')).filter((title): title is HTMLElement => Boolean(title))
      const subtitles = rows.map((row) => row.querySelector<HTMLElement>('small')).filter((subtitle): subtitle is HTMLElement => Boolean(subtitle))
      const controls = Array.from(element.querySelectorAll<HTMLElement>('button[aria-label^="Edit "]'))
      return {
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
        controlsAreTouchSized: controls.every((control) => {
          const rect = control.getBoundingClientRect()
          return rect.width >= 44 && rect.height >= 44
        }),
        copyFits: [...titles, ...subtitles].every((copy) =>
          copy.scrollWidth <= copy.clientWidth + 1
          && copy.scrollHeight <= copy.clientHeight + 1),
        rowWidths: rects.map((rect) => rect.width),
        subtitleFonts: [...new Set(subtitles.map((subtitle) => getComputedStyle(subtitle).fontSize))],
        titleFonts: [...new Set(titles.map((title) => getComputedStyle(title).fontSize))],
      }
    })
    expect(todoMetrics.columns).toBe(profile.columns)
    expect(todoMetrics.controlsAreTouchSized).toBe(true)
    expect(todoMetrics.copyFits).toBe(true)
    expect(todoMetrics.subtitleFonts).toEqual(['11.2px'])
    expect(todoMetrics.titleFonts).toEqual(['13.12px'])
    expect(Math.min(...todoMetrics.rowWidths)).toBeGreaterThan(0)

    await dialog.getByRole('tab', { name: /^Expired Food/ }).click()
    const inventoryList = dialog.getByLabel('Expired Food inventory list')
    await expect(inventoryList).toHaveAttribute('data-layout', 'responsive-grid')
    await expect(inventoryList).toHaveAttribute('data-row-variant', 'summary')
    const expiredRows = inventoryList.locator('[data-expiry-tone="expired"]')
    await expect(expiredRows).toHaveCount(2)
    const expiredMetrics = await expiredRows.evaluateAll((rows) => {
      const rects = rows.map((row) => row.getBoundingClientRect())
      const titles = rows.map((row) => row.querySelector<HTMLElement>('strong')).filter((title): title is HTMLElement => Boolean(title))
      const subtitles = rows.map((row) => row.querySelector<HTMLElement>('small')).filter((subtitle): subtitle is HTMLElement => Boolean(subtitle))
      const controls = rows.flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>('button')))
      return {
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
        controlsAreTouchSized: controls.every((control) => {
          const rect = control.getBoundingClientRect()
          return rect.width >= 44 && rect.height >= 44
        }),
        rowsStayInsideViewport: rects.every((rect) => rect.left >= -1 && rect.right <= window.innerWidth + 1),
        subtitleFonts: [...new Set(subtitles.map((subtitle) => getComputedStyle(subtitle).fontSize))],
        titleFonts: [...new Set(titles.map((title) => getComputedStyle(title).fontSize))],
      }
    })
    expect(expiredMetrics.columns).toBe(profile.columns)
    expect(expiredMetrics.controlsAreTouchSized).toBe(true)
    expect(expiredMetrics.rowsStayInsideViewport).toBe(true)
    expect(expiredMetrics.subtitleFonts).toEqual(['11.2px'])
    expect(expiredMetrics.titleFonts).toEqual(['13.12px'])

    if (profile.width >= 820 && profile.height >= 560) {
      expect(Math.round((await dialog.boundingBox())?.height ?? 0)).toBe(760)
    }
    await closeModal(dialog)
  }
})

test('Occupancy room tiles preserve portrait cards and centered square presentations', async ({ page }) => {
  test.setTimeout(120_000)
  const occupancyEntityIds = [...new Set(OCCUPANCY_GROUPS.flatMap((group) => group.items.map((item) => item.entityId)))]
  const activeEntityId = OCCUPANCY_GROUPS[0].items[0].entityId
  const viewports = [
    { centeredPresentation: false, height: 852, insets: { bottom: 34, left: 0, right: 0, top: 59 }, tileHeight: PORTRAIT_TILE_HEIGHT, tileWidth: PORTRAIT_TILE_WIDTH, width: 393 },
    { centeredPresentation: true, height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, tileHeight: 158.25, tileWidth: 158.25, width: 852 },
    { centeredPresentation: true, height: 1180, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tileHeight: DIALOG_SQUARE_TILE_SIZE, tileWidth: DIALOG_SQUARE_TILE_SIZE, width: 820 },
    { centeredPresentation: true, height: 900, insets: { bottom: 0, left: 0, right: 0, top: 0 }, tileHeight: DIALOG_SQUARE_TILE_SIZE, tileWidth: DIALOG_SQUARE_TILE_SIZE, width: 1440 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview#occupancy-overview')
    await setSafeAreaInsets(page, viewport.insets)
    await page.evaluate(({ activeId, entityIds }) => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      for (const entityId of entityIds) mock.setEntityState(entityId, 'off')
      mock.setEntityState(activeId, 'on')
    }, { activeId: activeEntityId, entityIds: occupancyEntityIds })

    const dialog = page.getByRole('dialog', { name: 'Occupancy' })
    await expect(dialog).toBeVisible()
    const occupiedSection = dialog.getByRole('region', { name: 'Occupied rooms' })
    const clearSection = dialog.getByRole('region', { name: 'Clear rooms' })
    await expect(occupiedSection.getByRole('button')).toHaveCount(1)
    await expect(clearSection.getByRole('button')).toHaveCount(OCCUPANCY_GROUPS.length - 1)

    const metrics = await dialog.evaluate((element, expectedCardSize) => {
      const dialogRect = element.getBoundingClientRect()
      const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
      const bodyRect = body?.getBoundingClientRect()
      const bodyStyle = body ? getComputedStyle(body) : null
      const bodyContentWidth = body
        ? body.clientWidth - Number.parseFloat(bodyStyle?.paddingLeft ?? '0') - Number.parseFloat(bodyStyle?.paddingRight ?? '0')
        : 0
      const scrollOwner = element.querySelector<HTMLElement>('[class*="occupancyContent"]')
      const sections = Array.from(element.querySelectorAll<HTMLElement>('section[aria-label$=" rooms"]'))
      const sectionMetrics = sections.map((section) => {
        const grid = section.querySelector<HTMLElement>('[style*="--modal-square-card-size"]')
        if (!grid) return null
        const gridRect = grid.getBoundingClientRect()
        const cards = Array.from(grid.querySelectorAll<HTMLElement>(':scope > * > button, :scope > * > article'))
        const rects = cards.map((card) => card.getBoundingClientRect())
        const rows = new Map<number, DOMRect[]>()
        for (const rect of rects) {
          const key = Math.round(rect.top)
          rows.set(key, [...(rows.get(key) ?? []), rect])
        }
        return {
          cardContentFits: cards.every((card) =>
            card.scrollWidth <= card.clientWidth + 1
            && card.scrollHeight <= card.clientHeight + 1),
          cardSizesValid: rects.every((rect) =>
            Math.abs(rect.width - expectedCardSize.width) <= 1
            && Math.abs(rect.height - expectedCardSize.height) <= 1),
          gridBodyWidthDelta: bodyRect ? Math.abs(gridRect.width - bodyContentWidth) : Number.POSITIVE_INFINITY,
          gridInsideBody: Boolean(bodyRect && gridRect.left >= bodyRect.left - 1 && gridRect.right <= bodyRect.right + 1),
          maximumRowStartDelta: Math.max(0, ...[...rows.values()].map((row) => {
            const rowLeft = Math.min(...row.map((rect) => rect.left))
            return Math.abs(rowLeft - gridRect.left - Number.parseFloat(getComputedStyle(grid).paddingLeft))
          })),
          minimumDialogInset: Math.min(
            ...rects.flatMap((rect) => [
              rect.left - dialogRect.left,
              dialogRect.right - rect.right,
            ]),
          ),
        }
      }).filter((metric): metric is NonNullable<typeof metric> => metric !== null)
      return {
        scrollOwnerClientHeight: scrollOwner?.clientHeight ?? 0,
        scrollOwnerScrollHeight: scrollOwner?.scrollHeight ?? 0,
        sectionMetrics,
      }
    }, { height: viewport.tileHeight, width: viewport.tileWidth })

    expect(metrics.sectionMetrics).toHaveLength(2)
    for (const section of metrics.sectionMetrics) {
      expect(section.cardContentFits).toBe(true)
      expect(section.cardSizesValid).toBe(true)
      expect(section.gridInsideBody).toBe(true)
      if (viewport.centeredPresentation) {
        expect(section.maximumRowStartDelta).toBeLessThanOrEqual(1)
        expect(section.minimumDialogInset).toBeGreaterThanOrEqual(24)
      } else {
        expect(section.gridBodyWidthDelta).toBeLessThanOrEqual(1)
      }
    }

    const scrollOwner = dialog.locator('[class*="occupancyContent"]')
    if (metrics.scrollOwnerScrollHeight > metrics.scrollOwnerClientHeight + 1) {
      await expect.poll(() => scrollOwner.evaluate((element) => {
        element.scrollTop = element.scrollHeight
        const terminalCard = Array.from(element.querySelectorAll<HTMLElement>('section[aria-label="Clear rooms"] button')).at(-1)
        if (!terminalCard) return false
        const ownerRect = element.getBoundingClientRect()
        const terminalRect = terminalCard.getBoundingClientRect()
        return terminalRect.top >= ownerRect.top - 1 && terminalRect.bottom <= ownerRect.bottom + 1
      })).toBe(true)
      await scrollOwner.evaluate((element) => {
        element.scrollTop = 0
      })
    }

    await occupiedSection.getByRole('button', { name: /Open Living Room Occupancy/i }).click()
    await expect(dialog.getByRole('heading', { name: 'Living Room Occupancy' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Back to room occupancy' }).click()
    await expect(dialog.getByRole('region', { name: 'Occupied rooms' })).toBeVisible()
    await closeModal(dialog)
  }
})

test('compact, form, standard, and media fill the desktop body within the shared frame', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 })

  const expectFrameAndMeasure = async (dialog: Locator, measureWidth: number) => {
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      return { width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) }
    }).toEqual({ width: 1100, height: 760 })
    await expect.poll(() => dialog.locator('[data-modal-content-measure="true"]').evaluate((element) => element.getBoundingClientRect().width)).toBe(measureWidth)
  }

  await page.goto('/index.html?path=overview')
  await page.getByRole('button', { name: /Security Armed/i }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'compact')
  await expectFrameAndMeasure(dialog, 1050)
  await closeModal(dialog)

  await page.goto('/index.html?path=grocery-list')
  await page.getByRole('button', { exact: true, name: 'Add Groceries' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'form')
  await expectFrameAndMeasure(dialog, 1050)
  await closeModal(dialog)

  await page.goto('/index.html?path=sprinklers')
  await page.getByRole('button', { name: /Front Yard Auto/i }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'standard')
  await expectFrameAndMeasure(dialog, 1050)
  await expectScrollSafe(dialog)
  await closeModal(dialog)

  await page.goto('/index.html?path=overview')
  await page.getByRole('button', { name: /Open Front Door camera/i }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'media')
  await expectFrameAndMeasure(dialog, 1050)
  await closeModal(dialog)
})

test('square-grid detail sheets delegate overflow to the correct owner', async ({ page }) => {
  for (const viewport of [{ height: 393, width: 852 }, { height: 1180, width: 820 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=settings')
    await openQuickLinksTab(page)
    await page.getByRole('button', { exact: true, name: 'Rooms' }).click()
    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)

    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const grid = dialog.locator('section[aria-label="Rooms"]')
    if (viewport.height < 560) {
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
      await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
      await expect(body).toHaveCSS('overflow-y', 'auto')
    } else {
      await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
      const gridState = await grid.evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflow: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
      }))
      if (gridState.scrollHeight > gridState.clientHeight + 1) expect(gridState.overflow).toBe('auto')
    }
    await expectScrollSafe(dialog)
    await closeModal(dialog)
  }
})

test('short-landscape square-grid families fill equal tracks and reach terminal controls', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ height: 393, width: 852 })

  for (const hash of ['#lights-overview', '#climate-overview', '#occupancy-overview', '#contact-sensors-overview', '#aqi-overview']) {
    await page.goto(`/index.html?path=overview${hash}`)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)
    await expectShortLandscapeFluidGrid(dialog)
    await closeModal(dialog)
  }

  await page.goto('/index.html?path=security#contact-sensors-overview')
  let dialog = page.getByRole('dialog', { name: 'Contact Sensors' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(520)
  await expectShortLandscapeFluidGrid(dialog)
  await closeModal(dialog)

  await page.goto('/index.html?path=settings')
  await openQuickLinksTab(page)
  await page.getByRole('button', { exact: true, name: 'Rooms' }).click()
  dialog = page.getByRole('dialog', { name: 'Rooms' })
  await page.waitForTimeout(520)
  await expectShortLandscapeFluidGrid(dialog)
  await closeModal(dialog)

  for (const hash of ['#presence-based-overrides', '#presence-based-overrides-auto']) {
    await page.goto(`/index.html?path=admin${hash}`)
    dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)
    await expectShortLandscapeFluidGrid(dialog)
    await closeModal(dialog)
  }
})

test('short-landscape dialog pickers use compact fixed tracks', async ({ page }) => {
  await page.setViewportSize({ height: 393, width: 852 })
  await page.goto('/index.html?path=custom-lights')
  await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass))).toBe(true)
  await page.evaluate(() => {
    const mockHass = window.__mockHass
    if (!mockHass) throw new Error('Mock Home Assistant API is unavailable')
    mockHass.setEntityState('input_boolean.manually_control_front_yard_lights', 'on')
    mockHass.setEntityState('input_select.front_yard_custom_lights', 'Custom')
  })
  await page.getByRole('button', { name: 'Select lighting mode' }).click()
  let dialog = page.getByRole('dialog', { name: 'Lighting Mode' })
  await expect(dialog).toBeVisible()
  let options = dialog.getByRole('group', { name: 'Lighting Mode options' })
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toBe('220px 220px')
  await closeModal(dialog)

  await page.goto('/index.html?path=ecobee')
  await page.getByRole('button', { name: /Thermostat Hub Mode Off/i }).click()
  dialog = page.getByRole('dialog', { name: 'Thermostat Hub Mode' })
  await expect(dialog).toBeVisible()
  options = dialog.getByRole('group', { name: 'Thermostat Hub Mode options' })
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toBe('220px 220px')
  await closeModal(dialog)
})

test('tabbed workspaces reset the active scroll owner at mobile and short-landscape sizes', async ({ page }) => {
  for (const viewport of [{ height: 852, width: 393 }, { height: 393, width: 852 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=living-room')
    await page.getByRole('button', { name: /^Living Room Remote Off$/i }).click()
    const dialog = page.getByRole('dialog')
    const body = dialog.locator('[data-modal-sheet-body="true"]')
    await dialog.getByRole('tab', { name: 'Apps' }).click()
    await expect(dialog.getByRole('tabpanel', { name: 'Apps' })).toBeVisible()
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await dialog.getByRole('tab', { name: 'Controls' }).click()
    await expect(dialog.getByRole('tabpanel', { name: 'Controls' })).toBeVisible()
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0)
    await closeModal(dialog)
  }
})

test('animated modal tabs preserve the outgoing scroll position until content swaps', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ height: 852, width: 393 })

  await page.goto('/')
  await page.evaluate(() => {
    window.history.replaceState(null, '', '/at-a-glance/food')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Food & Recipes' })).toBeVisible({ timeout: 12_000 })
  await page.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[role="tabpanel"]',
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Ingredients',
  })
  await closeModal(dialog)

  await page.goto('/index.html?path=living-room')
  await page.getByRole('button', { name: /^Living Room Remote Off$/i }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Apps' }).click()
  await expect(dialog.locator('[data-scroll-region="media-remote-panel"]')).toHaveAttribute('data-tab', 'apps')
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[data-scroll-region="media-remote-panel"]',
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Controls',
  })
  await closeModal(dialog)

  await page.goto('/index.html?path=master-bedroom')
  await page.getByRole('button', { name: /Humidifier .*46%/i }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Info' }).click()
  await expect(dialog.locator('[data-scroll-region="humidifier-panel"]')).toHaveAttribute('data-tab', 'info')
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[data-scroll-region="humidifier-panel"]',
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Schedules',
  })
  await closeModal(dialog)

  dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('tab', { name: 'Info' }).click()
  await expect(dialog.locator('[data-scroll-region="vacuum-panel"]')).toHaveAttribute('data-tab', 'info')
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[data-scroll-region="vacuum-panel"]',
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Controls',
  })
  await closeModal(dialog)

  await page.goto('/at-a-glance/ecobee#thermostat-automation')
  dialog = page.getByRole('dialog', { name: 'Thermostat · Advanced Controls' })
  await expect(dialog.getByRole('tabpanel', { name: 'Automation' })).toBeVisible()
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[role="tabpanel"]',
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Rooms',
  })
  await closeModal(dialog)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('tab', { name: 'Info' }).click()
  await expect(dialog.locator('[data-scroll-region="vacuum-panel"]')).toHaveAttribute('data-tab', 'info')
  await expectOutgoingTabScrollPreserved({
    dialog,
    panelSelector: '[data-scroll-region="vacuum-panel"]',
    requireOutgoingFrame: false,
    scrollOwnerSelector: '[data-modal-sheet-body="true"]',
    targetTab: 'Controls',
  })
  await closeModal(dialog)
})

test('humidifier centered panes reset to the top on tab changes', async ({ page }) => {
  for (const viewport of [{ height: 820, width: 1180 }, { height: 1080, width: 1920 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=master-bedroom')
    await page.getByRole('button', { name: /Humidifier .*46%/i }).click()
    const dialog = page.getByRole('dialog')
    const pane = dialog.locator('[data-scroll-region="humidifier-panel"]')
    await dialog.getByRole('tab', { name: 'Info' }).click()
    await expect(dialog.getByRole('tabpanel', { name: 'Info' })).toBeVisible()
    await pane.evaluate((element) => {
      element.style.height = '120px'
      element.style.maxHeight = '120px'
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await dialog.getByRole('tab', { name: 'Controls' }).click()
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(0)
    await pane.evaluate((element) => {
      element.style.removeProperty('height')
      element.style.removeProperty('max-height')
    })
    await closeModal(dialog)
  }
})

test('vacuum workspace stays fixed across tabs and keeps each region reachable', async ({ page }) => {
  await page.setViewportSize({ height: 1080, width: 1920 })
  const dialog = await openMainFloorVacuum(page)
  const heights: number[] = []

  for (const tabName of ['Controls', 'Zones', 'Auto-Clean', 'Actions', 'Info']) {
    await dialog.getByRole('tab', { name: tabName }).click()
    await page.waitForTimeout(220)
    heights.push(Math.round((await dialog.boundingBox())?.height ?? 0))
    await expectScrollSafe(dialog)

    const body = dialog.locator('[data-modal-sheet-body="true"]')
    await expect(body).toHaveCSS('overflow-y', 'hidden')
    const pane = dialog.locator('[data-scroll-region="vacuum-panel"]')
    const paneState = await pane.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflow: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }))
    if (paneState.scrollHeight > paneState.clientHeight + 1) expect(paneState.overflow).toBe('auto')
  }

  expect(new Set(heights)).toEqual(new Set([760]))
  const tabListBox = await dialog.getByRole('tablist', { name: 'Main Floor modal sections' }).boundingBox()
  expect(Math.round(tabListBox?.width ?? 0)).toBeLessThanOrEqual(680)
})

test('music room focused map omits scope controls across the canonical viewport matrix', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const dialog = await openMusicRoomVacuum(page)
    const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })

    await expect(map).toHaveAttribute('data-map-scope', 'focused')
    await expect(dialog.getByRole('button', { name: 'Full Map' })).toHaveCount(0)
    await expect(dialog.getByText('Reachable Area Only')).toHaveCount(0)
    const geometry = await map.evaluate((element) => {
      const frame = element.getBoundingClientRect()
      const dialog = element.closest<HTMLElement>('[role="dialog"]')?.getBoundingClientRect()
      return {
        contained: Boolean(dialog)
          && frame.left >= dialog!.left
          && frame.right <= dialog!.right
          && frame.top >= dialog!.top
          && frame.bottom <= dialog!.bottom,
        frameHeight: frame.height,
        frameWidth: frame.width,
      }
    })
    expect(geometry.contained).toBe(true)
    expect(geometry.frameHeight).toBeGreaterThan(0)
    expect(geometry.frameWidth).toBeGreaterThan(0)

    await closeModal(dialog)
  }
})

test('music room focused map survives mounted viewport transitions', async ({ page }) => {
  const sequences = [
    [
      { height: 852, width: 393 },
      { height: 900, width: 1440 },
      { height: 852, width: 393 },
    ],
    [
      { height: 900, width: 1440 },
      { height: 852, width: 393 },
      { height: 900, width: 1440 },
    ],
    [
      { height: 1180, width: 820 },
      { height: 820, width: 1180 },
      { height: 1180, width: 820 },
    ],
  ] as const

  for (const sequence of sequences) {
    await page.setViewportSize(sequence[0])
    const dialog = await openMusicRoomVacuum(page)
    const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })

    for (const viewport of sequence) {
      await page.setViewportSize(viewport)
      await expect(map).toHaveAttribute('data-map-scope', 'focused')
      await expect(dialog.getByRole('button', { name: 'Full Map' })).toHaveCount(0)
      await expect(dialog.getByText('Reachable Area Only')).toHaveCount(0)
    }

    await closeModal(dialog)
  }
})

test('vacuum short landscape uses one body scroller with a fixed navigation footer', async ({ page }) => {
  await page.setViewportSize({ height: 393, width: 852 })
  const dialog = await openMainFloorVacuum(page)
  await page.waitForTimeout(520)

  await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
  await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
  await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  await expect(body).toHaveCSS('overflow-y', 'auto')
  await expect.poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await expectScrollSafe(dialog)

  const navigation = dialog.locator('[data-modal-sheet-navigation="true"]')
  const before = await navigation.boundingBox()
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const after = await navigation.boundingBox()
  expect(Math.round(after?.y ?? 0)).toBe(Math.round(before?.y ?? 0))
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeLessThanOrEqual(394)
})

test('other workspace modals use body scrolling when short and named pane scrolling when centered', async ({ page }) => {
  const cases = [
    {
      open: async () => {
        await page.goto('/index.html?path=living-room')
        await page.getByRole('button', { name: /Living Room Remote Off/i }).click()
      },
      pane: 'media-remote-panel',
    },
    {
      open: async () => {
        await page.goto('/index.html?path=master-bedroom')
        await page.getByRole('button', { name: /Humidifier/i }).click()
      },
      pane: 'humidifier-panel',
    },
    {
      open: async () => {
        await page.goto('/index.html?path=master-bedroom')
        await page.getByRole('button', { name: /Stephen's Bed/i }).click()
      },
      pane: 'eight-sleep-panel',
    },
  ]

  for (const viewport of [{ height: 393, width: 852 }, { height: 1080, width: 1920 }]) {
    await page.setViewportSize(viewport)
    for (const modalCase of cases) {
      await modalCase.open()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(520)
      await expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
      const body = dialog.locator('[data-modal-sheet-body="true"]')
      await expect(body).toHaveCSS('overflow-y', viewport.height < 560 ? 'auto' : 'hidden')
      await expect(dialog.locator(`[data-scroll-region="${modalCase.pane}"]`)).toBeAttached()
      await expectScrollSafe(dialog)
      await closeModal(dialog)
    }
  }
})

test('an open workspace modal survives both resize directions', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  let dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('tab', { name: 'Info' }).click()

  await page.setViewportSize({ height: 1080, width: 1920 })
  await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
  await expect(dialog.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true')
  await expectScrollSafe(dialog)

  await page.setViewportSize({ height: 852, width: 393 })
  await expect(dialog).toHaveAttribute('data-centered-layout', 'false')
  await expect(dialog.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true')
  await closeModal(dialog)

  await page.setViewportSize({ height: 1080, width: 1920 })
  dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('tab', { name: 'Zones' }).click()
  await page.setViewportSize({ height: 852, width: 393 })
  await expect(dialog).toHaveAttribute('data-centered-layout', 'false')
  await expect(dialog.getByRole('tab', { name: 'Zones' })).toHaveAttribute('aria-selected', 'true')
  await page.setViewportSize({ height: 1080, width: 1920 })
  await expect(dialog).toHaveAttribute('data-centered-layout', 'true')
  await expectScrollSafe(dialog)
})
