import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { mockState, resetMockHass } from '../../../test/mocks/hakitCoreState'
import { RecipeDetailModal } from './RecipeDetailModal'
import { formatRecipeDuration, formatRecipeYield } from './recipeDetailFormatting'
import { recipeGroceryDisabledReason } from './recipeGroceryState'
import { normalizeRecipeDetailServiceResult, type RecipeCardSummary, type RecipeDetail } from './recipeTypes'
import { useRecipeDetailModalController } from './useRecipeDetailModal'

const recipe: RecipeCardSummary = {
  id: 42,
  dedupeKey: 'recipe:42',
  title: 'Pantry Bowl',
  imageUrl: null,
  thumbnailUrl: null,
  source: 'Manual',
  sourceUrl: null,
  coverage: 50,
  matchedRequired: 2,
  requiredTotal: 4,
  expiryScore: 0,
  soonestExpiryDays: null,
  score: 1,
  cookable: false,
}

function ingredient(
  position: number,
  name: string,
  state: 'in_stock' | 'missing' | 'staple' | 'uncertain',
  options: {
    closestMatch?: string
    closestMatchConfidence?: number
    closestMatchSource?: string
    displayName?: string
    feedback?: boolean
    matched?: string
    optional?: boolean | null
    providerMetadata?: Record<string, unknown>
    quantity?: number | null
    quantityMax?: number | null
    relation?: string
    quantityState?: string
    sourceText?: string
    text?: string | null
    unit?: string | null
  } = {},
) {
  return {
    key: `ri:${position}:${String(position + 1).padStart(16, '0')}`,
    position,
    name,
    ...(options.displayName ? { display_name: options.displayName } : {}),
    ...(options.sourceText ? { source_text: options.sourceText } : {}),
    ...(options.optional === undefined ? {} : { source_optional: options.optional }),
    ...(options.providerMetadata ? { provider: options.providerMetadata } : {}),
    ...(options.closestMatch
      ? {
          closest_match: {
            label: options.closestMatch,
            canonical_ingredient_id: 700 + position,
            taxonomy_node_id: 800 + position,
            mapping_source: options.closestMatchSource ?? 'taxonomy_alias',
            confidence: options.closestMatchConfidence ?? 0.87,
          },
        }
      : {}),
    amount: {
      quantity: options.quantity ?? null,
      quantity_max: options.quantityMax ?? null,
      unit: options.unit ?? null,
      text: options.text ?? null,
    },
    inventory: {
      state,
      relation: options.relation ?? null,
      confidence: state === 'uncertain' ? 0.3 : 0.95,
      matched_product: options.matched ? { id: 100 + position, name: options.matched } : null,
      quantity_state: options.quantityState ?? 'unknown',
      quantity_sufficiency: 'unknown',
    },
    ...(options.feedback
      ? {
          feedback_token: String(position + 1).padStart(64, 'a').slice(-64),
          user_override: null,
          identity_feedback: null,
          feedback_capabilities: {
            availability_override: true,
            identity: Boolean(options.closestMatch || options.matched),
            decision: true,
            assume_have: true,
            select_inventory_product: state !== 'staple',
            reject_current_match: state === 'in_stock' || state === 'staple',
            positive_identity: state !== 'staple',
            negative_identity: Boolean(options.matched),
          },
        }
      : {}),
  }
}

interface DetailResponseOptions {
  closestMatchConfidence?: number
  closestMatchSource?: string
  confirmedMissingCount?: number
  externalOnly?: boolean
  feedbackEnabled?: boolean
  freshnessIsStale?: boolean | null
  groceryAdd?: boolean
  groceryAddReason?: string
  groceryAddState?: 'unavailable' | 'unsupported'
  groceryBlockedReason?: string
  ingredientGroups?: unknown
  ingredientsTruncated?: boolean
  instructionGroups?: unknown
  instructionSteps?: unknown[]
  missingIngredients?: boolean
  noIngredients?: boolean
  optionalTomatoes?: boolean | null
  plannerEnabled?: boolean
  tomatoAmount?: {
    quantity: number | null
    quantityMax: number | null
    text: string | null
    unit: string | null
  }
  uncertainCount?: number
  uncertainIngredients?: boolean
}

function detailResponse({
  closestMatchConfidence = 0.87,
  closestMatchSource = 'taxonomy_alias',
  confirmedMissingCount,
  externalOnly = false,
  feedbackEnabled = false,
  freshnessIsStale = false,
  groceryAdd = true,
  groceryAddReason,
  groceryAddState,
  groceryBlockedReason,
  ingredientGroups,
  ingredientsTruncated = false,
  instructionGroups,
  instructionSteps,
  missingIngredients = true,
  noIngredients = false,
  optionalTomatoes,
  plannerEnabled = false,
  tomatoAmount = { quantity: null, quantityMax: null, text: '1 can', unit: null },
  uncertainCount,
  uncertainIngredients = true,
}: DetailResponseOptions = {}) {
  const ingredients = noIngredients
    ? []
    : [
        ingredient(0, 'tomatoes', missingIngredients ? 'missing' : 'in_stock', {
          displayName: 'Diced Tomatoes',
          quantityState: 'display_only',
          sourceText: '1 can diced tomatoes, drained',
          optional: optionalTomatoes,
          feedback: feedbackEnabled,
          quantity: tomatoAmount.quantity,
          quantityMax: tomatoAmount.quantityMax,
          text: tomatoAmount.text,
          unit: tomatoAmount.unit,
        }),
        ingredient(1, 'Rice', 'in_stock', {
          matched: 'Long grain rice',
          feedback: feedbackEnabled,
          quantityState: 'known',
          relation: 'exact',
          sourceText: '2 c Rice',
          text: '2 cups',
        }),
        ingredient(2, 'Salt', 'staple', { feedback: feedbackEnabled, quantityState: 'display_only', sourceText: 'Salt', text: 'to taste' }),
        ingredient(3, 'Fresh herbs', uncertainIngredients ? 'uncertain' : 'in_stock', {
          closestMatch: uncertainIngredients ? 'Italian parsley' : undefined,
          closestMatchConfidence,
          closestMatchSource,
          feedback: feedbackEnabled,
          matched: uncertainIngredients ? 'Dried herbs' : undefined,
          relation: uncertainIngredients ? 'taxonomy_ancestor' : 'exact',
        }),
      ]

  return {
    response: {
      success: true,
      detail: {
        schema_version: 'recipe_detail_v1',
        id: 42,
        title: 'Pantry Bowl',
        source: {
          connector: externalOnly ? 'cookidoo' : 'manual',
          label: externalOnly ? 'Cookidoo' : 'Manual',
          attribution: externalOnly ? 'Cookidoo' : 'Household recipe',
          external_id: externalOnly ? 'mock-42' : null,
          canonical_url: externalOnly
            ? 'https://cookidoo.example.test/recipes/mock-42'
            : 'https://recipes.example.test/42',
          locale: 'en-US',
          content_language: externalOnly ? 'en' : null,
          rights_basis: externalOnly ? 'provider_metadata_v2' : 'user_authorized',
        },
        images: {
          primary: 'https://images.example.test/pantry-bowl.jpg',
          thumbnail: null,
        },
        general: {
          yield: { quantity: 4, unit: 'servings' },
          prep_time_seconds: 600,
          cook_time_seconds: 1_200,
          active_time_seconds: 1_500,
          inactive_time_seconds: 300,
          total_time_seconds: 3_600,
          difficulty: 'Easy',
          primary_category: 'Dinner',
          devices: ['TM6', 'Oven'],
          optional_devices: ['Slow cooker'],
          equipment: ['Large bowl'],
        },
        planner: {
          available: plannerEnabled,
          account_scope: 'configured_account',
          minimum_date: '2026-08-12',
          maximum_date: '2027-08-12',
          provider_action_token: plannerEnabled ? 'b'.repeat(64) : null,
          reason: plannerEnabled ? null : 'planner_app_disabled',
        },
        ingredients,
        ...(ingredientGroups === undefined ? {} : { ingredient_groups: ingredientGroups }),
        ingredients_truncated: ingredientsTruncated,
        grocery: {
          confirmed_missing_count: confirmedMissingCount ?? (noIngredients ? 0 : missingIngredients ? 1 : 0),
          uncertain_count: uncertainCount ?? (noIngredients ? 0 : uncertainIngredients ? 1 : 0),
          ...(groceryBlockedReason === undefined ? {} : { blocked_reason: groceryBlockedReason }),
        },
        instructions: externalOnly
          ? {
              available: false,
              reason: 'provider_external_only',
              steps: [],
              fallback_url: 'https://cookidoo.example.test/recipes/mock-42',
              truncated: false,
            }
          : {
              available: true,
              reason: null,
              steps: instructionSteps
                ?? ['Combine the prepared ingredients.\nKeep this line break.', '<em>Serve in bowls.</em>'],
              ...(instructionGroups === undefined ? {} : { instruction_groups: instructionGroups }),
              fallback_url: null,
              truncated: false,
            },
        user_state: {
          favorite: false,
          hidden: false,
          rating: null,
          note: '',
          cooked_count: 0,
          last_cooked: null,
        },
        freshness: {
          retrieved_at: '2026-08-07T18:00:00Z',
          stale_at: '2026-08-14T18:00:00Z',
          updated_at: '2026-08-07T18:00:00Z',
          is_stale: freshnessIsStale,
        },
        revision: { inventory: 1, ranking: 2, catalog: 3 },
        capabilities: {
          general: 'full',
          ingredients: noIngredients ? 'none' : 'checklist',
          instructions: externalOnly ? 'external_link' : 'local',
          quantities: externalOnly ? 'display_only' : 'known',
          grocery_add: groceryAdd,
          ingredient_feedback: feedbackEnabled,
          ingredient_feedback_v2: feedbackEnabled,
          planner: plannerEnabled,
          ...(groceryAddState === undefined ? {} : { grocery_add_state: groceryAddState }),
          ...(groceryAddReason === undefined ? {} : { grocery_add_reason: groceryAddReason }),
        },
      },
    },
  }
}

