import { useState } from 'react'
import { CheckboxRow } from '../../core/CheckboxRow'
import { EmptyState } from '../../core/EmptyState'
import { ExpandingSearchAction } from '../../core/ExpandingSearchAction'
import { MaterialIcon } from '../../core/Icon'
import { ModalIconTabNav } from '../../core/ModalTabNav'
import { modalTabId, modalTabPanelId } from '../../core/modalTabIds'
import { ModalSheet, type ModalSheetStyle } from '../../core/ModalSheet'
import { NativePickerField } from '../../core/NativePickerField'
import { StatusPill, type StatusPillTone } from '../../core/StatusPill'
import { useSmoothDisplayedModalTab } from '../../../hooks/useSmoothDisplayedModalTab'
import { useModalDetailPageScroll } from '../../../hooks/useModalDetailPageScroll'
import { useCopy } from '../../../i18n/useCopy'
import {
  type RecipeDetail,
  type RecipeDetailIngredient,
  type RecipeIngredientInventoryState,
  type RecipeInstructionGroup,
} from './recipeTypes'
import { formatRecipeDuration, formatRecipeNumber, formatRecipeYield } from './recipeDetailFormatting'
import { recipeGroceryDisabledReason } from './recipeGroceryState'
import type { RecipeDetailModalController, RecipeInventoryProduct } from './useRecipeDetailModal'
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
const RECIPE_I18N = { namespace: 'modalRecipe' } as const
const RECIPE_COPY_KEYS = {
  activateChooseProduct: 'activateChooseProduct',
  activeTime: 'activeTime',
  addMyWeek: 'addMyWeek',
  additionalEquipment: 'additionalEquipment',
  backAssumeHave: 'backAssumeHave',
  backRecipe: 'backRecipe',
  chooseProductTitle: 'chooseProductTitle',
  cookTime: 'cookTime',
  devices: 'devices',
  inactiveRestTime: 'inactiveRestTime',
  inventoryChoices: 'inventoryChoices',
  inventoryPickerEmpty: 'inventoryPickerEmpty',
  inventoryPickerEmptyTitle: 'inventoryPickerEmptyTitle',
  inventoryPickerHelp: 'inventoryPickerHelp',
  inventoryPickerLoading: 'inventoryPickerLoading',
  inventoryPickerSearch: 'inventoryPickerSearch',
  inventoryPickerSearchPlaceholder: 'inventoryPickerSearchPlaceholder',
  inventoryPickerUnavailableTitle: 'inventoryPickerUnavailableTitle',
  inventoryQuantity: 'inventoryQuantity',
  inventoryQuantityUnknown: 'inventoryQuantityUnknown',
  openCookidoo: 'openCookidoo',
  plannerAdding: 'plannerAdding',
  plannerDate: 'plannerDate',
  plannerExplanation: 'plannerExplanation',
  prepTime: 'prepTime',
  product: 'product',
  sectionNavigation: 'sectionNavigation',
  sourceContentLanguage: 'sourceContentLanguage',
  optionalDevices: 'optionalDevices',
  totalTime: 'totalTime',
} as const

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

