import { useEntity, useHass } from '@hakit/core'
import type { EntityTileConfig } from '../../constants/portedDashboard'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatCompactEntityState } from './entityState'

interface SpecialDeviceModeCardProps {
  item: EntityTileConfig
  preload?: boolean
}

function accessibleName(title: string, subtitle: string) {
  return `${title} ${subtitle}`
}

function SpecialDeviceModeCardPreview({ item }: Pick<SpecialDeviceModeCardProps, 'item'>) {
  return (
    <Card
      ariaLabel={item.title}
      color={item.color}
      disabled
      icon={<MaterialIcon name={item.icon ?? 'mdi:tune-vertical'} size={38} />}
      muted
      size="wide"
      title={item.title}
    />
  )
}

function LiveSpecialDeviceModeCard({ item }: Pick<SpecialDeviceModeCardProps, 'item'>) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation' })
  const unavailable = !entity || displayState === 'unavailable' || displayState === 'unknown'
  const checked = displayState === 'on'
  const subtitle = formatCompactEntityState(entity, undefined, displayState)

  const toggle = () => {
    if (unavailable) return
    const nextState = checked ? 'off' : 'on'
    commitDisplayState(nextState)
    callService({
      domain: 'input_boolean',
      service: nextState === 'on' ? 'turn_on' : 'turn_off',
      target: item.entityId,
    })
  }

  return (
    <Card
      ariaLabel={accessibleName(item.title, subtitle)}
      color={item.color}
      disabled={unavailable}
      icon={<MaterialIcon name={item.icon ?? 'mdi:tune-vertical'} size={38} />}
      muted={unavailable || !checked}
      onClick={toggle}
      semantics={{ kind: 'toggle', checked }}
      size="wide"
      subtitle={subtitle}
      title={item.title}
    />
  )
}

export function SpecialDeviceModeCard({ item, preload = false }: SpecialDeviceModeCardProps) {
  return preload ? <SpecialDeviceModeCardPreview item={item} /> : <LiveSpecialDeviceModeCard item={item} />
}
