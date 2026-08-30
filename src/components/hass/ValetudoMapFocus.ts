import type { VacuumMapFocusConfig } from '../../constants/portedDashboard'
import {
  expandValetudoLayerPixels,
  valetudoMapBounds,
  type ValetudoMap,
  type ValetudoMapBounds,
  type ValetudoMapEntity,
  type ValetudoMapLayer,
} from './ValetudoMapCard.utils'
import type { MapGridRect } from './ValetudoMapGeometry'

const DIRECTIONS_8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

const DEFAULT_MINIMUM_EXCLUDED_AREA_M2 = 4
const DEFAULT_MINIMUM_EXCLUDED_FRACTION = 0.1
const DEFAULT_MAXIMUM_VIEW_AREA_RATIO = 0.85
const DEFAULT_PADDING_CM = 15
const DEFAULT_WALL_ASSOCIATION_CM = 20
const GRID_KEY_STRIDE = 100_000
const POSITION_SEARCH_RADIUS_GRID = 3
const ROUTE_SEARCH_RADIUS_GRID = 1
const ROUTE_ENTITY_TYPES = new Set(['active_zone', 'go_to_target', 'path', 'predicted_path'])

export type ValetudoMapFocusReason =
  | 'active-route-excluded'
  | 'active-segment-excluded'
  | 'anchor-outside-focus'
  | 'focused'
  | 'insufficient-benefit'
  | 'invalid-map'
  | 'missing-anchor'
  | 'missing-required-segment'
  | 'named-segment-excluded'
  | 'overlapping-segments'
  | 'segment-name-mismatch'
  | 'unconfigured'

export interface ValetudoMapFocusResult {
  acceptedSegmentIds: ReadonlySet<string>
  excludedAreaM2: number
  excludedSegmentIds: readonly string[]
  interactionBounds: ValetudoMapBounds
  mode: 'focused' | 'full'
  rawBounds: ValetudoMapBounds
  reason: ValetudoMapFocusReason
  renderWallPixelKeys: ReadonlySet<number> | null
  viewBounds: ValetudoMapBounds
}

interface SegmentData {
  active: boolean
  id: string
  name: string | null
  pixels: number[]
}

interface MutableBounds {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

export function valetudoMapPixelKey(x: number, y: number) {
  return x * GRID_KEY_STRIDE + y
}

function valetudoMapPointFromKey(key: number) {
  const x = Math.floor(key / GRID_KEY_STRIDE)
  return { x, y: key - x * GRID_KEY_STRIDE }
}

function segmentId(layer: ValetudoMapLayer) {
  const value = layer.metaData?.segmentId
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

function segmentName(layer: ValetudoMapLayer) {
  const value = layer.metaData?.name
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function emptyBounds(): MutableBounds {
  return {
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
  }
}

function includePoint(bounds: MutableBounds, x: number, y: number) {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function hasBounds(bounds: MutableBounds): bounds is ValetudoMapBounds {
  return Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxY)
}

function boundsArea(bounds: ValetudoMapBounds) {
  return Math.max(0, bounds.maxX - bounds.minX + 1) * Math.max(0, bounds.maxY - bounds.minY + 1)
}

function fullMapResult(
  rawBounds: ValetudoMapBounds,
  segmentIds: Iterable<string>,
  reason: Exclude<ValetudoMapFocusReason, 'focused'>,
): ValetudoMapFocusResult {
  return {
    acceptedSegmentIds: new Set(segmentIds),
    excludedAreaM2: 0,
    excludedSegmentIds: [],
    interactionBounds: rawBounds,
    mode: 'full',
    rawBounds,
    reason,
    renderWallPixelKeys: null,
    viewBounds: rawBounds,
  }
}

function nearestSegmentId(
  point: readonly number[],
  pixelSize: number,
  cells: ReadonlyMap<number, string>,
  radius: number,
) {
  if (point.length < 2 || pixelSize <= 0) return null
  const gridX = (point[0] ?? 0) / pixelSize
  const gridY = (point[1] ?? 0) / pixelSize
  const minimumX = Math.floor(gridX - radius)
  const maximumX = Math.ceil(gridX + radius)
  const minimumY = Math.floor(gridY - radius)
  const maximumY = Math.ceil(gridY + radius)
  let nearest: { distance: number; id: string } | null = null

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const id = cells.get(valetudoMapPixelKey(x, y))
      if (!id) continue
      const distance = (x - gridX) ** 2 + (y - gridY) ** 2
      if (distance > radius ** 2 || (nearest && distance >= nearest.distance)) continue
      nearest = { distance, id }
    }
  }

  return nearest?.id ?? null
}

function pointInPolygon(x: number, y: number, points: readonly number[]) {
  let inside = false
  for (let current = 0, previous = points.length - 2; current < points.length; previous = current, current += 2) {
    const currentX = points[current] ?? 0
    const currentY = points[current + 1] ?? 0
    const previousX = points[previous] ?? 0
    const previousY = points[previous + 1] ?? 0
    const crosses = (currentY > y) !== (previousY > y)
      && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX
    if (crosses) inside = !inside
  }
  return inside
}

function lineTouchesExcluded(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pixelSize: number,
  cells: ReadonlyMap<number, string>,
  excludedSegmentIds: ReadonlySet<string>,
) {
  const startGridX = startX / pixelSize
  const startGridY = startY / pixelSize
  const endGridX = endX / pixelSize
  const endGridY = endY / pixelSize
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(endGridX - startGridX), Math.abs(endGridY - startGridY)) * 2))

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    const point = [
      (startGridX + (endGridX - startGridX) * progress) * pixelSize,
      (startGridY + (endGridY - startGridY) * progress) * pixelSize,
    ]
    const id = nearestSegmentId(point, pixelSize, cells, ROUTE_SEARCH_RADIUS_GRID)
    if (id && excludedSegmentIds.has(id)) return true
  }
  return false
}

