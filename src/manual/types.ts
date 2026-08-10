import type { RoomSourceKind } from '../constants/roomPages'
import type { ManualTaskWorkflowId } from './taskWorkflows'

export type ManualSectionId =
  | 'start'
  | 'how-to'
  | 'home'
  | 'security'
  | 'climate'
  | 'chores'
  | 'food'
  | 'rooms'
  | 'settings'
  | 'help'

export type ManualArticleStatus = 'current' | 'in-development' | 'known-limitation'
export type ManualArticleKind = 'section-overview' | 'page-guide' | 'family-guide' | 'surface-guide' | 'behavior-guide' | 'page-overview' | 'component-guide' | 'task-guide' | 'technical-reference' | 'generated-room'
export type ManualSurfaceKind = 'route' | 'page-section' | 'status-chip' | 'floating-action' | 'component' | 'modal' | 'modal-tab' | 'detail-page' | 'wizard-step' | 'option-picker' | 'native-prompt' | 'stateful-control' | 'automatic-behavior'
export type ManualSurfaceCoverage = 'covered' | 'contextual'
export type ManualScreenshotRole = 'context' | 'overview' | 'focused' | 'modal' | 'detail' | 'state' | 'wizard'
export type ManualPrivacyClass = 'synthetic' | 'sanitized-household' | 'no-media'

export type ManualAtLeastOne<T> = readonly [T, ...T[]]
export type ManualAtLeastTwo<T> = readonly [T, T, ...T[]]
export type ManualAtLeastThree<T> = readonly [T, T, T, ...T[]]
export type ManualAtLeastFour<T> = readonly [T, T, T, T, ...T[]]

export interface ManualPageGuideFirstLook {
  label: string
  explanation: string
}

export type ManualPageGuideAutomation =
  | {
    mode: 'automatic'
    items: ManualAtLeastTwo<string>
  }
  | {
    mode: 'none'
    pageIsPurelyNavigational: true
    explanation: string
  }

export interface ManualPageGuide {
  routePath: string
  complexity: 'simple' | 'complex'
  generatedRoomPath?: string
  orientation: string
  visiblePageSectionNames: ManualAtLeastOne<string>
  whatYouCanDo: ManualAtLeastFour<string>
  whatHappensAutomatically: ManualPageGuideAutomation
  lookHereFirst: ManualAtLeastThree<ManualPageGuideFirstLook>
  safetyAndLimitations: {
    title: string
    text: string
  }
  troubleshootingChecks: ManualAtLeastThree<string>
  screenshotIds: ManualAtLeastOne<string>
  relatedArticleIds: ManualAtLeastOne<string>
}

export interface ManualFamilyGuideStateMeaning {
  label: string
  meaning: string
}

export interface ManualFamilyGuide {
  cardKind: RoomSourceKind
  purpose: string
  appearsOn: {
    routeTypes: ManualAtLeastOne<string>
    explanation: string
  }
  actionSemantics: ManualAtLeastOne<string>
  persistentStateMeanings: ManualAtLeastThree<ManualFamilyGuideStateMeaning>
  unavailableAndDisabledBehavior: string
  optimisticAndConfirmationBehavior: string
  safetyAndLimitations: {
    title: string
    text: string
  }
  troubleshootingChecks: ManualAtLeastThree<string>
  screenshotIds: ManualAtLeastOne<string>
  relatedArticleIds: ManualAtLeastOne<string>
}

export interface ManualSurfaceGuideNavigationItem {
  explanation: string
  label: string
  surfaceId: string
}

export interface ManualSurfaceGuide {
  howToOpen: ManualAtLeastOne<string>
  contents: ManualAtLeastTwo<string>
  navigation: {
    explanation: string
    tabs: readonly ManualSurfaceGuideNavigationItem[]
    detailPages: readonly ManualSurfaceGuideNavigationItem[]
    wizardSteps: readonly ManualSurfaceGuideNavigationItem[]
  }
  closeBackCancelBehavior: string
  homeAssistantOwnership: string
  stateAndDisabledBehavior: string
  safetyAndLimitations: {
    title: string
    text: string
  }
  troubleshootingChecks: ManualAtLeastThree<string>
  screenshotIds: ManualAtLeastOne<string>
  relatedArticleIds: ManualAtLeastOne<string>
}

