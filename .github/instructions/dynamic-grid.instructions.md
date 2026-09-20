---
description: "Use when adding or changing DynamicGrid, responsive grid policy, room source-section layout, or grid geometry coverage."
applyTo: "src/components/core/DynamicGrid.tsx,src/components/core/DynamicGrid.module.css,src/components/core/DynamicGrid.test.tsx,src/components/core/dynamicGridLayout.ts,src/constants/roomPages.ts,src/pages/DashboardViewPage.tsx,src/pages/DashboardViewPage.test.tsx,e2e/feedback-regressions.spec.ts,e2e/desktop-responsive.spec.ts"
---

# Dynamic Grid Instructions

Treat this as a living inference guide. Add a rule when a verified implementation
or regression reveals a reusable invariant; do not turn one page's current item
count into a global rule.

Read the [current UX contract](../../docs/ux/current-ux-contract.md), the
[layout workflow](../../docs/ux/layouts.md), and the matching React UX
instructions before changing visible grid behavior.

## Infer the policy before choosing props

Use this evidence order:

1. An explicit shared policy for the same semantic surface.
2. The current UX contract and an existing same-purpose grid on another route.
3. The content's sizing needs, intended row alignment, and behavior as item
   count or labels change.
4. Measured browser geometry at the required responsive contexts.

Do not infer from card count or a single screenshot alone. A layout that happens
to fit today is not a valid precedent if another item, wider label, translated
copy, live state, or larger viewport creates holes, giant cards, or reordering.
When no existing policy fits, add a named shared policy and coverage rather than
assembling an undocumented page-local prop combination.

## Established policies

| Surface intent | Shared policy | Required behavior |
|---|---|---|
| Standard room source section with one or two cards | Room grid default | Start from two columns. Use bounded growth with `maxCellWidth={280}`, `maxColumns={4}`, and `lastRow="fill-minimum"` so sparse wide sections retain useful card widths. |
| Standard room source section with three or more cards | `two-column-fill` | Remain at two columns and consume the full section width. Every occupied row fills both grid edges; three cards render as `1 + 1`, then `2`. |
| One lead card followed by ordinary controls | `lead-row` | Render the lead card in its own full-width grid and the remaining controls through the standard room policy. If the follow-up collection grows beyond that policy, extend the shared layout model instead of patching the page. |
| Branded app launchers | `app-launch` | Square tiles may expand from two tracks up to six bounded 200px tracks. Keep natural one-track spans, center only the incomplete final row, and do not stretch it. |
| Quick Links and other independently sized text cards | Content-aware | Mark all sizing labels, preserve item order, and let each card claim its required span. Centered Quick Links use `fillRows="except-last"` so non-final rows fill while the final row stays natural and left-aligned. |
| Rows, statuses, or options that should share one track width | Uniform | Use `itemSizing="uniform"`. Reduce the whole grid one column at a time until every marked label fits; wrap only when one column cannot contain an overlong label. |
| Live tiles whose changing state must not move the layout | Fixed | Use `itemSizing="fixed"` with stable equal tracks. Loading, hydration, unavailable, and ready copy must not change columns or spans. |
| Fixed-image cards, square modal tiles, or horizontal media collections | Not automatically `DynamicGrid` | Use the existing image-card, modal-tile, carousel, or responsive-section primitive that owns that geometry. `DynamicGrid` is not a universal replacement for CSS Grid. |

## Prop semantics

- `layout="fill"` means the grid owns the available inline width. Use it when
  full-width row utilization is part of the surface contract.
- `layout="bounded"` is an intentional card-width policy, not a generic desktop
  enhancement. Pair it with an evidence-based `maxCellWidth` and `maxColumns`.
  It may add tracks as the container grows.
- `lastRow="fill"` distributes spare tracks across the final row.
- `lastRow="fill-minimum"` fills at the base layout but stops stretching after
  bounded expansion. Use it only when sparse wide rows should retain their
  bounded card width.
- `lastRow="center"` is an explicit exception for collections such as branded
  app launchers. Never use centering to disguise an accidental incomplete row.
- `fillRows="except-last"` fills complete leading rows while preserving the
  final row's measured minimum spans. `fillRows={false}` preserves natural
  one-track placement.
- `itemSizing="content-aware"` lets each item span independently according to
  marked text. `uniform` changes the column count for the collection.
  `fixed` deliberately ignores live text when calculating geometry.
- `maxCellWidth` answers "when should another track be added?" It does not mean
  "how wide should every card be," and it should not be added without checking
  the resulting final row.
- `justify` positions a bounded grid. It does not repair unused tracks inside a
  row.

Content-aware and uniform grids must mark every label that participates in
sizing with `data-dynamic-grid-label="true"`. Group related labels inside
`data-dynamic-grid-label-container="true"` so icons, accessories, subtitles,
and other non-label width are included in the cell requirement.

## Width and packing invariants

- Preserve source order. Fill, center, or widen spans without sorting items.
- A row intended to fill must reach the grid's left and right bounds within one
  CSS pixel. Do not accept a matching column count as a proxy for width usage.
- Standard room source grids never gain a third column implicitly. Three-plus
  card sections must declare `two-column-fill`; branded app-launch grids are the
  explicit multi-track exception.
- Do not create holes with page-local `nth-child`, manual `grid-column`, or
  viewport-specific span rules. Add or change the shared packing algorithm.
- Infer from the grid container, not the window. Keep the existing
  `ResizeObserver`, font-ready, label mutation, and bounded-parent measurement
  path rather than duplicating viewport breakpoint logic.
- Keep pages declarative. Repeated semantic variants belong in typed config and
  a shared wrapper such as `RoomGrid`, not copied prop bundles.

## Validation

Behavior-bearing grid changes need a changed or added test:

- Cover packing, column selection, and measurement changes in
  `src/components/core/DynamicGrid.test.tsx`.
- Cover declarative policy invariants near the owning configuration. For room
  pages, assert that no visible non-app-launch section with more than two cards
  remains implicitly expandable.
- Use browser geometry for the actual contract: rendered column count, spans,
  label fit, stable item order, and row edges. Screenshot presence alone is not
  enough.
- For page/grid geometry, cover phone portrait, both mirrored safe-area phone
  landscapes, a zero-inset phone landscape, and affected fine-pointer desktop
  widths. Include a wide desktop such as 1920px when bounded expansion is
  possible.
- Audit every consumer when the shared primitive or packing helper changes.
  A shared fix is not accepted from one route alone.
- Follow the repository changed-test policy: run
  `npm run test:change-policy` and every changed or added test file by exact
  path. Broad unchanged suites remain owned by protected CI.

When a new grid variant is accepted, update this file with its semantic intent,
row behavior, sizing strategy, explicit exceptions, and the test that protects
the inference.
