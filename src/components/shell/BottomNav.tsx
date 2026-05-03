import { Icon } from '../core/Icon'
import type { IconKey } from '../../constants/atAGlance'
import styles from './BottomNav.module.css'

interface BottomNavProps {
  activeHash: string
  onOpenHash: (hash: string) => void
}

const TABS: { label: string; icon: IconKey; hash: string }[] = [
  { label: 'Home', icon: 'home', hash: '' },
  { label: 'Security', icon: 'security', hash: '#security-system' },
  { label: 'Ecobee', icon: 'thermostat', hash: '#climate-overview' },
  { label: 'Chores', icon: 'checklist', hash: '#chores-preview' },
  { label: 'Settings', icon: 'settings', hash: '#settings-preview' },
]

export function BottomNav({ activeHash, onOpenHash }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Dashboard sections">
      {TABS.map((tab) => {
        const isActive = tab.hash ? activeHash === tab.hash : activeHash === ''
        return (
          <button
            key={tab.label}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onOpenHash(tab.hash)}
            type="button"
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={23} />
          </button>
        )
      })}
    </nav>
  )
}