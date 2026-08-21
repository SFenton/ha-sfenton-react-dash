import { ControlSliderCircular } from '@hakit/components'
import { forwardRef, type KeyboardEventHandler, type PointerEventHandler, type ReactNode, type Ref } from 'react'
import { circularDialArcPath, circularDialHandleStyle } from './circularDialGeometry'
import styles from './CircularControlDial.module.css'

type SliderTarget = 'high' | 'low' | 'value'
export type CircularDialPrimaryVariant = 'status' | 'value' | 'wide-status'

interface CircularDialHandleBase {
  color?: string
  dataTarget?: string
  dragging?: boolean
  elementRef?: Ref<HTMLSpanElement>
  id: string
  onKeyDown?: KeyboardEventHandler<HTMLSpanElement>
  onPointerCancel?: PointerEventHandler<HTMLSpanElement>
  onPointerDown?: PointerEventHandler<HTMLSpanElement>
  onPointerMove?: PointerEventHandler<HTMLSpanElement>
  onPointerUp?: PointerEventHandler<HTMLSpanElement>
  value: number
}

export type CircularDialHandle = CircularDialHandleBase & (
  | {
      accessible: false
      ariaLabel?: never
      ariaValueText?: never
    }
  | {
      accessible?: true
      ariaLabel: string
      ariaValueText: string
    }
)

export interface CircularDialTrail {
  color: string
  from: number
  id: string
  to: number
}

export interface CircularDialMarker {
  color?: string
  id: string
  kind: 'current' | 'target'
  value: number
}

interface PositionedCircularDialMarker extends CircularDialMarker {
  clamped: boolean
  positionValue: number
}

interface CircularControlDialProps {
  actionText?: ReactNode
  ariaLabel: string
  colors: { color: string; highColor?: string; lowColor?: string }
  disabled?: boolean
  dual?: boolean
  handles?: CircularDialHandle[]
  high?: number
  inactive?: boolean
  inert?: boolean
  label: string
  low?: number
  markers?: CircularDialMarker[]
  max: number
  min: number
  mode?: 'full'
  off?: boolean
  onChange?: (value: number, target: SliderTarget) => void
  onChangeApplied?: (value: number, target: SliderTarget) => void
  onPointerCancel?: PointerEventHandler<HTMLDivElement>
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onPointerUpCapture?: PointerEventHandler<HTMLDivElement>
  primaryText: ReactNode
  primaryTextVariant?: CircularDialPrimaryVariant
  primaryUnit?: ReactNode
  readonly?: boolean
  secondaryText?: ReactNode
  size?: 'compact' | 'modal' | 'page'
  sliderAriaHidden?: boolean
  step: number
  trails?: CircularDialTrail[]
  value?: number
}

function positionedCircularDialMarkers(markers: CircularDialMarker[], min: number, max: number): PositionedCircularDialMarker[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []
  return markers.flatMap((marker) => {
    if (!Number.isFinite(marker.value)) return []
    const positionValue = Math.max(min, Math.min(max, marker.value))
    return [{ ...marker, clamped: positionValue !== marker.value, positionValue }]
  })
}

function CircularDialMarkerLayer({ markers, min, max }: { markers: PositionedCircularDialMarker[]; min: number; max: number }) {
  if (markers.length === 0) return null
  return (
    <div aria-hidden="true" className={styles.markerLayer} data-marker-layer={markers[0].kind}>
      {markers.map((marker) => (
        <span
          className={styles.marker}
          data-clamped={marker.clamped ? 'true' : 'false'}
          data-marker={marker.kind}
          data-position-value={marker.positionValue}
          data-value={marker.value}
          key={marker.id}
          style={circularDialHandleStyle(marker.positionValue, min, max, marker.color)}
        />
      ))}
    </div>
  )
}

