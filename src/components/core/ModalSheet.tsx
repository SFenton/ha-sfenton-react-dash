import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Drawer } from 'vaul'
import { MaterialIcon } from './Icon'
import { useCopy } from '../../i18n'
import styles from './ModalSheet.module.css'

export type ModalSheetStyle = CSSProperties & {
  [key: `--${string}`]: string | number | undefined
}

interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  backLabel?: string
  bodyElementRef?: Ref<HTMLDivElement>
  bodyHeader?: ReactNode
  contentStyle?: ModalSheetStyle
  footer?: ReactNode
  onBack?: () => void
  scrollResetKey?: string | number | boolean
  subtitle?: string
}

type ModalSheetSnapshot = Pick<ModalSheetProps, 'backLabel' | 'bodyHeader' | 'children' | 'contentStyle' | 'footer' | 'onBack' | 'scrollResetKey' | 'subtitle' | 'title'>
const RECENT_OPEN_INTERNAL_CLOSE_GUARD_MS = 450
export const MODAL_SHEET_EXIT_ANIMATION_MS = 520

function desktopModalLayoutMatches() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 760px)').matches
}

function closeWasWithinExitAnimation(closeRequestedAt: number) {
  return typeof window !== 'undefined' && window.performance.now() - closeRequestedAt <= MODAL_SHEET_EXIT_ANIMATION_MS
}

function useDesktopModalLayout() {
  const [isDesktopModalLayout, setIsDesktopModalLayout] = useState(desktopModalLayoutMatches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(min-width: 760px)')
    const syncLayout = () => setIsDesktopModalLayout(mediaQuery.matches)
    syncLayout()
    mediaQuery.addEventListener('change', syncLayout)
    return () => mediaQuery.removeEventListener('change', syncLayout)
  }, [])

  return isDesktopModalLayout
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

function clearVaulDragStyles(content: HTMLDivElement) {
  content.style.setProperty('transition', 'none')
  content.style.removeProperty('transform')
  // Flush the zero-transform state before restoring Vaul's transition.
  content.getBoundingClientRect()
  content.style.removeProperty('transition')
}

