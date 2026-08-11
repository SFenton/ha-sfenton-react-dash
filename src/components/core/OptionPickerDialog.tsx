import { useEffect, useId, useRef, type ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import glassTileStyles from './GlassTile.module.css'
import { ModalSheet, type ModalSheetStyle } from './ModalSheet'
import { useCopy } from '../../i18n'
import styles from './OptionPickerDialog.module.css'

export interface PickerOption {
  label: ReactNode
  value: string
  icon?: string
  activeBackground?: string
}

interface OptionPickerPanelProps {
  autoFocus?: boolean
  icon?: string
  layout?: 'card-grid' | 'compact-grid' | 'list'
  onSelect: (value: string) => void
  options: PickerOption[]
  selectedIcon?: string
  title: string
  value: string
}

interface OptionPickerDialogProps {
  open: boolean
  options: PickerOption[]
  title: string
  value: string
  icon?: string
  selectedIcon?: string
  presentation?: 'dialog' | 'sheet'
  sheetLayout?: 'card-grid' | 'compact-grid'
  sheetStyle?: ModalSheetStyle
  onClose: () => void
  onSelect: (value: string) => void
}

export function OptionPickerPanel({
  autoFocus = true,
  icon,
  layout = 'list',
  onSelect,
  options,
  selectedIcon,
  title,
  value,
}: OptionPickerPanelProps) {
  const firstActiveRef = useRef<HTMLButtonElement | null>(null)
  const isSheet = layout !== 'list'

  useEffect(() => {
    if (!autoFocus) return undefined

    const timeout = window.setTimeout(() => firstActiveRef.current?.focus(), 0)
    return () => window.clearTimeout(timeout)
  }, [autoFocus])

  return (
    <div aria-label={`${title} options`} className={`${styles.options} ${isSheet ? styles.sheetOptions : ''} ${layout === 'compact-grid' ? styles.compactSheetOptions : ''}`} data-layout={layout} role="group">
      {options.map((option) => {
        const active = option.value === value
        const sheetIcon = option.icon ?? (active ? (selectedIcon ?? icon) : icon)
        return (
          <button
            aria-pressed={active}
            className={isSheet ? `${glassTileStyles.tile} ${styles.sheetOption} ${layout === 'compact-grid' ? styles.compactSheetOption : ''}` : styles.option}
            data-active={active}
            data-modal-detail-autofocus={active ? 'true' : undefined}
            key={option.value}
            onClick={() => onSelect(option.value)}
            ref={active ? firstActiveRef : undefined}
            style={active && option.activeBackground ? { background: option.activeBackground } : undefined}
            type="button"
          >
            {isSheet ? (
              <span className={styles.sheetOptionContent}>
                <span aria-hidden="true" className={styles.sheetOptionIcon}>{sheetIcon && <MaterialIcon name={sheetIcon} size={24} />}</span>
                <span className={styles.sheetOptionLabel}>{option.label}</span>
              </span>
            ) : (
              <>
                <span>{option.label}</span>
                {active && <MaterialIcon name="mdi:checkbox-marked-circle" size={19} />}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function OptionPickerDialog({ open, options, title, value, icon, selectedIcon, presentation = 'dialog', sheetLayout = 'card-grid', sheetStyle, onClose, onSelect }: OptionPickerDialogProps) {
  const copy = useCopy('common')
  const titleId = useId()
  const isSheet = presentation === 'sheet'
  const optionPanel = (
    <OptionPickerPanel
      autoFocus={open}
      icon={icon}
      layout={isSheet ? sheetLayout : 'list'}
      onSelect={onSelect}
      options={options}
      selectedIcon={selectedIcon}
      title={title}
      value={value}
    />
  )

  if (!open && !isSheet) return null

  if (isSheet) {
    return (
      <ModalSheet contentStyle={sheetStyle} onClose={onClose} open={open} title={title}>
        {optionPanel}
      </ModalSheet>
    )
  }

  return (
    <div
      className={styles.overlay}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section aria-labelledby={titleId} aria-modal="true" className={styles.dialog} role="dialog">
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button aria-label={copy('actions.close')} className={styles.close} onClick={onClose} type="button">
            <MaterialIcon name="mdi:close" size={19} />
          </button>
        </header>
        {optionPanel}
      </section>
    </div>
  )
}