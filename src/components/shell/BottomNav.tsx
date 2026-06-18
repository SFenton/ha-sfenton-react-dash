import { useState } from 'react'
import { flushSync } from 'react-dom'
import { MaterialIcon } from '../core/Icon'
import { PRIMARY_NAV_ROUTES, primaryNavRouteActive } from '../../constants/routes'
import styles from './BottomNav.module.css'

interface BottomNavProps {
  activePath: string
  onNavigate: (path: string) => void
}

export function BottomNav({ activePath, onNavigate }: BottomNavProps) {
  const [visualOverride, setVisualOverride] = useState<{ activePath: string, path: string } | undefined>()
  const visualActivePath = visualOverride?.activePath === activePath ? visualOverride.path : activePath
  const setVisualPathNow = (path: string) => {
    flushSync(() => setVisualOverride({ activePath, path }))
  }

  return (
    <nav className={styles.nav} aria-label="Dashboard sections">
      {PRIMARY_NAV_ROUTES.map((tab) => {
        const isCurrent = primaryNavRouteActive(activePath, tab.path)
        const isActive = primaryNavRouteActive(visualActivePath, tab.path)
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
            aria-label={tab.label}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <MaterialIcon name={tab.icon} size={23} />
          </button>
        )
      })}
    </nav>
  )
}