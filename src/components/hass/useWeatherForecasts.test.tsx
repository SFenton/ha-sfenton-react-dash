import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { WEATHER_ENTITY } from '../../constants/atAGlance'
import { useWeatherForecasts, WEATHER_FORECAST_TTL_MS, type WeatherForecast, type WeatherForecastService } from './useWeatherForecasts'

const NOW = new Date('2026-09-05T12:30:00Z')
type Kind = 'daily' | 'hourly'

function response(temperature = 60, forecasts?: WeatherForecast[]) {
  return { response: { [WEATHER_ENTITY]: { forecast: forecasts ?? [{ temperature, datetime: NOW.toISOString() }] } } }
}

function kindOf(params: Record<string, unknown>) {
  return (params.serviceData as { type: Kind }).type
}

function serviceMock() {
  return vi.fn<(params: Record<string, unknown>) => Promise<ReturnType<typeof response>>>(() => Promise.resolve(response()))
}

function delayedService() {
  const pending: Record<Kind, { resolve: (value: unknown) => void; reject: (error: Error) => void }[]> = { daily: [], hourly: [] }
  const callService = vi.fn((params: Record<string, unknown>) => new Promise((resolve, reject) => {
    pending[kindOf(params)].push({ resolve, reject })
  }))
  return { callService, pending }
}

async function settle() {
  await act(async () => {})
}

