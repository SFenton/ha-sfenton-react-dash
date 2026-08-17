import type { CardColor } from '../core/Card'

interface ColorStop {
  color: CardColor
  value: number
}

const TEMPERATURE_GRADIENT: readonly ColorStop[] = [
  { value: 50, color: { r: 0, g: 110, b: 255 } },
  { value: 60, color: { r: 128, g: 0, b: 255 } },
  { value: 68, color: { r: 0, g: 200, b: 120 } },
  { value: 74, color: { r: 255, g: 215, b: 0 } },
  { value: 80, color: { r: 255, g: 165, b: 0 } },
  { value: 85, color: { r: 255, g: 0, b: 0 } },
]

const HUMIDITY_GRADIENT: readonly ColorStop[] = [
  { value: 20, color: { r: 0, g: 110, b: 255 } },
  { value: 30, color: { r: 128, g: 0, b: 255 } },
  { value: 40, color: { r: 0, g: 200, b: 120 } },
  { value: 50, color: { r: 255, g: 215, b: 0 } },
  { value: 60, color: { r: 255, g: 165, b: 0 } },
  { value: 70, color: { r: 255, g: 0, b: 0 } },
]

function colorFromGradient(value: number | null, stops: readonly ColorStop[]) {
  if (value === null) return null
  const firstStop = stops[0]
  const lastStop = stops[stops.length - 1]
  const bounded = Math.min(Math.max(value, firstStop.value), lastStop.value)
  if (bounded <= firstStop.value) return firstStop.color
  if (bounded >= lastStop.value) return lastStop.color

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index]
    const end = stops[index + 1]
    if (bounded < start.value || bounded > end.value) continue
    const ratio = (bounded - start.value) / (end.value - start.value)
    return {
      r: Math.round(start.color.r + (end.color.r - start.color.r) * ratio),
      g: Math.round(start.color.g + (end.color.g - start.color.g) * ratio),
      b: Math.round(start.color.b + (end.color.b - start.color.b) * ratio),
    }
  }

  return lastStop.color
}

export function colorFromRgba(value: string | undefined) {
  if (!value) return null
  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)/i)
  if (!match) return null
  const [, red, green, blue] = match
  return { r: Math.round(Number(red)), g: Math.round(Number(green)), b: Math.round(Number(blue)) }
}

export function colorFromTemperature(value: number | null) {
  return colorFromGradient(value, TEMPERATURE_GRADIENT)
}

export function colorFromHumidity(value: number | null) {
  return colorFromGradient(value, HUMIDITY_GRADIENT)
}

export function cardColorCss(color: CardColor | null, alpha = 0.6) {
  return color ? `rgb(${color.r} ${color.g} ${color.b} / ${alpha})` : undefined
}
