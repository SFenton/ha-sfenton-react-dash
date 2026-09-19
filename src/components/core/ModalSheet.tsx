import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { MaterialIcon } from './Icon'
import { useCopy } from '../../i18n'
import { useModalBackdropBands } from '../../hooks/useModalBackdropBands'
import {
  armDashboardKeyboardPrediction,
  isDashboardKeyboardInput,
} from '../../hooks/useDashboardViewport'
import {
  modalBodyTierForInlineSize,
  useModalSheetPresentation,
  type ModalBodyTier,
} from './modalSheetPresentation'
import styles from './ModalSheet.module.css'

export type ModalSheetStyle = CSSProperties & {
  [key: `--${string}`]: string | number | undefined
  aspectRatio?: never
  height?: never
  maxHeight?: never
  maxWidth?: never
  minHeight?: never
  minWidth?: never
  width?: never
  '--modal-desktop-height'?: never
  '--modal-desktop-max-height'?: never
  '--modal-desktop-max-width'?: never
  '--modal-desktop-width'?: never
}

export type ModalSheetSize = 'compact' | 'form' | 'media' | 'standard' | 'workspace'
export type ModalSheetScrollMode = 'body' | 'panes'
export type ModalSheetBackdropPolicy = 'auto' | 'full'
export type ModalLandscapeDensity = 'compact' | 'regular'
export type ModalContentWidth = 'readable' | 'full'
/** Family reading measure and identity; the shared presentation owns the outer frame. */
export type ModalCenteredGeometry = {
  id: string
  inlineSize: string
  maxInlineSize?: string
} & (
  | {
      blockPolicy: 'content-fit'
      blockSize?: never
      maxBlockSize?: string
    }
  | {
      blockPolicy: 'fixed'
      blockSize: string
      maxBlockSize?: string
    }
)

export interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  backdropPolicy?: ModalSheetBackdropPolicy
  onCloseComplete?: () => void
  retainLatestOnControlledClose?: boolean
  children: ReactNode
  backLabel?: string
  bodyElementRef?: Ref<HTMLDivElement>
  bodyHeader?: ReactNode
  centeredGeometry?: ModalCenteredGeometry
  contentStyle?: ModalSheetStyle
  contentWidth?: ModalContentWidth
  footer?: ReactNode
  headerActions?: ReactNode
  landscapeDensity?: ModalLandscapeDensity
  navigation?: ReactNode
  onBack?: () => void
  scrollMode?: ModalSheetScrollMode
  scrollResetKey?: string | number | boolean
  size?: ModalSheetSize
  surfaceDecoration?: ReactNode
  surfaceDecorationOccludesBackdrop?: boolean
  subtitle?: string
}

type ModalSheetSnapshot = Pick<ModalSheetProps, 'backLabel' | 'backdropPolicy' | 'bodyHeader' | 'centeredGeometry' | 'children' | 'contentStyle' | 'contentWidth' | 'footer' | 'headerActions' | 'landscapeDensity' | 'navigation' | 'onBack' | 'scrollMode' | 'scrollResetKey' | 'size' | 'subtitle' | 'surfaceDecoration' | 'surfaceDecorationOccludesBackdrop' | 'title'>
interface ModalCenteredGeometrySnapshot {
  centeredGeometry: ModalCenteredGeometry
  size: ModalSheetSize
}
export const MODAL_SHEET_EXIT_ANIMATION_MS = 520
const PREVENT_SCROLL_INPUT_TYPES = new Set([
  '',
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
])

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

