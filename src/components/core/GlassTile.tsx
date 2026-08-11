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
  ariaLabel?: string
  backgroundColor?: string
  controlRole?: 'switch'
  detailAutoFocus?: boolean
  disabled?: boolean
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
  trailingControl?: ReactNode
  variant?: 'card' | 'header'
}

export function GlassTile({
  title,
  icon,
  ariaLabel,
  backgroundColor,
  controlRole,
  detailAutoFocus = false,
  disabled = false,
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
  trailingControl,
  variant = 'card',
}: GlassTileProps) {
  const iconSize = variant === 'header' ? 26 : compact ? 18 : 24
  const progressValue = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined
  const showDisclosure = disclosure && Boolean(onClick) && !disabled
  const className = [
    styles.tile,
    onClick ? styles.button : '',
    compact ? styles.compact : '',
    showDisclosure ? styles.hasDisclosure : '',
    trailingControl ? styles.hasTrailingControl : '',
    variant === 'header' ? styles.headerPill : '',
    styles[tone],
    isOff ? styles.off : '',
  ]
    .filter(Boolean)
    .join(' ')
  const accessibleName = subtitle ? `${title} ${subtitle}` : title
  const resolvedAccessibleName = ariaLabel ?? accessibleName
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
        <span className={styles.labelGroup} data-dynamic-grid-label-container="true">
          <span className={styles.title} data-dynamic-grid-label="true">{title}</span>
          {subtitle && <span className={styles.subtitle} data-dynamic-grid-label="true">{subtitle}</span>}
        </span>
      </span>
      {showDisclosure && <ModalDisclosureIcon size={variant === 'header' ? 'compact' : 'standard'} />}
    </>
  )

  if (onClick) {
    const button = (
      <button
        aria-checked={controlRole === 'switch' ? pressed : undefined}
        aria-label={resolvedAccessibleName}
        aria-pressed={controlRole === 'switch' ? undefined : pressed}
        className={className}
        data-disabled={disabled ? 'true' : 'false'}
        data-icon={iconName}
        data-icon-color={iconColor}
        data-muted={isOff ? 'true' : 'false'}
        data-modal-detail-autofocus={detailAutoFocus ? 'true' : undefined}
        data-modal-opener={showDisclosure && disclosureKind === 'modal' ? 'true' : undefined}
        data-navigation-opener={showDisclosure && disclosureKind === 'navigation' ? 'true' : undefined}
        data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))}
        data-tone={tone}
        data-variant={variant}
        disabled={disabled}
        onClick={onClick}
        role={controlRole}
        style={resolvedStyle}
        type="button"
      >
        {content}
      </button>
    )

    if (trailingControl) {
      return (
        <div className={styles.controlShell} data-disclosure={showDisclosure ? 'true' : 'false'}>
          {button}
          <div className={styles.trailingControl}>{trailingControl}</div>
        </div>
      )
    }

    return button
  }

  return (
    <div aria-label={resolvedAccessibleName} className={className} data-icon={iconName} data-icon-color={iconColor} data-muted={isOff ? 'true' : 'false'} data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))} data-tone={tone} data-variant={variant} style={resolvedStyle}>
      {content}
    </div>
  )
}
