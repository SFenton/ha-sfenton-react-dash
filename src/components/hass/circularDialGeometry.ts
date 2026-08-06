import type { CSSProperties } from 'react'

export const CIRCULAR_DIAL_VIEWBOX_SIZE = 320
export const CIRCULAR_DIAL_RING_RADIUS = 145
export const CIRCULAR_DIAL_HANDLE_HIT_TARGET_SIZE_PX = 64

const RING_RADIUS_PERCENT = (CIRCULAR_DIAL_RING_RADIUS / CIRCULAR_DIAL_VIEWBOX_SIZE) * 100

export function valueToCircularDialPoint(value: number, min: number, max: number) {
  const percentage = (value - min) / (max - min)
  const angle = percentage * 270
  const radians = ((angle - 225) * Math.PI) / 180
  return {
    x: 50 + Math.cos(radians) * RING_RADIUS_PERCENT,
    y: 50 + Math.sin(radians) * RING_RADIUS_PERCENT,
  }
}

export function circularDialArcPath(from: number, to: number, min: number, max: number) {
  const startValue = Math.max(Math.min(from, max), min)
  const endValue = Math.max(Math.min(to, max), min)
  const delta = endValue - startValue
  if (delta <= 0) return null
  const start = valueToCircularDialPoint(startValue, min, max)
  const end = valueToCircularDialPoint(endValue, min, max)
  const largeArcFlag = (delta / (max - min)) * 270 > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${RING_RADIUS_PERCENT} ${RING_RADIUS_PERCENT} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

export function circularDialHandleStyle(value: number, min: number, max: number, color?: string) {
  const point = valueToCircularDialPoint(value, min, max)
  return {
    '--circular-dial-handle-color': color,
    '--circular-dial-handle-x': `${point.x}%`,
    '--circular-dial-handle-y': `${point.y}%`,
    '--thermostat-handle-x': `${point.x}%`,
    '--thermostat-handle-y': `${point.y}%`,
  } as CSSProperties
}

export function circularDialRawValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number) {
  const x = (2 * (clientX - rect.left - rect.width / 2)) / rect.width
  const y = (2 * (clientY - rect.top - rect.height / 2)) / rect.height
  const phi = Math.atan2(y, x)
  const degrees = (phi / Math.PI) * 180
  const angle = ((degrees + 270) % 360) - 45
  const percentage = Math.max(Math.min(angle / 270, 1), 0)
  return Number(Math.max(Math.min(min + (max - min) * percentage, max), min).toFixed(3))
}

export function circularDialValueFromPoint(rect: DOMRect, clientX: number, clientY: number, min: number, max: number, step: number) {
  const raw = circularDialRawValueFromPoint(rect, clientX, clientY, min, max)
  const stepped = min + Math.round((raw - min) / step) * step
  return Number(Math.max(Math.min(stepped, max), min).toFixed(3))
}

export function circularDialPointIsOnRing(rect: DOMRect, clientX: number, clientY: number, hitTargetSize = CIRCULAR_DIAL_HANDLE_HIT_TARGET_SIZE_PX) {
  const dialSize = Math.min(rect.width, rect.height)
  if (dialSize <= 0) return false
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const distanceFromCenter = Math.hypot(clientX - centerX, clientY - centerY)
  const ringRadius = (CIRCULAR_DIAL_RING_RADIUS / CIRCULAR_DIAL_VIEWBOX_SIZE) * dialSize
  return Math.abs(distanceFromCenter - ringRadius) <= hitTargetSize / 2
}
