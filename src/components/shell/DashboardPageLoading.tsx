import { createPortal } from 'react-dom'
import { useCopy } from '../../i18n'
import styles from './DashboardPageLoading.module.css'

export type DashboardPageLoadingPhase = 'loading' | 'exiting'
export type DashboardPageLoadingPlacement = 'local' | 'viewport'

interface DashboardPageLoadingProps {
  className?: string
  label?: string
  placement?: DashboardPageLoadingPlacement
  phase: DashboardPageLoadingPhase
}

export function DashboardPageLoading({ className, label, placement = 'local', phase }: DashboardPageLoadingProps) {
  const copy = useCopy('shell')
  const classNames = [styles.region, className].filter(Boolean).join(' ')
  const resolvedLabel = label ?? copy('loading.dashboard')
  const loading = (
    <div aria-label={resolvedLabel} className={classNames} data-placement={placement} data-state={phase} role="status">
      <span className={styles.arc} />
    </div>
  )

  return placement === 'viewport' && typeof document !== 'undefined'
    ? createPortal(loading, document.body)
    : loading
}
