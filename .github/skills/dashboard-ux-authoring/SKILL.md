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
- Do not add press-only animation or focus-border clobbering.

### 4. Validate narrowly

Run the smallest applicable commands:

```bash
npm run i18n:check
npm run design:check
npm run test:design
npm run test:run -- <focused-vitest-paths>
npm run test:e2e -- <focused-playwright-selection>
```

Use Playwright mobile first, normally `393x852`. Compare layout, type, state,
accessories, modal behavior, focus, safe areas, and scrolling at the same route
and state. Do not actuate live Home Assistant devices to discover behavior.

`design:sync` is prune-only. Use `design:refresh-baseline` only for an explicit
scanner-rule change after reviewing the complete regenerated inventory.

## Completion report

Report semantics and state/service coverage, shared primitives and i18n work,
focused commands/results, visual evidence or blockers, exact files changed,
and remaining integration concerns. State whether deployment or HA mutation
was performed.
