import styles from './DashboardPageLoading.module.css'

export type DashboardPageLoadingPhase = 'loading' | 'exiting'

interface DashboardPageLoadingProps {
  label?: string
  phase: DashboardPageLoadingPhase
}

export function DashboardPageLoading({ label = 'Loading dashboard', phase }: DashboardPageLoadingProps) {
  return (
    <div aria-label={label} className={styles.region} data-state={phase} role="status">
      <span className={styles.arc} />
    </div>
  )
}
