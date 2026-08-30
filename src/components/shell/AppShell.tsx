import { useEffect, useRef, type FocusEvent, type ReactNode } from 'react'
import { DailyReportModal } from '../hass/DailyReportModal'
import { useAdaptiveNavigationLayout } from '../../hooks/useAdaptiveNavigationLayout'
import { useDashboardViewport } from '../../hooks/useDashboardViewport'
import type { NavigationLayout } from '../../constants/navigationLayout'
import type { PageMeasure } from '../../constants/pageLayout'
import { AdaptiveNavigation } from './AdaptiveNavigation'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'
import { NavigationLayoutContext } from './NavigationLayoutContext'
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
  const navigationLayout = useAdaptiveNavigationLayout()
  const focusedNavigationRef = useRef<NavigationLayout | null>(null)
  const previousNavigationLayoutRef = useRef(navigationLayout)

  const shellClassName = !chromeHidden ? `${styles.shell} ${styles.hasFloatingAction}` : styles.shell
  const trackNavigationFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target
    focusedNavigationRef.current = target.closest('[data-adaptive-navigation="rail"]')
      ? 'rail'
      : target.closest('[data-adaptive-navigation="bottom"]')
        ? 'bottom'
        : target.closest('[aria-controls="dashboard-navigation-drawer"]')
          ? navigationLayout
          : null
  }

  useEffect(() => {
    const previousLayout = previousNavigationLayoutRef.current
    previousNavigationLayoutRef.current = navigationLayout
    if (previousLayout === navigationLayout || focusedNavigationRef.current !== previousLayout) return

    const selector = navigationLayout === 'rail'
      ? '[data-adaptive-navigation="rail"] button[aria-current="page"]'
      : navigationLayout === 'bottom'
        ? '[data-adaptive-navigation="bottom"] button[aria-current="page"]'
        : 'button[aria-label="Open navigation menu"]'
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true }))
  }, [navigationLayout])

  return (
    <NavigationLayoutContext.Provider value={navigationLayout}>
      <div className={shellClassName} data-app-shell="true" data-navigation-layout={navigationLayout} data-page-measure={pageMeasure} onFocusCapture={trackNavigationFocus}>
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
    </NavigationLayoutContext.Provider>
  )
}
