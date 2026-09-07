import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import ts from 'typescript'
import { RESPONSIVE_VIEWPORTS, type ResponsiveViewport } from './responsive-acceptance-data'

type ModalAudit = {
  backdropActive: boolean
  backdropAreaRatio: number
  backdropCoverageComplete: boolean
  backdropPolicy: string
  backdropProxyHeightDelta: number
  bodyOverflowY: string
  bodyVisibleContent: boolean
  centered: boolean
  clippedRegions: string[]
  dialogHeight: number
  dialogWidth: number
  id: string
  scrollMode: string
  size: string
  stage: string
  terminalViolations: string[]
  unshieldedSvgTargets: Array<{
    ariaHidden: string | null
    ariaLabel: string | null
    className: string | null
    index: number
  }>
  viewport: ResponsiveViewport
}

type ModalCase = {
  consumerCallsite?: string
  expectedScrollMode: 'body' | 'panes'
  expectedSize: 'compact' | 'form' | 'media' | 'standard' | 'workspace'
  id: string
  open: (page: Page) => Promise<Locator>
  physicalCallsite: string
  selectTabs?: Array<string | RegExp>
}

const PHONE = RESPONSIVE_VIEWPORTS[0]
const PHONE_LANDSCAPE = RESPONSIVE_VIEWPORTS[1]
const IPAD_PORTRAIT = RESPONSIVE_VIEWPORTS[2]
const IPAD_LANDSCAPE = RESPONSIVE_VIEWPORTS[3]
const DESKTOP = RESPONSIVE_VIEWPORTS[4]
const WIDE_DESKTOP = RESPONSIVE_VIEWPORTS[5]
const manifest: ModalAudit[] = []

function productionTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return fullPath === path.resolve('src/test') ? [] : productionTsxFiles(fullPath)
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [fullPath] : []
  })
}

function enclosingComponentName(node: ts.Node) {
  let owner: ts.Node | undefined = node.parent
  while (owner) {
    if (ts.isFunctionDeclaration(owner) && owner.name) return owner.name.text
    if (
      ts.isVariableDeclaration(owner)
      && ts.isIdentifier(owner.name)
      && owner.initializer
      && (ts.isArrowFunction(owner.initializer) || ts.isFunctionExpression(owner.initializer))
    ) return owner.name.text
    owner = owner.parent
  }
  return '<module>'
}

