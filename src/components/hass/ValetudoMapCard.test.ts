import { mapCameraEntityId, selectValetudoMapEntity } from './ValetudoMapCard.utils'
import { materialIconPath } from '../core/iconPaths'

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
})