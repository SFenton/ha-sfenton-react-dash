import styles from './FilterSheetFooter.module.css'

interface FilterSheetFooterProps {
  onApply: () => void
  onReset: () => void
}

export function FilterSheetFooter({ onApply, onReset }: FilterSheetFooterProps) {
  return (
    <div className={styles.footer}>
      <button className={styles.resetAction} onClick={onReset} type="button">Reset</button>
      <button className={styles.primaryAction} onClick={onApply} type="button">Apply</button>
    </div>
  )
}
