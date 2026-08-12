---
description: "Use when editing the Food & Recipes hub, recipe queries, hydration, controls, cards, grids, or tests."
applyTo: "src/pages/FoodHubPage*,src/pages/RecipesPage*,src/components/hass/recipes/**,src/components/core/CardCarousel*,src/components/core/ImageCard*,src/components/core/RangeField*"
---
# Food & Recipes

- Keep the hub route path `food` with display title `Food & Recipes`; the browse route is `recipes` and returns to `food`.
- Hub order is Suggested Recipes, one full-width All Recipes navigation tile, All Food, then Food Spaces. Keep Scan Item on the hub only.
- Recommendations call `evershelf.recipe_query` with `returnResponse: true`,
  `kind: recommendations`, and the responsive five-page total. React preserves
  server order and always renders five pages; mobile uses 2×3 while wider
  layouts add columns up to the configured card max width.
- Food & Recipes is not content-ready until recommendation data and every
  carousel image have settled. Mount the hidden carousel with eager images
  behind `DashboardPageLoading`, then use the shared minimum/exit timings; the
  shared page-load timeout is the only fallback.
- Browse calls `evershelf.recipe_query` with `kind: browse`, `limit: 50`, the committed query/sort/weights/coverage, optional expiry horizon, optional source/locale, and optional cursor.
- Browse sorts are `availability`, `expiry`, and `alphabetical`. Defaults are availability weight 100, expiry weight 25, minimum coverage 0, expiry horizon 7 with expiring-only off.
- Recipe search/sort/filter controls must use the same shared
  `ExpandingSearchAction`, `FloatingActionSlot`, `FloatingActionButton`, and
  `FilterSheetFooter` primitives as EverShelf Food Spaces. Do not recreate their
  collapse sizing, colors, or footer actions in recipe-local CSS.
- Recipe filter sheets use the standard vertical fieldset rhythm and RadioRows.
  Do not compress filter choices into bespoke horizontal button grids.
- Search is server-side over title and ingredients and follows the inventory debounce convention. Sort/filter sheet changes remain drafts until Apply; Reset resets drafts.
- Alphabetical mode visually disables both weight sliders and explains why.
- Recipe cards are native accessible buttons inside their list items. Cards in both
  Suggested Recipes and browse open the shared mounted Recipe Detail `ModalSheet`;
  never add press animation or transient active styling.
- Recipe Detail has General, Ingredients, and Instructions tabs. React requests the
  bounded DTO only through `evershelf.recipe_detail` with `returnResponse: true`.
  The icon-only tablist stays in the shared `ModalSheet` footer with tab/tabpanel
  semantics, roving keyboard focus, and the same pill geometry as other device
  modal navigation. Capabilities are authoritative, partial metadata remains
  optional, and the modal stays mounted through its close animation before detail
  state is cleared.
- General recipe facts use grouped `StatusPill` fields. Normalize the additive
  `ingredient_groups`/`ingredientGroups` contract against the bounded flat
  ingredient list. Reject unsafe counts, duplicate or missing references, invalid
  indices/order, and mismatched optional positions without discarding the flat
  fallback. Valid groups render in backend order; unreferenced flat ingredients
  remain visible in a final Other Ingredients section.
- One unlabeled ingredient or instruction group has no heading. Multiple unlabeled
  groups use subdued Section 1, Section 2 headings; nonempty provider/local labels
  remain authoritative. Ingredient titles are exactly `Display Name · source
  amount` when an amount exists. Do not repeat that amount in secondary chips;
  keep display-only/unknown sufficiency, Optional only for explicit `true`, source
  wording, product, and authorized identity details secondary.
- Show `Matched as …` only when the bounded DTO explicitly supplies
  `closest_match` from `taxonomy_alias`, `taxonomy_slug`, or `canonical_slug`;
  never infer or authorize an identity label from confidence or broader taxonomy
  sources.
- Authorized non-Cookidoo `instructions.groups`/`instruction_groups` render in
  order with semantic `ol`/`li` rows and noninteractive numbered leading markers
  matching CheckboxRow spacing. Existing flat local steps become one synthetic
  unlabeled group. Never add button, checkbox, `aria-pressed`, or HTML injection
  semantics to instruction rows.
- Official Cookidoo step text is external-only. Never request, render, log, cache,
  or fixture it. Cookidoo Instructions show attribution and an `Open in Cookidoo`
  action; the normalizer must discard and avoid reading any supplied Cookidoo
  steps or groups even when a hostile payload claims local capability. Only
  already-authorized local/manual/generated instruction text may render.
- The Ingredients action sends every currently missing key/position in one
  `evershelf.recipe_grocery_add` response service call with one bounded
  idempotency key. React must not call `todo.add_item`, another EverShelf mutation,
  or mirror services separately; Home Assistant owns the backend write and todo
  mirror outcomes.
- Treat `capabilities.grocery_add` as effective feature support, not as a missing
  count. Normalize additive grocery counts with ingredient-state fallback for old
  responses. Preserve bounded `grocery_add_state`, `grocery_add_reason`, and
  `grocery.blocked_reason` metadata when present. Disabled reasons are ordered
  loading, submitted, backend truncation, backend no-ingredient data, temporary
  unavailability, explicit unsupported state/reason, generic capability-false
  unavailability, over-limit, uncertain-only, then no-missing. Keep safe
  truncation and missing-ingredient-data fallbacks for old responses, never enable
  while `grocery_add` is false, and never describe supported zero-missing recipes
  as unavailable.
- Every committed criterion creates a new generation. Reject every stale service promise, transition timer, next-page continuation, hydration continuation, and poll.
- Preserve and fade old results during criteria changes, freeze their region height, show a centered spinner, then fade the new results in. Respect reduced motion and keep the initiating control focused.
- Next-page loading retains current cards and uses a reserved centered spinner row. Only one page request may be in flight; retry preserves prior pages.
- Root infinite loading in the real `Page` scroller and retain an accessible Load More button.
- Deduplicate browse pages and hydration appends by `dedupeKey`, announce added batches politely, and never reorder already-painted local results.
- Start remote hydration only after local results paint, a trimmed query has at least three characters, and it remains settled for about 600ms. Poll with server `next_poll_ms`; hydration errors are nonblocking.
- Recipe grids use DynamicGrid's requested maximum-cell-width mode to insert
  columns while filling the container; mobile remains at least two columns.
- Once more than 300 cards are loaded, window fixed-height dynamic-column rows
  with spacers and overscan. Do not cap total results or add a dependency.
- Preload mode performs no recipe service call, image load, timer, poll, observer, or other side effect.
- Production always uses `ha-evershelf`. Local Vite development may fall back to
  the same-origin `/__evershelf` proxy when HA has not yet installed the recipe
  services; never expose an EverShelf token to browser code or enable this fallback
  in production builds.
