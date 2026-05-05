import styles from './Separator.module.css'

interface SeparatorProps {
  className?: string
  visible?: boolean
}

export function Separator({ className, visible = true }: SeparatorProps) {
  if (!visible) return null

  return <span aria-hidden="true" className={[styles.separator, className].filter(Boolean).join(' ')} />
}