import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { ModalDisclosureIcon } from './ModalDisclosureIcon'
import styles from './Card.module.css'

export interface CardColor {
  r: number
  g: number
  b: number
}

interface CardProps {
  ariaLabel?: string
  color?: CardColor
  disabled?: boolean
  disclosure?: boolean
  icon: ReactNode
  muted?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  pressed?: boolean
  secondarySubtitle?: string
  size?: 'standard' | 'compact' | 'bubble' | 'source-row' | 'wide' | 'admin-modal'
  subtitle?: string
  title: string
}

type CardStyle = CSSProperties & {
  '--card-rgb': string
}

export function Card({
  ariaLabel,
  color = { r: 150, g: 80, b: 28 },
  disabled = false,
  disclosure = false,
  icon,
  muted = false,
  onClick,
  pressed,
  secondarySubtitle,
  size = 'standard',
  subtitle,
  title,
}: CardProps) {
  const style: CardStyle = {
    '--card-rgb': `${color.r} ${color.g} ${color.b}`,
  }
  const className = [
    styles.card,
    subtitle || secondarySubtitle ? styles.hasSubtitle : '',
    size === 'compact' ? styles.compact : '',
    size === 'bubble' ? styles.bubble : '',
    size === 'source-row' ? styles.sourceRow : '',
    size === 'wide' ? styles.wide : '',
    size === 'admin-modal' ? styles.adminModal : '',
    disclosure && onClick ? styles.hasDisclosure : '',
  ].filter(Boolean).join(' ')
  const content = (
    <>
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
      {disclosure && onClick && <ModalDisclosureIcon className={styles.disclosure} />}
      <span className={styles.copy} data-dynamic-grid-label-container="true">
        <span className={styles.title} data-dynamic-grid-label="true">{title}</span>
        {subtitle && <span className={styles.subtitle} data-dynamic-grid-label="true">{subtitle}</span>}
        {secondarySubtitle && <span className={styles.secondarySubtitle} data-dynamic-grid-label="true">{secondarySubtitle}</span>}
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
        data-disabled={disabled}
        data-modal-opener={disclosure ? 'true' : undefined}
        data-muted={muted}
        disabled={disabled}
        onClick={onClick}
        style={style}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <article aria-label={ariaLabel ?? title} className={className} data-disabled={disabled} data-muted={muted} style={style}>
      {content}
    </article>
  )
}