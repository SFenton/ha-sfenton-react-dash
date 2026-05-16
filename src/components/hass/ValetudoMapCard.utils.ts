export interface ValetudoEntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  last_changed?: string
  last_updated?: string
  state: string
}

export function mapCameraEntityId(vacuumMapId: string) {
  return `camera.${vacuumMapId}_map_data`
}

export function selectValetudoMapEntity(cameraEntityId: string, storeEntity: ValetudoEntityLike | null, liveEntity: ValetudoEntityLike | null) {
  return liveEntity?.entity_id === cameraEntityId ? liveEntity : storeEntity
}