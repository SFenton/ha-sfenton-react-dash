import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MODAL_OPENER_INVENTORY } from '../constants/modalOpeners'
import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import { DASHBOARD_ROUTES } from '../constants/routes'
import { deriveSurfaceCoverage, manualOwnershipMatches } from './surfaceCoverage'
import { collectDerivedSurfaceInventory, DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS, derivedSurfaceInventoriesMatch, type DerivedSurfaceInventory } from './surfaceInventory'
import { ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND } from './familyGuides'
import { MANUAL_BEHAVIOR_GUIDE_ARTICLES } from './behaviorGuides'
import { roomCardFamilySourceId, roomCardFamilySurfaceId } from './roomCardFamilies'
import { MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET, MANUAL_SURFACES } from './surfaces'
import type { ManualSurface } from './types'

describe('derived App Manual surface inventory', () => {
  const inventory = collectDerivedSurfaceInventory()

  it('derives the expected route, room, and opener-family census', () => {
    expect(DASHBOARD_ROUTES).toHaveLength(44)
    expect(inventory.counts.byKind.route).toBe(44)
    expect(Object.keys(ROOM_PAGE_CONFIGS)).toHaveLength(16)
    expect(inventory.counts.byKind['room-card']).toBe(116)
    expect(inventory.surfaces.filter((surface) => surface.sourceId.startsWith('room-section:'))).toHaveLength(26)
    expect(inventory.counts.byKind['modal-opener-family']).toBe(MODAL_OPENER_INVENTORY.length)
    expect(inventory.counts.byKind['automatic-behavior']).toBe(MANUAL_BEHAVIOR_GUIDE_ARTICLES.length)
    expect(inventory.surfaces.some((surface) => surface.sourceReference.includes('SECURITY_SECTIONS'))).toBe(false)
    expect(inventory.surfaces.some((surface) => surface.sourceReference.includes('ROOM_EXTRA_SECTIONS'))).toBe(false)
    expect(inventory.surfaces.some((surface) => surface.sourceReference.includes('SECURITY_MACHE_TILES'))).toBe(false)

    const configuredRoomCards = Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => [
      ...room.overviewCards,
      ...room.sourceSections.flatMap((section) => section.cards),
    ])
    expect(configuredRoomCards).toHaveLength(116)
    for (const room of Object.values(ROOM_PAGE_CONFIGS)) {
      expect(inventory.surfaces.find((surface) => surface.id === `route:${room.path}`)?.sourceReference).toContain(`ROOM_PAGE_CONFIGS.${room.path}`)
    }

    expect(inventory.surfaces.find((surface) => surface.id === 'room-card:living-room:section-climate:cover-living-room-vents:vents')?.interaction).toBe('open')
    expect(inventory.surfaces.find((surface) => surface.id === 'room-card:garage:section-garage-doors:cover-left-door:left-door')?.interaction).toBe('direct-action')
    expect(inventory.surfaces.find((surface) => surface.id === 'room-card:garage:section-appliances:input-boolean-washer-started-helper:washing-machine')?.interaction).toBe('status-only')
  })

  it('uses stable semantic IDs while keeping opener and destination identity separate', () => {
    expect(new Set(inventory.surfaces.map((surface) => surface.id)).size).toBe(inventory.surfaces.length)
    expect(inventory.surfaces.some((surface) => surface.id.includes('#'))).toBe(false)
    expect(inventory.surfaces.find((surface) => surface.sourceId === 'route:overview')?.id).toBe('route:overview')

    const livingRoomAirQuality = inventory.surfaces.find((surface) => surface.id === 'room-card:living-room:overview:sensor-living-room-air-purifier-pm2-5:air-quality')
    const livingRoomAirPurifier = inventory.surfaces.find((surface) => surface.id === 'room-card:living-room:section-climate:select-living-room-air-purifier-fan-mode:air-purifier')
    expect(livingRoomAirQuality?.destinationHint).toBe('#air-purifier')
    expect(livingRoomAirPurifier?.destinationHint).toBe('#air-purifier')
    expect(livingRoomAirQuality?.id).not.toBe(livingRoomAirPurifier?.id)
    expect(livingRoomAirQuality?.openerId).not.toBe(livingRoomAirPurifier?.openerId)
    expect(livingRoomAirQuality?.destinationId).toBe(livingRoomAirPurifier?.destinationId)
    expect(livingRoomAirQuality?.familySourceIds).toEqual(['room-card-kind:air', 'modal:room-status-chips'])
    expect(livingRoomAirPurifier?.familySourceIds).toEqual(['room-card-kind:air', 'modal:room-source-cards'])
  })

  it('assigns every configured room card to one of the fourteen semantic family sources', () => {
    const configuredKinds = [...new Set(Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => [
      ...room.overviewCards,
      ...room.sourceSections.flatMap((section) => section.cards),
    ]).map((card) => card.kind))].sort()

    expect(configuredKinds).toHaveLength(14)
    expect(Object.keys(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND).sort()).toEqual(configuredKinds)
    for (const kind of configuredKinds) {
      const kindSurfaces = inventory.surfaces.filter((surface) => surface.kind === 'room-card' && surface.familySourceIds?.includes(roomCardFamilySourceId(kind)))
      expect(kindSurfaces.length).toBeGreaterThan(0)
      for (const surface of kindSurfaces) {
        expect(manualOwnershipMatches(surface, MANUAL_SURFACES)).toEqual([{
          manualSurfaceId: roomCardFamilySurfaceId(kind),
          matchKind: 'family-source-id',
        }])
      }
    }
  })

  it('derives distinct Downstairs Hallway light and door destinations', () => {
    const hallwayCards = inventory.surfaces.filter((surface) => surface.kind === 'room-card' && surface.routes.includes('downstairs-hallway'))
    const light = hallwayCards.find((surface) => surface.visibleName === 'Light')
    const door = hallwayCards.find((surface) => surface.visibleName === 'Door')

    expect(light?.destinationHint).toBe('#light-downstairs-hallway')
    expect(door?.destinationHint).toBe('#door-downstairs-hallway')
    expect(light?.destinationId).not.toBe(door?.destinationId)
  })

  it('maps stable, family, and route-fallback ownership and holds the numeric ratchet', () => {
    const coverage = deriveSurfaceCoverage(inventory, MANUAL_SURFACES)
    const overviewRoute = inventory.surfaces.find((surface) => surface.id === 'route:overview')
    const lightsChip = inventory.surfaces.find((surface) => surface.id === 'home.status-chip-lights')

    expect(overviewRoute && manualOwnershipMatches(overviewRoute, MANUAL_SURFACES)).toContainEqual({
      manualSurfaceId: 'route:overview',
      matchKind: 'stable-id',
    })
    expect(lightsChip && manualOwnershipMatches(lightsChip, MANUAL_SURFACES)).toContainEqual({
      manualSurfaceId: 'home.status-chip-lights',
      matchKind: 'stable-id',
    })
    const drivewayCamera = inventory.surfaces.find((surface) => surface.id === 'camera:garage-camera')
    expect(drivewayCamera && manualOwnershipMatches(drivewayCamera, MANUAL_SURFACES)).toContainEqual({
      manualSurfaceId: 'modal-opener-family:camera-tiles',
      matchKind: 'family-source-id',
    })
    const mediaSection = inventory.surfaces.find((surface) => surface.id === 'page-section:media:media:living-room')
    expect(mediaSection && manualOwnershipMatches(mediaSection, MANUAL_SURFACES)).toEqual([{
      manualSurfaceId: 'route:media',
      matchKind: 'route-family-source-id',
    }])
    const securityTile = inventory.surfaces.find((surface) => surface.kind === 'security-tile')
    expect(securityTile && manualOwnershipMatches(securityTile, MANUAL_SURFACES)).toEqual([{
      manualSurfaceId: 'modal-opener-family:security-system-tile',
      matchKind: 'family-source-id',
    }])
    expect(coverage.ambiguousSurfaceIds).toEqual([])
    expect(coverage.total).toBe(522)
    expect(coverage.covered).toBe(522)
    expect(coverage.uncovered).toBe(0)
    expect(coverage.byKind.route).toEqual({ total: 44, covered: 44, uncovered: 0 })
    expect(Object.values(coverage.byKind).every((count) => count.uncovered === 0)).toBe(true)
    expect(coverage.uncoveredSurfaceIds).toEqual([])
    expect(MANUAL_DERIVED_SURFACE_UNCOVERED_BUDGET).toBe(0)
  })

  it('prefers stable and specific family ownership over route fallback', () => {
    const quickLink = inventory.surfaces.find((surface) => surface.kind === 'quick-link' && surface.visibleName === 'Food & Recipes')
    if (!quickLink) throw new Error('Missing Food & Recipes quick link')
    const routeOwner = MANUAL_SURFACES.find((surface) => surface.id === 'route:overview')
    if (!routeOwner) throw new Error('Missing overview route owner')
    const specificOwner: ManualSurface = {
      id: 'test.quick-link-family',
      kind: 'component',
      visibleName: 'Quick link family',
      routes: ['overview'],
      implementation: 'test',
      ownerArticleId: 'test-owner',
      coverage: 'covered',
      sourceIds: ['modal:overview-route-quick-links'],
      screenshotPolicy: 'none',
    }
    expect(manualOwnershipMatches(quickLink, [routeOwner, specificOwner])).toEqual([{
      manualSurfaceId: specificOwner.id,
      matchKind: 'family-source-id',
    }])

    const exactOwner: ManualSurface = {
      ...specificOwner,
      id: quickLink.id,
      sourceIds: [],
    }
    expect(manualOwnershipMatches(quickLink, [routeOwner, specificOwner, exactOwner])).toEqual([{
      manualSurfaceId: quickLink.id,
      matchKind: 'stable-id',
    }])
  })

  it('detects stale generated inventory and leaves only genuinely dynamic row extensions', () => {
    const committed = JSON.parse(readFileSync(resolve(process.cwd(), 'src/manual/generated/surfaceInventory.json'), 'utf8'))
    expect(derivedSurfaceInventoriesMatch(committed, inventory)).toBe(true)

    const stale = structuredClone(inventory) as DerivedSurfaceInventory
    stale.surfaces[0].visibleName = 'Stale surface'
    expect(derivedSurfaceInventoriesMatch(stale, inventory)).toBe(false)
    expect(DERIVED_SURFACE_COLLECTOR_EXTENSION_POINTS).toEqual([expect.objectContaining({
      id: 'dynamic.todo-items',
      kind: 'dynamic-item',
    })])
  })

  it('backs every authored route section name with a derived page-section surface', () => {
    for (const route of DASHBOARD_ROUTES) {
      for (const visibleName of route.manualVisibleSectionNames ?? []) {
        expect(inventory.surfaces.some((surface) => (
          surface.kind === 'page-section'
          && surface.routes.includes(route.path)
          && surface.visibleName === visibleName
        )), `${route.path}: ${visibleName}`).toBe(true)
      }
    }
  })
})
