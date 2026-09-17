// @covers src/components/hass/VacuumCard.module.css
// @covers src/components/hass/VacuumCard.tsx
// @covers src/components/core/ModalTabNav.module.css
// @covers src/components/core/ModalTabNav.tsx
import type { TestInfo } from '@playwright/test'
import { expect, test, type Page } from './layout/fixture'
import { waitForModalReady } from './layout/evidence'
import { NINE_ROOM_VACUUM_OUTCOME_CONTRACT } from '../src/test/fixtures/vacuumOutcomes'

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

async function waitForVacuumLayoutReady(dialog: ReturnType<Page['getByRole']>) {
  // A map that never loads holds the modal spinner for the shared 10s page-load timeout.
  await expect(dialog.locator('[data-layout-preparation-phase]')).toHaveAttribute('data-layout-preparation-phase', 'content', { timeout: 15_000 })
}

async function expectLocateUnavailable(dialog: ReturnType<Page['getByRole']>, mapPaneName: string) {
  const locate = dialog.getByRole('button', { name: 'Locate' })
  const mapPane = dialog.getByRole('group', { name: mapPaneName })
  const [layout, viewportLayout] = await Promise.all([
    mapPane.getAttribute('data-map-status-layout'),
    mapPane.getAttribute('data-vacuum-viewport-layout'),
  ])
  if (layout === 'split' || viewportLayout === 'tall-landscape') {
    await expect(locate).toBeDisabled()
    return
  }
  await expect(locate).toHaveCount(0)
}

async function setMusicVacuumUnavailable(page: Page) {  await page.evaluate(() => {
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

async function setMainFloorVacuumRuntime(page: Page, {
  error = 'No error',
  state,
  statusFlag = 'none',
}: {
  error?: string
  state: string
  statusFlag?: string
}) {
  await page.evaluate(({ error, state, statusFlag }) => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', state)
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_error', error)
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_status_flag', statusFlag)
    mock.calls.splice(0, mock.calls.length)
  }, { error, state, statusFlag })
}

async function setMainFloorDockStatus(page: Page, dockStatus: string) {
  await page.evaluate((state) => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_dock_status', state)
    mock.calls.splice(0, mock.calls.length)
  }, dockStatus)
}

async function mainFloorTabLabels(dialog: ReturnType<Page['getByRole']>) {
  return dialog.getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute('aria-label')))
}

async function mainFloorTabPositions(dialog: ReturnType<Page['getByRole']>) {
  return dialog.getByRole('tab').evaluateAll((tabs) => Object.fromEntries(tabs.map((tab) => {
    const label = tab.getAttribute('aria-label') ?? tab.textContent?.trim() ?? ''
    const rect = tab.getBoundingClientRect()
    return [label, { left: rect.left, width: rect.width }]
  })))
}

async function mainFloorTabContentMetrics(dialog: ReturnType<Page['getByRole']>, label: string) {
  return dialog.getByRole('tab', { name: label }).evaluate((tab) => {
    const rect = tab.getBoundingClientRect()
    const content = tab.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
    if (!(content instanceof HTMLElement)) throw new Error('Vacuum tab content is missing')
    const contentStyle = getComputedStyle(content)
    const iconNode = tab.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
    const iconStyle = iconNode ? getComputedStyle(iconNode) : null
    const labelNode = tab.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
    const labelStyle = labelNode ? getComputedStyle(labelNode) : null
    return {
      columnGap: Number.parseFloat(contentStyle.columnGap || '0'),
      contentOpacity: Number.parseFloat(contentStyle.opacity || '1'),
      contentTransition: content.style.transition,
      iconOpacity: iconStyle ? Number.parseFloat(iconStyle.opacity || '1') : null,
      inlineWidth: tab.style.width ? Number.parseFloat(tab.style.width) : null,
      justifySelf: tab.style.justifySelf,
      left: rect.left,
      labelDisplay: labelStyle?.display ?? null,
      labelOpacity: labelStyle ? Number.parseFloat(labelStyle.opacity || '1') : null,
      transform: tab.style.transform,
      transition: tab.style.transition,
      width: rect.width,
    }
  })
}

async function captureTabNavScreenshot(
  nav: ReturnType<Page['getByRole']>,
  testInfo: TestInfo,
  filename: string,
) {
  const screenshotPath = testInfo.outputPath(filename)
  await nav.screenshot({
    animations: 'allow',
    path: screenshotPath,
    scale: 'css',
  })
  return screenshotPath
}

async function captureMainFloorTabWidthTrace(
  nav: ReturnType<Page['getByRole']>,
  label: string,
  phase: 'expand-layout' | 'shrink-layout',
) {
  return nav.evaluate((element, { label, phase }) => new Promise<{
    end: {
      inlineWidth: number | null
      justifySelf: string
      phase: string | null
      transform: string
      transition: string
      width: number
    } | null
    samples: {
      inlineWidth: number | null
      justifySelf: string
      phase: string | null
      time: number
      transform: string
      transition: string
      width: number
    }[]
  }>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Timed out waiting for ${phase} width trace`))
    }, 2_000)

    const read = () => {
      const tab = element.querySelector<HTMLElement>(`[role="tab"][aria-label="${label}"]`)
      if (!(tab instanceof HTMLElement)) return null
      const rect = tab.getBoundingClientRect()
      return {
        inlineWidth: tab.style.width ? Number.parseFloat(tab.style.width) : null,
        justifySelf: tab.style.justifySelf,
        phase: element.getAttribute('data-membership-phase'),
        time: performance.now(),
        transform: tab.style.transform,
        transition: tab.style.transition,
        width: rect.width,
      }
    }

    const samples: {
      inlineWidth: number | null
      justifySelf: string
      phase: string | null
      time: number
      transform: string
      transition: string
      width: number
    }[] = []

    const finish = () => {
      window.clearTimeout(timeoutId)
      observer.disconnect()
      const endSnapshot = read()
      resolve({
        end: endSnapshot ? {
          inlineWidth: endSnapshot.inlineWidth,
          justifySelf: endSnapshot.justifySelf,
          phase: endSnapshot.phase,
          transform: endSnapshot.transform,
          transition: endSnapshot.transition,
          width: endSnapshot.width,
        } : null,
        samples,
      })
    }

    const sample = () => {
      const snapshot = read()
      if (!snapshot) {
        finish()
        return
      }
      samples.push(snapshot)
      if (element.getAttribute('data-membership-phase') === phase) {
        window.requestAnimationFrame(sample)
        return
      }
      finish()
    }

    const observer = new MutationObserver(() => {
      if (element.getAttribute('data-membership-phase') !== phase) return
      observer.disconnect()
      window.requestAnimationFrame(sample)
    })

    if (element.getAttribute('data-membership-phase') === phase) {
      window.requestAnimationFrame(sample)
      return
    }

    observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
  }), { label, phase })
}

async function captureMainFloorTabFadeTrace(
  nav: ReturnType<Page['getByRole']>,
  phase: 'expand-fade' | 'shrink-fade',
) {
  return nav.evaluate((element, phase) => new Promise<{
    end: {
      items: {
        contentOpacity: number | null
        iconOpacity: number | null
        key: string
        labelDisplay: string | null
        labelOpacity: number | null
        left: number
        opacity: number
        text: string
        top: number
      }[]
      navHeight: number
      navTop: number
      phase: string | null
      time: number
    } | null
    samples: {
      items: {
        contentOpacity: number | null
        iconOpacity: number | null
        key: string
        labelDisplay: string | null
        labelOpacity: number | null
        left: number
        opacity: number
        text: string
        top: number
      }[]
      navHeight: number
      navTop: number
      phase: string | null
      time: number
    }[]
  }>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Timed out waiting for ${phase} opacity trace`))
    }, 2_000)

    const snapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
        const contentStyle = contentNode ? getComputedStyle(contentNode) : null
        const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
        const iconStyle = iconNode ? getComputedStyle(iconNode) : null
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const labelStyle = labelNode ? getComputedStyle(labelNode) : null
        const nodeStyle = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return {
          contentOpacity: contentStyle ? Number.parseFloat(contentStyle.opacity || '1') : null,
          iconOpacity: iconStyle ? Number.parseFloat(iconStyle.opacity || '1') : null,
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelStyle?.display ?? null,
          labelOpacity: labelStyle ? Number.parseFloat(labelStyle.opacity || '1') : null,
          left: rect.left,
          opacity: Number.parseFloat(nodeStyle.opacity || '1'),
          text: node.textContent?.trim() ?? '',
          top: rect.top,
        }
      }),
      navHeight: element.getBoundingClientRect().height,
      navTop: element.getBoundingClientRect().top,
      phase: element.getAttribute('data-membership-phase'),
      time: performance.now(),
    })

    const samples: {
      items: {
        contentOpacity: number | null
        iconOpacity: number | null
        key: string
        labelDisplay: string | null
        labelOpacity: number | null
        left: number
        opacity: number
        text: string
        top: number
      }[]
      navHeight: number
      navTop: number
      phase: string | null
      time: number
    }[] = []

    const finish = () => {
      window.clearTimeout(timeoutId)
      observer.disconnect()
      resolve({
        end: snapshot(),
        samples,
      })
    }

    const sample = () => {
      samples.push(snapshot())
      if (element.getAttribute('data-membership-phase') === phase) {
        window.requestAnimationFrame(sample)
        return
      }
      finish()
    }

    const observer = new MutationObserver(() => {
      if (element.getAttribute('data-membership-phase') !== phase) return
      observer.disconnect()
      window.requestAnimationFrame(sample)
    })

    if (element.getAttribute('data-membership-phase') === phase) {
      window.requestAnimationFrame(sample)
      return
    }

    observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
  }), phase)
}

