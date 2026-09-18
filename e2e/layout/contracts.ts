import { CHAT_LAYOUT_STATES } from '../../src/test/fixtures/chat'

export type ResponsiveCoverage = 'direct' | 'not-applicable' | 'owned'

export interface PlaywrightSpecCoverage {
  area: string
  landscape: ResponsiveCoverage
  landscapeOwner?: string
  note?: string
  safeArea: ResponsiveCoverage
  safeAreaOwner?: string
  spec: string
}

export const PLAYWRIGHT_SPEC_COVERAGE = [
  {
    area: 'Global chat, same-user shared history, deliberate resume, pending state and composer geometry',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'chat-ux.spec.ts',
  },
  {
    area: 'Wake states, shared-frame geometry, scroll ownership, pending outcomes and source navigation',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'wake-light-alarms.spec.ts',
  },
  {
    area: 'Native phone, foldable, tablet and fine-pointer Wake commands and source-editor round trips',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'wake-light-alarms.spec.ts',
    spec: 'wake-light-adaptive-navigation.spec.ts',
  },
  {
    area: 'Fine-pointer Wake editor and accepted-save frame stability',
    landscape: 'owned',
    landscapeOwner: 'wake-light-alarms.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'wake-light-alarms.spec.ts',
    spec: 'wake-light-desktop-responsive.spec.ts',
  },
  {
    area: 'App chat routing through the authenticated household Home MCP endpoint',
    landscape: 'not-applicable',
    note: 'Transport routing has no viewport or safe-area-specific behavior.',
    safeArea: 'not-applicable',
    spec: 'home-mcp.spec.ts',
  },
  {
    area: 'Contract-certified mock page, shell, modal, grid, form, remote, host and preload journeys',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'layout-acceptance.spec.ts',
  },
  {
    area: 'Negative and positive validation-fixture safety and readiness checks',
    landscape: 'not-applicable',
    safeArea: 'not-applicable',
    note: 'Tooling guard tests, not product geometry evidence.',
    spec: 'layout-guards.spec.ts',
  },
  {
    area: 'Native phone, foldable, tablet and fine-pointer navigation, boundaries, rotation and focus',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'adaptive-navigation.spec.ts',
  },
  {
    area: 'Admin relay warning state and modal copy',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'admin-relay-warning.spec.ts',
  },
  {
    area: 'Bathroom fan cards, timers, and services',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'bathroom-fans.spec.ts',
  },
  {
    area: 'Fine-pointer Chores title wrapping',
    landscape: 'not-applicable',
    note: 'Desktop-only geometry is covered by desktop-responsive.spec.ts.',
    safeArea: 'not-applicable',
    spec: 'battery-title-desktop-responsive.spec.ts',
  },
  {
    area: 'Fine-pointer route, navigation, focus, Food, and vacuum behavior',
    landscape: 'direct',
    note: 'Desktop safe-area geometry remains the zero-inset baseline.',
    safeArea: 'not-applicable',
    spec: 'desktop-responsive.spec.ts',
  },
  {
    area: 'Cross-page layout, Chores, Security, media, and regression coverage',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'feedback-regressions.spec.ts',
  },
  {
    area: 'Garage optimistic state and service failures',
    landscape: 'owned',
    landscapeOwner: 'responsive-pages-all.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'garage-doors.spec.ts',
  },
  {
    area: 'Fine-pointer Home hydration without a second loader or lost chrome',
    landscape: 'not-applicable',
    note: 'Desktop-only hydration lifecycle has separate responsive coverage in home-route-hydration.spec.ts.',
    safeArea: 'not-applicable',
    spec: 'home-route-hydration-desktop.spec.ts',
  },
  {
    area: 'Warm Home navigation across phone orientations, tablet, desktop and mounted resize',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'home-route-hydration.spec.ts',
  },
  {
    area: 'Real HAKit iframe replacement lifecycle',
    landscape: 'not-applicable',
    note: 'Subscription lifecycle is geometry-independent.',
    safeArea: 'not-applicable',
    spec: 'iframe-lifecycle-real-hakit.spec.ts',
  },
  {
    area: 'Wrapper and custom-panel iframe disposal lifecycle',
    landscape: 'not-applicable',
    note: 'Host disposal bookkeeping is geometry-independent.',
    safeArea: 'not-applicable',
    spec: 'iframe-lifecycle.spec.ts',
  },
  {
    area: 'Non-room modal landscape chrome, measured tiers, pane layouts, media caps, and portrait rotation',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'landscape-modal-adaptation.spec.ts',
  },
  {
    area: 'Clean-baseline visual parity for every route',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'mobile-parity-all-routes.spec.ts',
  },
  {
    area: 'Named iPhone and Android descriptor geometry smoke',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'mobile-device-smoke.spec.ts',
  },
  {
    area: 'Modal gesture arbitration and dismissal',
    landscape: 'owned',
    landscapeOwner: 'responsive-modals.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'modal-sheet-gestures.spec.ts',
  },
  {
    area: 'Mounted modal open, close, hash, and rapid-reopen lifecycle',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'modal-sheet-lifecycle.spec.ts',
  },
  {
    area: 'Modal animation performance and blur cost',
    landscape: 'not-applicable',
    note: 'Frame timing intentionally runs in one stable geometry.',
    safeArea: 'not-applicable',
    spec: 'modal-sheet-performance.spec.ts',
  },
  {
    area: 'Intent-stable modal geometry, identity resets, loading, details, and rotation',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'modal-geometry-stability.spec.ts',
  },
  {
    area: 'Mounted rotation typography, equal-width tiles, cross-family frames, configured room openers, and every rendered tab',
    landscape: 'direct',
    note: 'Runs in mobile Chromium, fine-pointer Chrome, and opt-in WebKit. Native iOS text inflation and physical display masks still require a real device.',
    safeArea: 'direct',
    spec: 'modal-rotation-regressions.spec.ts',
  },
  {
    area: 'WebKit modal scrolling and touch action',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'modal-sheet-webkit.spec.ts',
  },
  {
    area: 'Dashboard preload I/O invariants',
    landscape: 'not-applicable',
    note: 'Hidden inert preload geometry performs no responsive runtime work.',
    safeArea: 'direct',
    spec: 'preload-inert.spec.ts',
  },
  {
    area: 'Broad functional dashboard, route, modal, and service behavior',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'react-dash.spec.ts',
  },
  {
    area: 'Real HAKit dial semantics and focus',
    landscape: 'not-applicable',
    note: 'Opt-in live-backend semantics are geometry-independent.',
    safeArea: 'not-applicable',
    spec: 'real-hakit-dials.spec.ts',
  },
  {
    area: 'Recipe touch and keyboard focus behavior',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'recipe-keyboard-focus.spec.ts',
  },
  {
    area: 'Per-ingredient add/remove grocery row controls, bulk-action exclusion, and command-stage reopen',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'recipe-ingredient-cart.spec.ts',
  },
  {
    area: 'Exact shell and navigation breakpoints',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'responsive-layout.spec.ts',
  },
  {
    area: 'Physical callsites, landscape opener/kind rows, and literal portrait tile families',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'responsive-modal-inventory.spec.ts',
  },
  {
    area: 'Modal sizes, scroll owners, grids, workspaces, and resizing',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'responsive-modals.spec.ts',
  },
  {
    area: 'All-route canonical viewport and mounted-resize acceptance',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'responsive-pages-all.spec.ts',
  },
  {
    area: 'All-route synthetic insets, phone shapes, modals, and rotation',
    landscape: 'direct',
    safeArea: 'direct',
    spec: 'safe-area-responsive.spec.ts',
  },
  {
    area: 'Sprinkler cards and same-sheet schedule details',
    landscape: 'owned',
    landscapeOwner: 'responsive-modal-inventory.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'sprinklers.spec.ts',
  },
  {
    area: 'Vacuum outcome cards, wrapping, and compact geometries',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'vacuum-outcomes.spec.ts',
  },
  {
    area: 'Vacuum state truthfulness, maps, all viewports, and resizing',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'vacuum-status.spec.ts',
  },
  {
    area: 'Weather carousel complete-page sizing, touch swipes, mouse and keyboard controls',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'safe-area-responsive.spec.ts',
    spec: 'weather-carousel.spec.ts',
  },
  {
    area: 'Opaque backdrop bands, filter-positive controls and mounted geometry',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'modal-backdrop-bands.spec.ts',
  },
  {
    area: 'Weather atmospheric scene shape, original Rain, motion and lifecycle',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'weather-atmosphere-scenes.spec.ts',
  },
  {
    area: 'Weather forecast freshness, missing values and bounded rails',
    landscape: 'owned',
    landscapeOwner: 'layout-acceptance.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'weather-data.spec.ts',
  },
  {
    area: 'Weather atmosphere continuity, backdrop composition and close behavior',
    landscape: 'owned',
    landscapeOwner: 'layout-acceptance.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'weather-modal-rendering.spec.ts',
  },
  {
    area: 'Weather rails, synchronized forecast wind and reduced-motion transitions',
    landscape: 'owned',
    landscapeOwner: 'layout-acceptance.spec.ts',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'weather-motion.spec.ts',
  },
  {
    area: 'Explicit debug scenes, absent preview UI and pressure units/resize geometry',
    landscape: 'direct',
    safeArea: 'owned',
    safeAreaOwner: 'layout-acceptance.spec.ts',
    spec: 'weather-scenes.spec.ts',
  },
] as const satisfies readonly PlaywrightSpecCoverage[]

