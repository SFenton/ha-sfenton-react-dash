import type { ReactNode } from 'react'
import { AppHeader, type AppHeaderAction } from '../components/shell/AppHeader'
import styles from './Page.module.css'

interface PageProps {
  activePath?: string
  backPath?: string
  title: string
  headerQuickLinks?: ReactNode
  children: ReactNode
  onNavigate?: (path: string) => void
  onProfile?: () => void
  onSettings?: () => void
  scrollLocked?: boolean
}

export function Page({ activePath, backPath, title, headerQuickLinks, children, onNavigate, onProfile, onSettings, scrollLocked = false }: PageProps) {
  const actions: AppHeaderAction[] = [
    ...(onSettings ? [{ icon: 'mdi:cog', label: 'Settings', onClick: onSettings }] : []),
    ...(onProfile ? [{ icon: 'mdi:account-circle', label: 'Profile', onClick: onProfile }] : []),
  ]

  return (
    <main className={styles.page}>
      <div className={styles.headerDock}>
        <AppHeader activePath={activePath} actions={actions} backPath={backPath} onNavigate={onNavigate} title={title} />
        {headerQuickLinks && <div className={styles.headerQuickLinks}>{headerQuickLinks}</div>}
      </div>
      <div className={styles.scroller} data-scroll-lock={scrollLocked ? 'true' : undefined}>
        <div className={styles.scrollContent} data-scroll-lock={scrollLocked ? 'true' : undefined}>{children}</div>
      </div>
    </main>
  )
}
