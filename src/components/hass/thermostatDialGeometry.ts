import type { CSSProperties } from 'react'
import {
  CIRCULAR_DIAL_HANDLE_HIT_TARGET_SIZE_PX,
  CIRCULAR_DIAL_RING_RADIUS,
  CIRCULAR_DIAL_VIEWBOX_SIZE,
  circularDialArcPath,
  circularDialPointIsOnRing,
  circularDialRawValueFromPoint,
  circularDialValueFromPoint,
  valueToCircularDialPoint,
} from './circularDialGeometry'

export const THERMOSTAT_DIAL_VIEWBOX_SIZE = CIRCULAR_DIAL_VIEWBOX_SIZE
export const THERMOSTAT_RING_RADIUS = CIRCULAR_DIAL_RING_RADIUS
export const THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX = CIRCULAR_DIAL_HANDLE_HIT_TARGET_SIZE_PX
export const THERMOSTAT_MARKER_OUTER_SIZE_PX = 32
export const THERMOSTAT_MIN_SUPPORTED_MODAL_DIAL_SIZE_PX = 286
export const THERMOSTAT_MODAL_DIAL_GUTTER_PX = 20

export function valueToThermostatPoint(value: number, min: number, max: number) {
  return valueToCircularDialPoint(value, min, max)
}

export function thermostatArcPath(from: number, to: number, min: number, max: number) {
  return circularDialArcPath(from, to, min, max)
}

export function thermostatHandleStyle(value: number, min: number, max: number) {
  const point = valueToThermostatPoint(value, min, max)
  return {
    '--thermostat-handle-x': `${point.x}%`,
    '--thermostat-handle-y': `${point.y}%`,
  } as CSSProperties
}

export function thermostatRawValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number) {
  return circularDialRawValueFromPoint(rect, clientX, clientY, min, max)
}

export function thermostatValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number, step: number) {
  return circularDialValueFromPoint(rect, clientX, clientY, min, max, step)
}

export function thermostatPointIsOnRing(rect: DOMRect, clientX: number, clientY: number, hitTargetSize = THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX) {
  return circularDialPointIsOnRing(rect, clientX, clientY, hitTargetSize)
}

export function thermostatTargetBounds(value: number, min: number, max: number, dialSize: number, targetSize: number) {
  const point = valueToThermostatPoint(value, min, max)
  const halfTarget = targetSize / 2
  const centerX = (point.x / 100) * dialSize
  const centerY = (point.y / 100) * dialSize
  return {
    bottom: centerY + halfTarget,
    left: centerX - halfTarget,
    right: centerX + halfTarget,
    top: centerY - halfTarget,
  }
}

export function thermostatRequiredTopGutter(value: number, min: number, max: number, dialSize: number, targetSize: number) {
  return Math.max(0, -thermostatTargetBounds(value, min, max, dialSize, targetSize).top)
}
