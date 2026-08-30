import { useState } from 'react'
import { flushSync } from 'react-dom'
import { CountBadge } from '../core/CountBadge'
import { MaterialIcon } from '../core/Icon'
import { useDailyReportContext } from '../hass/dailyReportModal'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { useCopy } from '../../i18n'
import { useNavigationLayout } from './NavigationLayoutContext'
import styles from './BottomNav.module.css'

/** Only Chores badges, and only with overdue chores - expired food belongs to the summary, not here. */
export const BADGED_NAV_PATH = 'chores'
export const DASHBOARD_SECTIONS_COPY_KEY = 'navigation.dashboardSections'
export const OVERDUE_TAB_COPY_KEY = 'tabs.overdue'

interface BottomNavProps {
  activePath: string
  onNavigate: (path: string) => void
}

export function BottomNav({ activePath, onNavigate }: BottomNavProps) {
  const { overdueCount } = useDailyReportContext()
  const copy = useCopy('shell')
  const navigationLayout = useNavigationLayout()
  const [visualOverride, setVisualOverride] = useState<{ activePath: string, path: string } | undefined>()
  const visualActivePath = visualOverride?.activePath === activePath ? visualOverride.path : activePath
  const setVisualPathNow = (path: string) => {
    flushSync(() => setVisualOverride({ activePath, path }))
  }

  return (
    <nav className={styles.nav} aria-label={copy(DASHBOARD_SECTIONS_COPY_KEY)} data-adaptive-navigation="bottom" hidden={navigationLayout !== 'bottom'}>
      {PRIMARY_NAV_ROUTES.map((tab) => {
        const isCurrent = primaryNavRouteActive(activePath, tab.path)
        const isActive = primaryNavRouteActive(visualActivePath, tab.path)
        const badgeCount = tab.path === BADGED_NAV_PATH ? overdueCount : 0
        return (
          <button
            key={tab.label}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            data-active={isActive}
            onBlur={() => setVisualOverride(undefined)}
            onClick={() => {
              setVisualPathNow(tab.path)
              onNavigate(tab.path)
            }}
            onPointerCancel={() => setVisualOverride(undefined)}
            onPointerDown={() => setVisualPathNow(tab.path)}
            type="button"
            aria-label={badgeCount > 0 ? copy(OVERDUE_TAB_COPY_KEY, { count: badgeCount, label: tab.label }) : tab.label}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <span className={styles.tabIcon}>
              <MaterialIcon name={tab.icon} size={23} />
              <CountBadge className={styles.tabBadge} count={badgeCount} />
            </span>
          </button>
        )
      })}
    </nav>
  )
}