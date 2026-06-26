import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import styles from './RadioRow.module.css'

interface RadioRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  active: boolean
  subtitle?: ReactNode
  title: ReactNode
}

function hasSubtitle(subtitle: ReactNode) {
  if (typeof subtitle === 'string') return subtitle.trim().length > 0
  return subtitle !== undefined && subtitle !== null && subtitle !== false
}

export function RadioRow({ active, className, subtitle, title, type = 'button', ...buttonProps }: RadioRowProps) {
  return (
    <button
      {...buttonProps}
      aria-checked={active}
      className={[styles.radioRow, className].filter(Boolean).join(' ')}
      role="radio"
      type={type}
    >
      <MaterialIcon name={active ? 'mdi:record-circle-outline' : 'mdi:checkbox-blank-circle-outline'} size={30} />
      <span className={styles.copy}>
        <strong>{title}</strong>
        {hasSubtitle(subtitle) && <small>{subtitle}</small>}
      </span>
    </button>
  )
}
