import { expect, test, type Locator, type Page } from './layout/fixture'
import { NINE_ROOM_VACUUM_OUTCOME_CONTRACT } from '../src/test/fixtures/vacuumOutcomes'
import { RESPONSIVE_ROUTES, RESPONSIVE_ROUTE_TITLES } from './responsive-acceptance-data'

const DESKTOP_VIEWPORTS = [
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
] as const

async function waitForRoute(page: Page, route: string) {
  const root = page.locator(`[data-route-path="${route}"]`)
  await expect(root).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
  await expect(root.getByRole('heading', { level: 1, name: RESPONSIVE_ROUTE_TITLES.get(route) })).toBeVisible()
  return root
}

async function navigateRoute(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    const url = new URL(window.location.href)
    url.searchParams.set('path', nextRoute)
    url.hash = ''
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  return waitForRoute(page, route)
}

async function visibleFocusIndicator(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return (
      (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
      || style.boxShadow !== 'none'
    )
  })
}

test('all routes remain contained in a fine-pointer desktop context', async ({ page }) => {
  test.setTimeout(180_000)
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
    await waitForRoute(page, 'overview')

    for (const route of RESPONSIVE_ROUTES) {
      const root = route === 'overview' ? await waitForRoute(page, route) : await navigateRoute(page, route)
      const overflow = await root.evaluate((element) => {
        const scroller = element.querySelector<HTMLElement>('[data-page-scroller="true"]')
        return {
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fallback: element.textContent?.includes('is not available in the React dashboard yet.') ?? false,
          scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
        }
      })
      expect(overflow.document, `${route} document overflow`).toBeLessThanOrEqual(1)
      expect(overflow.scroller, `${route} page overflow`).toBeLessThanOrEqual(1)
      expect(overflow.fallback, `${route} fallback content`).toBe(false)
    }
  }
})

test('floating action docks align to reading, dashboard, and media content measures', async ({ page }) => {
  const routes = ['overview', 'groceries', 'food'] as const

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })

    for (const route of routes) {
      const root = route === 'overview' ? await waitForRoute(page, route) : await navigateRoute(page, route)
      const content = root.locator('[data-page-content="true"]')
      const dock = page.locator('[data-floating-action-dock="true"]')
      const [contentBox, dockBox] = await Promise.all([content.boundingBox(), dock.boundingBox()])
      expect(contentBox).not.toBeNull()
      expect(dockBox).not.toBeNull()
      expect(Math.abs((dockBox?.x ?? 0) - (contentBox?.x ?? 0)), `${route} dock left edge`).toBeLessThanOrEqual(1)
      expect(Math.abs((dockBox?.x ?? 0) + (dockBox?.width ?? 0) - ((contentBox?.x ?? 0) + (contentBox?.width ?? 0))), `${route} dock right edge`).toBeLessThanOrEqual(1)
    }
  }
})

test('Food and Recipes keeps All Recipes full-width and issues one measured recommendation query', async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=overview')
    await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
    await page.evaluate(() => {
      window.__mockHass?.calls.splice(0)
    })
    const root = await navigateRoute(page, 'food')
    await expect(root.getByRole('heading', { name: 'Suggested Recipes' })).toBeVisible({ timeout: 15_000 })

    const content = root.locator('[data-page-content="true"]')
    const allRecipes = root.getByRole('region', { name: 'All Recipes' })
    const [contentBox, allRecipesBox] = await Promise.all([content.boundingBox(), allRecipes.boundingBox()])
    expect(contentBox).not.toBeNull()
    expect(allRecipesBox).not.toBeNull()
    expect(Math.abs((allRecipesBox?.x ?? 0) - (contentBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((allRecipesBox?.width ?? 0) - (contentBox?.width ?? 0))).toBeLessThanOrEqual(1)

    const carousel = root.locator('[data-card-carousel="true"]')
    const columns = Number(await carousel.getAttribute('data-columns'))
    const expectedLimit = columns * 2 * 5
    await expect.poll(() => page.evaluate(() => (
      window.__mockHass?.calls.filter((call) =>
        call.domain === 'evershelf'
        && call.service === 'recipe_query'
        && call.serviceData?.kind === 'recommendations'
      ).map((call) => call.serviceData?.limit) ?? []
    ))).toEqual([expectedLimit])
  }
})

