import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { GlassTile } from '../core/GlassTile'
import { Icon } from '../core/Icon'
import { COMMON_COPY_NAMESPACE, SHELL_COPY_KEYS, SHELL_COPY_NAMESPACE, useCopy } from '../../i18n'
import hubStyles from '../hass/StatusRail.module.css'
import styles from './DuoPageActionHub.module.css'

type HubState = 'closed' | 'closing' | 'open'

export interface DuoPageAction {
  id: string
  label: string
  icon: string
  active?: boolean
  onActivate: () => void
}

interface DuoPageActionHubProps {
  actions: readonly DuoPageAction[]
}

const HUB_CLOSE_DURATION_MS = 320

export function DuoPageActionHub({ actions }: DuoPageActionHubProps) {
  const commonCopy = useCopy(COMMON_COPY_NAMESPACE)
  const shellCopy = useCopy(SHELL_COPY_NAMESPACE)
  const [hubState, setHubState] = useState<HubState>('closed')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const isOpen = hubState !== 'closed'
  const hubDataState = hubState === 'closing' ? 'closed' : 'open'
  const triggerDataState = isOpen ? 'open' : 'closed'

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const finishClose = useCallback(() => {
    if (hubState !== 'closing') return
    const pendingAction = pendingActionRef.current
    pendingActionRef.current = null
    clearCloseTimer()
    setHubState('closed')
    triggerRef.current?.focus({ preventScroll: true })
    if (pendingAction) {
      window.requestAnimationFrame(pendingAction)
    }
  }, [clearCloseTimer, hubState])

  const closeHub = useCallback(() => {
    if (hubState === 'closed') return
    setHubState('closing')
  }, [hubState])

  const openHub = useCallback(() => {
    setHubState('open')
  }, [])

  const activateAction = useCallback((action: DuoPageAction) => {
    pendingActionRef.current = action.onActivate
    closeHub()
  }, [closeHub])

  useEffect(() => {
    if (hubState !== 'open') return
    panelRef.current?.querySelector<HTMLElement>('[data-duo-page-action="true"] button')?.focus({ preventScroll: true })
  }, [hubState])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (hubState !== 'closing') return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(finishClose, HUB_CLOSE_DURATION_MS)
    return clearCloseTimer
  }, [clearCloseTimer, finishClose, hubState])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHub()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [],
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeHub, isOpen])

  if (!actions.length) return null

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (!isOpen) openHub()
  }

  const hubLayer = isOpen ? (
    <div className={hubStyles.hubScrim} data-state={hubDataState} onClick={() => closeHub()}>
      <div
        aria-label={shellCopy(SHELL_COPY_KEYS.navigation.pageActions)}
        aria-modal="true"
        className={hubStyles.hubPanel}
        data-state={hubDataState}
        onAnimationEnd={(event) => {
          if (event.currentTarget === event.target) finishClose()
        }}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
      >
        <div className={hubStyles.hubHeader}>
          <h2>{shellCopy(SHELL_COPY_KEYS.navigation.pageActions)}</h2>
          <button
            aria-label={commonCopy('actions.close')}
            className={hubStyles.hubClose}
            onClick={() => closeHub()}
            type="button"
          >
            <Icon name="mdi:close" size={24} />
          </button>
        </div>
        <div className={hubStyles.hubGrid} data-duo-page-action-grid="true">
          {actions.map((action) => (
            <div className={styles.actionTile} data-active={action.active ? 'true' : 'false'} data-duo-page-action="true" key={action.id}>
              <GlassTile
                backgroundColor={action.active ? 'rgb(18 92 120 / 0.82)' : undefined}
                icon={action.icon}
                onClick={() => activateAction(action)}
                semantics={{ kind: 'modal' }}
                title={action.label}
                variant="header"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className={hubStyles.hubRoot} data-duo-page-action-hub="true" data-state={triggerDataState}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={shellCopy(SHELL_COPY_KEYS.navigation.morePageActions)}
        className={hubStyles.hubTrigger}
        data-action-kind="modal"
        onClick={openHub}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className={styles.triggerVisual}>
          <Icon name="mdi:dots-horizontal" size={25} />
        </span>
      </button>
      {hubLayer && createPortal(hubLayer, document.body)}
    </div>
  )
}
