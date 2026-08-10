import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MODAL_OPENER_INVENTORY } from '../../src/constants/modalOpeners'
import { ROOM_PAGE_CONFIGS } from '../../src/constants/roomPages'
import { APP_MANUAL_ROUTE_PATH, DASHBOARD_ROUTES } from '../../src/constants/routes'
import { SETTINGS_PAGE_ITEMS } from '../../src/constants/portedDashboard'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID, MANUAL_SECTIONS } from '../../src/manual/catalog'
import {
  automaticBehaviorSurfaceId,
  isManualBehaviorGuideArticle,
  manualBehaviorGuideAuthoredTextValues,
  manualBehaviorGuideWordCount,
} from '../../src/manual/behaviorGuides'
import { MANUAL_EXCEPTIONS } from '../../src/manual/exceptions'
import {
  isManualFamilyGuideArticle,
  manualFamilyGuideAuthoredTextValues,
  manualFamilyGuideWordCount,
  ROOM_CARD_FAMILY_GUIDE_IDS,
} from '../../src/manual/familyGuides'
import {
  isManualPageGuideArticle,
  manualRoomPageGuideSimilarityPairs,
  manualRoomPageGuideSimilarityViolations,
  manualPageGuideWordCount,
  MANUAL_ROUTE_GUIDE_REMAINING_BUDGET,
  remainingManualPageGuideRoutePaths,
  ROOM_PAGE_GUIDE_NGRAM_SIZE,
  ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD,
} from '../../src/manual/pageGuides'
import { collectManualRenderedTextSources, manualLanguageQualityIssues } from '../../src/manual/languageQuality'
import {
  MANUAL_SCREENSHOT_FORBIDDEN_TEXT,
  MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET,
  MANUAL_SCREENSHOTS,
  manualScreenshotCoverageIssues,
  manualScreenshotSurfaceIds,
} from '../../src/manual/screenshots'
import { roomCardFamilyArticleId, roomCardFamilySurfaceId } from '../../src/manual/roomCardFamilies'
import { deriveSurfaceCoverage, formatDerivedSurfaceCoverage, manualOwnershipMatches } from '../../src/manual/surfaceCoverage'
import { collectDerivedSurfaceInventory, derivedSurfaceInventoriesMatch } from '../../src/manual/surfaceInventory'
import { CANONICAL_SURFACE_DEFINITIONS } from '../../src/manual/surfaceDefinitions'
import {
  isManualSurfaceGuideArticle,
  manualSurfaceGuideAuthoredTextValues,
  manualSurfaceGuideWordCount,
} from '../../src/manual/surfaceGuides'
import { MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET, MANUAL_SURFACES, MANUAL_SURFACES_BY_ID } from '../../src/manual/surfaces'
import {
  isManualTaskGuideArticle,
  MANUAL_TASK_GUIDE_MINIMUM_WORDS,
  manualTaskGuideAuthoredTextValues,
  manualTaskGuideWordCount,
} from '../../src/manual/taskGuides'
import { MANUAL_TASK_WORKFLOW_REGISTRY, type ManualTaskWorkflowId } from '../../src/manual/taskWorkflows'
import type { ManualArticle, ManualHaInventory, ManualPageGuideArticle, ManualSectionGuideGroup, ManualSectionId } from '../../src/manual/types'
import { explicitMockEntities, mockEntities } from '../../src/test/mocks/hakitCoreState'
import { generatedMockEntities } from '../../src/test/mocks/generated/appEntities'
import { collectManualAppInventory, type ManualAppInventory } from './appInventory'
import {
  buildBehaviorOwnershipAudit,
  normalizedBehaviorOwnershipAudit,
  type ManualBehaviorOwnershipAudit,
} from './behaviorOwnership'
import { checkScreenshotReviewApproval } from './screenshotReview'

const errors: string[] = []
const expectedDescription = 'Access guides, instructions, and details on how our Home Assistant instance and app work.'

if (SETTINGS_PAGE_ITEMS[0]?.title !== 'App Manual' || SETTINGS_PAGE_ITEMS[0]?.subtitle !== expectedDescription || SETTINGS_PAGE_ITEMS[0]?.path !== APP_MANUAL_ROUTE_PATH) {
  errors.push('App Manual must remain the first Settings item with the exact requested description.')
}

const sectionIds = new Set(MANUAL_SECTIONS.map((section) => section.id))
const articleIds = new Set<string>()
const screenshotIds = new Set(MANUAL_SCREENSHOTS.map((screenshot) => screenshot.id))
const screenshotQuestions = new Set<string>()
const screenshotConsumers = new Map<string, Set<string>>()
const entityId = /\b[a-z_]+\.[a-z0-9_]+\b/
const surfaceIds = new Set<string>()
const currentSurfaceInventory = collectDerivedSurfaceInventory()
const derivedSurfaceIds = new Set(currentSurfaceInventory.surfaces.map((surface) => surface.id))
const registeredScreenshotSurfaceIds = new Set([...MANUAL_SURFACES_BY_ID.keys(), ...derivedSurfaceIds])
const taskCanonicalQuestions = new Set<string>()
const taskOwningSurfaceArticles = new Map<string, string>()
const taskWorkflowArticles = new Map<ManualTaskWorkflowId, string[]>()
const taskWorkflowIds = new Set<ManualTaskWorkflowId>(MANUAL_TASK_WORKFLOW_REGISTRY.map((workflow) => workflow.id))

function wordCount(values: string[]) {
  return values.join(' ').trim().split(/\s+/).filter(Boolean).length
}

function pageGuideTextValues(article: ManualPageGuideArticle) {
  const guide = article.pageGuide
  return [
    guide.orientation,
    ...guide.visiblePageSectionNames,
    ...guide.whatYouCanDo,
    ...(guide.whatHappensAutomatically.mode === 'automatic'
      ? guide.whatHappensAutomatically.items
      : [guide.whatHappensAutomatically.explanation]),
    ...guide.lookHereFirst.flatMap((item) => [item.label, item.explanation]),
    guide.safetyAndLimitations.title,
    guide.safetyAndLimitations.text,
    ...guide.troubleshootingChecks,
  ]
}

function formatMockCoverageByDomain(entityIds: readonly string[], coveredEntityIds: ReadonlySet<string>) {
  const counts = new Map<string, { covered: number; total: number }>()
  for (const entityId of entityIds) {
    const domain = entityId.split('.', 1)[0] ?? 'unknown'
    const count = counts.get(domain) ?? { covered: 0, total: 0 }
    count.total += 1
    if (coveredEntityIds.has(entityId)) count.covered += 1
    counts.set(domain, count)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, count]) => `${domain}=${count.covered}/${count.total}`)
    .join(', ')
}

function overviewWordCount(section: (typeof MANUAL_SECTIONS)[number], article: ManualArticle) {
  const blockText = article.blocks.flatMap((block) => {
    if (block.type === 'overview-purpose') return [block.text]
    if (block.type === 'overview-actions' || block.type === 'overview-automation') return block.items
    if (block.type === 'overview-first-look') return block.items.flatMap((item) => [item.label, item.text])
    if (block.type === 'overview-safety') return [block.title, block.text]
    return []
  })
  return wordCount([
    section.summary,
    ...blockText,
    ...(section.landing?.commonTasks.map((task) => task.question) ?? []),
    ...(section.landing?.guideGroups.flatMap((group) => group.summary ? [group.summary] : []) ?? []),
  ])
}

for (const issue of manualLanguageQualityIssues(collectManualRenderedTextSources(MANUAL_ARTICLES, MANUAL_SECTIONS, MANUAL_SCREENSHOTS))) {
  errors.push(`${issue.source} contains banned household-manual language "${issue.term}".`)
}

function expandedGuideArticleIds(sectionId: ManualSectionId, groups: ManualSectionGuideGroup[], label: string, requireSameSection: boolean) {
  const groupedArticleIds = new Set<string>()
  for (const group of groups) {
    if ((!group.articleIds || group.articleIds.length === 0) && (!group.kinds || group.kinds.length === 0)) {
      errors.push(`${label} guide group "${group.title}" has no article ids or kinds.`)
    }
    const ids = new Set([
      ...(group.articleIds ?? []),
      ...MANUAL_ARTICLES.filter((article) => group.kinds?.includes(article.kind) && article.sectionId === sectionId).map((article) => article.id),
    ])
    if (ids.size === 0) errors.push(`${label} guide group "${group.title}" resolves to no articles.`)
    if (!group.collapsed && ids.size > 6) errors.push(`${label} guide group "${group.title}" exposes more than six consecutive rows.`)
    for (const id of ids) {
      const article = MANUAL_ARTICLES_BY_ID.get(id)
      if (!article) {
        errors.push(`${label} guide group "${group.title}" links missing article ${id}.`)
        continue
      }
      if (requireSameSection && article.sectionId !== sectionId) errors.push(`${label} guide group "${group.title}" includes ${id} from ${article.sectionId}.`)
      if (groupedArticleIds.has(id)) errors.push(`${label} guide groups include ${id} more than once.`)
      groupedArticleIds.add(id)
    }
  }
  return groupedArticleIds
}

