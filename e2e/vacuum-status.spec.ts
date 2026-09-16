// @covers src/components/hass/VacuumCard.module.css
// @covers src/components/hass/VacuumCard.tsx
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
