import { renderHook, act } from '@testing-library/react'
import { useSmoothDisplayedModalTab } from './useSmoothDisplayedModalTab'

describe('useSmoothDisplayedModalTab', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the current modal tab visible while it fades out before showing the next tab', () => {
    const { result, rerender } = renderHook(({ tab }) => useSmoothDisplayedModalTab(tab), {
      initialProps: { tab: 'controls' },
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'idle' })

    act(() => {
      rerender({ tab: 'apps' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedTab: 'apps', transitionState: 'pre-entering' })

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current).toEqual({ displayedTab: 'apps', transitionState: 'entering' })

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current).toEqual({ displayedTab: 'apps', transitionState: 'idle' })
  })

  it('waits for modal tab tapping to settle before fading the original tab back in', () => {
    const { result, rerender } = renderHook(({ tab }) => useSmoothDisplayedModalTab(tab), {
      initialProps: { tab: 'controls' },
    })

    act(() => {
      rerender({ tab: 'apps' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'exiting' })

    act(() => {
      rerender({ tab: 'controls' })
    })

    act(() => {
      vi.advanceTimersByTime(129)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'pre-entering' })
  })

  it('coalesces rapid modal tab targets during one exit', () => {
    const { result, rerender } = renderHook(({ tab }) => useSmoothDisplayedModalTab(tab), {
      initialProps: { tab: 'controls' },
    })

    act(() => {
      rerender({ tab: 'apps' })
    })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(108)
      rerender({ tab: 'devices' })
    })

    act(() => {
      vi.advanceTimersByTime(119)
    })

    expect(result.current).toEqual({ displayedTab: 'controls', transitionState: 'exiting' })

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toEqual({ displayedTab: 'devices', transitionState: 'pre-entering' })
  })

  it('retargets directly while a modal tab is entering', () => {
    const { result, rerender } = renderHook(({ tab }) => useSmoothDisplayedModalTab(tab), {
      initialProps: { tab: 'controls' },
    })

    act(() => {
      rerender({ tab: 'apps' })
    })

    act(() => {
      vi.advanceTimersByTime(130)
    })

    expect(result.current).toEqual({ displayedTab: 'apps', transitionState: 'pre-entering' })

    act(() => {
      rerender({ tab: 'devices' })
    })

    expect(result.current).toEqual({ displayedTab: 'devices', transitionState: 'pre-entering' })
  })
})
