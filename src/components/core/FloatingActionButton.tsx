import type { CSSProperties } from 'react'
import { MaterialIcon } from './Icon'
import styles from './FloatingActionButton.module.css'

type FloatingActionButtonProps = {
  color: { r: number; g: number; b: number }
  icon: string
  onClick: () => void
} & ({ ariaLabel: string; label?: never } | { ariaLabel?: string; label: string })

type FloatingActionButtonStyle = CSSProperties & {
  '--card-rgb': string
}

export function FloatingActionButton({ ariaLabel, color, icon, label, onClick }: FloatingActionButtonProps) {
  const style: FloatingActionButtonStyle = {
    '--card-rgb': `${color.r} ${color.g} ${color.b}`,
  }
  const className = label ? `${styles.button} ${styles.pill}` : styles.button

  return (
    <button aria-label={ariaLabel} className={className} onClick={onClick} style={style} type="button">
      <MaterialIcon name={icon} size={32} />
      {label && <span className={styles.label}>{label}</span>}
    </button>
  )
}
