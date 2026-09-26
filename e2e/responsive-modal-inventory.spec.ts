// @covers src/components/hass/EditTodoItemSheet.tsx
// @covers src/components/hass/EditTodoItemSheet.module.css
// @covers src/components/shell/GlobalQuickLinksAction.tsx
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Locator, type Page } from './layout/fixture'
import { waitForModalReady } from './layout/evidence'
import { openQuickLinksTab } from './quick-links'
import ts from 'typescript'
import { modalSheetPresentationForViewport } from '../src/components/core/modalSheetPresentation'
import { VIEWPORTS, type ResponsiveViewport } from './responsive-acceptance-data'
import { installSafeAreaInsets, setSafeAreaInsets } from './safe-area'

// @covers src/components/core/ScheduleConfirmationForm.module.css
// @covers src/components/core/FieldActionButton.module.css

type ModalAudit = {
  backdropActive: boolean
  backdropAreaRatio: number
  backdropCoverageComplete: boolean
  backdropPolicy: string
  backdropProxyHeightDelta: number
  blockPolicy: string
  bodyOverflowY: string
  bodyVisibleContent: boolean
  centered: boolean
  clippedRegions: string[]
  dialogHeight: number
  dialogWidth: number
  geometryIntent: string
  id: string
  presentation: string
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

const PHONE = VIEWPORTS['phone-portrait']
const PHONE_LANDSCAPE = VIEWPORTS['phone-landscape']
const IPAD_PORTRAIT = VIEWPORTS['ipad-portrait']
const IPAD_LANDSCAPE = VIEWPORTS['ipad-landscape']
const DESKTOP = VIEWPORTS.desktop
const WIDE_DESKTOP = VIEWPORTS['wide-desktop']
const REGULAR_LANDSCAPE_DENSITY_CASES = new Set([
  'admin-presence-auto-reset',
  'admin-presence-overrides',
  'at-a-glance-sheet',
])
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
  const missingCenteredGeometryCallsites: string[] = []
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
          const centeredGeometry = opening.attributes.properties.find((property) =>
            ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'centeredGeometry',
          )
          if (!centeredGeometry) missingCenteredGeometryCallsites.push(callsite)
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
    missingCenteredGeometryCallsites: missingCenteredGeometryCallsites.sort(),
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
  'src/components/hass/EditTodoItemSheet.tsx:EditTodoItemSheet': 1,
  'src/components/hass/DailyReportModal.tsx:DailyReportModalView': 1,
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
  'src/components/hass/wakeLights/WakeLightModalContent.tsx:WakeLightModal': 1,
  'src/components/hass/householdAway/SoloTripEditorModal.tsx:SoloTripEditorModal': 1,
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
  await waitForModalReady(dialog)
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
  await page.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i }).click()
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
  await waitForDialogSettled(dialog)
  return dialog
}

