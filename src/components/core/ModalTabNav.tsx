import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useImmediateVisualTab } from '../../hooks/useSmoothDisplayedModalTab'
import { useReducedMotion } from '../../hooks/useReducedMotion'
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

type MembershipPhase = 'expand-fade' | 'expand-layout' | 'idle' | 'shrink-fade' | 'shrink-layout'
type ModalTabNavStyle = CSSProperties & {
  '--modal-tab-nav-count': number
}

interface MembershipRenderState<T extends string> {
  contentCount: number
  fromCount: number
  ghostColumns: Partial<Record<T, number>>
  ghostTabs: readonly ModalIconTabDefinition<T>[]
  enteringTabs: readonly T[]
  phase: MembershipPhase
  previouslyVisibleAuxiliaryTabs: Partial<Record<T, boolean>>
  revealingAuxiliaryTabs: readonly T[]
  semanticTabs: readonly ModalIconTabDefinition<T>[]
  tabColumns: Partial<Record<T, number>>
  toCount: number
  visualCount: number
}

export const MODAL_TAB_MEMBERSHIP_LAYOUT_MS = 180
export const MODAL_TAB_CONTENT_FADE_MS = 340
const MEMBERSHIP_LAYOUT_MS = MODAL_TAB_MEMBERSHIP_LAYOUT_MS
const CONTENT_FADE_MS = MODAL_TAB_CONTENT_FADE_MS
const MEMBERSHIP_SETTLE_MS = Math.max(MEMBERSHIP_LAYOUT_MS, CONTENT_FADE_MS) + 40
const CONTENT_FADE_IN_TRANSITION = `opacity ${CONTENT_FADE_MS}ms linear`
const CONTENT_FADE_OUT_TRANSITION = `opacity ${CONTENT_FADE_MS}ms linear`
const MEMBERSHIP_LAYOUT_TRANSITION = `transform ${MEMBERSHIP_LAYOUT_MS}ms ease, width ${MEMBERSHIP_LAYOUT_MS}ms ease`
const SHRINK_LAYOUT_TRANSITION = `transform ${MEMBERSHIP_LAYOUT_MS}ms ease, width ${MEMBERSHIP_LAYOUT_MS}ms ease-out`
const AUXILIARY_SELECTOR = '[data-modal-tab-label="true"], [data-modal-tab-accessory="true"]'

function signatureForTabs<T extends string>(tabs: readonly ModalIconTabDefinition<T>[]) {
  return tabs.map((tab) => tab.tab).join('|')
}

function naturalColumns<T extends string>(tabs: readonly ModalIconTabDefinition<T>[]) {
  return Object.fromEntries(tabs.map((tab, index) => [tab.tab, index + 1])) as Partial<Record<T, number>>
}

function baselineTabs<T extends string>(tabs: readonly ModalIconTabDefinition<T>[]): MembershipRenderState<T> {
  return {
    contentCount: tabs.length,
    fromCount: tabs.length,
    ghostColumns: {},
    ghostTabs: [],
    enteringTabs: [],
    phase: 'idle',
    previouslyVisibleAuxiliaryTabs: {},
    revealingAuxiliaryTabs: [],
    semanticTabs: tabs,
    tabColumns: {},
    toCount: tabs.length,
    visualCount: tabs.length,
  }
}

function membershipPlacement(column: number | undefined): CSSProperties | undefined {
  if (!column) return undefined
  return {
    gridColumn: String(column),
    gridRow: '1',
  }
}

function auxiliaryVisibility<T extends string>(
  tabRefs: Partial<Record<T, HTMLButtonElement>>,
  tabs: readonly ModalIconTabDefinition<T>[],
) {
  return Object.fromEntries(tabs.map((tab) => {
    const node = tabRefs[tab.tab]
    const auxiliaryNodes = node ? [...node.querySelectorAll<HTMLElement>(AUXILIARY_SELECTOR)] : []
    return [tab.tab, auxiliaryNodes.some((auxiliaryNode) => window.getComputedStyle(auxiliaryNode).display !== 'none')]
  })) as Partial<Record<T, boolean>>
}

