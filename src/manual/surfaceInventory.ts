import { CAMERA_ITEMS, OVERVIEW_STATUS_CHIPS, QUICK_ACCESS_ITEMS } from '../constants/atAGlance'
import { MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { MEDIA_PAGE_REMOTE_HASH_BY_ENTITY_ID } from '../constants/surfaceSemantics'
import {
  CONTROL_PAGES,
  MEDIA_SECTIONS,
  ROOM_EXTRA_SECTIONS,
  TODO_PAGES,
  type EntityAction,
  type EntityBasicAction,
  type EntitySectionConfig,
} from '../constants/portedDashboard'
import { ROOM_PAGE_CONFIGS, type RoomSourceCardAction, type RoomSourceCardConfig } from '../constants/roomPages'
import { DASHBOARD_ROUTES } from '../constants/routes'
import { SECURITY_CONTROL_TILES, SECURITY_STATUS_CHIPS } from '../constants/securityPage'
import { roomCardFamilySourceId } from './roomCardFamilies'
import { automaticBehaviorSurfaceId, MANUAL_BEHAVIOR_GUIDE_ARTICLES } from './behaviorGuides'
import { CANONICAL_SURFACE_DEFINITIONS, configuredHashDestinationId, roomCardModalDestinationId } from './surfaceDefinitions'

export const DERIVED_SURFACE_KINDS = [
  'automatic-behavior',
  'camera',
  'component',
  'configured-card',
  'detail-page',
  'floating-action',
  'modal-destination',
  'modal-opener-family',
  'modal-tab',
  'native-prompt',
  'option-picker',
  'page-section',
  'quick-link',
  'room-card',
  'route',
  'security-tile',
  'stateful-control',
  'status-chip',
  'wizard-step',
] as const

export const DERIVED_SURFACE_INTERACTIONS = [
  'navigate',
  'open',
  'direct-action',
  'status-only',
  'display',
] as const

export type DerivedSurfaceKind = (typeof DERIVED_SURFACE_KINDS)[number]
export type DerivedSurfaceInteraction = (typeof DERIVED_SURFACE_INTERACTIONS)[number]
export type DerivedSurfaceCollectorExtensionKind = 'dynamic-item'

export interface DerivedSurfaceRecord {
  id: string
  kind: DerivedSurfaceKind
  visibleName: string
  routes: string[]
  parentId?: string
  implementation: string
  sourceReference: string
  sourceId: string
  familySourceIds?: string[]
  openerId?: string
  destinationId?: string
  destinationIds?: string[]
  destinationHint?: string
  interaction: DerivedSurfaceInteraction
}

export interface DerivedSurfaceCollectorExtensionPoint {
  id: string
  kind: DerivedSurfaceCollectorExtensionKind
  sourceReference: string
  reason: string
}

export interface DerivedSurfaceInventory {
  schemaVersion: 3
  counts: {
    total: number
    byKind: Record<DerivedSurfaceKind, number>
    byInteraction: Record<DerivedSurfaceInteraction, number>
  }
  surfaces: DerivedSurfaceRecord[]
  extensionPoints: DerivedSurfaceCollectorExtensionPoint[]
}

export const DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS: DerivedSurfaceCollectorExtensionPoint[] = [
  {
    id: 'dynamic.todo-items',
    kind: 'dynamic-item',
    sourceReference: 'TodoListPanel runtime websocket items',
    reason: 'TODO_PAGES safely defines list sections, but task rows are live Home Assistant data rather than configured static cards.',
  },
]

function semanticSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function routeSurfaceId(path: string) {
  return `route:${path}`
}

function openerId(surfaceId: string) {
  return `opener:${surfaceId}`
}

function configuredRoutePath(path: string) {
  const withoutHash = path.split('#', 1)[0]
  const withoutSearch = withoutHash.split('?', 1)[0]
  return withoutSearch.split('/').filter(Boolean).at(-1)
}

type SurfaceAction = EntityAction | RoomSourceCardAction

function basicActions(action: SurfaceAction): EntityBasicAction[] {
  if (action.type !== 'state') return [action]
  return [
    ...action.cases.map((item) => item.action),
    ...(action.defaultAction ? [action.defaultAction] : []),
  ]
}

function actionInteraction(action: SurfaceAction | undefined, noActionInteraction: 'display' | 'status-only' = 'status-only'): DerivedSurfaceInteraction {
  if (!action) return noActionInteraction
  const actions = basicActions(action)
  return actions.length > 0 && actions.every((item) => item.type === 'navigate') ? 'navigate' : 'direct-action'
}

function actionDestinationId(action: SurfaceAction | undefined) {
  if (!action) return undefined
  const paths = [...new Set(basicActions(action)
    .filter((item): item is Extract<EntityBasicAction, { type: 'navigate' }> => item.type === 'navigate')
    .map((item) => configuredRoutePath(item.path))
    .filter((path): path is string => Boolean(path)))]
  return paths.length === 1 ? routeSurfaceId(paths[0]) : undefined
}

function routeSurfaces(): DerivedSurfaceRecord[] {
  const configuredRoomPaths = new Set(Object.entries(ROOM_PAGE_CONFIGS).map(([key, room]) => {
    if (key !== room.path) throw new Error(`ROOM_PAGE_CONFIGS key ${key} does not match path ${room.path}.`)
    return room.path
  }))

  return DASHBOARD_ROUTES.map((route) => ({
    id: routeSurfaceId(route.path),
    kind: 'route',
    visibleName: route.title,
    routes: [route.path],
    implementation: 'DashboardViewPage',
    sourceReference: configuredRoomPaths.has(route.path)
      ? `src/constants/routes.ts#DASHBOARD_ROUTES.${route.path}; src/constants/roomPages.ts#ROOM_PAGE_CONFIGS.${route.path}`
      : `src/constants/routes.ts#DASHBOARD_ROUTES.${route.path}`,
    sourceId: `route:${route.path}`,
    destinationId: routeSurfaceId(route.path),
    interaction: 'navigate',
  }))
}

function roomCardSurface(roomPath: string, card: RoomSourceCardConfig, location: string, parentId: string, sourceReference: string, implementation: string): DerivedSurfaceRecord {
  const id = `room-card:${roomPath}:${location}:${semanticSegment(card.entityId)}:${semanticSegment(card.title)}`
  const interaction = card.action ? actionInteraction(card.action) : card.hash ? 'open' : 'status-only'
  const modalDestinationId = roomCardModalDestinationId(card)
  if (interaction === 'open' && !modalDestinationId) throw new Error(`Room card ${roomPath}/${card.title} has no semantic modal destination.`)
  const familySourceIds = [
    roomCardFamilySourceId(card.kind),
    ...(card.hash ? [location === 'overview' ? 'modal:room-status-chips' : 'modal:room-source-cards'] : []),
  ]
  return {
    id,
    kind: 'room-card',
    visibleName: card.title,
    routes: [roomPath],
    parentId,
    implementation,
    sourceReference,
    sourceId: `room-page:${roomPath}:${location}:${semanticSegment(card.entityId)}:${semanticSegment(card.title)}`,
    familySourceIds,
    ...(interaction === 'open' || interaction === 'direct-action' || interaction === 'navigate' ? { openerId: openerId(id) } : {}),
    ...(interaction === 'open' && card.hash && modalDestinationId ? { destinationId: modalDestinationId, destinationHint: card.hash } : {}),
    ...(interaction === 'navigate' ? { destinationId: actionDestinationId(card.action) } : {}),
    interaction,
  }
}

function roomSurfaces(): DerivedSurfaceRecord[] {
  return Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => {
    const routeParentId = routeSurfaceId(room.path)
    const overviewCards = room.overviewCards.map((card) => roomCardSurface(
      room.path,
      card,
      'overview',
      routeParentId,
      `src/constants/roomPages.ts#ROOM_PAGE_CONFIGS.${room.path}.overviewCards`,
      'StatusRail',
    ))
    const sections = room.sourceSections.flatMap((section) => {
      const sectionId = `page-section:room:${room.path}:${semanticSegment(section.title)}`
      return [
        {
          id: sectionId,
          kind: 'page-section' as const,
          visibleName: section.title,
          routes: [room.path],
          parentId: routeParentId,
          implementation: 'SourceRoomPage',
          sourceReference: `src/constants/roomPages.ts#ROOM_PAGE_CONFIGS.${room.path}.sourceSections.${semanticSegment(section.title)}`,
          sourceId: `room-section:${room.path}:${semanticSegment(section.title)}`,
          familySourceIds: [routeSurfaceId(room.path)],
          interaction: 'display' as const,
        },
        ...section.cards.map((card) => roomCardSurface(
          room.path,
          card,
          `section-${semanticSegment(section.title)}`,
          sectionId,
          `src/constants/roomPages.ts#ROOM_PAGE_CONFIGS.${room.path}.sourceSections.${semanticSegment(section.title)}.cards`,
          'RoomSourceCard',
        )),
      ]
    })
    return [...overviewCards, ...sections]
  })
}

