import type { CSSProperties } from 'react'

export const THERMOSTAT_DIAL_VIEWBOX_SIZE = 320
export const THERMOSTAT_RING_RADIUS = 145
export const THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX = 64
export const THERMOSTAT_MARKER_OUTER_SIZE_PX = 32
export const THERMOSTAT_MIN_SUPPORTED_MODAL_DIAL_SIZE_PX = 286
export const THERMOSTAT_MODAL_DIAL_GUTTER_PX = 20

const THERMOSTAT_RING_RADIUS_PERCENT = (THERMOSTAT_RING_RADIUS / THERMOSTAT_DIAL_VIEWBOX_SIZE) * 100

export function valueToThermostatPoint(value: number, min: number, max: number) {
  const percentage = (value - min) / (max - min)
  const angle = percentage * 270
  const radians = ((angle - 225) * Math.PI) / 180
  return {
    x: 50 + Math.cos(radians) * THERMOSTAT_RING_RADIUS_PERCENT,
    y: 50 + Math.sin(radians) * THERMOSTAT_RING_RADIUS_PERCENT,
  }
}

export function thermostatArcPath(from: number, to: number, min: number, max: number) {
  const startValue = Math.max(Math.min(from, max), min)
  const endValue = Math.max(Math.min(to, max), min)
  const delta = endValue - startValue
  if (delta <= 0) return null
  const start = valueToThermostatPoint(startValue, min, max)
  const end = valueToThermostatPoint(endValue, min, max)
  const largeArcFlag = (delta / (max - min)) * 270 > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${THERMOSTAT_RING_RADIUS_PERCENT} ${THERMOSTAT_RING_RADIUS_PERCENT} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

export function thermostatHandleStyle(value: number, min: number, max: number) {
  const point = valueToThermostatPoint(value, min, max)
  return {
    '--thermostat-handle-x': `${point.x}%`,
    '--thermostat-handle-y': `${point.y}%`,
  } as CSSProperties
}

export function thermostatRawValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number) {
  const x = (2 * (clientX - rect.left - rect.width / 2)) / rect.width
  const y = (2 * (clientY - rect.top - rect.height / 2)) / rect.height
  const phi = Math.atan2(y, x)
  const degrees = (phi / Math.PI) * 180
  const angle = ((degrees + 270) % 360) - 45
  const percentage = Math.max(Math.min(angle / 270, 1), 0)
  const raw = min + (max - min) * percentage
  return Number(Math.max(Math.min(raw, max), min).toFixed(3))
}

export function thermostatValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number, step: number) {
  const raw = thermostatRawValueFromPoint(rect, clientX, clientY, min, max)
  const stepped = min + Math.round((raw - min) / step) * step
  return Number(Math.max(Math.min(stepped, max), min).toFixed(3))
}

export function thermostatPointIsOnRing(rect: DOMRect, clientX: number, clientY: number, hitTargetSize = THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX) {
  const dialSize = Math.min(rect.width, rect.height)
  if (dialSize <= 0) return false
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const distanceFromCenter = Math.hypot(clientX - centerX, clientY - centerY)
  const ringRadius = (THERMOSTAT_RING_RADIUS / THERMOSTAT_DIAL_VIEWBOX_SIZE) * dialSize
  return Math.abs(distanceFromCenter - ringRadius) <= hitTargetSize / 2
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
