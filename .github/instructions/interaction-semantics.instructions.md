---
description: "Use when authoring typed interactions and accessories in dashboard components and pages."
applyTo: "src/components/**/*.ts,src/components/**/*.tsx,src/pages/**/*.ts,src/pages/**/*.tsx"
---
# Interaction semantics

Follow the accessory and shared behavior contract in
[Current UX Contract](../../docs/ux/current-ux-contract.md).

- Classify every interactive surface with an explicit typed semantic:
  `modal`, `navigate`, `command`, `toggle`, `selection`, `value`, `external`,
  or `state`. Use the repository's shared discriminated union; do not infer
  semantics from label text, entity domain, icon, `onClick`, or a legacy
  `disclosure` boolean.
- Render accessories through
  `src/components/core/SurfaceAccessory.tsx`. Do not import
  `ModalDisclosureIcon` directly from any other file.
- A chevron is valid only for `modal` or `navigate`. Commands, toggles,
  selections, values, external links, and state displays must use their own
  semantic treatment and must not borrow disclosure styling.
- `command` performs an immediate action; `toggle` exposes checked/on state;
  `selection` exposes selected state; `value` presents a stable value and unit;
  `external` uses real link semantics; `state` is noninteractive unless a
  separately classified action is present.
- Preserve accessible role, name, state, keyboard behavior, and disabled or
  unavailable behavior for the selected semantic in the current dashboard.
- When displayed entity state changes the action, write and test a matrix with
  displayed state, semantic, user event, HA target/service, optimistic intent,
  and unavailable/error behavior. The current UX consumes one shared matrix
  and callback.
- Do not use an accessory to conceal a no-op surface. Noninteractive state and
  value displays must not receive button semantics, tab stops, pointer cursors,
  or decorative chevrons.
