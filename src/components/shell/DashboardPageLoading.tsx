import { useCopy } from '../../i18n'
import styles from './DashboardPageLoading.module.css'

export type DashboardPageLoadingPhase = 'loading' | 'exiting'

interface DashboardPageLoadingProps {
  className?: string
  label?: string
  phase: DashboardPageLoadingPhase
}

export function DashboardPageLoading({ className, label, phase }: DashboardPageLoadingProps) {
  const copy = useCopy('shell')
  const classNames = [styles.region, className].filter(Boolean).join(' ')
  const resolvedLabel = label ?? copy('loading.dashboard')

  return (
    <div aria-label={resolvedLabel} className={classNames} data-state={phase} role="status">
      <span className={styles.arc} />
    </div>
  )
}
