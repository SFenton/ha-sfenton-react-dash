import { act, renderHook } from '@testing-library/react'
import type { WeatherHourlyMode } from '../../constants/surfaceSemantics'
import { useWeatherModeTransition } from './weatherModeTransition'

describe('Weather mode transition settlement', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextId: number
  beforeEach(() => {
    vi.useFakeTimers()
    frames = new Map()
    nextId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextId, callback)
      return nextId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  const releaseFrames = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(performance.now()))
  }

  it('retains the140ms swap and320ms normal settlement', () => {
    const view = renderHook(({ mode }: { mode: WeatherHourlyMode }) => useWeatherModeTransition(mode), { initialProps: { mode: 'condition' } })
    view.rerender({ mode: 'precipitation' })
    act(() => { vi.advanceTimersByTime(140); releaseFrames() })
    expect(view.result.current).toEqual({ displayMode: 'precipitation', transitionPhase: 'in' })
    act(() => vi.advanceTimersByTime(180))
    expect(view.result.current.transitionPhase).toBe('idle')
  })

  it('settles after an animation frame delayed beyond the original deadline', () => {
    const view = renderHook(({ mode }: { mode: WeatherHourlyMode }) => useWeatherModeTransition(mode), { initialProps: { mode: 'condition' } })
    view.rerender({ mode: 'wind' })
    act(() => vi.advanceTimersByTime(1000))
    act(releaseFrames)
    act(() => vi.advanceTimersByTime(1))
    expect(view.result.current).toEqual({ displayMode: 'wind', transitionPhase: 'idle' })
  })

  it('cancels a queued entry when another mode supersedes it or unmounts', () => {
    const view = renderHook(({ mode }: { mode: WeatherHourlyMode }) => useWeatherModeTransition(mode), { initialProps: { mode: 'condition' } })
    view.rerender({ mode: 'wind' })
    act(() => vi.advanceTimersByTime(140))
    view.rerender({ mode: 'precipitation' })
    expect(frames.size).toBe(0)
    act(() => { vi.advanceTimersByTime(140); releaseFrames(); vi.advanceTimersByTime(180) })
    expect(view.result.current).toEqual({ displayMode: 'precipitation', transitionPhase: 'idle' })
    view.rerender({ mode: 'wind' })
    act(() => vi.advanceTimersByTime(140))
    view.unmount()
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
