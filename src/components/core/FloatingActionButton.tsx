import type { CSSProperties } from 'react'
import { MaterialIcon } from './Icon'
import styles from './FloatingActionButton.module.css'

interface FloatingActionButtonProps {
  ariaLabel: string
  color: { r: number; g: number; b: number }
  icon: string
  onClick: () => void
}

type FloatingActionButtonStyle = CSSProperties & {
  '--card-rgb': string
}

export function FloatingActionButton({ ariaLabel, color, icon, onClick }: FloatingActionButtonProps) {
  const style: FloatingActionButtonStyle = {
    '--card-rgb': `${color.r} ${color.g} ${color.b}`,
  }

  return (
    <button aria-label={ariaLabel} className={styles.button} onClick={onClick} style={style} type="button">
      <MaterialIcon name={icon} size={32} />
    </button>
  )
}