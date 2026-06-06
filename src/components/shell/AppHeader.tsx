import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { MaterialIcon } from '../core/Icon'
import styles from './AppHeader.module.css'

const SIDEBAR_ANIMATION_MS = 260

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
  onNavigate?: (path: string) => void
  title: ReactNode
}

export function AppHeader({ activePath, actions = [], backLabel = 'Go back', backPath, onNavigate, title }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarClosing, setSidebarClosing] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const sidebarCloseTimer = useRef<number | null>(null)
  const showBack = Boolean(backPath)
  const showMenu = Boolean(!showBack && onNavigate)
  const showActions = actions.length > 0
  const sidebarVisible = menuOpen || sidebarClosing
  const sidebarRoutes = PRIMARY_NAV_ROUTES.filter((route) => route.path !== 'settings')
  const settingsRoute = PRIMARY_NAV_ROUTES.find((route) => route.path === 'settings')

  const clearSidebarCloseTimer = () => {
    if (sidebarCloseTimer.current === null) return
    window.clearTimeout(sidebarCloseTimer.current)
    sidebarCloseTimer.current = null
  }

  const finishSidebarClose = () => {
    clearSidebarCloseTimer()
    setSidebarClosing(false)
  }

  const openSidebar = () => {
    clearSidebarCloseTimer()
    setSidebarClosing(false)
    setMenuOpen(true)
    setActionsOpen(false)
  }

  const closeSidebar = () => {
    if (!menuOpen && !sidebarClosing) return
    clearSidebarCloseTimer()
    setMenuOpen(false)
    setSidebarClosing(true)
    sidebarCloseTimer.current = window.setTimeout(finishSidebarClose, SIDEBAR_ANIMATION_MS)
  }

  const toggleSidebar = () => {
    if (menuOpen) {
      closeSidebar()
      return
    }

    openSidebar()
  }

  useEffect(() => () => clearSidebarCloseTimer(), [])

  const closeMenus = () => {
    closeSidebar()
    setActionsOpen(false)
  }

  const navigate = (path: string) => {
    closeMenus()
    onNavigate?.(path)
  }

  const goBack = () => {
    closeMenus()
    window.history.back()
  }

  const sidebarMenu = sidebarVisible && typeof document !== 'undefined'
    ? createPortal(
      <div className={styles.sidebarScrim} data-state={menuOpen ? 'open' : 'closed'} onClick={closeMenus}>
        <aside aria-hidden={sidebarClosing ? true : undefined} aria-label="Navigation menu" className={styles.sidebar} data-state={menuOpen ? 'open' : 'closed'} onAnimationEnd={() => sidebarClosing && finishSidebarClose()} onClick={(event) => event.stopPropagation()}>
          <div className={styles.sidebarHeader}>
            <span>Navigation</span>
          </div>
          <nav className={styles.sidebarNav} role="menu">
            {sidebarRoutes.map((route) => (
              <button aria-current={primaryNavRouteActive(activePath, route.path) ? 'page' : undefined} className={styles.menuItem} key={route.path} onClick={() => navigate(route.path)} role="menuitem" type="button">
                <MaterialIcon name={route.icon} size={22} />
                <span>{route.label}</span>
              </button>
            ))}
            {settingsRoute && (
              <button aria-current={primaryNavRouteActive(activePath, settingsRoute.path) ? 'page' : undefined} className={`${styles.menuItem} ${styles.sidebarSettingsItem}`} onClick={() => navigate(settingsRoute.path)} role="menuitem" type="button">
                <MaterialIcon name={settingsRoute.icon} size={22} />
                <span>{settingsRoute.label}</span>
              </button>
            )}
          </nav>
        </aside>
      </div>,
      document.body,
    )
    : null

  return (
    <header className={styles.header}>
      <div className={styles.leading}>
        {showBack && (
          <button aria-label={backLabel} className={styles.iconButton} onClick={goBack} type="button">
            <MaterialIcon name="mdi:chevron-left" size={22} />
          </button>
        )}
        {showMenu && (
          <button aria-expanded={menuOpen} aria-label="Open navigation menu" className={styles.iconButton} onClick={toggleSidebar} type="button">
            <MaterialIcon name="mdi:menu" size={22} />
          </button>
        )}
      </div>

      <div className={styles.titleWrap}>{typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}</div>

      <div className={styles.trailing}>
        {showActions && (
          <button aria-expanded={actionsOpen} aria-label="More actions" className={styles.iconButton} onClick={() => { setActionsOpen((open) => !open); closeSidebar() }} type="button">
            <MaterialIcon name="mdi:dots-horizontal" size={28} />
          </button>
        )}
      </div>

      {sidebarMenu}

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
