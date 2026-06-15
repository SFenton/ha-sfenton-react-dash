import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import type { EntityAction, EntityTileConfig } from '../../constants/portedDashboard'
import { resolveEntityAction, type EntityActionStateMap } from './entityActions'
import { asEntityName, formatCompactEntityState, isActiveState } from './entityState'

interface EntityActionCardProps {
  item: EntityTileConfig
  onNavigate: (path: string) => void
  size?: 'standard' | 'compact' | 'wide' | 'admin-modal'
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
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap

  return (entityId: string, action: EntityAction | undefined) => {
    const resolvedAction = resolveEntityAction(entityId, action, entities)
    if (!resolvedAction) return
    if (resolvedAction.type === 'navigate') {
      onNavigate(resolvedAction.path)
      return
    }
    if (resolvedAction.type === 'toggle') {
      callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
      return
    }
    const target = resolvedAction.target === null ? undefined : resolvedAction.target ?? entityId
    const params: Record<string, unknown> = { domain: resolvedAction.domain, service: resolvedAction.service, serviceData: resolvedAction.serviceData }
    if (target !== undefined) params.target = target
    callService(params)
  }
}

function formatStateLabel(item: EntityTileConfig, entity: ReturnType<typeof useEntity>) {
  if (!item.stateLabel || !entity) return undefined
  const value = entity.attributes[item.stateLabel.attribute]
  if (value === undefined || value === null) return undefined
  const label = value === true || value === 'true' || value === 'on' ? item.stateLabel.trueLabel : item.stateLabel.falseLabel
  return item.stateLabel.includeState ? `${formatCompactEntityState(entity, 'Unavailable')} · ${label}` : label
}

export function EntityActionCard({ item, onNavigate, size = 'compact' }: EntityActionCardProps) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const runAction = useActionRunner(onNavigate)
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const resolvedAction = resolveEntityAction(item.entityId, item.action, entities)
  const entityUnavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const stateLabel = formatStateLabel(item, entity)
  const subtitle = stateLabel ?? (item.showSubtitle ? formatCompactEntityState(entity, 'Unavailable') : undefined)
  const active = isActiveState(entity)
  const disabled = Boolean(item.disabledWhenUnavailable && entityUnavailable)
  const clickable = Boolean(item.action) && !disabled

  return (
    <Card
      ariaLabel={subtitle ? `${item.title} ${subtitle}` : item.title}
      color={item.color}
      disabled={disabled}
      icon={<MaterialIcon name={item.icon ?? defaultIcon(item.entityId)} size={38} />}
      muted={disabled || (!active && resolvedAction?.type !== 'navigate')}
      onClick={clickable ? () => runAction(item.entityId, item.action) : undefined}
      pressed={clickable && resolvedAction?.type !== 'navigate' ? active : undefined}
      size={size}
      subtitle={subtitle}
      title={item.title}
    />
  )
}