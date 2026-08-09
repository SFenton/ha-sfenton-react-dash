import { MANUAL_ARTICLES_BY_ID } from './catalog'
import { MANUAL_SCREENSHOTS } from './screenshots'
import { MANUAL_SURFACES_BY_ID } from './surfaces'
import {
  MANUAL_TASK_GUIDE_ARTICLES,
  MANUAL_TASK_GUIDE_MINIMUM_WORDS,
  manualTaskGuideAuthoredTextValues,
  manualTaskGuideWordCount,
} from './taskGuides'
import { MANUAL_TASK_WORKFLOW_REGISTRY } from './taskWorkflows'

describe('structured App Manual task guides', () => {
  it('keeps every guide deep, typed, and free of raw backend ids', () => {
    const backendId = /\b[a-z_]+\.[a-z0-9_]+\b/

    for (const article of MANUAL_TASK_GUIDE_ARTICLES) {
      const guide = article.taskGuide
      expect(article.kind).toBe('task-guide')
      expect(article.blocks).toEqual([])
      expect(article.tasks).toEqual([guide.canonicalQuestion])
      expect(guide.canonicalQuestion).toMatch(/\?$/)
      expect(guide.prerequisites.length).toBeGreaterThan(0)
      expect(guide.steps.length).toBeGreaterThanOrEqual(3)
      expect(guide.successConfirmation.length).toBeGreaterThan(0)
      expect(guide.backCancelClosePath.length).toBeGreaterThan(0)
      expect(guide.failureAndRecovery.length).toBeGreaterThan(0)
      expect(guide.automaticBehaviorAndSideEffects.length).toBeGreaterThan(0)
      expect(guide.safetyAndLimitations.title.length).toBeGreaterThan(0)
      expect(guide.safetyAndLimitations.text.length).toBeGreaterThan(0)
      expect(manualTaskGuideWordCount(article)).toBeGreaterThanOrEqual(MANUAL_TASK_GUIDE_MINIMUM_WORDS)
      for (const text of manualTaskGuideAuthoredTextValues(article)) expect(text).not.toMatch(backendId)
      expect(MANUAL_ARTICLES_BY_ID.get(article.id)).toBe(article)
    }
  })

  it('maps every current workflow registry entry to exactly one task guide', () => {
    const workflowOwners = new Map<string, string[]>()
    for (const article of MANUAL_TASK_GUIDE_ARTICLES) {
      for (const workflowId of article.taskGuide.workflowIds) {
        const owners = workflowOwners.get(workflowId) ?? []
        owners.push(article.id)
        workflowOwners.set(workflowId, owners)
      }
    }

    expect(new Set(MANUAL_TASK_WORKFLOW_REGISTRY.map((workflow) => workflow.id)).size).toBe(MANUAL_TASK_WORKFLOW_REGISTRY.length)
    for (const workflow of MANUAL_TASK_WORKFLOW_REGISTRY) {
      expect(workflowOwners.get(workflow.id)).toHaveLength(1)
    }
    expect([...workflowOwners.keys()].sort()).toEqual(MANUAL_TASK_WORKFLOW_REGISTRY.map((workflow) => workflow.id).sort())
  })

  it('uses one unique canonical natural-language question per guide', () => {
    const questions = MANUAL_TASK_GUIDE_ARTICLES.map((article) => article.taskGuide.canonicalQuestion.toLowerCase())
    expect(new Set(questions).size).toBe(questions.length)
    for (const question of questions) {
      expect(question.split(/\s+/).length).toBeGreaterThanOrEqual(5)
      expect(question.endsWith('?')).toBe(true)
    }
  })

  it('binds unique registered owning surfaces and never links a guide to itself', () => {
    const owningSurfaces = new Map<string, string>()
    for (const article of MANUAL_TASK_GUIDE_ARTICLES) {
      const guide = article.taskGuide
      expect(guide.owningSurfaceIds.length).toBeGreaterThan(0)
      expect(new Set(guide.owningSurfaceIds).size).toBe(guide.owningSurfaceIds.length)
      for (const surfaceId of guide.owningSurfaceIds) {
        expect(MANUAL_SURFACES_BY_ID.has(surfaceId)).toBe(true)
        expect(owningSurfaces.has(surfaceId)).toBe(false)
        owningSurfaces.set(surfaceId, article.id)
      }

      expect(new Set(guide.relatedArticleIds).size).toBe(guide.relatedArticleIds.length)
      expect(guide.relatedArticleIds).not.toContain(article.id)
      for (const relatedId of guide.relatedArticleIds) expect(MANUAL_ARTICLES_BY_ID.has(relatedId)).toBe(true)
    }
  })

  it('requires screenshot evidence or an explicit nonvisual reason', () => {
    const screenshotIds = new Set(MANUAL_SCREENSHOTS.map((screenshot) => screenshot.id))
    for (const article of MANUAL_TASK_GUIDE_ARTICLES) {
      const evidence = article.taskGuide.screenshotEvidence
      if (evidence.screenshotIds.length > 0) {
        expect(evidence.nonvisualReason).toBeUndefined()
        expect(new Set(evidence.screenshotIds).size).toBe(evidence.screenshotIds.length)
        for (const id of evidence.screenshotIds) expect(screenshotIds.has(id)).toBe(true)
      } else {
        expect(evidence.nonvisualReason?.split(/\s+/).length).toBeGreaterThanOrEqual(10)
        expect(evidence.missingDedicatedScreenshot).toBeUndefined()
      }
    }
  })

  it('keeps the dedicated task screenshot gap budget at zero', () => {
    expect(MANUAL_TASK_GUIDE_ARTICLES.filter((article) => (
      article.taskGuide.screenshotEvidence.missingDedicatedScreenshot
    ))).toEqual([])
  })
})
