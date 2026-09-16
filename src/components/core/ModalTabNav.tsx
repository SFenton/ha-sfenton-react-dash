import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
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
  animateMembership?: boolean
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
  animateMembership = false,
  idPrefix,
  label,
  onTabChange,
  panelId,
  tabs,
}: ModalIconTabNavProps<T>) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement>>>({})
  const previousRectsRef = useRef(new Map<T, DOMRect>())
  const previousSignatureRef = useRef<string | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const style: ModalTabNavStyle = { '--modal-tab-nav-count': tabs.length }
  const membershipSignature = useMemo(() => tabs.map((tab) => tab.tab).join('|'), [tabs])

  const clearMembershipAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    animationFrameRef.current = null
    settleTimerRef.current = null
    for (const tab of tabs) {
      const node = tabRefs.current[tab.tab]
      if (!node) continue
      node.style.removeProperty('opacity')
      node.style.removeProperty('transform')
      node.style.removeProperty('transition')
      node.style.removeProperty('will-change')
    }
  }, [tabs])

  useLayoutEffect(() => clearMembershipAnimation, [clearMembershipAnimation])

  useLayoutEffect(() => {
    clearMembershipAnimation()
    const currentRects = new Map<T, DOMRect>()
    for (const tab of tabs) {
      const node = tabRefs.current[tab.tab]
      if (!node) continue
      currentRects.set(tab.tab, node.getBoundingClientRect())
    }

    const previousSignature = previousSignatureRef.current
    previousSignatureRef.current = membershipSignature
    if (!animateMembership || previousSignature === null || previousSignature === membershipSignature) {
      previousRectsRef.current = currentRects
      return
    }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previousRectsRef.current = currentRects
      return
    }

    for (const tab of tabs) {
      const node = tabRefs.current[tab.tab]
      const currentRect = currentRects.get(tab.tab)
      if (!node || !currentRect) continue
      const previousRect = previousRectsRef.current.get(tab.tab)
      node.style.willChange = 'transform, opacity'
      if (previousRect) {
        const deltaX = previousRect.left - currentRect.left
        const deltaY = previousRect.top - currentRect.top
        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          node.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        }
      } else {
        node.style.opacity = '0'
        node.style.transform = 'translateY(8px)'
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      for (const tab of tabs) {
        const node = tabRefs.current[tab.tab]
        if (!node) continue
        node.style.transition = 'transform 180ms ease, opacity 180ms ease'
        node.style.opacity = '1'
        node.style.transform = 'translate(0px, 0px)'
      }
      animationFrameRef.current = null
      settleTimerRef.current = window.setTimeout(() => {
        clearMembershipAnimation()
      }, 220)
    })

    previousRectsRef.current = currentRects
  }, [animateMembership, clearMembershipAnimation, membershipSignature, tabs])

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
      data-tab-count={tabs.length}
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