export const SCENARIO_IDS = ['quick-links', 'chat', 'summary', 'filters', 'recipe-grocery', 'form', 'admin-todo-edit', 'remote', 'vacuum', 'weather', 'navigation', 'host', 'preload', 'wake-room', 'wake-light', 'wake-editor', 'wake-source'] as const
export type ScenarioId = typeof SCENARIO_IDS[number]
export type ContextId = 'touch-chromium' | 'fine-chromium' | 'touch-webkit'
export const CONTEXTS: Record<ContextId, { browser: 'chromium' | 'webkit'; touch: boolean; project: string }> = {
  'touch-chromium': { browser: 'chromium', touch: true, project: 'mobile' },
  'fine-chromium': { browser: 'chromium', touch: false, project: 'desktop' },
  'touch-webkit': { browser: 'webkit', touch: true, project: 'webkit' },
}

export const SURFACE_CONTRACTS: Record<ScenarioId, {
  family: 'modal' | 'page-shell-grid' | 'host' | 'preload'
  states: readonly string[]
  owners: readonly string[]
  legacy: readonly string[]
  question: string
  tabs?: readonly string[]
  readOnlyTerminals?: Readonly<Record<string, string>>
}> = {
  'quick-links': {
    family: 'modal', states: ['root', 'rooms', 'back'],
    tabs: ['^Home Assistant$', '^Quick Links$'],
    owners: ['src/components/shell/GlobalQuickLinksAction', 'src/components/hass/QuickLinkTile', 'src/components/hass/RoomNavigationGrid'],
    legacy: ['responsive-modal-inventory.spec.ts', 'modal-rotation-regressions.spec.ts'],
    question: 'Are text-aware links and left-aligned room tracks readable, with real end clearance and unchanged return geometry?',
  },
  chat: {
    family: 'modal', states: CHAT_LAYOUT_STATES,
    tabs: ['^Home Assistant$', '^Quick Links$'],
    readOnlyTerminals: { settings: '[data-chat-settings="true"]' },
    owners: ['src/components/hass/chat/', 'src/components/hass/LightColorPicker', 'src/components/hass/lightColor', 'src/components/shell/GlobalQuickLinksAction', 'src/i18n/locales/en/modals/chat.json'],
    legacy: ['chat-ux.spec.ts', 'modal-rotation-regressions.spec.ts'],
    question: 'Are roles, genuine pending dots, 14-day history visibility, versioned Chat Settings, embedded room/color/brightness controls and same-sheet custom color details using the shared exterior-light picker clear, with resume warnings, errors, long messages, a usable composer above bottom tabs and one safe scroll owner?',
  },
  summary: {
    family: 'modal', states: ['overdue', 'upcoming', 'expired'],
    tabs: ['^Overdue Chores(?:,|\\s|$)', '^Upcoming Chores(?:,|\\s|$)', '^Expired Food(?:,|\\s|$)'],
    owners: ['src/components/hass/DailyReport', 'src/components/hass/EverShelfInventoryPanel', 'src/constants/dailyReport', 'src/i18n/index.ts', 'src/i18n/locales/en/pages/food.json'],
    legacy: ['modal-rotation-regressions.spec.ts', 'feedback-regressions.spec.ts'],
    question: 'Does the selected incoming Summary content retain readable type and columns on rotation before refreshing a tab?',
  },
  filters: {
    family: 'modal', states: ['choices'],
    owners: ['src/components/hass/recipes/RecipeFloatingActions', 'src/components/core/RadioRow', 'src/components/core/FilterSheetFooter'],
    legacy: ['responsive-modal-inventory.spec.ts', 'recipe-keyboard-focus.spec.ts'],
    question: 'Are filter descriptions readable at the actual column width, and are options and footer usable?',
  },
  'recipe-grocery': {
    family: 'modal', states: ['ready', 'loading', 'success', 'exhausted'],
    tabs: ['^Overview$', '^Ingredients$', '^Instructions$', '^Nutrition$'],
    owners: [
      'src/components/hass/recipes/RecipeDetailModal',
      'src/components/hass/recipes/recipeGroceryState',
      'src/components/hass/recipes/useRecipeDetailModal',
    ],
    legacy: ['recipe-ingredient-cart.spec.ts'],
    question: 'Does the missing-ingredients action retain one stable command area while the button, spinner and success check transition, and does an exhausting individual add hide that command without redundant visible copy until removal restores it?',
  },
  form: {
    family: 'modal', states: ['draft'],
    owners: ['src/components/hass/CreateTodoItemSheet', 'src/components/core/NativePickerField'],
    legacy: ['modal-geometry-stability.spec.ts', 'react-dash.spec.ts'],
    question: 'Does the draft survive resizing, and are input, close and footer controls usable during synthetic keyboard contraction?',
  },
  'admin-todo-edit': {
    family: 'modal',
    states: ['pristine', 'dirty', 'failure'],
    owners: [
      'src/pages/DashboardViewPage.tsx',
      'src/components/hass/TodoListPanel.tsx',
      'src/components/hass/EditTodoItemSheet.tsx',
      'src/components/hass/EditTodoItemSheet.module.css',
      'src/components/hass/adminTodoEdit.ts',
      'src/i18n/locales/en/core.json',
    ],
    legacy: ['feedback-regressions.spec.ts'],
    question: 'Does the Admin To-Do editor open from the mock-backed todo.groceries route, retain pristine and failed drafts, keep Reset and Save aligned in one reachable horizontal footer row across phone portrait/landscape and centered desktop, and preserve overflow and safe-area clearance?',
  },
  remote: {
    family: 'modal', states: ['active'],
    owners: ['src/constants/mediaRemotes', 'src/components/hass/MediaRemote'],
    legacy: ['modal-rotation-regressions.spec.ts', 'react-dash.spec.ts'],
    question: 'Is the complete active direction pad visible without auto-scroll, operable, and unchanged on portrait return?',
  },
  vacuum: {
    family: 'modal', states: ['docked', 'cleaning', 'dock-cleaning', 'resumable', 'low-battery'],
    owners: ['src/components/hass/VacuumCard', 'src/components/hass/vacuumModalRuntime', 'src/components/hass/ValetudoMap', 'src/i18n/locales/en/modals/vacuum.json'],
    legacy: ['vacuum-status.spec.ts', 'modal-rotation-regressions.spec.ts'],
    question: 'Does the fitted vacuum map fill the stationary left pane in short and tall landscape while the right pane scrolls naturally, while runtime-driven minimal states immediately trim tabs, keep Controls non-empty, surface only the active dock stop action, close the area editor, and preserve the correct selected tab?',
  },
  weather: {
    family: 'modal',
    states: ['condition', 'precipitation', 'wind', 'pressure-unavailable', 'pressure-long', 'forecast-error-stale', 'forecast-empty', 'forecast-error-empty'],
    owners: ['src/components/hass/Weather', 'src/components/hass/weather', 'src/components/hass/precipitationTimeline', 'src/components/hass/useWeatherDayBriefing', 'src/components/hass/useWeatherForecasts', 'src/hooks/useForecastWindMotion', 'src/hooks/useHorizontalScrollControls', 'src/i18n/locales/en/modals/weather.json'],
    legacy: ['weather-scenes.spec.ts', 'weather-atmosphere-scenes.spec.ts', 'weather-carousel.spec.ts', 'weather-data.spec.ts', 'weather-motion.spec.ts', 'weather-modal-rendering.spec.ts'],
    question: 'Are forecast modes, stale/empty/error states, missing and long Pressure readings readable and reachable after rotation, with complete carousel pages centered and incomplete final pages aligned left, equal small-tile heights, no preview dropdown and unchanged return geometry?',
  },
  navigation: {
    family: 'page-shell-grid', states: ['home', 'back-page'],
    owners: ['src/pages/Page.', 'src/pages/ControlShowcasePage', 'src/i18n/locales/en/pages/controlShowcase.json', 'src/components/shell/AdaptiveNavigation', 'src/components/shell/AppHeader', 'src/constants/navigationLayout'],
    legacy: ['adaptive-navigation.spec.ts', 'responsive-pages-all.spec.ts', 'desktop-responsive.spec.ts', 'safe-area-responsive.spec.ts'],
    question: 'Do content, grid, fixed controls, Back/menu and focus remain usable across the named form-factor and stretch-return journey?',
  },
  host: {
    family: 'host', states: ['legacy', 'panel'],
    owners: ['src/panel/', 'src/lifecycle/', 'src/constants/dashboardHosts'],
    legacy: ['iframe-lifecycle.spec.ts'],
    question: 'Does the actual product bridge preserve its app during synthetic resizing and forward independent outer safe edges to the correctly sized inner viewport?',
  },
  preload: {
    family: 'preload', states: ['inert'],
    owners: ['src/components/shell/DashboardPreloadCache'],
    legacy: ['preload-inert.spec.ts', 'home-route-hydration.spec.ts', 'home-route-hydration-desktop.spec.ts'],
    question: 'Is the hidden preload geometry inert while the visible app remains usable?',
  },
  'wake-light': {
    family: 'modal',
    states: ['alarms', 'defaults', 'empty', 'source-only', 'no-enabled', 'vacation', 'unavailable', 'incompatible', 'blocked', 'active', 'source-snoozed', 'recovering', 'spent-once', 'legacy-ramp'],
    tabs: ['^Wake Alarms$', '^Defaults$'],
    owners: ['src/components/hass/wakeLights/', 'src/constants/wakeLights', 'src/i18n/locales/en/modals/wakeLight.json'],
    legacy: ['wake-light-alarms.spec.ts', 'wake-light-desktop-responsive.spec.ts', 'responsive-modal-inventory.spec.ts'],
    question: 'Are alarm controls, current blockers, source ownership, ramp choices and active Stop truthful, readable and reachable without changing the shared frame?',
  },
  'wake-room': {
    family: 'page-shell-grid',
    states: ['ready', 'no-enabled', 'unavailable', 'active'],
    owners: ['src/components/hass/wakeLights/WakeLightModalContent', 'src/constants/wakeLights'],
    legacy: ['wake-light-alarms.spec.ts', 'responsive-pages-all.spec.ts'],
    question: 'Does the standard room tile convey ready, no-enabled, unavailable and active state without moving, and open useful controls without issuing a command?',
  },
  'wake-editor': {
    family: 'modal',
    states: ['one-time', 'scheduled', 'unchanged', 'dirty', 'reverted', 'pending', 'rejected', 'revision-conflict', 'legacy-ramp'],
    owners: ['src/components/hass/wakeLights/WakeLightModalContent', 'src/components/hass/wakeLights/useWakeLightController'],
    legacy: ['wake-light-alarms.spec.ts', 'wake-light-adaptive-navigation.spec.ts'],
    question: 'Does the one-time-first editor preserve exact dirty state, ramp selection and rejected/conflicting drafts while acceptance remains required before closing?',
  },
  'wake-source': {
    family: 'modal',
    states: ['pod-editor', 'pod-alarm-detail', 'back'],
    owners: ['src/components/hass/scheduleExecutionDay', 'src/components/hass/wakeLights/WakeLightModalContent', 'src/constants/wakeLights'],
    legacy: ['wake-light-adaptive-navigation.spec.ts', 'wake-light-alarms.spec.ts', 'modal-geometry-stability.spec.ts'],
    question: 'Does source navigation close the old sheet before opening the authoritative Pod editor, preserve execution weekdays and linked-room meaning, and return without duplicate writes?',
  },
}