async function mainFloorTabNavSnapshot(dialog: ReturnType<Page['getByRole']>) {
  return dialog.getByRole('tablist', { name: 'Main Floor modal sections' }).evaluate((element) => {
    const navRect = element.getBoundingClientRect()
    const items = [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
      const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
      const contentStyle = contentNode ? getComputedStyle(contentNode) : null
      const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
      const iconStyle = iconNode ? getComputedStyle(iconNode) : null
      const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
      const labelStyle = labelNode ? getComputedStyle(labelNode) : null
      const accessoryNode = node.querySelector<HTMLElement>('[data-modal-tab-accessory="true"]')
      const accessoryStyle = accessoryNode ? getComputedStyle(accessoryNode) : null
      const nodeStyle = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return {
        key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
        accessoryOpacity: accessoryStyle ? Number.parseFloat(accessoryStyle.opacity || '1') : null,
        contentOpacity: contentStyle ? Number.parseFloat(contentStyle.opacity || '1') : null,
        iconOpacity: iconStyle ? Number.parseFloat(iconStyle.opacity || '1') : null,
        labelDisplay: labelStyle?.display ?? null,
        labelOpacity: labelStyle ? Number.parseFloat(labelStyle.opacity || '1') : null,
        left: rect.left,
        opacity: Number.parseFloat(nodeStyle.opacity || '1'),
        text: node.textContent?.trim() ?? '',
        top: rect.top,
      }
    })

    return {
      items,
      navHeight: navRect.height,
      navTop: navRect.top,
      phase: element.getAttribute('data-membership-phase'),
    }
  })
}

function findTabSnapshotItem(
  snapshot: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>>,
  kind: 'ghost' | 'tab',
  label: string,
) {
  const normalizedLabel = label.toLowerCase()
  const aliases = normalizedLabel === 'rooms'
    ? ['rooms', 'zones']
    : normalizedLabel === 'actions'
      ? ['actions', 'more']
      : [normalizedLabel]
  return snapshot.items.find((item) => (
    aliases.some((alias) => item.key.toLowerCase() === `${kind}:${alias}`)
    || aliases.some((alias) => item.text.toLowerCase() === alias)
  )) ?? null
}

async function waitForTabNavSnapshot(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  predicate: (snapshot: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>>) => boolean,
  description: string,
) {
  let lastSnapshot: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null = null
  const deadline = Date.now() + 4_000
  while (Date.now() < deadline) {
    const snapshot = await mainFloorTabNavSnapshot(dialog)
    lastSnapshot = snapshot
    if (predicate(snapshot)) return snapshot
    await page.waitForTimeout(16)
  }
  throw new Error(`Timed out waiting for ${description}. Last phase: ${lastSnapshot?.phase ?? 'unknown'}`)
}

async function openUnavailableMusicVacuum(page: Page, path = '/at-a-glance/vacuums') {
  await page.goto(path)
  await setMusicVacuumUnavailable(page)
  await page.getByRole('button', { name: 'Music Room Unavailable', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)
  return dialog
}

async function assertUnavailableAccuracy(page: Page) {
  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)
  await expect(dialog.getByLabel('Unavailable')).toHaveCount(0)
  const battery = dialog.getByText('Battery').locator('xpath=ancestor::*[@data-icon][1]')
  await expect(battery).toContainText('Unknown')
  await expect(battery).toHaveAttribute('data-tone', 'unavailable')
  await expect(dialog.getByRole('group', { name: 'Dock Status Unknown' })).toBeVisible()
  const map = dialog.getByRole('region', { name: 'Music Room Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'reported')
  await expect(map).toHaveAttribute('data-loaded', 'true')
  const note = dialog.locator('[data-map-reported-note="true"]')
  await expect(note).toHaveAttribute('data-icon', 'mdi:alert-outline')
  await expect(note).toContainText('Last Reported Position')
  await expect(note).toContainText('The exact report time is unknown, and the vacuum may have been moved since then.')
  const noteColors = await note.evaluate((element) => ({
    body: getComputedStyle(element.querySelector('small')!).color,
    title: getComputedStyle(element.querySelector('strong')!).color,
  }))
  expect(noteColors.body).toBe(noteColors.title)
  const reportedStatus = dialog.locator('[data-vacuum-reported-status="true"]')
  const viewport = page.viewportSize()
  if (viewport && viewport.width > viewport.height) await expect(reportedStatus).toHaveCount(1)
  if (await reportedStatus.count()) {
    await expect(reportedStatus.locator('[data-map-reported-note="true"]')).toBeVisible()
    await expect(reportedStatus.getByText('Battery')).toBeVisible()
    await expect(reportedStatus.locator('xpath=ancestor::*[@data-scroll-region="vacuum-panel"]')).toHaveCount(1)
    const mapPane = dialog.getByRole('group', { name: 'Music Room map and status' })
    const [mapPaneBox, reportedStatusBox] = await Promise.all([mapPane.boundingBox(), reportedStatus.boundingBox()])
    expect(mapPaneBox).not.toBeNull()
    expect(reportedStatusBox).not.toBeNull()
    expect(reportedStatusBox!.x).toBeGreaterThanOrEqual(mapPaneBox!.x + mapPaneBox!.width - 1)
    await expect(mapPane.locator('[data-map-reported-note="true"]')).toHaveCount(0)
  } else {
    const targets = await Promise.all([map.elementHandle(), note.elementHandle()])
    try {
      // Resolve identities first; both rectangles are sampled in one browser task.
      const [mapBox, noteBox] = await dialog.evaluate((element, targets) => targets.map((target) => {
        if (!target || !element.contains(target) || !target.getClientRects().length) return null
        const rect = target.getBoundingClientRect()
        const style = getComputedStyle(target)
        if (rect.width <= 0 || rect.height <= 0 || style.visibility !== 'visible') return null
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }), targets)
      expect(mapBox).not.toBeNull()
      expect(noteBox).not.toBeNull()
      expect(noteBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height)
    } finally {
      await Promise.all(targets.map((target) => target?.dispose()))
    }
  }
  await expect(map.locator('[data-map-editor-overlay="true"]')).toHaveCount(0)
  await expect(dialog.getByText('Map Unavailable')).toHaveCount(0)
  await expectLocateUnavailable(dialog, 'Music Room map and status')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/battery is critically low/i)).toHaveCount(0)
  await expect(dialog.locator('[data-vacuum-live-status="true"]')).toContainText("Unavailable. Home Assistant does not have the vacuum's current status.")
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

for (const landscape of [
  { label: '568x320 skinny landscape', layout: 'split', viewport: { height: 320, width: 568 } },
  { label: '667x375 skinny landscape', layout: 'split', viewport: { height: 375, width: 667 } },
  { label: '734x343 skinny landscape', layout: 'split', viewport: { height: 343, width: 734 } },
  { label: '852x393 short landscape', layout: 'split', viewport: { height: 393, width: 852 } },
  { label: '1440x900 tall landscape', layout: 'stacked', viewport: { height: 900, width: 1440 } },
  { label: '804x824 dialog', layout: 'stacked', viewport: { height: 824, width: 804 } },
] as const) {
  test(`Theater Room uses the right pane for its reported position and unavailable status in ${landscape.label}`, async ({ page }) => {
    await page.setViewportSize(landscape.viewport)
    await page.goto('/at-a-glance/theater-room')
    await page.evaluate(() => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      mock.setEntityState('vacuum.valetudo_politefatherlykingfisher', 'unavailable')
      mock.setEntityState('sensor.valetudo_politefatherlykingfisher_battery_level', 'unavailable')
      mock.setEntityState('sensor.valetudo_politefatherlykingfisher_error', 'unavailable')
      mock.setEntityState('sensor.valetudo_politefatherlykingfisher_status_flag', 'unavailable')
      mock.setEntityState('sensor.valetudo_politefatherlykingfisher_dock_status', 'unavailable')
      mock.setEntityState('camera.valetudo_politefatherlykingfisher_map_data', 'unavailable')
      mock.calls.splice(0, mock.calls.length)
    })
    await page.getByRole('button', { name: 'Theater Room Unavailable', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await waitForModalReady(dialog, undefined, 'vacuum-tabs')
    await waitForVacuumLayoutReady(dialog)

    const mapPane = dialog.getByRole('group', { name: 'Theater Room map and status' })
    const reportedStatus = dialog.locator('[data-vacuum-reported-status="true"]')
    await expect(mapPane).toHaveAttribute('data-map-status-layout', /^(split|stacked)$/)
    await expect(dialog.locator('[data-area-editor="false"]')).toHaveAttribute('data-reported-status-pane', 'right')
    await expect.poll(() => dialog.locator('[data-area-editor="false"]').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    ))).toBe(2)
    const [mapPaneBox, reportedStatusBox] = await Promise.all([mapPane.boundingBox(), reportedStatus.boundingBox()])
    expect(mapPaneBox).not.toBeNull()
    expect(reportedStatusBox).not.toBeNull()
    expect(reportedStatusBox!.x).toBeGreaterThanOrEqual(mapPaneBox!.x + mapPaneBox!.width - 1)
    await expect(reportedStatus.locator('[data-map-reported-note="true"]')).toContainText('Last Reported Position')
    await expect(reportedStatus.getByText('Battery')).toBeVisible()
    await expect(reportedStatus.locator('xpath=ancestor::*[@data-scroll-region="vacuum-panel"]')).toHaveCount(1)
    await expect(mapPane.locator('[data-map-reported-note="true"]')).toHaveCount(0)
    await expect(mapPane.locator('[data-vacuum-status-details="true"]')).toHaveCount(0)
    expect(await page.evaluate(() => window.__mockHass?.calls ?? [])).toEqual([])
  })
}

test('Main Floor keeps its cleaning report in the right pane at 804x824', async ({ page }) => {
  await page.setViewportSize({ height: 824, width: 804 })
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate((contract) => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityAttribute('sensor.main_floor_vacuum_coordinator_session_state', 'while_away_outcomes', contract)
    mock.calls.splice(0, mock.calls.length)
  }, structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT))
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
  const reportHeading = dialog.getByRole('heading', { name: 'Main Floor Cleaning Report' })
  await expect(reportHeading).toBeVisible()
  await expect(reportHeading.locator('xpath=ancestor::*[@data-scroll-region="vacuum-panel"]')).toHaveCount(1)
  await expect(mapPane.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toHaveCount(0)

  const [mapPaneBox, reportBox] = await Promise.all([mapPane.boundingBox(), reportHeading.boundingBox()])
  expect(mapPaneBox).not.toBeNull()
  expect(reportBox).not.toBeNull()
  expect(reportBox!.x).toBeGreaterThanOrEqual(mapPaneBox!.x + mapPaneBox!.width - 1)
})

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
      { height: 320, width: 568 },
      { height: 393, width: 852 },
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

