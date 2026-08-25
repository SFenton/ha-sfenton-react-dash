import { useCallback, useRef, type ReactNode } from 'react'
import { AppHeader, type AppHeaderAction } from '../components/shell/AppHeader'
import type { PageMeasure } from '../constants/pageLayout'
import { PageScrollerContext, PageScrollToTopContext } from '../hooks/usePageScroller'
import { useCopy } from '../i18n'
import styles from './Page.module.css'

interface PageProps {
  activePath?: string
  backPath?: string
  chromeHidden?: boolean
  contentHidden?: boolean
  contentTransitionState?: 'entering' | 'idle' | 'pre-entering'
  title: string
  headerQuickLinks?: ReactNode
  children: ReactNode
  measure?: PageMeasure
  onBack?: (fallbackPath?: string) => void
  onNavigate?: (path: string) => void
  onProfile?: () => void
  onSettings?: () => void
  scrollLocked?: boolean
}

export function Page({ activePath, backPath, chromeHidden = false, contentHidden = false, contentTransitionState = 'idle', title, headerQuickLinks, children, measure = 'dashboard', onBack, onNavigate, onProfile, onSettings, scrollLocked = false }: PageProps) {
  const copy = useCopy('common')
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
    ...(onSettings ? [{ icon: 'mdi:cog', label: copy('actions.settings'), onClick: onSettings }] : []),
    ...(onProfile ? [{ icon: 'mdi:account-circle', label: copy('actions.profile'), onClick: onProfile }] : []),
  ]

  return (
    <PageScrollerContext.Provider value={scrollerRef}>
      <PageScrollToTopContext.Provider value={scrollToTop}>
        <main className={styles.page} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-content-transition-state={contentTransitionState === 'idle' ? undefined : contentTransitionState} data-page-measure={measure}>
        {!chromeHidden && (
          <div className={styles.headerDock} data-page-header="true">
            <div className={styles.headerContent}>
              <AppHeader activePath={activePath} actions={actions} backPath={backPath} onBack={onBack} onNavigate={onNavigate} title={title} />
              {headerQuickLinks && <div className={styles.headerQuickLinks}>{headerQuickLinks}</div>}
            </div>
          </div>
        )}
        <div className={styles.scroller} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-page-scroller="true" data-scroll-lock={scrollLocked ? 'true' : undefined} ref={scrollerRef}>
          <div aria-hidden={contentHidden ? true : undefined} className={styles.scrollContent} data-chrome-hidden={chromeHidden ? 'true' : undefined} data-page-content="true" data-scroll-lock={scrollLocked ? 'true' : undefined} inert={contentHidden ? true : undefined}>{children}</div>
        </div>
        </main>
      </PageScrollToTopContext.Provider>
    </PageScrollerContext.Provider>
  )
}
