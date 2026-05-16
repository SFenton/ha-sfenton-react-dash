import { useEffect, useRef, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { MaterialIcon } from './Icon'
import styles from './ModalSheet.module.css'

interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function ModalSheet({ open, title, onClose, children }: ModalSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)

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
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content ref={contentRef} className={styles.content}>
          <div className={styles.handle} />
          <div className={styles.header}>
            <Drawer.Title className={styles.title}>{title}</Drawer.Title>
            <Drawer.Description className={styles.description}>{title} controls and status details</Drawer.Description>
            <Drawer.Close className={styles.close} aria-label="Close" type="button">
              <MaterialIcon name="mdi:close" size={19} />
            </Drawer.Close>
          </div>
          <div className={styles.body}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}