for (const article of MANUAL_ARTICLES) {
  if (articleIds.has(article.id)) errors.push(`Duplicate manual article id: ${article.id}`)
  articleIds.add(article.id)
  if (!sectionIds.has(article.sectionId)) errors.push(`Unknown section ${article.sectionId} on ${article.id}`)
  if (!article.kind) errors.push(`Manual article ${article.id} has no hierarchy kind.`)
  if (article.parentId && !MANUAL_ARTICLES_BY_ID.has(article.parentId)) errors.push(`Manual article ${article.id} has missing parent ${article.parentId}.`)
  if (article.kind === 'component-guide' && article.ownsSurfaceIds?.length && !article.parentId) errors.push(`Component guide ${article.id} must have a parent article.`)
  if (article.tasks.length === 0) errors.push(`Manual article ${article.id} has no task questions.`)
  if (article.summary.length > 180) errors.push(`Manual article ${article.id} summary exceeds 180 characters.`)
  for (const id of article.relatedArticleIds ?? []) {
    if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Manual article ${article.id} links missing article ${id}.`)
  }
  if (isManualPageGuideArticle(article)) {
    const guide = article.pageGuide
    if (article.blocks.length !== 0) errors.push(`Page guide ${article.id} must keep all authored content in its structured pageGuide payload.`)
    if (article.tasks.length < 3) errors.push(`Page guide ${article.id} must provide at least three natural-language tasks.`)
    for (const task of article.tasks) {
      if (wordCount([task]) < 4 || !task.trim().endsWith('?')) errors.push(`Page guide ${article.id} task "${task}" must be a natural-language question of at least four words.`)
    }
    if (!guide.routePath.trim()) errors.push(`Page guide ${article.id} has no exact routePath.`)
    if (guide.generatedRoomPath) {
      if (!ROOM_PAGE_CONFIGS[guide.generatedRoomPath]) errors.push(`Room page guide ${article.id} references unknown generated room ${guide.generatedRoomPath}.`)
      if (guide.generatedRoomPath !== guide.routePath) errors.push(`Room page guide ${article.id} appendix path ${guide.generatedRoomPath} must match routePath ${guide.routePath}.`)
      if (article.id !== `room-${guide.generatedRoomPath}`) errors.push(`Room page guide ${article.id} must preserve stable id room-${guide.generatedRoomPath}.`)
    }
    if (!guide.orientation.trim()) errors.push(`Page guide ${article.id} has no authored orientation.`)
    if (guide.visiblePageSectionNames.length === 0) errors.push(`Page guide ${article.id} names no visible page sections.`)
    if (new Set(guide.visiblePageSectionNames).size !== guide.visiblePageSectionNames.length) errors.push(`Page guide ${article.id} repeats a visible page section name.`)
    if (guide.whatYouCanDo.length < 4) errors.push(`Page guide ${article.id} must explain at least four things the user can do.`)
    if (guide.whatHappensAutomatically.mode === 'automatic' && guide.whatHappensAutomatically.items.length < 2) {
      errors.push(`Page guide ${article.id} must explain at least two automatic behaviors.`)
    }
    if (guide.whatHappensAutomatically.mode === 'none' && wordCount([guide.whatHappensAutomatically.explanation]) < 8) {
      errors.push(`Purely navigational page guide ${article.id} must explain why no automatic behavior occurs.`)
    }
    if (guide.lookHereFirst.length < 3) errors.push(`Page guide ${article.id} must provide at least three Look Here First entries.`)
    for (const item of guide.lookHereFirst) {
      if (!item.label.trim() || !item.explanation.trim()) errors.push(`Page guide ${article.id} has an incomplete Look Here First entry.`)
    }
    if (!guide.safetyAndLimitations.title.trim() || !guide.safetyAndLimitations.text.trim()) errors.push(`Page guide ${article.id} must explain safety or limitations.`)
    if (guide.troubleshootingChecks.length < 3) errors.push(`Page guide ${article.id} must provide at least three troubleshooting checks.`)
    if (guide.screenshotIds.length === 0) errors.push(`Page guide ${article.id} must register at least one relevant screenshot.`)
    if (new Set(guide.screenshotIds).size !== guide.screenshotIds.length) errors.push(`Page guide ${article.id} repeats a screenshot id.`)
    for (const screenshotId of guide.screenshotIds) {
      if (!screenshotIds.has(screenshotId)) errors.push(`Page guide ${article.id} references missing screenshot ${screenshotId}.`)
      const consumers = screenshotConsumers.get(screenshotId) ?? new Set<string>()
      consumers.add(article.id)
      screenshotConsumers.set(screenshotId, consumers)
    }
    if (guide.relatedArticleIds.length === 0) errors.push(`Page guide ${article.id} must link at least one related family, task, or behavior guide.`)
    for (const id of guide.relatedArticleIds) {
      if (id === article.id) errors.push(`Page guide ${article.id} must not link itself as a related guide.`)
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Page guide ${article.id} links missing article ${id}.`)
    }
    const minimumWords = guide.generatedRoomPath ? (guide.complexity === 'complex' ? 350 : 300) : guide.complexity === 'complex' ? 350 : 250
    const words = manualPageGuideWordCount(article)
    if (words < minimumWords) errors.push(`Page guide ${article.id} has ${words} authored words; expected at least ${minimumWords} for ${guide.complexity} complexity.`)
    for (const text of pageGuideTextValues(article)) {
      if (entityId.test(text)) errors.push(`Page guide ${article.id} puts a raw entity id in household prose.`)
    }
  }
  if (isManualFamilyGuideArticle(article)) {
    const guide = article.familyGuide
    if (article.blocks.length !== 0) errors.push(`Family guide ${article.id} must keep all authored content in its structured familyGuide payload.`)
    if (article.tasks.length < 3) errors.push(`Family guide ${article.id} must provide at least three natural-language tasks.`)
    for (const task of article.tasks) {
      if (wordCount([task]) < 4 || !task.trim().endsWith('?')) errors.push(`Family guide ${article.id} task "${task}" must be a natural-language question of at least four words.`)
    }
    if (!guide.purpose.trim()) errors.push(`Family guide ${article.id} has no purpose.`)
    if (guide.appearsOn.routeTypes.length === 0 || !guide.appearsOn.explanation.trim()) errors.push(`Family guide ${article.id} must explain where it appears and name at least one route type.`)
    if (guide.actionSemantics.length === 0) errors.push(`Family guide ${article.id} has no action semantics.`)
    if (guide.persistentStateMeanings.length < 3) errors.push(`Family guide ${article.id} must explain at least three persistent state meanings.`)
    for (const state of guide.persistentStateMeanings) {
      if (!state.label.trim() || !state.meaning.trim()) errors.push(`Family guide ${article.id} has an incomplete persistent state meaning.`)
    }
    if (!guide.unavailableAndDisabledBehavior.trim()) errors.push(`Family guide ${article.id} must explain unavailable and disabled behavior.`)
    if (!guide.optimisticAndConfirmationBehavior.trim()) errors.push(`Family guide ${article.id} must explain optimistic and confirmation behavior.`)
    if (!guide.safetyAndLimitations.title.trim() || !guide.safetyAndLimitations.text.trim()) errors.push(`Family guide ${article.id} must explain safety or limitations.`)
    if (guide.troubleshootingChecks.length < 3) errors.push(`Family guide ${article.id} must provide at least three troubleshooting checks.`)
    if (guide.screenshotIds.length === 0) errors.push(`Family guide ${article.id} must register at least one relevant screenshot.`)
    if (new Set(guide.screenshotIds).size !== guide.screenshotIds.length) errors.push(`Family guide ${article.id} repeats a screenshot id.`)
    for (const screenshotId of guide.screenshotIds) {
      if (!screenshotIds.has(screenshotId)) errors.push(`Family guide ${article.id} references missing screenshot ${screenshotId}.`)
      const consumers = screenshotConsumers.get(screenshotId) ?? new Set<string>()
      consumers.add(article.id)
      screenshotConsumers.set(screenshotId, consumers)
    }
    if (guide.relatedArticleIds.length === 0) errors.push(`Family guide ${article.id} must link at least one related guide.`)
    for (const id of guide.relatedArticleIds) {
      if (id === article.id) errors.push(`Family guide ${article.id} must not link itself as a related guide.`)
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Family guide ${article.id} links missing article ${id}.`)
    }
    const words = manualFamilyGuideWordCount(article)
    if (words < 200) errors.push(`Family guide ${article.id} has ${words} authored words; expected at least 200.`)
    for (const text of manualFamilyGuideAuthoredTextValues(article)) {
      if (entityId.test(text)) errors.push(`Family guide ${article.id} puts a raw entity id in household prose.`)
    }
  }
  if (isManualSurfaceGuideArticle(article)) {
    const guide = article.surfaceGuide
    if (article.blocks.length !== 0) errors.push(`Surface guide ${article.id} must keep all authored content in its structured surfaceGuide payload.`)
    if (article.tasks.length < 2) errors.push(`Surface guide ${article.id} must provide at least two natural-language tasks.`)
    for (const task of article.tasks) {
      if (wordCount([task]) < 4 || !task.trim().endsWith('?')) errors.push(`Surface guide ${article.id} task "${task}" must be a natural-language question of at least four words.`)
    }
    if (guide.howToOpen.length === 0) errors.push(`Surface guide ${article.id} must explain how to open the surface.`)
    if (guide.contents.length < 2) errors.push(`Surface guide ${article.id} must explain at least two contents or controls.`)
    if (!guide.navigation.explanation.trim()) errors.push(`Surface guide ${article.id} must explain tab, detail, or wizard navigation.`)
    const navigationItems = [...guide.navigation.tabs, ...guide.navigation.detailPages, ...guide.navigation.wizardSteps]
    if (new Set(navigationItems.map((item) => item.surfaceId)).size !== navigationItems.length) errors.push(`Surface guide ${article.id} repeats a navigation surface id.`)
    for (const item of navigationItems) {
      if (!item.label.trim() || wordCount([item.explanation]) < 6) errors.push(`Surface guide ${article.id} has an incomplete navigation explanation for ${item.surfaceId}.`)
    }
    if (!guide.closeBackCancelBehavior.trim()) errors.push(`Surface guide ${article.id} must explain close, Back, and Cancel behavior.`)
    if (!guide.homeAssistantOwnership.trim()) errors.push(`Surface guide ${article.id} must explain Home Assistant ownership.`)
    if (!guide.stateAndDisabledBehavior.trim()) errors.push(`Surface guide ${article.id} must explain state and disabled behavior.`)
    if (!guide.safetyAndLimitations.title.trim() || !guide.safetyAndLimitations.text.trim()) errors.push(`Surface guide ${article.id} must explain safety or limitations.`)
    if (guide.troubleshootingChecks.length < 3) errors.push(`Surface guide ${article.id} must provide at least three troubleshooting checks.`)
    if (guide.screenshotIds.length === 0) errors.push(`Surface guide ${article.id} must register at least one relevant screenshot.`)
    if (new Set(guide.screenshotIds).size !== guide.screenshotIds.length) errors.push(`Surface guide ${article.id} repeats a screenshot id.`)
    for (const screenshotId of guide.screenshotIds) {
      if (!screenshotIds.has(screenshotId)) errors.push(`Surface guide ${article.id} references missing screenshot ${screenshotId}.`)
      const consumers = screenshotConsumers.get(screenshotId) ?? new Set<string>()
      consumers.add(article.id)
      screenshotConsumers.set(screenshotId, consumers)
    }
    if (guide.relatedArticleIds.length === 0) errors.push(`Surface guide ${article.id} must link at least one related guide.`)
    for (const id of guide.relatedArticleIds) {
      if (id === article.id) errors.push(`Surface guide ${article.id} must not link itself as a related guide.`)
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Surface guide ${article.id} links missing article ${id}.`)
    }
    const words = manualSurfaceGuideWordCount(article)
    if (words < 180) errors.push(`Surface guide ${article.id} has ${words} authored words; expected at least 180.`)
    for (const text of manualSurfaceGuideAuthoredTextValues(article)) {
      if (entityId.test(text)) errors.push(`Surface guide ${article.id} puts a raw entity id in household prose.`)
    }
  }
  if (isManualBehaviorGuideArticle(article)) {
    const guide = article.behaviorGuide
    if (article.blocks.length !== 0) errors.push(`Behavior guide ${article.id} must keep all authored content in its structured behaviorGuide payload.`)
    if (article.tasks.length < 2) errors.push(`Behavior guide ${article.id} must provide at least two natural-language tasks.`)
    for (const task of article.tasks) {
      if (wordCount([task]) < 4 || !task.trim().endsWith('?')) errors.push(`Behavior guide ${article.id} task "${task}" must be a natural-language question of at least four words.`)
    }
    if (!guide.capability.trim()) errors.push(`Behavior guide ${article.id} must explain the capability.`)
    if (guide.whenAndTriggers.length === 0) errors.push(`Behavior guide ${article.id} must explain when it runs.`)
    if (guide.conditionsAndPreconditions.length === 0) errors.push(`Behavior guide ${article.id} must explain conditions and preconditions.`)
    if (guide.householdEffects.length === 0) errors.push(`Behavior guide ${article.id} must explain household effects.`)
    if (guide.visibleAppSigns.length === 0) errors.push(`Behavior guide ${article.id} must explain visible app signs.`)
    if (!guide.exceptionsGuestVacationAway.trim()) errors.push(`Behavior guide ${article.id} must explain guest, Vacation, and Away interactions.`)
    if (guide.overridePauseRecover.length === 0) errors.push(`Behavior guide ${article.id} must explain override, pause, or recovery behavior.`)
    if (!guide.notifications.trim()) errors.push(`Behavior guide ${article.id} must explain notifications.`)
    if (!guide.safetyAndLimitations.title.trim() || !guide.safetyAndLimitations.text.trim()) errors.push(`Behavior guide ${article.id} must explain safety or limitations.`)
    if (guide.troubleshootingChecks.length < 3) errors.push(`Behavior guide ${article.id} must provide at least three troubleshooting checks.`)
    if (guide.affectedRoutes.length === 0) errors.push(`Behavior guide ${article.id} must name at least one affected route.`)
    if (new Set(guide.affectedRoutes).size !== guide.affectedRoutes.length) errors.push(`Behavior guide ${article.id} repeats an affected route.`)
    for (const route of guide.affectedRoutes) {
      if (!DASHBOARD_ROUTES.some((candidate) => candidate.path === route)) errors.push(`Behavior guide ${article.id} references unknown affected route ${route}.`)
    }
    if (JSON.stringify(article.coversRoutes ?? []) !== JSON.stringify(guide.affectedRoutes)) errors.push(`Behavior guide ${article.id} coversRoutes must exactly match affectedRoutes.`)
    if (new Set(guide.screenshotIds).size !== guide.screenshotIds.length) errors.push(`Behavior guide ${article.id} repeats a screenshot id.`)
    for (const screenshotId of guide.screenshotIds) {
      if (!screenshotIds.has(screenshotId)) errors.push(`Behavior guide ${article.id} references missing screenshot ${screenshotId}.`)
      const consumers = screenshotConsumers.get(screenshotId) ?? new Set<string>()
      consumers.add(article.id)
      screenshotConsumers.set(screenshotId, consumers)
    }
    if (guide.relatedArticleIds.length === 0) errors.push(`Behavior guide ${article.id} must link at least one related guide.`)
    for (const id of guide.relatedArticleIds) {
      if (id === article.id) errors.push(`Behavior guide ${article.id} must not link itself as a related guide.`)
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Behavior guide ${article.id} links missing article ${id}.`)
    }
    const words = manualBehaviorGuideWordCount(article)
    if (words < 220) errors.push(`Behavior guide ${article.id} has ${words} authored words; expected at least 220.`)
    for (const text of manualBehaviorGuideAuthoredTextValues(article)) {
      if (entityId.test(text)) errors.push(`Behavior guide ${article.id} puts a raw entity, automation, or script id in household prose.`)
    }
    const surfaceId = automaticBehaviorSurfaceId(article.id)
    const surface = MANUAL_SURFACES_BY_ID.get(surfaceId)
    if (!surface || surface.kind !== 'automatic-behavior' || surface.ownerArticleId !== article.id) {
      errors.push(`Behavior guide ${article.id} must own automatic behavior surface ${surfaceId}.`)
    }
  }
  if (isManualTaskGuideArticle(article)) {
    const guide = article.taskGuide
    if (article.blocks.length !== 0) errors.push(`Task guide ${article.id} must keep all authored content in its structured taskGuide payload.`)
    if (article.tasks.length !== 1 || article.tasks[0] !== guide.canonicalQuestion) {
      errors.push(`Task guide ${article.id} must expose only its canonical question in article.tasks.`)
    }
    if (wordCount([guide.canonicalQuestion]) < 5 || !guide.canonicalQuestion.trim().endsWith('?')) {
      errors.push(`Task guide ${article.id} canonical question must be a natural-language question of at least five words.`)
    }
    const normalizedQuestion = guide.canonicalQuestion.trim().toLowerCase()
    if (taskCanonicalQuestions.has(normalizedQuestion)) errors.push(`Task guide ${article.id} duplicates canonical question "${guide.canonicalQuestion}".`)
    taskCanonicalQuestions.add(normalizedQuestion)
    if (guide.workflowIds.length === 0) errors.push(`Task guide ${article.id} must cover at least one registered workflow.`)
    if (new Set(guide.workflowIds).size !== guide.workflowIds.length) errors.push(`Task guide ${article.id} repeats a workflow id.`)
    for (const workflowId of guide.workflowIds) {
      if (!taskWorkflowIds.has(workflowId)) errors.push(`Task guide ${article.id} references unknown workflow ${workflowId}.`)
      const owners = taskWorkflowArticles.get(workflowId) ?? []
      owners.push(article.id)
      taskWorkflowArticles.set(workflowId, owners)
    }
    if (guide.prerequisites.length === 0) errors.push(`Task guide ${article.id} must provide prerequisites.`)
    if (guide.steps.length < 3) errors.push(`Task guide ${article.id} must provide at least three numbered steps.`)
    if (guide.successConfirmation.length === 0) errors.push(`Task guide ${article.id} must explain expected success or confirmation.`)
    if (!guide.backCancelClosePath.trim()) errors.push(`Task guide ${article.id} must explain the Back, Cancel, or close path.`)
    if (guide.failureAndRecovery.length === 0) errors.push(`Task guide ${article.id} must explain failure and recovery.`)
    if (guide.automaticBehaviorAndSideEffects.length === 0) errors.push(`Task guide ${article.id} must explain automatic behavior or side effects.`)
    if (!guide.safetyAndLimitations.title.trim() || !guide.safetyAndLimitations.text.trim()) errors.push(`Task guide ${article.id} must explain safety or limitations.`)
    if (guide.owningSurfaceIds.length === 0) errors.push(`Task guide ${article.id} must bind at least one owning surface.`)
    if (new Set(guide.owningSurfaceIds).size !== guide.owningSurfaceIds.length) errors.push(`Task guide ${article.id} repeats an owning surface.`)
    for (const surfaceId of guide.owningSurfaceIds) {
      if (!MANUAL_SURFACES_BY_ID.has(surfaceId)) errors.push(`Task guide ${article.id} references unknown owning surface ${surfaceId}.`)
      const previousOwner = taskOwningSurfaceArticles.get(surfaceId)
      if (previousOwner) errors.push(`Task guide owning surface ${surfaceId} is duplicated by ${previousOwner} and ${article.id}.`)
      else taskOwningSurfaceArticles.set(surfaceId, article.id)
    }
    if (guide.relatedArticleIds.length === 0) errors.push(`Task guide ${article.id} must link at least one related guide.`)
    if (new Set(guide.relatedArticleIds).size !== guide.relatedArticleIds.length) errors.push(`Task guide ${article.id} repeats a related guide.`)
    for (const id of guide.relatedArticleIds) {
      if (id === article.id) errors.push(`Task guide ${article.id} must not link itself as a related guide.`)
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Task guide ${article.id} links missing article ${id}.`)
    }
    const evidence = guide.screenshotEvidence
    if (evidence.screenshotIds.length === 0) {
      if (!evidence.nonvisualReason || wordCount([evidence.nonvisualReason]) < 10) {
        errors.push(`Task guide ${article.id} without screenshots must provide an explicit nonvisual reason of at least ten words.`)
      }
      if (evidence.missingDedicatedScreenshot) errors.push(`Task guide ${article.id} cannot declare an image gap when it is explicitly nonvisual.`)
    } else {
      if (evidence.nonvisualReason) errors.push(`Task guide ${article.id} cannot combine screenshots with a nonvisual reason.`)
      if (new Set(evidence.screenshotIds).size !== evidence.screenshotIds.length) errors.push(`Task guide ${article.id} repeats a screenshot id.`)
      for (const screenshotId of evidence.screenshotIds) {
        if (!screenshotIds.has(screenshotId)) errors.push(`Task guide ${article.id} references missing screenshot ${screenshotId}.`)
        const consumers = screenshotConsumers.get(screenshotId) ?? new Set<string>()
        consumers.add(article.id)
        screenshotConsumers.set(screenshotId, consumers)
      }
      if (evidence.missingDedicatedScreenshot && wordCount([evidence.missingDedicatedScreenshot]) < 8) {
        errors.push(`Task guide ${article.id} image-phase gap must explain the missing dedicated screenshot.`)
      }
    }
    const words = manualTaskGuideWordCount(article)
    if (words < MANUAL_TASK_GUIDE_MINIMUM_WORDS) {
      errors.push(`Task guide ${article.id} has ${words} authored words; expected at least ${MANUAL_TASK_GUIDE_MINIMUM_WORDS}.`)
    }
    for (const text of manualTaskGuideAuthoredTextValues(article)) {
      if (entityId.test(text)) errors.push(`Task guide ${article.id} puts a raw backend id in household prose.`)
    }
  }
  for (const block of article.blocks) {
    if (block.type === 'screenshot') {
      if (!screenshotIds.has(block.screenshotId)) errors.push(`Manual article ${article.id} references missing screenshot ${block.screenshotId}.`)
      const consumers = screenshotConsumers.get(block.screenshotId) ?? new Set<string>()
      consumers.add(article.id)
      screenshotConsumers.set(block.screenshotId, consumers)
    }

    if ((block.type === 'paragraph' || block.type === 'callout') && entityId.test(block.text)) errors.push(`Manual article ${article.id} puts a raw entity id in household prose.`)
  }
}