describe('useWeatherForecasts', () => {
  let visibility: DocumentVisibilityState

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    visibility = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function changeVisibility(next: DocumentVisibilityState) {
    act(() => {
      visibility = next
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  it('refreshes both kinds once at TTL and once per HA source update, publishing the actual data', async () => {
    let temperature = 60
    const callService = serviceMock().mockImplementation(() => Promise.resolve(response(temperature)))
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'initial' } })
    await settle()
    expect(callService.mock.calls.map(([params]) => kindOf(params))).toEqual(['daily', 'hourly'])
    expect(vi.getTimerCount()).toBe(1)
    expect(result.current.daily.status).toBe('ready')
    temperature = 71
    await act(async () => { await vi.advanceTimersByTimeAsync(WEATHER_FORECAST_TTL_MS) })
    expect(callService).toHaveBeenCalledTimes(4)
    expect(result.current.hourly.forecasts[0].temperature).toBe(71)
    expect(result.current.daily.forecasts[0].temperature).toBe(71)
    temperature = 82
    rerender({ sourceRevision: 'new-source' })
    await settle()
    expect(callService.mock.calls.map(([params]) => kindOf(params))).toEqual(['daily', 'hourly', 'daily', 'hourly', 'daily', 'hourly'])
    expect(result.current.hourly.forecasts[0].temperature).toBe(82)
    expect(result.current.daily.forecasts[0].temperature).toBe(82)
    rerender({ sourceRevision: 'new-source' })
    await settle()
    expect(callService).toHaveBeenCalledTimes(6)
  })

  it('shares fresh cached data and in-flight work across consumers and StrictMode remounts', async () => {
    const { callService, pending } = delayedService()
    const useForecasts = () => useWeatherForecasts({ callService, enabled: true, sourceRevision: 'initial' })
    const first = renderHook(useForecasts, { wrapper: StrictMode })
    const second = renderHook(useForecasts)
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    first.unmount()
    await act(async () => {
      pending.daily[0].resolve(response(66))
      pending.hourly[0].resolve(response(67))
    })
    expect(second.result.current.daily.forecasts[0].temperature).toBe(66)
    expect(second.result.current.hourly.forecasts[0].temperature).toBe(67)
    second.unmount()
    expect(vi.getTimerCount()).toBe(0)
    const third = renderHook(useForecasts)
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    expect(third.result.current.hourly.forecasts[0].temperature).toBe(67)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does no service, timer, visibility-listener or observer work while deferred, including cached mounts', async () => {
    const callService = serviceMock()
    const addListener = vi.spyOn(document, 'addEventListener')
    const observer = vi.spyOn(globalThis, 'ResizeObserver')
    const { rerender, unmount } = renderHook(({ enabled, sourceRevision }) => useWeatherForecasts({
      callService, enabled, sourceRevision,
    }), { initialProps: { enabled: false, sourceRevision: 'initial' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(7 * 60_000) })
    expect(callService).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(addListener.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(false)
    expect(observer).not.toHaveBeenCalled()
    rerender({ enabled: true, sourceRevision: 'initial' })
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    rerender({ enabled: false, sourceRevision: 'new-source' })
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(7 * 60_000) })
    expect(callService).toHaveBeenCalledTimes(2)
    unmount()
    renderHook(() => useWeatherForecasts({ callService, enabled: false, sourceRevision: 'new-source' }))
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('serializes delayed requests and coalesces concurrent source changes without dropping successful results', async () => {
    const { callService, pending } = delayedService()
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    expect(result.current.hourly.status).toBe('loading')
    rerender({ sourceRevision: 'b' })
    rerender({ sourceRevision: 'c' })
    await act(async () => { await vi.advanceTimersByTimeAsync(7 * 60_000) })
    expect(callService).toHaveBeenCalledTimes(2)
    await act(async () => {
      pending.daily[0].resolve(response(61))
      pending.hourly[0].resolve(response(62))
    })
    expect(callService).toHaveBeenCalledTimes(4)
    expect(result.current.daily.forecasts[0].temperature).toBe(61)
    expect(result.current.hourly.forecasts[0].temperature).toBe(62)
    expect(result.current.hourly.refreshing).toBe(true)
    await act(async () => {
      pending.hourly[1].resolve(response(82))
      pending.daily[1].resolve(response(81))
    })
    expect(callService).toHaveBeenCalledTimes(4)
    expect(result.current.daily.forecasts[0].temperature).toBe(81)
    expect(result.current.hourly.forecasts[0].temperature).toBe(82)
    expect(result.current.hourly.refreshing).toBe(false)
  })

  it.each(['deferred', 'hidden'])('does not start queued service I/O if the mount becomes %s before dispatch', async (mode) => {
    const callService = serviceMock()
    const { result, rerender } = renderHook(({ enabled }) => useWeatherForecasts({
      callService, enabled, sourceRevision: 'a',
    }), { initialProps: { enabled: true } })
    if (mode === 'deferred') rerender({ enabled: false })
    else changeVisibility('hidden')
    await settle()
    expect(callService).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    if (mode === 'deferred') rerender({ enabled: true })
    else changeVisibility('visible')
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    expect(result.current.hourly.status).toBe('ready')
  })

  it('retains a response completed after unmount without doing background refresh work', async () => {
    const { callService, pending } = delayedService()
    const useForecasts = () => useWeatherForecasts({ callService, enabled: true, sourceRevision: 'a' })
    const first = renderHook(useForecasts)
    await settle()
    first.unmount()
    await act(async () => {
      pending.daily[0].resolve(response(91))
      pending.hourly[0].resolve(response(92))
    })
    expect(vi.getTimerCount()).toBe(0)
    const second = renderHook(useForecasts)
    await settle()
    expect(callService).toHaveBeenCalledTimes(2)
    expect(second.result.current.hourly.forecasts[0].temperature).toBe(92)
  })

  it('pauses hidden-page I/O and refreshes once on visible resume despite multiple resume events', async () => {
    const callService = serviceMock()
    const { rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    changeVisibility('hidden')
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(7 * 60_000) })
    rerender({ sourceRevision: 'b' })
    act(() => window.dispatchEvent(new Event('pageshow')))
    expect(callService).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    changeVisibility('visible')
    act(() => {
      window.dispatchEvent(new Event('pageshow'))
      window.dispatchEvent(new Event('focus'))
    })
    await settle()
    expect(callService).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does not fetch on an initially hidden mount or queue follow-ups until visible', async () => {
    visibility = 'hidden'
    const { callService, pending } = delayedService()
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    expect(callService).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    changeVisibility('visible')
    await settle()
    changeVisibility('hidden')
    rerender({ sourceRevision: 'b' })
    await act(async () => {
      pending.daily[0].resolve(response(68))
      pending.hourly[0].resolve(response(69))
    })
    expect(result.current.hourly.forecasts[0].temperature).toBe(69)
    expect(callService).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    changeVisibility('visible')
    await settle()
    expect(callService).toHaveBeenCalledTimes(4)
  })

  it.each([false, true])('exposes errors with cached data=%s and retries without a tight loop', async (cached) => {
    const callService = serviceMock()
    if (!cached) callService.mockRejectedValue(new Error('HA offline'))
    const { result } = renderHook(() => useWeatherForecasts({ callService, enabled: true, sourceRevision: 'a' }))
    await settle()
    if (cached) {
      callService.mockRejectedValue(new Error('HA offline'))
      await act(async () => { await vi.advanceTimersByTimeAsync(WEATHER_FORECAST_TTL_MS) })
    }
    for (const kind of ['daily', 'hourly'] as const) {
      expect(result.current[kind]).toMatchObject({ status: 'error', error: 'HA offline', refreshing: false })
      expect(result.current[kind].forecasts).toHaveLength(cached ? 1 : 0)
      expect(result.current[kind].updatedAt).toBe(cached ? NOW.getTime() : null)
    }
    const attempts = callService.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(WEATHER_FORECAST_TTL_MS - 1) })
    expect(callService).toHaveBeenCalledTimes(attempts)
    callService.mockResolvedValue(response(99))
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(callService).toHaveBeenCalledTimes(attempts + 2)
    expect(result.current.hourly).toMatchObject({ error: null, status: 'ready' })
    expect(result.current.hourly.forecasts[0].temperature).toBe(99)
  })

  it('treats empty responses explicitly, clearing previous values rather than preserving phantom data', async () => {
    const callService = serviceMock()
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    callService.mockResolvedValue(response(0, []))
    rerender({ sourceRevision: 'b' })
    await settle()
    expect(result.current.daily).toMatchObject({ error: null, forecasts: [], status: 'empty', refreshing: false })
    expect(result.current.hourly).toMatchObject({ error: null, forecasts: [], status: 'empty', refreshing: false })
    act(() => window.dispatchEvent(new Event('focus')))
    await settle()
    expect(callService).toHaveBeenCalledTimes(4)
  })

  it.each([undefined, null])('treats a missing service result (%s) as failure, not successful empty data', async (value) => {
    const callService = vi.fn(() => value)
    const { result } = renderHook(() => useWeatherForecasts({ callService, enabled: true, sourceRevision: undefined }))
    await settle()
    expect(result.current.daily).toMatchObject({ status: 'error', updatedAt: null })
    expect(result.current.hourly.error).toBe('Unable to load Pirate Weather hourly forecast.')
  })

  it.each([{ response: {} }, { response: { [WEATHER_ENTITY]: {} } }])('rejects malformed forecast envelopes instead of publishing empty success', async (value) => {
    const callService = vi.fn(() => value)
    const { result } = renderHook(() => useWeatherForecasts({ callService, enabled: true, sourceRevision: undefined }))
    await settle()
    expect(result.current.daily).toMatchObject({ status: 'error', updatedAt: null })
    expect(result.current.hourly).toMatchObject({ status: 'error', updatedAt: null })
  })

  it('handles synchronous HA failures and wrapped service_response forecasts', async () => {
    const callService = vi.fn<WeatherForecastService>(() => { throw new Error('Disconnected') })
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    expect(result.current.hourly.error).toBe('Disconnected')
    callService.mockImplementation(() => ({ response: { service_response: response(75).response } }))
    rerender({ sourceRevision: 'b' })
    await settle()
    expect(result.current.hourly.forecasts[0].temperature).toBe(75)
  })

  it('expires past hourly buckets exactly at their end while a refresh is pending', async () => {
    vi.setSystemTime(new Date('2026-09-05T12:59:00Z'))
    const initial = [
      { datetime: '2026-09-05T11:00:00Z', temperature: 50 },
      { datetime: '2026-09-05T12:00:00Z', temperature: 60 },
      { datetime: '2026-09-05T13:00:00Z', temperature: 70 },
    ]
    const callService = serviceMock()
    callService.mockResolvedValue(response(0, initial))
    const { result, rerender } = renderHook(({ sourceRevision }) => useWeatherForecasts({
      callService, enabled: true, sourceRevision,
    }), { initialProps: { sourceRevision: 'a' } })
    await settle()
    expect(result.current.hourly.forecasts.map((forecast) => forecast.temperature)).toEqual([60, 70])
    callService.mockImplementation(() => new Promise(() => {}))
    rerender({ sourceRevision: 'b' })
    await settle()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(result.current.hourly.forecasts.map((forecast) => forecast.temperature)).toEqual([70])
    expect(result.current.hourly.refreshing).toBe(true)
    expect(callService).toHaveBeenCalledTimes(4)
  })
})
