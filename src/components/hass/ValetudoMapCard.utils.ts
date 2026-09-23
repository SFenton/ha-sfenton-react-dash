export interface ValetudoEntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  last_changed?: string
  last_updated?: string
  state: string
}

export interface ValetudoMapDimensionAxis {
  avg?: number
  max: number
  mid?: number
  min: number
}

export type ValetudoMapLayerMaterial =
  | 'carpet'
  | 'carpet_high'
  | 'carpet_low'
  | 'generic'
  | 'tile'
  | 'wood'
  | 'wood_horizontal'
  | 'wood_vertical'

export interface ValetudoMapLayerMetaData extends Record<string, unknown> {
  active?: boolean
  area?: number
  material?: ValetudoMapLayerMaterial
  name?: string
  segmentId?: string
}

export interface ValetudoMapLayer {
  __class?: string
  compressedPixels?: number[]
  dimensions?: {
    x: ValetudoMapDimensionAxis
    y: ValetudoMapDimensionAxis
  }
  metaData?: ValetudoMapLayerMetaData
  pixels?: number[]
  type: string
}

export interface ValetudoMapEntity {
  __class?: string
  metaData?: Record<string, unknown>
  points?: number[]
  type: string
}

export interface ValetudoMap {
  __class: string
  entities: ValetudoMapEntity[]
  layers: ValetudoMapLayer[]
  metaData?: Record<string, unknown>
  pixelSize: number
  size: {
    x: number
    y: number
  }
}