export interface ManualBehaviorGuide {
  capability: string
  whenAndTriggers: ManualAtLeastOne<string>
  conditionsAndPreconditions: ManualAtLeastOne<string>
  householdEffects: ManualAtLeastOne<string>
  visibleAppSigns: ManualAtLeastOne<string>
  exceptionsGuestVacationAway: string
  overridePauseRecover: ManualAtLeastOne<string>
  notifications: string
  safetyAndLimitations: {
    title: string
    text: string
  }
  troubleshootingChecks: ManualAtLeastThree<string>
  affectedRoutes: ManualAtLeastOne<string>
  screenshotIds: readonly string[]
  relatedArticleIds: ManualAtLeastOne<string>
}

export type ManualTaskGuideScreenshotEvidence =
  | {
    screenshotIds: ManualAtLeastOne<string>
    nonvisualReason?: never
    missingDedicatedScreenshot?: string
  }
  | {
    screenshotIds: readonly []
    nonvisualReason: string
    missingDedicatedScreenshot?: never
  }

export interface ManualTaskGuide {
  workflowIds: ManualAtLeastOne<ManualTaskWorkflowId>
  canonicalQuestion: string
  prerequisites: ManualAtLeastOne<string>
  steps: ManualAtLeastThree<string>
  successConfirmation: ManualAtLeastOne<string>
  backCancelClosePath: string
  failureAndRecovery: ManualAtLeastOne<string>
  automaticBehaviorAndSideEffects: ManualAtLeastOne<string>
  safetyAndLimitations: {
    title: string
    text: string
  }
  screenshotEvidence: ManualTaskGuideScreenshotEvidence
  owningSurfaceIds: ManualAtLeastOne<string>
  relatedArticleIds: ManualAtLeastOne<string>
}

export type ManualFactId =
  | 'app-routes'
  | 'app-rooms'
  | 'automation-catalog'
  | 'device-families'
  | 'food-spaces'
  | 'integration-catalog'
  | 'presence-states'
  | 'schedule-types'
  | 'script-catalog'
  | 'wip-dependencies'

export type ManualBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; title: string; items: string[] }
  | { type: 'bullets'; title: string; items: string[] }
  | { type: 'callout'; title: string; text: string; tone: 'info' | 'warning' | 'development' }
  | { type: 'fact'; factId: ManualFactId; title: string }
  | { type: 'screenshot'; screenshotId: string }
  | { type: 'room-reference'; roomPath: string }
  | { type: 'overview-purpose'; text: string }
  | { type: 'overview-actions'; items: string[] }
  | { type: 'overview-automation'; items: string[] }
  | { type: 'overview-first-look'; items: { label: string; text: string }[] }
  | { type: 'overview-safety'; title: string; text: string }

export interface ManualSectionTask {
  articleId: string
  question: string
}

export interface ManualSectionGuideGroup {
  title: string
  summary?: string
  kinds?: ManualArticleKind[]
  articleIds?: string[]
  collapsed?: boolean
}

export interface ManualSectionLanding {
  canonicalArticleId: string
  primaryRoutePath?: string
  visualPolicy: 'required' | 'optional' | 'none'
  commonTasks: ManualSectionTask[]
  guideGroups: ManualSectionGuideGroup[]
  troubleshootingArticleId: string
  relatedSectionIds?: ManualSectionId[]
  technicalArticleIds?: string[]
  technicalDetailsTitle?: string
}

export interface ManualArticleBase {
  id: string
  kind: ManualArticleKind
  sectionId: ManualSectionId
  parentId?: string
  childArticleIds?: string[]
  title: string
  summary: string
  icon: string
  status: ManualArticleStatus
  aliases?: string[]
  visibleLabels?: string[]
  ownsSurfaceIds?: string[]
  stateMatrixIds?: string[]
  keywords: string[]
  tasks: string[]
  coversRoutes?: string[]
  blocks: ManualBlock[]
  relatedArticleIds?: string[]
}

