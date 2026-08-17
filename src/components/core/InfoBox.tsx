import type { ReactNode } from 'react'
import styles from './InfoBox.module.css'

interface InfoBoxProps {
  children: ReactNode
  title: string
  tone?: 'neutral' | 'success' | 'warning'
}

export function InfoBox({ children, title, tone = 'success' }: InfoBoxProps) {
  return (
    <div aria-label={title} className={styles.box} data-tone={tone} role="note">
      <h4>{title}</h4>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
