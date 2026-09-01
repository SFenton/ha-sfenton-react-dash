import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import effects from '../../styles/effects.module.css'
import { SUN_ENTITY, WEATHER_AQI_ENTITY, WEATHER_ENTITY } from '../../constants/atAGlance'
import { WEATHER_HOURLY_MODES, type WeatherHourlyMode } from '../../constants/surfaceSemantics'
import { CORE_COPY_KEYS, CORE_COPY_NAMESPACE, formatDate, useCopy, WEATHER_COPY_KEYS, WEATHER_COPY_NAMESPACE, type CopyKey, type CopyValues } from '../../i18n'
import { useHorizontalScrollControls } from '../../hooks/useHorizontalScrollControls'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MaterialIcon } from '../core/Icon'
import { materialIconPath } from '../core/iconPaths'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import { SurfaceAccessory } from '../core/SurfaceAccessory'
import { asEntityName } from './entityState'
import { WeatherAtmosphere } from './WeatherAtmosphere'
import { WeatherHourlyMetricTiles } from './WeatherHourlyMetricTiles'
import { WeatherPrecipitationTile } from './WeatherPrecipitationTile'
import {
  classifyUsAqi,
  compassRotationDurationMs,
  DEFAULT_WIND_SPEED_UNIT,
  feelsLikePresentation,
  pressurePresentation,
  shortestBearingDelta,
  sunArcMarker,
  sunPresentation,
  uvPresentation,
  visibilityPresentation,
  WIND_ROTATION_EASING,
  windBearingPresentation,
  type AqiLevel,
  type UvLevel,
} from './weatherPresentation'
import styles from './WeatherSummary.module.css'

type CallService = <Response extends object>(params: Record<string, unknown>) => Promise<{ response: Response }> | void

interface WeatherForecast {
  apparent_temperature?: number
  cloud_coverage?: number
  condition?: string
  datetime?: string
  dew_point?: number
  humidity?: number
  precipitation?: number
  precipitation_probability?: number
  pressure?: number
  temperature?: number
  templow?: number
  uv_index?: number
  wind_bearing?: number | string
  wind_gust_speed?: number
  wind_speed?: number
}

interface WeatherForecastResponse {
  service_response?: Record<string, { forecast?: WeatherForecast[] }>
  [entityId: string]: { forecast?: WeatherForecast[] } | Record<string, { forecast?: WeatherForecast[] }> | undefined
}

type WeatherRangeStyle = CSSProperties & {
  '--range-marker'?: string
  '--range-size'?: string
  '--range-start'?: string
}

type WeatherPercentStyle = CSSProperties & {
  '--percent-fill'?: string
}

type AqiStyle = CSSProperties & {
  '--aqi-marker'?: string
}

type HighlightKind = 'feels' | 'humidity' | 'wind' | 'visibility' | 'pressure' | 'uv' | 'cloud' | 'sun'

type WeatherHighlightStyle = CSSProperties & {
  '--pressure-high-label-x'?: string
  '--pressure-low-label-x'?: string
  '--highlight-percent'?: string
  '--highlight-rotation'?: string
}

interface WeatherHighlightData {
  ariaLabel?: string
  available: boolean
  icon: string
  kind: HighlightKind
  percent?: number
  rotation?: number
  status?: string
  title: string
  value: string
  wide?: boolean
  wind?: {
    bearingDegrees?: number
    destinationDegrees?: number
    directionLabel: string
    directionValue: string
    gustIsForecast: boolean
    gustLabel: string
    gustValue: string
    showVector: boolean
    speedLabel: string
    speedValue: string
  }
}

type HourlyMode = WeatherHourlyMode
type ModeTransitionPhase = 'idle' | 'out' | 'in'
type WeatherCopy = <K extends CopyKey<typeof WEATHER_COPY_NAMESPACE>>(key: K, values?: CopyValues) => string

const DEFAULT_PRECIPITATION_UNIT = 'in'
const WEATHER_MODAL_STYLE: ModalSheetStyle = {
  '--color-modal-surface': 'var(--rd-weather-modal-surface)',
}

const AQI_CATEGORY_COPY_KEYS: Record<AqiLevel, CopyKey<typeof WEATHER_COPY_NAMESPACE>> = WEATHER_COPY_KEYS.aqi.categories
const AQI_GUIDANCE_COPY_KEYS: Record<AqiLevel, CopyKey<typeof WEATHER_COPY_NAMESPACE>> = WEATHER_COPY_KEYS.aqi.guidance
const UV_CATEGORY_COPY_KEYS: Record<UvLevel, CopyKey<typeof WEATHER_COPY_NAMESPACE>> = WEATHER_COPY_KEYS.details.uv.categories
const SUN_TITLE_COPY_KEYS = {
  sunrise: WEATHER_COPY_KEYS.details.sun.sunrise,
  sunset: WEATHER_COPY_KEYS.details.sun.sunset,
} as const

const WEATHER_CONDITIONS: Record<string, { icon: string; label: string }> = {
  'clear-night': { icon: 'mdi:weather-night', label: 'Clear Night' },
  cloudy: { icon: 'mdi:cloud', label: 'Cloudy' },
  exceptional: { icon: 'mdi:alert-circle', label: 'Exceptional' },
  fog: { icon: 'mdi:weather-fog', label: 'Fog' },
  hail: { icon: 'mdi:weather-hail', label: 'Hail' },
  lightning: { icon: 'mdi:weather-lightning', label: 'Lightning' },
  'lightning-rainy': { icon: 'mdi:weather-lightning-rainy', label: 'Storms' },
  partlycloudy: { icon: 'mdi:weather-partly-cloudy', label: 'Partly Cloudy' },
  pouring: { icon: 'mdi:weather-pouring', label: 'Heavy Rain' },
  rainy: { icon: 'mdi:weather-rainy', label: 'Rain' },
  snowy: { icon: 'mdi:weather-snowy', label: 'Snow' },
  'snowy-rainy': { icon: 'mdi:weather-snowy-rainy', label: 'Wintry Mix' },
  sunny: { icon: 'mdi:weather-sunny', label: 'Sunny' },
  windy: { icon: 'mdi:weather-windy', label: 'Windy' },
  'windy-variant': { icon: 'mdi:weather-windy-variant', label: 'Windy Clouds' },
}

const GLYPH_COLOR = {
  alert: '#ff9a3d',
  cloud: '#ffffff',
  fog: '#f2fbff',
  hail: '#5ee0ff',
  lightning: '#ffd34d',
  moon: '#dbe7ff',
  rain: '#57d7ff',
  snow: '#78e7ff',
  sun: '#ffd34d',
  wind: '#ffffff',
} as const

function GlyphPath({ color, name, opacity, transform }: { color: string; name: string; opacity?: number; transform?: string }) {
  return <path d={materialIconPath(name)} fill={color} opacity={opacity} transform={transform} />
}

function GlyphRain({ heavy = false }: { heavy?: boolean }) {
  const drops = heavy ? [7.4, 11.8, 16.2] : [8.9, 15.1]
  return (
    <g fill={GLYPH_COLOR.rain} opacity="0.96">
      {drops.map((x, index) => (
        <path d="M0-3c1.05 1.35 1.65 2.58 1.65 3.7C1.65 1.85.9 2.78 0 2.78S-1.65 1.85-1.65.7C-1.65-.42-1.05-1.65 0-3Z" key={x} transform={`translate(${x} ${heavy ? 18.5 + (index % 2) * 1.6 : 18.9})`} />
      ))}
    </g>
  )
}

function GlyphHail() {
  return (
    <g fill={GLYPH_COLOR.hail} opacity="0.98" stroke="rgba(6, 54, 68, 0.58)" strokeWidth="0.35">
      <circle cx="7.4" cy="18.9" r="1.55" />
      <circle cx="12" cy="21" r="1.55" />
      <circle cx="16.6" cy="18.9" r="1.55" />
    </g>
  )
}

function GlyphSnowflake({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g stroke={GLYPH_COLOR.snow} strokeLinecap="round" strokeWidth={1.25 * scale} transform={`translate(${x} ${y})`}>
      <line x1={-2.2 * scale} x2={2.2 * scale} y1="0" y2="0" />
      <line x1={-1.55 * scale} x2={1.55 * scale} y1={-1.55 * scale} y2={1.55 * scale} />
      <line x1={-1.55 * scale} x2={1.55 * scale} y1={1.55 * scale} y2={-1.55 * scale} />
    </g>
  )
}

function GlyphSnow({ mixed = false }: { mixed?: boolean } = {}) {
  if (mixed) {
    return (
      <g opacity="0.98">
        <GlyphSnowflake x={13.6} y={18.8} scale={0.72} />
        <GlyphSnowflake x={17.4} y={20.8} scale={0.72} />
      </g>
    )
  }

  return (
    <g opacity="0.98">
      <GlyphSnowflake x={7.7} y={18.7} scale={0.76} />
      <GlyphSnowflake x={12.1} y={21} scale={0.76} />
      <GlyphSnowflake x={16.5} y={18.7} scale={0.76} />
    </g>
  )
}

