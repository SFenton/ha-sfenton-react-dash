import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  const sourcePopup = rendered.chrome === 'source-popup'
  const isDesktopModalLayout = useDesktopModalLayout()
  const showDragHandle = !sourcePopup && !isDesktopModalLayout

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return
    setLastOpenSnapshot(currentSnapshot)
    onClose()
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

  return (
    <Drawer.Root handleOnly open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content ref={contentRef} className={styles.content} data-chrome={rendered.chrome} data-has-footer={rendered.footer ? 'true' : 'false'} data-has-subtitle={rendered.subtitle ? 'true' : 'false'} data-surface="hass-popup" style={rendered.contentStyle}>
          {showDragHandle && <Drawer.Handle className={styles.handle} data-mobile-drag-handle="true" />}
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <Drawer.Title className={styles.title}>{rendered.title}</Drawer.Title>
              {rendered.subtitle && <p className={styles.subtitle}>{rendered.subtitle}</p>}
            </div>
            <Drawer.Description className={styles.description}>{rendered.subtitle ? `${rendered.title}: ${rendered.subtitle}` : `${rendered.title} controls and status details`}</Drawer.Description>
            <Drawer.Close className={styles.close} aria-label="Close" type="button">
              <MaterialIcon name="mdi:close" size={sourcePopup ? 30 : 19} />
            </Drawer.Close>
          </div>
          <div className={styles.body}>{rendered.children}</div>
          {rendered.footer && <div className={styles.footer}>{rendered.footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}