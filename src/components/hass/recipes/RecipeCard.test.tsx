import { fireEvent, render, screen, within } from '@testing-library/react'
import { RecipeCard } from './RecipeCard'
import type { RecipeCardSummary } from './recipeTypes'

const recipe: RecipeCardSummary = {
  id: 1,
  dedupeKey: 'recipe:1',
  title: 'Chicken Dinner',
  imageUrl: null,
  thumbnailUrl: null,
  source: 'Cookidoo',
  sourceUrl: null,
  coverage: 80,
  matchedRequired: 8,
  requiredTotal: 10,
  expiryScore: 0.4,
  soonestExpiryDays: 3,
  score: 0.8,
  cookable: false,
}

describe('RecipeCard', () => {
  it('keeps ingredient coverage inside the image card and renders no below-card metadata', () => {
    const { container } = render(<RecipeCard onOpenRecipe={() => undefined} recipe={recipe} />)
    const imageCard = screen.getByRole('button', { name: 'Open Chicken Dinner recipe details' })

    expect(within(imageCard).getByText('8/10 ingredients')).toBeInTheDocument()
    expect(screen.queryByText(/% match/)).not.toBeInTheDocument()
    expect(screen.queryByText('Cookidoo')).not.toBeInTheDocument()
    expect(screen.queryByText('Expires in 3d')).not.toBeInTheDocument()
    expect(container.querySelector('[data-recipe-card]')?.children).toHaveLength(1)
  })

  it('keeps compact carousel cards title-only', () => {
    render(<RecipeCard compact onOpenRecipe={() => undefined} recipe={recipe} />)
    expect(screen.getByRole('button', { name: 'Open Chicken Dinner recipe details' })).toBeInTheDocument()
    expect(screen.queryByText('8/10 ingredients')).not.toBeInTheDocument()
  })

  it('uses a native keyboard-accessible button, activates once, and sends no image referrer', () => {
    const onOpenRecipe = vi.fn()
    render(
      <RecipeCard
        onOpenRecipe={onOpenRecipe}
        recipe={{ ...recipe, imageUrl: 'https://example.test/recipe.jpg' }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Open Chicken Dinner recipe details' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).not.toHaveAttribute('aria-pressed')
    fireEvent.click(button)
    expect(onOpenRecipe).toHaveBeenCalledTimes(1)
    expect(onOpenRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    expect(document.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer')
  })
})