function modalOpenerFamilySurfaces(): DerivedSurfaceRecord[] {
  return MODAL_OPENER_INVENTORY.map((family) => {
    const id = `modal-opener-family:${family.id}`
    const destinationIds = [...new Set([
      ...CANONICAL_SURFACE_DEFINITIONS
        .filter((surface) => surface.openerFamilyIds?.includes(family.id))
        .flatMap((surface) => surface.destinationId ? [surface.destinationId] : ['modal-destination', 'native-prompt', 'option-picker'].includes(surface.kind) ? [surface.id] : []),
      ...(family.id === 'overview-route-quick-links'
        ? QUICK_ACCESS_ITEMS.flatMap((item) => item.route ? [routeSurfaceId(configuredRoutePath(item.route) ?? item.route)] : [])
        : []),
    ])].sort()
    if (destinationIds.length === 0) throw new Error(`Modal opener family ${family.id} has no semantic destination relationship.`)
    return {
      id,
      kind: 'modal-opener-family',
      visibleName: family.label,
      routes: [],
      implementation: family.implementation,
      sourceReference: `src/constants/modalOpeners.ts#MODAL_OPENER_INVENTORY.${family.id}`,
      sourceId: `modal:${family.id}`,
      openerId: openerId(id),
      destinationIds,
      interaction: family.id === 'overview-route-quick-links' ? 'navigate' : 'open',
    }
  })
}

