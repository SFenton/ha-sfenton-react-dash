import type { ReactNode } from 'react'
import styles from './Description.module.css'

interface DescriptionProps {
  children: ReactNode
  className?: string
}

export function Description({ children, className }: DescriptionProps) {
  const classNames = [styles.description, className].filter(Boolean).join(' ')

  if (typeof children === 'string') {
    return (
      <div className={classNames}>
        {children.split('\n\n').map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    )
  }

  return <div className={classNames}>{children}</div>
}