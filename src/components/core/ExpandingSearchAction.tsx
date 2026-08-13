import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type TouchEvent } from 'react'
import { flushSync } from 'react-dom'
import { armDashboardKeyboardPrediction, clearDashboardKeyboardPrediction, DASHBOARD_KEYBOARD_STATE_EVENT, type DashboardKeyboardStateDetail } from '../../hooks/useDashboardViewport'
import { useCopy } from '../../i18n'
import { MaterialIcon } from './Icon'
import styles from './ExpandingSearchAction.module.css'

const SEARCH_EXPANDED_ATTR = 'data-dashboard-search-expanded'

interface ExpandingSearchActionProps {
  ariaLabel: string
  collapsedLabel?: string
  initiallyExpanded?: boolean
  onExpandedChange: (expanded: boolean) => void
  onQueryChange: (query: string) => void
  placeholder: string
  persistent?: boolean
  query: string
}

function updateSearchExpanded(expanded: boolean) {
  if (expanded) document.documentElement.setAttribute(SEARCH_EXPANDED_ATTR, 'true')
  else document.documentElement.removeAttribute(SEARCH_EXPANDED_ATTR)
}

export function ExpandingSearchAction({ ariaLabel, collapsedLabel, initiallyExpanded = false, onExpandedChange, onQueryChange, placeholder, persistent = false, query }: ExpandingSearchActionProps) {
  const copy = useCopy('core')
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const inputRef = useRef<HTMLInputElement>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const pendingCollapseRef = useRef(false)
  const hasQuery = query.trim() !== ''

  const collapseSearch = useCallback(() => {
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
    pendingCollapseRef.current = false
    updateSearchExpanded(false)
    clearDashboardKeyboardPrediction()
    onExpandedChange(false)
    setExpanded(false)
  }, [onExpandedChange])

  useEffect(() => {
    if (initiallyExpanded) updateSearchExpanded(true)
    const handleKeyboardState = (event: Event) => {
      const keyboardEvent = event as CustomEvent<DashboardKeyboardStateDetail>
      if (!keyboardEvent.detail.open && pendingCollapseRef.current) collapseSearch()
    }
    window.addEventListener(DASHBOARD_KEYBOARD_STATE_EVENT, handleKeyboardState)
    return () => {
      window.removeEventListener(DASHBOARD_KEYBOARD_STATE_EVENT, handleKeyboardState)
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
      updateSearchExpanded(false)
      clearDashboardKeyboardPrediction()
    }
  }, [collapseSearch, initiallyExpanded])

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const expandSearch = useCallback(() => {
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
    pendingCollapseRef.current = false
    armDashboardKeyboardPrediction()
    updateSearchExpanded(true)
    flushSync(() => {
      onExpandedChange(true)
      setExpanded(true)
    })
    focusInput()
  }, [focusInput, onExpandedChange])

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value)
  }, [onQueryChange])

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }, [])

  const handleInputBlur = useCallback(() => {
    if (persistent) {
      pendingCollapseRef.current = false
      clearDashboardKeyboardPrediction()
      return
    }
    pendingCollapseRef.current = true
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = window.setTimeout(collapseSearch, 400)
  }, [collapseSearch, persistent])

  const clearSearch = useCallback(() => {
    flushSync(() => onQueryChange(''))
    focusInput()
  }, [focusInput, onQueryChange])

  const handleClearSearchPressStart = useCallback((event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
  }, [clearSearch])

  const handleClearSearchClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
  }, [clearSearch])

  if (!expanded) {
    return (
      <div className={styles.slot} data-expanded="false">
        <button aria-label={ariaLabel} className={styles.button} data-active={hasQuery ? 'true' : undefined} onClick={expandSearch} type="button">
          <MaterialIcon name="mdi:magnify" size={26} />
          <span>{hasQuery ? query : collapsedLabel ?? copy('search.collapsed')}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={styles.slot} data-expanded="true">
      <label className={styles.bar}>
        <span aria-hidden="true" className={styles.icon}><MaterialIcon name="mdi:magnify" size={26} /></span>
        <input
          aria-label={ariaLabel}
          autoComplete="off"
          className={styles.input}
          enterKeyHint="search"
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          type="search"
          value={query}
        />
        {hasQuery && (
          <button
            aria-label={copy('search.clear')}
            className={styles.clear}
            onClick={handleClearSearchClick}
            onMouseDown={handleClearSearchPressStart}
            onPointerDown={handleClearSearchPressStart}
            onTouchStart={handleClearSearchPressStart}
            title={copy('search.clear')}
            type="button"
          >
            <MaterialIcon name="mdi:close" size={20} />
          </button>
        )}
      </label>
    </div>
  )
}
