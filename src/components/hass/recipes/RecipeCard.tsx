import { ImageCard } from '../../core/ImageCard'
import type { RecipeCardSummary } from './recipeTypes'
import styles from './RecipeCard.module.css'

interface RecipeCardProps {
  compact?: boolean
  eager?: boolean
  onOpenRecipe: (recipe: RecipeCardSummary) => void
  recipe: RecipeCardSummary
}

export function RecipeCard({ compact = false, eager = false, onOpenRecipe, recipe }: RecipeCardProps) {
  const ingredientCoverage = `${recipe.matchedRequired}/${recipe.requiredTotal} ingredients`

  return (
    <div
      className={styles.item}
      data-dedupe-key={recipe.dedupeKey}
      data-recipe-card="true"
      role="listitem"
    >
      <ImageCard
        ariaLabel={`Open ${recipe.title} recipe details`}
        fallbackImageUrl={recipe.imageUrl}
        imageUrl={recipe.thumbnailUrl ?? recipe.imageUrl}
        loading={eager ? 'eager' : 'lazy'}
        onActivate={() => onOpenRecipe(recipe)}
        subtitle={compact ? undefined : ingredientCoverage}
        title={recipe.title}
      />
    </div>
  )
}
