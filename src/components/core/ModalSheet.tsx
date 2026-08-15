import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Drawer } from '@base-ui/react/drawer'
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
export const MODAL_SHEET_EXIT_ANIMATION_MS = 520

function desktopModalLayoutMatches() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 760px)').matches
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

// Base UI arbitrates native nested scrolling and dismissal before React's delegated touch handlers.
export function ModalSheet({ open, title, onClose, children, backLabel, bodyElementRef, bodyHeader, contentStyle, footer, onBack, scrollResetKey, subtitle }: ModalSheetProps) {
  const copy = useCopy('core')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [bodyRefVersion, setBodyRefVersion] = useState(0)
  const currentSnapshot: ModalSheetSnapshot = { backLabel: backLabel ?? copy('modal.back'), bodyHeader, children, contentStyle, footer, onBack, scrollResetKey, subtitle, title }
  const [lastOpenSnapshot, setLastOpenSnapshot] = useState<ModalSheetSnapshot>(currentSnapshot)
  const [mounted, setMounted] = useState(open)
  const [previousOpen, setPreviousOpen] = useState(open)
  const [rapidReopen, setRapidReopen] = useState(false)
  const [rapidReopenPending, setRapidReopenPending] = useState(false)
  if (open && !mounted) setMounted(true)
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) {
      setLastOpenSnapshot(currentSnapshot)
      setRapidReopen(rapidReopenPending)
      setRapidReopenPending(false)
    }
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
    setRapidReopen(false)
    setRapidReopenPending(true)
    setLastOpenSnapshot(currentSnapshot)
    onClose()
  }

  const handleOpenChange: NonNullable<Drawer.Root.Props['onOpenChange']> = (nextOpen) => {
    if (nextOpen) return
    if (open) requestClose()
  }

  useLayoutEffect(() => {
    if (!closing || typeof document === 'undefined') return
    document.body.style.pointerEvents = 'auto'
  }, [closing])

  useLayoutEffect(() => {
    if (open) return undefined
    const timeout = window.setTimeout(() => {
      setRapidReopen(false)
      setRapidReopenPending(false)
      setMounted(false)
    }, MODAL_SHEET_EXIT_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !rapidReopen) return undefined
    let resetFrame = 0
    const settleFrame = window.requestAnimationFrame(() => {
      resetFrame = window.requestAnimationFrame(() => setRapidReopen(false))
    })
    return () => {
      window.cancelAnimationFrame(settleFrame)
      if (resetFrame) window.cancelAnimationFrame(resetFrame)
    }
  }, [open, rapidReopen])

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
      const visibleHeight = `${body.clientHeight}px`
      const contentHeight = `${Math.max(0, body.clientHeight - (Number.isFinite(verticalPadding) ? verticalPadding : 0))}px`
      if (body.style.getPropertyValue('--modal-body-visible-height') !== visibleHeight) body.style.setProperty('--modal-body-visible-height', visibleHeight)
      if (body.style.getPropertyValue('--modal-body-content-height') !== contentHeight) body.style.setProperty('--modal-body-content-height', contentHeight)
    }

    syncVisibleHeight()
    window.addEventListener('resize', syncVisibleHeight)
    body.addEventListener('load', syncVisibleHeight, true)
    const cleanupBodyObservers = () => {
      body.removeEventListener('load', syncVisibleHeight, true)
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
    <Drawer.Root disablePointerDismissal modal="trap-focus" open={open} onOpenChange={handleOpenChange} swipeDirection="down">
      <Drawer.Portal keepMounted>
        <Drawer.Backdrop className={styles.overlay} data-closing={closing ? 'true' : 'false'} data-modal-sheet-overlay="true" hidden={false} onPointerDown={(event) => {
          if (event.currentTarget === event.target) requestClose()
        }} />
        <Drawer.Viewport className={styles.viewport} hidden={false}>
          <Drawer.Popup
            className={styles.content}
            data-closing={closing ? 'true' : 'false'}
            data-has-footer={renderedHasFooter ? 'true' : 'false'}
            data-has-body-header={rendered.bodyHeader ? 'true' : 'false'}
            data-has-subtitle={renderedHasSubtitle ? 'true' : 'false'}
            data-rapid-reopen={rapidReopen ? 'true' : 'false'}
            data-state={open ? 'open' : 'closed'}
            data-surface="hass-popup"
            hidden={false}
            inert={closing ? true : undefined}
            initialFocus={false}
            style={renderedContentStyle}
          >
            <Drawer.Content className={styles.contentLayout} data-base-ui-swipe-ignore={isDesktopModalLayout ? 'true' : undefined}>
              {showDragHandle && <div className={styles.handle} data-mobile-drag-handle="true" />}
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
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}