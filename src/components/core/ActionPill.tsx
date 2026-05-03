import type { ReactNode } from 'react'
import styles from './ActionPill.module.css'

interface ActionPillProps {
  label: string
  active?: boolean
  danger?: boolean
  pulse?: boolean
  onClick: () => void
  children: ReactNode
}

export function ActionPill({ label, active = false, danger = false, pulse = false, onClick, children }: ActionPillProps) {
  return (
    <button
      aria-label={label}
      className={styles.button}
      data-active={active ? 'true' : 'false'}
      data-danger={danger ? 'true' : 'false'}
      data-pulse={pulse ? 'true' : 'false'}
      onClick={onClick}
      type="button"
    >
      <span className={styles.icon}>{children}</span>
      <span className={styles.label}>{label}</span>
    </button>
  )
}