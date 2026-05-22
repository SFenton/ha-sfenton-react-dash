import type { AreaConfig } from '../../constants/atAGlance'
import { Card } from '../core/Card'
import { Icon } from '../core/Icon'

interface RoomCardProps {
  area: AreaConfig
  ariaLabel?: string
  onNavigate?: (path: string) => void
  secondarySubtitle?: string
  subtitle?: string
}

export function RoomCard({ area, ariaLabel, onNavigate, secondarySubtitle, subtitle }: RoomCardProps) {
  const path = area.route.split('/').filter(Boolean).at(-1) ?? 'overview'
  return (
    <Card
      ariaLabel={ariaLabel ?? `${area.title} area`}
      color={area.color}
      icon={<Icon name={area.icon} size={42} />}
      onClick={onNavigate ? () => onNavigate(path) : undefined}
      secondarySubtitle={secondarySubtitle}
      subtitle={subtitle}
      title={area.title}
    />
  )
}