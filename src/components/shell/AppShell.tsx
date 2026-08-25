import type { ReactNode } from 'react'
import { DailyReportModal } from '../hass/DailyReportModal'
import { useDashboardViewport } from '../../hooks/useDashboardViewport'
import type { PageMeasure } from '../../constants/pageLayout'
import { AdaptiveNavigation } from './AdaptiveNavigation'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'
import styles from './AppShell.module.css'

interface AppShellProps {
  activePath?: string
  children: ReactNode
  bottomNav: ReactNode
  chromeHidden?: boolean
  floatingAction?: ReactNode
  onNavigate: (path: string) => void
  pageMeasure?: PageMeasure
}

export function AppShell({ activePath = 'overview', children, bottomNav, chromeHidden = false, floatingAction, onNavigate, pageMeasure = 'dashboard' }: AppShellProps) {
  useDashboardViewport()

  const shellClassName = !chromeHidden ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell

  return (
    <div className={shellClassName} data-app-shell="true" data-page-measure={pageMeasure}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      {!chromeHidden && <AdaptiveNavigation activePath={activePath} onNavigate={onNavigate} />}
      <div className={styles.content}>{children}</div>
      {!chromeHidden && (
        <div className={styles.floatingAction} data-floating-action-dock="true">
          {floatingAction}
          <GlobalQuickLinksAction onNavigate={onNavigate} />
        </div>
      )}
      {!chromeHidden && bottomNav}
      <DailyReportModal />
    </div>
  )
}