function entityTouchesExcluded(
  entity: ValetudoMapEntity,
  pixelSize: number,
  cells: ReadonlyMap<number, string>,
  excludedSegmentIds: ReadonlySet<string>,
) {
  const points = entity.points ?? []
  for (let index = 0; index + 1 < points.length; index += 2) {
    const id = nearestSegmentId([points[index] ?? 0, points[index + 1] ?? 0], pixelSize, cells, ROUTE_SEARCH_RADIUS_GRID)
    if (id && excludedSegmentIds.has(id)) return true
  }

  for (let index = 0; index + 3 < points.length; index += 2) {
    if (lineTouchesExcluded(
      points[index] ?? 0,
      points[index + 1] ?? 0,
      points[index + 2] ?? 0,
      points[index + 3] ?? 0,
      pixelSize,
      cells,
      excludedSegmentIds,
    )) return true
  }

  if (entity.type !== 'active_zone' || points.length < 6) return false
  if (lineTouchesExcluded(
    points.at(-2) ?? 0,
    points.at(-1) ?? 0,
    points[0] ?? 0,
    points[1] ?? 0,
    pixelSize,
    cells,
    excludedSegmentIds,
  )) return true

  for (const [key, id] of cells) {
    if (!excludedSegmentIds.has(id)) continue
    const point = valetudoMapPointFromKey(key)
    if (pointInPolygon((point.x + 0.5) * pixelSize, (point.y + 0.5) * pixelSize, points)) return true
  }
  return false
}

function wallOwnership(
  x: number,
  y: number,
  radius: number,
  cells: ReadonlyMap<number, string>,
  acceptedSegmentIds: ReadonlySet<string>,
) {
  const radiusSquared = radius ** 2
  let acceptedDistance = Number.POSITIVE_INFINITY
  let excludedDistance = Number.POSITIVE_INFINITY

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const distance = offsetX ** 2 + offsetY ** 2
      if (distance > radiusSquared) continue
      const id = cells.get(valetudoMapPixelKey(x + offsetX, y + offsetY))
      if (!id) continue
      if (acceptedSegmentIds.has(id)) acceptedDistance = Math.min(acceptedDistance, distance)
      else excludedDistance = Math.min(excludedDistance, distance)
    }
  }

  if (!Number.isFinite(acceptedDistance)) return 'excluded'
  if (acceptedDistance < excludedDistance) return 'accepted'
  if (acceptedDistance === excludedDistance) return 'shared'
  return 'excluded'
}

function findEntity(map: ValetudoMap, type: string) {
  return map.entities.find((entity) => entity.type === type)
}

