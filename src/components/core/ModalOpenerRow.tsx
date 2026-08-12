import type { ReactNode } from 'react'
import { SurfaceAccessory } from './SurfaceAccessory'
import styles from './ModalOpenerRow.module.css'

interface ModalOpenerRowProps {
  ariaLabel?: string
  disabled?: boolean
  icon?: ReactNode
  onClick: () => void
  subtitle?: string
  title: string
  tone?: 'glass' | 'switch-active'
  variant?: 'compact' | 'wide'
}

export function ModalOpenerRow({
  ariaLabel,
  disabled = false,
  icon,
  onClick,
  subtitle,
  title,
  tone = 'glass',
  variant = 'compact',
}: ModalOpenerRowProps) {
  return (
    <button
      aria-label={ariaLabel ?? (subtitle ? `${title} ${subtitle}` : title)}
      className={styles.row}
      data-disabled={disabled ? 'true' : undefined}
      data-has-icon={icon ? 'true' : 'false'}
      data-modal-opener="true"
      data-tone={tone}
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon && <span aria-hidden="true" className={styles.icon}>{icon}</span>}
      <span className={styles.copy} data-dynamic-grid-label-container="true">
        <strong data-dynamic-grid-label="true">{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
      <SurfaceAccessory semantics={{ kind: 'modal' }} size={variant === 'compact' ? 'compact' : 'standard'} />
    </button>
  )
}
