import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDailyReportContext } from '../hass/dailyReportModal'
import { DAILY_REPORT_HASH, PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { dispatchDashboardRouteChange, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { IconSize } from '../../constants/theme'
import { CountBadge } from '../core/CountBadge'
import { MaterialIcon } from '../core/Icon'
import { useCopy } from '../../i18n'
import { BADGED_NAV_PATH, OVERDUE_TAB_COPY_KEY } from './BottomNav'
import { useNavigationLayout } from './NavigationLayoutContext'
import styles from './AppHeader.module.css'

export interface AppHeaderAction {
  icon: string
  label: string
  onClick: () => void
}

interface AppHeaderProps {
  activePath?: string
  actions?: AppHeaderAction[]
  backLabel?: string
  backPath?: string
  onBack?: (fallbackPath?: string) => void
  onNavigate?: (path: string) => void
  title: ReactNode
}

type SidebarState = 'closed' | 'closing' | 'open'

export const SHELL_COPY_NAMESPACE = 'shell'
export const SHELL_NAVIGATION_HEADING_COPY_KEY = 'navigation.heading'
export const SHELL_NAVIGATION_MENU_COPY_KEY = 'navigation.menu'

function BackChevron() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height={IconSize.back} viewBox="0 0 24 24" width={IconSize.back}>
      <path d="M15.75 4.5 8.25 12l7.5 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height={IconSize.nav} viewBox="0 0 24 24" width={IconSize.nav}>
      <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  )
}