test('vacuum map and status reflow through a fade when modal height becomes constrained', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
  const controlsPane = dialog.getByRole('group', { name: /Main Floor controls/ })
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'stacked')
  await expect(map).toHaveAttribute('data-map-display', 'fitted')
  await expect(mapPane.getByRole('heading', { name: 'Status' })).toHaveCount(0)
  await expect(mapPane.getByRole('heading', { name: 'Actions' })).toHaveCount(0)
  await expect(mapPane.locator('[data-vacuum-map-status-controls="true"]')).toBeHidden()
  await expect(mapPane.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Locate' })).toBeVisible()
  const tallGeometry = await mapPane.evaluate((element) => {
    const map = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
    const paneRect = element.getBoundingClientRect()
    const mapRect = map?.getBoundingClientRect()
    return {
      mapCenterDelta: mapRect
        ? Math.abs((mapRect.left + mapRect.width / 2) - (paneRect.left + paneRect.width / 2))
        : Number.POSITIVE_INFINITY,
      mapHeight: mapRect?.height ?? 0,
      paneHeight: paneRect.height,
      scrollOverflow: element.scrollHeight - element.clientHeight,
    }
  })
  expect(tallGeometry.mapCenterDelta).toBeLessThanOrEqual(1)
  expect(tallGeometry.mapHeight).toBeGreaterThanOrEqual(tallGeometry.paneHeight - 1)
  expect(tallGeometry.scrollOverflow).toBeLessThanOrEqual(1)

  await mapPane.evaluate((element) => {
    const target = element as HTMLElement
    const runtime = window as typeof window & {
      __vacuumLayoutObserver?: MutationObserver
      __vacuumLayoutTrace?: { layout: string | null; opacity: string; transition: string | null }[]
    }
    runtime.__vacuumLayoutTrace = []
    const record = () => runtime.__vacuumLayoutTrace?.push({
      layout: target.getAttribute('data-map-status-layout'),
      opacity: getComputedStyle(target).opacity,
      transition: target.getAttribute('data-map-status-layout-transition'),
    })
    runtime.__vacuumLayoutObserver?.disconnect()
    runtime.__vacuumLayoutObserver = new MutationObserver(record)
    runtime.__vacuumLayoutObserver.observe(target, {
      attributeFilter: ['data-map-status-layout', 'data-map-status-layout-transition'],
      attributes: true,
    })
    record()
  })

  await page.setViewportSize({ height: 393, width: 852 })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'split')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')
  await expect(map).toHaveAttribute('data-map-display', 'fitted')
  await expect(mapPane.getByRole('heading', { name: 'Status' })).toHaveCount(0)
  await expect(mapPane.getByRole('heading', { name: 'Actions' })).toHaveCount(0)
  const compactLocate = controlsPane.getByRole('button', { name: 'Locate' })
  await expect(compactLocate).toHaveCount(1)
  await expect(mapPane.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(mapPane.getByRole('group', { name: 'Dock Status Idle' })).toHaveCount(0)
  const compactDockStatus = controlsPane.getByRole('group', { name: 'Dock Status Idle' })
  await expect(compactDockStatus).toBeVisible()
  await expect(controlsPane).toBeVisible()
  await expect(mapPane.locator('[data-vacuum-map-status-controls="true"]')).toBeHidden()
  await page.evaluate(() => {
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.splice(0)
  })
  await compactLocate.click()
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .some((call) => call.domain === 'vacuum' && call.service === 'locate' && call.target === 'vacuum.valetudo_exaltedsneakydeer')
  ))).toBe(true)
  const compactGeometry = await mapPane.evaluate((element) => {
    const map = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
    const paneRect = element.getBoundingClientRect()
    const mapRect = map?.getBoundingClientRect()
    const mapStageRect = element.querySelector<HTMLElement>('[data-vacuum-map-stage="true"]')?.getBoundingClientRect()
    const naturalAspect = map ? Number.parseFloat(getComputedStyle(map).getPropertyValue('--map-aspect-ratio')) : 0
    return {
      mapAspect: mapRect ? mapRect.width / mapRect.height : 0,
      mapCenterDelta: mapRect && mapStageRect
        ? Math.abs((mapRect.left + mapRect.width / 2) - (mapStageRect.left + mapStageRect.width / 2))
        : Number.POSITIVE_INFINITY,
      naturalAspect,
      mapHeight: mapRect?.height,
      mapWidth: mapRect?.width,
      paneHeight: paneRect.height,
      paneWidth: paneRect.width,
      paneBottom: paneRect.bottom,
      scrollOverflow: element.scrollHeight - element.clientHeight,
    }
  })
  expect(compactGeometry.scrollOverflow).toBeLessThanOrEqual(1)
  expect(compactGeometry.naturalAspect).toBeGreaterThan(0)
  expect(compactGeometry.mapAspect).toBeCloseTo(compactGeometry.naturalAspect, 1)
  expect(compactGeometry.mapCenterDelta).toBeLessThanOrEqual(1)
  expect(compactGeometry.mapHeight).toBeGreaterThanOrEqual((compactGeometry.paneHeight ?? 0) - 1)
  expect(compactGeometry.mapWidth).toBeLessThanOrEqual((compactGeometry.paneWidth ?? 0) + 1)
  expect(tallGeometry.mapHeight).toBeGreaterThan(compactGeometry.mapHeight ?? 0)

  await page.setViewportSize({ height: 343, width: 852 })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'split')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')
  await expect.poll(() => map.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(compactGeometry.mapHeight ?? 0)
  const shorterGeometry = await mapPane.evaluate((element) => {
    const modalBody = element.closest<HTMLElement>('[data-modal-sheet-body="true"]')
    const map = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
    const mapRect = map?.getBoundingClientRect()
    const paneRect = element.getBoundingClientRect()
    const bodyRect = modalBody?.getBoundingClientRect()
    const naturalAspect = map ? Number.parseFloat(getComputedStyle(map).getPropertyValue('--map-aspect-ratio')) : 0
    return {
      bodyBottom: bodyRect?.bottom,
      mapAspect: mapRect ? mapRect.width / mapRect.height : 0,
      naturalAspect,
      mapHeight: mapRect?.height,
      mapWidth: mapRect?.width,
      paneBottom: paneRect.bottom,
      scrollOverflow: element.scrollHeight - element.clientHeight,
      statusOverflow: (() => {
        const controls = element.querySelector<HTMLElement>('[data-vacuum-map-status-controls="true"]')
        return controls ? controls.scrollHeight - controls.clientHeight : 0
      })(),
    }
  })
  expect(shorterGeometry.mapAspect).toBeCloseTo(shorterGeometry.naturalAspect, 1)
  expect(shorterGeometry.mapHeight).toBeLessThan(compactGeometry.mapHeight ?? 0)
  expect(shorterGeometry.mapWidth).toBeLessThan(compactGeometry.mapWidth ?? 0)
  expect((shorterGeometry.mapWidth ?? 0) / (compactGeometry.mapWidth ?? 1)).toBeCloseTo(
    (shorterGeometry.mapHeight ?? 0) / (compactGeometry.mapHeight ?? 1),
    2,
  )
  expect(shorterGeometry.paneBottom).toBeLessThanOrEqual((shorterGeometry.bodyBottom ?? 0) + 1)
  expect(shorterGeometry.scrollOverflow).toBeLessThanOrEqual(1)
  expect(shorterGeometry.statusOverflow).toBeLessThanOrEqual(1)

  const trace = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumLayoutObserver?: MutationObserver
      __vacuumLayoutTrace?: { layout: string | null; opacity: string; transition: string | null }[]
    }
    runtime.__vacuumLayoutObserver?.disconnect()
    return runtime.__vacuumLayoutTrace ?? []
  })
  const firstSplit = trace.findIndex((entry) => entry.layout === 'split')
  expect(firstSplit).toBeGreaterThan(0)
  expect(trace.slice(0, firstSplit)).toContainEqual(expect.objectContaining({ layout: 'stacked', transition: 'exiting' }))
  expect(trace[firstSplit]).toMatchObject({ layout: 'split', opacity: '0', transition: 'pre-entering' })

  await page.setViewportSize({ height: 852, width: 393 })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'stacked')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')
  await expect(map).toHaveAttribute('data-map-display', 'contained')
  await expect(dialog.locator('[data-area-editor="false"]')).not.toHaveAttribute('data-map-status-layout', 'split')
  await expect.poll(() => dialog.locator('[data-area-editor="false"]').evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ))).toBe(1)

  await page.setViewportSize({ height: 900, width: 1440 })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'stacked')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')
  await expect(map).toHaveAttribute('data-map-display', 'fitted')
  await expect(mapPane.getByRole('heading', { name: 'Status' })).toHaveCount(0)
  await expect(mapPane.getByRole('heading', { name: 'Actions' })).toHaveCount(0)
  await expect(mapPane.locator('[data-vacuum-map-status-controls="true"]')).toBeHidden()
  await expect(mapPane.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Locate' })).toBeVisible()
})

test('compact near-square landscape gives the empty status row back to the vacuum map', async ({ page }) => {
  await page.setViewportSize({ height: 682, width: 776 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
  await expect(dialog).toHaveAttribute('data-landscape-density', 'compact')
  await expect(dialog).toHaveAttribute('data-modal-body-tier', 'standard')

  const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
  const statusControls = mapPane.locator('[data-vacuum-map-status-controls="true"]')
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'split')
  await expect(statusControls).toBeHidden()
  await expect(dialog.getByRole('group', { name: /Main Floor controls/ }).getByRole('button', { name: 'Locate' })).toBeVisible()

  const geometry = await mapPane.evaluate((element) => {
    const map = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
    const paneRect = element.getBoundingClientRect()
    const mapRect = map?.getBoundingClientRect()
    return {
      mapHeight: mapRect?.height ?? 0,
      paneHeight: paneRect.height,
      scrollOverflow: element.scrollHeight - element.clientHeight,
    }
  })
  expect(geometry.mapHeight).toBeGreaterThanOrEqual(geometry.paneHeight - 1)
  expect(geometry.scrollOverflow).toBeLessThanOrEqual(1)
})

test('a short landscape vacuum modal opens without overlap and keeps its layout after Area', async ({ page }) => {
  await page.setViewportSize({ height: 393, width: 852 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  const mapPane = dialog.getByRole('group', { name: 'Main Floor map and status' })
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'split')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')

  const openingOverlap = await mapPane.evaluate((element) => {
    const mapRect = element.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')?.getBoundingClientRect()
    const paneRect = element.getBoundingClientRect()
    return mapRect ? mapRect.bottom - paneRect.bottom : Number.POSITIVE_INFINITY
  })
  expect(openingOverlap).toBeLessThanOrEqual(0)
  await expect(mapPane.getByRole('button', { name: 'Locate' })).toHaveCount(0)
  await expect(dialog.getByRole('group', { name: /Main Floor controls/ }).getByRole('button', { name: 'Locate' })).toBeVisible()

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await expect(dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })).toBeVisible()
  await dialog.getByRole('button', { name: /Back/ }).click()
  await expect(mapPane).toHaveAttribute('data-map-status-layout', 'split')
  await expect(mapPane).toHaveAttribute('data-map-status-layout-transition', 'idle')
  await expect(dialog.getByRole('region', { name: 'Main Floor Valetudo map' })).toHaveAttribute('data-map-display', 'fitted')
})

