import { useRef, type MouseEvent } from 'react'
import styles from './NativePickerField.module.css'

interface NativePickerFieldProps {
  ariaLabel?: string
  className?: string
  detailAutoFocus?: boolean
  disabled?: boolean
  emptyLabel?: string
  label: string
  name?: string
  onChange: (value: string) => void
  type: 'date' | 'time'
  value: string
}

function formatDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatTime(value: string) {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function displayValue(type: NativePickerFieldProps['type'], value: string, emptyLabel: string) {
  if (!value) return emptyLabel
  return type === 'date' ? formatDate(value) : formatTime(value)
}

export function NativePickerField({ ariaLabel, className, detailAutoFocus = false, disabled = false, emptyLabel = 'Select', label, name, onChange, type, value }: NativePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fieldClassName = className ? `${styles.field} ${className}` : styles.field
  const openPickerFromField = (event: MouseEvent<HTMLLabelElement>) => {
    const input = inputRef.current
    if (disabled || !input || event.target === input) return
    event.preventDefault()
    input.focus({ preventScroll: true })
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        return
      } catch {
        // Fall back to the native click path if the browser rejects programmatic picker opening.
      }
    }
    input.click()
  }

  return (
    <label className={fieldClassName} data-disabled={disabled ? 'true' : 'false'} onClick={openPickerFromField}>
      <span>{label}</span>
      <span className={styles.pickerShell} data-empty={value ? 'false' : 'true'}>
        <span className={styles.pickerValue} aria-hidden="true">{displayValue(type, value, emptyLabel)}</span>
        <input aria-label={ariaLabel ?? label} className={styles.nativePickerInput} data-modal-detail-autofocus={detailAutoFocus ? 'true' : undefined} disabled={disabled} name={name} onChange={(event) => onChange(event.target.value)} ref={inputRef} type={type} value={value} />
      </span>
    </label>
  )
}
