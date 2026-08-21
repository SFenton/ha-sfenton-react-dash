# Current UX Contract

The dashboard has one current visual experience, one React tree, and one Home
Assistant state/service layer. Do not add browser-selectable experience modes,
root mode attributes, parallel routes, duplicated components, or alternate
state-to-service paths.

## Runtime invariants

- Home Assistant remains the source of truth. React signals intent through one
  service, script, helper, or automation path and uses shared optimistic state
  only for immediate feedback.
- Interactive surfaces use `ControlSemantics` and
  `src/components/core/SurfaceAccessory.tsx`.
- Chevrons are reserved for `modal` and `navigate` semantics. Commands,
  toggles, selections, values, external destinations, and state displays use
  their own semantic treatment.
- Accessible names, roles, checked or selected state, keyboard behavior,
  disabled state, and unavailable state must match the classified action.
- A noninteractive state or value must not receive button behavior, a tab
  stop, a pointer cursor, or a decorative disclosure accessory.

## State and service behavior

When displayed entity state changes an action, record and test a matrix with:

| Displayed state | Semantic | User event | HA target/service | Optimistic intent | Unavailable/error behavior |
| --- | --- | --- | --- | --- | --- |

Include tap, icon, button, hold/double, sub-button, helper, script, and
state-dependent branches present in the source evidence. Keep the matrix in
the shared behavior layer rather than duplicating HA-owned side effects.

## Visual and interaction rules

- Preserve the established current dashboard materials, density, typography,
  state colors, responsive layout, and mobile-first information hierarchy.
- Do not add visual press-only feedback through `:active` transforms, opacity,
  background, filter, or border changes. Persistent dragging, selected,
  checked, on/off, disabled, unavailable, and HA-derived state remain visible.
- Coarse-pointer taps must not leave a focus ring solely because of touch, but
  do not globally erase component border colors or keyboard focus treatment.
- Keep card, control, modal, slider, and navigation dimensions stable while
  live entity values update.
- Use shared primitives before adding page-local variants. Static visible copy
  belongs in the i18n facade and catalogs.

## Dial marker contract

- Circular dials use `target` for commanded/requested values and `current` for
  live Home Assistant values expressed on the same scale.
- Adjustable targets are the only dial elements with slider semantics,
  keyboard behavior, pointer handling, or a tab stop. Static target/current
  markers are state displays and remain pointer-inert and hidden from the
  accessibility tree.
- Every dial exposes at most one adjustable slider. Equivalent target/current
  values must remain available through the visible readout or dial
  description.
- Automatic or HA-owned control is read-only, not unavailable. Do not mark the
  whole dial disabled merely because a current marker cannot be adjusted.
- Render live current markers beneath adjustable and fixed target markers so
  the target owns the visual state when both values overlap. Distinguish them
  by size and fill treatment, not color alone.

## Modal contract

`ModalSheet` owns the hardcoded `data-surface="hass-popup"` treatment. Close,
backdrop, swipe, hash, route, and state-driven dismissal must render
`open={false}` while the sheet remains mounted so the exit animation completes.
Do not restore dead surface or chrome variants, immediately unmount a closing
sheet, or add nested sheets when one mounted detail flow can be used.

## Validation and release boundary

Use the design-system checker to ratchet raw colors, undefined `--rd-*`
variables, direct `ModalDisclosureIcon` imports, and visual `:active` rules.
Validate mobile first with focused unit tests and Playwright at the same route,
state, scroll position, and viewport. Follow
[Validation Matrix](validation-matrix.md).

Authoring or review does not authorize deployment, Home Assistant mutation,
service calls against live devices, wrapper updates, commits, or pushes. Those
actions require separate explicit authorization.
