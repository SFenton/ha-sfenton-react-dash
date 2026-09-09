---
name: dashboard-ux-authoring
description: Authors or reviews the current dashboard UX with typed interaction semantics, one Home Assistant behavior layer, shared primitives, design checks, i18n, and mobile-first validation.
---

# Dashboard UX Authoring

Use this skill for current dashboard components, pages, modals, and shared
primitives. The app has one current visual experience; do not introduce a mode
switch, root experience selector, or parallel component or service path.

This skill does not authorize deployment, Home Assistant mutation, live device
service calls, wrapper/dashboard updates, commits, or pushes. Those actions
require separate explicit authorization.

## Required contracts

Read before editing:

- [Current UX Contract](../../../docs/ux/current-ux-contract.md)
- [Validation Matrix](../../../docs/ux/validation-matrix.md)
- [Executable Layouts](../../../docs/ux/layouts.md)
- [Interaction Semantics](../../instructions/interaction-semantics.instructions.md)
- every other repository instruction matching the target files

Inspect git status and preserve unrelated work. Identify the current shared
primitive, Home Assistant ownership boundary, and applicable i18n namespace.

## Workflow

### 1. Classify semantics

Classify every visible surface before selecting an icon or component:

| Kind | Meaning |
| --- | --- |
| `modal` | Opens an in-app modal or detail sheet. |
| `navigate` | Moves to another in-app route or page. |
| `command` | Performs an immediate action. |
| `toggle` | Changes and exposes binary checked/on state. |
| `selection` | Chooses and exposes one selected item. |
| `value` | Presents a stable value/unit; classify any action separately. |
| `external` | Opens an external destination with link semantics. |
| `state` | Reports state and is noninteractive unless a separate action exists. |
| `static` | Presents noninteractive content. |

Use `ControlSemantics` and `SurfaceAccessory`. Chevrons are allowed only for
`modal` and `navigate`.

### 2. Build the state/service matrix

Before implementation, record one row per displayed state and user action:

| Displayed state | Semantic | Event | HA target/service | Optimistic intent | Unavailable/error behavior |
| --- | --- | --- | --- | --- | --- |

Include tap, icon, button, hold/double, sub-button, script, helper, and
state-dependent branches from the source evidence. Home Assistant owns actual
updates and cascading side effects; React uses one shared command path and
`useOptimisticState` where immediate intent feedback is needed.

### 3. Choose shared primitives and copy

- Reuse `Page`, `ModalSheet`, `SurfaceAccessory`, entity controls, and existing
  layout primitives before adding page-local variants.
- Extend a typed shared primitive when a pattern repeats or carries semantic
  meaning.
- Put static visible copy in the i18n facade and the narrowest catalog.
- Preserve the mounted modal close lifecycle and hardcoded `hass-popup`
  surface.
- Give every `ModalSheet` a typed `centeredGeometry`. Multi-state, tabbed,
  async, hash-driven, and same-sheet detail flows use fixed preferred geometry;
  `content-fit` is single-view only. Never add `--modal-desktop-*` product
  overrides.
- Treat both centered frames as presentation-owned: landscape fills the same
  padded safe rectangle; tablet/desktop shares the 1100x760px preferred frame.
  Desktop body, body-header, and footer regions fill the padded frame while tabs
  retain family reading measures. New intent ids, pickers, and direct entry must
  not produce different outer sizes. Use `contentWidth="full"` when tab navigation,
  such as Security controls, should also fill the padded width.
- Keep modal tiles presentation-specific: fluid standard cards in portrait,
  equal-width 132px-minimum tracks in phone landscape, and 168px squares in
  tablet/desktop. Full landscape rows consume all usable width; incomplete
  rows align left without stretching sparse groups. Security mode choices
  stay 74px tall.
- Quick Links is a text-aware `DynamicGrid`, not a square-tile grid. Phone
  portrait keeps production's top-aligned, standard 120px cards and filled
  rows. Centered layouts keep compact 88px cards, grow minimum spans for text,
  and use `fillRows="except-last"` to balance spare tracks across narrower
  tiles on non-final rows. The final row retains its required spans at the left.
- Preserve document text-size adjustment at 100% without disabling user zoom.
  Body tiers must update on mounted rotation before any tab switch or remount.
- Do not add press-only animation or focus-border clobbering.

### 4. Validate narrowly

First run `layout:check` and create a `layout:plan` against an explicit resolved
master SHA in the approved worktree. Inspect the owners, complete declared state
set, contexts, transitions, legacy fallback and blockers before editing or
validating. The registry, not a second per-task viewport list, drives both
automated assertions and manual inspection. Copy length is not a layout exemption.

Use `layout:run` for owned, no-proxy mock builds/servers and exact collected test
selection. Then actually replay the manual worklist, view the unnormalized images
with an image-capable tool and record observations tied to checkpoints/hashes.
Run `layout:verify` before acceptance. Never mark captures as manually inspected
automatically. Missing engines, stale source, incomplete loops and access-unavailable
artifacts block their required obligations. Device-only gaps remain explicit.
The commands below remain useful for focused development; they do not replace
the plan's completed acceptance ledger.

Run the smallest applicable commands:

```bash
npm run i18n:check
npm run design:check
npm run test:design
npm run test:run -- <focused-vitest-paths>
npm run test:e2e -- <focused-playwright-selection>
```

Use Playwright mobile first at `393x852`, then run `852x393` with both mirrored
safe-area profiles and a zero-inset rectangular-phone profile when the change
touches shell, page, grid, modal, or fixed-control geometry. Compare layout,
type, state, accessories, modal behavior, focus, safe areas, scrolling, and
mounted rotation at the same route and state. Named Playwright devices do not
simulate physical cutout masks. Do not actuate live Home Assistant devices to
discover behavior.

For non-grid modal work, also test `568x320`, `667x375`, and `734x343`.
Landscape structure must use the shared compact density and measured body
tiers, preserve one modal-body scroll owner, and return to exact portrait
geometry after rotation. Keep square tile modal density regular.
Body-scrolling measure wrappers must grow intrinsically while pane-scrolling
wrappers stay bounded. Scroll to the end and measure the real bottom clearance;
computed padding alone does not catch overflowing grandchildren.
At each phone-landscape viewport, open every production geometry intent and
assert the exact safe-rectangle formula. Within an intent, walk every reachable
tab/detail/loading/result state and assert no more than 1 CSS pixel drift.
Use literal portrait tile/padding metrics and compare tablet/desktop
transitioned identities with direct entry. Compare different modal families,
not just a modal against itself. Run `modal-rotation-regressions.spec.ts` in
mobile Chromium, fine-pointer Chrome, and WebKit, including glyph bounds,
full-row utilization, one scroll owner, keyboard contraction, and every
Summary tab before/after a tab refresh.
For media remotes, verify the entire direction pad is visible above navigation
without scrolling, then click a real coordinate in a mocked HA context.
For filters, inspect and measure description wrapping, not just column count.

Linux WPE's iPhone descriptor does not implement native iOS text autosizing.
Record that limitation; a passing WebKit layout test is not physical iOS
font-inflation or cutout evidence.

`design:sync` is prune-only. Use `design:refresh-baseline` only for an explicit
scanner-rule change after reviewing the complete regenerated inventory.

## Completion report

Report semantics and state/service coverage, shared primitives and i18n work,
focused commands/results, visual evidence or blockers, exact files changed,
and remaining integration concerns. State whether deployment or HA mutation
was performed.
Include the plan/run/assessment paths and distinguish checkpoint-certified,
coarse legacy, manually reviewed and device-only evidence.