function modalInventoryCounts() {
  let directModalSheetJsxCallsites = 0
  let optionPickerSheetConsumers = 0
  const optionPickerConsumerCallsites: string[] = []
  const physicalCallsiteCounts: Record<string, number> = {}
  for (const filePath of productionTsxFiles(path.resolve('src'))) {
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const visit = (node: ts.Node) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null
      if (opening) {
        const tagName = opening.tagName.getText(sourceFile)
        if (tagName === 'ModalSheet') {
          directModalSheetJsxCallsites += 1
          const ownerName = enclosingComponentName(opening)
          const callsite = `${path.relative(process.cwd(), filePath)}:${ownerName}`
          physicalCallsiteCounts[callsite] = (physicalCallsiteCounts[callsite] ?? 0) + 1
        }
        if (tagName === 'OptionPickerDialog') {
          const presentation = opening.attributes.properties.find((property) =>
            ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'presentation',
          )
          if (
            presentation
            && ts.isJsxAttribute(presentation)
            && presentation.initializer
            && ts.isStringLiteral(presentation.initializer)
            && presentation.initializer.text === 'sheet'
          ) {
            optionPickerSheetConsumers += 1
            optionPickerConsumerCallsites.push(`${path.relative(process.cwd(), filePath)}:${enclosingComponentName(opening)}`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return {
    directModalSheetJsxCallsites,
    expandedReviewRows: directModalSheetJsxCallsites + optionPickerSheetConsumers,
    optionPickerConsumerCallsites: optionPickerConsumerCallsites.sort(),
    optionPickerSheetConsumers,
    physicalCallsiteCounts,
  }
}

const EXPECTED_PHYSICAL_MODAL_CALLSITES = {
  'src/components/core/OptionPickerDialog.tsx:OptionPickerDialog': 1,
  'src/components/hass/BathroomFanModalContent.tsx:BathroomFanModal': 1,
  'src/components/hass/BedTemperatureScopePrompt.tsx:BedTemperatureScopePrompt': 1,
  'src/components/hass/CreateDonetickTaskSheet.tsx:CreateDonetickTaskSheet': 1,
  'src/components/hass/CreateGroceryItemSheet.tsx:CreateGroceryItemSheet': 1,
  'src/components/hass/CreateTodoItemSheet.tsx:CreateTodoItemSheet': 1,
  'src/components/hass/DailyReportModal.tsx:DailyReportModal': 1,
  'src/components/hass/EverShelfInventoryPanel.tsx:InventoryFilterSheet': 1,
  'src/components/hass/EverShelfInventoryPanel.tsx:InventoryItemDetailsModal': 1,
  'src/components/hass/EverShelfInventoryPanel.tsx:InventorySortSheet': 1,
  'src/components/hass/HumidifierModalContent.tsx:HumidifierModal': 1,
  'src/components/hass/LightMoreInfoSheet.tsx:LightMoreInfoSheet': 1,
  'src/components/hass/ScanItemCameraSheet.tsx:ScanItemCameraSheet': 1,
  'src/components/hass/SecurityDashboard.tsx:SecurityDashboard': 1,
  'src/components/hass/SprinklerController.tsx:SprinklerController': 1,
  'src/components/hass/VacuumCard.tsx:VacuumModal': 1,
  'src/components/hass/WeatherSummary.tsx:WeatherSummary': 1,
  'src/components/hass/recipes/RecipeDetailModal.tsx:RecipeDetailModal': 1,
  'src/components/hass/recipes/RecipeFloatingActions.tsx:RecipeFilterSheet': 1,
  'src/components/hass/recipes/RecipeFloatingActions.tsx:RecipeSortSheet': 1,
  'src/components/shell/GlobalQuickLinksAction.tsx:GlobalQuickLinksAction': 1,
  'src/pages/AtAGlancePage.tsx:AtAGlancePage': 1,
  'src/pages/DashboardViewPage.tsx:AdminPage': 2,
  'src/pages/DashboardViewPage.tsx:EightSleepBedModal': 1,
  'src/pages/DashboardViewPage.tsx:MediaRoomSourceModal': 1,
  'src/pages/DashboardViewPage.tsx:RoomSourceModal': 1,
  'src/pages/DashboardViewPage.tsx:ThermostatModal': 1,
  'src/pages/DashboardViewPage.tsx:VacationConfirmationModal': 1,
}

const EXPECTED_OPTION_PICKER_CONSUMERS = [
  'src/pages/CustomLightsPage.tsx:CustomLightsPage',
  'src/pages/DashboardViewPage.tsx:ThermostatSelectButton',
]

function artifactPath(filename: string) {
  const directory = process.env.RESPONSIVE_ARTIFACT_DIR
  if (!directory) return null
  fs.mkdirSync(directory, { recursive: true })
  return path.join(directory, filename)
}

async function waitForRoute(page: Page) {
  await expect(page.locator('[data-page-scroller="true"]:visible').last()).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass)), { timeout: 15_000 }).toBe(true)
}

async function clearMockCalls(page: Page) {
  await page.evaluate(() => {
    window.__mockHass?.calls.splice(0)
  })
}

async function gotoRoute(page: Page, route: string) {
  await page.goto(`/index.html?path=${route}`)
  await waitForRoute(page)
}

async function waitForDialogSettled(dialog: Locator) {
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect.poll(() => dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    const transform = style.transform
    const translateY = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
    return Math.abs(translateY) <= 1 && Number.parseFloat(style.opacity) >= 0.99
  }), { timeout: 2_000 }).toBe(true)
}

async function openButtonModal(page: Page, route: string, opener: string | RegExp, dialogName?: string | RegExp) {
  await gotoRoute(page, route)
  await clearMockCalls(page)
  await page.getByRole('button', { name: opener }).first().click()
  const dialog = dialogName ? page.getByRole('dialog', { name: dialogName }) : page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await waitForDialogSettled(dialog)
  return dialog
}

