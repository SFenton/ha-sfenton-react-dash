import { useEffect, useId, useRef, type ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import glassTileStyles from './GlassTile.module.css'
import { ModalSheet } from './ModalSheet'
import styles from './OptionPickerDialog.module.css'

export interface PickerOption {
  label: ReactNode
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
  onClose: () => void
  onSelect: (value: string) => void
}

export function OptionPickerDialog({ open, options, title, value, icon, selectedIcon, presentation = 'dialog', onClose, onSelect }: OptionPickerDialogProps) {
  const titleId = useId()
  const firstActiveRef = useRef<HTMLButtonElement | null>(null)
  const isSheet = presentation === 'sheet'

  useEffect(() => {
    if (!open) return undefined

    const timeout = window.setTimeout(() => firstActiveRef.current?.focus(), 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!open) return null

  const optionList = (
    <div aria-label={`${title} options`} className={`${styles.options} ${presentation === 'sheet' ? styles.sheetOptions : ''}`} data-layout={presentation === 'sheet' ? 'card-grid' : 'list'} role="group">
      {options.map((option) => {
        const active = option.value === value
        const sheetIcon = active ? (selectedIcon ?? icon) : icon
        return (
          <button
            aria-pressed={active}
            className={isSheet ? `${glassTileStyles.tile} ${styles.sheetOption}` : styles.option}
            data-active={active}
            key={option.value}
            onClick={() => onSelect(option.value)}
            ref={active ? firstActiveRef : undefined}
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

  if (isSheet) {
    return (
      <ModalSheet onClose={onClose} open={open} title={title}>
        {optionList}
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
          <button aria-label="Close" className={styles.close} onClick={onClose} type="button">
            <MaterialIcon name="mdi:close" size={19} />
          </button>
        </header>
        {optionList}
      </section>
    </div>
  )
}