for (const workflow of MANUAL_TASK_WORKFLOW_REGISTRY) {
  const owners = taskWorkflowArticles.get(workflow.id) ?? []
  if (owners.length !== 1) {
    errors.push(`Task workflow ${workflow.id} must resolve to exactly one task-guide article; found ${owners.length}: ${owners.join(', ') || 'none'}.`)
  }
}
console.log(`App Manual task-guide contract: ${MANUAL_TASK_WORKFLOW_REGISTRY.length - MANUAL_TASK_WORKFLOW_REGISTRY.filter((workflow) => (taskWorkflowArticles.get(workflow.id) ?? []).length !== 1).length}/${MANUAL_TASK_WORKFLOW_REGISTRY.length} workflows resolve to exactly one task guide.`)

const roomGuideSimilarityPairs = manualRoomPageGuideSimilarityPairs(MANUAL_ARTICLES)
const roomGuideSimilarityViolations = manualRoomPageGuideSimilarityViolations(MANUAL_ARTICLES)
const maximumRoomGuideSimilarity = roomGuideSimilarityPairs.reduce((maximum, pair) => Math.max(maximum, pair.similarity), 0)
for (const pair of roomGuideSimilarityViolations) {
  errors.push(`Room page guides ${pair.leftArticleId} and ${pair.rightArticleId} have normalized similarity ${pair.similarity.toFixed(3)}, above the ${ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD.toFixed(2)} anti-template threshold.`)
}
console.log(`App Manual room-guide uniqueness: maximum normalized ${ROOM_PAGE_GUIDE_NGRAM_SIZE}-gram Jaccard similarity ${maximumRoomGuideSimilarity.toFixed(3)} (threshold ${ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD.toFixed(2)}).`)

