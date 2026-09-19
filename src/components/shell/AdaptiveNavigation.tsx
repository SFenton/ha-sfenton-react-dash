import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { SHELL_COPY_KEYS, useCopy } from '../../i18n'
import { CountBadge } from '../core/CountBadge'
import { MaterialIcon } from '../core/Icon'
import { useDailyReportContext } from '../hass/dailyReportModal'
import { SHELL_COPY_NAMESPACE, SHELL_NAVIGATION_HEADING_COPY_KEY, SHELL_NAVIGATION_MENU_COPY_KEY } from './AppHeader'
import { BADGED_NAV_PATH, DASHBOARD_SECTIONS_COPY_KEY, OVERDUE_TAB_COPY_KEY } from './BottomNav'
import { useNavigationLayout } from './NavigationLayoutContext'
import styles from './AdaptiveNavigation.module.css'

interface AdaptiveNavigationProps {
  activePath: string
  duoRouteCount?: DuoNavigationRouteCount
  onDuoExpand?: () => void
  onNavigate: (path: string) => void
}

export type DuoNavigationRouteCount = 1 | 2 | 3 | 5

export function AdaptiveNavigation({ activePath, duoRouteCount = 5, onDuoExpand, onNavigate }: AdaptiveNavigationProps) {
  const copy = useCopy(SHELL_COPY_NAMESPACE)
  const { overdueCount } = useDailyReportContext()
  const navigationLayout = useNavigationLayout()
  const isDuo = navigationLayout === 'duo'
  const isCondensedDuo = isDuo && duoRouteCount < 5
  const navigationVisible = navigationLayout === 'rail' || isDuo
  const primaryRoutes = PRIMARY_NAV_ROUTES.filter((route) => route.path !== 'settings')
  const homeRoute = PRIMARY_NAV_ROUTES.find((route) => route.path === 'overview')
  const settingsRoute = PRIMARY_NAV_ROUTES.find((route) => route.path === 'settings')
  const activeCondensedRoute = primaryRoutes.find((route) =>
    route.path !== 'overview' && primaryNavRouteActive(activePath, route.path))
  const fallbackCondensedRoute = primaryRoutes.find((route) => route.path !== 'overview')
  const condensedRoutes = duoRouteCount === 1
    ? [homeRoute]
    : duoRouteCount === 2
      ? [homeRoute, settingsRoute]
      : [homeRoute, activeCondensedRoute ?? fallbackCondensedRoute, settingsRoute]

  const renderRoute = (route: typeof PRIMARY_NAV_ROUTES[number], settings = false) => {
    const current = primaryNavRouteActive(activePath, route.path)
    const badgeCount = route.path === BADGED_NAV_PATH ? overdueCount : 0

    return (
      <button
        aria-current={current ? 'page' : undefined}
        aria-label={badgeCount > 0 ? copy(OVERDUE_TAB_COPY_KEY, { count: badgeCount, label: route.label }) : route.label}
        className={[styles.item, settings ? styles.settingsItem : ''].filter(Boolean).join(' ')}
        data-action-kind="navigate"
        data-navigation-opener="true"
        data-navigation-path={route.path}
        key={route.path}
        onClick={() => onNavigate(route.path)}
        type="button"
      >
        <span className={styles.icon}>
          <MaterialIcon name={route.icon} size={24} />
        </span>
        <span className={styles.label} data-navigation-label="true">{route.label}</span>
        <CountBadge className={styles.badge} count={badgeCount} />
      </button>
    )
  }

  return (
    <aside
      aria-label={copy(SHELL_NAVIGATION_MENU_COPY_KEY)}
      className={`${styles.rail} ${isDuo ? styles.duo : ''}`}
      data-adaptive-navigation={isDuo ? 'duo' : 'rail'}
      data-duo-route-count={duoRouteCount}
      data-navigation-display={navigationLayout}
      hidden={!navigationVisible}
    >
      <div className={styles.heading}>{copy(SHELL_NAVIGATION_HEADING_COPY_KEY)}</div>
      <nav aria-label={copy(DASHBOARD_SECTIONS_COPY_KEY)} className={styles.navigation}>
        {isCondensedDuo ? (
          <>
            {condensedRoutes.map((route) => route && renderRoute(route, route === settingsRoute))}
            <button
              aria-expanded={false}
              aria-label={copy(SHELL_COPY_KEYS.navigation.expandDuo)}
              className={`${styles.item} ${styles.expandItem}`}
              data-action-kind="toggle"
              data-duo-expand="true"
              onClick={onDuoExpand}
              type="button"
            >
              <span className={styles.icon}>
                <MaterialIcon name="mdi:chevron-up" size={26} />
              </span>
            </button>
          </>
        ) : (
          <>
            <div className={styles.primary}>{primaryRoutes.map((route) => renderRoute(route))}</div>
            {settingsRoute && renderRoute(settingsRoute, true)}
          </>
        )}
      </nav>
    </aside>
  )
}
