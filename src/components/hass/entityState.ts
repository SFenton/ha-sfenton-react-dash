import type { EntityName } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import { copy, type CopyKey } from '../../i18n'

const STATE_COPY_KEYS: Partial<Record<string, CopyKey<'common'>>> = {
  armed_away: 'states.armedAway',
  armed_home: 'states.armedHome',
  armed_night: 'states.armedNight',
  active: 'states.active',
  clear: 'states.clear',
  closed: 'states.closed',
  closing: 'states.closing',
  cool: 'states.cool',
  disarmed: 'states.disarmed',
  docked: 'states.docked',
  drying: 'states.drying',
  error: 'states.error',
  heat: 'states.heat',
  home: 'states.home',
  idle: 'states.idle',
  locked: 'states.locked',
  locking: 'states.locking',
  off: 'states.off',
  on: 'states.on',
  open: 'states.open',
  opening: 'states.opening',
  paused: 'states.paused',
  pending: 'states.pending',
  playing: 'states.playing',
  recording: 'states.recording',
  ringing: 'states.ringing',
  running: 'states.running',
  snoozed: 'states.snoozed',
  stopped: 'states.stopped',
  triggered: 'states.triggered',
  unavailable: 'states.unavailable',
  unlocked: 'states.unlocked',
  unlocking: 'states.unlocking',
  unknown: 'states.unknown',
}

export function entityName(entity: HassEntity | null, fallback: string) {
  return String(entity?.attributes.friendly_name ?? fallback)
}

export function titleCaseState(state: string | undefined) {
  if (!state) return copy('common', 'states.unknown')
  const knownKey = STATE_COPY_KEYS[state]
  if (knownKey) return copy('common', knownKey)
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

export function formatOccupancyEntityState(entity: HassEntity | null | undefined, fallback = copy('common', 'states.unavailable')) {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return copy('common', 'states.unavailable')
  if (entity.state === 'unknown') return copy('common', 'states.unknown')
  if (isOccupancyActive(entity)) return copy('common', 'states.detected')
  if (entity.state === 'off' || entity.state === 'inactive' || entity.state === 'clear' || entity.state === 'not_occupied') return copy('common', 'states.clear')
  return titleCaseState(entity.state)
}

export function formatContactEntityState(entity: HassEntity | null | undefined, fallback = copy('common', 'states.unavailable')) {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return copy('common', 'states.unavailable')
  if (entity.state === 'unknown') return copy('common', 'states.unknown')
  if (isContactOpen(entity)) return copy('common', 'states.open')
  if (entity.state === 'off' || entity.state === 'closed') return copy('common', 'states.closed')
  return titleCaseState(entity.state)
}

export function formatCompactEntityState(entity: HassEntity | null, fallback = copy('common', 'states.unavailable'), stateOverride?: string) {
  if (!entity) return fallback
  const state = stateOverride ?? entity.state
  if (state === 'unavailable') return copy('common', 'states.unavailable')

  if (entity.entity_id.startsWith('binary_sensor.contact')) {
    return state === 'on' ? copy('common', 'states.open') : copy('common', 'states.closed')
  }

  if (entity.entity_id.startsWith('binary_sensor.')) {
    return state === 'on' ? copy('common', 'states.active') : copy('common', 'states.clear')
  }

  if (entity.entity_id.startsWith('light.')) {
    return state === 'on' ? copy('common', 'states.on') : copy('common', 'states.off')
  }

  if (entity.entity_id.startsWith('alarm_control_panel.')) {
    return titleCaseState(state)
  }

  if (entity.entity_id.startsWith('sensor.') || entity.entity_id.startsWith('input_text.')) {
    return state
  }

  return titleCaseState(state)
}

export function formatTemperature(entity: HassEntity | null) {
  if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') return formatCompactEntityState(entity)
  const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  return `${entity.state}${unit}`
}

export function asEntityName(entityId: string) {
  return entityId as EntityName
}
