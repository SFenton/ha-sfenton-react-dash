import { useCopy } from '../../i18n'
import styles from './FilterSheetFooter.module.css'

interface FilterSheetFooterProps {
  onApply: () => void
  onReset: () => void
}

export function FilterSheetFooter({ onApply, onReset }: FilterSheetFooterProps) {
  const copy = useCopy('core')
  return (
    <div className={styles.footer}>
      <button className={styles.resetAction} onClick={onReset} type="button">{copy('filter.reset')}</button>
      <button className={styles.primaryAction} onClick={onApply} type="button">{copy('filter.apply')}</button>
    </div>
  )
}
