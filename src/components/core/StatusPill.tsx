import { MaterialIcon } from './Icon'
import styles from './StatusPill.module.css'

export type StatusPillTone = 'active' | 'danger' | 'neutral' | 'ok' | 'returning' | 'unavailable' | 'warning'

interface StatusPillProps {
  grouped?: boolean
  icon: string
  label: string
  tone?: StatusPillTone
  value: string
}

export function StatusPill({ grouped = false, icon, label, tone = 'neutral', value }: StatusPillProps) {
  const accessibilityProps = grouped ? { 'aria-label': `${label} ${value}`, role: 'group' as const } : {}

  return (
    <span {...accessibilityProps} className={styles.pill} data-icon={icon} data-tone={tone}>
      <MaterialIcon name={icon} size={18} />
      <span className={styles.text}>
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </span>
  )
}
