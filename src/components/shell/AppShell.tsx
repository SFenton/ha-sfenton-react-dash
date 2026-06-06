import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  bottomNav: ReactNode
  floatingAction?: ReactNode
}

export function AppShell({ children, bottomNav, floatingAction }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
      {floatingAction && <div className={styles.floatingAction}>{floatingAction}</div>}
      {bottomNav}
    </div>
  )
}