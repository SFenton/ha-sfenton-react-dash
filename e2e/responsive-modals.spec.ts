import { expect, test, type Locator, type Page } from '@playwright/test'

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
] as const

async function closeModal(dialog: Locator) {
  await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
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
    await expectScrollSafe(dialog)
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
