import styles from './SectionHeader.module.css'
import { Separator } from './Separator'

interface SectionHeaderProps {
  title: string
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <h2>{title}</h2>
      <Separator className={styles.rule} />
    </div>
  )
}