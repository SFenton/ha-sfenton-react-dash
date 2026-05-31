import { useEntity } from '@hakit/core'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatOccupancyEntityState, isOccupancyActive } from '../hass/entityState'

interface OccupancyCardProps {
  active?: boolean
  ariaLabel?: string
  color?: CardColor
  entityId?: string
  icon?: React.ReactNode
  onClick?: () => void
  size?: 'standard' | 'compact' | 'bubble' | 'source-row'
  subtitle?: string
  title: string
}

const DEFAULT_OCCUPANCY_COLOR: CardColor = { r: 46, g: 180, b: 120 }

function OccupancyIcon({ active }: { active: boolean }) {
  return <MaterialIcon name={active ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off'} size={38} />
}

export function OccupancyCard({ active, ariaLabel, color = DEFAULT_OCCUPANCY_COLOR, entityId, icon, onClick, size = 'standard', subtitle, title }: OccupancyCardProps) {
  const entity = useEntity(asEntityName(entityId ?? 'binary_sensor.unavailable'), { returnNullIfNotFound: true })
  const isActive = active ?? isOccupancyActive(entity)
  const stateText = subtitle ?? (entityId ? formatOccupancyEntityState(entity) : undefined)

  return (
    <Card
      ariaLabel={ariaLabel ?? `${title}${stateText ? ` ${stateText}` : ''}`}
      color={color}
      icon={icon ?? <OccupancyIcon active={isActive} />}
      muted={!isActive}
      onClick={onClick}
      pressed={onClick ? isActive : undefined}
      size={size}
      subtitle={stateText}
      title={title}
    />
  )
}
