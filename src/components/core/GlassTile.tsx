import { Icon } from './Icon'
import { isValidElement, type CSSProperties, type ReactNode } from 'react'
import type { IconKey } from '../../constants/atAGlance'
import { SurfaceAccessory } from './SurfaceAccessory'
import { controlDisclosureTarget, TOGGLE_CONTROL_KIND, type ControlSemantics } from './controlSemantics'
import styles from './GlassTile.module.css'

export type TileTone = 'air' | 'climate' | 'contact' | 'danger' | 'light' | 'media' | 'neutral' | 'presence' | 'security' | 'switch' | 'vacuum' | 'warning'

type GlassTileStyle = CSSProperties & {
  '--header-pill-color'?: string
  '--tile-color'?: string
  '--tile-controls-width'?: string
  '--tile-progress'?: string
  '--tile-progress-color'?: string
}

type GlassTileControlSemantics = Extract<ControlSemantics, { kind: 'command' } | { kind: 'toggle' }>

export interface GlassTileControl {
  ariaLabel: string
  disabled: boolean
  icon: IconKey | string | ReactNode
  id: string
  onPress: () => void
  semantics: GlassTileControlSemantics
}

export type GlassTileControls =
  | readonly [GlassTileControl]
  | readonly [GlassTileControl, GlassTileControl]

