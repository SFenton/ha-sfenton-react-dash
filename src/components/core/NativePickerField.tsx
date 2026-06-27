import styles from './NativePickerField.module.css'

interface NativePickerFieldProps {
  ariaLabel?: string
  className?: string
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

function displayValue(type: NativePickerFieldProps['type'], value: string) {
  return type === 'date' ? formatDate(value) : formatTime(value)
}

export function NativePickerField({ ariaLabel, className, label, name, onChange, type, value }: NativePickerFieldProps) {
  const fieldClassName = className ? `${styles.field} ${className}` : styles.field

  return (
    <label className={fieldClassName}>
      <span>{label}</span>
      <span className={styles.pickerShell} data-empty={value ? 'false' : 'true'}>
        <span className={styles.pickerValue} aria-hidden="true">{displayValue(type, value)}</span>
        <input aria-label={ariaLabel ?? label} className={styles.nativePickerInput} name={name} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
      </span>
    </label>
  )
}
