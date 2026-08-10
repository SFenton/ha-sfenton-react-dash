import { DASHBOARD_ROUTES } from '../constants/routes'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID } from './catalog'
import {
  completedManualPageGuideRouteBindings,
  isManualPageGuideArticle,
  manualRoomPageGuideSimilarityPairs,
  manualRoomPageGuideSimilarityViolations,
  manualPageGuideWordCount,
  MANUAL_ROUTE_GUIDE_REMAINING_BUDGET,
  remainingManualPageGuideRoutePaths,
  ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD,
} from './pageGuides'
import { ROOM_PAGE_GUIDE_ARTICLES } from './roomPageGuides'
import { MANUAL_SCREENSHOT_FORBIDDEN_TEXT, MANUAL_SCREENSHOTS } from './screenshots'
import { deriveSurfaceCoverage, manualOwnershipMatches } from './surfaceCoverage'
import { collectDerivedSurfaceInventory } from './surfaceInventory'
import { MANUAL_ROUTE_GUIDE_SURFACES, MANUAL_SURFACES, MANUAL_SURFACES_BY_ID } from './surfaces'
import type { ManualPageGuideArticle } from './types'

const FOUNDATIONAL_ROUTE_GUIDES = [
  ['manual', 'app-manual-page-guide'],
  ['overview', 'home-overview'],
  ['custom-lights', 'custom-lights-page-guide'],
  ['security', 'security-page-guide'],
  ['ecobee', 'thermostat-page-guide'],
] as const

const CHORE_ROUTE_GUIDES = [
  ['chores', 'chores-page-guide'],
  ['to-do', 'to-do-page-guide'],
  ['groceries', 'groceries-page-guide'],
  ['stephens-chores', 'stephens-chores-page-guide'],
  ['stephs-chores', 'stephs-chores-page-guide'],
  ['unassigned-chores', 'unassigned-chores-page-guide'],
  ['home-improvement-chores', 'home-improvement-chores-page-guide'],
] as const

const FOOD_ROUTE_GUIDES = [
  ['grocery-list', 'grocery-list-page-guide'],
  ['food', 'food-page-guide'],
  ['recipes', 'recipes-page-guide'],
  ['all-food', 'all-food-page-guide'],
  ['pantry', 'pantry-page-guide'],
  ['fridge', 'fridge-page-guide'],
  ['freezer', 'freezer-page-guide'],
  ['spice-rack', 'spice-rack-page-guide'],
  ['cabinet', 'cabinet-page-guide'],
] as const

const FEATURE_ROUTE_GUIDES = [
  ['mach-e', 'mach-e-page-guide'],
  ['vacuums', 'vacuums-page-guide'],
  ['media', 'media-page-guide'],
] as const

const SETTINGS_ROUTE_GUIDES = [
  ['settings', 'settings-page-guide'],
  ['admin', 'admin-page-guide'],
  ['guests-staying-over', 'guest-controls-page-guide'],
  ['vacation', 'vacation-page-guide'],
] as const

const ROOM_ROUTE_GUIDES = ROOM_PAGE_GUIDE_ARTICLES.map((article) => [article.pageGuide.routePath, article.id] as const)
const COMPLETED_ROUTE_GUIDES = [...FOUNDATIONAL_ROUTE_GUIDES, ...CHORE_ROUTE_GUIDES, ...FOOD_ROUTE_GUIDES, ...FEATURE_ROUTE_GUIDES, ...SETTINGS_ROUTE_GUIDES, ...ROOM_ROUTE_GUIDES] as const

