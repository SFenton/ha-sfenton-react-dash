import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import { GlassTile, type TileTone } from '../core/GlassTile'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState, formatContactEntityState, formatOccupancyEntityState, isActiveState, isContactOpen } from './entityState'
import styles from './StatusRail.module.css'

export interface StatusRailChip extends Omit<StatusChipConfig, 'hash' | 'icon' | 'tone'> {
  hash?: string
  icon: StatusChipConfig['icon'] | string
  stateKind?: 'contact' | 'presence'
  tone: TileTone
}

interface StatusRailProps {
  chips: StatusRailChip[]
  onOpenHash: (hash: string) => void
  subtitleByHash?: Partial<Record<string, string>>
}

function StatusChip({ chip, onOpenHash, subtitleOverride }: { chip: StatusRailChip; onOpenHash: (hash: string) => void; subtitleOverride?: string }) {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const stateKind = chip.stateKind ?? chip.icon
  let primaryState = stateKind === 'presence' ? formatOccupancyEntityState(entity) : stateKind === 'contact' ? formatContactEntityState(entity) : formatCompactEntityState(entity)
  if (stateKind === 'contact' && !isContactOpen(entity) && chip.title.endsWith('s')) primaryState = 'All Closed'
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const subtitle = subtitleOverride ?? (secondaryState ? `${primaryState} / ${secondaryState}` : primaryState)
  const isOff = !isActiveState(entity) && !chip.secondaryEntityId
  const icon = stateKind === 'presence' && isOff ? 'presence-off' : stateKind === 'contact' && isContactOpen(entity) ? 'contact-open' : chip.icon

  return (
    <div className={styles.chip} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        compact
        icon={icon}
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
