const HOUR_MS = 60 * 60 * 1000
const CHANCE_DOMAIN_MIN = 10
const CHANCE_DOMAIN_STEP = 10
const CHANCE_DOMAIN_MAX = 100
const AMOUNT_AXIS_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10] as const
const AXIS_EPSILON = 1e-9

export interface PrecipitationForecastInput {
  datetime?: string
  precipitation?: unknown
  precipitation_probability?: unknown
}

export interface PrecipitationTimelinePoint {
  amount: number | null
  cumulative: number | null
  endTime: Date | null
  index: number
  probability: number | null
  startTime: Date | null
}

export interface PrecipitationAmountAxis {
  domain: number
  maximumFractionDigits: number
  step: number
}

function finiteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function nonNegativeNumber(value: unknown) {
  const numeric = finiteNumber(value)
  return numeric === null ? null : Math.max(0, numeric)
}

function forecastDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildPrecipitationTimeline(forecasts: readonly PrecipitationForecastInput[], limit = 24) {
  let cumulative: number | null = 0
  return forecasts.slice(0, limit).map((forecast, index): PrecipitationTimelinePoint => {
    const startTime = forecastDate(forecast.datetime)
    const probabilityValue = nonNegativeNumber(forecast.precipitation_probability)
    const amount = nonNegativeNumber(forecast.precipitation)
    cumulative = cumulative === null || amount === null ? null : cumulative + amount

    return {
      amount,
      cumulative,
      endTime: startTime ? new Date(startTime.getTime() + HOUR_MS) : null,
      index,
      probability: probabilityValue === null ? null : Math.min(100, probabilityValue),
      startTime,
    }
  })
}

export function precipitationPeakChance(points: readonly PrecipitationTimelinePoint[]) {
  const values = points.flatMap((point) => point.probability === null ? [] : [point.probability])
  return values.length ? Math.max(...values) : null
}

export function precipitationTotal(points: readonly PrecipitationTimelinePoint[]) {
  return points.at(-1)?.cumulative ?? null
}

export function precipitationChanceDomain(peak: number | null) {
  if (peak === null || !Number.isFinite(peak)) return CHANCE_DOMAIN_MIN
  const bounded = Math.min(CHANCE_DOMAIN_MAX, Math.max(0, peak))
  return Math.min(CHANCE_DOMAIN_MAX, Math.max(CHANCE_DOMAIN_MIN, Math.ceil(bounded / CHANCE_DOMAIN_STEP) * CHANCE_DOMAIN_STEP))
}

export function precipitationScaledPercent(value: number | null, domain: number) {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(domain) || domain <= 0) return 0
  return roundedAxisValue(Math.min(100, Math.max(0, (value / domain) * 100)))
}

function roundedAxisValue(value: number, maximumFractionDigits = 6) {
  const factor = 10 ** maximumFractionDigits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function decimalPlaces(value: number, maximumFractionDigits: number) {
  const fixed = roundedAxisValue(value, maximumFractionDigits).toFixed(maximumFractionDigits).replace(/0+$/, '')
  return fixed.includes('.') ? fixed.length - fixed.indexOf('.') - 1 : 0
}

function millimeterUnit(unit: string) {
  return unit.trim().toLowerCase().includes('mm')
}

export function precipitationAmountAxis(total: number | null, unit: string): PrecipitationAmountAxis {
  const metric = millimeterUnit(unit)
  const minimumStep = metric ? 0.25 : 0.01
  const maximumFractionDigits = metric ? 2 : 3
  const boundedTotal = total !== null && Number.isFinite(total) ? Math.max(0, total) : 0
  const targetStep = Math.max(minimumStep, boundedTotal / 2)
  const startingExponent = Math.floor(Math.log10(targetStep))

  for (let exponent = startingExponent - 1; exponent <= startingExponent + 12; exponent += 1) {
    const magnitude = 10 ** exponent
    for (const factor of AMOUNT_AXIS_FACTORS) {
      const step = roundedAxisValue(factor * magnitude)
      if (step + AXIS_EPSILON < targetStep || step + AXIS_EPSILON < minimumStep) continue
      const domain = roundedAxisValue(step * 2)
      const requiredDigits = Math.max(
        decimalPlaces(step, maximumFractionDigits + 2),
        decimalPlaces(domain, maximumFractionDigits + 2),
      )
      if (requiredDigits > maximumFractionDigits) continue
      return { domain, maximumFractionDigits: requiredDigits, step }
    }
  }

  const step = roundedAxisValue(targetStep, maximumFractionDigits)
  return {
    domain: roundedAxisValue(step * 2, maximumFractionDigits),
    maximumFractionDigits,
    step,
  }
}

export function precipitationLabelCadence(itemCount: number, plotWidth: number, widestLabelWidth: number, gap = 6) {
  if (itemCount <= 0) return 1
  if (plotWidth <= 0 || widestLabelWidth <= 0) return Math.max(1, Math.ceil(itemCount / 4))
  const capacity = Math.max(1, Math.floor(plotWidth / (widestLabelWidth + gap)))
  return Math.max(1, Math.ceil(itemCount / capacity))
}

export function precipitationLabelIndices(itemCount: number, cadence: number) {
  if (itemCount <= 0) return []
  const normalizedCadence = Math.max(1, Math.floor(cadence))
  return Array.from({ length: itemCount }, (_, index) => index).filter((index) => index % normalizedCadence === 0)
}
