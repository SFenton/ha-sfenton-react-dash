import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { MaterialIcon } from './Icon'
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
  bodyHeader?: ReactNode
  chrome?: 'default' | 'source-popup'
  contentStyle?: ModalSheetStyle
  footer?: ReactNode
  onBack?: () => void
  scrollResetKey?: string | number | boolean
  subtitle?: string
  surface?: 'hass-popup'
}

type ModalSheetSnapshot = Pick<ModalSheetProps, 'backLabel' | 'bodyHeader' | 'children' | 'chrome' | 'contentStyle' | 'footer' | 'onBack' | 'scrollResetKey' | 'subtitle' | 'title'>
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

export function ModalSheet({ open, title, onClose, children, backLabel = 'Back', bodyHeader, chrome = 'default', contentStyle, footer, onBack, scrollResetKey, subtitle }: ModalSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const closeRequestedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const ignoreInternalCloseUntilRef = useRef(0)
  const currentSnapshot: ModalSheetSnapshot = { backLabel, bodyHeader, children, chrome, contentStyle, footer, onBack, scrollResetKey, subtitle, title }
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
  const closing = !open
  const shouldRender = open || mounted
  const renderedContentStyle: ModalSheetStyle | undefined = closing ? { ...rendered.contentStyle, pointerEvents: 'none' } : rendered.contentStyle
  const sourcePopup = rendered.chrome === 'source-popup'
  const isDesktopModalLayout = useDesktopModalLayout()
  const showDragHandle = !sourcePopup && !isDesktopModalLayout

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
      ignoreInternalCloseUntilRef.current = closeWasWithinExitAnimation(closeRequestedAtRef.current) ? now + RECENT_OPEN_INTERNAL_CLOSE_GUARD_MS : 0
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

    const syncVisibleHeight = () => {
      const computed = window.getComputedStyle(body)
      const verticalPadding = parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0')
      body.style.setProperty('--modal-body-visible-height', `${body.clientHeight}px`)
      body.style.setProperty('--modal-body-content-height', `${Math.max(0, body.clientHeight - (Number.isFinite(verticalPadding) ? verticalPadding : 0))}px`)
    }

    syncVisibleHeight()
    window.addEventListener('resize', syncVisibleHeight)

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', syncVisibleHeight)
    }

    const observer = new ResizeObserver(syncVisibleHeight)
    observer.observe(body)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncVisibleHeight)
    }
  }, [open, rendered.contentStyle, rendered.footer, rendered.subtitle])

  if (!shouldRender) return null

  return (
    <Drawer.Root handleOnly modal={false} open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        {open && <div className={styles.overlay} data-modal-sheet-overlay="true" onPointerDown={(event) => {
          if (event.currentTarget === event.target) requestClose()
        }} />}
        <Drawer.Content
          ref={contentRef}
          className={styles.content}
          data-chrome={rendered.chrome}
          data-closing={closing ? 'true' : 'false'}
          data-has-footer={rendered.footer ? 'true' : 'false'}
          data-has-body-header={rendered.bodyHeader ? 'true' : 'false'}
          data-has-subtitle={rendered.subtitle ? 'true' : 'false'}
          data-rapid-reopen={rapidReopen ? 'true' : 'false'}
          data-surface="hass-popup"
          inert={closing ? true : undefined}
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
            <Drawer.Description className={styles.description}>{rendered.subtitle ? `${rendered.title}: ${rendered.subtitle}` : `${rendered.title} controls and status details`}</Drawer.Description>
            <button className={styles.close} aria-label="Close" onClick={requestClose} type="button">
              <MaterialIcon name="mdi:close" size={sourcePopup ? 30 : 19} />
            </button>
          </div>
          {rendered.bodyHeader && <div className={styles.bodyHeader} data-modal-sheet-body-header="true">{rendered.bodyHeader}</div>}
          <div className={styles.body} data-modal-sheet-body="true" ref={bodyRef}>{rendered.children}</div>
          {rendered.footer && <div className={styles.footer}>{rendered.footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}