import { DASHBOARD_ROUTES } from '../constants/routes'
import {
  automaticBehaviorSurfaceId,
  MANUAL_BEHAVIOR_GUIDE_ARTICLES,
  manualBehaviorGuideAuthoredTextValues,
  manualBehaviorGuideWordCount,
} from './behaviorGuides'
import { deriveSurfaceCoverage, manualOwnershipMatches } from './surfaceCoverage'
import { collectDerivedSurfaceInventory } from './surfaceInventory'
import { MANUAL_SURFACES, MANUAL_SURFACES_BY_ID } from './surfaces'

describe('automatic household behavior guides', () => {
  it('keeps every guide structured, authored, household-facing, and route-bound', () => {
    const routePaths = new Set(DASHBOARD_ROUTES.map((route) => route.path))
    const rawId = /\b(?:automation|script|[a-z_]+)\.[a-z0-9_]+\b/

    expect(MANUAL_BEHAVIOR_GUIDE_ARTICLES).toHaveLength(25)
    expect(new Set(MANUAL_BEHAVIOR_GUIDE_ARTICLES.map((article) => article.id)).size).toBe(MANUAL_BEHAVIOR_GUIDE_ARTICLES.length)

    for (const article of MANUAL_BEHAVIOR_GUIDE_ARTICLES) {
      const guide = article.behaviorGuide
      expect(article.kind).toBe('behavior-guide')
      expect(article.blocks).toEqual([])
      expect(article.tasks.length).toBeGreaterThanOrEqual(2)
      expect(article.tasks.every((task) => task.endsWith('?'))).toBe(true)
      expect(manualBehaviorGuideWordCount(article)).toBeGreaterThanOrEqual(220)
      expect(guide.whenAndTriggers.length).toBeGreaterThan(0)
      expect(guide.conditionsAndPreconditions.length).toBeGreaterThan(0)
      expect(guide.householdEffects.length).toBeGreaterThan(0)
      expect(guide.visibleAppSigns.length).toBeGreaterThan(0)
      expect(guide.overridePauseRecover.length).toBeGreaterThan(0)
      expect(guide.troubleshootingChecks.length).toBeGreaterThanOrEqual(3)
      expect(guide.relatedArticleIds.length).toBeGreaterThan(0)
      expect(guide.affectedRoutes.length).toBeGreaterThan(0)
      expect(new Set(guide.affectedRoutes).size).toBe(guide.affectedRoutes.length)
      expect(guide.affectedRoutes.every((route) => routePaths.has(route))).toBe(true)
      expect(article.coversRoutes).toEqual(guide.affectedRoutes)
      expect(manualBehaviorGuideAuthoredTextValues(article).join(' ')).not.toMatch(rawId)
    }
  })

  it('derives exactly one owned automatic-behavior surface per guide with zero uncovered', () => {
    const inventory = collectDerivedSurfaceInventory()
    const automaticSurfaces = inventory.surfaces.filter((surface) => surface.kind === 'automatic-behavior')
    const coverage = deriveSurfaceCoverage(inventory, MANUAL_SURFACES)

    expect(automaticSurfaces).toHaveLength(MANUAL_BEHAVIOR_GUIDE_ARTICLES.length)
    expect(coverage.byKind['automatic-behavior']).toEqual({
      total: MANUAL_BEHAVIOR_GUIDE_ARTICLES.length,
      covered: MANUAL_BEHAVIOR_GUIDE_ARTICLES.length,
      uncovered: 0,
    })
    for (const article of MANUAL_BEHAVIOR_GUIDE_ARTICLES) {
      const id = automaticBehaviorSurfaceId(article.id)
      const derived = automaticSurfaces.find((surface) => surface.id === id)
      const manual = MANUAL_SURFACES_BY_ID.get(id)
      expect(derived?.routes).toEqual(article.behaviorGuide.affectedRoutes)
      expect(manual).toMatchObject({
        id,
        kind: 'automatic-behavior',
        ownerArticleId: article.id,
        routes: article.behaviorGuide.affectedRoutes,
      })
      expect(derived && manualOwnershipMatches(derived, MANUAL_SURFACES)).toEqual([{
        manualSurfaceId: id,
        matchKind: 'stable-id',
      }])
    }
  })
})
