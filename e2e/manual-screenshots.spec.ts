import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONTACT_GROUPS, OCCUPANCY_GROUPS } from '../src/constants/atAGlance'
import { TODO_PAGES } from '../src/constants/portedDashboard'
import { DASHBOARD_ROUTES } from '../src/constants/routes'
import {
  MANUAL_ROUTE_CONTEXT_FORBIDDEN_FIXTURE_TEXT,
  MANUAL_ROUTE_CONTEXT_SCREENSHOTS,
  type ManualRouteContextScreenshotConfig,
} from '../src/manual/routeContextScreenshots'
import { MANUAL_SCREENSHOT_FORBIDDEN_TEXT, manualScreenshotConfig } from '../src/manual/screenshots'

const ROLE_BOUNDS = {
  context: { minHeight: 140, minWidth: 280, maxHeightRatio: 0.5, maxWidth: 1280 },
  overview: { minHeight: 400, minWidth: 280, maxHeightRatio: 1.1, maxWidth: 1280 },
  focused: { minHeight: 40, minWidth: 120, maxHeightRatio: 0.5, maxWidth: 820 },
  modal: { minHeight: 220, minWidth: 280, maxHeightRatio: 1.1, maxWidth: 820 },
  detail: { minHeight: 220, minWidth: 280, maxHeightRatio: 1.1, maxWidth: 820 },
  state: { minHeight: 40, minWidth: 120, maxHeightRatio: 0.5, maxWidth: 560 },
  wizard: { minHeight: 220, minWidth: 280, maxHeightRatio: 1.1, maxWidth: 820 },
} as const

test.setTimeout(90_000)

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'manual-desktop') return
  const config = manualScreenshotConfig(testInfo.title)
  if (config?.desktopCaptureWidth) await page.setViewportSize({ width: config.desktopCaptureWidth, height: 900 })
})

function configuredCropHeight(id: string) {
  const config = manualScreenshotConfig(id)
  return test.info().project.name === 'manual-desktop'
    ? config?.desktopCropHeight ?? config?.cropHeight
    : config?.cropHeight
}

async function expectManualSubject(id: string, subject: Locator) {
  const config = manualScreenshotConfig(id)
  if (!config) throw new Error(`Missing manual screenshot config for ${id}`)
  const bounds = ROLE_BOUNDS[config.role]
  const cropHeight = configuredCropHeight(id)
  const requiredText = config.requiredTargets
  const forbiddenText = MANUAL_SCREENSHOT_FORBIDDEN_TEXT.filter((value) => !config.allowedStateText?.includes(value))
  await expect(subject).toHaveCount(1)
  await expect(subject).toBeVisible()
  const box = await subject.boundingBox()
  const cropsSubject = config.cropSubject || (
    config.mobileCropSubject && test.info().project.name === 'manual-mobile'
  )
  const measuredHeight = box?.height ?? 0
  const captureHeight = cropHeight
    ? cropsSubject
      ? cropHeight
      : Math.min(measuredHeight, cropHeight)
    : measuredHeight
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(bounds.minWidth)
  expect(captureHeight).toBeGreaterThanOrEqual(bounds.minHeight)
  expect(box?.width ?? 0).toBeLessThanOrEqual(Math.max(bounds.maxWidth, config.desktopCaptureWidth ?? 0))

  const evidence = await subject.evaluate((element, { cropFromBottom, cropHeight, forbiddenText, requiredText }) => {
    const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
    const text = normalize((element as HTMLElement).innerText)
    const subjectRect = element.getBoundingClientRect()
    const captureHeight = Math.min(subjectRect.height, cropHeight ?? subjectRect.height)
    const captureTop = cropFromBottom ? subjectRect.bottom - captureHeight : subjectRect.top
    const captureBottom = captureTop + captureHeight
    const targetEvidence = (value: string) => {
      const statusChip = element.querySelector<HTMLElement>(`[data-status-chip="${CSS.escape(value)}"]`)
      const descendants = Array.from(element.querySelectorAll<HTMLElement>('*'))
      const semanticLabels = (candidate: HTMLElement) => [
        candidate.getAttribute('aria-label'),
        candidate.getAttribute('title'),
        candidate.getAttribute('placeholder'),
      ].map(normalize).filter(Boolean)
      const exactSemanticCandidates = descendants.filter((candidate) => semanticLabels(candidate).includes(value))
      const containingCandidates = descendants
        .filter((candidate) => (
          normalize(candidate.innerText).includes(value)
          || semanticLabels(candidate).some((label) => label.includes(value))
        ))
        .sort((left, right) => {
          const leftLength = Math.min(
            normalize(left.innerText).length || Number.MAX_SAFE_INTEGER,
            ...semanticLabels(left).map((label) => label.length),
          )
          const rightLength = Math.min(
            normalize(right.innerText).length || Number.MAX_SAFE_INTEGER,
            ...semanticLabels(right).map((label) => label.length),
          )
          return leftLength - rightLength
        })
      const candidates = [
        ...(statusChip ? [statusChip] : []),
        ...exactSemanticCandidates,
        ...containingCandidates,
      ]
      for (const candidate of candidates) {
        const style = getComputedStyle(candidate)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
        const rect = candidate.getBoundingClientRect()
        const contained = rect.width > 0
          && rect.height > 0
          && rect.left >= subjectRect.left
          && rect.right <= subjectRect.right
          && rect.top >= captureTop
          && rect.bottom <= captureBottom
        if (!contained) continue
        const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2))
        const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
        const hit = document.elementFromPoint(centerX, centerY)
        const unoccluded = Boolean(hit && (candidate === hit || candidate.contains(hit) || hit.contains(candidate)))
        if (unoccluded) {
          const owner = candidate.closest<HTMLElement>('[data-status-chip], button, [role="button"]') ?? candidate
          const ownerRect = owner.getBoundingClientRect()
          return { area: ownerRect.width * ownerRect.height, found: true }
        }
      }
      return { area: 0, found: false }
    }
    const targets = requiredText.map((value) => targetEvidence(value))
    const descendants = Array.from(element.querySelectorAll('*')).filter((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }).length
    const semanticText = Array.from(element.querySelectorAll<HTMLElement>('[aria-label], [title], [placeholder]'))
      .flatMap((candidate) => [
        candidate.getAttribute('aria-label'),
        candidate.getAttribute('title'),
        candidate.getAttribute('placeholder'),
      ])
      .map(normalize)
      .filter(Boolean)
      .join(' ')
    return {
      descendants,
      evidenceText: `${text} ${semanticText}`.trim(),
      forbidden: forbiddenText.filter((value) => targetEvidence(value).found),
      missingVisibleText: requiredText.filter((_value, index) => !targets[index].found),
      targetArea: targets.reduce((total, target) => total + target.area, 0),
      text,
      viewportHeight: window.innerHeight,
    }
  }, { cropFromBottom: config.cropFromBottom ?? false, cropHeight, forbiddenText, requiredText })

  expect(evidence.descendants).toBeGreaterThanOrEqual(config.minDescendants ?? 4)
  expect(evidence.forbidden).toEqual([])
  expect(evidence.missingVisibleText).toEqual([])
  expect(captureHeight).toBeLessThanOrEqual(evidence.viewportHeight * (config.maxViewportHeightRatio ?? bounds.maxHeightRatio))
  if (config.role === 'focused') {
    const subjectArea = (box?.width ?? 0) * captureHeight
    expect(subjectArea > 0 ? evidence.targetArea / subjectArea : 0).toBeGreaterThanOrEqual(0.2)
  }
  for (const text of requiredText) expect(evidence.evidenceText).toContain(text)
}

async function captureManualSubject(page: Page, id: string, subject: Locator) {
  const config = manualScreenshotConfig(id)
  const cropHeight = configuredCropHeight(id)
  const options = {
    animations: config?.allowAnimations ? 'allow' : 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: config?.maxDiffPixelRatio ?? 0.01,
    scale: 'css',
  } as const
  if (!cropHeight) {
    await expect(subject).toHaveScreenshot(`${id}.png`, options)
    return
  }
  const cropSubject = config?.cropSubject || (
    config?.mobileCropSubject && test.info().project.name === 'manual-mobile'
  )
  if (cropSubject) {
    await subject.evaluate((element, height) => {
      const subjectElement = element as HTMLElement
      subjectElement.style.setProperty('height', `${height}px`, 'important')
      subjectElement.style.setProperty('min-height', `${height}px`, 'important')
      subjectElement.style.setProperty('max-height', `${height}px`, 'important')
      subjectElement.style.setProperty('overflow', 'hidden', 'important')
      return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }, cropHeight)
    await expect(subject).toHaveScreenshot(`${id}.png`, options)
    return
  }
  const box = await subject.boundingBox()
  if (!box) throw new Error(`Manual screenshot subject ${id} was not measurable`)
  await expect(page).toHaveScreenshot(`${id}.png`, {
    ...options,
    clip: {
      x: Math.round(box.x),
      y: Math.round(config?.cropFromBottom ? box.y + box.height - Math.min(box.height, cropHeight) : box.y),
      width: Math.round(box.width),
      height: Math.round(Math.min(box.height, cropHeight)),
    },
  })
}

function configuredCrop(page: Page, id: string) {
  const selector = manualScreenshotConfig(id)?.cropSelector
  if (!selector) throw new Error(`Missing crop selector for ${id}`)
  return page.locator(selector)
}

async function pageMain(page: Page, heading: string) {
  const title = page.getByRole('heading', { level: 1, name: heading })
  try {
    await title.waitFor({ state: 'visible', timeout: 20000 })
  } catch (error) {
    const appMounted = await page.locator('#root').evaluate((root) => root.childElementCount > 0).catch(() => false)
    if (appMounted) throw error
    await page.reload({ waitUntil: 'domcontentloaded' })
    await title.waitFor({ state: 'visible', timeout: 30000 })
  }
  return title.locator('xpath=ancestor::main[1]')
}

async function openRouteWithSyntheticStates(page: Page, routePath: string, heading: string, states: Record<string, string>) {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await page.evaluate(({ nextPath, syntheticStates }) => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    for (const [entityId, state] of Object.entries(syntheticStates)) mock.setEntityState(entityId, state)
    window.history.pushState({}, '', `/index.html?path=${nextPath}`)
    window.dispatchEvent(new Event('dashboard-route-change'))
  }, { nextPath: routePath, syntheticStates: states })
  await pageMain(page, heading)
  await expect(page.locator(`[data-route-path="${routePath}"][data-route-transition-state="idle"]`)).toBeVisible()
}

async function setSyntheticStates(page: Page, states: Record<string, string>) {
  await page.evaluate((syntheticStates) => {
    const mock = (window as unknown as { __mockHass: { setEntityState: (entityId: string, state: string) => void } }).__mockHass
    for (const [entityId, state] of Object.entries(syntheticStates)) mock.setEntityState(entityId, state)
  }, states)
}

async function setSyntheticInventoryItems(page: Page, location: string, items: Record<string, unknown>[]) {
  await page.evaluate(({ inventoryItems, inventoryLocation }) => {
    const mock = (window as unknown as {
      __mockHass: {
        setInventoryItems: (location: string, items: Record<string, unknown>[]) => void
      }
    }).__mockHass
    mock.setInventoryItems(inventoryLocation, inventoryItems)
  }, { inventoryItems: items, inventoryLocation: location })
}

interface ManualSyntheticTodoItem {
  due?: string
  status: 'completed' | 'needs_action'
  summary: string
  uid: string
}

interface ManualSyntheticFixture {
  donetickTasks?: Record<number, Record<string, unknown>>
  entityAttributes?: Record<string, Record<string, unknown>>
  entityStates?: Record<string, string>
  humidifierSchedule?: Record<string, unknown>
  inventoryByLocation?: Record<string, Record<string, unknown>[]>
  todoItemsByEntity?: Record<string, ManualSyntheticTodoItem[]>
}

