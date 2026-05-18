import { Icon } from './Icon'
import type { IconKey } from '../../constants/atAGlance'
import styles from './GlassTile.module.css'

export type TileTone = 'air' | 'climate' | 'contact' | 'light' | 'media' | 'neutral' | 'presence' | 'security' | 'vacuum' | 'warning'

interface GlassTileProps {
  title: string
  icon: IconKey | string
  iconColor?: string
  subtitle?: string
  tone?: TileTone
  compact?: boolean
  isOff?: boolean
  onClick?: () => void
  variant?: 'card' | 'header'
}

export function GlassTile({
  title,
  icon,
  iconColor,
  subtitle,
  tone = 'neutral',
  compact = false,
  isOff = false,
  onClick,
  variant = 'card',
}: GlassTileProps) {
  const iconSize = variant === 'header' ? 30 : compact ? 18 : 24
  const className = [
    styles.tile,
    onClick ? styles.button : '',
    compact ? styles.compact : '',
    variant === 'header' ? styles.headerPill : '',
    styles[tone],
    isOff ? styles.off : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <span className={styles.content}>
      <span aria-hidden="true" className={styles.icon} style={iconColor ? { color: iconColor } : undefined}>
        <Icon name={icon} size={iconSize} />
      </span>
      <span className={styles.labelGroup}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </span>
  )

  if (onClick) {
    return (
      <button className={className} data-icon={icon} data-icon-color={iconColor} onClick={onClick} type="button">
        {content}
      </button>
    )
  }

  return (
    <div className={className} data-icon={icon} data-icon-color={iconColor}>
      {content}
    </div>
  )
}