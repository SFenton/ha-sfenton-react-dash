import { ImageCard } from '../../core/ImageCard'
import type { RecipeCardSummary } from './recipeTypes'
import styles from './RecipeCard.module.css'

interface RecipeCardProps {
  compact?: boolean
  eager?: boolean
  recipe: RecipeCardSummary
}

export function RecipeCard({ compact = false, eager = false, recipe }: RecipeCardProps) {
  const ingredientCoverage = `${recipe.matchedRequired}/${recipe.requiredTotal} ingredients`

  return (
    <div
      className={styles.item}
      data-dedupe-key={recipe.dedupeKey}
      data-recipe-card="true"
      role="listitem"
    >
      <ImageCard
        fallbackImageUrl={recipe.imageUrl}
        imageUrl={recipe.thumbnailUrl ?? recipe.imageUrl}
        loading={eager ? 'eager' : 'lazy'}
        subtitle={compact ? undefined : ingredientCoverage}
        title={recipe.title}
      />
    </div>
  )
}