async function openRouteWithSyntheticFixture(
  page: Page,
  routePath: string,
  heading: string,
  fixture: ManualSyntheticFixture = {},
) {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await page.evaluate(({ nextPath, syntheticFixture }) => {
    type MockHassApi = {
      reset: () => void
      setDonetickTask: (taskId: number, task: Record<string, unknown>) => void
      setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      setEntityState: (entityId: string, state: string) => void
      setHumidifierSchedule: (schedule: Record<string, unknown>) => void
      setInventoryItems: (location: string, items: Record<string, unknown>[]) => void
      setTodoItems: (entityId: string, items: ManualSyntheticTodoItem[]) => void
    }
    const mock = (window as unknown as { __mockHass: MockHassApi }).__mockHass
    mock.reset()
    if (syntheticFixture.humidifierSchedule) {
      mock.setHumidifierSchedule(syntheticFixture.humidifierSchedule)
    }
    for (const [entityId, state] of Object.entries(syntheticFixture.entityStates ?? {})) {
      mock.setEntityState(entityId, state)
    }
    for (const [entityId, attributes] of Object.entries(syntheticFixture.entityAttributes ?? {})) {
      for (const [attribute, value] of Object.entries(attributes)) {
        mock.setEntityAttribute(entityId, attribute, value)
      }
    }
    for (const [entityId, items] of Object.entries(syntheticFixture.todoItemsByEntity ?? {})) {
      mock.setTodoItems(entityId, items)
      mock.setEntityState(entityId, String(items.filter((item) => item.status !== 'completed').length))
    }
    for (const [location, items] of Object.entries(syntheticFixture.inventoryByLocation ?? {})) {
      mock.setInventoryItems(location, items)
    }
    for (const [taskId, task] of Object.entries(syntheticFixture.donetickTasks ?? {})) {
      mock.setDonetickTask(Number(taskId), task)
    }
    window.history.pushState({}, '', `/index.html?path=${nextPath}`)
    window.dispatchEvent(new Event('dashboard-route-change'))
  }, { nextPath: routePath, syntheticFixture: fixture })
  await pageMain(page, heading)
  await expect(page.locator(`[data-route-path="${routePath}"][data-route-transition-state="idle"]`)).toBeVisible()
}

async function setSyntheticWakeAlarms(
  page: Page,
  side: 'left' | 'right',
  wakeDay: string,
  alarms: Array<{ enabled: boolean; time: string }>,
  adapter: 'climate' | 'legacy' = 'legacy',
) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const scheduleDay = days[(days.indexOf(wakeDay) + days.length - 1) % days.length]
  await page.evaluate(({ adapterMode, nextAlarms, scheduleDay: targetDay, side: targetSide }) => {
    type Schedules = Partial<Record<'left' | 'right', Record<string, Record<string, unknown>>>>
    const mock = (window as unknown as {
      __mockHass: {
        freeSleepSchedules: () => Schedules
        setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
      }
    }).__mockHass
    const schedules = mock.freeSleepSchedules()
    const sideSchedule = schedules[targetSide] ?? {}
    const daySchedule = sideSchedule[targetDay] ?? {}
    const scheduleEntityId = adapterMode === 'climate'
      ? 'sensor.master_bedroom_sleepypod_eight_pod_schedules'
      : 'sensor.nightcanvasrestful_schedules'
    mock.setEntityAttribute(scheduleEntityId, targetSide, {
      ...sideSchedule,
      [targetDay]: {
        ...daySchedule,
        alarm: nextAlarms[0],
        alarms: nextAlarms,
      },
    })
  }, { adapterMode: adapter, nextAlarms: alarms, scheduleDay, side })
}

async function replaceVisiblePrivateText(subject: Locator, replacements: Record<string, string>) {
  await subject.evaluate((element, values) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      let text = node.textContent ?? ''
      for (const [privateText, replacement] of Object.entries(values)) {
        text = text.replaceAll(privateText, replacement)
      }
      node.textContent = text
      node = walker.nextNode()
    }
  }, replacements)
  const text = await subject.innerText()
  for (const [privateText, replacement] of Object.entries(replacements)) {
    expect(text).not.toContain(privateText)
    expect(text).toContain(replacement)
  }
}

async function captureSyntheticWorkflowSubject(page: Page, id: string, subject: Locator) {
  if (await subject.getAttribute('data-state') === 'open') {
    await expect(subject).toHaveAttribute('data-state', 'open')
    await page.waitForTimeout(600)
  }
  await expectPrivacySafeRouteContext(id, subject)
  await expectManualSubject(id, subject)
  await captureManualSubject(page, id, subject)
}

async function openHomeStatusSheet(
  page: Page,
  chipTitle: string,
  sheetName: string,
  sheetKind: 'air-quality' | 'climate' | 'contact' | 'occupancy',
  states: Record<string, string>,
) {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await setSyntheticStates(page, states)
  const chip = page.locator(`[data-status-chip="${chipTitle}"]`)
  await chip.scrollIntoViewIfNeeded()
  await expect(chip).toBeVisible()
  await chip.getByRole('button').click()
  const dialog = page.getByRole('dialog', { name: sheetName })
  await expect(dialog).toBeVisible({ timeout: 15000 })
  await expect(dialog.locator(`[data-manual-sheet="${sheetKind}"][data-manual-sheet-view="overview"]`)).toBeVisible()
  if (await dialog.getAttribute('data-state') === 'open') await page.waitForTimeout(600)
  return dialog
}

async function visibleRouteContextEvidence(id: string, subject: Locator) {
  const cropHeight = configuredCropHeight(id)
  return subject.evaluate((element, configuredHeight) => {
    const subjectRect = element.getBoundingClientRect()
    const cropBottom = Math.min(subjectRect.bottom, subjectRect.top + (configuredHeight ?? subjectRect.height))
    const text: string[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let current = walker.nextNode()
    while (current) {
      const value = current.textContent?.replace(/\s+/g, ' ').trim()
      const parent = current.parentElement
      if (value && parent) {
        let visible = true
        let ancestor: HTMLElement | null = parent
        while (ancestor && element.contains(ancestor)) {
          const style = getComputedStyle(ancestor)
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            visible = false
            break
          }
          if (ancestor === element) break
          ancestor = ancestor.parentElement
        }
        if (visible) {
          const range = document.createRange()
          range.selectNodeContents(current)
          const rects = Array.from(range.getClientRects())
          const rendered = rects.some((rect) => (
            rect.width > 0
            && rect.height > 0
            && rect.right > subjectRect.left
            && rect.left < subjectRect.right
            && rect.bottom > subjectRect.top
            && rect.top < cropBottom
            && rect.bottom > 0
            && rect.top < window.innerHeight
          ))
          if (rendered) text.push(value)
        }
      }
      current = walker.nextNode()
    }
    const visibleMedia = Array.from(element.querySelectorAll<HTMLElement>('video, [data-webrtc-card], img[src*="camera"], img[src*="snapshot"]')).filter((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return rect.width > 0
        && rect.height > 0
        && rect.right > subjectRect.left
        && rect.left < subjectRect.right
        && rect.bottom > subjectRect.top
        && rect.top < cropBottom
    }).length
    return { text: text.join(' '), visibleMedia }
  }, cropHeight)
}

async function expectPrivacySafeRouteContext(id: string, subject: Locator) {
  const evidence = await visibleRouteContextEvidence(id, subject)
  const text = evidence.text
  expect(text).not.toContain('Unavailable')
  expect(text).not.toContain('Loading')
  for (const privateFixtureText of MANUAL_ROUTE_CONTEXT_FORBIDDEN_FIXTURE_TEXT) {
    expect(text).not.toContain(privateFixtureText)
  }
  expect(text).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)
  expect(evidence.visibleMedia).toBe(0)
}

async function openRouteContext(page: Page, config: ManualRouteContextScreenshotConfig) {
  const heading = DASHBOARD_ROUTES.find((route) => route.path === config.routePath)?.title
  if (!heading) throw new Error(`Missing route heading for ${config.routePath}`)
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await page.evaluate(({ fixture, routePath }) => {
    type MockHassApi = {
      reset: () => void
      setEntityState: (entityId: string, state: string) => void
      setInventoryItems: (location: string, items: Record<string, unknown>[]) => void
      setTodoItems: (entityId: string, items: Array<{ status: string }>) => void
    }
    const targetWindow = window as unknown as { __mockHass: MockHassApi }
    targetWindow.__mockHass.reset()
    const mock = targetWindow.__mockHass
    for (const [entityId, state] of Object.entries(fixture?.entityStates ?? {})) {
      mock.setEntityState(entityId, state)
    }
    for (const [entityId, items] of Object.entries(fixture?.todoItemsByEntity ?? {})) {
      mock.setTodoItems(entityId, items)
      mock.setEntityState(entityId, String(items.filter((item) => item.status !== 'completed').length))
    }
    for (const [location, items] of Object.entries(fixture?.inventoryByLocation ?? {})) {
      mock.setInventoryItems(location, items)
    }
    window.history.pushState({}, '', `/index.html?path=${routePath}`)
    window.dispatchEvent(new Event('dashboard-route-change'))
  }, { fixture: config.fixture, routePath: config.routePath })
  await pageMain(page, heading)
  await expect(page.locator(`[data-route-path="${config.routePath}"][data-route-transition-state="idle"]`)).toBeVisible()
  if (config.excludeSelectors?.length) {
    await page.addStyleTag({
      content: `${config.excludeSelectors.join(', ')} { visibility: hidden !important; }`,
    })
  }
  if (config.focusSelector) {
    const focus = page.locator(config.focusSelector)
    await expect(focus).toBeVisible({ timeout: 15000 })
    await focus.evaluate((element, focusBottomPadding) => {
      let ancestor = element.parentElement
      while (ancestor) {
        const style = getComputedStyle(ancestor)
        if (ancestor.scrollHeight > ancestor.clientHeight && /(auto|scroll)/.test(style.overflowY)) break
        ancestor = ancestor.parentElement
      }
      if (ancestor && focusBottomPadding > 0) {
        const scrollContent = ancestor.firstElementChild as HTMLElement | null
        if (scrollContent) scrollContent.style.paddingBottom = `${focusBottomPadding}px`
      }
      element.scrollIntoView({ block: 'start' })
    }, config.focusBottomPadding ?? 0)
  }
}

const VACATION_CHECKLIST_STATES = {
  'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers': 'on',
  'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain': 'on',
  'input_boolean.vacation_checklist_make_the_bed': 'off',
  'input_boolean.vacation_checklist_unload_and_check_dishwasher': 'off',
  'input_boolean.vacation_checklist_trash_and_recycles_taken_out': 'on',
} as const

const CLEAR_OCCUPANCY_STATES = Object.fromEntries(
  OCCUPANCY_GROUPS.flatMap((group) => group.items.map((item) => [item.entityId, 'off'])),
)

const CLOSED_CONTACT_STATES = Object.fromEntries(
  CONTACT_GROUPS.flatMap((group) => group.items.map((item) => [item.entityId, 'off'])),
)

async function replaceVacationChecklistCopy(page: Page) {
  await page.addStyleTag({
    content: `
      [data-manual-private-checklist-row="true"] strong {
        font-size: 0 !important;
      }
      [data-manual-private-checklist-row="true"] strong::after {
        content: "Private checklist item";
        font-size: 0.95rem;
      }
    `,
  })
}

test('app-layout-home', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await expect(page.getByRole('button', { name: 'Rooms' })).toBeVisible()
  const subject = configuredCrop(page, 'app-layout-home')
  await expectManualSubject('app-layout-home', subject)
  await captureManualSubject(page, 'app-layout-home', subject)
})

test('section-start-navigation', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  const subject = configuredCrop(page, 'section-start-navigation')
  await expectManualSubject('section-start-navigation', subject)
  await captureManualSubject(page, 'section-start-navigation', subject)
})

test('section-home-context', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  const subject = configuredCrop(page, 'section-home-context')
  await expect(subject.getByText('Partly Cloudy')).toBeVisible()
  await expectManualSubject('section-home-context', subject)
  await captureManualSubject(page, 'section-home-context', subject)
})

test('section-security-context', async ({ page }) => {
  await page.goto('/index.html?path=security')
  await pageMain(page, 'Security')
  const subject = configuredCrop(page, 'section-security-context')
  await expectManualSubject('section-security-context', subject)
  await captureManualSubject(page, 'section-security-context', subject)
})

test('section-security-modes', async ({ page }) => {
  await page.goto('/index.html?path=security')
  await pageMain(page, 'Security')
  await page.getByRole('button', { name: /Security System /i }).click()
  const subject = page.locator('[data-security-mode-grid="true"]')
  await subject.scrollIntoViewIfNeeded()
  await expectManualSubject('section-security-modes', subject)
  await captureManualSubject(page, 'section-security-modes', subject)
})

test('security-camera-controls', async ({ page }) => {
  await page.goto('/index.html?path=security')
  await pageMain(page, 'Security')
  await page.getByRole('button', { name: 'Open Driveway camera' }).click()
  const subject = configuredCrop(page, 'security-camera-controls')
  await subject.scrollIntoViewIfNeeded()
  await expectManualSubject('security-camera-controls', subject)
  await captureManualSubject(page, 'security-camera-controls', subject)
})

