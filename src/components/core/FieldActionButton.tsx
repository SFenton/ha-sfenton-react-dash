import type { ButtonHTMLAttributes } from 'react'
import styles from './FieldActionButton.module.css'

interface FieldActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  className?: string
  label: string
  tone?: 'danger' | 'default'
  variant?: 'default' | 'primary'
}

export function FieldActionButton({ className, label, tone = 'default', type = 'button', variant = 'default', ...buttonProps }: FieldActionButtonProps) {
  return (
    <button
      {...buttonProps}
      className={[styles.button, className].filter(Boolean).join(' ')}
      data-action-kind="command"
      data-tone={tone}
      data-variant={variant}
      type={type}
    >
      {label}
    </button>
  )
}
