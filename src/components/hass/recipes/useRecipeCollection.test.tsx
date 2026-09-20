import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { PageScrollToTopContext, PageScrollerContext } from '../../../hooks/usePageScroller'
import {
  mockState,
  resetMockHass,
  setMockConnectionStatus,
  setMockRecipeQueryAvailable,
  type MockConnectionStatus,
} from '../../../test/mocks/hakitCoreState'
import type { RecipeBrowseCriteria } from './recipeTypes'
import { RECIPE_HYDRATION_SETTLE_MS, RECIPE_RECOVERY_RETRY_MS, useRecipeCollection } from './useRecipeCollection'

function criteria(q = ''): RecipeBrowseCriteria {
  return {
    q,
    sort: 'availability',
    availabilityWeight: 100,
    expiryWeight: 25,
    minimumCoverage: 0,
  }
}

function rawCard(id: number, dedupeKey = `recipe:${id}`) {
  return {
    id,
    dedupe_key: dedupeKey,
    title: `Recipe ${id}`,
    source: 'Test',
    coverage: 80,
    matched_required: 8,
    required_total: 10,
    expiry_score: 4,
    score: 90,
    cookable: true,
  }
}

function browse(items: unknown[], options: { cursor?: string | null; hasMore?: boolean; total?: number } = {}) {
  return {
    response: {
      kind: 'browse',
      criteria_hash: 'criteria',
      snapshot_id: 'snapshot',
      items,
      next_cursor: options.cursor ?? null,
      has_more: options.hasMore ?? false,
      total: options.total ?? items.length,
      ranking_status: 'ready',
    },
  }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useRecipeCollection', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('rejects stale criteria promises and progresses through transition phases', async () => {
    const pending = new Map<string, (value: unknown) => void>()
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        const q = String((params.serviceData as { q?: string }).q ?? '')
        return new Promise((resolve) => pending.set(q, resolve))
      }
      return originalCallService(params)
    }

    try {
      const { result, rerender } = renderHook(({ value }) => useRecipeCollection(value), { initialProps: { value: criteria('old') } })
      await waitFor(() => expect(result.current.criteriaPhase).toBe('loading'))
      expect(result.current.initialResolved).toBe(false)
      rerender({ value: criteria('new') })

      await waitFor(() => expect(pending.has('new')).toBe(true))
      expect(result.current.initialResolved).toBe(false)
      await act(async () => pending.get('new')?.(browse([rawCard(2)])))
      await waitFor(() => expect(result.current.criteriaPhase).toBe('idle'))
      expect(result.current.initialResolved).toBe(true)
      expect(result.current.items.map((item) => item.title)).toEqual(['Recipe 2'])

      if (pending.has('old')) {
        await act(async () => pending.get('old')?.(browse([rawCard(1)])))
      }
      expect(result.current.items.map((item) => item.title)).toEqual(['Recipe 2'])
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps initial resolution pending until the first active request settles', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? new Promise(() => undefined)
        : originalCallService(params)
    )

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await waitFor(() => expect(result.current.criteriaPhase).toBe('loading'))
      expect(result.current.initialResolved).toBe(false)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('marks the initial request resolved after a handled error and keeps it resolved on retry', async () => {
    const originalCallService = mockState.helpers.callService
    let rejectRequest = true
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return rejectRequest
          ? Promise.reject(new Error('Initial failure'))
          : Promise.resolve(browse([rawCard(1)]))
      }
      return originalCallService(params)
    }

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await waitFor(() => expect(result.current.error).toBe('Initial failure'))
      expect(result.current.initialResolved).toBe(true)

      rejectRequest = false
      act(() => result.current.retryCriteria())
      expect(result.current.initialResolved).toBe(true)
      await waitFor(() => expect(result.current.criteriaPhase).toBe('idle'))
      expect(result.current.items.map((item) => item.id)).toEqual([1])
      expect(result.current.initialResolved).toBe(true)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('retries an unavailable collection exactly 5 seconds after settlement and stays serial', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ message: 'Service evershelf.recipe_query not found', success: false }),
      ok: false,
      status: 503,
    }))
    vi.stubGlobal('fetch', fetchMock)
    let attempts = 0
    let active = 0
    let maximumActive = 0
    mockState.helpers.callService = (params) => {
      if (params.domain !== 'evershelf' || params.service !== 'recipe_query') return originalCallService(params)
      attempts += 1
      active += 1
      maximumActive = Math.max(maximumActive, active)
      if (attempts === 1) {
        active -= 1
        return Promise.reject(new Error('Service evershelf.recipe_query not found'))
      }
      active -= 1
      return Promise.resolve(browse([rawCard(2)]))
    }

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.recovery).toBe(true)
      expect(attempts).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_RECOVERY_RETRY_MS - 1)
      })
      expect(attempts).toBe(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(attempts).toBe(2)
      expect(maximumActive).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(result.current.recovery).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.items.map((item) => item.id)).toEqual([2])
    } finally {
      vi.unstubAllGlobals()
      globalThis.fetch = originalFetch
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('ends recovery on a connected non-classified retry error without scheduling another retry', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ message: 'Service evershelf.recipe_query not found', success: false }),
      ok: false,
      status: 503,
    })))
    let attempts = 0
    mockState.helpers.callService = (params) => {
      if (params.domain !== 'evershelf' || params.service !== 'recipe_query') return originalCallService(params)
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error('Service evershelf.recipe_query not found'))
        : Promise.reject(new Error('Connected recipe query failure'))
    }

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.recovery).toBe(true)
      expect(attempts).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_RECOVERY_RETRY_MS)
      })
      expect(attempts).toBe(2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(result.current.recovery).toBe(false)
      expect(result.current.error).toBe('Connected recipe query failure')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_RECOVERY_RETRY_MS)
      })
      expect(attempts).toBe(2)
    } finally {
      vi.unstubAllGlobals()
      globalThis.fetch = originalFetch
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('lets service registration preempt recovery and complete with an empty collection', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ message: 'Service evershelf.recipe_query not found', success: false }),
      ok: false,
      status: 503,
    })))
    let attempts = 0
    mockState.helpers.callService = (params) => {
      if (params.domain !== 'evershelf' || params.service !== 'recipe_query') return originalCallService(params)
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error('Service evershelf.recipe_query not found'))
        : Promise.resolve(browse([]))
    }

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.recovery).toBe(true)
      expect(attempts).toBe(1)

      await act(async () => {
        setMockRecipeQueryAvailable(true)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(attempts).toBe(2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(result.current.recovery).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.items).toEqual([])
    } finally {
      act(() => setMockRecipeQueryAvailable(false))
      vi.unstubAllGlobals()
      globalThis.fetch = originalFetch
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it.each<MockConnectionStatus>(['pending', 'disconnected', 'pending-suspension', 'suspended'])(
    'does not call recipe services while connection is %s',
    async (status) => {
      const originalCallService = mockState.helpers.callService
      const callService = vi.fn((params: Record<string, unknown>) => (
        params.domain === 'evershelf' && params.service === 'recipe_query'
          ? Promise.resolve(browse([rawCard(1)]))
          : originalCallService(params)
      ))
      mockState.helpers.callService = callService
      setMockConnectionStatus(status)

      try {
        const { result, unmount } = renderHook(() => useRecipeCollection(criteria()))
        await flushMicrotasks()
        expect(callService).not.toHaveBeenCalled()
        expect(result.current.recovery).toBe(true)

        await act(async () => {
          setMockConnectionStatus('connected')
          await Promise.resolve()
        })
        expect(callService).toHaveBeenCalledTimes(1)
        unmount()
      } finally {
        setMockConnectionStatus('connected')
        mockState.helpers.callService = originalCallService
      }
    },
  )

  it('coalesces simultaneous connection and service readiness signals into one recovery call', async () => {
    const originalCallService = mockState.helpers.callService
    let resolveRequest: ((value: unknown) => void) | undefined
    let attempts = 0
    let active = 0
    let maximumActive = 0
    mockState.helpers.callService = (params) => {
      if (params.domain !== 'evershelf' || params.service !== 'recipe_query') return originalCallService(params)
      attempts += 1
      active += 1
      maximumActive = Math.max(maximumActive, active)
      return new Promise((resolve) => {
        resolveRequest = (value) => {
          active -= 1
          resolve(value)
        }
      })
    }
    setMockConnectionStatus('disconnected')

    let unmount: (() => void) | undefined
    try {
      const rendered = renderHook(() => useRecipeCollection(criteria()))
      unmount = rendered.unmount
      await flushMicrotasks()
      expect(rendered.result.current.recovery).toBe(true)
      expect(attempts).toBe(0)

      await act(async () => {
        setMockConnectionStatus('connected')
        setMockRecipeQueryAvailable(true)
        await Promise.resolve()
      })
      expect(attempts).toBe(1)
      expect(maximumActive).toBe(1)

      await act(async () => resolveRequest?.(browse([rawCard(3)])))
      await waitFor(() => expect(rendered.result.current.criteriaPhase).toBe('idle'))
    } finally {
      unmount?.()
      act(() => {
        setMockRecipeQueryAvailable(false)
        setMockConnectionStatus('connected')
      })
      mockState.helpers.callService = originalCallService
    }
  })

  it('defers hidden recovery until visibility is restored and keeps preload inert', async () => {
    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    const originalCallService = mockState.helpers.callService
    const callService = vi.fn((params: Record<string, unknown>) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? Promise.resolve(browse([rawCard(1)]))
        : originalCallService(params)
    ))
    mockState.helpers.callService = callService
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    try {
      const hidden = renderHook(() => useRecipeCollection(criteria()))
      await flushMicrotasks()
      expect(callService).not.toHaveBeenCalled()
      expect(hidden.result.current.recovery).toBe(true)

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await Promise.resolve()
      })
      expect(callService).toHaveBeenCalledTimes(1)
      hidden.unmount()

      const addEventListener = vi.spyOn(document, 'addEventListener')
      vi.useFakeTimers()
      const preload = renderHook(() => useRecipeCollection(criteria(), { preload: true }))
      expect(preload.result.current.initialResolved).toBe(true)
      expect(addEventListener.mock.calls.some(([event]) => event === 'visibilitychange')).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
      preload.unmount()
      addEventListener.mockRestore()
      vi.useRealTimers()
    } finally {
      mockState.helpers.callService = originalCallService
      if (originalVisibilityDescriptor) Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor)
      else Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    }
  })

  it('cancels a pending recovery timer when the generation is replaced or unmounted', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ message: 'Service evershelf.recipe_query not found', success: false }),
      ok: false,
      status: 503,
    })))
    let attempts = 0
    mockState.helpers.callService = (params) => {
      if (params.domain !== 'evershelf' || params.service !== 'recipe_query') return originalCallService(params)
      attempts += 1
      return Promise.reject(new Error('Service evershelf.recipe_query not found'))
    }

    try {
      const { rerender, unmount } = renderHook(({ value }) => useRecipeCollection(value), {
        initialProps: { value: criteria('first') },
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(attempts).toBe(1)
      rerender({ value: criteria('second') })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(attempts).toBe(2)
      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_RECOVERY_RETRY_MS)
      })
      expect(attempts).toBe(2)
    } finally {
      vi.unstubAllGlobals()
      globalThis.fetch = originalFetch
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('loads 50 then 50, deduplicates, prevents duplicate flights, exhausts, and retries a failed page', async () => {
    let pageAttempts = 0
    let resolvePage: ((value: unknown) => void) | undefined
    let rejectPage: ((reason?: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    const firstItems = Array.from({ length: 50 }, (_, index) => rawCard(index + 1))
    const secondItems = [rawCard(50), ...Array.from({ length: 49 }, (_, index) => rawCard(index + 51))]
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        const cursor = (params.serviceData as { cursor?: string }).cursor
        if (!cursor) return Promise.resolve(browse(firstItems, { cursor: 'page-2', hasMore: true, total: 99 }))
        pageAttempts += 1
        return new Promise((resolve, reject) => {
          resolvePage = resolve
          rejectPage = reject
        })
      }
      return originalCallService(params)
    }

    try {
      const { result } = renderHook(() => useRecipeCollection(criteria()))
      await waitFor(() => expect(result.current.criteriaPhase).toBe('idle'))
      expect(result.current.items).toHaveLength(50)

      act(() => {
        result.current.loadNextPage()
        result.current.loadNextPage()
      })
      expect(pageAttempts).toBe(1)
      await act(async () => rejectPage?.(new Error('Page failed')))
      await waitFor(() => expect(result.current.nextPageError).toBe('Page failed'))
      expect(result.current.items).toHaveLength(50)
      expect(result.current.nextPageRevision).toBe(1)

      act(() => result.current.retryNextPage())
      expect(pageAttempts).toBe(2)
      await act(async () => resolvePage?.(browse(secondItems, { hasMore: false, total: 99 })))
      await waitFor(() => expect(result.current.nextPageLoading).toBe(false))
      expect(result.current.items).toHaveLength(99)
      expect(result.current.hasMore).toBe(false)
      expect(result.current.nextPageRevision).toBe(2)
      expect(result.current.announcement).toContain('49 more recipes loaded; 99 total.')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('starts hydration only after local display and settle, appends without replacing, and ignores stale hydration', async () => {
    vi.useFakeTimers()
    let resolveHydration: ((value: unknown) => void) | undefined
    const calls: Record<string, unknown>[] = []
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        const q = String((params.serviceData as { q?: string }).q ?? '')
        return Promise.resolve(browse([rawCard(q === 'tomato' ? 1 : 2)]))
      }
      if (params.domain === 'evershelf' && params.service === 'recipe_hydration') {
        return new Promise((resolve) => {
          resolveHydration = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      const { result, rerender } = renderHook(({ value }) => useRecipeCollection(value), { initialProps: { value: criteria('tomato') } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(result.current.criteriaPhase).toBe('idle')
      expect(result.current.items.map((item) => item.id)).toEqual([1])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_HYDRATION_SETTLE_MS)
      })
      expect(calls.filter((call) => call.service === 'recipe_hydration')).toHaveLength(1)

      rerender({ value: criteria('potato') })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(result.current.items.map((item) => item.id)).toEqual([2])

      await act(async () => resolveHydration?.({
        response: {
          search_id: 'stale-search',
          status: 'complete',
          exhausted: true,
          new_items: [rawCard(99)],
        },
      }))
      expect(result.current.items.map((item) => item.id)).toEqual([2])
    } finally {
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('does not hydrate a short query and keeps local results after hydration failure', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    const hydration = vi.fn(() => Promise.reject(new Error('Remote failed')))
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') return Promise.resolve(browse([rawCard(1)]))
      if (params.domain === 'evershelf' && params.service === 'recipe_hydration') return hydration(params)
      return originalCallService(params)
    }
    try {
      const short = renderHook(() => useRecipeCollection(criteria('ab')))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(short.result.current.criteriaPhase).toBe('idle')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_HYDRATION_SETTLE_MS + 40)
      })
      expect(hydration).not.toHaveBeenCalled()
      short.unmount()

      const long = renderHook(() => useRecipeCollection(criteria('abcd')))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(long.result.current.criteriaPhase).toBe('idle')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RECIPE_HYDRATION_SETTLE_MS)
      })
      expect(long.result.current.hydrationState).toBe('error')
      expect(long.result.current.items.map((item) => item.id)).toEqual([1])
    } finally {
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('handles an immediate criteria rejection before the exit transition completes', async () => {
    const originalCallService = mockState.helpers.callService
    const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault())
    let requests = 0
    window.addEventListener('unhandledrejection', unhandled)
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        requests += 1
        return requests === 1
          ? Promise.resolve(browse([rawCard(1)]))
          : Promise.reject(new Error('Fast criteria failure'))
      }
      return originalCallService(params)
    }

    try {
      const { result, rerender } = renderHook(
        ({ value }) => useRecipeCollection(value),
        { initialProps: { value: criteria('first') } },
      )
      await waitFor(() => expect(result.current.criteriaPhase).toBe('idle'))
      rerender({ value: criteria('second') })
      await waitFor(() => expect(result.current.error).toBe('Fast criteria failure'))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('unhandledrejection', unhandled)
      mockState.helpers.callService = originalCallService
    }
  })

  it('resets the Page scroller when committed sort or filter criteria change', async () => {
    const scroller = document.createElement('div')
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 640,
    })
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      scroller.scrollTop = Number(top ?? 0)
    })
    Object.defineProperty(scroller, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageScrollerContext.Provider value={{ current: scroller }}>
        <PageScrollToTopContext.Provider value={() => scrollTo({ behavior: 'auto', top: 0 })}>
          {children}
        </PageScrollToTopContext.Provider>
      </PageScrollerContext.Provider>
    )
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? Promise.resolve(browse([rawCard(1)]))
        : originalCallService(params)
    )

    try {
      const { result, rerender } = renderHook(
        ({ value }) => useRecipeCollection(value),
        { initialProps: { value: criteria() }, wrapper },
      )
      await waitFor(() => expect(result.current.criteriaPhase).toBe('idle'))
      scroller.scrollTop = 640
      rerender({ value: { ...criteria(), sort: 'expiry' as const } })
      expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 0 })
      expect(scroller.scrollTop).toBe(0)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })
})
