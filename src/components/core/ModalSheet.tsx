import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { MaterialIcon } from './Icon'
import { useCopy } from '../../i18n'
import { useModalBackdropBands } from '../../hooks/useModalBackdropBands'
import styles from './ModalSheet.module.css'

export type ModalSheetStyle = CSSProperties & {
  [key: `--${string}`]: string | number | undefined
}

export type ModalSheetSize = 'compact' | 'form' | 'media' | 'standard' | 'workspace'
export type ModalSheetScrollMode = 'body' | 'panes'
export type ModalSheetBackdropPolicy = 'auto' | 'full'

export interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  backdropPolicy?: ModalSheetBackdropPolicy
  children: ReactNode
  backLabel?: string
  bodyElementRef?: Ref<HTMLDivElement>
  bodyHeader?: ReactNode
  contentStyle?: ModalSheetStyle
  footer?: ReactNode
  navigation?: ReactNode
  onBack?: () => void
  scrollMode?: ModalSheetScrollMode
  scrollResetKey?: string | number | boolean
  size?: ModalSheetSize
  surfaceDecoration?: ReactNode
  surfaceDecorationOccludesBackdrop?: boolean
  subtitle?: string
}

type ModalSheetSnapshot = Pick<ModalSheetProps, 'backLabel' | 'backdropPolicy' | 'bodyHeader' | 'children' | 'contentStyle' | 'footer' | 'navigation' | 'onBack' | 'scrollMode' | 'scrollResetKey' | 'size' | 'subtitle' | 'surfaceDecoration' | 'surfaceDecorationOccludesBackdrop' | 'title'>
export const MODAL_SHEET_EXIT_ANIMATION_MS = 520
export const MODAL_SHEET_CENTERED_QUERY = '(min-width: 760px) and (min-height: 560px)'

function centeredModalLayoutMatches() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MODAL_SHEET_CENTERED_QUERY).matches
}

function useCenteredModalLayout() {
  const [isCenteredModalLayout, setIsCenteredModalLayout] = useState(centeredModalLayoutMatches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(MODAL_SHEET_CENTERED_QUERY)
    const syncLayout = () => setIsCenteredModalLayout(mediaQuery.matches)
    syncLayout()
    mediaQuery.addEventListener('change', syncLayout)
    return () => mediaQuery.removeEventListener('change', syncLayout)
  }, [])

  return isCenteredModalLayout
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

function previewModalBackdropPolicy(policy: ModalSheetBackdropPolicy) {
  if (import.meta.env.MODE === 'production' || typeof window === 'undefined') return policy
  return new URLSearchParams(window.location.search).get('modalBackdrop') === 'full' ? 'full' : policy
}

function automaticBackdropSupported(snapshot: ModalSheetSnapshot) {
  if (snapshot.contentStyle && Object.keys(snapshot.contentStyle).some((property) => !property.startsWith('--'))) {
    return false
  }
  return snapshot.contentStyle?.['--color-modal-surface'] === undefined
    || snapshot.surfaceDecorationOccludesBackdrop === true
}

function modalBackdropStyle(contentStyle: ModalSheetStyle | undefined): ModalSheetStyle | undefined {
  if (!contentStyle) return undefined
  const height = contentStyle['--modal-mobile-height']
  const maxHeight = contentStyle['--modal-mobile-max-height']
  if (height === undefined && maxHeight === undefined) return undefined
  return {
    '--modal-mobile-height': height,
    '--modal-mobile-max-height': maxHeight,
  }
}

