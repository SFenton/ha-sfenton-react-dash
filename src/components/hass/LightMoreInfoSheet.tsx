import { ColorPicker } from '@hakit/components'
import { useEntity, useHass } from '@hakit/core'
import type { EntityName, FilterByDomain } from '@hakit/core'
import { useRef, useState, type CSSProperties } from 'react'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import { LightBrightnessCard } from './LightBrightnessCard'
import { asEntityName } from './entityState'
import styles from './LightMoreInfoSheet.module.css'

const FRONT_YARD_GROUP = 'light.front_yard_lights'
const COLOR_MODES = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy']
const LIGHT_COLOR_PICKER_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-width': '700px',
  '--modal-desktop-max-width': '700px',
  '--modal-desktop-height': 'auto',
}

// Pointer distance (px) from the wheel marker that still counts as grabbing it.
const NEAR_MARKER_PX = 28
// Movement (px) under which a press counts as a tap rather than a swipe.
const TAP_SLOP_PX = 10
// Minimum gap between service calls while dragging the marker.
const DRAG_THROTTLE_MS = 90

type Rgb = [number, number, number]

interface LightRef {
  entityId: string
  title: string
}

function readRgb(rgbColor: unknown): Rgb | null {
  if (Array.isArray(rgbColor) && rgbColor.length === 3 && rgbColor.every((value) => typeof value === 'number')) {
    return [rgbColor[0] as number, rgbColor[1] as number, rgbColor[2] as number]
  }
  return null
}

function rgbCss(rgb: Rgb) {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
}

function readHs(hsColor: unknown): [number, number] | null {
  if (Array.isArray(hsColor) && hsColor.length === 2 && hsColor.every((value) => typeof value === 'number')) {
    return [hsColor[0] as number, hsColor[1] as number]
  }
  return null
}

// Hue (deg) + saturation (0-100) → normalized wheel coordinates in [-1, 1],
// matching HAKit's color wheel orientation (0° at +x, clockwise with screen y).
function hsToXY([hue, saturation]: [number, number]) {
  const radius = Math.min(1, saturation / 100)
  const phi = (hue * Math.PI) / 180
  return { x: radius * Math.cos(phi), y: radius * Math.sin(phi) }
}

function xyKey({ x, y }: { x: number; y: number }) {
  return `${x.toFixed(4)},${y.toFixed(4)}`
}

function parseXyKey(key: string): { x: number; y: number } | null {
  if (!key) return null
  const [x, y] = key.split(',').map(Number)
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  return { x, y }
}

interface LightMoreInfoSheetProps {
  entityId: string | null
  title: string
  open: boolean
  onClose: () => void
  /** All custom lights, used to drive the "apply another light's color" buttons. */
  lights?: LightRef[]
}