export interface ValetudoMapBounds {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

export type ValetudoMapMaterialAccent = 'dark' | 'light'

export interface ValetudoMapEntityRenderStyle {
  fillStyle?: string
  haloColor?: string
  icon?: 'obstacle' | 'target'
  lineDash?: number[]
  shape: 'line' | 'point' | 'polygon'
  strokeStyle: string
}

const ENTITY_RENDER_STYLES: Record<string, ValetudoMapEntityRenderStyle> = {
  active_zone: {
    fillStyle: 'rgba(77, 208, 225, 0.16)',
    shape: 'polygon',
    strokeStyle: 'rgba(128, 222, 234, 0.72)',
  },
  carpet: {
    fillStyle: 'rgba(255, 193, 7, 0.12)',
    lineDash: [3, 3],
    shape: 'polygon',
    strokeStyle: 'rgba(255, 213, 79, 0.62)',
  },
  curtain: {
    lineDash: [2, 3],
    shape: 'line',
    strokeStyle: 'rgba(128, 222, 234, 0.86)',
  },
  go_to_target: {
    haloColor: 'rgba(16, 54, 68, 0.78)',
    icon: 'target',
    shape: 'point',
    strokeStyle: '#80deea',
  },
  no_go_area: {
    fillStyle: 'rgba(239, 83, 80, 0.22)',
    shape: 'polygon',
    strokeStyle: 'rgba(255, 138, 128, 0.76)',
  },
  no_mop_area: {
    fillStyle: 'rgba(33, 150, 243, 0.2)',
    shape: 'polygon',
    strokeStyle: 'rgba(144, 202, 249, 0.76)',
  },
  obstacle: {
    haloColor: 'rgba(80, 48, 8, 0.8)',
    icon: 'obstacle',
    shape: 'point',
    strokeStyle: '#ffca6b',
  },
  ramp: {
    fillStyle: 'rgba(171, 71, 188, 0.16)',
    lineDash: [5, 3],
    shape: 'polygon',
    strokeStyle: 'rgba(206, 147, 216, 0.78)',
  },
  threshold: {
    lineDash: [6, 4],
    shape: 'line',
    strokeStyle: 'rgba(255, 183, 77, 0.9)',
  },
  virtual_wall: {
    shape: 'line',
    strokeStyle: 'rgba(255, 112, 103, 0.9)',
  },
}

const REPORTED_MAP_VISIBLE_ENTITY_TYPES = new Set([
  'carpet',
  'curtain',
  'no_go_area',
  'no_mop_area',
  'ramp',
  'robot_position',
  'threshold',
  'virtual_wall',
])

export function isReportedMapEntityVisible(type: string) {
  return REPORTED_MAP_VISIBLE_ENTITY_TYPES.has(type)
}

export function valetudoMapEntityRenderStyle(type: string) {
  return ENTITY_RENDER_STYLES[type] ?? null
}

export function valetudoMapMaterialAccent(material: ValetudoMapLayerMaterial | undefined, x: number, y: number): ValetudoMapMaterialAccent | null {
  switch (material) {
    case 'tile':
      return x % 6 === 0 || y % 6 === 0 ? 'dark' : null
    case 'wood':
      return (x + y) % 8 === 0 ? 'dark' : null
    case 'wood_horizontal':
      return y % 5 === 0 || (y % 10 === 2 && x % 12 === 0) ? 'dark' : null
    case 'wood_vertical':
      return x % 5 === 0 || (x % 10 === 2 && y % 12 === 0) ? 'dark' : null
    case 'carpet':
      return (Math.floor(x / 2) + y) % 4 === 0 ? 'light' : null
    case 'carpet_low':
      return x % 4 === 0 && y % 4 === 0 ? 'light' : null
    case 'carpet_high':
      return (x + y) % 4 === 0 || (x - y) % 7 === 0 ? 'light' : null
    default:
      return null
  }
}

const MOCK_MAP_BOUNDS: Record<string, ValetudoMapBounds> = {
  valetudo_elatedusedram: { minX: 638, maxX: 782, minY: 555, maxY: 722 },
  valetudo_exaltedsneakydeer: { minX: 558, maxX: 728, minY: 639, maxY: 1027 },
  valetudo_politefatherlykingfisher: { minX: 637, maxX: 735, minY: 535, maxY: 688 },
}
const EXPANDED_PIXEL_CACHE = new WeakMap<ValetudoMapLayer, number[]>()

export function mapCameraEntityId(vacuumMapId: string) {
  return `camera.${vacuumMapId}_map_data`
}

function mockCompressedRows(minX: number, maxX: number, minY: number, maxY: number, step = 1) {
  const rows: number[] = []
  for (let y = minY; y <= maxY; y += step) rows.push(minX, y, maxX - minX + 1)
  return rows
}

function mockOutlineRows(minX: number, maxX: number, minY: number, maxY: number) {
  const rows = [
    ...mockCompressedRows(minX, maxX, minY, minY),
    ...mockCompressedRows(minX, maxX, maxY, maxY),
  ]
  for (let y = minY + 1; y < maxY; y += 1) {
    rows.push(minX, y, 1, maxX, y, 1)
  }
  return rows
}

function createMockMusicRoomMap(): ValetudoMap {
  const segmentDefinitions = [
    { id: '3', name: 'Music Room', minX: 638, maxX: 781, minY: 556, maxY: 667 },
    { id: '10', name: 'Downstairs Hallway', minX: 710, maxX: 729, minY: 668, maxY: 713 },
    { id: '12', name: 'Downstairs Bathroom', minX: 638, maxX: 709, minY: 668, maxY: 721 },
    { id: '4', minX: 505, maxX: 630, minY: 545, maxY: 684 },
  ]

  return {
    __class: 'ValetudoMap',
    entities: [
      { type: 'charger_location', points: [3230, 3275] },
      { type: 'robot_position', points: [3230, 3275], metaData: { angle: 90 } },
    ],
    layers: [
      {
        type: 'wall',
        dimensions: {
          x: { min: 504, max: 782 },
          y: { min: 544, max: 722 },
        },
        compressedPixels: [
          ...mockOutlineRows(637, 782, 555, 722),
          ...mockOutlineRows(504, 631, 544, 685),
        ],
      },
      ...segmentDefinitions.map((segment) => ({
        type: 'segment',
        dimensions: {
          x: { min: segment.minX, max: segment.maxX },
          y: { min: segment.minY, max: segment.maxY },
        },
        compressedPixels: mockCompressedRows(segment.minX, segment.maxX, segment.minY, segment.maxY),
        metaData: {
          name: segment.name,
          segmentId: segment.id,
        },
      })),
    ],
    metaData: { nonce: 'mock-music-room-focus', version: 2 },
    pixelSize: 5,
    size: { x: 6554, y: 6554 },
  }
}

function createMockMainFloorMap(): ValetudoMap {
  const bounds = MOCK_MAP_BOUNDS.valetudo_exaltedsneakydeer
  const roomNames = [
    ['Dining Room', '1'],
    ['Living Room', '3'],
    ['Kitchen', '4'],
    ['Guest Bathroom', '5'],
    ['Gym', '7'],
    ['Master Bathroom', '8'],
    ['Master Bedroom Closet', '9'],
    ['Guest Room', '11'],
    ['Hallway', '12'],
    ['Master Bedroom', '13'],
    ['Office', '14'],
  ] as const
  const inset = 5
  const columns = 4
  const rows = 3
  const roomWidth = Math.floor((bounds.maxX - bounds.minX - inset * 2) / columns)
  const roomHeight = Math.floor((bounds.maxY - bounds.minY - inset * 2) / rows)
  const rooms = roomNames.map(([name, id], index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const minX = bounds.minX + inset + column * roomWidth
    const minY = bounds.minY + inset + row * roomHeight
    return {
      id,
      name,
      minX,
      minY,
      maxX: column === columns - 1 ? bounds.maxX - inset : minX + roomWidth - 1,
      maxY: row === rows - 1 ? bounds.maxY - inset : minY + roomHeight - 1,
    }
  })

  return {
    __class: 'ValetudoMap',
    entities: [
      { type: 'charger_location', points: [(bounds.minX + inset + 4) * 5, (bounds.minY + inset + 4) * 5] },
      { type: 'robot_position', points: [Math.round((bounds.minX + bounds.maxX) * 2.5), Math.round((bounds.minY + bounds.maxY) * 2.5)], metaData: { angle: 90 } },
    ],
    layers: [
      ...rooms.map((room) => ({
        type: 'segment',
        dimensions: { x: { min: room.minX, max: room.maxX }, y: { min: room.minY, max: room.maxY } },
        compressedPixels: mockCompressedRows(room.minX, room.maxX, room.minY, room.maxY),
        metaData: { name: room.name, segmentId: room.id },
      })),
      {
        type: 'wall',
        dimensions: { x: { min: bounds.minX, max: bounds.maxX }, y: { min: bounds.minY, max: bounds.maxY } },
        compressedPixels: mockOutlineRows(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY),
      },
      {
        type: 'floor',
        dimensions: { x: { min: bounds.minX, max: bounds.maxX }, y: { min: 0, max: 6554 } },
        pixels: [],
      },
    ],
    metaData: { nonce: 'mock-main-floor-rooms', version: 2 },
    pixelSize: 5,
    size: { x: 6554, y: 6554 },
  }
}

export function createMockValetudoMap(vacuumMapId: string): ValetudoMap {
  if (vacuumMapId === 'valetudo_elatedusedram') return createMockMusicRoomMap()
  if (vacuumMapId === 'valetudo_exaltedsneakydeer') return createMockMainFloorMap()

  const bounds = MOCK_MAP_BOUNDS[vacuumMapId] ?? MOCK_MAP_BOUNDS.valetudo_exaltedsneakydeer
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const splitX = Math.round(bounds.minX + width * 0.54)
  const splitY = Math.round(bounds.minY + height * 0.48)
  const inset = Math.max(3, Math.round(Math.min(width, height) * 0.04))
  const segmentBounds = [
    { minX: bounds.minX + inset, maxX: splitX - 1, minY: bounds.minY + inset, maxY: splitY - 1 },
    { minX: splitX, maxX: bounds.maxX - inset, minY: bounds.minY + inset, maxY: splitY - 1 },
    { minX: bounds.minX + inset, maxX: bounds.maxX - inset, minY: splitY, maxY: bounds.maxY - inset },
  ]

  return {
    __class: 'ValetudoMap',
    entities: [
      {
        type: 'charger_location',
        points: [(bounds.minX + inset + 4) * 5, (bounds.minY + inset + 4) * 5],
      },
      {
        type: 'robot_position',
        points: [Math.round((bounds.minX + bounds.maxX) * 2.5), Math.round((bounds.minY + bounds.maxY) * 2.5)],
        metaData: { angle: 90 },
      },
    ],
    layers: [
      ...segmentBounds.map((segment) => ({
        type: 'segment',
        dimensions: {
          x: { min: segment.minX, max: segment.maxX },
          y: { min: segment.minY, max: segment.maxY },
        },
        compressedPixels: mockCompressedRows(segment.minX, segment.maxX, segment.minY, segment.maxY),
      })),
      {
        type: 'wall',
        dimensions: {
          x: { min: bounds.minX, max: bounds.maxX },
          y: { min: bounds.minY, max: bounds.maxY },
        },
        compressedPixels: [
          ...mockCompressedRows(bounds.minX, bounds.maxX, bounds.minY, bounds.minY),
          ...mockCompressedRows(bounds.minX, bounds.maxX, bounds.maxY, bounds.maxY),
          ...mockCompressedRows(bounds.minX, bounds.minX, bounds.minY, bounds.maxY),
          ...mockCompressedRows(bounds.maxX, bounds.maxX, bounds.minY, bounds.maxY),
        ],
      },
    ],
    metaData: { version: 2 },
    pixelSize: 5,
    size: { x: 6554, y: 6554 },
  }
}

export function selectValetudoMapEntity(
  cameraEntityId: string,
  storeEntity: ValetudoEntityLike | null,
  liveEntity: ValetudoEntityLike | null,
  liveEntityMissing = false,
) {
  if (liveEntityMissing) return null
  if (liveEntity?.entity_id !== cameraEntityId) return storeEntity
  if (!storeEntity) return liveEntity
  const storeUpdated = Date.parse(storeEntity.last_updated ?? storeEntity.last_changed ?? '')
  const liveUpdated = Date.parse(liveEntity.last_updated ?? liveEntity.last_changed ?? '')
  if (Number.isFinite(storeUpdated) && Number.isFinite(liveUpdated)) {
    return liveUpdated >= storeUpdated ? liveEntity : storeEntity
  }
  return liveEntity
}

function readPngChunkLength(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  let value = ''
  for (let index = start; index < end; index += 1) value += String.fromCharCode(bytes[index] ?? 0)
  return value
}

function assertPngSignature(bytes: Uint8Array) {
  const expected = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < expected.length || expected.some((byte, index) => bytes[index] !== byte)) {
    throw new Error('Invalid PNG map image')
  }
}