const seenSectionIds = new Set<string>()
for (const section of MANUAL_SECTIONS) {
  if (seenSectionIds.has(section.id)) errors.push(`Duplicate manual section id: ${section.id}`)
  seenSectionIds.add(section.id)

  if (section.landing) {
    const canonical = MANUAL_ARTICLES_BY_ID.get(section.landing.canonicalArticleId)
    if (!canonical) {
      errors.push(`Manual section ${section.id} has missing canonical article ${section.landing.canonicalArticleId}.`)
      continue
    }
    if (canonical.sectionId !== section.id) errors.push(`Manual section ${section.id} canonical article ${canonical.id} belongs to ${canonical.sectionId}.`)
    if (canonical.kind !== 'section-overview') errors.push(`Manual section ${section.id} canonical article ${canonical.id} must use section-overview kind.`)

    const renderedBlockTypes = new Set(['overview-purpose', 'overview-actions', 'overview-automation', 'overview-first-look', 'overview-safety', 'screenshot'])
    for (const block of canonical.blocks) {
      if (!renderedBlockTypes.has(block.type)) errors.push(`Manual section ${section.id} canonical article contains non-renderable ${block.type} content.`)
    }

    const requiredBlockTypes = ['overview-purpose', 'overview-actions', 'overview-automation', 'overview-first-look'] as const
    const requiredBlockIndexes = requiredBlockTypes.map((type) => canonical.blocks.findIndex((block) => block.type === type))
    for (const [index, type] of requiredBlockTypes.entries()) {
      const matches = canonical.blocks.filter((block) => block.type === type)
      if (matches.length !== 1) errors.push(`Manual section ${section.id} canonical article must contain exactly one ${type} block.`)
      if (index > 0 && requiredBlockIndexes[index] <= requiredBlockIndexes[index - 1]) errors.push(`Manual section ${section.id} overview blocks are out of order around ${type}.`)
    }
    const actionBlock = canonical.blocks.find((block) => block.type === 'overview-actions')
    const automationBlock = canonical.blocks.find((block) => block.type === 'overview-automation')
    const firstLookBlock = canonical.blocks.find((block) => block.type === 'overview-first-look')
    const safetyBlocks = canonical.blocks.filter((block) => block.type === 'overview-safety')
    if (actionBlock?.type === 'overview-actions' && actionBlock.items.length < 4) errors.push(`Manual section ${section.id} must explain at least four things the user can do.`)
    if (automationBlock?.type === 'overview-automation' && automationBlock.items.length < 3) errors.push(`Manual section ${section.id} must explain at least three automatic behaviors.`)
    if (firstLookBlock?.type === 'overview-first-look' && firstLookBlock.items.length < 4) errors.push(`Manual section ${section.id} must explain at least four first-look states or places.`)
    if (safetyBlocks.length !== 1) errors.push(`Manual section ${section.id} must contain exactly one safety or important-limitation block.`)

    const landingScreenshots = MANUAL_SCREENSHOTS.filter((screenshot) => screenshot.landingUse?.sectionId === section.id)
    const contextScreenshots = landingScreenshots.filter((screenshot) => screenshot.role === 'context')
    if (section.landing.visualPolicy === 'required' && contextScreenshots.length !== 1) errors.push(`Manual section ${section.id} requires exactly one context screenshot.`)
    for (const screenshot of landingScreenshots) {
      if (screenshot.articleId !== canonical.id) errors.push(`Landing screenshot ${screenshot.id} must be owned by ${canonical.id}.`)
      if (!canonical.blocks.some((block) => block.type === 'screenshot' && block.screenshotId === screenshot.id)) errors.push(`Landing screenshot ${screenshot.id} is not consumed by ${canonical.id}.`)
    }
    const contextBlockIndex = canonical.blocks.findIndex((block) => block.type === 'screenshot' && contextScreenshots.some((screenshot) => screenshot.id === block.screenshotId))
    if (contextScreenshots.length === 1 && (contextBlockIndex <= requiredBlockIndexes[0] || contextBlockIndex >= requiredBlockIndexes[1])) {
      errors.push(`Manual section ${section.id} context screenshot must follow purpose and precede actions.`)
    }
    const screenshotBlockCount = canonical.blocks.filter((block) => block.type === 'screenshot').length
    const minimumScreenshotCount = section.id === 'help' ? 1 : 2
    if (screenshotBlockCount < minimumScreenshotCount) errors.push(`Manual section ${section.id} must display at least ${minimumScreenshotCount} screenshot ${minimumScreenshotCount === 1 ? 'subject' : 'subjects'}.`)

    if (section.landing.commonTasks.length < 4 || section.landing.commonTasks.length > 6) errors.push(`Manual section ${section.id} must expose four to six common tasks.`)
    const taskQuestions = new Set<string>()
    for (const task of section.landing.commonTasks) {
      const taskArticle = MANUAL_ARTICLES_BY_ID.get(task.articleId)
      if (!taskArticle) errors.push(`Manual section ${section.id} common task links missing article ${task.articleId}.`)
      if (taskArticle && isManualTaskGuideArticle(taskArticle) && task.question !== taskArticle.taskGuide.canonicalQuestion) {
        errors.push(`Manual section ${section.id} common task for ${task.articleId} must use its canonical question exactly.`)
      }
      if (task.articleId === canonical.id) errors.push(`Manual section ${section.id} common task "${task.question}" links back to its own landing.`)
      if (taskQuestions.has(task.question)) errors.push(`Manual section ${section.id} repeats common task "${task.question}".`)
      taskQuestions.add(task.question)
    }

    const groupedArticleIds = expandedGuideArticleIds(section.id, section.landing.guideGroups, `Manual section ${section.id}`, false)
    const separatelyRenderedIds = new Set([
      canonical.id,
      section.landing.troubleshootingArticleId,
      ...(section.landing.technicalArticleIds ?? []),
      ...section.landing.commonTasks.map((task) => task.articleId),
      ...groupedArticleIds,
    ])
    const ungroupedCount = MANUAL_ARTICLES.filter((article) => article.sectionId === section.id && !separatelyRenderedIds.has(article.id)).length
    if (ungroupedCount > 6) errors.push(`Manual section ${section.id} exposes more than six ungrouped guide rows.`)
    for (const id of canonical.relatedArticleIds ?? []) {
      if (!separatelyRenderedIds.has(id)) errors.push(`Manual section ${section.id} canonical related article ${id} is not reachable from the landing.`)
    }

    if (!MANUAL_ARTICLES_BY_ID.has(section.landing.troubleshootingArticleId)) errors.push(`Manual section ${section.id} links missing troubleshooting article ${section.landing.troubleshootingArticleId}.`)
    for (const id of section.landing.technicalArticleIds ?? []) {
      if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Manual section ${section.id} links missing technical article ${id}.`)
    }
    for (const id of section.landing.relatedSectionIds ?? []) {
      if (!sectionIds.has(id)) errors.push(`Manual section ${section.id} links missing related section ${id}.`)
    }

    if (!section.landing.primaryRoutePath) {
      errors.push(`Manual section ${section.id} has no primary route binding.`)
    } else {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === section.landing?.primaryRoutePath)
      if (!route) errors.push(`Manual section ${section.id} points to unknown route ${section.landing.primaryRoutePath}.`)
      else if (!MANUAL_ARTICLES_BY_ID.has(route.manualArticleId)) errors.push(`Manual section ${section.id} route ${route.path} points to missing article ${route.manualArticleId}.`)
      else if (!separatelyRenderedIds.has(route.manualArticleId)) errors.push(`Manual section ${section.id} route ${route.path} article ${route.manualArticleId} is not reachable from the landing.`)
    }

    const words = overviewWordCount(section, canonical)
    if (words < 250 || words > 450) errors.push(`Manual section ${section.id} landing has ${words} authored words; expected 250-450.`)
  } else {
    errors.push(`Manual section ${section.id} must define a rich landing.`)
  }

  if (section.browseGroups) {
    const groupedArticleIds = expandedGuideArticleIds(section.id, section.browseGroups, `Manual section ${section.id}`, true)
    const ungrouped = MANUAL_ARTICLES.filter((article) => article.sectionId === section.id && !groupedArticleIds.has(article.id))
    if (ungrouped.length > 0) errors.push(`Manual section ${section.id} browse groups omit: ${ungrouped.map((article) => article.id).join(', ')}.`)
  }
}

const routeEntriesByPath = new Map<string, typeof DASHBOARD_ROUTES>()
for (const route of DASHBOARD_ROUTES) {
  const entries = routeEntriesByPath.get(route.path) ?? []
  entries.push(route)
  routeEntriesByPath.set(route.path, entries)
  const article = MANUAL_ARTICLES_BY_ID.get(route.manualArticleId)
  if (!article) {
    errors.push(`Dashboard route ${route.path} points to missing manual article ${route.manualArticleId}.`)
    continue
  }
  if (isManualPageGuideArticle(article)) {
    if (article.pageGuide.routePath !== route.path) errors.push(`Dashboard route ${route.path} points to page guide ${article.id}, which claims ${article.pageGuide.routePath}.`)
    if (!route.manualVisibleSectionNames || route.manualVisibleSectionNames.length === 0) {
      errors.push(`Dashboard route ${route.path} has a page guide but no route-specific visible section baseline.`)
    } else if (JSON.stringify(route.manualVisibleSectionNames) !== JSON.stringify(article.pageGuide.visiblePageSectionNames)) {
      errors.push(`Page guide ${article.id} does not cover the exact visible sections for ${route.path}. Expected: ${route.manualVisibleSectionNames.join(', ')}. Actual: ${article.pageGuide.visiblePageSectionNames.join(', ')}.`)
    }
  } else if (route.manualVisibleSectionNames?.length) {
    errors.push(`Dashboard route ${route.path} declares page-guide section coverage but points to non-page-guide article ${article.id}.`)
  }
}
for (const [path, entries] of routeEntriesByPath) {
  if (entries.length !== 1) errors.push(`Dashboard route path ${path} must have exactly one DASHBOARD_ROUTES entry; found ${entries.length}.`)
}

const pageGuideArticles = MANUAL_ARTICLES.filter(isManualPageGuideArticle)
for (const article of pageGuideArticles) {
  const guide = article.pageGuide
  const pathRoutes = DASHBOARD_ROUTES.filter((route) => route.path === guide.routePath)
  const ownerRoutes = DASHBOARD_ROUTES.filter((route) => route.manualArticleId === article.id)
  if (pathRoutes.length !== 1) errors.push(`Page guide ${article.id} routePath ${guide.routePath} must resolve to exactly one dashboard route; found ${pathRoutes.length}.`)
  if (ownerRoutes.length === 0) errors.push(`Page guide ${article.id} is not the manualArticleId owner of route ${guide.routePath}.`)
  if (ownerRoutes.length > 1) errors.push(`Page guide ${article.id} claims multiple dashboard routes: ${ownerRoutes.map((route) => route.path).join(', ')}.`)
  if (ownerRoutes.length === 1 && ownerRoutes[0].path !== guide.routePath) errors.push(`Page guide ${article.id} route mismatch: payload claims ${guide.routePath}, but DASHBOARD_ROUTES binds ${ownerRoutes[0].path}.`)
  if (JSON.stringify(article.coversRoutes ?? []) !== JSON.stringify([guide.routePath])) errors.push(`Page guide ${article.id} coversRoutes must contain only ${guide.routePath}.`)

  const routeSurfaceId = `route:${guide.routePath}`
  const manualRouteSurface = MANUAL_SURFACES_BY_ID.get(routeSurfaceId)
  if (!manualRouteSurface || manualRouteSurface.kind !== 'route') {
    errors.push(`Completed page guide ${article.id} has no covered manual route surface ${routeSurfaceId}.`)
  } else if (manualRouteSurface.ownerArticleId !== article.id) {
    errors.push(`Manual route surface ${routeSurfaceId} must be owned by page guide ${article.id}.`)
  }
  const derivedRouteSurface = currentSurfaceInventory.surfaces.find((surface) => surface.id === routeSurfaceId)
  const ownershipMatches = derivedRouteSurface
    ? [...new Set(manualOwnershipMatches(derivedRouteSurface, MANUAL_SURFACES).map((match) => match.manualSurfaceId))]
    : []
  if (!derivedRouteSurface) errors.push(`Page guide ${article.id} has no derived route surface ${routeSurfaceId}.`)
  else if (ownershipMatches.length !== 1 || ownershipMatches[0] !== routeSurfaceId) {
    errors.push(`Derived route ${routeSurfaceId} must have exactly one page-guide route owner; matched ${ownershipMatches.join(', ') || 'none'}.`)
  }
}

const remainingPageGuideRoutePaths = remainingManualPageGuideRoutePaths(DASHBOARD_ROUTES, MANUAL_ARTICLES)
if (MANUAL_ROUTE_GUIDE_REMAINING_BUDGET !== 0) {
  errors.push(`The route-guide backlog contract is zero, but the committed remaining budget is ${MANUAL_ROUTE_GUIDE_REMAINING_BUDGET}.`)
}
if (remainingPageGuideRoutePaths.length !== 0) {
  errors.push(`Every dashboard route must have one exact page guide. Missing route bindings: ${remainingPageGuideRoutePaths.join(', ')}.`)
}
if (new Set(DASHBOARD_ROUTES.map((route) => route.manualArticleId)).size !== DASHBOARD_ROUTES.length) {
  errors.push('Every dashboard route must use a unique manualArticleId.')
}
console.log(`App Manual route-guide contract: ${DASHBOARD_ROUTES.length - remainingPageGuideRoutePaths.length}/${DASHBOARD_ROUTES.length} routes complete, zero-route backlog ${remainingPageGuideRoutePaths.length === 0 ? 'satisfied' : 'violated'}.`)

const configuredRoomPaths = Object.keys(ROOM_PAGE_CONFIGS)
const authoredRoomPageGuides = MANUAL_ARTICLES.filter((article): article is ManualPageGuideArticle => (
  isManualPageGuideArticle(article) && Boolean(article.pageGuide.generatedRoomPath)
))
if (authoredRoomPageGuides.length !== configuredRoomPaths.length) {
  errors.push(`Expected ${configuredRoomPaths.length} authored room page guides, found ${authoredRoomPageGuides.length}.`)
}
if (MANUAL_ARTICLES.some((article) => article.kind === 'generated-room')) {
  errors.push('Generated-only room articles must be replaced by authored page guides with generated appendices.')
}
for (const roomPath of configuredRoomPaths) {
  const article = MANUAL_ARTICLES_BY_ID.get(`room-${roomPath}`)
  if (!article || !isManualPageGuideArticle(article) || article.pageGuide.generatedRoomPath !== roomPath) {
    errors.push(`Room ${roomPath} has no authored page guide with its generated controls appendix.`)
  }
}
const configuredRoomCardKinds = [...new Set(Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => [
  ...room.overviewCards,
  ...room.sourceSections.flatMap((section) => section.cards),
]).map((card) => card.kind))].sort()
const familyGuideArticles = MANUAL_ARTICLES.filter(isManualFamilyGuideArticle)
const authoredFamilyKinds = familyGuideArticles.map((article) => article.familyGuide.cardKind).sort()
if (familyGuideArticles.length !== configuredRoomCardKinds.length || ROOM_CARD_FAMILY_GUIDE_IDS.length !== configuredRoomCardKinds.length) {
  errors.push(`Expected ${configuredRoomCardKinds.length} room-card family guides, found ${familyGuideArticles.length}.`)
}
if (JSON.stringify(authoredFamilyKinds) !== JSON.stringify(configuredRoomCardKinds)) {
  errors.push(`Room-card family guide kinds do not match ROOM_PAGE_CONFIGS. Expected ${configuredRoomCardKinds.join(', ')}; found ${authoredFamilyKinds.join(', ')}.`)
}
for (const kind of configuredRoomCardKinds) {
  const matches = familyGuideArticles.filter((article) => article.familyGuide.cardKind === kind)
  const expectedArticleId = roomCardFamilyArticleId(kind)
  const expectedSurfaceId = roomCardFamilySurfaceId(kind)
  const expectedRoutes = Object.values(ROOM_PAGE_CONFIGS)
    .filter((room) => [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)].some((card) => card.kind === kind))
    .map((room) => room.path)
    .sort()
  if (matches.length !== 1 || matches[0]?.id !== expectedArticleId) {
    errors.push(`Room-card kind ${kind} must have exactly one canonical family guide ${expectedArticleId}.`)
  } else if (!matches[0].ownsSurfaceIds?.includes(expectedSurfaceId)) {
    errors.push(`Family guide ${expectedArticleId} must own generated surface ${expectedSurfaceId}.`)
  } else if (JSON.stringify([...(matches[0].coversRoutes ?? [])].sort()) !== JSON.stringify(expectedRoutes)) {
    errors.push(`Family guide ${expectedArticleId} must cover exactly the configured ${kind} routes: ${expectedRoutes.join(', ')}.`)
  }
}
for (const surface of MANUAL_SURFACES) {
  if (surfaceIds.has(surface.id)) errors.push(`Duplicate manual surface id: ${surface.id}`)
  surfaceIds.add(surface.id)
  if (surface.parentSurfaceId && !MANUAL_SURFACES_BY_ID.has(surface.parentSurfaceId)) errors.push(`Manual surface ${surface.id} has missing parent ${surface.parentSurfaceId}.`)
  if (!surface.ownerArticleId || !MANUAL_ARTICLES_BY_ID.has(surface.ownerArticleId)) errors.push(`Manual surface ${surface.id} lacks a valid canonical owner.`)
  if (surface.screenshotPolicy === 'none') {
    if (!surface.screenshotPolicyReason || wordCount([surface.screenshotPolicyReason]) < 8) errors.push(`Manual surface ${surface.id} must explain why no standalone screenshot is required.`)
  } else if (surface.screenshotPolicyReason) {
    errors.push(`Manual surface ${surface.id} has screenshot evidence policy ${surface.screenshotPolicy} and must not carry a no-screenshot reason.`)
  }
  if (surface.ownerArticleId) {
    const owners = MANUAL_ARTICLES.filter((article) => article.ownsSurfaceIds?.includes(surface.id))
    if (owners.length !== 1 || owners[0]?.id !== surface.ownerArticleId) errors.push(`Manual surface ${surface.id} must be owned exactly once by ${surface.ownerArticleId}.`)
  }
}

const ownedModalFamilies = new Set(MANUAL_SURFACES.flatMap((surface) => surface.sourceIds ?? []).filter((id) => id.startsWith('modal:')).map((id) => id.slice('modal:'.length)))
for (const opener of MODAL_OPENER_INVENTORY) {
  if (!ownedModalFamilies.has(opener.id)) errors.push(`Modal opener family ${opener.id} lacks canonical surface ownership.`)
}
if (ownedModalFamilies.size !== MODAL_OPENER_INVENTORY.length) errors.push('Modal opener family ownership must exactly match MODAL_OPENER_INVENTORY with no migration allowlist.')

const canonicalSourceCache = new Map<string, string>()
for (const definition of CANONICAL_SURFACE_DEFINITIONS) {
  const surface = MANUAL_SURFACES_BY_ID.get(definition.id)
  if (!surface) {
    errors.push(`Canonical surface definition ${definition.id} is not registered as a manual surface.`)
    continue
  }
  if (surface.ownerArticleId !== definition.ownerArticleId) errors.push(`Canonical surface ${definition.id} must be owned by ${definition.ownerArticleId}.`)
  if (surface.implementation !== definition.implementation) errors.push(`Canonical surface ${definition.id} implementation drifted from its semantic registry.`)
  const [sourcePath, sourceAnchor] = definition.sourceReference.split('#', 2)
  if (!sourcePath || !sourceAnchor) {
    errors.push(`Canonical surface ${definition.id} must cite an exact source file and symbol anchor.`)
    continue
  }
  const absoluteSourcePath = resolve(process.cwd(), sourcePath)
  try {
    const source = canonicalSourceCache.get(sourcePath) ?? await readFile(absoluteSourcePath, 'utf8')
    canonicalSourceCache.set(sourcePath, source)
    const missingAnchorTokens = sourceAnchor.split('.').filter((token) => token && !source.includes(token))
    if (missingAnchorTokens.length > 0) errors.push(`Canonical surface ${definition.id} source anchor ${sourceAnchor} is missing tokens ${missingAnchorTokens.join(', ')} from ${sourcePath}.`)
  } catch {
    errors.push(`Canonical surface ${definition.id} source file ${sourcePath} does not exist.`)
  }
}

for (const article of MANUAL_ARTICLES.filter(isManualSurfaceGuideArticle)) {
  const expectedTabs = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'modal-tab').map((surface) => surface.id).sort()
  const expectedDetails = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'detail-page').map((surface) => surface.id).sort()
  const expectedSteps = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'wizard-step').map((surface) => surface.id).sort()
  const actualTabs = article.surfaceGuide.navigation.tabs.map((item) => item.surfaceId).sort()
  const actualDetails = article.surfaceGuide.navigation.detailPages.map((item) => item.surfaceId).sort()
  const actualSteps = article.surfaceGuide.navigation.wizardSteps.map((item) => item.surfaceId).sort()
  if (JSON.stringify(actualTabs) !== JSON.stringify(expectedTabs)) errors.push(`Surface guide ${article.id} tab explanations do not match its owned modal tabs.`)
  if (JSON.stringify(actualDetails) !== JSON.stringify(expectedDetails)) errors.push(`Surface guide ${article.id} detail explanations do not match its owned detail pages.`)
  if (JSON.stringify(actualSteps) !== JSON.stringify(expectedSteps)) errors.push(`Surface guide ${article.id} wizard explanations do not match its owned wizard steps.`)
}

const seenScreenshotIds = new Set<string>()
const screenshotScenarioIds = new Set<string>()
const coveredSurfaceScreenshotIds = new Map<string, string>()
for (const screenshot of MANUAL_SCREENSHOTS) {
  if (seenScreenshotIds.has(screenshot.id)) errors.push(`Duplicate manual screenshot id: ${screenshot.id}`)
  seenScreenshotIds.add(screenshot.id)
  if (screenshotScenarioIds.has(screenshot.scenarioId)) errors.push(`Duplicate manual screenshot scenario id: ${screenshot.scenarioId}`)
  screenshotScenarioIds.add(screenshot.scenarioId)
  if (!MANUAL_ARTICLES_BY_ID.has(screenshot.articleId)) errors.push(`Screenshot ${screenshot.id} points to missing article ${screenshot.articleId}.`)
  if (screenshot.requiredTargets.length === 0) errors.push(`Screenshot ${screenshot.id} has no required visible targets.`)
  for (const issue of manualScreenshotCoverageIssues(screenshot, registeredScreenshotSurfaceIds)) {
    errors.push(`Screenshot ${screenshot.id} ${issue}.`)
  }
  for (const surfaceId of screenshot.coveredSurfaceIds ?? []) {
    const previousScreenshotId = coveredSurfaceScreenshotIds.get(surfaceId)
    if (previousScreenshotId) {
      errors.push(`Covered surface ${surfaceId} is claimed by both ${previousScreenshotId} and ${screenshot.id}.`)
    } else {
      coveredSurfaceScreenshotIds.set(surfaceId, screenshot.id)
    }
  }
  for (const allowedText of screenshot.allowedStateText ?? []) {
    if (!MANUAL_SCREENSHOT_FORBIDDEN_TEXT.includes(allowedText)) errors.push(`Screenshot ${screenshot.id} allows unknown forbidden text "${allowedText}".`)
  }
  if (screenshotQuestions.has(screenshot.caption)) errors.push(`Screenshot ${screenshot.id} duplicates another screenshot caption/question.`)
  screenshotQuestions.add(screenshot.caption)
  const consumers = screenshotConsumers.get(screenshot.id) ?? new Set<string>()
  const expectedConsumers = new Set([screenshot.articleId, ...(screenshot.alsoUsedByArticleIds ?? [])])
  for (const surfaceId of manualScreenshotSurfaceIds(screenshot)) {
    const ownerArticleId = MANUAL_SURFACES_BY_ID.get(surfaceId)?.ownerArticleId
    if (ownerArticleId && !expectedConsumers.has(ownerArticleId)) {
      errors.push(`Screenshot ${screenshot.id} claims ${surfaceId}, but its owner ${ownerArticleId} is not named as a consumer.`)
    }
  }
  for (const id of expectedConsumers) {
    if (!MANUAL_ARTICLES_BY_ID.has(id)) errors.push(`Screenshot ${screenshot.id} names missing consumer article ${id}.`)
    if (!consumers.has(id)) errors.push(`Screenshot ${screenshot.id} metadata names ${id}, but that article does not consume it.`)
  }
  for (const id of consumers) {
    if (!expectedConsumers.has(id)) errors.push(`Screenshot ${screenshot.id} is consumed by ${id} without ownership metadata.`)
  }
  if (screenshot.landingUse) {
    const section = MANUAL_SECTIONS.find((candidate) => candidate.id === screenshot.landingUse?.sectionId)
    if (!section?.landing) errors.push(`Screenshot ${screenshot.id} names non-landing section ${screenshot.landingUse.sectionId}.`)
    if (section?.landing?.canonicalArticleId !== screenshot.articleId) errors.push(`Screenshot ${screenshot.id} landing owner does not match ${screenshot.landingUse.sectionId}.`)
    if (screenshot.landingUse.caption !== screenshot.caption) errors.push(`Screenshot ${screenshot.id} landing caption must match its canonical caption.`)
  }
  if (screenshot.role === 'context') {
    const owner = MANUAL_ARTICLES_BY_ID.get(screenshot.articleId)
    const isRouteContext = Boolean(
      owner
      && isManualPageGuideArticle(owner)
      && screenshot.surfaceId === `route:${owner.pageGuide.routePath}`,
    )
    if (!screenshot.landingUse && !isRouteContext) errors.push(`Context screenshot ${screenshot.id} must declare landing ownership or match its page-guide route surface.`)
    if (!screenshot.cropSelector) errors.push(`Context screenshot ${screenshot.id} must declare a stable crop selector.`)
    if (screenshot.privacyClass === 'sanitized-household') errors.push(`Context screenshot ${screenshot.id} must not rely on sanitized live household data.`)
  }
  for (const project of ['manual-mobile', 'manual-desktop']) {
    const path = resolve(process.cwd(), `public/manual/${project}/${screenshot.id}.png`)
    try {
      await access(path)
    } catch {
      errors.push(`Missing ${project} screenshot for ${screenshot.id}. Run npm run manual:capture.`)
    }
  }
}

const screenshotReview = await checkScreenshotReviewApproval()
for (const issue of screenshotReview.issues) errors.push(`Screenshot review: ${issue}`)
if (screenshotReview.state) {
  console.log(
    `App Manual screenshot review: ${screenshotReview.state.subjectCount} subjects / ${screenshotReview.state.variantCount} variants, `
    + `${screenshotReview.state.library.totalBytes} bytes total, ${screenshotReview.state.library.maxFileBytes} bytes max.`,
  )
}

for (const exception of MANUAL_EXCEPTIONS) {
  if (new Date(exception.expiresOn).getTime() <= Date.now()) errors.push(`Manual exception ${exception.capabilityId} expired on ${exception.expiresOn}.`)
}
if (MANUAL_EXCEPTIONS.length > 3) errors.push('No more than three App Manual exceptions may be active at once.')

const recipeStatusArticles = ['recipes-page-guide', 'recipes']
  .map((id) => MANUAL_ARTICLES_BY_ID.get(id))
  .filter((article): article is ManualArticle => Boolean(article))
const vacuumArea = MANUAL_ARTICLES_BY_ID.get('vacuum-area-cleaning')
const haAuditPath = resolve(process.cwd(), 'scripts/manual/generated/haInventory.json')
const haAudit = JSON.parse(await readFile(haAuditPath, 'utf8')) as ManualHaInventory
const behaviorOwnership = buildBehaviorOwnershipAudit(haAudit, MANUAL_ARTICLES)
for (const error of behaviorOwnership.errors) errors.push(`Behavior ownership: ${error}`)
console.log(`App Manual behavior ownership: ${behaviorOwnership.audit.counts.mappedUserFacing}/${behaviorOwnership.audit.counts.userFacing} user-facing items mapped; ${behaviorOwnership.audit.counts.reviewedInternal}/${behaviorOwnership.audit.counts.internal} internal items reviewed.`)
const behaviorAuditPath = resolve(process.cwd(), 'scripts/manual/generated/behaviorOwnershipAudit.json')
try {
  const committedBehaviorAudit = JSON.parse(await readFile(behaviorAuditPath, 'utf8')) as ManualBehaviorOwnershipAudit
  if (JSON.stringify(normalizedBehaviorOwnershipAudit(committedBehaviorAudit)) !== JSON.stringify(normalizedBehaviorOwnershipAudit(behaviorOwnership.audit))) {
    errors.push('The private Home Assistant behavior ownership audit is stale. Run npm run manual:sync:ha after reviewing ownership.')
  }
} catch {
  errors.push('The private Home Assistant behavior ownership audit is missing. Run npm run manual:sync:ha after reviewing ownership.')
}
const recipeServicesAvailable = ['evershelf.recipe_query', 'evershelf.recipe_hydration'].every((service) => haAudit.services.includes(service))
const areaScriptsAvailable = [
  'script.main_floor_vacuum_clean_zone',
  'script.music_room_vacuum_clean_zone',
  'script.theater_room_vacuum_clean_zone',
].every((id) => haAudit.scripts.some((script) => script.id === id))
if (recipeStatusArticles.length !== 2) errors.push('Recipes route and feature guides must both exist for dependency status review.')
if (recipeServicesAvailable && recipeStatusArticles.some((article) => article.status === 'in-development')) {
  errors.push('Recipe backend services are now available; review and promote both the Recipes route and feature guides.')
}
if (!recipeServicesAvailable && recipeStatusArticles.some((article) => article.status !== 'in-development')) {
  errors.push('Recipes route and feature guides must remain In Development while recipe services are missing.')
}
if (areaScriptsAvailable && vacuumArea?.status === 'in-development') errors.push('Vacuum area scripts are now available; review and promote the Vacuum Area manual article.')
if (!areaScriptsAvailable && vacuumArea?.status !== 'in-development') errors.push('Vacuum Area Cleaning must remain In Development while clean-zone scripts are missing.')

const appInventoryPath = resolve(process.cwd(), 'src/manual/generated/appInventory.json')
const committedAppInventory = JSON.parse(await readFile(appInventoryPath, 'utf8')) as ManualAppInventory
const currentAppInventory = await collectManualAppInventory()
if (JSON.stringify(committedAppInventory) !== JSON.stringify(currentAppInventory)) {
  errors.push('The App Manual app inventory is stale. Run npm run manual:sync:app and review the manual impact.')
}

const mergedMockEntityIds = new Set(Object.keys(mockEntities))
const explicitMockEntityIds = new Set(Object.keys(explicitMockEntities))
const generatedMockEntityIds = new Set(Object.keys(generatedMockEntities))
const overlappingMockEntityIds = [...generatedMockEntityIds].filter((entityId) => explicitMockEntityIds.has(entityId)).sort()
const missingMockEntityIds = committedAppInventory.entities.filter((entityId) => !mergedMockEntityIds.has(entityId))
const explicitReferencedCount = committedAppInventory.entities.filter((entityId) => explicitMockEntityIds.has(entityId)).length
const generatedReferencedCount = committedAppInventory.entities.filter((entityId) => generatedMockEntityIds.has(entityId) && !explicitMockEntityIds.has(entityId)).length
const mockCoverageByDomain = formatMockCoverageByDomain(committedAppInventory.entities, mergedMockEntityIds)
if (overlappingMockEntityIds.length > 0) {
  errors.push(`Generated mocks duplicate ${overlappingMockEntityIds.length} explicit mock IDs. Run npm run manual:sync:mocks. IDs: ${overlappingMockEntityIds.join(', ')}.`)
}
if (missingMockEntityIds.length > 0) {
  errors.push(`App Manual mock coverage is missing ${missingMockEntityIds.length} app-referenced entity IDs. Run npm run manual:sync:mocks. Counts by domain: ${mockCoverageByDomain}. IDs: ${missingMockEntityIds.join(', ')}.`)
}
console.log(`App Manual mock coverage: ${committedAppInventory.entities.length - missingMockEntityIds.length}/${committedAppInventory.entities.length} referenced entities (${explicitReferencedCount} explicit, ${generatedReferencedCount} generated); maps contain ${explicitMockEntityIds.size} explicit, ${generatedMockEntityIds.size} generated, ${mergedMockEntityIds.size} merged. Counts by domain: ${mockCoverageByDomain}.`)

const surfaceInventoryPath = resolve(process.cwd(), 'src/manual/generated/surfaceInventory.json')
const committedSurfaceInventory = JSON.parse(await readFile(surfaceInventoryPath, 'utf8'))
if (!derivedSurfaceInventoriesMatch(committedSurfaceInventory, currentSurfaceInventory)) {
  errors.push('The App Manual surface inventory is stale. Run npm run manual:sync:app and review the manual impact.')
}

const surfaceCoverage = deriveSurfaceCoverage(currentSurfaceInventory, MANUAL_SURFACES)
const manuallyDeclaredSurfaceIds = new Set([
  ...CANONICAL_SURFACE_DEFINITIONS.map((surface) => surface.id),
  ...currentSurfaceInventory.surfaces.filter((surface) => surface.id.startsWith('automatic-behavior:')).map((surface) => surface.id),
])
const manuallyDeclaredSurfaceCount = currentSurfaceInventory.surfaces.filter((surface) => manuallyDeclaredSurfaceIds.has(surface.id)).length
const sourceDerivedSurfaceCount = currentSurfaceInventory.surfaces.length - manuallyDeclaredSurfaceCount
if (surfaceCoverage.ambiguousSurfaceIds.length > 0) {
  errors.push(`Derived surfaces map to multiple manual owners: ${surfaceCoverage.ambiguousSurfaceIds.join(', ')}.`)
}
for (const [kind, count] of Object.entries(surfaceCoverage.byKind)) {
  if (count.uncovered !== 0) errors.push(`Derived ${kind} ownership must remain complete; ${count.uncovered} items are uncovered.`)
}
if (surfaceCoverage.uncovered !== MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET) {
  errors.push(`Derived surface ownership has ${surfaceCoverage.uncovered} uncovered items, but the permanent budget is ${MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET}. Counts by kind: ${formatDerivedSurfaceCoverage(surfaceCoverage)}.`)
}
if (MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET !== 0) errors.push('The permanent derived surface uncovered budget must remain zero.')
if (currentSurfaceInventory.extensionPoints.some((point) => point.kind !== 'dynamic-item')) errors.push('Collector extension points may represent only genuinely dynamic data rows.')

const matchedManualSurfaceIds = new Set(currentSurfaceInventory.surfaces.flatMap((surface) => manualOwnershipMatches(surface, MANUAL_SURFACES).map((match) => match.manualSurfaceId)))
const orphanManualSurfaceIds = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId && !matchedManualSurfaceIds.has(surface.id)).map((surface) => surface.id).sort()
if (orphanManualSurfaceIds.length > 0) {
  errors.push(`Manual surfaces with canonical owners must match at least one derived surface. Orphans: ${orphanManualSurfaceIds.join(', ')}.`)
}

const screenshotSurfaceIds = new Set(MANUAL_SCREENSHOTS.flatMap(manualScreenshotSurfaceIds))
const screenshotRequiredSurfaces = MANUAL_SURFACES.filter((surface) => surface.screenshotPolicy !== 'none')
const missingScreenshotPolicySurfaceIds = screenshotRequiredSurfaces
  .filter((surface) => !screenshotSurfaceIds.has(surface.id))
  .map((surface) => surface.id)
  .sort()
if (missingScreenshotPolicySurfaceIds.length !== MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET) {
  errors.push(`Screenshot-policy migration has ${missingScreenshotPolicySurfaceIds.length} surfaces without evidence, but the committed numeric budget is ${MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET}. Missing surfaces: ${missingScreenshotPolicySurfaceIds.join(', ') || 'none'}.`)
}

console.log(`App Manual derived surface coverage: ${surfaceCoverage.covered}/${surfaceCoverage.total} owned, ${surfaceCoverage.uncovered} uncovered (budget ${MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET}). Counts by kind: ${formatDerivedSurfaceCoverage(surfaceCoverage)}.`)
console.log(`App Manual surface provenance: ${sourceDerivedSurfaceCount} source/config-derived and ${manuallyDeclaredSurfaceCount} manually declared semantic/behavior surfaces.`)
console.log(`App Manual screenshot-policy coverage: ${screenshotRequiredSurfaces.length - missingScreenshotPolicySurfaceIds.length}/${screenshotRequiredSurfaces.length} screenshot-required surfaces have evidence; ${missingScreenshotPolicySurfaceIds.length} remain (budget ${MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET}).`)

if (errors.length > 0) {
  throw new Error(`App Manual checks failed:\n- ${errors.join('\n- ')}`)
}

console.log(`App Manual checks passed for ${MANUAL_ARTICLES.length} articles, ${MANUAL_SECTIONS.length} sections, and ${MANUAL_SCREENSHOTS.length} screenshot subjects.`)