test('permanent navigation and modal controls retain keyboard focus indicators', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await expect(page.locator('[data-adaptive-navigation="rail"]')).toBeVisible({ timeout: 20_000 })
  const home = page.locator('[data-adaptive-navigation="rail"]').getByRole('button', { name: 'Home' })
  await page.keyboard.press('Tab')
  await expect(home).toBeFocused()
  await expect.poll(() => visibleFocusIndicator(home)).toBe(true)

  const quickLinks = page.getByRole('button', { name: 'Quick Links' })
  await quickLinks.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Quick Links' })
  await expect(dialog).toBeVisible()
  await expect.poll(() => dialog.getByRole('group', { name: 'Quick Links', exact: true }).evaluate((grid) => {
    const gridRect = grid.getBoundingClientRect()
    const bodyRect = grid.parentElement?.getBoundingClientRect()
    const buttons = Array.from(grid.querySelectorAll('button'))
    return {
      centered: Boolean(bodyRect && Math.abs(
        (gridRect.left + gridRect.right) / 2 - (bodyRect.left + bodyRect.right) / 2,
      ) <= 1),
      columns: Number(grid.getAttribute('data-dynamic-grid-columns')),
      compactTiles: buttons.every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.width <= grid.clientWidth + 1 && Math.round(rect.height) === 88
      }),
      contentFits: buttons.every((button) =>
        button.scrollWidth <= button.clientWidth + 1
        && button.scrollHeight <= button.clientHeight + 1),
    }
  })).toEqual({
    centered: true,
    columns: 4,
    compactTiles: true,
    contentFits: true,
  })
  const close = dialog.getByRole('button', { name: 'Close' })
  await close.focus()
  await expect(close).toBeFocused()
  await expect.poll(() => visibleFocusIndicator(close)).toBe(true)
})

test('Daily Summary uses compact two-column rows in a fine-pointer desktop context', async ({ page }) => {
  await page.goto('/index.html?path=overview&user=stephen#daily-report')
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-modal-body-tier', 'standard')
  await expect(dialog.locator('h2').first()).toHaveCSS('font-size', '16px')
  const dialogBox = await dialog.boundingBox()
  expect(Math.round(dialogBox?.width ?? 0)).toBe(1100)
  expect(Math.round(dialogBox?.height ?? 0)).toBe(760)
  await expect(dialog.locator('[data-modal-content-measure="true"]')).toHaveCSS('width', '670px')

  const todoList = dialog.getByLabel('Overdue Chores todo list')
  await expect(todoList.locator('li')).toHaveCount(2)
  expect(await todoList.locator('li').evaluateAll((rows) =>
    new Set(rows.map((row) => Math.round(row.getBoundingClientRect().left))).size,
  )).toBe(2)
  await expect(todoList.locator('strong').first()).toHaveCSS('font-size', '13.12px')

  await dialog.getByRole('tab', { name: /^Expired Food/ }).click()
  const expiredRows = dialog.locator('[data-expiry-tone="expired"]')
  await expect(expiredRows).toHaveCount(2)
  expect(await expiredRows.evaluateAll((rows) =>
    new Set(rows.map((row) => Math.round(row.getBoundingClientRect().left))).size,
  )).toBe(2)
  await expect(expiredRows.locator('strong').first()).toHaveCSS('font-size', '13.12px')
})

test('centered modal geometry stays fixed through details in a fine-pointer desktop context', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  await page.getByRole('button', { name: 'Quick Links' }).click()
  let dialog = page.getByRole('dialog', { name: 'Quick Links' })
  const quickGeometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      intent: element.dataset.modalGeometryIntent,
      width: rect.width,
    }
  })
  await dialog.getByRole('button', { name: 'Rooms' }).click()
  dialog = page.getByRole('dialog', { name: 'Rooms' })
  await expect.poll(() => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      intent: element.dataset.modalGeometryIntent,
      width: rect.width,
    }
  })).toEqual(quickGeometry)

  await page.goto('/index.html?path=sprinklers')
  await page.getByRole('button', { name: /Front Yard Auto/i }).click()
  dialog = page.getByRole('dialog')
  const sprinklerGeometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      intent: element.dataset.modalGeometryIntent,
      width: rect.width,
    }
  })
  await dialog.getByRole('button', { name: 'Water now · Front Yard' }).click()
  await expect.poll(() => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      intent: element.dataset.modalGeometryIntent,
      width: rect.width,
    }
  })).toEqual(sprinklerGeometry)
})

test('music room focused map omits scope controls in a fine-pointer desktop context', async ({ page }) => {
  await page.goto('/index.html?path=vacuums')
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })
  await page.evaluate(() => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
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
  const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })

  await expect(map).toHaveAttribute('data-map-scope', 'focused')
  await expect(dialog.getByRole('button', { name: 'Full Map' })).toHaveCount(0)
  await expect(dialog.getByText('Reachable Area Only')).toHaveCount(0)
  const containment = await map.evaluate((element) => {
    const frame = element.getBoundingClientRect()
    const dialog = element.closest<HTMLElement>('[role="dialog"]')?.getBoundingClientRect()
    return Boolean(dialog)
      && frame.left >= dialog!.left
      && frame.right <= dialog!.right
      && frame.top >= dialog!.top
      && frame.bottom <= dialog!.bottom
  })
  expect(containment).toBe(true)
})

