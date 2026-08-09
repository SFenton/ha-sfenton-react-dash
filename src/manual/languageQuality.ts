import type { ManualArticle, ManualBlock, ManualSection } from './types'

export interface ManualRenderedTextSource {
  source: string
  values: string[]
}

export interface ManualLanguageQualityIssue {
  source: string
  term: string
  value: string
}

interface ManualRenderedScreenshotText {
  alt: string
  caption: string
  id: string
  landingUse?: {
    caption: string
  }
}

const MANUAL_LANGUAGE_RULES = [
  { term: 'bare React', pattern: /\bReact\b(?!\s+Dash\b)/ },
  { term: 'backend', pattern: /\bbackend\b/i },
  { term: 'ROOM_PAGE_CONFIGS', pattern: /\broom_page_configs\b/i },
  { term: 'Vite', pattern: /\bvite\b/i },
  { term: 'ha-evershelf', pattern: /\bha-evershelf\b/i },
  { term: 'MQTT', pattern: /\bmqtt\b/i },
  { term: 'mounted', pattern: /\bmounted\b/i },
  { term: 'optimistic or optimistically', pattern: /\boptimistic(?:ally)?\b/i },
  { term: 'coordinator or coordinators', pattern: /\bcoordinators?\b/i },
] as const

function manualBlockRenderedTextValues(block: ManualBlock): string[] {
  switch (block.type) {
    case 'paragraph':
      return [block.text]
    case 'steps':
    case 'bullets':
      return [block.title, ...block.items]
    case 'callout':
      return [block.title, block.text]
    case 'fact':
      return [block.title]
    case 'screenshot':
    case 'room-reference':
      return []
    case 'overview-purpose':
      return [block.text]
    case 'overview-actions':
    case 'overview-automation':
      return [...block.items]
    case 'overview-first-look':
      return block.items.flatMap((item) => [item.label, item.text])
    case 'overview-safety':
      return [block.title, block.text]
  }
}

export function manualArticleRenderedTextValues(article: ManualArticle): string[] {
  const commonValues = [
    article.title,
    article.summary,
    ...article.tasks,
  ]

  switch (article.kind) {
    case 'page-guide': {
      const guide = article.pageGuide
      return [
        ...commonValues,
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
    case 'family-guide': {
      const guide = article.familyGuide
      return [
        ...commonValues,
        guide.purpose,
        ...guide.appearsOn.routeTypes,
        guide.appearsOn.explanation,
        ...guide.actionSemantics,
        ...guide.persistentStateMeanings.flatMap((item) => [item.label, item.meaning]),
        guide.unavailableAndDisabledBehavior,
        guide.optimisticAndConfirmationBehavior,
        guide.safetyAndLimitations.title,
        guide.safetyAndLimitations.text,
        ...guide.troubleshootingChecks,
      ]
    }
    case 'surface-guide': {
      const guide = article.surfaceGuide
      return [
        ...commonValues,
        ...guide.howToOpen,
        ...guide.contents,
        guide.navigation.explanation,
        ...guide.navigation.tabs.flatMap((item) => [item.label, item.explanation]),
        ...guide.navigation.detailPages.flatMap((item) => [item.label, item.explanation]),
        ...guide.navigation.wizardSteps.flatMap((item) => [item.label, item.explanation]),
        guide.closeBackCancelBehavior,
        guide.homeAssistantOwnership,
        guide.stateAndDisabledBehavior,
        guide.safetyAndLimitations.title,
        guide.safetyAndLimitations.text,
        ...guide.troubleshootingChecks,
      ]
    }
    case 'behavior-guide': {
      const guide = article.behaviorGuide
      return [
        ...commonValues,
        guide.capability,
        ...guide.whenAndTriggers,
        ...guide.conditionsAndPreconditions,
        ...guide.householdEffects,
        ...guide.visibleAppSigns,
        guide.exceptionsGuestVacationAway,
        ...guide.overridePauseRecover,
        guide.notifications,
        guide.safetyAndLimitations.title,
        guide.safetyAndLimitations.text,
        ...guide.troubleshootingChecks,
      ]
    }
    case 'task-guide': {
      const guide = article.taskGuide
      return [
        ...commonValues,
        guide.canonicalQuestion,
        ...guide.prerequisites,
        ...guide.steps,
        ...guide.successConfirmation,
        guide.backCancelClosePath,
        ...guide.failureAndRecovery,
        ...guide.automaticBehaviorAndSideEffects,
        guide.safetyAndLimitations.title,
        guide.safetyAndLimitations.text,
        ...(guide.screenshotEvidence.nonvisualReason ? [guide.screenshotEvidence.nonvisualReason] : []),
        ...(guide.screenshotEvidence.missingDedicatedScreenshot ? [guide.screenshotEvidence.missingDedicatedScreenshot] : []),
      ]
    }
    case 'section-overview':
    case 'page-overview':
    case 'component-guide':
    case 'technical-reference':
    case 'generated-room':
      return [
        ...commonValues,
        ...article.blocks.flatMap(manualBlockRenderedTextValues),
      ]
  }
}

export function manualSectionRenderedTextValues(section: ManualSection): string[] {
  return [
    section.title,
    section.summary,
    ...(section.browseGroups?.flatMap((group) => [group.title, ...(group.summary ? [group.summary] : [])]) ?? []),
    ...(section.landing
      ? [
        ...section.landing.commonTasks.map((task) => task.question),
        ...section.landing.guideGroups.flatMap((group) => [group.title, ...(group.summary ? [group.summary] : [])]),
        ...(section.landing.technicalDetailsTitle ? [section.landing.technicalDetailsTitle] : []),
      ]
      : []),
  ]
}

export function collectManualRenderedTextSources(
  articles: readonly ManualArticle[],
  sections: readonly ManualSection[],
  screenshots: readonly ManualRenderedScreenshotText[] = [],
): ManualRenderedTextSource[] {
  return [
    ...articles.map((article) => ({
      source: `article ${article.id}`,
      values: manualArticleRenderedTextValues(article),
    })),
    ...sections.map((section) => ({
      source: `section ${section.id}`,
      values: manualSectionRenderedTextValues(section),
    })),
    ...screenshots.map((screenshot) => ({
      source: `screenshot ${screenshot.id}`,
      values: [
        screenshot.alt,
        screenshot.caption,
        ...(screenshot.landingUse ? [screenshot.landingUse.caption] : []),
      ],
    })),
  ]
}

export function findManualLanguageQualityIssues(value: string) {
  return MANUAL_LANGUAGE_RULES
    .filter((rule) => rule.pattern.test(value))
    .map((rule) => rule.term)
}

export function manualLanguageQualityIssues(sources: readonly ManualRenderedTextSource[]): ManualLanguageQualityIssue[] {
  return sources.flatMap(({ source, values }) => values.flatMap((value) => (
    findManualLanguageQualityIssues(value).map((term) => ({ source, term, value }))
  )))
}
