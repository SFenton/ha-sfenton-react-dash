import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DASHBOARD_LOADING_EXIT_MS, DASHBOARD_MIN_LOADING_MS, DASHBOARD_PAGE_LOAD_TIMEOUT_MS } from '../../constants/loading'
import { DashboardPageLoading } from './DashboardPageLoading'
import styles from './DashboardPageLoadGate.module.css'

interface DashboardPageLoadGateProps {
  children: ReactNode
  contentClassName?: string
  label: string
  preload?: boolean
  settled: boolean
}

export function DashboardPageLoadGate({
  children,
  contentClassName,
  label,
  preload = false,
  settled,
}: DashboardPageLoadGateProps) {
  const loadingStartedAtRef = useRef<number | null>(null)
  const [phase, setPhase] = useState<'content' | 'exiting' | 'loading'>(
    preload ? 'content' : 'loading',
  )

  useEffect(() => {
    if (preload || phase === 'content') return undefined
    const loadingStartedAt = loadingStartedAtRef.current ?? Date.now()
    loadingStartedAtRef.current = loadingStartedAt
    const elapsed = Date.now() - loadingStartedAt
    const exitDelay = Math.max(
      0,
      (settled ? DASHBOARD_MIN_LOADING_MS : DASHBOARD_PAGE_LOAD_TIMEOUT_MS) - elapsed,
    )
    const exitTimer = window.setTimeout(() => setPhase('exiting'), exitDelay)
    const contentTimer = window.setTimeout(
      () => setPhase('content'),
      exitDelay + DASHBOARD_LOADING_EXIT_MS,
    )
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(contentTimer)
    }
  }, [phase, preload, settled])

  return (
    <div className={styles.gate} data-page-load-phase={phase}>
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(' ')}
        data-content-visible={phase === 'content' ? 'true' : 'false'}
      >
        {children}
      </div>
      {phase !== 'content' && (
        <DashboardPageLoading
          className={styles.loading}
          label={label}
          placement="viewport"
          phase={phase === 'exiting' ? 'exiting' : 'loading'}
        />
      )}
    </div>
  )
}