function focusKeyboardInputWithoutScroll(target: EventTarget | null) {
  if (
    target instanceof HTMLTextAreaElement
    || (
      target instanceof HTMLInputElement
      && PREVENT_SCROLL_INPUT_TYPES.has(target.getAttribute('type')?.toLowerCase() ?? '')
    )
    || (target instanceof HTMLElement && target.isContentEditable)
  ) {
    target.focus({ preventScroll: true })
    return true
  }
  return false
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

function modalBackdropStyle(
  contentStyle: ModalSheetStyle | undefined,
  keyboardSurfaceBlockSize: string | null,
): ModalSheetStyle | undefined {
  const height = contentStyle?.['--modal-mobile-height']
  const maxHeight = contentStyle?.['--modal-mobile-max-height']
  if (height === undefined && maxHeight === undefined && keyboardSurfaceBlockSize === null) return undefined
  return {
    '--modal-mobile-height': height,
    '--modal-mobile-max-height': maxHeight,
    '--modal-keyboard-surface-block-size': keyboardSurfaceBlockSize ?? undefined,
  }
}

function modalContentStyle(
  contentStyle: ModalSheetStyle | undefined,
  geometrySnapshot: ModalCenteredGeometrySnapshot | null,
  closing: boolean,
  closingKeyboardInset: string | null,
  keyboardSurfaceBlockSize: string | null,
) {
  const resolved: ModalSheetStyle = {
    '--modal-surface-backing': contentStyle?.['--color-modal-surface'] === undefined
      ? 'var(--rd-modal-surface-opaque)'
      : undefined,
    ...contentStyle,
  }
  if (geometrySnapshot) {
    const { centeredGeometry } = geometrySnapshot
    resolved['--modal-centered-inline-size'] = centeredGeometry.inlineSize
    resolved['--modal-centered-max-inline-size'] = centeredGeometry.maxInlineSize ?? centeredGeometry.inlineSize
    resolved['--modal-centered-block-size'] = centeredGeometry.blockPolicy === 'fixed' ? centeredGeometry.blockSize : 'auto'
    resolved['--modal-centered-max-block-size'] = centeredGeometry.maxBlockSize
      ?? (centeredGeometry.blockPolicy === 'fixed' ? centeredGeometry.blockSize : undefined)
  }
  if (keyboardSurfaceBlockSize !== null) {
    resolved['--modal-keyboard-surface-block-size'] = keyboardSurfaceBlockSize
  }
  if (closing && closingKeyboardInset !== null) {
    resolved['--modal-keyboard-inset'] = closingKeyboardInset
  }
  if (closing) resolved.pointerEvents = 'none'
  return Object.keys(resolved).length > 0 ? resolved : undefined
}

// Base UI arbitrates native nested scrolling and dismissal before React's delegated touch handlers.
export function ModalSheet({
  open,
  title,
  onClose,
  onCloseComplete,
  retainLatestOnControlledClose = false,
  children,
  backLabel,
  backdropPolicy = 'auto',
  bodyElementRef,
  bodyHeader,
  centeredGeometry,
  contentStyle,
  contentWidth = 'readable',
  footer,
  headerActions,
  landscapeDensity = 'compact',
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
  const closeCompleteRef = useRef(onCloseComplete)
  useLayoutEffect(() => {
    closeCompleteRef.current = onCloseComplete
  }, [onCloseComplete])
  const [bodyRefVersion, setBodyRefVersion] = useState(0)
  const currentSnapshot: ModalSheetSnapshot = {
    backLabel: backLabel ?? copy('modal.back'),
    backdropPolicy: previewModalBackdropPolicy(backdropPolicy),
    bodyHeader,
    centeredGeometry,
    children,
    contentStyle,
    contentWidth,
    footer,
    headerActions,
    landscapeDensity,
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
  const currentCenteredGeometrySnapshot: ModalCenteredGeometrySnapshot | null = centeredGeometry
    ? { centeredGeometry, size }
    : null
  const [lastOpenSnapshot, setLastOpenSnapshot] = useState<ModalSheetSnapshot>(currentSnapshot)
  const [openCenteredGeometrySnapshot, setOpenCenteredGeometrySnapshot] = useState<ModalCenteredGeometrySnapshot | null>(currentCenteredGeometrySnapshot)
  const [mounted, setMounted] = useState(open)
  const [initialStarting, setInitialStarting] = useState(open)
  const [previousOpen, setPreviousOpen] = useState(open)
  const [rapidReopen, setRapidReopen] = useState(false)
  const [rapidReopenPending, setRapidReopenPending] = useState(false)
  const [closingKeyboardInset, setClosingKeyboardInset] = useState<string | null>(null)
  const [keyboardSurfaceBlockSize, setKeyboardSurfaceBlockSize] = useState<string | null>(null)
  const [keyboardLiftReady, setKeyboardLiftReady] = useState(false)
  const [inputShielded, setInputShielded] = useState(false)
  const inputShieldFrameRef = useRef<number | null>(null)
  const keyboardLiftPendingRef = useRef(false)
  const currentPresentation = useModalSheetPresentation()
  const [measuredBodyTier, setMeasuredBodyTier] = useState<ModalBodyTier>('compact')
  const currentBodyTier = currentPresentation === 'sheet' ? 'compact' : measuredBodyTier
  const [lastOpenPresentation, setLastOpenPresentation] = useState(currentPresentation)
  const [lastOpenBodyTier, setLastOpenBodyTier] = useState(currentBodyTier)
  const opening = open && open !== previousOpen
  const geometryIdentityChanged = Boolean(
    open
    && currentCenteredGeometrySnapshot
    && openCenteredGeometrySnapshot
    && currentCenteredGeometrySnapshot.centeredGeometry.id !== openCenteredGeometrySnapshot.centeredGeometry.id,
  )
  if (open && !mounted) setMounted(true)
  if (open && currentPresentation !== lastOpenPresentation) {
    setLastOpenPresentation(currentPresentation)
  }
  if (open && currentBodyTier !== lastOpenBodyTier) {
    setLastOpenBodyTier(currentBodyTier)
  }
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) {
      setLastOpenSnapshot(currentSnapshot)
      setOpenCenteredGeometrySnapshot(currentCenteredGeometrySnapshot)
      setRapidReopen(rapidReopenPending)
      setRapidReopenPending(false)
      setClosingKeyboardInset(null)
      setKeyboardSurfaceBlockSize(null)
      setKeyboardLiftReady(false)
    } else {
      setClosingKeyboardInset(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--dashboard-keyboard-overlay-inset')
          .trim() || '0px',
      )
    }
  }
  if (geometryIdentityChanged) setOpenCenteredGeometrySnapshot(currentCenteredGeometrySnapshot)
  if (retainLatestOnControlledClose && open && (Object.keys(currentSnapshot) as (keyof ModalSheetSnapshot)[])
    .some(key => !Object.is(currentSnapshot[key], lastOpenSnapshot[key]))) {
    setLastOpenSnapshot(currentSnapshot)
  }
  const rendered = open ? currentSnapshot : lastOpenSnapshot
  const renderedHasFooter = Boolean(rendered.footer)
  const renderedHasNavigation = Boolean(rendered.navigation)
  const renderedHasSubtitle = Boolean(rendered.subtitle)
  const closing = !open
  const shouldRender = open || mounted
  const renderedPresentation = open ? currentPresentation : lastOpenPresentation
  const renderedBodyTier = open ? currentBodyTier : lastOpenBodyTier
  const renderedCenteredGeometrySnapshot = opening || geometryIdentityChanged
    ? currentCenteredGeometrySnapshot
    : openCenteredGeometrySnapshot
  const renderedCenteredGeometry = renderedCenteredGeometrySnapshot?.centeredGeometry
  const renderedSize = renderedCenteredGeometrySnapshot?.size ?? rendered.size
  const isDialogPresentation = renderedPresentation !== 'sheet'

  useEffect(() => {
    if (!initialStarting) return
    const frame = requestAnimationFrame(() => setInitialStarting(false))
    return () => cancelAnimationFrame(frame)
  }, [initialStarting])
  const renderedContentStyle = modalContentStyle(
    rendered.contentStyle,
    renderedCenteredGeometrySnapshot,
    closing,
    closingKeyboardInset,
    keyboardSurfaceBlockSize,
  )
  const renderedBackdropPolicy: ModalSheetBackdropPolicy = rendered.backdropPolicy === 'auto' && automaticBackdropSupported(rendered)
    ? 'auto'
    : 'full'
  const renderBackdropBands = renderedBackdropPolicy === 'auto'
  const renderedBackdropStyle = modalBackdropStyle(rendered.contentStyle, keyboardSurfaceBlockSize)
  const { contentRef: backdropContentRef, overlayRef: backdropOverlayRef } = useModalBackdropBands(Boolean(
    open
    && renderBackdropBands
    && !closing
    && !initialStarting
    && !rapidReopen
    && !isDialogPresentation,
  ))
  const showDragHandle = !isDialogPresentation
  const setBodyRefs = useCallback((node: HTMLDivElement | null) => {
    if (bodyRef.current !== node) setBodyRefVersion((current) => current + 1)
    bodyRef.current = node
    assignRef(bodyElementRef, node)
  }, [bodyElementRef])
  const requestClose = () => {
    keyboardLiftPendingRef.current = false
    if (inputShieldFrameRef.current !== null) window.cancelAnimationFrame(inputShieldFrameRef.current)
    setInputShielded(true)
    inputShieldFrameRef.current = window.requestAnimationFrame(() => {
      inputShieldFrameRef.current = null
      setInputShielded(false)
    })
    setRapidReopen(false)
    setRapidReopenPending(true)
    setKeyboardLiftReady(false)
    setClosingKeyboardInset(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--dashboard-keyboard-overlay-inset')
        .trim() || '0px',
    )
    setLastOpenSnapshot(currentSnapshot)
    setLastOpenPresentation(currentPresentation)
    setLastOpenBodyTier(currentBodyTier)
    onClose()
  }

  const handleOpenChange: NonNullable<Drawer.Root.Props['onOpenChange']> = (nextOpen, eventDetails) => {
    if (nextOpen) return
    const root = document.documentElement
    if (
      eventDetails.reason === 'swipe'
      && (
        root.getAttribute('data-dashboard-keyboard') === 'open'
        || root.getAttribute('data-dashboard-kb-arming') === 'true'
      )
    ) {
      eventDetails.cancel()
      return
    }
    if (open) requestClose()
  }

  useLayoutEffect(() => {
    if (open || !mounted) return undefined
    const timeout = window.setTimeout(() => {
      setRapidReopen(false)
      setRapidReopenPending(false)
      setMounted(false)
      closeCompleteRef.current?.()
    }, MODAL_SHEET_EXIT_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [mounted, open])

  useLayoutEffect(() => {
    if (!open || !rapidReopen) return undefined
    const timeout = window.setTimeout(() => setRapidReopen(false), MODAL_SHEET_EXIT_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [open, rapidReopen])

  useEffect(() => {
    const releaseKeyboardLift = () => {
      if (!keyboardLiftPendingRef.current) return
      keyboardLiftPendingRef.current = false
      setKeyboardLiftReady(true)
    }
    const resetKeyboardLift = () => {
      keyboardLiftPendingRef.current = false
      setKeyboardLiftReady(false)
    }
    window.addEventListener('pointerup', releaseKeyboardLift, true)
    window.addEventListener('touchend', releaseKeyboardLift, true)
    window.addEventListener('pointercancel', resetKeyboardLift, true)
    window.addEventListener('touchcancel', resetKeyboardLift, true)
    return () => {
      if (inputShieldFrameRef.current !== null) window.cancelAnimationFrame(inputShieldFrameRef.current)
      window.removeEventListener('pointerup', releaseKeyboardLift, true)
      window.removeEventListener('touchend', releaseKeyboardLift, true)
      window.removeEventListener('pointercancel', resetKeyboardLift, true)
      window.removeEventListener('touchcancel', resetKeyboardLift, true)
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
      const contentMeasure = body.querySelector<HTMLElement>('[data-modal-content-measure="true"]')
      const verticalPadding = parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0')
      const visibleHeight = `${body.clientHeight}px`
      const contentHeight = `${Math.max(0, body.clientHeight - (Number.isFinite(verticalPadding) ? verticalPadding : 0))}px`
      const contentInlineSize = Math.max(0, contentMeasure?.clientWidth ?? body.clientWidth)
      const contentInlineWidth = `${contentInlineSize}px`
      if (body.style.getPropertyValue('--modal-body-visible-height') !== visibleHeight) body.style.setProperty('--modal-body-visible-height', visibleHeight)
      if (body.style.getPropertyValue('--modal-body-content-height') !== contentHeight) body.style.setProperty('--modal-body-content-height', contentHeight)
      if (body.style.getPropertyValue('--modal-body-content-inline-size') !== contentInlineWidth) body.style.setProperty('--modal-body-content-inline-size', contentInlineWidth)
      setMeasuredBodyTier((current) => {
        const next = modalBodyTierForInlineSize(contentInlineSize)
        return current === next ? current : next
      })
    }

    syncVisibleHeight()
    window.addEventListener('resize', syncVisibleHeight)
    window.visualViewport?.addEventListener('resize', syncVisibleHeight)
    body.addEventListener('load', syncVisibleHeight, true)
    const cleanupBodyObservers = () => {
      body.removeEventListener('load', syncVisibleHeight, true)
      window.removeEventListener('resize', syncVisibleHeight)
      window.visualViewport?.removeEventListener('resize', syncVisibleHeight)
    }

    const ResizeObserverConstructor = window.ResizeObserver
    if (typeof ResizeObserverConstructor === 'undefined') {
      return cleanupBodyObservers
    }

    const observer = new ResizeObserverConstructor(syncVisibleHeight)
    observer.observe(body)
    const contentMeasure = body.querySelector<HTMLElement>('[data-modal-content-measure="true"]')
    if (contentMeasure) observer.observe(contentMeasure)
    return () => {
      observer.disconnect()
      cleanupBodyObservers()
    }
  }, [bodyRefVersion, open, rendered.contentStyle, rendered.contentWidth, rendered.landscapeDensity, rendered.scrollMode, renderedCenteredGeometry?.id, renderedHasFooter, renderedHasNavigation, renderedHasSubtitle, renderedPresentation, renderedSize])

  return (
    <Drawer.Root
      disablePointerDismissal
      modal="trap-focus"
      onOpenChange={handleOpenChange}
      open={open}
      swipeDirection="down"
    >
      {shouldRender && (
        <Drawer.Portal keepMounted>
          <Drawer.Backdrop
            className={styles.overlay}
            data-backdrop-policy={renderedBackdropPolicy}
            data-closing={closing ? 'true' : 'false'}
            data-input-shielded={inputShielded ? 'true' : undefined}
            data-initial-starting-style={initialStarting ? 'true' : undefined}
            data-modal-presentation={renderedPresentation}
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
          <Drawer.Viewport className={styles.viewport} data-modal-presentation={renderedPresentation} hidden={false}>
            <Drawer.Popup
              className={styles.content}
              data-backdrop-policy={renderedBackdropPolicy}
              data-centered-layout={isDialogPresentation ? 'true' : 'false'}
              data-closing={closing ? 'true' : 'false'}
              data-has-footer={renderedHasFooter ? 'true' : 'false'}
              data-has-navigation={renderedHasNavigation ? 'true' : 'false'}
              data-has-body-header={rendered.bodyHeader ? 'true' : 'false'}
              data-has-subtitle={renderedHasSubtitle ? 'true' : 'false'}
              data-has-surface-decoration={rendered.surfaceDecoration ? 'true' : 'false'}
              data-initial-starting-style={initialStarting ? 'true' : undefined}
              data-keyboard-lift-ready={keyboardLiftReady ? 'true' : undefined}
              data-landscape-density={rendered.landscapeDensity}
              data-modal-block-policy={renderedCenteredGeometry?.blockPolicy}
              data-rapid-reopen={rapidReopen ? 'true' : 'false'}
              data-modal-body-tier={renderedBodyTier}
              data-modal-content-width={rendered.contentWidth ?? 'readable'}
              data-modal-geometry-intent={renderedCenteredGeometry?.id}
              data-modal-presentation={renderedPresentation}
              data-state={open ? 'open' : 'closed'}
              data-scroll-mode={rendered.scrollMode}
              data-size={renderedSize}
              data-surface="hass-popup"
              hidden={false}
              inert={closing ? true : undefined}
              initialFocus={false}
              onPointerDownCapture={(event) => {
                if (isDashboardKeyboardInput(event.target)) {
                  event.currentTarget.removeAttribute('data-keyboard-lift-ready')
                  setKeyboardLiftReady(false)
                  keyboardLiftPendingRef.current = true
                  const blockSize = event.currentTarget.getBoundingClientRect().height
                  if (blockSize && blockSize > 0) {
                    setKeyboardSurfaceBlockSize(`${blockSize}px`)
                  }
                  armDashboardKeyboardPrediction()
                  if (document.activeElement !== event.target && focusKeyboardInputWithoutScroll(event.target)) {
                    event.preventDefault()
                  }
                }
              }}
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
              <Drawer.Content className={styles.contentLayout} data-base-ui-swipe-ignore={isDialogPresentation ? 'true' : undefined} data-modal-sheet-content-layout="true">
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
                  {rendered.headerActions && <div className={styles.headerActions} data-modal-sheet-header-actions="true">{rendered.headerActions}</div>}
                  <button className={styles.close} aria-label={copy('modal.close')} onClick={requestClose} type="button">
                    <MaterialIcon name="mdi:close" size={19} />
                  </button>
                </div>
                {rendered.bodyHeader && (
                  <div className={styles.bodyHeader} data-modal-sheet-body-header="true">
                    <div className={styles.regionMeasure}>{rendered.bodyHeader}</div>
                  </div>
                )}
                <div className={styles.body} data-modal-body-tier={renderedBodyTier} data-modal-sheet-body="true" ref={setBodyRefs}>
                  <div className={`${styles.regionMeasure} ${styles.bodyMeasure}`} data-modal-content-measure="true">{rendered.children}</div>
                </div>
                {rendered.navigation && (
                  <div className={styles.navigation} data-modal-sheet-navigation="true">
                    <div className={`${styles.regionMeasure} ${styles.navigationMeasure}`}>{rendered.navigation}</div>
                  </div>
                )}
                {rendered.footer && (
                  <div className={styles.footer} data-modal-sheet-footer="true">
                    <div className={styles.regionMeasure}>{rendered.footer}</div>
                  </div>
                )}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      )}
    </Drawer.Root>
  )
}