test('section-climate-context', async ({ page }) => {
  await page.goto('/index.html?path=ecobee')
  await pageMain(page, 'Thermostat')
  await page.getByRole('navigation', { name: 'Dashboard sections' }).evaluate((element) => {
    element.style.display = 'none'
  })
  const subject = configuredCrop(page, 'section-climate-context')
  await subject.scrollIntoViewIfNeeded()
  await expect(subject.getByRole('button', { exact: true, name: 'Room Thermostats' })).toBeVisible()
  await expectManualSubject('section-climate-context', subject)
  await captureManualSubject(page, 'section-climate-context', subject)
})

test('section-chores-context', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'chores', 'Chores', {
    todoItemsByEntity: Object.fromEntries(TODO_PAGES.chores.lists.map((list) => [list.entityId, []])),
  })
  const subject = configuredCrop(page, 'section-chores-context')
  await expect(subject.getByRole('button', { name: /Stephen's Tasks/ })).toBeVisible({ timeout: 15000 })
  await subject.scrollIntoViewIfNeeded()
  await expectPrivacySafeRouteContext('section-chores-context', subject)
  await expectManualSubject('section-chores-context', subject)
  await captureManualSubject(page, 'section-chores-context', subject)
})

test('section-food-context', async ({ page }) => {
  await page.goto('/index.html?path=food')
  await pageMain(page, 'Food & Recipes')
  const subject = configuredCrop(page, 'section-food-context')
  await expect(subject.getByText('35 Items • 6 Expiring Soon')).toBeVisible({ timeout: 15000 })
  await subject.scrollIntoViewIfNeeded()
  await expectManualSubject('section-food-context', subject)
  await captureManualSubject(page, 'section-food-context', subject)
})

test('food-suggested-recipes', async ({ page }) => {
  await page.goto('/index.html?path=food')
  await pageMain(page, 'Food & Recipes')
  const subject = configuredCrop(page, 'food-suggested-recipes')
  await expect(subject.getByRole('button', {
    name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
  })).toBeVisible({ timeout: 15000 })
  await subject.scrollIntoViewIfNeeded()
  await expectPrivacySafeRouteContext('food-suggested-recipes', subject)
  await expectManualSubject('food-suggested-recipes', subject)
  await captureManualSubject(page, 'food-suggested-recipes', subject)
})

test('section-rooms-context', async ({ page }) => {
  await page.goto('/index.html?path=living-room')
  await pageMain(page, 'Living Room')
  const subject = configuredCrop(page, 'section-rooms-context')
  await subject.scrollIntoViewIfNeeded()
  await expectManualSubject('section-rooms-context', subject)
  await captureManualSubject(page, 'section-rooms-context', subject)
})

for (const config of MANUAL_ROUTE_CONTEXT_SCREENSHOTS) {
  test(config.scenarioId, async ({ page }) => {
    await openRouteContext(page, config)
    const subject = configuredCrop(page, config.id)
    for (const target of config.requiredTargets) {
      await expect(
        subject
          .getByText(target, { exact: false })
          .or(subject.getByLabel(target, { exact: false }))
          .first(),
      ).toBeVisible({ timeout: 15000 })
    }
    await expectPrivacySafeRouteContext(config.id, subject)
    await expectManualSubject(config.id, subject)
    await captureManualSubject(page, config.id, subject)
  })
}

test('mach-e-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'mach-e', 'Mach-E', {
    'sensor.fordpass_3fmtk3su5mma09266_elvehcharging': 'charging',
    'lock.fordpass_3fmtk3su5mma09266_doorlock': 'locked',
    'select.fordpass_3fmtk3su5mma09266_rccseatfrontleft': 'Heated Level 2',
    'select.fordpass_3fmtk3su5mma09266_rccseatfrontright': 'Off',
    'number.fordpass_3fmtk3su5mma09266_rcctemperature': '72',
  })
  const subject = configuredCrop(page, 'mach-e-page-context')
  await expectPrivacySafeRouteContext('mach-e-page-context', subject)
  await expectManualSubject('mach-e-page-context', subject)
  await captureManualSubject(page, 'mach-e-page-context', subject)
})

test('vacuums-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'vacuums', 'Vacuums', {
    'vacuum.valetudo_exaltedsneakydeer': 'docked',
    'sensor.valetudo_exaltedsneakydeer_battery_level': '99',
    'vacuum.valetudo_elatedusedram': 'idle',
    'sensor.valetudo_elatedusedram_battery_level': '82',
    'sensor.valetudo_elatedusedram_status_flag': 'ready',
    'sensor.valetudo_elatedusedram_error': 'No error',
    'vacuum.valetudo_politefatherlykingfisher': 'cleaning',
    'sensor.valetudo_politefatherlykingfisher_battery_level': '74',
    'sensor.valetudo_politefatherlykingfisher_status_flag': 'active',
    'sensor.valetudo_politefatherlykingfisher_error': 'No error',
  })
  const subject = configuredCrop(page, 'vacuums-page-context')
  await expect(subject.getByRole('button', { name: /Main Floor Docked • 99%/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Music Room Idle • 82%/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Theater Room Cleaning • 74%/i })).toBeVisible()
  await expectPrivacySafeRouteContext('vacuums-page-context', subject)
  await expectManualSubject('vacuums-page-context', subject)
  await captureManualSubject(page, 'vacuums-page-context', subject)
})

test('media-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'media', 'Media', {
    'media_player.living_room_shield': 'playing',
    'media_player.sony_projector': 'on',
    'input_boolean.is_nintendo_switch_active': 'on',
    'input_boolean.is_theater_shield_active': 'off',
  })
  const subject = configuredCrop(page, 'media-page-context')
  await expect(subject.getByRole('button', { name: /Living Room SHIELD Playing/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Theater Room On/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Nintendo Switch On/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Theater SHIELD Off/i })).toBeVisible()
  await expectPrivacySafeRouteContext('media-page-context', subject)
  await expectManualSubject('media-page-context', subject)
  await captureManualSubject(page, 'media-page-context', subject)
})

test('section-settings-context', async ({ page }) => {
  await page.goto('/index.html?path=settings')
  await pageMain(page, 'Settings')
  const subject = configuredCrop(page, 'section-settings-context')
  await expectManualSubject('section-settings-context', subject)
  await captureManualSubject(page, 'section-settings-context', subject)
})

test('admin-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'admin', 'Admin', {
    'input_boolean.is_front_door_auto_lock_enabled': 'on',
    'input_boolean.relay_control_mode': 'off',
    'input_boolean.show_outdoor_faucets': 'off',
    'input_boolean.show_christmas_lights': 'on',
  })
  const subject = configuredCrop(page, 'admin-page-context')
  await expect(subject.getByRole('button', { name: /Front Door Auto-Lock On/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Relay Control Mode Off/i })).toBeVisible()
  await expectPrivacySafeRouteContext('admin-page-context', subject)
  await expectManualSubject('admin-page-context', subject)
  await captureManualSubject(page, 'admin-page-context', subject)
})

test('guest-controls-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'guests-staying-over', 'Guest Controls', {
    'input_boolean.guests_staying_in_guest_room': 'on',
    'input_boolean.guests_staying_in_music_room': 'off',
    'input_boolean.guests_staying_in_theater_room': 'on',
  })
  const subject = configuredCrop(page, 'guest-controls-page-context')
  await expect(subject.getByRole('button', { name: /Guest Room On/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Music Room Off/i })).toBeVisible()
  await expect(subject.getByRole('button', { name: /Theater Room On/i })).toBeVisible()
  await expectPrivacySafeRouteContext('guest-controls-page-context', subject)
  await expectManualSubject('guest-controls-page-context', subject)
  await captureManualSubject(page, 'guest-controls-page-context', subject)
})

test('vacation-page-context', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'vacation', 'Vacation', {
    ...VACATION_CHECKLIST_STATES,
    'input_boolean.vacation_mode': 'off',
    'input_boolean.vacation_mode_invalid_dates_pending': 'off',
  })
  await replaceVacationChecklistCopy(page)
  const subject = configuredCrop(page, 'vacation-page-context')
  await expect(subject.getByRole('button', { name: /Vacation Mode Off/i })).toBeVisible()
  await expect(subject.locator('[data-manual-private-checklist-row="true"] strong').first()).toHaveCSS('font-size', '0px')
  await expectPrivacySafeRouteContext('vacation-page-context', subject)
  await expectManualSubject('vacation-page-context', subject)
  await captureManualSubject(page, 'vacation-page-context', subject)
})

test('vacation-confirmation', async ({ page }) => {
  await openRouteWithSyntheticStates(page, 'vacation', 'Vacation', {
    ...Object.fromEntries(Object.keys(VACATION_CHECKLIST_STATES).map((entityId) => [entityId, 'on'])),
    'input_boolean.vacation_mode': 'off',
    'input_boolean.vacation_mode_invalid_dates_pending': 'off',
  })
  await page.getByRole('button', { name: /Vacation Mode Off/i }).click()
  const subject = page.getByRole('dialog', { name: 'Confirm Vacation' })
  await expect(subject).toBeVisible()
  await subject.getByLabel('Start Date').fill('2030-09-12')
  await subject.getByLabel('Start Time').fill('09:30')
  await subject.getByLabel('End Date').fill('2030-09-18')
  await subject.getByLabel('End Time').fill('18:45')
  await expect(subject.getByLabel('Start Date')).toHaveValue('2030-09-12')
  await expect(subject.getByLabel('End Date')).toHaveValue('2030-09-18')
  await expectManualSubject('vacation-confirmation', subject)
  await captureManualSubject(page, 'vacation-confirmation', subject)
})

test('section-help-context', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=help')
  await pageMain(page, 'App Manual')
  const subject = configuredCrop(page, 'section-help-context')
  await subject.scrollIntoViewIfNeeded()
  await expectManualSubject('section-help-context', subject)
  await captureManualSubject(page, 'section-help-context', subject)
})

test('home-status-rail-start', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  const subject = page.locator('[data-status-rail="true"]').first()
  await subject.evaluate((element) => {
    element.scrollLeft = 0
  })
  for (const chip of ['Lights', 'Security', 'Climate']) {
    await expect(subject.locator(`[data-status-chip="${chip}"]`)).toBeVisible()
  }
  await expectManualSubject('home-status-rail-start', subject)
  await captureManualSubject(page, 'home-status-rail-start', subject)
})

test('home-status-rail-end', async ({ page }) => {
  await page.goto('/index.html?path=overview')
  await pageMain(page, 'Home')
  const subject = page.locator('[data-status-rail="true"]').first()
  await subject.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect.poll(() => subject.evaluate((element) => Math.round(element.scrollLeft))).toBeGreaterThan(0)
  for (const chip of ['Contact Sensors', 'Air Quality']) {
    await expect(subject.locator(`[data-status-chip="${chip}"]`)).toBeVisible()
  }
  await expectManualSubject('home-status-rail-end', subject)
  await captureManualSubject(page, 'home-status-rail-end', subject)
})

test('home-climate-overview', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Climate', 'Climate', 'climate', {
    'input_text.living_room_climate_range': '66°F - 68°F',
    'input_text.guest_room_climate_range': '70°F - 72°F',
  })
  await expectPrivacySafeRouteContext('home-climate-overview', dialog)
  await expectManualSubject('home-climate-overview', dialog)
  await captureManualSubject(page, 'home-climate-overview', dialog)
})

test('home-climate-room-detail', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Climate', 'Climate', 'climate', {
    'input_text.guest_room_climate_range': '69°F - 71°F',
    'sensor.guest_room_presence_sensor_temperature_2': '69.5',
    'sensor.guest_room_closet_facing_presence_sensor_temperature_2': '70.2',
    'cover.guest_room_vent_vent': 'open',
  })
  await dialog.getByRole('button', { name: 'Open Guest Room Climate' }).click()
  await expect(dialog.locator('[data-manual-sheet="climate"][data-manual-sheet-view="detail"]')).toBeVisible()
  await expectPrivacySafeRouteContext('home-climate-room-detail', dialog)
  await expectManualSubject('home-climate-room-detail', dialog)
  await captureManualSubject(page, 'home-climate-room-detail', dialog)
})

test('home-occupancy-overview', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Occupancy', 'Occupancy', 'occupancy', {
    ...CLEAR_OCCUPANCY_STATES,
    'binary_sensor.living_room_presence_sensor_presence': 'on',
  })
  await expect(dialog.getByRole('heading', { name: 'Clear' })).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Open Hallway Occupancy' })).toHaveCount(1)
  await expectPrivacySafeRouteContext('home-occupancy-overview', dialog)
  await expectManualSubject('home-occupancy-overview', dialog)
  await captureManualSubject(page, 'home-occupancy-overview', dialog)
})