function todoSurfaces(): DerivedSurfaceRecord[] {
  return Object.entries(TODO_PAGES).flatMap(([route, page]) => page.lists.map((list) => {
    const id = `page-section:todo:${route}:${semanticSegment(list.entityId)}:${semanticSegment(list.title)}`
    return {
      id,
      kind: 'page-section',
      visibleName: list.title,
      routes: [route],
      parentId: routeSurfaceId(route),
      implementation: 'TodoListPanel',
      sourceReference: `src/constants/portedDashboard.ts#TODO_PAGES.${route}.lists`,
      sourceId: `todo-list:${route}:${semanticSegment(list.entityId)}:${semanticSegment(list.title)}`,
      familySourceIds: [routeSurfaceId(route)],
      interaction: 'display',
    }
  }))
}

interface EntitySectionCollector {
  namespace: string
  route: string
  sections: EntitySectionConfig[]
  implementation: string
  sourceReference: string
  noActionInteraction?: 'display' | 'status-only'
}

function entitySectionSurfaces(collector: EntitySectionCollector): DerivedSurfaceRecord[] {
  return collector.sections.flatMap((section) => {
    const sectionKey = semanticSegment(section.title)
    const sectionId = `page-section:${collector.namespace}:${collector.route}:${sectionKey}`
    const sectionSurface: DerivedSurfaceRecord = {
      id: sectionId,
      kind: 'page-section',
      visibleName: section.title,
      routes: [collector.route],
      parentId: routeSurfaceId(collector.route),
      implementation: collector.implementation,
      sourceReference: `${collector.sourceReference}.${sectionKey}`,
      sourceId: `configured-section:${collector.namespace}:${collector.route}:${sectionKey}`,
      familySourceIds: [routeSurfaceId(collector.route)],
      interaction: 'display',
    }
    const cardSurfaces = section.items.map((item) => {
      const id = `configured-card:${collector.namespace}:${collector.route}:${sectionKey}:${semanticSegment(item.entityId)}:${semanticSegment(item.title)}`
      const mediaRemoteHash = collector.namespace === 'media' ? MEDIA_PAGE_REMOTE_HASH_BY_ENTITY_ID[item.entityId] : undefined
      const interaction = mediaRemoteHash ? 'open' : actionInteraction(item.action, collector.noActionInteraction)
      return {
        id,
        kind: 'configured-card' as const,
        visibleName: item.title,
        routes: [collector.route],
        parentId: sectionId,
        implementation: 'EntityActionCard',
        sourceReference: `${collector.sourceReference}.${sectionKey}.items`,
        sourceId: `configured-card:${collector.namespace}:${collector.route}:${sectionKey}:${semanticSegment(item.entityId)}:${semanticSegment(item.title)}`,
        familySourceIds: [
          ...(mediaRemoteHash ? ['modal:media-page-remotes'] : []),
          routeSurfaceId(collector.route),
        ],
        ...(interaction === 'navigate' || interaction === 'direct-action' ? { openerId: openerId(id) } : {}),
        ...(interaction === 'open' ? { openerId: openerId(id) } : {}),
        ...(interaction === 'navigate' ? { destinationId: actionDestinationId(item.action) } : {}),
        ...(mediaRemoteHash ? { destinationId: 'media.remote-sheet', destinationHint: mediaRemoteHash } : {}),
        interaction,
      }
    })
    return [sectionSurface, ...cardSurfaces]
  })
}