export const DEVICE_ONLY_GAPS = [
  'Physical cutout masks and platform edge gestures',
  'Native iOS text autosizing and native keyboard behavior',
  'Actual Home Assistant/companion-app three-frame inset delivery and host lifecycle',
] as const

export const INTENTIONAL_NEW_ROUTES: Record<string, {
  backLabel: string
  heading: string
  owner: ScenarioId
  referenceRoute: string
  root: string
  expected: {
    actionCount: number
    colorPickers: number
    rgbChannels: number
    sectionHeadings: string[]
    temperaturePickers: number
  }
}> = {
  'light-controls': {
    backLabel: 'Light Controls',
    heading: 'Light Controls',
    owner: 'navigation',
    referenceRoute: 'custom-lights',
    root: '[data-control-showcase="true"]',
    expected: {
      actionCount: 0,
      colorPickers: 1,
      rgbChannels: 3,
      sectionHeadings: ['Full Color', 'White Temperature'],
      temperaturePickers: 1,
    },
  },
}

export const INTENTIONAL_ROUTE_ADDITIONS: Record<string, {
  owner: ScenarioId
  section: string
  inherited: string[]
  viewports: Record<string, {
    height: number
    shifts: Record<string, { x: number; y: number }>
    tileWidth: number
    width: number
  }>
}> = {
  'master-bedroom': {
    owner: 'wake-light',
    section: 'section-sleep-&-wake',
    inherited: ['section-sleepypod', 'section-media', 'section-climate'],
    viewports: {
      'phone-portrait': {
        height: 184,
        width: 361,
        tileWidth: 361,
        shifts: {
          'section-sleepypod': { x: 0, y: 202 },
          'section-media': { x: 0, y: 202 },
          'section-climate': { x: 0, y: 202 },
        },
      },
      'phone-landscape': {
        height: 186,
        width: 401,
        tileWidth: 401,
        shifts: {
          'section-sleepypod': { x: 419, y: 0 },
          'section-media': { x: -419, y: 334 },
          'section-climate': { x: 419, y: 0 },
        },
      },
    },
  },
}

