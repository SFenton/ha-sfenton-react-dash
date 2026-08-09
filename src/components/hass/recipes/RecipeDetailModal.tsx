import { useMemo, useState } from 'react'
import { CheckboxRow } from '../../core/CheckboxRow'
import { EmptyState } from '../../core/EmptyState'
import { MaterialIcon } from '../../core/Icon'
import { ModalIconTabNav } from '../../core/ModalTabNav'
import { modalTabId, modalTabPanelId } from '../../core/modalTabIds'
import { ModalSheet, type ModalSheetStyle } from '../../core/ModalSheet'
import { StatusPill, type StatusPillTone } from '../../core/StatusPill'
import { useSmoothDisplayedModalTab } from '../../../hooks/useSmoothDisplayedModalTab'
import {
  type RecipeDetail,
  type RecipeDetailIngredient,
  type RecipeIngredientInventoryState,
  type RecipeInstructionGroup,
} from './recipeTypes'
import { formatRecipeDuration, formatRecipeNumber, formatRecipeYield } from './recipeDetailFormatting'
import { recipeGroceryDisabledReason } from './recipeGroceryState'
import type { RecipeDetailModalController } from './useRecipeDetailModal'
import { RECIPE_DETAIL_TABS, type RecipeDetailTab } from '../../../constants/surfaceSemantics'
import styles from './RecipeDetailModal.module.css'

type GroceryState = RecipeDetailModalController['groceryState']

const RECIPE_DETAIL_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-max-width': '720px',
  '--modal-desktop-width': '720px',
  '--modal-mobile-height': '92dvh',
  '--modal-mobile-max-height': '92dvh',
}

const RECIPE_DETAIL_TAB_ID_PREFIX = 'recipe-detail'
const RECIPE_DETAIL_TAB_PANEL_ID = modalTabPanelId(RECIPE_DETAIL_TAB_ID_PREFIX, 'content')

function formatRecipeDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function GeneralFact({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail?: string
  icon: string
  label: string
  tone?: StatusPillTone
  value: string | null
}) {
  if (!value) return null
  return <StatusPill detail={detail} grouped icon={icon} label={label} tone={tone} value={value} />
}

function RecipeDetailImage({ detail, fallbackImageUrl }: { detail: RecipeDetail; fallbackImageUrl?: string | null }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const imageUrl = [detail.images.primary, detail.images.thumbnail, fallbackImageUrl]
    .find((candidate, index, candidates): candidate is string => (
      Boolean(candidate)
      && candidates.indexOf(candidate) === index
      && !failed.has(candidate as string)
    )) ?? null

  return (
    <div className={styles.hero} data-image-state={imageUrl ? 'image' : 'fallback'}>
      {imageUrl ? (
        <img
          alt={detail.title}
          decoding="async"
          onError={() => setFailed((current) => new Set(current).add(imageUrl))}
          referrerPolicy="no-referrer"
          src={imageUrl}
        />
      ) : (
        <span aria-hidden="true" className={styles.heroFallback}>
          <MaterialIcon name="mdi:chef-hat" size={52} />
        </span>
      )}
    </div>
  )
}

