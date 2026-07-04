import { deflateSync, inflateSync } from 'node:zlib'
import { expandValetudoLayerPixels, extractValetudoMapFromPngBytes, mapCameraEntityId, selectValetudoMapEntity, valetudoMapBounds } from './ValetudoMapCard.utils'
import { materialIconPath } from '../core/iconPaths'

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

  it('resolves Valetudo marker icons used by the ha-icon fallback', () => {
    expect(materialIconPath('mdi:robot-vacuum')).not.toBe(materialIconPath('mdi:home'))
    expect(materialIconPath('mdi:flash')).not.toBe(materialIconPath('mdi:home'))
    expect(materialIconPath('mdi:pin')).not.toBe(materialIconPath('mdi:home'))
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
        },
      ],
      entities: [{ type: 'robot_position', points: [10, 10], metaData: { angle: 90 } }],
    }

    const parsed = await extractValetudoMapFromPngBytes(valetudoPng(sourceMap), async (data) => inflateSync(data).toString('utf8'))

    expect(parsed.__class).toBe('ValetudoMap')
    expect(parsed.entities[0]?.type).toBe('robot_position')
    expect(expandValetudoLayerPixels(parsed.layers[0]!)).toEqual([1, 2, 2, 2, 3, 2])
    expect(valetudoMapBounds(parsed)).toEqual({ minX: 1, maxX: 3, minY: 2, maxY: 2 })
  })
})