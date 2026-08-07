import { Description } from './Description'
import styles from './EmptyState.module.css'

export type EmptyStateLayout = 'centered' | 'compact' | 'modal'

interface EmptyStateProps {
  className?: string
  description: string
  layout?: EmptyStateLayout
  title: string
}

export function EmptyState({ className, description, layout = 'centered', title }: EmptyStateProps) {
  const classNames = [styles.emptyState, className].filter(Boolean).join(' ')

  return (
    <section className={classNames} data-empty-layout={layout} data-empty-typography="festival">
      <h2>{title}</h2>
      <Description>{description}</Description>
    </section>
  )
}