function contentFadeNode(root: HTMLElement | null | undefined) {
  return root ? [root] : []
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
  const reducedMotion = useReducedMotion()
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement>>>({})
  const ghostRefs = useRef<Partial<Record<T, HTMLDivElement>>>({})
  const tabContentRefs = useRef<Partial<Record<T, HTMLSpanElement>>>({})
  const ghostContentRefs = useRef<Partial<Record<T, HTMLSpanElement>>>({})
  const animationFrameRef = useRef<number | null>(null)
  const contentAnimationStartTimerRef = useRef<number | null>(null)
  const clearStyleTimerRef = useRef<number | null>(null)
  const auxiliaryAnimationFrameRef = useRef<number | null>(null)
  const auxiliaryClearStyleTimerRef = useRef<number | null>(null)
  const phaseTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const motionRectsRef = useRef<Map<T, DOMRect> | null>(null)
  const fadingGhostsRef = useRef<T[] | null>(null)
  const [renderState, setRenderState] = useState<MembershipRenderState<T>>(() => baselineTabs(tabs))
  const renderStateRef = useRef(renderState)
  const tabsSignature = useMemo(() => signatureForTabs(tabs), [tabs])
  const displayedRenderState = !animateMembership || reducedMotion ? baselineTabs(tabs) : renderState
  const style: ModalTabNavStyle = { '--modal-tab-nav-count': displayedRenderState.visualCount }

  const clearMembershipStyles = useCallback(() => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    if (contentAnimationStartTimerRef.current !== null) window.clearTimeout(contentAnimationStartTimerRef.current)
    contentAnimationStartTimerRef.current = null
    if (clearStyleTimerRef.current !== null) window.clearTimeout(clearStyleTimerRef.current)
    clearStyleTimerRef.current = null
    if (auxiliaryAnimationFrameRef.current !== null) window.cancelAnimationFrame(auxiliaryAnimationFrameRef.current)
    auxiliaryAnimationFrameRef.current = null
    if (auxiliaryClearStyleTimerRef.current !== null) window.clearTimeout(auxiliaryClearStyleTimerRef.current)
    auxiliaryClearStyleTimerRef.current = null

    for (const tab of renderStateRef.current.semanticTabs) {
      const node = tabRefs.current[tab.tab]
      if (!node) continue
      node.style.removeProperty('opacity')
      node.style.removeProperty('transform')
      node.style.removeProperty('transition')
      node.style.removeProperty('will-change')
      node.style.removeProperty('width')
      node.style.removeProperty('justify-self')
      const contentNode = tabContentRefs.current[tab.tab]
      contentNode?.style.removeProperty('opacity')
      contentNode?.style.removeProperty('transition')
      contentNode?.style.removeProperty('will-change')
      for (const auxiliaryNode of node.querySelectorAll<HTMLElement>(AUXILIARY_SELECTOR)) {
        auxiliaryNode.style.removeProperty('opacity')
        auxiliaryNode.style.removeProperty('transition')
        auxiliaryNode.style.removeProperty('will-change')
      }
    }

    for (const ghost of renderStateRef.current.ghostTabs) {
      const node = ghostRefs.current[ghost.tab]
      if (!node) continue
      node.style.removeProperty('opacity')
      node.style.removeProperty('transition')
      node.style.removeProperty('will-change')
      const contentNode = ghostContentRefs.current[ghost.tab]
      contentNode?.style.removeProperty('opacity')
      contentNode?.style.removeProperty('transition')
      contentNode?.style.removeProperty('will-change')
    }
  }, [])

  const clearMembershipSchedule = useCallback(() => {
    if (phaseTimerRef.current !== null) window.clearTimeout(phaseTimerRef.current)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    phaseTimerRef.current = null
    settleTimerRef.current = null
  }, [])

  const clearMembershipAnimation = useCallback(() => {
    clearMembershipSchedule()
    clearMembershipStyles()
    motionRectsRef.current = null
    fadingGhostsRef.current = null
  }, [clearMembershipSchedule, clearMembershipStyles])

  const measureRenderedTabRects = useCallback((renderedTabs: readonly ModalIconTabDefinition<T>[]) => {
    const rects = new Map<T, DOMRect>()
    for (const tab of renderedTabs) {
      const node = tabRefs.current[tab.tab]
      if (!node) continue
      rects.set(tab.tab, node.getBoundingClientRect())
    }
    return rects
  }, [])

  const scheduleSettleToIdle = useCallback((expectedSignature: string) => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      if (signatureForTabs(renderStateRef.current.semanticTabs) !== expectedSignature) {
        settleTimerRef.current = null
        return
      }
      setRenderState(baselineTabs(tabs))
      settleTimerRef.current = null
    }, MEMBERSHIP_SETTLE_MS)
  }, [tabs])

  useLayoutEffect(() => {
    renderStateRef.current = renderState
  }, [renderState])

  useLayoutEffect(() => {
    if (renderState.phase === 'idle') clearMembershipStyles()
  }, [clearMembershipStyles, renderState.phase])

  useLayoutEffect(() => () => {
    clearMembershipAnimation()
  }, [clearMembershipAnimation])

  useLayoutEffect(() => {
    const previousRects = motionRectsRef.current
    if (!previousRects || reducedMotion) {
      motionRectsRef.current = null
      return
    }
    motionRectsRef.current = null

    const animatedTabs: {
      node: HTMLButtonElement
      width?: number
    }[] = []
    for (const tab of renderState.semanticTabs) {
      const node = tabRefs.current[tab.tab]
      const previousRect = previousRects.get(tab.tab)
      if (!node || !previousRect) continue
      const currentRect = node.getBoundingClientRect()
      const deltaX = previousRect.left - currentRect.left
      const deltaY = previousRect.top - currentRect.top
      const widthDelta = previousRect.width - currentRect.width
      const moving = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5
      const resizing = Math.abs(widthDelta) > 0.5
      if (!moving && !resizing) continue

      const willChange: string[] = []
      if (moving) {
        node.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        willChange.push('transform')
      }
      if (resizing) {
        node.style.justifySelf = 'start'
        node.style.width = `${previousRect.width}px`
        willChange.push('width')
      }
      node.style.willChange = willChange.join(', ')
      animatedTabs.push({
        node,
        width: resizing ? currentRect.width : undefined,
      })
    }
    if (animatedTabs.length === 0) return

    animationFrameRef.current = window.requestAnimationFrame(() => {
      for (const { node, width } of animatedTabs) {
        node.style.transition = renderState.phase === 'shrink-layout'
          ? SHRINK_LAYOUT_TRANSITION
          : MEMBERSHIP_LAYOUT_TRANSITION
        node.style.transform = 'translate(0px, 0px)'
        if (width !== undefined) node.style.width = `${width}px`
      }
      animationFrameRef.current = null
      if (clearStyleTimerRef.current !== null) window.clearTimeout(clearStyleTimerRef.current)
      clearStyleTimerRef.current = window.setTimeout(() => {
        for (const { node } of animatedTabs) {
          node.style.removeProperty('transform')
          node.style.removeProperty('transition')
          node.style.removeProperty('will-change')
          node.style.removeProperty('width')
          node.style.removeProperty('justify-self')
        }
        clearStyleTimerRef.current = null
      }, MEMBERSHIP_SETTLE_MS)
    })
  }, [reducedMotion, renderState.phase, renderState.semanticTabs])

  useLayoutEffect(() => {
    const fadingGhosts = fadingGhostsRef.current
    if (!fadingGhosts || reducedMotion) {
      fadingGhostsRef.current = null
      return
    }
    fadingGhostsRef.current = null
    const nodes = fadingGhosts.flatMap((tab) => contentFadeNode(ghostContentRefs.current[tab]))
    if (nodes.length === 0) return

    for (const node of nodes) {
      node.style.opacity = '1'
      node.style.transition = CONTENT_FADE_OUT_TRANSITION
      node.style.willChange = 'opacity'
      node.getBoundingClientRect()
    }

    contentAnimationStartTimerRef.current = window.setTimeout(() => {
      for (const node of nodes) {
        node.style.opacity = '0'
      }
      contentAnimationStartTimerRef.current = null
      if (clearStyleTimerRef.current !== null) window.clearTimeout(clearStyleTimerRef.current)
      clearStyleTimerRef.current = window.setTimeout(() => {
        for (const node of nodes) {
          node.style.removeProperty('opacity')
          node.style.removeProperty('transition')
          node.style.removeProperty('will-change')
        }
        clearStyleTimerRef.current = null
      }, CONTENT_FADE_MS + 40)
    }, 34)
  }, [reducedMotion, renderState.ghostTabs, renderState.phase])

  useLayoutEffect(() => {
    const enteringTabs = renderState.enteringTabs
    if (enteringTabs.length === 0 || reducedMotion) {
      return
    }
    const nodes = enteringTabs.flatMap((tab) => contentFadeNode(tabContentRefs.current[tab]))
    if (nodes.length === 0) return

    for (const node of nodes) {
      node.style.opacity = '0'
      node.style.transition = CONTENT_FADE_IN_TRANSITION
      node.style.willChange = 'opacity'
      node.getBoundingClientRect()
    }

    contentAnimationStartTimerRef.current = window.setTimeout(() => {
      for (const node of nodes) {
        node.style.opacity = '1'
      }
      contentAnimationStartTimerRef.current = null
      if (clearStyleTimerRef.current !== null) window.clearTimeout(clearStyleTimerRef.current)
      clearStyleTimerRef.current = window.setTimeout(() => {
        for (const node of nodes) {
          node.style.removeProperty('opacity')
          node.style.removeProperty('transition')
          node.style.removeProperty('will-change')
        }
        clearStyleTimerRef.current = null
      }, CONTENT_FADE_MS + 40)
    }, 34)
  }, [reducedMotion, renderState.enteringTabs, renderState.phase, renderState.semanticTabs])

  useLayoutEffect(() => {
    const revealingAuxiliaryTabs = renderState.revealingAuxiliaryTabs
    if (revealingAuxiliaryTabs.length === 0 || reducedMotion) {
      return
    }
    const previousVisibility = renderState.previouslyVisibleAuxiliaryTabs
    const nodes = revealingAuxiliaryTabs.flatMap((tab) => {
      if (previousVisibility[tab]) return []
      const node = tabRefs.current[tab]
      if (!node) return []
      return [...node.querySelectorAll<HTMLElement>(AUXILIARY_SELECTOR)]
        .filter((auxiliaryNode) => window.getComputedStyle(auxiliaryNode).display !== 'none')
    })
    if (nodes.length === 0) return

    for (const node of nodes) {
      node.style.opacity = '0'
      node.style.willChange = 'opacity'
    }

    auxiliaryAnimationFrameRef.current = window.requestAnimationFrame(() => {
      for (const node of nodes) {
        node.style.transition = CONTENT_FADE_IN_TRANSITION
      }
      auxiliaryAnimationFrameRef.current = window.requestAnimationFrame(() => {
        for (const node of nodes) {
          node.style.opacity = '1'
        }
        auxiliaryAnimationFrameRef.current = null
        if (auxiliaryClearStyleTimerRef.current !== null) window.clearTimeout(auxiliaryClearStyleTimerRef.current)
        auxiliaryClearStyleTimerRef.current = window.setTimeout(() => {
          for (const node of nodes) {
            node.style.removeProperty('opacity')
            node.style.removeProperty('transition')
            node.style.removeProperty('will-change')
          }
          auxiliaryClearStyleTimerRef.current = null
        }, CONTENT_FADE_MS + 40)
      })
    })
  }, [reducedMotion, renderState.phase, renderState.previouslyVisibleAuxiliaryTabs, renderState.revealingAuxiliaryTabs, renderState.semanticTabs])

  useEffect(() => {
    if (!animateMembership || reducedMotion) {
      clearMembershipAnimation()
      return
    }

    const currentState = renderStateRef.current
    const currentSignature = signatureForTabs(currentState.semanticTabs)
    if (currentSignature === tabsSignature) {
      if (
        currentState.phase !== 'idle'
        || currentState.visualCount !== tabs.length
        || currentState.contentCount !== tabs.length
        || currentState.fromCount !== tabs.length
        || currentState.toCount !== tabs.length
      ) {
        clearMembershipAnimation()
      }
      return
    }

    const currentTabs = currentState.semanticTabs
    const interruptedMotionRects = currentState.phase === 'idle'
      ? null
      : measureRenderedTabRects(currentTabs)
    const currentIndex = new Map(currentTabs.map((tab, index) => [tab.tab, index]))
    const currentColumns = Object.keys(currentState.tabColumns).length > 0
      ? currentState.tabColumns
      : naturalColumns(currentTabs)
    const nextIndex = new Map(tabs.map((tab, index) => [tab.tab, index]))
    const removedTabs = currentTabs.filter((tab) => !nextIndex.has(tab.tab))
    const addedTabs = tabs.filter((tab) => !currentIndex.has(tab.tab))
    const fromCount = currentState.contentCount
    const toCount = tabs.length

    clearMembershipAnimation()

    if (tabs.length < currentTabs.length && removedTabs.length > 0) {
      fadingGhostsRef.current = removedTabs.map((tab) => tab.tab)
      setRenderState({
        contentCount: fromCount,
        fromCount,
        ghostColumns: Object.fromEntries(removedTabs.map((tab) => [tab.tab, currentColumns[tab.tab] ?? currentIndex.get(tab.tab)! + 1])) as Partial<Record<T, number>>,
        ghostTabs: removedTabs,
        enteringTabs: [],
        phase: 'shrink-fade',
        previouslyVisibleAuxiliaryTabs: {},
        revealingAuxiliaryTabs: [],
        semanticTabs: tabs,
        tabColumns: Object.fromEntries(tabs.map((tab) => [tab.tab, currentColumns[tab.tab] ?? currentIndex.get(tab.tab)! + 1])) as Partial<Record<T, number>>,
        toCount,
        visualCount: currentState.visualCount,
      })
      phaseTimerRef.current = window.setTimeout(() => {
        motionRectsRef.current = measureRenderedTabRects(renderStateRef.current.semanticTabs)
        const previousAuxiliaryVisibility = auxiliaryVisibility(tabRefs.current, renderStateRef.current.semanticTabs)
        setRenderState({
          contentCount: toCount,
          fromCount,
          ghostColumns: {},
          ghostTabs: [],
          enteringTabs: [],
          phase: 'shrink-layout',
          previouslyVisibleAuxiliaryTabs: previousAuxiliaryVisibility,
          revealingAuxiliaryTabs: tabs.map((tab) => tab.tab),
          semanticTabs: tabs,
          tabColumns: {},
          toCount,
          visualCount: tabs.length,
        })
        scheduleSettleToIdle(tabsSignature)
        phaseTimerRef.current = null
      }, CONTENT_FADE_MS)
      return
    }

    if (tabs.length > currentTabs.length && addedTabs.length > 0) {
      motionRectsRef.current = interruptedMotionRects ?? measureRenderedTabRects(currentTabs)
      setRenderState({
        contentCount: fromCount,
        fromCount,
        ghostColumns: {},
        ghostTabs: [],
        enteringTabs: [],
        phase: 'expand-layout',
        previouslyVisibleAuxiliaryTabs: {},
        revealingAuxiliaryTabs: [],
        semanticTabs: currentTabs,
        tabColumns: Object.fromEntries(currentTabs.map((tab) => [tab.tab, nextIndex.get(tab.tab)! + 1])) as Partial<Record<T, number>>,
        toCount,
        visualCount: tabs.length,
      })
      phaseTimerRef.current = window.setTimeout(() => {
        setRenderState({
          contentCount: toCount,
          fromCount,
          ghostColumns: {},
          ghostTabs: [],
          enteringTabs: addedTabs.map((tab) => tab.tab),
          phase: 'expand-fade',
          previouslyVisibleAuxiliaryTabs: {},
          revealingAuxiliaryTabs: [],
          semanticTabs: tabs,
          tabColumns: {},
          toCount,
          visualCount: tabs.length,
        })
        scheduleSettleToIdle(tabsSignature)
        phaseTimerRef.current = null
      }, MEMBERSHIP_LAYOUT_MS)
      return
    }

    motionRectsRef.current = interruptedMotionRects ?? measureRenderedTabRects(currentTabs)
    setRenderState({
      contentCount: tabs.length,
      fromCount: tabs.length,
      ghostColumns: {},
      ghostTabs: [],
      enteringTabs: [],
      phase: 'expand-layout',
      previouslyVisibleAuxiliaryTabs: {},
      revealingAuxiliaryTabs: [],
      semanticTabs: tabs,
      tabColumns: {},
      toCount: tabs.length,
      visualCount: tabs.length,
    })
    scheduleSettleToIdle(tabsSignature)
  }, [animateMembership, clearMembershipAnimation, measureRenderedTabRects, reducedMotion, scheduleSettleToIdle, tabs, tabs.length, tabsSignature])

  const selectTab = (tab: T, focus = false) => {
    setVisualTabNow(tab)
    onTabChange(tab)
    if (focus) window.requestAnimationFrame(() => tabRefs.current[tab]?.focus({ preventScroll: true }))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: T) => {
    const index = displayedRenderState.semanticTabs.findIndex((item) => item.tab === tab)
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % displayedRenderState.semanticTabs.length
      : event.key === 'ArrowLeft'
        ? (index - 1 + displayedRenderState.semanticTabs.length) % displayedRenderState.semanticTabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? displayedRenderState.semanticTabs.length - 1
            : -1
    if (nextIndex < 0) return
    event.preventDefault()
    selectTab(displayedRenderState.semanticTabs[nextIndex].tab, true)
  }

  return (
    <div
      aria-label={label}
      aria-orientation="horizontal"
      className={styles.tabList}
      data-content-count={displayedRenderState.contentCount}
      data-content-count-from={displayedRenderState.fromCount}
      data-content-count-to={displayedRenderState.toCount}
      data-membership-phase={displayedRenderState.phase}
      data-modal-tab-nav="true"
      data-semantic-count={displayedRenderState.semanticTabs.length}
      data-tab-count={displayedRenderState.visualCount}
      data-visual-count={displayedRenderState.visualCount}
      role="tablist"
      style={style}
    >
      {displayedRenderState.semanticTabs.map((item, index) => {
        const visuallyActive = visualActiveTab === item.tab
        const selected = activeTab === item.tab
        const column = displayedRenderState.tabColumns[item.tab]
        const entering = displayedRenderState.phase === 'expand-fade' && displayedRenderState.enteringTabs.includes(item.tab)
        const revealingAuxiliary = displayedRenderState.phase === 'shrink-layout'
          && !displayedRenderState.previouslyVisibleAuxiliaryTabs[item.tab]
          && displayedRenderState.revealingAuxiliaryTabs.includes(item.tab)
        const enteringContentStyle = entering ? { opacity: 0 } satisfies CSSProperties : undefined
        const revealingAuxiliaryStyle = revealingAuxiliary ? { opacity: 0 } satisfies CSSProperties : undefined
        return (
          <button
            aria-controls={panelId ?? modalTabPanelId(idPrefix, item.tab)}
            aria-label={item.ariaLabel ?? item.label}
            aria-selected={selected}
            className={styles.tab}
            data-active={visuallyActive ? 'true' : undefined}
            data-icon={item.icon}
            data-membership-index={index + 1}
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
            style={membershipPlacement(column)}
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span
              className={styles.content}
              data-modal-tab-content="true"
              ref={(node) => {
                tabContentRefs.current[item.tab] = node ?? undefined
              }}
              style={enteringContentStyle}
            >
              <span className={styles.icon} data-modal-tab-icon="true">
                <MaterialIcon name={item.icon} size={22} />
                <CountBadge className={styles.badge} count={item.badgeCount ?? 0} />
              </span>
              <span
                className={styles.label}
                data-modal-tab-label="true"
                style={revealingAuxiliaryStyle}
              >
                {item.label}
              </span>
              {item.accessory && (
                <span
                  className={styles.accessory}
                  data-modal-tab-accessory="true"
                  style={revealingAuxiliaryStyle}
                >
                  {item.accessory}
                </span>
              )}
            </span>
          </button>
        )
      })}
      {displayedRenderState.ghostTabs.map((item) => {
        const column = displayedRenderState.ghostColumns[item.tab]
        return (
          <div
            aria-hidden="true"
            className={styles.ghost}
            data-icon={item.icon}
            data-modal-tab-ghost="true"
            data-tab={item.tab}
            key={`ghost-${item.tab}`}
            ref={(node) => {
              ghostRefs.current[item.tab] = node ?? undefined
            }}
            style={membershipPlacement(column)}
          >
            <span
              className={styles.content}
              data-modal-tab-content="true"
              ref={(node) => {
                ghostContentRefs.current[item.tab] = node ?? undefined
              }}
            >
              <span className={styles.icon} data-modal-tab-icon="true">
                <MaterialIcon name={item.icon} size={22} />
                <CountBadge className={styles.badge} count={item.badgeCount ?? 0} />
              </span>
              <span className={styles.label} data-modal-tab-label="true">{item.label}</span>
              {item.accessory && <span className={styles.accessory} data-modal-tab-accessory="true">{item.accessory}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
