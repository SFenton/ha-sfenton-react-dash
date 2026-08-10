import { forwardRef, type ReactNode } from 'react'
import styles from './FloatingActionSlot.module.css'

interface FloatingActionSlotProps {
  children: ReactNode
  collapsed: boolean
}

export const FloatingActionSlot = forwardRef<HTMLSpanElement, FloatingActionSlotProps>(
  function FloatingActionSlot({ children, collapsed }, ref) {
    return (
      <span
        aria-hidden={collapsed ? 'true' : undefined}
        className={styles.slot}
        data-collapsed={collapsed ? 'true' : undefined}
        inert={collapsed}
        ref={ref}
      >
        {children}
      </span>
    )
  },
)
