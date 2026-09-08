import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeatherForecast } from './useWeatherForecasts'
import {
  resetWeatherDayBriefingCache,
  useWeatherDayBriefing,
  WEATHER_BRIEFING_STORAGE_KEY,
  type WeatherDayBriefingParams,
} from './useWeatherDayBriefing'
import { WEATHER_BRIEFING_VERSION } from './weatherDayBriefing'

const ZONE = 'America/Los_Angeles'

function hoursFor(date: string, condition = 'sunny'): WeatherForecast[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    condition,
    datetime: `${date}T${String(hour).padStart(2, '0')}:00:00-08:00`,
    precipitation: 0,
    precipitation_probability: 0,
    temperature: 55 + hour,
    wind_speed: 5,
  }))
}

function params(overrides: Partial<WeatherDayBriefingParams> = {}): WeatherDayBriefingParams {
  return {
    daily: [],
    hourly: hoursFor('2026-01-15'),
    now: Date.parse('2026-01-15T00:01:00-08:00'),
    timeZone: ZONE,
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  resetWeatherDayBriefingCache()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useWeatherDayBriefing', () => {
  it('generates once for the local day and persists it', () => {
    const { result } = renderHook(() => useWeatherDayBriefing(params()))

    expect(result.current?.dateKey).toBe('2026-01-15')
    const stored = JSON.parse(window.localStorage.getItem(WEATHER_BRIEFING_STORAGE_KEY) ?? 'null')
    expect(stored.dateKey).toBe('2026-01-15')
    expect(stored.version).toBe(WEATHER_BRIEFING_VERSION)
  })

  it('does not rewrite the briefing when the weather changes later in the day', () => {
    const { rerender, result } = renderHook((props: WeatherDayBriefingParams) => useWeatherDayBriefing(props), {
      initialProps: params(),
    })
    const first = result.current

    rerender(params({
      hourly: hoursFor('2026-01-15', 'pouring'),
      now: Date.parse('2026-01-15T14:00:00-08:00'),
    }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current).toBe(first)
  })

  it('waits for 12:01 AM before replacing yesterday\u2019s briefing', () => {
    const { rerender, result } = renderHook((props: WeatherDayBriefingParams) => useWeatherDayBriefing(props), {
      initialProps: params(),
    })
    expect(result.current?.dateKey).toBe('2026-01-15')

    rerender(params({
      hourly: hoursFor('2026-01-16'),
      now: Date.parse('2026-01-16T00:00:20-08:00'),
    }))
    expect(result.current?.dateKey).toBe('2026-01-15')

    rerender(params({
      hourly: hoursFor('2026-01-16'),
      now: Date.parse('2026-01-16T00:01:10-08:00'),
    }))
    expect(result.current?.dateKey).toBe('2026-01-16')
  })

  it('catches up once same-day forecast data arrives late', () => {
    const late = params({ hourly: hoursFor('2026-01-14'), now: Date.parse('2026-01-15T06:30:00-08:00') })
    const { rerender, result } = renderHook((props: WeatherDayBriefingParams) => useWeatherDayBriefing(props), {
      initialProps: late,
    })
    expect(result.current).toBeNull()

    rerender(params({ now: Date.parse('2026-01-15T06:35:00-08:00') }))
    expect(result.current?.dateKey).toBe('2026-01-15')
  })

  it('restores a same-day briefing from storage without regenerating', () => {
    const { result, unmount } = renderHook(() => useWeatherDayBriefing(params()))
    const generatedAt = result.current?.generatedAt
    unmount()

    const { result: restored } = renderHook(() => useWeatherDayBriefing(params({
      now: Date.parse('2026-01-15T18:00:00-08:00'),
    })))
    expect(restored.current?.generatedAt).toBe(generatedAt)
  })

  it('discards a cached briefing written by an older version', () => {
    window.localStorage.setItem(WEATHER_BRIEFING_STORAGE_KEY, JSON.stringify({
      dateKey: '2026-01-15',
      sentences: [],
      version: WEATHER_BRIEFING_VERSION - 1,
    }))

    const { result } = renderHook(() => useWeatherDayBriefing(params({
      now: Date.parse('2026-01-15T09:00:00-08:00'),
    })))

    expect(result.current?.version).toBe(WEATHER_BRIEFING_VERSION)
    expect(result.current?.sentences.length).toBeGreaterThan(0)
  })
})
