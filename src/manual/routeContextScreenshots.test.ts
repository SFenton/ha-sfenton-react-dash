import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DASHBOARD_ROUTES } from '../constants/routes'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID } from './catalog'
import { isManualPageGuideArticle } from './pageGuides'
import {
  MANUAL_ROUTE_CONTEXT_FORBIDDEN_FIXTURE_TEXT,
  MANUAL_ROUTE_CONTEXT_SCREENSHOTS,
  MANUAL_ROUTE_CONTEXT_SCREENSHOTS_BY_PATH,
} from './routeContextScreenshots'
import {
  MANUAL_SCREENSHOT_FORBIDDEN_TEXT,
  MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET,
  MANUAL_SCREENSHOTS,
  manualScreenshotSurfaceIds,
} from './screenshots'
import { MANUAL_SURFACES } from './surfaces'
import { MANUAL_TASK_GUIDE_ARTICLES } from './taskGuides'
import type { ManualArticle } from './types'

const EXPECTED_NEW_ROUTE_CONTEXT_PATHS = [
  'all-food',
  'back-deck',
  'cabinet',
  'custom-lights',
  'dining-room',
  'downstairs-hallway',
  'entryway',
  'freezer',
  'fridge',
  'garage',
  'groceries',
  'grocery-list',
  'guest-bathroom',
  'guest-room',
  'gym',
  'hallway',
  'home-improvement-chores',
  'kitchen',
  'master-bathroom',
  'master-bedroom',
  'music-room',
  'office',
  'pantry',
  'spice-rack',
  'stephens-chores',
  'stephs-chores',
  'theater-room',
  'to-do',
  'unassigned-chores',
] as const

function articleScreenshotIds(article: ManualArticle) {
  if (article.kind === 'page-guide') return article.pageGuide.screenshotIds
  if (article.kind === 'family-guide') return article.familyGuide.screenshotIds
  if (article.kind === 'surface-guide') return article.surfaceGuide.screenshotIds
  if (article.kind === 'behavior-guide') return article.behaviorGuide.screenshotIds
  if (article.kind === 'task-guide') return article.taskGuide.screenshotEvidence.screenshotIds
  return article.blocks.flatMap((block) => block.type === 'screenshot' ? [block.screenshotId] : [])
}

function consumersForScreenshot(id: string) {
  return MANUAL_ARTICLES
    .filter((article) => articleScreenshotIds(article).includes(id))
    .map((article) => article.id)
    .sort()
}

function pngDimensions(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  }
}

