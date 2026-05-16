import { useRef, type ReactNode } from 'react'
import { MaterialIcon } from '../components/core/Icon'
import { useScrollFade, type ScrollFadeOptions } from '../hooks/useScrollFade'
import styles from './Page.module.css'

interface PageProps {
  title: string
  headerQuickLinks?: ReactNode
  children: ReactNode
  onProfile?: () => void
  onSettings?: () => void
  scrollFadeOptions?: ScrollFadeOptions
}

export function Page({ title, headerQuickLinks, children, onProfile, onSettings, scrollFadeOptions }: PageProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  useScrollFade(scrollerRef, scrollContentRef, [children], scrollFadeOptions)

  return (
    <main className={styles.page}>
      <div className={styles.headerDock}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.actions} aria-label="Page actions">
            <button className={styles.iconButton} onClick={onSettings} type="button" aria-label="Settings">
              <MaterialIcon name="mdi:cog" size={21} />
            </button>
            <button className={styles.iconButton} onClick={onProfile} type="button" aria-label="Profile">
              <MaterialIcon name="mdi:account-circle" size={21} />
            </button>
          </div>
        </header>
        {headerQuickLinks && <div className={styles.headerQuickLinks}>{headerQuickLinks}</div>}
      </div>
      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.scrollContent} ref={scrollContentRef}>{children}</div>
      </div>
    </main>
  )
}