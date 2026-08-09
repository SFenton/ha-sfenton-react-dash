import type { ManualSurface } from './types'
import { DERIVED_SURFACE_KINDS, type DerivedSurfaceInventory, type DerivedSurfaceKind, type DerivedSurfaceRecord } from './surfaceInventory'

export type DerivedSurfaceOwnershipMatchKind = 'family-source-id' | 'route-family-source-id' | 'source-id' | 'stable-id'

export interface DerivedSurfaceOwnershipMatch {
  manualSurfaceId: string
  matchKind: DerivedSurfaceOwnershipMatchKind
}

export interface DerivedSurfaceCoverageKindCount {
  total: number
  covered: number
  uncovered: number
}

export interface DerivedSurfaceCoverageReport {
  total: number
  covered: number
  uncovered: number
  byKind: Record<DerivedSurfaceKind, DerivedSurfaceCoverageKindCount>
  coveredSurfaceIds: string[]
  uncoveredSurfaceIds: string[]
  ambiguousSurfaceIds: string[]
}

function ownedManualSurfaces(manualSurfaces: ManualSurface[]) {
  return manualSurfaces.filter((surface) => Boolean(surface.ownerArticleId))
}

export function manualOwnershipMatches(surface: DerivedSurfaceRecord, manualSurfaces: ManualSurface[]): DerivedSurfaceOwnershipMatch[] {
  const owned = ownedManualSurfaces(manualSurfaces)
  const stableMatches = owned
    .filter((manualSurface) => manualSurface.id === surface.id)
    .map((manualSurface) => ({ manualSurfaceId: manualSurface.id, matchKind: 'stable-id' as const }))
  if (stableMatches.length > 0) return stableMatches

  const sourceMatches = owned
    .filter((manualSurface) => manualSurface.sourceIds?.some((sourceId) => sourceId === surface.sourceId || sourceId === surface.id))
    .map((manualSurface) => ({ manualSurfaceId: manualSurface.id, matchKind: 'source-id' as const }))
  if (sourceMatches.length > 0) return sourceMatches

  const familySourceIds = surface.familySourceIds ?? []
  const familyTiers = [
    familySourceIds.filter((sourceId) => sourceId.startsWith('room-card-kind:')),
    familySourceIds.filter((sourceId) => !sourceId.startsWith('room-card-kind:') && !sourceId.startsWith('route:')),
    familySourceIds.filter((sourceId) => sourceId.startsWith('route:')),
  ]
  for (const [index, tierSourceIds] of familyTiers.entries()) {
    if (tierSourceIds.length === 0) continue
    const matches = owned
      .filter((manualSurface) => manualSurface.sourceIds?.some((sourceId) => tierSourceIds.includes(sourceId)))
      .map((manualSurface) => ({
        manualSurfaceId: manualSurface.id,
        matchKind: index === familyTiers.length - 1 ? 'route-family-source-id' as const : 'family-source-id' as const,
      }))
    if (matches.length > 0) return matches
  }
  return []
}

export function deriveSurfaceCoverage(inventory: DerivedSurfaceInventory, manualSurfaces: ManualSurface[]): DerivedSurfaceCoverageReport {
  const byKind = Object.fromEntries(DERIVED_SURFACE_KINDS.map((kind) => [kind, { total: 0, covered: 0, uncovered: 0 }])) as Record<DerivedSurfaceKind, DerivedSurfaceCoverageKindCount>
  const coveredSurfaceIds: string[] = []
  const uncoveredSurfaceIds: string[] = []
  const ambiguousSurfaceIds: string[] = []

  for (const surface of inventory.surfaces) {
    const manualSurfaceIds = new Set(manualOwnershipMatches(surface, manualSurfaces).map((match) => match.manualSurfaceId))
    const covered = manualSurfaceIds.size > 0
    byKind[surface.kind].total += 1
    byKind[surface.kind][covered ? 'covered' : 'uncovered'] += 1
    if (covered) coveredSurfaceIds.push(surface.id)
    else uncoveredSurfaceIds.push(surface.id)
    if (manualSurfaceIds.size > 1) ambiguousSurfaceIds.push(surface.id)
  }

  return {
    total: inventory.surfaces.length,
    covered: coveredSurfaceIds.length,
    uncovered: uncoveredSurfaceIds.length,
    byKind,
    coveredSurfaceIds,
    uncoveredSurfaceIds,
    ambiguousSurfaceIds,
  }
}

export function formatDerivedSurfaceCoverage(report: DerivedSurfaceCoverageReport) {
  return DERIVED_SURFACE_KINDS
    .map((kind) => `${kind} ${report.byKind[kind].covered}/${report.byKind[kind].total} owned (${report.byKind[kind].uncovered} uncovered)`)
    .join(', ')
}
