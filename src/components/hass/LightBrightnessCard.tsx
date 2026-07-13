import { useEntity, useHass } from '@hakit/core'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { MaterialIcon } from '../core/Icon'
import { ModalDisclosureIcon } from '../core/ModalDisclosureIcon'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName, isActiveState } from './entityState'
import styles from './LightBrightnessCard.module.css'

const DRAG_THRESHOLD_PX = 6
// Movement beyond this (typically a vertical scroll/swipe) cancels the tap so a
// swipe over a tile does not accidentally open more-info or toggle the light.
const TAP_SLOP_PX = 10
const FILL_COLOR = 'rgb(150 80 28)'

function brightnessToPct(brightness: number | undefined | null) {
  if (typeof brightness !== 'number') return 0
  return Math.round((brightness / 255) * 100)
}

function clampPct(value: number) {
  return Math.min(100, Math.max(0, value))
}

// The slider fill follows the light's current color when it reports one,
// falling back to the warm default used elsewhere on the dashboard.
function readFillColor(rgbColor: unknown): string {
  if (Array.isArray(rgbColor) && rgbColor.length === 3 && rgbColor.every((value) => typeof value === 'number')) {
    return `rgb(${rgbColor[0]} ${rgbColor[1]} ${rgbColor[2]})`
  }
  return FILL_COLOR
}

export type LightTapAction = 'toggle' | 'more-info'

interface LightBrightnessCardProps {
  entityId: string
  title: string
  tapAction?: LightTapAction
  showStatus?: boolean
  onMoreInfo?: (entityId: string, title: string) => void
}

export function LightBrightnessCard({ entityId, title, tapAction = 'toggle', showStatus = false, onMoreInfo }: LightBrightnessCardProps) {
  const callService = useHass((state) => state.helpers.callService)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const active = isActiveState(entity)
  const entityPct = brightnessToPct(entity?.attributes?.brightness as number | undefined)
  // Live percent: 0 when off, otherwise the reported brightness (falling back to full
  // when the light reports on without a brightness attribute so the tile still reads "on").
  const liveDisplayPct = active ? (entityPct > 0 ? entityPct : 100) : 0
  // Optimistic layer: after the user releases the slider (or toggles), the tile holds the
  // committed value until Home Assistant catches up, then drops the override (or reverts on timeout).
  const [optimisticPct, commitPct] = useOptimisticState(liveDisplayPct)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const dragging = useRef(false)
  const suppressDetailsClick = useRef(false)

  // While dragging the slider value is purely local; otherwise it follows the optimistic layer.
  const displayPct = dragPct ?? optimisticPct
  const isOn = displayPct > 0
  const icon = isOn ? 'mdi:lightbulb' : 'mdi:lightbulb-off'
  const fillColor = readFillColor(entity?.attributes?.rgb_color)

  const setBrightness = (pct: number) => {
    const value = clampPct(pct)
    // Hold the released value locally until Home Assistant confirms (or the revert timeout fires).
    commitPct(value)
    if (value <= 0) {
      callService({ domain: 'light', service: 'turn_off', target: entityId })
      return
    }
    callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { brightness_pct: value } })
  }

  const pctFromClientX = (clientX: number) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clampPct(((clientX - rect.left) / rect.width) * 100)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    dragging.current = false
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    if (!start || start.pointerId !== event.pointerId) return
    if (!dragging.current && Math.abs(event.clientX - start.x) < DRAG_THRESHOLD_PX) return
    if (!dragging.current) {
      dragging.current = true
      suppressDetailsClick.current = true
      cardRef.current?.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    setDragPct(pctFromClientX(event.clientX))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.pointerId !== event.pointerId) return

    if (dragging.current) {
      dragging.current = false
      if (cardRef.current?.hasPointerCapture(event.pointerId)) cardRef.current.releasePointerCapture(event.pointerId)
      const finalPct = pctFromClientX(event.clientX)
      setDragPct(null)
      setBrightness(finalPct)
      window.setTimeout(() => {
        suppressDetailsClick.current = false
      }, 0)
      return
    }

    // Ignore gestures that moved like a scroll/swipe (mostly vertical, or any
    // direction past the slop) so swiping over a tile does not register as a tap.
    const movedX = Math.abs(event.clientX - start.x)
    const movedY = Math.abs(event.clientY - start.y)
    if (movedX > TAP_SLOP_PX || movedY > TAP_SLOP_PX) {
      suppressDetailsClick.current = true
      window.setTimeout(() => {
        suppressDetailsClick.current = false
      }, 0)
      return
    }

    // Treated as a tap
    if (tapAction !== 'more-info') toggle()
  }

  const handlePower = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const toggle = () => {
    // Optimistically reflect the off transition; the on transition waits for HA to report brightness.
    if (isOn) commitPct(0)
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  const togglePower = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    toggle()
  }

  const openMoreInfo = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (suppressDetailsClick.current) {
      suppressDetailsClick.current = false
      return
    }
    onMoreInfo?.(entityId, title)
  }

  return (
    <div
      aria-label={title}
      className={styles.card}
      data-active={isOn}
      data-dragging={dragPct !== null}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={cardRef}
      role="group"
      style={{ '--fill-color': fillColor, '--fill-pct': `${displayPct}%` } as React.CSSProperties}
    >
      <span aria-hidden="true" className={styles.fill} />
      {tapAction === 'more-info' && (
        <button aria-label={`Open ${title} details`} className={styles.details} onClick={openMoreInfo} type="button" />
      )}
      <span aria-hidden="true" className={styles.icon}>
        <MaterialIcon name={icon} size={22} />
      </span>
      <span className={styles.copy}>
        <span className={styles.title}>{title}</span>
        {showStatus && isOn && <span className={styles.subtitle}>{`${Math.floor(displayPct)}%`}</span>}
      </span>
      {tapAction === 'more-info' && <ModalDisclosureIcon className={styles.disclosure} size="compact" />}
      <button aria-label={`Toggle ${title}`} className={styles.power} onClick={togglePower} onPointerDown={handlePower} type="button">
        <MaterialIcon name="mdi:power" size={18} />
      </button>
    </div>
  )
}