test('home-occupancy-room-detail', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Occupancy', 'Occupancy', 'occupancy', {
    ...CLEAR_OCCUPANCY_STATES,
    'binary_sensor.guest_room_presence_sensor_presence': 'on',
  })
  await dialog.getByRole('button', { name: 'Open Guest Room Occupancy' }).click()
  await expect(dialog.locator('[data-manual-sheet="occupancy"][data-manual-sheet-view="detail"]')).toBeVisible()
  await expectPrivacySafeRouteContext('home-occupancy-room-detail', dialog)
  await expectManualSubject('home-occupancy-room-detail', dialog)
  await captureManualSubject(page, 'home-occupancy-room-detail', dialog)
})

test('home-contact-overview', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Contact Sensors', 'Contact Sensors', 'contact', {
    ...CLOSED_CONTACT_STATES,
    'binary_sensor.office_pc_window_sensor_contact': 'on',
  })
  await expectPrivacySafeRouteContext('home-contact-overview', dialog)
  await expectManualSubject('home-contact-overview', dialog)
  await captureManualSubject(page, 'home-contact-overview', dialog)
})

test('home-contact-room-detail', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Contact Sensors', 'Contact Sensors', 'contact', {
    ...CLOSED_CONTACT_STATES,
    'binary_sensor.office_pc_window_sensor_contact': 'on',
  })
  await dialog.getByRole('button', { name: 'Open Office Contact Sensors' }).click()
  await expect(dialog.locator('[data-manual-sheet="contact"][data-manual-sheet-view="detail"]')).toBeVisible()
  await expectPrivacySafeRouteContext('home-contact-room-detail', dialog)
  await expectManualSubject('home-contact-room-detail', dialog)
  await captureManualSubject(page, 'home-contact-room-detail', dialog)
})

test('home-air-quality-overview', async ({ page }) => {
  const dialog = await openHomeStatusSheet(page, 'Air Quality', 'Air Quality', 'air-quality', {
    'sensor.living_room_air_purifier_air_quality_index': '12',
    'sensor.living_room_air_purifier_pm2_5': '4',
    'sensor.guest_room_air_purifier_air_quality_index': '27',
    'sensor.guest_room_air_purifier_pm2_5': '8',
    'sensor.office_air_purifier_air_quality_index': '63',
    'sensor.office_air_purifier_pm2_5': '21',
  })
  await expectPrivacySafeRouteContext('home-air-quality-overview', dialog)
  await expectManualSubject('home-air-quality-overview', dialog)
  await captureManualSubject(page, 'home-air-quality-overview', dialog)
})

test('status-lights-overview', async ({ page }) => {
  await page.goto('/index.html?path=overview#lights-overview')
  const dialog = page.getByRole('dialog', { name: 'Lights' })
  await expect(dialog).toBeVisible({ timeout: 15000 })
  await expectManualSubject('status-lights-overview', dialog)
  await captureManualSubject(page, 'status-lights-overview', dialog)
})

test('status-lights-detail', async ({ page }) => {
  await page.goto('/index.html?path=overview#lights-overview')
  const dialog = page.getByRole('dialog', { name: 'Lights' })
  await expect(dialog).toBeVisible({ timeout: 15000 })
  await dialog.getByRole('button', { name: /Open Living Room Lights/i }).click()
  await expect(dialog.getByRole('heading', { name: 'Living Room Lights' })).toBeVisible()
  await expectManualSubject('status-lights-detail', dialog)
  await captureManualSubject(page, 'status-lights-detail', dialog)
})

test('presence-lighting-states', async ({ page }) => {
  await page.goto('/index.html?path=admin')
  await pageMain(page, 'Admin')
  await page.getByRole('button', { name: 'Open Presence-Based Overrides' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 15000 })
  await dialog.getByRole('button', { name: /Living Room (Enabled|Disabled|Paused|Quieted)/ }).click()
  await expectManualSubject('presence-lighting-states', dialog)
  await captureManualSubject(page, 'presence-lighting-states', dialog)
})

test('thermostat-options', async ({ page }) => {
  await page.goto('/index.html?path=ecobee')
  const subject = await pageMain(page, 'Thermostat')
  await expectManualSubject('thermostat-options', subject)
  await captureManualSubject(page, 'thermostat-options', subject)
})

test('chore-schedule', async ({ page }) => {
  await page.goto('/index.html?path=chores')
  await pageMain(page, 'Chores')
  await page.getByRole('button', { name: 'Add Task' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create Task' })
  await dialog.getByLabel('Recurrence').selectOption('interval')
  await dialog.getByLabel('Repeat Every').scrollIntoViewIfNeeded()
  await expectManualSubject('chore-schedule', dialog)
  await captureManualSubject(page, 'chore-schedule', dialog)
})

test('food-scan-review', async ({ page }) => {
  await page.goto('/index.html?path=food')
  await pageMain(page, 'Food & Recipes')
  await page.getByRole('button', { name: 'Scan Item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Item' })
  await expect(dialog).toBeVisible()
  const manualName = dialog.getByRole('button', { name: 'Manually Enter Name' })
  await expect(manualName).toBeVisible({ timeout: 15000 })
  await manualName.click()
  const productName = dialog.getByRole('textbox', { name: 'Product name' })
  await expect(productName).toBeVisible()
  await productName.fill('Pasta Sauce')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Manually Enter Expiration Date' }).click()
  await dialog.locator('input[type="date"]').fill('2026-09-01')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog.getByText(/Review Item .* Step 3 of 3/).first()).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Product name' })).toHaveValue('Pasta Sauce')
  await dialog.getByRole('button', { name: 'Prepared Food Item' }).scrollIntoViewIfNeeded()
  await expectManualSubject('food-scan-review', dialog)
  await captureManualSubject(page, 'food-scan-review', dialog)
})

test('humidifier-schedule', async ({ page }) => {
  await page.goto('/index.html?path=master-bedroom')
  await pageMain(page, 'Master Bedroom')
  await page.getByRole('button', { name: /Humidifier .*46%/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Schedules', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Scheduled Activity' }).click()
  await expectManualSubject('humidifier-schedule', dialog)
  await captureManualSubject(page, 'humidifier-schedule', dialog)
})

test('vacuum-area-editor', async ({ page }) => {
  await page.goto('/index.html?path=vacuums')
  await pageMain(page, 'Vacuums')
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('group', { name: 'Cleaning target' }).getByRole('button', { name: 'Area' }).click()
  await dialog.getByRole('button', { name: 'Draw Area' }).click()
  const overlay = dialog.locator('[data-map-editor-overlay="true"]')
  await expect(overlay).toBeVisible()
  const box = await overlay.boundingBox()
  if (!box) throw new Error('Vacuum area editor overlay was not measurable')
  await page.mouse.move(box.x + box.width * 0.34, box.y + box.height * 0.32)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.62, { steps: 8 })
  await page.mouse.up()
  await expect(dialog.locator('[data-map-rect="true"]')).toBeVisible()
  await expectManualSubject('vacuum-area-editor', dialog)
  await captureManualSubject(page, 'vacuum-area-editor', dialog)
})

test('recipes-browse', async ({ page }) => {
  await page.goto('/index.html?path=recipes')
  const main = await pageMain(page, 'Recipes')
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Search recipes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sort' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible()
  const subject = page.locator('#root > div').filter({ has: main.getByRole('heading', { level: 1, name: 'Recipes' }) }).first()
  await expectManualSubject('recipes-browse', subject)
  await captureManualSubject(page, 'recipes-browse', subject)
})

test('recipe-detail', async ({ page }) => {
  await page.goto('/index.html?path=food')
  await pageMain(page, 'Food & Recipes')
  await page.getByRole('button', { name: /Open Suggested Citrus Pantry Bowl .* recipe details/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Instructions' }).click()
  await expect(dialog.getByRole('tabpanel', { name: 'Instructions' })).toBeVisible()
  await expectManualSubject('recipe-detail', dialog)
  await captureManualSubject(page, 'recipe-detail', dialog)
})

const GUEST_PRESENCE_STATES = {
  'input_boolean.guests_staying_in_guest_room': 'on',
  'input_boolean.guests_staying_in_music_room': 'on',
  'input_boolean.guests_staying_in_theater_room': 'off',
  'cover.left_door': 'closed',
  'cover.right_door': 'closed',
  'lock.aqara_smart_lock_u400': 'locked',
  'alarm_control_panel.aqara_hub_m3_0056_security_system_2': 'disarmed',
  'automation.automatically_vacuum_or_mop_music_room': 'off',
  'automation.automatically_vacuum_theater_room_on_schedule': 'off',
  'switch.main_floor_vacuum_coordinator_pause': 'on',
  'select.thermostat_contact_sensors_eco_behavior_when_away': 'Disable Eco When Away',
  'switch.guest_bathroom_towel_rack_switch_top': 'off',
  'switch.master_bathroom_towel_rack_switch_top': 'off',
} as const

const DISHWASHER_ACTIVE_STATES = {
  'binary_sensor.dishwasher_connectivity': 'on',
  'binary_sensor.dishwasher_remote_control': 'on',
  'binary_sensor.dishwasher_remote_start': 'on',
  'button.dishwasher_resume_program': 'idle',
  'button.dishwasher_stop_program': 'idle',
  'input_boolean.dishwasher_clean_unopened': 'off',
  'select.dishwasher_active_program': 'Eco 50',
  'select.dishwasher_selected_program': 'Eco 50',
  'sensor.dishwasher_door': 'closed',
  'sensor.dishwasher_operation_state': 'run',
  'sensor.dishwasher_program_finish_time': '2030-09-18T18:45:00+00:00',
  'sensor.dishwasher_program_progress': '42',
  'sensor.dishwasher_rinse_aid_nearly_empty': 'off',
  'sensor.dishwasher_salt_nearly_empty': 'off',
  'switch.dishwasher_half_load': 'on',
  'switch.dishwasher_hygiene': 'off',
  'switch.dishwasher_power': 'on',
  'switch.dishwasher_zeolite_dry': 'on',
} as const

const MEDIA_REMOTE_STATES = {
  'media_player.sony_projector': 'on',
  'media_player.theater': 'on',
  'media_player.theater_room_shield': 'playing',
  'input_boolean.theater_pc_power': 'off',
} as const

const MAIN_FLOOR_VACUUM_STATES = {
  'vacuum.valetudo_exaltedsneakydeer': 'docked',
  'sensor.valetudo_exaltedsneakydeer_battery_level': '88',
  'sensor.valetudo_exaltedsneakydeer_status_flag': 'ready',
  'sensor.valetudo_exaltedsneakydeer_error': 'No error',
  'input_text.main_floor_vacuum_error_message': '',
  'select.valetudo_exaltedsneakydeer_mode': 'vacuum',
  'select.valetudo_exaltedsneakydeer_fan': 'balanced',
  'select.valetudo_exaltedsneakydeer_water': 'medium',
  'input_select.main_floor_vacuum_cleaning_passes': '1',
  'binary_sensor.valetudo_exaltedsneakydeer_mop_attachment': 'on',
  'sensor.valetudo_exaltedsneakydeer_dock_status': 'idle',
} as const

const HEALTHY_HUMIDIFIER_STATES = {
  'switch.lv600s_humidifier_power': 'on',
  'switch.lv600s_humidifier_display': 'on',
  'select.lv600s_humidifier_mode': 'Manual',
  'number.lv600s_humidifier_mist_level': '5',
  'number.lv600s_humidifier_warm_level': '1',
  'number.lv600s_humidifier_timer_minutes': '0',
  'sensor.lv600s_humidifier_timer_remaining': '0',
  'sensor.lv600s_humidifier_current_humidity': '46',
  'sensor.lv600s_humidifier_current_temperature': '71.6',
  'binary_sensor.lv600s_humidifier_water_low': 'off',
  'binary_sensor.lv600s_humidifier_tank_removed': 'off',
  'binary_sensor.lv600s_humidifier_humidifying': 'on',
} as const

const SYNTHETIC_HUMIDIFIER_RULE_DATA = {
  display: false,
  end_time: '07:00',
  label: 'Synthetic Night Profile',
  mist_level: 4,
  mode: 'Sleep',
  rule_days: 'monday,tuesday,wednesday,thursday,friday',
  rule_id: 'synthetic-night-profile',
  start_time: '22:00',
  target_humidity: 50,
  warm_level: 0,
}

const SYNTHETIC_HUMIDIFIER_SCHEDULE = {
  id: 'master_bedroom_humidifier',
  name: 'Master Bedroom Humidifier',
  icon: 'mdi:calendar-clock',
  sunday: [],
  monday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '22:00', to: '24:00' }],
  tuesday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '00:00', to: '07:00' }, { data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '22:00', to: '24:00' }],
  wednesday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '00:00', to: '07:00' }, { data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '22:00', to: '24:00' }],
  thursday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '00:00', to: '07:00' }, { data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '22:00', to: '24:00' }],
  friday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '00:00', to: '07:00' }, { data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '22:00', to: '24:00' }],
  saturday: [{ data: SYNTHETIC_HUMIDIFIER_RULE_DATA, from: '00:00', to: '07:00' }],
}

