import { DAILY_REPORT_TABS } from '../constants/dailyReport'
import { MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { ROOM_PAGE_CONFIGS, type RoomSourceCardConfig, type RoomSourceKind } from '../constants/roomPages'
import { DASHBOARD_ROUTES } from '../constants/routes'
import {
  EIGHT_SLEEP_MODAL_TABS,
  HUMIDIFIER_MODAL_TABS,
  MEDIA_REMOTE_MODAL_TABS,
  RECIPE_DETAIL_TABS,
  SCAN_ITEM_STEPS,
  SLEEPYPOD_MODAL_TABS,
  THERMOSTAT_MODAL_TABS,
  VACUUM_MODAL_TABS,
  WEATHER_HOURLY_MODES,
} from '../constants/surfaceSemantics'
import { roomCardFamilyArticleId } from './roomCardFamilies'
import type { ManualSurface } from './types'

export const CANONICAL_SURFACE_KINDS = [
  'component',
  'detail-page',
  'floating-action',
  'modal-destination',
  'modal-tab',
  'native-prompt',
  'option-picker',
  'page-section',
  'stateful-control',
  'wizard-step',
] as const

export type CanonicalSurfaceKind = (typeof CANONICAL_SURFACE_KINDS)[number]
export type CanonicalSurfaceInteraction = 'direct-action' | 'display' | 'open'

export interface CanonicalSurfaceDefinition {
  destinationId?: string
  id: string
  implementation: string
  interaction: CanonicalSurfaceInteraction
  kind: CanonicalSurfaceKind
  openerFamilyIds?: readonly string[]
  ownerArticleId: string
  parentId?: string
  routes: readonly string[]
  screenshotPolicy: ManualSurface['screenshotPolicy']
  screenshotPolicyReason?: string
  sourceReference: string
  visibleName: string
}

const FOOD_INVENTORY_ROUTES = ['all-food', 'pantry', 'fridge', 'freezer', 'spice-rack', 'cabinet'] as const
const FOOD_SCAN_ROUTES = ['food', 'kitchen', ...FOOD_INVENTORY_ROUTES] as const
const DONETICK_ROUTES = ['chores', 'stephens-chores', 'stephs-chores', 'unassigned-chores', 'home-improvement-chores'] as const
const ROOM_ROUTES = Object.values(ROOM_PAGE_CONFIGS).map((room) => room.path)
const ALL_ROUTES = DASHBOARD_ROUTES.map((route) => route.path)

function roomModalRoutes(kind: RoomSourceKind) {
  return Object.values(ROOM_PAGE_CONFIGS)
    .filter((room) => [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
      .some((card) => card.kind === kind && Boolean(card.hash)))
    .map((room) => room.path)
}

const ROOM_MODAL_DESTINATION_BY_KIND: Partial<Record<RoomSourceKind, string>> = {
  air: 'room.air-sheet',
  appliance: 'room.dishwasher-sheet',
  climate: 'room.climate-sheet',
  contact: 'room.contact-sheet',
  grill: 'room.grill-sheet',
  humidifier: 'room.humidifier-sheet',
  light: 'room.light-sheet',
  media: 'media.remote-sheet',
  occupancy: 'room.occupancy-sheet',
  vacuum: 'cleaning.vacuum-sheet',
  vent: 'room.vent-sheet',
}

export function roomCardModalDestinationId(card: RoomSourceCardConfig) {
  if (!card.hash) return undefined
  if (card.kind === 'climate' && card.entityId.split('.', 1)[0] === 'climate' && card.entityId.includes('sleepypod_')) return 'room.sleepypod-sheet'
  return ROOM_MODAL_DESTINATION_BY_KIND[card.kind]
}

const HASH_DESTINATION_IDS: Readonly<Record<string, string>> = {
  '#aqi-overview': 'home.air-quality-sheet',
  '#climate-overview': 'home.climate-sheet',
  '#contact-sensors-overview': 'home.contact-sensors-sheet',
  '#guest-presence-security': 'security.guest-presence-sheet',
  '#lights-overview': 'home.lights-sheet',
  '#occupancy-overview': 'home.occupancy-sheet',
  '#security-system': 'security.system-sheet',
}

export function configuredHashDestinationId(hash: string) {
  return HASH_DESTINATION_IDS[hash]
}

function definition(
  id: string,
  kind: CanonicalSurfaceKind,
  visibleName: string,
  ownerArticleId: string,
  routes: readonly string[],
  implementation: string,
  sourceReference: string,
  options: Partial<Pick<CanonicalSurfaceDefinition, 'destinationId' | 'interaction' | 'openerFamilyIds' | 'parentId' | 'screenshotPolicy' | 'screenshotPolicyReason'>> = {},
): CanonicalSurfaceDefinition {
  const screenshotPolicy = options.screenshotPolicy
    ?? (kind === 'modal-destination' || kind === 'modal-tab' || kind === 'option-picker'
      ? 'modal'
      : kind === 'detail-page'
        ? 'detail'
        : kind === 'wizard-step'
          ? 'wizard'
          : kind === 'floating-action'
            ? 'focused'
            : kind === 'stateful-control'
              ? 'state'
              : 'none')
  return {
    id,
    implementation,
    interaction: options.interaction ?? (kind === 'floating-action' || kind === 'native-prompt' || kind === 'option-picker' ? 'open' : 'display'),
    kind,
    ownerArticleId,
    routes,
    screenshotPolicy,
    ...(screenshotPolicy === 'none'
      ? { screenshotPolicyReason: options.screenshotPolicyReason ?? 'This semantic surface has no stable standalone visual state beyond its documented parent surface.' }
      : {}),
    sourceReference,
    visibleName,
    ...(options.destinationId ? { destinationId: options.destinationId } : {}),
    ...(options.openerFamilyIds ? { openerFamilyIds: options.openerFamilyIds } : {}),
    ...(options.parentId ? { parentId: options.parentId } : {}),
  }
}

function modalTabDefinitions({
  ownerArticleId,
  parentId,
  prefix,
  routes,
  sourceReference,
  tabs,
}: {
  ownerArticleId: string
  parentId: string
  prefix: string
  routes: readonly string[]
  sourceReference: string
  tabs: readonly { label: string; tab: string }[]
}) {
  return tabs.map((tab) => definition(
    `${prefix}-${tab.tab}`,
    'modal-tab',
    tab.label,
    ownerArticleId,
    routes,
    `${parentId} ${tab.label} content`,
    `${sourceReference}.${tab.tab}`,
    { parentId },
  ))
}

const FOUNDATIONAL_SURFACES: CanonicalSurfaceDefinition[] = [
  definition('start.navigation', 'component', 'App navigation', 'app-layout', ['overview', 'security', 'ecobee', 'chores', 'settings'], 'AppHeader, BottomNav, Page', 'src/components/shell/AppHeader.tsx#AppHeader', { screenshotPolicy: 'overview' }),
  definition('home.status-rail', 'page-section', 'Home status chips', 'status-chips', ['overview'], 'StatusRail with OVERVIEW_STATUS_CHIPS', 'src/components/hass/StatusRail.tsx#StatusRail', { parentId: 'route:overview', screenshotPolicy: 'focused' }),
  definition('food.suggested-recipes', 'page-section', 'Suggested Recipes', 'recipes', ['food'], 'FoodHubPage, SuggestedRecipeCarousel, RecipeCard', 'src/pages/FoodHubPage.tsx#section-suggested-recipes', { parentId: 'route:food', screenshotPolicy: 'overview' }),
]

const MODAL_DESTINATIONS: CanonicalSurfaceDefinition[] = [
  definition('home.weather-sheet', 'modal-destination', 'Weather', 'weather-surface-guide', ['overview'], 'WeatherSummary and WeatherForecastSheet', 'src/components/hass/WeatherSummary.tsx#WeatherSummary', { openerFamilyIds: ['weather-hero'] }),
  definition('home.lights-sheet', 'modal-destination', 'Lights overview', 'status-lights', ['overview'], 'LightsSheet overview', 'src/pages/AtAGlancePage.tsx#LightsSheet', { openerFamilyIds: ['overview-status-chips'] }),
  definition('home.climate-sheet', 'modal-destination', 'Climate overview', 'status-chips', ['overview'], 'ClimateSheet overview', 'src/pages/AtAGlancePage.tsx#ClimateSheet', { openerFamilyIds: ['overview-status-chips'] }),
  definition('home.occupancy-sheet', 'modal-destination', 'Occupancy overview', 'status-chips', ['overview'], 'OccupancySheet overview', 'src/pages/AtAGlancePage.tsx#OccupancySheet', { openerFamilyIds: ['overview-status-chips'] }),
  definition('home.contact-sensors-sheet', 'modal-destination', 'Contact Sensors overview', 'status-chips', ['overview', 'security'], 'ContactSheet overview', 'src/pages/AtAGlancePage.tsx#ContactSheet', { openerFamilyIds: ['overview-status-chips', 'security-status-chips'] }),
  definition('home.air-quality-sheet', 'modal-destination', 'Air Quality overview', 'status-chips', ['overview'], 'AirQualitySheet', 'src/pages/AtAGlancePage.tsx#AirQualitySheet', { openerFamilyIds: ['overview-status-chips'] }),
  definition('security.system-sheet', 'modal-destination', 'Security System', 'security-system-modes', ['overview', 'security'], 'SecurityControls in ModalSheet', 'src/components/hass/SecurityControls.tsx#SecurityControls', { openerFamilyIds: ['overview-security-tile', 'overview-status-chips', 'security-status-chips', 'security-system-tile'] }),
  definition('security.guest-presence-sheet', 'modal-destination', 'Guest Presence Security', 'guest-controls-page-guide', ['overview', 'security'], 'GuestPresenceSecurityModalContent', 'src/components/hass/GuestPresenceSecurity.tsx#GuestPresenceSecurityModalContent', { openerFamilyIds: ['guest-presence-security'] }),
  definition('security.camera-controls', 'modal-destination', 'Security camera controls', 'security-cameras', ['overview', 'security'], 'CameraTile, CameraModalContent, WebRtcCamera', 'src/components/hass/CameraModalContent.tsx#CameraModalContent', { openerFamilyIds: ['camera-tiles'], screenshotPolicy: 'focused' }),
  definition('rooms.picker-sheet', 'modal-destination', 'Rooms picker', 'rooms-picker-guide', ['overview', ...ROOM_ROUTES], 'RoomPickerButton and ModalSheet', 'src/pages/AtAGlancePage.tsx#RoomPickerButton', { openerFamilyIds: ['rooms-floating-action'] }),
  definition('room.air-sheet', 'modal-destination', 'Room air purifier sheet', roomCardFamilyArticleId('air'), roomModalRoutes('air'), 'AirQualityModalContent', 'src/components/hass/AirQualityModalContent.tsx#AirQualityModalContent', { openerFamilyIds: ['room-source-cards', 'room-status-chips'] }),
  definition('room.dishwasher-sheet', 'modal-destination', 'Dishwasher sheet', roomCardFamilyArticleId('appliance'), roomModalRoutes('appliance'), 'DishwasherModalContent', 'src/pages/DashboardViewPage.tsx#DishwasherModalContent', { openerFamilyIds: ['room-source-cards'] }),
  definition('room.climate-sheet', 'modal-destination', 'Room climate sheet', roomCardFamilyArticleId('climate'), roomModalRoutes('climate'), 'ClimateSheet direct room mode', 'src/pages/AtAGlancePage.tsx#ClimateSheet', { openerFamilyIds: ['room-source-cards', 'room-status-chips'] }),
  definition('room.sleepypod-sheet', 'modal-destination', 'SleepyPod side sheet', 'wake-alarms', ['master-bedroom'], 'EightSleepBedModal', 'src/pages/DashboardViewPage.tsx#EightSleepBedModal', { openerFamilyIds: ['room-source-cards'] }),
  definition('climate.sleepypod-temperature-scope-prompt', 'modal-destination', 'Set Bed Temperature scope prompt', 'wake-alarms', ['master-bedroom'], 'BedTemperatureScopePrompt', 'src/components/hass/BedTemperatureScopePrompt.tsx#BedTemperatureScopePrompt', { parentId: 'room.sleepypod-sheet' }),
  definition('room.contact-sheet', 'modal-destination', 'Room contact sheet', roomCardFamilyArticleId('contact'), roomModalRoutes('contact'), 'ContactSheet direct room mode', 'src/pages/AtAGlancePage.tsx#ContactSheet', { openerFamilyIds: ['room-source-cards', 'room-status-chips'] }),
  definition('room.grill-sheet', 'modal-destination', 'Bear Grills sheet', roomCardFamilyArticleId('grill'), roomModalRoutes('grill'), 'GrillModalContent', 'src/components/hass/GrillModalContent.tsx#GrillModalContent', { openerFamilyIds: ['room-source-cards'] }),
  definition('room.humidifier-sheet', 'modal-destination', 'Humidifier sheet', 'humidifier-schedule', roomModalRoutes('humidifier'), 'HumidifierModal', 'src/components/hass/HumidifierModalContent.tsx#HumidifierModal', { openerFamilyIds: ['room-source-cards'] }),
  definition('room.light-sheet', 'modal-destination', 'Room lights sheet', roomCardFamilyArticleId('light'), roomModalRoutes('light'), 'LightsSheet direct room mode', 'src/pages/AtAGlancePage.tsx#LightsSheet', { openerFamilyIds: ['room-source-cards', 'room-status-chips'] }),
  definition('media.remote-sheet', 'modal-destination', 'Media remote sheet', 'media-page-guide', ['media', 'living-room', 'master-bedroom', 'theater-room'], 'MediaRemoteModalContent and MediaRemoteModalNav', 'src/components/hass/MediaRemoteModalContent.tsx#MediaRemoteModalContent', { openerFamilyIds: ['media-page-remotes', 'room-source-cards'] }),
  definition('room.occupancy-sheet', 'modal-destination', 'Room occupancy sheet', roomCardFamilyArticleId('occupancy'), roomModalRoutes('occupancy'), 'OccupancySheet direct room mode', 'src/pages/AtAGlancePage.tsx#OccupancySheet', { openerFamilyIds: ['room-source-cards', 'room-status-chips'] }),
  definition('cleaning.vacuum-sheet', 'modal-destination', 'Robot vacuum sheet', 'vacuums-page-guide', ['vacuums', 'living-room', 'music-room', 'theater-room'], 'VacuumModal', 'src/components/hass/VacuumCard.tsx#VacuumModal', { openerFamilyIds: ['room-source-cards', 'vacuum-page-cards'] }),
  definition('room.vent-sheet', 'modal-destination', 'Room vent sheet', roomCardFamilyArticleId('vent'), roomModalRoutes('vent'), 'ClimateSheet direct vent mode', 'src/pages/AtAGlancePage.tsx#ClimateSheet', { openerFamilyIds: ['room-source-cards'] }),
  definition('admin.presence-overrides-sheet', 'modal-destination', 'Presence-Based Overrides', 'presence-based-lighting', ['admin'], 'AdminPage presence ModalSheet', 'src/pages/DashboardViewPage.tsx#AdminPage.presenceModal', { openerFamilyIds: ['admin-config-rows'] }),
  definition('admin.presence-auto-reset-sheet', 'modal-destination', 'Presence-Based Overrides Auto-Reset', 'presence-based-lighting', ['admin'], 'AdminPage auto-reset ModalSheet', 'src/pages/DashboardViewPage.tsx#AdminPage.autoResetModal', { openerFamilyIds: ['admin-config-rows'] }),
  definition('climate.thermostat-controls-sheet', 'modal-destination', 'Thermostat controls', 'thermostat-controls-guide', ['ecobee'], 'ThermostatModal', 'src/pages/DashboardViewPage.tsx#ThermostatModal', { openerFamilyIds: ['thermostat-controls'] }),
  definition('custom-lights.detail-sheet', 'modal-destination', 'Custom light details', 'custom-lights-page-guide', ['custom-lights'], 'LightMoreInfoSheet', 'src/components/hass/LightMoreInfoSheet.tsx#LightMoreInfoSheet', { openerFamilyIds: ['custom-light-details'] }),
  definition('vacation.confirmation-sheet', 'modal-destination', 'Confirm Vacation', 'vacation-page-guide', ['vacation'], 'VacationConfirmationModal', 'src/pages/DashboardViewPage.tsx#VacationConfirmationModal', { openerFamilyIds: ['vacation-mode-confirmation'] }),
  definition('food.inventory-detail-sheet', 'modal-destination', 'Inventory item details', 'food-inventory', FOOD_INVENTORY_ROUTES, 'InventoryItemDetailsModal and EverShelfInventoryDetailsPage', 'src/components/hass/EverShelfInventoryPanel.tsx#InventoryItemDetailsModal', { openerFamilyIds: ['inventory-multi-item-row', 'inventory-single-item-edit'] }),
  definition('food.recipe-detail', 'modal-destination', 'Recipe Details', 'recipes', ['food', 'recipes'], 'RecipeDetailModal', 'src/components/hass/recipes/RecipeDetailModal.tsx#RecipeDetailModal', { openerFamilyIds: ['recipe-cards'] }),
  definition('chores.donetick-task-sheet', 'modal-destination', 'Create or Edit Task', 'chore-scheduling', DONETICK_ROUTES, 'CreateDonetickTaskSheet and DonetickTaskFormPage', 'src/components/hass/CreateDonetickTaskSheet.tsx#CreateDonetickTaskSheet', { openerFamilyIds: ['chore-row-edit', 'create-task-floating-actions'] }),
  definition('groceries.add-item-sheet', 'modal-destination', 'Add Grocery Item', 'groceries-page-guide', ['groceries', 'grocery-list'], 'CreateGroceryItemSheet', 'src/components/hass/CreateGroceryItemSheet.tsx#CreateGroceryItemSheet', { openerFamilyIds: ['grocery-floating-actions'] }),
  definition('admin.add-todo-sheet', 'modal-destination', 'Add Admin Task', 'to-do-page-guide', ['to-do'], 'CreateTodoItemSheet', 'src/components/hass/CreateTodoItemSheet.tsx#CreateTodoItemSheet', { openerFamilyIds: ['admin-task-floating-action'] }),
  definition('food.scan-item-sheet', 'modal-destination', 'Add Item scanner', 'food-scanning', FOOD_SCAN_ROUTES, 'ScanItemCameraSheet', 'src/components/hass/ScanItemCameraSheet.tsx#ScanItemCameraSheet', { openerFamilyIds: ['scan-floating-actions'] }),
  definition('food.inventory-sort-sheet', 'modal-destination', 'Sort Inventory', 'food-inventory', FOOD_INVENTORY_ROUTES, 'InventorySortSheet', 'src/components/hass/EverShelfInventoryPanel.tsx#InventorySortSheet', { openerFamilyIds: ['inventory-sort-floating-actions'] }),
  definition('food.inventory-filter-sheet', 'modal-destination', 'Filter Inventory', 'food-inventory', FOOD_INVENTORY_ROUTES, 'InventoryFilterSheet', 'src/components/hass/EverShelfInventoryPanel.tsx#InventoryFilterSheet', { openerFamilyIds: ['inventory-filter-floating-actions'] }),
  definition('chores.daily-report-sheet', 'modal-destination', 'Daily Report', 'daily-report', ALL_ROUTES, 'DailyReportModal', 'src/components/hass/DailyReportModal.tsx#DailyReportModal', { openerFamilyIds: ['daily-report-profile'] }),
  definition('food.recipe-sort-sheet', 'modal-destination', 'Sort Recipes', 'recipes', ['recipes'], 'RecipeSortSheet', 'src/components/hass/recipes/RecipeFloatingActions.tsx#RecipeSortSheet', { openerFamilyIds: ['recipe-sort-filter-floating-actions'] }),
  definition('food.recipe-filter-sheet', 'modal-destination', 'Filter Recipes', 'recipes', ['recipes'], 'RecipeFilterSheet', 'src/components/hass/recipes/RecipeFloatingActions.tsx#RecipeFilterSheet', { openerFamilyIds: ['recipe-sort-filter-floating-actions'] }),
]

const MODAL_TABS: CanonicalSurfaceDefinition[] = [
  ...modalTabDefinitions({
    ownerArticleId: 'weather-surface-guide',
    parentId: 'home.weather-sheet',
    prefix: 'home.weather-mode',
    routes: ['overview'],
    sourceReference: 'src/constants/surfaceSemantics.ts#WEATHER_HOURLY_MODES',
    tabs: WEATHER_HOURLY_MODES,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'media-page-guide',
    parentId: 'media.remote-sheet',
    prefix: 'media.remote-tab',
    routes: ['media', 'living-room', 'master-bedroom', 'theater-room'],
    sourceReference: 'src/constants/surfaceSemantics.ts#MEDIA_REMOTE_MODAL_TABS',
    tabs: MEDIA_REMOTE_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'vacuums-page-guide',
    parentId: 'cleaning.vacuum-sheet',
    prefix: 'cleaning.vacuum-tab',
    routes: ['vacuums', 'living-room', 'music-room', 'theater-room'],
    sourceReference: 'src/constants/surfaceSemantics.ts#VACUUM_MODAL_TABS',
    tabs: VACUUM_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'humidifier-schedule',
    parentId: 'room.humidifier-sheet',
    prefix: 'climate.humidifier-tab',
    routes: ['master-bedroom'],
    sourceReference: 'src/constants/surfaceSemantics.ts#HUMIDIFIER_MODAL_TABS',
    tabs: HUMIDIFIER_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'wake-alarms',
    parentId: 'room.sleepypod-sheet',
    prefix: 'climate.eight-sleep-tab',
    routes: ['master-bedroom'],
    sourceReference: 'src/constants/surfaceSemantics.ts#EIGHT_SLEEP_MODAL_TABS',
    tabs: EIGHT_SLEEP_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'wake-alarms',
    parentId: 'room.sleepypod-sheet',
    prefix: 'climate.sleepypod-tab',
    routes: ['master-bedroom'],
    sourceReference: 'src/constants/surfaceSemantics.ts#SLEEPYPOD_MODAL_TABS',
    tabs: SLEEPYPOD_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'thermostat-controls-guide',
    parentId: 'climate.thermostat-controls-sheet',
    prefix: 'climate.thermostat-tab',
    routes: ['ecobee'],
    sourceReference: 'src/constants/surfaceSemantics.ts#THERMOSTAT_MODAL_TABS',
    tabs: THERMOSTAT_MODAL_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'daily-report',
    parentId: 'chores.daily-report-sheet',
    prefix: 'chores.daily-report-tab',
    routes: ALL_ROUTES,
    sourceReference: 'src/constants/dailyReport.ts#DAILY_REPORT_TABS',
    tabs: DAILY_REPORT_TABS,
  }),
  ...modalTabDefinitions({
    ownerArticleId: 'recipes',
    parentId: 'food.recipe-detail',
    prefix: 'food.recipe-detail',
    routes: ['food', 'recipes'],
    sourceReference: 'src/constants/surfaceSemantics.ts#RECIPE_DETAIL_TABS',
    tabs: RECIPE_DETAIL_TABS,
  }),
]

const DETAIL_PAGES: CanonicalSurfaceDefinition[] = [
  definition('home.lights-room-detail', 'detail-page', 'Room light detail', 'status-lights', ['overview'], 'LightsSheet selectedGroup detail', 'src/pages/AtAGlancePage.tsx#LightsSheet.selectedGroup', { parentId: 'home.lights-sheet', screenshotPolicy: 'detail' }),
  definition('home.climate-room-detail', 'detail-page', 'Room climate detail', 'status-chips', ['overview'], 'ClimateSheet selectedGroup detail', 'src/pages/AtAGlancePage.tsx#ClimateSheet.selectedGroup', { parentId: 'home.climate-sheet' }),
  definition('home.occupancy-room-detail', 'detail-page', 'Room occupancy detail', 'status-chips', ['overview'], 'OccupancySheet selectedGroup detail', 'src/pages/AtAGlancePage.tsx#OccupancySheet.selectedGroup', { parentId: 'home.occupancy-sheet' }),
  definition('home.contact-room-detail', 'detail-page', 'Room contact detail', 'status-chips', ['overview', 'security'], 'ContactSheet selectedGroup detail', 'src/pages/AtAGlancePage.tsx#ContactSheet.selectedGroup', { parentId: 'home.contact-sensors-sheet' }),
  definition('settings.presence-detail', 'detail-page', 'Presence lighting room detail', 'presence-based-lighting', ['admin'], 'PresenceOverrideDetailPage', 'src/components/hass/PresenceOverrideCard.tsx#PresenceOverrideDetailPage', { parentId: 'admin.presence-overrides-sheet' }),
  definition('climate.thermostat-room-detail', 'detail-page', 'Room thermostat detail', 'thermostat-controls-guide', ['ecobee'], 'ThermostatRoomModalContent in ThermostatModal', 'src/pages/DashboardViewPage.tsx#ThermostatRoomModalContent', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-room-rows'] }),
  definition('climate.predictive-comfort-detail', 'detail-page', 'Predictive Comfort', 'thermostat-controls-guide', ['ecobee'], 'PredictiveComfortModalContent in ThermostatModal', 'src/pages/DashboardViewPage.tsx#PredictiveComfortModalContent', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['predictive-comfort'] }),
  definition('climate.eco-critical-tracking-detail', 'detail-page', 'Eco Mode Critical Tracking', 'thermostat-controls-guide', ['ecobee'], 'ThermostatOptionDetailPage eco-critical', 'src/pages/DashboardViewPage.tsx#ThermostatOptionDetailPage.eco-critical', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-option-pages'] }),
  definition('climate.eco-away-behavior-detail', 'detail-page', 'Eco Behavior When Away', 'thermostat-controls-guide', ['ecobee'], 'ThermostatOptionDetailPage eco-away', 'src/pages/DashboardViewPage.tsx#ThermostatOptionDetailPage.eco-away', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-option-pages'] }),
  definition('climate.tracking-selected-rooms-detail', 'detail-page', 'Selected Rooms', 'thermostat-controls-guide', ['ecobee'], 'ThermostatTrackingDetailPage selected-rooms', 'src/pages/DashboardViewPage.tsx#ThermostatTrackingDetailPage.selected-rooms', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-tracking-rows'] }),
  definition('climate.tracking-critical-protection-detail', 'detail-page', 'Critical Protection', 'thermostat-controls-guide', ['ecobee'], 'ThermostatTrackingDetailPage critical-protection', 'src/pages/DashboardViewPage.tsx#ThermostatTrackingDetailPage.critical-protection', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-tracking-rows'] }),
  definition('climate.tracking-occupied-only-detail', 'detail-page', 'Occupied Only', 'thermostat-controls-guide', ['ecobee'], 'ThermostatTrackingDetailPage occupied-only', 'src/pages/DashboardViewPage.tsx#ThermostatTrackingDetailPage.occupied-only', { destinationId: 'climate.thermostat-controls-sheet', parentId: 'climate.thermostat-controls-sheet', openerFamilyIds: ['thermostat-tracking-rows'] }),
  definition('climate.humidifier-schedule-editor', 'detail-page', 'Humidifier activity editor', 'humidifier-schedule', ['master-bedroom'], 'HumidifierModal activityPage', 'src/components/hass/HumidifierModalContent.tsx#activityPage', { parentId: 'room.humidifier-sheet' }),
  definition('cleaning.vacuum-area-editor', 'detail-page', 'Vacuum area editor', 'vacuum-area-cleaning', ['vacuums', 'living-room', 'music-room', 'theater-room'], 'VacuumModal area editor', 'src/components/hass/VacuumCard.tsx#areaEditorOpen', { parentId: 'cleaning.vacuum-sheet' }),
  definition('climate.sleepypod-alarm-day', 'detail-page', 'SleepyPod alarm day', 'wake-alarms', ['master-bedroom'], 'EightSleepBedModal alarm day page', 'src/pages/DashboardViewPage.tsx#EightSleepAlarmDetailPage.day', { parentId: 'room.sleepypod-sheet' }),
  definition('climate.sleepypod-alarm-editor', 'detail-page', 'SleepyPod alarm editor', 'wake-alarms', ['master-bedroom'], 'EightSleepBedModal alarm editor page', 'src/pages/DashboardViewPage.tsx#EightSleepAlarmDetailPage.editor', { parentId: 'room.sleepypod-sheet' }),
  definition('media.remote-text-prompt', 'detail-page', 'Text to send', 'media-page-guide', ['media', 'living-room', 'theater-room'], 'MediaRemoteModalContent TextPrompt', 'src/components/hass/MediaRemoteModalContent.tsx#TextPrompt', { parentId: 'media.remote-sheet' }),
  definition('chores.daily-report-task-detail', 'detail-page', 'Daily Report task editor', 'daily-report', ALL_ROUTES, 'DonetickTaskFormBody in DailyReportModal', 'src/components/hass/DailyReportModal.tsx#editingTaskPage', { parentId: 'chores.daily-report-sheet' }),
  definition('food.daily-report-inventory-detail', 'detail-page', 'Daily Report inventory detail', 'daily-report', ALL_ROUTES, 'EverShelfInventoryDetailsPage in DailyReportModal', 'src/components/hass/DailyReportModal.tsx#editingInventoryPage', { parentId: 'chores.daily-report-sheet' }),
  definition('food.inventory-single-detail', 'detail-page', 'Single inventory instance detail', 'food-inventory', FOOD_INVENTORY_ROUTES, 'EverShelfInventoryDetailsPage single batch', 'src/components/hass/EverShelfInventoryPanel.tsx#EverShelfInventoryDetailsPage.single-batch', { parentId: 'food.inventory-detail-sheet' }),
  definition('food.inventory-grouped-detail', 'detail-page', 'Grouped inventory instance detail', 'food-inventory', FOOD_INVENTORY_ROUTES, 'EverShelfInventoryDetailsPage multiple batches', 'src/components/hass/EverShelfInventoryPanel.tsx#EverShelfInventoryDetailsPage.multipleBatches', { parentId: 'food.inventory-detail-sheet' }),
]

const WIZARD_STEPS: CanonicalSurfaceDefinition[] = SCAN_ITEM_STEPS.map((step) => definition(
  step.step === 'review' ? 'food.scan-review' : `food.scan-${step.step}`,
  'wizard-step',
  `${step.label} step`,
  'food-scanning',
  FOOD_SCAN_ROUTES,
  `ScanItemCameraSheet ${step.label} step`,
  `src/constants/surfaceSemantics.ts#SCAN_ITEM_STEPS.${step.step}`,
  { parentId: 'food.scan-item-sheet', screenshotPolicy: step.step === 'review' ? 'wizard' : 'none' },
))

const FLOATING_ACTIONS: CanonicalSurfaceDefinition[] = [
  definition('floating-action.rooms', 'floating-action', 'Rooms', 'rooms-picker-guide', ['overview', ...ROOM_ROUTES], 'RoomPickerButton through FloatingActionButton', 'src/pages/AtAGlancePage.tsx#RoomPickerButton', { destinationId: 'rooms.picker-sheet', openerFamilyIds: ['rooms-floating-action'] }),
  definition('floating-action.create-task', 'floating-action', 'Add Task', 'chore-scheduling', DONETICK_ROUTES, 'CreateChoreButton through FloatingActionButton', 'src/components/shell/DashboardFloatingAction.tsx#CreateChoreButton', { destinationId: 'chores.donetick-task-sheet', openerFamilyIds: ['create-task-floating-actions'] }),
  definition('floating-action.add-groceries', 'floating-action', 'Add Groceries', 'groceries-page-guide', ['groceries', 'grocery-list'], 'CreateGroceryButton through FloatingActionButton', 'src/components/shell/DashboardFloatingAction.tsx#CreateGroceryButton', { destinationId: 'groceries.add-item-sheet', openerFamilyIds: ['grocery-floating-actions'] }),
  definition('floating-action.add-admin-task', 'floating-action', 'Add Task', 'to-do-page-guide', ['to-do'], 'CreateAdminTodoButton through FloatingActionButton', 'src/components/shell/DashboardFloatingAction.tsx#CreateAdminTodoButton', { destinationId: 'admin.add-todo-sheet', openerFamilyIds: ['admin-task-floating-action'] }),
  definition('floating-action.scan-item', 'floating-action', 'Scan Item', 'food-scanning', FOOD_SCAN_ROUTES, 'ScanItemButton through FloatingActionButton', 'src/components/shell/DashboardFloatingAction.tsx#ScanItemButton', { destinationId: 'food.scan-item-sheet', openerFamilyIds: ['scan-floating-actions'] }),
  definition('floating-action.inventory-search', 'floating-action', 'Search inventory', 'food-inventory', FOOD_INVENTORY_ROUTES, 'InventorySearchAction through ExpandingSearchAction', 'src/components/hass/EverShelfInventoryPanel.tsx#InventorySearchAction', { interaction: 'direct-action' }),
  definition('floating-action.inventory-sort', 'floating-action', 'Sort inventory', 'food-inventory', FOOD_INVENTORY_ROUTES, 'EverShelfInventoryFloatingActions', 'src/components/hass/EverShelfInventoryPanel.tsx#EverShelfInventoryFloatingActions.sort', { destinationId: 'food.inventory-sort-sheet', openerFamilyIds: ['inventory-sort-floating-actions'] }),
  definition('floating-action.inventory-filter', 'floating-action', 'Filter inventory', 'food-inventory', FOOD_INVENTORY_ROUTES, 'EverShelfInventoryFloatingActions', 'src/components/hass/EverShelfInventoryPanel.tsx#EverShelfInventoryFloatingActions.filter', { destinationId: 'food.inventory-filter-sheet', openerFamilyIds: ['inventory-filter-floating-actions'] }),
  definition('floating-action.recipe-search', 'floating-action', 'Search recipes', 'recipes', ['recipes'], 'RecipeFloatingActions ExpandingSearchAction', 'src/components/hass/recipes/RecipeFloatingActions.tsx#RecipeFloatingActions.search', { interaction: 'direct-action' }),
  definition('floating-action.recipe-sort', 'floating-action', 'Sort recipes', 'recipes', ['recipes'], 'RecipeFloatingActions', 'src/components/hass/recipes/RecipeFloatingActions.tsx#RecipeFloatingActions.sort', { destinationId: 'food.recipe-sort-sheet', openerFamilyIds: ['recipe-sort-filter-floating-actions'] }),
  definition('floating-action.recipe-filter', 'floating-action', 'Filter recipes', 'recipes', ['recipes'], 'RecipeFloatingActions', 'src/components/hass/recipes/RecipeFloatingActions.tsx#RecipeFloatingActions.filter', { destinationId: 'food.recipe-filter-sheet', openerFamilyIds: ['recipe-sort-filter-floating-actions'] }),
]

const OPTION_PICKERS: CanonicalSurfaceDefinition[] = [
  definition('option-picker.thermostat-hub-mode', 'option-picker', 'Thermostat Hub Mode', 'thermostat-page-guide', ['ecobee'], 'ThermostatSelectButton', 'src/pages/DashboardViewPage.tsx#ThermostatHubPill', { openerFamilyIds: ['thermostat-option-pickers'], parentId: 'route:ecobee' }),
  definition('option-picker.thermostat-hub-fan', 'option-picker', 'Thermostat Hub Fan', 'thermostat-page-guide', ['ecobee'], 'ThermostatSelectButton', 'src/pages/DashboardViewPage.tsx#ThermostatHubPill', { openerFamilyIds: ['thermostat-option-pickers'], parentId: 'route:ecobee' }),
  definition('option-picker.custom-light-mode', 'option-picker', 'Lighting Mode', 'custom-lights-page-guide', ['custom-lights'], 'ModeToggleCard and OptionPickerDialog', 'src/pages/CustomLightsPage.tsx#ModeToggleCard', { openerFamilyIds: ['custom-light-mode-picker'], parentId: 'route:custom-lights' }),
]

const NATIVE_PROMPTS: CanonicalSurfaceDefinition[] = [
  definition('native-prompt.vacation-date-time', 'native-prompt', 'Vacation date and time pickers', 'native-inputs-and-prompts', ['vacation'], 'NativePickerField', 'src/pages/DashboardViewPage.tsx#VacationDateControls', { openerFamilyIds: ['native-date-time-controls'], parentId: 'vacation.confirmation-sheet' }),
  definition('native-prompt.donetick-due-date-time', 'native-prompt', 'Task due date and time pickers', 'native-inputs-and-prompts', DONETICK_ROUTES, 'NativePickerField', 'src/components/hass/DonetickTaskFormPage.tsx#DonetickTaskFormBody', { openerFamilyIds: ['native-date-time-controls'], parentId: 'chores.donetick-task-sheet' }),
  definition('native-prompt.humidifier-schedule-time', 'native-prompt', 'Humidifier schedule time pickers', 'native-inputs-and-prompts', ['master-bedroom'], 'ScheduleEditorFields time controls', 'src/components/core/ScheduleEditorFields.tsx#timeFields', { openerFamilyIds: ['native-date-time-controls'], parentId: 'climate.humidifier-schedule-editor' }),
  definition('native-prompt.sleepypod-schedule-time', 'native-prompt', 'SleepyPod schedule and alarm time pickers', 'native-inputs-and-prompts', ['master-bedroom'], 'SleepyPod time inputs and alarm editor', 'src/pages/DashboardViewPage.tsx#EightSleepBedtimeSetting', { openerFamilyIds: ['native-date-time-controls'], parentId: 'room.sleepypod-sheet' }),
  definition('native-prompt.scan-expiry-date', 'native-prompt', 'Scan item expiration date picker', 'native-inputs-and-prompts', FOOD_SCAN_ROUTES, 'NativePickerField', 'src/components/hass/ScanItemCameraSheet.tsx#ExpirationDate', { openerFamilyIds: ['native-date-time-controls'], parentId: 'food.scan-item-sheet' }),
  definition('native-prompt.inventory-expiry-date', 'native-prompt', 'Inventory expiration date picker', 'native-inputs-and-prompts', FOOD_INVENTORY_ROUTES, 'NativePickerField', 'src/components/hass/EverShelfInventoryPanel.tsx#EverShelfInventoryDetailsPage', { openerFamilyIds: ['native-date-time-controls'], parentId: 'food.inventory-detail-sheet' }),
  definition('native-prompt.sleepypod-power-off-confirmation', 'native-prompt', 'SleepyPod power-off confirmation', 'native-inputs-and-prompts', ['master-bedroom'], 'window.confirm', 'src/pages/DashboardViewPage.tsx#toggleSidePower', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'room.sleepypod-sheet' }),
  definition('native-prompt.sleepypod-alarm-delete-confirmation', 'native-prompt', 'SleepyPod alarm delete confirmation', 'native-inputs-and-prompts', ['master-bedroom'], 'window.confirm', 'src/pages/DashboardViewPage.tsx#deleteAlarm', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'climate.sleepypod-alarm-editor' }),
  definition('native-prompt.donetick-delete-confirmation', 'native-prompt', 'Task delete confirmation', 'native-inputs-and-prompts', DONETICK_ROUTES, 'window.confirm', 'src/components/hass/useDonetickTaskForm.ts#handleDelete', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'chores.donetick-task-sheet' }),
  definition('native-prompt.inventory-shopping-quantity', 'native-prompt', 'Inventory shopping quantity prompt', 'native-inputs-and-prompts', FOOD_INVENTORY_ROUTES, 'window.prompt', 'src/components/hass/EverShelfInventoryPanel.tsx#promptShoppingQuantity', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'food.inventory-detail-sheet' }),
  definition('native-prompt.inventory-delete-quantity', 'native-prompt', 'Inventory delete quantity prompt', 'native-inputs-and-prompts', FOOD_INVENTORY_ROUTES, 'window.prompt', 'src/components/hass/EverShelfInventoryPanel.tsx#promptDeleteQuantity', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'food.inventory-detail-sheet' }),
  definition('native-prompt.inventory-prepared-quantity', 'native-prompt', 'Prepared food quantity prompt', 'native-inputs-and-prompts', FOOD_INVENTORY_ROUTES, 'window.prompt', 'src/components/hass/EverShelfInventoryPanel.tsx#promptPreparedQuantity', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'food.inventory-detail-sheet' }),
  definition('native-prompt.inventory-delete-confirmation', 'native-prompt', 'Inventory delete confirmation', 'native-inputs-and-prompts', FOOD_INVENTORY_ROUTES, 'window.confirm', 'src/components/hass/EverShelfInventoryPanel.tsx#deleteBatch', { openerFamilyIds: ['native-confirm-prompt-actions'], parentId: 'food.inventory-detail-sheet' }),
]