function normalizedDetail(options: Parameters<typeof detailResponse>[0] = {}): RecipeDetail {
  const result = normalizeRecipeDetailServiceResult(detailResponse(options))
  if (result.kind !== 'detail') throw new Error('Expected normalized recipe detail')
  return result.detail
}

function grocerySuccessResponse() {
  return {
    response: {
      success: true,
      replayed: false,
      outcomes: [],
      ha_mirror: {
        success: true,
        summary: { added: 1, already_present: 0, skipped: 0, failed: 0 },
      },
      summary: {
        backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
        ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
      },
    },
  }
}

function Harness() {
  const controller = useRecipeDetailModalController()
  return (
    <>
      <button onClick={() => controller.openRecipe(recipe)} type="button">Open test recipe</button>
      <output data-testid="selected-recipe">{controller.selectedRecipe?.id ?? 'none'}</output>
      <RecipeDetailModal controller={controller} />
    </>
  )
}

async function openRecipe() {
  const opener = screen.getByRole('button', { name: 'Open test recipe' })
  opener.focus()
  fireEvent.click(opener)
  return screen.findByRole('dialog')
}

async function openTab(dialog: HTMLElement, name: 'General' | 'Ingredients' | 'Instructions') {
  fireEvent.click(within(dialog).getByRole('tab', { name }))
  await waitFor(() => expect(within(dialog).getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true'))
  await waitFor(() => expect(within(dialog).getByRole('tabpanel', { name })).toBeInTheDocument())
}

function selectedTabPanel(dialog: HTMLElement) {
  const selectedTabs = within(dialog).getAllByRole('tab').filter(
    (tab) => tab.getAttribute('aria-selected') === 'true',
  )
  expect(selectedTabs).toHaveLength(1)
  const panelId = selectedTabs[0].getAttribute('aria-controls')
  expect(panelId).toBeTruthy()
  const panel = panelId ? document.getElementById(panelId) : null
  expect(panel).toBeInTheDocument()
  expect(dialog).toContainElement(panel)
  return { panel: panel as HTMLElement, panelId: panelId as string, selectedTab: selectedTabs[0] }
}

describe('RecipeDetailModal', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('keeps modal tabs, recipe actions, external links, and close available to keyboard focus', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({ externalOnly: true }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')

      const generalTab = within(dialog).getByRole('tab', { name: 'General' })
      const sourceLink = within(dialog).getByRole('link', { name: 'Open in Cookidoo' })
      const closeButton = within(dialog).getByRole('button', { name: 'Close' })
      for (const control of [generalTab, sourceLink, closeButton]) {
        control.focus()
        expect(control).toHaveFocus()
      }

      await openTab(dialog, 'Ingredients')
      const groceryButton = within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
      groceryButton.focus()
      expect(groceryButton).toHaveFocus()

      await openTab(dialog, 'Instructions')
      const cookidooLink = within(dialog).getByRole('link', { name: 'Open in Cookidoo' })
      cookidooLink.focus()
      expect(cookidooLink).toHaveFocus()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps the selected tab pointed at one mounted panel throughout Arrow, Home, and End transitions', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail' ? Promise.resolve(detailResponse()) : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')

      const initial = selectedTabPanel(dialog)
      expect(initial.selectedTab).toHaveAccessibleName('General')
      expect(initial.panel).toHaveAccessibleName('General')

      fireEvent.keyDown(initial.selectedTab, { key: 'ArrowRight' })
      const arrowTransition = selectedTabPanel(dialog)
      expect(arrowTransition.selectedTab).toHaveAccessibleName('Ingredients')
      expect(arrowTransition.panelId).toBe(initial.panelId)
      expect(arrowTransition.panel).toBe(initial.panel)
      await waitFor(() => expect(arrowTransition.panel).toHaveAccessibleName('Ingredients'))

      fireEvent.keyDown(arrowTransition.selectedTab, { key: 'Home' })
      const homeTransition = selectedTabPanel(dialog)
      expect(homeTransition.selectedTab).toHaveAccessibleName('General')
      expect(homeTransition.panelId).toBe(initial.panelId)
      expect(homeTransition.panel).toBe(initial.panel)
      await waitFor(() => expect(homeTransition.panel).toHaveAccessibleName('General'))

      fireEvent.keyDown(homeTransition.selectedTab, { key: 'End' })
      const endTransition = selectedTabPanel(dialog)
      expect(endTransition.selectedTab).toHaveAccessibleName('Instructions')
      expect(endTransition.panelId).toBe(initial.panelId)
      expect(endTransition.panel).toBe(initial.panel)
      await waitFor(() => expect(endTransition.panel).toHaveAccessibleName('Instructions'))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('shows a centered loader, structured unsupported state, and ordinary errors without closing', async () => {
    const originalCallService = mockState.helpers.callService
    let resolveDetail: ((value: unknown) => void) | undefined
    mockState.helpers.callService = (params) => (
      params.domain === 'evershelf' && params.service === 'recipe_detail'
        ? new Promise((resolve) => {
            resolveDetail = resolve
          })
        : originalCallService(params)
    )

    try {
      const { unmount } = render(<Harness />)
      const dialog = await openRecipe()
      expect(within(dialog).getByRole('status', { name: 'Loading recipe details' })).toBeInTheDocument()

      await act(async () => resolveDetail?.({
        response: {
          success: false,
          error_kind: 'unsupported',
          error: 'unsupported_capability',
          required_capability: 'recipe_detail_v1',
        },
      }))
      expect(await within(dialog).findByText('Recipe Details Unsupported')).toBeInTheDocument()
      expect(within(dialog).getByText(/installed EverShelf\/ha-evershelf version/i)).toBeInTheDocument()
      expect(dialog).toHaveAttribute('data-state', 'open')
      unmount()

      mockState.helpers.callService = (params) => (
        params.domain === 'evershelf' && params.service === 'recipe_detail'
          ? Promise.resolve({
              response: {
                success: false,
                error_kind: 'unavailable',
                error: 'unsupported_capability',
                required_capability: 'recipe_detail_v1',
                message: 'Recipe capability probe timed out. Please try again.',
              },
            })
          : originalCallService(params)
      )
      const transient = render(<Harness />)
      const transientDialog = await openRecipe()
      expect(await within(transientDialog).findByText('Unable to Load Recipe')).toBeInTheDocument()
      expect(within(transientDialog).getByText('Recipe capability probe timed out. Please try again.')).toBeInTheDocument()
      expect(within(transientDialog).queryByText('Recipe Details Unsupported')).not.toBeInTheDocument()
      expect(within(transientDialog).queryByText(/installed EverShelf\/ha-evershelf version/i)).not.toBeInTheDocument()
      transient.unmount()

      mockState.helpers.callService = (params) => (
        params.domain === 'evershelf' && params.service === 'recipe_detail'
          ? Promise.reject(new Error('Detail request failed safely'))
          : originalCallService(params)
      )
      render(<Harness />)
      const errorDialog = await openRecipe()
      expect(await within(errorDialog).findByText('Unable to Load Recipe')).toBeInTheDocument()
      expect(within(errorDialog).getByText('Detail request failed safely')).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('renders all local tabs, factual formatting, read-only inventory states, and one missing-only grocery command', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let resolveGrocery: ((value: unknown) => void) | undefined
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.domain === 'evershelf' && params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.domain === 'evershelf' && params.service === 'recipe_grocery_add') {
        return new Promise((resolve) => {
          resolveGrocery = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      expect(await within(dialog).findByText('Serves 4')).toBeInTheDocument()
      expect(within(dialog).getByText('10 min')).toBeInTheDocument()
      expect(within(dialog).getByText('20 min')).toBeInTheDocument()
      expect(within(dialog).getByText('25 min')).toBeInTheDocument()
      expect(within(dialog).getByText('5 min')).toBeInTheDocument()
      expect(within(dialog).getByText('1 hr')).toBeInTheDocument()
      expect(within(dialog).getAllByRole('group')).toHaveLength(11)
      expect(within(dialog).getByRole('group', { name: 'Yield Serves 4' })).toHaveAttribute('data-icon', 'mdi:account-group')
      expect(within(dialog).getByRole('group', { name: 'Prep Time 10 min' })).toHaveAttribute('data-icon', 'mdi:timer-cog')
      expect(within(dialog).getByRole('group', { name: 'Cook Time 20 min' })).toHaveAttribute('data-icon', 'mdi:pot-steam')
      expect(within(dialog).getByRole('group', { name: 'Active Time 25 min' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Inactive/Rest Time 5 min' })).toHaveAttribute('data-icon', 'mdi:pause-circle')
      expect(within(dialog).getByRole('group', { name: 'Total Time 1 hr' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Difficulty Easy' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Category Dinner' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Source Household recipe' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Locale en-US' })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Freshness Current Aug 7, 2026' })).toHaveAttribute('data-tone', 'ok')
      expect(within(dialog).getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
      expect(within(dialog).getByText('TM6')).toBeInTheDocument()
      expect(within(dialog).getByText('Oven')).toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: 'Optional Devices' })).toBeInTheDocument()
      expect(within(dialog).getByText('Slow cooker')).toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: 'Additional Equipment' })).toBeInTheDocument()
      expect(within(dialog).queryByText(/Required Equipment/i)).not.toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: 'Open Source Recipe' })).toHaveAttribute('href', 'https://recipes.example.test/42')
      expect(dialog.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer')

      const generalTab = within(dialog).getByRole('tab', { name: 'General' })
      generalTab.focus()
      fireEvent.keyDown(generalTab, { key: 'ArrowRight' })
      await waitFor(() => expect(within(dialog).getByRole('tabpanel', { name: 'Ingredients' })).toBeInTheDocument())
      await waitFor(() => expect(within(dialog).getByRole('tab', { name: 'Ingredients' })).toHaveFocus())
      expect(await within(dialog).findByRole('group', { name: /Diced Tomatoes · 1 can: Missing from inventory/ })).toHaveAttribute('data-status', 'unchecked')
      expect(within(dialog).getByRole('group', { name: /Rice · 2 cups: Exact inventory match/ })).toHaveAttribute('data-status', 'checked')
      expect(within(dialog).getByRole('group', { name: /Fresh herbs: Inventory match uncertain/ })).toHaveAttribute('data-status', 'unchecked')
      expect(within(dialog).getByText('Product: Long grain rice')).toBeInTheDocument()
      expect(within(dialog).getByText('Diced Tomatoes · 1 can')).toBeInTheDocument()
      expect(within(dialog).getAllByText('Source quantity is display-only').length).toBeGreaterThan(0)
      expect(within(dialog).queryByText(/Source amount:/)).not.toBeInTheDocument()
      expect(within(dialog).getByText('Source: diced tomatoes, drained')).toBeInTheDocument()
      expect(within(dialog).getByText('Matched as Italian parsley')).toBeInTheDocument()
      expect(within(dialog).getAllByText(/^Matched as /)).toHaveLength(1)
      expect(within(dialog).queryByText(/Taxonomy inventory match/)).not.toBeInTheDocument()
      expect(within(dialog).queryByText('Source: Salt')).not.toBeInTheDocument()
      expect(within(dialog).queryByText('Source: 2 c Rice')).not.toBeInTheDocument()
      expect(within(dialog).getAllByText(/Quantity sufficiency is unknown/).length).toBeGreaterThan(0)
      expect([...dialog.querySelectorAll('[data-read-only="true"]')].every((row) => !row.hasAttribute('aria-pressed'))).toBe(true)

      const groceryButton = within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
      expect(groceryButton).toBeEnabled()
      fireEvent.click(groceryButton)
      expect(groceryButton).toBeDisabled()
      expect(within(dialog).getByText('Adding missing ingredients…')).toBeInTheDocument()
      fireEvent.click(groceryButton)
      expect(calls.filter((call) => call.service === 'recipe_grocery_add')).toHaveLength(1)
      await act(async () => resolveGrocery?.({
        response: {
          success: true,
          replayed: false,
          outcomes: [],
          ha_mirror: {
            success: true,
            summary: { added: 1, already_present: 0, skipped: 0, failed: 0 },
          },
          summary: {
            backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
            ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
          },
        },
      }))
      await within(dialog).findByText(/EverShelf: 1 added\./)
      expect(groceryButton).toBeDisabled()
      expect(within(dialog).getByText('Missing ingredients were submitted.')).toBeInTheDocument()
      fireEvent.click(groceryButton)

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(1)
      expect(groceryCalls[0]).toMatchObject({
        domain: 'evershelf',
        returnResponse: true,
        service: 'recipe_grocery_add',
        serviceData: {
          recipe_id: 42,
          selections: [{ key: 'ri:0:0000000000000001', position: 0 }],
          todo_entity_id: 'todo.shopping_list',
        },
      })
      expect((groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key).toMatch(
        /^[A-Za-z0-9._:-]{1,128}$/,
      )
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('omits unavailable time and device facts while preserving available equipment', async () => {
    const originalCallService = mockState.helpers.callService
    const response = detailResponse() as unknown as {
      response: {
        detail: {
          general: Record<string, unknown>
        }
      }
    }
    Object.assign(response.response.detail.general, {
      prep_time_seconds: null,
      cook_time_seconds: null,
      inactive_time_seconds: null,
      devices: [],
      optional_devices: [],
    })
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(response)
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      expect(within(dialog).queryByRole('group', { name: /Prep Time/ })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('group', { name: /Cook Time/ })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('group', { name: /Inactive\/Rest Time/ })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: 'Optional Devices' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: 'Additional Equipment' })).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('opens an inventory picker without writes and Back submits assume_have only', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      if (params.service === 'list_inventory') {
        return Promise.resolve({
          response: {
            inventory: [
              { product_id: 501, name: 'Fresh parsley', quantity: 2, unit: 'bunch' },
            ],
          },
        })
      }
      if (params.service === 'recipe_ingredient_decision') {
        return Promise.resolve({ response: { success: true } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      const uncertain = await within(dialog).findByRole('button', {
        name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
      })
      expect(uncertain).toHaveAttribute('data-status', 'unchecked')
      fireEvent.click(uncertain)
      expect(await within(dialog).findByRole('heading', { name: /Choose Product for Fresh herbs/ })).toBeInTheDocument()
      expect(within(dialog).getByRole('searchbox', { name: 'Search inventory products' })).toBeInTheDocument()
      expect(within(dialog).getByRole('tablist', { name: 'Pantry Bowl sections' })).toBeInTheDocument()
      expect(calls.filter((call) => call.service === 'recipe_ingredient_decision')).toHaveLength(0)

      fireEvent.click(within(dialog).getByRole('button', { name: 'Back and mark ingredient available' }))
      expect(await within(dialog).findByText('Ingredient marked available without AI evidence.')).toBeInTheDocument()
      const decisions = calls.filter((call) => call.service === 'recipe_ingredient_decision')
      expect(decisions).toHaveLength(1)
      expect(decisions[0]).toMatchObject({
        serviceData: {
          action: 'assume_have',
          action_origin: 'react_dashboard',
          ingredient_key: 'ri:3:0000000000000004',
          recipe_id: 42,
        },
      })
      expect((decisions[0].serviceData as Record<string, unknown>)).not.toHaveProperty('selected_product_id')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('selects one product-level inventory ID atomically and displays the correction optimistically', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let resolveDecision: ((value: unknown) => void) | undefined
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      if (params.service === 'list_inventory') {
        return Promise.resolve({
          response: {
            inventory: [
              { inventory_id: 1, product_id: 501, name: 'Fresh parsley', quantity: 1, unit: 'bunch' },
              { inventory_id: 2, product_id: 501, name: 'Fresh parsley', quantity: 1, unit: 'bunch' },
            ],
          },
        })
      }
      if (params.service === 'recipe_ingredient_decision') {
        return new Promise((resolve) => {
          resolveDecision = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      fireEvent.click(await within(dialog).findByRole('button', {
        name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
      }))
      const choices = await within(dialog).findAllByRole('button', { name: /Fresh parsley/ })
      expect(choices).toHaveLength(1)
      expect(choices[0]).toHaveAttribute('data-product-id', '501')
      fireEvent.click(choices[0])

      expect(await within(dialog).findByText('Product: Fresh parsley')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', {
        name: /Fresh herbs: Inventory match uncertain.*Activate to mark missing/,
      })).toHaveAttribute('data-status', 'checked')
      const decision = calls.find((call) => call.service === 'recipe_ingredient_decision')
      expect(decision).toMatchObject({
        serviceData: {
          action: 'select_inventory_product',
          selected_product_id: 501,
          ingredient_key: 'ri:3:0000000000000004',
        },
      })
      await act(async () => resolveDecision?.({ response: { success: true } }))
      expect(await within(dialog).findByText(/queued for ontology review/)).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reuses a decision idempotency key after an ambiguous transport failure', async () => {
    const originalCallService = mockState.helpers.callService
    const keys: string[] = []
    let attempts = 0
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      if (params.service === 'list_inventory') return Promise.resolve({ response: { inventory: [] } })
      if (params.service === 'recipe_ingredient_decision') {
        attempts += 1
        keys.push(String((params.serviceData as { idempotency_key?: string }).idempotency_key))
        return attempts === 1
          ? Promise.reject(new Error('Connection lost after submit'))
          : Promise.resolve({ response: { success: true } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      const openPicker = async () => {
        fireEvent.click(await within(dialog).findByRole('button', {
          name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
        }))
        await within(dialog).findByRole('button', { name: 'Back and mark ingredient available' })
      }
      await openPicker()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back and mark ingredient available' }))
      expect(await within(dialog).findByText('Connection lost after submit')).toBeInTheDocument()
      await openPicker()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back and mark ingredient available' }))
      expect(await within(dialog).findByText('Ingredient marked available without AI evidence.')).toBeInTheDocument()
      expect(keys).toHaveLength(2)
      expect(keys[1]).toBe(keys[0])
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reloads detail after a stale atomic decision token', async () => {
    const originalCallService = mockState.helpers.callService
    let detailCalls = 0
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') {
        detailCalls += 1
        return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      }
      if (params.service === 'list_inventory') return Promise.resolve({ response: { inventory: [] } })
      if (params.service === 'recipe_ingredient_decision') {
        return Promise.resolve({ response: { success: false, error: 'ingredient_feedback_stale' } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      fireEvent.click(await within(dialog).findByRole('button', {
        name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
      }))
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Back and mark ingredient available' }))
      await waitFor(() => expect(detailCalls).toBe(2))
      expect(await within(dialog).findByText('ingredient_feedback_stale')).toBeInTheDocument()
      expect(within(dialog).queryByText(/^Your override:/)).not.toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('rejects exact checked products while staples submit availability-only intent', async () => {
    const originalCallService = mockState.helpers.callService
    const decisions: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      if (params.service === 'recipe_ingredient_decision') {
        decisions.push(params.serviceData as Record<string, unknown>)
        return Promise.resolve({ response: { success: true } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      fireEvent.click(await within(dialog).findByRole('button', {
        name: /Rice · 2 cups: Exact inventory match.*Activate to mark missing/,
      }))
      await within(dialog).findByText(/exact match feedback was queued/)
      fireEvent.click(within(dialog).getByRole('button', {
        name: /Salt · to taste: Staple.*Activate to mark missing/,
      }))
      await waitFor(() => expect(decisions).toHaveLength(2))
      expect(decisions[0]).toMatchObject({
        action: 'reject_current_match',
        expected_target_product_id: 101,
      })
      expect(decisions[1]).toMatchObject({ action: 'reject_current_match' })
      expect(decisions[1]).not.toHaveProperty('expected_target_product_id')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reopens the picker after rejecting an exact match and reselects the same product', async () => {
    const originalCallService = mockState.helpers.callService
    const decisions: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') {
        return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      }
      if (params.service === 'list_inventory') {
        return Promise.resolve({
          response: {
            inventory: [
              { inventory_id: 10, product_id: 101, name: 'Rice', quantity: 2, unit: 'cups' },
            ],
          },
        })
      }
      if (params.service === 'recipe_ingredient_decision') {
        decisions.push(params.serviceData as Record<string, unknown>)
        return Promise.resolve({ response: { success: true } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      fireEvent.click(await within(dialog).findByRole('button', {
        name: /Rice · 2 cups: Exact inventory match.*Activate to mark missing/,
      }))
      await within(dialog).findByText(/exact match feedback was queued/)

      const rejected = within(dialog).getByRole('button', {
        name: /Rice · 2 cups:.*Activate to choose an inventory product/,
      })
      expect(rejected).toHaveAttribute('data-status', 'unchecked')
      fireEvent.click(rejected)

      expect(await within(dialog).findByRole('heading', {
        name: /Choose Product for Rice/,
      })).toBeInTheDocument()
      const sameProduct = (await within(dialog).findAllByRole('button', {
        name: /Rice/,
      })).find((choice) => choice.getAttribute('data-product-id') === '101')
      expect(sameProduct).toBeDefined()
      fireEvent.click(sameProduct!)

      expect(await within(dialog).findByText('Product: Rice')).toBeInTheDocument()
      await waitFor(() => expect(decisions).toHaveLength(2))
      expect(decisions[0]).toMatchObject({
        action: 'reject_current_match',
        expected_target_product_id: 101,
      })
      expect(decisions[1]).toMatchObject({
        action: 'select_inventory_product',
        selected_product_id: 101,
      })
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('cancels the picker on tab navigation without writing and keeps the tab bar anchored', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse({ feedbackEnabled: true }))
      if (params.service === 'list_inventory') return Promise.resolve({ response: { inventory: [] } })
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await openTab(dialog, 'Ingredients')
      fireEvent.click(await within(dialog).findByRole('button', {
        name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/,
      }))
      expect(await within(dialog).findByRole('searchbox', { name: 'Search inventory products' })).toBeInTheDocument()
      const tabs = within(dialog).getByRole('tablist', { name: 'Pantry Bowl sections' })
      expect(tabs.parentElement?.className).toContain('pickerFooterStack')
      fireEvent.click(within(dialog).getByRole('tab', { name: 'General' }))
      await waitFor(() => expect(within(dialog).getByRole('tabpanel', { name: 'General' })).toBeInTheDocument())
      expect(within(dialog).queryByRole('searchbox', { name: 'Search inventory products' })).not.toBeInTheDocument()
      expect(calls.filter((call) => call.service === 'recipe_ingredient_decision')).toHaveLength(0)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('separates Open in Cookidoo from a bounded account-level My Week planner flow', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') {
        return Promise.resolve(detailResponse({
          externalOnly: true,
          plannerEnabled: true,
        }))
      }
      if (params.service === 'recipe_planner_add') {
        return Promise.resolve({
          response: {
            success: true,
            changed: true,
            already_present: false,
            verified: true,
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      expect(await within(dialog).findByRole('link', { name: 'Open in Cookidoo' })).toBeInTheDocument()
      const addButton = within(dialog).getByRole('button', { name: 'Add to My Week' })
      fireEvent.click(addButton)
      expect(await within(dialog).findByRole('heading', { name: 'Add to My Week' })).toBeInTheDocument()
      expect(within(dialog).getByText(/configured Cookidoo account/)).toBeInTheDocument()
      const dateInput = within(dialog).getByLabelText('Cookidoo My Week date')
      expect(dateInput).toHaveAttribute('min', '2026-08-12')
      expect(dateInput).toHaveAttribute('max', '2027-08-12')
      fireEvent.change(dateInput, { target: { value: '2026-08-20' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add to My Week' }))
      expect(await within(dialog).findByText('Recipe added to Cookidoo My Week.')).toBeInTheDocument()
      const plannerCalls = calls.filter((call) => call.service === 'recipe_planner_add')
      expect(plannerCalls).toHaveLength(1)
      expect(plannerCalls[0]).toMatchObject({
        serviceData: {
          recipe_id: 42,
          date: '2026-08-20',
          provider_action_token: 'b'.repeat(64),
        },
      })
      expect(plannerCalls[0].serviceData).not.toHaveProperty('external_id')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('cancels a planner sub-page with Back without a service write', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') {
        return Promise.resolve(detailResponse({ externalOnly: true, plannerEnabled: true }))
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Add to My Week' }))
      expect(await within(dialog).findByRole('button', { name: 'Back to recipe' })).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back to recipe' }))
      expect(await within(dialog).findByRole('button', { name: 'Add to My Week' })).toBeInTheDocument()
      expect(calls.filter((call) => call.service === 'recipe_planner_add')).toHaveLength(0)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reuses a planner idempotency key after an ambiguous transport failure', async () => {
    const originalCallService = mockState.helpers.callService
    const keys: string[] = []
    let attempts = 0
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') {
        return Promise.resolve(detailResponse({ externalOnly: true, plannerEnabled: true }))
      }
      if (params.service === 'recipe_planner_add') {
        attempts += 1
        keys.push(String((params.serviceData as { idempotency_key: string }).idempotency_key))
        return attempts === 1
          ? Promise.reject(new Error('Planner response was lost'))
          : Promise.resolve({ response: { success: true, already_present: true, verified: true } })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Add to My Week' }))
      const dateInput = await within(dialog).findByLabelText('Cookidoo My Week date')
      fireEvent.change(dateInput, { target: { value: '2026-08-20' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add to My Week' }))
      expect(await within(dialog).findByText('Planner response was lost')).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add to My Week' }))
      expect(await within(dialog).findByText(/already in Cookidoo My Week/)).toBeInTheDocument()
      expect(keys).toHaveLength(2)
      expect(keys[1]).toBe(keys[0])
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('renders labeled ingredient groups in order with inline ranges, optional state, and an orphan section', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({
            ingredientGroups: [
              {
                key: 'group:produce',
                index: 0,
                label: 'Produce',
                ingredient_keys: [
                  'ri:0:0000000000000001',
                  'ri:1:0000000000000002',
                ],
                positions: [0, 1],
              },
              {
                key: 'group:pantry',
                index: 1,
                label: 'Pantry',
                ingredientKeys: ['ri:2:0000000000000003'],
                positions: [2],
              },
            ],
            optionalTomatoes: true,
            tomatoAmount: {
              quantity: 1.5,
              quantityMax: 2,
              text: null,
              unit: 'cups',
            },
          }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const panel = within(dialog).getByRole('tabpanel', { name: 'Ingredients' })
      const headings = within(panel).getAllByRole('heading')
      expect(headings.map((heading) => heading.textContent)).toEqual(['Produce', 'Pantry', 'Other Ingredients'])
      expect(headings[2]).toHaveAttribute('data-subdued', 'true')
      expect(within(panel).getByText('Diced Tomatoes · 1.5–2 cups')).toBeInTheDocument()
      expect(within(panel).getAllByText('Optional')).toHaveLength(1)
      expect(within(panel).queryByText(/Source amount:/)).not.toBeInTheDocument()
      expect(panel.querySelectorAll('[data-read-only="true"]')).toHaveLength(4)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('uses subdued numbered headings for multiple unlabeled ingredient groups', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({
            ingredientGroups: [
              {
                key: 'group:first',
                index: 0,
                label: null,
                ingredient_keys: ['ri:0:0000000000000001', 'ri:1:0000000000000002'],
              },
              {
                key: 'group:second',
                index: 1,
                label: '',
                ingredient_keys: ['ri:2:0000000000000003', 'ri:3:0000000000000004'],
              },
            ],
          }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const panel = within(dialog).getByRole('tabpanel', { name: 'Ingredients' })
      expect(within(panel).getByRole('heading', { name: 'Section 1' })).toHaveAttribute('data-subdued', 'true')
      expect(within(panel).getByRole('heading', { name: 'Section 2' })).toHaveAttribute('data-subdued', 'true')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('omits a heading for one unlabeled ingredient group and does not treat null optional state as optional', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({
            ingredientGroups: [{
              key: 'group:all',
              index: 0,
              label: null,
              ingredient_keys: [
                'ri:0:0000000000000001',
                'ri:1:0000000000000002',
                'ri:2:0000000000000003',
                'ri:3:0000000000000004',
              ],
            }],
            optionalTomatoes: null,
          }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const panel = within(dialog).getByRole('tabpanel', { name: 'Ingredients' })
      expect(within(panel).queryByRole('heading')).not.toBeInTheDocument()
      expect(within(panel).queryByText('Optional')).not.toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reports every applicable backend and Home Assistant mirror category truthfully', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        return Promise.resolve({
          response: {
            success: true,
            summary: {
              backend: {
                added: 1,
                already_listed: 2,
                now_in_stock: 3,
                unresolved: 0,
                failed: 0,
              },
              ha_mirror: {
                added: 4,
                already_present: 1,
                skipped: 2,
                failed: 0,
              },
            },
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const groceryButton = within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
      fireEvent.click(groceryButton)

      expect(await within(dialog).findByRole('status')).toHaveTextContent(
        'EverShelf: 1 added, 2 already listed, 3 now in stock. '
          + 'Home Assistant mirror: 4 added, 1 already present, 2 skipped.',
      )
      expect(groceryButton).toBeDisabled()
      expect(within(dialog).getByText('Missing ingredients were submitted.')).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it.each([
    {
      absentCopy: [
        'EverShelf did not report service success.',
        'Home Assistant mirror did not report service success.',
        'Recipe grocery service did not report complete success.',
      ],
      expectedCopy: [
        'EverShelf: 1 added.',
        'Home Assistant mirror: 1 added.',
      ],
      label: 'full success',
      response: {
        success: true,
        summary: {
          backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
          ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
        },
      },
      role: 'status',
    },
    {
      absentCopy: [
        'EverShelf did not report service success.',
        'Home Assistant mirror did not report service success.',
        'Recipe grocery service did not report complete success.',
      ],
      expectedCopy: [
        'EverShelf: 1 added.',
        'Home Assistant mirror: unavailable in the development fallback.',
      ],
      label: 'development fallback success',
      response: {
        success: true,
        summary: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
      },
      role: 'status',
    },
    {
      absentCopy: [
        'Home Assistant mirror did not report service success.',
        'Recipe grocery service did not report complete success.',
      ],
      expectedCopy: [
        'EverShelf: 1 added.',
        'EverShelf outcome details were truncated.',
        'Home Assistant mirror: 1 added.',
      ],
      label: 'truncated backend outcomes',
      response: {
        success: true,
        outcomes_truncated: true,
        summary: {
          backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
          ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
        },
      },
      role: 'alert',
    },
    {
      absentCopy: [
        'EverShelf did not report service success.',
        'Home Assistant mirror did not report service success.',
      ],
      expectedCopy: [
        'EverShelf: 1 added.',
        'Home Assistant mirror: 1 added.',
        'Recipe grocery service did not report complete success.',
      ],
      label: 'neutral aggregate mismatch',
      response: {
        success: false,
        partial_failure: true,
        summary: {
          backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
          ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
        },
      },
      role: 'alert',
    },
    {
      absentCopy: [
        'Home Assistant mirror did not report service success.',
        'Recipe grocery service did not report complete success.',
      ],
      expectedCopy: [
        'EverShelf: 1 added.',
        'EverShelf did not report service success.',
        'EverShelf message: Backend status unavailable',
        'Home Assistant mirror: 1 added.',
      ],
      label: 'bounded backend error signal',
      response: {
        success: false,
        partial_failure: true,
        backend_message: 'Backend status unavailable',
        summary: {
          backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
          ha_mirror: { added: 1, already_present: 0, skipped: 0, failed: 0 },
        },
      },
      role: 'alert',
    },
  ])('attributes $label grocery feedback without blaming the wrong system', async ({
    absentCopy,
    expectedCopy,
    response,
    role,
  }) => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') return Promise.resolve({ response })
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      const feedback = await within(dialog).findByRole(role)
      expectedCopy.forEach((copy) => expect(feedback).toHaveTextContent(copy))
      absentCopy.forEach((copy) => expect(feedback).not.toHaveTextContent(copy))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it.each([
    {
      backend: { added: 0, already_listed: 0, now_in_stock: 0, unresolved: 1, failed: 0 },
      backendCopy: 'EverShelf: 1 unresolved.',
      label: 'unresolved-only',
      mirror: { added: 0, already_present: 0, skipped: 1, failed: 0 },
      mirrorCopy: 'Home Assistant mirror: 1 skipped.',
    },
    {
      backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 1, failed: 0 },
      backendCopy: 'EverShelf: 1 added, 1 unresolved.',
      label: 'mixed added and unresolved',
      mirror: { added: 1, already_present: 0, skipped: 1, failed: 0 },
      mirrorCopy: 'Home Assistant mirror: 1 added, 1 skipped.',
    },
  ])('keeps retry available and rotates the command key for a $label backend result', async ({
    backend,
    backendCopy,
    mirror,
    mirrorCopy,
  }) => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let groceryAttempt = 0
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        groceryAttempt += 1
        return groceryAttempt === 1
          ? Promise.resolve({
              response: {
                success: true,
                summary: {
                  backend,
                  ha_mirror: mirror,
                },
              },
            })
          : Promise.resolve(grocerySuccessResponse())
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const groceryButton = within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' })

      fireEvent.click(groceryButton)
      const alert = await within(dialog).findByRole('alert')
      expect(alert).toHaveTextContent(backendCopy)
      expect(alert).toHaveTextContent(mirrorCopy)
      expect(alert).not.toHaveTextContent('Recipe grocery service did not report complete success.')
      expect(groceryButton).toBeEnabled()
      expect(within(dialog).queryByText('Missing ingredients were submitted.')).not.toBeInTheDocument()

      fireEvent.click(groceryButton)
      await within(dialog).findByText(/EverShelf: 1 added\./)

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(2)
      expect((groceryCalls[1].serviceData as { idempotency_key: string }).idempotency_key).not.toBe(
        (groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key,
      )
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it.each(['taxonomy_rule', 'semantic_similarity'])(
    'discards high-confidence broad closest-match source %s before rendering',
    async (closestMatchSource) => {
      const originalCallService = mockState.helpers.callService
      mockState.helpers.callService = (params) => (
        params.service === 'recipe_detail'
          ? Promise.resolve(detailResponse({ closestMatchConfidence: 1, closestMatchSource }))
          : originalCallService(params)
      )

      try {
        render(<Harness />)
        const dialog = await openRecipe()
        await within(dialog).findByText('Serves 4')
        await openTab(dialog, 'Ingredients')
        expect(within(dialog).getByRole('group', { name: /Fresh herbs: Inventory match uncertain/ })).toBeInTheDocument()
        expect(within(dialog).queryByText('Matched as Italian parsley')).not.toBeInTheDocument()
        expect(within(dialog).queryAllByText(/^Matched as /)).toHaveLength(0)
      } finally {
        mockState.helpers.callService = originalCallService
      }
    },
  )

  it('reports HA-mirror-only partial failure and reuses the grocery command key', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        return Promise.resolve({
          response: {
            success: false,
            partial_failure: true,
            summary: {
              backend: { added: 1, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 0 },
              ha_mirror: { added: 0, already_present: 0, skipped: 0, failed: 1 },
            },
            ha_mirror: { message: 'Todo mirror unavailable' },
          },
        })

      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      const alert = await within(dialog).findByRole('alert')
      expect(alert).toHaveTextContent('EverShelf: 1 added.')
      expect(alert).toHaveTextContent('Home Assistant mirror: 1 failed.')
      expect(alert).not.toHaveTextContent('EverShelf did not report service success.')
      expect(alert).toHaveTextContent('Home Assistant mirror did not report service success.')
      expect(alert).toHaveTextContent('Home Assistant mirror message: Todo mirror unavailable')
      expect(alert).not.toHaveTextContent('Recipe grocery service did not report complete success.')
      expect(dialog).toHaveAttribute('data-state', 'open')

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(1)
      expect(groceryCalls[0]).toMatchObject({
        domain: 'evershelf',
        returnResponse: true,
        service: 'recipe_grocery_add',
        serviceData: {
          recipe_id: 42,
          selections: [{ key: 'ri:0:0000000000000001', position: 0 }],
          todo_entity_id: 'todo.shopping_list',
        },
      })
      expect((groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key).toMatch(
        /^[A-Za-z0-9._:-]{1,128}$/,
      )
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      await waitFor(() => expect(calls.filter((call) => call.service === 'recipe_grocery_add')).toHaveLength(2))
      const retryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect((retryCalls[1].serviceData as { idempotency_key: string }).idempotency_key).toBe(
        (retryCalls[0].serviceData as { idempotency_key: string }).idempotency_key,
      )
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('rotates the grocery command key after a definitive backend partial failure', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let groceryAttempt = 0
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        groceryAttempt += 1
        return groceryAttempt === 1
          ? Promise.resolve({
              response: {
                success: false,
                partial_failure: true,
                summary: {
                  backend: { added: 0, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 1 },
                  ha_mirror: { added: 0, already_present: 0, skipped: 1, failed: 0 },
                },
              },
            })
          : Promise.resolve(grocerySuccessResponse())
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      const alert = await within(dialog).findByRole('alert')
      expect(alert).toHaveTextContent('EverShelf: 1 failed.')
      expect(alert).toHaveTextContent('EverShelf did not report service success.')
      expect(alert).toHaveTextContent('Home Assistant mirror: 1 skipped.')
      expect(alert).not.toHaveTextContent('Home Assistant mirror did not report service success.')
      expect(alert).not.toHaveTextContent('Recipe grocery service did not report complete success.')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      await within(dialog).findByText(/EverShelf: 1 added\./)

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(2)
      expect((groceryCalls[1].serviceData as { idempotency_key: string }).idempotency_key).not.toBe(
        (groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key,
      )
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reuses the grocery command key after a rejected request', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let groceryAttempt = 0
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        groceryAttempt += 1
        return groceryAttempt === 1
          ? Promise.reject(new Error('Temporary grocery request failure'))
          : Promise.resolve(grocerySuccessResponse())
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Temporary grocery request failure')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      await within(dialog).findByText(/EverShelf: 1 added\./)

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(2)
      expect((groceryCalls[1].serviceData as { idempotency_key: string }).idempotency_key).toBe(
        (groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key,
      )
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('rotates the grocery command key on close/reopen and ignores the stale prior response', async () => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    let groceryAttempt = 0
    let resolveFirstGrocery: ((value: unknown) => void) | undefined
    mockState.helpers.callService = (params) => {
      calls.push(params)
      if (params.service === 'recipe_detail') return Promise.resolve(detailResponse())
      if (params.service === 'recipe_grocery_add') {
        groceryAttempt += 1
        if (groceryAttempt === 1) {
          return new Promise((resolve) => {
            resolveFirstGrocery = resolve
          })
        }
        return Promise.resolve(grocerySuccessResponse())
      }
      return originalCallService(params)
    }

    try {
      render(<Harness />)
      const firstDialog = await openRecipe()
      await within(firstDialog).findByText('Serves 4')
      await openTab(firstDialog, 'Ingredients')
      fireEvent.click(within(firstDialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      await waitFor(() => expect(calls.filter((call) => call.service === 'recipe_grocery_add')).toHaveLength(1))

      fireEvent.click(within(firstDialog).getByRole('button', { name: 'Close' }))
      fireEvent.click(screen.getByRole('button', { name: 'Open test recipe', hidden: true }))
      const reopenedDialog = await screen.findByRole('dialog')
      await waitFor(() => expect(within(reopenedDialog).getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true'))
      await within(reopenedDialog).findByText('Serves 4')
      await openTab(reopenedDialog, 'Ingredients')
      fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' }))
      await within(reopenedDialog).findByText(/EverShelf: 1 added\./)

      const groceryCalls = calls.filter((call) => call.service === 'recipe_grocery_add')
      expect(groceryCalls).toHaveLength(2)
      expect((groceryCalls[1].serviceData as { idempotency_key: string }).idempotency_key).not.toBe(
        (groceryCalls[0].serviceData as { idempotency_key: string }).idempotency_key,
      )

      await act(async () => resolveFirstGrocery?.({
        response: {
          success: false,
          partial_failure: true,
          summary: {
            backend: { added: 0, already_listed: 0, now_in_stock: 0, unresolved: 0, failed: 1 },
            ha_mirror: { added: 0, already_present: 0, skipped: 1, failed: 0 },
          },
        },
      }))
      expect(within(reopenedDialog).getByText(/EverShelf: 1 added\./)).toBeInTheDocument()
      expect(within(reopenedDialog).queryByText('EverShelf: 1 failed.')).not.toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it.each([
    {
      copy: 'Ingredients are truncated, so groceries cannot be added safely.',
      label: 'backend ingredients_truncated',
      options: { groceryAdd: false, groceryBlockedReason: 'ingredients_truncated' },
    },
    {
      copy: 'Ingredients are truncated, so groceries cannot be added safely.',
      label: 'old-backend truncation',
      options: { groceryAdd: false, ingredientsTruncated: true },
    },
    {
      copy: 'No ingredient data is available, so groceries cannot be added.',
      label: 'backend no_ingredients',
      options: { groceryAdd: false, groceryBlockedReason: 'no_ingredients', noIngredients: true },
    },
    {
      copy: 'No ingredient data is available, so groceries cannot be added.',
      label: 'old-backend missing ingredient capability',
      options: { groceryAdd: false, noIngredients: true },
    },
    {
      copy: 'Adding missing ingredients is temporarily unavailable. Try again later.',
      label: 'temporarily unavailable capability',
      options: { groceryAdd: false, groceryAddState: 'unavailable' as const },
    },
    {
      copy: 'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.',
      label: 'unsupported capability state',
      options: { groceryAdd: false, groceryAddState: 'unsupported' as const },
    },
    {
      copy: 'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.',
      label: 'unsupported capability reason',
      options: { groceryAdd: false, groceryAddReason: 'unsupported' },
    },
    {
      copy: 'Adding missing ingredients is unavailable for this recipe.',
      label: 'old-backend generic capability denial',
      options: { groceryAdd: false },
    },
    {
      copy: 'Too many missing ingredients to add in one request.',
      label: 'over-limit missing count',
      options: { confirmedMissingCount: 101 },
    },
    {
      copy: "EverShelf can't yet tell which of these 1 ingredients you're missing.",
      label: 'uncertain-only inventory',
      options: { missingIngredients: false, uncertainIngredients: true },
    },
    {
      copy: 'No missing ingredients to add.',
      label: 'supported recipe with no missing ingredients',
      options: { missingIngredients: false, uncertainIngredients: false },
    },
  ])('renders the $label grocery-disabled copy in the modal', async ({ copy, options }) => {
    const originalCallService = mockState.helpers.callService
    const calls: Record<string, unknown>[] = []
    mockState.helpers.callService = (params) => {
      calls.push(params)
      return params.service === 'recipe_detail' ? Promise.resolve(detailResponse(options)) : originalCallService(params)
    }

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Ingredients')
      const groceryButton = within(dialog).getByRole('button', { name: 'Add Missing Ingredients to Groceries' })
      expect(groceryButton).toBeDisabled()
      expect(within(dialog).getByText(copy)).toBeInTheDocument()
      fireEvent.click(groceryButton)
      expect(calls.filter((call) => call.service === 'recipe_grocery_add')).toHaveLength(0)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('uses the adjudicated grocery disabled precedence for every state', () => {
    const idle = { status: 'idle' } as const
    const detail = normalizedDetail()

    expect(recipeGroceryDisabledReason(detail, 'loading', true)).toBe('Adding missing ingredients…')
    expect(recipeGroceryDisabledReason(detail, idle.status, true)).toBe('Missing ingredients were submitted.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: {
        ...detail.capabilities,
        groceryAdd: false,
        groceryAddReason: 'unsupported',
        groceryAddState: 'unavailable',
      },
      grocery: { ...detail.grocery, blockedReason: 'ingredients_truncated' },
    }, idle.status, false)).toBe('Ingredients are truncated, so groceries cannot be added safely.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: { ...detail.capabilities, groceryAdd: false, groceryAddState: 'unavailable' },
      grocery: { ...detail.grocery, blockedReason: 'no_ingredients' },
      ingredientsTruncated: true,
    }, idle.status, false)).toBe('No ingredient data is available, so groceries cannot be added.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: {
        ...detail.capabilities,
        groceryAdd: false,
        groceryAddReason: 'unsupported',
        groceryAddState: 'unavailable',
        ingredients: 'none',
      },
    }, idle.status, false)).toBe('Adding missing ingredients is temporarily unavailable. Try again later.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: { ...detail.capabilities, groceryAdd: false, groceryAddState: 'unsupported' },
    }, idle.status, false)).toBe(
      'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.',
    )
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: { ...detail.capabilities, groceryAdd: false, groceryAddReason: 'unsupported' },
    }, idle.status, false)).toBe(
      'The installed EverShelf/ha-evershelf version does not support recipe grocery adding yet.',
    )
    expect(recipeGroceryDisabledReason({
      ...detail,
      capabilities: { ...detail.capabilities, groceryAdd: false },
    }, idle.status, false)).toBe('Adding missing ingredients is unavailable for this recipe.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      grocery: { ...detail.grocery, confirmedMissingCount: 101 },
    }, idle.status, false)).toBe('Too many missing ingredients to add in one request.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      grocery: { ...detail.grocery, confirmedMissingCount: 0, uncertainCount: 3 },
    }, idle.status, false)).toBe("EverShelf can't yet tell which of these 3 ingredients you're missing.")
    expect(recipeGroceryDisabledReason({
      ...detail,
      grocery: { ...detail.grocery, confirmedMissingCount: 0, uncertainCount: 0 },
    }, idle.status, false)).toBe('No missing ingredients to add.')
    expect(recipeGroceryDisabledReason({
      ...detail,
      ingredients: detail.ingredients.map((ingredient) => (
        ingredient.inventory.state === 'missing'
          ? {
              ...ingredient,
              userOverride: {
                availability: 'have' as const,
                updatedAt: null,
              },
            }
          : ingredient
      )),
    }, idle.status, false)).toBe(
      'All confirmed missing ingredients are marked as available by your overrides.',
    )
    expect(recipeGroceryDisabledReason(detail, idle.status, false)).toBeNull()
  })

  it('maps recipe freshness to warning and unavailable status-pill tones', async () => {
    const originalCallService = mockState.helpers.callService
    let currentDetail = detailResponse({ freshnessIsStale: true })
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail' ? Promise.resolve(currentDetail) : originalCallService(params)
    )

    try {
      const stale = render(<Harness />)
      let dialog = await openRecipe()
      expect(await within(dialog).findByRole('group', { name: 'Freshness Stale Aug 7, 2026' })).toHaveAttribute('data-tone', 'warning')
      stale.unmount()

      currentDetail = detailResponse({ freshnessIsStale: null })
      render(<Harness />)
      dialog = await openRecipe()
      expect(await within(dialog).findByRole('group', { name: 'Freshness Unknown Aug 7, 2026' })).toHaveAttribute('data-tone', 'unavailable')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('renders authorized local instruction groups as semantic numbered rows without control semantics', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({
            instructionGroups: [
              {
                key: 'instructions:prepare',
                index: 0,
                label: 'Prepare',
                steps: [
                  { key: 'step:prepare:1', index: 0, number: 1, text: 'Wash and chop the vegetables.' },
                  { key: 'step:prepare:2', index: 1, number: 2, text: 'Combine the base ingredients.' },
                ],
              },
              {
                key: 'instructions:finish',
                index: 1,
                label: 'Finish',
                steps: [
                  { key: 'step:finish:1', index: 0, number: 3, text: '<em>Serve safely.</em>' },
                ],
              },
            ],
          }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Instructions')
      const panel = within(dialog).getByRole('tabpanel', { name: 'Instructions' })
      expect(within(panel).getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(within(panel).getByRole('heading', { name: 'Finish' })).toBeInTheDocument()
      expect(within(panel).getAllByRole('list')).toHaveLength(2)
      const steps = within(panel).getAllByRole('listitem')
      expect(steps).toHaveLength(3)
      expect(steps.map((step) => step.getAttribute('value'))).toEqual(['1', '2', '3'])
      expect(within(steps[0]).getByText('1.')).toBeInTheDocument()
      expect(within(steps[1]).getByText('2.')).toBeInTheDocument()
      expect(within(steps[2]).getByText('3.')).toBeInTheDocument()
      expect(within(panel).getByText('<em>Serve safely.</em>')).toBeInTheDocument()
      expect(panel.querySelector('em')).toBeNull()
      expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
      expect(within(panel).queryByRole('checkbox')).not.toBeInTheDocument()
      expect(panel.querySelector('[aria-pressed]')).toBeNull()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('uses subdued numbered headings for multiple unlabeled instruction groups', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail'
        ? Promise.resolve(detailResponse({
            instructionGroups: [
              {
                key: 'instructions:first',
                index: 0,
                label: null,
                steps: [{ key: 'step:first', index: 0, text: 'First section step.' }],
              },
              {
                key: 'instructions:second',
                index: 1,
                label: '',
                steps: [{ key: 'step:second', index: 0, text: 'Second section step.' }],
              },
            ],
          }))
        : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Instructions')
      const panel = within(dialog).getByRole('tabpanel', { name: 'Instructions' })
      expect(within(panel).getByRole('heading', { name: 'Section 1' })).toHaveAttribute('data-subdued', 'true')
      expect(within(panel).getByRole('heading', { name: 'Section 2' })).toHaveAttribute('data-subdued', 'true')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps Cookidoo instructions external-only and renders authorized local steps as text', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail' ? Promise.resolve(detailResponse({ externalOnly: true })) : originalCallService(params)
    )

    try {
      const { unmount } = render(<Harness />)
      const dialog = await openRecipe()
      await within(dialog).findByText('Serves 4')
      await openTab(dialog, 'Instructions')
      expect(await within(dialog).findByRole('heading', { name: 'Instructions are on Cookidoo' })).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: 'Open in Cookidoo' })).toHaveAttribute(
        'href',
        'https://cookidoo.example.test/recipes/mock-42',
      )
      expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
      unmount()

      mockState.helpers.callService = (params) => (
        params.service === 'recipe_detail' ? Promise.resolve(detailResponse()) : originalCallService(params)
      )
      render(<Harness />)
      const localDialog = await openRecipe()
      await within(localDialog).findByText('Serves 4')
      await openTab(localDialog, 'Instructions')
      expect((await within(localDialog).findByText(/Combine the prepared ingredients\.\s+Keep this line break\./)).textContent).toBe(
        'Combine the prepared ingredients.\nKeep this line break.',
      )
      const localPanel = within(localDialog).getByRole('tabpanel', { name: 'Instructions' })
      expect(within(localPanel).getAllByRole('list')).toHaveLength(1)
      expect(within(localPanel).queryByRole('heading')).not.toBeInTheDocument()
      expect(within(localPanel).getByText('1.')).toBeInTheDocument()
      expect(within(localPanel).getByText('2.')).toBeInTheDocument()
      expect(within(localDialog).getByText('<em>Serve in bowls.</em>')).toBeInTheDocument()
      expect(localPanel.querySelector('em')).toBeNull()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('keeps loaded detail mounted throughout the close animation before clearing it', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => (
      params.service === 'recipe_detail' ? Promise.resolve(detailResponse()) : originalCallService(params)
    )

    try {
      render(<Harness />)
      const dialog = await openRecipe()
      expect(await within(dialog).findByText('Serves 4')).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(dialog).toHaveAttribute('data-closing', 'true'))
      expect(within(dialog).getByText('Serves 4')).toBeInTheDocument()
      expect(screen.getByTestId('selected-recipe')).toHaveTextContent('42')

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      })
      expect(within(dialog).getByText('Serves 4')).toBeInTheDocument()
      expect(screen.getByTestId('selected-recipe')).toHaveTextContent('42')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 1_200 })
      await waitFor(() => expect(screen.getByTestId('selected-recipe')).toHaveTextContent('none'))
      expect(screen.getByRole('button', { name: 'Open test recipe' })).toHaveFocus()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })
})

describe('recipe detail factual formatting', () => {
  it('uses serving language only for serving-like units', () => {
    expect(formatRecipeYield(4, 'portions')).toBe('Serves 4')
    expect(formatRecipeYield(2.5, 'bowls')).toBe('Makes 2.5 bowls')
    expect(formatRecipeYield(4, null)).toBeNull()
    expect(formatRecipeDuration(5_400)).toBe('1 hr 30 min')
  })
})
