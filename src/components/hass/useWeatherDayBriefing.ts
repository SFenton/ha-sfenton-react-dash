import { useEffect, useState, useSyncExternalStore } from 'react'
import { zonedDateParts } from '../../i18n'
import type { WeatherForecast } from './useWeatherForecasts'
import {
  generateWeatherDayBriefing,
  localDateKey,
  WEATHER_BRIEFING_VERSION,
  type WeatherDayBriefing,
} from './weatherDayBriefing'

export const WEATHER_BRIEFING_STORAGE_KEY = 'sfenton.weather.dayBriefing'
export const WEATHER_BRIEFING_GENERATION_MINUTE = 1
const TICK_MS = 30_000

export interface WeatherDayBriefingParams {
  aqi?: unknown
  daily: WeatherForecast[]
  enabled?: boolean
  hourly: WeatherForecast[]
  now?: number
  precipitationUnit?: unknown
  sunrise?: unknown
  sunset?: unknown
  temperatureUnit?: unknown
  timeZone?: string
  windSpeedUnit?: unknown
}

function readStored(): WeatherDayBriefing | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(WEATHER_BRIEFING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherDayBriefing
    if (!parsed || parsed.version !== WEATHER_BRIEFING_VERSION || typeof parsed.dateKey !== 'string') return null
    if (!Array.isArray(parsed.sentences)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * The briefing lives in a module store rather than component state: it is written from
 * an effect, shared by every mount, and must survive remounts of the weather modal.
 */
const briefingStore = (() => {
  let snapshot: WeatherDayBriefing | null | undefined
  const listeners = new Set<() => void>()
  return {
    clear() {
      snapshot = undefined
      for (const listener of listeners) listener()
    },
    getSnapshot() {
      if (snapshot === undefined) snapshot = readStored()
      return snapshot
    },
    set(next: WeatherDayBriefing) {
      snapshot = next
      persist(next)
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
})()

/** Clears the in-memory cache so a test can start from a known storage state. */
export function resetWeatherDayBriefingCache() {
  briefingStore.clear()
}

function persist(briefing: WeatherDayBriefing) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WEATHER_BRIEFING_STORAGE_KEY, JSON.stringify(briefing))
  } catch {
    // A full or blocked store only costs the cached copy; the briefing still renders this session.
  }
}

function minutesIntoLocalDay(timestamp: number, timeZone: string | undefined) {
  const parts = zonedDateParts(timestamp, timeZone)
  return parts.hour * 60 + parts.minute
}

function coversToday(forecasts: WeatherForecast[], dateKey: string, timeZone: string | undefined) {
  return forecasts.some((forecast) => {
    if (typeof forecast.datetime !== 'string') return false
    const parsed = Date.parse(forecast.datetime)
    return Number.isFinite(parsed) && localDateKey(parsed, timeZone) === dateKey
  })
}

/**
 * Home Assistant remains the weather source; this hook only decides when the day's
 * narrative is frozen. A briefing is written once per local calendar day at or after
 * 00:01 and never rewritten during that day. If the dashboard is asleep, offline, or
 * still waiting on Pirate Weather ingestion, generation simply happens at the first
 * tick where same-day forecast data exists.
 */
export function useWeatherDayBriefing(params: WeatherDayBriefingParams) {
  const {
    aqi,
    daily,
    enabled = true,
    hourly,
    precipitationUnit,
    sunrise,
    sunset,
    temperatureUnit,
    timeZone,
    windSpeedUnit,
  } = params
  const briefing = useSyncExternalStore(briefingStore.subscribe, briefingStore.getSnapshot, briefingStore.getSnapshot)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const bump = () => setTick((value) => value + 1)
    const interval = window.setInterval(bump, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', bump)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', bump)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const now = params.now ?? Date.now()
    const dateKey = localDateKey(now, timeZone)
    const current = briefingStore.getSnapshot()
    if (current && current.dateKey === dateKey) return
    const firstEver = !current
    if (!firstEver && minutesIntoLocalDay(now, timeZone) < WEATHER_BRIEFING_GENERATION_MINUTE) return
    if (!coversToday(hourly, dateKey, timeZone) && !coversToday(daily, dateKey, timeZone)) return

    const next = generateWeatherDayBriefing({
      aqi,
      daily,
      generatedAt: now,
      hourly,
      precipitationUnit,
      sunrise,
      sunset,
      temperatureUnit,
      timeZone,
      windSpeedUnit,
    })
    briefingStore.set(next)
  }, [aqi, daily, enabled, hourly, params.now, precipitationUnit, sunrise, sunset, temperatureUnit, tick, timeZone, windSpeedUnit])

  return briefing
}
