import { ROOM_PAGE_CONFIGS, type RoomSourceKind } from '../constants/roomPages'
import { MANUAL_ARTICLES_BY_ID } from './catalog'
import {
  manualFamilyGuideWordCount,
  ROOM_CARD_FAMILY_GUIDE_ARTICLES,
  ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND,
} from './familyGuides'
import { roomCardFamilySourceId, roomCardFamilySurfaceId } from './roomCardFamilies'
import { MANUAL_SCREENSHOTS, manualScreenshotSurfaceIds } from './screenshots'
import { MANUAL_FAMILY_GUIDE_SURFACES } from './surfaces'

const EXPECTED_FAMILY_SCREENSHOTS: Record<RoomSourceKind, string> = {
  air: 'guest-room-page-context',
  appliance: 'kitchen-page-context',
  climate: 'guest-room-page-context',
  contact: 'back-deck-page-context',
  fan: 'guest-bathroom-page-context',
  grill: 'back-deck-page-context',
  humidifier: 'master-bedroom-page-context',
  laundry: 'garage-page-context',
  light: 'status-lights-detail',
  media: 'media-page-context',
  occupancy: 'gym-page-context',
  power: 'office-page-context',
  vacuum: 'music-room-page-context',
  vent: 'guest-room-page-context',
}

describe('room-card family guides', () => {
  const configuredKinds = [...new Set(Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => [
    ...room.overviewCards,
    ...room.sourceSections.flatMap((section) => section.cards),
  ]).map((card) => card.kind))].sort()

  it('defines one canonical structured guide and generated surface for all fourteen card kinds', () => {
    expect(configuredKinds).toHaveLength(14)
    expect(Object.keys(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND).sort()).toEqual(configuredKinds)
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES).toHaveLength(14)
    expect(MANUAL_FAMILY_GUIDE_SURFACES).toHaveLength(14)

    for (const kind of configuredKinds) {
      const article = ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND[kind]
      const surface = MANUAL_FAMILY_GUIDE_SURFACES.find((candidate) => candidate.id === roomCardFamilySurfaceId(kind))
      const expectedRoutes = Object.values(ROOM_PAGE_CONFIGS)
        .filter((room) => [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)].some((card) => card.kind === kind))
        .map((room) => room.path)
        .sort()
      expect(article.kind).toBe('family-guide')
      expect(article.familyGuide.cardKind).toBe(kind)
      expect(article.ownsSurfaceIds).toEqual([roomCardFamilySurfaceId(kind)])
      expect([...(article.coversRoutes ?? [])].sort()).toEqual(expectedRoutes)
      expect(surface).toMatchObject({
        ownerArticleId: article.id,
        sourceIds: [roomCardFamilySourceId(kind)],
      })
      expect([...(surface?.routes ?? [])].sort()).toEqual(expectedRoutes)
    }
  })

  it('meets the family schema, task, screenshot, relationship, and authored-word contracts', () => {
    const screenshotIds = new Set(MANUAL_SCREENSHOTS.map((screenshot) => screenshot.id))

    for (const article of ROOM_CARD_FAMILY_GUIDE_ARTICLES) {
      const guide = article.familyGuide
      expect(article.blocks).toEqual([])
      expect(article.tasks.length).toBeGreaterThanOrEqual(3)
      expect(article.tasks.every((task) => task.trim().endsWith('?') && task.trim().split(/\s+/).length >= 4)).toBe(true)
      expect(guide.purpose).toBeTruthy()
      expect(guide.appearsOn.routeTypes.length).toBeGreaterThan(0)
      expect(guide.appearsOn.explanation).toBeTruthy()
      expect(guide.actionSemantics.length).toBeGreaterThan(0)
      expect(guide.persistentStateMeanings.length).toBeGreaterThanOrEqual(3)
      expect(guide.unavailableAndDisabledBehavior).toBeTruthy()
      expect(guide.optimisticAndConfirmationBehavior).toBeTruthy()
      expect(guide.safetyAndLimitations.title).toBeTruthy()
      expect(guide.safetyAndLimitations.text).toBeTruthy()
      expect(guide.troubleshootingChecks.length).toBeGreaterThanOrEqual(3)
      expect(guide.screenshotIds.every((id) => screenshotIds.has(id))).toBe(true)
      expect(guide.relatedArticleIds.every((id) => MANUAL_ARTICLES_BY_ID.has(id))).toBe(true)
      expect(manualFamilyGuideWordCount(article)).toBeGreaterThanOrEqual(200)
    }
  })

  it('maps every family surface to a screenshot with explicit visible target proof', () => {
    for (const kind of configuredKinds) {
      const article = ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND[kind]
      const screenshotId = EXPECTED_FAMILY_SCREENSHOTS[kind]
      const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === screenshotId)
      const surfaceId = roomCardFamilySurfaceId(kind)

      expect(article.familyGuide.screenshotIds).toContain(screenshotId)
      expect(screenshot).toBeTruthy()
      expect(screenshot && manualScreenshotSurfaceIds(screenshot)).toContain(surfaceId)
      expect(screenshot?.surfaceTargetEvidence?.[surfaceId]?.length).toBeGreaterThan(0)
      expect(screenshot?.surfaceTargetEvidence?.[surfaceId]?.every((target) => screenshot.requiredTargets.includes(target))).toBe(true)
      expect([screenshot?.articleId, ...(screenshot?.alsoUsedByArticleIds ?? [])]).toContain(article.id)
    }
  })

  it('covers the configured modal, immediate, conditional, state-dependent, and status-only branches', () => {
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.light.familyGuide.actionSemantics.join(' ')).toMatch(/brightness control.*detail opener/i)
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.media.familyGuide.actionSemantics.join(' ')).toMatch(/Remote openers.*Activity cards.*app tiles/is)
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.grill.familyGuide.actionSemantics.join(' ')).toMatch(/only when.*active/i)
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.laundry.familyGuide.actionSemantics.join(' ')).toMatch(/no action/i)
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.power.familyGuide.actionSemantics).toEqual(expect.arrayContaining([
      expect.stringMatching(/equals On.*Off input button/i),
      expect.stringMatching(/Off or any other non-On value.*On input button/i),
    ]))
    expect(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.vacuum.familyGuide.actionSemantics.join(' ')).toMatch(/Controls.*Zones.*Auto-Clean.*Actions.*Info/is)
  })
})
