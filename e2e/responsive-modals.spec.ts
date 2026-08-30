import { expect, test, type Locator, type Page } from '@playwright/test'

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
  { height: 741, width: 1152 },
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

async function expectShortLandscapeFixedGrid(dialog: Locator) {
  await expect(dialog).toHaveAttribute('data-centered-layout', 'false')
  const grid = dialog.locator('[style*="--modal-square-cols"]').first()
  await expect(grid).toBeVisible()

  const gridMetrics = await grid.evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns
      .split(' ')
      .map((track) => Number.parseFloat(track))
      .filter(Number.isFinite)
    const firstButton = element.querySelector<HTMLElement>('button, article')
    const firstRect = firstButton?.getBoundingClientRect()
    return {
      firstHeight: Math.round(firstRect?.height ?? 0),
      firstWidth: Math.round(firstRect?.width ?? 0),
      tracks,
    }
  })
  expect(gridMetrics.tracks.length).toBeGreaterThanOrEqual(2)
  expect(Math.max(...gridMetrics.tracks)).toBeLessThanOrEqual(170)
  expect(gridMetrics.firstWidth).toBeGreaterThan(0)
  expect(gridMetrics.firstHeight).toBeGreaterThan(0)
  expect(gridMetrics.firstWidth).toBeLessThanOrEqual(170)
  expect(gridMetrics.firstHeight).toBeLessThanOrEqual(170)

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

test('media sheets choose compact or centered presentation across the viewport matrix', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weather' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)

    const centered = viewport.width >= 760 && viewport.height >= 560
    await expect(dialog).toHaveAttribute('data-centered-layout', centered ? 'true' : 'false')
    await expect(dialog).toHaveAttribute('data-size', 'media')
    if (!centered) await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toBeVisible()
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
        dialHeight: dial?.height ?? 0,
        dialWidth: dial?.width ?? 0,
        height: tile.height,
        noOverlap: Boolean(readout && dial && readout.right <= dial.left),
        overflow: element.scrollWidth > element.clientWidth + 1,
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
    expect(Math.abs(windMetrics.dialHeight - 112)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(windMetrics.dialWidth - 112)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(windMetrics.height - 158)).toBeLessThanOrEqual(0.5)
    expect(windMetrics.vectorSpan).toBeLessThanOrEqual(53)
    await closeModal(dialog)
  }
})

test('compact, form, standard, and media intents avoid viewport-wide desktop sheets', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 })

  await page.goto('/index.html?path=overview')
  await page.getByRole('button', { name: /Security Armed/i }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'compact')
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(500)
  await closeModal(dialog)

  await page.goto('/index.html?path=grocery-list')
  await page.getByRole('button', { exact: true, name: 'Add Groceries' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'form')
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(560)
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.height ?? 0)).toBeLessThan(400)
  await closeModal(dialog)

  await page.goto('/index.html?path=sprinklers')
  await page.getByRole('button', { name: /Front Yard Auto/i }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'standard')
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(720)
  await expectScrollSafe(dialog)
  await closeModal(dialog)

  await page.goto('/index.html?path=overview')
  await page.getByRole('button', { name: /Open Front Door camera/i }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-size', 'media')
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(1100)
  await closeModal(dialog)
})

