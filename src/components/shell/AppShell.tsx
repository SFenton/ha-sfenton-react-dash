import type { ReactNode } from 'react'
import { DailyReportModal } from '../hass/DailyReportModal'
import { useDashboardViewport } from '../../hooks/useDashboardViewport'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  bottomNav: ReactNode
  chromeHidden?: boolean
  floatingAction?: ReactNode
  onNavigate: (path: string) => void
}

export function AppShell({ children, bottomNav, chromeHidden = false, floatingAction, onNavigate }: AppShellProps) {
  useDashboardViewport()

  const shellClassName = !chromeHidden ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell

  return (
    <div className={shellClassName} data-app-shell="true">
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
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