function configuredSectionSurfaces(): DerivedSurfaceRecord[] {
  return [
    ...Object.entries(CONTROL_PAGES).flatMap(([route, page]) => entitySectionSurfaces({
      namespace: 'control-page',
      route,
      sections: page.sections,
      implementation: 'EntitySections',
      sourceReference: `src/constants/portedDashboard.ts#CONTROL_PAGES.${route}.sections`,
    })),
    ...Object.entries(ROOM_EXTRA_SECTIONS).flatMap(([route, sections]) => ROOM_PAGE_CONFIGS[route] ? [] : entitySectionSurfaces({
        namespace: 'room-extra',
        route,
        sections,
        implementation: 'EntitySections',
        sourceReference: `src/constants/portedDashboard.ts#ROOM_EXTRA_SECTIONS.${route}`,
      })),
    ...entitySectionSurfaces({
      namespace: 'media',
      route: 'media',
      sections: MEDIA_SECTIONS,
      implementation: 'MediaPage',
      sourceReference: 'src/constants/portedDashboard.ts#MEDIA_SECTIONS',
      noActionInteraction: 'display',
    }),
  ]
}

function homeSurfaces(): DerivedSurfaceRecord[] {
  const statusChips = OVERVIEW_STATUS_CHIPS.map((chip) => {
    const id = `home.status-chip-${semanticSegment(chip.title)}`
    const destinationId = configuredHashDestinationId(chip.hash)
    if (!destinationId) throw new Error(`Home status chip ${chip.title} has no semantic destination.`)
    return {
      id,
      kind: 'status-chip' as const,
      visibleName: chip.title,
      routes: ['overview'],
      parentId: routeSurfaceId('overview'),
      implementation: 'StatusRail',
      sourceReference: `src/constants/atAGlance.ts#OVERVIEW_STATUS_CHIPS.${semanticSegment(chip.title)}`,
      sourceId: `overview-status-chip:${semanticSegment(chip.title)}`,
      familySourceIds: ['modal:overview-status-chips', routeSurfaceId('overview')],
      openerId: openerId(id),
      destinationId,
      destinationHint: chip.hash,
      interaction: 'open' as const,
    }
  })
  const quickLinks = QUICK_ACCESS_ITEMS.map((item) => {
    if (Boolean(item.hash) === Boolean(item.route)) throw new Error(`Quick access item ${item.title} must define exactly one hash or route destination.`)
    const id = `home.quick-link-${semanticSegment(item.title)}`
    const interaction: DerivedSurfaceInteraction = item.route ? 'navigate' : 'open'
    const hashDestination = item.hash ? configuredHashDestinationId(item.hash) : undefined
    if (item.hash && !hashDestination) throw new Error(`Home quick link ${item.title} has no semantic destination.`)
    return {
      id,
      kind: 'quick-link' as const,
      visibleName: item.title,
      routes: ['overview'],
      parentId: routeSurfaceId('overview'),
      implementation: 'QuickAccessTile',
      sourceReference: `src/constants/atAGlance.ts#QUICK_ACCESS_ITEMS.${semanticSegment(item.title)}`,
      sourceId: `overview-quick-link:${semanticSegment(item.title)}`,
      familySourceIds: [
        item.route ? 'modal:overview-route-quick-links' : 'modal:overview-security-tile',
        routeSurfaceId('overview'),
      ],
      openerId: openerId(id),
      ...(item.hash && hashDestination ? { destinationId: hashDestination, destinationHint: item.hash } : {}),
      ...(item.route ? { destinationId: routeSurfaceId(configuredRoutePath(item.route) ?? item.route), destinationHint: item.route } : {}),
      interaction,
    }
  })
  const cameras = CAMERA_ITEMS.map((camera) => {
    const id = `camera:${semanticSegment(camera.streamId)}`
    return {
      id,
      kind: 'camera' as const,
      visibleName: camera.title,
      routes: ['overview', 'security'],
      implementation: 'CameraTile',
      sourceReference: `src/constants/atAGlance.ts#CAMERA_ITEMS.${semanticSegment(camera.streamId)}`,
      sourceId: `camera:${semanticSegment(camera.streamId)}`,
      familySourceIds: ['modal:camera-tiles'],
      openerId: openerId(id),
      destinationId: 'security.camera-controls',
      destinationHint: camera.hash,
      interaction: 'open' as const,
    }
  })
  return [...statusChips, ...quickLinks, ...cameras]
}

