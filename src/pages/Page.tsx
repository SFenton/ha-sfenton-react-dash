import { useCallback, useRef, type ReactNode } from 'react'
import { AppHeader, type AppHeaderAction } from '../components/shell/AppHeader'
import { PageScrollerContext, PageScrollToTopContext } from '../hooks/usePageScroller'
import styles from './Page.module.css'

interface PageProps {
  activePath?: string
  backPath?: string
  chromeHidden?: boolean
  contentTransitionState?: 'entering' | 'idle' | 'pre-entering'
  title: string
  headerQuickLinks?: ReactNode
  children: ReactNode
  onBack?: (fallbackPath?: string) => void
  onNavigate?: (path: string) => void
  onProfile?: () => void
  onSettings?: () => void
  scrollLocked?: boolean
}

export function Page({ activePath, backPath, chromeHidden = false, contentTransitionState = 'idle', title, headerQuickLinks, children, onBack, onNavigate, onProfile, onSettings, scrollLocked = false }: PageProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollToTop = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ behavior: 'auto', top: 0 })
      return
    }
    scroller.scrollTop = 0
  }, [])
  const actions: AppHeaderAction[] = [
    ...(onSettings ? [{ icon: 'mdi:cog', label: 'Settings', onClick: onSettings }] : []),
    ...(onProfile ? [{ icon: 'mdi:account-circle', label: 'Profile', onClick: onProfile }] : []),
  ]

  return (
    <PageScrollerContext.Provider value={scrollerRef}>
      <PageScrollToTopContext.Provider value={scrollToTop}>
        <main className={styles.page} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-content-transition-state={contentTransitionState === 'idle' ? undefined : contentTransitionState}>
        {!chromeHidden && (
          <div className={styles.headerDock}>
            <AppHeader activePath={activePath} actions={actions} backPath={backPath} onBack={onBack} onNavigate={onNavigate} title={title} />
            {headerQuickLinks && <div className={styles.headerQuickLinks}>{headerQuickLinks}</div>}
          </div>
        )}
        <div className={styles.scroller} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-scroll-lock={scrollLocked ? 'true' : undefined} ref={scrollerRef}>
          <div className={styles.scrollContent} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-scroll-lock={scrollLocked ? 'true' : undefined}>{children}</div>
        </div>
        </main>
      </PageScrollToTopContext.Provider>
    </PageScrollerContext.Provider>
  )
}