test('room map taps preserve cleaning order and confirm Rooms-Area conflicts', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await dialog.getByRole('button', { name: 'Kitchen' }).click()
  await dialog.getByRole('button', { name: 'Living Room' }).click()
  await dialog.getByRole('tab', { name: 'Controls' }).click()
  await page.waitForTimeout(600)

  const kitchenMarker = dialog.locator('[data-room-entity-id="input_boolean.roborock_kitchen_toggle"]')
  const livingMarker = dialog.locator('[data-room-entity-id="input_boolean.roborock_living_room_toggle"]')
  await expect(kitchenMarker).toHaveAttribute('data-room-order', '1')
  await expect(livingMarker).toHaveAttribute('data-room-order', '2')
  const kitchenBox = await kitchenMarker.boundingBox()
  expect(kitchenBox).not.toBeNull()
  await page.mouse.click(kitchenBox!.x + kitchenBox!.width / 2, kitchenBox!.y + kitchenBox!.height / 2)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toContainEqual({
    domain: 'input_boolean',
    service: 'turn_off',
    target: 'input_boolean.roborock_kitchen_toggle',
  })

  await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.splice(0))
  const areaButton = dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' })
  page.once('dialog', (confirmation) => confirmation.dismiss())
  await areaButton.click()
  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Area' })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])

  page.once('dialog', (confirmation) => confirmation.accept())
  await areaButton.click()
  await expect(dialog.getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toContainEqual({
    domain: 'input_boolean',
    service: 'turn_off',
    target: 'input_boolean.roborock_living_room_toggle',
  })

  const areaEditor = dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })
  const areaBox = await areaEditor.boundingBox()
  expect(areaBox).not.toBeNull()
  await page.mouse.move(areaBox!.x + areaBox!.width * 0.38, areaBox!.y + areaBox!.height * 0.38)
  await page.mouse.down()
  await page.mouse.move(areaBox!.x + areaBox!.width * 0.62, areaBox!.y + areaBox!.height * 0.62, { steps: 5 })
  await page.mouse.up()
  await dialog.getByRole('button', { name: 'Use This Area' }).click()
  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls.splice(0))

  let roomsConfirmation = ''
  page.once('dialog', async (confirmation) => {
    roomsConfirmation = confirmation.message()
    await confirmation.dismiss()
  })
  await dialog.getByRole('button', { name: 'Living Room' }).click()
  expect(roomsConfirmation).toBe('Switch to Rooms\n\nYou have an area drawn right now. Switching to Rooms will discard that area. Are you sure you want to continue?')
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])

  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Living Room' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toContainEqual({
    domain: 'input_boolean',
    service: 'turn_on',
    target: 'input_boolean.roborock_living_room_toggle',
  })
})

test('runtime mode changes immediately retarget hidden tabs and preserve auto-clean selection', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)
  const dialogId = await dialog.getAttribute('id')

  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })

  await expect(page.getByRole('dialog')).toHaveAttribute('id', dialogId ?? '')
  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Auto-Clean', 'Info'])
  await expect(dialog.getByRole('tab', { name: 'Controls', selected: true })).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'Rooms' })).toHaveCount(0)
  await expect(dialog.getByRole('tab', { name: 'Actions' })).toHaveCount(0)
  await expect(dialog.getByRole('tab', { name: 'Info' })).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Cleaning target' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Stop' })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'docked' })
  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
  await expect(dialog.getByRole('tab', { name: 'Controls', selected: true })).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toHaveCount(0)

  await dialog.getByRole('tab', { name: 'Auto-Clean' }).click()
  await expect(dialog.getByRole('tab', { name: 'Auto-Clean', selected: true })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'returning' })
  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Auto-Clean', 'Info'])
  await expect(dialog.getByRole('tab', { name: 'Auto-Clean', selected: true })).toBeVisible()

  await dialog.getByRole('tab', { name: 'Info' }).click()
  await expect(dialog.getByRole('tab', { name: 'Info', selected: true })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'docked' })
  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
  await expect(dialog.getByRole('tab', { name: 'Info', selected: true })).toBeVisible()
})

test('tab membership shrink waits for the fade phase before surviving tabs shift left', async ({ page, browserName }) => {
  await page.setViewportSize({ height: 375, width: 667 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  await nav.evaluate((element) => {
    const runtime = window as typeof window & {
      __vacuumShrinkLayout667Observer?: MutationObserver
      __vacuumShrinkLayout667Snapshot?: {
        items: {
          contentOpacity: number | null
          iconOpacity: number | null
          key: string
          labelDisplay: string | null
          labelOpacity: number | null
          text: string
        }[]
      } | null
      __vacuumTabNavObserver?: MutationObserver
      __vacuumTabNavPhaseSnapshots?: Record<string, {
        items: {
          key: string
          labelDisplay: string | null
          left: number
          opacity: number
          top: number
        }[]
        navHeight: number
        navTop: number
      }>
    }
    const snapshot = () => {
      const navRect = element.getBoundingClientRect()
      const items = [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const labelStyle = labelNode ? getComputedStyle(labelNode) : null
        const nodeStyle = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return {
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelStyle?.display ?? null,
          left: rect.left,
          opacity: Number.parseFloat(nodeStyle.opacity || '1'),
          top: rect.top,
        }
      })
      return {
        items,
        navHeight: navRect.height,
        navTop: navRect.top,
      }
    }
    const shrinkLayoutSnapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
        return {
          contentOpacity: contentNode ? Number.parseFloat(getComputedStyle(contentNode).opacity || '1') : null,
          iconOpacity: iconNode ? Number.parseFloat(getComputedStyle(iconNode).opacity || '1') : null,
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelNode ? getComputedStyle(labelNode).display : null,
          labelOpacity: labelNode ? Number.parseFloat(getComputedStyle(labelNode).opacity || '1') : null,
          text: node.textContent?.trim() ?? '',
        }
      }),
    })
    const record = () => {
      const phase = element.getAttribute('data-membership-phase')
      if (!phase) return
      runtime.__vacuumTabNavPhaseSnapshots ??= {}
      runtime.__vacuumTabNavPhaseSnapshots[phase] ??= snapshot()
      if (phase === 'shrink-layout' && !runtime.__vacuumShrinkLayout667Snapshot) {
        window.setTimeout(() => {
          runtime.__vacuumShrinkLayout667Snapshot = shrinkLayoutSnapshot()
          runtime.__vacuumShrinkLayout667Observer?.disconnect()
        }, 100)
      }
    }
    runtime.__vacuumShrinkLayout667Snapshot = null
    runtime.__vacuumShrinkLayout667Observer?.disconnect()
    runtime.__vacuumShrinkLayout667Observer = new MutationObserver(record)
    runtime.__vacuumShrinkLayout667Observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
    runtime.__vacuumTabNavPhaseSnapshots = {}
    runtime.__vacuumTabNavObserver?.disconnect()
    runtime.__vacuumTabNavObserver = new MutationObserver(record)
    runtime.__vacuumTabNavObserver.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
      childList: true,
      subtree: true,
    })
    record()
  })
  const before = await mainFloorTabPositions(dialog)
  const beforeSnapshot = await mainFloorTabNavSnapshot(dialog)
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Controls')?.labelDisplay).toBe('none')

  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'shrink-fade')
  await expect(nav).toHaveAttribute('data-visual-count', '5')
  await expect(nav).toHaveAttribute('data-semantic-count', '3')
  await expect(dialog.getByRole('tab', { name: 'Controls', selected: true })).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'Rooms' })).toHaveCount(0)
  await expect(dialog.getByRole('tab', { name: 'Actions' })).toHaveCount(0)
  await expect.poll(async () => {
    const snapshot = await mainFloorTabNavSnapshot(dialog)
    const rows = snapshot.items.map((item) => item.top)
    return snapshot.phase === 'shrink-fade'
      && rows.length === 5
      && Math.max(...rows) - Math.min(...rows) <= 1
      && Math.abs(snapshot.navHeight - beforeSnapshot.navHeight) <= 1
      && Math.abs(snapshot.navTop - beforeSnapshot.navTop) <= 1
  }).toBe(true)

  const shrinkFadeEarly = await waitForTabNavSnapshot(page, dialog, (snapshot) => {
    const roomsGhost = findTabSnapshotItem(snapshot, 'ghost', 'Rooms')
    const actionsGhost = findTabSnapshotItem(snapshot, 'ghost', 'Actions')
    return snapshot.phase === 'shrink-fade'
      && (roomsGhost?.contentOpacity ?? -1) > 0.35
      && (roomsGhost?.contentOpacity ?? 1) < 0.95
      && (actionsGhost?.contentOpacity ?? -1) > 0.35
      && (actionsGhost?.contentOpacity ?? 1) < 0.95
  }, 'short-landscape shrink mid-fade content opacity')
  const roomsGhost = findTabSnapshotItem(shrinkFadeEarly, 'ghost', 'Rooms')
  const actionsGhost = findTabSnapshotItem(shrinkFadeEarly, 'ghost', 'Actions')
  expect(roomsGhost?.contentOpacity).toBeGreaterThan(0.35)
  expect(roomsGhost?.contentOpacity).toBeLessThan(0.95)
  expect(roomsGhost?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsGhost?.contentOpacity).toBeGreaterThan(0.35)
  expect(actionsGhost?.contentOpacity).toBeLessThan(0.95)
  expect(actionsGhost?.iconOpacity).toBeCloseTo(1, 4)

  const duringFade = await mainFloorTabPositions(dialog)
  expect(duringFade['Auto-Clean']?.left).toBeCloseTo(before['Auto-Clean']?.left ?? 0, 0)
  expect(duringFade.Info?.left).toBeCloseTo(before.Info?.left ?? 0, 0)

  await page.waitForFunction(() => {
    const runtime = window as typeof window & {
      __vacuumShrinkLayout667Snapshot?: unknown
    }
    return runtime.__vacuumShrinkLayout667Snapshot != null
  })
  const shrinkLayoutSnapshot = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumShrinkLayout667Observer?: MutationObserver
      __vacuumShrinkLayout667Snapshot?: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null
    }
    runtime.__vacuumShrinkLayout667Observer?.disconnect()
    return runtime.__vacuumShrinkLayout667Snapshot
  })
  const controlsLabel = findTabSnapshotItem(shrinkLayoutSnapshot, 'tab', 'Controls')
  expect(controlsLabel?.labelDisplay).toBe('block')
  if (browserName === 'chromium') {
    expect(controlsLabel?.labelOpacity).toBeGreaterThan(0.05)
    expect(controlsLabel?.labelOpacity).toBeLessThan(0.9)
  } else {
    expect(controlsLabel?.labelOpacity).toBeGreaterThanOrEqual(0)
    expect(controlsLabel?.labelOpacity).toBeLessThan(1)
  }
  expect(controlsLabel?.contentOpacity).toBeCloseTo(1, 4)
  expect(controlsLabel?.iconOpacity).toBeCloseTo(1, 4)

  await expect.poll(async () => nav.getAttribute('data-membership-phase')).toBe('idle')
  await expect.poll(async () => (await mainFloorTabContentMetrics(dialog, 'Controls')).labelOpacity ?? 0).toBeGreaterThan(0.9)
  await expect.poll(async () => (await mainFloorTabPositions(dialog)).Info?.left).toBeLessThan((before.Info?.left ?? 0) - 5)
  const phaseSnapshots = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumTabNavObserver?: MutationObserver
      __vacuumTabNavPhaseSnapshots?: Record<string, {
        items: {
          key: string
          labelDisplay: string | null
          left: number
          opacity: number
          top: number
        }[]
        navHeight: number
        navTop: number
      }>
    }
    runtime.__vacuumTabNavObserver?.disconnect()
    return runtime.__vacuumTabNavPhaseSnapshots ?? {}
  })
  const shrinkFadeSnapshot = phaseSnapshots['shrink-fade']
  expect(shrinkFadeSnapshot).toBeTruthy()
  const shrinkFadeRows = shrinkFadeSnapshot.items.map((item) => item.top)
  expect(Math.max(...shrinkFadeRows) - Math.min(...shrinkFadeRows)).toBeLessThanOrEqual(1)
  expect(Math.abs(shrinkFadeSnapshot.navHeight - beforeSnapshot.navHeight)).toBeLessThanOrEqual(1)
  expect(Math.abs(shrinkFadeSnapshot.navTop - beforeSnapshot.navTop)).toBeLessThanOrEqual(1)
  expect(shrinkFadeSnapshot.items.find((item) => item.key === 'tab:Controls')?.labelDisplay).toBe('none')
  const afterSnapshot = await mainFloorTabNavSnapshot(dialog)
  const rows = afterSnapshot.items.map((item) => item.top)
  expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterSnapshot.navHeight - beforeSnapshot.navHeight)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterSnapshot.navTop - beforeSnapshot.navTop)).toBeLessThanOrEqual(1)
  expect(findTabSnapshotItem(afterSnapshot, 'tab', 'Controls')?.labelDisplay).toBe('block')
  expect(findTabSnapshotItem(afterSnapshot, 'tab', 'Controls')?.labelOpacity).toBeCloseTo(1, 1)
})

