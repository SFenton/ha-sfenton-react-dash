import styles from './DashboardPageLoading.module.css'

export type DashboardPageLoadingPhase = 'loading' | 'exiting'

interface DashboardPageLoadingProps {
  className?: string
  label?: string
  phase: DashboardPageLoadingPhase
}

export function DashboardPageLoading({ className, label = 'Loading dashboard', phase }: DashboardPageLoadingProps) {
  const classNames = [styles.region, className].filter(Boolean).join(' ')

  return (
    <div aria-label={label} className={classNames} data-state={phase} role="status">
      <span className={styles.arc} />
    </div>
  )
}