async function openHashModal(page: Page, route: string, hash: string, dialogName?: string | RegExp) {
  await gotoRoute(page, route)
  await clearMockCalls(page)
  await page.evaluate((nextHash) => {
    const oldURL = window.location.href
    const url = new URL(oldURL)
    url.hash = nextHash
    window.history.pushState({}, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange', { newURL: url.href, oldURL }))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, hash)
  const dialog = dialogName ? page.getByRole('dialog', { name: dialogName }) : page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await waitForDialogSettled(dialog)
  return dialog
}

async function setMockStates(page: Page, states: Record<string, string>) {
  await page.evaluate((nextStates) => {
    for (const [entityId, state] of Object.entries(nextStates)) window.__mockHass?.setEntityState(entityId, state)
  }, states)
}

async function openVacationConfirmation(page: Page) {
  await gotoRoute(page, 'vacation')
  await setMockStates(page, {
    'input_boolean.vacation_mode': 'off',
    'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers': 'on',
    'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain': 'on',
    'input_boolean.vacation_checklist_make_the_bed': 'on',
    'input_boolean.vacation_checklist_unload_and_check_dishwasher': 'on',
    'input_boolean.vacation_checklist_trash_and_recycles_taken_out': 'on',
  })
  const opener = page.getByRole('button', { name: 'Vacation Mode Off' })
  await expect(opener).toBeVisible()
  await clearMockCalls(page)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Confirm Vacation' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function openInventoryModal(page: Page, kind: 'details' | 'filter' | 'sort') {
  await gotoRoute(page, 'fridge')
  const route = page.locator('[data-route-path="fridge"]:visible').last()
  await expect(route.getByLabel('Fridge inventory list')).toBeVisible({ timeout: 15_000 })
  await clearMockCalls(page)
  if (kind === 'details') {
    await route.getByRole('button', { name: 'Edit Greek Yogurt' }).click()
    return page.getByRole('dialog', { name: /Greek Yogurt/i })
  }
  const actionDock = page.locator('[data-floating-action-dock="true"]:visible').last()
  await actionDock.getByRole('button', { name: kind === 'sort' ? 'Sort' : 'Filter' }).click()
  return page.getByRole('dialog', { name: kind === 'sort' ? 'Sort Inventory' : 'Filter Inventory' })
}

async function openRecipeModal(page: Page, kind: 'detail' | 'filter' | 'sort') {
  await gotoRoute(page, kind === 'detail' ? 'food' : 'recipes')
  await clearMockCalls(page)
  if (kind === 'detail') {
    await page.getByRole('button', {
      name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details',
    }).click()
    return page.getByRole('dialog', { name: 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables' })
  }
  await page.getByRole('button', { name: kind === 'sort' ? 'Sort' : 'Filter' }).click()
  return page.getByRole('dialog', { name: kind === 'sort' ? 'Sort Recipes' : 'Filter Recipes' })
}

async function openHarness(page: Page, harness: string, values: string[]) {
  const search = new URLSearchParams({ __modalAcceptance: harness })
  for (const value of values) search.append('__modalValue', value)
  await page.goto(`/?${search.toString()}`)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await waitForDialogSettled(dialog)
  await clearMockCalls(page)
  return dialog
}

const MODAL_CASES: ModalCase[] = [
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'at-a-glance-sheet',
    open: (page) => openHashModal(page, 'overview', '#lights-overview', /Lights/),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'media-room-source',
    open: (page) => openButtonModal(page, 'living-room', /^Living Room Remote Off$/i),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:MediaRoomSourceModal',
    selectTabs: ['Controls', 'Apps'],
  },
  {
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'music-room-media-remote',
    open: (page) => openButtonModal(page, 'music-room', /^Music Room Remote Off$/i),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:MediaRoomSourceModal',
    selectTabs: ['Controls', 'Apps', 'Devices'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'room-source-generic',
    open: (page) => openButtonModal(page, 'living-room', /^Climate /i, 'Living Room Climate'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'vacation-confirmation',
    open: openVacationConfirmation,
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:VacationConfirmationModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'admin-presence-overrides',
    open: (page) => openHashModal(page, 'admin', '#presence-based-overrides', 'Presence-Based Overrides'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:AdminPage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'admin-presence-auto-reset',
    open: (page) => openHashModal(page, 'admin', '#presence-based-overrides-auto', 'Presence-Based Overrides Auto-Reset'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:AdminPage',
  },
  {
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'eight-sleep',
    open: (page) => openButtonModal(page, 'master-bedroom', /Steph.s Bed Off/i, /Steph.s Bed/),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:EightSleepBedModal',
    selectTabs: [/^(?:Temperature|Sleep Schedule)$/, 'Special Modes', 'Alarms', 'Status'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'workspace',
    id: 'thermostat',
    open: (page) => openHashModal(page, 'ecobee', '#thermostat-controls', 'Thermostat · Advanced Controls'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:ThermostatModal',
    selectTabs: ['Rooms', 'Automation', 'Tracking'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'option-picker-wrapper',
    open: (page) => openHarness(page, 'option-picker', ['Option Picker', 'Automatic', 'Manual']),
    physicalCallsite: 'src/components/core/OptionPickerDialog.tsx:OptionPickerDialog',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'bathroom-fan',
    open: (page) => openButtonModal(page, 'guest-bathroom', 'Fan Off', 'Guest Bathroom Fan'),
    physicalCallsite: 'src/components/hass/BathroomFanModalContent.tsx:BathroomFanModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'bed-temperature-scope',
    open: (page) => openHarness(page, 'bed-temperature-scope', ["Stephen's Bed", '-3', 'bedtime']),
    physicalCallsite: 'src/components/hass/BedTemperatureScopePrompt.tsx:BedTemperatureScopePrompt',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'create-donetick-task',
    open: (page) => openButtonModal(page, 'chores', 'Add Task', 'Create Task'),
    physicalCallsite: 'src/components/hass/CreateDonetickTaskSheet.tsx:CreateDonetickTaskSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'create-grocery-item',
    open: (page) => openButtonModal(page, 'grocery-list', 'Add Groceries', 'Add Grocery Item'),
    physicalCallsite: 'src/components/hass/CreateGroceryItemSheet.tsx:CreateGroceryItemSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'create-todo-item',
    open: (page) => openButtonModal(page, 'to-do', 'Add Task', 'Add Task'),
    physicalCallsite: 'src/components/hass/CreateTodoItemSheet.tsx:CreateTodoItemSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'daily-report',
    open: (page) => openHashModal(page, 'overview&user=stephen', '#daily-report', "Stephen's Summary"),
    physicalCallsite: 'src/components/hass/DailyReportModal.tsx:DailyReportModal',
    selectTabs: [/^Overdue Chores/, 'Upcoming Chores', /^Expired Food/],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'inventory-details',
    open: (page) => openInventoryModal(page, 'details'),
    physicalCallsite: 'src/components/hass/EverShelfInventoryPanel.tsx:InventoryItemDetailsModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'inventory-sort',
    open: (page) => openInventoryModal(page, 'sort'),
    physicalCallsite: 'src/components/hass/EverShelfInventoryPanel.tsx:InventorySortSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'inventory-filter',
    open: (page) => openInventoryModal(page, 'filter'),
    physicalCallsite: 'src/components/hass/EverShelfInventoryPanel.tsx:InventoryFilterSheet',
  },
  {
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'humidifier',
    open: (page) => openButtonModal(page, 'master-bedroom', /Humidifier .*46%/i),
    physicalCallsite: 'src/components/hass/HumidifierModalContent.tsx:HumidifierModal',
    selectTabs: ['Controls', 'Schedules', 'Info'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'light-more-info',
    open: (page) => openHarness(page, 'light-more-info', ['Left Door Light', 'light.front_door_exterior_left_light']),
    physicalCallsite: 'src/components/hass/LightMoreInfoSheet.tsx:LightMoreInfoSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'recipe-detail',
    open: (page) => openRecipeModal(page, 'detail'),
    physicalCallsite: 'src/components/hass/recipes/RecipeDetailModal.tsx:RecipeDetailModal',
    selectTabs: ['General', 'Ingredients', 'Instructions'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'recipe-sort',
    open: (page) => openRecipeModal(page, 'sort'),
    physicalCallsite: 'src/components/hass/recipes/RecipeFloatingActions.tsx:RecipeSortSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'recipe-filter',
    open: (page) => openRecipeModal(page, 'filter'),
    physicalCallsite: 'src/components/hass/recipes/RecipeFloatingActions.tsx:RecipeFilterSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'form',
    id: 'scan-item',
    open: (page) => openButtonModal(page, 'kitchen', 'Scan Item', /Add Item/i),
    physicalCallsite: 'src/components/hass/ScanItemCameraSheet.tsx:ScanItemCameraSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'security-dashboard',
    open: (page) => openHashModal(page, 'security', '#security-system', 'Security System'),
    physicalCallsite: 'src/components/hass/SecurityDashboard.tsx:SecurityDashboard',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'sprinkler-controller',
    open: (page) => openButtonModal(page, 'sprinklers', /Front Yard Auto/i),
    physicalCallsite: 'src/components/hass/SprinklerController.tsx:SprinklerController',
  },
  {
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'vacuum',
    open: (page) => openButtonModal(page, 'vacuums', /Main Floor Docked/i),
    physicalCallsite: 'src/components/hass/VacuumCard.tsx:VacuumModal',
    selectTabs: ['Controls', 'Zones', 'Auto-Clean', 'Actions', 'Info'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'weather',
    open: (page) => openButtonModal(page, 'overview', /Open seven-day weather forecast/i, 'Weather'),
    physicalCallsite: 'src/components/hass/WeatherSummary.tsx:WeatherSummary',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'global-quick-links',
    open: (page) => openButtonModal(page, 'living-room', 'Quick Links', 'Quick Links'),
    physicalCallsite: 'src/components/shell/GlobalQuickLinksAction.tsx:GlobalQuickLinksAction',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'custom-lights-option-picker',
    open: async (page) => {
      await gotoRoute(page, 'custom-lights')
      await setMockStates(page, {
        'input_boolean.manually_control_front_yard_lights': 'on',
        'input_select.front_yard_custom_lights': 'Custom',
      })
      await clearMockCalls(page)
      await page.getByRole('button', { name: 'Select lighting mode' }).click()
      return page.getByRole('dialog', { name: 'Lighting Mode' })
    },
    consumerCallsite: 'src/pages/CustomLightsPage.tsx:CustomLightsPage',
    physicalCallsite: 'src/components/core/OptionPickerDialog.tsx:OptionPickerDialog',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'thermostat-option-picker',
    open: (page) => openButtonModal(page, 'ecobee', /Thermostat Hub Mode Off/i, 'Thermostat Hub Mode'),
    consumerCallsite: 'src/pages/DashboardViewPage.tsx:ThermostatSelectButton',
    physicalCallsite: 'src/components/core/OptionPickerDialog.tsx:OptionPickerDialog',
  },
]

function listenForUnexpectedErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes("WebSocket connection to 'ws://mock-hass.local")) return
    if (text.startsWith('[StreamManager] WebSocket error for ')) return
    errors.push(`console: ${text}`)
  })
  return errors
}

async function auditBackdropBands(page: Page) {
  const overlay = page.locator('[data-modal-sheet-overlay="true"]:visible').last()
  return overlay.evaluate((element) => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter((dialog) => {
      const bounds = dialog.getBoundingClientRect()
      return bounds.width > 0 && bounds.height > 0
    })
    const dialog = dialogs.at(-1)
    const proxy = element.querySelector<HTMLElement>('[data-modal-backdrop-proxy="true"]')
    const bands = Object.fromEntries(Array.from(element.querySelectorAll<HTMLElement>('[data-modal-backdrop-band]')).map((band) => [
      band.dataset.modalBackdropBand,
      band.getBoundingClientRect(),
    ]))
    if (!dialog) throw new Error('Modal dialog geometry is unavailable')
    if (!proxy || !bands.top || !bands.bottom || !bands.left || !bands.right) {
      return {
        active: false,
        areaRatio: 1,
        coverageComplete: element.dataset.backdropPolicy === 'full',
        policy: element.dataset.backdropPolicy ?? '',
        proxyHeightDelta: 0,
      }
    }
    const overlayBounds = element.getBoundingClientRect()
    const dialogBounds = dialog.getBoundingClientRect()
    const proxyBounds = proxy.getBoundingClientRect()
    const areaRatio = Object.values(bands).reduce((area, bounds) => area + bounds.width * bounds.height, 0)
      / (overlayBounds.width * overlayBounds.height)
    const tolerance = 1
    const coverageComplete = bands.top.top <= overlayBounds.top + tolerance
      && bands.top.left <= overlayBounds.left + tolerance
      && bands.top.right >= overlayBounds.right - tolerance
      && bands.top.bottom >= dialogBounds.top + 30 - tolerance
      && bands.bottom.left <= overlayBounds.left + tolerance
      && bands.bottom.right >= overlayBounds.right - tolerance
      && bands.bottom.bottom >= overlayBounds.bottom - tolerance
      && bands.left.left <= overlayBounds.left + tolerance
      && bands.left.right >= dialogBounds.left + tolerance
      && bands.left.top <= bands.top.bottom + tolerance
      && bands.left.bottom >= bands.bottom.top - tolerance
      && bands.right.right >= overlayBounds.right - tolerance
      && bands.right.left <= dialogBounds.right - tolerance
      && bands.right.top <= bands.top.bottom + tolerance
      && bands.right.bottom >= bands.bottom.top - tolerance
    return {
      active: element.hasAttribute('data-exposed-backdrop-bands'),
      areaRatio,
      coverageComplete,
      policy: element.dataset.backdropPolicy ?? '',
      proxyHeightDelta: Math.abs(proxyBounds.height - dialogBounds.height),
    }
  })
}

async function auditModal(page: Page, modalCase: ModalCase, dialog: Locator, viewport: ResponsiveViewport, stage: string) {
  await page.waitForTimeout(540)
  await expect(dialog).toHaveAttribute('data-size', modalCase.expectedSize)
  await expect(dialog).toHaveAttribute('data-scroll-mode', modalCase.expectedScrollMode)

  const metrics = await dialog.evaluate((element) => {
    const dialogRect = element.getBoundingClientRect()
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    const navigation = element.querySelector<HTMLElement>('[data-modal-sheet-navigation="true"]')
    const footer = element.querySelector<HTMLElement>('[data-modal-sheet-footer="true"]')
    const regions = [
      body,
      ...element.querySelectorAll<HTMLElement>('[data-scroll-region]'),
    ].filter((region, index, items): region is HTMLElement =>
      Boolean(region && region.clientHeight > 0 && items.indexOf(region) === index),
    ).map((region) => {
      const style = getComputedStyle(region)
      return {
        clientHeight: region.clientHeight,
        name: region.dataset.scrollRegion ?? 'modal-body',
        overflowY: style.overflowY,
        scrollHeight: region.scrollHeight,
      }
    })
    const clippedRegions = regions
      .filter((region) => region.scrollHeight > region.clientHeight + 1 && !['auto', 'scroll'].includes(region.overflowY))
      .map((region) => region.name)
    const terminalViolations = regions.flatMap((region) => {
      if (region.scrollHeight <= region.clientHeight + 1 || !['auto', 'scroll'].includes(region.overflowY)) return []
      const regionElement = region.name === 'modal-body'
        ? body
        : element.querySelector<HTMLElement>(`[data-scroll-region="${CSS.escape(region.name)}"]`)
      if (!regionElement) return []
      if (region.name === 'modal-body' && regionElement.querySelector('[data-scroll-region]')) return []
      const previousScrollTop = regionElement.scrollTop
      regionElement.scrollTop = regionElement.scrollHeight
      const regionRect = regionElement.getBoundingClientRect()
      const candidates = Array.from(regionElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="heading"]',
      )).filter((candidate) => {
        const candidateRect = candidate.getBoundingClientRect()
        const owner = candidate.closest<HTMLElement>('[data-scroll-region], [data-modal-sheet-body="true"]')
        return owner === regionElement && candidateRect.width > 0 && candidateRect.height > 0
      })
      const terminal = candidates.at(-1)
      const terminalRect = terminal?.getBoundingClientRect()
      const terminalResult = terminalRect ? {
        ownerBottom: regionRect.bottom,
        ownerTop: regionRect.top,
        terminalBottom: terminalRect.bottom,
        terminalTop: terminalRect.top,
      } : null
      regionElement.scrollTop = previousScrollTop
      return terminalResult && terminalResult.terminalBottom > terminalResult.ownerBottom + 1
        ? [`${region.name}: ${Math.round(terminalResult.terminalTop)}-${Math.round(terminalResult.terminalBottom)} outside ${Math.round(terminalResult.ownerTop)}-${Math.round(terminalResult.ownerBottom)}`]
        : []
    })
    const unshieldedSvgTargets = Array.from(body?.querySelectorAll<SVGSVGElement>('svg') ?? []).flatMap((svg, index) => {
      const rect = svg.getBoundingClientRect()
      const style = getComputedStyle(svg)
      const visible = rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
      if (
        !visible
        || style.pointerEvents === 'none'
        || svg.closest('[data-base-ui-swipe-ignore="true"]')
      ) {
        return []
      }
      return [{
        ariaHidden: svg.getAttribute('aria-hidden'),
        ariaLabel: svg.getAttribute('aria-label'),
        className: svg.getAttribute('class'),
        index,
      }]
    })
    const box = (target: HTMLElement | null) => {
      const rect = target?.getBoundingClientRect()
      return rect ? { bottom: rect.bottom, top: rect.top } : null
    }
    return {
      bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
      bodyVisibleContent: Boolean(body && Array.from(body.children).some((child) => {
        const rect = child.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })),
      centered: element.dataset.centeredLayout === 'true',
      clippedRegions,
      dialog: {
        bottom: dialogRect.bottom,
        height: dialogRect.height,
        left: dialogRect.left,
        right: dialogRect.right,
        top: dialogRect.top,
        width: dialogRect.width,
      },
      footer: box(footer),
      navigation: box(navigation),
      terminalViolations,
      unshieldedSvgTargets,
    }
  })
  const backdrop = await auditBackdropBands(page)
  const expectedBackdropActive = backdrop.policy === 'auto' && !metrics.centered && backdrop.areaRatio <= 0.25
  expect(backdrop.active, `${modalCase.id} ${stage} automatic backdrop eligibility`).toBe(expectedBackdropActive)
  if (backdrop.policy === 'auto' && !metrics.centered) {
    expect(backdrop.proxyHeightDelta, `${modalCase.id} ${stage} backdrop proxy height`).toBeLessThanOrEqual(1)
  }
  if (backdrop.active) {
    expect(backdrop.areaRatio, `${modalCase.id} ${stage} backdrop band area`).toBeLessThanOrEqual(0.25)
    expect(backdrop.coverageComplete, `${modalCase.id} ${stage} backdrop coverage`).toBe(true)
  }

  expect(metrics.dialog.left, `${modalCase.id} ${stage} left containment`).toBeGreaterThanOrEqual(-1)
  expect(metrics.dialog.top, `${modalCase.id} ${stage} top containment`).toBeGreaterThanOrEqual(-1)
  expect(metrics.dialog.right, `${modalCase.id} ${stage} right containment`).toBeLessThanOrEqual(viewport.width + 1)
  expect(metrics.dialog.bottom, `${modalCase.id} ${stage} bottom containment`).toBeLessThanOrEqual(viewport.height + 1)
  expect(metrics.bodyVisibleContent, `${modalCase.id} ${stage} visible modal content`).toBe(true)
  expect(metrics.clippedRegions, `${modalCase.id} ${stage} clipped regions`).toEqual([])
  expect(metrics.terminalViolations, `${modalCase.id} ${stage} terminal reachability`).toEqual([])
  expect(metrics.unshieldedSvgTargets, `${modalCase.id} ${stage} unshielded modal SVG targets`).toEqual([])
  if (metrics.navigation) {
    expect(metrics.navigation.top).toBeGreaterThanOrEqual(metrics.dialog.top - 1)
    expect(metrics.navigation.bottom).toBeLessThanOrEqual(metrics.dialog.bottom + 1)
  }
  if (metrics.footer) {
    expect(metrics.footer.top).toBeGreaterThanOrEqual(metrics.dialog.top - 1)
    expect(metrics.footer.bottom).toBeLessThanOrEqual(metrics.dialog.bottom + 1)
  }
  if (modalCase.expectedScrollMode === 'panes' && metrics.centered) {
    expect(metrics.bodyOverflowY, `${modalCase.id} ${stage} pane body lock`).toBe('hidden')
  } else {
    expect(['auto', 'scroll'], `${modalCase.id} ${stage} body scroll owner`).toContain(metrics.bodyOverflowY)
  }
  if (metrics.centered) {
    const widthCap = {
      compact: 500,
      form: 560,
      media: 1100,
      standard: 720,
      workspace: 980,
    }[modalCase.expectedSize]
    expect(Math.round(metrics.dialog.width), `${modalCase.id} ${stage} typed width cap`).toBeLessThanOrEqual(widthCap)
  }
  if (modalCase.expectedSize === 'workspace' && viewport.width >= 760 && viewport.height >= 560) {
    expect(Math.round(metrics.dialog.height), `${modalCase.id} ${stage} workspace height`).toBeLessThanOrEqual(viewport.height - 63)
  }

  manifest.push({
    backdropActive: backdrop.active,
    backdropAreaRatio: backdrop.areaRatio,
    backdropCoverageComplete: backdrop.coverageComplete,
    backdropPolicy: backdrop.policy,
    backdropProxyHeightDelta: backdrop.proxyHeightDelta,
    bodyOverflowY: metrics.bodyOverflowY,
    bodyVisibleContent: metrics.bodyVisibleContent,
    centered: metrics.centered,
    clippedRegions: metrics.clippedRegions,
    dialogHeight: Math.round(metrics.dialog.height),
    dialogWidth: Math.round(metrics.dialog.width),
    id: modalCase.id,
    scrollMode: modalCase.expectedScrollMode,
    size: modalCase.expectedSize,
    stage,
    terminalViolations: metrics.terminalViolations,
    unshieldedSvgTargets: metrics.unshieldedSvgTargets,
    viewport,
  })
  return metrics
}

async function assertNoMutatingCalls(page: Page, modalCase: ModalCase) {
  const calls = await page.evaluate(() => window.__mockHass?.calls ?? [])
  const allowedReadCalls = new Set([
    'evershelf.list_inventory',
    'evershelf.recipe_detail',
    'evershelf.recipe_query',
    'weather.get_forecasts',
  ])
  const mutations = calls.filter((call) => {
    if (typeof call.domain !== 'string' || typeof call.service !== 'string') return true
    return !allowedReadCalls.has(`${call.domain}.${call.service}`)
  })
  expect(mutations, `${modalCase.id} invoked a mutating service while opening`).toEqual([])
}

async function exercisePersistentTabs(dialog: Locator, modalCase: ModalCase) {
  let selectedTab: Locator | null = null
  for (const tabName of modalCase.selectTabs ?? []) {
    const tab = dialog.getByRole('tab', { name: tabName })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    selectedTab = tab
  }
  return selectedTab
}

async function assertMountedClose(dialog: Locator) {
  await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await expect(dialog).toHaveAttribute('data-closing', 'true')
  await expect(dialog).toHaveCount(0, { timeout: 700 })
}

test.describe.serial('complete ModalSheet inventory acceptance', () => {
  test.afterAll(() => {
    const output = artifactPath('phase3-modal-acceptance.json')
    if (output && manifest.length > 0) {
      fs.writeFileSync(output, `${JSON.stringify({
        counting: {
          directModalSheetJsxCallsites: 29,
          expandedAcceptanceRows: MODAL_CASES.length,
          logicalAcceptanceSurfaces: MODAL_CASES.length,
          optionPickerConsumersAdded: 2,
        },
        generatedAt: new Date().toISOString(),
        results: manifest,
        surfaces: MODAL_CASES.map(({ consumerCallsite, expectedScrollMode, expectedSize, id, physicalCallsite }) => ({
          consumerCallsite,
          expectedScrollMode,
          expectedSize,
          id,
          physicalCallsite,
        })),
      }, null, 2)}\n`)
    }
  })

  test('reconciles physical ModalSheet nodes with expanded review surfaces', () => {
    expect(modalInventoryCounts()).toEqual({
      directModalSheetJsxCallsites: 29,
      expandedReviewRows: 31,
      optionPickerConsumerCallsites: EXPECTED_OPTION_PICKER_CONSUMERS,
      optionPickerSheetConsumers: 2,
      physicalCallsiteCounts: EXPECTED_PHYSICAL_MODAL_CALLSITES,
    })
    expect(MODAL_CASES).toHaveLength(32)
    expect([...new Set(MODAL_CASES.map((modalCase) => modalCase.physicalCallsite))].sort()).toEqual(
      Object.keys(EXPECTED_PHYSICAL_MODAL_CALLSITES).sort(),
    )
    expect(MODAL_CASES.flatMap((modalCase) => modalCase.consumerCallsite ?? []).sort()).toEqual(
      EXPECTED_OPTION_PICKER_CONSUMERS,
    )
  })

  for (const modalCase of MODAL_CASES) {
    test(`${modalCase.id} survives all required modal transitions`, async ({ page }) => {
      test.setTimeout(150_000)
      const errors = listenForUnexpectedErrors(page)

      await page.setViewportSize(PHONE)
      let dialog = await modalCase.open(page)
      const selectedMobileTab = await exercisePersistentTabs(dialog, modalCase)
      const mobileStart = await auditModal(page, modalCase, dialog, PHONE, 'mobile-start')
      await page.setViewportSize(DESKTOP)
      await auditModal(page, modalCase, dialog, DESKTOP, 'mobile-desktop')
      if (selectedMobileTab) await expect(selectedMobileTab).toHaveAttribute('aria-selected', 'true')
      await page.setViewportSize(PHONE)
      const mobileEnd = await auditModal(page, modalCase, dialog, PHONE, 'mobile-desktop-mobile')
      expect(Math.abs(mobileEnd.dialog.height - mobileStart.dialog.height)).toBeLessThanOrEqual(1)
      await assertNoMutatingCalls(page, modalCase)
      await assertMountedClose(dialog)

      await page.setViewportSize(DESKTOP)
      dialog = await modalCase.open(page)
      const selectedDesktopTab = await exercisePersistentTabs(dialog, modalCase)
      const desktopStart = await auditModal(page, modalCase, dialog, DESKTOP, 'desktop-start')
      await page.setViewportSize(PHONE)
      await auditModal(page, modalCase, dialog, PHONE, 'desktop-mobile')
      if (selectedDesktopTab) await expect(selectedDesktopTab).toHaveAttribute('aria-selected', 'true')
      await page.setViewportSize(DESKTOP)
      const desktopEnd = await auditModal(page, modalCase, dialog, DESKTOP, 'desktop-mobile-desktop')
      expect(Math.abs(desktopEnd.dialog.height - desktopStart.dialog.height)).toBeLessThanOrEqual(1)
      await assertNoMutatingCalls(page, modalCase)
      await assertMountedClose(dialog)

      await page.setViewportSize(IPAD_PORTRAIT)
      dialog = await modalCase.open(page)
      const selectedTabletTab = await exercisePersistentTabs(dialog, modalCase)
      const tabletStart = await auditModal(page, modalCase, dialog, IPAD_PORTRAIT, 'ipad-portrait')
      await page.setViewportSize(IPAD_LANDSCAPE)
      await auditModal(page, modalCase, dialog, IPAD_LANDSCAPE, 'ipad-landscape')
      if (selectedTabletTab) await expect(selectedTabletTab).toHaveAttribute('aria-selected', 'true')
      await page.setViewportSize(IPAD_PORTRAIT)
      const tabletEnd = await auditModal(page, modalCase, dialog, IPAD_PORTRAIT, 'ipad-landscape-portrait')
      expect(Math.abs(tabletEnd.dialog.height - tabletStart.dialog.height)).toBeLessThanOrEqual(1)
      await assertNoMutatingCalls(page, modalCase)
      await assertMountedClose(dialog)

      for (const viewport of [PHONE_LANDSCAPE, WIDE_DESKTOP]) {
        await page.setViewportSize(viewport)
        dialog = await modalCase.open(page)
        await exercisePersistentTabs(dialog, modalCase)
        await auditModal(page, modalCase, dialog, viewport, viewport.name)
        await assertNoMutatingCalls(page, modalCase)
        await assertMountedClose(dialog)
      }

      expect(errors).toEqual([])
    })
  }
})