test('tab membership expansion grows the grid before the new tabs become semantic tabs', async ({ page }) => {
  await page.setViewportSize({ height: 375, width: 667 })
  await page.goto('/at-a-glance/vacuums')
  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })
  await page.getByRole('button', { name: /Main Floor Cleaning/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  await nav.evaluate((element) => {
    const runtime = window as typeof window & {
      __vacuumExpandLayout667Observer?: MutationObserver
      __vacuumExpandLayout667Snapshot?: {
        items: {
          contentOpacity: number | null
          iconOpacity: number | null
          key: string
          labelDisplay: string | null
          labelOpacity: number | null
          text: string
        }[]
      } | null
      __vacuumTabNavObserver?: MutationObserver
      __vacuumTabNavPhaseSnapshots?: Record<string, {
        items: {
          key: string
          labelDisplay: string | null
          left: number
          opacity: number
          top: number
        }[]
      }>
    }
    const snapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const labelStyle = labelNode ? getComputedStyle(labelNode) : null
        const nodeStyle = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return {
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelStyle?.display ?? null,
          left: rect.left,
          opacity: Number.parseFloat(nodeStyle.opacity || '1'),
          top: rect.top,
        }
      }),
    })
    const expandLayoutSnapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
        return {
          contentOpacity: contentNode ? Number.parseFloat(getComputedStyle(contentNode).opacity || '1') : null,
          iconOpacity: iconNode ? Number.parseFloat(getComputedStyle(iconNode).opacity || '1') : null,
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelNode ? getComputedStyle(labelNode).display : null,
          labelOpacity: labelNode ? Number.parseFloat(getComputedStyle(labelNode).opacity || '1') : null,
          text: node.textContent?.trim() ?? '',
        }
      }),
    })
    const record = () => {
      const phase = element.getAttribute('data-membership-phase')
      if (!phase) return
      runtime.__vacuumTabNavPhaseSnapshots ??= {}
      runtime.__vacuumTabNavPhaseSnapshots[phase] ??= snapshot()
      if (phase === 'expand-layout' && !runtime.__vacuumExpandLayout667Snapshot) {
        window.setTimeout(() => {
          runtime.__vacuumExpandLayout667Snapshot = expandLayoutSnapshot()
          runtime.__vacuumExpandLayout667Observer?.disconnect()
        }, 100)
      }
    }
    runtime.__vacuumExpandLayout667Snapshot = null
    runtime.__vacuumExpandLayout667Observer?.disconnect()
    runtime.__vacuumExpandLayout667Observer = new MutationObserver(record)
    runtime.__vacuumExpandLayout667Observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
    runtime.__vacuumTabNavPhaseSnapshots = {}
    runtime.__vacuumTabNavObserver?.disconnect()
    runtime.__vacuumTabNavObserver = new MutationObserver(record)
    runtime.__vacuumTabNavObserver.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
      childList: true,
      subtree: true,
    })
    record()
  })
  const before = await mainFloorTabPositions(dialog)
  const beforeSnapshot = await mainFloorTabNavSnapshot(dialog)
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Controls')?.labelDisplay).toBe('block')
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Controls')?.labelOpacity).toBeCloseTo(1, 1)

  await setMainFloorVacuumRuntime(page, { state: 'docked' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'expand-layout')
  await expect(nav).toHaveAttribute('data-visual-count', '5')
  await expect(nav).toHaveAttribute('data-semantic-count', '3')

  await expect.poll(async () => {
    const positions = await mainFloorTabPositions(dialog)
    return (positions['Auto-Clean']?.left ?? 0) - (before['Auto-Clean']?.left ?? 0) > 5
  }).toBe(true)
  await page.waitForFunction(() => {
    const runtime = window as typeof window & {
      __vacuumExpandLayout667Snapshot?: unknown
    }
    return runtime.__vacuumExpandLayout667Snapshot != null
  })
  const expandLayoutSnapshot = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumExpandLayout667Observer?: MutationObserver
      __vacuumExpandLayout667Snapshot?: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null
    }
    runtime.__vacuumExpandLayout667Observer?.disconnect()
    return runtime.__vacuumExpandLayout667Snapshot
  })
  const autoCleanLabel = findTabSnapshotItem(expandLayoutSnapshot, 'tab', 'Auto-Clean')
  expect(autoCleanLabel?.labelDisplay).toBe('block')
  expect(autoCleanLabel?.labelOpacity).toBeGreaterThan(0.05)
  expect(autoCleanLabel?.labelOpacity).toBeLessThan(0.9)
  expect(findTabSnapshotItem(expandLayoutSnapshot, 'tab', 'Rooms')).toBeFalsy()
  expect(findTabSnapshotItem(expandLayoutSnapshot, 'tab', 'Actions')).toBeFalsy()

  await expect.poll(async () => nav.getAttribute('data-membership-phase')).toBe('expand-fade')
  await expect(dialog.getByRole('tab', { name: 'Rooms' })).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'Actions' })).toBeVisible()
  await page.waitForTimeout(70)
  const expandFadeEarly = await mainFloorTabNavSnapshot(dialog)
  const roomsTab = findTabSnapshotItem(expandFadeEarly, 'tab', 'Rooms')
  const actionsTab = findTabSnapshotItem(expandFadeEarly, 'tab', 'Actions')
  expect(roomsTab?.contentOpacity).toBeGreaterThan(0.05)
  expect(roomsTab?.contentOpacity).toBeLessThan(0.9)
  expect(roomsTab?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsTab?.contentOpacity).toBeGreaterThan(0.05)
  expect(actionsTab?.contentOpacity).toBeLessThan(0.9)
  expect(actionsTab?.iconOpacity).toBeCloseTo(1, 4)
  await expect.poll(async () => nav.getAttribute('data-membership-phase')).toBe('idle')
  const phaseSnapshots = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumTabNavObserver?: MutationObserver
      __vacuumTabNavPhaseSnapshots?: Record<string, {
        items: {
          key: string
          labelDisplay: string | null
          left: number
          opacity: number
          top: number
        }[]
      }>
    }
    runtime.__vacuumTabNavObserver?.disconnect()
    return runtime.__vacuumTabNavPhaseSnapshots ?? {}
  })
  const expandFadeSnapshot = phaseSnapshots['expand-fade']
  expect(expandFadeSnapshot).toBeTruthy()
  expect(expandFadeSnapshot.items.find((item) => item.key === 'tab:Controls')?.labelDisplay).toBe('none')
  expect(expandFadeSnapshot.items.find((item) => item.key === 'tab:Auto-Clean')?.labelDisplay).toBe('none')
  expect(expandFadeSnapshot.items.find((item) => item.key === 'tab:Rooms')?.labelDisplay).toBe('none')
  expect(findTabSnapshotItem(expandFadeEarly, 'tab', 'Controls')?.contentOpacity).toBeCloseTo(1, 4)
  expect(findTabSnapshotItem(expandFadeEarly, 'tab', 'Controls')?.iconOpacity).toBeCloseTo(1, 4)
  const afterSnapshot = await mainFloorTabNavSnapshot(dialog)
  expect(findTabSnapshotItem(afterSnapshot, 'tab', 'Controls')?.labelDisplay).toBe('none')
  expect(findTabSnapshotItem(afterSnapshot, 'tab', 'Rooms')?.labelDisplay).toBe('none')
})

