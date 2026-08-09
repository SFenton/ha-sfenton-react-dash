import { MaterialIcon } from './Icon'
import styles from './StatusPill.module.css'

export type StatusPillTone = 'active' | 'danger' | 'neutral' | 'ok' | 'returning' | 'unavailable' | 'warning'

interface StatusPillProps {
  detail?: string
  grouped?: boolean
  icon: string
  label: string
  tone?: StatusPillTone
  value: string
}

export function StatusPill({ detail, grouped = false, icon, label, tone = 'neutral', value }: StatusPillProps) {
  const accessibilityProps = grouped
    ? { 'aria-label': [label, value, detail].filter(Boolean).join(' '), role: 'group' as const }
    : {}

  return (
    <span {...accessibilityProps} className={styles.pill} data-icon={icon} data-tone={tone}>
      <MaterialIcon name={icon} size={18} />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <strong className={styles.value}>{value}</strong>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
    </span>
  )
}