// Base UI arbitrates native nested scrolling and dismissal before React's delegated touch handlers.
export function ModalSheet({
  open,
  title,
  onClose,
  children,
  backLabel,
  backdropPolicy = 'auto',
  bodyElementRef,
  bodyHeader,
  contentStyle,
  footer,
  navigation,
  onBack,
  scrollMode = 'body',
  scrollResetKey,
  size = 'standard',
  surfaceDecoration,
  surfaceDecorationOccludesBackdrop = false,
  subtitle,
}: ModalSheetProps) {
  const copy = useCopy('core')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [bodyRefVersion, setBodyRefVersion] = useState(0)
  const currentSnapshot: ModalSheetSnapshot = {
    backLabel: backLabel ?? copy('modal.back'),
    backdropPolicy: previewModalBackdropPolicy(backdropPolicy),
    bodyHeader,
    children,
    contentStyle,
    footer,
    navigation,
    onBack,
    scrollMode,
    scrollResetKey,
    size,
    subtitle,
    surfaceDecoration,
    surfaceDecorationOccludesBackdrop,
    title,
  }
  const [lastOpenSnapshot, setLastOpenSnapshot] = useState<ModalSheetSnapshot>(currentSnapshot)
  const [mounted, setMounted] = useState(open)
  const [initialStarting, setInitialStarting] = useState(open)
  const [previousOpen, setPreviousOpen] = useState(open)
  const [rapidReopen, setRapidReopen] = useState(false)
  const [rapidReopenPending, setRapidReopenPending] = useState(false)
  const [inputShielded, setInputShielded] = useState(false)
  const inputShieldFrameRef = useRef<number | null>(null)
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
  const renderedHasNavigation = Boolean(rendered.navigation)
  const renderedHasSubtitle = Boolean(rendered.subtitle)
  const closing = !open
  const shouldRender = open || mounted

  useEffect(() => {
    if (!initialStarting) return
    const frame = requestAnimationFrame(() => setInitialStarting(false))
    return () => cancelAnimationFrame(frame)
  }, [initialStarting])
  const renderedContentStyle: ModalSheetStyle = {
    '--modal-surface-backing': rendered.contentStyle?.['--color-modal-surface'] === undefined
      ? 'var(--rd-modal-surface-opaque)'
      : undefined,
    ...rendered.contentStyle,
    ...(closing ? { pointerEvents: 'none' } : {}),
  }
  const isCenteredModalLayout = useCenteredModalLayout()
  const renderedBackdropPolicy: ModalSheetBackdropPolicy = rendered.backdropPolicy === 'auto' && automaticBackdropSupported(rendered)
    ? 'auto'
    : 'full'
  const renderBackdropBands = renderedBackdropPolicy === 'auto'
  const renderedBackdropStyle = modalBackdropStyle(rendered.contentStyle)
  const { contentRef: backdropContentRef, overlayRef: backdropOverlayRef } = useModalBackdropBands(Boolean(
    open
    && renderBackdropBands
    && !closing
    && !initialStarting
    && !rapidReopen
    && !isCenteredModalLayout,
  ))
  const showDragHandle = !isCenteredModalLayout
  const setBodyRefs = useCallback((node: HTMLDivElement | null) => {
    if (bodyRef.current !== node) setBodyRefVersion((current) => current + 1)
    bodyRef.current = node
    assignRef(bodyElementRef, node)
  }, [bodyElementRef])

  const requestClose = () => {
    if (inputShieldFrameRef.current !== null) window.cancelAnimationFrame(inputShieldFrameRef.current)
    setInputShielded(true)
    inputShieldFrameRef.current = window.requestAnimationFrame(() => {
      inputShieldFrameRef.current = null
      setInputShielded(false)
    })
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

  useEffect(() => {
    return () => {
      if (inputShieldFrameRef.current !== null) window.cancelAnimationFrame(inputShieldFrameRef.current)
    }
  }, [])

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
  }, [bodyRefVersion, open, rendered.contentStyle, rendered.scrollMode, rendered.size, renderedHasFooter, renderedHasNavigation, renderedHasSubtitle])

  return (
    <Drawer.Root disablePointerDismissal modal="trap-focus" open={open} onOpenChange={handleOpenChange} swipeDirection="down">
      {shouldRender && (
        <Drawer.Portal keepMounted>
          <Drawer.Backdrop
            className={styles.overlay}
            data-backdrop-policy={renderedBackdropPolicy}
            data-closing={closing ? 'true' : 'false'}
            data-input-shielded={inputShielded ? 'true' : undefined}
            data-initial-starting-style={initialStarting ? 'true' : undefined}
            data-modal-sheet-overlay="true"
            data-rapid-reopen={rapidReopen ? 'true' : undefined}
            hidden={false}
            onClick={(event) => {
              if (event.currentTarget !== event.target) return
              event.preventDefault()
              event.stopPropagation()
              requestClose()
            }}
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) event.stopPropagation()
            }}
            onPointerUp={(event) => {
              if (event.currentTarget === event.target) event.stopPropagation()
            }}
            ref={backdropOverlayRef}
            style={renderedBackdropStyle}
          >
            {renderBackdropBands ? (
              <span aria-hidden="true" className={styles.backdropBandLayer} data-modal-backdrop-layer="true">
                <span aria-hidden="true" className={styles.overlayBand} data-modal-backdrop-band="top" />
                <span aria-hidden="true" className={styles.backdropGeometryProxy} data-modal-backdrop-proxy="true">
                  <span aria-hidden="true" className={styles.overlayBand} data-modal-backdrop-band="left" />
                  <span aria-hidden="true" className={styles.overlayBand} data-modal-backdrop-band="right" />
                  <span aria-hidden="true" className={styles.overlayBand} data-modal-backdrop-band="bottom" />
                </span>
              </span>
            ) : null}
            {renderBackdropBands && <span aria-hidden="true" className={styles.backdropScrim} data-modal-backdrop-scrim="true" />}
          </Drawer.Backdrop>
          <Drawer.Viewport className={styles.viewport} hidden={false}>
            <Drawer.Popup
              className={styles.content}
              data-backdrop-policy={renderedBackdropPolicy}
              data-centered-layout={isCenteredModalLayout ? 'true' : 'false'}
              data-closing={closing ? 'true' : 'false'}
              data-has-footer={renderedHasFooter ? 'true' : 'false'}
              data-has-navigation={renderedHasNavigation ? 'true' : 'false'}
              data-has-body-header={rendered.bodyHeader ? 'true' : 'false'}
              data-has-subtitle={renderedHasSubtitle ? 'true' : 'false'}
              data-has-surface-decoration={rendered.surfaceDecoration ? 'true' : 'false'}
              data-initial-starting-style={initialStarting ? 'true' : undefined}
              data-rapid-reopen={rapidReopen ? 'true' : 'false'}
              data-state={open ? 'open' : 'closed'}
              data-scroll-mode={rendered.scrollMode}
              data-size={rendered.size}
              data-surface="hass-popup"
              hidden={false}
              inert={closing ? true : undefined}
              initialFocus={false}
              ref={backdropContentRef}
              style={renderedContentStyle}
            >
              {rendered.surfaceDecoration && (
                <div
                  aria-hidden="true"
                  className={styles.surfaceDecoration}
                  data-modal-backdrop-occluder={rendered.surfaceDecorationOccludesBackdrop ? 'opaque' : undefined}
                  data-modal-sheet-surface-decoration="true"
                >
                  {rendered.surfaceDecoration}
                </div>
              )}
              <Drawer.Content className={styles.contentLayout} data-base-ui-swipe-ignore={isCenteredModalLayout ? 'true' : undefined}>
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
                {rendered.navigation && <div className={styles.navigation} data-modal-sheet-navigation="true">{rendered.navigation}</div>}
                {rendered.footer && <div className={styles.footer} data-modal-sheet-footer="true">{rendered.footer}</div>}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      )}
    </Drawer.Root>
  )
}