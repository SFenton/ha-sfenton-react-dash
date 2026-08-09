import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EXPECTED_MODAL_OPENER_FAMILY_COUNT, MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID } from './catalog'
import { MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET, MANUAL_SCREENSHOTS, manualScreenshotSurfaceIds } from './screenshots'
import { deriveSurfaceCoverage, manualOwnershipMatches } from './surfaceCoverage'
import { CANONICAL_SURFACE_DEFINITIONS, MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS } from './surfaceDefinitions'
import {
  isManualSurfaceGuideArticle,
  manualSurfaceGuideWordCount,
} from './surfaceGuides'
import { collectDerivedSurfaceInventory, DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS } from './surfaceInventory'
import { MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET, MANUAL_SURFACES, MANUAL_SURFACES_BY_ID } from './surfaces'

const EXPECTED_COUNTS = {
  'automatic-behavior': 25,
  camera: 4,
  component: 1,
  'configured-card': 12,
  'detail-page': 21,
  'floating-action': 11,
  'modal-destination': 39,
  'modal-opener-family': EXPECTED_MODAL_OPENER_FAMILY_COUNT,
  'modal-tab': 32,
  'native-prompt': 13,
  'option-picker': 3,
  'page-section': 142,
  'quick-link': 5,
  'room-card': 116,
  route: 44,
  'security-tile': 4,
  'stateful-control': 1,
  'status-chip': 8,
  'wizard-step': 4,
} as const