async function inflateZlibText(data: Uint8Array) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot decode compressed Valetudo map data')
  }

  const copy = new Uint8Array(data.length)
  copy.set(data)
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate'))
  const buffer = await new Response(stream).arrayBuffer()
  return new TextDecoder().decode(buffer)
}

export function expandValetudoLayerPixels(layer: ValetudoMapLayer) {
  if (layer.pixels?.length) return layer.pixels
  const cached = EXPANDED_PIXEL_CACHE.get(layer)
  if (cached) return cached
  const compressed = layer.compressedPixels ?? []
  const pixels: number[] = []

  for (let index = 0; index + 2 < compressed.length; index += 3) {
    const startX = compressed[index] ?? 0
    const y = compressed[index + 1] ?? 0
    const count = compressed[index + 2] ?? 0
    for (let offset = 0; offset < count; offset += 1) {
      pixels.push(startX + offset, y)
    }
  }

  EXPANDED_PIXEL_CACHE.set(layer, pixels)
  return pixels
}

export interface ValetudoMapRoomTarget {
  entityId: string
  mapName: string
  title: string
}

export interface ValetudoSelectableRoom extends ValetudoMapRoomTarget {
  centroid: { x: number; y: number }
  pixelKeys: ReadonlySet<string>
  segmentId: string | null
}

