import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDailyReportContext } from '../hass/dailyReportModal'
import { DAILY_REPORT_HASH, PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { dispatchDashboardRouteChange, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { IconSize } from '../../constants/theme'
import { CountBadge } from '../core/CountBadge'
import { MaterialIcon } from '../core/Icon'
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

export function AppHeader({ activePath, actions = [], backLabel = 'Go back', backPath, onBack, onNavigate, title }: AppHeaderProps) {
  const [sidebarState, setSidebarState] = useState<SidebarState>('closed')
  const [actionsOpen, setActionsOpen] = useState(false)
  const { badgeCount, title: profileTitle } = useDailyReportContext()
  const profileLabel = badgeCount > 0 ? `Open ${profileTitle}, ${badgeCount} ${badgeCount === 1 ? 'item needs' : 'items need'} attention` : `Open ${profileTitle}`
  const showBack = Boolean(backPath)
  const showMenu = Boolean(!showBack && onNavigate)
  const showActions = actions.length > 0
  const menuOpen = sidebarState === 'open'
  const sidebarMounted = sidebarState !== 'closed'
  const sidebarDataState = sidebarState === 'closing' ? 'closed' : 'open'

  const closeSidebar = () => {
    setSidebarState((current) => (current === 'open' ? 'closing' : current))
  }

  const closeMenus = () => {
    closeSidebar()
    setActionsOpen(false)
  }

  const toggleSidebar = () => {
    setActionsOpen(false)
    setSidebarState((current) => (current === 'open' ? 'closing' : 'open'))
  }

  const navigate = (path: string) => {
    closeMenus()
    onNavigate?.(path)
  }

  const goBack = () => {
    closeMenus()
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
    closeMenus()
    pushDashboardUrl(DAILY_REPORT_HASH)
    dispatchDashboardRouteChange()
  }
  const sidebar = sidebarMounted ? (
    <div
      className={styles.sidebarScrim}
      data-state={sidebarDataState}
      onAnimationEnd={() => {
        setSidebarState((current) => (current === 'closing' ? 'closed' : current))
      }}
      onClick={closeMenus}
    >
      <aside aria-label="Navigation menu" className={styles.sidebar} data-state={sidebarDataState} onClick={(event) => event.stopPropagation()}>
        <div className={styles.sidebarHeader}>
          <span>Navigation</span>
        </div>
        <nav className={styles.sidebarNav} role="menu">
          <div className={styles.primaryNavigation} data-primary-navigation="true">
            {PRIMARY_NAV_ROUTES.filter((route) => route.path !== 'settings').map((route) => (
              <button aria-current={primaryNavRouteActive(activePath, route.path) ? 'page' : undefined} className={styles.menuItem} key={route.path} onClick={() => navigate(route.path)} role="menuitem" type="button">
                <MaterialIcon name={route.icon} size={22} />
                <span>{route.label}</span>
              </button>
            ))}
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
    <header className={`${styles.header} ${showBack ? styles.headerWithBack : ''} ${showMenu ? styles.headerWithMenu : ''}`}>
      {showBack ? (
        <>
          <button aria-label={backLabel} className={styles.backButton} onClick={goBack} type="button">
            <span className={styles.backIconSlot}><BackChevron /></span>
            <span className={styles.backTitle}>{title}</span>
          </button>
          {typeof title === 'string' && <h1 className={styles.visuallyHidden}>{title}</h1>}
        </>
      ) : (
        <>
          <div className={styles.leading}>
            {showMenu && (
              <button aria-expanded={menuOpen} aria-label="Open navigation menu" className={styles.menuButton} onClick={toggleSidebar} type="button">
                <MenuIcon />
              </button>
            )}
          </div>

          <div className={styles.titleWrap}>{typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}</div>
        </>
      )}

      <div className={styles.trailing}>
        {showActions && (
          <button aria-expanded={actionsOpen} aria-label="More actions" className={styles.iconButton} onClick={() => { setActionsOpen((open) => !open); closeSidebar() }} type="button">
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
        <div aria-label="Page actions" className={`${styles.menu} ${styles.actionsMenu}`} role="menu">
          {actions.map((action) => (
            <button className={styles.menuItem} key={action.label} onClick={() => { closeMenus(); action.onClick() }} role="menuitem" type="button">
              <MaterialIcon name={action.icon} size={20} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