export function mapGridRectWithinBounds(rect: MapGridRect, bounds: ValetudoMapBounds) {
  const minimumX = Math.min(rect.x0, rect.x1)
  const maximumX = Math.max(rect.x0, rect.x1)
  const minimumY = Math.min(rect.y0, rect.y1)
  const maximumY = Math.max(rect.y0, rect.y1)
  return minimumX >= bounds.minX
    && maximumX <= bounds.maxX + 1
    && minimumY >= bounds.minY
    && maximumY <= bounds.maxY + 1
}

export function resolveValetudoMapFocus(
  map: ValetudoMap,
  policy: VacuumMapFocusConfig | undefined,
): ValetudoMapFocusResult {
  const rawBounds = valetudoMapBounds(map)
  const segments: SegmentData[] = map.layers
    .filter((layer) => layer.type === 'segment')
    .map((layer) => {
      const id = segmentId(layer)
      return id
        ? {
            active: layer.metaData?.active === true,
            id,
            name: segmentName(layer),
            pixels: expandValetudoLayerPixels(layer),
          }
        : null
    })
    .filter((segment): segment is SegmentData => Boolean(segment))
  const allSegmentIds = new Set(segments.map((segment) => segment.id))

  if (!policy?.requiredSegments.length) return fullMapResult(rawBounds, allSegmentIds, 'unconfigured')
  if (map.metaData?.version !== 2 || !Number.isFinite(map.pixelSize) || map.pixelSize <= 0 || segments.length === 0) {
    return fullMapResult(rawBounds, allSegmentIds, 'invalid-map')
  }

  const segmentsById = new Map<string, SegmentData[]>()
  const cells = new Map<number, string>()
  let overlappingSegments = false
  for (const segment of segments) {
    const existingSegments = segmentsById.get(segment.id) ?? []
    existingSegments.push(segment)
    segmentsById.set(segment.id, existingSegments)
    for (let index = 0; index + 1 < segment.pixels.length; index += 2) {
      const key = valetudoMapPixelKey(segment.pixels[index] ?? 0, segment.pixels[index + 1] ?? 0)
      const existingId = cells.get(key)
      if (existingId && existingId !== segment.id) overlappingSegments = true
      cells.set(key, segment.id)
    }
  }

  if (overlappingSegments) return fullMapResult(rawBounds, allSegmentIds, 'overlapping-segments')

  for (const required of policy.requiredSegments) {
    const matching = segmentsById.get(required.id)
    if (!matching?.length) return fullMapResult(rawBounds, allSegmentIds, 'missing-required-segment')
    if (required.name && !matching.some((segment) => segment.name === required.name)) {
      return fullMapResult(rawBounds, allSegmentIds, 'segment-name-mismatch')
    }
  }

  // Segment IDs remain the indivisible action unit; diagonal contact avoids
  // dropping rooms that only touch because of rasterization.
  const graph = new Map<string, Set<string>>([...allSegmentIds].map((id) => [id, new Set<string>()]))
  for (const [key, id] of cells) {
    const x = Math.floor(key / GRID_KEY_STRIDE)
    const y = key - x * GRID_KEY_STRIDE
    for (const [offsetX, offsetY] of DIRECTIONS_8) {
      const neighborId = cells.get(valetudoMapPixelKey(x + offsetX, y + offsetY))
      if (!neighborId || neighborId === id) continue
      graph.get(id)?.add(neighborId)
      graph.get(neighborId)?.add(id)
    }
  }

  const acceptedSegmentIds = new Set<string>()
  for (const required of policy.requiredSegments) {
    const queue = [required.id]
    acceptedSegmentIds.add(required.id)
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]
      for (const neighbor of graph.get(current) ?? []) {
        if (acceptedSegmentIds.has(neighbor)) continue
        acceptedSegmentIds.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  const excludedSegmentIds = [...allSegmentIds].filter((id) => !acceptedSegmentIds.has(id)).sort((left, right) => Number(left) - Number(right))
  const excludedSet = new Set(excludedSegmentIds)

  for (const id of excludedSegmentIds) {
    const excludedLayers = segmentsById.get(id) ?? []
    if (excludedLayers.some((segment) => segment.name)) {
      return fullMapResult(rawBounds, allSegmentIds, 'named-segment-excluded')
    }
    if (excludedLayers.some((segment) => segment.active)) {
      return fullMapResult(rawBounds, allSegmentIds, 'active-segment-excluded')
    }
  }

  for (const type of ['robot_position', 'charger_location']) {
    const entity = findEntity(map, type)
    if (!entity) return fullMapResult(rawBounds, allSegmentIds, 'missing-anchor')
    const nearestId = nearestSegmentId(entity.points ?? [], map.pixelSize, cells, POSITION_SEARCH_RADIUS_GRID)
    if (!nearestId || !acceptedSegmentIds.has(nearestId)) {
      return fullMapResult(rawBounds, allSegmentIds, 'anchor-outside-focus')
    }
  }

  // Transient navigation data validates the focus but never expands it.
  if (map.entities.some((entity) => ROUTE_ENTITY_TYPES.has(entity.type) && entityTouchesExcluded(entity, map.pixelSize, cells, excludedSet))) {
    return fullMapResult(rawBounds, allSegmentIds, 'active-route-excluded')
  }

  const totalSegmentCells = segments.reduce((total, segment) => total + segment.pixels.length / 2, 0)
  const excludedCells = segments
    .filter((segment) => excludedSet.has(segment.id))
    .reduce((total, segment) => total + segment.pixels.length / 2, 0)
  const excludedAreaM2 = excludedCells * map.pixelSize * map.pixelSize / 10_000
  const excludedFraction = totalSegmentCells > 0 ? excludedCells / totalSegmentCells : 0
  if (
    excludedAreaM2 < (policy.minimumExcludedAreaM2 ?? DEFAULT_MINIMUM_EXCLUDED_AREA_M2)
    || excludedFraction < (policy.minimumExcludedFraction ?? DEFAULT_MINIMUM_EXCLUDED_FRACTION)
  ) {
    return fullMapResult(rawBounds, allSegmentIds, 'insufficient-benefit')
  }

  const interactionBounds = emptyBounds()
  for (const segment of segments) {
    if (!acceptedSegmentIds.has(segment.id)) continue
    for (let index = 0; index + 1 < segment.pixels.length; index += 2) {
      includePoint(interactionBounds, segment.pixels[index] ?? 0, segment.pixels[index + 1] ?? 0)
    }
  }
  if (!hasBounds(interactionBounds)) return fullMapResult(rawBounds, allSegmentIds, 'invalid-map')

  const coreBounds: MutableBounds = { ...interactionBounds }
  const renderWallPixelKeys = new Set<number>()
  const wallRadius = Math.max(1, Math.ceil((policy.wallAssociationCm ?? DEFAULT_WALL_ASSOCIATION_CM) / map.pixelSize))
  // The global wall layer spans the reflected area, so assign each wall pixel
  // to the nearest accepted or excluded floor before calculating view bounds.
  for (const layer of map.layers) {
    if (layer.type !== 'wall') continue
    const pixels = expandValetudoLayerPixels(layer)
    for (let index = 0; index + 1 < pixels.length; index += 2) {
      const x = pixels[index] ?? 0
      const y = pixels[index + 1] ?? 0
      const ownership = wallOwnership(x, y, wallRadius, cells, acceptedSegmentIds)
      if (ownership === 'excluded') continue
      renderWallPixelKeys.add(valetudoMapPixelKey(x, y))
      if (ownership === 'accepted') includePoint(coreBounds, x, y)
    }
  }

  const padding = Math.max(0, Math.ceil((policy.paddingCm ?? DEFAULT_PADDING_CM) / map.pixelSize))
  const viewBounds = {
    minX: Math.max(rawBounds.minX, coreBounds.minX - padding),
    maxX: Math.min(rawBounds.maxX, coreBounds.maxX + padding),
    minY: Math.max(rawBounds.minY, coreBounds.minY - padding),
    maxY: Math.min(rawBounds.maxY, coreBounds.maxY + padding),
  }
  const viewAreaRatio = boundsArea(rawBounds) > 0 ? boundsArea(viewBounds) / boundsArea(rawBounds) : 1
  if (viewAreaRatio > (policy.maximumViewAreaRatio ?? DEFAULT_MAXIMUM_VIEW_AREA_RATIO)) {
    return fullMapResult(rawBounds, allSegmentIds, 'insufficient-benefit')
  }

  return {
    acceptedSegmentIds,
    excludedAreaM2,
    excludedSegmentIds,
    interactionBounds,
    mode: 'focused',
    rawBounds,
    reason: 'focused',
    renderWallPixelKeys,
    viewBounds,
  }
}
