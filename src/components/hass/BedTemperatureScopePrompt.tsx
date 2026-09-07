import { useEffect, useRef } from 'react'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { MODAL_SHEET_EXIT_ANIMATION_MS, ModalSheet, type ModalCenteredGeometry, type ModalSheetStyle } from '../core/ModalSheet'
import {
  sleepypodSchedulePhaseLabel,
  type SleepypodSchedulePhase,
  type SleepypodTemperatureScope,
} from './bedTemperatureScope'
import styles from './BedTemperatureScopePrompt.module.css'

const BED_TEMPERATURE_SCOPE_MODAL_STYLE: ModalSheetStyle = {
  '--modal-mobile-height': 'min(430px, 54dvh)',
  '--modal-mobile-max-height': 'calc(var(--dashboard-viewport-height, 100dvh) - 24px)',
}
const BED_TEMPERATURE_SCOPE_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'bed-temperature-scope',
  inlineSize: '440px',
} satisfies ModalCenteredGeometry

interface BedTemperatureScopePromptProps {
  onChoose: (scope: SleepypodTemperatureScope) => void
  onClose: () => void
  open: boolean
  phase: SleepypodSchedulePhase
  returnFocus?: HTMLElement | null
  sideTitle: string
  targetText: string
}

export function BedTemperatureScopePrompt({
  onChoose,
  onClose,
  open,
  phase,
  returnFocus,
  sideTitle,
  targetText,
}: BedTemperatureScopePromptProps) {
  const phaseLabel = sleepypodSchedulePhaseLabel(phase)
  const forceReturnFocusRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const tonightRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      forceReturnFocusRef.current = false
      const activeElement = document.activeElement
      if (returnFocus?.isConnected) returnFocusRef.current = returnFocus
      else if (activeElement instanceof HTMLElement && activeElement !== document.body) returnFocusRef.current = activeElement
      const frame = window.requestAnimationFrame(() => tonightRef.current?.focus({ preventScroll: true }))
      return () => window.cancelAnimationFrame(frame)
    }

    const returnTarget = returnFocusRef.current
    if (!returnTarget) return undefined
    const forceReturnFocus = forceReturnFocusRef.current
    const focusAtClose = document.activeElement
    const timeout = window.setTimeout(() => {
      forceReturnFocusRef.current = false
      returnFocusRef.current = null
      const currentFocus = document.activeElement
      const focusMovedElsewhere = currentFocus instanceof HTMLElement
        && currentFocus !== document.body
        && currentFocus !== focusAtClose
        && currentFocus.isConnected
      if (focusMovedElsewhere && !forceReturnFocus) return
      const ownerDialog = returnTarget.closest('[role="dialog"]')
      if (!returnTarget.isConnected || returnTarget.getAttribute('aria-disabled') === 'true' || ownerDialog?.hasAttribute('inert')) return
      returnTarget.focus({ preventScroll: true })
    }, MODAL_SHEET_EXIT_ANIMATION_MS + 20)
    return () => window.clearTimeout(timeout)
  }, [open, returnFocus])

  const chooseScope = (scope: SleepypodTemperatureScope) => {
    forceReturnFocusRef.current = true
    onChoose(scope)
  }

  return (
    <ModalSheet
      centeredGeometry={BED_TEMPERATURE_SCOPE_CENTERED_GEOMETRY}
      contentStyle={BED_TEMPERATURE_SCOPE_MODAL_STYLE}
      onClose={onClose}
      open={open}
      size="compact"
      subtitle={`${sideTitle} • ${phaseLabel} • ${targetText}`}
      title="Set Bed Temperature"
    >
      <div className={styles.content}>
        <Description className={styles.description}>
          Choose whether this target applies only to the current night or also becomes the {phaseLabel.toLowerCase()} setting for future nights.
        </Description>
        <div aria-label="Temperature duration" className={styles.choices} role="group">
          <button aria-label="Tonight" className={styles.choice} onClick={() => chooseScope('tonight')} ref={tonightRef} type="button">
            <span aria-hidden="true" className={styles.icon}><MaterialIcon name="mdi:weather-night" size={24} /></span>
            <span className={styles.copy}>
              <strong>Tonight</strong>
              <span>Change the current Pod target only.</span>
            </span>
          </button>
          <button aria-label="All Nights" className={styles.choice} onClick={() => chooseScope('all-nights')} type="button">
            <span aria-hidden="true" className={styles.icon}><MaterialIcon name="mdi:calendar-refresh" size={24} /></span>
            <span className={styles.copy}>
              <strong>All Nights</strong>
              <span>Update this schedule stage and tonight&apos;s target.</span>
            </span>
          </button>
        </div>
        <button className={styles.cancel} onClick={onClose} type="button">Cancel</button>
      </div>
    </ModalSheet>
  )
}
