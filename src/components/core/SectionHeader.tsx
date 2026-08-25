import styles from './SectionHeader.module.css'
import { Separator } from './Separator'

interface SectionHeaderProps {
  className?: string
  separator?: boolean
  title: string
}

export function SectionHeader({ className, separator = true, title }: SectionHeaderProps) {
  return (
    <div className={[styles.sectionHeader, className].filter(Boolean).join(' ')}>
      <h2>{title}</h2>
      <Separator className={styles.rule} visible={separator} />
    </div>
  )
}