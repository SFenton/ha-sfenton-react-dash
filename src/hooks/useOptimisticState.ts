import { useCallback, useEffect, useRef, useState } from 'react'

export const DEFAULT_OPTIMISTIC_REVERT_MS = 2000

interface OptimisticStateOptions {
  clearOn?: 'confirmation' | 'live-change'
  revertMs?: number
}

/**
 * Tracks an optimistic value layered on top of a live (Home Assistant) value.
 *
 * When `commit` is called the returned value immediately reflects the optimistic
 * value so controls give instant feedback. Once the live value catches up to the
 * committed value the override is dropped quietly (no flicker). If the live value
 * never confirms within `revertMs`, the override is discarded so the control falls
 * back to the real state instead of lying about it.
 */
export function useOptimisticState<T>(liveValue: T, optionsOrRevertMs: OptimisticStateOptions | number = DEFAULT_OPTIMISTIC_REVERT_MS): [T, (next: T) => void] {
  const options = typeof optionsOrRevertMs === 'number' ? { revertMs: optionsOrRevertMs } : optionsOrRevertMs
  const clearOn = options.clearOn ?? 'live-change'
  const revertMs = options.revertMs ?? DEFAULT_OPTIMISTIC_REVERT_MS
  const [pending, setPending] = useState<{ value: T } | null>(null)
  const [prevLive, setPrevLive] = useState(liveValue)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Adjust state during render (React's recommended pattern over an effect): once the
  // live value actually changes, the optimistic override has served its purpose and is
  // consumed. This quietly resolves a successful commit and also lets external changes win.
  if (!Object.is(liveValue, prevLive)) {
    setPrevLive(liveValue)
    if (pending !== null && (clearOn === 'live-change' || Object.is(liveValue, pending.value))) setPending(null)
  }

  // Cancel any pending revert timer on unmount.
  useEffect(() => clearTimer, [clearTimer])

  const commit = useCallback(
    (next: T) => {
      clearTimer()
      setPending({ value: next })
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setPending(null)
      }, revertMs)
    },
    [clearTimer, revertMs],
  )

  return [pending !== null ? pending.value : liveValue, commit]
}
