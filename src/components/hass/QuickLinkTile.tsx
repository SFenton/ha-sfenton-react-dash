import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import type { ControlSemantics } from '../core/controlSemantics'
import { allFoodSubtitle } from '../../constants/everShelfFood'
import type { QuickAccessConfig, QuickAccessModalPage } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState } from './entityState'
import { securityStateCssColor, securityStateIconName } from './securityState'

interface QuickLinkTileProps {
  item: QuickAccessConfig
  onNavigate: (path: string) => void
  onOpenDetail: (page: QuickAccessModalPage) => void
}

export function QuickLinkTile({ item, onNavigate, onOpenDetail }: QuickLinkTileProps) {
  const entity = useEntity(asEntityName(item.entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true })
  const foodSubtitle = useHass((state) => item.status === 'all_food' ? allFoodSubtitle(state.entities) : undefined)
  const subtitle = item.status === 'entity_state' ? formatCompactEntityState(entity) : foodSubtitle
  const isSecurityTile = item.tone === 'security' && item.entityId?.startsWith('alarm_control_panel.')
  const semantics: ControlSemantics = item.action.kind === 'modal' ? { kind: 'modal' } : { kind: 'navigate' }

  const handleClick = () => {
    if (item.action.kind === 'modal') {
      onOpenDetail(item.action.page)
      return
    }
    onNavigate(item.action.path)
  }

  return (
    <GlassTile
      backgroundColor={isSecurityTile ? securityStateCssColor(entity?.state, 0.5) : item.backgroundColor}
      icon={isSecurityTile ? securityStateIconName(entity?.state) : item.icon}
      iconColor={isSecurityTile ? 'white' : undefined}
      onClick={handleClick}
      semantics={semantics}
      subtitle={subtitle}
      title={item.title}
      tone={item.tone}
    />
  )
}