const STATEFUL_CONTROLS: CanonicalSurfaceDefinition[] = [
  definition('food.recipe-grocery-add', 'stateful-control', 'Add Missing Ingredients to Groceries', 'recipes', ['food', 'recipes'], 'RecipeDetailModal IngredientsTab', 'src/components/hass/recipes/RecipeDetailModal.tsx#IngredientsTab.groceryAction', { parentId: 'food.recipe-detail-ingredients' }),
]

export const CANONICAL_SURFACE_DEFINITIONS: readonly CanonicalSurfaceDefinition[] = [
  ...FOUNDATIONAL_SURFACES,
  ...MODAL_DESTINATIONS,
  ...MODAL_TABS,
  ...DETAIL_PAGES,
  ...WIZARD_STEPS,
  ...FLOATING_ACTIONS,
  ...OPTION_PICKERS,
  ...NATIVE_PROMPTS,
  ...STATEFUL_CONTROLS,
]

export const MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS = {
  'admin-config-rows': 'admin-page-guide',
  'admin-task-floating-action': 'to-do-page-guide',
  'camera-tiles': 'security-cameras',
  'chore-row-edit': 'chore-scheduling',
  'create-task-floating-actions': 'chore-scheduling',
  'custom-light-details': 'custom-lights-page-guide',
  'custom-light-mode-picker': 'custom-lights-page-guide',
  'daily-report-profile': 'daily-report',
  'grocery-floating-actions': 'groceries-page-guide',
  'guest-presence-security': 'guest-controls-page-guide',
  'inventory-filter-floating-actions': 'food-inventory',
  'inventory-multi-item-row': 'food-inventory',
  'inventory-single-item-edit': 'food-inventory',
  'inventory-sort-floating-actions': 'food-inventory',
  'media-page-remotes': 'media-page-guide',
  'native-confirm-prompt-actions': 'native-inputs-and-prompts',
  'native-date-time-controls': 'native-inputs-and-prompts',
  'overview-route-quick-links': 'home-overview',
  'overview-security-tile': 'security-system-modes',
  'overview-status-chips': 'status-chips',
  'predictive-comfort': 'thermostat-controls-guide',
  'recipe-cards': 'recipes',
  'recipe-sort-filter-floating-actions': 'recipes',
  'room-source-cards': 'room-sheet-navigation-guide',
  'room-status-chips': 'room-sheet-navigation-guide',
  'rooms-floating-action': 'rooms-picker-guide',
  'scan-floating-actions': 'food-scanning',
  'security-status-chips': 'security-page-guide',
  'security-system-tile': 'security-system-modes',
  'thermostat-controls': 'thermostat-controls-guide',
  'thermostat-option-pages': 'thermostat-controls-guide',
  'thermostat-option-pickers': 'thermostat-page-guide',
  'thermostat-room-rows': 'thermostat-controls-guide',
  'thermostat-tracking-rows': 'thermostat-controls-guide',
  'vacation-mode-confirmation': 'vacation-page-guide',
  'vacuum-page-cards': 'vacuums-page-guide',
  'weather-hero': 'weather-surface-guide',
} as const satisfies Record<(typeof MODAL_OPENER_INVENTORY)[number]['id'], string>

export function canonicalSurfaceDefinition(id: string) {
  return CANONICAL_SURFACE_DEFINITIONS.find((surface) => surface.id === id)
}

export function canonicalSurfaceIdsOwnedByArticle(articleId: string) {
  return [
    ...CANONICAL_SURFACE_DEFINITIONS.filter((surface) => surface.ownerArticleId === articleId).map((surface) => surface.id),
    ...Object.entries(MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS)
      .filter(([, ownerArticleId]) => ownerArticleId === articleId)
      .map(([openerFamilyId]) => `modal-opener-family:${openerFamilyId}`),
  ]
}