const SLEEPYPOD_CLIMATE_STATES = {
  'climate.sleepypod_eight_pod_left_side': 'heat',
  'number.master_bedroom_sleepypod_eight_pod_left_target_level': '-2',
  'sensor.sleepypod_stephen_schedule_phase': 'bedtime',
  'input_boolean.eight_sleep_stephen_hot_flash_active': 'off',
  'sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state': 'idle',
  'binary_sensor.sleepypod_eight_pod_left_pump_stall': 'off',
  'binary_sensor.sleepypod_eight_pod_left_pump_clog_detected': 'off',
  'sensor.sleepypod_eight_pod_left_pump_loop_temp': '79',
  'sensor.sleepypod_eight_pod_left_pump_rpm': '2450',
  'sensor.sleepypod_eight_pod_left_heart_rate': '61',
  'sensor.sleepypod_eight_pod_left_breathing_rate': '14',
  'sensor.sleepypod_eight_pod_left_hrv': '48',
} as const

const SLEEPYPOD_CLIMATE_ATTRIBUTES = {
  'climate.sleepypod_eight_pod_left_side': {
    current_temperature: 82,
    hvac_action: 'heating',
    hvac_modes: ['off', 'heat'],
    temperature: 80,
  },
  'sensor.sleepypod_eight_pod_left_pump_loop_temp': { unit_of_measurement: '°F' },
  'sensor.sleepypod_eight_pod_left_pump_rpm': { unit_of_measurement: 'rpm' },
  'sensor.sleepypod_eight_pod_left_heart_rate': { unit_of_measurement: 'bpm' },
  'sensor.sleepypod_eight_pod_left_breathing_rate': { unit_of_measurement: 'br/min' },
  'sensor.sleepypod_eight_pod_left_hrv': { unit_of_measurement: 'ms' },
} as const

const EIGHT_SLEEP_LEGACY_STATES = {
  'climate.sleepypod_eight_pod_left_side': 'unavailable',
  'number.master_bedroom_sleepypod_eight_pod_left_target_level': 'unavailable',
  'number.nightcanvasrestful_left_target_temperature': '-1',
  'sensor.nightcanvasrestful_left_current_temperature': '86',
  'sensor.nightcanvasrestful_left_seconds_remaining': '7200',
  'binary_sensor.nightcanvasrestful_left_presence': 'on',
  'switch.nightcanvasrestful_left_power': 'on',
  'switch.nightcanvasrestful_left_away_mode': 'off',
  'input_boolean.eight_sleep_stephen_hot_flash_active': 'off',
  'sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state': 'idle',
} as const

const SYNTHETIC_INVENTORY = [
  {
    expiry_date: '2030-01-15',
    id: 7101,
    inventory_id: 7101,
    location: 'dispensa',
    name: 'Synthetic Batch Item',
    prepared_food: false,
    product_id: 97101,
    quantity: 2,
    unit: 'items',
    vacuum_sealed: false,
  },
  {
    expiry_date: '2030-02-20',
    id: 7102,
    inventory_id: 7102,
    location: 'frigo',
    name: 'Synthetic Batch Item',
    prepared_food: true,
    product_id: 97101,
    quantity: 1,
    unit: 'items',
    vacuum_sealed: false,
  },
  {
    expiry_date: '2030-03-10',
    id: 7201,
    inventory_id: 7201,
    location: 'dispensa',
    name: 'Synthetic Single Item',
    prepared_food: false,
    product_id: 97201,
    quantity: 3,
    unit: 'items',
    vacuum_sealed: false,
  },
] as const

const SYNTHETIC_REPORT_TASK: ManualSyntheticTodoItem = {
  status: 'needs_action',
  summary: 'Synthetic report chore',
  uid: '9401--None',
}

const SYNTHETIC_REPORT_INVENTORY = [{
  expiry_date: '2020-01-15',
  id: 7301,
  inventory_id: 7301,
  location: 'dispensa',
  name: 'Synthetic Report Produce',
  prepared_food: false,
  product_id: 97301,
  quantity: 2,
  unit: 'items',
  vacuum_sealed: false,
}]

const SYNTHETIC_DONETICK_TASK = {
  assignees: [1],
  assigned_to: 1,
  description: 'Synthetic report task details.',
  frequency: 1,
  frequency_metadata: {},
  frequency_type: 'once',
  hide_on_vacation: true,
  id: 9401,
  name: 'Synthetic report chore',
  next_due_date: null,
  priority: 2,
}

const SYNTHETIC_UPCOMING_REPORT_TASK: ManualSyntheticTodoItem = {
  status: 'needs_action',
  summary: 'Synthetic upcoming chore',
  uid: '9402--None',
}

const SYNTHETIC_UPCOMING_DONETICK_TASK = {
  ...SYNTHETIC_DONETICK_TASK,
  id: 9402,
  name: 'Synthetic upcoming chore',
  next_due_date: null,
}

async function openSyntheticWeatherSheet(page: Page) {
  await openRouteWithSyntheticFixture(page, 'overview', 'Home')
  await page.getByRole('button', { name: /Open seven-day weather forecast/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  await expect(dialog.getByText('Conditions')).toBeVisible({ timeout: 15000 })
  return dialog
}

async function openSyntheticHumidifierSheet(
  page: Page,
  fixture: ManualSyntheticFixture = {},
) {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom', {
    ...fixture,
    entityStates: {
      ...HEALTHY_HUMIDIFIER_STATES,
      ...(fixture.entityStates ?? {}),
    },
  })
  await page.getByRole('button', { name: /Humidifier Humidifying.*46%/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Master Bedroom Humidifier' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function openSyntheticSleepSheet(
  page: Page,
  mode: 'climate' | 'legacy',
  alarms: Array<{ enabled: boolean; time: string }> = [],
) {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom', {
    entityStates: mode === 'climate' ? SLEEPYPOD_CLIMATE_STATES : EIGHT_SLEEP_LEGACY_STATES,
    entityAttributes: mode === 'climate' ? SLEEPYPOD_CLIMATE_ATTRIBUTES : undefined,
  })
  if (alarms.length > 0) await setSyntheticWakeAlarms(page, 'left', 'sunday', alarms, mode)
  await page.getByRole('button', { name: /Stephen's Bed/i }).click()
  const namedDialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  await expect(namedDialog).toBeVisible()
  if (mode === 'climate') {
    await expect(namedDialog.getByRole('button', { name: 'Temperature' })).toBeVisible()
    await expect(namedDialog.getByRole('button', { name: 'Settings' })).toHaveCount(0)
  } else {
    await expect(namedDialog.getByRole('button', { name: 'Sleep Schedule' })).toBeVisible()
    await expect(namedDialog.getByRole('button', { name: 'Settings' })).toBeVisible()
  }
  const dialog = page.locator('[role="dialog"]').last()
  await replaceVisiblePrivateText(dialog, { "Stephen's Bed": 'Synthetic Bed', 'Stephen’s Bed': 'Synthetic Bed' })
  return dialog
}

async function scrollSleepTabPanelIntoView(dialog: Locator, panelScroll: false | 'end' | number = false) {
  const panel = dialog.locator('[data-scroll-region="eight-sleep-panel"]')
  await panel.evaluate((element, requestedPanelScroll) => {
    const body = element.closest<HTMLElement>('[data-modal-sheet-body="true"]')
    if (body) {
      const bodyRect = body.getBoundingClientRect()
      const panelRect = element.getBoundingClientRect()
      body.scrollTop += panelRect.top - bodyRect.top - 8
    }
    if (requestedPanelScroll === 'end') element.scrollTop = element.scrollHeight
    else if (typeof requestedPanelScroll === 'number') element.scrollTop = requestedPanelScroll
  }, panelScroll)
  await dialog.page().waitForTimeout(100)
}

test('weather-sheet', async ({ page }) => {
  const dialog = await openSyntheticWeatherSheet(page)
  await captureSyntheticWorkflowSubject(page, 'weather-sheet', dialog)
})

test('weather-precipitation', async ({ page }) => {
  const dialog = await openSyntheticWeatherSheet(page)
  await dialog.getByRole('button', { name: 'Precipitation conditions' }).click()
  const hourlyPanel = dialog.locator('section[aria-label="24-hour weather conditions"]')
  const modeContent = hourlyPanel.locator('[data-transition]')
  await expect(hourlyPanel.getByText('Precipitation chance (%)')).toBeVisible()
  await expect(hourlyPanel.locator('article[aria-label^="Now precipitation"]')).toBeVisible()
  await expect(modeContent).toHaveAttribute('data-transition', 'idle')
  await expect.poll(() => modeContent.evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
  await page.waitForTimeout(100)
  await captureSyntheticWorkflowSubject(page, 'weather-precipitation', dialog)
})

test('weather-wind', async ({ page }) => {
  const dialog = await openSyntheticWeatherSheet(page)
  await dialog.getByRole('button', { name: 'Wind conditions' }).click()
  const hourlyPanel = dialog.locator('section[aria-label="24-hour weather conditions"]')
  const modeContent = hourlyPanel.locator('[data-transition]')
  await expect(hourlyPanel.getByText('Speed (mph) · Gusts')).toBeVisible()
  await expect(hourlyPanel.locator('article[aria-label^="Now wind"]')).toBeVisible()
  await expect(modeContent).toHaveAttribute('data-transition', 'idle')
  await expect.poll(() => modeContent.evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
  await page.waitForTimeout(100)
  await captureSyntheticWorkflowSubject(page, 'weather-wind', dialog)
})

test('guest-presence-security', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'security', 'Security', {
    entityStates: GUEST_PRESENCE_STATES,
  })
  await page.getByRole('button', { name: 'Guest Presence Security' }).click()
  const dialog = page.getByRole('dialog', { name: 'Guest Presence Security' })
  await expect(dialog.getByRole('heading', { name: 'Guest Rooms' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'guest-presence-security', dialog)
})

test('rooms-picker', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'overview', 'Home')
  await page.getByRole('button', { name: 'Rooms' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rooms' })
  await expect(dialog.locator('section[aria-label="Rooms"]')).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'rooms-picker', dialog)
})

test('room-air-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'guest-room', 'Guest Room', {
    entityStates: {
      'sensor.guest_room_air_purifier_air_quality_index': '27',
      'sensor.guest_room_air_purifier_pm2_5': '8',
      'select.guest_room_air_purifier_auto_mode': 'Quiet',
      'select.guest_room_air_purifier_fan_mode': 'Auto',
      'fan.guest_room_air_purifier_levoit_purifier': 'on',
    },
  })
  await page.getByRole('button', { name: /^Air Quality /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Guest Room Air Quality' })
  await expect(dialog.getByRole('button', { name: 'Quiet' })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'room-air-sheet', dialog)
})

test('room-dishwasher-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'kitchen', 'Kitchen', {
    entityStates: DISHWASHER_ACTIVE_STATES,
  })
  await page.getByRole('button', { name: /^Dishwasher /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Dishwasher' })
  await dialog.getByText('42%').scrollIntoViewIfNeeded()
  await expect(dialog.getByRole('button', { name: 'Stop Program' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'room-dishwasher-sheet', dialog)
})

test('room-climate-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'guest-room', 'Guest Room', {
    entityStates: {
      'input_text.guest_room_climate_range': '69°F - 71°F',
      'sensor.guest_room_presence_sensor_temperature_2': '69.5',
      'sensor.guest_room_closet_facing_presence_sensor_temperature_2': '70.2',
      'cover.guest_room_vent_vent': 'open',
    },
  })
  await page.getByRole('button', { name: /^Climate /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Guest Room Climate' })
  await expect(dialog.getByText('70.2°F')).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'room-climate-sheet', dialog)
})

test('room-contact-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'office', 'Office', {
    entityStates: {
      'binary_sensor.office_windows': 'on',
      'binary_sensor.office_pc_window_sensor_contact': 'on',
      'binary_sensor.office_window_contact_sensor_contact': 'off',
    },
  })
  await page.getByRole('button', { name: /^Windows /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Office Windows' })
  await expect(dialog.getByText('PC Window')).toBeVisible()
  await dialog.getByText('PC Window').scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'room-contact-sheet', dialog)
})