export type ManualStandardArticleKind = Exclude<ManualArticleKind, 'page-guide' | 'family-guide' | 'surface-guide' | 'behavior-guide' | 'task-guide'>

export interface ManualStandardArticle extends ManualArticleBase {
  kind: ManualStandardArticleKind
  pageGuide?: never
  familyGuide?: never
  surfaceGuide?: never
  behaviorGuide?: never
  taskGuide?: never
}

export interface ManualPageGuideArticle extends ManualArticleBase {
  kind: 'page-guide'
  pageGuide: ManualPageGuide
  familyGuide?: never
  surfaceGuide?: never
  behaviorGuide?: never
  taskGuide?: never
  blocks: []
  relatedArticleIds?: never
}

export interface ManualFamilyGuideArticle extends ManualArticleBase {
  kind: 'family-guide'
  familyGuide: ManualFamilyGuide
  pageGuide?: never
  surfaceGuide?: never
  behaviorGuide?: never
  taskGuide?: never
  blocks: []
  relatedArticleIds?: never
}

export interface ManualSurfaceGuideArticle extends ManualArticleBase {
  kind: 'surface-guide'
  surfaceGuide: ManualSurfaceGuide
  pageGuide?: never
  familyGuide?: never
  behaviorGuide?: never
  taskGuide?: never
  blocks: []
  relatedArticleIds?: never
}

export interface ManualBehaviorGuideArticle extends ManualArticleBase {
  kind: 'behavior-guide'
  behaviorGuide: ManualBehaviorGuide
  pageGuide?: never
  familyGuide?: never
  surfaceGuide?: never
  taskGuide?: never
  blocks: []
  relatedArticleIds?: never
}

export interface ManualTaskGuideArticle extends ManualArticleBase {
  kind: 'task-guide'
  taskGuide: ManualTaskGuide
  pageGuide?: never
  familyGuide?: never
  surfaceGuide?: never
  behaviorGuide?: never
  blocks: []
  relatedArticleIds?: never
}

export type ManualArticle = ManualStandardArticle | ManualPageGuideArticle | ManualFamilyGuideArticle | ManualSurfaceGuideArticle | ManualBehaviorGuideArticle | ManualTaskGuideArticle

export interface ManualSection {
  id: ManualSectionId
  title: string
  summary: string
  icon: string
  backgroundColor: string
  browseGroups?: ManualSectionGuideGroup[]
  landing?: ManualSectionLanding
}

export interface ManualSurface {
  id: string
  kind: ManualSurfaceKind
  visibleName: string
  parentSurfaceId?: string
  routes: string[]
  implementation: string
  ownerArticleId?: string
  coverage: ManualSurfaceCoverage
  sourceIds?: string[]
  stateMatrixId?: string
  screenshotPolicy: 'none' | 'overview' | 'focused' | 'modal' | 'detail' | 'state' | 'wizard'
  screenshotPolicyReason?: string
}

export interface ManualHaCatalogItem {
  category: string
  id: string
  name: string
  classification: 'app-facing' | 'background-user-facing' | 'internal'
}

export interface ManualIntegrationCatalogItem {
  domain: string
  instances: number
  category: string
}

export interface ManualHaInventory {
  generatedAt: string
  homeAssistantVersion: string
  counts: {
    automations: number
    entities: number
    integrationDomains: number
    integrationInstances: number
    scripts: number
    todoLists: number
  }
  automations: ManualHaCatalogItem[]
  integrations: ManualIntegrationCatalogItem[]
  scripts: ManualHaCatalogItem[]
  services: string[]
}

export interface ManualHaCategorySummary {
  category: string
  count: number
  instances?: number
}

export interface ManualHaSummary {
  generatedAt: string
  counts: {
    automations: number
    integrationDomains: number
    integrationInstances: number
    scripts: number
    todoLists: number
  }
  automationCategories: ManualHaCategorySummary[]
  integrationCategories: ManualHaCategorySummary[]
  scriptCategories: ManualHaCategorySummary[]
  expectedDependencies: {
    recipeDetail: boolean
    recipeGroceryAdd: boolean
    recipeHydration: boolean
    recipeQuery: boolean
    vacuumAreaScripts: boolean
  }
}
