import styles from './RangeField.module.css'

interface RangeFieldProps {
  disabled?: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
  valueSuffix?: string
}

export function RangeField({ disabled = false, label, max, min, onChange, step, value, valueSuffix = '%' }: RangeFieldProps) {
  return (
    <label className={styles.field} data-disabled={disabled ? 'true' : undefined}>
      <span className={styles.header}>
        <strong>{label}</strong>
        <output>{value}{valueSuffix}</output>
      </span>
      <input
        aria-label={label}
        aria-valuetext={valueSuffix === '%' ? `${value} percent` : `${value}${valueSuffix}`}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}
