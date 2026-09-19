import { useCallback, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { MaterialIcon } from './Icon'
import styles from './CheckboxRow.module.css'

interface CheckboxRowSharedProps {
  active: boolean
  alignWrappedToIconTop?: boolean
  className?: string
  subtitle?: ReactNode
  title: ReactNode
}

type CheckboxRowControlProps = CheckboxRowSharedProps
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'title'>
  & {
    mode?: 'control'
    status?: never
  }

type CheckboxRowStatusProps = CheckboxRowSharedProps
  & {
    'aria-label'?: string
    id?: string
    mode: 'status'
    status?: 'checked' | 'mixed' | 'unchecked'
  }

type CheckboxRowStatusControlProps = CheckboxRowSharedProps
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'title'>
  & {
    mode: 'status-control'
    status: 'checked' | 'mixed' | 'unchecked'
  }

type CheckboxRowProps =
  | CheckboxRowControlProps
  | CheckboxRowStatusControlProps
  | CheckboxRowStatusProps

function hasSubtitle(subtitle: ReactNode) {
  if (typeof subtitle === 'string') return subtitle.trim().length > 0
  return subtitle !== undefined && subtitle !== null && subtitle !== false
}

function lineHeightPx(element: HTMLElement) {
  const lineHeight = window.getComputedStyle(element).lineHeight
  if (lineHeight === 'normal') return Number.parseFloat(window.getComputedStyle(element).fontSize) * 1.2
  return Number.parseFloat(lineHeight)
}

function checkboxControlAttributes(
  props: CheckboxRowControlProps | CheckboxRowStatusControlProps,
) {
  const attributes = { ...props } as ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>
  delete attributes.active
  delete attributes.alignWrappedToIconTop
  delete attributes.className
  delete attributes.mode
  delete attributes.status
  delete attributes.subtitle
  delete attributes.title
  return attributes
}

export function CheckboxRow(props: CheckboxRowProps) {
  const {
    active,
    alignWrappedToIconTop = false,
    className,
    subtitle,
    title,
  } = props
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
    let frame: number | null = null
    const scheduleMeasure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = null
        measureCopy()
      })
    }
    scheduleMeasure()
    const titleElement = titleRef.current
    if (!alignWrappedToIconTop || !titleElement) {
      return () => {
        if (frame !== null) window.cancelAnimationFrame(frame)
      }
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleMeasure)
      return () => {
        if (frame !== null) window.cancelAnimationFrame(frame)
        window.removeEventListener('resize', scheduleMeasure)
      }
    }

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(titleElement)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [alignWrappedToIconTop, measureCopy, title, subtitle])

  const status = props.mode === 'status' || props.mode === 'status-control'
    ? (props.status ?? (active ? 'checked' : 'unchecked'))
    : undefined
  const icon = status === 'mixed'
    ? 'mdi:minus-box-outline'
    : active
      ? 'mdi:checkbox-marked-outline'
      : 'mdi:checkbox-blank-outline'
  const content = (
    <>
      <MaterialIcon name={icon} size={34} />
      <span className={styles.copy} data-dynamic-grid-label-container="true">
        <strong data-dynamic-grid-label="true" ref={titleRef}>{title}</strong>
        {subtitleVisible && <small data-dynamic-grid-label="true">{subtitle}</small>}
      </span>
    </>
  )

  if (props.mode === 'status') {
    return (
      <div
        aria-label={props['aria-label']}
        className={[styles.checkboxRow, className].filter(Boolean).join(' ')}
        data-copy-wrapped={alignWrappedToIconTop && copyWrapped ? 'true' : undefined}
        data-read-only="true"
        data-status={status}
        id={props.id}
        role="group"
      >
        {content}
      </div>
    )
  }

  const buttonProps = checkboxControlAttributes(props)
  if (props.mode === 'status-control') {
    return (
      <button
        {...buttonProps}
        className={[styles.checkboxRow, className].filter(Boolean).join(' ')}
        data-copy-wrapped={alignWrappedToIconTop && copyWrapped ? 'true' : undefined}
        data-status={status}
        data-status-control="true"
        data-wrap-copy="true"
        type={buttonProps.type ?? 'button'}
      >
        {content}
      </button>
    )
  }
  return (
    <button
      {...buttonProps}
      aria-pressed={active}
      className={[styles.checkboxRow, className].filter(Boolean).join(' ')}
      data-copy-wrapped={alignWrappedToIconTop && copyWrapped ? 'true' : undefined}
      type={buttonProps.type ?? 'button'}
    >
      {content}
    </button>
  )
}
