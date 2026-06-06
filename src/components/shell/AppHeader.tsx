import { useState, type ReactNode } from 'react'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
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
  onNavigate?: (path: string) => void
  title: ReactNode
}

export function AppHeader({ activePath, actions = [], backLabel = 'Go back', backPath, onNavigate, title }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const showBack = Boolean(backPath)
  const showMenu = Boolean(!showBack && onNavigate)
  const showActions = actions.length > 0

  const closeMenus = () => {
    setMenuOpen(false)
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

  return (
    <header className={styles.header}>
      <div className={styles.leading}>
        {showBack && (
          <button aria-label={backLabel} className={styles.iconButton} onClick={goBack} type="button">
            <MaterialIcon name="mdi:chevron-left" size={22} />
          </button>
        )}
        {showMenu && (
          <button aria-expanded={menuOpen} aria-label="Open navigation menu" className={styles.iconButton} onClick={() => { setMenuOpen((open) => !open); setActionsOpen(false) }} type="button">
            <MaterialIcon name="mdi:menu" size={22} />
          </button>
        )}
      </div>

      <div className={styles.titleWrap}>{typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}</div>

      <div className={styles.trailing}>
        {showActions && (
          <button aria-expanded={actionsOpen} aria-label="More actions" className={styles.iconButton} onClick={() => { setActionsOpen((open) => !open); setMenuOpen(false) }} type="button">
            <MaterialIcon name="mdi:dots-horizontal" size={28} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div className={styles.sidebarScrim} onClick={closeMenus}>
          <aside aria-label="Navigation menu" className={styles.sidebar} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sidebarHeader}>
              <span>Navigation</span>
              <button aria-label="Close navigation menu" className={styles.iconButton} onClick={closeMenus} type="button">
                <MaterialIcon name="mdi:close" size={26} />
              </button>
            </div>
            <nav className={styles.sidebarNav} role="menu">
              {PRIMARY_NAV_ROUTES.map((route) => (
                <button aria-current={primaryNavRouteActive(activePath, route.path) ? 'page' : undefined} className={styles.menuItem} key={route.path} onClick={() => navigate(route.path)} role="menuitem" type="button">
                  <MaterialIcon name={route.icon} size={22} />
                  <span>{route.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

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