function securitySurfaces(): DerivedSurfaceRecord[] {
  const statusChips = SECURITY_STATUS_CHIPS.map((chip) => {
    if (!chip.hash) throw new Error(`Security status chip ${chip.title} must define a hash destination.`)
    const destinationId = configuredHashDestinationId(chip.hash)
    if (!destinationId) throw new Error(`Security status chip ${chip.title} has no semantic destination.`)
    const id = `security.status-chip-${semanticSegment(chip.title)}`
    return {
      id,
      kind: 'status-chip' as const,
      visibleName: chip.title,
      routes: ['security'],
      parentId: routeSurfaceId('security'),
      implementation: 'SecurityStatusRail',
      sourceReference: `src/constants/securityPage.ts#SECURITY_STATUS_CHIPS.${semanticSegment(chip.title)}`,
      sourceId: `security-status-chip:${semanticSegment(chip.title)}`,
      familySourceIds: ['modal:security-status-chips', routeSurfaceId('security')],
      openerId: openerId(id),
      destinationId,
      destinationHint: chip.hash,
      interaction: 'open' as const,
    }
  })
  const tileSurface = (source: 'control' | 'mache', tile: (typeof SECURITY_CONTROL_TILES)[number]): DerivedSurfaceRecord => {
    const id = `security-tile:${source}:${semanticSegment(tile.entityId)}:${semanticSegment(tile.title)}`
    const interaction = tile.action?.type === 'hash' ? 'open' : tile.action ? 'direct-action' : 'status-only'
    const destinationId = tile.action?.type === 'hash' ? configuredHashDestinationId(tile.action.hash) : undefined
    if (tile.action?.type === 'hash' && !destinationId) throw new Error(`Security tile ${tile.title} has no semantic destination.`)
    return {
      id,
      kind: 'security-tile',
      visibleName: tile.title,
      routes: ['security'],
      parentId: routeSurfaceId('security'),
      implementation: 'SecurityTile',
      sourceReference: `src/constants/securityPage.ts#${source === 'control' ? 'SECURITY_CONTROL_TILES' : 'SECURITY_MACHE_TILES'}.${semanticSegment(tile.title)}`,
      sourceId: `security-tile:${source}:${semanticSegment(tile.entityId)}:${semanticSegment(tile.title)}`,
      familySourceIds: [
        ...(tile.action?.type === 'hash' ? ['modal:security-system-tile'] : []),
        routeSurfaceId('security'),
      ],
      ...(interaction === 'open' || interaction === 'direct-action' ? { openerId: openerId(id) } : {}),
      ...(tile.action?.type === 'hash' && destinationId ? { destinationId, destinationHint: tile.action.hash } : {}),
      interaction,
    }
  }
  return [
    ...statusChips,
    ...SECURITY_CONTROL_TILES.map((tile) => tileSurface('control', tile)),
  ]
}

