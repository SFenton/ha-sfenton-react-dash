import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { SuggestedRecipeCarousel } from './SuggestedRecipeCarousel'
import { mockState, resetMockHass } from '../../../test/mocks/hakitCoreState'

function recommendationCard(id: number) {
  return {
    id,
    dedupe_key: `test:${id}`,
    title: `Test Recipe ${id}`,
    image_url: null,
    thumbnail_url: null,
    source: 'Test Source',
    coverage: 80,
    matched_required: 8,
    required_total: 10,
    expiry_score: 5,
    score: 90,
    cookable: true,
  }
}

describe('SuggestedRecipeCarousel', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('preloads exactly five by six inert slots with no service calls or images', () => {
    const callService = vi.fn(mockState.helpers.callService)
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = callService
    try {
      const { container } = render(<SuggestedRecipeCarousel preload />)
      expect(container.querySelectorAll('[data-carousel-page]')).toHaveLength(5)
      expect(container.querySelectorAll('[data-carousel-card]')).toHaveLength(30)
      expect(container.querySelectorAll('[data-recipe-placeholder]')).toHaveLength(30)
      expect(container.querySelector('img')).toBeNull()
      expect(callService).not.toHaveBeenCalled()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('preserves five-page geometry when the backend returns too few items and keeps cards inert', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return Promise.resolve({ response: { kind: 'recommendations', items: Array.from({ length: 4 }, (_, index) => recommendationCard(index + 1)) } })
      }
      return originalCallService(params)
    }
    try {
      const { container } = render(<SuggestedRecipeCarousel />)
      await screen.findByRole('article', { name: 'Test Recipe 1' })
      expect(container.querySelectorAll('[data-carousel-page]')).toHaveLength(5)
      expect(container.querySelectorAll('[data-carousel-card]')).toHaveLength(30)
      expect(container.querySelectorAll('[data-recipe-placeholder]')).toHaveLength(26)
      expect(screen.getAllByRole('article')).toHaveLength(4)
      expect(screen.queryByText(/% match/)).not.toBeInTheDocument()
      expect(container.querySelectorAll('button [data-recipe-card], a [data-recipe-card]')).toHaveLength(0)
      for (const article of screen.getAllByRole('article')) {
        expect(article).not.toHaveAttribute('tabindex')
      }
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('exposes five dot buttons, keyboard navigation, and reduced-motion auto scrolling', async () => {
    const originalMatchMedia = window.matchMedia
    const scrollTo = vi.fn()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
    try {
      const { container } = render(<SuggestedRecipeCarousel preload />)
      const track = screen.getByRole('region', { name: 'Suggested recipes' })
      const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-carousel-page]'))
      pages.forEach((page, index) => Object.defineProperty(page, 'offsetLeft', { configurable: true, value: index * 345 }))
      const dots = within(screen.getByRole('group', { name: 'Suggested recipes pages' })).getAllByRole('button')
      expect(dots).toHaveLength(5)
      expect(dots[0]).toHaveAttribute('aria-current', 'page')

      fireEvent.keyDown(track, { key: 'ArrowRight' })
      expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', left: 345, top: 0 })
      expect(dots[1]).toHaveAttribute('aria-current', 'page')

      fireEvent.click(dots[4])
      await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', left: 1_380, top: 0 }))
      expect(dots[4]).toHaveAttribute('aria-current', 'page')
    } finally {
      window.matchMedia = originalMatchMedia
      delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo
    }
  })

  it('uses three desktop pages with five columns and two rows', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 900px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    try {
      const { container } = render(<SuggestedRecipeCarousel />)
      await screen.findByRole('article', { name: 'Ang Chow Chicken (Red Fermented Rice Wine Chicken)' })
      const pages = Array.from(container.querySelectorAll('[data-carousel-page]'))
      expect(pages).toHaveLength(3)
      pages.forEach((page) => expect(page.querySelectorAll('[data-carousel-card]')).toHaveLength(10))
      expect(container.querySelector('[data-card-carousel]')).toHaveAttribute('data-columns', '5')
      expect(within(screen.getByRole('group', { name: 'Suggested recipes pages' })).getAllByRole('button')).toHaveLength(3)
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
