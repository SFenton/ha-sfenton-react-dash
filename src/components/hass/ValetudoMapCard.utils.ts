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

export interface ValetudoMapLayer {
  __class?: string
  compressedPixels?: number[]
  dimensions?: {
    x: ValetudoMapDimensionAxis
    y: ValetudoMapDimensionAxis
  }
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

export function mapCameraEntityId(vacuumMapId: string) {
  return `camera.${vacuumMapId}_map_data`
}

export function selectValetudoMapEntity(cameraEntityId: string, storeEntity: ValetudoEntityLike | null, liveEntity: ValetudoEntityLike | null) {
  return liveEntity?.entity_id === cameraEntityId ? liveEntity : storeEntity
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

  return pixels
}

export function valetudoMapBounds(map: ValetudoMap): ValetudoMapBounds {
  const axes = map.layers
    .map((layer) => layer.dimensions)
    .filter((dimensions): dimensions is NonNullable<ValetudoMapLayer['dimensions']> => Boolean(dimensions))

  if (axes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(1, Math.ceil(map.size.x / map.pixelSize)),
      maxY: Math.max(1, Math.ceil(map.size.y / map.pixelSize)),
    }
  }

  return axes.reduce(
    (bounds, dimensions) => ({
      minX: Math.min(bounds.minX, dimensions.x.min),
      minY: Math.min(bounds.minY, dimensions.y.min),
      maxX: Math.max(bounds.maxX, dimensions.x.max),
      maxY: Math.max(bounds.maxY, dimensions.y.max),
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