function canonicalSurfaces(): DerivedSurfaceRecord[] {
  return CANONICAL_SURFACE_DEFINITIONS.map((surface) => ({
    id: surface.id,
    kind: surface.kind,
    visibleName: surface.visibleName,
    routes: [...surface.routes],
    ...(surface.parentId ? { parentId: surface.parentId } : {}),
    implementation: surface.implementation,
    sourceReference: surface.sourceReference,
    sourceId: `semantic-surface:${surface.id}`,
    ...(surface.interaction === 'open' || surface.interaction === 'direct-action' ? { openerId: openerId(surface.id) } : {}),
    ...(surface.destinationId ? { destinationId: surface.destinationId } : {}),
    interaction: surface.interaction,
  }))
}

function automaticBehaviorSurfaces(): DerivedSurfaceRecord[] {
  return MANUAL_BEHAVIOR_GUIDE_ARTICLES.map((article) => ({
    id: automaticBehaviorSurfaceId(article.id),
    kind: 'automatic-behavior',
    visibleName: article.title,
    routes: [...article.behaviorGuide.affectedRoutes],
    implementation: 'Home Assistant automation and script ownership registry',
    sourceReference: `src/manual/behaviorGuides.ts#${article.id}`,
    sourceId: automaticBehaviorSurfaceId(article.id),
    interaction: 'display',
  }))
}

function routeVisibleSectionSurfaces(existingSurfaces: readonly DerivedSurfaceRecord[]): DerivedSurfaceRecord[] {
  const existingSectionKeys = new Set(existingSurfaces
    .filter((surface) => surface.kind === 'page-section')
    .flatMap((surface) => surface.routes.map((route) => `${route}:${semanticSegment(surface.visibleName)}`)))

  return DASHBOARD_ROUTES.flatMap((route) => (route.manualVisibleSectionNames ?? []).flatMap((visibleName) => {
    const sectionKey = `${route.path}:${semanticSegment(visibleName)}`
    if (existingSectionKeys.has(sectionKey)) return []
    const id = `route-section:${sectionKey}`
    return [{
      id,
      kind: 'page-section' as const,
      visibleName,
      routes: [route.path],
      parentId: routeSurfaceId(route.path),
      implementation: `DASHBOARD_ROUTES.${route.path}.manualVisibleSectionNames`,
      sourceReference: `src/constants/routes.ts#DASHBOARD_ROUTES.${route.path}.manualVisibleSectionNames`,
      sourceId: id,
      familySourceIds: [routeSurfaceId(route.path)],
      interaction: 'display' as const,
    }]
  }))
}

