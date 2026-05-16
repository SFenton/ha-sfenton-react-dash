import { useEffect, useId, useRef, type ReactNode } from 'react'
import { MaterialIcon } from './Icon'
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
  onClose: () => void
  onSelect: (value: string) => void
}

export function OptionPickerDialog({ open, options, title, value, onClose, onSelect }: OptionPickerDialogProps) {
  const titleId = useId()
  const firstActiveRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const timeout = window.setTimeout(() => firstActiveRef.current?.focus(), 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!open) return null

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
        <div aria-label={`${title} options`} className={styles.options} role="group">
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                aria-pressed={active}
                className={styles.option}
                data-active={active}
                key={option.value}
                onClick={() => onSelect(option.value)}
                ref={active ? firstActiveRef : undefined}
                type="button"
              >
                <span>{option.label}</span>
                {active && <MaterialIcon name="mdi:checkbox-marked-circle" size={19} />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}