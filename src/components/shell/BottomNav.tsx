import { MaterialIcon } from '../core/Icon'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import styles from './BottomNav.module.css'

interface BottomNavProps {
  activePath: string
  onNavigate: (path: string) => void
}

export function BottomNav({ activePath, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Dashboard sections">
      {PRIMARY_NAV_ROUTES.map((tab) => {
        const isActive = primaryNavRouteActive(activePath, tab.path)
        return (
          <button
            key={tab.label}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onNavigate(tab.path)}
            type="button"
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <MaterialIcon name={tab.icon} size={23} />
          </button>
        )
      })}
    </nav>
  )
}