describe('App Manual page guides', () => {
  it('uses the strict page-guide schema only for structured route articles', () => {
    for (const article of MANUAL_ARTICLES) {
      expect('pageGuide' in article).toBe(article.kind === 'page-guide')
    }

    for (const [, articleId] of COMPLETED_ROUTE_GUIDES) {
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!article || !isManualPageGuideArticle(article)) continue
      expect(article.blocks).toEqual([])
      expect(article.pageGuide.whatYouCanDo.length).toBeGreaterThanOrEqual(4)
      expect(article.pageGuide.lookHereFirst.length).toBeGreaterThanOrEqual(3)
      expect(article.pageGuide.troubleshootingChecks.length).toBeGreaterThanOrEqual(3)
      expect(article.tasks.length).toBeGreaterThanOrEqual(3)
      expect(article.tasks.every((task) => task.endsWith('?') && task.trim().split(/\s+/).length >= 4)).toBe(true)
      expect(article.pageGuide.screenshotIds.length).toBeGreaterThan(0)
      expect(article.pageGuide.relatedArticleIds.length).toBeGreaterThan(0)
      if (article.pageGuide.whatHappensAutomatically.mode === 'automatic') {
        expect(article.pageGuide.whatHappensAutomatically.items.length).toBeGreaterThanOrEqual(2)
      } else {
        expect(article.pageGuide.whatHappensAutomatically.pageIsPurelyNavigational).toBe(true)
        expect(article.pageGuide.whatHappensAutomatically.explanation.trim().split(/\s+/).length).toBeGreaterThanOrEqual(8)
      }
      if (article.pageGuide.generatedRoomPath) expect(article.pageGuide.generatedRoomPath).toBe(article.pageGuide.routePath)
    }
  })

  it('maps every completed route through both exact routePath and manualArticleId', () => {
    const bindings = completedManualPageGuideRouteBindings(DASHBOARD_ROUTES, MANUAL_ARTICLES)
    expect(bindings.map(({ article, route }) => [route.path, article.id]).sort()).toEqual([...COMPLETED_ROUTE_GUIDES].sort())

    for (const [path, articleId] of COMPLETED_ROUTE_GUIDES) {
      const routes = DASHBOARD_ROUTES.filter((route) => route.path === path)
      expect(routes).toHaveLength(1)
      expect(routes[0].manualArticleId).toBe(articleId)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(article && isManualPageGuideArticle(article) ? article.pageGuide.routePath : undefined).toBe(path)
    }
  })

  it('enforces the strict zero-route-backlog contract with one unique article per route', () => {
    const remainingPaths = remainingManualPageGuideRoutePaths(DASHBOARD_ROUTES, MANUAL_ARTICLES)
    expect(remainingPaths).toEqual([])
    expect(MANUAL_ROUTE_GUIDE_REMAINING_BUDGET).toBe(0)
    expect(COMPLETED_ROUTE_GUIDES).toHaveLength(DASHBOARD_ROUTES.length)
    expect(new Set(DASHBOARD_ROUTES.map((route) => route.manualArticleId)).size).toBe(DASHBOARD_ROUTES.length)
  })

  it('meets simple and complex word minima and exact route-specific section coverage', () => {
    for (const [path, articleId] of COMPLETED_ROUTE_GUIDES) {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === path)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!route || !article || !isManualPageGuideArticle(article)) continue
      const minimum = article.pageGuide.generatedRoomPath ? (article.pageGuide.complexity === 'complex' ? 350 : 300) : article.pageGuide.complexity === 'complex' ? 350 : 250
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(minimum)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route.manualVisibleSectionNames)
    }

    const security = MANUAL_ARTICLES_BY_ID.get('security-page-guide')
    const thermostat = MANUAL_ARTICLES_BY_ID.get('thermostat-page-guide')
    expect(security?.kind === 'page-guide' ? security.pageGuide.complexity : undefined).toBe('complex')
    expect(thermostat?.kind === 'page-guide' ? thermostat.pageGuide.complexity : undefined).toBe('complex')
  })

  it('registers every page-guide screenshot with exact consumer metadata', () => {
    for (const [, articleId] of COMPLETED_ROUTE_GUIDES) {
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      if (!article || !isManualPageGuideArticle(article)) continue
      for (const screenshotId of article.pageGuide.screenshotIds) {
        const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === screenshotId)
        expect(screenshot).toBeTruthy()
        expect([screenshot?.articleId, ...(screenshot?.alsoUsedByArticleIds ?? [])]).toContain(article.id)
      }
    }
  })

  it('derives covered route surfaces with one owner while preserving special children', () => {
    const inventory = collectDerivedSurfaceInventory()
    expect(MANUAL_ROUTE_GUIDE_SURFACES.map((surface) => surface.id).sort()).toEqual(COMPLETED_ROUTE_GUIDES.map(([path]) => `route:${path}`).sort())

    for (const [path, articleId] of COMPLETED_ROUTE_GUIDES) {
      const id = `route:${path}`
      const derived = inventory.surfaces.find((surface) => surface.id === id)
      const manual = MANUAL_SURFACES_BY_ID.get(id)
      expect(manual?.ownerArticleId).toBe(articleId)
      expect(derived && [...new Set(manualOwnershipMatches(derived, MANUAL_SURFACES).map((match) => match.manualSurfaceId))]).toEqual([id])
    }

    expect(MANUAL_SURFACES_BY_ID.get('home.status-rail')).toMatchObject({ parentSurfaceId: 'route:overview', ownerArticleId: 'status-chips' })
    expect(MANUAL_SURFACES_BY_ID.get('security.access-controls')).toMatchObject({ parentSurfaceId: 'route:security', ownerArticleId: 'security-access-controls' })
    expect(MANUAL_SURFACES_BY_ID.get('food.suggested-recipes')).toMatchObject({
      kind: 'page-section',
      ownerArticleId: 'recipes',
      parentSurfaceId: 'route:food',
    })
    expect(MANUAL_SURFACES_BY_ID.get('food.scan-review')).toMatchObject({
      kind: 'wizard-step',
      ownerArticleId: 'food-scanning',
      sourceIds: ['semantic-surface:food.scan-review'],
    })

    const coverage = deriveSurfaceCoverage(inventory, MANUAL_SURFACES)
    expect(coverage.ambiguousSurfaceIds).toEqual([])
    expect(coverage.byKind.route).toEqual({ total: 44, covered: 44, uncovered: 0 })
  })

  it('keeps the three feature-route guides distinct, detailed, private, and tied to real route contexts', () => {
    const expectedContextIds: Record<(typeof FEATURE_ROUTE_GUIDES)[number][0], string> = {
      'mach-e': 'mach-e-page-context',
      vacuums: 'vacuums-page-context',
      media: 'media-page-context',
    }
    const articles = FEATURE_ROUTE_GUIDES.map(([path, articleId]) => {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === path)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(route?.manualArticleId).toBe(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!route || !article || !isManualPageGuideArticle(article)) throw new Error(`Missing feature route guide ${articleId}`)

      expect(article.pageGuide.routePath).toBe(path)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route.manualVisibleSectionNames)
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(path === 'mach-e' ? 250 : 350)
      expect(article.pageGuide.complexity).toBe(path === 'mach-e' ? 'simple' : 'complex')
      expect(article.tasks.length).toBeGreaterThanOrEqual(4)

      const contextId = expectedContextIds[path]
      expect(article.pageGuide.screenshotIds[0]).toBe(contextId)
      const context = MANUAL_SCREENSHOTS.find((screenshot) => screenshot.id === contextId)
      expect(context).toMatchObject({
        articleId,
        privacyClass: 'synthetic',
        role: 'context',
        surfaceId: `route:${path}`,
      })
      expect(context?.landingUse).toBeUndefined()
      expect(context?.cropSelector).toBeTruthy()
      expect(context?.requiredTargets).not.toEqual(expect.arrayContaining([...MANUAL_SCREENSHOT_FORBIDDEN_TEXT]))
      return article
    })

    expect(new Set(articles.map((article) => article.title)).size).toBe(3)
    expect(new Set(articles.map((article) => article.pageGuide.orientation)).size).toBe(3)
    expect(new Set(articles.flatMap((article) => article.tasks)).size).toBe(articles.flatMap((article) => article.tasks).length)
    expect(MANUAL_ARTICLES_BY_ID.get('mach-e-page-guide')?.status).toBe('known-limitation')
    for (const sharedId of ['vacuum-cleaning', 'vacuum-area-cleaning', 'media-appliances-vehicle']) {
      expect(MANUAL_ARTICLES_BY_ID.get(sharedId)?.kind).not.toBe('page-guide')
    }
  })

  it('keeps the final four Settings routes distinct, complete, private, and separate from shared behavior guides', () => {
    const expectedContextIds: Record<(typeof SETTINGS_ROUTE_GUIDES)[number][0], string> = {
      settings: 'section-settings-context',
      admin: 'admin-page-context',
      'guests-staying-over': 'guest-controls-page-context',
      vacation: 'vacation-page-context',
    }
    const expectedComplexity: Record<(typeof SETTINGS_ROUTE_GUIDES)[number][0], 'simple' | 'complex'> = {
      settings: 'simple',
      admin: 'complex',
      'guests-staying-over': 'complex',
      vacation: 'complex',
    }
    const expectedContextOwners: Record<(typeof SETTINGS_ROUTE_GUIDES)[number][0], string> = {
      settings: 'settings-section-overview',
      admin: 'admin-page-guide',
      'guests-staying-over': 'guest-controls-page-guide',
      vacation: 'vacation-page-guide',
    }
    const articles = SETTINGS_ROUTE_GUIDES.map(([path, articleId]) => {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === path)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(route?.manualArticleId).toBe(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!route || !article || !isManualPageGuideArticle(article)) throw new Error(`Missing Settings route guide ${articleId}`)

      expect(article.pageGuide.routePath).toBe(path)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route.manualVisibleSectionNames)
      expect(article.pageGuide.complexity).toBe(expectedComplexity[path])
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(path === 'settings' ? 250 : 350)
      expect(article.tasks.length).toBeGreaterThanOrEqual(4)
      expect(article.pageGuide.screenshotIds[0]).toBe(expectedContextIds[path])

      const context = MANUAL_SCREENSHOTS.find((screenshot) => screenshot.id === expectedContextIds[path])
      expect(context).toMatchObject({
        articleId: expectedContextOwners[path],
        role: 'context',
        surfaceId: `route:${path}`,
      })
      expect([context?.articleId, ...(context?.alsoUsedByArticleIds ?? [])]).toContain(articleId)
      expect(context?.cropSelector).toBeTruthy()
      expect(context?.requiredTargets).not.toEqual(expect.arrayContaining([...MANUAL_SCREENSHOT_FORBIDDEN_TEXT]))
      if (path !== 'settings') expect(context?.privacyClass).toBe('synthetic')
      return article
    })

    expect(new Set(articles.map((article) => article.title)).size).toBe(SETTINGS_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => article.pageGuide.orientation)).size).toBe(SETTINGS_ROUTE_GUIDES.length)
    expect(new Set(articles.flatMap((article) => article.tasks)).size).toBe(articles.flatMap((article) => article.tasks).length)
    const settingsGuide = MANUAL_ARTICLES_BY_ID.get('settings-page-guide')
    expect(settingsGuide?.kind === 'page-guide' ? settingsGuide.pageGuide.whatHappensAutomatically.mode : undefined).toBe('none')
    expect(MANUAL_SCREENSHOTS.find((screenshot) => screenshot.id === 'vacation-confirmation')).toMatchObject({
      articleId: 'vacation-page-guide',
      privacyClass: 'synthetic',
      role: 'modal',
      surfaceId: 'modal-opener-family:vacation-mode-confirmation',
    })
    for (const privateText of ['Turn off outdoor sprinklers', 'Pour boiling water down the drain', 'Make the bed', 'Unload and Check Dishwasher', 'Trash and Recycles taken out']) {
      expect(MANUAL_SCREENSHOTS.find((screenshot) => screenshot.id === 'vacation-page-context')?.requiredTargets).not.toContain(privateText)
    }
    for (const sharedId of ['presence-based-lighting', 'guest-and-vacation']) {
      expect(MANUAL_ARTICLES_BY_ID.get(sharedId)?.kind).not.toBe('page-guide')
      expect(DASHBOARD_ROUTES.some((route) => route.manualArticleId === sharedId)).toBe(false)
    }
  })

  it('keeps all seven Chores-domain route guides complete and independently authored', () => {
    const articles = CHORE_ROUTE_GUIDES.map(([path, articleId]) => {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === path)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(route?.manualArticleId).toBe(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!route || !article || !isManualPageGuideArticle(article)) throw new Error(`Missing Chores route guide ${articleId}`)
      expect(article.pageGuide.routePath).toBe(path)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route.manualVisibleSectionNames)
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(article.pageGuide.complexity === 'complex' ? 350 : 250)
      expect(article.tasks.length).toBeGreaterThanOrEqual(3)
      return article
    })

    expect(new Set(articles.map((article) => article.id)).size).toBe(CHORE_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => article.title)).size).toBe(CHORE_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => article.pageGuide.orientation)).size).toBe(CHORE_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => JSON.stringify({
      actions: article.pageGuide.whatYouCanDo,
      automatic: article.pageGuide.whatHappensAutomatically,
      firstLook: article.pageGuide.lookHereFirst,
      safety: article.pageGuide.safetyAndLimitations,
      troubleshooting: article.pageGuide.troubleshootingChecks,
    }))).size).toBe(CHORE_ROUTE_GUIDES.length)
    const questions = articles.flatMap((article) => article.tasks)
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('keeps all nine Food-domain route guides complete, distinct, and honest about recipe status', () => {
    const articles = FOOD_ROUTE_GUIDES.map(([path, articleId]) => {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === path)
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(route?.manualArticleId).toBe(articleId)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!route || !article || !isManualPageGuideArticle(article)) throw new Error(`Missing Food route guide ${articleId}`)
      expect(article.pageGuide.routePath).toBe(path)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route.manualVisibleSectionNames)
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(article.pageGuide.complexity === 'complex' ? 350 : 250)
      expect(article.tasks.length).toBeGreaterThanOrEqual(3)
      return article
    })

    expect(new Set(articles.map((article) => article.id)).size).toBe(FOOD_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => article.title)).size).toBe(FOOD_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => article.pageGuide.orientation)).size).toBe(FOOD_ROUTE_GUIDES.length)
    expect(new Set(articles.map((article) => JSON.stringify({
      actions: article.pageGuide.whatYouCanDo,
      automatic: article.pageGuide.whatHappensAutomatically,
      firstLook: article.pageGuide.lookHereFirst,
      safety: article.pageGuide.safetyAndLimitations,
      troubleshooting: article.pageGuide.troubleshootingChecks,
    }))).size).toBe(FOOD_ROUTE_GUIDES.length)
    expect(new Set(articles.flatMap((article) => article.tasks)).size).toBe(articles.flatMap((article) => article.tasks).length)

    for (const articleId of ['food-page-guide', 'recipes-page-guide', 'all-food-page-guide']) {
      const article = MANUAL_ARTICLES_BY_ID.get(articleId)
      expect(article?.kind === 'page-guide' ? article.pageGuide.complexity : undefined).toBe('complex')
    }
    expect(MANUAL_ARTICLES_BY_ID.get('recipes-page-guide')?.status).toBe('in-development')
    expect(MANUAL_ARTICLES_BY_ID.get('recipes')?.status).toBe('in-development')
  })

  it('keeps all sixteen room guides authored, appendix-backed, and above the room minimum', () => {
    expect(ROOM_PAGE_GUIDE_ARTICLES).toHaveLength(16)
    expect(new Set(ROOM_PAGE_GUIDE_ARTICLES.map((article) => article.id)).size).toBe(16)
    expect(new Set(ROOM_PAGE_GUIDE_ARTICLES.flatMap((article) => article.tasks)).size).toBe(ROOM_PAGE_GUIDE_ARTICLES.flatMap((article) => article.tasks).length)

    for (const article of ROOM_PAGE_GUIDE_ARTICLES) {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === article.pageGuide.routePath)
      expect(article.kind).toBe('page-guide')
      expect(article.blocks).toEqual([])
      expect(article.pageGuide.generatedRoomPath).toBe(article.pageGuide.routePath)
      expect(article.id).toBe(`room-${article.pageGuide.routePath}`)
      expect(article.tasks.length).toBeGreaterThanOrEqual(3)
      expect(article.pageGuide.whatYouCanDo.length).toBeGreaterThanOrEqual(4)
      expect(article.pageGuide.lookHereFirst.length).toBeGreaterThanOrEqual(3)
      expect(article.pageGuide.troubleshootingChecks.length).toBeGreaterThanOrEqual(3)
      expect(article.pageGuide.whatHappensAutomatically.mode).toBe('automatic')
      expect(article.pageGuide.whatHappensAutomatically.mode === 'automatic' ? article.pageGuide.whatHappensAutomatically.items.length : 0).toBeGreaterThanOrEqual(2)
      expect(manualPageGuideWordCount(article)).toBeGreaterThanOrEqual(300)
      expect(article.pageGuide.visiblePageSectionNames).toEqual(route?.manualVisibleSectionNames)
    }
  })

  it('does not count the generated room appendix toward authored word minima', () => {
    const article = structuredClone(ROOM_PAGE_GUIDE_ARTICLES[0])
    const authoredWords = manualPageGuideWordCount(article)
    article.pageGuide.generatedRoomPath = 'generated facts with many words that must stay outside the authored count'
    expect(manualPageGuideWordCount(article)).toBe(authoredWords)
  })

  it('rejects a normalized copied room template while the authored set stays below the threshold', () => {
    const authoredPairs = manualRoomPageGuideSimilarityPairs(ROOM_PAGE_GUIDE_ARTICLES)
    expect(manualRoomPageGuideSimilarityViolations(ROOM_PAGE_GUIDE_ARTICLES)).toEqual([])
    expect(Math.max(...authoredPairs.map((pair) => pair.similarity))).toBeLessThanOrEqual(ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD)

    const copied = JSON.parse(
      JSON.stringify(ROOM_PAGE_GUIDE_ARTICLES[0])
        .replaceAll('Living Room', 'Guest Room')
        .replaceAll('living-room', 'guest-room')
        .replaceAll('room-living-room', 'room-guest-room'),
    ) as ManualPageGuideArticle
    const violations = manualRoomPageGuideSimilarityViolations([ROOM_PAGE_GUIDE_ARTICLES[0], copied])
    expect(violations).toHaveLength(1)
    expect(violations[0].similarity).toBeGreaterThan(ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD)
  })
})