function GlyphMixedPrecipitation() {
  return (
    <g opacity="0.98">
      <path d="M0-3c1.05 1.35 1.65 2.58 1.65 3.7C1.65 1.85.9 2.78 0 2.78S-1.65 1.85-1.65.7C-1.65-.42-1.05-1.65 0-3Z" fill={GLYPH_COLOR.rain} transform="translate(8.4 19.5)" />
      <GlyphSnow mixed />
    </g>
  )
}

function GlyphFog() {
  return (
    <g fill={GLYPH_COLOR.fog} opacity="0.92">
      <rect height="1.3" rx="0.65" width="12.4" x="5.8" y="16.4" />
      <rect height="1.35" rx="0.68" width="16" x="4" y="19.2" />
      <rect height="1.3" rx="0.65" width="10.8" x="6.6" y="21.6" />
    </g>
  )
}

function GlyphLightning() {
  return <GlyphPath color={GLYPH_COLOR.lightning} name="mdi:flash" transform="translate(6.6 8.4) scale(0.5)" />
}

function GlyphSun({ transform }: { transform?: string } = {}) {
  return (
    <g stroke={GLYPH_COLOR.sun} strokeLinecap="round" strokeWidth="1.9" transform={transform}>
      <circle cx="12" cy="12" fill={GLYPH_COLOR.sun} r="5.1" stroke="none" />
      <line x1="12" x2="12" y1="2.3" y2="5.1" />
      <line x1="12" x2="12" y1="18.9" y2="21.7" />
      <line x1="2.3" x2="5.1" y1="12" y2="12" />
      <line x1="18.9" x2="21.7" y1="12" y2="12" />
      <line x1="5.1" x2="7.1" y1="5.1" y2="7.1" />
      <line x1="16.9" x2="18.9" y1="16.9" y2="18.9" />
      <line x1="5.1" x2="7.1" y1="18.9" y2="16.9" />
      <line x1="16.9" x2="18.9" y1="7.1" y2="5.1" />
    </g>
  )
}

function GlyphWindWithCloud() {
  return (
    <>
      <GlyphPath color="#d7f7ff" name="mdi:weather-windy" transform="translate(4.4 -1.4) scale(0.82)" />
      <GlyphPath color={GLYPH_COLOR.cloud} name="mdi:cloud" transform="translate(-1.8 5.8) scale(0.68)" />
    </>
  )
}

export function WeatherGlyph({ condition, size = 24 }: { condition?: string; size?: number }) {
  const cloud = <GlyphPath color={GLYPH_COLOR.cloud} name="mdi:cloud" />

  return (
    <svg aria-hidden="true" className={styles.weatherGlyph} focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      {condition === 'clear-night' ? <GlyphPath color={GLYPH_COLOR.moon} name="mdi:weather-night" /> : null}
      {condition === 'cloudy' ? cloud : null}
      {condition === 'exceptional' ? (
        <>
          {cloud}
          <GlyphPath color={GLYPH_COLOR.alert} name="mdi:alert-circle" transform="translate(9.7 9.4) scale(0.5)" />
        </>
      ) : null}
      {condition === 'fog' ? (
        <>
          {cloud}
          <GlyphFog />
        </>
      ) : null}
      {condition === 'hail' ? (
        <>
          {cloud}
          <GlyphHail />
        </>
      ) : null}
      {condition === 'lightning' ? (
        <>
          {cloud}
          <GlyphLightning />
        </>
      ) : null}
      {condition === 'lightning-rainy' ? (
        <>
          {cloud}
          <GlyphRain />
          <GlyphLightning />
        </>
      ) : null}
      {condition === 'partlycloudy' ? (
        <>
          <GlyphSun transform="translate(-3.6 -3.4) scale(0.9)" />
          <GlyphPath color={GLYPH_COLOR.cloud} name="mdi:cloud" transform="translate(4.9 5.9) scale(0.7)" />
        </>
      ) : null}
      {condition === 'pouring' ? (
        <>
          {cloud}
          <GlyphRain heavy />
        </>
      ) : null}
      {condition === 'rainy' ? (
        <>
          {cloud}
          <GlyphRain />
        </>
      ) : null}
      {condition === 'snowy' ? (
        <>
          {cloud}
          <GlyphSnow />
        </>
      ) : null}
      {condition === 'snowy-rainy' ? (
        <>
          {cloud}
          <GlyphMixedPrecipitation />
        </>
      ) : null}
      {condition === 'sunny' ? <GlyphSun /> : null}
      {condition === 'windy' ? <GlyphPath color={GLYPH_COLOR.wind} name="mdi:weather-windy" /> : null}
      {condition === 'windy-variant' ? <GlyphWindWithCloud /> : null}
      {!condition || !(condition in WEATHER_CONDITIONS) ? (
        <>
          {cloud}
          <GlyphPath color={GLYPH_COLOR.alert} name="mdi:alert-circle" transform="translate(9.7 9.4) scale(0.5)" />
        </>
      ) : null}
    </svg>
  )
}

const FORECAST_PLACEHOLDERS = Array.from({ length: 7 }, (_, index) => index)
const HERO_HOURLY_PLACEHOLDERS = Array.from({ length: 8 }, (_, index) => index)
const FORECAST_CACHE_TTL_MS = 5 * 60 * 1000
const PRESSURE_TICK_COUNT = 49
const PRESSURE_ARC_START_DEGREES = 145
const PRESSURE_ARC_SPAN_DEGREES = 250
const WIND_COMPASS_TICK_COUNT = 48

interface ForecastCache {
  forecasts: WeatherForecast[]
  updatedAt: number
}

let dailyForecastCache: ForecastCache | null = null
let hourlyForecastCache: ForecastCache | null = null

function cacheFresh(cache: ForecastCache | null) {
  return Boolean(cache && Date.now() - cache.updatedAt < FORECAST_CACHE_TTL_MS)
}

function pressureGaugeLine(percent: number, innerRadius: number, outerRadius: number) {
  const angle = ((PRESSURE_ARC_START_DEGREES + (clampPercent(percent) / 100) * PRESSURE_ARC_SPAN_DEGREES) * Math.PI) / 180
  const centerX = 100
  const centerY = 94

  return {
    x1: centerX + Math.cos(angle) * innerRadius,
    x2: centerX + Math.cos(angle) * outerRadius,
    y1: centerY + Math.sin(angle) * innerRadius,
    y2: centerY + Math.sin(angle) * outerRadius,
  }
}

