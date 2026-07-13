import { MaterialIcon } from './Icon'
import styles from './ModalDisclosureIcon.module.css'

interface ModalDisclosureIconProps {
  className?: string
  size?: 'compact' | 'standard'
}

export function ModalDisclosureIcon({ className, size = 'standard' }: ModalDisclosureIconProps) {
  const classes = [styles.icon, size === 'compact' ? styles.compact : '', className ?? ''].filter(Boolean).join(' ')

  return (
    <span aria-hidden="true" className={classes} data-modal-disclosure="right-chevron">
      <MaterialIcon name="mdi:chevron-right" size={size === 'compact' ? 18 : 24} />
    </span>
  )
}
