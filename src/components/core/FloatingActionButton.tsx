import type { CSSProperties } from 'react'
import { MaterialIcon } from './Icon'
import type { ControlSemantics } from './controlSemantics'
import styles from './FloatingActionButton.module.css'

type FloatingActionButtonProps = {
  ariaExpanded?: boolean
  ariaHasPopup?: 'dialog'
  className?: string
  color: { r: number; g: number; b: number }
  icon: string
  onClick: () => void
  semantics?: ControlSemantics
  title?: string
} & ({ ariaLabel: string; label?: never } | { ariaLabel?: string; label: string })

type FloatingActionButtonStyle = CSSProperties & {
  '--card-rgb': string
}

export function FloatingActionButton({ ariaExpanded, ariaHasPopup, ariaLabel, className, color, icon, label, onClick, semantics, title }: FloatingActionButtonProps) {
  const style: FloatingActionButtonStyle = {
    '--card-rgb': `${color.r} ${color.g} ${color.b}`,
  }
  const resolvedClassName = [styles.button, label ? styles.pill : '', className].filter(Boolean).join(' ')

  return (
    <button
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-label={ariaLabel ?? label}
      className={resolvedClassName}
      data-action-kind={semantics?.kind}
      data-floating-action-button="true"
      data-modal-opener-exception={semantics?.kind === 'modal' ? 'floating-action' : undefined}
      onClick={onClick}
      style={style}
      title={title}
      type="button"
    >
      <MaterialIcon name={icon} size={32} />
      {label && <span className={styles.label} data-floating-action-label="true">{label}</span>}
    </button>
  )
}