test('Music Room media controls remain usable in a fine-pointer desktop context', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=music-room')
    const root = await waitForRoute(page, 'music-room')
    await expect(root.getByRole('button', { name: 'Music Room Remote Off' })).toBeVisible()
    await expect(root.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('data-action-kind', 'selection')
    await expect(root.getByRole('button', { name: 'Server Off' })).toHaveAttribute('data-action-kind', 'selection')
    await expect(root.getByRole('button', { name: 'Fortnite' })).toHaveCount(0)

    await page.evaluate(() => {
      const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
      mock.setEntityState('media_player.music_room_tv_android', 'on')
      mock.setEntityState('media_player.xbox', 'off')
      mock.setEntityState('switch.music_room_music_room_sync_box_power', 'on')
      mock.setEntityState('select.music_room_music_room_sync_box_hdmi_input', 'HDMI 1')
      mock.setEntityState('sensor.music_room_music_room_sync_box_hdmi1_status', 'linked')
    })
    await root.getByRole('button', { name: /^Music Room Remote / }).click()
    const dialog = page.getByRole('dialog', { name: 'Music Room Remote' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Sonos Beam Volume' })).toBeVisible()
    await dialog.getByRole('tab', { name: 'Devices' }).click()
    await expect(dialog.getByRole('switch', { name: 'TV On' })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Xbox On' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
    await expect(dialog.getByLabel('Sonos Beam Playing')).toHaveAttribute('data-action-kind', 'state')
    await dialog.getByRole('tab', { name: 'Hue Sync' }).click()
    await expect(dialog.getByRole('switch', { name: 'Sync Box Power On' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('button', { name: /^HDMI 1 Selected • / })).toBeVisible()
    await expect(dialog.getByText('Entertainment Stream')).toHaveCount(0)
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
    await dialog.getByRole('button', { name: 'Close' }).click()

    const media = await navigateRoute(page, 'media')
    const musicSection = media.getByRole('heading', { level: 2, name: 'Music Room' }).locator('xpath=ancestor::section[1]')
    await expect(musicSection.getByRole('button', { name: /^Music Room Remote / })).toBeVisible()
    await expect(musicSection.getByRole('button', { name: 'Xbox Off' })).toBeVisible()
    await expect(musicSection.getByRole('button', { name: 'Server Off' })).toBeVisible()
    const mediaFortnite = musicSection.getByRole('button', { name: 'Fortnite' })
    await expect(mediaFortnite).toBeVisible()
    await expect.poll(() => mediaFortnite.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  }
})

for (const route of [
  { label: 'Vacuums', path: 'vacuums' },
  { label: 'Music Room', path: 'music-room' },
] as const) {
  test(`unavailable vacuum status stays truthful on ${route.label} in a fine-pointer desktop context`, async ({ page }) => {
    await page.goto(`/index.html?path=${route.path}`)
    await expect.poll(() => page.evaluate(() => ({
      coarse: window.matchMedia('(pointer: coarse)').matches,
      hover: window.matchMedia('(hover: hover)').matches,
    }))).toEqual({ coarse: false, hover: true })
    await page.evaluate(() => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      mock.setEntityState('vacuum.valetudo_elatedusedram', 'unavailable')
      mock.setEntityState('sensor.valetudo_elatedusedram_error', 'unavailable')
      mock.setEntityState('camera.valetudo_elatedusedram_map_data', 'unavailable')
      mock.setEntityState('input_text.music_room_vacuum_error_message', 'The battery is critically low and the vacuum will shut down soon.')
      mock.calls.splice(0, mock.calls.length)
    })

    await page.getByRole('button', { name: 'Music Room Unavailable', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Unavailable')).toHaveCount(0)
    await expect(dialog.getByText('Battery').locator('xpath=ancestor::*[@data-icon][1]')).toHaveAttribute('data-tone', 'unavailable')
    await expect(dialog.getByRole('region', { name: 'Music Room Valetudo map' })).toHaveAttribute('data-source-available', 'false')
    await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
    expect(await page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])

    const close = dialog.getByRole('button', { name: 'Close' })
    await expect(close).toBeVisible()
  })
}

test('cleaning report detail remains usable in a fine-pointer desktop context', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
  }))).toEqual({ coarse: false, hover: true })

  for (const viewport of [
    { height: 820, width: 1180 },
    ...DESKTOP_VIEWPORTS,
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/index.html?path=vacuums')
    await page.evaluate((contract) => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      mock.setEntityAttribute(
        'sensor.main_floor_vacuum_coordinator_session_state',
        'while_away_outcomes',
        contract,
      )
      mock.calls.splice(0, mock.calls.length)
    }, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))

    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const dialog = page.getByRole('dialog')
    const summary = dialog.getByRole('button', {
      name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026',
    })
    await expect(summary).toBeVisible()
    await summary.click()

    await expect(dialog.getByRole('heading', {
      name: 'Main Floor · Automatic Cleaning Report',
    })).toBeVisible()
    await expect(dialog.locator('[data-vacuum-outcome-detail="true"]')).toBeFocused()
    await expect(dialog.locator('[data-group] > button')).toHaveCount(0)
    await expect(dialog.locator('[data-room-id="dining_room"]').getByRole('button')).toHaveCount(0)
    await expect(dialog.locator('[data-room-id="dining_room"]')).toContainText(
      'Vacuuming and mopping remain.',
    )
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
    expect(await page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])

    await dialog.getByRole('button', { name: 'Back to Vacuum Controls' }).click()
    await expect(summary).toBeFocused()
  }
})
