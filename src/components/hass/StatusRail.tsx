import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import type { HassEntity } from 'home-assistant-js-websocket'
import { GlassTile, type TileTone } from '../core/GlassTile'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState, formatContactEntityState, formatOccupancyEntityState, isActiveState, isContactOpen } from './entityState'
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

const SECURITY_STATE_META: Record<string, { color: string; icon: string }> = {
  disarmed: { color: 'rgb(67, 160, 71)', icon: 'mdi:shield-off' },
  armed_home: { color: 'rgb(30, 136, 229)', icon: 'mdi:shield-home' },
  armed_night: { color: 'rgb(142, 36, 170)', icon: 'mdi:shield-moon' },
  armed_away: { color: 'rgb(229, 57, 53)', icon: 'mdi:shield' },
  triggered: { color: 'rgb(229, 57, 53)', icon: 'mdi:shield-alert' },
}

function securityStateMeta(state: string | undefined) {
  return (state && SECURITY_STATE_META[state]) || { color: 'rgb(84, 110, 122)', icon: 'mdi:shield-outline' }
}

function colorState(entity: HassEntity | null | undefined) {
  const state = entity?.state ?? ''
  return /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(state) ? state : undefined
}

function StatusChip({ chip, onOpenHash, subtitleOverride }: { chip: StatusRailChip; onOpenHash: (hash: string) => void; subtitleOverride?: string }) {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const colorEntity = useEntity(asEntityName(chip.colorEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const stateKind = chip.stateKind ?? (chip.tone === 'security' ? 'security' : chip.icon)
  let primaryState = stateKind === 'presence' ? formatOccupancyEntityState(entity) : stateKind === 'contact' ? formatContactEntityState(entity) : formatCompactEntityState(entity)
  if (stateKind === 'contact' && !isContactOpen(entity) && chip.title.endsWith('s')) primaryState = 'All Closed'
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const subtitle = subtitleOverride ?? (secondaryState ? `${primaryState} / ${secondaryState}` : primaryState)
  const isOff = stateKind === 'security' ? false : !isActiveState(entity) && !chip.secondaryEntityId
  const securityMeta = stateKind === 'security' ? securityStateMeta(entity?.state) : null
  const dynamicColor = chip.colorEntityId ? colorState(colorEntity) : undefined
  const icon = securityMeta?.icon ?? (stateKind === 'presence' && isOff ? 'presence-off' : stateKind === 'contact' && isContactOpen(entity) ? 'contact-open' : chip.icon)

  return (
    <div className={styles.chip} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        compact
        icon={icon}
        iconColor={securityMeta?.color ?? dynamicColor}
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
