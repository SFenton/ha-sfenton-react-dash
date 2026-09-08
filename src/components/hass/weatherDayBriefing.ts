import { formatClockTime, formatHourLabel as formatLocaleHour, WEATHER_COPY_KEYS, zonedDateParts } from '../../i18n'
import type { CopyKey } from '../../i18n'
import type { WeatherForecast } from './useWeatherForecasts'
import { conditionInfo, DEFAULT_WIND_SPEED_UNIT } from './weatherPresentation'

export type WeatherBriefingSeverity = 'alert' | 'caution' | 'notable' | 'calm'
export type WeatherHazardKind =
  | 'damagingWind'
  | 'denseFog'
  | 'extremeCold'
  | 'extremeHeat'
  | 'freeze'
  | 'hail'
  | 'heat'
  | 'heavyRain'
  | 'heavySnow'
  | 'highUv'
  | 'ice'
  | 'poorAir'
  | 'severeStorms'
  | 'snow'
  | 'wind'

export type WeatherBriefingCopyKey = CopyKey<'modalWeather'>

export type WeatherBriefingValues = Record<string, number | string | WeatherBriefingRef>

export interface WeatherBriefingRef {
  key: WeatherBriefingCopyKey
  values?: WeatherBriefingValues
}

export type WeatherBriefingSentence = WeatherBriefingRef

export interface WeatherDayBriefing {
  condition: string | undefined
  dateKey: string
  generatedAt: number
  hazard: WeatherHazardKind | null
  headline: WeatherBriefingRef | null
  headlineText: string | null
  icon: string
  sentences: WeatherBriefingSentence[]
  severity: WeatherBriefingSeverity
  version: number
}

export interface WeatherDayBriefingInput {
  aqi?: unknown
  daily?: WeatherForecast[]
  generatedAt: number
  hourly?: WeatherForecast[]
  precipitationUnit?: unknown
  sunrise?: unknown
  sunset?: unknown
  temperatureUnit?: unknown
  timeZone?: string
  windSpeedUnit?: unknown
}

export const WEATHER_BRIEFING_VERSION = 3
const BRIEFING = WEATHER_COPY_KEYS.briefing

const HAZARD_SEVERITY: Record<WeatherHazardKind, WeatherBriefingSeverity> = {
  damagingWind: 'alert',
  denseFog: 'caution',
  extremeCold: 'alert',
  extremeHeat: 'alert',
  freeze: 'notable',
  hail: 'caution',
  heat: 'notable',
  heavyRain: 'caution',
  heavySnow: 'alert',
  highUv: 'notable',
  ice: 'alert',
  poorAir: 'caution',
  severeStorms: 'alert',
  snow: 'caution',
  wind: 'notable',
}

const HAZARD_ICON: Record<WeatherHazardKind, string> = {
  damagingWind: 'mdi:weather-windy',
  denseFog: 'mdi:weather-fog',
  extremeCold: 'mdi:snowflake-alert',
  extremeHeat: 'mdi:thermometer-alert',
  freeze: 'mdi:snowflake',
  hail: 'mdi:weather-hail',
  heat: 'mdi:thermometer-high',
  heavyRain: 'mdi:weather-pouring',
  heavySnow: 'mdi:weather-snowy-heavy',
  highUv: 'mdi:weather-sunny-alert',
  ice: 'mdi:car-traction-control',
  poorAir: 'mdi:air-filter',
  severeStorms: 'mdi:weather-lightning',
  snow: 'mdi:weather-snowy',
  wind: 'mdi:weather-windy',
}

const HAZARD_HEADLINE: Record<WeatherHazardKind, WeatherBriefingCopyKey> = BRIEFING.hazard
const HAZARD_ADVISORY: Record<WeatherHazardKind, WeatherBriefingCopyKey> = BRIEFING.advisory

// Severity first, then meteorological priority inside a severity band.
const HAZARD_PRIORITY: WeatherHazardKind[] = [
  'severeStorms',
  'ice',
  'heavySnow',
  'damagingWind',
  'extremeCold',
  'extremeHeat',
  'hail',
  'heavyRain',
  'snow',
  'poorAir',
  'denseFog',
  'wind',
  'heat',
  'freeze',
  'highUv',
]

const SEVERITY_RANK: Record<WeatherBriefingSeverity, number> = {
  alert: 3,
  calm: 0,
  caution: 2,
  notable: 1,
}

