import { MaterialIcon } from './Icon'
import { ModalDisclosureIcon } from './ModalDisclosureIcon'
import type { ControlSemantics } from './controlSemantics'
import styles from './SurfaceAccessory.module.css'

export function SurfaceAccessory({ className, semantics, size = 'standard' }: { className?: string; semantics: ControlSemantics; size?: 'compact' | 'standard' }) {
  const classes = [styles.accessory, className].filter(Boolean).join(' ')

  if (semantics.kind === 'modal' || semantics.kind === 'navigate') {
    return <ModalDisclosureIcon className={className} size={size} />
  }

  if (semantics.kind === 'external') {
    return (
      <span aria-hidden="true" className={classes} data-surface-accessory="external">
        <MaterialIcon name="mdi:open-in-new" size={size === 'compact' ? 18 : 22} />
      </span>
    )
  }

  if (semantics.kind === 'selection' && semantics.selected) {
    return (
      <span aria-hidden="true" className={classes} data-surface-accessory="selection">
        <MaterialIcon name="mdi:check" size={size === 'compact' ? 18 : 22} />
      </span>
    )
  }

  if (semantics.kind === 'value' || (semantics.kind === 'state' && semantics.text)) {
    return <span className={[styles.text, className].filter(Boolean).join(' ')} data-surface-accessory={semantics.kind}>{semantics.text}</span>
  }

  return null
}
