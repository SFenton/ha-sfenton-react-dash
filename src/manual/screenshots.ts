import type { ManualPrivacyClass, ManualScreenshotRole, ManualSectionId } from './types'
import { MANUAL_ROUTE_CONTEXT_SCREENSHOTS } from './routeContextScreenshots'
import { roomCardFamilySurfaceId } from './roomCardFamilies'
import { MANUAL_WORKFLOW_SCREENSHOTS } from './workflowScreenshots'

export const MANUAL_SCREENSHOT_FORBIDDEN_TEXT = [
  'Loading',
  'Processing...',
  'Camera unavailable',
  'is not available in the React dashboard yet',
  'Unavailable',
] as const

/** Permanent release contract: every non-none screenshot policy has registered evidence. */
export const MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET = 0

export type ManualScreenshotForbiddenText = (typeof MANUAL_SCREENSHOT_FORBIDDEN_TEXT)[number]

export interface ManualScreenshotConfig {
  id: string
  articleId: string
  surfaceId: string
  allowAnimations?: boolean
  coveredSurfaceIds?: string[]
  surfaceTargetEvidence?: Record<string, string[]>
  role: ManualScreenshotRole
  scenarioId: string
  requiredTargets: string[]
  privacyClass: ManualPrivacyClass
  desktopMaxWidth: number
  mobileMaxWidth?: number
  desktopCaptureWidth?: number
  maxDiffPixelRatio?: number
  maxViewportHeightRatio?: number
  minDescendants?: number
  alsoUsedByArticleIds?: string[]
  landingUse?: {
    sectionId: ManualSectionId
    caption: string
  }
  cropSelector?: string
  cropSubject?: boolean
  mobileCropSubject?: boolean
  cropFromBottom?: boolean
  cropHeight?: number
  desktopCropHeight?: number
  excludeSelectors?: string[]
  allowedStateText?: ManualScreenshotForbiddenText[]
  alt: string
  caption: string
}

export function manualScreenshotSurfaceIds(screenshot: Pick<ManualScreenshotConfig, 'coveredSurfaceIds' | 'surfaceId'>) {
  return [screenshot.surfaceId, ...(screenshot.coveredSurfaceIds ?? [])]
}

export function manualScreenshotCoverageIssues(
  screenshot: Pick<ManualScreenshotConfig, 'coveredSurfaceIds' | 'id' | 'requiredTargets' | 'surfaceId' | 'surfaceTargetEvidence'>,
  registeredSurfaceIds: ReadonlySet<string>,
) {
  const issues: string[] = []
  const coveredSurfaceIds = screenshot.coveredSurfaceIds ?? []
  const duplicateCoveredSurfaceIds = coveredSurfaceIds.filter((surfaceId, index) => coveredSurfaceIds.indexOf(surfaceId) !== index)
  const claimedSurfaceIds = manualScreenshotSurfaceIds(screenshot)

  if (duplicateCoveredSurfaceIds.length > 0) {
    issues.push(`duplicates covered surface ids: ${[...new Set(duplicateCoveredSurfaceIds)].join(', ')}`)
  }
  if (coveredSurfaceIds.includes(screenshot.surfaceId)) {
    issues.push(`repeats primary surface ${screenshot.surfaceId} as covered`)
  }
  for (const surfaceId of claimedSurfaceIds) {
    if (!registeredSurfaceIds.has(surfaceId)) issues.push(`claims unknown surface ${surfaceId}`)
  }

  if (coveredSurfaceIds.length === 0) {
    if (screenshot.surfaceTargetEvidence) issues.push('declares surface target evidence without covered surfaces')
    return issues
  }

  const evidence = screenshot.surfaceTargetEvidence
  if (!evidence) {
    issues.push('has covered surfaces without per-surface target evidence')
    return issues
  }

  const claimedSurfaceIdSet = new Set(claimedSurfaceIds)
  for (const surfaceId of claimedSurfaceIds) {
    const targets = evidence[surfaceId]
    if (!targets || targets.length === 0) {
      issues.push(`has no visible target evidence for ${surfaceId}`)
      continue
    }
    if (new Set(targets).size !== targets.length) {
      issues.push(`repeats visible target evidence for ${surfaceId}`)
    }
    for (const target of targets) {
      if (!screenshot.requiredTargets.includes(target)) {
        issues.push(`uses "${target}" for ${surfaceId} without requiring that visible target`)
      }
    }
  }
  for (const surfaceId of Object.keys(evidence)) {
    if (!claimedSurfaceIdSet.has(surfaceId)) issues.push(`declares target evidence for unclaimed surface ${surfaceId}`)
  }

  return issues
}

