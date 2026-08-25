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
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('preserves five-page geometry and exposes accessible card activation when the backend returns too few items', async () => {
    const originalCallService = mockState.helpers.callService
    const onOpenRecipe = vi.fn()
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return Promise.resolve({ response: { kind: 'recommendations', items: Array.from({ length: 4 }, (_, index) => recommendationCard(index + 1)) } })
      }
      return originalCallService(params)
    }
    try {
      const { container } = render(<SuggestedRecipeCarousel onOpenRecipe={onOpenRecipe} />)
      const firstCard = await screen.findByRole('button', { name: 'Open Test Recipe 1 recipe details' })
      expect(container.querySelectorAll('[data-carousel-page]')).toHaveLength(5)
      expect(container.querySelectorAll('[data-carousel-card]')).toHaveLength(30)
      expect(container.querySelectorAll('[data-recipe-placeholder]')).toHaveLength(26)
      expect(screen.getAllByRole('button', { name: /Open Test Recipe \d recipe details/ })).toHaveLength(4)
      expect(screen.queryByText(/% match/)).not.toBeInTheDocument()
      expect(container.querySelectorAll('button [data-recipe-card], a [data-recipe-card]')).toHaveLength(0)
      fireEvent.click(firstCard)
      expect(onOpenRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('does not report ready until every carousel image has settled', async () => {
    const originalCallService = mockState.helpers.callService
    const onLoadStateChange = vi.fn()
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        return Promise.resolve({
          response: {
            kind: 'recommendations',
            items: [1, 2].map((id) => ({
              ...recommendationCard(id),
              image_url: `https://example.test/recipe-${id}.jpg`,
            })),
          },
        })
      }
      return originalCallService(params)
    }

    try {
      const { container } = render(
        <SuggestedRecipeCarousel onLoadStateChange={onLoadStateChange} />,
      )
      await screen.findByRole('button', { name: 'Open Test Recipe 1 recipe details' })
      expect(onLoadStateChange).not.toHaveBeenCalledWith('ready')
      const images = Array.from(container.querySelectorAll('img'))
      expect(images).toHaveLength(2)
      images.forEach((image) => {
        Object.defineProperty(image, 'complete', { configurable: true, value: true })
        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 584 })
        fireEvent.load(image)
      })
      await waitFor(() => expect(onLoadStateChange).toHaveBeenCalledWith('ready'))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('exposes compact dots and wraps keyboard and touch navigation at both boundaries', async () => {
    const originalMatchMedia = window.matchMedia
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
    try {
      const { container } = render(<SuggestedRecipeCarousel preload />)
      const track = screen.getByRole('region', { name: 'Suggested recipes' })
      const carousel = container.querySelector('[data-card-carousel]')
      const dots = within(screen.getByRole('group', { name: 'Suggested recipes pages' })).getAllByRole('button')
      expect(dots).toHaveLength(5)
      expect(dots[0]).toHaveAttribute('aria-current', 'page')
      dots[0].focus()
      fireEvent.pointerUp(dots[0])
      expect(dots[0]).not.toHaveFocus()

      fireEvent.keyDown(track, { key: 'ArrowLeft' })
      expect(dots[4]).toHaveAttribute('aria-current', 'page')
      expect(carousel).toHaveAttribute('data-active-page', '5')

      fireEvent.keyDown(track, { key: 'ArrowRight' })
      expect(dots[0]).toHaveAttribute('aria-current', 'page')

      fireEvent.keyDown(track, { key: 'ArrowRight' })
      expect(dots[1]).toHaveAttribute('aria-current', 'page')

      fireEvent.click(dots[4])
      await waitFor(() => expect(carousel).toHaveAttribute('data-active-page', '5'))
      expect(dots[4]).toHaveAttribute('aria-current', 'page')

      fireEvent.touchStart(track, { touches: [{ clientX: 180 }] })
      fireEvent.touchEnd(track, { changedTouches: [{ clientX: 80 }] })
      expect(dots[0]).toHaveAttribute('aria-current', 'page')

      fireEvent.touchStart(track, { touches: [{ clientX: 80 }] })
      fireEvent.touchEnd(track, { changedTouches: [{ clientX: 180 }] })
      expect(dots[4]).toHaveAttribute('aria-current', 'page')
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('measures the desktop container before issuing one correctly sized recommendation request', async () => {
    const originalMatchMedia = window.matchMedia
    const originalCallService = mockState.helpers.callService
    const recommendationCalls: Record<string, unknown>[] = []
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1_440 })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.dataset.recommendationStatus !== undefined || this.dataset.cardCarousel === 'true') return 1_192
      return 0
    })
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
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'recipe_query') {
        recommendationCalls.push(params)
        return Promise.resolve({
          response: {
            kind: 'recommendations',
            items: Array.from({ length: 60 }, (_, index) => recommendationCard(index + 1)),
          },
        })
      }
      return originalCallService(params)
    }

    try {
      const { container } = render(<SuggestedRecipeCarousel />)
      await screen.findByRole('button', { name: 'Open Test Recipe 1 recipe details' })
      const pages = Array.from(container.querySelectorAll('[data-carousel-page]'))
      expect(pages).toHaveLength(5)
      pages.forEach((page) => expect(page.querySelectorAll('[data-carousel-card]')).toHaveLength(12))
      expect(container.querySelector('[data-card-carousel]')).toHaveAttribute('data-columns', '6')
      expect(within(screen.getByRole('group', { name: 'Suggested recipes pages' })).getAllByRole('button')).toHaveLength(5)
      expect(recommendationCalls).toHaveLength(1)
      expect(recommendationCalls[0]).toMatchObject({
        serviceData: {
          kind: 'recommendations',
          limit: 60,
        },
      })
    } finally {
      mockState.helpers.callService = originalCallService
      window.matchMedia = originalMatchMedia
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    }
  })
})
