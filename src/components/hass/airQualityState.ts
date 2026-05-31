import type { HassEntity } from 'home-assistant-js-websocket'
import { formatCompactEntityState } from './entityState'

export function derivedAirPurifierEntityIds(pm25EntityId: string) {
  const base = pm25EntityId.replace(/^sensor\./, '').replace(/_pm2_5$/, '')
  return {
    aqiEntityId: `sensor.${base}_air_quality_index`,
    autoModeEntityId: `select.${base}_auto_mode`,
    fanEntityId: `fan.${base}_levoit_purifier`,
    modeEntityId: `select.${base}_fan_mode`,
  }
}

export function formatAirMetricState(entity: HassEntity | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  const rawState = typeof entity.state === 'string' ? entity.state.trim() : ''
  if (!rawState || rawState === 'unknown' || rawState === 'unavailable') return formatCompactEntityState(entity, fallback)

  const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  const state = unit ? rawState : rawState.replace(/\.0$/, '')
  return unit && !state.includes(unit) ? `${state} ${unit}` : state
}

export function formatAirQualitySummary(aqiEntity: HassEntity | null | undefined, pm25Entity: HassEntity | null | undefined) {
  return `${formatAirMetricState(aqiEntity)} • ${formatAirMetricState(pm25Entity)}`
}