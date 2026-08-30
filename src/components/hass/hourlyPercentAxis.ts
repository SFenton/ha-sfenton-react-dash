export type HourlyPercentMetric = 'cloud' | 'humidity'

export interface HourlyPercentAxis {
  lower: number
  middle: number
  truncated: boolean
  upper: number
}

const GUIDE_STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const
const MIN_DATA_SPAN = 4
const ZERO_REACH_RATIO = 0.35

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function availableValues(values: readonly (number | null)[]) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value)).map(clampPercent)
}

function zeroBasedAxis(maximum: number): HourlyPercentAxis {
  const upper = Math.min(100, Math.max(10, Math.ceil(maximum / 10) * 10))
  return { lower: 0, middle: upper / 2, truncated: false, upper }
}

function compareKeys(left: readonly number[], right: readonly number[]) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

export function hourlyPercentAxis(values: readonly (number | null)[], metric: HourlyPercentMetric): HourlyPercentAxis | null {
  const available = availableValues(values)
  if (!available.length) return null

  const minimum = Math.min(...available)
  const maximum = Math.max(...available)
  if (metric === 'cloud' && (maximum === 0 || minimum <= ZERO_REACH_RATIO * maximum)) return zeroBasedAxis(maximum)

  let low = minimum
  let high = maximum
  const deficit = MIN_DATA_SPAN - (high - low)
  if (deficit > 0) {
    low = Math.max(0, low - deficit / 2)
    high = Math.min(100, high + deficit / 2)
  }

  let best: { axis: HourlyPercentAxis; key: readonly number[] } | null = null
  for (const step of GUIDE_STEPS) {
    const span = step * 2
    for (let lower = 0; lower <= 100 - span; lower += 5) {
      const upper = lower + span
      if (lower > low || upper < high) continue
      const middle = lower + step
      const roundGuides = [lower, middle, upper].filter((guide) => guide % 10 === 0).length
      const balance = Math.abs((low - lower) - (upper - high))
      const key = [span, -roundGuides, balance, lower] as const
      if (!best || compareKeys(key, best.key) < 0) {
        best = {
          axis: { lower, middle, truncated: lower > 0, upper },
          key,
        }
      }
    }
  }

  return best?.axis ?? { lower: 0, middle: 50, truncated: false, upper: 100 }
}

export function hourlyPercentPosition(value: number | null, axis: HourlyPercentAxis) {
  if (value === null || !Number.isFinite(value)) return 0
  const span = axis.upper - axis.lower
  if (span <= 0) return 0
  return Math.round(clampPercent(((value - axis.lower) / span) * 100) * 1e6) / 1e6
}
