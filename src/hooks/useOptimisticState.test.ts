import { act, renderHook } from '@testing-library/react'
import { DEFAULT_OPTIMISTIC_REVERT_MS, useOptimisticState } from './useOptimisticState'

describe('useOptimisticState', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('returns the live value when nothing has been committed', () => {
    const { result } = renderHook(({ live }) => useOptimisticState(live), { initialProps: { live: 'off' } })
    expect(result.current[0]).toBe('off')
  })

  it('shows the optimistic value immediately after commit', () => {
    const { result } = renderHook(({ live }) => useOptimisticState(live), { initialProps: { live: 'off' } })

    act(() => result.current[1]('on'))

    expect(result.current[0]).toBe('on')
  })

  it('drops the override quietly once the live value catches up', () => {
    const { result, rerender } = renderHook(({ live }) => useOptimisticState(live), { initialProps: { live: 'off' } })

    act(() => result.current[1]('on'))
    expect(result.current[0]).toBe('on')

    rerender({ live: 'on' })
    expect(result.current[0]).toBe('on')

    // A later live change is reflected because the override was cleared.
    rerender({ live: 'off' })
    expect(result.current[0]).toBe('off')
  })

  it('reverts to the live value if Home Assistant never confirms', () => {
    const { result } = renderHook(({ live }) => useOptimisticState(live), { initialProps: { live: 'off' } })

    act(() => result.current[1]('on'))
    expect(result.current[0]).toBe('on')

    act(() => vi.advanceTimersByTime(DEFAULT_OPTIMISTIC_REVERT_MS))
    expect(result.current[0]).toBe('off')
  })

  it('keeps showing the optimistic value until just before the revert deadline', () => {
    const { result } = renderHook(({ live }) => useOptimisticState(live, 1000), { initialProps: { live: 'off' } })

    act(() => result.current[1]('on'))
    act(() => vi.advanceTimersByTime(999))
    expect(result.current[0]).toBe('on')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe('off')
  })

  it('restarts the revert window when a new value is committed', () => {
    const { result } = renderHook(({ live }) => useOptimisticState(live, 1000), { initialProps: { live: 'off' } })

    act(() => result.current[1]('on'))
    act(() => vi.advanceTimersByTime(900))
    act(() => result.current[1]('off'))

    // The original timer would have fired here, but the second commit reset it.
    act(() => vi.advanceTimersByTime(200))
    expect(result.current[0]).toBe('off')
  })

  it('can keep the optimistic value across stale live updates until confirmation', () => {
    const { result, rerender } = renderHook(({ live }) => useOptimisticState(live, { clearOn: 'confirmation', revertMs: 1000 }), { initialProps: { live: 0 } })

    act(() => result.current[1](-2))
    expect(result.current[0]).toBe(-2)

    rerender({ live: -1 })
    expect(result.current[0]).toBe(-2)

    rerender({ live: -2 })
    expect(result.current[0]).toBe(-2)

    rerender({ live: 0 })
    expect(result.current[0]).toBe(0)
  })

  it('still reverts confirmation-only optimistic values when never confirmed', () => {
    const { result, rerender } = renderHook(({ live }) => useOptimisticState(live, { clearOn: 'confirmation', revertMs: 1000 }), { initialProps: { live: 0 } })

    act(() => result.current[1](-2))
    rerender({ live: -1 })

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current[0]).toBe(-1)
  })

  it('can hold a confirmed value through a short stale live echo', () => {
    const { result, rerender } = renderHook(({ live }) => useOptimisticState(live, { clearOn: 'confirmation', confirmationHoldMs: 250, revertMs: 1000 }), { initialProps: { live: -3 } })

    act(() => result.current[1](2))
    rerender({ live: 2 })
    expect(result.current[0]).toBe(2)

    rerender({ live: -3 })
    expect(result.current[0]).toBe(2)

    act(() => vi.advanceTimersByTime(249))
    expect(result.current[0]).toBe(2)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe(-3)

    rerender({ live: 2 })
    expect(result.current[0]).toBe(2)
  })
})