test('room-grill-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'back-deck', 'Back Deck', {
    entityStates: {
      'sensor.d8478fa2ad0a_grill_state': 'cooking',
      'sensor.bear_grills_probe_probe0': '225',
      'sensor.d8478fa2ad0a_pellet_level': '64',
      'switch.d8478fa2ad0a_keep_warm_enabled': 'on',
      'switch.d8478fa2ad0a_super_smoke_enabled': 'off',
    },
    entityAttributes: {
      'sensor.bear_grills_probe_probe0': { unit_of_measurement: '°F' },
      'sensor.d8478fa2ad0a_pellet_level': { unit_of_measurement: '%' },
    },
  })
  await page.getByRole('button', { name: /Bear Grills Cooking/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Back Deck: Bear Grills' })
  await expect(dialog.getByRole('button', { name: /Keep Warm On/i })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'room-grill-sheet', dialog)
})

test('room-humidifier-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom', {
    entityStates: {
      'switch.lv600s_humidifier_power': 'on',
      'switch.lv600s_humidifier_display': 'on',
      'select.lv600s_humidifier_mode': 'Manual',
      'number.lv600s_humidifier_mist_level': '5',
      'number.lv600s_humidifier_warm_level': '1',
      'sensor.lv600s_humidifier_current_humidity': '46',
      'sensor.lv600s_humidifier_current_temperature': '71.6',
      'binary_sensor.lv600s_humidifier_water_low': 'off',
      'binary_sensor.lv600s_humidifier_tank_removed': 'off',
      'binary_sensor.lv600s_humidifier_humidifying': 'on',
    },
  })
  await page.getByRole('button', { name: /Humidifier Humidifying.*46%/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Master Bedroom Humidifier' })
  const mediumPreset = dialog.getByRole('button', { name: 'Medium Level 5' })
  await expect(mediumPreset).toHaveAttribute('aria-pressed', 'true')
  await mediumPreset.scrollIntoViewIfNeeded()
  await dialog.locator('[data-modal-sheet-body="true"]').evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollTop - 64)
  })
  await captureSyntheticWorkflowSubject(page, 'room-humidifier-sheet', dialog)
})

test('humidifier-schedules', async ({ page }) => {
  const dialog = await openSyntheticHumidifierSheet(page, {
    humidifierSchedule: SYNTHETIC_HUMIDIFIER_SCHEDULE,
    entityStates: {
      'input_boolean.master_bedroom_humidifier_schedule_enabled': 'on',
      'schedule.master_bedroom_humidifier': 'off',
    },
  })
  await dialog.getByRole('button', { name: 'Schedules', exact: true }).click()
  await expect(dialog.getByText('Synthetic Night Profile')).toBeVisible()
  await expect(dialog.getByText('1 activity configured')).toBeVisible()
  await dialog.locator('[data-tab="schedules"]').evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(100)
  await captureSyntheticWorkflowSubject(page, 'humidifier-schedules', dialog)
})

test('humidifier-info', async ({ page }) => {
  const dialog = await openSyntheticHumidifierSheet(page)
  await dialog.getByRole('button', { name: 'Info', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Device State' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Environment' })).toBeVisible()
  await dialog.locator('[data-tab="info"]').scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'humidifier-info', dialog)
})

test('room-occupancy-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'guest-room', 'Guest Room', {
    entityStates: {
      'binary_sensor.guest_room_occupancy_sensors': 'on',
      'binary_sensor.guest_room_presence_sensor_presence': 'on',
      'binary_sensor.guest_room_closet_facing_presence_sensor_presence': 'off',
    },
  })
  await page.getByRole('button', { name: /^Occupancy /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Guest Room Occupancy' })
  await expect(dialog.getByText('Detected')).toBeVisible()
  await dialog.getByText('Closet').scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'room-occupancy-sheet', dialog)
})

test('room-vent-sheet', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'living-room', 'Living Room', {
    entityStates: {
      'cover.living_room_vents': 'open',
      'cover.living_room_vent_1_vent': 'open',
      'cover.living_room_vent_2_vent': 'closed',
    },
  })
  await page.getByRole('button', { name: /^Vents /i }).click()
  const dialog = page.getByRole('dialog', { name: 'Living Room: Vents' })
  await expect(dialog.getByText('Vent 2')).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'room-vent-sheet', dialog)
})

test('sleepypod-main', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'climate')
  await expect(dialog.getByRole('heading', { name: 'Sleep Schedule' })).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'sleepypod-main', dialog)
})

test('sleepypod-modes', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'climate')
  await dialog.getByRole('button', { name: 'Special Modes' }).click()
  await expect(dialog.getByRole('heading', { name: 'Special Modes' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Hot Flash Mode Inactive' })).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'sleepypod-modes', dialog)
})

test('sleepypod-alarms', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'climate', [{ enabled: true, time: '06:30' }])
  await dialog.getByRole('button', { name: 'Alarms', exact: true }).click()
  await expect(dialog.getByText('Sunday Alarm')).toBeVisible()
  await expect(dialog.getByRole('switch', { name: /6:30 AM/ })).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'sleepypod-alarms', dialog)
})

test('sleepypod-status', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'climate')
  await dialog.getByRole('button', { name: 'Status', exact: true }).click()
  await expect(dialog.getByText('Pump RPM')).toBeVisible()
  await expect(dialog.getByText('HRV')).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog, 190)
  await captureSyntheticWorkflowSubject(page, 'sleepypod-status', dialog)
})

test('eight-sleep-schedule', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'legacy')
  await expect(dialog.getByRole('heading', { name: 'Sleep Schedule' })).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'eight-sleep-schedule', dialog)
})

test('eight-sleep-modes', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'legacy')
  await dialog.getByRole('button', { name: 'Special Modes' }).click()
  await expect(dialog.getByRole('heading', { name: 'Special Modes' })).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'eight-sleep-modes', dialog)
})

test('eight-sleep-alarms', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'legacy', [{ enabled: true, time: '06:30' }])
  await dialog.getByRole('button', { name: 'Alarms', exact: true }).click()
  await expect(dialog.getByText('Sunday Alarm')).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog)
  await captureSyntheticWorkflowSubject(page, 'eight-sleep-alarms', dialog)
})

test('eight-sleep-status', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'legacy')
  await dialog.getByRole('button', { name: 'Status', exact: true }).click()
  await expect(dialog.getByText('Time Remaining')).toBeVisible()
  await expect(dialog.getByText('2h')).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog, 'end')
  await captureSyntheticWorkflowSubject(page, 'eight-sleep-status', dialog)
})

test('eight-sleep-settings', async ({ page }) => {
  const dialog = await openSyntheticSleepSheet(page, 'legacy')
  await dialog.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Bedtime' })).toBeVisible()
  await expect(dialog.getByText('Away Mode')).toBeVisible()
  await scrollSleepTabPanelIntoView(dialog, 'end')
  await captureSyntheticWorkflowSubject(page, 'eight-sleep-settings', dialog)
})

test('sleepypod-temperature-scope', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom', {
    entityStates: {
      'climate.sleepypod_eight_pod_left_side': 'heat',
      'number.master_bedroom_sleepypod_eight_pod_left_target_level': '-2',
      'sensor.sleepypod_stephen_schedule_phase': 'bedtime',
    },
    entityAttributes: {
      'climate.sleepypod_eight_pod_left_side': {
        current_temperature: 82,
        hvac_action: 'heating',
        temperature: 80,
      },
    },
  })
  await page.getByRole('button', { name: /Stephen's Bed/i }).click()
  const bedDialog = page.getByRole('dialog', { name: "Stephen's Bed" })
  await bedDialog.getByRole('slider', { name: "Stephen's Bed target level" }).press('ArrowLeft')
  const dialog = page.getByRole('dialog', { name: 'Set Bed Temperature' })
  await expect(dialog.getByRole('button', { name: 'Tonight' })).toBeFocused()
  await replaceVisiblePrivateText(dialog, { "Stephen's Bed": 'Synthetic Bed', 'Stephen’s Bed': 'Synthetic Bed' })
  await captureSyntheticWorkflowSubject(page, 'sleepypod-temperature-scope', dialog)
})

