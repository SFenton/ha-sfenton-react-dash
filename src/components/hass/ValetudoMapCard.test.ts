import { deflateSync, inflateSync } from 'node:zlib'
import {
  createMockValetudoMap,
  expandValetudoLayerPixels,
  extractValetudoMapFromPngBytes,
  isReportedMapEntityVisible,
  mapCameraEntityId,
  selectableValetudoRooms,
  selectValetudoMapEntity,
  valetudoMapBounds,
  valetudoRoomAtGridPoint,
  valetudoMapEntityRenderStyle,
  valetudoMapMaterialAccent,
} from './ValetudoMapCard.utils'
import { materialIconPath } from '../core/iconPaths'

function mapWithLayers(layers: ReturnType<typeof createMockValetudoMap>['layers']) {
  return {
    __class: 'ValetudoMap' as const,
    entities: [],
    layers,
    pixelSize: 5,
    size: { x: 20, y: 30 },
  }
}

function chunk(type: string, data = Buffer.alloc(0)) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
}

function valetudoPng(map: unknown) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
  const compressed = deflateSync(Buffer.from(JSON.stringify(map), 'utf8'))
  const ztxt = Buffer.concat([Buffer.from('ValetudoMap', 'latin1'), Buffer.from([0, 0]), compressed])
  return new Uint8Array(Buffer.concat([signature, chunk('IHDR', ihdr), chunk('zTXt', ztxt), chunk('IEND')]))
}

