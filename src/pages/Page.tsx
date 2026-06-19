import type { ReactNode } from 'react'
import { AppHeader, type AppHeaderAction } from '../components/shell/AppHeader'
import styles from './Page.module.css'

interface PageProps {
  activePath?: string
  backPath?: string
  chromeHidden?: boolean
  contentTransitionState?: 'entering' | 'idle' | 'pre-entering'
  title: string
  headerQuickLinks?: ReactNode
  children: ReactNode
  onNavigate?: (path: string) => void
  onProfile?: () => void
  onSettings?: () => void
  scrollLocked?: boolean
}

export function Page({ activePath, backPath, chromeHidden = false, contentTransitionState = 'idle', title, headerQuickLinks, children, onNavigate, onProfile, onSettings, scrollLocked = false }: PageProps) {
  const actions: AppHeaderAction[] = [
    ...(onSettings ? [{ icon: 'mdi:cog', label: 'Settings', onClick: onSettings }] : []),
    ...(onProfile ? [{ icon: 'mdi:account-circle', label: 'Profile', onClick: onProfile }] : []),
  ]

  return (
    <main className={styles.page} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-content-transition-state={contentTransitionState === 'idle' ? undefined : contentTransitionState}>
      {!chromeHidden && (
        <div className={styles.headerDock}>
          <AppHeader activePath={activePath} actions={actions} backPath={backPath} onNavigate={onNavigate} title={title} />
          {headerQuickLinks && <div className={styles.headerQuickLinks}>{headerQuickLinks}</div>}
        </div>
      )}
      <div className={styles.scroller} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-scroll-lock={scrollLocked ? 'true' : undefined}>
        <div className={styles.scrollContent} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-scroll-lock={scrollLocked ? 'true' : undefined}>{children}</div>
      </div>
    </main>
  )
}
