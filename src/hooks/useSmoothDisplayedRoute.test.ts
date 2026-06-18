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

    expect(result.current).toEqual({ displayedPath: 'security', transitionSourcePath: 'security', transitionState: 'idle' })
  })

  it('waits for tapping to settle before fading the displayed route back in', () => {
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

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(129)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'pre-entering' })

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'entering' })

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'idle' })
  })

  it('coalesces rapid target changes during one exit instead of restarting the delay', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'overview' },
    })

    act(() => {
      rerender({ path: 'security' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(40)
      rerender({ path: 'ecobee' })
    })

    act(() => {
      vi.advanceTimersByTime(89)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(30)
    })

    expect(result.current).toEqual({ displayedPath: 'ecobee', transitionSourcePath: 'overview', transitionState: 'pre-entering' })
  })

  it('waits briefly for rapid taps to settle before showing the pending route', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'overview' },
    })

    act(() => {
      rerender({ path: 'security' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(108)
      rerender({ path: 'chores' })
    })

    act(() => {
      vi.advanceTimersByTime(22)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(22)
      rerender({ path: 'ecobee' })
    })

    act(() => {
      vi.advanceTimersByTime(119)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toEqual({ displayedPath: 'ecobee', transitionSourcePath: 'overview', transitionState: 'pre-entering' })
  })

  it('retargets directly while a pending route is entering', () => {
    const { result, rerender } = renderHook(({ path }) => useSmoothDisplayedRoute(path), {
      initialProps: { path: 'overview' },
    })

    act(() => {
      rerender({ path: 'security' })
    })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedPath: 'security', transitionSourcePath: 'overview', transitionState: 'pre-entering' })

    act(() => {
      rerender({ path: 'ecobee' })
    })

    expect(result.current).toEqual({ displayedPath: 'ecobee', transitionSourcePath: 'overview', transitionState: 'pre-entering' })

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current).toEqual({ displayedPath: 'ecobee', transitionSourcePath: 'overview', transitionState: 'entering' })

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current).toEqual({ displayedPath: 'ecobee', transitionSourcePath: 'ecobee', transitionState: 'idle' })
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

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current).toEqual({ displayedPath: 'overview', transitionSourcePath: 'overview', transitionState: 'idle' })
  })
})
