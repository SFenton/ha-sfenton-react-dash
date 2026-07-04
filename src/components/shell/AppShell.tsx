import type { ReactNode } from 'react'
import { useDashboardViewport } from '../../hooks/useDashboardViewport'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  bottomNav: ReactNode
  chromeHidden?: boolean
  floatingAction?: ReactNode
}

export function AppShell({ children, bottomNav, chromeHidden = false, floatingAction }: AppShellProps) {
  useDashboardViewport()

  const shellClassName = floatingAction && !chromeHidden ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell

  return (
    <div className={shellClassName}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
      {!chromeHidden && floatingAction && <div className={styles.floatingAction} data-floating-action-dock="true">{floatingAction}</div>}
      {!chromeHidden && bottomNav}
    </div>
  )
}