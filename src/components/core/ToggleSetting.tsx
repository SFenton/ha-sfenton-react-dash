import { MaterialIcon } from './Icon'
import { ToggleControl } from './ToggleControl'
import styles from './ToggleSetting.module.css'

interface ToggleSettingProps {
  checked: boolean
  disabled?: boolean
  icon: string
  label: string
  onChange: (checked: boolean) => void
}

export function ToggleSetting({
  checked,
  disabled = false,
  icon,
  label,
  onChange,
}: ToggleSettingProps) {
  return (
    <div className={styles.setting} data-disabled={disabled ? 'true' : 'false'}>
      <span className={styles.icon}>
        <MaterialIcon name={icon} size={22} />
      </span>
      <span className={styles.text}>
        <strong>{label}</strong>
      </span>
      <ToggleControl checked={checked} disabled={disabled} label={label} onChange={onChange} />
    </div>
  )
}