function normalizedRoomName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function pixelKey(x: number, y: number) {
  return `${x}:${y}`
}

export function selectableValetudoRooms(map: ValetudoMap, targets: ValetudoMapRoomTarget[]): ValetudoSelectableRoom[] {
  const targetsByName = new Map(targets.map((target) => [normalizedRoomName(target.mapName), target]))

  return map.layers.flatMap((layer) => {
    if (layer.type !== 'segment' || typeof layer.metaData?.name !== 'string') return []
    const target = targetsByName.get(normalizedRoomName(layer.metaData.name))
    if (!target) return []
    const pixels = expandValetudoLayerPixels(layer)
    if (pixels.length < 2) return []

    let sumX = 0
    let sumY = 0
    const pixelKeys = new Set<string>()
    for (let index = 0; index + 1 < pixels.length; index += 2) {
      const x = pixels[index] ?? 0
      const y = pixels[index + 1] ?? 0
      sumX += x
      sumY += y
      pixelKeys.add(pixelKey(x, y))
    }
    const count = pixels.length / 2
    const meanX = sumX / count
    const meanY = sumY / count
    let centroid = { x: pixels[0] ?? 0, y: pixels[1] ?? 0 }
    let centroidDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index + 1 < pixels.length; index += 2) {
      const x = pixels[index] ?? 0
      const y = pixels[index + 1] ?? 0
      const distance = (x - meanX) ** 2 + (y - meanY) ** 2
      if (distance >= centroidDistance) continue
      centroid = { x, y }
      centroidDistance = distance
    }

    const segmentId = typeof layer.metaData.segmentId === 'string' || typeof layer.metaData.segmentId === 'number'
      ? String(layer.metaData.segmentId)
      : null
    return [{ ...target, centroid, pixelKeys, segmentId }]
  })
}