function GeneralFactList({
  id,
  items,
  label,
}: {
  id: string
  items: string[]
  label: string
}) {
  if (items.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h3 id={id}>{label}</h3>
      <ul className={styles.equipment}>
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  )
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

function GeneralTab({
  detail,
  fallbackImageUrl,
  onOpenPlanner,
}: {
  detail: RecipeDetail
  fallbackImageUrl?: string | null
  onOpenPlanner: () => void
}) {
  const copy = useCopy('modalRecipe')
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
        {generalAvailable && <GeneralFact icon="mdi:timer-cog" label={copy(RECIPE_COPY_KEYS.prepTime)} value={formatRecipeDuration(detail.general.prepTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:pot-steam" label={copy(RECIPE_COPY_KEYS.cookTime)} value={formatRecipeDuration(detail.general.cookTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:progress-clock" label={copy(RECIPE_COPY_KEYS.activeTime)} value={formatRecipeDuration(detail.general.activeTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:pause-circle" label={copy(RECIPE_COPY_KEYS.inactiveRestTime)} value={formatRecipeDuration(detail.general.inactiveTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:clock-outline" label={copy(RECIPE_COPY_KEYS.totalTime)} value={formatRecipeDuration(detail.general.totalTimeSeconds)} />}
        {generalAvailable && <GeneralFact icon="mdi:gauge" label="Difficulty" value={detail.general.difficulty} />}
        {generalAvailable && <GeneralFact icon="mdi:food-fork-drink" label="Category" value={detail.general.primaryCategory} />}
        <GeneralFact icon="mdi:book-open-page-variant" label="Source" value={source} />
        <GeneralFact icon="mdi:map-marker" label="Locale" value={detail.source.locale} />
        <GeneralFact icon="mdi:translate" label={copy(RECIPE_COPY_KEYS.sourceContentLanguage)} value={detail.source.contentLanguage} />
        <GeneralFact
          detail={updated ?? undefined}
          icon="mdi:progress-clock"
          label="Freshness"
          tone={freshness?.tone}
          value={freshness?.value ?? null}
        />
      </div>
      {!generalAvailable && (
        <p className={styles.notice} role="status">
          {copy('metadataUnavailable')}
        </p>
      )}
      {generalAvailable && (
        <>
          <GeneralFactList
            id="recipe-devices"
            items={detail.general.devices}
            label={copy(RECIPE_COPY_KEYS.devices)}
          />
          <GeneralFactList
            id="recipe-optional-devices"
            items={detail.general.optionalDevices}
            label={copy(RECIPE_COPY_KEYS.optionalDevices)}
          />
          <GeneralFactList
            id="recipe-additional-equipment"
            items={detail.general.equipment}
            label={copy(RECIPE_COPY_KEYS.additionalEquipment)}
          />
        </>
      )}
      <div className={styles.generalActions}>
        {detail.source.canonicalUrl && (
          <a
            className={styles.primaryAction}
            href={detail.source.canonicalUrl}
            referrerPolicy="no-referrer"
            rel="noreferrer noopener"
            target="_blank"
          >
            <MaterialIcon name="mdi:open-in-new" size={20} />
            <span>
              {detail.source.connector.toLowerCase() === 'cookidoo'
                ? copy(RECIPE_COPY_KEYS.openCookidoo)
                : 'Open Source Recipe'}
            </span>
          </a>
        )}
        {detail.capabilities.planner && detail.planner.available && (
          <button className={styles.secondaryPrimaryAction} onClick={onOpenPlanner} type="button">
            <MaterialIcon name="mdi:calendar-plus" size={20} />
            <span>{copy(RECIPE_COPY_KEYS.addMyWeek)}</span>
          </button>
        )}
      </div>
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
  if (state === 'uncertain') return inventoryStatus(missingIngredientValue())
  return 'checked' as const
}

function missingIngredientValue(): RecipeIngredientInventoryState {
  return 'missing'
}

function ingredientDisplayStatus(ingredient: RecipeDetailIngredient) {
  if (ingredient.userOverride?.availability === 'have') return inventoryStatus('in_stock')
  if (ingredient.userOverride?.availability === 'missing') return inventoryStatus(missingIngredientValue())
  return inventoryStatus(ingredient.inventory.state)
}

function ingredientStatusChecked(value: ReturnType<typeof ingredientDisplayStatus>) {
  return value === inventoryStatus('in_stock')
}

function ingredientStatusUnchecked(value: ReturnType<typeof ingredientDisplayStatus>) {
  return value === inventoryStatus(missingIngredientValue())
}

function plannerSucceeded(controller: RecipeDetailModalController) {
  return controller.plannerState.status === 'success'
}

function plannerFailed(controller: RecipeDetailModalController) {
  return controller.plannerState.status === 'error'
}

function plannerFeedback(controller: RecipeDetailModalController) {
  return (controller.plannerState as { message?: string }).message ?? ''
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

function ingredientDetailParts(
  detail: RecipeDetail,
  ingredient: RecipeDetailIngredient,
  overrideLabel: string | null = null,
) {
  const sourceDetail = ingredientSourceDetail(ingredient)
  return [
    inventoryMatchLabel(ingredient),
    ingredient.optional === true ? 'Optional' : null,
    ingredient.userOverride?.selectedProduct?.name
      ? `Product: ${ingredient.userOverride.selectedProduct.name}`
      : ingredient.inventory.matchedProduct?.name
        ? `Product: ${ingredient.inventory.matchedProduct.name}`
      : null,
    sourceDetail ? `Source: ${sourceDetail}` : null,
    ingredient.closestMatch ? `Matched as ${ingredient.closestMatch.label}` : null,
    overrideLabel,
    ingredientQuantityExplanation(detail, ingredient),
  ].filter((part): part is string => Boolean(part))
}

function IngredientSubtitle({ detail, ingredient }: { detail: RecipeDetail; ingredient: RecipeDetailIngredient }) {
  const copy = useCopy('modalRecipe')
  const state = inventoryMatchLabel(ingredient)
  const quantityExplanation = ingredientQuantityExplanation(detail, ingredient)
  const sourceDetail = ingredientSourceDetail(ingredient)
  return (
    <span className={styles.ingredientDetails}>
      <span className={styles.ingredientMetaRow}>
        <span className={styles.ingredientChip}>{state}</span>
        {ingredient.optional === true && <span className={styles.ingredientChip}>Optional</span>}
        {!ingredient.userOverride?.selectedProduct && ingredient.inventory.matchedProduct?.name && (
          <span className={styles.ingredientChip}>
            {copy(RECIPE_COPY_KEYS.product, {
              product: ingredient.inventory.matchedProduct.name,
            })}
          </span>
        )}
        {ingredient.userOverride?.selectedProduct && (
          <span className={styles.ingredientChip} data-user-correction="true">
            {copy(RECIPE_COPY_KEYS.product, {
              product: ingredient.userOverride.selectedProduct.name,
            })}
          </span>
        )}
        {ingredient.userOverride && (
          <span className={styles.ingredientChip} data-user-override="true">
            {copy('overridePrefix', {
              value: ingredient.userOverride.availability === 'have'
                ? copy('overrideHave')
                : copy('overrideMissing'),
            })}
          </span>
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
  feedbackMessage,
  feedbackPending,
  groceryState,
  grocerySubmitted,
  onAddMissing,
  onOpenIngredientPicker,
  onRejectIngredientMatch,
}: {
  detail: RecipeDetail
  feedbackMessage: string | null
  feedbackPending: ReadonlySet<string>
  groceryState: GroceryState
  grocerySubmitted: boolean
  onAddMissing: () => void
  onOpenIngredientPicker: (ingredient: RecipeDetailIngredient) => void
  onRejectIngredientMatch: (ingredient: RecipeDetailIngredient) => void
}) {
  const copy = useCopy('modalRecipe')
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
                  {section.ingredients.map((ingredient) => {
                    const status = ingredientDisplayStatus(ingredient)
                    const pending = feedbackPending.has(ingredient.key)
                    const canOpenPicker = detail.capabilities.ingredientFeedbackV2
                      && ingredient.feedbackCapabilities.decision
                      && ingredient.feedbackCapabilities.selectInventoryProduct
                      && Boolean(ingredient.feedbackToken)
                      && ingredientStatusUnchecked(status)
                    const canReject = detail.capabilities.ingredientFeedbackV2
                      && ingredient.feedbackCapabilities.decision
                      && ingredient.feedbackCapabilities.rejectCurrentMatch
                      && Boolean(ingredient.feedbackToken)
                      && ingredientStatusChecked(status)
                    const canActivate = canOpenPicker || canReject
                    const overrideLabel = ingredient.userOverride
                      ? copy('overridePrefix', {
                          value: ingredient.userOverride.availability === 'have'
                            ? copy('overrideHave')
                            : copy('overrideMissing'),
                        })
                      : null
                    const detailParts = ingredientDetailParts(
                      detail,
                      ingredient,
                      overrideLabel,
                    )
                    const overrideInstruction = canOpenPicker
                      ? copy(RECIPE_COPY_KEYS.activateChooseProduct)
                      : canReject
                        ? copy('activateMarkMissing')
                        : null
                    const label = copy('ingredientAria', {
                      details: [
                        ...detailParts,
                        overrideInstruction,
                      ].filter(Boolean).join('. '),
                      title: ingredientTitle(ingredient),
                    })
                    return (
                      <li key={ingredient.key}>
                        {detail.capabilities.ingredients === 'checklist' ? (
                          canActivate ? (
                            <CheckboxRow
                              active={ingredientStatusChecked(status)}
                              alignWrappedToIconTop
                              aria-label={label}
                              disabled={pending}
                              data-modal-detail-trigger={ingredient.key}
                              mode="status-control"
                              onClick={() => {
                                if (canOpenPicker) onOpenIngredientPicker(ingredient)
                                else onRejectIngredientMatch(ingredient)
                              }}
                              status={status}
                              subtitle={<IngredientSubtitle detail={detail} ingredient={ingredient} />}
                              title={ingredientTitle(ingredient)}
                            />
                          ) : (
                            <CheckboxRow
                              active={ingredientStatusChecked(status)}
                              alignWrappedToIconTop
                              aria-label={label}
                              mode="status"
                              status={status}
                              subtitle={<IngredientSubtitle detail={detail} ingredient={ingredient} />}
                              title={ingredientTitle(ingredient)}
                            />
                          )
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
                    )
                  })}
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
        {feedbackMessage && <p className={styles.actionHint} role="status">{feedbackMessage}</p>}
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

function inventoryProductSubtitle(
  product: RecipeInventoryProduct,
  copy: ReturnType<typeof useCopy>,
) {
  if (product.quantity === null) return copy(RECIPE_COPY_KEYS.inventoryQuantityUnknown)
  const quantity = [
    formatRecipeNumber(product.quantity),
    product.unit,
  ].filter(Boolean).join(' ')
  return copy(RECIPE_COPY_KEYS.inventoryQuantity, { quantity })
}

function IngredientPickerPage({
  controller,
  onSelect,
}: {
  controller: RecipeDetailModalController
  onSelect: (product: RecipeInventoryProduct) => void
}) {
  const copy = useCopy(RECIPE_I18N.namespace)
  const state = controller.ingredientPickerLoadState
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div aria-label={copy(RECIPE_COPY_KEYS.inventoryPickerLoading)} className={styles.loader} role="status">
        <span aria-hidden="true" />
      </div>
    )
  }
  if (state.status === 'error') {
    return <EmptyState description={state.message} layout="modal" title={copy(RECIPE_COPY_KEYS.inventoryPickerUnavailableTitle)} />
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        description={copy(RECIPE_COPY_KEYS.inventoryPickerEmpty)}
        layout="modal"
        title={copy(RECIPE_COPY_KEYS.inventoryPickerEmptyTitle)}
      />
    )
  }
  return (
    <div className={styles.pickerStack}>
      <p className={styles.notice}>
        {copy(RECIPE_COPY_KEYS.inventoryPickerHelp)}
      </p>
      <ul aria-label={copy(RECIPE_COPY_KEYS.inventoryChoices)} className={styles.productChoices}>
        {state.items.map((product) => (
          <li key={product.id}>
            <button
              data-product-id={product.id}
              onClick={() => onSelect(product)}
              type="button"
            >
              <span>
                <strong>{product.name}</strong>
                <small>{inventoryProductSubtitle(product, copy)}</small>
              </span>
              <MaterialIcon name="mdi:chevron-right" size={22} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlannerPage({ controller }: { controller: RecipeDetailModalController }) {
  const copy = useCopy(RECIPE_I18N.namespace)
  const detail = controller.detailState.status === 'ready'
    ? controller.detailState.detail
    : null
  if (!detail) return null
  const disabled = controller.plannerState.status === 'loading'
    || !controller.plannerDate
  const plannerLoading = controller.plannerState.status === 'loading'
  return (
    <div className={styles.plannerStack}>
      <p className={styles.notice}>
        {copy(RECIPE_COPY_KEYS.plannerExplanation)}
      </p>
      <NativePickerField
        ariaLabel={copy(RECIPE_COPY_KEYS.plannerDate)}
        detailAutoFocus
        label={copy(RECIPE_COPY_KEYS.plannerDate)}
        max={detail.planner.maximumDate ?? undefined}
        min={detail.planner.minimumDate ?? undefined}
        onChange={controller.setPlannerDate}
        type="date"
        value={controller.plannerDate}
      />
      <button
        className={styles.primaryAction}
        disabled={disabled}
        onClick={controller.submitPlanner}
        type="button"
      >
        <MaterialIcon name="mdi:calendar-plus" size={20} />
        <span>{plannerLoading ? copy(RECIPE_COPY_KEYS.plannerAdding) : copy(RECIPE_COPY_KEYS.addMyWeek)}</span>
      </button>
      {plannerSucceeded(controller) && (
        <p className={styles.successFeedback} role="status">{plannerFeedback(controller)}</p>
      )}
      {plannerFailed(controller) && (
        <p className={styles.errorFeedback} role="alert">{plannerFeedback(controller)}</p>
      )}
    </div>
  )
}

function RecipeDetailTabContent({
  activeTab,
  detail,
  fallbackImageUrl,
  feedbackMessage,
  feedbackPending,
  groceryState,
  grocerySubmitted,
  onAddMissing,
  onOpenIngredientPicker,
  onOpenPlanner,
  onRejectIngredientMatch,
}: {
  activeTab: RecipeDetailTab
  detail: RecipeDetail
  fallbackImageUrl?: string | null
  feedbackMessage: string | null
  feedbackPending: ReadonlySet<string>
  groceryState: GroceryState
  grocerySubmitted: boolean
  onAddMissing: () => void
  onOpenIngredientPicker: (ingredient: RecipeDetailIngredient) => void
  onOpenPlanner: () => void
  onRejectIngredientMatch: (ingredient: RecipeDetailIngredient) => void
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
      {displayedTab === 'general' && (
        <GeneralTab
          detail={detail}
          fallbackImageUrl={fallbackImageUrl}
          onOpenPlanner={onOpenPlanner}
        />
      )}
      {displayedTab === 'ingredients' && (
        <IngredientsTab
          detail={detail}
          feedbackMessage={feedbackMessage}
          feedbackPending={feedbackPending}
          groceryState={groceryState}
          grocerySubmitted={grocerySubmitted}
          onAddMissing={onAddMissing}
          onOpenIngredientPicker={onOpenIngredientPicker}
          onRejectIngredientMatch={onRejectIngredientMatch}
        />
      )}
      {displayedTab === 'instructions' && <InstructionsTab detail={detail} />}
    </div>
  )
}

export function RecipeDetailModal({ controller }: { controller: RecipeDetailModalController }) {
  const copy = useCopy(RECIPE_I18N.namespace)
  const readyDetail = controller.detailState.status === 'ready' ? controller.detailState.detail : null
  const detailPageKey = controller.ingredientPickerIngredient
    ? `ingredient:${controller.ingredientPickerIngredient.key}`
    : controller.plannerOpen
      ? `planner:${readyDetail?.id ?? 'none'}`
      : null
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPageKey)
  const title = controller.ingredientPickerIngredient
    ? copy(RECIPE_COPY_KEYS.chooseProductTitle, {
        ingredient: controller.ingredientPickerIngredient.displayName,
      })
    : controller.plannerOpen
      ? copy(RECIPE_COPY_KEYS.addMyWeek)
      : readyDetail?.title ?? controller.selectedRecipe?.title ?? 'Recipe Details'

  const openIngredientPicker = (ingredient: RecipeDetailIngredient) => {
    enterDetailPage(ingredient.key)
    controller.openIngredientPicker(ingredient)
  }

  const openPlanner = () => {
    enterDetailPage('planner')
    controller.openPlanner()
  }

  const restoreIngredientFocus = (ingredientKey: string) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        bodyElementRef.current
          ?.querySelector<HTMLElement>(
            `[data-modal-detail-trigger="${ingredientKey}"]`,
          )
          ?.focus({ preventScroll: true })
      })
    })
  }

  const cancelDetailPage = (restoreFocus = false) => {
    const ingredientKey = controller.ingredientPickerIngredient?.key
    leaveDetailPage()
    if (controller.ingredientPickerIngredient) controller.cancelIngredientPicker()
    if (controller.plannerOpen) controller.cancelPlanner()
    if (restoreFocus && ingredientKey) restoreIngredientFocus(ingredientKey)
  }

  const assumeIngredientHave = () => {
    const ingredientKey = controller.ingredientPickerIngredient?.key
    leaveDetailPage()
    controller.assumeIngredientHave()
    if (ingredientKey) restoreIngredientFocus(ingredientKey)
  }

  const selectIngredientProduct = (product: RecipeInventoryProduct) => {
    const ingredientKey = controller.ingredientPickerIngredient?.key
    leaveDetailPage()
    controller.selectIngredientProduct(product)
    if (ingredientKey) restoreIngredientFocus(ingredientKey)
  }

  const changeTab = (tab: RecipeDetailTab) => {
    if (detailPageKey) {
      cancelDetailPage(
        Boolean(controller.ingredientPickerIngredient)
          && tab === controller.activeTab,
      )
    }
    controller.setActiveTab(tab)
  }

  const closeModal = () => {
    if (controller.ingredientPickerIngredient) controller.cancelIngredientPicker()
    if (controller.plannerOpen) controller.cancelPlanner()
    resetDetailPageScroll()
    controller.close()
  }

  const tabNav = readyDetail
    ? (
        <ModalIconTabNav
          activeTab={controller.activeTab}
          idPrefix={RECIPE_DETAIL_TAB_ID_PREFIX}
          label={copy(RECIPE_COPY_KEYS.sectionNavigation, { title: readyDetail.title })}
          onTabChange={changeTab}
          panelId={RECIPE_DETAIL_TAB_PANEL_ID}
          tabs={RECIPE_DETAIL_TABS}
        />
      )
    : undefined
  const footer = controller.ingredientPickerIngredient && tabNav
    ? (
        <div className={styles.pickerFooterStack}>
          <ExpandingSearchAction
            ariaLabel={copy(RECIPE_COPY_KEYS.inventoryPickerSearch)}
            initiallyExpanded
            onExpandedChange={() => undefined}
            onQueryChange={controller.setIngredientPickerQuery}
            persistent
            placeholder={copy(RECIPE_COPY_KEYS.inventoryPickerSearchPlaceholder)}
            query={controller.ingredientPickerQuery}
          />
          {tabNav}
        </div>
      )
    : tabNav

  const content = (() => {
    if (controller.ingredientPickerIngredient) {
      return (
        <IngredientPickerPage
          controller={controller}
          onSelect={selectIngredientProduct}
        />
      )
    }
    if (controller.plannerOpen) {
      return <PlannerPage controller={controller} />
    }
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
          feedbackMessage={controller.ingredientFeedbackMessage}
          feedbackPending={controller.ingredientFeedbackPending}
          groceryState={controller.groceryState}
          grocerySubmitted={controller.grocerySubmitted}
          onAddMissing={controller.addMissingIngredients}
          onOpenIngredientPicker={openIngredientPicker}
          onOpenPlanner={openPlanner}
          onRejectIngredientMatch={controller.rejectIngredientMatch}
        />
      )
    }
    return null
  })()

  return (
    <ModalSheet
      contentStyle={RECIPE_DETAIL_MODAL_STYLE}
      footer={footer}
      backLabel={controller.ingredientPickerIngredient
        ? copy(RECIPE_COPY_KEYS.backAssumeHave)
        : controller.plannerOpen
          ? copy(RECIPE_COPY_KEYS.backRecipe)
          : undefined}
      bodyElementRef={bodyElementRef}
      onBack={controller.ingredientPickerIngredient
        ? assumeIngredientHave
        : controller.plannerOpen
          ? cancelDetailPage
          : undefined}
      onClose={closeModal}
      open={controller.open && controller.selectedRecipe !== null}
      scrollResetKey={`${controller.selectedRecipe?.id ?? 'none'}:${controller.activeTab}:${detailPageKey ?? 'root'}`}
      title={title}
    >
      {content}
    </ModalSheet>
  )
}