test('tab membership shrink fades icon-only portrait content wrappers at 393x852', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' && browserName !== 'webkit', 'Vacuum tab fade evidence is collected in Chromium and WebKit only.')

  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const beforePositions = await mainFloorTabPositions(dialog)
  const shrinkFadeTracePromise = captureMainFloorTabFadeTrace(nav, 'shrink-fade')

  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toBeVisible()
  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'shrink-fade')
  const shrinkFadeTrace = await shrinkFadeTracePromise
  const shrinkFadeSamples = shrinkFadeTrace.samples.filter((sample) => sample.phase === 'shrink-fade')
  const shrinkMidFadeSnapshot = shrinkFadeSamples.find((sample) => {
    const roomsGhost = findTabSnapshotItem(sample, 'ghost', 'Rooms')
    const actionsGhost = findTabSnapshotItem(sample, 'ghost', 'Actions')
    return roomsGhost?.labelDisplay === 'none'
      && actionsGhost?.labelDisplay === 'none'
      && (roomsGhost?.contentOpacity ?? 0) > 0.2
      && (roomsGhost?.contentOpacity ?? 1) < 0.85
      && (actionsGhost?.contentOpacity ?? 0) > 0.2
      && (actionsGhost?.contentOpacity ?? 1) < 0.85
  })
  expect(shrinkFadeSamples.length).toBeGreaterThanOrEqual(2)
  expect(shrinkMidFadeSnapshot).toBeTruthy()
  const roomsGhostOpacities = shrinkFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'ghost', 'Rooms')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  const actionsGhostOpacities = shrinkFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'ghost', 'Actions')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  expect(roomsGhostOpacities.length).toBeGreaterThanOrEqual(2)
  expect(actionsGhostOpacities.length).toBeGreaterThanOrEqual(2)
  expect(roomsGhostOpacities.at(0) ?? 0).toBeGreaterThan(roomsGhostOpacities.at(-1) ?? 1)
  expect(actionsGhostOpacities.at(0) ?? 0).toBeGreaterThan(actionsGhostOpacities.at(-1) ?? 1)
  const roomsGhost = findTabSnapshotItem(shrinkMidFadeSnapshot!, 'ghost', 'Rooms')
  const actionsGhost = findTabSnapshotItem(shrinkMidFadeSnapshot!, 'ghost', 'Actions')
  const autoCleanDuringFade = findTabSnapshotItem(shrinkMidFadeSnapshot!, 'tab', 'Auto-Clean')
  const infoDuringFade = findTabSnapshotItem(shrinkMidFadeSnapshot!, 'tab', 'Info')
  expect(roomsGhost?.labelDisplay).toBe('none')
  expect(actionsGhost?.labelDisplay).toBe('none')
  expect(roomsGhost?.contentOpacity).toBeGreaterThan(0.2)
  expect(roomsGhost?.contentOpacity).toBeLessThan(0.85)
  expect(roomsGhost?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsGhost?.contentOpacity).toBeGreaterThan(0.2)
  expect(actionsGhost?.contentOpacity).toBeLessThan(0.85)
  expect(actionsGhost?.iconOpacity).toBeCloseTo(1, 4)
  expect(findTabSnapshotItem(shrinkMidFadeSnapshot!, 'tab', 'Controls')?.labelDisplay).toBe('none')
  const controlsOpacities = shrinkFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'tab', 'Controls')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  expect(controlsOpacities.length).toBeGreaterThan(0)
  for (const opacity of controlsOpacities) expect(opacity).toBeCloseTo(1, 4)
  expect(autoCleanDuringFade?.left).toBeCloseTo(beforePositions['Auto-Clean']?.left ?? 0, 0)
  expect(infoDuringFade?.left).toBeCloseTo(beforePositions.Info?.left ?? 0, 0)

  await expect(nav).toHaveAttribute('data-membership-phase', 'idle')
})

test('tab membership expansion fades icon-only portrait entering content wrappers at 393x852', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' && browserName !== 'webkit', 'Vacuum tab fade evidence is collected in Chromium and WebKit only.')

  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/at-a-glance/vacuums')
  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })
  await page.getByRole('button', { name: /Main Floor Cleaning/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const expandFadeTracePromise = captureMainFloorTabFadeTrace(nav, 'expand-fade')
  await setMainFloorVacuumRuntime(page, { state: 'docked' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'expand-fade')
  const expandFadeTrace = await expandFadeTracePromise
  const expandFadeSamples = expandFadeTrace.samples.filter((sample) => sample.phase === 'expand-fade')
  const expandMidFadeSnapshot = expandFadeSamples.find((sample) => {
    const roomsTab = findTabSnapshotItem(sample, 'tab', 'Rooms')
    const actionsTab = findTabSnapshotItem(sample, 'tab', 'Actions')
    return roomsTab?.labelDisplay === 'none'
      && actionsTab?.labelDisplay === 'none'
      && (roomsTab?.contentOpacity ?? 0) > 0.15
      && (roomsTab?.contentOpacity ?? 1) < 0.8
      && (actionsTab?.contentOpacity ?? 0) > 0.15
      && (actionsTab?.contentOpacity ?? 1) < 0.8
  })
  expect(expandFadeSamples.length).toBeGreaterThanOrEqual(2)
  expect(expandMidFadeSnapshot).toBeTruthy()
  const roomsTabOpacities = expandFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'tab', 'Rooms')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  const actionsTabOpacities = expandFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'tab', 'Actions')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  expect(roomsTabOpacities.length).toBeGreaterThanOrEqual(2)
  expect(actionsTabOpacities.length).toBeGreaterThanOrEqual(2)
  expect(roomsTabOpacities.at(-1) ?? 0).toBeGreaterThan(roomsTabOpacities.at(0) ?? 1)
  expect(actionsTabOpacities.at(-1) ?? 0).toBeGreaterThan(actionsTabOpacities.at(0) ?? 1)
  const roomsTab = findTabSnapshotItem(expandMidFadeSnapshot!, 'tab', 'Rooms')
  const actionsTab = findTabSnapshotItem(expandMidFadeSnapshot!, 'tab', 'Actions')
  expect(expandMidFadeSnapshot?.phase).toBe('expand-fade')
  expect(roomsTab?.labelDisplay).toBe('none')
  expect(actionsTab?.labelDisplay).toBe('none')
  expect(roomsTab?.contentOpacity).toBeGreaterThan(0.15)
  expect(roomsTab?.contentOpacity).toBeLessThan(0.8)
  expect(roomsTab?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsTab?.contentOpacity).toBeGreaterThan(0.15)
  expect(actionsTab?.contentOpacity).toBeLessThan(0.8)
  expect(actionsTab?.iconOpacity).toBeCloseTo(1, 4)
  const expandControlsOpacities = expandFadeSamples
    .map((sample) => findTabSnapshotItem(sample, 'tab', 'Controls')?.contentOpacity)
    .filter((opacity): opacity is number => opacity != null)
  expect(expandControlsOpacities.length).toBeGreaterThan(0)
  for (const opacity of expandControlsOpacities) expect(opacity).toBeCloseTo(1, 4)

  await expect(nav).toHaveAttribute('data-membership-phase', 'idle')
})

test('Controls fades the outgoing Docked section and fades it back after the tab bar expands', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const runtimeContent = dialog.locator('[data-vacuum-runtime-content-transition="true"]')
  await expect(runtimeContent.getByRole('heading', { name: 'Docked' })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'shrink-fade')
  await expect(runtimeContent).toHaveAttribute('data-vacuum-runtime-content-phase', 'shrink-fade')
  await expect(runtimeContent.getByRole('heading', { name: 'Docked' })).toBeVisible()
  await expect.poll(async () => {
    const opacity = await runtimeContent.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity || '1'))
    return opacity > 0.15 && opacity < 0.85
  }).toBe(true)

  await expect(runtimeContent.getByRole('heading', { name: 'Docked' })).toHaveCount(0)
  await expect(runtimeContent.getByRole('heading', { name: 'Cleaning' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'docked' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'expand-layout')
  await expect(runtimeContent).toHaveAttribute('data-vacuum-runtime-content-phase', 'expand-layout')
  await expect(runtimeContent.getByRole('heading', { name: 'Docked' })).toHaveCount(0)
  await expect(runtimeContent).toHaveAttribute('data-vacuum-runtime-content-phase', 'expand-fade')
  await expect(runtimeContent.getByRole('heading', { name: 'Docked' })).toBeVisible()
  await expect.poll(async () => {
    const opacity = await runtimeContent.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity || '1'))
    return opacity > 0.15 && opacity < 0.85
  }).toBe(true)

  await expect(runtimeContent).toHaveAttribute('data-vacuum-runtime-content-phase', 'idle')
  await expect(runtimeContent).toHaveCSS('opacity', '1')
})

