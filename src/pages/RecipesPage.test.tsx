import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockState, resetMockHass, setMockConnectionStatus } from '../test/mocks/hakitCoreState'
import { useRecipeControls } from '../components/hass/recipes/useRecipeControls'
import { DASHBOARD_LOADING_EXIT_MS, DASHBOARD_MIN_LOADING_MS, DASHBOARD_PAGE_LOAD_TIMEOUT_MS } from '../constants/loading'
import { RecipesPage } from './RecipesPage'

function rawCard(id: number) {
  return {
    id,
    dedupe_key: `recipe:${id}`,
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

function Harness({ initiallyAppGated = false, onInitialResolved, preload = false }: { initiallyAppGated?: boolean; onInitialResolved?: () => void; preload?: boolean }) {
  const controls = useRecipeControls('recipes-test', !preload)
  return <RecipesPage controls={controls} initiallyAppGated={initiallyAppGated} onInitialResolved={onInitialResolved} preload={preload} />
}

describe('RecipesPage', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('performs zero recipe calls and image loads during preload', () => {
    const originalCallService = mockState.helpers.callService
    const callService = vi.fn(originalCallService)
    mockState.helpers.callService = callService
    try {
      const { container } = render(<Harness preload />)
      expect(container.querySelector('[data-recipes-preload="true"]')).toBeInTheDocument()
      expect(container.querySelector('img')).toBeNull()
      expect(callService).not.toHaveBeenCalled()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reports readiness without mounting a second page gate when the app gate owns initial loading', async () => {
    const onInitialResolved = vi.fn()
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? Promise.resolve({ response: { items: [rawCard(1)], total: 1 } })
        : originalCallService(params)
    )

    try {
      render(<Harness initiallyAppGated onInitialResolved={onInitialResolved} />)
      expect(screen.queryByRole('status', { name: 'Loading Recipes' })).not.toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'Loading recipes' })).toBeInTheDocument()
      await screen.findByRole('button', { name: 'Open Recipe 1 recipe details' })
      await waitFor(() => expect(onInitialResolved).toHaveBeenCalledTimes(1))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps the page gate visible until the initial recipes resolve', async () => {
    vi.useFakeTimers()
    let resolveInitial: ((value: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return new Promise((resolve) => {
          resolveInitial = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      const { container } = render(<Harness />)
      expect(screen.getByRole('status', { name: 'Loading Recipes' })).toBeInTheDocument()
      expect(container.querySelector('[data-content-visible="false"]')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open Recipe 1 recipe details' })).not.toBeInTheDocument()

      await act(async () => {
        await Promise.resolve()
      })
      await act(async () => {
        resolveInitial?.({ response: { items: [rawCard(1)], total: 1 } })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      expect(screen.getByRole('status', { name: 'Loading Recipes' })).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_MIN_LOADING_MS + DASHBOARD_LOADING_EXIT_MS)
      })

      expect(screen.queryByRole('status', { name: 'Loading Recipes' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open Recipe 1 recipe details' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('shows the terminal error title once without exposing backend diagnostics', async () => {
    vi.useFakeTimers()
    let rejectInitial: ((reason?: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return new Promise((_, reject) => {
          rejectInitial = reject
        })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      expect(screen.queryByText('Initial recipe failure')).not.toBeInTheDocument()

      await act(async () => {
        await Promise.resolve()
      })
      await act(async () => {
        rejectInitial?.(new Error('Initial recipe failure'))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      expect(screen.getByRole('status', { name: 'Loading Recipes' })).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_MIN_LOADING_MS + DASHBOARD_LOADING_EXIT_MS)
      })

      expect(screen.queryByRole('status', { name: 'Loading Recipes' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('heading', { name: 'Unable to Load Recipes' })).toHaveLength(1)
      expect(screen.queryByText('Initial recipe failure')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps recovery on one loading status without terminal error controls', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? Promise.resolve({ response: { items: [rawCard(1)], total: 1 } })
        : originalCallService(params)
    )
    setMockConnectionStatus('disconnected')

    try {
      render(<Harness initiallyAppGated />)
      const loading = screen.getByRole('status', { name: 'Loading recipes' })
      expect(loading).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Unable to Load Recipes' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
      expect(loading.closest('[data-recovery="true"]')).toHaveAttribute('aria-busy', 'true')

      await act(async () => {
        setMockConnectionStatus('connected')
        await Promise.resolve()
      })
      await screen.findByRole('button', { name: 'Open Recipe 1 recipe details' })
      expect(screen.queryByRole('status', { name: 'Loading recipes' })).not.toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reveals the recipes results spinner after the default page timeout', async () => {
    vi.useFakeTimers()
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? new Promise(() => undefined)
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          DASHBOARD_PAGE_LOAD_TIMEOUT_MS + DASHBOARD_LOADING_EXIT_MS + 1,
        )
      })

      expect(screen.queryByRole('status', { name: 'Loading Recipes' })).not.toBeInTheDocument()
      const loading = screen.getByRole('status', { name: 'Loading recipes' })
      expect(loading).toBeInTheDocument()
      expect(loading.closest('[data-criteria-phase]')).toHaveAttribute('aria-busy', 'true')
    } finally {
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
  })

  it('freezes prior height and exposes exiting, loading, spinner-exiting, and entering phases', async () => {
    let resolveSecond: ((value: unknown) => void) | undefined
    let requestCount = 0
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        requestCount += 1
        if (requestCount === 1) return Promise.resolve({ response: { items: [rawCard(1)], total: 1 } })
        return new Promise((resolve) => {
          resolveSecond = resolve
        })
      }
      return originalCallService(params)
    }

    function SearchHarness() {
      const controls = useRecipeControls('transition-test')
      return (
        <>
          <button onClick={() => controls.setSearchQuery('tomato')} type="button">Search tomato</button>
          <RecipesPage controls={controls} />
        </>
      )
    }

    try {
      const { container } = render(<SearchHarness />)
      await screen.findByRole('button', { name: 'Open Recipe 1 recipe details' })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Search tomato' }))
        await new Promise((resolve) => window.setTimeout(resolve, 270))
      })

      await waitFor(() => expect(container.querySelector('[data-criteria-phase="exiting"]')).toBeInTheDocument())
      expect(container.querySelector('[data-height-frozen="true"]')).toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('status', { name: 'Loading recipes' })).toBeInTheDocument())

      await act(async () => resolveSecond?.({ response: { items: [rawCard(2)], total: 1 } }))
      await waitFor(() => expect(container.querySelector('[data-criteria-phase="spinner-exiting"]')).toBeInTheDocument())
      await waitFor(() => expect(container.querySelector('[data-criteria-phase="entering"]')).toBeInTheDocument())
      await screen.findByRole('button', { name: 'Open Recipe 2 recipe details' })
      await waitFor(() => expect(container.querySelector('[data-criteria-phase="idle"]')).toBeInTheDocument())
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })
})