export function AppHeader({ activePath, actions = [], backLabel, backPath, onBack, onNavigate, title }: AppHeaderProps) {
  const [sidebarState, setSidebarState] = useState<SidebarState>('closed')
  const [actionsOpen, setActionsOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const restoreFocusAfterCloseRef = useRef(false)
  const previousActivePathRef = useRef(activePath)
  const commonCopy = useCopy('common')
  const shellCopy = useCopy(SHELL_COPY_NAMESPACE)
  const { badgeCount, overdueCount, title: profileTitle } = useDailyReportContext()
  const navigationLayout = useNavigationLayout()
  const previousNavigationLayoutRef = useRef(navigationLayout)
  const profileLabel = badgeCount > 0
    ? shellCopy('profile.openWithAttention', { count: badgeCount, title: profileTitle })
    : shellCopy('profile.open', { title: profileTitle })
  const resolvedBackLabel = backLabel ?? commonCopy('actions.goBack')
  const showBack = Boolean(backPath)
  const showMenu = Boolean(!showBack && onNavigate && navigationLayout !== 'rail')
  const showBackMenu = Boolean(showBack && onNavigate && navigationLayout === 'drawer-only')
  const backMenuClassName = [styles.menuButton, styles.backMenuButton].join(' ')
  const showActions = actions.length > 0
  const menuOpen = sidebarState === 'open'
  const sidebarMounted = sidebarState !== 'closed'
  const sidebarDataState = sidebarState === 'closing' ? 'closed' : 'open'

  useEffect(() => {
    const previousNavigationLayout = previousNavigationLayoutRef.current
    previousNavigationLayoutRef.current = navigationLayout
    if (navigationLayout !== 'rail' || previousNavigationLayout === 'rail') return undefined
    const drawerWasMounted = sidebarState !== 'closed'
    queueMicrotask(() => {
      restoreFocusAfterCloseRef.current = false
      setSidebarState('closed')
      setActionsOpen(false)
      if (!drawerWasMounted) return
      queueMicrotask(() => {
        document.querySelector<HTMLButtonElement>('[data-adaptive-navigation="rail"] button[aria-current="page"]')?.focus({ preventScroll: true })
      })
    })
  }, [navigationLayout, sidebarState])

  const closeSidebar = useCallback((restoreFocus = false) => {
    if (restoreFocus) restoreFocusAfterCloseRef.current = true
    setSidebarState((current) => (current === 'open' ? 'closing' : current))
  }, [])

  const closeMenus = useCallback((restoreFocus = false) => {
    closeSidebar(restoreFocus)
    setActionsOpen(false)
  }, [closeSidebar])

  const toggleSidebar = () => {
    setActionsOpen(false)
    setSidebarState((current) => {
      if (current === 'open') {
        restoreFocusAfterCloseRef.current = true
        return 'closing'
      }
      restoreFocusAfterCloseRef.current = false
      return 'open'
    })
  }
  const renderMenuButton = (className = styles.menuButton) => (
    <button aria-controls="dashboard-navigation-drawer" aria-expanded={menuOpen} aria-label={shellCopy('navigation.openMenu')} className={className} onClick={toggleSidebar} ref={menuButtonRef} type="button">
      <MenuIcon />
    </button>
  )

  const navigate = (path: string) => {
    closeMenus(false)
    onNavigate?.(path)
  }

  const goBack = () => {
    closeMenus(false)
    if (onBack) {
      onBack(backPath)
      return
    }
    if (backPath && onNavigate) {
      onNavigate(backPath)
      return
    }
    window.history.back()
  }

  const openProfile = () => {
    closeMenus(false)
    pushDashboardUrl(DAILY_REPORT_HASH)
    dispatchDashboardRouteChange()
  }

  useEffect(() => {
    if (sidebarState !== 'open' || navigationLayout === 'rail') return
    const target = sidebarRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')
      ?? sidebarRef.current?.querySelector<HTMLButtonElement>('button')
    target?.focus({ preventScroll: true })
  }, [navigationLayout, sidebarState])

  useEffect(() => {
    if (!sidebarMounted) return undefined
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenus(true)
        return
      }
      if (event.key !== 'Tab' || sidebarState !== 'open') return

      const items = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items.at(-1)!
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === firstItem || !sidebarRef.current?.contains(activeElement))) {
        event.preventDefault()
        lastItem.focus({ preventScroll: true })
      } else if (!event.shiftKey && activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', handleDrawerKeyDown)
    return () => document.removeEventListener('keydown', handleDrawerKeyDown)
  }, [closeMenus, sidebarMounted, sidebarState])

  useEffect(() => {
    if (previousActivePathRef.current !== activePath) {
      previousActivePathRef.current = activePath
      closeMenus(false)
    }
  }, [activePath, closeMenus])

  const finishSidebarClose = () => {
    setSidebarState((current) => (current === 'closing' ? 'closed' : current))
    if (restoreFocusAfterCloseRef.current) {
      restoreFocusAfterCloseRef.current = false
      menuButtonRef.current?.focus({ preventScroll: true })
    }
  }

  const sidebar = sidebarMounted && navigationLayout !== 'rail' ? (
    <div
      className={styles.sidebarScrim}
      data-state={sidebarDataState}
      onAnimationEnd={finishSidebarClose}
      onClick={() => closeMenus(true)}
    >
      <aside aria-label={shellCopy(SHELL_NAVIGATION_MENU_COPY_KEY)} className={styles.sidebar} data-adaptive-navigation="drawer" data-state={sidebarDataState} id="dashboard-navigation-drawer" onClick={(event) => event.stopPropagation()} ref={sidebarRef}>
        <div className={styles.sidebarHeader}>
          <span>{shellCopy(SHELL_NAVIGATION_HEADING_COPY_KEY)}</span>
        </div>
        <nav className={styles.sidebarNav} role="menu">
          <div className={styles.primaryNavigation} data-primary-navigation="true">
            {PRIMARY_NAV_ROUTES.filter((route) => route.path !== 'settings').map((route) => {
              const routeBadgeCount = route.path === BADGED_NAV_PATH ? overdueCount : 0
              return (
                <button
                  aria-current={primaryNavRouteActive(activePath, route.path) ? 'page' : undefined}
                  aria-label={routeBadgeCount > 0 ? shellCopy(OVERDUE_TAB_COPY_KEY, { count: routeBadgeCount, label: route.label }) : route.label}
                  className={styles.menuItem}
                  key={route.path}
                  onClick={() => navigate(route.path)}
                  role="menuitem"
                  type="button"
                >
                  <MaterialIcon name={route.icon} size={22} />
                  <span>{route.label}</span>
                  <CountBadge className={styles.sidebarBadge} count={routeBadgeCount} />
                </button>
              )
            })}
          </div>
          {PRIMARY_NAV_ROUTES.filter((route) => route.path === 'settings').map((route) => (
            <button aria-current={primaryNavRouteActive(activePath, route.path) ? 'page' : undefined} className={`${styles.menuItem} ${styles.sidebarSettingsItem}`} key={route.path} onClick={() => navigate(route.path)} role="menuitem" type="button">
              <MaterialIcon name={route.icon} size={22} />
              <span>{route.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  ) : null

  return (
    <header className={[
      styles.header,
      showBack ? styles.headerWithBack : '',
      showMenu ? styles.headerWithMenu : '',
      showBackMenu ? styles.headerWithBackMenu : '',
      !showBack && navigationLayout === 'rail' ? styles.headerWithRail : '',
    ].filter(Boolean).join(' ')}>
      {showBack ? (
        <>
          <button aria-label={resolvedBackLabel} className={styles.backButton} onClick={goBack} type="button">
            <span className={styles.backIconSlot}><BackChevron /></span>
            <span className={styles.backTitle}>{title}</span>
          </button>
          {typeof title === 'string' && <h1 className={styles.visuallyHidden}>{title}</h1>}
        </>
      ) : (
        <>
          <div className={styles.leading}>
            {showMenu && (
              renderMenuButton()
            )}
          </div>

          <div className={styles.titleWrap}>{typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}</div>
        </>
      )}

      <div className={styles.trailing}>
        {showBackMenu && (
          renderMenuButton(backMenuClassName)
        )}
        {showActions && (
          <button aria-expanded={actionsOpen} aria-label={shellCopy('navigation.moreActions')} className={styles.iconButton} onClick={() => { setActionsOpen((open) => !open); closeSidebar(false) }} type="button">
            <MaterialIcon name="mdi:dots-horizontal" size={28} />
          </button>
        )}
        <button aria-label={profileLabel} className={styles.profileButton} onClick={openProfile} type="button">
          <MaterialIcon name="mdi:account" size={22} />
          <CountBadge className={styles.profileBadge} count={badgeCount} />
        </button>
      </div>

      {sidebar && createPortal(sidebar, document.body)}

      {actionsOpen && (
        <div aria-label={shellCopy('navigation.pageActions')} className={`${styles.menu} ${styles.actionsMenu}`} role="menu">
          {actions.map((action) => (
            <button className={styles.menuItem} key={action.label} onClick={() => { closeMenus(false); action.onClick() }} role="menuitem" type="button">
              <MaterialIcon name={action.icon} size={20} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
