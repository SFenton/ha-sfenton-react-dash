import { useEntity } from '@hakit/core'
import { Lightbulb } from 'lucide-react'
import type { CSSProperties } from 'react'
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
  const fill = active ? 'currentColor' : 'none'
  const style: MultiLightIconStyle = { '--multi-light-size': `${size}px` }

  return (
    <span className={styles.multiIcon} style={style}>
      <Lightbulb absoluteStrokeWidth className={styles.rearBulb} fill={fill} strokeWidth={2.1} />
      <Lightbulb absoluteStrokeWidth className={styles.frontBulb} fill={fill} strokeWidth={2.1} />
    </span>
  )
}

function SingleLightIcon({ active }: { active: boolean }) {
  return <Lightbulb absoluteStrokeWidth fill={active ? 'currentColor' : 'none'} size={42} strokeWidth={2.08} />
}

interface LightCardProps {
  ariaLabel?: string
  entityId: string
  icon?: 'single' | 'multi'
  onClick: () => void
  pressed?: boolean
  size?: 'standard' | 'compact'
  title: string
}

export function LightCard({ ariaLabel, entityId, icon = 'single', onClick, pressed, size = 'standard', title }: LightCardProps) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const active = isActiveState(entity)
  const subtitle = formatCompactEntityState(entity, 'Off')
  const iconSlot = icon === 'multi' ? <MultiLightIcon active={active} size={42} /> : <SingleLightIcon active={active} />

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