test('square-grid detail sheets delegate overflow to the correct owner', async ({ page }) => {
  for (const viewport of [{ height: 393, width: 852 }, { height: 1180, width: 820 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=settings')
    await page.getByRole('button', { name: 'Quick Links' }).click()
    await page.getByRole('button', { exact: true, name: 'Rooms' }).click()
    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)

    const body = dialog.locator('[data-modal-sheet-body="true"]')
    const grid = dialog.locator('section[aria-label="Rooms"]')
    if (viewport.height < 560) {
      await expect(dialog).toHaveAttribute('data-centered-layout', 'false')
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

test('short-landscape square-grid families keep fixed tracks and reachable terminal controls', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ height: 393, width: 852 })

  for (const hash of ['#lights-overview', '#climate-overview', '#occupancy-overview', '#contact-sensors-overview', '#aqi-overview']) {
    await page.goto(`/index.html?path=overview${hash}`)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)
    await expectShortLandscapeFixedGrid(dialog)
    await closeModal(dialog)
  }

  await page.goto('/index.html?path=security#contact-sensors-overview')
  let dialog = page.getByRole('dialog', { name: 'Contact Sensors' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(520)
  await expectShortLandscapeFixedGrid(dialog)
  await closeModal(dialog)

  await page.goto('/index.html?path=settings')
  await page.getByRole('button', { name: 'Quick Links' }).click()
  await page.getByRole('button', { exact: true, name: 'Rooms' }).click()
  dialog = page.getByRole('dialog', { name: 'Rooms' })
  await page.waitForTimeout(520)
  await expectShortLandscapeFixedGrid(dialog)
  await closeModal(dialog)

  for (const hash of ['#presence-based-overrides', '#presence-based-overrides-auto']) {
    await page.goto(`/index.html?path=admin${hash}`)
    dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(520)
    await expectShortLandscapeFixedGrid(dialog)
    await closeModal(dialog)
  }
})

test('short-landscape sheet pickers use compact fixed tracks', async ({ page }) => {
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
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toBe('240px 240px')
  await closeModal(dialog)

  await page.goto('/index.html?path=ecobee')
  await page.getByRole('button', { name: /Thermostat Hub Mode Off/i }).click()
  dialog = page.getByRole('dialog', { name: 'Thermostat Hub Mode' })
  await expect(dialog).toBeVisible()
  options = dialog.getByRole('group', { name: 'Thermostat Hub Mode options' })
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toBe('240px 240px')
  await closeModal(dialog)
})

test('tabbed workspaces reset the active scroll owner at mobile and short-landscape sizes', async ({ page }) => {
  for (const viewport of [{ height: 852, width: 393 }, { height: 393, width: 852 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=living-room')
    await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()
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
  await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()
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

test('music room focused-map controls stay contained across the canonical viewport matrix', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const dialog = await openMusicRoomVacuum(page)
    const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })
    const fullMap = dialog.getByRole('button', { name: 'Full Map' })

    await expect(map).toHaveAttribute('data-map-scope', 'focused')
    await expect(dialog.getByText('Reachable Area Only')).toBeVisible()
    const geometry = await map.evaluate((element) => {
      const frame = element.getBoundingClientRect()
      const control = element.querySelector<HTMLElement>('button[aria-pressed]')
      const controlRect = control?.getBoundingClientRect()
      return {
        contained: Boolean(controlRect)
          && controlRect!.left >= frame.left
          && controlRect!.right <= frame.right
          && controlRect!.top >= frame.top
          && controlRect!.bottom <= frame.bottom,
        controlHeight: controlRect?.height ?? 0,
        frameHeight: frame.height,
        frameWidth: frame.width,
      }
    })
    expect(geometry.contained).toBe(true)
    expect(geometry.controlHeight).toBeGreaterThanOrEqual(44)
    expect(geometry.frameHeight).toBeGreaterThan(0)
    expect(geometry.frameWidth).toBeGreaterThan(0)

    await fullMap.click()
    await expect(map).toHaveAttribute('data-map-scope', 'full')
    await fullMap.click()
    await expect(map).toHaveAttribute('data-map-scope', 'focused')
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
      await expect(dialog.getByRole('button', { name: 'Full Map' })).toBeVisible()
      await expect(dialog.getByText('Reachable Area Only')).toBeVisible()
    }

    await closeModal(dialog)
  }
})

test('vacuum short landscape uses one body scroller with a fixed navigation footer', async ({ page }) => {
  await page.setViewportSize({ height: 393, width: 852 })
  const dialog = await openMainFloorVacuum(page)
  await page.waitForTimeout(520)

  await expect(dialog).toHaveAttribute('data-centered-layout', 'false')
  await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toBeVisible()
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
        await page.getByRole('button', { name: /Living Room SHIELD Off/i }).click()
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
