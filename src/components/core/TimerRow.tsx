import { FieldActionButton } from './FieldActionButton'
import { MaterialIcon } from './Icon'
import styles from './TimerRow.module.css'

interface TimerRowProps {
  ariaLabel: string
  clearDisabled?: boolean
  clearLabel: string
  onClear: () => void
  value: string
}

export function TimerRow({ ariaLabel, clearDisabled = false, clearLabel, onClear, value }: TimerRowProps) {
  return (
    <div aria-label={ariaLabel} className={styles.row} data-timer-row="true" role="group">
      <span aria-hidden="true" className={styles.icon}>
        <MaterialIcon name="mdi:timer-outline" size={24} />
      </span>
      <strong className={styles.value}>{value}</strong>
      <FieldActionButton className={styles.clear} disabled={clearDisabled} label={clearLabel} onClick={onClear} tone="danger" />
    </div>
  )
}
