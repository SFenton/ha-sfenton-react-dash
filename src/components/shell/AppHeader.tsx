import { useState, type ReactNode } from 'react'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import { IconSize } from '../../constants/theme'
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
              <button aria-expanded={menuOpen} aria-label="Open navigation menu" className={styles.menuButton} onClick={() => { setMenuOpen((open) => !open); setActionsOpen(false) }} type="button">
                <MenuIcon />
              </button>
            )}
          </div>

          <div className={styles.titleWrap}>{typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}</div>
        </>
      )}

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
