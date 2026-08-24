import { act, render, screen } from '@testing-library/react'
import { mockState, resetMockHass } from '../test/mocks/hakitCoreState'
import { DASHBOARD_LOADING_EXIT_MS, DASHBOARD_MIN_LOADING_MS, DASHBOARD_PAGE_LOAD_TIMEOUT_MS } from '../constants/loading'
import { FoodHubPage } from './FoodHubPage'

function recommendationCard(id: number) {
  return {
    id,
    dedupe_key: `recipe:${id}`,
    title: `Recipe ${id}`,
    image_url: null,
    thumbnail_url: null,
    source: 'Test',
    coverage: 1,
    matched_required: 1,
    required_total: 1,
    expiry_score: 0,
    score: 1,
    cookable: true,
  }
}

describe('FoodHubPage loading gate', () => {
  beforeEach(() => {
    resetMockHass()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps preload inert with no recipe calls, images, modal, timers, or observers', () => {
    const originalCallService = mockState.helpers.callService
    const callService = vi.fn(originalCallService)
    mockState.helpers.callService = callService
    try {
      const { container } = render(<FoodHubPage onNavigate={() => undefined} preload />)
      expect(container.querySelectorAll('[data-recipe-placeholder]')).toHaveLength(30)
      expect(container.querySelector('img')).toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(callService).not.toHaveBeenCalled()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps the All Recipes navigation section full-span', () => {
    const { container } = render(<FoodHubPage onNavigate={() => undefined} preload />)
    expect(screen.getByRole('region', { name: 'All Recipes' }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    expect(container.querySelector('[data-responsive-section-grid="true"]')).toBeInTheDocument()
  })

  it('keeps the standard page loader until recommendations settle and fades it out', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? Promise.resolve({
          response: {
            kind: 'recommendations',
            items: Array.from({ length: 30 }, (_, index) => recommendationCard(index + 1)),
          },
        })
        : originalCallService(params)
    )

    try {
      const { container } = render(<FoodHubPage onNavigate={() => undefined} />)
      expect(screen.getByRole('status', { name: 'Loading Food & Recipes' })).toHaveAttribute('data-state', 'loading')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_MIN_LOADING_MS - 1)
      })
      expect(container.querySelector('[data-page-load-phase="loading"]')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_LOADING_EXIT_MS + 2)
      })
      expect(screen.queryByRole('status', { name: 'Loading Food & Recipes' })).not.toBeInTheDocument()
      expect(container.querySelector('[data-page-load-phase="content"]')).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('releases the page after the default timeout when recommendations never settle', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_query'
        ? new Promise(() => undefined)
        : originalCallService(params)
    )

    try {
      const { container } = render(<FoodHubPage onNavigate={() => undefined} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          DASHBOARD_PAGE_LOAD_TIMEOUT_MS + DASHBOARD_LOADING_EXIT_MS + 1,
        )
      })
      expect(container.querySelector('[data-page-load-phase="content"]')).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })
})