export const SHARED_OWNER_ROOTS = [
  'src/pages/Page.', 'src/components/core/ModalSheet', 'src/components/core/modalSheet',
  'src/components/core/DynamicGrid', 'src/components/core/dynamicGrid', 'src/components/core/modalSquareGrid',
  'src/components/shell/AppShell', 'src/styles/', 'src/constants/routes',
  'src/hooks/useDashboardViewport', 'src/hooks/useAdaptiveNavigationLayout',
  'src/hooks/useModalBackdropBands',
  'src/utils/focusAppearance',
  'public/', 'index.html',
] as const

export const SHARED_MODAL_OWNER_ROOTS = [
  'src/components/core/ModalTabNav',
] as const

export const EXTERNAL_SPECS = new Set(['real-hakit-dials.spec.ts', 'iframe-lifecycle-real-hakit.spec.ts'])
export const PARITY_SPEC = 'mobile-parity-all-routes.spec.ts'
export const LAYOUT_UNIT_GATES = [
  'scripts/layout', 'scripts/e2e-coverage-check.test.ts', 'scripts/required-mobile-parity.test.ts',
  'src/components/shell/DashboardPreloadCache.test.tsx', 'src/test/mocks/hakitCoreState.test.ts',
  'src/components/hass/chat', 'src/components/shell/GlobalChat.test.tsx', 'src/components/shell/GlobalQuickLinksAction.test.tsx',
] as const

