import { expect, test, type Locator, type Page } from './layout/fixture'
import { setSafeAreaInsets } from './safe-area'
import { openQuickLinksTab } from './quick-links'

interface GeometrySnapshot {
  geometryIntent: string | null
  height: number
  presentation: string | null
  probeId: string | null
  width: number
}

const DESKTOP = {
  height: 900,
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
  name: 'desktop',
  width: 1440,
}
const LANDSCAPE_LEFT = {
  height: 393,
  insets: { bottom: 21, left: 59, right: 44, top: 0 },
  name: 'landscape-left',
  width: 852,
}
const CENTERED_VIEWPORTS = [LANDSCAPE_LEFT, DESKTOP] as const
let navigationVersion = 0

async function gotoPath(page: Page, path: string, viewport?: {
  height: number
  insets: { bottom: number; left: number; right: number; top: number }
  width: number
}) {
  if (viewport) await page.setViewportSize(viewport)
  const [pathAndQuery, hash] = path.split('#')
  navigationVersion += 1
  await page.goto(`/index.html?path=${pathAndQuery}&modalGeometryRun=${navigationVersion}${hash ? `#${hash}` : ''}`)
  if (viewport) await setSafeAreaInsets(page, viewport.insets)
}

async function resizeViewport(page: Page, viewport: {
  height: number
  insets: { bottom: number; left: number; right: number; top: number }
  width: number
}) {
  await page.setViewportSize(viewport)
  await setSafeAreaInsets(page, viewport.insets)
}

async function geometrySnapshot(dialog: Locator): Promise<GeometrySnapshot> {
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  if (!box) throw new Error('Modal geometry was unavailable')
  return {
    geometryIntent: await dialog.getAttribute('data-modal-geometry-intent'),
    height: box.height,
    presentation: await dialog.getAttribute('data-modal-presentation'),
    probeId: await dialog.getAttribute('data-modal-geometry-probe'),
    width: box.width,
  }
}

async function markGeometry(dialog: Locator, probeId: string) {
  await dialog.evaluate((element, id) => {
    element.dataset.modalGeometryProbe = id
  }, probeId)
  return geometrySnapshot(dialog)
}

async function expectStableGeometry(dialog: Locator, baseline: GeometrySnapshot, label: string) {
  const current = await geometrySnapshot(dialog)
  expect(current.probeId, `${label} mounted node`).toBe(baseline.probeId)
  expect(current.geometryIntent, `${label} geometry intent`).toBe(baseline.geometryIntent)
  expect(current.presentation, `${label} presentation`).toBe(baseline.presentation)
  expect(Math.abs(current.width - baseline.width), `${label} width drift`).toBeLessThanOrEqual(1)
  expect(Math.abs(current.height - baseline.height), `${label} height drift`).toBeLessThanOrEqual(1)
}

test.describe('centered modal geometry stability', () => {
  test.beforeEach(() => {
    test.setTimeout(180_000)
  })

  test('keeps Quick Links stable through Rooms and Security details', async ({ page }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'overview', viewport)
      await openQuickLinksTab(page)
      let dialog = page.getByRole('dialog', { name: 'Quick Links' })
      const baseline = await markGeometry(dialog, `quick-links-${viewport.name}`)

      await dialog.getByRole('button', { name: 'Rooms' }).click()
      dialog = page.getByRole('dialog', { name: 'Rooms' })
      await expectStableGeometry(dialog, baseline, `${viewport.name} Rooms`)
      await dialog.getByRole('button', { exact: true, name: 'Back' }).click()
      dialog = page.getByRole('dialog', { name: 'Quick Links' })
      await expectStableGeometry(dialog, baseline, `${viewport.name} Rooms Back`)

      await dialog.getByRole('button', { name: /^Security System/ }).click()
      dialog = page.getByRole('dialog', { name: 'Security System' })
      await expectStableGeometry(dialog, baseline, `${viewport.name} Security`)
    }
  })

  test('keeps Daily Summary stable through tabs and both detail types', async ({ page }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'overview&user=stephen#daily-report', viewport)
      let dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
      const baseline = await markGeometry(dialog, `daily-${viewport.name}`)

      await dialog.getByRole('tab', { name: 'Upcoming Chores' }).click()
      await expectStableGeometry(dialog, baseline, `${viewport.name} Upcoming`)
      await dialog.getByRole('tab', { name: /^Expired Food/ }).click()
      await expectStableGeometry(dialog, baseline, `${viewport.name} Expired`)

      const expiredRow = dialog.locator('[data-expiry-tone="expired"]').first()
      await expect(expiredRow).toBeVisible()
      await expiredRow.getByRole('button', { name: /^Edit / }).click()
      dialog = page.getByRole('dialog', { name: 'Milk' })
      await expectStableGeometry(dialog, baseline, `${viewport.name} inventory detail`)
      await dialog.getByRole('button', { name: 'Back to expired food' }).click()
      dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
      await expectStableGeometry(dialog, baseline, `${viewport.name} inventory Back`)

      await dialog.getByRole('tab', { name: /^Overdue Chores/ }).click()
      await dialog.getByRole('region', { name: 'Overdue Chores' }).getByRole('button', { name: /^Edit / }).first().click()
      dialog = page.getByRole('dialog', { name: 'Edit Task' })
      await expectStableGeometry(dialog, baseline, `${viewport.name} task detail`)
    }
  })

  test('keeps Humidifier and Eight Sleep geometry through schedule editors', async ({ page }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'master-bedroom', viewport)
      await page.getByRole('button', { name: /Humidifier .*46%/i }).click()
      let dialog = page.getByRole('dialog')
      const humidifierBaseline = await markGeometry(dialog, `humidifier-${viewport.name}`)
      await dialog.getByRole('tab', { exact: true, name: 'Schedules' }).click()
      await expectStableGeometry(dialog, humidifierBaseline, `${viewport.name} Humidifier Schedules`)
      await dialog.getByRole('button', { name: 'Add Scheduled Activity' }).click()
      await expectStableGeometry(dialog, humidifierBaseline, `${viewport.name} Humidifier editor`)

      await gotoPath(page, 'master-bedroom', viewport)
      await page.getByRole('button', { name: /Steph.s Bed Off/i }).click()
      dialog = page.getByRole('dialog')
      const sleepBaseline = await markGeometry(dialog, `eight-sleep-${viewport.name}`)
      await dialog.getByRole('tab', { exact: true, name: 'Alarms' }).click()
      await expectStableGeometry(dialog, sleepBaseline, `${viewport.name} Eight Sleep Alarms`)
      await dialog.getByRole('button', { exact: true, name: 'Add Alarm' }).click()
      await expectStableGeometry(dialog, sleepBaseline, `${viewport.name} Eight Sleep editor`)
    }
  })

  test('keeps Thermostat room details and Recipe loading geometry stable', async ({ page }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'thermostat#thermostat-controls', viewport)
      let dialog = page.getByRole('dialog', { name: 'Thermostat · Advanced Controls' })
      const thermostatBaseline = await markGeometry(dialog, `thermostat-${viewport.name}`)
      await dialog.getByRole('button', { name: /^Living Room/ }).click()
      dialog = page.getByRole('dialog', { name: 'Living Room' })
      await expectStableGeometry(dialog, thermostatBaseline, `${viewport.name} Thermostat room`)

      await gotoPath(page, 'food&__mockRecipeDetailDelayMs=1200', viewport)
      await page.getByRole('button', { name: /Open Suggested .* recipe details/i }).first().click()
      dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('status', { name: 'Loading recipe details' })).toBeVisible()
      const recipeBaseline = await markGeometry(dialog, `recipe-${viewport.name}`)
      await expect(dialog.getByText('Serves 4')).toBeVisible()
      await expectStableGeometry(dialog, recipeBaseline, `${viewport.name} Recipe ready`)
      for (const tab of ['Ingredients', 'Instructions', 'General']) {
        await dialog.getByRole('tab', { name: tab }).click()
        await expectStableGeometry(dialog, recipeBaseline, `${viewport.name} Recipe ${tab}`)
      }
    }
  })

  test('keeps Sprinkler and Scan multi-step geometry stable', async ({ page }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'sprinklers', viewport)
      await page.getByRole('button', { name: /Front Yard Auto/i }).click()
      let dialog = page.getByRole('dialog')
      const sprinklerBaseline = await markGeometry(dialog, `sprinkler-${viewport.name}`)
      await dialog.getByRole('button', { name: 'Water now · Front Yard' }).click()
      await expectStableGeometry(dialog, sprinklerBaseline, `${viewport.name} Sprinkler water`)
      await dialog.getByRole('button', { exact: true, name: 'Back' }).click()
      await dialog.getByRole('button', { name: /Front Yard schedule .* Every day/i }).click()
      await expectStableGeometry(dialog, sprinklerBaseline, `${viewport.name} Sprinkler schedule`)

      await gotoPath(page, 'food', viewport)
      await page.getByRole('button', { name: 'Scan Item' }).click()
      dialog = page.getByRole('dialog', { name: /Add Item/i })
      const scanBaseline = await markGeometry(dialog, `scan-${viewport.name}`)
      await dialog.getByRole('button', { name: 'Manually Enter Name' }).click()
      await expectStableGeometry(dialog, scanBaseline, `${viewport.name} Scan manual`)
      await dialog.getByRole('textbox', { name: 'Product name' }).fill('Milk')
      await dialog.getByRole('button', { name: 'Next' }).click()
      await expect(dialog).toContainText('Expiration Date · Step 2 of 3')
      await expectStableGeometry(dialog, scanBaseline, `${viewport.name} Scan expiry`)
      await dialog.getByRole('button', { name: 'Skip Expiration' }).click()
      await expect(dialog).toContainText('Review Item · Step 3 of 3')
      await expectStableGeometry(dialog, scanBaseline, `${viewport.name} Scan review`)
    }
  })

  test('updates shared Home geometry by identity while preserving the landscape frame', async ({ page, context }) => {
    for (const viewport of CENTERED_VIEWPORTS) {
      await gotoPath(page, 'overview#lights-overview', viewport)
      let dialog = page.getByRole('dialog')
      const baseline = await markGeometry(dialog, `home-hashes-${viewport.name}`)

      for (const hash of ['#contact-sensors-overview', '#aqi-overview', '#security-system']) {
        await page.evaluate((nextHash) => {
          const url = new URL(window.location.href)
          url.hash = nextHash
          window.history.pushState({}, '', url)
          window.dispatchEvent(new HashChangeEvent('hashchange'))
        }, hash)
        dialog = page.getByRole('dialog')
        const transitioned = await geometrySnapshot(dialog)
        expect(transitioned.probeId, `${viewport.name} ${hash} mounted node`).toBe(baseline.probeId)

        const directPage = await context.newPage()
        await gotoPath(directPage, `overview${hash}`, viewport)
        const direct = await geometrySnapshot(directPage.getByRole('dialog'))
        expect(transitioned.geometryIntent, `${viewport.name} ${hash} intent`).toBe(direct.geometryIntent)
        expect(Math.abs(transitioned.width - direct.width), `${viewport.name} ${hash} width`).toBeLessThanOrEqual(1)
        expect(Math.abs(transitioned.height - direct.height), `${viewport.name} ${hash} height`).toBeLessThanOrEqual(1)
        if (transitioned.presentation === 'landscape-dialog') {
          expect(Math.abs(transitioned.width - baseline.width), `${viewport.name} ${hash} landscape width`).toBeLessThanOrEqual(1)
          expect(Math.abs(transitioned.height - baseline.height), `${viewport.name} ${hash} landscape height`).toBeLessThanOrEqual(1)
        }
        await directPage.close()
      }
    }
  })

  test('reclamps one geometry intent across stress widths and restores portrait exactly', async ({ page }) => {
    const stressViewports = [
      { height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 568 },
      { height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 667 },
      { height: 343, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 734 },
      LANDSCAPE_LEFT,
      { height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, width: 852 },
      { height: 1180, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 820 },
      { height: 820, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 1180 },
      { height: 1080, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 1920 },
    ]

    for (const viewport of stressViewports) {
      await gotoPath(page, 'overview', viewport)
      await openQuickLinksTab(page)
      let dialog = page.getByRole('dialog', { name: 'Quick Links' })
      const baseline = await markGeometry(dialog, `quick-stress-${viewport.width}-${viewport.height}`)
      await dialog.getByRole('button', { name: 'Rooms' }).click()
      dialog = page.getByRole('dialog', { name: 'Rooms' })
      await expectStableGeometry(dialog, baseline, `${viewport.width}x${viewport.height} Rooms`)
    }

    await gotoPath(page, 'overview', {
      height: 852,
      insets: { bottom: 34, left: 0, right: 0, top: 59 },
      width: 393,
    })
    await openQuickLinksTab(page)
    const dialog = page.getByRole('dialog', { name: 'Quick Links' })
    const portraitStart = await markGeometry(dialog, 'quick-rotation')
    await resizeViewport(page, LANDSCAPE_LEFT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
    expect((await geometrySnapshot(dialog)).geometryIntent).toBe(portraitStart.geometryIntent)
    await resizeViewport(page, {
      height: 852,
      insets: { bottom: 34, left: 0, right: 0, top: 59 },
      width: 393,
    })
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await page.waitForTimeout(520)
    const portraitEnd = await geometrySnapshot(dialog)
    expect(Math.abs(portraitEnd.width - portraitStart.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(portraitEnd.height - portraitStart.height)).toBeLessThanOrEqual(1)
  })
})
