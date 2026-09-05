import { useRef, useState } from 'react'
import { Description } from '../../core/Description'
import { ExpandingSearchAction } from '../../core/ExpandingSearchAction'
import { FilterSheetFooter } from '../../core/FilterSheetFooter'
import { FloatingActionSlot } from '../../core/FloatingActionSlot'
import { FloatingActionButton } from '../../core/FloatingActionButton'
import { ModalSheet, type ModalCenteredGeometry } from '../../core/ModalSheet'
import { RadioRow } from '../../core/RadioRow'
import { RangeField } from '../../core/RangeField'
import { ToggleSetting } from '../../core/ToggleSetting'
import type { RecipeSort } from './recipeTypes'
import type { RecipeControls, RecipeFilterValues } from './useRecipeControls'
import styles from './RecipeFloatingActions.module.css'

const ACTION_COLOR = { r: 42, g: 126, b: 180 }
const ACTIVE_ACTION_COLOR = { r: 155, g: 110, b: 64 }
const RECIPE_SORT_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '500px',
  id: 'recipe-sort',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry
const RECIPE_FILTER_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'recipe-filter',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

const SORT_OPTIONS: Array<{ label: string; subtitle: string; value: RecipeSort }> = [
  { label: 'Ingredients Available', subtitle: 'Prioritize recipes you can make from current inventory.', value: 'availability' },
  { label: 'Expiring Soon', subtitle: 'Prioritize recipes that use ingredients nearing expiration.', value: 'expiry' },
  { label: 'Alphabetical', subtitle: 'Sort recipe titles from A to Z.', value: 'alphabetical' },
]

const EXPIRY_HORIZONS: Array<{ label: string; subtitle: string; value: 7 | 30 | 90 }> = [
  { label: '7 Days', subtitle: 'Use ingredients expiring within the next week.', value: 7 },
  { label: '30 Days', subtitle: 'Use ingredients expiring within the next month.', value: 30 },
  { label: '90 Days', subtitle: 'Use ingredients expiring within the next three months.', value: 90 },
]

function focusSlotButton(slot: HTMLSpanElement | null) {
  window.requestAnimationFrame(() => slot?.querySelector('button')?.focus({ preventScroll: true }))
}

function RecipeSortSheet({ controls, onApplied }: { controls: RecipeControls; onApplied: () => void }) {
  return (
    <ModalSheet
      centeredGeometry={RECIPE_SORT_CENTERED_GEOMETRY}
      footer={(
        <FilterSheetFooter
          onApply={() => {
            controls.applySort()
            controls.closeSortSheet()
            onApplied()
          }}
          onReset={controls.resetSortDraft}
        />
      )}
      onClose={controls.closeSortSheet}
      open={controls.sortOpen}
      size="form"
      title="Sort Recipes"
    >
      <fieldset className={styles.fieldset}>
        <legend>Sort By</legend>
        <div className={styles.radioGroup} role="radiogroup" aria-label="Sort recipes">
          {SORT_OPTIONS.map((option) => (
            <RadioRow
              active={controls.sortDraft === option.value}
              key={option.value}
              onClick={() => controls.setSortDraft(option.value)}
              subtitle={option.subtitle}
              title={option.label}
            />
          ))}
        </div>
      </fieldset>
    </ModalSheet>
  )
}

function updateFilterDraft(controls: RecipeControls, patch: Partial<RecipeFilterValues>) {
  controls.setFilterDraft({ ...controls.filterDraft, ...patch })
}

