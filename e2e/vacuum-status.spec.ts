import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 820, width: 1180 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
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

async function openUnavailableMusicVacuum(page: Page) {
  await page.goto('/at-a-glance/vacuums')
  await setMusicVacuumUnavailable(page)
  await page.getByRole('button', { name: 'Music Room', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function assertUnavailableAccuracy(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Unavailable')).toContainText('Home Assistant does not have a current status for the vacuum.')
  await expect(dialog.getByText('Battery').locator('xpath=ancestor::*[@data-icon][1]')).toContainText('Unknown')
  await expect(dialog.getByRole('group', { name: 'Dock Status Unknown' })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Music Room Valetudo map' })).toHaveAttribute('data-source-available', 'false')
  await expect(dialog.getByText('Map Unavailable')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText("Unavailable. Home Assistant does not have the vacuum's current status.")
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
}

for (const viewport of VIEWPORTS) {
  test(`unavailable vacuum status stays truthful at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openUnavailableMusicVacuum(page)
    await assertUnavailableAccuracy(page)
  })
}

test('an unavailable vacuum modal keeps truthful state through mounted resize sequences', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  const dialog = await openUnavailableMusicVacuum(page)
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
  await expect(dialog.getByRole('region', { name: 'Main Floor Valetudo map' })).toHaveAttribute('data-source-available', 'false')
  await expect(dialog.getByText('Map Unavailable')).toBeVisible()
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
  await expect(dialog.getByRole('region', { name: 'Main Floor Valetudo map' })).toHaveAttribute('data-source-available', 'false')
  await expect(dialog.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/Battery level is low/i)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
})
