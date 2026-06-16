import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { MaterialIcon } from './Icon'
import styles from './ModalSheet.module.css'

interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  chrome?: 'default' | 'source-popup'
  contentStyle?: CSSProperties
  footer?: ReactNode
  subtitle?: string
  surface?: 'hass-popup'
}

export function ModalSheet({ open, title, onClose, children, chrome = 'default', contentStyle, footer, subtitle }: ModalSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const sourcePopup = chrome === 'source-popup'

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
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content ref={contentRef} className={styles.content} data-chrome={chrome} data-has-footer={footer ? 'true' : 'false'} data-has-subtitle={subtitle ? 'true' : 'false'} data-surface="hass-popup" style={contentStyle}>
          {!sourcePopup && <div className={styles.handle} />}
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <Drawer.Title className={styles.title}>{title}</Drawer.Title>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            <Drawer.Description className={styles.description}>{subtitle ? `${title}: ${subtitle}` : `${title} controls and status details`}</Drawer.Description>
            <Drawer.Close className={styles.close} aria-label="Close" type="button">
              <MaterialIcon name="mdi:close" size={sourcePopup ? 30 : 19} />
            </Drawer.Close>
          </div>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}