describe('surface guide ownership contract', () => {
  const inventory = collectDerivedSurfaceInventory()

  it('keeps the expanded semantic inventory exact and fully owned', () => {
    expect(inventory.schemaVersion).toBe(3)
    expect(inventory.counts.total).toBe(522)
    expect(inventory.counts.byKind).toEqual(EXPECTED_COUNTS)
    expect(new Set(inventory.surfaces.map((surface) => surface.id)).size).toBe(inventory.surfaces.length)
    expect(inventory.surfaces.some((surface) => surface.id.includes('#'))).toBe(false)

    const coverage = deriveSurfaceCoverage(inventory, MANUAL_SURFACES)
    expect(coverage).toMatchObject({
      total: 522,
      covered: 522,
      uncovered: 0,
      uncoveredSurfaceIds: [],
      ambiguousSurfaceIds: [],
    })
    expect(Object.values(coverage.byKind).every((count) => count.uncovered === 0)).toBe(true)
    expect(MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET).toBe(0)

    const matchedManualSurfaceIds = new Set(inventory.surfaces.flatMap((surface) => manualOwnershipMatches(surface, MANUAL_SURFACES).map((match) => match.manualSurfaceId)))
    expect(MANUAL_SURFACES.filter((surface) => surface.ownerArticleId && !matchedManualSurfaceIds.has(surface.id))).toEqual([])

    const screenshotSurfaceIds = new Set(MANUAL_SCREENSHOTS.flatMap(manualScreenshotSurfaceIds))
    expect(MANUAL_SURFACES.filter((surface) => surface.screenshotPolicy !== 'none' && !screenshotSurfaceIds.has(surface.id))).toHaveLength(MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET)
  })

  it('binds every modal opener family to semantic destinations and one canonical owner', () => {
    expect(MODAL_OPENER_INVENTORY).toHaveLength(EXPECTED_MODAL_OPENER_FAMILY_COUNT)
    expect(Object.keys(MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS).sort()).toEqual(MODAL_OPENER_INVENTORY.map((opener) => opener.id).sort())

    const derivedIds = new Set(inventory.surfaces.map((surface) => surface.id))
    for (const opener of MODAL_OPENER_INVENTORY) {
      const id = `modal-opener-family:${opener.id}`
      const derived = inventory.surfaces.find((surface) => surface.id === id)
      const manual = MANUAL_SURFACES_BY_ID.get(id)
      expect(derived?.destinationIds?.length).toBeGreaterThan(0)
      expect(derived?.destinationIds?.every((destinationId) => derivedIds.has(destinationId))).toBe(true)
      expect(manual?.ownerArticleId).toBe(MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS[opener.id])
      expect(MANUAL_ARTICLES_BY_ID.get(manual?.ownerArticleId ?? '')?.ownsSurfaceIds).toContain(id)
    }
  })

  it('registers every canonical tab, detail, step, action, picker, and prompt exactly once', () => {
    expect(new Set(CANONICAL_SURFACE_DEFINITIONS.map((surface) => surface.id)).size).toBe(CANONICAL_SURFACE_DEFINITIONS.length)

    for (const definition of CANONICAL_SURFACE_DEFINITIONS) {
      const derived = inventory.surfaces.filter((surface) => surface.id === definition.id)
      const manual = MANUAL_SURFACES.filter((surface) => surface.id === definition.id)
      expect(derived).toHaveLength(1)
      expect(manual).toHaveLength(1)
      expect(manual[0]).toMatchObject({
        implementation: definition.implementation,
        ownerArticleId: definition.ownerArticleId,
      })
      const owner = MANUAL_ARTICLES_BY_ID.get(definition.ownerArticleId)
      expect(['section-overview', 'page-guide', 'family-guide', 'surface-guide']).toContain(owner?.kind)
      expect(MANUAL_ARTICLES.filter((article) => article.ownsSurfaceIds?.includes(definition.id)).map((article) => article.id)).toEqual([definition.ownerArticleId])
    }
  })

  it('enforces the surface-guide schema, depth, screenshots, and navigation descriptions', () => {
    const guides = MANUAL_ARTICLES.filter(isManualSurfaceGuideArticle)
    expect(guides).toHaveLength(18)

    for (const article of guides) {
      const guide = article.surfaceGuide
      expect(article.blocks).toEqual([])
      expect(article.tasks.length).toBeGreaterThanOrEqual(2)
      expect(article.tasks.every((task) => task.endsWith('?') && task.trim().split(/\s+/).length >= 4)).toBe(true)
      expect(guide.howToOpen.length).toBeGreaterThan(0)
      expect(guide.contents.length).toBeGreaterThanOrEqual(2)
      expect(guide.closeBackCancelBehavior).toMatch(/Back|Cancel|close|Close/)
      expect(guide.homeAssistantOwnership).toMatch(/Home Assistant/)
      expect(guide.stateAndDisabledBehavior).toBeTruthy()
      expect(guide.troubleshootingChecks.length).toBeGreaterThanOrEqual(3)
      expect(guide.screenshotIds.length).toBeGreaterThan(0)
      expect(guide.relatedArticleIds.every((id) => MANUAL_ARTICLES_BY_ID.has(id))).toBe(true)
      expect(manualSurfaceGuideWordCount(article)).toBeGreaterThanOrEqual(180)

      const expectedTabs = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'modal-tab').map((surface) => surface.id).sort()
      const expectedDetails = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'detail-page').map((surface) => surface.id).sort()
      const expectedSteps = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id && surface.kind === 'wizard-step').map((surface) => surface.id).sort()
      expect(guide.navigation.tabs.map((entry) => entry.surfaceId).sort()).toEqual(expectedTabs)
      expect(guide.navigation.detailPages.map((entry) => entry.surfaceId).sort()).toEqual(expectedDetails)
      expect(guide.navigation.wizardSteps.map((entry) => entry.surfaceId).sort()).toEqual(expectedSteps)
      expect([...guide.navigation.tabs, ...guide.navigation.detailPages, ...guide.navigation.wizardSteps].every((entry) => entry.explanation.trim().split(/\s+/).length >= 6)).toBe(true)
    }
  })

  it('keeps migration allowlists, planned coverage, and static collector backlogs permanently absent', () => {
    const surfacesSource = readFileSync(resolve(process.cwd(), 'src/manual/surfaces.ts'), 'utf8')
    const checkSource = readFileSync(resolve(process.cwd(), 'scripts/manual/check.ts'), 'utf8')
    for (const source of [surfacesSource, checkSource]) {
      expect(source).not.toContain('MANUAL_MODAL_MIGRATION_ALLOWLIST')
      expect(source).not.toContain('MANUAL_SCREENSHOT_SURFACE_MIGRATION_ALLOWLIST')
      expect(source).not.toMatch(/coverage:\s*['"]planned['"]/)
    }
    expect(DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS).toEqual([expect.objectContaining({
      id: 'dynamic.todo-items',
      kind: 'dynamic-item',
    })])
  })
})
