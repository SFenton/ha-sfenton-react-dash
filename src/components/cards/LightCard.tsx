import { useEntity } from '@hakit/core'
import type { CSSProperties } from 'react'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatCompactEntityState, isActiveState } from '../hass/entityState'
import { Card, type CardColor } from '../core/Card'
import styles from './LightCard.module.css'

const LIGHT_ON_COLOR: CardColor = { r: 150, g: 80, b: 28 }

interface MultiLightIconProps {
  active: boolean
  size?: number
}

type MultiLightIconStyle = CSSProperties & {
  '--multi-light-size': string
}

export function MultiLightIcon({ active, size = 28 }: MultiLightIconProps) {
  const style: MultiLightIconStyle = { '--multi-light-size': `${size}px`, opacity: active ? 1 : 0.72 }

  return (
    <span className={styles.multiIcon} style={style}>
      <span className={styles.rearBulb}><MaterialIcon name="mdi:lightbulb" size={size} /></span>
      <span className={styles.frontBulb}><MaterialIcon name="mdi:lightbulb" size={size} /></span>
    </span>
  )
}

function SingleLightIcon({ active, size }: { active: boolean; size: number }) {
  return <MaterialIcon name={active ? 'mdi:lightbulb' : 'mdi:lightbulb'} size={size} />
}

interface LightCardProps {
  activeOverride?: boolean
  ariaLabel?: string
  entityId: string
  icon?: 'single' | 'multi'
  onClick?: () => void
  pressed?: boolean
  size?: 'standard' | 'compact'
  subtitleOverride?: string
  title: string
}

export function LightCard({ activeOverride, ariaLabel, entityId, icon = 'single', onClick, pressed, size = 'standard', subtitleOverride, title }: LightCardProps) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const active = activeOverride ?? isActiveState(entity)
  const subtitle = subtitleOverride ?? formatCompactEntityState(entity, 'Off')
  const iconSize = size === 'compact' ? 24 : 42
  const iconSlot = icon === 'multi' ? <MultiLightIcon active={active} size={iconSize} /> : <SingleLightIcon active={active} size={iconSize} />

  return (
    <Card
      ariaLabel={ariaLabel ?? `${title} ${subtitle}`}
      color={LIGHT_ON_COLOR}
      icon={iconSlot}
      muted={!active}
      onClick={onClick}
      pressed={pressed ? active : undefined}
      size={size}
      subtitle={subtitle}
      title={title}
    />
  )
}