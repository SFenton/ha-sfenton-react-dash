import { useCallback, type KeyboardEvent } from 'react'
import { MaterialIcon } from './Icon'
import styles from './Stepper.module.css'

interface StepperProps {
  ariaLabel?: string
  className?: string
  decrementDisabled?: boolean
  decrementLabel: string
  disabled?: boolean
  displayValue: string
  icon?: string
  incrementDisabled?: boolean
  incrementLabel: string
  label: string
  onDecrement: () => void
  onIncrement: () => void
  onValueKeyDown?: (event: KeyboardEvent<HTMLSpanElement>) => void
  valueMax?: number
  valueMin?: number
  valueNow?: number
}

interface NumberStepperProps {
  ariaLabel?: string
  className?: string
  decrementLabel: string
  disabled?: boolean
  formatValue?: (value: number) => string
  icon?: string
  incrementLabel: string
  label: string
  max?: number
  min?: number
  onChange: (value: number) => void
  step?: number
  value: number
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function Stepper({ ariaLabel, className, decrementDisabled, decrementLabel, disabled = false, displayValue, icon, incrementDisabled, incrementLabel, label, onDecrement, onIncrement, onValueKeyDown, valueMax, valueMin, valueNow }: StepperProps) {
  const controlClassName = className ? `${styles.control} ${className}` : styles.control
  const spinnable = valueNow !== undefined

  return (
    <div className={controlClassName}>
      <span className={styles.label}>
        {icon && <MaterialIcon name={icon} size={15} />}
        {label}
      </span>
      <div className={styles.stepper}>
        <button aria-label={decrementLabel} className={styles.stepperButton} disabled={disabled || decrementDisabled} onClick={onDecrement} type="button">
          <MaterialIcon name="mdi:minus" size={20} />
        </button>
        <span
          aria-label={spinnable ? ariaLabel ?? label : undefined}
          aria-valuemax={valueMax}
          aria-valuemin={valueMin}
          aria-valuenow={valueNow}
          aria-valuetext={spinnable ? displayValue : undefined}
          className={styles.value}
          onKeyDown={onValueKeyDown}
          role={spinnable ? 'spinbutton' : undefined}
          tabIndex={spinnable && !disabled ? 0 : undefined}
        >
          {displayValue}
        </span>
        <button aria-label={incrementLabel} className={styles.stepperButton} disabled={disabled || incrementDisabled} onClick={onIncrement} type="button">
          <MaterialIcon name="mdi:plus" size={20} />
        </button>
      </div>
    </div>
  )
}

export function NumberStepper({ ariaLabel, className, decrementLabel, disabled = false, formatValue, icon, incrementLabel, label, max = Number.MAX_SAFE_INTEGER, min = 0, onChange, step = 1, value }: NumberStepperProps) {
  const changeBy = useCallback((amount: number) => {
    const nextValue = clampValue(Number((value + amount).toFixed(6)), min, max)
    if (nextValue !== value) onChange(nextValue)
  }, [max, min, onChange, value])
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      changeBy(step)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      changeBy(-step)
    }
  }

  return (
    <Stepper
      ariaLabel={ariaLabel}
      className={className}
      decrementDisabled={value - step < min}
      decrementLabel={decrementLabel}
      disabled={disabled}
      displayValue={formatValue ? formatValue(value) : String(value)}
      icon={icon}
      incrementDisabled={value + step > max}
      incrementLabel={incrementLabel}
      label={label}
      onDecrement={() => changeBy(-step)}
      onIncrement={() => changeBy(step)}
      onValueKeyDown={handleKeyDown}
      valueMax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
      valueMin={min}
      valueNow={value}
    />
  )
}
