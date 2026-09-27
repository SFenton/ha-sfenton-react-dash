import { useEntity, useHass } from '@hakit/core'
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { MaterialIcon } from '../core/Icon'
import { SurfaceAccessory } from '../core/SurfaceAccessory'
import type { ControlSemantics } from '../core/controlSemantics'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { formatNumber } from '../../i18n'
import { asEntityName, formatCompactEntityState, isActiveState, titleCaseState } from './entityState'
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
  separator?: boolean
  showStatus?: boolean
  onMoreInfo?: (entityId: string, title: string) => void
}

export function LightBrightnessCard({ entityId, title, tapAction = 'toggle', separator = false, showStatus = false, onMoreInfo }: LightBrightnessCardProps) {
  const callService = useHass((state) => state.helpers.callService)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const disabled = !entity || entity.state === 'unknown' || entity.state === 'unavailable'
  const active = isActiveState(entity)
  const entityPct = brightnessToPct(entity?.attributes?.brightness as number | undefined)
  const liveDisplayPct = active ? (entityPct > 0 ? entityPct : 100) : 0
  const [optimisticPct, commitPct] = useOptimisticState(liveDisplayPct)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const dragging = useRef(false)
  const suppressDetailsClick = useRef(false)
  const displayPct = dragPct ?? optimisticPct
  const isOn = displayPct > 0
  const valueSemantics: ControlSemantics = { kind: 'value', text: formatNumber(Math.round(displayPct) / 100, { style: 'percent' }) }
  const sliderSemantics: ControlSemantics = { kind: 'command' }
  const powerSemantics: ControlSemantics = { kind: 'toggle', checked: isOn }
  const icon = separator
    ? (isOn ? 'mdi:lightbulb-multiple' : 'mdi:lightbulb-multiple-off')
    : (isOn ? 'mdi:lightbulb' : 'mdi:lightbulb-off')
  const fillColor = readFillColor(entity?.attributes?.rgb_color)
  const disabledStatus = disabled ? (entity ? titleCaseState(entity.state) : formatCompactEntityState(null)) : undefined
  const setBrightness = (pct: number) => {
    if (disabled) return
    const value = clampPct(pct)
    commitPct(value)
    if (value <= 0) {
      callService({ domain: 'light', service: 'turn_off', target: entityId })
      return
    }
    callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { brightness_pct: value } })
  }
  const pctFromClientX = (clientX: number) => {
    const rect = (separator ? sliderRef.current : cardRef.current)?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clampPct(((clientX - rect.left) / rect.width) * 100)
  }
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    dragging.current = false
  }
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const start = pointerStart.current
    if (!start || start.pointerId !== event.pointerId) return
    if (!dragging.current && Math.abs(event.clientX - start.x) < DRAG_THRESHOLD_PX) return
    if (!dragging.current && Math.abs(event.clientY - start.y) > Math.abs(event.clientX - start.x)) return
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
    const movedX = Math.abs(event.clientX - start.x)
    const movedY = Math.abs(event.clientY - start.y)
    if (movedX > TAP_SLOP_PX || movedY > TAP_SLOP_PX) {
      suppressDetailsClick.current = true
      window.setTimeout(() => {
        suppressDetailsClick.current = false
      }, 0)
      return
    }
    if (separator) setBrightness(pctFromClientX(event.clientX))
    else if (tapAction !== 'more-info') toggle()
  }
  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.pointerId !== event.pointerId) return
    if (dragging.current) {
      dragging.current = false
      if (cardRef.current?.hasPointerCapture(event.pointerId)) cardRef.current.releasePointerCapture(event.pointerId)
      setDragPct(null)
    }
    suppressDetailsClick.current = true
    window.setTimeout(() => {
      suppressDetailsClick.current = false
    }, 0)
  }
  const handlePower = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const toggle = () => {
    if (disabled) return
    if (isOn) commitPct(0)
    else if (separator) commitPct(entityPct || 100)
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  const handleSliderKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let nextPct: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        nextPct = clampPct(displayPct + 5)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        nextPct = clampPct(displayPct - 5)
        break
      case 'Home':
        nextPct = 0
        break
      case 'End':
        nextPct = 100
        break
      default:
        return
    }
    event.preventDefault()
    if (nextPct !== displayPct) setBrightness(nextPct)
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
      className={styles.card} data-action-kind={valueSemantics.kind}
      data-active={isOn}
      data-base-ui-swipe-ignore="true" data-disabled={disabled}
      data-dragging={dragPct !== null}
      data-separator={separator}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={cardRef}
      role="group"
      style={{ '--fill-color': fillColor, '--fill-pct': `${displayPct}%`, cursor: disabled && tapAction !== 'more-info' ? 'default' : undefined } as React.CSSProperties}
    >
      <span aria-hidden="true" className={styles.fill} />
      {separator && (
        <div
          aria-disabled={disabled}
          aria-label={title}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(displayPct)}
          aria-valuetext={valueSemantics.text}
          className={styles.sliderTarget}
          data-action-kind={sliderSemantics.kind}
          onKeyDown={handleSliderKeyDown}
          ref={sliderRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
        />
      )}
      {tapAction === 'more-info' && (
        <button aria-label={`Open ${title} details`} className={styles.details} data-action-kind="modal" onClick={openMoreInfo} type="button" />
      )}
      <span aria-hidden="true" className={styles.icon}>
        <MaterialIcon name={icon} size={separator ? 18 : 22} />
      </span>
      <span className={styles.copy} data-dynamic-grid-label-container="true">
        {!separator && <span className={styles.title} data-dynamic-grid-label="true">{title}</span>}
        {disabledStatus ? <span className={styles.subtitle} data-dynamic-grid-label="true">{disabledStatus}</span> : showStatus && (isOn || separator) ? <span className={styles.subtitle} data-dynamic-grid-label="true">{`${Math.floor(displayPct)}%`}</span> : null}
      </span>
      {tapAction === 'more-info' && <SurfaceAccessory className={styles.disclosure} semantics={{ kind: 'modal' }} size="compact" />}
      <button aria-label={`Toggle ${title}`} aria-pressed={powerSemantics.checked} className={styles.power} data-action-kind={powerSemantics.kind} disabled={disabled} onClick={togglePower} onPointerDown={handlePower} type="button">
        <MaterialIcon name="mdi:power" size={18} />
      </button>
    </div>
  )
}