export function ModalSheet({ open, title, onClose, children, backLabel, bodyElementRef, bodyHeader, contentStyle, footer, onBack, scrollResetKey, subtitle }: ModalSheetProps) {
  const copy = useCopy('core')
  const contentRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [bodyRefVersion, setBodyRefVersion] = useState(0)
  const closeRequestedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const ignoreInternalCloseUntilRef = useRef(0)
  const currentSnapshot: ModalSheetSnapshot = { backLabel: backLabel ?? copy('modal.back'), bodyHeader, children, contentStyle, footer, onBack, scrollResetKey, subtitle, title }
  const [lastOpenSnapshot, setLastOpenSnapshot] = useState<ModalSheetSnapshot>(currentSnapshot)
  const [mounted, setMounted] = useState(open)
  const [previousOpen, setPreviousOpen] = useState(open)
  const [rapidReopen, setRapidReopen] = useState(false)
  if (open && !mounted) setMounted(true)
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) setLastOpenSnapshot(currentSnapshot)
  }
  const rendered = open ? currentSnapshot : lastOpenSnapshot
  const renderedHasFooter = Boolean(rendered.footer)
  const renderedHasSubtitle = Boolean(rendered.subtitle)
  const closing = !open
  const shouldRender = open || mounted
  const renderedContentStyle: ModalSheetStyle | undefined = closing ? { ...rendered.contentStyle, pointerEvents: 'none' } : rendered.contentStyle
  const isDesktopModalLayout = useDesktopModalLayout()
  const showDragHandle = !isDesktopModalLayout
  const setBodyRefs = useCallback((node: HTMLDivElement | null) => {
    if (bodyRef.current !== node) setBodyRefVersion((current) => current + 1)
    bodyRef.current = node
    assignRef(bodyElementRef, node)
  }, [bodyElementRef])

  const requestClose = () => {
    closeRequestedAtRef.current = window.performance.now()
    setRapidReopen(true)
    setLastOpenSnapshot(currentSnapshot)
    onClose()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return
    if (open && window.performance.now() < ignoreInternalCloseUntilRef.current) return
    requestClose()
  }

  useLayoutEffect(() => {
    if (open) {
      const now = window.performance.now()
      const reopenedDuringExit = closeWasWithinExitAnimation(closeRequestedAtRef.current)
      ignoreInternalCloseUntilRef.current = reopenedDuringExit ? now + RECENT_OPEN_INTERNAL_CLOSE_GUARD_MS : 0
      if (reopenedDuringExit && contentRef.current) clearVaulDragStyles(contentRef.current)
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setRapidReopen(false)
      setMounted(false)
    }, MODAL_SHEET_EXIT_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return

    const timeout = window.setTimeout(() => {
      const content = contentRef.current
      if (!content?.getAnimations) return

      for (const animation of content.getAnimations({ subtree: false })) {
        if (animation.playState === 'running' && animation.startTime === null && animation.currentTime === 0) {
          animation.finish()
        }
      }
    }, 120)

    return () => window.clearTimeout(timeout)
  }, [open])

  useLayoutEffect(() => {
    if (!closing || typeof document === 'undefined') return
    document.body.style.pointerEvents = 'auto'
  }, [closing])

  useLayoutEffect(() => {
    if (!open) return
    if (!bodyRef.current) return
    bodyRef.current.scrollTop = 0
  }, [open, scrollResetKey])

  useLayoutEffect(() => {
    if (!open) return undefined
    const body = bodyRef.current
    if (!body) return undefined

    const syncGestureArbitration = () => {
      const scrollable = body.scrollHeight > body.clientHeight + 1
      const scrollableValue = scrollable ? 'true' : 'false'
      // Safari can expose elastic negative scrollTop; normalize it to Vaul's exact top sentinel.
      if (body.scrollTop < 0) body.scrollTop = 0
      // pan-down lets upward finger motion scroll while reserving a downward pull at the top for Vaul.
      const touchAction = !scrollable ? 'none' : body.scrollTop === 0 ? 'pan-down' : 'pan-y'
      if (body.dataset.modalSheetScrollable !== scrollableValue) body.dataset.modalSheetScrollable = scrollableValue
      if (body.style.touchAction !== touchAction) body.style.touchAction = touchAction
    }

    const syncVisibleHeight = () => {
      const computed = window.getComputedStyle(body)
      const verticalPadding = parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0')
      const visibleHeight = `${body.clientHeight}px`
      const contentHeight = `${Math.max(0, body.clientHeight - (Number.isFinite(verticalPadding) ? verticalPadding : 0))}px`
      if (body.style.getPropertyValue('--modal-body-visible-height') !== visibleHeight) body.style.setProperty('--modal-body-visible-height', visibleHeight)
      if (body.style.getPropertyValue('--modal-body-content-height') !== contentHeight) body.style.setProperty('--modal-body-content-height', contentHeight)
      syncGestureArbitration()
    }

    syncVisibleHeight()
    window.addEventListener('resize', syncVisibleHeight)
    const clearBodyGestureStyles = () => {
      delete body.dataset.modalSheetScrollable
      body.style.removeProperty('touch-action')
    }
    let mutationFrame: number | null = null
    const scheduleVisibleHeightSync = () => {
      if (mutationFrame !== null) return
      mutationFrame = window.requestAnimationFrame(() => {
        mutationFrame = null
        syncVisibleHeight()
      })
    }
    const mutationObserver = typeof window.MutationObserver === 'undefined'
      ? null
      : new window.MutationObserver((records) => {
          if (records.some((record) => record.type !== 'attributes' || record.target !== body)) scheduleVisibleHeightSync()
        })
    mutationObserver?.observe(body, {
      attributeFilter: ['aria-expanded', 'class', 'hidden', 'open', 'style'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })
    body.addEventListener('load', syncVisibleHeight, true)
    body.addEventListener('scroll', syncGestureArbitration, { passive: true })
    const cleanupBodyObservers = () => {
      if (mutationFrame !== null) window.cancelAnimationFrame(mutationFrame)
      mutationObserver?.disconnect()
      body.removeEventListener('load', syncVisibleHeight, true)
      body.removeEventListener('scroll', syncGestureArbitration)
      clearBodyGestureStyles()
      window.removeEventListener('resize', syncVisibleHeight)
    }

    const ResizeObserverConstructor = window.ResizeObserver
    if (typeof ResizeObserverConstructor === 'undefined') {
      return cleanupBodyObservers
    }

    const observer = new ResizeObserverConstructor(syncVisibleHeight)
    observer.observe(body)
    return () => {
      observer.disconnect()
      cleanupBodyObservers()
    }
  }, [bodyRefVersion, open, rendered.contentStyle, renderedHasFooter, renderedHasSubtitle])

  if (!shouldRender) return null

  return (
    <Drawer.Root handleOnly={isDesktopModalLayout} modal={false} open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        {open && <div className={styles.overlay} data-modal-sheet-overlay="true" onPointerDown={(event) => {
          if (event.currentTarget === event.target) requestClose()
        }} />}
        <Drawer.Content
          ref={contentRef}
          className={styles.content}
          data-closing={closing ? 'true' : 'false'}
          data-has-footer={renderedHasFooter ? 'true' : 'false'}
          data-has-body-header={rendered.bodyHeader ? 'true' : 'false'}
          data-has-subtitle={renderedHasSubtitle ? 'true' : 'false'}
          data-rapid-reopen={rapidReopen ? 'true' : 'false'}
          data-surface="hass-popup"
          inert={closing ? true : undefined}
          onPointerCancel={() => {
            if (open && contentRef.current) clearVaulDragStyles(contentRef.current)
          }}
          style={renderedContentStyle}
        >
          {showDragHandle && <Drawer.Handle className={styles.handle} data-mobile-drag-handle="true" />}
          <div className={styles.header}>
            <div className={styles.headingGroup}>
              {rendered.onBack && (
                <button aria-label={rendered.backLabel} className={styles.back} onClick={rendered.onBack} type="button">
                  <MaterialIcon name="mdi:chevron-left" size={22} />
                </button>
              )}
              <div className={styles.titleBlock}>
                <Drawer.Title className={styles.title}>{rendered.title}</Drawer.Title>
                {rendered.subtitle && <p className={styles.subtitle}>{rendered.subtitle}</p>}
              </div>
            </div>
            <Drawer.Description className={styles.description}>{rendered.subtitle
              ? copy('modal.descriptionWithSubtitle', { subtitle: rendered.subtitle, title: rendered.title })
              : copy('modal.description', { title: rendered.title })}</Drawer.Description>
            <button className={styles.close} aria-label={copy('modal.close')} onClick={requestClose} type="button">
              <MaterialIcon name="mdi:close" size={19} />
            </button>
          </div>
          {rendered.bodyHeader && <div className={styles.bodyHeader} data-modal-sheet-body-header="true">{rendered.bodyHeader}</div>}
          <div className={styles.body} data-modal-sheet-body="true" ref={setBodyRefs}>{rendered.children}</div>
          {rendered.footer && <div className={styles.footer} data-modal-sheet-footer="true">{rendered.footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}