function pressureLabelStyle(percent: number | undefined, rotation?: number): WeatherHighlightStyle | undefined {
  const low = pressureGaugeLine(0, 60, 70)
  const high = pressureGaugeLine(100, 60, 70)

  return {
    ...highlightStyle(percent, rotation),
    '--pressure-low-label-x': `${(low.x1 / 200) * 100}%`,
    '--pressure-high-label-x': `${(high.x1 / 200) * 100}%`,
  }
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function conditionInfo(condition: string | undefined) {
  if (!condition) return { icon: 'mdi:alert-circle', label: 'Weather Unavailable' }
  return (
    WEATHER_CONDITIONS[condition] ?? {
      icon: 'mdi:cloud',
      label: condition.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }
  )
}

function unitWithoutDegree(unit: unknown, fallback: string) {
  return typeof unit === 'string' && unit.trim() ? unit.replace('°', '') : fallback
}

function formatTemperatureValue(value: unknown, unit: unknown) {
  const temperature = numberValue(value)
  if (temperature === undefined || temperature === null) return '--'
  return `${Math.round(temperature)}°${unitWithoutDegree(unit, 'F')}`
}

function formatDegreeValue(value: unknown) {
  const temperature = numberValue(value)
  if (temperature === undefined || temperature === null) return '--'
  return `${Math.round(temperature)}°`
}

function weatherTemperature(entity: HassEntity | null) {
  return formatTemperatureValue(entity?.attributes.temperature, entity?.attributes.temperature_unit)
}

function weatherDegree(entity: HassEntity | null) {
  return formatDegreeValue(entity?.attributes.temperature)
}

function formatNumber(value: unknown, digits = 0) {
  const number = numberValue(value)
  if (number === undefined) return undefined
  return number.toLocaleString([], {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
}

function formatPercent(value: unknown) {
  const formatted = formatNumber(value)
  return formatted ? `${formatted}%` : undefined
}

function formatMeasure(value: unknown, unit: unknown, digits = 0) {
  const formatted = formatNumber(value, digits)
  if (!formatted) return undefined
  return `${formatted}${unit ? ` ${unit}` : ''}`
}

function formatWindMeasure(value: unknown, unit: unknown) {
  const numeric = numberValue(value)
  if (numeric === undefined || numeric < 0) return undefined
  const unitLabel = unitWithoutDegree(unit, DEFAULT_WIND_SPEED_UNIT)
  const amount = numeric > 0 && numeric < 1 ? '<1' : formatNumber(numeric, 0) ?? '--'
  return {
    amount,
    numeric,
    unit: unitLabel,
    value: `${amount} ${unitLabel}`,
  }
}

function formatWindRange(speed: unknown, gust: unknown, unit: unknown) {
  const wind = formatWindMeasure(speed, unit)
  const windGust = formatWindMeasure(gust, unit)
  if (!wind && !windGust) return '--'
  if (!windGust) return wind?.value ?? '--'
  if (!wind || windGust.amount === wind.amount) return wind?.value ?? windGust.value
  return `${wind.amount}-${windGust.amount} ${windGust.unit}`
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function forecastDayLabel(value: string | undefined, index: number) {
  if (!value) return index === 0 ? 'Today' : `Day ${index + 1}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return index === 0 ? 'Today' : `Day ${index + 1}`
  if (index === 0) return 'Today'
  return date.toLocaleDateString([], { weekday: 'short' })
}

function hourlyLabel(value: string | undefined, index: number) {
  if (index === 0) return 'Now'
  if (!value) return `${index}h`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return `${index}h`
  return date.toLocaleTimeString([], { hour: 'numeric', hour12: true }).replace(/\s+/g, ' ')
}

function extractForecasts(response: WeatherForecastResponse, limit = 7) {
  const responseMap = response.service_response ?? response
  const weatherResponse = responseMap[WEATHER_ENTITY]
  if (!weatherResponse || !('forecast' in weatherResponse) || !Array.isArray(weatherResponse.forecast)) return []
  return weatherResponse.forecast.slice(0, limit)
}

function compactHighLowLabel(forecast: WeatherForecast | undefined) {
  if (!forecast) return ''
  const high = formatDegreeValue(forecast.temperature)
  const low = formatDegreeValue(forecast.templow)
  if (high === '--' && low === '--') return ''
  if (high === '--') return `L:${low}`
  if (low === '--') return `H:${high}`
  return `H:${high}  L:${low}`
}

function modalHighLowLabel(copy: WeatherCopy, forecast: WeatherForecast | undefined) {
  if (!forecast) return ''
  const high = formatDegreeValue(forecast.temperature)
  const low = formatDegreeValue(forecast.templow)
  if (high === '--' && low === '--') return ''
  if (high === '--') return copy(WEATHER_COPY_KEYS.hero.low, { low })
  if (low === '--') return copy(WEATHER_COPY_KEYS.hero.high, { high })
  return copy(WEATHER_COPY_KEYS.hero.highLow, { high, low })
}

function forecastSummary(forecasts: WeatherForecast[], entity: HassEntity | null) {
  if (!forecasts.length) return 'Daily Pirate Weather forecast will appear when Home Assistant returns forecast data.'
  const highs = forecasts.map((forecast) => numberValue(forecast.temperature)).filter((value): value is number => value !== undefined)
  const rainChances = forecasts.map((forecast) => numberValue(forecast.precipitation_probability)).filter((value): value is number => value !== undefined)
  const warmest = highs.length ? Math.max(...highs) : undefined
  const wettest = rainChances.length ? Math.max(...rainChances) : undefined
  const first = conditionInfo(forecasts[0]?.condition).label.toLowerCase()
  const warmestLabel = warmest === undefined ? undefined : formatTemperatureValue(warmest, entity?.attributes.temperature_unit)
  const rainLabel = wettest === undefined ? undefined : formatPercent(wettest)
  return [`The week opens ${first}`, warmestLabel ? `peaks near ${warmestLabel}` : undefined, rainLabel ? `rain chance tops out at ${rainLabel}` : undefined].filter(Boolean).join(' · ')
}

function forecastRangeStyle(forecast: WeatherForecast, forecasts: WeatherForecast[], entity: HassEntity | null, index: number): WeatherRangeStyle | undefined {
  const lows = forecasts.map((item) => numberValue(item.templow)).filter((value): value is number => value !== undefined)
  const highs = forecasts.map((item) => numberValue(item.temperature)).filter((value): value is number => value !== undefined)
  const low = numberValue(forecast.templow)
  const high = numberValue(forecast.temperature)
  if (low === undefined || high === undefined || lows.length === 0 || highs.length === 0) return undefined
  const minLow = Math.min(...lows)
  const maxHigh = Math.max(...highs)
  const spread = Math.max(1, maxHigh - minLow)
  const current = index === 0 ? numberValue(entity?.attributes.temperature) : undefined
  return {
    '--range-marker': current === undefined ? undefined : `${clampPercent(((current - minLow) / spread) * 100)}%`,
    '--range-size': `${Math.max(6, clampPercent(((high - low) / spread) * 100))}%`,
    '--range-start': `${clampPercent(((low - minLow) / spread) * 100)}%`,
  }
}

function heroRangeStyle(forecast: WeatherForecast, entity: HassEntity | null): WeatherRangeStyle | undefined {
  const low = numberValue(forecast.templow)
  const high = numberValue(forecast.temperature)
  const current = numberValue(entity?.attributes.temperature)
  if (low === undefined || high === undefined) return undefined

  const spread = Math.max(1, high - low)
  return {
    '--range-marker': current === undefined ? undefined : `${clampPercent(((current - low) / spread) * 100)}%`,
    '--range-size': '100%',
    '--range-start': '0%',
  }
}

function percentStyle(value: unknown): WeatherPercentStyle | undefined {
  const percent = numberValue(value)
  if (percent === undefined) return undefined
  return { '--percent-fill': `${clampPercent(percent)}%` }
}

function highlightStyle(percent: number | undefined, rotation?: number): WeatherHighlightStyle | undefined {
  if (percent === undefined && rotation === undefined) return undefined
  return {
    '--highlight-percent': percent === undefined ? undefined : `${clampPercent(percent)}%`,
    '--highlight-rotation': rotation === undefined ? undefined : `${rotation}deg`,
  }
}

function aqiCategory(copy: WeatherCopy, level: AqiLevel) {
  return copy(AQI_CATEGORY_COPY_KEYS[level])
}

function aqiGuidance(copy: WeatherCopy, level: AqiLevel) {
  return copy(AQI_GUIDANCE_COPY_KEYS[level])
}

function uvCategoryLabel(copy: WeatherCopy, level: UvLevel) {
  return copy(UV_CATEGORY_COPY_KEYS[level])
}

function highlightTiles(entity: HassEntity | null, forecasts: WeatherForecast[], sunEntity: HassEntity | null, copy: WeatherCopy) {
  const today = forecasts[0]
  const attrs = entity?.attributes ?? {}
  const wind = formatWindMeasure(attrs.wind_speed, attrs.wind_speed_unit)
  const currentGust = numberValue(attrs.wind_gust_speed)
  const dailyGust = numberValue(today?.wind_gust_speed)
  const gustIsForecast = currentGust === undefined && dailyGust !== undefined
  const gust = formatWindMeasure(currentGust ?? dailyGust, attrs.wind_speed_unit)
  const bearing = windBearingPresentation(attrs.wind_bearing)
  const calm = wind?.numeric === 0
  const gustLabel = copy(gustIsForecast ? WEATHER_COPY_KEYS.details.wind.todaysGust : WEATHER_COPY_KEYS.details.wind.gusts)
  const directionLabel = copy(calm || !bearing ? WEATHER_COPY_KEYS.details.wind.direction : WEATHER_COPY_KEYS.details.wind.from)
  const directionAriaLabel = copy(calm || !bearing ? WEATHER_COPY_KEYS.details.wind.direction : WEATHER_COPY_KEYS.details.wind.from)
  const directionValue = calm
    ? copy(WEATHER_COPY_KEYS.details.wind.calm)
    : bearing
      ? `${bearing.cardinal}${bearing.displayDegrees === undefined ? '' : ` · ${bearing.displayDegrees}°`}`
      : copy(WEATHER_COPY_KEYS.unavailable)
  const directionAriaValue = calm
    ? copy(WEATHER_COPY_KEYS.details.wind.calm)
    : bearing
      ? bearing.displayDegrees === undefined
        ? bearing.spoken
        : copy(WEATHER_COPY_KEYS.details.wind.bearingDegrees, { degrees: bearing.displayDegrees, direction: bearing.spoken })
      : copy(WEATHER_COPY_KEYS.unavailable)
  const windAriaLabel = copy(WEATHER_COPY_KEYS.details.wind.ariaLabel, {
    direction: directionAriaValue,
    directionLabel: directionAriaLabel,
    gust: gust?.value ?? copy(WEATHER_COPY_KEYS.unavailable),
    gustLabel,
    speed: wind?.value ?? copy(WEATHER_COPY_KEYS.unavailable),
  })
  const pressure = numberValue(attrs.pressure)
  const pressureData = pressurePresentation(pressure, attrs.pressure_unit)
  const uv = uvPresentation(today?.uv_index)
  const feels = feelsLikePresentation(attrs.temperature, attrs.apparent_temperature, attrs.temperature_unit)
  const visibility = visibilityPresentation(attrs.visibility, attrs.visibility_unit)
  const sun = sunEntity ? sunPresentation(sunEntity.state, sunEntity.attributes) : null
  const sunValue = sun ? formatDate(sun.primaryTime, { hour: 'numeric', minute: '2-digit' }) : undefined
  const unavailable = copy(WEATHER_COPY_KEYS.unavailable)
  const tiles: WeatherHighlightData[] = [
    {
      available: Boolean(feels),
      icon: 'mdi:thermometer-lines',
      kind: 'feels',
      percent: feels?.markerPercent,
      title: 'Feels Like',
      value: feels ? formatTemperatureValue(attrs.apparent_temperature, attrs.temperature_unit) : '--',
    },
    {
      available: Boolean(uv),
      icon: 'mdi:weather-sunny-alert',
      kind: 'uv',
      percent: uv?.markerPercent,
      status: uv ? uvCategoryLabel(copy, uv.level) : undefined,
      title: 'UV Index',
      value: uv ? formatNumber(uv.value, 1) ?? unavailable : '--',
    },
    {
      ariaLabel: windAriaLabel,
      available: Boolean(wind || gust || bearing),
      icon: 'mdi:weather-windy',
      kind: 'wind',
      title: 'Wind',
      value: wind?.value ?? '--',
      wide: true,
      wind: {
        bearingDegrees: calm ? undefined : bearing?.sourceDegrees,
        destinationDegrees: calm ? undefined : bearing?.destinationDegrees,
        directionLabel,
        directionValue,
        gustIsForecast,
        gustLabel,
        gustValue: gust?.value ?? unavailable,
        showVector: Boolean(bearing && !calm),
        speedLabel: copy(WEATHER_COPY_KEYS.details.wind.speed),
        speedValue: wind?.value ?? unavailable,
      },
    },
    ...(sunEntity ? [{
      available: Boolean(sun && sunValue),
      icon: 'mdi:weather-sunny',
      kind: 'sun' as const,
      percent: sun?.markerPercent,
      title: sun ? copy(SUN_TITLE_COPY_KEYS[sun.primary]) : copy(WEATHER_COPY_KEYS.details.sun.sunset),
      value: sunValue ?? '--',
    }] : []),
    {
      available: Boolean(visibility),
      icon: 'mdi:eye',
      kind: 'visibility',
      percent: visibility?.markerPercent,
      title: 'Visibility',
      value: visibility ? formatMeasure(attrs.visibility, attrs.visibility_unit, 1) ?? '--' : '--',
    },
    {
      available: pressureData !== null,
      icon: 'mdi:gauge',
      kind: 'pressure',
      percent: pressureData?.markerPercent,
      rotation: pressureData === null ? undefined : (pressureData.markerPercent - 50) * 1.35,
      title: 'Pressure',
      value: pressureData === null ? '--' : formatMeasure(pressure, attrs.pressure_unit, 2) ?? '--',
    },
  ]

  return tiles
}

function ForecastRow({ entity, forecast, forecasts, index, mode }: { entity: HassEntity | null; forecast: WeatherForecast; forecasts: WeatherForecast[]; index: number; mode: HourlyMode }) {
  const condition = conditionInfo(forecast.condition)
  const highLow = compactHighLowLabel(forecast)
  const rangeStyle = forecastRangeStyle(forecast, forecasts, entity, index)

  if (mode === 'precipitation') {
    const amount = formatMeasure(forecast.precipitation, entity?.attributes.precipitation_unit, 2) ?? '0 in'
    const chance = formatPercent(forecast.precipitation_probability) ?? '0%'

    return (
      <article className={styles.forecastRow} data-mode="precipitation" aria-label={`${forecastDayLabel(forecast.datetime, index)} precipitation ${amount} ${chance}`}>
        <span className={styles.forecastDay}>{forecastDayLabel(forecast.datetime, index)}</span>
        <span className={styles.forecastIcon}>
          <MaterialIcon name="mdi:weather-rainy" size={25} />
        </span>
        <span className={styles.precipTrack} style={percentStyle(forecast.precipitation_probability)}>
          <span className={styles.precipFill} />
        </span>
        <span className={styles.forecastAmount}>{amount}</span>
        <span className={styles.forecastChance}>{chance}</span>
      </article>
    )
  }

  if (mode === 'wind') {
    const speedRange = formatWindRange(forecast.wind_speed, forecast.wind_gust_speed, entity?.attributes.wind_speed_unit)
    const bearing = windBearingPresentation(forecast.wind_bearing)

    return (
      <article className={styles.forecastRow} data-mode="wind" aria-label={`${forecastDayLabel(forecast.datetime, index)} wind ${speedRange}`}>
        <span className={styles.forecastDay}>{forecastDayLabel(forecast.datetime, index)}</span>
        <span
          className={styles.forecastIcon}
          data-wind-destination-bearing={bearing?.destinationDegrees}
          data-wind-source-bearing={bearing?.sourceDegrees}
          style={bearing ? { transform: `rotate(${bearing.destinationDegrees}deg)` } : undefined}
        >
          <MaterialIcon name={bearing ? 'mdi:navigation' : 'mdi:weather-windy'} size={24} />
        </span>
        <span className={styles.windSparkline}>
          <span className={styles.windLine} />
        </span>
        <span className={styles.forecastWindRange}>{speedRange}</span>
      </article>
    )
  }

  return (
    <article className={styles.forecastRow} aria-label={`${forecastDayLabel(forecast.datetime, index)} ${condition.label} ${highLow}`}>
      <span className={styles.forecastDay}>{forecastDayLabel(forecast.datetime, index)}</span>
      <span className={styles.forecastIcon}>
        <WeatherGlyph condition={forecast.condition} size={26} />
      </span>
      <span className={styles.forecastLow}>{formatDegreeValue(forecast.templow)}</span>
      <span className={styles.rangeTrack} style={rangeStyle}>
        <span className={styles.rangeFill} />
        {index === 0 ? <span className={styles.rangeMarker} /> : null}
      </span>
      <span className={styles.forecastHigh}>{formatDegreeValue(forecast.temperature)}</span>
    </article>
  )
}

function HighlightVisual({ tile }: { tile: WeatherHighlightData }) {
  if (!tile.available) {
    return (
      <span className={styles.highlightUnavailableVisual}>
        <MaterialIcon name={tile.icon} size={34} />
      </span>
    )
  }

  if (tile.kind === 'sun') {
    const progress = clampPercent(tile.percent ?? 0)
    const marker = sunArcMarker(progress)
    return (
      <span className={styles.sunArc}>
        <svg aria-hidden="true" viewBox="0 0 100 48">
          <path className={styles.sunArcPath} d="M8 40 Q50 4 92 40" />
          <line className={styles.sunHorizon} x1="4" x2="96" y1="40" y2="40" />
          <circle className={styles.sunMarker} cx={marker.x} cy={marker.y} r="3.5" />
        </svg>
      </span>
    )
  }

  if (tile.kind === 'pressure') {
    const [pressureValue, pressureUnit] = tile.value.split(' ')
    const indicatorLine = pressureGaugeLine(tile.percent ?? 50, 60, 74)
    return (
      <span className={styles.pressureGauge} style={pressureLabelStyle(tile.percent, tile.rotation)}>
        <svg aria-hidden="true" className={styles.pressureGaugeSvg} viewBox="0 0 200 164">
          {Array.from({ length: PRESSURE_TICK_COUNT }, (_, index) => {
            const line = pressureGaugeLine((index / (PRESSURE_TICK_COUNT - 1)) * 100, 60, 70)
            return <line className={styles.pressureGaugeTick} key={index} x1={line.x1} x2={line.x2} y1={line.y1} y2={line.y2} />
          })}
          <line className={styles.pressureGaugeIndicator} x1={indicatorLine.x1} x2={indicatorLine.x2} y1={indicatorLine.y1} y2={indicatorLine.y2} />
        </svg>
        <span className={styles.pressureGaugeReadout}>
          <span className={styles.pressureGaugeValue}>{pressureValue}</span>
          {pressureUnit ? <small>{pressureUnit}</small> : null}
        </span>
        <span className={styles.pressureGaugeLowLabel}>Low</span>
        <span className={styles.pressureGaugeHighLabel}>High</span>
      </span>
    )
  }

  if (tile.kind === 'cloud') {
    return (
      <span className={styles.cloudDial} data-cloud-cover-visual="dial" style={highlightStyle(tile.percent)}>
        <span className={styles.cloudDialCore}>
          <MaterialIcon name="mdi:cloud" size={28} />
        </span>
      </span>
    )
  }

  if (tile.kind === 'visibility') {
    return (
      <span className={styles.visibilityDistanceRail} data-visibility-visual="distance-rail" style={highlightStyle(tile.percent)}>
        <span className={styles.visibilityDistanceFill} />
        {tile.available && (tile.percent ?? 0) > 0 ? <span className={styles.visibilityDistanceMarker} /> : null}
      </span>
    )
  }

  if (tile.kind === 'feels' || tile.kind === 'uv') {
    return (
      <span
        className={`${styles.highlightRail} ${styles[`highlightRail_${tile.kind}`]}`}
        data-weather-highlight-rail={tile.kind}
        style={highlightStyle(tile.percent)}
      >
        <span className={styles.highlightRailMarker} />
      </span>
    )
  }

  return (
    <span className={`${styles.highlightMeter} ${styles[`highlightMeter_${tile.kind}`]}`} style={highlightStyle(tile.percent)}>
      <span className={styles.highlightMeterFill} />
      <span className={styles.highlightMeterMarker} />
    </span>
  )
}

function readPaintedWindRotation(element: SVGGElement) {
  if (typeof DOMMatrixReadOnly === 'undefined') return null
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none') return null

  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  } catch {
    return null
  }
}

function AnimatedWindVector({
  destinationDegrees,
  sourceDegrees,
}: {
  destinationDegrees?: number
  sourceDegrees: number
}) {
  const vectorRef = useRef<SVGGElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const previousBearingRef = useRef<number | undefined>(undefined)
  const underlyingRotationRef = useRef(sourceDegrees)
  const [initialRotation] = useState(sourceDegrees)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const vector = vectorRef.current
    if (!vector) return

    if (previousBearingRef.current === undefined) {
      previousBearingRef.current = sourceDegrees
      underlyingRotationRef.current = sourceDegrees
      vector.style.transform = `rotate(${sourceDegrees}deg)`
      return
    }

    if (reducedMotion) {
      animationRef.current?.cancel()
      animationRef.current = null
      previousBearingRef.current = sourceDegrees
      underlyingRotationRef.current = sourceDegrees
      vector.style.transform = `rotate(${sourceDegrees}deg)`
      return
    }

    if (previousBearingRef.current === sourceDegrees) return

    const currentRotation = readPaintedWindRotation(vector) ?? underlyingRotationRef.current
    const delta = shortestBearingDelta(currentRotation, sourceDegrees)
    const targetRotation = currentRotation + delta
    animationRef.current?.cancel()
    animationRef.current = null
    previousBearingRef.current = sourceDegrees
    underlyingRotationRef.current = targetRotation
    vector.style.transform = `rotate(${targetRotation}deg)`

    if (Math.abs(delta) < 0.01 || typeof vector.animate !== 'function') return

    const animation = vector.animate(
      [
        { transform: `rotate(${currentRotation}deg)` },
        { transform: `rotate(${targetRotation}deg)` },
      ],
      {
        duration: compassRotationDurationMs(currentRotation, targetRotation),
        easing: WIND_ROTATION_EASING,
      },
    )
    animationRef.current = animation
    animation.onfinish = () => {
      if (animationRef.current !== animation) return
      animationRef.current = null
      animation.cancel()
    }
    animation.oncancel = () => {
      if (animationRef.current === animation) animationRef.current = null
    }
  }, [reducedMotion, sourceDegrees])

  useEffect(() => () => animationRef.current?.cancel(), [])

  return (
    <g
      className={styles.windVector}
      data-destination-bearing={destinationDegrees}
      data-source-bearing={sourceDegrees}
      data-wind-motion="true"
      data-wind-vector="true"
      ref={vectorRef}
      style={{ transform: `rotate(${initialRotation}deg)` }}
    >
      <path className={styles.windVectorSourceBlade} d="M51.5 56 L60.5 56 L57.06 36.5 L54.94 36.5 Z" data-wind-source-blade="true" />
      <circle className={styles.windVectorSource} cx="56" cy="33.5" data-wind-source-marker="true" r="2.8" />
      <path className={styles.windVectorArrow} d="M51.5 56 L60.5 56 L56 82.5 Z" data-wind-destination-arrow="true" />
    </g>
  )
}

function WindCompass({ wind }: { wind: NonNullable<WeatherHighlightData['wind']> }) {
  return (
    <span aria-hidden="true" className={styles.windCompass} data-wind-compass="true" data-wind-directional={wind.showVector ? 'true' : undefined}>
      <svg className={styles.windCompassSvg} focusable="false" viewBox="0 0 112 112">
        <g>
          {Array.from({ length: WIND_COMPASS_TICK_COUNT }, (_, index) => index === 0 ? null : (
            <line className={styles.windCompassTick} key={index} shapeRendering="geometricPrecision" transform={`rotate(${index * (360 / WIND_COMPASS_TICK_COUNT)} 56 56)`} x1="56" x2="56" y1="5" y2={index % 2 === 0 ? 14 : 11.5} />
          ))}
        </g>
        <path className={styles.windCompassNorthMarker} d="M56 6.5 L57.8 9.5 H54.2 Z" />
        {wind.showVector && wind.bearingDegrees !== undefined ? (
          <AnimatedWindVector destinationDegrees={wind.destinationDegrees} sourceDegrees={wind.bearingDegrees} />
        ) : null}
        <text className={styles.windCompassCardinal} data-wind-cardinal="true" data-wind-text="true" dominantBaseline="middle" textAnchor="middle" x="56" y="22.1">N</text>
        {wind.showVector ? <text className={styles.windCompassCardinal} data-wind-cardinal="true" data-wind-text="true" dominantBaseline="middle" textAnchor="middle" x="90.5" y="56.6">E</text> : null}
        <text className={styles.windCompassCardinal} data-wind-cardinal="true" data-wind-text="true" dominantBaseline="middle" textAnchor="middle" x="56" y="91.1">S</text>
        {wind.showVector ? <text className={styles.windCompassCardinal} data-wind-cardinal="true" data-wind-text="true" dominantBaseline="middle" textAnchor="middle" x="21.5" y="56.6">W</text> : null}
      </svg>
    </span>
  )
}

function WindHighlightTile({ tile }: { tile: WeatherHighlightData }) {
  const wind = tile.wind
  if (!wind) return null

  return (
    <article
      aria-label={tile.ariaLabel}
      className={styles.highlightTile}
      data-kind="wind"
      data-unavailable={tile.available ? undefined : 'true'}
      data-wide="true"
      data-wind-gust-forecast={wind.gustIsForecast ? 'true' : undefined}
    >
      <span className={styles.highlightTitle} data-wind-text="true">
        <span className={styles.highlightIcon}>
          <MaterialIcon name={tile.icon} size={16} />
        </span>
        {tile.title}
      </span>
      <span className={styles.windReadout}>
        <span className={styles.windDetailRow}>
          <span data-wind-speed-label="true" data-wind-text="true">{wind.speedLabel}</span>
          <strong data-wind-speed-value="true" data-wind-text="true">{wind.speedValue}</strong>
        </span>
        <span className={styles.windDetailRow}>
          <span data-wind-gust-label="true" data-wind-text="true">{wind.gustLabel}</span>
          <strong data-wind-gust-value="true" data-wind-text="true">{wind.gustValue}</strong>
        </span>
        <span className={styles.windDetailRow}>
          <span data-wind-direction-label="true" data-wind-text="true">{wind.directionLabel}</span>
          <strong data-wind-direction-value="true" data-wind-text="true">{wind.directionValue}</strong>
        </span>
      </span>
      <WindCompass wind={wind} />
    </article>
  )
}

function HighlightTile({ tile }: { tile: WeatherHighlightData }) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  if (tile.kind === 'wind') return <WindHighlightTile tile={tile} />

  const accessibleValue = tile.available
    ? [tile.value, tile.status].filter(Boolean).join(' ')
    : copy(WEATHER_COPY_KEYS.unavailable)
  const alignedVisual = tile.kind === 'feels' || tile.kind === 'uv' || tile.kind === 'sun' || tile.kind === 'visibility'

  return (
    <article className={styles.highlightTile} data-kind={tile.kind} data-unavailable={tile.available ? undefined : 'true'} data-wide={tile.wide ? 'true' : undefined} aria-label={tile.ariaLabel ?? copy(WEATHER_COPY_KEYS.details.ariaLabel, { title: tile.title, value: accessibleValue })}>
      <span className={styles.highlightTitle}>
        <span className={styles.highlightIcon}>
          <MaterialIcon name={tile.icon} size={16} />
        </span>
        {tile.title}
      </span>
      {tile.kind !== 'pressure' ? (
        <span className={styles.highlightValueRow} data-highlight-value={tile.kind}>
          <strong className={styles.highlightValue}>{tile.value}</strong>
          {tile.status ? <span className={styles.highlightStatus}>{tile.status}</span> : null}
        </span>
      ) : null}
      {alignedVisual ? (
        <span className={styles.highlightVisualSlot} data-highlight-visual={tile.kind}>
          <HighlightVisual tile={tile} />
        </span>
      ) : <HighlightVisual tile={tile} />}
    </article>
  )
}

function WeatherAqiTile({ entity }: { entity: HassEntity }) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const status = classifyUsAqi(entity.state)
  const category = status ? aqiCategory(copy, status.level) : copy(WEATHER_COPY_KEYS.unavailable)
  const value = status ? String(status.value) : '--'
  const style: AqiStyle | undefined = status ? { '--aqi-marker': `${status.markerPercent}%` } : undefined
  const ariaLabel = status
    ? copy(WEATHER_COPY_KEYS.aqi.ariaLabel, { category, value })
    : copy(WEATHER_COPY_KEYS.aqi.unavailableAriaLabel)

  return (
    <article
      aria-label={ariaLabel}
      className={`${styles.highlightTile} ${styles.aqiTile}`}
      data-aqi-tone={status?.level ?? 'unavailable'}
      data-unavailable={status ? undefined : 'true'}
      data-wide="true"
    >
      <span className={styles.highlightTitle}>
        <span className={styles.highlightIcon}>
          <MaterialIcon name="mdi:air-filter" size={16} />
        </span>
        {copy(WEATHER_COPY_KEYS.aqi.title)}
      </span>
      <span className={styles.aqiReading}>
        <strong className={styles.aqiValue}>{value}</strong>
        <span className={styles.aqiCategory}>{category}</span>
      </span>
      <span className={styles.aqiScale} style={style}>
        <span className={styles.aqiMarker} />
      </span>
    </article>
  )
}

function hourlySubhead(mode: HourlyMode, entity: HassEntity | null) {
  if (mode === 'precipitation') return 'Precipitation chance (%)'
  if (mode === 'wind') return `Speed (${entity?.attributes.wind_speed_unit ?? DEFAULT_WIND_SPEED_UNIT}) · Gusts`
  return `Temperature (${unitWithoutDegree(entity?.attributes.temperature_unit, 'F')})`
}

function HourlyConditionItem({
  entity,
  forecast,
  index,
  mode,
  pageEnd,
  pageStart,
}: {
  entity: HassEntity | null
  forecast: WeatherForecast
  index: number
  mode: HourlyMode
  pageEnd: boolean
  pageStart: boolean
}) {
  const condition = conditionInfo(forecast.condition)
  const temperature = formatTemperatureValue(forecast.temperature, entity?.attributes.temperature_unit)
  const precipitationChance = formatPercent(forecast.precipitation_probability) ?? '0%'
  const precipitationAmount = formatMeasure(forecast.precipitation, entity?.attributes.precipitation_unit, 2)
  const windSpeed = formatWindMeasure(forecast.wind_speed, entity?.attributes.wind_speed_unit)?.value ?? '--'
  const gustSpeed = formatWindMeasure(forecast.wind_gust_speed, entity?.attributes.wind_speed_unit)?.value
  const time = hourlyLabel(forecast.datetime, index)

  if (mode === 'precipitation') {
    return (
      <article className={styles.hourlyItem} aria-label={`${time} precipitation ${precipitationChance}`} data-carousel-item="true" data-carousel-page-end={pageEnd ? 'true' : undefined} data-carousel-page-start={pageStart ? 'true' : undefined}>
        <span className={styles.hourlyTime}>{time}</span>
        <span className={styles.hourlyIcon}>
          <MaterialIcon name="mdi:water" size={28} />
        </span>
        <span className={styles.hourlyValueGroup}>
          <strong className={styles.hourlyTemperature}>{precipitationChance}</strong>
          {precipitationAmount && precipitationAmount !== '0 in' ? <span className={styles.hourlyDetail}>{precipitationAmount}</span> : null}
        </span>
      </article>
    )
  }

  if (mode === 'wind') {
    const bearing = windBearingPresentation(forecast.wind_bearing)
    return (
      <article className={styles.hourlyItem} aria-label={`${time} wind ${windSpeed}${gustSpeed ? ` gusts ${gustSpeed}` : ''}`} data-carousel-item="true" data-carousel-page-end={pageEnd ? 'true' : undefined} data-carousel-page-start={pageStart ? 'true' : undefined}>
        <span className={styles.hourlyTime}>{time}</span>
        <span
          className={styles.hourlyIcon}
          data-wind-destination-bearing={bearing?.destinationDegrees}
          data-wind-source-bearing={bearing?.sourceDegrees}
          style={bearing ? { transform: `rotate(${bearing.destinationDegrees}deg)` } : undefined}
        >
          <MaterialIcon name={bearing ? 'mdi:navigation' : 'mdi:weather-windy'} size={26} />
        </span>
        <span className={styles.hourlyValueGroup}>
          <strong className={styles.hourlyTemperature}>{windSpeed}</strong>
          {gustSpeed ? <span className={styles.hourlyDetail}>{gustSpeed}</span> : null}
        </span>
      </article>
    )
  }

  return (
    <article className={styles.hourlyItem} aria-label={`${time} ${condition.label} ${temperature}`} data-carousel-item="true" data-carousel-page-end={pageEnd ? 'true' : undefined} data-carousel-page-start={pageStart ? 'true' : undefined}>
      <span className={styles.hourlyTime}>{time}</span>
      <span className={styles.hourlyIcon}>
        <WeatherGlyph condition={forecast.condition} size={30} />
      </span>
      <strong className={styles.hourlyTemperature}>{temperature}</strong>
    </article>
  )
}

function WeatherScrollControls({
  ariaControlsId,
  canScrollNext,
  canScrollPrevious,
  fallbackRef,
  hidden,
  label,
  modal = false,
  onKeyDown,
  onNext,
  onPrevious,
}: {
  ariaControlsId?: string
  canScrollNext: boolean
  canScrollPrevious: boolean
  fallbackRef: RefObject<HTMLElement | null>
  hidden: boolean
  label: string
  modal?: boolean
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onNext: () => void
  onPrevious: () => void
}) {
  const copy = useCopy(CORE_COPY_NAMESPACE)
  const controlsRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!hidden || !controlsRef.current?.contains(document.activeElement)) return
    fallbackRef.current?.focus()
  }, [fallbackRef, hidden])

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
  }

  return (
    <span
      aria-label={copy(CORE_COPY_KEYS.carousel.controls, { label })}
      className={`${styles.weatherCarouselControls} ${modal ? styles.weatherCarouselControlsModal : styles.weatherCarouselControlsHero}`}
      data-weather-carousel-controls="true"
      hidden={hidden}
      onKeyDown={onKeyDown}
      ref={controlsRef}
      role="group"
    >
      <button
        aria-controls={ariaControlsId}
        aria-disabled={!canScrollPrevious}
        aria-label={copy(CORE_COPY_KEYS.carousel.previous, { label })}
        className={styles.weatherCarouselControl}
        data-weather-carousel-previous="true"
        onClick={() => canScrollPrevious && onPrevious()}
        onPointerUp={handlePointerUp}
        type="button"
      >
        <MaterialIcon name="mdi:chevron-left" size={20} />
      </button>
      <button
        aria-controls={ariaControlsId}
        aria-disabled={!canScrollNext}
        aria-label={copy(CORE_COPY_KEYS.carousel.next, { label })}
        className={styles.weatherCarouselControl}
        data-weather-carousel-next="true"
        onClick={() => canScrollNext && onNext()}
        onPointerUp={handlePointerUp}
        type="button"
      >
        <MaterialIcon name="mdi:chevron-right" size={20} />
      </button>
    </span>
  )
}

function WeatherCarouselPagination({
  currentPage,
  hero = false,
  hidden,
  label,
  onPageChange,
  pageCount,
}: {
  currentPage: number
  hero?: boolean
  hidden: boolean
  label: string
  onPageChange: (page: number) => void
  pageCount: number
}) {
  const copy = useCopy(CORE_COPY_NAMESPACE)

  return (
    <span
      aria-label={copy(CORE_COPY_KEYS.carousel.pages, { label })}
      className={`${styles.weatherCarouselPagination} ${hero ? styles.weatherCarouselPaginationHero : styles.weatherCarouselPaginationModal}`}
      data-weather-carousel-page-count={pageCount}
      data-weather-carousel-pagination="true"
      hidden={hidden}
      role="group"
    >
      {Array.from({ length: pageCount }, (_, page) => (
        <button
          aria-current={currentPage === page ? 'page' : undefined}
          aria-label={copy(CORE_COPY_KEYS.carousel.goToPage, { page: page + 1 })}
          data-weather-carousel-page={page + 1}
          key={page}
          onClick={() => onPageChange(page)}
          onPointerUp={(event) => {
            if (event.pointerType !== 'mouse') event.currentTarget.blur()
          }}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </span>
  )
}

function HeroDayForecast({ entity, forecast }: { entity: HassEntity | null; forecast: WeatherForecast | undefined }) {
  if (!forecast) {
    return (
      <span aria-hidden="true" className={`${styles.heroDayForecast} ${styles.heroDayForecastPlaceholder}`}>
        <span className={styles.heroDayIconPlaceholder} />
        <span className={styles.heroDayLow} />
        <span className={styles.heroDayRangeTrack} />
        <span className={styles.heroDayHigh} />
      </span>
    )
  }

  const condition = conditionInfo(forecast.condition)
  return (
    <span className={styles.heroDayForecast} aria-label={`Today ${condition.label} ${compactHighLowLabel(forecast)}`}>
      <span className={styles.heroDayIcon}>
        <WeatherGlyph condition={forecast.condition} size={24} />
      </span>
      <span className={styles.heroDayLow}>{formatDegreeValue(forecast.templow)}</span>
      <span className={styles.heroDayRangeTrack} style={heroRangeStyle(forecast, entity)}>
        <span className={styles.heroDayRangeFill} />
        <span className={styles.heroDayRangeMarker} />
      </span>
      <span className={styles.heroDayHigh}>{formatDegreeValue(forecast.temperature)}</span>
    </span>
  )
}

function HeroHourlyStrip({
  ariaLabel,
  entity,
  forecasts,
  onKeyDown,
  pageStartIndices,
  scrollerId,
  scrollerRef,
}: {
  ariaLabel: string
  entity: HassEntity | null
  forecasts: WeatherForecast[]
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  pageStartIndices: readonly number[]
  scrollerId: string
  scrollerRef: RefObject<HTMLSpanElement | null>
}) {
  if (forecasts.length === 0) {
    return (
      <span aria-hidden="true" className={`${styles.heroHourlyStrip} ${styles.heroHourlyStripPlaceholder}`}>
        {HERO_HOURLY_PLACEHOLDERS.map((item) => (
          <span className={styles.heroHourlyItem} key={item}>
            <span className={styles.heroHourlyPlaceholderLine} />
            <span className={styles.heroHourlyPlaceholderDot} />
            <span className={styles.heroHourlyPlaceholderLine} />
          </span>
        ))}
      </span>
    )
  }

  return (
    <span aria-label={ariaLabel} className={styles.heroHourlyStrip} data-carousel-snap-ready={pageStartIndices.length > 0 ? 'true' : undefined} data-weather-carousel="hero" id={scrollerId} onKeyDown={onKeyDown} ref={scrollerRef} tabIndex={0}>
      {forecasts.map((forecast, index) => {
        const condition = conditionInfo(forecast.condition)
        return (
          <span
            className={styles.heroHourlyItem}
            aria-label={`${hourlyLabel(forecast.datetime, index)} ${condition.label} ${formatTemperatureValue(forecast.temperature, entity?.attributes.temperature_unit)}`}
            data-carousel-page-end={index === forecasts.length - 1 ? 'true' : undefined}
            data-carousel-page-start={pageStartIndices.includes(index) ? 'true' : undefined}
            data-carousel-item="true"
            key={forecast.datetime ?? index}
          >
            <span className={styles.heroHourlyTime}>{hourlyLabel(forecast.datetime, index)}</span>
            <span className={styles.heroHourlyIcon}>
              <WeatherGlyph condition={forecast.condition} size={20} />
            </span>
            <span className={styles.heroHourlyTemperature}>{formatDegreeValue(forecast.temperature)}</span>
          </span>
        )
      })}
    </span>
  )
}

function HourlyConditionsPanel({
  activeMode,
  entity,
  error,
  forecasts,
  loading,
  mode,
  onModeChange,
  transitionPhase,
}: {
  activeMode: HourlyMode
  entity: HassEntity | null
  error: string | null
  forecasts: WeatherForecast[]
  loading: boolean
  mode: HourlyMode
  onModeChange: (mode: HourlyMode) => void
  transitionPhase: ModeTransitionPhase
}) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const carouselId = useId()
  const carouselLabel = copy(WEATHER_COPY_KEYS.carousel.conditions)
  const sectionLabel = copy(WEATHER_COPY_KEYS.carousel.section)
  const {
    canScrollNext,
    canScrollPrevious,
    currentPage,
    handleNavigationKeyDown,
    hasOverflow,
    pageCount,
    pageStartIndices,
    scrollNext,
    scrollToPage,
    scrollPrevious,
    scrollerRef,
  } = useHorizontalScrollControls<HTMLDivElement>({
    enabled: !loading && !error && forecasts.length > 0,
    itemCount: forecasts.length,
    revision: mode,
  })

  return (
    <section className={styles.hourlyPanel} aria-label={sectionLabel}>
      <div className={styles.hourlyHeader}>
        <span className={styles.sectionLabel}>Conditions</span>
        <span className={styles.hourlyModes}>
          {WEATHER_HOURLY_MODES.map((option) => (
            <button
              aria-label={`${option.label} conditions`}
              aria-pressed={activeMode === option.tab}
              className={activeMode === option.tab ? styles.hourlyModeActive : undefined}
              key={option.tab}
              onClick={() => onModeChange(option.tab)}
              type="button"
            >
              <MaterialIcon name={option.icon} size={18} />
            </button>
          ))}
        </span>
      </div>
      <div className={styles.modeContent} data-transition={transitionPhase}>
        <span className={styles.hourlySubhead}>{hourlySubhead(mode, entity)}</span>
        {loading ? (
          <div className={styles.hourlyScroller} aria-label="Loading 24-hour conditions">
            {FORECAST_PLACEHOLDERS.map((item) => (
              <div className={styles.hourlySkeleton} key={item} />
            ))}
          </div>
        ) : null}
        {!loading && error ? <div className={styles.errorState}>{error}</div> : null}
        {!loading && !error && forecasts.length === 0 ? <div className={styles.errorState}>No hourly forecast data returned by Pirate Weather.</div> : null}
        {!loading && !error && forecasts.length > 0 ? (
          <div className={styles.hourlyScrollerFrame} data-carousel-overflow={hasOverflow ? 'true' : undefined}>
            <div
              aria-label={carouselLabel}
              aria-roledescription="carousel"
              className={styles.hourlyScroller}
              data-base-ui-swipe-ignore="true"
              data-carousel-snap-ready={pageStartIndices.length > 0 ? 'true' : undefined}
              data-weather-carousel="hourly"
              id={carouselId}
              onKeyDown={handleNavigationKeyDown}
              ref={scrollerRef}
              role="group"
              tabIndex={0}
            >
              {forecasts.map((forecast, index) => (
                <HourlyConditionItem
                  entity={entity}
                  forecast={forecast}
                  index={index}
                  key={forecast.datetime ?? index}
                  mode={mode}
                  pageEnd={index === forecasts.length - 1}
                  pageStart={pageStartIndices.includes(index)}
                />
              ))}
            </div>
            <WeatherScrollControls
              ariaControlsId={carouselId}
              canScrollNext={canScrollNext}
              canScrollPrevious={canScrollPrevious}
              fallbackRef={scrollerRef}
              hidden={!hasOverflow}
              label={carouselLabel}
              modal
              onKeyDown={handleNavigationKeyDown}
              onNext={scrollNext}
              onPrevious={scrollPrevious}
            />
            <WeatherCarouselPagination currentPage={currentPage} hidden={!hasOverflow || pageCount <= 1} label={carouselLabel} onPageChange={scrollToPage} pageCount={pageCount} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ForecastSkeleton() {
  return (
    <div className={styles.forecastList} aria-label="Loading seven-day weather forecast">
      {FORECAST_PLACEHOLDERS.map((item) => (
        <div className={styles.skeletonRow} key={item} />
      ))}
    </div>
  )
}

function WeatherForecastSheet({
  aqiEntity,
  entity,
  error,
  forecasts,
  hourlyError,
  hourlyForecasts,
  hourlyLoading,
  loading,
  sunEntity,
}: {
  aqiEntity: HassEntity | null
  entity: HassEntity | null
  error: string | null
  forecasts: WeatherForecast[]
  hourlyError: string | null
  hourlyForecasts: WeatherForecast[]
  hourlyLoading: boolean
  loading: boolean
  sunEntity: HassEntity | null
}) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const condition = conditionInfo(entity?.state)
  const today = forecasts[0]
  const highlights = highlightTiles(entity, forecasts, sunEntity, copy)
  const aqiStatus = classifyUsAqi(aqiEntity?.state)
  const headlineCategory = aqiStatus ? aqiCategory(copy, aqiStatus.level) : null
  const headlineIsAqi = Boolean(aqiStatus?.elevated && headlineCategory)
  const headlineTitle = headlineIsAqi
    ? copy(WEATHER_COPY_KEYS.headline.aqi, { category: headlineCategory, value: aqiStatus?.value })
    : copy(WEATHER_COPY_KEYS.headline.weather, { condition: condition.label })
  const headlineDetail = headlineIsAqi && aqiStatus
    ? aqiGuidance(copy, aqiStatus.level)
    : forecastSummary(forecasts, entity)
  const [selectedMode, setSelectedMode] = useState<HourlyMode>('condition')
  const [displayMode, setDisplayMode] = useState<HourlyMode>('condition')
  const [transitionPhase, setTransitionPhase] = useState<ModeTransitionPhase>('idle')
  const previousSelectedModeRef = useRef(selectedMode)

  useEffect(() => {
    if (selectedMode === previousSelectedModeRef.current) return undefined
    previousSelectedModeRef.current = selectedMode

    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = window.requestAnimationFrame(() => {
        setDisplayMode(selectedMode)
        setTransitionPhase('idle')
      })
      return () => window.cancelAnimationFrame(reducedMotionFrame)
    }

    let animationFrame = 0
    const exitTimer = window.setTimeout(() => setTransitionPhase('out'), 0)

    const swapTimer = window.setTimeout(() => {
      setDisplayMode(selectedMode)
      animationFrame = window.requestAnimationFrame(() => setTransitionPhase('in'))
    }, 140)

    const settleTimer = window.setTimeout(() => setTransitionPhase('idle'), 320)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(swapTimer)
      window.clearTimeout(settleTimer)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
    }
  }, [selectedMode])

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetContent}>
        <section className={styles.modalHero} aria-label="Current weather conditions">
          <strong className={styles.modalTemperature}>{weatherDegree(entity)}</strong>
          <span className={styles.modalCondition}>{condition.label}</span>
          {today ? <span className={styles.modalHighLow}>{modalHighLowLabel(copy, today)}</span> : null}
        </section>

        <section className={styles.currentPanel} aria-label="Today weather summary">
          <div className={styles.currentHero}>
            <span className={styles.currentIcon}>
              {headlineIsAqi ? <MaterialIcon name="mdi:air-filter" size={30} /> : <WeatherGlyph condition={entity?.state} size={32} />}
            </span>
            <span className={styles.currentCopy}>
              <span className={styles.currentLabel}>{copy(WEATHER_COPY_KEYS.headline.label)}</span>
              <strong>{headlineTitle}</strong>
              <span>{headlineDetail}</span>
            </span>
          </div>
        </section>

        <HourlyConditionsPanel activeMode={selectedMode} entity={entity} error={hourlyError} forecasts={hourlyForecasts} loading={hourlyLoading} mode={displayMode} onModeChange={setSelectedMode} transitionPhase={transitionPhase} />

        <section className={styles.forecastPanel} aria-label="Seven-day weather forecast">
          <div className={styles.sectionLabel}>Next Seven Days</div>
          <div className={styles.modeContent} data-transition={transitionPhase}>
            {loading ? <ForecastSkeleton /> : null}
            {!loading && error ? <div className={styles.errorState}>{error}</div> : null}
            {!loading && !error && forecasts.length === 0 ? <div className={styles.errorState}>No forecast data returned by Pirate Weather.</div> : null}
            {!loading && !error && forecasts.length > 0 ? (
              <div className={styles.forecastList}>
                {forecasts.map((forecast, index) => (
                  <ForecastRow entity={entity} forecast={forecast} forecasts={forecasts} index={index} key={forecast.datetime ?? index} mode={displayMode} />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.highlightsPanel} aria-label="Weather highlights">
          <div className={styles.sectionLabel}>Highlights</div>
          <div className={styles.highlightGrid}>
            {aqiEntity ? <WeatherAqiTile entity={aqiEntity} /> : null}
            <WeatherPrecipitationTile
              forecasts={hourlyForecasts}
              precipitationUnit={stringValue(entity?.attributes.precipitation_unit, DEFAULT_PRECIPITATION_UNIT)}
            />
            <WeatherHourlyMetricTiles forecasts={hourlyForecasts} />
            {highlights.map((tile) => (
              <HighlightTile key={tile.kind} tile={tile} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

interface WeatherSummaryProps {
  deferRefresh?: boolean
}

export function WeatherSummary({ deferRefresh = false }: WeatherSummaryProps) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const heroCarouselLabel = copy(WEATHER_COPY_KEYS.carousel.forecast)
  const weather = useEntity(asEntityName(WEATHER_ENTITY), {
    returnNullIfNotFound: true,
  })
  const aqi = useEntity(asEntityName(WEATHER_AQI_ENTITY), {
    returnNullIfNotFound: true,
  })
  const sun = useEntity(asEntityName(SUN_ENTITY), {
    returnNullIfNotFound: true,
  })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [open, setOpen] = useState(false)
  const [forecasts, setForecasts] = useState<WeatherForecast[]>(() => dailyForecastCache?.forecasts ?? [])
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [hourlyForecasts, setHourlyForecasts] = useState<WeatherForecast[]>(() => hourlyForecastCache?.forecasts ?? [])
  const [hourlyForecastError, setHourlyForecastError] = useState<string | null>(null)
  const [hourlyForecastLoading, setHourlyForecastLoading] = useState(false)
  const heroCarouselId = useId()
  const weatherCardButtonRef = useRef<HTMLButtonElement>(null)
  const {
    canScrollNext: canScrollHeroNext,
    canScrollPrevious: canScrollHeroPrevious,
    currentPage: currentHeroPage,
    handleNavigationKeyDown: handleHeroNavigationKeyDown,
    hasOverflow: heroHasOverflow,
    pageCount: heroPageCount,
    pageStartIndices: heroPageStartIndices,
    scrollNext: scrollHeroNext,
    scrollToPage: scrollHeroToPage,
    scrollPrevious: scrollHeroPrevious,
    scrollerRef: heroScrollerRef,
  } = useHorizontalScrollControls<HTMLSpanElement>({
    enabled: !deferRefresh && hourlyForecasts.length > 0,
    itemCount: hourlyForecasts.length,
  })

  useEffect(() => {
    let cancelled = false
    const cached = dailyForecastCache
    if (deferRefresh || cacheFresh(cached)) {
      const settleTimer = window.setTimeout(() => setForecastLoading(false), 0)
      return () => {
        cancelled = true
        window.clearTimeout(settleTimer)
      }
    }

    const loadingTimer = window.setTimeout(() => {
      setForecastLoading(open && !cached)
      setForecastError(null)
    }, 0)

    Promise.resolve(
      callService<WeatherForecastResponse>({
        domain: 'weather',
        service: 'get_forecasts',
        target: WEATHER_ENTITY,
        serviceData: { type: 'daily' },
        returnResponse: true,
      }),
    )
      .then((serviceResponse) => {
        if (cancelled) return
        const nextForecasts = serviceResponse ? extractForecasts(serviceResponse.response) : []
        dailyForecastCache = { forecasts: nextForecasts, updatedAt: Date.now() }
        setForecasts(nextForecasts)
        setForecastError(null)
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return
        if (!cached) setForecastError(caughtError instanceof Error ? caughtError.message : 'Unable to load Pirate Weather forecast.')
      })
      .finally(() => {
        if (!cancelled) setForecastLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(loadingTimer)
    }
  }, [callService, deferRefresh, open])

  useEffect(() => {
    let cancelled = false
    const cached = hourlyForecastCache
    if (deferRefresh || cacheFresh(cached)) {
      const settleTimer = window.setTimeout(() => setHourlyForecastLoading(false), 0)
      return () => {
        cancelled = true
        window.clearTimeout(settleTimer)
      }
    }

    const loadingTimer = window.setTimeout(() => {
      setHourlyForecastLoading(!cached)
      setHourlyForecastError(null)
    }, 0)

    Promise.resolve(
      callService<WeatherForecastResponse>({
        domain: 'weather',
        service: 'get_forecasts',
        target: WEATHER_ENTITY,
        serviceData: { type: 'hourly' },
        returnResponse: true,
      }),
    )
      .then((serviceResponse) => {
        if (cancelled) return
        const nextForecasts = serviceResponse ? extractForecasts(serviceResponse.response, 24) : []
        hourlyForecastCache = { forecasts: nextForecasts, updatedAt: Date.now() }
        setHourlyForecasts(nextForecasts)
        setHourlyForecastError(null)
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return
        if (!cached) setHourlyForecastError(caughtError instanceof Error ? caughtError.message : 'Unable to load Pirate Weather hourly forecast.')
      })
      .finally(() => {
        if (!cancelled) setHourlyForecastLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(loadingTimer)
    }
  }, [callService, deferRefresh, open])

  const condition = conditionInfo(weather?.state)
  const today = forecasts[0]

  const handleOpen = () => {
    setOpen(true)
  }

  return (
    <>
      <div className={styles.weatherCardFrame} data-carousel-overflow={heroHasOverflow ? 'true' : undefined}>
        <button
          aria-label={`Open seven-day weather forecast. ${condition.label}, ${weatherTemperature(weather)}`}
          className={`${effects.frosted} ${styles.card}`}
          onClick={handleOpen}
          ref={weatherCardButtonRef}
          type="button"
        >
          <span className={styles.copy}>
            <span className={styles.heroMain}>
              <span className={styles.conditionRow}>
                <span className={styles.summaryIcon}>
                  <WeatherGlyph condition={weather?.state} size={40} />
                </span>
                <span className={styles.condition}>{condition.label}</span>
              </span>
              <span className={styles.temperatureBlock}>
                <span className={styles.temperature}>{weatherDegree(weather)}</span>
              </span>
            </span>
            <HeroDayForecast entity={weather} forecast={today} />
            <HeroHourlyStrip
              ariaLabel={heroCarouselLabel}
              entity={weather}
              forecasts={hourlyForecasts}
              onKeyDown={handleHeroNavigationKeyDown}
              pageStartIndices={heroPageStartIndices}
              scrollerId={heroCarouselId}
              scrollerRef={heroScrollerRef}
            />
          </span>
          <SurfaceAccessory className={styles.disclosure} semantics={{ kind: 'modal' }} />
        </button>
        <WeatherScrollControls
          ariaControlsId={heroCarouselId}
          canScrollNext={canScrollHeroNext}
          canScrollPrevious={canScrollHeroPrevious}
          fallbackRef={weatherCardButtonRef}
          hidden={open || !heroHasOverflow}
          label={heroCarouselLabel}
          onKeyDown={handleHeroNavigationKeyDown}
          onNext={scrollHeroNext}
          onPrevious={scrollHeroPrevious}
        />
        <WeatherCarouselPagination currentPage={currentHeroPage} hero hidden={!heroHasOverflow || heroPageCount <= 1} label={heroCarouselLabel} onPageChange={scrollHeroToPage} pageCount={heroPageCount} />
      </div>

      <ModalSheet
        contentStyle={WEATHER_MODAL_STYLE}
        onClose={() => setOpen(false)}
        open={open}
        size="media"
        surfaceDecoration={<WeatherAtmosphere condition={weather?.state} isNight={sun?.state === 'below_horizon'} />}
        title="Weather"
        subtitle={copy(WEATHER_COPY_KEYS.subtitle, { condition: condition.label, temperature: weatherDegree(weather) })}
      >
        <WeatherForecastSheet aqiEntity={aqi} entity={weather} error={forecastError} forecasts={forecasts} hourlyError={hourlyForecastError} hourlyForecasts={hourlyForecasts} hourlyLoading={hourlyForecastLoading} loading={forecastLoading} sunEntity={sun} />
      </ModalSheet>
    </>
  )
}
