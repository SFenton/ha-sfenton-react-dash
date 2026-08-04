import { MaterialIcon } from './Icon'
import styles from './ModalActionFooter.module.css'

export interface ModalFooterAction {
  disabled?: boolean
  form?: string
  icon: string
  label: string
  onClick?: () => void
  type?: 'button' | 'submit'
}

export type ModalActionTone = 'destructive' | 'neutral' | 'primary' | 'warning'

interface ModalActionFooterProps {
  destructive?: ModalFooterAction
  primary: ModalFooterAction
}

export function ModalActionButton({ action, tone = 'primary' }: { action: ModalFooterAction; tone?: ModalActionTone }) {
  return (
    <button
      className={styles.action}
      data-icon={action.icon}
      data-modal-action-button="true"
      data-tone={tone}
      disabled={action.disabled}
      form={action.form}
      onClick={action.onClick}
      type={action.type ?? 'button'}
    >
      <MaterialIcon name={action.icon} size={20} />
      <span>{action.label}</span>
    </button>
  )
}

export function ModalActionFooter({ destructive, primary }: ModalActionFooterProps) {
  if (!destructive) return <ModalActionButton action={primary} />

  return (
    <div className={styles.sheetFooter}>
      <ModalActionButton action={destructive} tone="destructive" />
      <ModalActionButton action={primary} />
    </div>
  )
}
