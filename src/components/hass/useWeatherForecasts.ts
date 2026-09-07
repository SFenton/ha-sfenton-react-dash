import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { WEATHER_ENTITY } from '../../constants/atAGlance'
import { copy, WEATHER_COPY_KEYS, WEATHER_COPY_NAMESPACE } from '../../i18n'

export interface WeatherForecast {
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

interface WeatherForecastRequest {
  domain: 'weather'
  service: 'get_forecasts'
  target: typeof WEATHER_ENTITY
  serviceData: { type: 'daily' | 'hourly' }
  returnResponse: true
}

export type WeatherForecastService = (params: WeatherForecastRequest) => unknown
export const WEATHER_FORECAST_TTL_MS = 5 * 60 * 1000
export const WEATHER_FORECAST_PHASE = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
} as const
const HOUR_MS = 60 * 60 * 1000
const KINDS = ['daily', 'hourly'] as const
type ForecastKind = typeof KINDS[number]

interface ForecastState {
  error: string | null
  forecasts: WeatherForecast[]
  refreshing: boolean
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  updatedAt: number | null
}

interface ForecastRequest {
  completedRevision: number
  inFlight: boolean
  nextRefresh: number
}

const emptyState = (): ForecastState => ({
  error: null,
  forecasts: [],
  refreshing: false,
  status: WEATHER_FORECAST_PHASE.IDLE,
  updatedAt: null,
})