function initializedCount<T extends string>(values: readonly T[]) {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>
}

function validateDerivedSurfaces(surfaces: DerivedSurfaceRecord[]) {
  const routeIds = new Set(DASHBOARD_ROUTES.map((route) => routeSurfaceId(route.path)))
  const ids = new Set<string>()
  const sourceIds = new Set<string>()
  const openerIds = new Set<string>()

  for (const surface of surfaces) {
    if (surface.id.includes('#')) throw new Error(`Derived surface ${surface.id} uses a hash as identity.`)
    if (ids.has(surface.id)) throw new Error(`Duplicate derived surface id: ${surface.id}`)
    if (sourceIds.has(surface.sourceId)) throw new Error(`Duplicate derived surface source id: ${surface.sourceId}`)
    if (surface.openerId && openerIds.has(surface.openerId)) throw new Error(`Duplicate derived surface opener id: ${surface.openerId}`)
    ids.add(surface.id)
    sourceIds.add(surface.sourceId)
    if (surface.openerId) openerIds.add(surface.openerId)
    for (const route of surface.routes) {
      if (!routeIds.has(routeSurfaceId(route))) throw new Error(`Derived surface ${surface.id} references unknown route ${route}.`)
    }
  }

  for (const surface of surfaces) {
    if (surface.parentId && !ids.has(surface.parentId)) throw new Error(`Derived surface ${surface.id} references missing parent ${surface.parentId}.`)
    const destinations = [...(surface.destinationId ? [surface.destinationId] : []), ...(surface.destinationIds ?? [])]
    for (const destination of destinations) {
      if (!ids.has(destination)) throw new Error(`Derived surface ${surface.id} references missing destination ${destination}.`)
    }
  }
  for (const room of Object.values(ROOM_PAGE_CONFIGS)) {
    if (!routeIds.has(routeSurfaceId(room.path))) throw new Error(`Room page ${room.path} has no DASHBOARD_ROUTES surface.`)
  }
}

export function collectDerivedSurfaceInventory(): DerivedSurfaceInventory {
  const configuredSurfaces = [
    ...routeSurfaces(),
    ...roomSurfaces(),
    ...modalOpenerFamilySurfaces(),
    ...todoSurfaces(),
    ...configuredSectionSurfaces(),
    ...homeSurfaces(),
    ...securitySurfaces(),
    ...canonicalSurfaces(),
    ...automaticBehaviorSurfaces(),
  ]
  const surfaces = [
    ...configuredSurfaces,
    ...routeVisibleSectionSurfaces(configuredSurfaces),
  ].sort((left, right) => left.id.localeCompare(right.id))

  validateDerivedSurfaces(surfaces)
  const byKind = initializedCount(DERIVED_SURFACE_KINDS)
  const byInteraction = initializedCount(DERIVED_SURFACE_INTERACTIONS)
  for (const surface of surfaces) {
    byKind[surface.kind] += 1
    byInteraction[surface.interaction] += 1
  }

  return {
    schemaVersion: 3,
    counts: {
      total: surfaces.length,
      byKind,
      byInteraction,
    },
    surfaces,
    extensionPoints: [...DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS].sort((left, right) => left.id.localeCompare(right.id)),
  }
}

export function serializeDerivedSurfaceInventory(inventory: DerivedSurfaceInventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`
}

export function derivedSurfaceInventoriesMatch(committed: unknown, current: DerivedSurfaceInventory) {
  return JSON.stringify(committed) === JSON.stringify(current)
}
