import { useCallback, useState } from 'react'
import { useHass } from '@hakit/core'
import { GlassTile } from '../components/core/GlassTile'
import { SectionHeader } from '../components/core/SectionHeader'
import { RecipeDetailModal } from '../components/hass/recipes/RecipeDetailModal'
import { SuggestedRecipeCarousel, type RecommendationLoadState } from '../components/hass/recipes/SuggestedRecipeCarousel'
import { useRecipeDetailModalController } from '../components/hass/recipes/useRecipeDetailModal'
import { DashboardPageLoadGate } from '../components/shell/DashboardPageLoadGate'
import type { EntityActionStateMap } from '../components/hass/entityActions'
import { EVERSHELF_FOOD_SPACES, allFoodSubtitle, groceryPlaceSubtitle } from '../constants/everShelfFood'
import { HOME_ALL_FOOD_ROUTE_PATH, HOME_RECIPES_ROUTE_PATH } from '../constants/routes'
import { useCopy } from '../i18n'
import styles from './FoodHubPage.module.css'

interface FoodHubPageProps {
  onNavigate: (path: string) => void
  preload?: boolean
}

export function FoodHubPage({ onNavigate, preload = false }: FoodHubPageProps) {
  const copy = useCopy('pageFood')
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const recipeDetail = useRecipeDetailModalController({ enabled: !preload })
  const [carouselLoadState, setCarouselLoadState] = useState<'loading' | RecommendationLoadState>(
    preload ? 'ready' : 'loading',
  )
  const navigate = (path: string) => preload ? undefined : () => onNavigate(path)
  const handleCarouselLoadState = useCallback((state: RecommendationLoadState) => {
    setCarouselLoadState(state)
  }, [])

  return (
    <>
      <DashboardPageLoadGate
        contentClassName={styles.stack}
        label={copy('loading')}
        preload={preload}
        settled={carouselLoadState !== 'loading'}
      >
        <section className={`${styles.section} ${styles.leadingSection}`} data-manual-surface="food-suggested-recipes" id="section-suggested-recipes">
          <SectionHeader title={copy('sections.suggestedRecipes')} />
          <SuggestedRecipeCarousel onLoadStateChange={handleCarouselLoadState} onOpenRecipe={recipeDetail.openRecipe} preload={preload} />
        </section>

        <section aria-label={copy('sections.allRecipes')} className={styles.fullWidthTile}>
          <GlassTile
            backgroundColor="rgba(42, 126, 180, 0.72)"
            disclosure
            disclosureKind="navigation"
            icon="mdi:book-open-page-variant"
            onClick={navigate(HOME_RECIPES_ROUTE_PATH)}
            title={copy('sections.allRecipes')}
          />
        </section>

        <section className={styles.section} id="section-all-food">
          <SectionHeader title={copy('sections.allFood')} />
          <div className={styles.grid}>
            <GlassTile
              backgroundColor="rgba(88, 128, 94, 0.72)"
              icon="mdi:food-variant"
              onClick={navigate(HOME_ALL_FOOD_ROUTE_PATH)}
              subtitle={allFoodSubtitle(entities)}
              title={copy('sections.allFood')}
            />
          </div>
        </section>

        <section className={styles.section} id="section-food-spaces">
          <SectionHeader title={copy('sections.foodSpaces')} />
          <div className={styles.grid}>
            {EVERSHELF_FOOD_SPACES.map((place) => (
              <GlassTile
                backgroundColor={`rgba(${place.color.r}, ${place.color.g}, ${place.color.b}, 0.72)`}
                icon={place.icon}
                key={place.location}
                onClick={navigate(place.routePath)}
                subtitle={groceryPlaceSubtitle(entities, place.entityId, place.location)}
                title={place.title}
              />
            ))}
          </div>
        </section>
      </DashboardPageLoadGate>
      {!preload && <RecipeDetailModal controller={recipeDetail} />}
    </>
  )
}