async function openSoloTripEditor(page: Page) {
  await gotoRoute(page, 'vacation')
  await page.getByRole('button', { name: /Solo Trip One traveler, one home resident/i }).click()
  await page.getByRole('button', { name: 'You', exact: true }).click()
  await clearMockCalls(page)
  await page.getByRole('switch', { name: 'Solo Trip Off' }).click()
  const dialog = page.getByRole('dialog', { name: 'Schedule Solo Trip' })
  await expect(dialog).toBeVisible()
  await waitForDialogSettled(dialog)
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

async function openAdminTodoEditModal(page: Page) {
  await gotoRoute(page, 'to-do')
  await page.evaluate(() => {
    const mock = window.__mockHass!
    mock.setEntityState('todo.groceries', '1')
    mock.setTodoItems('todo.groceries', [
      { status: 'needs_action', summary: 'Layout validation task', uid: 'layout-admin-task' },
    ])
  })
  await page.getByLabel('Admin To-Do todo list').getByRole('button', { name: 'Edit Layout validation task' }).click()
  return page.getByRole('dialog', { name: 'Edit Task' })
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
    expectedScrollMode: 'panes',
    expectedSize: 'workspace',
    id: 'wake-light',
    open: page => openButtonModal(page, 'master-bedroom', /Wake-Light Alarms Next/i, 'Master Bedroom Wake-Light Alarms'),
    physicalCallsite: 'src/components/hass/wakeLights/WakeLightModalContent.tsx:WakeLightModal',
    selectTabs: ['Wake Alarms', 'Defaults'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'workspace',
    id: 'wake-light-editor',
    open: async page => {
      const dialog = await openButtonModal(page, 'master-bedroom', /Wake-Light Alarms Next/i, 'Master Bedroom Wake-Light Alarms')
      await dialog.getByRole('button', { name: 'Add Wake Alarm', exact: true }).click()
      return page.getByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
    },
    physicalCallsite: 'src/components/hass/wakeLights/WakeLightModalContent.tsx:WakeLightModal',
  },
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
    selectTabs: ['Controls', 'Apps', 'Devices', 'Hue Sync'],
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
    expectedSize: 'form',
    id: 'solo-trip-editor',
    open: openSoloTripEditor,
    physicalCallsite: 'src/components/hass/householdAway/SoloTripEditorModal.tsx:SoloTripEditorModal',
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
    open: (page) => openButtonModal(page, 'master-bedroom', /Steph's Side Off/i, /Steph.s Bed/),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:EightSleepBedModal',
    selectTabs: [/^(?:Temperature|Sleep Schedule)$/, 'Special Modes', 'Alarms', 'Status'],
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'workspace',
    id: 'thermostat',
    open: (page) => openHashModal(page, 'thermostat', '#thermostat-controls', 'Thermostat · Advanced Controls'),
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
    expectedSize: 'form',
    id: 'admin-todo-edit',
    open: openAdminTodoEditModal,
    physicalCallsite: 'src/components/hass/EditTodoItemSheet.tsx:EditTodoItemSheet',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'daily-report',
    open: (page) => openHashModal(page, 'overview&user=stephen', '#daily-report', "Your Summary"),
    physicalCallsite: 'src/components/hass/DailyReportModal.tsx:DailyReportModalView',
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
    selectTabs: ['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'],
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
    open: async (page) => {
      await gotoRoute(page, 'living-room')
      await openQuickLinksTab(page)
      return page.locator('[role="dialog"][data-modal-geometry-intent="global-quick-links"]')
    },
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
    open: (page) => openButtonModal(page, 'thermostat', /Thermostat Hub Mode Off/i, 'Thermostat Hub Mode'),
    consumerCallsite: 'src/pages/DashboardViewPage.tsx:ThermostatSelectButton',
    physicalCallsite: 'src/components/core/OptionPickerDialog.tsx:OptionPickerDialog',
  },
]

const LANDSCAPE_INTENT_CASES: ModalCase[] = [
  ...MODAL_CASES,
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'home-climate-overview',
    open: (page) => openHashModal(page, 'overview', '#climate-overview', 'Climate'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'home-occupancy-overview',
    open: (page) => openHashModal(page, 'overview', '#occupancy-overview', 'Occupancy'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'home-contact-overview',
    open: (page) => openHashModal(page, 'overview', '#contact-sensors-overview', 'Contact Sensors'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'home-aqi-overview',
    open: (page) => openHashModal(page, 'overview', '#aqi-overview', 'Air Quality'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'home-security-system',
    open: (page) => openHashModal(page, 'overview', '#security-system', 'Security System'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'home-guest-presence',
    open: (page) => openHashModal(page, 'overview', '#guest-presence-security', 'Guest Presence Security'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'home-camera',
    open: (page) => openHashModal(page, 'overview', '#camera-front-door', /Front Door/),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'home-chores-preview',
    open: (page) => openHashModal(page, 'overview', '#chores-preview', 'Chores'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'home-settings-preview',
    open: (page) => openHashModal(page, 'overview', '#settings-preview', 'Settings'),
    physicalCallsite: 'src/pages/AtAGlancePage.tsx:AtAGlancePage',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'master-bedroom-climate',
    open: (page) => openButtonModal(page, 'master-bedroom', /^Climate /i, 'Master Bedroom Climate'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'master-bedroom-lights',
    open: (page) => openHashModal(page, 'master-bedroom', '#lights-master-bedroom'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'master-bedroom-occupancy',
    open: (page) => openHashModal(page, 'master-bedroom', '#master-bedroom-occupancy'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'master-bedroom-window',
    open: (page) => openHashModal(page, 'master-bedroom', '#window-master-bedroom'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'master-bedroom-air',
    open: (page) => openHashModal(page, 'master-bedroom', '#air-purifier'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'compact',
    id: 'living-room-vents',
    open: (page) => openHashModal(page, 'living-room', '#vents'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'kitchen-dishwasher',
    open: (page) => openHashModal(page, 'kitchen', '#dishwasher', 'Dishwasher'),
    physicalCallsite: 'src/pages/DashboardViewPage.tsx:RoomSourceModal',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'security-contact-sensors',
    open: (page) => openHashModal(page, 'security', '#contact-sensors-overview', 'Contact Sensors'),
    physicalCallsite: 'src/components/hass/SecurityDashboard.tsx:SecurityDashboard',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'standard',
    id: 'security-guest-presence',
    open: (page) => openHashModal(page, 'security', '#guest-presence-security', 'Guest Presence Security'),
    physicalCallsite: 'src/components/hass/SecurityDashboard.tsx:SecurityDashboard',
  },
  {
    expectedScrollMode: 'body',
    expectedSize: 'media',
    id: 'security-camera',
    open: (page) => openHashModal(page, 'security', '#camera-front-door', /Front Door/),
    physicalCallsite: 'src/components/hass/SecurityDashboard.tsx:SecurityDashboard',
  },
]

const LANDSCAPE_GEOMETRY_PROFILES = [
  { height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, name: '568x320', width: 568 },
  { height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, name: '667x375', width: 667 },
  { height: 343, insets: { bottom: 0, left: 0, right: 0, top: 0 }, name: '734x343', width: 734 },
  { height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, name: '852x393-left', width: 852 },
  { height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, name: '852x393-right', width: 852 },
] as const

const PORTRAIT_TILE_CASES = [
  {
    id: 'rooms',
    open: async (page: Page) => {
      await gotoRoute(page, 'overview')
      await openQuickLinksTab(page)
      const quickLinks = page.getByRole('dialog', { name: 'Quick Links' })
      await quickLinks.getByRole('button', { name: 'Rooms' }).click()
      return page.getByRole('dialog', { name: 'Rooms' })
    },
    expected: { height: 147.875, icon: 42, padding: '22px 22px 18px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'home-lights',
    open: (page: Page) => openHashModal(page, 'overview', '#lights-overview', /Lights/),
    expected: { height: 147.875, icon: 31.078125, padding: '22px 22px 17px', radius: '30px', titleFont: '16px', width: 174.5 },
  },
  {
    id: 'home-climate',
    open: (page: Page) => openHashModal(page, 'overview', '#climate-overview', 'Climate'),
    expected: { height: 147.875, icon: 42, padding: '22px 22px 17px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'home-occupancy',
    open: (page: Page) => openHashModal(page, 'overview', '#occupancy-overview', 'Occupancy'),
    expected: { height: 147.875, icon: 38, padding: '22px 22px 17px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'home-contact',
    open: (page: Page) => openHashModal(page, 'overview', '#contact-sensors-overview', 'Contact Sensors'),
    expected: { height: 147.875, icon: 38, padding: '22px 22px 17px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'home-aqi',
    open: (page: Page) => openHashModal(page, 'overview', '#aqi-overview', 'Air Quality'),
    expected: { height: 147.875, icon: 42, padding: '22px 22px 17px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'security-contact',
    open: (page: Page) => openHashModal(page, 'security', '#contact-sensors-overview', 'Contact Sensors'),
    expected: { height: 147.875, icon: 38, padding: '22px 22px 17px', radius: '30px', titleFont: '15.68px', width: 174.5 },
  },
  {
    id: 'admin-presence',
    open: (page: Page) => openHashModal(page, 'admin', '#presence-based-overrides', 'Presence-Based Overrides'),
    expected: { height: 120, icon: 36, padding: '16px 14px', radius: '32px', titleFont: '13.76px', width: 175.5 },
  },
  {
    id: 'admin-auto',
    open: (page: Page) => openHashModal(page, 'admin', '#presence-based-overrides-auto', 'Presence-Based Overrides Auto-Reset'),
    expected: { height: 120, icon: 36, padding: '16px 14px', radius: '32px', titleFont: '13.76px', width: 175.5 },
  },
] as const

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
  await waitForModalReady(dialog)
  await expect(dialog).toHaveAttribute('data-size', modalCase.expectedSize)
  await expect(dialog).toHaveAttribute('data-scroll-mode', modalCase.expectedScrollMode)
  await expect(dialog).toHaveAttribute(
    'data-landscape-density',
    REGULAR_LANDSCAPE_DENSITY_CASES.has(modalCase.id) ? 'regular' : 'compact',
  )
  const expectedPresentation = modalSheetPresentationForViewport(viewport.width, viewport.height)
  await expect(dialog).toHaveAttribute('data-modal-presentation', expectedPresentation)

  const metrics = await dialog.evaluate((element) => {
    const dialogRect = element.getBoundingClientRect()
    const rootStyle = getComputedStyle(document.documentElement)
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
      .filter((region) => region.name !== 'modal-body'
        && region.scrollHeight > region.clientHeight + 1
        && !['auto', 'scroll'].includes(region.overflowY))
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
      blockPolicy: element.dataset.modalBlockPolicy ?? '',
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
      geometryIntent: element.dataset.modalGeometryIntent ?? '',
      innerPaneOwners: regions
        .filter((region) => region.name !== 'modal-body' && ['auto', 'scroll'].includes(region.overflowY))
        .map((region) => region.name),
      navigation: box(navigation),
      presentation: element.dataset.modalPresentation,
      safeArea: {
        bottom: Number.parseFloat(rootStyle.getPropertyValue('--rd-safe-bottom')) || 0,
        left: Number.parseFloat(rootStyle.getPropertyValue('--rd-safe-left')) || 0,
        right: Number.parseFloat(rootStyle.getPropertyValue('--rd-safe-right')) || 0,
        top: Number.parseFloat(rootStyle.getPropertyValue('--rd-safe-top')) || 0,
      },
      terminalViolations,
      unshieldedSvgTargets,
    }
  })
  await expect.poll(async () => {
    const current = await auditBackdropBands(page)
    const expected = current.policy === 'auto' && !metrics.centered && current.areaRatio <= 0.25
    return current.active === expected
  }, { message: `${modalCase.id} ${stage} settled automatic backdrop eligibility` }).toBe(true)
  const backdrop = await auditBackdropBands(page)
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
  expect(metrics.geometryIntent, `${modalCase.id} ${stage} centered geometry intent`).not.toBe('')
  expect(['content-fit', 'fixed'], `${modalCase.id} ${stage} centered block policy`).toContain(metrics.blockPolicy)
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
  if (modalCase.expectedScrollMode === 'panes' && metrics.presentation !== 'sheet' && metrics.bodyOverflowY === 'hidden') {
    expect(metrics.bodyOverflowY, `${modalCase.id} ${stage} pane body lock`).toBe('hidden')
    expect(metrics.innerPaneOwners.length, `${modalCase.id} ${stage} declared inner pane owner`).toBeGreaterThan(0)
  } else {
    expect(['auto', 'scroll'], `${modalCase.id} ${stage} body scroll owner`).toContain(metrics.bodyOverflowY)
  }
  if (metrics.presentation === 'landscape-dialog') {
    expect(Math.abs(metrics.dialog.left - (metrics.safeArea.left + 12)), `${modalCase.id} ${stage} landscape left`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.top - (metrics.safeArea.top + 8)), `${modalCase.id} ${stage} landscape top`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.width - (viewport.width - metrics.safeArea.left - metrics.safeArea.right - 24)), `${modalCase.id} ${stage} landscape width`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.height - (viewport.height - metrics.safeArea.top - metrics.safeArea.bottom - 16)), `${modalCase.id} ${stage} landscape height`).toBeLessThanOrEqual(1)
  }
  if (metrics.presentation === 'dialog') {
    const left = Math.max(32, metrics.safeArea.left)
    const right = Math.max(32, metrics.safeArea.right)
    const top = Math.max(32, metrics.safeArea.top)
    const bottom = Math.max(32, metrics.safeArea.bottom)
    const width = Math.min(1100, viewport.width - left - right)
    const height = Math.min(760, viewport.height - top - bottom)
    expect(Math.abs(metrics.dialog.width - width), `${modalCase.id} ${stage} common dialog width`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.height - height), `${modalCase.id} ${stage} common dialog height`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.left - (left + (viewport.width - left - right - width) / 2)), `${modalCase.id} ${stage} dialog left`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.dialog.top - (top + (viewport.height - top - bottom - height) / 2)), `${modalCase.id} ${stage} dialog top`).toBeLessThanOrEqual(1)
  }
  if (modalCase.expectedSize === 'workspace' && metrics.presentation === 'dialog') {
    expect(Math.round(metrics.dialog.height), `${modalCase.id} ${stage} workspace height`).toBeLessThanOrEqual(viewport.height - 63)
  }

  manifest.push({
    backdropActive: backdrop.active,
    backdropAreaRatio: backdrop.areaRatio,
    backdropCoverageComplete: backdrop.coverageComplete,
    backdropPolicy: backdrop.policy,
    backdropProxyHeightDelta: backdrop.proxyHeightDelta,
    blockPolicy: metrics.blockPolicy,
    bodyOverflowY: metrics.bodyOverflowY,
    bodyVisibleContent: metrics.bodyVisibleContent,
    centered: metrics.centered,
    clippedRegions: metrics.clippedRegions,
    dialogHeight: Math.round(metrics.dialog.height),
    dialogWidth: Math.round(metrics.dialog.width),
    geometryIntent: metrics.geometryIntent,
    id: modalCase.id,
    presentation: metrics.presentation ?? '',
    scrollMode: modalCase.expectedScrollMode,
    size: modalCase.expectedSize,
    stage,
    terminalViolations: metrics.terminalViolations,
    unshieldedSvgTargets: metrics.unshieldedSvgTargets,
    viewport,
  })
  if (stage.startsWith('state-') && ['portrait', '852x393-left', 'desktop'].some((suffix) => stage.endsWith(suffix))) {
    const screenshot = artifactPath(`modal-${modalCase.id}-${stage.replace(/[^a-z0-9-]/gi, '-')}.png`)
    if (screenshot) await page.screenshot({ path: screenshot, scale: 'css' })
  }
  return metrics
}

async function assertNoMutatingCalls(page: Page, modalCase: Pick<ModalCase, 'id'>) {
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
  const node = await dialog.elementHandle()
  if (!node) throw new Error('Cannot close a missing modal')
  await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
  await expect.poll(() => node.evaluate((element) => ({
    state: element.getAttribute('data-state'),
    closing: element.getAttribute('data-closing'),
    inert: element.hasAttribute('inert'),
  })), { timeout: 750, intervals: [16, 32, 64, 128] }).toEqual({
    state: 'closed', closing: 'true', inert: true,
  })
  const exitDurations = await node.evaluate((element) => element.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => Number(animation.effect?.getComputedTiming().endTime ?? 0)))
  expect(Math.max(0, ...exitDurations)).toBeLessThanOrEqual(700)
  await node.evaluate((element) => Promise.all(element.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))))
  await expect(dialog).toHaveCount(0)
  await node.dispose()
}

test.describe('complete ModalSheet inventory acceptance', () => {
  test.beforeEach(() => { manifest.length = 0 })
  test.afterEach(async ({ browserName }, testInfo) => {
    const data = {
      scope: 'Per-test legacy audit, not a complete matrix or checkpoint certificate',
      testId: testInfo.testId, title: testInfo.title, status: testInfo.status, browserName,
      auditedGeometryIntentIds: [...new Set(manifest.map((entry) => entry.geometryIntent))].sort(),
      auditedStateStages: [...new Set(manifest.map((entry) => `${entry.id}:${entry.stage}`))],
      results: manifest,
    }
    const attached = testInfo.outputPath('modal-acceptance.json')
    fs.writeFileSync(attached, `${JSON.stringify(data, null, 2)}\n`)
    await testInfo.attach('legacy-modal-acceptance', { path: attached, contentType: 'application/json' })
    const output = artifactPath(`phase3-modal-acceptance-${testInfo.testId}.json`)
    if (output) fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`)
  })

  test('reconciles physical ModalSheet nodes with expanded review surfaces', () => {
    expect(modalInventoryCounts()).toEqual({
      directModalSheetJsxCallsites: 32,
      expandedReviewRows: 34,
      missingCenteredGeometryCallsites: [],
      optionPickerConsumerCallsites: EXPECTED_OPTION_PICKER_CONSUMERS,
      optionPickerSheetConsumers: 2,
      physicalCallsiteCounts: EXPECTED_PHYSICAL_MODAL_CALLSITES,
    })
    expect(MODAL_CASES).toHaveLength(36)
    expect(LANDSCAPE_INTENT_CASES).toHaveLength(55)
    expect([...new Set(MODAL_CASES.map((modalCase) => modalCase.physicalCallsite))].sort()).toEqual(
      Object.keys(EXPECTED_PHYSICAL_MODAL_CALLSITES).sort(),
    )
    expect(MODAL_CASES.flatMap((modalCase) => modalCase.consumerCallsite ?? []).sort()).toEqual(
      EXPECTED_OPTION_PICKER_CONSUMERS,
    )
  })

  test('keeps Vacation and Solo Trip schedule forms visually identical', async ({ page }) => {
    test.setTimeout(180_000)

    const facts = async (dialog: Locator) => {
      const fields = dialog.locator('[data-schedule-confirmation-fields="true"]')
      const action = dialog.locator('[data-schedule-confirmation-action="true"]')
      await expect(fields).toBeVisible()
      await expect(action).toBeVisible()
      await expect(fields.locator('label')).toHaveCount(4)
      await expect(action).toHaveAttribute('data-variant', 'primary')
      return {
        dialog: await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }
        }),
        action: await action.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return {
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            height: rect.height,
            width: rect.width,
          }
        }),
        fields: await fields.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return {
            columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
            gridTemplateColumns: style.gridTemplateColumns,
            width: rect.width,
          }
        }),
      }
    }

    for (const profile of [
      { columns: 1, height: 852, insets: { bottom: 34, left: 0, right: 0, top: 59 }, width: 393 },
      { columns: 2, height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 568 },
      { columns: 2, height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 667 },
      { columns: 2, height: 343, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 734 },
      { columns: 2, height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, width: 852 },
      { columns: 2, height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, width: 852 },
      { columns: 2, height: 900, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 1440 },
    ]) {
      await page.setViewportSize({ height: profile.height, width: profile.width })
      await installSafeAreaInsets(page, profile.insets)
      const vacation = await openVacationConfirmation(page)
      const vacationFacts = await facts(vacation)
      await assertNoMutatingCalls(page, { id: 'vacation-confirmation' })
      await assertMountedClose(vacation)

      const soloTrip = await openSoloTripEditor(page)
      const soloTripFacts = await facts(soloTrip)
      await assertNoMutatingCalls(page, { id: 'solo-trip-editor' })

      expect(vacationFacts.fields.columns).toBe(profile.columns)
      expect(soloTripFacts.fields.columns).toBe(profile.columns)
      expect(soloTripFacts.dialog).toEqual(vacationFacts.dialog)
      expect(Math.abs(vacationFacts.fields.width - vacationFacts.action.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(soloTripFacts.fields.width - soloTripFacts.action.width)).toBeLessThanOrEqual(1)
      expect(soloTripFacts.fields.gridTemplateColumns).toBe(vacationFacts.fields.gridTemplateColumns)
      expect(soloTripFacts.action).toEqual(vacationFacts.action)

      await assertMountedClose(soloTrip)
    }
  })

  for (const profile of LANDSCAPE_GEOMETRY_PROFILES) {
    test(`uses one exact landscape rectangle for each listed opener and kind at ${profile.name}`, async ({ page }) => {
      test.setTimeout(900_000)
      await page.setViewportSize({ height: profile.height, width: profile.width })
      await installSafeAreaInsets(page, profile.insets)

      for (const modalCase of LANDSCAPE_INTENT_CASES) {
        const dialog = await modalCase.open(page)
        await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
        const geometry = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }
        })
        expect(Math.abs(geometry.left - (profile.insets.left + 12)), `${modalCase.id} left`).toBeLessThanOrEqual(1)
        expect(Math.abs(geometry.top - (profile.insets.top + 8)), `${modalCase.id} top`).toBeLessThanOrEqual(1)
        expect(Math.abs(geometry.width - (profile.width - profile.insets.left - profile.insets.right - 24)), `${modalCase.id} width`).toBeLessThanOrEqual(1)
        expect(Math.abs(geometry.height - (profile.height - profile.insets.top - profile.insets.bottom - 16)), `${modalCase.id} height`).toBeLessThanOrEqual(1)
        await assertNoMutatingCalls(page, modalCase)
        await assertMountedClose(dialog)
      }
    })
  }

  test('preserves literal accepted portrait tile metrics for every affected family', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ height: 852, width: 393 })
    await installSafeAreaInsets(page, { bottom: 34, left: 0, right: 0, top: 59 })

    for (const tileCase of PORTRAIT_TILE_CASES) {
      const dialog = await tileCase.open(page)
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      const metrics = await dialog.evaluate((element) => {
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
        const bodyStyle = body ? getComputedStyle(body) : null
        const bodyContentWidth = body
          ? body.clientWidth - Number.parseFloat(bodyStyle?.paddingLeft ?? '0') - Number.parseFloat(bodyStyle?.paddingRight ?? '0')
          : 0
        const grid = element.querySelector<HTMLElement>('[style*="--modal-square-card-size"]')
        const card = grid?.querySelector<HTMLElement>('button, article')
        const cardRect = card?.getBoundingClientRect()
        const cardStyle = card ? getComputedStyle(card) : null
        const icon = card?.querySelector<SVGElement>('svg')
        const title = card?.querySelector<HTMLElement>('span:last-child span:first-child')
        const dialogRect = element.getBoundingClientRect()
        return {
          bodyContentWidth,
          bodyPaddingBottom: bodyStyle?.paddingBottom ?? '',
          cardHeight: cardRect?.height ?? 0,
          cardWidth: cardRect?.width ?? 0,
          dialogHeight: dialogRect.height,
          dialogWidth: dialogRect.width,
          gridWidth: grid?.getBoundingClientRect().width ?? 0,
          iconWidth: icon?.getBoundingClientRect().width ?? 0,
          padding: cardStyle?.padding ?? '',
          radius: cardStyle?.borderRadius ?? '',
          titleFont: title ? getComputedStyle(title).fontSize : '',
        }
      })

      expect(Math.abs(metrics.dialogWidth - 393), `${tileCase.id} dialog width`).toBeLessThanOrEqual(1)
      expect(Math.abs(metrics.dialogHeight - 767), `${tileCase.id} dialog height`).toBeLessThanOrEqual(1)
      expect(metrics.bodyPaddingBottom, `${tileCase.id} body bottom padding`).toBe('58px')
      if (tileCase.id === 'rooms') {
        await expect(dialog.locator('[data-modal-sheet-navigation="true"]')).toHaveCount(0)
        await expect(dialog.locator('[data-modal-sheet-footer="true"]')).toHaveCount(0)
      }
      expect(Math.abs(metrics.gridWidth - 359), `${tileCase.id} grid width`).toBeLessThanOrEqual(1)
      expect(Math.abs(metrics.bodyContentWidth - 359), `${tileCase.id} body content width`).toBeLessThanOrEqual(1)
      expect(Math.abs(metrics.cardWidth - tileCase.expected.width), `${tileCase.id} card width`).toBeLessThanOrEqual(0.1)
      expect(Math.abs(metrics.cardHeight - tileCase.expected.height), `${tileCase.id} card height`).toBeLessThanOrEqual(0.1)
      expect(Math.abs(metrics.iconWidth - tileCase.expected.icon), `${tileCase.id} icon width`).toBeLessThanOrEqual(0.1)
      expect(metrics.padding, `${tileCase.id} padding`).toBe(tileCase.expected.padding)
      expect(metrics.radius, `${tileCase.id} radius`).toBe(tileCase.expected.radius)
      expect(metrics.titleFont, `${tileCase.id} title font`).toBe(tileCase.expected.titleFont)
      await assertMountedClose(dialog)
    }

    const footerDialog = await openButtonModal(page, 'to-do', 'Add Task', 'Add Task')
    await expect(footerDialog.locator('[data-modal-sheet-footer="true"]')).toHaveCSS('padding-bottom', '52px')
    await assertMountedClose(footerDialog)
  })

  for (const modalCase of MODAL_CASES) {
    test(`${modalCase.id} survives all required modal transitions`, async ({ page }) => {
      test.setTimeout(300_000)
      const errors = listenForUnexpectedErrors(page)

      await page.setViewportSize(PHONE)
      let dialog = await modalCase.open(page)
      await dialog.evaluate((element) => { element.setAttribute('data-state-cycle-node', 'original') })
      const tabs = await dialog.getByRole('tab').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''))
      const states = tabs.length > 0 ? tabs : [null]
      for (const state of states) {
        const label = `state-${state ?? 'root'}`
        await page.setViewportSize(PHONE)
        await setSafeAreaInsets(page, { top: 59, right: 0, bottom: 34, left: 0 })
        const tab = state === null ? null : dialog.getByRole('tab', { name: state, exact: true })
        if (tab) {
          await expect(tab).toBeEnabled()
          await tab.click()
        }
        const mobileStart = await auditModal(page, modalCase, dialog, PHONE, `${label}-portrait`)
        for (const profile of LANDSCAPE_GEOMETRY_PROFILES) {
          await page.setViewportSize({ width: profile.width, height: profile.height })
          await setSafeAreaInsets(page, profile.insets)
          await auditModal(page, modalCase, dialog, profile, `${label}-${profile.name}`)
          if (tab) await expect(tab).toHaveAttribute('aria-selected', 'true')
          await expect(dialog).toHaveAttribute('data-state-cycle-node', 'original')
        }
        await page.setViewportSize(PHONE)
        await setSafeAreaInsets(page, { top: 59, right: 0, bottom: 34, left: 0 })
        await auditModal(page, modalCase, dialog, PHONE, `${label}-rotated-portrait`)
        await page.setViewportSize(DESKTOP)
        await setSafeAreaInsets(page, { top: 0, right: 0, bottom: 0, left: 0 })
        await auditModal(page, modalCase, dialog, DESKTOP, `${label}-desktop`)
        if (tab) await expect(tab).toHaveAttribute('aria-selected', 'true')
        await page.setViewportSize(PHONE)
        await setSafeAreaInsets(page, { top: 59, right: 0, bottom: 34, left: 0 })
        const mobileEnd = await auditModal(page, modalCase, dialog, PHONE, `${label}-desktop-portrait`)
        expect(Math.abs(mobileEnd.dialog.height - mobileStart.dialog.height)).toBeLessThanOrEqual(1)
        await expect(dialog).toHaveAttribute('data-state-cycle-node', 'original')
      }
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