export function valetudoRoomAtGridPoint(rooms: ValetudoSelectableRoom[], point: { x: number; y: number }) {
  const candidates = [
    [Math.floor(point.x), Math.floor(point.y)],
    [Math.round(point.x), Math.round(point.y)],
  ] as const
  return rooms.find((room) => candidates.some(([x, y]) => room.pixelKeys.has(pixelKey(x, y)))) ?? null
}

function layerHasPixelRepresentation(layer: ValetudoMapLayer) {
  return Object.prototype.hasOwnProperty.call(layer, 'pixels')
    || Object.prototype.hasOwnProperty.call(layer, 'compressedPixels')
}

function finitePixelBounds(pixels: number[]): ValetudoMapBounds | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }
  let found = false

  for (let index = 0; index + 1 < pixels.length; index += 2) {
    const x = pixels[index]
    const y = pixels[index + 1]
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
    found = true
  }

  return found ? bounds : null
}

function validDimensionBounds(dimensions: ValetudoMapLayer['dimensions']): ValetudoMapBounds | null {
  if (!dimensions) return null
  const bounds = {
    minX: dimensions.x.min,
    minY: dimensions.y.min,
    maxX: dimensions.x.max,
    maxY: dimensions.y.max,
  }
  if (!Object.values(bounds).every((value) => Number.isFinite(value))) return null
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) return null
  return bounds
}

export function valetudoMapBounds(map: ValetudoMap): ValetudoMapBounds {
  const layerBounds = map.layers.flatMap((layer) => {
    const bounds = layerHasPixelRepresentation(layer)
      ? finitePixelBounds(expandValetudoLayerPixels(layer))
      : validDimensionBounds(layer.dimensions)
    return bounds ? [bounds] : []
  })

  if (layerBounds.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(1, Math.ceil(map.size.x / map.pixelSize)),
      maxY: Math.max(1, Math.ceil(map.size.y / map.pixelSize)),
    }
  }

  return layerBounds.reduce(
    (bounds, layer) => ({
      minX: Math.min(bounds.minX, layer.minX),
      minY: Math.min(bounds.minY, layer.minY),
      maxX: Math.max(bounds.maxX, layer.maxX),
      maxY: Math.max(bounds.maxY, layer.maxY),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )
}

export async function extractValetudoMapFromPngBytes(bytes: Uint8Array, inflateText = inflateZlibText): Promise<ValetudoMap> {
  assertPngSignature(bytes)

  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readPngChunkLength(bytes, offset)
    offset += 4
    const type = readAscii(bytes, offset, offset + 4)
    offset += 4
    const data = bytes.slice(offset, offset + length)
    offset += length + 4

    if (type === 'IEND') break
    if (type !== 'zTXt') continue

    const separator = data.indexOf(0)
    if (separator < 0) continue
    const keyword = readAscii(data, 0, separator)
    const compressionMethod = data[separator + 1]
    if (keyword !== 'ValetudoMap' || compressionMethod !== 0) continue

    const json = await inflateText(data.slice(separator + 2))
    const map = JSON.parse(json) as ValetudoMap
    if (map.__class !== 'ValetudoMap') throw new Error('Valetudo map metadata is invalid')
    return map
  }

  throw new Error('No Valetudo map data found in camera image')
}