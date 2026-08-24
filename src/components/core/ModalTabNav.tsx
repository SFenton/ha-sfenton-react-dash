import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useImmediateVisualTab } from '../../hooks/useSmoothDisplayedModalTab'
import { CountBadge } from './CountBadge'
import { MaterialIcon } from './Icon'
import { modalTabId, modalTabPanelId } from './modalTabIds'
import styles from './ModalTabNav.module.css'

export interface ModalIconTabDefinition<T extends string> {
  accessory?: ReactNode
  ariaLabel?: string
  badgeCount?: number
  icon: string
  label: string
  tab: T
}

interface ModalIconTabNavProps<T extends string> {
  activeTab: T
  idPrefix: string
  label: string
  onTabChange: (tab: T) => void
  panelId?: string
  tabs: readonly ModalIconTabDefinition<T>[]
}

type ModalTabNavStyle = CSSProperties & {
  '--modal-tab-nav-count': number
}

export function ModalIconTabNav<T extends string>({
  activeTab,
  idPrefix,
  label,
  onTabChange,
  panelId,
  tabs,
}: ModalIconTabNavProps<T>) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement>>>({})
  const style: ModalTabNavStyle = { '--modal-tab-nav-count': tabs.length }

  const selectTab = (tab: T, focus = false) => {
    setVisualTabNow(tab)
    onTabChange(tab)
    if (focus) window.requestAnimationFrame(() => tabRefs.current[tab]?.focus({ preventScroll: true }))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: T) => {
    const index = tabs.findIndex((item) => item.tab === tab)
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1
    if (nextIndex < 0) return
    event.preventDefault()
    selectTab(tabs[nextIndex].tab, true)
  }

  return (
    <div
      aria-label={label}
      aria-orientation="horizontal"
      className={styles.tabList}
      data-modal-tab-nav="true"
      role="tablist"
      style={style}
    >
      {tabs.map((item) => {
        const visuallyActive = visualActiveTab === item.tab
        const selected = activeTab === item.tab
        return (
          <button
            aria-controls={panelId ?? modalTabPanelId(idPrefix, item.tab)}
            aria-label={item.ariaLabel ?? item.label}
            aria-selected={selected}
            className={styles.tab}
            data-active={visuallyActive ? 'true' : undefined}
            data-icon={item.icon}
            id={modalTabId(idPrefix, item.tab)}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => selectTab(item.tab)}
            onKeyDown={(event) => handleKeyDown(event, item.tab)}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            ref={(node) => {
              tabRefs.current[item.tab] = node ?? undefined
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className={styles.icon}>
              <MaterialIcon name={item.icon} size={22} />
              <CountBadge className={styles.badge} count={item.badgeCount ?? 0} />
            </span>
            <span className={styles.label}>{item.label}</span>
            {item.accessory && <span className={styles.accessory}>{item.accessory}</span>}
          </button>
        )
      })}
    </div>
  )
}