// The color wheel plus a gesture overlay. HAKit's ColorPicker captures every drag
// on the wheel to recolor and only moves its marker once Home Assistant echoes the
// new state back, which feels laggy. We render it for the wheel gradient only,
// hide its built-in marker, and own the interaction ourselves: tap picks a color,
// dragging the marker recolors live, and any other drag falls through to vaul so
// the sheet can be dismissed by swiping over the wheel. The marker is driven by an
// optimistic layer so it tracks the finger instantly while the backend catches up.
function ColorWheel({ entityId }: { entityId: string }) {
  const callService = useHass((state) => state.helpers.callService)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const isOn = entity?.state === 'on'

  // The light's confirmed marker position, derived from its reported hue/saturation.
  const liveHs = readHs(entity?.attributes?.hs_color)
  const liveXY = isOn && liveHs ? hsToXY(liveHs) : null
  const liveKey = liveXY ? xyKey(liveXY) : ''
  // Optimistic layer: after a tap/drag the marker holds the committed position until
  // HA reports the matching color, then drops the override (or reverts on timeout).
  const [optimisticKey, commitKey] = useOptimisticState(liveKey)
  // While actively dragging, the marker is purely local for zero-latency tracking.
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null)
  const markerXY = dragXY ?? parseXyKey(optimisticKey)

  const wrapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastApplyRef = useRef(0)
  const draggingRef = useRef(false)
  const tapStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const moveHandlerRef = useRef<((event: PointerEvent) => void) | null>(null)
  const upHandlerRef = useRef<((event: PointerEvent) => void) | null>(null)

  // Convert a client point into wheel coordinates + the matching hue/saturation.
  const computeFromClient = (clientX: number, clientY: number) => {
    const overlay = overlayRef.current
    if (!overlay) return null
    const rect = overlay.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height)
    if (size <= 0) return null
    const nx = (clientX - (rect.left + rect.width / 2)) / (size / 2)
    const ny = (clientY - (rect.top + rect.height / 2)) / (size / 2)
    const radius = Math.min(1, Math.hypot(nx, ny))
    const phi = Math.atan2(ny, nx)
    const deg = Math.round((phi * 180) / Math.PI) % 360
    const hue = (deg + 360) % 360
    const saturation = Math.round(radius * 100)
    return { hue, saturation, x: radius * Math.cos(phi), y: radius * Math.sin(phi) }
  }

  const applyHs = (hue: number, saturation: number, throttle: boolean) => {
    if (throttle) {
      const now = Date.now()
      if (now - lastApplyRef.current < DRAG_THROTTLE_MS) return
      lastApplyRef.current = now
    }
    callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { hs_color: [hue, saturation] } })
  }

  const detachWindowListeners = () => {
    if (moveHandlerRef.current) window.removeEventListener('pointermove', moveHandlerRef.current)
    if (upHandlerRef.current) window.removeEventListener('pointerup', upHandlerRef.current)
    moveHandlerRef.current = null
    upHandlerRef.current = null
  }

  // Current marker position in client coordinates, used to decide whether a press
  // grabbed the marker (vs. a tap-elsewhere or a swipe-to-dismiss).
  const markerClient = () => {
    const overlay = overlayRef.current
    if (!overlay || !markerXY) return null
    const rect = overlay.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height)
    return {
      x: rect.left + rect.width / 2 + (markerXY.x * size) / 2,
      y: rect.top + rect.height / 2 + (markerXY.y * size) / 2,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const marker = markerClient()
    const onMarker = marker !== null && Math.hypot(event.clientX - marker.x, event.clientY - marker.y) <= NEAR_MARKER_PX

    if (onMarker) {
      // Own this gesture so vaul never starts a dismiss drag while recoloring.
      event.stopPropagation()
      event.preventDefault()
      draggingRef.current = true
      lastApplyRef.current = 0
      const computed = computeFromClient(event.clientX, event.clientY)
      if (computed) {
        setDragXY({ x: computed.x, y: computed.y })
        applyHs(computed.hue, computed.saturation, false)
      }
    } else {
      // Tap-to-pick or swipe-to-dismiss; leave the event for vaul to evaluate.
      draggingRef.current = false
      tapStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    }

    const onMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return
      moveEvent.preventDefault()
      const computed = computeFromClient(moveEvent.clientX, moveEvent.clientY)
      if (!computed) return
      setDragXY({ x: computed.x, y: computed.y })
      applyHs(computed.hue, computed.saturation, true)
    }
    const onUp = (upEvent: PointerEvent) => {
      detachWindowListeners()
      if (draggingRef.current) {
        draggingRef.current = false
        const computed = computeFromClient(upEvent.clientX, upEvent.clientY)
        setDragXY(null)
        if (computed) {
          commitKey(xyKey({ x: computed.x, y: computed.y }))
          applyHs(computed.hue, computed.saturation, false)
        }
        return
      }
      const start = tapStartRef.current
      tapStartRef.current = null
      if (!start || start.pointerId !== upEvent.pointerId) return
      const moved = Math.hypot(upEvent.clientX - start.x, upEvent.clientY - start.y)
      if (moved > TAP_SLOP_PX) return
      const computed = computeFromClient(upEvent.clientX, upEvent.clientY)
      if (!computed) return
      commitKey(xyKey({ x: computed.x, y: computed.y }))
      applyHs(computed.hue, computed.saturation, false)
    }

    detachWindowListeners()
    moveHandlerRef.current = onMove
    upHandlerRef.current = onUp
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className={styles.colorPicker}>
      <div className={styles.wheelWrap} ref={wrapRef}>
        <ColorPicker className={styles.wheel} entity={entityId as FilterByDomain<EntityName, 'light'>} />
        <div aria-hidden="true" className={styles.wheelOverlay} data-testid="color-wheel-overlay" onPointerDown={handlePointerDown} ref={overlayRef}>
          {markerXY && (
            <span
              className={styles.wheelMarker}
              data-dragging={dragXY !== null}
              data-testid="color-wheel-marker"
              style={{ left: `${((markerXY.x + 1) / 2) * 100}%`, top: `${((markerXY.y + 1) / 2) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// A tile that copies another light's current color onto the open light.
function OtherLightButton({ light, onApply }: { light: LightRef; onApply: (rgb: Rgb) => void }) {
  const entity = useEntity(asEntityName(light.entityId), { returnNullIfNotFound: true })
  const rgb = readRgb(entity?.attributes?.rgb_color)
  const style = {
    '--other-light-color': rgb ? rgbCss(rgb) : undefined,
  } as CSSProperties

  return (
    <button
      aria-label={`Apply ${light.title} Color`}
      className={styles.otherSwatch}
      data-has-color={rgb ? 'true' : 'false'}
      data-icon="mdi:outdoor-lamp"
      data-icon-color="#ffffff"
      disabled={!rgb}
      onClick={() => rgb && onApply(rgb)}
      style={style}
      type="button"
    >
      <span aria-hidden="true" className={styles.otherIcon}>
        <MaterialIcon name="mdi:outdoor-lamp" size={28} />
      </span>
    </button>
  )
}

export function LightMoreInfoSheet({ entityId, title, open, onClose, lights = [] }: LightMoreInfoSheetProps) {
  const callService = useHass((state) => state.helpers.callService)
  const entity = useEntity(asEntityName(entityId ?? 'light.unavailable'), { returnNullIfNotFound: true })
  const supportsColor = Array.isArray(entity?.attributes?.supported_color_modes)
    && (entity.attributes.supported_color_modes as string[]).some((mode) => COLOR_MODES.includes(mode))

  const liveRgb = readRgb(entity?.attributes?.rgb_color)
  const liveKey = liveRgb ? liveRgb.join(',') : ''
  const [draft, setDraft] = useState<[string, string, string]>(['', '', ''])

  // Sync the RGB inputs with the live color using React's render-time adjustment
  // pattern (no effect) so typing a value the light echoes back does not clobber
  // the field mid-edit.
  const [syncedKey, setSyncedKey] = useState('')
  if (liveRgb && liveKey !== syncedKey) {
    setSyncedKey(liveKey)
    setDraft([String(liveRgb[0]), String(liveRgb[1]), String(liveRgb[2])])
  }

  const applyColor = (rgb: Rgb, target: string) => {
    callService({ domain: 'light', service: 'turn_on', target, serviceData: { rgb_color: rgb } })
  }

  const handleChannel = (index: 0 | 1 | 2, value: string) => {
    const next = [...draft] as [string, string, string]
    next[index] = value
    setDraft(next)
    if (!entityId) return
    const parsed = next.map((channel) => Number(channel))
    const allValid = next.every((channel) => channel !== '') && parsed.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
    if (allValid) applyColor([parsed[0], parsed[1], parsed[2]], entityId)
  }

  const handleReset = () => {
    if (!entityId) return
    // Mirrors the page-level reset: warm white (2000K) at full brightness.
    callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { color_temp_kelvin: 2000, brightness: 255, transition: 1 } })
  }

  const handleApplyAll = () => {
    if (!liveRgb) return
    applyColor(liveRgb, FRONT_YARD_GROUP)
  }

  const otherLights = lights.filter((light) => light.entityId !== entityId)
  const hasOtherColorLights = supportsColor && otherLights.length > 0

  return (
    <ModalSheet contentStyle={LIGHT_COLOR_PICKER_MODAL_STYLE} onClose={onClose} open={open} title={title}>
      <div className={styles.body} data-has-other-lights={hasOtherColorLights ? 'true' : 'false'}>
        {entityId && (
          <section aria-label={`${title} light slider`} className={styles.sliderPane} data-layout="light-slider">
            <LightBrightnessCard entityId={entityId} showStatus tapAction="toggle" title={title} />
          </section>
        )}
        {entityId && supportsColor && (
          <section aria-label={`${title} color controls`} className={styles.controlsPane}>
            <ColorWheel entityId={entityId} />

            <div className={styles.rgbRow}>
              {(['R', 'G', 'B'] as const).map((label, index) => (
                <label className={styles.rgbField} key={label}>
                  <span className={styles.rgbLabel}>{label}</span>
                  <input
                    aria-label={`${title} ${label} channel`}
                    className={styles.rgbInput}
                    inputMode="numeric"
                    max={255}
                    min={0}
                    onChange={(event) => handleChannel(index as 0 | 1 | 2, event.target.value)}
                    type="number"
                    value={draft[index]}
                  />
                </label>
              ))}
            </div>

            <div className={styles.actionRow}>
              <GlassTile
                backgroundColor="rgb(255 197 143)"
                icon="mdi:restore"
                iconColor="#ffffff"
                onClick={handleReset}
                title="Reset"
                tone="light"
              />
              <GlassTile
                backgroundColor={liveRgb ? rgbCss(liveRgb) : undefined}
                icon="mdi:lightbulb-group"
                iconColor="#ffffff"
                onClick={handleApplyAll}
                title="Apply to All Lights"
                tone="light"
              />
            </div>
          </section>
        )}
        {entityId && hasOtherColorLights && (
          <section aria-label="Other Lights" className={styles.otherPane}>
            <div className={styles.separator}>Other Lights</div>
            <div className={styles.otherGrid} data-layout="color-swatch-grid">
              {otherLights.map((light) => (
                <OtherLightButton key={light.entityId} light={light} onApply={(rgb) => applyColor(rgb, entityId)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </ModalSheet>
  )
}
