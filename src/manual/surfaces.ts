import { ROOM_PAGE_CONFIGS, type RoomSourceKind } from '../constants/roomPages'
import { DASHBOARD_ROUTES } from '../constants/routes'
import { MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { MANUAL_ARTICLES } from './catalog'
import { isManualFamilyGuideArticle } from './familyGuides'
import { automaticBehaviorSurfaceId, isManualBehaviorGuideArticle } from './behaviorGuides'
import { completedManualPageGuideRouteBindings } from './pageGuides'
import { roomCardFamilySourceId, roomCardFamilySurfaceId } from './roomCardFamilies'
import { CANONICAL_SURFACE_DEFINITIONS, MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS, type CanonicalSurfaceKind } from './surfaceDefinitions'
import type { ManualSurface } from './types'

/** Permanent release contract: every derived surface must have one canonical owner. */
export const MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET = 0

export const MANUAL_ROUTE_GUIDE_SURFACES: ManualSurface[] = completedManualPageGuideRouteBindings(DASHBOARD_ROUTES, MANUAL_ARTICLES).map(({ article, route }) => ({
  id: `route:${route.path}`,
  kind: 'route',
  visibleName: route.title,
  routes: [route.path],
  implementation: `DASHBOARD_ROUTES.${route.path}`,
  ownerArticleId: article.id,
  coverage: 'covered',
  sourceIds: [`route:${route.path}`],
  screenshotPolicy: 'overview',
}))

function roomRoutesForCardKind(kind: RoomSourceKind) {
  return Object.values(ROOM_PAGE_CONFIGS)
    .filter((room) => [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)].some((card) => card.kind === kind))
    .map((room) => room.path)
}

export const MANUAL_FAMILY_GUIDE_SURFACES: ManualSurface[] = MANUAL_ARTICLES
  .filter(isManualFamilyGuideArticle)
  .map((article) => ({
    id: roomCardFamilySurfaceId(article.familyGuide.cardKind),
    kind: 'component',
    visibleName: article.title,
    routes: roomRoutesForCardKind(article.familyGuide.cardKind),
    implementation: `ROOM_PAGE_CONFIGS RoomSourceCard.kind=${article.familyGuide.cardKind}`,
    ownerArticleId: article.id,
    coverage: 'covered',
    sourceIds: [roomCardFamilySourceId(article.familyGuide.cardKind)],
    screenshotPolicy: 'overview',
  }))

export const MANUAL_BEHAVIOR_GUIDE_SURFACES: ManualSurface[] = MANUAL_ARTICLES
  .filter(isManualBehaviorGuideArticle)
  .map((article) => ({
    id: automaticBehaviorSurfaceId(article.id),
    kind: 'automatic-behavior',
    visibleName: article.title,
    routes: [...article.behaviorGuide.affectedRoutes],
    implementation: 'Home Assistant automation and script ownership registry',
    ownerArticleId: article.id,
    coverage: 'covered',
    sourceIds: [automaticBehaviorSurfaceId(article.id)],
    screenshotPolicy: 'none',
    screenshotPolicyReason: 'Automatic behavior is explained through affected route, control, and workflow evidence rather than a standalone visual surface.',
  }))

function manualSurfaceKind(kind: CanonicalSurfaceKind): ManualSurface['kind'] {
  if (kind === 'modal-destination') return 'modal'
  return kind
}

export const MANUAL_CANONICAL_SURFACES: ManualSurface[] = CANONICAL_SURFACE_DEFINITIONS.map((surface) => ({
  id: surface.id,
  kind: manualSurfaceKind(surface.kind),
  visibleName: surface.visibleName,
  ...(surface.parentId ? { parentSurfaceId: surface.parentId } : {}),
  routes: [...surface.routes],
  implementation: surface.implementation,
  ownerArticleId: surface.ownerArticleId,
  coverage: 'covered',
  sourceIds: [`semantic-surface:${surface.id}`],
  screenshotPolicy: surface.screenshotPolicy,
  ...(surface.screenshotPolicyReason ? { screenshotPolicyReason: surface.screenshotPolicyReason } : {}),
}))

export const MANUAL_MODAL_OPENER_SURFACES: ManualSurface[] = MODAL_OPENER_INVENTORY.map((opener) => ({
  id: `modal-opener-family:${opener.id}`,
  kind: 'component',
  visibleName: opener.label,
  routes: [],
  implementation: opener.implementation,
  ownerArticleId: MODAL_OPENER_FAMILY_OWNER_ARTICLE_IDS[opener.id],
  coverage: 'covered',
  sourceIds: [`modal:${opener.id}`],
  screenshotPolicy: 'none',
  screenshotPolicyReason: 'The opener family is evidenced by its route or destination screenshot; duplicate opener-only artwork would not add useful instruction.',
}))

export const MANUAL_SURFACES: ManualSurface[] = [
  ...MANUAL_ROUTE_GUIDE_SURFACES,
  ...MANUAL_FAMILY_GUIDE_SURFACES,
  ...MANUAL_BEHAVIOR_GUIDE_SURFACES,
  ...MANUAL_CANONICAL_SURFACES,
  ...MANUAL_MODAL_OPENER_SURFACES,
  {
    id: 'security.access-controls',
    kind: 'stateful-control',
    visibleName: 'Front door and garage controls',
    parentSurfaceId: 'route:security',
    routes: ['security'],
    implementation: 'SecurityDashboard SecurityTile',
    ownerArticleId: 'security-access-controls',
    coverage: 'covered',
    sourceIds: [
      'security-tile:control:lock-aqara-smart-lock-u400:front-door',
      'security-tile:control:cover-left-door:left-door',
      'security-tile:control:cover-right-door:right-door',
    ],
    stateMatrixId: 'security',
    screenshotPolicy: 'state',
  },
  {
    id: 'home.status-chip-lights',
    kind: 'status-chip',
    visibleName: 'Lights status chip',
    parentSurfaceId: 'home.status-rail',
    routes: ['overview'],
    implementation: 'StatusChip with #lights-overview',
    ownerArticleId: 'status-chips',
    coverage: 'covered',
    screenshotPolicy: 'focused',
  },
  ...[
    ['home.status-chip-security', 'Security status chip', 'security-system-modes'],
    ['home.status-chip-climate', 'Climate status chip', 'status-chips'],
    ['home.status-chip-occupancy', 'Occupancy status chip', 'status-chips'],
    ['home.status-chip-contact-sensors', 'Contact Sensors status chip', 'status-chips'],
    ['home.status-chip-air-quality', 'Air Quality status chip', 'status-chips'],
  ].map(([id, visibleName, ownerArticleId]) => ({
    id,
    kind: 'status-chip' as const,
    visibleName,
    parentSurfaceId: 'home.status-rail',
    routes: ['overview'],
    implementation: 'StatusChip',
    ownerArticleId,
    coverage: 'covered' as const,
    screenshotPolicy: 'focused' as const,
  })),
]

export const MANUAL_SURFACES_BY_ID = new Map(MANUAL_SURFACES.map((surface) => [surface.id, surface]))
