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
  chrome?: 'default' | 'source-popup'
  contentStyle?: ModalSheetStyle
  footer?: ReactNode
  subtitle?: string
  surface?: 'hass-popup'
}

type ModalSheetSnapshot = Pick<ModalSheetProps, 'children' | 'chrome' | 'contentStyle' | 'footer' | 'subtitle' | 'title'>

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

export function ModalSheet({ open, title, onClose, children, chrome = 'default', contentStyle, footer, subtitle }: ModalSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const currentSnapshot: ModalSheetSnapshot = { children, chrome, contentStyle, footer, subtitle, title }
  const [lastOpenSnapshot, setLastOpenSnapshot] = useState<ModalSheetSnapshot>(currentSnapshot)
  const rendered = open ? currentSnapshot : lastOpenSnapshot
  const closing = !open
  const renderedContentStyle: ModalSheetStyle | undefined = closing ? { ...rendered.contentStyle, pointerEvents: 'none' } : rendered.contentStyle
  const sourcePopup = rendered.chrome === 'source-popup'
  const isDesktopModalLayout = useDesktopModalLayout()
  const showDragHandle = !sourcePopup && !isDesktopModalLayout

  const requestClose = () => {
    setLastOpenSnapshot(currentSnapshot)
    onClose()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return
    requestClose()
  }

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
          data-has-subtitle={rendered.subtitle ? 'true' : 'false'}
          data-surface="hass-popup"
          inert={closing ? true : undefined}
          style={renderedContentStyle}
        >
          {showDragHandle && <Drawer.Handle className={styles.handle} data-mobile-drag-handle="true" />}
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <Drawer.Title className={styles.title}>{rendered.title}</Drawer.Title>
              {rendered.subtitle && <p className={styles.subtitle}>{rendered.subtitle}</p>}
            </div>
            <Drawer.Description className={styles.description}>{rendered.subtitle ? `${rendered.title}: ${rendered.subtitle}` : `${rendered.title} controls and status details`}</Drawer.Description>
            <button className={styles.close} aria-label="Close" onClick={requestClose} type="button">
              <MaterialIcon name="mdi:close" size={sourcePopup ? 30 : 19} />
            </button>
          </div>
          <div className={styles.body}>{rendered.children}</div>
          {rendered.footer && <div className={styles.footer}>{rendered.footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}