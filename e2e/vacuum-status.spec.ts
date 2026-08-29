import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
] as const

const UNAVAILABLE_ROUTES = [
  { label: 'Vacuums', path: '/at-a-glance/vacuums' },
  { label: 'Music Room', path: '/at-a-glance/music-room' },
] as const

async function setMusicVacuumUnavailable(page: Page) {
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        calls: Record<string, unknown>[]
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_elatedusedram', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_battery_level', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_error', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_status_flag', 'unavailable')
    mock.setEntityState('sensor.valetudo_elatedusedram_dock_status', 'unavailable')
    mock.setEntityState('camera.valetudo_elatedusedram_map_data', 'unavailable')
    mock.setEntityState('input_text.music_room_vacuum_error_message', 'The battery is critically low and the vacuum will shut down soon.')
    mock.calls.splice(0, mock.calls.length)
  })
}

async function openUnavailableMusicVacuum(page: Page, path = '/at-a-glance/vacuums') {
  await page.goto(path)
  await setMusicVacuumUnavailable(page)
  await page.getByRole('button', { name: 'Music Room Unavailable', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function assertUnavailableAccuracy(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Unavailable')).toContainText('Home Assistant does not have a current status for the vacuum.')
  await expect(dialog.getByText('Battery').locator('xpath=ancestor::*[@data-icon][1]')).toContainText('Unknown')
  await expect(dialog.getByRole('group', { name: 'Dock Status Unknown' })).toBeVisible()
  const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'reported')
  await expect(map).toHaveAttribute('data-loaded', 'true')
  const note = dialog.locator('[data-map-reported-note="true"]')
  await expect(note).toHaveAttribute('data-icon', 'mdi:alert-outline')
  await expect(note).toContainText('Last Reported Position')
  await expect(note).toContainText('The exact report time is unknown, and the vacuum may have been moved since then.')
  await expect(map.locator('[data-map-editor-overlay="true"]')).toHaveCount(0)
  await expect(dialog.getByText('Map Unavailable')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText("Unavailable. Home Assistant does not have the vacuum's current status.")
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
}

for (const route of UNAVAILABLE_ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`unavailable vacuum status stays truthful on ${route.label} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openUnavailableMusicVacuum(page, route.path)
      await assertUnavailableAccuracy(page)
    })
  }
}

test('room vacuum tiles match the dedicated Vacuums page presentation', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })

  const cases = [
    {
      accessibleName: 'Main Floor Cleaning • 72%',
      batteryEntityId: 'sensor.valetudo_exaltedsneakydeer_battery_level',
      batteryState: '72',
      entityId: 'vacuum.valetudo_exaltedsneakydeer',
      path: '/at-a-glance/living-room',
      state: 'cleaning',
    },
    {
      accessibleName: 'Music Room Unavailable',
      batteryEntityId: 'sensor.valetudo_elatedusedram_battery_level',
      batteryState: '87',
      entityId: 'vacuum.valetudo_elatedusedram',
      path: '/at-a-glance/music-room',
      state: 'unavailable',
    },
    {
      accessibleName: 'Theater Room Error • 0%',
      batteryEntityId: 'sensor.valetudo_politefatherlykingfisher_battery_level',
      batteryState: '0',
      entityId: 'vacuum.valetudo_politefatherlykingfisher',
      path: '/at-a-glance/theater-room',
      state: 'error',
    },
  ] as const

  for (const vacuum of cases) {
    const readPresentation = async (path: string) => {
      await page.goto(path)
      await page.evaluate(({ batteryEntityId, batteryState, entityId, state }) => {
        const mock = window.__mockHass
        if (!mock) throw new Error('Mock Home Assistant API is unavailable')
        mock.setEntityState(entityId, state)
        mock.setEntityState(batteryEntityId, batteryState)
      }, vacuum)
      const tile = page.getByRole('button', { name: vacuum.accessibleName, exact: true })
      await expect(tile).toBeVisible()
      return tile.evaluate((element) => ({
        actionKind: element.getAttribute('data-action-kind'),
        icon: element.getAttribute('data-icon'),
        inlineColor: (element as HTMLElement).style.getPropertyValue('--tile-color'),
        modalOpener: element.getAttribute('data-modal-opener'),
        muted: element.getAttribute('data-muted'),
        tone: element.getAttribute('data-tone'),
      }))
    }

    const dedicated = await readPresentation('/at-a-glance/vacuums')
    const room = await readPresentation(vacuum.path)
    expect(room).toEqual(dedicated)
    expect(room.actionKind).toBe('modal')
    expect(room.modalOpener).toBe('true')
  }
})

for (const route of UNAVAILABLE_ROUTES) {
  test(`an unavailable vacuum modal on ${route.label} keeps truthful state through mounted resize sequences`, async ({ page }) => {
    await page.setViewportSize({ height: 852, width: 393 })
    const dialog = await openUnavailableMusicVacuum(page, route.path)
    const dialogId = await dialog.getAttribute('id')

    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 852, width: 393 },
      { height: 1180, width: 820 },
      { height: 820, width: 1180 },
      { height: 1180, width: 820 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(page.getByRole('dialog')).toHaveAttribute('id', dialogId ?? '')
      await assertUnavailableAccuracy(page)
    }
  })
}

test('a camera-only outage hides cached position and map-linked commands', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        calls: Record<string, unknown>[]
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', 'docked')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_error', 'No error')
    mock.setEntityState('camera.valetudo_exaltedsneakydeer_map_data', 'unavailable')
    mock.calls.splice(0, mock.calls.length)
  })

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'none')
  await expect(dialog.getByText('Map Unavailable')).toBeVisible()
  await expect(dialog.locator('[data-map-reported-note="true"]')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
})

test('an open vacuum modal immediately yields to a live unavailable transition', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  const dialogId = await dialog.getAttribute('id')
  await expect(dialog.getByRole('button', { name: 'Locate' })).toBeVisible()

  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        calls: Record<string, unknown>[]
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('input_text.main_floor_vacuum_error_message', 'Battery level is low. The vacuum will return to charge.')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_error', 'unavailable')
    mock.setEntityState('camera.valetudo_exaltedsneakydeer_map_data', 'unavailable')
    mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', 'unavailable')
    mock.calls.splice(0, mock.calls.length)
  })

  await expect(page.getByRole('dialog')).toHaveAttribute('id', dialogId ?? '')
  await expect(dialog.getByLabel('Unavailable')).toBeVisible()
  await expect(dialog.getByRole('status')).toContainText("Unavailable. Home Assistant does not have the vacuum's current status.")
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'reported')
  await expect(dialog.locator('[data-map-reported-note="true"]')).toContainText('Last Reported Position')
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/Battery level is low/i)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
})

test('an unavailable transition resets a zoomed area editor before showing the last reported position', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await dialog.getByRole('button', { name: 'Draw Area' }).click()

  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  const editor = dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })
  await editor.dispatchEvent('wheel', { clientX: 48, clientY: 48, deltaY: -900 })
  await expect.poll(async () => Number(await map.getAttribute('data-viewport-zoom'))).toBeGreaterThan(1)

  await page.evaluate(() => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', 'unavailable')
    mock.calls.splice(0, mock.calls.length)
  })

  await expect(map).toHaveAttribute('data-map-provenance', 'reported')
  await expect(map).toHaveAttribute('data-viewport-zoom', '1')
  await expect(map).toHaveAttribute('data-viewport-pan-x', '0')
  await expect(map).toHaveAttribute('data-viewport-pan-y', '0')
  await expect(dialog.locator('[data-map-reported-note="true"]')).toContainText('Last Reported Position')
  await expect(dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])
})
