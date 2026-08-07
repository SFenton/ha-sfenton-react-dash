import { useRef, useState } from 'react'
import { Description } from '../../core/Description'
import { ExpandingSearchAction } from '../../core/ExpandingSearchAction'
import { FloatingActionButton } from '../../core/FloatingActionButton'
import { ModalSheet } from '../../core/ModalSheet'
import { RadioRow } from '../../core/RadioRow'
import { RangeField } from '../../core/RangeField'
import { ToggleSetting } from '../../core/ToggleSetting'
import type { RecipeSort } from './recipeTypes'
import type { RecipeControls, RecipeFilterValues } from './useRecipeControls'
import styles from './RecipeFloatingActions.module.css'

const ACTION_COLOR = { r: 42, g: 126, b: 180 }
const ACTIVE_ACTION_COLOR = { r: 155, g: 110, b: 64 }

const SORT_OPTIONS: Array<{ label: string; subtitle: string; value: RecipeSort }> = [
  { label: 'Ingredients Available', subtitle: 'Prioritize recipes you can make from current inventory.', value: 'availability' },
  { label: 'Expiring Soon', subtitle: 'Prioritize recipes that use ingredients nearing expiration.', value: 'expiry' },
  { label: 'Alphabetical', subtitle: 'Sort recipe titles from A to Z.', value: 'alphabetical' },
]

const EXPIRY_HORIZONS: Array<{ label: string; value: 7 | 30 | 90 }> = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
]

function focusSlotButton(slot: HTMLSpanElement | null) {
  window.requestAnimationFrame(() => slot?.querySelector('button')?.focus({ preventScroll: true }))
}

function SheetFooter({ onApply, onReset }: { onApply: () => void; onReset: () => void }) {
  return (
    <div className={styles.sheetFooter}>
      <button className={styles.resetAction} onClick={onReset} type="button">Reset</button>
      <button className={styles.primaryAction} onClick={onApply} type="button">Apply</button>
    </div>
  )
}

function RecipeSortSheet({ controls, onApplied }: { controls: RecipeControls; onApplied: () => void }) {
  return (
    <ModalSheet
      footer={<SheetFooter onApply={() => {
        controls.applySort()
        controls.closeSortSheet()
        onApplied()
      }} onReset={controls.resetSortDraft} />}
      onClose={controls.closeSortSheet}
      open={controls.sortOpen}
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
      footer={<SheetFooter onApply={() => {
        controls.applyFilter()
        controls.closeFilterSheet()
        onApplied()
      }} onReset={controls.resetFilterDraft} />}
      onClose={controls.closeFilterSheet}
      open={controls.filterOpen}
      title="Filter Recipes"
    >
      <div className={styles.sheetStack}>
        <ToggleSetting
          checked={controls.filterDraft.expiringOnly}
          icon="mdi:clock-alert-outline"
          label="Expiring ingredients only"
          onChange={(expiringOnly) => updateFilterDraft(controls, { expiringOnly })}
        />
        <fieldset className={styles.fieldset}>
          <legend>Expiring Within</legend>
          <div className={styles.horizonGroup} role="radiogroup" aria-label="Expiring within">
            {EXPIRY_HORIZONS.map((option) => (
              <RadioRow
                active={controls.filterDraft.expiringWithinDays === option.value}
                disabled={!controls.filterDraft.expiringOnly}
                key={option.value}
                onClick={() => updateFilterDraft(controls, { expiringWithinDays: option.value })}
                title={option.label}
              />
            ))}
          </div>
        </fieldset>
        <RangeField
          label="Minimum Coverage"
          max={100}
          min={0}
          onChange={(minimumCoverage) => updateFilterDraft(controls, { minimumCoverage })}
          step={5}
          value={controls.filterDraft.minimumCoverage}
        />
        {alphabetical && <Description className={styles.weightExplanation}>Weights are not used while recipes are sorted alphabetically.</Description>}
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
      <span aria-hidden={searchExpanded ? 'true' : undefined} className={styles.actionSlot} data-collapsed={searchExpanded ? 'true' : undefined} inert={searchExpanded} ref={sortSlotRef}>
        <FloatingActionButton ariaLabel="Sort" color={controls.sortActive ? ACTIVE_ACTION_COLOR : ACTION_COLOR} icon="mdi:swap-vertical" onClick={controls.openSortSheet} />
      </span>
      <span aria-hidden={searchExpanded ? 'true' : undefined} className={styles.actionSlot} data-collapsed={searchExpanded ? 'true' : undefined} inert={searchExpanded} ref={filterSlotRef}>
        <FloatingActionButton ariaLabel="Filter" color={controls.filterActive ? ACTIVE_ACTION_COLOR : ACTION_COLOR} icon="mdi:tune-vertical" onClick={controls.openFilterSheet} />
      </span>
      <RecipeSortSheet controls={controls} onApplied={() => focusSlotButton(sortSlotRef.current)} />
      <RecipeFilterSheet controls={controls} onApplied={() => focusSlotButton(filterSlotRef.current)} />
    </>
  )
}
