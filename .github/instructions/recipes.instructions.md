---
description: "Use when editing the Food & Recipes hub, recipe queries, hydration, controls, cards, grids, or tests."
applyTo: "src/pages/FoodHubPage*,src/pages/RecipesPage*,src/components/hass/recipes/**,src/components/core/CardCarousel*,src/components/core/ImageCard*,src/components/core/RangeField*"
---
# Food & Recipes

- Keep the hub route path `food` with display title `Food & Recipes`; the browse route is `recipes` and returns to `food`.
- Hub order is Suggested Recipes, one full-width All Recipes navigation tile, All Food, then Food Spaces. Keep Scan Item on the hub only.
- Recommendations call `evershelf.recipe_query` with `returnResponse: true` and `kind: recommendations`. React preserves the server order and always renders five pages of six slots, filling faulty short responses with inert placeholders.
- Browse calls `evershelf.recipe_query` with `kind: browse`, `limit: 50`, the committed query/sort/weights/coverage, optional expiry horizon, optional source/locale, and optional cursor.
- Browse sorts are `availability`, `expiry`, and `alphabetical`. Defaults are availability weight 100, expiry weight 25, minimum coverage 0, expiry horizon 7 with expiring-only off.
- Search is server-side over title and ingredients and follows the inventory debounce convention. Sort/filter sheet changes remain drafts until Apply; Reset resets drafts.
- Alphabetical mode visually disables both weight sliders and explains why.
- Recipe cards are intentionally inert articles/list items in this phase: no button, link, tab index, pointer cursor, press feedback, or no-op click.
- Every committed criterion creates a new generation. Reject every stale service promise, transition timer, next-page continuation, hydration continuation, and poll.
- Preserve and fade old results during criteria changes, freeze their region height, show a centered spinner, then fade the new results in. Respect reduced motion and keep the initiating control focused.
- Next-page loading retains current cards and uses a reserved centered spinner row. Only one page request may be in flight; retry preserves prior pages.
- Root infinite loading in the real `Page` scroller and retain an accessible Load More button.
- Deduplicate browse pages and hydration appends by `dedupeKey`, announce added batches politely, and never reorder already-painted local results.
- Start remote hydration only after local results paint, a trimmed query has at least three characters, and it remains settled for about 600ms. Poll with server `next_poll_ms`; hydration errors are nonblocking.
- Once more than 300 cards are loaded, window fixed-height two-column rows with spacers and overscan. Do not cap total results or add a dependency.
- Preload mode performs no recipe service call, image load, timer, poll, observer, or other side effect.
- Production always uses `ha-evershelf`. Local Vite development may fall back to
  the same-origin `/__evershelf` proxy when HA has not yet installed the recipe
  services; never expose an EverShelf token to browser code or enable this fallback
  in production builds.