function forecastFailure(kind: ForecastKind) {
  return copy(WEATHER_COPY_NAMESPACE, kind === 'daily'
    ? WEATHER_COPY_KEYS.forecast.dailyError
    : WEATHER_COPY_KEYS.forecast.hourlyError)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function extractForecasts(result: unknown, kind: ForecastKind): WeatherForecast[] {
  if (!isRecord(result) || !isRecord(result.response)) {
    throw new Error(forecastFailure(kind))
  }
  const response = result.response.service_response ?? result.response
  const entity = isRecord(response) ? response[WEATHER_ENTITY] : undefined
  const forecasts = isRecord(entity) ? entity.forecast : undefined
  if (!Array.isArray(forecasts)) throw new Error(forecastFailure(kind))
  return forecasts.filter(isRecord).slice(0, kind === 'daily' ? 7 : 24) as WeatherForecast[]
}

function hourlyExpiry(forecast: WeatherForecast) {
  const start = forecast.datetime ? Date.parse(forecast.datetime) : Number.NaN
  return Number.isFinite(start) ? start + HOUR_MS : Infinity
}

function currentHourlyForecasts(forecasts: WeatherForecast[], now: number) {
  return forecasts.filter((forecast) => hourlyExpiry(forecast) > now)
}

// One cache/scheduler per HA helper: card/modal mounts share both data and in-flight work.
// Requests are not cancelled on effect cleanup; a newer HA revision queues one follow-up.
class WeatherForecastCache {
  private state = { daily: emptyState(), hourly: emptyState() }
  private requests: Record<ForecastKind, ForecastRequest> = {
    daily: { completedRevision: -1, inFlight: false, nextRefresh: 0 },
    hourly: { completedRevision: -1, inFlight: false, nextRefresh: 0 },
  }
  private listeners = new Set<() => void>()
  private consumers = 0
  private revision = 0
  private sourceRevision: string | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private callService: WeatherForecastService

  constructor(callService: WeatherForecastService) {
    this.callService = callService
  }

  getSnapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  activate(sourceRevision: string | undefined) {
    this.consumers += 1
    if (sourceRevision !== this.sourceRevision) {
      this.sourceRevision = sourceRevision
      this.revision += 1
    }
    if (this.consumers === 1) {
      document.addEventListener('visibilitychange', this.refresh)
      window.addEventListener('pageshow', this.refresh)
      window.addEventListener('focus', this.refresh)
    }
    this.refresh()
    return () => {
      this.consumers -= 1
      if (this.consumers !== 0) return
      this.clearTimer()
      document.removeEventListener('visibilitychange', this.refresh)
      window.removeEventListener('pageshow', this.refresh)
      window.removeEventListener('focus', this.refresh)
    }
  }

  private publish(kind: ForecastKind, patch: Partial<ForecastState>) {
    this.state = { ...this.state, [kind]: { ...this.state[kind], ...patch } }
    this.listeners.forEach((listener) => listener())
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  private active() {
    return this.consumers > 0 && document.visibilityState !== 'hidden'
  }

  private pruneHourly(now: number) {
    const hourly = this.state.hourly
    const forecasts = currentHourlyForecasts(hourly.forecasts, now)
    if (forecasts.length === hourly.forecasts.length) return
    this.publish('hourly', {
      forecasts,
      status: hourly.status === 'ready' && !forecasts.length ? 'empty' : hourly.status,
    })
  }

  private refresh = () => {
    this.clearTimer()
    if (!this.active()) return
    const now = Date.now()
    this.pruneHourly(now)
    for (const kind of KINDS) {
      const request = this.requests[kind]
      if (!request.inFlight && (request.completedRevision !== this.revision || now >= request.nextRefresh)) {
        this.fetch(kind)
      }
    }
    const deadlines = KINDS.flatMap((kind) => this.requests[kind].inFlight ? [] : [this.requests[kind].nextRefresh])
    deadlines.push(...this.state.hourly.forecasts.map(hourlyExpiry))
    const next = Math.min(...deadlines)
    if (Number.isFinite(next)) {
      this.timer = setTimeout(this.refresh, Math.max(1, next - now))
    }
  }

  private fetch(kind: ForecastKind) {
    const request = this.requests[kind]
    const revision = this.revision
    const previousStatus = this.state[kind].status
    let started = false
    request.inFlight = true
    this.publish(kind, {
      refreshing: true,
      status: this.state[kind].forecasts.length ? this.state[kind].status : 'loading',
    })
    void Promise.resolve()
      .then(() => {
        if (!this.active()) return
        started = true
        return this.callService({
          domain: 'weather',
          service: 'get_forecasts',
          target: WEATHER_ENTITY,
          serviceData: { type: kind },
          returnResponse: true,
        })
      })
      .then((result) => {
        if (!started) return
        const received = extractForecasts(result, kind)
        const forecasts = kind === 'hourly' ? currentHourlyForecasts(received, Date.now()) : received
        this.publish(kind, {
          error: null,
          forecasts,
          status: forecasts.length ? 'ready' : 'empty',
          updatedAt: Date.now(),
        })
      })
      .catch((error: unknown) => {
        this.publish(kind, {
          error: error instanceof Error ? error.message : forecastFailure(kind),
          status: 'error',
        })
      })
      .finally(() => {
        request.inFlight = false
        if (started) {
          request.completedRevision = revision
          request.nextRefresh = Date.now() + WEATHER_FORECAST_TTL_MS
        }
        this.publish(kind, { refreshing: false, ...(!started ? { status: previousStatus } : {}) })
        this.refresh()
      })
  }
}

const caches = new WeakMap<WeatherForecastService, WeatherForecastCache>()
const inertSubscribe = () => () => {}

export function useWeatherForecasts({
  callService,
  enabled,
  sourceRevision,
}: {
  callService: WeatherForecastService
  enabled: boolean
  sourceRevision: string | undefined
}) {
  const cache = useMemo(() => {
    let existing = caches.get(callService)
    if (!existing) {
      existing = new WeatherForecastCache(callService)
      caches.set(callService, existing)
    }
    return existing
  }, [callService])
  const snapshot = useSyncExternalStore(enabled ? cache.subscribe : inertSubscribe, cache.getSnapshot, cache.getSnapshot)

  useEffect(() => {
    if (!enabled) return
    return cache.activate(sourceRevision)
  }, [cache, enabled, sourceRevision])

  return snapshot
}
