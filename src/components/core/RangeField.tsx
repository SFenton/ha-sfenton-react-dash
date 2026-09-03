import { useRef } from 'react'
import styles from './RangeField.module.css'

interface RangeFieldProps {
  disabled?: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  step: number
  value: number
  valueText?: string
  valueSuffix?: string
}

export function RangeField({ disabled = false, label, max, min, onChange, onCommit, step, value, valueText, valueSuffix = '%' }: RangeFieldProps) {
  const pendingCommitRef = useRef<number | null>(null)
  const displayedValue = valueText ?? `${value}${valueSuffix}`
  const commitPendingValue = () => {
    if (!onCommit || pendingCommitRef.current === null) return
    const pendingValue = pendingCommitRef.current
    pendingCommitRef.current = null
    onCommit(pendingValue)
  }

  return (
    <label className={styles.field} data-disabled={disabled ? 'true' : undefined}>
      <span className={styles.header}>
        <strong>{label}</strong>
        <output>{displayedValue}</output>
      </span>
      <input
        aria-label={label}
        aria-valuetext={valueText ?? (valueSuffix === '%' ? `${value} percent` : displayedValue)}
        disabled={disabled}
        max={max}
        min={min}
        onBlur={commitPendingValue}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          if (onCommit) pendingCommitRef.current = nextValue
          onChange(nextValue)
        }}
        onKeyUp={commitPendingValue}
        onPointerCancel={commitPendingValue}
        onPointerUp={commitPendingValue}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}
