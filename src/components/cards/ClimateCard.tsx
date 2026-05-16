import { useEntity } from '@hakit/core'
import type { ReactNode } from 'react'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatCompactEntityState } from '../hass/entityState'

interface ClimateCardProps {
  ariaLabel?: string
  color?: CardColor
  colorEntityId?: string
  entityId?: string
  icon?: 'temperature' | 'vent' | ReactNode
  onClick?: () => void
  size?: 'standard' | 'compact'
  subtitle?: string
  title: string
}

const CLIMATE_ICON_SIZE = 38
const DEFAULT_CLIMATE_COLOR: CardColor = { r: 128, g: 128, b: 128 }
const VENT_CLOSED_COLOR: CardColor = { r: 128, g: 128, b: 128 }
const VENT_OPEN_COLOR: CardColor = { r: 30, g: 136, b: 229 }
const TEMPERATURE_GRADIENT = [
  { temp: 50, color: { r: 0, g: 110, b: 255 } },
  { temp: 60, color: { r: 128, g: 0, b: 255 } },
  { temp: 68, color: { r: 0, g: 200, b: 120 } },
  { temp: 74, color: { r: 255, g: 215, b: 0 } },
  { temp: 80, color: { r: 255, g: 165, b: 0 } },
  { temp: 85, color: { r: 255, g: 0, b: 0 } },
]

function iconSlot(icon: ClimateCardProps['icon']) {
  if (icon && icon !== 'temperature' && icon !== 'vent') return icon
  if (icon === 'vent') return <MaterialIcon name="mdi:fan" size={CLIMATE_ICON_SIZE} />
  return <MaterialIcon name="mdi:thermometer" size={CLIMATE_ICON_SIZE} />
}

function truncateToOneDecimal(value: number) {
  return Math.trunc(value * 10) / 10
}

function formatTemperatureValue(value: number, unit: string) {
  const displayValue = truncateToOneDecimal(value).toFixed(1)
  return `${displayValue}${unit}`
}

function temperatureValue(entity: ReturnType<typeof useEntity> | null) {
  if (!entity?.entity_id.startsWith('sensor.')) return null
  if (entity.state === 'unavailable' || entity.state === 'unknown') return null

  const value = Number(entity.state)
  return Number.isFinite(value) ? value : null
}

function colorFromRgba(value: string | undefined) {
  if (!value) return null

  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)/i)
  if (!match) return null

  const [, red, green, blue] = match
  return { r: Math.round(Number(red)), g: Math.round(Number(green)), b: Math.round(Number(blue)) }
}

function colorFromTemperature(value: number | null) {
  if (value === null) return null

  const firstStop = TEMPERATURE_GRADIENT[0]
  const lastStop = TEMPERATURE_GRADIENT[TEMPERATURE_GRADIENT.length - 1]
  const temperature = Math.min(Math.max(value, firstStop.temp), lastStop.temp)

  if (temperature <= firstStop.temp) return firstStop.color
  if (temperature >= lastStop.temp) return lastStop.color

  for (let index = 0; index < TEMPERATURE_GRADIENT.length - 1; index += 1) {
    const start = TEMPERATURE_GRADIENT[index]
    const end = TEMPERATURE_GRADIENT[index + 1]

    if (temperature >= start.temp && temperature <= end.temp) {
      const ratio = (temperature - start.temp) / (end.temp - start.temp)
      return {
        r: Math.round(start.color.r + (end.color.r - start.color.r) * ratio),
        g: Math.round(start.color.g + (end.color.g - start.color.g) * ratio),
        b: Math.round(start.color.b + (end.color.b - start.color.b) * ratio),
      }
    }
  }

  return DEFAULT_CLIMATE_COLOR
}

function colorFromVentState(entity: ReturnType<typeof useEntity> | null) {
  if (!entity?.entity_id.startsWith('cover.')) return null
  if (entity.state === 'open') return VENT_OPEN_COLOR
  if (entity.state === 'closed') return VENT_CLOSED_COLOR
  return null
}

function formatClimateEntityState(entity: ReturnType<typeof useEntity> | null) {
  if (!entity) return 'Unavailable'
  if (entity.entity_id.startsWith('sensor.')) {
    if (entity.state === 'unavailable' || entity.state === 'unknown') return formatCompactEntityState(entity)
    const value = temperatureValue(entity)
    if (value === null) return formatCompactEntityState(entity)
    const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
    return formatTemperatureValue(value, unit)
  }
  return formatCompactEntityState(entity)
}

export function ClimateCard({ ariaLabel, color = DEFAULT_CLIMATE_COLOR, colorEntityId, entityId, icon = 'temperature', onClick, size = 'standard', subtitle, title }: ClimateCardProps) {
  const entity = useEntity(asEntityName(entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true })
  const colorEntity = useEntity(asEntityName(colorEntityId ?? 'input_text.unavailable'), { returnNullIfNotFound: true })
  const stateText = subtitle ?? (entityId ? formatClimateEntityState(entity) : undefined)
  const cardColor = colorFromVentState(entity) ?? colorFromRgba(colorEntity?.state) ?? colorFromTemperature(temperatureValue(entity)) ?? color

  return (
    <Card
      ariaLabel={ariaLabel ?? `${title}${stateText ? ` ${stateText}` : ''}`}
      color={cardColor}
      icon={iconSlot(icon)}
      onClick={onClick}
      size={size}
      subtitle={stateText}
      title={title}
    />
  )
}
