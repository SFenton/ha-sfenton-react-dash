import { MaterialIcon } from './Icon'
import styles from './NativePickerField.module.css'

export interface NativeSelectOption {
  label: string
  value: string
}

interface NativeSelectFieldProps {
  ariaLabel?: string
  blurOnChange?: boolean
  className?: string
  disabled?: boolean
  emptyLabel?: string
  hideLabel?: boolean
  icon?: string
  label: string
  name?: string
  onChange: (value: string) => void
  options: NativeSelectOption[]
  selectedLabel?: string
  value: string
}

export function NativeSelectField({
  ariaLabel,
  blurOnChange = false,
  className,
  disabled = false,
  emptyLabel = 'Select',
  hideLabel = false,
  icon,
  label,
  name,
  onChange,
  options,
  selectedLabel,
  value,
}: NativeSelectFieldProps) {
  const fieldClassName = className ? `${styles.field} ${className}` : styles.field
  const displayLabel = selectedLabel ?? options.find((option) => option.value === value)?.label ?? emptyLabel

  return (
    <label className={fieldClassName} data-disabled={disabled ? 'true' : 'false'} data-has-icon={icon ? 'true' : 'false'} data-label-hidden={hideLabel ? 'true' : 'false'} data-native-select-field="true">
      {!hideLabel && (
        <span className={styles.label}>
          {icon && <MaterialIcon name={icon} size={18} />}
          <span>{label}</span>
        </span>
      )}
      <span className={`${styles.pickerShell} ${styles.selectShell}`} data-empty={value ? 'false' : 'true'}>
        <span aria-hidden="true" className={styles.pickerValue}>{displayLabel}</span>
        <MaterialIcon name="mdi:chevron-down" size={19} />
        <select
          aria-label={ariaLabel ?? label}
          className={styles.nativePickerInput}
          disabled={disabled}
          name={name}
          onChange={(event) => {
            const nextValue = event.currentTarget.value
            if (blurOnChange) event.currentTarget.blur()
            onChange(nextValue)
          }}
          value={value}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </span>
    </label>
  )
}
