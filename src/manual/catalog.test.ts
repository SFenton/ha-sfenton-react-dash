import { MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import { APP_MANUAL_ROUTE_PATH, DASHBOARD_ROUTES } from '../constants/routes'
import { SETTINGS_PAGE_ITEMS } from '../constants/portedDashboard'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID, MANUAL_NON_ROOM_ROUTE_PATHS, MANUAL_ROOM_PATHS, MANUAL_SECTIONS } from './catalog'
import { MANUAL_BEHAVIOR_GUIDE_ARTICLES, MANUAL_BEHAVIOR_GUIDE_IDS } from './behaviorGuides'
import { ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND, ROOM_CARD_FAMILY_GUIDE_IDS } from './familyGuides'
import { ROOM_PAGE_GUIDE_IDS } from './roomPageGuides'
import { MANUAL_SCREENSHOTS } from './screenshots'
import { MANUAL_SURFACES, MANUAL_SURFACES_BY_ID } from './surfaces'

describe('App Manual catalog', () => {
  it('keeps the requested Settings entry first with exact copy', () => {
    expect(SETTINGS_PAGE_ITEMS[0]).toMatchObject({
      icon: 'mdi:book-open-page-variant',
      path: APP_MANUAL_ROUTE_PATH,
      subtitle: 'Access guides, instructions, and details on how our Home Assistant instance and app work.',
      title: 'App Manual',
    })
  })

  it('has unique, reachable sections and articles', () => {
    expect(new Set(MANUAL_SECTIONS.map((section) => section.id)).size).toBe(MANUAL_SECTIONS.length)
    expect(new Set(MANUAL_ARTICLES.map((article) => article.id)).size).toBe(MANUAL_ARTICLES.length)

    const sectionIds = new Set(MANUAL_SECTIONS.map((section) => section.id))
    for (const article of MANUAL_ARTICLES) {
      expect(sectionIds.has(article.sectionId)).toBe(true)
      expect(article.kind).toBeTruthy()
      expect(article.summary.length).toBeLessThanOrEqual(180)
      expect(article.tasks.length).toBeGreaterThan(0)
      const relatedArticleIds = article.kind === 'page-guide'
        ? article.pageGuide.relatedArticleIds
        : article.kind === 'family-guide'
          ? article.familyGuide.relatedArticleIds
          : article.kind === 'surface-guide'
            ? article.surfaceGuide.relatedArticleIds
            : article.kind === 'behavior-guide'
              ? article.behaviorGuide.relatedArticleIds
              : article.kind === 'task-guide'
                ? article.taskGuide.relatedArticleIds
            : article.relatedArticleIds ?? []
      for (const relatedId of relatedArticleIds) {
        expect(MANUAL_ARTICLES_BY_ID.has(relatedId)).toBe(true)
      }
    }
  })

  it('covers every current route, room, and modal-opener family', () => {
    for (const route of DASHBOARD_ROUTES) expect(MANUAL_ARTICLES_BY_ID.has(route.manualArticleId)).toBe(true)

    for (const roomPath of Object.keys(ROOM_PAGE_CONFIGS)) {
      const article = MANUAL_ARTICLES_BY_ID.get(`room-${roomPath}`)
      expect(article?.kind).toBe('page-guide')
      expect(article?.kind === 'page-guide' ? article.pageGuide.generatedRoomPath : undefined).toBe(roomPath)
    }

    const ownedModalFamilies = MANUAL_SURFACES.flatMap((surface) => surface.sourceIds ?? []).filter((id) => id.startsWith('modal:')).map((id) => id.slice('modal:'.length))
    expect([...new Set(ownedModalFamilies)].sort()).toEqual(MODAL_OPENER_INVENTORY.map((item) => item.id).sort())
    expect([...MANUAL_ROOM_PATHS].sort()).toEqual(Object.keys(ROOM_PAGE_CONFIGS).sort())
    const expectedNonRoomRoutes = DASHBOARD_ROUTES.map((route) => route.path)
      .filter((path) => path !== APP_MANUAL_ROUTE_PATH && !Object.hasOwn(ROOM_PAGE_CONFIGS, path))
      .sort()
    expect([...MANUAL_NON_ROOM_ROUTE_PATHS].sort()).toEqual(expectedNonRoomRoutes)
  })

  it('assigns exact owners and parents to covered manual surfaces', () => {
    expect(new Set(MANUAL_SURFACES.map((surface) => surface.id)).size).toBe(MANUAL_SURFACES.length)
    for (const surface of MANUAL_SURFACES) {
      if (surface.parentSurfaceId) expect(MANUAL_SURFACES_BY_ID.has(surface.parentSurfaceId)).toBe(true)
      expect(surface.ownerArticleId).toBeTruthy()
      expect(MANUAL_ARTICLES_BY_ID.has(surface.ownerArticleId ?? '')).toBe(true)
      expect(MANUAL_ARTICLES.filter((article) => article.ownsSurfaceIds?.includes(surface.id)).map((article) => article.id)).toEqual([surface.ownerArticleId])
    }
  })

  it('binds every screenshot block to one declared screenshot', () => {
    const screenshotIds = new Set(MANUAL_SCREENSHOTS.map((screenshot) => screenshot.id))
    const referenced = MANUAL_ARTICLES.flatMap((article) => [
      ...article.blocks.flatMap((block) => block.type === 'screenshot' ? [block.screenshotId] : []),
      ...(article.kind === 'page-guide' ? article.pageGuide.screenshotIds : []),
      ...(article.kind === 'family-guide' ? article.familyGuide.screenshotIds : []),
      ...(article.kind === 'surface-guide' ? article.surfaceGuide.screenshotIds : []),
      ...(article.kind === 'behavior-guide' ? article.behaviorGuide.screenshotIds : []),
      ...(article.kind === 'task-guide' ? article.taskGuide.screenshotEvidence.screenshotIds : []),
    ])
    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((id) => !screenshotIds.has(id))).toEqual([])
  })

  it('requires complete rich landings for all nine user-facing sections', () => {
    expect(MANUAL_SECTIONS.map((section) => section.id)).toEqual(['start', 'home', 'security', 'climate', 'chores', 'food', 'rooms', 'settings', 'help'])

    for (const section of MANUAL_SECTIONS) {
      const landing = section.landing
      const article = MANUAL_ARTICLES_BY_ID.get(landing?.canonicalArticleId ?? '')
      expect(article?.kind).toBe('section-overview')
      expect(article?.sectionId).toBe(section.id)
      expect(article?.blocks.map((block) => block.type)).toEqual(expect.arrayContaining([
        'overview-purpose',
        'overview-actions',
        'overview-automation',
        'overview-first-look',
      ]))
      const actionBlock = article?.blocks.find((block) => block.type === 'overview-actions')
      const automationBlock = article?.blocks.find((block) => block.type === 'overview-automation')
      const firstLookBlock = article?.blocks.find((block) => block.type === 'overview-first-look')
      expect(actionBlock?.type === 'overview-actions' ? actionBlock.items.length : 0).toBeGreaterThanOrEqual(4)
      expect(automationBlock?.type === 'overview-automation' ? automationBlock.items.length : 0).toBeGreaterThanOrEqual(3)
      expect(firstLookBlock?.type === 'overview-first-look' ? firstLookBlock.items.length : 0).toBeGreaterThanOrEqual(4)
      expect(article?.blocks.filter((block) => block.type === 'overview-safety')).toHaveLength(1)
      expect(MANUAL_SCREENSHOTS.filter((screenshot) => screenshot.role === 'context' && screenshot.landingUse?.sectionId === section.id)).toHaveLength(1)
      expect(landing?.commonTasks.length).toBeGreaterThanOrEqual(4)
      expect(landing?.commonTasks.length).toBeLessThanOrEqual(6)
      expect(landing?.commonTasks.some((task) => task.articleId === article?.id)).toBe(false)
      for (const task of landing?.commonTasks ?? []) {
        const target = MANUAL_ARTICLES_BY_ID.get(task.articleId)
        if (target?.kind === 'task-guide') expect(task.question).toBe(target.taskGuide.canonicalQuestion)
      }
      expect(MANUAL_ARTICLES_BY_ID.has(landing?.troubleshootingArticleId ?? '')).toBe(true)

      const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === landing?.primaryRoutePath)
      expect(route).toBeTruthy()
      expect(MANUAL_ARTICLES_BY_ID.has(route?.manualArticleId ?? '')).toBe(true)
      const reachable = new Set([
        article?.id,
        landing?.troubleshootingArticleId,
        ...(landing?.technicalArticleIds ?? []),
        ...(landing?.commonTasks.map((task) => task.articleId) ?? []),
        ...(landing?.guideGroups.flatMap((group) => group.articleIds ?? []) ?? []),
        ...MANUAL_ARTICLES.filter((candidate) => landing?.guideGroups.some((group) => group.kinds?.includes(candidate.kind) && candidate.sectionId === section.id)).map((candidate) => candidate.id),
      ])
      expect(reachable.has(route?.manualArticleId)).toBe(true)
    }
  })

  it('groups feature routes, family guides, room references, and Help without flattening them together', () => {
    const rooms = MANUAL_SECTIONS.find((section) => section.id === 'rooms')
    expect(rooms?.landing?.guideGroups[0]?.articleIds).toEqual(['mach-e-page-guide', 'vacuums-page-guide', 'media-page-guide'])
    expect(rooms?.landing?.guideGroups[0]?.collapsed).toBeFalsy()
    expect(rooms?.landing?.guideGroups[1]?.articleIds).toEqual(['browse-pages', 'vacuum-cleaning', 'vacuum-area-cleaning', 'media-appliances-vehicle', 'device-families'])
    expect(rooms?.landing?.guideGroups[1]?.collapsed).toBeFalsy()
    expect(rooms?.landing?.guideGroups[2]).toMatchObject({
      title: 'Automatic cleaning behavior',
      articleIds: ['behavior-vacuum-auto-clean', 'behavior-vacuum-commands'],
    })
    expect(rooms?.landing?.guideGroups[3]).toMatchObject({
      title: 'Automatic media and equipment behavior',
      articleIds: ['behavior-media-source-coordination', 'behavior-computer-power', 'behavior-kitchen-appliances', 'behavior-laundry-cycle', 'behavior-grill-vehicle-status'],
    })
    expect(rooms?.landing?.guideGroups[4]).toMatchObject({
      title: 'Comfort & sensors',
      articleIds: [
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.air.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.climate.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.contact.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.humidifier.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.occupancy.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.vent.id,
      ],
    })
    expect(rooms?.landing?.guideGroups[5]).toMatchObject({
      title: 'Devices & media',
      articleIds: [
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.appliance.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.fan.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.laundry.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.light.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.media.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.power.id,
      ],
    })
    expect(rooms?.landing?.guideGroups[6]).toMatchObject({
      title: 'Cleaning & actions',
      articleIds: [
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.grill.id,
        ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND.vacuum.id,
      ],
    })
    expect(rooms?.landing?.guideGroups[7]).toMatchObject({ collapsed: true, articleIds: [...ROOM_PAGE_GUIDE_IDS] })
    expect(rooms?.landing?.guideGroups[7]?.kinds).toBeUndefined()
    expect(MANUAL_ARTICLES.filter((article) => article.kind === 'generated-room')).toHaveLength(0)
    expect(ROOM_PAGE_GUIDE_IDS).toHaveLength(MANUAL_ROOM_PATHS.length)
    expect([...ROOM_PAGE_GUIDE_IDS]).toEqual(MANUAL_ROOM_PATHS.map((path) => `room-${path}`))
    expect(ROOM_CARD_FAMILY_GUIDE_IDS).toHaveLength(14)
    const reachable = new Set(rooms?.landing?.guideGroups.flatMap((group) => group.articleIds ?? []))
    expect(['mach-e-page-guide', 'vacuums-page-guide', 'media-page-guide'].every((id) => reachable.has(id))).toBe(true)
    expect(['vacuum-cleaning', 'vacuum-area-cleaning', 'media-appliances-vehicle'].every((id) => reachable.has(id))).toBe(true)
    expect(ROOM_CARD_FAMILY_GUIDE_IDS.every((id) => reachable.has(id))).toBe(true)
    expect(['behavior-vacuum-auto-clean', 'behavior-vacuum-commands', 'behavior-media-source-coordination', 'behavior-computer-power', 'behavior-kitchen-appliances', 'behavior-laundry-cycle', 'behavior-grill-vehicle-status'].every((id) => reachable.has(id))).toBe(true)

    const help = MANUAL_SECTIONS.find((section) => section.id === 'help')
    expect(help?.landing?.guideGroups[0]?.articleIds).toEqual(['troubleshooting', 'work-in-development', 'glossary'])
    expect(help?.landing?.technicalArticleIds).toEqual(['integration-catalog', 'automation-catalog', 'script-catalog'])
    expect(help?.landing?.technicalDetailsTitle).toBe('Behind the scenes')
  })

  it('keeps every Chores-domain route guide reachable while collapsing sibling ownership lists', () => {
    const chores = MANUAL_SECTIONS.find((section) => section.id === 'chores')
    const landing = chores?.landing
    const routeGuideIds = [
      'chores-page-guide',
      'to-do-page-guide',
      'groceries-page-guide',
      'stephens-chores-page-guide',
      'stephs-chores-page-guide',
      'unassigned-chores-page-guide',
      'home-improvement-chores-page-guide',
    ]
    const reachable = new Set([
      ...(landing?.commonTasks.map((task) => task.articleId) ?? []),
      ...(landing?.guideGroups.flatMap((group) => group.articleIds ?? []) ?? []),
    ])

    expect(routeGuideIds.every((articleId) => reachable.has(articleId))).toBe(true)
    expect(landing?.guideGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Main and shared lists',
        articleIds: ['chores-page-guide', 'groceries-page-guide', 'to-do-page-guide'],
      }),
      expect.objectContaining({
        title: 'People, ownership, and projects',
        articleIds: ['stephens-chores-page-guide', 'stephs-chores-page-guide', 'unassigned-chores-page-guide', 'home-improvement-chores-page-guide'],
        collapsed: true,
      }),
      expect.objectContaining({
        title: 'Shared task behavior',
        articleIds: ['chore-scheduling', 'daily-report'],
      }),
    ]))
  })

  it('keeps all Food-domain route guides reachable while collapsing the five storage locations', () => {
    const food = MANUAL_SECTIONS.find((section) => section.id === 'food')
    const landing = food?.landing
    const routeGuideIds = [
      'grocery-list-page-guide',
      'food-page-guide',
      'recipes-page-guide',
      'all-food-page-guide',
      'pantry-page-guide',
      'fridge-page-guide',
      'freezer-page-guide',
      'spice-rack-page-guide',
      'cabinet-page-guide',
    ]
    const reachable = new Set([
      ...(landing?.commonTasks.map((task) => task.articleId) ?? []),
      ...(landing?.guideGroups.flatMap((group) => group.articleIds ?? []) ?? []),
    ])

    expect(routeGuideIds.every((articleId) => reachable.has(articleId))).toBe(true)
    expect(landing?.guideGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Food pages',
        articleIds: ['food-page-guide', 'grocery-list-page-guide', 'all-food-page-guide', 'recipes-page-guide'],
      }),
      expect.objectContaining({
        title: 'Storage spaces',
        articleIds: ['pantry-page-guide', 'fridge-page-guide', 'freezer-page-guide', 'spice-rack-page-guide', 'cabinet-page-guide'],
        collapsed: true,
      }),
      expect.objectContaining({
        title: 'Shared workflows',
        articleIds: ['food-inventory', 'food-scanning', 'recipes'],
      }),
    ]))
    expect(MANUAL_ARTICLES_BY_ID.get('food-inventory')?.kind).toBe('surface-guide')
    expect(MANUAL_ARTICLES_BY_ID.get('food-scanning')?.kind).toBe('surface-guide')
    expect(MANUAL_ARTICLES_BY_ID.get('recipes')).toMatchObject({
      kind: 'surface-guide',
      parentId: 'recipes-page-guide',
      status: 'in-development',
    })
  })

  it('keeps all four Settings route guides reachable and separates shared behavior guides', () => {
    const settings = MANUAL_SECTIONS.find((section) => section.id === 'settings')
    const landing = settings?.landing
    const routeGuideIds = ['settings-page-guide', 'admin-page-guide', 'guest-controls-page-guide', 'vacation-page-guide']
    const sharedGuideIds = ['presence-based-lighting', 'guest-and-vacation']
    const automaticGuideIds = ['behavior-presence-overnight-reset', 'behavior-relay-power-recovery', 'behavior-guest-safeguards', 'behavior-vacation-lifecycle']
    const reachable = new Set([
      ...(landing?.commonTasks.map((task) => task.articleId) ?? []),
      ...(landing?.guideGroups.flatMap((group) => group.articleIds ?? []) ?? []),
    ])

    expect(routeGuideIds.every((articleId) => reachable.has(articleId))).toBe(true)
    expect(sharedGuideIds.every((articleId) => reachable.has(articleId))).toBe(true)
    expect(automaticGuideIds.every((articleId) => reachable.has(articleId))).toBe(true)
    expect(landing?.guideGroups).toEqual([
      expect.objectContaining({
        title: 'Settings page guides',
        articleIds: routeGuideIds,
      }),
      expect.objectContaining({
        title: 'Shared behavior guides',
        articleIds: sharedGuideIds,
      }),
      expect.objectContaining({
        title: 'Automatic house-mode behavior',
        articleIds: automaticGuideIds,
      }),
      expect.objectContaining({
        title: 'Guest and Vacation tasks',
        articleIds: ['task-configure-guests', 'task-start-vacation-mode', 'task-cancel-vacation-mode'],
      }),
      expect.objectContaining({
        title: 'Admin control tasks',
        articleIds: ['task-configure-presence-lighting', 'task-run-living-room-recovery', 'task-change-relay-control-mode'],
      }),
    ])
    expect(routeGuideIds.every((articleId) => MANUAL_ARTICLES_BY_ID.get(articleId)?.kind === 'page-guide')).toBe(true)
    expect(sharedGuideIds.every((articleId) => MANUAL_ARTICLES_BY_ID.get(articleId)?.kind !== 'page-guide')).toBe(true)
  })

  it('registers every canonical behavior guide as a reachable authored article', () => {
    expect(MANUAL_BEHAVIOR_GUIDE_ARTICLES).toHaveLength(25)
    expect(MANUAL_BEHAVIOR_GUIDE_IDS).toHaveLength(25)
    const reachable = new Set(MANUAL_SECTIONS.flatMap((section) => section.landing?.guideGroups.flatMap((group) => group.articleIds ?? []) ?? []))
    expect(MANUAL_BEHAVIOR_GUIDE_IDS.every((id) => reachable.has(id))).toBe(true)
  })

  it('keeps household prose free of raw entity identifiers', () => {
    const entityId = /\b[a-z_]+\.[a-z0-9_]+\b/
    for (const article of MANUAL_ARTICLES) {
      for (const block of article.blocks) {
        if (block.type === 'paragraph' || block.type === 'callout') {
          expect(block.text).not.toMatch(entityId)
        }
      }
    }
  })
})
