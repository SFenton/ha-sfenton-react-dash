import { useEntity } from '@hakit/core'
import type { ReactNode } from 'react'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatCompactEntityState } from '../hass/entityState'
import { colorFromRgba, colorFromTemperature } from './climateColor'

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
