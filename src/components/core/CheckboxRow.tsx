import { useCallback, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import styles from './CheckboxRow.module.css'

interface CheckboxRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  active: boolean
  alignWrappedToIconTop?: boolean
  subtitle?: ReactNode
  title: ReactNode
}

function hasSubtitle(subtitle: ReactNode) {
  if (typeof subtitle === 'string') return subtitle.trim().length > 0
  return subtitle !== undefined && subtitle !== null && subtitle !== false
}

function lineHeightPx(element: HTMLElement) {
  const lineHeight = window.getComputedStyle(element).lineHeight
  if (lineHeight === 'normal') return Number.parseFloat(window.getComputedStyle(element).fontSize) * 1.2
  return Number.parseFloat(lineHeight)
}

export function CheckboxRow({ active, alignWrappedToIconTop = false, className, subtitle, title, type = 'button', ...buttonProps }: CheckboxRowProps) {
  const titleRef = useRef<HTMLElement | null>(null)
  const subtitleVisible = hasSubtitle(subtitle)
  const [copyWrapped, setCopyWrapped] = useState(false)

  const measureCopy = useCallback(() => {
    const titleElement = titleRef.current
    if (!alignWrappedToIconTop || !titleElement) {
      setCopyWrapped(false)
      return
    }

    if (subtitleVisible) {
      setCopyWrapped(true)
      return
    }

    const lineHeight = lineHeightPx(titleElement)
    setCopyWrapped(titleElement.scrollHeight > lineHeight * 1.5)
  }, [alignWrappedToIconTop, subtitleVisible])

  useLayoutEffect(() => {
    measureCopy()
    const titleElement = titleRef.current
    if (!alignWrappedToIconTop || !titleElement) return undefined

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureCopy)
      return () => window.removeEventListener('resize', measureCopy)
    }

    const observer = new ResizeObserver(measureCopy)
    observer.observe(titleElement)
    return () => observer.disconnect()
  }, [alignWrappedToIconTop, measureCopy, title, subtitle])

  return (
    <button
      {...buttonProps}
      aria-pressed={active}
      className={[styles.checkboxRow, className].filter(Boolean).join(' ')}
      data-copy-wrapped={alignWrappedToIconTop && copyWrapped ? 'true' : undefined}
      type={type}
    >
      <MaterialIcon name={active ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'} size={34} />
      <span className={styles.copy}>
        <strong ref={titleRef}>{title}</strong>
        {subtitleVisible && <small>{subtitle}</small>}
      </span>
    </button>
  )
}
