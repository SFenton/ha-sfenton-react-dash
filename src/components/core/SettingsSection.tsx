import type { ReactNode } from 'react'
import { Description } from './Description'
import { Section } from './Section'
import styles from './SettingsSection.module.css'

interface SettingsSectionProps {
  children: ReactNode
  description?: ReactNode
  title: string
}

export function SettingsSection({ children, description, title }: SettingsSectionProps) {
  return (
    <div className={styles.wrapper} data-settings-section="true">
      <Section className={styles.section} title={title}>
        <div className={styles.body} data-settings-section-body="true">
          {description && <Description className={styles.description}>{description}</Description>}
          <div className={styles.controls} data-settings-section-controls="true">{children}</div>
        </div>
      </Section>
    </div>
  )
}
