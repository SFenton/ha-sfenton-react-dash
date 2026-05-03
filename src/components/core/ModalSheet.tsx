import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import styles from './ModalSheet.module.css'

interface ModalSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function ModalSheet({ open, title, onClose, children }: ModalSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content className={styles.content}>
          <div className={styles.handle} />
          <div className={styles.header}>
            <Drawer.Title className={styles.title}>{title}</Drawer.Title>
            <Drawer.Description className={styles.description}>{title} controls and status details</Drawer.Description>
            <Drawer.Close className={styles.close} aria-label="Close" type="button">
              <X size={19} />
            </Drawer.Close>
          </div>
          <div className={styles.body}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}