import { renderHook, act } from '@testing-library/react'
import { useSmoothDisplayedRoute } from './useSmoothDisplayedRoute'

describe('useSmoothDisplayedRoute', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the current route visible while it fades out before showing the next route', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'overview' },
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'idle' })

    act(() => {
      rerender({ path: 'security' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedPath: 'security', transitionSourcePath: 'overview', transitionState: 'pre-entering' })

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current).toEqual({ displayedPath: 'security', transitionSourcePath: 'overview', transitionState: 'entering' })

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current).toEqual({ displayedPath: 'security', transitionSourcePath: 'overview', transitionState: 'entering' })
  })

  it('cancels an exit when navigation returns to the displayed route', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'overview' },
    })

    act(() => {
      rerender({ path: 'security' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current.transitionState).toBe('exiting')

    act(() => {
      rerender({ path: 'overview' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'idle' })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'idle' })
  })

  it('preserves the source route while the target route enters', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'living-room' },
    })

    act(() => {
      rerender({ path: 'overview' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedPath: 'living-room', transitionSourcePath: 'living-room', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'living-room', transitionState: 'pre-entering' })

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'living-room', transitionState: 'entering' })
  })
})
