import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import type { EntityAction, EntityTileConfig } from '../../constants/portedDashboard'
import { asEntityName, formatCompactEntityState, isActiveState } from './entityState'

interface EntityActionCardProps {
  item: EntityTileConfig
  onNavigate: (path: string) => void
}

function domainOf(entityId: string) {
  return entityId.split('.', 1)[0]
}

function defaultIcon(entityId: string) {
  const domain = domainOf(entityId)
  if (domain === 'alarm_control_panel') return 'mdi:shield'
  if (domain === 'binary_sensor') return 'mdi:checkbox-marked-circle'
  if (domain === 'climate') return 'mdi:thermostat'
  if (domain === 'cover') return 'mdi:garage'
  if (domain === 'fan') return 'mdi:fan'
  if (domain === 'humidifier') return 'mdi:air-humidifier'
  if (domain === 'input_boolean') return 'mdi:toggle-switch'
  if (domain === 'light') return 'mdi:lightbulb'
  if (domain === 'lock') return 'mdi:lock'
  if (domain === 'media_player') return 'mdi:remote'
  if (domain === 'number') return 'mdi:numeric'
  if (domain === 'select') return 'mdi:form-dropdown'
  if (domain === 'switch') return 'mdi:toggle-switch'
  if (domain === 'vacuum') return 'mdi:robot-vacuum'
  return 'mdi:home-assistant'
}

function useActionRunner(onNavigate: (path: string) => void) {
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void

  return (entityId: string, action: EntityAction | undefined) => {
    if (!action) return
    if (action.type === 'navigate') {
      onNavigate(action.path)
      return
    }
    if (action.type === 'toggle') {
      callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
      return
    }
    callService({ domain: action.domain, service: action.service, target: action.target ?? entityId, serviceData: action.serviceData })
  }
}

export function EntityActionCard({ item, onNavigate }: EntityActionCardProps) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const runAction = useActionRunner(onNavigate)
  const entityUnavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const subtitle = item.manualReview ? `${formatCompactEntityState(entity, 'Review')} - review` : item.showSubtitle ? formatCompactEntityState(entity, 'Unavailable') : undefined
  const active = isActiveState(entity)
  const disabled = Boolean(item.disabledWhenUnavailable && entityUnavailable)
  const clickable = Boolean(item.action) && !disabled

  return (
    <Card
      ariaLabel={subtitle ? `${item.title} ${subtitle}` : item.title}
      color={item.color}
      disabled={disabled}
      icon={<MaterialIcon name={item.icon ?? defaultIcon(item.entityId)} size={38} />}
      muted={disabled || (!active && item.action?.type !== 'navigate')}
      onClick={clickable ? () => runAction(item.entityId, item.action) : undefined}
      pressed={clickable && item.action?.type !== 'navigate' ? active : undefined}
      size="compact"
      subtitle={subtitle}
      title={item.title}
    />
  )
}