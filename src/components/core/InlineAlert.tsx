import type { ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import styles from './InlineAlert.module.css'

interface InlineAlertProps {
  children: ReactNode
  className?: string
  icon?: string
}

export function InlineAlert({ children, className, icon = 'mdi:alert-circle' }: InlineAlertProps) {
  return (
    <div className={[styles.inlineAlert, className].filter(Boolean).join(' ')} role="alert">
      <MaterialIcon name={icon} size={20} />
      <span>{children}</span>
    </div>
  )
}
