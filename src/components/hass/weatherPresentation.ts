export type AqiLevel = 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'veryUnhealthy' | 'hazardous'
export type FeelsLikeRelation = 'cooler' | 'similar' | 'warmer'
export type PressureBand = 'above' | 'below' | 'typical'
export type UvLevel = 'extreme' | 'high' | 'low' | 'moderate' | 'veryHigh'
export type VisibilityBand = 'clear' | 'good' | 'moderate' | 'poor' | 'veryPoor'
export const WEATHER_SCENES = ['sunny', 'night', 'clouds', 'fog', 'rain', 'storm', 'snow', 'wind', 'exceptional', 'neutral'] as const
export type WeatherScene = typeof WEATHER_SCENES[number]
export const DEFAULT_WIND_SPEED_UNIT = 'mph'
export const WEATHER_DATA_TRANSITION_MS = 390
export const WIND_ROTATION_EASING = 'cubic-bezier(.32, .72, 0, 1)'

const WIND_COMPASS_POINTS = [
  { abbreviation: 'N', spoken: 'north' },
  { abbreviation: 'NNE', spoken: 'north-northeast' },
  { abbreviation: 'NE', spoken: 'northeast' },
  { abbreviation: 'ENE', spoken: 'east-northeast' },
  { abbreviation: 'E', spoken: 'east' },
  { abbreviation: 'ESE', spoken: 'east-southeast' },
  { abbreviation: 'SE', spoken: 'southeast' },
  { abbreviation: 'SSE', spoken: 'south-southeast' },
  { abbreviation: 'S', spoken: 'south' },
  { abbreviation: 'SSW', spoken: 'south-southwest' },
  { abbreviation: 'SW', spoken: 'southwest' },
  { abbreviation: 'WSW', spoken: 'west-southwest' },
  { abbreviation: 'W', spoken: 'west' },
  { abbreviation: 'WNW', spoken: 'west-northwest' },
  { abbreviation: 'NW', spoken: 'northwest' },
  { abbreviation: 'NNW', spoken: 'north-northwest' },
] as const

interface AqiBandDefinition {
  level: AqiLevel
  max: number
  min: number
}

const AQI_BANDS: readonly AqiBandDefinition[] = [
  { level: 'good', min: 0, max: 50 },
  { level: 'moderate', min: 51, max: 100 },
  { level: 'sensitive', min: 101, max: 150 },
  { level: 'unhealthy', min: 151, max: 200 },
  { level: 'veryUnhealthy', min: 201, max: 300 },
  { level: 'hazardous', min: 301, max: 500 },
]

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function normalizeBearingDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

export function shortestBearingDelta(from: number, to: number) {
  const delta = ((normalizeBearingDegrees(to) - normalizeBearingDegrees(from) + 540) % 360) - 180
  return delta <= -180 ? 180 : delta
}

export function compassRotationDurationMs(from: number, to: number) {
  return Math.round(260 * (1 + Math.min(180, Math.abs(to - from)) / 180))
}

export function classifyUsAqi(value: unknown) {
  const numeric = numberValue(value)
  if (numeric === undefined || numeric < 0) return null
  const rounded = Math.round(numeric)

  const bandIndex = AQI_BANDS.findIndex((band) => rounded <= band.max)
  const resolvedIndex = bandIndex === -1 ? AQI_BANDS.length - 1 : bandIndex
  const band = AQI_BANDS[resolvedIndex]
  const clampedWithinBand = Math.min(band.max, Math.max(band.min, rounded))
  const bandProgress = (clampedWithinBand - band.min) / Math.max(1, band.max - band.min)

  return {
    elevated: rounded > 100,
    level: band.level,
    markerPercent: ((resolvedIndex + bandProgress) / AQI_BANDS.length) * 100,
    value: rounded,
  }
}

export function uvPresentation(value: unknown) {
  const numeric = numberValue(value)
  if (numeric === undefined || numeric < 0) return null

  const level: UvLevel = numeric < 3
    ? 'low'
    : numeric < 6
      ? 'moderate'
      : numeric < 8
        ? 'high'
        : numeric < 11
          ? 'veryHigh'
          : 'extreme'

  return {
    level,
    markerPercent: clampPercent((numeric / 11) * 100),
    value: numeric,
  }
}

export function feelsLikePresentation(actualValue: unknown, apparentValue: unknown, unit: unknown) {
  const actual = numberValue(actualValue)
  const apparent = numberValue(apparentValue)
  if (actual === undefined || apparent === undefined) return null

  const celsius = typeof unit === 'string' && unit.toLowerCase().includes('c')
  const neutralDelta = celsius ? 1 : 2
  const displayRange = celsius ? 7 : 12
  const delta = apparent - actual
  const relation: FeelsLikeRelation = Math.abs(delta) <= neutralDelta ? 'similar' : delta > 0 ? 'warmer' : 'cooler'

  return {
    delta,
    markerPercent: clampPercent(((delta + displayRange) / (displayRange * 2)) * 100),
    relation,
  }
}

