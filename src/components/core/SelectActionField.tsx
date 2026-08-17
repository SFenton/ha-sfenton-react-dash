import { MaterialIcon } from './Icon'
import { FieldActionButton } from './FieldActionButton'
import { NativeSelectField, type NativeSelectOption } from './NativeSelectField'
import styles from './SelectActionField.module.css'

interface SelectActionFieldProps {
  actionDisabled?: boolean
  actionLabel: string
  ariaLabel?: string
  disabled?: boolean
  hideLabel?: boolean
  icon?: string
  label: string
  onAction: () => void
  onChange: (value: string) => void
  options: NativeSelectOption[]
  value: string
}

export function SelectActionField({
  actionDisabled,
  actionLabel,
  ariaLabel,
  disabled = false,
  hideLabel = false,
  icon,
  label,
  onAction,
  onChange,
  options,
  value,
}: SelectActionFieldProps) {
  return (
    <div
      aria-label={label}
      className={styles.field}
      data-disabled={disabled ? 'true' : 'false'}
      data-label-hidden={hideLabel ? 'true' : 'false'}
      data-select-action-field="true"
      role="group"
    >
      {!hideLabel && (
        <span className={styles.label}>
          {icon && <MaterialIcon name={icon} size={18} />}
          <span>{label}</span>
        </span>
      )}
      <div className={styles.controls}>
        <NativeSelectField
          ariaLabel={ariaLabel ?? label}
          className={styles.select}
          disabled={disabled}
          hideLabel
          label={label}
          onChange={onChange}
          options={options}
          value={value}
        />
        <FieldActionButton
          className={styles.action}
          disabled={actionDisabled ?? disabled}
          label={actionLabel}
          onClick={onAction}
        />
      </div>
    </div>
  )
}