export const MANUAL_SCREENSHOTS: ManualScreenshotConfig[] = [
  {
    id: 'section-start-navigation',
    articleId: 'app-layout',
    surfaceId: 'start.navigation',
    role: 'context',
    scenarioId: 'section-start-navigation',
    requiredTargets: ['Home', 'Security', 'Climate', 'Chores'],
    privacyClass: 'no-media',
    desktopMaxWidth: 291,
    cropSelector: '[data-primary-navigation="true"]',
    alsoUsedByArticleIds: ['app-manual-page-guide', 'task-find-page-or-room'],
    landingUse: {
      sectionId: 'start',
      caption: 'The navigation menu groups the four main dashboard areas; Settings stays separated at the bottom.',
    },
    alt: 'Primary navigation group listing Home, Security, Climate, and Chores.',
    caption: 'The navigation menu groups the four main dashboard areas; Settings stays separated at the bottom.',
  },
  {
    id: 'section-home-context',
    articleId: 'home-section-overview',
    surfaceId: 'route:overview',
    role: 'context',
    scenarioId: 'section-home-context',
    requiredTargets: ['Partly Cloudy'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    cropSelector: '[data-manual-home-context="true"]',
    alsoUsedByArticleIds: ['home-overview', 'rooms-picker-guide', 'weather-surface-guide'],
    landingUse: {
      sectionId: 'home',
      caption: 'Home begins with a compact weather summary that opens the detailed forecast.',
    },
    alt: 'Home weather summary showing a synthetic Partly Cloudy condition and current temperature.',
    caption: 'Home begins with a compact weather summary that opens the detailed forecast.',
  },
  {
    id: 'section-security-context',
    articleId: 'security-and-cameras',
    surfaceId: 'route:security',
    role: 'context',
    scenarioId: 'section-security-context',
    requiredTargets: ['Security System', 'Front Door', 'Left Door', 'Right Door'],
    coveredSurfaceIds: ['security.access-controls'],
    surfaceTargetEvidence: {
      'route:security': ['Security System', 'Front Door', 'Left Door', 'Right Door'],
      'security.access-controls': ['Front Door', 'Left Door', 'Right Door'],
    },
    privacyClass: 'no-media',
    desktopMaxWidth: 560,
    cropSelector: '[data-security-control-grid="true"]',
    alsoUsedByArticleIds: ['security-page-guide', 'security-access-controls', 'room-garage', 'task-control-door-or-garage'],
    landingUse: {
      sectionId: 'security',
      caption: 'Security puts the alarm, front lock, and both garage doors together.',
    },
    alt: 'Security controls for the alarm, front door, left garage door, and right garage door.',
    caption: 'Security puts the alarm, front lock, and both garage doors together.',
  },
  {
    id: 'section-security-modes',
    articleId: 'security-system-modes',
    surfaceId: 'security.system-sheet',
    role: 'state',
    scenarioId: 'section-security-modes',
    requiredTargets: ['Home', 'Away', 'Night', 'Disarmed'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 450,
    alsoUsedByArticleIds: ['security-page-guide', 'security-and-cameras', 'task-arm-or-disarm-alarm'],
    alt: 'Security System mode choices: Home, Away, Night, and Disarmed.',
    caption: 'The four alarm choices set the security system mode.',
  },
  {
    id: 'security-camera-controls',
    articleId: 'security-cameras',
    surfaceId: 'security.camera-controls',
    role: 'focused',
    scenarioId: 'security-camera-controls',
    requiredTargets: ['Snapshot', 'Muted', 'Recording'],
    privacyClass: 'no-media',
    desktopMaxWidth: 560,
    desktopCaptureWidth: 820,
    cropSelector: '[data-security-camera-controls="true"]',
    alsoUsedByArticleIds: ['security-page-guide', 'security-and-cameras', 'task-use-security-camera'],
    alt: 'Camera controls showing Snapshot, Muted, and Recording actions.',
    caption: 'Every security camera sheet keeps snapshot, audio, and manual-recording actions below the live view.',
  },
  {
    id: 'section-climate-context',
    articleId: 'climate-section-overview',
    surfaceId: 'route:ecobee',
    role: 'context',
    scenarioId: 'section-climate-context',
    requiredTargets: ['Room Thermostats', 'Advanced Configuration', 'Room Tracking'],
    privacyClass: 'synthetic',
    cropHeight: 740,
    desktopCaptureWidth: 620,
    desktopCropHeight: 720,
    desktopMaxWidth: 420,
    mobileMaxWidth: 270,
    cropSelector: '[data-thermostat-page-entrypoints="true"]',
    maxViewportHeightRatio: 0.9,
    alsoUsedByArticleIds: ['thermostat-page-guide'],
    landingUse: {
      sectionId: 'climate',
      caption: 'Each green Climate tile follows a short explanation and opens its matching Thermostat tab.',
    },
    alt: 'Green Room Thermostats, Advanced Configuration, and Room Tracking tiles with explanatory text.',
    caption: 'Each green Climate tile follows a short explanation and opens its matching Thermostat tab.',
  },
  {
    id: 'section-chores-context',
    articleId: 'chores-section-overview',
    surfaceId: 'route:chores',
    role: 'context',
    scenarioId: 'section-chores-context',
    requiredTargets: ['Groceries', "Stephen's Tasks"],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 700,
    cropSelector: '[aria-label="Chore quick links"]',
    cropHeight: 260,
    alsoUsedByArticleIds: [
      'chore-scheduling',
      'chores-page-guide',
      'groceries-page-guide',
      'stephens-chores-page-guide',
      'task-complete-household-task',
      'task-manage-grocery-item',
    ],
    landingUse: {
      sectionId: 'chores',
      caption: 'The beginning of Chore Quick Links opens groceries and personal task lists without exposing task text.',
    },
    alt: 'Beginning of Chore Quick Links showing Groceries and personal task destinations.',
    caption: 'The beginning of Chore Quick Links opens groceries and personal task lists without exposing task text.',
  },
  {
    id: 'section-food-context',
    articleId: 'food-section-overview',
    surfaceId: 'route:food',
    role: 'context',
    scenarioId: 'section-food-context',
    requiredTargets: ['All Food', '35 Items', '6 Expiring Soon'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    cropSelector: '#section-all-food',
    alsoUsedByArticleIds: ['grocery-list-page-guide', 'food-page-guide', 'all-food-page-guide', 'food-inventory', 'task-edit-food-inventory'],
    landingUse: {
      sectionId: 'food',
      caption: 'The Food hub opens the complete inventory with synthetic item and expiration counts.',
    },
    alt: 'Food hub All Food section showing synthetic total and expiring-soon counts.',
    caption: 'The Food hub opens the complete inventory with synthetic item and expiration counts.',
  },
  {
    id: 'section-rooms-context',
    articleId: 'rooms-section-overview',
    surfaceId: 'route:living-room',
    role: 'context',
    scenarioId: 'section-rooms-context',
    requiredTargets: ['Climate', 'Vents', 'Air Purifier'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 300,
    cropSelector: '[data-manual-rooms-context="true"]',
    alsoUsedByArticleIds: [
      'media-page-guide',
      'room-sheet-navigation-guide',
      'room-living-room',
      'room-guest-room',
      'room-office',
      'wake-alarms',
      'task-find-page-or-room',
      'task-change-sleepypod-temperature',
      'task-manage-wake-alarm',
      'task-use-dishwasher',
      'task-use-grill',
    ],
    landingUse: {
      sectionId: 'rooms',
      caption: 'A room page groups related controls under clear section headings, such as Climate.',
    },
    alt: 'Living Room Climate section showing Vents and Air Purifier controls with synthetic states.',
    caption: 'A room page groups related controls under clear section headings, such as Climate.',
  },
  ...MANUAL_ROUTE_CONTEXT_SCREENSHOTS,
  {
    id: 'mach-e-page-context',
    articleId: 'mach-e-page-guide',
    surfaceId: 'route:mach-e',
    role: 'context',
    scenarioId: 'mach-e-page-context',
    requiredTargets: ['Charge Status', 'Doors', "Driver's Seat", 'Passenger Seat', 'Climate'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 360,
    cropSelector: '[data-manual-route-context="mach-e"]',
    cropHeight: 360,
    desktopCropHeight: 330,
    alt: 'Mach-E page showing five synthetic read-only status tiles without vehicle identifiers.',
    caption: 'The Mach-E route groups charging, door, seat, and climate reports in one read-only status section.',
  },
  {
    id: 'vacuums-page-context',
    articleId: 'vacuums-page-guide',
    surfaceId: 'route:vacuums',
    role: 'context',
    scenarioId: 'vacuums-page-context',
    requiredTargets: ['Robot Vacuums', 'Main Floor', 'Music Room', 'Theater Room', 'Docked', 'Idle', 'Cleaning'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 360,
    cropSelector: '[data-manual-route-context="vacuums"]',
    cropHeight: 460,
    desktopCropHeight: 330,
    maxViewportHeightRatio: 0.55,
    alsoUsedByArticleIds: ['task-clean-vacuum-rooms', 'task-use-vacuum-dock', 'task-recover-vacuum-error'],
    alt: 'Vacuums page showing all three available robot cards in distinct synthetic states.',
    caption: 'The Robot Vacuums section shows availability, current state, and battery before a card opens its detailed sheet.',
  },
  {
    id: 'media-page-context',
    articleId: 'media-page-guide',
    surfaceId: 'route:media',
    role: 'context',
    scenarioId: 'media-page-context',
    requiredTargets: ['Living Room', 'Living Room SHIELD', 'Theater Room', 'Nintendo Switch', 'Theater SHIELD'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('media')],
    surfaceTargetEvidence: {
      'route:media': ['Living Room', 'Living Room SHIELD', 'Theater Room', 'Nintendo Switch', 'Theater SHIELD'],
      [roomCardFamilySurfaceId('media')]: ['Living Room SHIELD', 'Theater Room', 'Nintendo Switch', 'Theater SHIELD'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 360,
    cropSelector: '[data-manual-route-context="media"]',
    cropHeight: 600,
    desktopCropHeight: 520,
    maxViewportHeightRatio: 0.72,
    alsoUsedByArticleIds: ['room-card-family-media', 'task-use-media-remote', 'task-run-pc-power-command'],
    alt: 'Media page showing synthetic Living Room and Theater remote and direct-action cards.',
    caption: 'The Media route separates room remote openers from the Theater source tiles that run direct actions.',
  },
  {
    id: 'section-settings-context',
    articleId: 'settings-section-overview',
    surfaceId: 'route:settings',
    role: 'context',
    scenarioId: 'section-settings-context',
    requiredTargets: ['App Manual', 'Admin Controls', 'Guest Controls'],
    privacyClass: 'no-media',
    desktopMaxWidth: 820,
    cropSelector: '[data-manual-settings-context="true"]',
    cropHeight: 250,
    desktopCropHeight: 235,
    alsoUsedByArticleIds: ['settings-page-guide', 'to-do-page-guide', 'task-add-admin-todo'],
    landingUse: {
      sectionId: 'settings',
      caption: 'Settings starts with documentation, Admin Controls, and the guest and vacation destinations.',
    },
    alt: 'Settings page showing App Manual, Admin Controls, and Guest Controls destinations.',
    caption: 'Settings starts with documentation, Admin Controls, and the guest and vacation destinations.',
  },
  {
    id: 'admin-page-context',
    articleId: 'admin-page-guide',
    surfaceId: 'route:admin',
    role: 'context',
    scenarioId: 'admin-page-context',
    requiredTargets: ['Security Controls', 'Front Door Auto-Lock', 'Living Room Power Recovery', 'Attempt to turn power back on', 'Relay Control Mode'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropSelector: '[data-manual-route-context="admin"]',
    cropHeight: 600,
    desktopCropHeight: 650,
    maxViewportHeightRatio: 0.95,
    alsoUsedByArticleIds: ['task-run-living-room-recovery', 'task-change-relay-control-mode'],
    alt: 'Admin Controls showing synthetic auto-lock and relay states plus the direct Living Room power-recovery command.',
    caption: 'Admin begins with two direct security and recovery actions, followed by the house-wide relay mode.',
  },
  {
    id: 'guest-controls-page-context',
    articleId: 'guest-controls-page-guide',
    surfaceId: 'route:guests-staying-over',
    role: 'context',
    scenarioId: 'guest-controls-page-context',
    requiredTargets: ['Guest Controls', 'Guest Room', 'Music Room', 'Theater Room'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropSelector: '[data-manual-route-context="guests-staying-over"]',
    cropHeight: 430,
    desktopCropHeight: 330,
    maxViewportHeightRatio: 0.55,
    alsoUsedByArticleIds: ['task-configure-guests'],
    alt: 'Guest Controls showing the three room toggles in synthetic on and off states.',
    caption: 'Guest Controls has one direct toggle for each guest-capable sleeping room.',
  },
  {
    id: 'vacation-page-context',
    articleId: 'vacation-page-guide',
    surfaceId: 'route:vacation',
    role: 'context',
    scenarioId: 'vacation-page-context',
    requiredTargets: ['Vacation Mode', 'Pre-Vacation Checklist'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropSelector: '[data-manual-route-context="vacation"]',
    cropHeight: 490,
    desktopCropHeight: 420,
    maxViewportHeightRatio: 0.6,
    alsoUsedByArticleIds: ['task-start-vacation-mode', 'task-cancel-vacation-mode'],
    alt: 'Vacation page showing Vacation Mode and a synthetic checklist with private item wording replaced.',
    caption: 'Vacation starts with the mode card and a required checklist; private trip-specific wording is intentionally replaced in this image.',
  },
  {
    id: 'vacation-confirmation',
    articleId: 'vacation-page-guide',
    surfaceId: 'modal-opener-family:vacation-mode-confirmation',
    coveredSurfaceIds: ['vacation.confirmation-sheet'],
    surfaceTargetEvidence: {
      'modal-opener-family:vacation-mode-confirmation': ['Confirm Vacation', 'Start Date', 'Start Time', 'End Date', 'End Time'],
      'vacation.confirmation-sheet': ['Confirm Vacation', 'Start Date', 'Start Time', 'End Date', 'End Time'],
    },
    role: 'modal',
    scenarioId: 'vacation-confirmation',
    requiredTargets: ['Confirm Vacation', 'Start Date', 'Start Time', 'End Date', 'End Time'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    desktopCaptureWidth: 820,
    desktopCropHeight: 360,
    alsoUsedByArticleIds: ['native-inputs-and-prompts', 'task-start-vacation-mode'],
    alt: 'Confirm Vacation sheet showing fixed synthetic start and end dates and times.',
    caption: 'After the checklist is complete, Confirm Vacation holds date edits locally until the final confirmation.',
  },
  {
    id: 'section-help-context',
    articleId: 'help-section-overview',
    surfaceId: 'route:manual',
    role: 'context',
    scenarioId: 'section-help-context',
    requiredTargets: ['Troubleshooting', 'What is in development', 'Glossary'],
    privacyClass: 'no-media',
    desktopMaxWidth: 820,
    mobileMaxWidth: 300,
    cropSelector: '[data-manual-guide-group="Start here"]',
    cropHeight: 381,
    desktopCropHeight: 304,
    alsoUsedByArticleIds: ['app-manual-page-guide'],
    landingUse: {
      sectionId: 'help',
      caption: 'Help puts troubleshooting, current development status, and plain-language definitions first.',
    },
    alt: 'Help Start here group listing Troubleshooting, What is in development, and Glossary.',
    caption: 'Help puts troubleshooting, current development status, and plain-language definitions first.',
  },
  {
    id: 'app-layout-home',
    articleId: 'home-overview',
    surfaceId: 'route:overview',
    coveredSurfaceIds: ['floating-action.rooms'],
    surfaceTargetEvidence: {
      'route:overview': ['Home', 'Quick Links', 'Food & Recipes'],
      'floating-action.rooms': ['Rooms'],
    },
    role: 'overview',
    scenarioId: 'app-layout-home',
    requiredTargets: ['Home', 'Quick Links', 'Food & Recipes', 'Rooms'],
    privacyClass: 'no-media',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSelector: '[data-app-shell="true"]',
    alsoUsedByArticleIds: ['app-layout', 'daily-report', 'home-section-overview', 'custom-lights-page-guide', 'rooms-picker-guide'],
    alt: 'Home page showing the header, status chips, quick links, Rooms action, and bottom navigation.',
    caption: 'Home keeps summary information near the top, primary navigation at the bottom, and room navigation in the floating Rooms action.',
  },
  {
    id: 'home-status-rail-start',
    articleId: 'status-chips',
    surfaceId: 'home.status-rail',
    role: 'focused',
    scenarioId: 'home-status-rail-start',
    requiredTargets: ['Lights', 'Security', 'Climate'],
    coveredSurfaceIds: [
      'home.status-chip-lights',
      'home.status-chip-security',
      'home.status-chip-climate',
    ],
    surfaceTargetEvidence: {
      'home.status-rail': ['Lights', 'Security', 'Climate'],
      'home.status-chip-lights': ['Lights'],
      'home.status-chip-security': ['Security'],
      'home.status-chip-climate': ['Climate'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    desktopCaptureWidth: 592,
    alsoUsedByArticleIds: ['security-system-modes'],
    alt: 'Beginning of the horizontally scrollable Home status-chip row showing Lights, Security, and Climate.',
    caption: 'Swipe the chip row sideways on a phone to reveal the remaining household summaries.',
  },
  {
    id: 'home-status-rail-end',
    articleId: 'status-chips',
    surfaceId: 'home.status-rail',
    role: 'focused',
    scenarioId: 'home-status-rail-end',
    requiredTargets: ['Contact Sensors', 'Air Quality'],
    coveredSurfaceIds: [
      'home.status-chip-contact-sensors',
      'home.status-chip-air-quality',
    ],
    surfaceTargetEvidence: {
      'home.status-rail': ['Contact Sensors', 'Air Quality'],
      'home.status-chip-contact-sensors': ['Contact Sensors'],
      'home.status-chip-air-quality': ['Air Quality'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    desktopCaptureWidth: 592,
    alt: 'End of the Home status-chip row showing Contact Sensors and Air Quality.',
    caption: 'The end of the same row keeps Contact Sensors and Air Quality fully visible.',
  },
  {
    id: 'food-suggested-recipes',
    articleId: 'recipes',
    surfaceId: 'food.suggested-recipes',
    role: 'overview',
    scenarioId: 'food-suggested-recipes',
    requiredTargets: [
      'Suggested Recipes',
      'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables',
      'Suggested Recipe 2',
      'Suggested Recipe 3',
    ],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    maxDiffPixelRatio: 0.05,
    cropSelector: '[data-manual-surface="food-suggested-recipes"]',
    cropHeight: 620,
    desktopCropHeight: 500,
    alsoUsedByArticleIds: ['food-section-overview', 'food-page-guide', 'recipes-page-guide', 'task-find-and-use-recipe'],
    alt: 'Suggested Recipes section showing deterministic synthetic recipe cards in the responsive carousel.',
    caption: 'Suggested Recipes keeps the server-ranked synthetic cards in a five-page responsive carousel.',
  },
  {
    id: 'home-climate-overview',
    articleId: 'status-chips',
    surfaceId: 'home.climate-sheet',
    role: 'modal',
    scenarioId: 'home-climate-overview',
    requiredTargets: ['Climate', 'Rooms', 'Living Room', '66.0°F - 68.0°F', 'Guest Room', '70.0°F - 72.0°F'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    mobileCropSubject: true,
    cropHeight: 580,
    desktopCropHeight: 280,
    alsoUsedByArticleIds: ['task-adjust-thermostat'],
    alt: 'Home Climate overview showing distinct synthetic temperature ranges for Living Room and Guest Room.',
    caption: 'The Climate chip opens a room comparison before any room sensor detail is selected.',
  },
  {
    id: 'home-climate-room-detail',
    articleId: 'status-chips',
    surfaceId: 'home.climate-room-detail',
    role: 'detail',
    scenarioId: 'home-climate-room-detail',
    requiredTargets: ['Climate', 'Guest Room Climate', '69.0°F - 71.0°F', 'Temperature Sensors', 'Presence', '69.5°F', 'Closet', '70.2°F', 'Vent', 'Open'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSubject: true,
    cropHeight: 400,
    desktopCropHeight: 380,
    alsoUsedByArticleIds: ['task-adjust-thermostat'],
    alt: 'Guest Room Climate detail showing two synthetic temperature sensors and the room vent state.',
    caption: 'Selecting Guest Room keeps the Climate sheet open and reveals its sensor readings and vent state.',
  },
  {
    id: 'home-occupancy-overview',
    articleId: 'status-chips',
    surfaceId: 'home.occupancy-sheet',
    coveredSurfaceIds: ['home.status-chip-occupancy'],
    surfaceTargetEvidence: {
      'home.occupancy-sheet': ['Occupancy', 'Occupied', 'Living Room', 'Living Room Occupied'],
      'home.status-chip-occupancy': ['Occupancy'],
    },
    role: 'modal',
    scenarioId: 'home-occupancy-overview',
    requiredTargets: ['Occupancy', 'Occupied', 'Living Room', 'Living Room Occupied'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSubject: true,
    cropHeight: 450,
    desktopCropHeight: 490,
    alt: 'Home Occupancy overview grouping a synthetic occupied Living Room above a clear Hallway.',
    caption: 'The Occupancy chip separates occupied rooms from clear rooms without changing any sensor.',
  },
  {
    id: 'home-occupancy-room-detail',
    articleId: 'status-chips',
    surfaceId: 'home.occupancy-room-detail',
    role: 'detail',
    scenarioId: 'home-occupancy-room-detail',
    requiredTargets: ['Occupancy', 'Guest Room Occupancy', '1 sensor occupied', 'Guest Room', 'Detected', 'Closet', 'Clear'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSubject: true,
    cropHeight: 250,
    desktopCropHeight: 250,
    alt: 'Guest Room Occupancy detail showing one occupied sensor and one clear closet sensor.',
    caption: 'Selecting Guest Room identifies which contributing occupancy sensor is active and which is clear.',
  },
  {
    id: 'home-contact-overview',
    articleId: 'status-chips',
    surfaceId: 'home.contact-sensors-sheet',
    role: 'modal',
    scenarioId: 'home-contact-overview',
    requiredTargets: ['Contact Sensors', 'Rooms', 'Entryway', 'Door Closed', 'Office', '1 Window Open'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    mobileCropSubject: true,
    cropHeight: 580,
    desktopCropHeight: 280,
    alsoUsedByArticleIds: ['task-investigate-contact-pause'],
    alt: 'Home Contact Sensors overview showing a synthetic open Office window group beside closed Entryway doors.',
    caption: 'The Contact Sensors overview makes the room with an open window visible before climate troubleshooting.',
  },
  {
    id: 'home-contact-room-detail',
    articleId: 'status-chips',
    surfaceId: 'home.contact-room-detail',
    role: 'detail',
    scenarioId: 'home-contact-room-detail',
    requiredTargets: ['Contact Sensors', 'Office Contact Sensors', '1 Window Open', 'PC Window', 'Open', 'Window', 'Closed'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSubject: true,
    cropHeight: 250,
    desktopCropHeight: 250,
    alsoUsedByArticleIds: ['thermostat-and-contacts', 'task-investigate-contact-pause'],
    alt: 'Office Contact Sensors detail showing one synthetic open PC Window and one closed Window.',
    caption: 'Office detail traces the aggregate open-contact warning to the exact open window while showing the other window closed.',
  },
  {
    id: 'home-air-quality-overview',
    articleId: 'status-chips',
    surfaceId: 'home.air-quality-sheet',
    role: 'modal',
    scenarioId: 'home-air-quality-overview',
    requiredTargets: ['Air Quality', 'Rooms', 'Living Room', '12 • 4 μg/m³', 'Guest Room', '27 • 8 μg/m³', 'Office', '63 • 21 μg/m³'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    cropSubject: true,
    cropHeight: 600,
    desktopCropHeight: 480,
    alt: 'Home Air Quality overview comparing distinct synthetic AQI and PM2.5 readings across rooms.',
    caption: 'Air Quality compares room AQI and PM2.5 readings without implying purifier power or a safety guarantee.',
  },
  {
    id: 'status-lights-overview',
    articleId: 'status-lights',
    surfaceId: 'home.lights-sheet',
    role: 'modal',
    scenarioId: 'status-lights-overview',
    requiredTargets: ['Lights', 'Living Room'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 600,
    desktopCaptureWidth: 820,
    alt: 'Lights overview sheet showing room light groups.',
    caption: 'The Lights chip opens a room overview so you can find where lights are active.',
  },
  {
    id: 'status-lights-detail',
    articleId: 'status-lights',
    surfaceId: 'home.lights-room-detail',
    role: 'detail',
    scenarioId: 'status-lights-detail',
    requiredTargets: ['Living Room Lights', 'Front Left'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('light'), 'room.light-sheet'],
    surfaceTargetEvidence: {
      'home.lights-room-detail': ['Living Room Lights', 'Front Left'],
      [roomCardFamilySurfaceId('light')]: ['Living Room Lights', 'Front Left'],
      'room.light-sheet': ['Living Room Lights', 'Front Left'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 600,
    desktopCaptureWidth: 820,
    alsoUsedByArticleIds: ['rooms-section-overview', 'room-living-room', 'room-hallway', 'room-back-deck', 'room-entryway', 'room-card-family-light', 'task-control-room-light'],
    alt: 'Living Room light detail page inside the Lights sheet.',
    caption: "Selecting a room keeps the sheet open and replaces the overview with that room's individual lights.",
  },
  {
    id: 'presence-lighting-states',
    articleId: 'presence-based-lighting',
    surfaceId: 'settings.presence-detail',
    coveredSurfaceIds: ['admin.presence-overrides-sheet'],
    surfaceTargetEvidence: {
      'settings.presence-detail': ['Enable Presence-Based Lighting', 'Paused', 'Quieted'],
      'admin.presence-overrides-sheet': ['Enable Presence-Based Lighting', 'Paused', 'Quieted'],
    },
    role: 'detail',
    scenarioId: 'presence-lighting-states',
    requiredTargets: ['Enable Presence-Based Lighting', 'Paused', 'Quieted'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    alsoUsedByArticleIds: ['admin-page-guide', 'settings-section-overview', 'task-configure-presence-lighting'],
    alt: 'Presence-Based Lighting controls showing Enabled, Disabled, Paused, and Quieted choices.',
    caption: 'Each room can enable automatic lighting, disable it, pause the current light state, or stay quiet until the room clears.',
  },
  {
    id: 'thermostat-options',
    articleId: 'thermostat-and-contacts',
    surfaceId: 'route:ecobee',
    role: 'overview',
    scenarioId: 'thermostat-options',
    requiredTargets: ['Whole Home', 'Thermostat Hub'],
    privacyClass: 'synthetic',
    cropHeight: 610,
    cropSelector: '[data-manual-route-context="ecobee"]',
    desktopCaptureWidth: 820,
    desktopCropHeight: 610,
    desktopMaxWidth: 820,
    alsoUsedByArticleIds: [
      'climate-section-overview',
      'thermostat-page-guide',
      'room-guest-room',
      'room-master-bedroom',
      'room-gym',
      'room-dining-room',
      'room-downstairs-hallway',
      'room-guest-bathroom',
      'room-master-bathroom',
      'task-adjust-thermostat',
      'task-configure-predictive-comfort',
    ],
    alt: 'Climate page showing the Whole Home thermostat and physical Thermostat Hub.',
    caption: 'The top of the Climate page keeps the Whole Home target and physical Hub state immediately visible.',
  },
  {
    id: 'chore-schedule',
    articleId: 'chore-scheduling',
    surfaceId: 'chores.donetick-task-sheet',
    role: 'detail',
    scenarioId: 'chore-schedule',
    requiredTargets: ['Priority', 'Recurrence', 'Repeat Every', 'Interval Unit'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    alsoUsedByArticleIds: [
      'chores-section-overview',
      'chores-page-guide',
      'stephens-chores-page-guide',
      'stephs-chores-page-guide',
      'unassigned-chores-page-guide',
      'home-improvement-chores-page-guide',
      'task-manage-repeating-chore',
    ],
    alt: 'Create Task sheet showing priority and repeating-task controls.',
    caption: 'Chore recurrence belongs to Donetick tasks and is separate from wake alarms or device schedules.',
  },
  {
    id: 'food-scan-review',
    articleId: 'food-scanning',
    surfaceId: 'food.scan-review',
    coveredSurfaceIds: ['food.scan-item-sheet'],
    surfaceTargetEvidence: {
      'food.scan-review': ['Where should it be stored?', 'When does it expire?', 'Prepared Food Item'],
      'food.scan-item-sheet': ['Where should it be stored?', 'When does it expire?', 'Prepared Food Item'],
    },
    role: 'wizard',
    scenarioId: 'food-scan-review',
    requiredTargets: ['Where should it be stored?', 'When does it expire?', 'Prepared Food Item'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 560,
    alsoUsedByArticleIds: [
      'food-section-overview',
      'food-page-guide',
      'all-food-page-guide',
      'pantry-page-guide',
      'fridge-page-guide',
      'freezer-page-guide',
      'spice-rack-page-guide',
      'cabinet-page-guide',
      'room-kitchen',
      'task-add-food-item',
    ],
    alt: 'Add Item review step showing storage location, expiration date, and the prepared-food option.',
    caption: 'The final scan step confirms where the item belongs, when it expires, and whether it is prepared food.',
  },
  {
    id: 'humidifier-schedule',
    articleId: 'humidifier-schedule',
    surfaceId: 'climate.humidifier-schedule-editor',
    role: 'detail',
    scenarioId: 'humidifier-schedule',
    requiredTargets: ['Name', 'Days', 'Start', 'End', 'Mode'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 1280,
    alsoUsedByArticleIds: ['climate-section-overview', 'room-master-bedroom', 'task-manage-humidifier-activity'],
    alt: 'Humidifier schedule editor showing a scheduled activity name, days, times, and humidifier settings.',
    caption: 'Humidifier activities use the shared device-schedule editor and can span multiple days or cross midnight.',
  },
  {
    id: 'vacuum-area-editor',
    articleId: 'vacuum-area-cleaning',
    surfaceId: 'cleaning.vacuum-area-editor',
    role: 'detail',
    scenarioId: 'vacuum-area-editor',
    requiredTargets: ['Main Floor Cleaning Area', 'Redraw', 'Reset View', 'Use This Area'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 1280,
    alsoUsedByArticleIds: ['vacuums-page-guide', 'room-living-room', 'room-music-room', 'room-theater-room', 'task-draw-vacuum-area'],
    alt: 'Robot vacuum area editor showing a rectangular cleaning area drawn on the map.',
    caption: 'Area Cleaning currently draws one rectangle that can be moved and resized before starting a targeted run.',
  },
  {
    id: 'recipes-browse',
    articleId: 'recipes',
    surfaceId: 'route:recipes',
    coveredSurfaceIds: [
      'floating-action.recipe-search',
      'floating-action.recipe-sort',
      'floating-action.recipe-filter',
    ],
    surfaceTargetEvidence: {
      'route:recipes': ['Recipes', 'Catalog Recipe'],
      'floating-action.recipe-search': ['Search recipes'],
      'floating-action.recipe-sort': ['Sort'],
      'floating-action.recipe-filter': ['Filter'],
    },
    role: 'overview',
    scenarioId: 'recipes-browse',
    requiredTargets: ['Recipes', 'Catalog Recipe', 'Search recipes', 'Sort', 'Filter'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    maxDiffPixelRatio: 0.05,
    alsoUsedByArticleIds: ['food-section-overview', 'food-page-guide', 'recipes-page-guide', 'task-find-and-use-recipe'],
    alt: 'Recipes page showing recipe cards with search, sort, and filter actions.',
    caption: 'Recipe browse supports searching, sorting, filtering, paging, and opening any server-ranked card for details.',
  },
  {
    id: 'recipe-detail',
    articleId: 'recipes',
    surfaceId: 'food.recipe-detail-instructions',
    coveredSurfaceIds: ['food.recipe-detail'],
    surfaceTargetEvidence: {
      'food.recipe-detail-instructions': ['General', 'Ingredients', 'Instructions', 'Open in Cookidoo'],
      'food.recipe-detail': ['General', 'Ingredients', 'Instructions', 'Open in Cookidoo'],
    },
    role: 'modal',
    scenarioId: 'recipe-detail',
    requiredTargets: ['General', 'Ingredients', 'Instructions', 'Open in Cookidoo'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 720,
    maxDiffPixelRatio: 0.05,
    alsoUsedByArticleIds: ['recipes-page-guide', 'task-find-and-use-recipe'],
    alt: 'Recipe detail sheet on the Instructions panel with icon-only footer tabs and the external-only Cookidoo state.',
    caption: 'The anchored footer tabs keep recipe sections accessible while Cookidoo official instructions remain an attributed external link.',
  },
  ...MANUAL_WORKFLOW_SCREENSHOTS,
]

export function manualScreenshotConfig(id: string) {
  return MANUAL_SCREENSHOTS.find((screenshot) => screenshot.id === id)
}

export function manualScreenshotUrl(id: string, variant: 'manual-desktop' | 'manual-mobile') {
  return `${import.meta.env.BASE_URL}manual/${variant}/${id}.png`
}
