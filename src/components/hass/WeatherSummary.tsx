import { useEffect, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import effects from '../../styles/effects.module.css'
import { WEATHER_ENTITY } from '../../constants/atAGlance'
import { MaterialIcon } from '../core/Icon'
import { materialIconPath } from '../core/iconPaths'
import { ModalSheet } from '../core/ModalSheet'
import { ModalDisclosureIcon } from '../core/ModalDisclosureIcon'
import { asEntityName } from './entityState'
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

type HighlightKind = 'feels' | 'humidity' | 'wind' | 'visibility' | 'pressure' | 'precipitation' | 'uv' | 'cloud'

type WeatherHighlightStyle = CSSProperties & {
  '--pressure-high-label-x'?: string
  '--pressure-low-label-x'?: string
  '--highlight-percent'?: string
  '--highlight-rotation'?: string
}

interface WeatherHighlightData {
  icon: string
  kind: HighlightKind
  note: string
  percent?: number
  rotation?: number
  title: string
  value: string
}

type HourlyMode = 'condition' | 'precipitation' | 'wind'
type ModeTransitionPhase = 'idle' | 'out' | 'in'

const HOURLY_MODES: { icon: string; label: string; mode: HourlyMode }[] = [
  { icon: 'mdi:cloud', label: 'Conditions', mode: 'condition' },
  { icon: 'mdi:water', label: 'Precipitation', mode: 'precipitation' },
  { icon: 'mdi:weather-windy', label: 'Wind', mode: 'wind' },
]

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

function formatWindRange(speed: unknown, gust: unknown, unit: unknown) {
  const wind = formatNumber(speed, 0)
  const windGust = formatNumber(gust, 0)
  const unitLabel = typeof unit === 'string' && unit.trim() ? unit : 'mph'
  if (!wind && !windGust) return '--'
  if (!windGust || windGust === wind) return `${wind ?? windGust} ${unitLabel}`
  return `${wind ?? windGust}-${windGust} ${unitLabel}`
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

function windBearingLabel(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.toUpperCase()
  const degrees = numberValue(value)
  if (degrees === undefined) return undefined
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round(degrees / 45) % directions.length]
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

function uvCategory(value: unknown) {
  const uv = numberValue(value)
  if (uv === undefined) return undefined
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  if (uv < 11) return 'Very High'
  return 'Extreme'
}

function pressureTendency(value: unknown) {
  const pressure = numberValue(value)
  if (pressure === undefined) return 'Current pressure'
  if (pressure < 29.8) return 'Lower pressure'
  if (pressure > 30.2) return 'Higher pressure'
  return 'Steady pressure'
}

function pressurePercent(value: unknown) {
  const pressure = numberValue(value)
  if (pressure === undefined) return undefined
  return clampPercent(((pressure - 28.8) / 2.4) * 100)
}

function visibilityPercent(value: unknown, unit: unknown) {
  const visibility = numberValue(value)
  if (visibility === undefined) return undefined
  const maxVisibility = typeof unit === 'string' && unit.toLowerCase().includes('km') ? 16 : 10
  return clampPercent((visibility / maxVisibility) * 100)
}

function highlightStyle(percent: number | undefined, rotation?: number): WeatherHighlightStyle | undefined {
  if (percent === undefined && rotation === undefined) return undefined
  return {
    '--highlight-percent': percent === undefined ? undefined : `${clampPercent(percent)}%`,
    '--highlight-rotation': rotation === undefined ? undefined : `${rotation}deg`,
  }
}

function highlightTiles(entity: HassEntity | null, today: WeatherForecast | undefined) {
  const attrs = entity?.attributes ?? {}
  const wind = formatMeasure(attrs.wind_speed, attrs.wind_speed_unit, 0)
  const gust = formatMeasure(attrs.wind_gust_speed ?? today?.wind_gust_speed, attrs.wind_speed_unit, 0)
  const humidity = numberValue(attrs.humidity)
  const cloudCover = numberValue(attrs.cloud_coverage ?? today?.cloud_coverage)
  const pressure = numberValue(attrs.pressure)
  const precipProbability = numberValue(today?.precipitation_probability)
  const precipChance = formatPercent(today?.precipitation_probability)
  const precipAmount = formatMeasure(today?.precipitation, attrs.precipitation_unit, 2)
  const uvNumber = numberValue(today?.uv_index)
  const uv = formatNumber(uvNumber, 1)
  const uvText = uvCategory(today?.uv_index)
  return [
    {
      icon: 'mdi:thermometer-lines',
      kind: 'feels',
      note: `Actual ${formatTemperatureValue(attrs.temperature, attrs.temperature_unit)}.`,
      percent: numberValue(attrs.apparent_temperature) === undefined ? undefined : clampPercent(((numberValue(attrs.apparent_temperature) ?? 0) + 20) / 1.2),
      title: 'Feels Like',
      value: formatTemperatureValue(attrs.apparent_temperature, attrs.temperature_unit),
    },
    {
      icon: 'mdi:water-percent',
      kind: 'humidity',
      note: `The dew point is ${formatTemperatureValue(attrs.dew_point, attrs.temperature_unit)} right now.`,
      percent: humidity,
      title: 'Humidity',
      value: formatPercent(humidity),
    },
    {
      icon: 'mdi:navigation',
      kind: 'wind',
      note: [windBearingLabel(attrs.wind_bearing), gust ? `gusts ${gust}` : undefined].filter(Boolean).join(' · '),
      rotation: numberValue(attrs.wind_bearing),
      title: 'Wind',
      value: wind,
    },
    {
      icon: 'mdi:eye',
      kind: 'visibility',
      note: 'Current view distance.',
      percent: visibilityPercent(attrs.visibility, attrs.visibility_unit),
      title: 'Visibility',
      value: formatMeasure(attrs.visibility, attrs.visibility_unit, 1),
    },
    {
      icon: 'mdi:gauge',
      kind: 'pressure',
      note: pressureTendency(pressure),
      percent: pressurePercent(pressure),
      rotation: pressurePercent(pressure) === undefined ? undefined : (pressurePercent(pressure)! - 50) * 1.35,
      title: 'Pressure',
      value: formatMeasure(pressure, attrs.pressure_unit, 2),
    },
    {
      icon: 'mdi:weather-rainy',
      kind: 'precipitation',
      note: precipAmount ? `${precipAmount} expected today.` : 'Daily chance from forecast.',
      percent: precipProbability,
      title: 'Precipitation',
      value: precipChance ?? precipAmount,
    },
    {
      icon: 'mdi:weather-sunny-alert',
      kind: 'uv',
      note: uvText ? `${uvText} exposure.` : 'Daily forecast unavailable.',
      percent: uvNumber === undefined ? undefined : clampPercent((uvNumber / 11) * 100),
      title: 'UV Index',
      value: uv,
    },
    {
      icon: 'mdi:cloud',
      kind: 'cloud',
      note: 'Current sky coverage.',
      percent: cloudCover,
      title: 'Cloud Cover',
      value: formatPercent(cloudCover),
    },
  ].filter((tile): tile is WeatherHighlightData => Boolean(tile.value && tile.value !== '--'))
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

    return (
      <article className={styles.forecastRow} data-mode="wind" aria-label={`${forecastDayLabel(forecast.datetime, index)} wind ${speedRange}`}>
        <span className={styles.forecastDay}>{forecastDayLabel(forecast.datetime, index)}</span>
        <span
          className={styles.forecastIcon}
          style={
            forecast.wind_bearing === undefined
              ? undefined
              : {
                  transform: `rotate(${numberValue(forecast.wind_bearing) ?? 0}deg)`,
                }
          }
        >
          <MaterialIcon name="mdi:navigation" size={24} />
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
  if (tile.kind === 'wind') {
    return (
      <span className={styles.highlightCompass} style={highlightStyle(undefined, tile.rotation)}>
        <span className={styles.compassNorth}>N</span>
        <span className={styles.compassEast}>E</span>
        <span className={styles.compassSouth}>S</span>
        <span className={styles.compassWest}>W</span>
        <span className={styles.compassNeedle}>
          <MaterialIcon name="mdi:navigation" size={22} />
        </span>
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
      <span className={styles.cloudMeter} style={highlightStyle(tile.percent)}>
        <span className={styles.cloudMeterFill} />
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

function HighlightTile({ tile }: { tile: WeatherHighlightData }) {
  return (
    <article className={styles.highlightTile} data-kind={tile.kind} aria-label={`${tile.title} ${tile.value}`}>
      <span className={styles.highlightTitle}>
        <span className={styles.highlightIcon} style={tile.rotation === undefined || tile.kind === 'wind' ? undefined : { transform: `rotate(${tile.rotation}deg)` }}>
          <MaterialIcon name={tile.icon} size={16} />
        </span>
        {tile.title}
      </span>
      {tile.kind !== 'pressure' ? <strong className={styles.highlightValue}>{tile.value}</strong> : null}
      <HighlightVisual tile={tile} />
      {tile.kind !== 'pressure' ? <span className={styles.highlightNote}>{tile.note}</span> : null}
    </article>
  )
}

function hourlySubhead(mode: HourlyMode, entity: HassEntity | null) {
  if (mode === 'precipitation') return 'Precipitation chance (%)'
  if (mode === 'wind') return `Speed (${entity?.attributes.wind_speed_unit ?? 'mph'}) · Gusts`
  return `Temperature (${unitWithoutDegree(entity?.attributes.temperature_unit, 'F')})`
}

function HourlyConditionItem({ entity, forecast, index, mode }: { entity: HassEntity | null; forecast: WeatherForecast; index: number; mode: HourlyMode }) {
  const condition = conditionInfo(forecast.condition)
  const temperature = formatTemperatureValue(forecast.temperature, entity?.attributes.temperature_unit)
  const precipitationChance = formatPercent(forecast.precipitation_probability) ?? '0%'
  const precipitationAmount = formatMeasure(forecast.precipitation, entity?.attributes.precipitation_unit, 2)
  const windSpeed = formatMeasure(forecast.wind_speed, entity?.attributes.wind_speed_unit, 0) ?? '--'
  const gustSpeed = formatMeasure(forecast.wind_gust_speed, entity?.attributes.wind_speed_unit, 0)
  const time = hourlyLabel(forecast.datetime, index)

  if (mode === 'precipitation') {
    return (
      <article className={styles.hourlyItem} aria-label={`${time} precipitation ${precipitationChance}`}>
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
    return (
      <article className={styles.hourlyItem} aria-label={`${time} wind ${windSpeed}${gustSpeed ? ` gusts ${gustSpeed}` : ''}`}>
        <span className={styles.hourlyTime}>{time}</span>
        <span
          className={styles.hourlyIcon}
          style={
            forecast.wind_bearing === undefined
              ? undefined
              : {
                  transform: `rotate(${numberValue(forecast.wind_bearing) ?? 0}deg)`,
                }
          }
        >
          <MaterialIcon name="mdi:navigation" size={26} />
        </span>
        <span className={styles.hourlyValueGroup}>
          <strong className={styles.hourlyTemperature}>{windSpeed}</strong>
          {gustSpeed ? <span className={styles.hourlyDetail}>{gustSpeed}</span> : null}
        </span>
      </article>
    )
  }

  return (
    <article className={styles.hourlyItem} aria-label={`${time} ${condition.label} ${temperature}`}>
      <span className={styles.hourlyTime}>{time}</span>
      <span className={styles.hourlyIcon}>
        <WeatherGlyph condition={forecast.condition} size={30} />
      </span>
      <strong className={styles.hourlyTemperature}>{temperature}</strong>
    </article>
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

function HeroHourlyStrip({ entity, forecasts }: { entity: HassEntity | null; forecasts: WeatherForecast[] }) {
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
    <span className={styles.heroHourlyStrip} aria-label="24-hour weather forecast">
      {forecasts.map((forecast, index) => {
        const condition = conditionInfo(forecast.condition)
        return (
          <span
            className={styles.heroHourlyItem}
            aria-label={`${hourlyLabel(forecast.datetime, index)} ${condition.label} ${formatTemperatureValue(forecast.temperature, entity?.attributes.temperature_unit)}`}
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
  return (
    <section className={styles.hourlyPanel} aria-label="24-hour weather conditions">
      <div className={styles.hourlyHeader}>
        <span className={styles.sectionLabel}>Conditions</span>
        <span className={styles.hourlyModes}>
          {HOURLY_MODES.map((option) => (
            <button
              aria-label={`${option.label} conditions`}
              aria-pressed={activeMode === option.mode}
              className={activeMode === option.mode ? styles.hourlyModeActive : undefined}
              key={option.mode}
              onClick={() => onModeChange(option.mode)}
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
          <div className={styles.hourlyScroller}>
            {forecasts.map((forecast, index) => (
              <HourlyConditionItem entity={entity} forecast={forecast} index={index} key={forecast.datetime ?? index} mode={mode} />
            ))}
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
  entity,
  error,
  forecasts,
  hourlyError,
  hourlyForecasts,
  hourlyLoading,
  loading,
}: {
  entity: HassEntity | null
  error: string | null
  forecasts: WeatherForecast[]
  hourlyError: string | null
  hourlyForecasts: WeatherForecast[]
  hourlyLoading: boolean
  loading: boolean
}) {
  const condition = conditionInfo(entity?.state)
  const today = forecasts[0]
  const highlights = highlightTiles(entity, today)
  const [selectedMode, setSelectedMode] = useState<HourlyMode>('condition')
  const [displayMode, setDisplayMode] = useState<HourlyMode>('condition')
  const [transitionPhase, setTransitionPhase] = useState<ModeTransitionPhase>('idle')

  useEffect(() => {
    if (selectedMode === displayMode) return undefined

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
  }, [displayMode, selectedMode])

  return (
    <div className={styles.sheet}>
      <section className={styles.modalHero} aria-label="Current weather conditions">
        <span className={styles.modalPlace}>Home</span>
        <strong className={styles.modalTemperature}>{weatherDegree(entity)}</strong>
        <span className={styles.modalCondition}>{condition.label}</span>
        {today ? <span className={styles.modalHighLow}>{compactHighLowLabel(today)}</span> : null}
      </section>

      <section className={styles.currentPanel} aria-label="Today weather summary">
        <div className={styles.currentHero}>
          <span className={styles.currentIcon}>
            <WeatherGlyph condition={entity?.state} size={32} />
          </span>
          <span className={styles.currentCopy}>
            <span className={styles.currentLabel}>Today</span>
            <strong>{condition.label}</strong>
            <span>{forecastSummary(forecasts, entity)}</span>
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

      {highlights.length > 0 ? (
        <section className={styles.highlightsPanel} aria-label="Weather highlights">
          <div className={styles.sectionLabel}>Highlights</div>
          <div className={styles.highlightGrid}>
            {highlights.map((tile) => (
              <HighlightTile key={tile.title} tile={tile} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

interface WeatherSummaryProps {
  deferRefresh?: boolean
}

export function WeatherSummary({ deferRefresh = false }: WeatherSummaryProps) {
  const weather = useEntity(asEntityName(WEATHER_ENTITY), {
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

  return (
    <>
      <button aria-label={`Open seven-day weather forecast. ${condition.label}, ${weatherTemperature(weather)}`} className={`${effects.frosted} ${styles.card}`} onClick={() => setOpen(true)} type="button">
        <span className={styles.copy}>
          <span className={styles.heroMain}>
            <span className={styles.conditionRow}>
              <span className={styles.summaryIcon}>
                <WeatherGlyph condition={weather?.state} size={40} />
              </span>
              <span className={styles.condition}>{condition.label}</span>
              <ModalDisclosureIcon size="compact" />
            </span>
            <span className={styles.temperatureBlock}>
              <span className={styles.temperature}>{weatherDegree(weather)}</span>
            </span>
          </span>
          <HeroDayForecast entity={weather} forecast={today} />
          <HeroHourlyStrip entity={weather} forecasts={hourlyForecasts} />
        </span>
      </button>

      <ModalSheet open={open} title="Weather" subtitle="Pirate Weather · 7-day forecast" onClose={() => setOpen(false)}>
        <WeatherForecastSheet entity={weather} error={forecastError} forecasts={forecasts} hourlyError={hourlyForecastError} hourlyForecasts={hourlyForecasts} hourlyLoading={hourlyForecastLoading} loading={forecastLoading} />
      </ModalSheet>
    </>
  )
}
