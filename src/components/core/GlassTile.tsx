import { Icon } from './Icon'
import type { IconKey } from '../../constants/atAGlance'
import styles from './GlassTile.module.css'

export type TileTone = 'air' | 'climate' | 'contact' | 'light' | 'media' | 'neutral' | 'presence' | 'security' | 'vacuum' | 'warning'

interface GlassTileProps {
  title: string
  icon: IconKey | string
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
      <span className={styles.icon} aria-hidden="true">
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
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}