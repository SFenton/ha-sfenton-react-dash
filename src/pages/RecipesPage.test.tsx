import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockState, resetMockHass } from '../test/mocks/hakitCoreState'
import { useRecipeControls } from '../components/hass/recipes/useRecipeControls'
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

function Harness({ preload = false }: { preload?: boolean }) {
  const controls = useRecipeControls('recipes-test', !preload)
  return <RecipesPage controls={controls} preload={preload} />
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
      await screen.findByRole('article', { name: 'Recipe 1' })
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
      await screen.findByRole('article', { name: 'Recipe 2' })
      await waitFor(() => expect(container.querySelector('[data-criteria-phase="idle"]')).toBeInTheDocument())
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })
})
