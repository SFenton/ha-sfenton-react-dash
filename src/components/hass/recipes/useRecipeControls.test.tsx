import { act, renderHook, waitFor } from '@testing-library/react'
import { useRecipeControls } from './useRecipeControls'

describe('useRecipeControls', () => {
  it('closes transient sheets when the Recipes route is disabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useRecipeControls('recipes', enabled),
      { initialProps: { enabled: true } },
    )

    act(() => result.current.openSortSheet())
    expect(result.current.sortOpen).toBe(true)

    rerender({ enabled: false })
    await waitFor(() => expect(result.current.sortOpen).toBe(false))
    expect(result.current.sort).toBe('availability')
  })

  it('commits a pending visible search before the route is disabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useRecipeControls('recipes', enabled),
      { initialProps: { enabled: true } },
    )

    act(() => result.current.setSearchQuery('tomato'))
    expect(result.current.criteria.q).toBe('')
    rerender({ enabled: false })

    await waitFor(() => expect(result.current.criteria.q).toBe('tomato'))
    rerender({ enabled: true })
    expect(result.current.searchQuery).toBe('tomato')
    expect(result.current.criteria.q).toBe('tomato')
  })
})
