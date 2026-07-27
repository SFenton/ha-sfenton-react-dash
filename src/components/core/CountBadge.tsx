import styles from './CountBadge.module.css'

interface CountBadgeProps {
  className?: string
  count: number
}

/** Counts above this render as "9+" so the badge keeps a stable width. */
const MAX_DISPLAY_COUNT = 9

export function CountBadge({ className, count }: CountBadgeProps) {
  if (!Number.isFinite(count) || count <= 0) return null

  return (
    <span aria-hidden="true" className={[styles.badge, className].filter(Boolean).join(' ')} data-count={count}>
      {count > MAX_DISPLAY_COUNT ? `${MAX_DISPLAY_COUNT}+` : count}
    </span>
  )
}