test('tab membership shrink keeps five-tab labels visibly fading at 844x390', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ height: 390, width: 844 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const beforeSnapshot = await mainFloorTabNavSnapshot(dialog)
  const beforePositions = await mainFloorTabPositions(dialog)
  const beforeControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  const shrinkWidthTracePromise = captureMainFloorTabWidthTrace(nav, 'Controls', 'shrink-layout')
  await nav.evaluate((element) => {
    const runtime = window as typeof window & {
      __vacuumShrinkFade844Observer?: MutationObserver
      __vacuumShrinkFade844Snapshot?: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null
    }
    const snapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
        const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        const nodeStyle = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return {
          contentOpacity: contentNode ? Number.parseFloat(getComputedStyle(contentNode).opacity || '1') : null,
          iconOpacity: iconNode ? Number.parseFloat(getComputedStyle(iconNode).opacity || '1') : null,
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelNode ? getComputedStyle(labelNode).display : null,
          labelOpacity: labelNode ? Number.parseFloat(getComputedStyle(labelNode).opacity || '1') : null,
          left: rect.left,
          opacity: Number.parseFloat(nodeStyle.opacity || '1'),
          text: node.textContent?.trim() ?? '',
          top: rect.top,
        }
      }),
      navHeight: element.getBoundingClientRect().height,
      navTop: element.getBoundingClientRect().top,
      phase: element.getAttribute('data-membership-phase'),
    })
    const record = () => {
      if (element.getAttribute('data-membership-phase') !== 'shrink-fade' || runtime.__vacuumShrinkFade844Snapshot) return
      window.setTimeout(() => {
        runtime.__vacuumShrinkFade844Snapshot = snapshot()
        runtime.__vacuumShrinkFade844Observer?.disconnect()
      }, 160)
    }
    runtime.__vacuumShrinkFade844Snapshot = null
    runtime.__vacuumShrinkFade844Observer?.disconnect()
    runtime.__vacuumShrinkFade844Observer = new MutationObserver(record)
    runtime.__vacuumShrinkFade844Observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
    record()
  })
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Rooms')?.labelDisplay).toBe('block')
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Actions')?.labelDisplay).toBe('block')
  expect(beforeControls.columnGap).toBeCloseTo(8, 4)

  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toBeVisible()
  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'shrink-fade')
  await page.waitForFunction(() => {
    const runtime = window as typeof window & {
      __vacuumShrinkFade844Snapshot?: unknown
    }
    return runtime.__vacuumShrinkFade844Snapshot != null
  })
  const earlyFadeSnapshot = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumShrinkFade844Observer?: MutationObserver
      __vacuumShrinkFade844Snapshot?: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null
    }
    runtime.__vacuumShrinkFade844Observer?.disconnect()
    return runtime.__vacuumShrinkFade844Snapshot
  })
  const duringFadePositions = await mainFloorTabPositions(dialog)
  const roomsGhost = findTabSnapshotItem(earlyFadeSnapshot, 'ghost', 'Rooms')
  const actionsGhost = findTabSnapshotItem(earlyFadeSnapshot, 'ghost', 'Actions')
  expect(roomsGhost?.labelDisplay).toBe('block')
  if (browserName === 'chromium') {
    expect(roomsGhost?.contentOpacity).toBeGreaterThan(0.35)
    expect(roomsGhost?.contentOpacity).toBeLessThan(0.95)
  }
  expect(roomsGhost?.iconOpacity).toBeCloseTo(1, 4)
  expect(roomsGhost?.labelOpacity).toBeCloseTo(1, 4)
  if (browserName === 'chromium') {
    expect(actionsGhost?.contentOpacity).toBeGreaterThan(0.35)
    expect(actionsGhost?.contentOpacity).toBeLessThan(0.95)
  }
  expect(actionsGhost?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsGhost?.labelOpacity).toBeCloseTo(1, 4)
  expect(Math.abs(earlyFadeSnapshot.navHeight - beforeSnapshot.navHeight)).toBeLessThanOrEqual(1)
  expect(Math.abs(earlyFadeSnapshot.navTop - beforeSnapshot.navTop)).toBeLessThanOrEqual(1)
  expect(duringFadePositions['Auto-Clean']?.left).toBeCloseTo(beforePositions['Auto-Clean']?.left ?? 0, 0)
  expect(duringFadePositions.Info?.left).toBeCloseTo(beforePositions.Info?.left ?? 0, 0)
  await captureTabNavScreenshot(nav, testInfo, 'vacuum-tab-membership-shrink-844x390-mid-fade.png')

  await expect(nav).toHaveAttribute('data-membership-phase', 'idle')
  const shrinkWidthTrace = await shrinkWidthTracePromise
  const afterPositions = await mainFloorTabPositions(dialog)
  const afterControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  expect(afterControls.columnGap).toBeCloseTo(beforeControls.columnGap, 4)
  expect(afterControls.labelDisplay).toBe('block')
  expect(afterControls.labelOpacity).toBeCloseTo(1, 4)
  expect(afterPositions['Auto-Clean']?.left).toBeLessThan((beforePositions['Auto-Clean']?.left ?? 0) - 5)
  expect(afterPositions.Info?.left).toBeLessThan((beforePositions.Info?.left ?? 0) - 5)
  expect(afterControls.width).toBeGreaterThan(beforeControls.width + 80)
  expect(afterControls.inlineWidth).toBeNull()
  expect(afterControls.justifySelf).toBe('')
  expect(afterControls.transition).toBe('')

  const shrinkPhaseSamples = shrinkWidthTrace.samples.filter((sample) => sample.phase === 'shrink-layout')
  const shrinkWidths = shrinkPhaseSamples.map((sample) => sample.width)
  const uniqueShrinkWidths = [...new Set(shrinkWidths.map((width) => Math.round(width * 10) / 10))]
  const shrinkWidthSteps = shrinkWidths.slice(1).map((width, index) => Math.abs(width - shrinkWidths[index]))
  const shrinkSpan = afterControls.width - beforeControls.width
  expect(shrinkPhaseSamples.length).toBeGreaterThanOrEqual(browserName === 'chromium' ? 3 : 1)
  expect(uniqueShrinkWidths.length).toBeGreaterThanOrEqual(browserName === 'chromium' ? 3 : 1)
  expect(shrinkPhaseSamples.some((sample) => sample.width > beforeControls.width + 1 && sample.width < afterControls.width - 1)).toBe(browserName === 'chromium')
  expect(shrinkPhaseSamples.every((sample) => sample.inlineWidth !== null)).toBe(true)
  expect(shrinkPhaseSamples.every((sample) => sample.justifySelf === 'start')).toBe(true)
  expect(shrinkPhaseSamples.every((sample) => sample.transition.includes('width 180ms'))).toBe(true)
  if (browserName === 'chromium') {
    const duringLayoutControls = await mainFloorTabContentMetrics(dialog, 'Controls')
    expect(duringLayoutControls.columnGap).toBeCloseTo(beforeControls.columnGap, 4)
    expect(duringLayoutControls.contentOpacity).toBeCloseTo(1, 4)
    expect(duringLayoutControls.iconOpacity).toBeCloseTo(1, 4)
  }
  for (let index = 1; index < shrinkWidths.length; index += 1) {
    expect(shrinkWidths[index]).toBeGreaterThanOrEqual(shrinkWidths[index - 1] - 1)
  }
  expect(Math.max(...shrinkWidthSteps)).toBeLessThan(shrinkSpan * (browserName === 'chromium' ? 0.6 : 1.2))
})

test('tab membership expansion keeps entering five-tab labels translucently visible at 844x390', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ height: 390, width: 844 })
  await page.goto('/at-a-glance/vacuums')
  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })
  await page.getByRole('button', { name: /Main Floor Cleaning/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const beforeSnapshot = await mainFloorTabNavSnapshot(dialog)
  const beforeControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  const expandWidthTracePromise = captureMainFloorTabWidthTrace(nav, 'Controls', 'expand-layout')
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Controls')?.labelDisplay).toBe('block')
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Auto-Clean')?.labelDisplay).toBe('block')
  expect(findTabSnapshotItem(beforeSnapshot, 'tab', 'Info')?.labelDisplay).toBe('block')
  await nav.evaluate((element) => {
    const runtime = window as typeof window & {
      __vacuumExpandFade844Observer?: MutationObserver
      __vacuumExpandFade844Snapshot?: {
        items: {
          contentOpacity: number | null
          iconOpacity: number | null
          key: string
          labelDisplay: string | null
          labelOpacity: number | null
          text: string
        }[]
      } | null
    }
    const snapshot = () => ({
      items: [...element.querySelectorAll<HTMLElement>('[role="tab"], [data-modal-tab-ghost="true"]')].map((node) => {
        const contentNode = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
        const iconNode = node.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')
        const labelNode = node.querySelector<HTMLElement>('[data-modal-tab-label="true"]')
        return {
          contentOpacity: contentNode ? Number.parseFloat(getComputedStyle(contentNode).opacity || '1') : null,
          iconOpacity: iconNode ? Number.parseFloat(getComputedStyle(iconNode).opacity || '1') : null,
          key: `${node.getAttribute('data-modal-tab-ghost') === 'true' ? 'ghost' : 'tab'}:${node.getAttribute('aria-label') ?? node.getAttribute('data-tab') ?? ''}`,
          labelDisplay: labelNode ? getComputedStyle(labelNode).display : null,
          labelOpacity: labelNode ? Number.parseFloat(getComputedStyle(labelNode).opacity || '1') : null,
          text: node.textContent?.trim() ?? '',
        }
      }),
    })
    const record = () => {
      if (element.getAttribute('data-membership-phase') !== 'expand-fade' || runtime.__vacuumExpandFade844Snapshot) return
      window.setTimeout(() => {
        runtime.__vacuumExpandFade844Snapshot = snapshot()
        runtime.__vacuumExpandFade844Observer?.disconnect()
      }, 100)
    }
    runtime.__vacuumExpandFade844Snapshot = null
    runtime.__vacuumExpandFade844Observer?.disconnect()
    runtime.__vacuumExpandFade844Observer = new MutationObserver(record)
    runtime.__vacuumExpandFade844Observer.observe(element, {
      attributeFilter: ['data-membership-phase'],
      attributes: true,
    })
    record()
  })

  await setMainFloorVacuumRuntime(page, { state: 'docked' })
  await expect(nav).toHaveAttribute('data-membership-phase', 'expand-layout')
  const duringLayoutControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  expect(duringLayoutControls.inlineWidth).not.toBeNull()
  expect(duringLayoutControls.justifySelf).toBe('start')
  expect(duringLayoutControls.transition).toContain('width 180ms')
  await page.waitForFunction(() => {
    const runtime = window as typeof window & {
      __vacuumExpandFade844Snapshot?: unknown
    }
    return runtime.__vacuumExpandFade844Snapshot != null
  })
  const initialFadeSnapshot = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __vacuumExpandFade844Observer?: MutationObserver
      __vacuumExpandFade844Snapshot?: Awaited<ReturnType<typeof mainFloorTabNavSnapshot>> | null
    }
    runtime.__vacuumExpandFade844Observer?.disconnect()
    return runtime.__vacuumExpandFade844Snapshot
  })
  const earlyFadeSnapshot = initialFadeSnapshot
  const roomsTab = findTabSnapshotItem(earlyFadeSnapshot, 'tab', 'Rooms')
  const actionsTab = findTabSnapshotItem(earlyFadeSnapshot, 'tab', 'Actions')
  expect(roomsTab?.labelDisplay).toBe('block')
  if (browserName === 'chromium') {
    expect(roomsTab?.contentOpacity).toBeGreaterThan(0.05)
    expect(roomsTab?.contentOpacity).toBeLessThan(0.8)
  }
  expect(roomsTab?.iconOpacity).toBeCloseTo(1, 4)
  expect(roomsTab?.labelOpacity).toBeCloseTo(1, 4)
  if (browserName === 'chromium') {
    expect(actionsTab?.contentOpacity).toBeGreaterThan(0.05)
    expect(actionsTab?.contentOpacity).toBeLessThan(0.8)
  }
  expect(actionsTab?.iconOpacity).toBeCloseTo(1, 4)
  expect(actionsTab?.labelOpacity).toBeCloseTo(1, 4)
  expect(findTabSnapshotItem(initialFadeSnapshot, 'tab', 'Rooms')?.labelDisplay).toBe('block')
  await captureTabNavScreenshot(nav, testInfo, 'vacuum-tab-membership-expand-844x390-mid-fade.png')
  await expect(nav).toHaveAttribute('data-membership-phase', 'idle')
  const expandWidthTrace = await expandWidthTracePromise
  const afterControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  expect(afterControls.width).toBeLessThan(beforeControls.width - 80)
  expect(afterControls.inlineWidth).toBeNull()
  expect(afterControls.justifySelf).toBe('')
  expect(afterControls.transition).toBe('')

  const expandPhaseSamples = expandWidthTrace.samples.filter((sample) => sample.phase === 'expand-layout')
  const expandWidths = expandPhaseSamples.map((sample) => sample.width)
  const uniqueExpandWidths = [...new Set(expandWidths.map((width) => Math.round(width * 10) / 10))]
  const expandWidthSteps = expandWidths.slice(1).map((width, index) => Math.abs(width - expandWidths[index]))
  const expandSpan = beforeControls.width - afterControls.width
  expect(expandPhaseSamples.length).toBeGreaterThanOrEqual(browserName === 'chromium' ? 3 : 1)
  expect(uniqueExpandWidths.length).toBeGreaterThanOrEqual(browserName === 'chromium' ? 3 : 1)
  expect(expandPhaseSamples.some((sample) => sample.width < beforeControls.width - 1 && sample.width > afterControls.width + 1)).toBe(browserName === 'chromium')
  expect(expandPhaseSamples.every((sample) => sample.inlineWidth !== null)).toBe(true)
  expect(expandPhaseSamples.every((sample) => sample.justifySelf === 'start')).toBe(true)
  expect(expandPhaseSamples.every((sample) => sample.transition.includes('width 180ms'))).toBe(true)
  for (let index = 1; index < expandWidths.length; index += 1) {
    expect(expandWidths[index]).toBeLessThanOrEqual(expandWidths[index - 1] + 1)
  }
  expect(Math.max(...expandWidthSteps)).toBeLessThan(expandSpan * (browserName === 'chromium' ? 0.6 : 1.2))
})