interface GlassTileBaseProps {
  title: string
  icon: IconKey | string | ReactNode
  announcement?: string
  ariaLabel?: string
  ariaDisabled?: boolean
  backgroundColor?: string
  controlRole?: 'switch'
  detailAutoFocus?: boolean
  disabled?: boolean
  dynamicGridMeasurementLabels?: readonly string[]
  iconColor?: string
  subtitle?: string
  semantics?: ControlSemantics
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

export type GlassTileProps = GlassTileBaseProps & (
  | { controls?: never; trailingControl?: ReactNode }
  | { controls: GlassTileControls; trailingControl?: never }
)

function tileIconContent(icon: GlassTileControl['icon'], size: number) {
  const iconName = typeof icon === 'string' ? icon : undefined
  return isValidElement(icon) ? icon : <Icon name={iconName ?? 'mdi:help-circle-outline'} size={size} />
}

export function GlassTile({
  title,
  icon,
  announcement,
  ariaLabel,
  ariaDisabled = false,
  backgroundColor,
  controlRole,
  detailAutoFocus = false,
  disabled = false,
  dynamicGridMeasurementLabels,
  iconColor,
  subtitle,
  semantics,
  tone = 'neutral',
  compact = false,
  controls,
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
  const semanticDisclosureTarget = controlDisclosureTarget(semantics)
  const legacyDisclosureTarget = disclosure ? disclosureKind : null
  const disclosureTarget = semantics ? semanticDisclosureTarget : legacyDisclosureTarget
  const showDisclosure = Boolean(disclosureTarget && onClick && !disabled)
  const accessorySemantics: ControlSemantics | null = disclosureTarget === 'modal'
    ? { kind: 'modal' }
    : disclosureTarget === 'navigation'
      ? { kind: 'navigate' }
      : null
  const resolvedControlRole = semantics?.kind === 'toggle' ? 'switch' : controlRole
  const semanticChecked = semantics?.kind === 'toggle' ? semantics.checked : undefined
  const semanticPressed = semantics?.kind === 'selection' ? semantics.selected : undefined
  const controlCount = controls?.length ?? 0
  const className = [
    styles.tile,
    onClick ? styles.button : '',
    compact ? styles.compact : '',
    showDisclosure ? styles.hasDisclosure : '',
    controlCount > 0 ? styles.hasControls : '',
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
  if (controlCount > 0) style['--tile-controls-width'] = `${controlCount * 44 + (controlCount - 1) * 8}px`
  if (progressValue !== undefined) style['--tile-progress'] = `${progressValue}%`
  if (progressColor) style['--tile-progress-color'] = progressColor
  const resolvedStyle = Object.keys(style).length ? style : undefined
  const iconName = typeof icon === 'string' ? icon : undefined
  const iconContent = tileIconContent(icon, iconSize)

  const content = (
    <>
      {progressValue !== undefined && <span aria-hidden="true" className={styles.progressFill} />}
      <span className={styles.content} data-glass-tile-content="true">
        <span aria-hidden="true" className={styles.icon} style={iconColor ? { color: iconColor } : undefined}>
          {iconContent}
        </span>
        <span className={styles.labelGroup} data-dynamic-grid-label-container="true">
          <span className={styles.title} data-dynamic-grid-label="true">{title}</span>
          {subtitle && <span className={styles.subtitle} data-dynamic-grid-label="true">{subtitle}</span>}
          {dynamicGridMeasurementLabels?.map((label) => (
            <span
              aria-hidden="true"
              className={`${styles.subtitle} ${styles.measurementLabel}`}
              data-dynamic-grid-label="true"
              data-dynamic-grid-measure-only="true"
              key={label}
            >
              {label}
            </span>
          ))}
        </span>
      </span>
      {showDisclosure && accessorySemantics && <SurfaceAccessory semantics={accessorySemantics} size={variant === 'header' ? 'compact' : 'standard'} />}
    </>
  )
  const liveAnnouncement = announcement !== undefined ? (
    <span aria-atomic="true" aria-live="polite" className={styles.visuallyHidden} data-live-announcement="true" role="status">
      {announcement}
    </span>
  ) : null

  if (onClick) {
    const button = (
      <button
        aria-checked={semantics ? semanticChecked : controlRole === 'switch' ? pressed : undefined}
        aria-disabled={disabled || ariaDisabled ? 'true' : undefined}
        aria-label={resolvedAccessibleName}
        aria-pressed={semantics ? semanticPressed : controlRole === 'switch' ? undefined : pressed}
        className={className}
        data-action-kind={semantics?.kind}
        data-disabled={disabled || ariaDisabled ? 'true' : 'false'}
        data-icon={iconName}
        data-icon-color={iconColor}
        data-muted={isOff ? 'true' : 'false'}
        data-modal-detail-autofocus={detailAutoFocus ? 'true' : undefined}
        data-modal-opener={showDisclosure && disclosureTarget === 'modal' ? 'true' : undefined}
        data-navigation-opener={showDisclosure && disclosureTarget === 'navigation' ? 'true' : undefined}
        data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))}
        data-tone={tone}
        data-variant={variant}
        disabled={disabled}
        onClick={onClick}
        role={resolvedControlRole}
        style={resolvedStyle}
        type="button"
      >
        {content}
      </button>
    )

    if (trailingControl) {
      return (
        <>
          <div className={styles.controlShell} data-disclosure={showDisclosure ? 'true' : 'false'} data-glass-tile-control-shell="legacy">
            {button}
            <div className={styles.trailingControl}>{trailingControl}</div>
          </div>
          {liveAnnouncement}
        </>
      )
    }

    if (controls) {
      return (
        <>
          <div className={styles.controlShell} data-disclosure={showDisclosure ? 'true' : 'false'} data-glass-tile-control-shell="rail">
            {button}
            <div className={styles.controlRail} data-glass-tile-control-rail="true">
              {controls.map((control) => {
                const checked = control.semantics.kind === TOGGLE_CONTROL_KIND ? control.semantics.checked : undefined
                return (
                  <button
                    aria-checked={checked}
                    aria-label={control.ariaLabel}
                    className={styles.railControl}
                    data-action-kind={control.semantics.kind}
                    data-checked={checked === undefined ? undefined : checked ? 'true' : 'false'}
                    data-control-id={control.id}
                    data-glass-tile-control="true"
                    disabled={control.disabled}
                    key={control.id}
                    onClick={control.onPress}
                    role={control.semantics.kind === TOGGLE_CONTROL_KIND ? 'switch' : undefined}
                    type="button"
                  >
                    {tileIconContent(control.icon, 20)}
                  </button>
                )
              })}
            </div>
          </div>
          {liveAnnouncement}
        </>
      )
    }

    return (
      <>
        {button}
        {liveAnnouncement}
      </>
    )
  }

  return (
    <>
      <div aria-label={resolvedAccessibleName} className={className} data-action-kind={semantics?.kind} data-icon={iconName} data-icon-color={iconColor} data-muted={isOff ? 'true' : 'false'} data-progress={progressValue === undefined ? undefined : String(Math.round(progressValue))} data-tone={tone} data-variant={variant} style={resolvedStyle}>
        {content}
      </div>
      {liveAnnouncement}
    </>
  )
}
