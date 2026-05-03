import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import { GlassTile } from '../core/GlassTile'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState, isActiveState } from './entityState'
import styles from './StatusRail.module.css'

interface StatusRailProps {
  chips: StatusChipConfig[]
  onOpenHash: (hash: string) => void
}

function StatusChip({ chip, onOpenHash }: { chip: StatusChipConfig; onOpenHash: (hash: string) => void }) {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const primaryState = formatCompactEntityState(entity)
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const subtitle = secondaryState ? `${primaryState} / ${secondaryState}` : primaryState

  return (
    <div className={styles.chip} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        compact
        icon={chip.icon}
        isOff={!isActiveState(entity) && !chip.secondaryEntityId}
        onClick={() => onOpenHash(chip.hash)}
        subtitle={subtitle}
        title={chip.title}
        tone={chip.tone}
        variant="header"
      />
    </div>
  )
}

export function StatusRail({ chips, onOpenHash }: StatusRailProps) {
  return (
    <div className={styles.rail}>
      {chips.map((chip) => (
        <StatusChip chip={chip} key={chip.title} onOpenHash={onOpenHash} />
      ))}
    </div>
  )
}