// Exact, existing engine restrictions; these remain skipped, never counted as passed.
export const LEGACY_ENGINE_SKIPS = [
  { spec: 'modal-backdrop-bands.spec.ts', title: 'rendered blur passes a positive control before checking automatic pixel parity', browser: 'webkit', reason: 'This Linux WebKit renderer does not execute the blur-positive control; its pixel parity is unverified.' },
  { spec: 'iframe-lifecycle.spec.ts', title: 'legacy replacements keep post-GC heap bounded', browser: 'webkit', reason: 'CDP heap measurements require Chromium.' },
  { spec: 'modal-sheet-lifecycle.spec.ts', title: 'keeps a fast top-edge swipe terminal after Base UI finishes its velocity-scaled exit', browser: 'webkit', reason: 'Trusted multi-point touch injection is Chromium-only in Playwright' },
  { spec: 'modal-sheet-lifecycle.spec.ts', title: 'keeps a synthetic WebKit top-edge swipe terminal through the mounted exit window', browser: 'chromium', reason: 'Constructed TouchEvent coverage targets the WebKit project' },
  { spec: 'modal-sheet-lifecycle.spec.ts', title: 'keeps a synthetic WebKit top-edge swipe terminal through the mounted exit window', browser: 'webkit', reason: 'Playwright WebKit exposes no trusted touch-drag injection; constructed TouchEvents are untrusted and cannot drive Base UI dismissal. Chromium CDP covers trusted swipe dismissal.' },
  { spec: 'modal-sheet-performance.spec.ts', title: 'keeps page glass blurred while removing nested modal glass blur in WebKit', browser: 'chromium', reason: 'Backdrop-filter computed styles are validated in WebKit' },
  { spec: 'weather-atmosphere-scenes.spec.ts', title: 'new atmospheric elements follow CSS-owned close, reduced-motion and forced-color lifecycle', browser: 'webkit', reason: 'The pinned baseline remounts the scene during rapid close/reopen in Linux WebKit; Chromium and desktop retain node-identity coverage, while other WebKit weather tests remain required.' },
  { spec: 'modal-sheet-performance.spec.ts', title: 'compares automatic and full backdrop policies under throttled idle and trusted dismissal', browser: 'webkit', reason: 'CPU throttling and trusted touch injection are Chromium-only' },
] as const

export function requireScenarios(ids: readonly string[]): ScenarioId[] {
  if (!ids.length) throw new Error('A layout selection must contain at least one scenario')
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate layout scenario selection')
  for (const id of ids) if (!SCENARIO_IDS.includes(id as ScenarioId)) throw new Error(`Unknown layout scenario: ${id}`)
  return ids as ScenarioId[]
}
