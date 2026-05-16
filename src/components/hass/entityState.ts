import type { EntityName } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'

export function entityName(entity: HassEntity | null, fallback: string) {
  return String(entity?.attributes.friendly_name ?? fallback)
}

export function titleCaseState(state: string | undefined) {
  if (!state || state === 'unknown') return 'Unknown'
  if (state === 'unavailable') return 'Unavailable'
  return state
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function isActiveState(entity: HassEntity | null) {
  if (!entity) return false
  if (entity.entity_id.startsWith('alarm_control_panel.')) return entity.state !== 'disarmed'
  return ['on', 'open', 'playing', 'recording', 'home', 'heat', 'cool'].includes(entity.state)
}

export function isOccupancyActive(entity: HassEntity | null | undefined) {
  return entity?.state === 'on' || entity?.state === 'active' || entity?.state === 'occupied'
}

export function isContactOpen(entity: HassEntity | null | undefined) {
  return entity?.state === 'on' || entity?.state === 'open'
}

export function formatOccupancyEntityState(entity: HassEntity | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return 'Unavailable'
  if (entity.state === 'unknown') return 'Unknown'
  if (isOccupancyActive(entity)) return 'Detected'
  if (entity.state === 'off' || entity.state === 'inactive' || entity.state === 'clear' || entity.state === 'not_occupied') return 'Clear'
  return titleCaseState(entity.state)
}

export function formatContactEntityState(entity: HassEntity | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return 'Unavailable'
  if (entity.state === 'unknown') return 'Unknown'
  if (isContactOpen(entity)) return 'Open'
  if (entity.state === 'off' || entity.state === 'closed') return 'Closed'
  return titleCaseState(entity.state)
}

export function formatCompactEntityState(entity: HassEntity | null, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return 'Unavailable'

  if (entity.entity_id.startsWith('binary_sensor.contact')) {
    return entity.state === 'on' ? 'Open' : 'Closed'
  }

  if (entity.entity_id.startsWith('binary_sensor.')) {
    return entity.state === 'on' ? 'Active' : 'Clear'
  }

  if (entity.entity_id.startsWith('light.')) {
    return entity.state === 'on' ? 'On' : 'Off'
  }

  if (entity.entity_id.startsWith('alarm_control_panel.')) {
    return titleCaseState(entity.state)
  }

  if (entity.entity_id.startsWith('sensor.') || entity.entity_id.startsWith('input_text.')) {
    return entity.state
  }

  return titleCaseState(entity.state)
}

export function formatTemperature(entity: HassEntity | null) {
  if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') return formatCompactEntityState(entity)
  const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  return `${entity.state}${unit}`
}

export function asEntityName(entityId: string) {
  return entityId as EntityName
}
