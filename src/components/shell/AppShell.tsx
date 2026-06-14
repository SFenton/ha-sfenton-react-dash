import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  bottomNav: ReactNode
  floatingAction?: ReactNode
}

export function AppShell({ children, bottomNav, floatingAction }: AppShellProps) {
  const shellClassName = floatingAction ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell

  return (
    <div className={shellClassName}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
      {floatingAction && <div className={styles.floatingAction}>{floatingAction}</div>}
      {bottomNav}
    </div>
  )
}