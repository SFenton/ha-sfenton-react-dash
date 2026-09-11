import { ColorPicker } from '@hakit/components'
import type { EntityName, FilterByDomain } from '@hakit/core'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { lightHsToRgb, lightRgbToHs, type LightHs, type LightRgb } from './lightColor'
import styles from './LightColorPicker.module.css'

const NEAR_MARKER_PX = 28
const TAP_SLOP_PX = 10
const DRAG_THROTTLE_MS = 90

function hsToPosition([hue, saturation]: LightHs) {
  const radius = Math.min(1, saturation / 100)
  const phi = (hue * Math.PI) / 180
  return { x: radius * Math.cos(phi), y: radius * Math.sin(phi) }
}

interface LightColorPickerProps {
  ariaLabel: string
  channelLabel: (channel: 'R' | 'G' | 'B') => string
  entityId?: string
  hs?: LightHs | null
  onHsChange: (rgb: LightRgb, hs: LightHs) => void
  onRgbChange: (rgb: LightRgb) => void
  rgb: LightRgb
  valueText: string
}

interface LightTemperaturePickerProps {
  kelvin: number
  label: string
  max: number
  min: number
  onChange: (kelvin: number) => void
  step: number
  valueText: string
}

export function LightTemperaturePicker({ kelvin, label, max, min, onChange, step, valueText }: LightTemperaturePickerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const percentage = ((kelvin - min) / (max - min)) * 100
  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value / step) * step))
  const updateFromClient = (clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    onChange(clamp(min + ((clientX - rect.left) / rect.width) * (max - min)))
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromClient(event.clientX)
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromClient(event.clientX)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = step * (event.shiftKey ? 5 : 1)
    let next: number | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = kelvin - delta
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = kelvin + delta
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    onChange(clamp(next))
  }
  const handleInput = (value: string) => {
    if (!/^\d+$/.test(value)) return
    const parsed = Number(value)
    if (parsed >= min && parsed <= max) onChange(clamp(parsed))
  }

  return <div className={styles.editor} data-light-temperature-picker="true">
    <div className={styles.temperaturePicker}>
      <div className={styles.temperatureDisc}>
        <div
          aria-label={label}
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={kelvin}
          aria-valuetext={valueText}
          className={styles.temperatureOverlay}
          data-base-ui-swipe-ignore="true"
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          ref={overlayRef}
          role="slider"
          tabIndex={0}
        >
          <span
            aria-hidden="true"
            className={styles.temperatureMarker}
            style={{ left: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
    <label className={styles.temperatureField}>
      <span>{label}</span>
      <span className={styles.temperatureValue}>
        <input
          aria-label={label}
          inputMode="numeric"
          max={max}
          min={min}
          onChange={(event) => handleInput(event.target.value)}
          step={step}
          type="number"
          value={kelvin}
        />
        <span aria-hidden="true">K</span>
      </span>
    </label>
  </div>
}

export function LightColorPicker({ ariaLabel, channelLabel, entityId, hs, onHsChange, onRgbChange, rgb, valueText }: LightColorPickerProps) {
  const markerHs = hs === undefined ? lightRgbToHs(rgb) : hs
  const marker = markerHs ? hsToPosition(markerHs) : null
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastApplyRef = useRef(0)
  const draggingRef = useRef(false)
  const tapStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const moveHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const upHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const cancelHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [channels, setChannels] = useState<[string, string, string]>(() => rgb.map(String) as [string, string, string])
  const rgbKey = rgb.join(',')
  const [syncedRgbKey, setSyncedRgbKey] = useState(rgbKey)
  if (rgbKey !== syncedRgbKey) {
    setSyncedRgbKey(rgbKey)
    setChannels(rgb.map(String) as [string, string, string])
  }

  const computeFromClient = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return null
    const size = Math.min(rect.width, rect.height)
    if (size <= 0) return null
    const nx = (clientX - (rect.left + rect.width / 2)) / (size / 2)
    const ny = (clientY - (rect.top + rect.height / 2)) / (size / 2)
    const radius = Math.min(1, Math.hypot(nx, ny))
    const phi = Math.atan2(ny, nx)
    const hue = ((Math.round((phi * 180) / Math.PI) % 360) + 360) % 360
    const saturation = Math.round(radius * 100)
    return { hs: [hue, saturation] as LightHs, x: radius * Math.cos(phi), y: radius * Math.sin(phi) }
  }

  const emitHs = (nextHs: LightHs, throttle: boolean) => {
    if (throttle) {
      const now = Date.now()
      if (now - lastApplyRef.current < DRAG_THROTTLE_MS) return
      lastApplyRef.current = now
    }
    onHsChange(lightHsToRgb(nextHs), nextHs)
  }

  const detachWindowListeners = () => {
    if (moveHandlerRef.current) window.removeEventListener('pointermove', moveHandlerRef.current)
    if (upHandlerRef.current) window.removeEventListener('pointerup', upHandlerRef.current)
    if (cancelHandlerRef.current) window.removeEventListener('pointercancel', cancelHandlerRef.current)
    moveHandlerRef.current = null
    upHandlerRef.current = null
    cancelHandlerRef.current = null
    activePointerRef.current = null
  }

  useEffect(() => detachWindowListeners, [])

  const markerClient = () => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return null
    const position = dragPosition ?? marker
    if (!position) return null
    const size = Math.min(rect.width, rect.height)
    return {
      x: rect.left + rect.width / 2 + (position.x * size) / 2,
      y: rect.top + rect.height / 2 + (position.y * size) / 2,
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    detachWindowListeners()
    activePointerRef.current = event.pointerId
    const markerPoint = markerClient()
    const onMarker = markerPoint !== null && Math.hypot(event.clientX - markerPoint.x, event.clientY - markerPoint.y) <= NEAR_MARKER_PX
    if (onMarker) {
      event.stopPropagation()
      event.preventDefault()
      draggingRef.current = true
      lastApplyRef.current = 0
      const computed = computeFromClient(event.clientX, event.clientY)
      if (computed) {
        setDragPosition({ x: computed.x, y: computed.y })
        emitHs(computed.hs, false)
      }
    } else {
      draggingRef.current = false
      tapStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    }

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!draggingRef.current || moveEvent.pointerId !== activePointerRef.current) return
      moveEvent.preventDefault()
      const computed = computeFromClient(moveEvent.clientX, moveEvent.clientY)
      if (!computed) return
      setDragPosition({ x: computed.x, y: computed.y })
      emitHs(computed.hs, true)
    }
    const onUp = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId !== activePointerRef.current) return
      detachWindowListeners()
      if (draggingRef.current) {
        draggingRef.current = false
        setDragPosition(null)
        const computed = computeFromClient(upEvent.clientX, upEvent.clientY)
        if (computed) emitHs(computed.hs, false)
        return
      }
      const start = tapStartRef.current
      tapStartRef.current = null
      if (!start || start.pointerId !== upEvent.pointerId
        || Math.hypot(upEvent.clientX - start.x, upEvent.clientY - start.y) > TAP_SLOP_PX) return
      const computed = computeFromClient(upEvent.clientX, upEvent.clientY)
      if (computed) emitHs(computed.hs, false)
    }
    const onCancel = (cancelEvent: globalThis.PointerEvent) => {
      if (cancelEvent.pointerId !== activePointerRef.current) return
      draggingRef.current = false
      tapStartRef.current = null
      setDragPosition(null)
      detachWindowListeners()
    }

    moveHandlerRef.current = onMove
    upHandlerRef.current = onUp
    cancelHandlerRef.current = onCancel
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const [hue, saturation] = markerHs ?? lightRgbToHs(rgb)
    const hueStep = event.shiftKey ? 15 : 5
    const saturationStep = event.shiftKey ? 15 : 5
    let next: LightHs | null = null
    if (event.key === 'ArrowLeft') next = [(hue - hueStep + 360) % 360, saturation]
    else if (event.key === 'ArrowRight') next = [(hue + hueStep) % 360, saturation]
    else if (event.key === 'ArrowDown') next = [hue, Math.max(0, saturation - saturationStep)]
    else if (event.key === 'ArrowUp') next = [hue, Math.min(100, saturation + saturationStep)]
    if (!next) return
    event.preventDefault()
    emitHs(next, false)
  }

  const handleChannel = (index: number, value: string) => {
    const next = [...channels] as [string, string, string]
    next[index] = value
    setChannels(next)
    const parsed = next.map(Number)
    if (!next.every((channel) => channel !== '')
      || !parsed.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)) return
    const nextRgb = [parsed[0], parsed[1], parsed[2]] as LightRgb
    onRgbChange(nextRgb)
  }

  const position = dragPosition ?? marker
  return <div className={styles.editor} data-light-color-picker="true">
    <div className={styles.colorPicker}>
      <div className={styles.wheelWrap}>
        {entityId
          ? <ColorPicker className={styles.wheel} entity={entityId as FilterByDomain<EntityName, 'light'>} />
          : <div className={`${styles.wheel} color-picker`} data-testid="color-picker" />}
        <div
          aria-label={ariaLabel}
          aria-valuemax={359}
          aria-valuemin={0}
          aria-valuenow={Math.round((markerHs ?? lightRgbToHs(rgb))[0])}
          aria-valuetext={valueText}
          className={styles.wheelOverlay}
          data-testid="color-wheel-overlay"
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          ref={overlayRef}
          role="slider"
          tabIndex={0}
        >
          {position && <span
              aria-hidden="true"
              className={styles.wheelMarker}
              data-base-ui-swipe-ignore="true"
              data-dragging={dragPosition !== null}
              data-testid="color-wheel-marker"
              style={{ left: `${((position.x + 1) / 2) * 100}%`, top: `${((position.y + 1) / 2) * 100}%` }}
            />}
        </div>
      </div>
    </div>
    <div className={styles.rgbRow}>
      {(['R', 'G', 'B'] as const).map((channel, index) => <label className={styles.rgbField} key={channel}>
        <span className={styles.rgbLabel}>{channel}</span>
        <input
          aria-label={channelLabel(channel)}
          className={styles.rgbInput}
          inputMode="numeric"
          max={255}
          min={0}
          onChange={(event) => handleChannel(index, event.target.value)}
          type="number"
          value={channels[index]}
        />
      </label>)}
    </div>
  </div>
}
