import styles from './Separator.module.css'

interface SeparatorProps {
  className?: string
}

export function Separator({ className }: SeparatorProps) {
  return <span aria-hidden="true" className={[styles.separator, className].filter(Boolean).join(' ')} />
}