export function windBearingPresentation(value: unknown) {
  let degrees: number | undefined
  let reportedAsDegrees = false

  if (typeof value === 'number' && Number.isFinite(value)) {
    degrees = value
    reportedAsDegrees = true
  } else if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().toUpperCase()
    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) {
      degrees = numeric
      reportedAsDegrees = true
    } else {
      const cardinalIndex = WIND_COMPASS_POINTS.findIndex(({ abbreviation }) => abbreviation === normalized)
      if (cardinalIndex === -1) return null
      degrees = cardinalIndex * 22.5
    }
  }

  if (degrees === undefined) return null
  const sourceDegrees = normalizeBearingDegrees(degrees)
  const direction = WIND_COMPASS_POINTS[Math.floor((sourceDegrees + 11.25) / 22.5) % WIND_COMPASS_POINTS.length]

  return {
    cardinal: direction.abbreviation,
    destinationDegrees: (sourceDegrees + 180) % 360,
    displayDegrees: reportedAsDegrees ? Math.round(sourceDegrees) % 360 : undefined,
    sourceDegrees,
    spoken: direction.spoken,
  }
}

export function pressurePresentation(value: unknown, unit: unknown) {
  const numeric = numberValue(value)
  const normalizedUnit = typeof unit === 'string' ? unit.toLowerCase().replace(/\s+/g, '') : ''
  if (numeric === undefined || !normalizedUnit) return null

  let hpa: number | undefined
  if (normalizedUnit.includes('inhg')) hpa = numeric * 33.8638866667
  else if (normalizedUnit.includes('hpa') || normalizedUnit.includes('mbar') || normalizedUnit === 'mb') hpa = numeric
  else if (normalizedUnit.includes('kpa')) hpa = numeric * 10
  else if (normalizedUnit === 'pa') hpa = numeric / 100
  if (hpa === undefined) return null

  const band: PressureBand = hpa < 1009 ? 'below' : hpa > 1023 ? 'above' : 'typical'
  return {
    band,
    hpa,
    markerPercent: clampPercent(((hpa - 970) / 80) * 100),
  }
}

export function visibilityPresentation(value: unknown, unit: unknown) {
  const numeric = numberValue(value)
  if (numeric === undefined || numeric < 0) return null

  const normalizedUnit = typeof unit === 'string' ? unit.toLowerCase().trim() : ''
  const miles = normalizedUnit.includes('km')
    ? numeric * 0.621371
    : normalizedUnit === 'm' || normalizedUnit.includes('meter')
      ? numeric / 1609.344
      : numeric
  const band: VisibilityBand = miles >= 10
    ? 'clear'
    : miles >= 6
      ? 'good'
      : miles >= 3
        ? 'moderate'
        : miles >= 1
          ? 'poor'
          : 'veryPoor'

  return {
    band,
    markerPercent: clampPercent((miles / 10) * 100),
    miles,
  }
}

function dateValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function sunPresentation(state: string | undefined, attributes: Record<string, unknown>, now = Date.now()) {
  const nextRising = dateValue(attributes.next_rising)
  const nextSetting = dateValue(attributes.next_setting)
  if (!nextRising || !nextSetting) return null

  if (state === 'above_horizon') {
    const previousRising = nextRising.getTime() - 24 * 60 * 60 * 1000
    const daylightDuration = nextSetting.getTime() - previousRising
    const markerPercent = daylightDuration > 0 ? clampPercent(((now - previousRising) / daylightDuration) * 100) : undefined
    return {
      markerPercent,
      primary: 'sunset' as const,
      primaryTime: nextSetting,
      secondary: 'sunrise' as const,
      secondaryTime: nextRising,
    }
  }

  return {
    markerPercent: undefined,
    primary: 'sunrise' as const,
    primaryTime: nextRising,
    secondary: 'sunset' as const,
    secondaryTime: nextSetting,
  }
}

export function sunArcMarker(percent: number) {
  const normalized = clampPercent(percent) / 100
  return {
    x: 8 + normalized * 84,
    y: 40 - 72 * normalized * (1 - normalized),
  }
}

export function weatherSceneForCondition(condition: string | undefined, isNight = false): WeatherScene {
  if (condition === 'clear-night' || (isNight && condition === 'sunny')) return 'night'
  if (condition === 'sunny') return 'sunny'
  if (condition === 'partlycloudy' || condition === 'cloudy') return 'clouds'
  if (condition === 'fog') return 'fog'
  if (condition === 'rainy' || condition === 'pouring') return 'rain'
  if (condition === 'lightning' || condition === 'lightning-rainy' || condition === 'hail') return 'storm'
  if (condition === 'snowy' || condition === 'snowy-rainy') return 'snow'
  if (condition === 'windy' || condition === 'windy-variant') return 'wind'
  if (condition === 'exceptional') return 'exceptional'
  return 'neutral'
}