describe('ValetudoMapCard helpers', () => {
  it('builds the Valetudo map camera entity id', () => {
    expect(mapCameraEntityId('valetudo_elatedusedram')).toBe('camera.valetudo_elatedusedram_map_data')
  })

  it('prefers the live fetched map camera entity over the static HASS store snapshot', () => {
    const cameraEntityId = 'camera.valetudo_elatedusedram_map_data'
    const storeEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data?stale' },
      entity_id: cameraEntityId,
      last_updated: '2026-05-16T12:00:00.000Z',
      state: 'idle',
    }
    const liveEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data?live' },
      entity_id: cameraEntityId,
      last_updated: '2026-05-16T12:00:03.000Z',
      state: 'idle',
    }

    expect(selectValetudoMapEntity(cameraEntityId, storeEntity, liveEntity)).toBe(liveEntity)
  })

  it('ignores live camera updates for a different vacuum map', () => {
    const cameraEntityId = 'camera.valetudo_elatedusedram_map_data'
    const storeEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data' },
      entity_id: cameraEntityId,
      state: 'idle',
    }
    const otherLiveEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_exaltedsneakydeer_map_data' },
      entity_id: 'camera.valetudo_exaltedsneakydeer_map_data',
      state: 'idle',
    }

    expect(selectValetudoMapEntity(cameraEntityId, storeEntity, otherLiveEntity)).toBe(storeEntity)
  })

  it('uses the newest same-camera state so recovery can replace a stale fetched snapshot', () => {
    const cameraEntityId = 'camera.valetudo_elatedusedram_map_data'
    const storeEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data?recovered' },
      entity_id: cameraEntityId,
      last_updated: '2026-08-27T12:00:05.000Z',
      state: 'idle',
    }
    const staleFetchedEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data?unavailable' },
      entity_id: cameraEntityId,
      last_updated: '2026-08-27T12:00:00.000Z',
      state: 'unavailable',
    }

    expect(selectValetudoMapEntity(cameraEntityId, storeEntity, staleFetchedEntity)).toBe(storeEntity)
  })

  it('lets a live removal tombstone override a cached HASS store entity', () => {
    const cameraEntityId = 'camera.valetudo_elatedusedram_map_data'
    const cachedStoreEntity = {
      attributes: { entity_picture: '/api/camera_proxy/camera.valetudo_elatedusedram_map_data?cached' },
      entity_id: cameraEntityId,
      last_updated: '2026-08-27T12:00:00.000Z',
      state: 'idle',
    }

    expect(selectValetudoMapEntity(cameraEntityId, cachedStoreEntity, null, true)).toBeNull()
  })

  it('resolves Valetudo marker icons used by the ha-icon fallback', () => {
    expect(materialIconPath('mdi:robot-vacuum')).not.toBe(materialIconPath('mdi:home'))
    expect(materialIconPath('mdi:flash')).not.toBe(materialIconPath('mdi:home'))
    expect(materialIconPath('mdi:pin')).not.toBe(materialIconPath('mdi:home'))
    expect(materialIconPath('mdi:alert-outline')).not.toBe(materialIconPath('mdi:home'))
  })

  it.each([
    ['robot_position', true],
    ['carpet', true],
    ['no_go_area', true],
    ['path', false],
    ['predicted_path', false],
    ['go_to_target', false],
    ['active_zone', false],
    ['obstacle', false],
    ['charger_location', false],
  ])('sets reported-map visibility for %s to %s', (type, visible) => {
    expect(isReportedMapEntityVisible(type)).toBe(visible)
  })

  it.each([
    ['virtual_wall', 'line'],
    ['threshold', 'line'],
    ['curtain', 'line'],
    ['active_zone', 'polygon'],
    ['no_go_area', 'polygon'],
    ['no_mop_area', 'polygon'],
    ['carpet', 'polygon'],
    ['ramp', 'polygon'],
    ['go_to_target', 'point'],
    ['obstacle', 'point'],
  ] as const)('maps %s entities to %s rendering', (type, shape) => {
    expect(valetudoMapEntityRenderStyle(type)).toMatchObject({ shape })
  })

  it('ignores map entity types without a supported visual', () => {
    expect(valetudoMapEntityRenderStyle('vendor_specific_unknown')).toBeNull()
  })

  it.each([
    ['tile', 6, 5, 'dark'],
    ['wood', 4, 4, 'dark'],
    ['wood_horizontal', 7, 5, 'dark'],
    ['wood_vertical', 5, 7, 'dark'],
    ['carpet', 4, 2, 'light'],
    ['carpet_low', 4, 4, 'light'],
    ['carpet_high', 2, 2, 'light'],
    ['generic', 4, 4, null],
  ] as const)('maps %s material coordinates to %s accents', (material, x, y, accent) => {
    expect(valetudoMapMaterialAccent(material, x, y)).toBe(accent)
  })

  it('matches configured rooms by normalized map name and keeps marker centroids inside the room', () => {
    const map = createMockValetudoMap('valetudo_exaltedsneakydeer')
    const rooms = selectableValetudoRooms(map, [
      { entityId: 'input_boolean.kitchen', mapName: '  KITCHEN  ' },
      { entityId: 'input_boolean.closet', mapName: 'Master Bedroom Closet' },
    ])

    expect(rooms.map((room) => room.entityId)).toEqual(['input_boolean.kitchen', 'input_boolean.closet'])
    for (const room of rooms) {
      expect(room.pixelKeys.has(`${room.centroid.x}:${room.centroid.y}`)).toBe(true)
      expect(valetudoRoomAtGridPoint(rooms, room.centroid)?.entityId).toBe(room.entityId)
    }
  })

  it('uses exact room pixels for hit testing', () => {
    const map = createMockValetudoMap('valetudo_elatedusedram')
    const rooms = selectableValetudoRooms(map, [
      { entityId: 'input_boolean.music_room', mapName: 'Music Room' },
    ])

    expect(valetudoRoomAtGridPoint(rooms, { x: 700.4, y: 600.4 })?.entityId).toBe('input_boolean.music_room')
    expect(valetudoRoomAtGridPoint(rooms, { x: 500, y: 500 })).toBeNull()
  })

  it('derives bounds from rendered pixels instead of empty layer dimensions', () => {
    const map = mapWithLayers([
      {
        type: 'segment',
        dimensions: { x: { min: 558, max: 728 }, y: { min: 639, max: 1027 } },
        compressedPixels: [558, 639, 171, 558, 1027, 171],
      },
      {
        type: 'floor',
        dimensions: { x: { min: 558, max: 728 }, y: { min: 0, max: 6554 } },
        pixels: [],
      },
    ])

    expect(valetudoMapBounds(map)).toEqual({ minX: 558, maxX: 728, minY: 639, maxY: 1027 })
  })

  it('uses the same pixel precedence for bounds and rendering', () => {
    expect(valetudoMapBounds(mapWithLayers([{
      type: 'segment',
      dimensions: { x: { min: 0, max: 999 }, y: { min: 0, max: 999 } },
      pixels: [4, 5, 6, 7],
      compressedPixels: [100, 200, 3],
    }]))).toEqual({ minX: 4, maxX: 6, minY: 5, maxY: 7 })

    expect(valetudoMapBounds(mapWithLayers([{
      type: 'segment',
      dimensions: { x: { min: 0, max: 999 }, y: { min: 0, max: 999 } },
      pixels: [],
      compressedPixels: [8, 9, 2],
    }]))).toEqual({ minX: 8, maxX: 9, minY: 9, maxY: 9 })
  })

  it('derives equivalent bounds from compressed and uncompressed pixels', () => {
    const pixels = mapWithLayers([{
      type: 'segment',
      pixels: [10, 20, 11, 20, 12, 20],
    }])
    const compressedPixels = mapWithLayers([{
      type: 'segment',
      compressedPixels: [10, 20, 3],
    }])

    expect(valetudoMapBounds(pixels)).toEqual(valetudoMapBounds(compressedPixels))
  })

  it('does not fall back to dimensions for malformed explicit pixels', () => {
    const map = mapWithLayers([{
      type: 'segment',
      dimensions: { x: { min: 100, max: 200 }, y: { min: 300, max: 400 } },
      pixels: [Number.NaN, Number.POSITIVE_INFINITY, 5],
    }])

    expect(valetudoMapBounds(map)).toEqual({ minX: 0, maxX: 4, minY: 0, maxY: 6 })
  })

  it('uses only valid dimensions when pixel representations are absent', () => {
    const valid = mapWithLayers([{
      type: 'metadata',
      dimensions: { x: { min: 2, max: 6 }, y: { min: 3, max: 7 } },
    }])
    const invalid = mapWithLayers([
      {
        type: 'metadata',
        dimensions: { x: { min: 6, max: 2 }, y: { min: 3, max: 7 } },
      },
      {
        type: 'metadata',
        dimensions: { x: { min: 2, max: Number.NaN }, y: { min: 3, max: 7 } },
      },
    ])

    expect(valetudoMapBounds(valid)).toEqual({ minX: 2, maxX: 6, minY: 3, maxY: 7 })
    expect(valetudoMapBounds(invalid)).toEqual({ minX: 0, maxX: 4, minY: 0, maxY: 6 })
  })

  it('keeps the Main Floor mock bounds stable with an empty extreme layer', () => {
    expect(valetudoMapBounds(createMockValetudoMap('valetudo_exaltedsneakydeer'))).toEqual({
      minX: 558,
      maxX: 728,
      minY: 639,
      maxY: 1027,
    })
  })

  it('extracts ValetudoMap JSON from a zTXt PNG chunk', async () => {
    const sourceMap = {
      __class: 'ValetudoMap',
      metaData: { version: 2 },
      size: { x: 20, y: 20 },
      pixelSize: 5,
      layers: [
        {
          type: 'segment',
          dimensions: { x: { min: 1, max: 3 }, y: { min: 2, max: 2 } },
          compressedPixels: [1, 2, 3],
          metaData: { material: 'carpet_high', name: 'Music Room', segmentId: '3' },
        },
      ],
      entities: [{ type: 'robot_position', points: [10, 10], metaData: { angle: 90 } }],
    }

    const parsed = await extractValetudoMapFromPngBytes(valetudoPng(sourceMap), async (data) => inflateSync(data).toString('utf8'))

    expect(parsed.__class).toBe('ValetudoMap')
    expect(parsed.entities[0]?.type).toBe('robot_position')
    expect(parsed.layers[0]?.metaData).toEqual({ material: 'carpet_high', name: 'Music Room', segmentId: '3' })
    expect(expandValetudoLayerPixels(parsed.layers[0]!)).toEqual([1, 2, 2, 2, 3, 2])
    expect(valetudoMapBounds(parsed)).toEqual({ minX: 1, maxX: 3, minY: 2, maxY: 2 })
  })
})