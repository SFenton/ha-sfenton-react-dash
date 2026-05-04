import type { AreaConfig } from '../../constants/atAGlance'
import { Card } from '../core/Card'
import { Icon } from '../core/Icon'

interface RoomCardProps {
  area: AreaConfig
}

export function RoomCard({ area }: RoomCardProps) {
  return <Card ariaLabel={`${area.title} area`} color={area.color} icon={<Icon name={area.icon} size={42} />} title={area.title} />
}