import type { CSSProperties, ReactNode } from 'react'
import styles from './ResponsiveSectionGrid.module.css'

export type ResponsiveSectionSpan = 'auto' | 'full' | 'wide'

type ResponsiveSectionGridStyle = CSSProperties & {
  '--responsive-section-gap': string
}

interface ResponsiveSectionGridProps {
  children: ReactNode
  className?: string
  gap?: number
  maxColumns?: 2 | 3
}

interface ResponsiveSectionItemProps {
  children: ReactNode
  className?: string
  span?: ResponsiveSectionSpan
}

export function ResponsiveSectionGrid({
  children,
  className,
  gap = 18,
  maxColumns = 2,
}: ResponsiveSectionGridProps) {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(' ')}
      data-responsive-section-container="true"
    >
      <div
        className={styles.grid}
        data-max-columns={maxColumns}
        data-responsive-section-grid="true"
        style={{ '--responsive-section-gap': `${gap}px` } as ResponsiveSectionGridStyle}
      >
        {children}
      </div>
    </div>
  )
}

export function ResponsiveSectionItem({
  children,
  className,
  span = 'auto',
}: ResponsiveSectionItemProps) {
  return (
    <div
      className={[styles.item, className].filter(Boolean).join(' ')}
      data-responsive-section-item="true"
      data-span={span}
    >
      {children}
    </div>
  )
}