test('tab membership reversal carries forward the in-flight shrink width at 844x390', async ({ page, browserName }) => {
  await page.setViewportSize({ height: 390, width: 844 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  const nav = dialog.getByRole('tablist', { name: 'Main Floor modal sections' })
  const beforeDockedControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  await dialog.getByRole('tab', { name: 'Rooms' }).click()
  await expect(dialog.getByRole('tab', { name: 'Rooms', selected: true })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { state: 'cleaning' })
  let preReversalControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  if (browserName === 'chromium') {
    await expect.poll(async () => {
      const controls = await mainFloorTabContentMetrics(dialog, 'Controls')
      return controls.inlineWidth !== null
    }).toBe(true)
    await page.waitForTimeout(70)
    preReversalControls = await mainFloorTabContentMetrics(dialog, 'Controls')
    expect(preReversalControls.inlineWidth).not.toBeNull()
    expect(preReversalControls.width).toBeLessThanOrEqual((preReversalControls.inlineWidth ?? 0) - 10)
  } else {
    await expect(nav).toHaveAttribute('data-membership-phase', 'shrink-fade')
  }

  await setMainFloorVacuumRuntime(page, { state: 'docked' })

  await expect(nav).toHaveAttribute('data-membership-phase', 'expand-layout')
  if (browserName === 'chromium') {
    const firstReverseSample = await mainFloorTabContentMetrics(dialog, 'Controls')
    expect(firstReverseSample.inlineWidth).not.toBeNull()
    expect(firstReverseSample.justifySelf).toBe('start')
    if (firstReverseSample.transition) expect(firstReverseSample.transition).toContain('width 180ms')
    expect(firstReverseSample.width).toBeLessThan((preReversalControls.inlineWidth ?? 0) - 10)

    const shrinkTargetWidth = preReversalControls.inlineWidth ?? 0
    const distanceToPaintedWidth = Math.abs(firstReverseSample.width - preReversalControls.width)
    const distanceToShrinkEndpoint = Math.abs(firstReverseSample.width - shrinkTargetWidth)

    expect(distanceToPaintedWidth).toBeLessThan(18)
    expect(distanceToPaintedWidth).toBeLessThan(distanceToShrinkEndpoint)
    expect(firstReverseSample.width).toBeLessThanOrEqual(shrinkTargetWidth - 10)
  }

  await expect(nav).toHaveAttribute('data-membership-phase', 'idle')
  const afterControls = await mainFloorTabContentMetrics(dialog, 'Controls')
  expect(afterControls.width).toBeCloseTo(beforeDockedControls.width, 0)
  expect(afterControls.inlineWidth).toBeNull()
  expect(afterControls.justifySelf).toBe('')
  expect(afterControls.transition).toBe('')
  expect(afterControls.transform).toBe('')
})

test('busy dock minimal mode shows Actions only for the active dock stop control', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  await setMainFloorDockStatus(page, 'cleaning')

  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Auto-Clean', 'Actions', 'Info'])
  const controlsPane = dialog.getByRole('group', { name: 'Main Floor controls, auto-clean, actions, info' })
  await expect(controlsPane.getByRole('button', { name: 'Stop Dock Clean' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Clean Mop Dock' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Dry Mops' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Empty Bin' })).toHaveCount(0)

  await dialog.getByRole('tab', { name: 'Actions' }).click()
  await expect(controlsPane.getByRole('button', { name: 'Stop Dock Clean' })).toBeVisible()
  await controlsPane.getByRole('button', { name: 'Stop Dock Clean' }).click()
  await expect.poll(() => page.evaluate(() => window.__mockHass?.calls ?? [])).toContainEqual({
    domain: 'script',
    service: 'main_floor_vacuum_mop_dock_clean',
  })
})

test('minimal short landscape controls keep a visible status fallback and close the area editor', async ({ page }) => {
  await page.setViewportSize({ height: 393, width: 852 })
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)

  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await expect(dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })).toBeVisible()

  await setMainFloorVacuumRuntime(page, { error: 'Low battery', state: 'error' })

  await expect(dialog.getByRole('application', { name: 'Main Floor cleaning area editor' })).toHaveCount(0)
  await expect.poll(async () => mainFloorTabLabels(dialog)).toEqual(['Controls', 'Auto-Clean', 'Info'])
  const controlsPane = dialog.getByRole('group', { name: 'Main Floor controls, auto-clean, info' })
  const statusSummary = controlsPane.getByRole('group', { name: 'Vacuum status' })
  await expect(statusSummary).toContainText('Error')
  await expect(statusSummary).toContainText('Battery')
  const currentIssue = controlsPane.getByRole('region', { name: 'Current Issue' })
  await expect(currentIssue).toBeVisible()
  await expect(currentIssue).toContainText('Low battery')
  await expect(controlsPane.getByRole('status')).toContainText('Low battery')
  await expect(controlsPane.getByRole('button', { name: 'Clean' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Pause' })).toHaveCount(0)
  await expect(controlsPane.getByRole('button', { name: 'Stop' })).toHaveCount(0)
})

test('unknown consumable sensors stay visible with unknown values in Info', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.evaluate(() => {
    const mock = window.__mockHass
    if (!mock) throw new Error('Mock Home Assistant API is unavailable')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_freshwater_dock_component', 'unknown')
    mock.setEntityState('sensor.valetudo_exaltedsneakydeer_wastewater_dock_component', 'unavailable')
    mock.calls.splice(0, mock.calls.length)
  })
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, 'vacuum-tabs')
  await waitForVacuumLayoutReady(dialog)
  await dialog.getByRole('tab', { name: 'Info' }).click()

  for (const name of ['Fresh Water Unknown', 'Waste Water Unknown']) {
    const item = dialog.getByRole('group', { name })
    await expect(item).toBeVisible()
    await expect(item).toHaveAttribute('data-icon', 'mdi:help-circle-outline')
    await expect(item).toHaveAttribute('data-tone', 'unavailable')
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
  // The map never loads here, so the modal spinner must hold past the short settled minimum.
  await page.waitForTimeout(1_500)
  await expect(dialog.locator('[data-layout-preparation-phase]')).toHaveAttribute('data-layout-preparation-phase', 'loading')
  await waitForVacuumLayoutReady(dialog)
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'none')
  await expect(dialog.getByText('Map Unavailable')).toBeVisible()
  await expect(dialog.locator('[data-map-reported-note="true"]')).toHaveCount(0)
  // Locate targets the vacuum itself, so a camera-only outage must not remove it.
  await expect(dialog.getByRole('button', { name: 'Locate' })).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
})

test('an open vacuum modal immediately yields to a live unavailable transition', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await waitForVacuumLayoutReady(dialog)
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
  await expect(dialog.getByLabel('Unavailable')).toHaveCount(0)
  await expect(dialog.locator('[data-vacuum-live-status="true"]')).toContainText("Unavailable. Home Assistant does not have the vacuum's current status.")
  const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
  await expect(map).toHaveAttribute('data-source-available', 'false')
  await expect(map).toHaveAttribute('data-map-provenance', 'reported')
  await expect(dialog.locator('[data-map-reported-note="true"]')).toContainText('Last Reported Position')
  await expectLocateUnavailable(dialog, 'Main Floor map and status')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText(/Battery level is low/i)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls)).toEqual([])
})

test('an unavailable transition resets a zoomed area editor before showing the last reported position', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()

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