test('sleepypod-alarm-day', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom')
  await setSyntheticWakeAlarms(page, 'right', 'sunday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
  await page.getByRole('button', { name: /Steph.s Bed/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Alarms', exact: true }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarms")
  await replaceVisiblePrivateText(dialog, { "Steph's Bed": 'Synthetic Bed', 'Steph’s Bed': 'Synthetic Bed' })
  await captureSyntheticWorkflowSubject(page, 'sleepypod-alarm-day', dialog)
})

test('sleepypod-alarm-editor', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'master-bedroom', 'Master Bedroom')
  await setSyntheticWakeAlarms(page, 'right', 'sunday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
  await page.getByRole('button', { name: /Steph.s Bed/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Alarms', exact: true }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }).click()
  await dialog.getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i }).click()
  await expect(dialog).toHaveAccessibleName("Steph's Bed Sunday Alarm")
  await replaceVisiblePrivateText(dialog, { "Steph's Bed": 'Synthetic Bed', 'Steph’s Bed': 'Synthetic Bed' })
  await captureSyntheticWorkflowSubject(page, 'sleepypod-alarm-editor', dialog)
})

async function openTheaterRemote(page: Page) {
  await openRouteWithSyntheticFixture(page, 'theater-room', 'Theater Room', {
    entityStates: MEDIA_REMOTE_STATES,
  })
  await page.getByRole('button', { name: /^Theater Remote On$/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Theater Room SHIELD Remote' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('media-remote-controls', async ({ page }) => {
  const dialog = await openTheaterRemote(page)
  await dialog.getByRole('heading', { name: 'Navigation' }).scrollIntoViewIfNeeded()
  await expect(dialog.getByRole('heading', { name: 'Controls' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'media-remote-controls', dialog)
})

test('media-remote-apps', async ({ page }) => {
  const dialog = await openTheaterRemote(page)
  await dialog.getByRole('button', { name: 'Apps' }).click()
  await expect(dialog.getByRole('button', { name: 'Plex' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Prime Video' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'media-remote-apps', dialog)
})

test('media-remote-devices', async ({ page }) => {
  const dialog = await openTheaterRemote(page)
  await dialog.getByRole('button', { name: 'Devices' }).click()
  await expect(dialog.getByRole('button', { name: /Projector On/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Theater Room PC Off/i })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'media-remote-devices', dialog)
})

test('media-remote-text', async ({ page }) => {
  const dialog = await openTheaterRemote(page)
  await dialog.getByRole('button', { name: 'Keyboard' }).click()
  const input = dialog.getByLabel('Text to send')
  await expect(input).toBeVisible()
  await input.fill('Synthetic media text')
  await expect(input).toHaveValue('Synthetic media text')
  await captureSyntheticWorkflowSubject(page, 'media-remote-text', dialog)
})

async function openMainFloorVacuum(page: Page, states: Record<string, string> = MAIN_FLOOR_VACUUM_STATES) {
  await openRouteWithSyntheticFixture(page, 'vacuums', 'Vacuums', {
    entityStates: states,
  })
  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Main Floor Robot Vacuum' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('vacuum-controls', async ({ page }) => {
  const dialog = await openMainFloorVacuum(page)
  await expect(dialog.getByRole('group', { name: 'Cleaning target' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Selected Rooms' })).toBeVisible()
  const subject = configuredCrop(page, 'vacuum-controls')
  await subject.scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'vacuum-controls', subject)
})

test('vacuum-zones', async ({ page }) => {
  const dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('button', { name: 'Zones' }).click()
  const kitchen = dialog.getByRole('button', { name: /^Kitchen/ })
  const livingRoom = dialog.getByRole('button', { name: /^Living Room/ })
  await kitchen.click()
  await livingRoom.click()
  await expect(kitchen).toHaveAccessibleName('Kitchen, cleaning order 1')
  await expect(livingRoom).toHaveAccessibleName('Living Room, cleaning order 2')
  await dialog.locator('[data-scroll-region="vacuum-panel"]').evaluate((element) => {
    element.scrollTop = 0
  })
  await expect(dialog.getByRole('heading', { name: 'Zones' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'vacuum-zones', dialog)
})

test('vacuum-auto-clean', async ({ page }) => {
  const dialog = await openMainFloorVacuum(page, {
    ...MAIN_FLOOR_VACUUM_STATES,
    'switch.main_floor_vacuum_coordinator_living_room_auto_clean_disabled': 'on',
    'switch.main_floor_vacuum_coordinator_kitchen_auto_clean_disabled': 'on',
  })
  await dialog.getByRole('button', { name: 'Auto-Clean' }).click()
  await expect(dialog.getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })).toBeVisible()
  await dialog.getByText('Office').scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'vacuum-auto-clean', dialog)
})

test('vacuum-actions', async ({ page }) => {
  const dialog = await openMainFloorVacuum(page)
  await dialog.getByRole('button', { name: 'Actions' }).click()
  await expect(dialog.getByRole('button', { name: 'Clean Mop Dock' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Dry Mops' })).toBeEnabled()
  await captureSyntheticWorkflowSubject(page, 'vacuum-actions', dialog)
})

test('vacuum-info-recovery', async ({ page }) => {
  const dialog = await openMainFloorVacuum(page, {
    ...MAIN_FLOOR_VACUUM_STATES,
    'sensor.valetudo_exaltedsneakydeer_status_flag': 'resumable',
    'input_text.main_floor_vacuum_error_message': 'Synthetic brush obstruction cleared',
  })
  await dialog.getByRole('button', { name: 'Info' }).click()
  await expect(dialog.getByText('Synthetic brush obstruction cleared')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Consumables' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'vacuum-info-recovery', dialog)
})

const PRESENCE_OVERRIDE_STATES = {
  'switch.living_room_presence_living_room_lights_presence_allowed': 'on',
  'switch.kitchen_presence_kitchen_lights_presence_allowed': 'on',
  'switch.hallway_presence_hallway_lights_presence_allowed': 'on',
  'switch.gym_presence_gym_light_presence_allowed': 'on',
  'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed': 'on',
  'switch.guest_room_presence_guest_room_presence_allowed': 'on',
  'switch.office_presence_office_light_presence_allowed': 'on',
  'switch.master_bedroom_presence_master_bedroom_presence_allowed': 'on',
  'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed': 'on',
  'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed': 'on',
  'switch.theater_room_presence_theater_room_presence_allowed': 'on',
  'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed': 'on',
  'switch.music_room_presence_music_room_lights_presence_allowed': 'on',
  'switch.upper_deck_presence_back_deck_lights_presence_allowed': 'on',
} as const

test('presence-overrides-overview', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'admin', 'Admin', {
    entityStates: PRESENCE_OVERRIDE_STATES,
    entityAttributes: {
      'switch.kitchen_presence_kitchen_lights_presence_allowed': { automation_paused: true },
      'switch.hallway_presence_hallway_lights_presence_allowed': { automation_state: 'quieted' },
    },
  })
  await page.getByRole('button', { name: 'Open Presence-Based Overrides' }).click()
  const dialog = page.getByRole('dialog', { name: 'Presence-Based Overrides' })
  await expect(dialog.getByRole('button', { name: 'Kitchen Paused' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Hallway Quieted' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'presence-overrides-overview', dialog)
})

test('presence-auto-reset', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'admin', 'Admin', {
    entityStates: {
      'switch.living_room_auto_re_enable_presence_lighting': 'on',
      'switch.kitchen_auto_re_enable_presence_lighting': 'off',
      'switch.hallway_auto_re_enable_presence_lighting': 'on',
    },
  })
  await page.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' }).click()
  const dialog = page.getByRole('dialog', { name: 'Presence-Based Overrides Auto-Reset' })
  await expect(dialog.getByRole('button', { name: /Living Room On/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Kitchen Off/i })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'presence-auto-reset', dialog)
})

async function openThermostatManualDialog(page: Page, tab: 'Automation' | 'Rooms' | 'Tracking' = 'Rooms') {
  await openRouteWithSyntheticFixture(page, 'ecobee', 'Thermostat', {})
  const openerName = tab === 'Automation'
    ? 'Advanced Configuration'
    : tab === 'Tracking'
      ? 'Room Tracking'
      : 'Room Thermostats'
  await page.getByRole('button', { exact: true, name: openerName }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('Thermostat · Advanced Controls')
  await expect(dialog.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
  return dialog
}

test('thermostat-controls-rooms', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page)
  await expect(dialog.getByRole('tab', { name: 'Rooms' })).toHaveAttribute('aria-selected', 'true')
  await captureSyntheticWorkflowSubject(page, 'thermostat-controls-rooms', dialog)
})

test('thermostat-controls-automation', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page, 'Automation')
  await expect(dialog.getByRole('heading', { name: 'Automatic Thermostat' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'thermostat-controls-automation', dialog)
})

test('thermostat-controls-tracking', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page, 'Tracking')
  await expect(dialog.getByRole('button', { name: /Selected Rooms \d+ of 11 selected/i })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'thermostat-controls-tracking', dialog)
})

test('thermostat-selected-rooms', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page, 'Tracking')
  await dialog.getByRole('button', { name: /Selected Rooms \d+ of 11 selected/i }).click()
  await expect(dialog).toHaveAccessibleName('Selected Rooms')
  await captureSyntheticWorkflowSubject(page, 'thermostat-selected-rooms', dialog)
})

test('thermostat-critical-protection', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page, 'Tracking')
  await dialog.getByRole('button', { name: /Critical Protection \d+ rooms forced/i }).click()
  await expect(dialog).toHaveAccessibleName('Critical Protection')
  await captureSyntheticWorkflowSubject(page, 'thermostat-critical-protection', dialog)
})

test('thermostat-occupied-only', async ({ page }) => {
  const dialog = await openThermostatManualDialog(page, 'Tracking')
  await dialog.getByRole('button', { name: /Occupied Only \d+ of 11 occupied only/i }).click()
  await expect(dialog).toHaveAccessibleName('Occupied Only')
  await captureSyntheticWorkflowSubject(page, 'thermostat-occupied-only', dialog)
})

test('thermostat-room', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'ecobee', 'Thermostat', {
    entityStates: {
      'sensor.thermostat_contact_sensors_living_room_temperature': '70.2',
      'sensor.thermostat_contact_sensors_living_room_occupancy': 'active',
      'climate.thermostat_contact_sensors_living_room_virtual_thermostat': 'heat_cool',
      'cover.living_room_vent_1_vent': 'open',
      'cover.living_room_vent_2_vent': 'closed',
    },
    entityAttributes: {
      'climate.thermostat_contact_sensors_living_room_virtual_thermostat': {
        current_temperature: 70.2,
        effective_cool_target: 74,
        effective_heat_target: 69,
        hvac_action: 'idle',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        target_temp_high: 74,
        target_temp_low: 69,
        temperature_unit: '°F',
      },
    },
  })
  await page.getByRole('button', { exact: true, name: 'Room Thermostats' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Living Room 70.2°F/i }).click()
  await expect(dialog).toHaveAccessibleName('Living Room')
  await expect(dialog.getByRole('heading', { name: 'Living Room Vents' })).toBeVisible()
  await dialog.getByRole('heading', { name: 'Living Room Vents' }).scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'thermostat-room', dialog)
})

test('predictive-comfort', async ({ page }) => {
  test.setTimeout(180000)
  await openRouteWithSyntheticFixture(page, 'ecobee', 'Thermostat', {
    entityStates: {
      'switch.thermostat_contact_sensors_predictive_comfort_mode': 'on',
      'switch.thermostat_contact_sensors_predictive_auto_adjust': 'on',
      'switch.thermostat_contact_sensors_predictive_hvac_mode_changes': 'off',
      'switch.thermostat_contact_sensors_predictive_allow_away': 'off',
      'sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode': 'pre_cool',
    },
    entityAttributes: {
      'switch.thermostat_contact_sensors_predictive_comfort_mode': {
        current_recommendation: 'pre_cool',
      },
      'sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode': {
        active_activity_entities: ['Synthetic Cooking Load'],
        adjustment_status: 'auto_adjust_disabled',
        comfort_high: 74,
        comfort_low: 71,
        forecast_high: 83,
        forecast_low: 68,
        indoor_temperature: 72.4,
        predicted_temperature: 75.2,
        reason: 'Synthetic forecast suggests pre-cooling before afternoon warmth.',
        weather_entity: 'Synthetic Forecast',
      },
    },
  })
  await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
  const dialog = page.getByRole('dialog')
  const openControls = dialog.getByRole('button', { name: /Open Predictive Comfort controls/i })
  await expect(openControls).toBeVisible({ timeout: 120000 })
  await openControls.scrollIntoViewIfNeeded()
  await openControls.click()
  await expect(dialog).toHaveAccessibleName('Predictive Comfort')
  await expect(dialog.getByText('Synthetic Forecast').first()).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'predictive-comfort', dialog)
})

test('custom-light-detail', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'custom-lights', 'Custom Lights', {
    entityStates: {
      'input_boolean.manually_control_front_yard_lights': 'on',
      'input_select.front_yard_custom_lights': 'Custom',
      'light.front_door_exterior_left_light': 'on',
      'light.front_door_exterior_light_v2': 'on',
      'light.front_door_bollard_1': 'on',
    },
    entityAttributes: {
      'light.front_door_exterior_left_light': {
        brightness: 178,
        color_mode: 'hs',
        hs_color: [210, 64],
        rgb_color: [36, 112, 214],
        supported_color_modes: ['hs'],
      },
      'light.front_door_exterior_light_v2': {
        brightness: 204,
        color_mode: 'hs',
        hs_color: [18, 58],
        rgb_color: [224, 112, 54],
        supported_color_modes: ['hs'],
      },
      'light.front_door_bollard_1': {
        brightness: 128,
        color_mode: 'hs',
        hs_color: [120, 45],
        rgb_color: [78, 180, 88],
        supported_color_modes: ['hs'],
      },
    },
  })
  await page.getByRole('button', { name: 'Open Left Door Light details' }).click()
  const dialog = page.getByRole('dialog', { name: 'Left Door Light' })
  await expect(dialog.getByLabel('Left Door Light R channel')).toHaveValue('36')
  await captureSyntheticWorkflowSubject(page, 'custom-light-detail', dialog)
})

test('vacation-active-cancel', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'vacation', 'Vacation', {
    entityStates: {
      'input_boolean.vacation_mode': 'on',
      'input_boolean.vacation_mode_invalid_dates_pending': 'off',
      'input_datetime.vacation_start': '2030-09-12 09:30:00',
      'input_datetime.vacation_end': '2030-09-18 18:45:00',
    },
  })
  const subject = configuredCrop(page, 'vacation-active-cancel')
  await expect(subject.getByRole('button', { name: /Vacation Mode On/i })).toBeVisible()
  await expect(subject.getByLabel('Start Date')).toHaveValue('2030-09-12')
  await expect(subject.getByLabel('End Date')).toHaveValue('2030-09-18')
  await captureSyntheticWorkflowSubject(page, 'vacation-active-cancel', subject)
})

async function openSyntheticInventoryRoute(page: Page) {
  await openRouteWithSyntheticFixture(page, 'all-food', 'All Food', {
    inventoryByLocation: {
      all: [...SYNTHETIC_INVENTORY],
    },
  })
  const list = page.getByLabel('All Food inventory list')
  await expect(list.getByText('Synthetic Batch Item')).toBeVisible({ timeout: 15000 })
  return list
}

test('inventory-grouped-detail', async ({ page }) => {
  const list = await openSyntheticInventoryRoute(page)
  await list.getByRole('button', { name: 'Edit Synthetic Batch Item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Synthetic Batch Item' })
  await expect(dialog.getByText('In the fridge · Prepared')).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'inventory-grouped-detail', dialog)
})

test('inventory-single-detail', async ({ page }) => {
  const list = await openSyntheticInventoryRoute(page)
  await list.getByRole('button', { name: 'Edit Synthetic Single Item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Synthetic Single Item' })
  await expect(dialog.getByRole('spinbutton', { name: 'Quantity for Synthetic Single Item' })).toHaveText('3')
  await captureSyntheticWorkflowSubject(page, 'inventory-single-detail', dialog)
})

