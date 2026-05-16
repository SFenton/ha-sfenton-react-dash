import type { AreaConfig } from '../../constants/atAGlance'
import { Card } from '../core/Card'
import { Icon } from '../core/Icon'

interface RoomCardProps {
  area: AreaConfig
  onNavigate?: (path: string) => void
}

export function RoomCard({ area, onNavigate }: RoomCardProps) {
  const path = area.route.split('/').filter(Boolean).at(-1) ?? 'overview'
  return <Card ariaLabel={`${area.title} area`} color={area.color} icon={<Icon name={area.icon} size={42} />} onClick={onNavigate ? () => onNavigate(path) : undefined} title={area.title} />
}