export const CircularControlDial = forwardRef<HTMLDivElement, CircularControlDialProps>(function CircularControlDial({
  actionText,
  ariaLabel,
  colors,
  disabled = false,
  dual = false,
  handles = [],
  high,
  inactive = false,
  inert = false,
  label,
  low,
  markers = [],
  max,
  min,
  mode,
  off = false,
  onChange = () => undefined,
  onChangeApplied = () => undefined,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerUpCapture,
  primaryText,
  primaryTextVariant = off ? 'status' : 'value',
  primaryUnit,
  readonly = false,
  secondaryText,
  size = 'modal',
  sliderAriaHidden = true,
  step,
  trails = [],
  value,
}, ref) {
  const positionedMarkers = positionedCircularDialMarkers(markers, min, max)
  const currentMarkers = positionedMarkers.filter((marker) => marker.kind === 'current')
  const targetMarkers = positionedMarkers.filter((marker) => marker.kind === 'target')

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      className={styles.dial}
      data-base-ui-swipe-ignore="true"
      data-inactive={inactive ? 'true' : 'false'}
      data-off={off ? 'true' : 'false'}
      data-size={size}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerUpCapture={onPointerUpCapture}
      ref={ref}
      role="region"
    >
      <ControlSliderCircular
        aria-hidden={sliderAriaHidden ? true : undefined}
        className={styles.slider}
        colors={colors}
        disabled={disabled}
        dual={dual}
        high={high}
        inactive={inactive}
        inert={inert ? true : undefined}
        label={label}
        low={low}
        max={max}
        min={min}
        mode={mode}
        onChange={onChange}
        onChangeApplied={onChangeApplied}
        readonly={readonly}
        step={step}
        value={value}
      />
      {trails.length > 0 && (
        <svg aria-hidden="true" className={styles.trailLayer} viewBox="0 0 100 100">
          {trails.map((trail) => (
            <path d={circularDialArcPath(trail.from, trail.to, min, max) ?? undefined} key={trail.id} style={{ stroke: trail.color }} />
          ))}
        </svg>
      )}
      <CircularDialMarkerLayer markers={currentMarkers} max={max} min={min} />
      {handles.length > 0 && (
        <div className={styles.handleLayer}>
          {handles.map((handle) => (
            <span
              aria-hidden={handle.accessible === false ? true : undefined}
              aria-label={handle.accessible === false ? undefined : handle.ariaLabel}
              aria-valuemax={handle.accessible === false ? undefined : max}
              aria-valuemin={handle.accessible === false ? undefined : min}
              aria-valuenow={handle.accessible === false ? undefined : handle.value}
              aria-valuetext={handle.accessible === false ? undefined : handle.ariaValueText}
              aria-readonly={handle.accessible === false ? undefined : disabled || readonly ? 'true' : 'false'}
              className={styles.handle}
              data-dragging={handle.dragging ? 'true' : undefined}
              data-target={handle.dataTarget}
              data-value={handle.value}
              key={handle.id}
              onKeyDown={handle.onKeyDown}
              onPointerCancel={handle.onPointerCancel}
              onPointerDown={handle.onPointerDown}
              onPointerMove={handle.onPointerMove}
              onPointerUp={handle.onPointerUp}
              ref={handle.elementRef}
              role={handle.accessible === false ? undefined : 'slider'}
              style={circularDialHandleStyle(handle.value, min, max, handle.color)}
              tabIndex={handle.accessible === false || disabled || readonly ? undefined : 0}
            />
          ))}
        </div>
      )}
      <CircularDialMarkerLayer markers={targetMarkers} max={max} min={min} />
      <div className={styles.readout} data-off={off ? 'true' : 'false'} data-primary-variant={primaryTextVariant} data-readout-state={off ? 'off' : undefined} data-single-value={actionText ? undefined : 'true'}>
        {actionText && <span className={styles.action}>{actionText}</span>}
        <span className={styles.primary}>{primaryText}{primaryUnit && <small>{primaryUnit}</small>}</span>
        {secondaryText && <span className={styles.secondary}>{secondaryText}</span>}
      </div>
    </div>
  )
})
