import styles from './SectionHeader.module.css'

interface SectionHeaderProps {
  title: string
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <h2>{title}</h2>
      <div className={styles.rule} />
    </div>
  )
}