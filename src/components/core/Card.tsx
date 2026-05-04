import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import styles from './Card.module.css'

export interface CardColor {
  r: number
  g: number
  b: number
}

interface CardProps {
  ariaLabel?: string
  color?: CardColor
  icon: ReactNode
  muted?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  pressed?: boolean
  size?: 'standard' | 'compact'
  subtitle?: string
  title: string
}

type CardStyle = CSSProperties & {
  '--card-rgb': string
}

export function Card({
  ariaLabel,
  color = { r: 150, g: 80, b: 28 },
  icon,
  muted = false,
  onClick,
  pressed,
  size = 'standard',
  subtitle,
  title,
}: CardProps) {
  const style: CardStyle = {
    '--card-rgb': `${color.r} ${color.g} ${color.b}`,
  }
  const className = [styles.card, subtitle ? styles.hasSubtitle : '', size === 'compact' ? styles.compact : ''].filter(Boolean).join(' ')
  const content = (
    <>
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
      <span className={styles.copy}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel ?? title}
        aria-pressed={pressed}
        className={className}
        data-clickable="true"
        data-muted={muted}
        onClick={onClick}
        style={style}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <article aria-label={ariaLabel ?? title} className={className} data-muted={muted} style={style}>
      {content}
    </article>
  )
}