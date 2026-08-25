import type { CSSProperties, ReactNode } from 'react'
import { Description } from './Description'
import { ResponsiveSectionItem, type ResponsiveSectionSpan } from './ResponsiveSectionGrid'
import { SectionHeader } from './SectionHeader'
import styles from './Section.module.css'

type SectionStyle = CSSProperties & {
  '--section-gap': string
}

export interface SectionProps {
  children: ReactNode
  className?: string
  contentClassName?: string
  description?: ReactNode
  gap?: number
  id?: string
  separator?: boolean
  span?: ResponsiveSectionSpan
  title: string
}

export function Section({
  children,
  className,
  contentClassName,
  description,
  gap = 10,
  id,
  separator = true,
  span = 'auto',
  title,
}: SectionProps) {
  return (
    <ResponsiveSectionItem span={span}>
      <section
        className={[styles.section, className].filter(Boolean).join(' ')}
        data-section-layout="true"
        id={id}
        style={{ '--section-gap': `${gap}px` } as SectionStyle}
      >
        <SectionHeader separator={separator} title={title} />
        {description !== undefined && <Description>{description}</Description>}
        <div className={[styles.content, contentClassName].filter(Boolean).join(' ')} data-section-content="true">
          {children}
        </div>
      </section>
    </ResponsiveSectionItem>
  )
}