function GeneralTab({ detail, fallbackImageUrl }: { detail: RecipeDetail; fallbackImageUrl?: string | null }) {
  const generalAvailable = detail.capabilities.general !== 'none'
  const source = detail.source.attribution || detail.source.label || detail.source.connector || null
  const updated = formatRecipeDate(detail.freshness.updatedAt ?? detail.freshness.retrievedAt)
  const freshness = detail.freshness.isStale === null
    ? (updated ? { value: 'Unknown', tone: 'unavailable' as const } : null)
    : {
        value: detail.freshness.isStale ? 'Stale' : 'Current',
        tone: detail.freshness.isStale ? 'warning' as const : 'ok' as const,
      }

  return (
    <div className={styles.tabStack}>
      <RecipeDetailImage detail={detail} fallbackImageUrl={fallbackImageUrl} />
      <div className={styles.statusGrid}>
        {generalAvailable && <GeneralFact icon="mdi:account-group" label="Yield" value={formatRecipeYield(detail.general.yield.quantity, detail.general.yield.unit)} />}
        {generalAvailable && <GeneralFact icon="mdi:progress-clock" label="Active Time" value={formatRecipeDuration(detail.general.activeTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:clock-outline" label="Total Time" value={formatRecipeDuration(detail.general.totalTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:gauge" label="Difficulty" value={detail.general.difficulty} />}
        {generalAvailable && <GeneralFact icon="mdi:food-fork-drink" label="Category" value={detail.general.primaryCategory} />}
        <GeneralFact icon="mdi:book-open-page-variant" label="Source" value={source} />
        <GeneralFact icon="mdi:map-marker" label="Locale" value={detail.source.locale} />
        <GeneralFact
          detail={updated ?? undefined}
          icon="mdi:progress-clock"
          label="Freshness"
          tone={freshness?.tone}
          value={freshness?.value ?? null}
        />
      </div>
      {generalAvailable && detail.general.equipment.length > 0 && (
        <section className={styles.section} aria-labelledby="recipe-additional-equipment">
          <h3 id="recipe-additional-equipment">Additional Equipment</h3>
          <ul className={styles.equipment}>
            {detail.general.equipment.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        </section>
      )}
      {detail.source.canonicalUrl && (
        <a
          className={styles.primaryAction}
          href={detail.source.canonicalUrl}
          referrerPolicy="no-referrer"
          rel="noreferrer noopener"
          target="_blank"
        >
          <MaterialIcon name="mdi:open-in-new" size={20} />
          <span>Open Source Recipe</span>
        </a>
      )}
    </div>
  )
}

function inventoryMatchLabel(ingredient: RecipeDetailIngredient) {
  if (ingredient.inventory.state === 'staple') return 'Staple'
  if (ingredient.inventory.state === 'missing') return 'Missing from inventory'
  if (ingredient.inventory.state === 'uncertain') return 'Inventory match uncertain'
  const relation = ingredient.inventory.relation?.toLowerCase() ?? ''
  if (relation === 'exact' || relation === 'normalized_name') return 'Exact inventory match'
  return 'In inventory'
}

function inventoryStatus(state: RecipeIngredientInventoryState) {
  if (state === 'missing') return 'unchecked' as const
  if (state === 'uncertain') return 'mixed' as const
  return 'checked' as const
}

function recipeAmountText(ingredient: RecipeDetailIngredient) {
  if (ingredient.amount.text) return ingredient.amount.text
  if (ingredient.amount.quantity === null) return null
  const quantity = ingredient.amount.quantityMax !== null
    ? `${formatRecipeNumber(ingredient.amount.quantity)}–${formatRecipeNumber(ingredient.amount.quantityMax)}`
    : formatRecipeNumber(ingredient.amount.quantity)
  return `${quantity}${ingredient.amount.unit ? ` ${ingredient.amount.unit}` : ''}`
}

function ingredientTitle(ingredient: RecipeDetailIngredient) {
  const amount = recipeAmountText(ingredient)
  return amount ? `${ingredient.displayName} · ${amount}` : ingredient.displayName
}

function materiallyDifferentIngredientText(sourceText: string | null, displayName: string) {
  if (!sourceText) return false
  const normalize = (value: string) => value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return normalize(sourceText) !== normalize(displayName)
}

const RECIPE_AMOUNT_UNIT_ALIASES = [
  ['tablespoon', 'tablespoons', 'tbsp', 'tbs'],
  ['teaspoon', 'teaspoons', 'tsp'],
  ['cup', 'cups', 'c'],
  ['ounce', 'ounces', 'oz'],
  ['pound', 'pounds', 'lb', 'lbs'],
  ['gram', 'grams', 'g'],
  ['kilogram', 'kilograms', 'kg'],
  ['milliliter', 'milliliters', 'ml'],
  ['liter', 'liters', 'l'],
] as const

function recipeAmountCandidates(amount: string) {
  const candidates = new Set([amount.trim()])
  const match = amount.trim().match(/^(.*\S)\s+([^\s.]+)\.?$/u)
  if (!match) return [...candidates]
  const [, quantity, rawUnit] = match
  const unit = rawUnit.toLocaleLowerCase()
  const aliases = RECIPE_AMOUNT_UNIT_ALIASES.find((group) => (
    (group as readonly string[]).includes(unit)
  ))
  aliases?.forEach((alias) => candidates.add(`${quantity} ${alias}`))
  return [...candidates].sort((left, right) => right.length - left.length)
}

function ingredientSourceDetail(ingredient: RecipeDetailIngredient) {
  if (!ingredient.sourceText) return null
  const amount = recipeAmountText(ingredient)
  let sourceText = ingredient.sourceText.trim()
  if (amount) {
    const sourceTextLower = sourceText.toLocaleLowerCase()
    for (const candidate of recipeAmountCandidates(amount)) {
      if (!sourceTextLower.startsWith(candidate.toLocaleLowerCase())) continue
      const remainder = sourceText.slice(candidate.length)
      if (!remainder || /^[\s,.;:·—–-]/u.test(remainder)) {
        sourceText = remainder.replace(/^[\s,.;:·—–-]+/u, '').trim()
        break
      }
    }
  }
  return materiallyDifferentIngredientText(sourceText, ingredient.displayName) ? sourceText : null
}

function ingredientQuantityExplanation(detail: RecipeDetail, ingredient: RecipeDetailIngredient) {
  if (
    detail.capabilities.quantities === 'display_only'
    || ingredient.inventory.quantityState === 'display_only'
  ) {
    return 'Source quantity is display-only'
  }
  if (
    detail.capabilities.quantities === 'unknown'
    || ingredient.inventory.quantityState === 'unknown'
  ) {
    return 'Quantity sufficiency is unknown'
  }
  if (ingredient.inventory.quantitySufficiency === 'insufficient') {
    return 'Inventory quantity may be insufficient'
  }
  if (ingredient.inventory.quantitySufficiency === 'unknown') {
    return 'Quantity sufficiency is unknown'
  }
  return null
}

function ingredientDetailParts(detail: RecipeDetail, ingredient: RecipeDetailIngredient) {
  const sourceDetail = ingredientSourceDetail(ingredient)
  return [
    inventoryMatchLabel(ingredient),
    ingredient.optional === true ? 'Optional' : null,
    ingredient.inventory.matchedProduct?.name
      ? `Product: ${ingredient.inventory.matchedProduct.name}`
      : null,
    sourceDetail ? `Source: ${sourceDetail}` : null,
    ingredient.closestMatch ? `Matched as ${ingredient.closestMatch.label}` : null,
    ingredientQuantityExplanation(detail, ingredient),
  ].filter((part): part is string => Boolean(part))
}

function IngredientSubtitle({ detail, ingredient }: { detail: RecipeDetail; ingredient: RecipeDetailIngredient }) {
  const state = inventoryMatchLabel(ingredient)
  const quantityExplanation = ingredientQuantityExplanation(detail, ingredient)
  const sourceDetail = ingredientSourceDetail(ingredient)
  return (
    <span className={styles.ingredientDetails}>
      <span className={styles.ingredientMetaRow}>
        <span className={styles.ingredientChip}>{state}</span>
        {ingredient.optional === true && <span className={styles.ingredientChip}>Optional</span>}
        {ingredient.inventory.matchedProduct?.name && (
          <span className={styles.ingredientChip}>Product: {ingredient.inventory.matchedProduct.name}</span>
        )}
        {quantityExplanation && <span className={styles.ingredientChip}>{quantityExplanation}</span>}
      </span>
      {sourceDetail && (
        <span className={styles.ingredientSource}>Source: {sourceDetail}</span>
      )}
      {ingredient.closestMatch && (
        <span className={styles.closestMatch}>Matched as {ingredient.closestMatch.label}</span>
      )}
    </span>
  )
}

interface IngredientSection {
  key: string
  label: string | null
  ingredients: RecipeDetailIngredient[]
  orphaned: boolean
}

function recipeIngredientSections(detail: RecipeDetail): IngredientSection[] {
  if (detail.ingredientGroups.length === 0) {
    return [{
      key: 'flat-ingredients',
      label: null,
      ingredients: detail.ingredients,
      orphaned: false,
    }]
  }

  const ingredientByKey = new Map(detail.ingredients.map((ingredient) => [ingredient.key, ingredient]))
  const groupedKeys = new Set<string>()
  const sections = detail.ingredientGroups.map((group) => {
    const ingredients = group.ingredientKeys
      .map((key) => ingredientByKey.get(key))
      .filter((ingredient): ingredient is RecipeDetailIngredient => Boolean(ingredient))
    ingredients.forEach((ingredient) => groupedKeys.add(ingredient.key))
    return {
      key: group.key,
      label: group.label,
      ingredients,
      orphaned: false,
    }
  }).filter((section) => section.ingredients.length > 0)

  const orphanedIngredients = detail.ingredients.filter((ingredient) => !groupedKeys.has(ingredient.key))
  if (orphanedIngredients.length > 0) {
    sections.push({
      key: 'other-ingredients',
      label: null,
      ingredients: orphanedIngredients,
      orphaned: true,
    })
  }
  return sections.length > 0
    ? sections
    : [{
        key: 'flat-ingredients',
        label: null,
        ingredients: detail.ingredients,
        orphaned: false,
      }]
}

function recipeSectionHeading(
  label: string | null,
  sectionIndex: number,
  sectionCount: number,
  orphaned = false,
) {
  if (label) return { label, subdued: false }
  if (orphaned) return { label: 'Other Ingredients', subdued: true }
  if (sectionCount === 1) return null
  return { label: `Section ${sectionIndex + 1}`, subdued: true }
}

function IngredientsTab({
  detail,
  groceryState,
  grocerySubmitted,
  onAddMissing,
}: {
  detail: RecipeDetail
  groceryState: GroceryState
  grocerySubmitted: boolean
  onAddMissing: () => void
}) {
  const ingredientDetailsAvailable = detail.capabilities.ingredients !== 'none'
  const disabledReason = recipeGroceryDisabledReason(detail, groceryState.status, grocerySubmitted)
  const sections = recipeIngredientSections(detail)

  return (
    <div className={styles.tabStack}>
      {ingredientDetailsAvailable && detail.ingredientsTruncated && (
        <p className={styles.notice} role="status">This ingredient list is truncated.</p>
      )}
      {ingredientDetailsAvailable && detail.ingredients.length > 0 && (
        <div className={styles.recipeGroups}>
          {sections.map((section, sectionIndex) => {
            const heading = recipeSectionHeading(
              section.label,
              sectionIndex,
              sections.length,
              section.orphaned,
            )
            return (
              <section className={styles.recipeGroup} key={section.key}>
                {heading && (
                  <h3 className={styles.recipeGroupHeading} data-subdued={heading.subdued || undefined}>
                    {heading.label}
                  </h3>
                )}
                <ol className={styles.ingredients}>
                  {section.ingredients.map((ingredient) => (
                    <li key={ingredient.key}>
                      {detail.capabilities.ingredients === 'checklist' ? (
                        <CheckboxRow
                          active={ingredient.inventory.state === 'in_stock' || ingredient.inventory.state === 'staple'}
                          alignWrappedToIconTop
                          aria-label={`${ingredientTitle(ingredient)}: ${ingredientDetailParts(detail, ingredient).join('. ')}`}
                          mode="status"
                          status={inventoryStatus(ingredient.inventory.state)}
                          subtitle={<IngredientSubtitle detail={detail} ingredient={ingredient} />}
                          title={ingredientTitle(ingredient)}
                        />
                      ) : (
                        <span className={styles.ingredientName}>
                          <strong>{ingredientTitle(ingredient)}</strong>
                          {ingredient.optional === true && <small>Optional</small>}
                          {ingredientQuantityExplanation(detail, ingredient) && (
                            <small>{ingredientQuantityExplanation(detail, ingredient)}</small>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>
      )}
      {(!ingredientDetailsAvailable || detail.ingredients.length === 0) && (
        <EmptyState description="Ingredient details are not available for this recipe." layout="modal" title="No Ingredients Available" />
      )}
      <div className={styles.groceryAction}>
        <button
          className={styles.primaryAction}
          disabled={Boolean(disabledReason)}
          onClick={onAddMissing}
          type="button"
        >
          <MaterialIcon name="mdi:plus" size={20} />
          <span>Add Missing Ingredients to Groceries</span>
        </button>
        {disabledReason && <p className={styles.actionHint}>{disabledReason}</p>}
        {groceryState.status === 'success' && <p className={styles.successFeedback} role="status">{groceryState.message}</p>}
        {groceryState.status === 'error' && <p className={styles.errorFeedback} role="alert">{groceryState.message}</p>}
      </div>
    </div>
  )
}

function recipeInstructionGroups(detail: RecipeDetail): RecipeInstructionGroup[] {
  if (detail.instructions.groups.length > 0) return detail.instructions.groups
  if (detail.instructions.steps.length === 0) return []
  return [{
    key: 'flat-instructions',
    index: 0,
    label: null,
    steps: detail.instructions.steps.map((text, index) => ({
      key: `flat-instruction-${index}`,
      index,
      number: null,
      text,
    })),
  }]
}

function InstructionsTab({ detail }: { detail: RecipeDetail }) {
  const externalUrl = detail.instructions.fallbackUrl ?? detail.source.canonicalUrl
  if (detail.capabilities.instructions === 'external_link') {
    if (!externalUrl) {
      return <EmptyState description="The external instruction link is not available." layout="modal" title="Instructions Link Unavailable" />
    }
    return (
      <div className={styles.externalInstructions}>
        <span aria-hidden="true" className={styles.externalIcon}>
          <MaterialIcon name="mdi:open-in-new" size={38} />
        </span>
        <h3>Instructions are on Cookidoo</h3>
        <p>Official Cookidoo step text stays on Cookidoo and is not stored or shown here.</p>
        <a
          className={styles.primaryAction}
          href={externalUrl}
          referrerPolicy="no-referrer"
          rel="noreferrer noopener"
          target="_blank"
        >
          <MaterialIcon name="mdi:open-in-new" size={20} />
          <span>Open in Cookidoo</span>
        </a>
      </div>
    )
  }

  const groups = recipeInstructionGroups(detail)
  if (detail.capabilities.instructions === 'local' && detail.instructions.available && groups.length > 0) {
    return (
      <div className={styles.tabStack}>
        {detail.instructions.truncated && <p className={styles.notice} role="status">These instructions are truncated.</p>}
        <div className={styles.recipeGroups}>
          {groups.map((group, groupIndex) => {
            const heading = recipeSectionHeading(group.label, groupIndex, groups.length)
            return (
              <section className={styles.recipeGroup} key={group.key}>
                {heading && (
                  <h3 className={styles.recipeGroupHeading} data-subdued={heading.subdued || undefined}>
                    {heading.label}
                  </h3>
                )}
                <ol className={styles.instructions}>
                  {group.steps.map((step) => {
                    const number = step.number ?? step.index + 1
                    return (
                      <li key={step.key} value={number}>
                        <span className={styles.instructionMarker}>{number}.</span>
                        <p>{step.text}</p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      </div>
    )
  }

  return <EmptyState description="Instructions are not available for this recipe." layout="modal" title="No Instructions Available" />
}

function RecipeDetailTabContent({
  activeTab,
  detail,
  fallbackImageUrl,
  groceryState,
  grocerySubmitted,
  onAddMissing,
}: {
  activeTab: RecipeDetailTab
  detail: RecipeDetail
  fallbackImageUrl?: string | null
  groceryState: GroceryState
  grocerySubmitted: boolean
  onAddMissing: () => void
}) {
  const { displayedTab, transitionState } = useSmoothDisplayedModalTab(activeTab)
  return (
    <div
      aria-labelledby={modalTabId(RECIPE_DETAIL_TAB_ID_PREFIX, displayedTab)}
      className={styles.tabPanel}
      data-modal-tab-transition-state={transitionState}
      id={RECIPE_DETAIL_TAB_PANEL_ID}
      role="tabpanel"
    >
      {displayedTab === 'general' && <GeneralTab detail={detail} fallbackImageUrl={fallbackImageUrl} />}
      {displayedTab === 'ingredients' && (
        <IngredientsTab
          detail={detail}
          groceryState={groceryState}
          grocerySubmitted={grocerySubmitted}
          onAddMissing={onAddMissing}
        />
      )}
      {displayedTab === 'instructions' && <InstructionsTab detail={detail} />}
    </div>
  )
}

export function RecipeDetailModal({ controller }: { controller: RecipeDetailModalController }) {
  const readyDetail = controller.detailState.status === 'ready' ? controller.detailState.detail : null
  const title = readyDetail?.title ?? controller.selectedRecipe?.title ?? 'Recipe Details'
  const footer = readyDetail
    ? (
        <ModalIconTabNav
          activeTab={controller.activeTab}
          idPrefix={RECIPE_DETAIL_TAB_ID_PREFIX}
          label={`${title} sections`}
          onTabChange={controller.setActiveTab}
          panelId={RECIPE_DETAIL_TAB_PANEL_ID}
          tabs={RECIPE_DETAIL_TABS}
        />
      )
    : undefined

  const content = useMemo(() => {
    if (controller.detailState.status === 'loading') {
      return (
        <div aria-label="Loading recipe details" className={styles.loader} role="status">
          <span aria-hidden="true" />
        </div>
      )
    }
    if (controller.detailState.status === 'unsupported') {
      return <EmptyState description={controller.detailState.message} layout="modal" title="Recipe Details Unsupported" />
    }
    if (controller.detailState.status === 'error') {
      return <EmptyState description={controller.detailState.message} layout="modal" title="Unable to Load Recipe" />
    }
    if (controller.detailState.status === 'ready') {
      return (
        <RecipeDetailTabContent
          activeTab={controller.activeTab}
          detail={controller.detailState.detail}
          fallbackImageUrl={controller.selectedRecipe?.imageUrl ?? controller.selectedRecipe?.thumbnailUrl}
          groceryState={controller.groceryState}
          grocerySubmitted={controller.grocerySubmitted}
          onAddMissing={controller.addMissingIngredients}
        />
      )
    }
    return null
  }, [
    controller.activeTab,
    controller.addMissingIngredients,
    controller.detailState,
    controller.groceryState,
    controller.grocerySubmitted,
    controller.selectedRecipe?.imageUrl,
    controller.selectedRecipe?.thumbnailUrl,
  ])

  return (
    <ModalSheet
      contentStyle={RECIPE_DETAIL_MODAL_STYLE}
      footer={footer}
      onClose={controller.close}
      open={controller.open && controller.selectedRecipe !== null}
      scrollResetKey={`${controller.selectedRecipe?.id ?? 'none'}:${controller.activeTab}`}
      surface="hass-popup"
      title={title}
    >
      {content}
    </ModalSheet>
  )
}