describe('route-context screenshot registry', () => {
  it('matches exactly the 29 route surfaces that lacked direct evidence', () => {
    const registryIds = new Set(MANUAL_ROUTE_CONTEXT_SCREENSHOTS.map((screenshot) => screenshot.id))
    const preRegistrySurfaceIds = new Set(
      MANUAL_SCREENSHOTS
        .filter((screenshot) => !registryIds.has(screenshot.id))
        .map((screenshot) => screenshot.surfaceId),
    )
    const previouslyMissingRoutes = DASHBOARD_ROUTES
      .filter((route) => !preRegistrySurfaceIds.has(`route:${route.path}`))
      .map((route) => route.path)
      .sort()

    expect(MANUAL_ROUTE_CONTEXT_SCREENSHOTS).toHaveLength(29)
    expect(MANUAL_ROUTE_CONTEXT_SCREENSHOTS.map((screenshot) => screenshot.routePath).sort()).toEqual(
      [...EXPECTED_NEW_ROUTE_CONTEXT_PATHS].sort(),
    )
    expect(previouslyMissingRoutes).toEqual([...EXPECTED_NEW_ROUTE_CONTEXT_PATHS].sort())
    expect(MANUAL_ROUTE_CONTEXT_SCREENSHOTS_BY_PATH.size).toBe(29)
  })

  it('provides screenshot evidence for all 44 dashboard route surfaces', () => {
    const evidencedRouteSurfaceIds = new Set(
      MANUAL_SCREENSHOTS
        .filter((screenshot) => screenshot.surfaceId.startsWith('route:'))
        .map((screenshot) => screenshot.surfaceId),
    )
    expect(DASHBOARD_ROUTES).toHaveLength(44)
    expect(DASHBOARD_ROUTES.filter((route) => !evidencedRouteSurfaceIds.has(`route:${route.path}`))).toEqual([])
    expect(DASHBOARD_ROUTES.every((route) => evidencedRouteSurfaceIds.has(`route:${route.path}`))).toBe(true)
  })

  it('binds every new subject to its exact page-guide owner and consumer metadata', () => {
    for (const screenshot of MANUAL_ROUTE_CONTEXT_SCREENSHOTS) {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === screenshot.routePath)
      const article = MANUAL_ARTICLES_BY_ID.get(screenshot.articleId)
      expect(route).toBeTruthy()
      expect(screenshot.articleId).toBe(route?.manualArticleId)
      expect(screenshot.surfaceId).toBe(`route:${screenshot.routePath}`)
      expect(article && isManualPageGuideArticle(article)).toBe(true)
      if (!article || !isManualPageGuideArticle(article)) continue
      expect(article.pageGuide.routePath).toBe(screenshot.routePath)
      expect(article.pageGuide.screenshotIds[0]).toBe(screenshot.id)
      expect(article.pageGuide.screenshotIds).toContain(screenshot.id)
      expect(consumersForScreenshot(screenshot.id)).toEqual([
        article.id,
        ...(screenshot.alsoUsedByArticleIds ?? []),
      ].sort())
      expect(MANUAL_SCREENSHOTS.filter((candidate) => candidate.id === screenshot.id)).toEqual([screenshot])
    }
  })

  it('keeps every route capture meaningful, stable, synthetic, and privacy-safe', () => {
    const captions = new Set<string>()
    const subjects = new Set<string>()
    const forbidden = [...MANUAL_SCREENSHOT_FORBIDDEN_TEXT, ...MANUAL_ROUTE_CONTEXT_FORBIDDEN_FIXTURE_TEXT]

    for (const screenshot of MANUAL_ROUTE_CONTEXT_SCREENSHOTS) {
      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === screenshot.routePath)
      const fullShell = screenshot.cropSelector === '[data-app-shell="true"]'
      expect(screenshot.id).toBe(`${screenshot.routePath}-page-context`)
      expect(screenshot.scenarioId).toBe(screenshot.id)
      expect(screenshot.role).toBe('context')
      expect(screenshot.privacyClass).toBe('synthetic')
      expect(screenshot.cropSelector).toBe(fullShell ? '[data-app-shell="true"]' : `[data-route-path="${screenshot.routePath}"]`)
      if (fullShell) {
        expect(screenshot.cropHeight).toBeUndefined()
        expect(screenshot.desktopCropHeight).toBeUndefined()
        expect(screenshot.desktopCaptureWidth).toBe(820)
      } else {
        expect(screenshot.cropHeight).toBeGreaterThan(0)
        expect(screenshot.desktopCropHeight).toBeGreaterThan(0)
      }
      expect(screenshot.desktopMaxWidth).toBe(820)
      expect(screenshot.mobileMaxWidth).toBe(393)
      expect(screenshot.requiredTargets).toContain(route?.title)
      expect(screenshot.requiredTargets.length).toBeGreaterThanOrEqual(3)
      expect(screenshot.alt.split(/\s+/).length).toBeGreaterThanOrEqual(8)
      expect(screenshot.caption).toContain('?')
      expect(captions.has(screenshot.caption)).toBe(false)
      captions.add(screenshot.caption)

      const subjectKey = JSON.stringify(screenshot.requiredTargets)
      expect(subjects.has(subjectKey)).toBe(false)
      subjects.add(subjectKey)

      const publicCopy = [screenshot.alt, screenshot.caption, ...screenshot.requiredTargets].join(' ')
      for (const privateText of forbidden) expect(publicCopy).not.toContain(privateText)
      expect(publicCopy).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)

      for (const items of Object.values(screenshot.fixture?.todoItemsByEntity ?? {})) {
        for (const item of items) {
          expect(item.summary).toMatch(/^Synthetic /)
          expect(item.due).toBeUndefined()
        }
      }
      for (const items of Object.values(screenshot.fixture?.inventoryByLocation ?? {})) {
        for (const item of items) {
          expect(item.name).toMatch(/^Synthetic /)
          expect(JSON.stringify(item)).not.toMatch(/https?:\/\//)
        }
      }
    }

    for (const path of ['hallway', 'downstairs-hallway', 'entryway']) {
      const screenshot = MANUAL_ROUTE_CONTEXT_SCREENSHOTS_BY_PATH.get(path)
      expect(screenshot?.requiredTargets).toEqual(expect.arrayContaining([
        'Nothing Here Yet!',
        'Once some devices are added to this room',
      ]))
      expect(screenshot?.requiredTargets.some((target) => target === 'Light' || target === 'Lights')).toBe(true)
    }
  })

  it('reuses exact route-context evidence and leaves zero dedicated task-image gaps', () => {
    const routeContextIds = new Set(MANUAL_ROUTE_CONTEXT_SCREENSHOTS.map((screenshot) => screenshot.id))
    const taskRouteContextIds = MANUAL_TASK_GUIDE_ARTICLES.flatMap((article) => (
      article.taskGuide.screenshotEvidence.screenshotIds.filter((id) => routeContextIds.has(id))
    ))
    const dedicatedGaps = MANUAL_TASK_GUIDE_ARTICLES.filter((article) => (
      article.taskGuide.screenshotEvidence.missingDedicatedScreenshot
    ))

    expect(taskRouteContextIds).toEqual([
      'stephens-chores-page-context',
      'groceries-page-context',
      'office-page-context',
    ])
    expect(dedicatedGaps).toEqual([])
    expect(MANUAL_TASK_GUIDE_ARTICLES.find((article) => article.id === 'task-investigate-contact-pause')?.taskGuide.screenshotEvidence).toEqual({
      screenshotIds: ['home-contact-overview', 'home-contact-room-detail'],
    })
  })

  it('stores both deterministic 393px phone and 1280px desktop variants', () => {
    for (const screenshot of MANUAL_ROUTE_CONTEXT_SCREENSHOTS) {
      const mobilePath = resolve(process.cwd(), `public/manual/manual-mobile/${screenshot.id}.png`)
      const desktopPath = resolve(process.cwd(), `public/manual/manual-desktop/${screenshot.id}.png`)
      expect(existsSync(mobilePath), mobilePath).toBe(true)
      expect(existsSync(desktopPath), desktopPath).toBe(true)
      expect(pngDimensions(mobilePath)).toEqual({
        height: screenshot.cropHeight ?? 852,
        width: 393,
      })
      expect(pngDimensions(desktopPath)).toEqual({
        height: screenshot.desktopCropHeight ?? 900,
        width: screenshot.desktopCaptureWidth ?? 1280,
      })
    }
  })

  it('keeps the screenshot-policy budget permanently at zero', () => {
    const evidencedSurfaceIds = new Set(MANUAL_SCREENSHOTS.flatMap(manualScreenshotSurfaceIds))
    const remaining = MANUAL_SURFACES.filter((surface) => (
      surface.screenshotPolicy !== 'none' && !evidencedSurfaceIds.has(surface.id)
    ))
    expect(MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET).toBe(0)
    expect(remaining).toEqual([])
    expect(96 - MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET).toBe(96)
  })
})
