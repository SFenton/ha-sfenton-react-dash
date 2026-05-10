import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import { GlassTile } from '../core/GlassTile'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState, formatOccupancyEntityState, isActiveState } from './entityState'
import styles from './StatusRail.module.css'

interface StatusRailProps {
  chips: StatusChipConfig[]
  onOpenHash: (hash: string) => void
  subtitleByHash?: Partial<Record<string, string>>
}

function StatusChip({ chip, onOpenHash, subtitleOverride }: { chip: StatusChipConfig; onOpenHash: (hash: string) => void; subtitleOverride?: string }) {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const primaryState = chip.icon === 'presence' ? formatOccupancyEntityState(entity) : formatCompactEntityState(entity)
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const subtitle = subtitleOverride ?? (secondaryState ? `${primaryState} / ${secondaryState}` : primaryState)
  const isOff = !isActiveState(entity) && !chip.secondaryEntityId
  const icon = chip.icon === 'presence' && isOff ? 'presence-off' : chip.icon

  return (
    <div className={styles.chip} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        compact
        icon={icon}
        isOff={isOff}
        onClick={() => onOpenHash(chip.hash)}
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
        <StatusChip chip={chip} key={chip.title} onOpenHash={onOpenHash} subtitleOverride={subtitleByHash?.[chip.hash]} />
      ))}
    </div>
  )
}
