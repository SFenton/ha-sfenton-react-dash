import type { ReactNode } from 'react'
import { Description } from './Description'
import { GlassTile, type TileTone } from './GlassTile'
import { MaterialIcon } from './Icon'
import { InlineAlert } from './InlineAlert'
import { ModalActionFooter, type ModalFooterAction } from './ModalActionFooter'
import { SectionHeader } from './SectionHeader'
import styles from './ScheduleFlow.module.css'

export interface ScheduleControlConfig {
  active: boolean
  activeColor?: string
  description?: ReactNode
  disabled?: boolean
  heading?: string
  icon?: string
  label: string
  onToggle?: () => void
  subtitle?: string
  tone?: TileTone
}

export interface ScheduleAddAction {
  autoFocus?: boolean
  disabled?: boolean
  focusKey: string
  label: string
  onClick: () => void
}

interface ScheduleCollectionProps {
  addAction?: ScheduleAddAction
  children?: ReactNode
  control?: ScheduleControlConfig
  empty: boolean
  emptyText: string
  error?: ReactNode
  itemsTitle: string
  loading?: boolean
  loadingText?: string
  readOnlyText?: string
}

interface ScheduleListRowProps {
  accessibleLabel?: string
  autoFocus?: boolean
  active?: boolean
  disabled?: boolean
  disclosure?: boolean
  dynamicGridLabel?: boolean
  focusKey: string
  icon?: string
  iconSurface?: boolean
  onClick: () => void
  pressed?: boolean
  primary: ReactNode
  secondary?: ReactNode
  tertiary?: ReactNode
  trailingControl?: ReactNode
  wrapText?: boolean
}

interface ScheduleDetailFooterProps {
  deleteAction?: ModalFooterAction
  primaryAction: ModalFooterAction
}

export function ScheduleControlSection({
  active,
  activeColor = 'rgba(0, 150, 136, 0.58)',
  description,
  disabled = false,
  heading = 'Schedule Control',
  icon = 'mdi:calendar',
  label,
  onToggle,
  subtitle,
  tone = 'climate',
}: ScheduleControlConfig) {
  return (
    <section className={styles.section}>
      <SectionHeader title={heading} />
      <div className={styles.singleTile} data-disabled={disabled ? 'true' : 'false'}>
        <GlassTile
          compact
          backgroundColor={active ? activeColor : undefined}
          icon={icon}
          isOff={!active}
          onClick={disabled ? undefined : onToggle}
          pressed={active}
          subtitle={subtitle}
          title={label}
          tone={active ? tone : 'neutral'}
        />
      </div>
      {description && <Description>{description}</Description>}
    </section>
  )
}

export function ScheduleCollection({
  addAction,
  children,
  control,
  empty,
  emptyText,
  error,
  itemsTitle,
  loading = false,
  loadingText = 'Loading schedules…',
  readOnlyText,
}: ScheduleCollectionProps) {
  return (
    <div className={styles.stack}>
      {control && <ScheduleControlSection {...control} />}
      <section className={styles.section}>
        <SectionHeader title={itemsTitle} />
        {loading && <Description>{loadingText}</Description>}
        {!loading && empty && <Description>{emptyText}</Description>}
        <div className={styles.list}>{children}</div>
        {error && <InlineAlert>{error}</InlineAlert>}
        {addAction ? (
          <button
            className={styles.add}
            data-modal-detail-autofocus={addAction.autoFocus ? 'true' : undefined}
            data-modal-detail-trigger={addAction.focusKey}
            disabled={addAction.disabled}
            onClick={addAction.onClick}
            type="button"
          >
            <MaterialIcon name="mdi:plus" size={20} />
            {addAction.label}
          </button>
        ) : readOnlyText ? (
          <Description>{readOnlyText}</Description>
        ) : null}
      </section>
    </div>
  )
}

export function ScheduleListRow({
  accessibleLabel,
  active = false,
  autoFocus = false,
  disabled = false,
  disclosure = true,
  dynamicGridLabel = false,
  focusKey,
  icon = 'mdi:calendar',
  iconSurface = true,
  onClick,
  pressed,
  primary,
  secondary,
  tertiary,
  trailingControl,
  wrapText = false,
}: ScheduleListRowProps) {
  return (
    <div className={styles.rowShell} data-schedule-list-row={true}>
      <button
        aria-label={accessibleLabel}
        aria-pressed={pressed}
        className={styles.row}
        data-active={active ? 'true' : 'false'}
        data-has-trailing-control={trailingControl ? 'true' : 'false'}
        data-icon-surface={iconSurface ? 'true' : 'false'}
        data-modal-detail-autofocus={autoFocus ? 'true' : undefined}
        data-modal-detail-trigger={focusKey}
        data-wrap-text={wrapText ? 'true' : undefined}
        disabled={disabled}
        onClick={onClick}
        type='button'
      >
        <span className={styles.rowIcon}>
          <MaterialIcon name={icon} size={22} />
        </span>
        <span className={styles.rowText} data-dynamic-grid-label-container={dynamicGridLabel ? 'true' : undefined}>
          <strong data-dynamic-grid-label={dynamicGridLabel ? 'true' : undefined}>{primary}</strong>
          {secondary && <span>{secondary}</span>}
          {tertiary && <small>{tertiary}</small>}
        </span>
        {trailingControl && <span aria-hidden className={styles.rowTrailingSpacer} />}
        {!disabled && disclosure && (
          <span className={styles.rowChevron} data-schedule-list-row-chevron>
            <MaterialIcon name='mdi:chevron-right' size={20} />
          </span>
        )}
      </button>
      {trailingControl && <div className={styles.rowTrailingControl} data-schedule-list-row-control>{trailingControl}</div>}
    </div>
  )
}

export function ScheduleDetailFooter({ deleteAction, primaryAction }: ScheduleDetailFooterProps) {
  return <ModalActionFooter destructive={deleteAction} primary={primaryAction} />
}