function RecipeFilterSheet({ controls, onApplied }: { controls: RecipeControls; onApplied: () => void }) {
  const alphabetical = controls.sort === 'alphabetical'
  return (
    <ModalSheet
      centeredGeometry={RECIPE_FILTER_CENTERED_GEOMETRY}
      footer={(
        <FilterSheetFooter
          onApply={() => {
            controls.applyFilter()
            controls.closeFilterSheet()
            onApplied()
          }}
          onReset={controls.resetFilterDraft}
        />
      )}
      onClose={controls.closeFilterSheet}
      open={controls.filterOpen}
      size="form"
      title="Filter Recipes"
    >
      <div className={styles.sheetStack} data-modal-landscape-layout="section-grid">
        <fieldset className={styles.fieldset}>
          <legend>Ingredient Coverage</legend>
          <Description className={styles.groupDescription}>Only show recipes where at least this percentage of required ingredients is currently available.</Description>
          <RangeField
            label="Minimum Ingredients Available"
            max={100}
            min={0}
            onChange={(minimumCoverage) => updateFilterDraft(controls, { minimumCoverage })}
            step={5}
            value={controls.filterDraft.minimumCoverage}
          />
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>Expiring Ingredients</legend>
          <ToggleSetting
            checked={controls.filterDraft.expiringOnly}
            icon="mdi:clock-outline"
            label="Use expiring ingredients only"
            onChange={(expiringOnly) => updateFilterDraft(controls, { expiringOnly })}
          />
          <div className={styles.radioGroup} role="radiogroup" aria-label="Expiring within">
            {EXPIRY_HORIZONS.map((option) => (
              <RadioRow
                active={controls.filterDraft.expiringWithinDays === option.value}
                disabled={!controls.filterDraft.expiringOnly}
                key={option.value}
                onClick={() => updateFilterDraft(controls, { expiringWithinDays: option.value })}
                subtitle={option.subtitle}
                title={option.label}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>Ranking Strength</legend>
          <Description className={styles.groupDescription}>Tune how strongly available and expiring ingredients influence ranked recipe results.</Description>
          {alphabetical && <Description className={styles.weightExplanation}>Weights are unavailable while recipes are sorted alphabetically.</Description>}
          <div className={styles.rangeGroup}>
            <RangeField
              disabled={alphabetical}
              label="Availability Weight"
              max={100}
              min={0}
              onChange={(availabilityWeight) => updateFilterDraft(controls, { availabilityWeight })}
              step={5}
              value={controls.filterDraft.availabilityWeight}
            />
            <RangeField
              disabled={alphabetical}
              label="Expiry Weight"
              max={100}
              min={0}
              onChange={(expiryWeight) => updateFilterDraft(controls, { expiryWeight })}
              step={5}
              value={controls.filterDraft.expiryWeight}
            />
          </div>
        </fieldset>
      </div>
    </ModalSheet>
  )
}

export function RecipeFloatingActions({ controls }: { controls: RecipeControls }) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  const sortSlotRef = useRef<HTMLSpanElement>(null)
  const filterSlotRef = useRef<HTMLSpanElement>(null)

  return (
    <>
      <ExpandingSearchAction
        ariaLabel="Search recipes"
        onExpandedChange={setSearchExpanded}
        onQueryChange={controls.setSearchQuery}
        placeholder="Search titles and ingredients..."
        query={controls.searchQuery}
      />
      <FloatingActionSlot collapsed={searchExpanded} ref={sortSlotRef}>
        <FloatingActionButton ariaLabel="Sort" color={controls.sortActive ? ACTIVE_ACTION_COLOR : ACTION_COLOR} icon="mdi:swap-vertical" onClick={controls.openSortSheet} />
      </FloatingActionSlot>
      <FloatingActionSlot collapsed={searchExpanded} ref={filterSlotRef}>
        <FloatingActionButton ariaLabel="Filter" color={controls.filterActive ? ACTIVE_ACTION_COLOR : ACTION_COLOR} icon="mdi:tune-vertical" onClick={controls.openFilterSheet} />
      </FloatingActionSlot>
      <RecipeSortSheet controls={controls} onApplied={() => focusSlotButton(sortSlotRef.current)} />
      <RecipeFilterSheet controls={controls} onApplied={() => focusSlotButton(filterSlotRef.current)} />
    </>
  )
}
