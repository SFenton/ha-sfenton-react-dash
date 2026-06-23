import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import styles from './CheckboxRow.module.css'

interface CheckboxRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  active: boolean
  subtitle?: ReactNode
  title: ReactNode
}

function hasSubtitle(subtitle: ReactNode) {
  if (typeof subtitle === 'string') return subtitle.trim().length > 0
  return subtitle !== undefined && subtitle !== null && subtitle !== false
}

export function CheckboxRow({ active, className, subtitle, title, type = 'button', ...buttonProps }: CheckboxRowProps) {
  return (
    <button
      {...buttonProps}
      aria-pressed={active}
      className={[styles.checkboxRow, className].filter(Boolean).join(' ')}
      type={type}
    >
      <MaterialIcon name={active ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'} size={34} />
      <span className={styles.copy}>
        <strong>{title}</strong>
        {hasSubtitle(subtitle) && <small>{subtitle}</small>}
      </span>
    </button>
  )
}