test('inventory-sort', async ({ page }) => {
  await openSyntheticInventoryRoute(page)
  await page.getByRole('button', { name: 'Sort' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sort Inventory' })
  await expect(dialog.getByRole('radio', { name: /Title/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'inventory-sort', dialog)
})

test('inventory-filter', async ({ page }) => {
  await openSyntheticInventoryRoute(page)
  await page.getByRole('button', { name: 'Filter' }).click()
  const dialog = page.getByRole('dialog', { name: 'Filter Inventory' })
  await expect(dialog.getByRole('radio', { name: /Expired/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible()
  await dialog.getByRole('radio', { name: /All Items/i }).scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'inventory-filter', dialog)
})

async function openSyntheticDailyReport(page: Page, includeInventory = false, includeUpcoming = false) {
  await openRouteWithSyntheticFixture(page, 'overview', 'Home', {
    donetickTasks: {
      9401: SYNTHETIC_DONETICK_TASK,
      ...(includeUpcoming ? { 9402: SYNTHETIC_UPCOMING_DONETICK_TASK } : {}),
    },
    entityAttributes: {
      'sensor.evershelf_expired_items': {
        expired_list: includeInventory ? SYNTHETIC_REPORT_INVENTORY : [],
      },
    },
    inventoryByLocation: {
      all: includeInventory ? SYNTHETIC_REPORT_INVENTORY : [],
    },
    todoItemsByEntity: {
      'todo.stephen_s_past_due_with_unassigned': [SYNTHETIC_REPORT_TASK],
      'todo.stephen_s_due_today_with_unassigned': includeUpcoming ? [SYNTHETIC_UPCOMING_REPORT_TASK] : [],
    },
  })
  await page.getByRole('button', { name: /^Open Stephen's Summary/ }).click()
  const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
  await expect(dialog).toBeVisible()
  if (includeInventory) await setSyntheticInventoryItems(page, 'all', SYNTHETIC_REPORT_INVENTORY)
  return dialog
}

test('daily-report-overview', async ({ page }) => {
  const namedDialog = await openSyntheticDailyReport(page)
  await expect(namedDialog.getByText('Synthetic report chore')).toBeVisible()
  const dialog = page.locator('[role="dialog"]').last()
  await replaceVisiblePrivateText(dialog, { "Stephen's Summary": 'Synthetic Resident Summary' })
  await captureSyntheticWorkflowSubject(page, 'daily-report-overview', dialog)
})

test('daily-report-upcoming', async ({ page }) => {
  const namedDialog = await openSyntheticDailyReport(page, false, true)
  await namedDialog.getByRole('button', { name: 'Upcoming Chores' }).click()
  await expect(namedDialog.getByText('Synthetic upcoming chore')).toBeVisible()
  const dialog = page.locator('[role="dialog"]').last()
  await replaceVisiblePrivateText(dialog, { "Stephen's Summary": 'Synthetic Resident Summary' })
  await captureSyntheticWorkflowSubject(page, 'daily-report-upcoming', dialog)
})

test('daily-report-expired-food', async ({ page }) => {
  const namedDialog = await openSyntheticDailyReport(page, true)
  await namedDialog.getByRole('button', { name: /^Expired Food/ }).click()
  await expect(namedDialog.getByText('Synthetic Report Produce')).toBeVisible()
  const dialog = page.locator('[role="dialog"]').last()
  await replaceVisiblePrivateText(dialog, { "Stephen's Summary": 'Synthetic Resident Summary' })
  await captureSyntheticWorkflowSubject(page, 'daily-report-expired-food', dialog)
})

test('daily-report-task-detail', async ({ page }) => {
  const dialog = await openSyntheticDailyReport(page)
  await dialog.getByRole('button', { name: 'Edit Synthetic report chore' }).click()
  const detail = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(detail.getByLabel('Task Name')).toHaveValue('Synthetic report chore')
  await captureSyntheticWorkflowSubject(page, 'daily-report-task-detail', detail)
})

test('daily-report-inventory-detail', async ({ page }) => {
  const dialog = await openSyntheticDailyReport(page, true)
  await dialog.getByRole('button', { name: /^Expired Food/ }).click()
  const row = dialog.getByRole('group', { name: /Synthetic Report Produce Quantity/ })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Edit Synthetic Report Produce' }).click()
  const detail = page.getByRole('dialog', { name: 'Synthetic Report Produce' })
  await expect(detail.getByRole('spinbutton', { name: 'Quantity for Synthetic Report Produce' })).toHaveText('2')
  await captureSyntheticWorkflowSubject(page, 'daily-report-inventory-detail', detail)
})

async function openSyntheticRecipeDetail(page: Page) {
  await openRouteWithSyntheticFixture(page, 'food', 'Food & Recipes')
  await page.getByRole('button', { name: /Open Suggested Citrus Pantry Bowl .* recipe details/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables' })
  await expect(dialog.getByRole('tabpanel', { name: 'General' })).toBeVisible()
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  return dialog
}

async function openSyntheticLocalRecipeDetail(page: Page) {
  await openRouteWithSyntheticFixture(page, 'recipes', 'Recipes')
  const recipe = page.getByRole('button', { name: 'Open Catalog Recipe 1 recipe details' })
  await expect(recipe).toBeVisible({ timeout: 15_000 })
  await recipe.click()
  const dialog = page.getByRole('dialog', { name: 'Catalog Recipe 1' })
  await expect(dialog.getByRole('tabpanel', { name: 'General' })).toBeVisible()
  await expect(dialog.getByText('Makes 2 bowls')).toBeVisible()
  return dialog
}

test('recipe-detail-general', async ({ page }) => {
  const dialog = await openSyntheticRecipeDetail(page)
  await dialog.getByText('Serves 4', { exact: true }).scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'recipe-detail-general', dialog)
})

test('recipe-detail-ingredients', async ({ page }) => {
  const dialog = await openSyntheticRecipeDetail(page)
  await dialog.getByRole('tab', { name: 'Ingredients' }).click()
  const addMissing = dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
  await addMissing.scrollIntoViewIfNeeded()
  await addMissing.click()
  const submitted = dialog.getByText('EverShelf: 2 added. Home Assistant mirror: 2 added.')
  await expect(submitted).toBeVisible()
  await submitted.scrollIntoViewIfNeeded()
  await captureSyntheticWorkflowSubject(page, 'recipe-detail-ingredients', dialog)
})

test('recipe-detail-instructions', async ({ page }) => {
  const dialog = await openSyntheticLocalRecipeDetail(page)
  await dialog.getByRole('tab', { name: 'Instructions' }).click()
  const panel = dialog.getByRole('tabpanel', { name: 'Instructions' })
  await expect(panel.getByRole('heading', { name: 'Prepare' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Serve' })).toBeVisible()
  await expect(panel.getByRole('listitem')).toHaveCount(3)
  await captureSyntheticWorkflowSubject(page, 'recipe-detail-instructions', dialog)
})

test('recipe-sort', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'recipes', 'Recipes')
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Sort' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sort Recipes' })
  await expect(dialog.getByRole('radio', { name: /Expiring Soon/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'recipe-sort', dialog)
})

test('recipe-filter', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'recipes', 'Recipes')
  await expect(page.locator('[data-recipe-grid="true"] [data-recipe-card]').first()).toBeVisible({ timeout: 15000 })
  const filterButton = page.getByRole('button', { name: 'Filter', exact: true })
  await expect(filterButton).toBeVisible()
  await filterButton.click()
  const dialog = page.getByRole('dialog', { name: 'Filter Recipes' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('slider', { name: 'Minimum Ingredients Available' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'recipe-filter', dialog)
})

test('custom-light-mode-picker', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'custom-lights', 'Custom Lights', {
    entityStates: {
      'input_boolean.manually_control_front_yard_lights': 'on',
      'input_select.front_yard_custom_lights': 'Custom',
      'light.front_door_exterior_left_light': 'on',
      'light.front_door_exterior_light_v2': 'on',
    },
    entityAttributes: {
      'input_select.front_yard_custom_lights': {
        options: ['Default', 'Custom', 'Seahawks', "Valentine's Day"],
      },
      'light.front_door_exterior_left_light': { rgb_color: [36, 112, 214] },
      'light.front_door_exterior_light_v2': { rgb_color: [224, 112, 54] },
    },
  })
  await page.getByRole('button', { name: 'Select lighting mode' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lighting Mode' })
  await expect(dialog.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'custom-light-mode-picker', dialog)
})

const THERMOSTAT_PICKER_FIXTURE: ManualSyntheticFixture = {
  entityStates: {
    'climate.thermostat_hub_w200': 'heat',
    'select.thermostat_contact_sensors_eco_mode_critical_tracking': 'Track Select Critical',
    'select.thermostat_contact_sensors_eco_behavior_when_away': 'Keep Eco Active',
  },
  entityAttributes: {
    'climate.thermostat_hub_w200': {
      current_temperature: 70,
      fan_mode: 'auto',
      fan_modes: ['auto', 'on', 'circulate'],
      hvac_action: 'heating',
      hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      temperature: 71,
      temperature_unit: '°F',
    },
    'select.thermostat_contact_sensors_eco_mode_critical_tracking': {
      options: ['Do Not Track Critical', 'Track Select Critical', 'Track All Critical'],
    },
    'select.thermostat_contact_sensors_eco_behavior_when_away': {
      options: ['Disable Eco When Away', 'Use Eco Away Targets', 'Keep Eco Active'],
    },
  },
}

async function openThermostatOptionPicker(page: Page, buttonName: RegExp, title: string) {
  await openRouteWithSyntheticFixture(page, 'ecobee', 'Thermostat', THERMOSTAT_PICKER_FIXTURE)
  let scope: Page | Locator = page
  if (title.startsWith('Eco ')) {
    await page.getByRole('button', { exact: true, name: 'Advanced Configuration' }).click()
    scope = page.getByRole('dialog')
  }
  const opener = scope.getByRole('button', { name: buttonName })
  await opener.scrollIntoViewIfNeeded()
  await opener.click()
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
  return page.getByRole('dialog')
}

test('thermostat-hub-mode-picker', async ({ page }) => {
  const dialog = await openThermostatOptionPicker(page, /^Thermostat Hub Mode /, 'Thermostat Hub Mode')
  await expect(dialog.getByRole('button', { name: 'Heat', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'thermostat-hub-mode-picker', dialog)
})

test('thermostat-hub-fan-picker', async ({ page }) => {
  const dialog = await openThermostatOptionPicker(page, /^Thermostat Hub Fan /, 'Thermostat Hub Fan')
  await expect(dialog.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'thermostat-hub-fan-picker', dialog)
})

test('eco-critical-tracking-picker', async ({ page }) => {
  const dialog = await openThermostatOptionPicker(page, /^Eco Mode Critical Tracking /, 'Eco Mode Critical Tracking')
  await expect(dialog.getByRole('button', { name: 'Track Select Critical' })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'eco-critical-tracking-picker', dialog)
})

test('eco-away-behavior-picker', async ({ page }) => {
  const dialog = await openThermostatOptionPicker(page, /^Eco Behavior When Away /, 'Eco Behavior When Away')
  await expect(dialog.getByRole('button', { name: 'Keep Eco Active' })).toHaveAttribute('aria-pressed', 'true')
  await captureSyntheticWorkflowSubject(page, 'eco-away-behavior-picker', dialog)
})

test('create-task-floating-action', async ({ page }) => {
  const targetListIndex = TODO_PAGES.chores.lists.findIndex(
    (list) => list.entityId === 'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned',
  )
  expect(targetListIndex).toBeGreaterThanOrEqual(0)
  await openRouteWithSyntheticFixture(page, 'chores', 'Chores', {
    todoItemsByEntity: Object.fromEntries(TODO_PAGES.chores.lists.map((list, index) => [list.entityId, [{
      status: 'needs_action',
      summary: index === targetListIndex ? 'Synthetic recurring task' : `Synthetic household task ${index + 1}`,
      uid: `manual-create-task-${index + 1}--None`,
    }]])),
  })
  const task = page.getByText('Synthetic recurring task', { exact: true })
  await expect(task).toBeVisible()
  await task.evaluate((element) => element.scrollIntoView({ block: 'end' }))
  const subject = configuredCrop(page, 'create-task-floating-action')
  await expect(subject.getByRole('button', { name: 'Add Task' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'create-task-floating-action', subject)
})

test('grocery-add', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'groceries', 'Groceries', {
    todoItemsByEntity: {
      'todo.shopping_list': [{
        status: 'needs_action',
        summary: 'Synthetic grocery item',
        uid: 'manual-grocery-add--None',
      }],
    },
  })
  await page.getByRole('button', { name: 'Add Groceries' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Grocery Item' })
  const input = dialog.getByLabel('Item')
  await input.fill('Synthetic grocery addition')
  await expect(input).toHaveValue('Synthetic grocery addition')
  await expect(dialog.getByRole('button', { name: 'Add Item' })).toBeVisible()
  await captureSyntheticWorkflowSubject(page, 'grocery-add', dialog)
})

test('admin-todo-add', async ({ page }) => {
  await openRouteWithSyntheticFixture(page, 'to-do', 'To-Do', {
    todoItemsByEntity: {
      'todo.groceries': [],
    },
  })
  await page.getByRole('button', { name: 'Add Task' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Task' })
  const input = dialog.getByLabel('Task')
  await input.fill('Synthetic admin task')
  await expect(input).toHaveValue('Synthetic admin task')
  await captureSyntheticWorkflowSubject(page, 'admin-todo-add', dialog)
})