const CONDITION_PHRASE: Record<string, WeatherBriefingCopyKey> = BRIEFING.phrase

// Ranked from calm to disruptive so a mixed segment reports the notable half.
const CONDITION_WEIGHT: Record<string, number> = {
  'clear-night': 0,
  sunny: 0,
  partlycloudy: 1,
  cloudy: 2,
  windy: 3,
  'windy-variant': 3,
  fog: 4,
  rainy: 5,
  'snowy-rainy': 6,
  pouring: 7,
  snowy: 7,
  hail: 8,
  lightning: 9,
  'lightning-rainy': 9,
  exceptional: 10,
}

interface HourSample {
  apparent: number | undefined
  cloud: number | undefined
  condition: string | undefined
  gust: number | undefined
  hour: number
  humidity: number | undefined
  precipitation: number | undefined
  probability: number | undefined
  temperature: number | undefined
  timestamp: number
  uv: number | undefined
  windBearing: number | undefined
  windSpeed: number | undefined
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function isCelsius(unit: unknown) {
  return typeof unit === 'string' && unit.toUpperCase().includes('C')
}

function isMetricDepth(unit: unknown) {
  return typeof unit === 'string' && unit.toLowerCase().includes('mm')
}

function toFahrenheit(value: number, unit: unknown) {
  return isCelsius(unit) ? (value * 9) / 5 + 32 : value
}

function toMph(value: number, unit: unknown) {
  if (typeof unit !== 'string') return value
  const normalized = unit.toLowerCase()
  if (normalized.includes('km')) return value * 0.621371
  if (normalized.includes('m/s')) return value * 2.23694
  if (normalized.includes('kn')) return value * 1.15078
  return value
}

function toInches(value: number, unit: unknown) {
  return isMetricDepth(unit) ? value / 25.4 : value
}

export function localDateKey(timestamp: number, timeZone?: string) {
  const parts = zonedParts(timestamp, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function zonedParts(timestamp: number, timeZone?: string) {
  return zonedDateParts(timestamp, timeZone)
}

function timestampOf(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatTemperature(value: number | undefined) {
  if (value === undefined) return undefined
  return `${Math.round(value)}°`
}

function formatPercent(value: number | undefined) {
  if (value === undefined) return undefined
  return `${Math.round(value)}%`
}

function resolvedUnit(unit: unknown, defaultUnit?: string) {
  return typeof unit === 'string' && unit.trim() ? unit.trim() : defaultUnit
}

function joinMeasure(amount: string, unit: string | undefined) {
  return [amount, unit].filter(Boolean).join(' ')
}

function formatSpeed(value: number | undefined, unit: unknown) {
  if (value === undefined) return undefined
  return joinMeasure(String(Math.round(value)), resolvedUnit(unit, DEFAULT_WIND_SPEED_UNIT))
}

function formatDepth(value: number | undefined, unit: unknown) {
  if (value === undefined) return undefined
  const digits = isMetricDepth(unit) ? (value < 10 ? 1 : 0) : value < 1 ? 2 : 1
  return joinMeasure(value.toFixed(digits), resolvedUnit(unit))
}

function formatClock(timestamp: number, timeZone?: string) {
  return formatClockTime(timestamp, timeZone)
}

function formatHourLabel(timestamp: number, timeZone?: string) {
  return formatLocaleHour(timestamp, timeZone)
}

const WIND_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const

function bearingWord(bearing: number | undefined) {
  if (bearing === undefined) return undefined
  const normalized = ((bearing % 360) + 360) % 360
  return WIND_POINTS[Math.round(normalized / 45) % 8]
}

function bearingValue(value: unknown) {
  const numeric = numberValue(value)
  if (numeric !== undefined) return numeric
  if (typeof value !== 'string') return undefined
  const index = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(value.trim().toUpperCase())
  return index === -1 ? undefined : index * 45
}

function averageBearing(samples: HourSample[]) {
  const bearings = samples.map((sample) => sample.windBearing).filter((value): value is number => value !== undefined)
  if (!bearings.length) return undefined
  const x = bearings.reduce((total, value) => total + Math.cos((value * Math.PI) / 180), 0)
  const y = bearings.reduce((total, value) => total + Math.sin((value * Math.PI) / 180), 0)
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return undefined
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function maxOf(values: (number | undefined)[]) {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length ? Math.max(...defined) : undefined
}

function minOf(values: (number | undefined)[]) {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length ? Math.min(...defined) : undefined
}

function sumOf(values: (number | undefined)[]) {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length ? defined.reduce((total, value) => total + value, 0) : undefined
}

function conditionWeight(condition: string | undefined) {
  if (!condition) return -1
  return CONDITION_WEIGHT[condition] ?? 2
}

function dominantCondition(samples: HourSample[]) {
  const counts = new Map<string, number>()
  for (const sample of samples) {
    if (!sample.condition) continue
    counts.set(sample.condition, (counts.get(sample.condition) ?? 0) + 1)
  }
  if (!counts.size) return undefined
  let best: string | undefined
  let bestCount = -1
  for (const [condition, count] of counts) {
    if (count > bestCount || (count === bestCount && conditionWeight(condition) > conditionWeight(best))) {
      best = condition
      bestCount = count
    }
  }
  // A short but disruptive stretch outranks a marginally longer benign one.
  const severe = [...counts.entries()]
    .filter(([condition, count]) => conditionWeight(condition) >= 7 && count >= Math.max(2, samples.length * 0.25))
    .sort((left, right) => conditionWeight(right[0]) - conditionWeight(left[0]))[0]
  return severe ? severe[0] : best
}

function conditionPhrase(condition: string | undefined): WeatherBriefingCopyKey {
  if (!condition) return BRIEFING.phrase.exceptional
  return CONDITION_PHRASE[condition] ?? BRIEFING.phrase.cloudy
}

function isWetCondition(condition: string | undefined) {
  return condition !== undefined && ['rainy', 'pouring', 'lightning-rainy', 'snowy', 'snowy-rainy', 'hail'].includes(condition)
}

function isFrozenCondition(condition: string | undefined) {
  return condition === 'snowy' || condition === 'snowy-rainy'
}

interface WetWindow {
  end: number
  start: number
}

function wetWindows(samples: HourSample[]) {
  const windows: WetWindow[] = []
  let current: WetWindow | null = null
  for (const sample of samples) {
    const wet = (sample.probability ?? 0) >= 35 || (sample.precipitation ?? 0) > 0.005 || isWetCondition(sample.condition)
    if (wet) {
      if (current) current.end = sample.timestamp
      else current = { end: sample.timestamp, start: sample.timestamp }
    } else if (current) {
      windows.push(current)
      current = null
    }
  }
  if (current) windows.push(current)
  return windows
}

function segmentOf(hour: number) {
  if (hour < 5) return 'overnight' as const
  if (hour < 12) return 'morning' as const
  if (hour < 17) return 'afternoon' as const
  if (hour < 22) return 'evening' as const
  return 'overnight' as const
}

const SEGMENT_KEY = {
  afternoon: BRIEFING.window.afternoon,
  evening: BRIEFING.window.evening,
  morning: BRIEFING.window.morning,
  overnight: BRIEFING.window.overnight,
} as const

export function generateWeatherDayBriefing(input: WeatherDayBriefingInput): WeatherDayBriefing {
  const { generatedAt, timeZone } = input
  const dateKey = localDateKey(generatedAt, timeZone)
  const temperatureUnit = input.temperatureUnit
  const windUnit = typeof input.windSpeedUnit === 'string' && input.windSpeedUnit.trim() ? input.windSpeedUnit : 'mph'
  const precipitationUnit = typeof input.precipitationUnit === 'string' && input.precipitationUnit.trim() ? input.precipitationUnit : 'in'

  const samples: HourSample[] = (input.hourly ?? [])
    .map((forecast) => {
      const timestamp = timestampOf(forecast.datetime)
      if (timestamp === undefined) return undefined
      const parts = zonedParts(timestamp, timeZone)
      return {
        apparent: numberValue(forecast.apparent_temperature),
        cloud: numberValue(forecast.cloud_coverage),
        condition: typeof forecast.condition === 'string' ? forecast.condition : undefined,
        gust: numberValue(forecast.wind_gust_speed),
        hour: parts.hour,
        humidity: numberValue(forecast.humidity),
        precipitation: numberValue(forecast.precipitation),
        probability: numberValue(forecast.precipitation_probability),
        temperature: numberValue(forecast.temperature),
        timestamp,
        uv: numberValue(forecast.uv_index),
        windBearing: bearingValue(forecast.wind_bearing),
        windSpeed: numberValue(forecast.wind_speed),
      } satisfies HourSample
    })
    .filter((sample): sample is HourSample => sample !== undefined)
    .filter((sample) => localDateKey(sample.timestamp, timeZone) === dateKey)
    .sort((left, right) => left.timestamp - right.timestamp)

  const daily = input.daily ?? []
  const today = daily.find((forecast) => {
    const timestamp = timestampOf(forecast.datetime)
    return timestamp !== undefined && localDateKey(timestamp, timeZone) === dateKey
  }) ?? daily[0]

  if (!samples.length && !today) {
    return {
      condition: undefined,
      dateKey,
      generatedAt,
      hazard: null,
      headline: null,
      headlineText: null,
      icon: 'mdi:cloud-question',
      sentences: [{ key: BRIEFING.unavailable }],
      severity: 'calm',
      version: WEATHER_BRIEFING_VERSION,
    }
  }

  const daytime = samples.filter((sample) => sample.hour >= 6 && sample.hour <= 20)
  const conditionPool = daytime.length >= 4 ? daytime : samples
  const dayCondition = dominantCondition(conditionPool)
    ?? (typeof today?.condition === 'string' ? today.condition : undefined)

  const high = maxOf([...samples.map((sample) => sample.temperature), numberValue(today?.temperature)])
  const low = minOf([...samples.map((sample) => sample.temperature), numberValue(today?.templow)])
  const apparentHigh = maxOf(samples.map((sample) => sample.apparent))
  const apparentLow = minOf(samples.map((sample) => sample.apparent))
  const maxProbability = maxOf([...samples.map((sample) => sample.probability), numberValue(today?.precipitation_probability)])
  const totalPrecipitation = samples.length
    ? sumOf(samples.map((sample) => sample.precipitation)) ?? numberValue(today?.precipitation)
    : numberValue(today?.precipitation)
  const maxWind = maxOf([...samples.map((sample) => sample.windSpeed), numberValue(today?.wind_speed)])
  const maxGust = maxOf([...samples.map((sample) => sample.gust), numberValue(today?.wind_gust_speed)])
  const maxUv = maxOf([...samples.map((sample) => sample.uv), numberValue(today?.uv_index)])
  const bearing = averageBearing(samples) ?? bearingValue(today?.wind_bearing)
  const aqi = numberValue(input.aqi)

  const highF = high === undefined ? undefined : toFahrenheit(high, temperatureUnit)
  const lowF = low === undefined ? undefined : toFahrenheit(low, temperatureUnit)
  const apparentHighF = apparentHigh === undefined ? undefined : toFahrenheit(apparentHigh, temperatureUnit)
  const apparentLowF = apparentLow === undefined ? undefined : toFahrenheit(apparentLow, temperatureUnit)
  const gustMph = maxGust === undefined ? undefined : toMph(maxGust, windUnit)
  const windMph = maxWind === undefined ? undefined : toMph(maxWind, windUnit)
  const precipitationIn = totalPrecipitation === undefined ? undefined : toInches(totalPrecipitation, precipitationUnit)

  const conditions = samples.map((sample) => sample.condition)
  const frozenHours = conditions.filter((condition) => isFrozenCondition(condition)).length
  const stormHours = conditions.filter((condition) => condition === 'lightning' || condition === 'lightning-rainy').length
  const hailHours = conditions.filter((condition) => condition === 'hail').length
  const fogHours = conditions.filter((condition) => condition === 'fog').length
  const mixHours = conditions.filter((condition) => condition === 'snowy-rainy').length
  const nearFreezing = samples.some((sample) => {
    const temperature = sample.temperature === undefined ? undefined : toFahrenheit(sample.temperature, temperatureUnit)
    return temperature !== undefined && temperature >= 26 && temperature <= 36
  })

  const hazards = new Set<WeatherHazardKind>()
  if (stormHours >= 1) hazards.add('severeStorms')
  if (hailHours >= 1) hazards.add('hail')
  if (mixHours >= 1 && nearFreezing) hazards.add('ice')
  if (frozenHours >= 1) hazards.add(frozenHours >= 4 && (precipitationIn ?? 0) >= 0.4 ? 'heavySnow' : 'snow')
  if (gustMph !== undefined && gustMph >= 46) hazards.add('damagingWind')
  else if (gustMph !== undefined && gustMph >= 30) hazards.add('wind')
  if (frozenHours === 0 && ((precipitationIn ?? 0) >= 1 || conditions.filter((condition) => condition === 'pouring').length >= 2)) {
    hazards.add('heavyRain')
  }
  const feelsHigh = apparentHighF ?? highF
  const feelsLow = apparentLowF ?? lowF
  if (feelsHigh !== undefined && feelsHigh >= 100) hazards.add('extremeHeat')
  else if (feelsHigh !== undefined && feelsHigh >= 90) hazards.add('heat')
  if (feelsLow !== undefined && feelsLow <= 10) hazards.add('extremeCold')
  else if (feelsLow !== undefined && feelsLow <= 28) hazards.add('freeze')
  if (fogHours >= 2) hazards.add('denseFog')
  if (aqi !== undefined && aqi >= 101) hazards.add('poorAir')
  if (maxUv !== undefined && maxUv >= 8) hazards.add('highUv')

  const hazardSeverity = (kind: WeatherHazardKind) => {
    if (kind === 'severeStorms' && (gustMph ?? 0) < 40 && stormHours < 2) return 'caution' as const
    if (kind === 'poorAir') return (aqi ?? 0) >= 201 ? ('alert' as const) : ('caution' as const)
    return HAZARD_SEVERITY[kind]
  }

  const rankedHazards = [...hazards].sort((left, right) => {
    const bySeverity = SEVERITY_RANK[hazardSeverity(right)] - SEVERITY_RANK[hazardSeverity(left)]
    if (bySeverity !== 0) return bySeverity
    return HAZARD_PRIORITY.indexOf(left) - HAZARD_PRIORITY.indexOf(right)
  })
  const leadHazard = rankedHazards[0] ?? null
  const severity: WeatherBriefingSeverity = leadHazard ? hazardSeverity(leadHazard) : 'calm'
  const headlineOverride = leadHazard !== null && (severity === 'alert' || severity === 'caution')

  const condition = conditionInfo(dayCondition)
  const headline: WeatherDayBriefing['headline'] = headlineOverride && leadHazard
    ? { key: HAZARD_HEADLINE[leadHazard] }
    : condition.labelKey
      ? { key: condition.labelKey }
      : null
  const headlineText = headlineOverride ? null : condition.label ?? null
  const icon = headlineOverride && leadHazard ? HAZARD_ICON[leadHazard] : condition.icon

  const sentences: WeatherBriefingSentence[] = []
  sentences.push(overviewSentence(samples, dayCondition))
  const temperature = temperatureSentence(samples, high, low, apparentHigh, apparentLow, temperatureUnit)
  if (temperature) sentences.push(temperature)
  const precipitation = precipitationSentence({
    maxProbability,
    precipitationUnit,
    samples,
    temperatureUnit,
    timeZone,
    totalPrecipitation,
  })
  if (precipitation) sentences.push(precipitation)
  const wind = windSentence(windMph, gustMph, bearing, windUnit)
  if (wind) sentences.push(wind)
  const advisory = leadHazard
    ? advisorySentence(leadHazard, { aqi, feelsHigh, feelsLow, gust: maxGust, uv: maxUv, windUnit })
    : undefined
  if (advisory) sentences.push(advisory)
  const sun = sunSentence(input.sunrise, input.sunset, dateKey, timeZone)
  if (sun) sentences.push(sun)

  return {
    condition: dayCondition,
    dateKey,
    generatedAt,
    hazard: leadHazard,
    headline,
    headlineText,
    icon,
    sentences,
    severity,
    version: WEATHER_BRIEFING_VERSION,
  }
}

function overviewSentence(samples: HourSample[], dayCondition: string | undefined): WeatherBriefingSentence {
  const morning = dominantCondition(samples.filter((sample) => sample.hour >= 5 && sample.hour < 12))
  const afternoon = dominantCondition(samples.filter((sample) => sample.hour >= 12 && sample.hour < 17))
  const evening = dominantCondition(samples.filter((sample) => sample.hour >= 17 && sample.hour < 22))
  const parts = [morning, afternoon, evening].filter((value): value is string => value !== undefined)
  const distinct = [...new Set(parts)]

  if (!parts.length && !dayCondition) return { key: BRIEFING.overview.unknown }
  if (parts.length < 2 || distinct.length === 1) {
    return { key: BRIEFING.overview.steady, values: { condition: { key: conditionPhrase(dayCondition ?? parts[0]) } } }
  }

  if (parts.length === 3 && distinct.length === 3) {
    const [first, second, third] = parts
    return {
      key: BRIEFING.overview.threePart,
      values: {
        afternoon: { key: conditionPhrase(second) },
        evening: { key: conditionPhrase(third) },
        morning: { key: conditionPhrase(first) },
      },
    }
  }

  const first = parts[0]
  const last = [...parts].reverse().find((value) => value !== first) ?? parts[parts.length - 1]
  const clearing = conditionWeight(last) < conditionWeight(first)
  return {
    key: clearing ? BRIEFING.overview.improving : BRIEFING.overview.twoPart,
    values: {
      later: { key: conditionPhrase(last) },
      start: { key: conditionPhrase(first) },
    },
  }
}

function temperatureSentence(
  samples: HourSample[],
  high: number | undefined,
  low: number | undefined,
  apparentHigh: number | undefined,
  apparentLow: number | undefined,
  unit: unknown,
): WeatherBriefingSentence | undefined {
  if (high === undefined && low === undefined) return undefined
  const highLabel = formatTemperature(high)
  const lowLabel = formatTemperature(low)
  if (!highLabel || !lowLabel) {
    const only = highLabel ?? lowLabel
    return only ? { key: BRIEFING.temperature.single, values: { temperature: only } } : undefined
  }

  const spreadsF = high !== undefined && low !== undefined
    ? Math.abs(toFahrenheit(high, unit) - toFahrenheit(low, unit))
    : 0
  const feelsGapHigh = apparentHigh !== undefined && high !== undefined
    ? toFahrenheit(apparentHigh, unit) - toFahrenheit(high, unit)
    : 0
  const feelsGapLow = apparentLow !== undefined && low !== undefined
    ? toFahrenheit(apparentLow, unit) - toFahrenheit(low, unit)
    : 0

  const peakHour = samples.reduce<HourSample | undefined>((best, sample) => {
    if (sample.temperature === undefined) return best
    if (!best || (best.temperature ?? -Infinity) < sample.temperature) return sample
    return best
  }, undefined)?.hour

  if (Math.abs(feelsGapHigh) >= 6) {
    return {
      key: feelsGapHigh > 0 ? BRIEFING.temperature.feelsWarmer : BRIEFING.temperature.feelsCooler,
      values: { feelsLike: formatTemperature(apparentHigh) ?? highLabel, high: highLabel, low: lowLabel },
    }
  }
  if (feelsGapLow <= -6) {
    return {
      key: BRIEFING.temperature.windChill,
      values: { feelsLike: formatTemperature(apparentLow) ?? lowLabel, high: highLabel, low: lowLabel },
    }
  }
  if (peakHour !== undefined && peakHour < 11 && spreadsF >= 6) {
    return { key: BRIEFING.temperature.falling, values: { high: highLabel, low: lowLabel } }
  }
  if (spreadsF <= 6) {
    return { key: BRIEFING.temperature.flat, values: { high: highLabel, low: lowLabel } }
  }
  return { key: BRIEFING.temperature.range, values: { high: highLabel, low: lowLabel } }
}

function precipitationTypeKey(samples: HourSample[], temperatureUnit: unknown): WeatherBriefingCopyKey {
  const conditions = samples.map((sample) => sample.condition)
  if (conditions.some((condition) => condition === 'lightning' || condition === 'lightning-rainy')) {
    return BRIEFING.precipitationType.thunderstorms
  }
  const snow = conditions.filter((condition) => condition === 'snowy').length
  const mix = conditions.filter((condition) => condition === 'snowy-rainy').length
  const rain = conditions.filter((condition) => condition === 'rainy' || condition === 'pouring').length
  if (mix > 0 && snow === 0 && rain === 0) return BRIEFING.precipitationType.wintryMix
  if (mix > 0 && (snow > 0 || rain > 0)) return BRIEFING.precipitationType.wintryMix
  if (snow > rain) return BRIEFING.precipitationType.snow
  if (rain > 0) return BRIEFING.precipitationType.rain
  // Without a wet hour to read, temperature still tells us what would fall.
  const coldest = minOf(samples.map((sample) =>
    sample.temperature === undefined ? undefined : toFahrenheit(sample.temperature, temperatureUnit)))
  if (coldest === undefined) return BRIEFING.precipitationType.precipitation
  if (coldest <= 30) return BRIEFING.precipitationType.snow
  if (coldest <= 36) return BRIEFING.precipitationType.wintryMix
  return BRIEFING.precipitationType.rain
}

function windowValue(window: WetWindow, samples: HourSample[], timeZone: string | undefined): WeatherBriefingRef | undefined {
  const spanHours = (window.end - window.start) / 3_600_000
  const covered = samples.length ? (spanHours + 1) / samples.length : 0
  if (covered >= 0.7) return undefined
  const startHour = zonedParts(window.start, timeZone).hour
  const endHour = zonedParts(window.end, timeZone).hour
  if (spanHours < 1.5) return { key: BRIEFING.window.around, values: { time: formatHourLabel(window.start, timeZone) } }
  if (segmentOf(startHour) === segmentOf(endHour)) return { key: SEGMENT_KEY[segmentOf(startHour)] }
  // A stretch that runs from midnight or up to bedtime reads better open-ended.
  if (startHour <= 1) return { key: BRIEFING.window.before, values: { end: formatHourLabel(window.end, timeZone) } }
  if (endHour >= 22) return { key: BRIEFING.window.after, values: { start: formatHourLabel(window.start, timeZone) } }
  return {
    key: BRIEFING.window.between,
    values: { end: formatHourLabel(window.end, timeZone), start: formatHourLabel(window.start, timeZone) },
  }
}

function precipitationSentence({
  maxProbability,
  precipitationUnit,
  samples,
  temperatureUnit,
  timeZone,
  totalPrecipitation,
}: {
  maxProbability: number | undefined
  precipitationUnit: unknown
  samples: HourSample[]
  temperatureUnit: unknown
  timeZone: string | undefined
  totalPrecipitation: number | undefined
}): WeatherBriefingSentence | undefined {
  const type = precipitationTypeKey(samples, temperatureUnit)
  const chance = formatPercent(maxProbability)
  const amount = totalPrecipitation !== undefined && totalPrecipitation >= (isMetricDepth(precipitationUnit) ? 0.3 : 0.01)
    ? formatDepth(totalPrecipitation, precipitationUnit)
    : undefined

  if (maxProbability === undefined && amount === undefined) return undefined
  if ((maxProbability ?? 0) < 15 && amount === undefined) {
    return { key: BRIEFING.precipitation.none, values: { type: { key: type } } }
  }
  if ((maxProbability ?? 0) < 35 && amount === undefined) {
    return { key: BRIEFING.precipitation.slight, values: { chance: chance ?? '', type: { key: type } } }
  }

  const windows = wetWindows(samples)
  const longest = windows.reduce<WetWindow | undefined>((best, window) => {
    if (!best) return window
    return window.end - window.start > best.end - best.start ? window : best
  }, undefined)
  const window = longest ? windowValue(longest, samples, timeZone) : undefined

  if (!window) {
    return amount
      ? { key: BRIEFING.precipitation.allDayAmount, values: { amount, chance: chance ?? '', type: { key: type } } }
      : { key: BRIEFING.precipitation.allDay, values: { chance: chance ?? '', type: { key: type } } }
  }
  const values = { chance: chance ?? '', type: { key: type }, window }
  return amount
    ? { key: BRIEFING.precipitation.windowAmount, values: { ...values, amount } }
    : { key: BRIEFING.precipitation.window, values }
}

function windSentence(
  windMph: number | undefined,
  gustMph: number | undefined,
  bearing: number | undefined,
  unit: unknown,
): WeatherBriefingSentence | undefined {
  if (windMph === undefined && gustMph === undefined) return undefined
  const speedLabel = formatSpeed(windMph === undefined ? undefined : fromMph(windMph, unit), unit)
  const gustLabel = formatSpeed(gustMph === undefined ? undefined : fromMph(gustMph, unit), unit)
  const direction = bearingWord(bearing)

  if ((windMph ?? 0) < 6 && (gustMph ?? 0) < 14) return { key: BRIEFING.wind.calm }
  if (gustMph !== undefined && windMph !== undefined && gustMph - windMph >= 8 && gustLabel && speedLabel) {
    return direction
      ? { key: BRIEFING.wind.gustyDirected, values: { direction: { key: BRIEFING.direction[direction] }, gust: gustLabel, speed: speedLabel } }
      : { key: BRIEFING.wind.gusty, values: { gust: gustLabel, speed: speedLabel } }
  }
  if (!speedLabel) return gustLabel ? { key: BRIEFING.wind.gustsOnly, values: { gust: gustLabel } } : undefined
  return direction
    ? { key: BRIEFING.wind.steadyDirected, values: { direction: { key: BRIEFING.direction[direction] }, speed: speedLabel } }
    : { key: BRIEFING.wind.steady, values: { speed: speedLabel } }
}

function fromMph(value: number, unit: unknown) {
  if (typeof unit !== 'string') return value
  const normalized = unit.toLowerCase()
  if (normalized.includes('km')) return value / 0.621371
  if (normalized.includes('m/s')) return value / 2.23694
  if (normalized.includes('kn')) return value / 1.15078
  return value
}

function advisorySentence(
  hazard: WeatherHazardKind,
  context: { aqi?: number; feelsHigh?: number; feelsLow?: number; gust?: number; uv?: number; windUnit: unknown },
): WeatherBriefingSentence {
  const values: WeatherBriefingValues = {}
  if (hazard === 'damagingWind' || hazard === 'wind') {
    values.gust = formatSpeed(context.gust, context.windUnit) ?? ''
  }
  if (hazard === 'extremeHeat' || hazard === 'heat') values.feelsLike = formatTemperature(context.feelsHigh) ?? ''
  if (hazard === 'extremeCold' || hazard === 'freeze') values.feelsLike = formatTemperature(context.feelsLow) ?? ''
  if (hazard === 'poorAir') values.aqi = context.aqi === undefined ? '' : String(Math.round(context.aqi))
  if (hazard === 'highUv') values.uv = context.uv === undefined ? '' : String(Math.round(context.uv))
  return { key: HAZARD_ADVISORY[hazard], values: Object.keys(values).length ? values : undefined }
}

// Home Assistant's sun entity reports the *next* rise and set, which drift onto the
// following day once today's event has passed. Pull each back onto the briefing's day.
function alignToDay(timestamp: number | undefined, dateKey: string, timeZone: string | undefined) {
  if (timestamp === undefined) return undefined
  for (const shifted of [timestamp, timestamp - 86_400_000, timestamp + 86_400_000]) {
    if (localDateKey(shifted, timeZone) === dateKey) return shifted
  }
  return undefined
}

function sunSentence(
  sunrise: unknown,
  sunset: unknown,
  dateKey: string,
  timeZone: string | undefined,
): WeatherBriefingSentence | undefined {
  const rise = alignToDay(timestampOf(sunrise), dateKey, timeZone)
  const set = alignToDay(timestampOf(sunset), dateKey, timeZone)
  if (rise === undefined || set === undefined || set <= rise) return undefined
  const totalMinutes = Math.round((set - rise) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const values = { count: hours, sunrise: formatClock(rise, timeZone), sunset: formatClock(set, timeZone) }
  return minutes <= 1
    ? { key: BRIEFING.sun.daylightWhole, values }
    : { key: BRIEFING.sun.daylight, values: { ...values, minutes } }
}

export type WeatherBriefingCopy = <K extends WeatherBriefingCopyKey>(key: K, values?: Record<string, unknown>) => string

function resolveValues(copy: WeatherBriefingCopy, values: WeatherBriefingValues | undefined) {
  if (!values) return undefined
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      typeof value === 'string' || typeof value === 'number' ? value : renderBriefingRef(copy, value),
    ]),
  )
}

export function renderBriefingRef(copy: WeatherBriefingCopy, ref: WeatherBriefingRef): string {
  return copy(ref.key, resolveValues(copy, ref.values))
}

export function renderWeatherBriefingText(copy: WeatherBriefingCopy, briefing: WeatherDayBriefing) {
  return briefing.sentences.map((sentence) => renderBriefingRef(copy, sentence)).join(' ')
}

export function weatherBriefingHeadline(copy: WeatherBriefingCopy, briefing: WeatherDayBriefing) {
  if (briefing.headline) return renderBriefingRef(copy, briefing.headline)
  return briefing.headlineText ?? ''
}
