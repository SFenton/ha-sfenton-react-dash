import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import type { HassEntity } from 'home-assistant-js-websocket'
import { GlassTile, type TileTone } from '../core/GlassTile'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { derivedAirPurifierEntityIds, formatAirQualitySummary } from './airQualityState'
import { asEntityName, formatCompactEntityState, formatContactEntityState, formatOccupancyEntityState, isActiveState, isContactOpen, isOccupancyActive } from './entityState'
import { securityStateCssColor, securityStateIconName } from './securityState'
import styles from './StatusRail.module.css'

export interface StatusRailChip extends Omit<StatusChipConfig, 'hash' | 'icon' | 'tone'> {
  hash?: string
  icon: StatusChipConfig['icon'] | string
  stateKind?: 'contact' | 'presence' | 'security'
  tone: TileTone
}

interface StatusRailProps {
  chips: StatusRailChip[]
  onOpenHash: (hash: string) => void
  subtitleByHash?: Partial<Record<string, string>>
}

function colorState(entity: HassEntity | null | undefined) {
  const state = entity?.state ?? ''
  return /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(state) ? state : undefined
}

function StatusChip({ chip, onOpenHash, subtitleOverride }: { chip: StatusRailChip; onOpenHash: (hash: string) => void; subtitleOverride?: string }) {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const airEntityIds = chip.tone === 'air' ? derivedAirPurifierEntityIds(chip.entityId) : null
  const airQualityEntity = useEntity(asEntityName(airEntityIds?.aqiEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const colorEntity = useEntity(asEntityName(chip.colorEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const stateKind = chip.stateKind ?? (chip.tone === 'security' ? 'security' : chip.tone === 'presence' ? 'presence' : chip.tone === 'contact' ? 'contact' : undefined)
  let primaryState = stateKind === 'presence' ? formatOccupancyEntityState(entity) : stateKind === 'contact' ? formatContactEntityState(entity) : formatCompactEntityState(entity)
  if (stateKind === 'contact' && !isContactOpen(entity) && chip.title.endsWith('s')) primaryState = 'All Closed'
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const airQualityState = chip.tone === 'air' ? formatAirQualitySummary(airQualityEntity, entity) : null
  const subtitle = subtitleOverride ?? airQualityState ?? (secondaryState ? `${primaryState} / ${secondaryState}` : primaryState)
  const presenceActive = stateKind === 'presence' ? isOccupancyActive(entity) : false
  const isOff = stateKind === 'security' ? false : stateKind === 'presence' ? !presenceActive && !chip.secondaryEntityId : !isActiveState(entity) && !chip.secondaryEntityId
  const securityBackgroundColor = stateKind === 'security' ? securityStateCssColor(entity?.state, 0.44) : undefined
  const securityIcon = stateKind === 'security' ? securityStateIconName(entity?.state) : undefined
  const dynamicColor = chip.colorEntityId ? colorState(colorEntity) : undefined
  const icon = securityIcon ?? (stateKind === 'presence' ? (presenceActive ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off') : stateKind === 'contact' && isContactOpen(entity) ? 'mdi:door-open' : chip.icon)

  return (
    <div className={styles.chip} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        backgroundColor={securityBackgroundColor}
        compact
        icon={icon}
        iconColor={securityIcon ? 'white' : dynamicColor}
        isOff={isOff}
        onClick={chip.hash ? () => onOpenHash(chip.hash as string) : undefined}
        subtitle={subtitle}
        title={chip.title}
        tone={chip.tone}
        variant="header"
      />
    </div>
  )
}

export function StatusRail({ chips, onOpenHash, subtitleByHash }: StatusRailProps) {
  return (
    <div className={styles.rail}>
      {chips.map((chip) => (
        <StatusChip chip={chip} key={chip.title} onOpenHash={onOpenHash} subtitleOverride={chip.hash ? subtitleByHash?.[chip.hash] : undefined} />
      ))}
    </div>
  )
}
