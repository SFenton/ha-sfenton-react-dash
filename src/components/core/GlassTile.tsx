import { Icon } from './Icon'
import { isValidElement, type CSSProperties, type ReactNode } from 'react'
import type { IconKey } from '../../constants/atAGlance'
import { ModalDisclosureIcon } from './ModalDisclosureIcon'
import styles from './GlassTile.module.css'

export type TileTone = 'air' | 'climate' | 'contact' | 'danger' | 'light' | 'media' | 'neutral' | 'presence' | 'security' | 'switch' | 'vacuum' | 'warning'

type GlassTileStyle = CSSProperties & {
  '--header-pill-color'?: string
  '--tile-color'?: string
  '--tile-progress'?: string
  '--tile-progress-color'?: string
}

export interface GlassTileProps {
  title: string
  icon: IconKey | string | ReactNode
  backgroundColor?: string
  iconColor?: string
  subtitle?: string
  tone?: TileTone
  compact?: boolean
  disclosure?: boolean
  disclosureKind?: 'modal' | 'navigation'
  isOff?: boolean
  onClick?: () => void
  pressed?: boolean
  progress?: number
  progressColor?: string
  variant?: 'card' | 'header'
}

export function GlassTile({
  title,
  icon,
  backgroundColor,
  iconColor,
  subtitle,
  tone = 'neutral',
  compact = false,
  disclosure = false,
  disclosureKind = 'modal',
  isOff = false,
  onClick,
  pressed,
  progress,
  progressColor,
  variant = 'card',
}: GlassTileProps) {
  const iconSize = variant === 'header' ? 26 : compact ? 18 : 24
  const progressValue = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined
  const className = [
    styles.tile,
    onClick ? styles.button : '',
    compact ? styles.compact : '',
    disclosure && onClick ? styles.hasDisclosure : '',
    variant === 'header' ? styles.headerPill : '',
    styles[tone],
    isOff ? styles.off : '',
  ]
    .filter(Boolean)
    .join(' ')
  const accessibleName = subtitle ? `${title} ${subtitle}` : title
  const style: GlassTileStyle = {}
  if (backgroundColor) {
    style['--header-pill-color'] = backgroundColor
    style['--tile-color'] = backgroundColor
  }
  if (progressValue !== undefined) style['--tile-progress'] = `${progressValue}%`
  if (progressColor) style['--tile-progress-color'] = progressColor
  const resolvedStyle = Object.keys(style).length ? style : undefined
  const iconName = typeof icon === 'string' ? icon : undefined
  const iconContent = isValidElement(icon) ? icon : <Icon name={iconName ?? 'mdi:help-circle-outline'} size={iconSize} />

  const content = (
    <>
      {progressValue !== undefined && <span aria-hidden="true" className={styles.progressFill} />}
      <span className={styles.content}>
        <span aria-hidden="true" className={styles.icon} style={iconColor ? { color: iconColor } : undefined}>
          {iconContent}
        </span>
        <span className={styles.labelGroup}>
          <span className={styles.title}>{title}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </span>
      </span>
      {disclosure && onClick && <ModalDisclosureIcon size={variant === 'header' ? 'compact' : 'standard'} />}
    </>
  )

  if (onClick) {
    return (
      <button
        aria-label={accessibleName}
        aria-pressed={pressed}
        className={className}
        data-icon={iconName}
        data-icon-color={iconColor}
        data-muted={isOff ? 'true' : 'false'}
        data-modal-opener={disclosure && disclosureKind === 'modal' ? 'true' : undefined}
        data-navigation-opener={disclosure && disclosureKind === 'navigation' ? 'true' : undefined}
        data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))}
        data-tone={tone}
        data-variant={variant}
        onClick={onClick}
        style={resolvedStyle}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <div aria-label={accessibleName} className={className} data-icon={iconName} data-icon-color={iconColor} data-muted={isOff ? 'true' : 'false'} data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))} data-tone={tone} data-variant={variant} style={resolvedStyle}>
      {content}
    </div>
  )
}
