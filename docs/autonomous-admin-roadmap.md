# Autonomous HASS Admin Roadmap

This is the canonical autonomous execution plan for the Home Assistant Admin To-Do list rendered at `/sfenton-react-dash/home?path=to-do`.

<!-- autonomous-execution-profile
plan_id: hass-admin-todo-2026-07-11
final_task_id: A13-vacation-home-away
model: gpt-5.6-sol
reasoning_effort: max
context_tier: long_context
required_skills: autonomous-hass-admin-executor
todo_entity_id: todo.groceries
completion_script: script.complete_admin_todo_item
completion_receipt_entity_id: input_text.admin_todo_completion_receipt
-->

## Canonical queue

Each phase contains one Admin todo item. Dependencies require the prior phase to be processed, not necessarily accepted, so a well-evidenced rejection or hard blocker does not strand later independent work.

<!-- autonomous-queue:start -->
| Phase | Task ID | Todo UID | Status | Depends On | Admin Task | Work | Acceptance / Stop Gate |
|---|---|---|---|---|---|---|---|
| 1 | `A01-predictive-cooling-heat-devices` | `d8d4d71a-7269-11f1-b37a-525400aeeeef` | accepted | none | Check heat-bearing devices for Predictive Cooling | Inventory every heat-producing device and signal currently considered by Predictive Comfort/Cooling, trace HA ownership and timing, correct missing or false-positive inputs, and expose any operator-visible status consistently in React. | Accepted only with a source-backed device inventory, explicit inclusion/exclusion rationale, HA config validation, focused behavior tests, and live evidence that heat signals influence cooling once without duplicate or stale effects. |
| 2 | `A02-guest-toggle-presence-reset` | `c9e8b5ca-7a19-11f1-b37e-525400aeeeef` | accepted | A01-predictive-cooling-heat-devices | Check if guest toggle disables presence lighting auto reset | Trace all guest-stay toggles, nightly presence-lighting auto re-enable paths, and affected room switches; make guest occupancy prevent inappropriate reset while preserving normal reset after guests clear. | Accepted only when active and inactive guest-state service matrices are documented, HA owns the guard, startup/state-change behavior is covered, and focused tests prove guest rooms are not silently re-enabled. |
| 3 | `A03-kitchen-keyboard-half-height` | `71ae3140-7a29-11f1-b37e-525400aeeeef` | accepted | A02-guest-toggle-presence-reset | If kitchen page re-opens and keyboard was open, app only opens to half height | Reproduce the iPhone visual-viewport/keyboard sequence, identify stale viewport or sheet sizing state, repair shared layout behavior without desktop regression, and verify reopen/close/navigation paths. | Accepted only after mobile Playwright reproduction is captured, the root cause is fixed in a reusable shell/modal primitive when appropriate, keyboard close and page reopen restore full height, and focused regression coverage passes. |
| 4 | `A04-vacuum-state-icons` | `f0634762-7a3a-11f1-a26f-525400aeeeef` | accepted | A03-kitchen-keyboard-half-height | Vacuum state icons on info page need work | Capture the live HA vacuum state/icon/color matrix, inspect every vacuum information surface, and align docked, cleaning, paused, returning, error, unavailable, and consumable states with reusable icon logic. | Accepted only with source-config and Playwright evidence, a complete tested state-to-icon matrix, no regressions to vacuum controls or WebRTC/map content, and mobile visual comparison. |
| 5 | `A05-pre-cool-hyphenation` | `1f800878-7a3b-11f1-a26f-525400aeeeef` | accepted | A04-vacuum-state-icons | Predictive Comfort "Pre Cool" -> "Pre-Cool" | Locate every user-visible and accessible Predictive Comfort label, update the canonical source string to "Pre-Cool", and prevent divergent copies in tests or HA-derived display mappings. | Accepted only when repository and relevant HA config searches show no remaining user-visible "Pre Cool" copy, focused tests assert "Pre-Cool", and the live React surface renders the corrected label. |
| 6 | `A06-ux-consistency-pass` | `397303e8-7a3b-11f1-a26f-525400aeeeef` | hard_blocked | A05-pre-cool-hyphenation | UX consistency pass | Prioritize every button, card, chip, or row that opens a modal: add a consistent right-chevron navigation affordance, consolidate opener layout and styling into shared reusable components, then fix adjacent mobile consistency issues through those primitives rather than page-local patches. | Accepted only with a complete modal-opener inventory, a documented exception for any opener without a right chevron, reusable shared opener styles/components adopted across affected pages, preserved accessible names and behavior, targeted tests, and representative mobile HASS-versus-React Playwright comparisons. |
| 7 | `A07-room-access-ranking` | `5c588a54-7a3b-11f1-a26f-525400aeeeef` | accepted | A06-ux-consistency-pass | Rooms buttons should increment a counter for each room and modal should sort by most accessed rooms | Define HA-owned per-room access counters and a single increment command, signal it from room navigation without delaying navigation, sort the room modal by live counts with deterministic tie-breaking, and handle unavailable/new rooms safely. | Accepted only when HA persists counts across React reloads, each room tap increments exactly once, sorting is deterministic and tested, React does not own durable counts, and mobile modal behavior is visually verified. |
| 8 | `A08-thermostat-hero-dial-clipping` | `8e6bec48-7a3b-11f1-a26f-525400aeeeef` | accepted | A07-room-access-ranking | Hero dials in thermostat modals get slightly cut off if heat/cool circles are at top of dial | Reproduce dial clipping at extreme target positions and supported viewport/safe-area sizes, identify overflow or geometry assumptions, and repair the shared thermostat modal layout without shrinking touch targets. | Accepted only with before/after mobile screenshots, unclipped heat/cool markers at all supported extremes, stable modal scrolling and footer placement, and focused geometry/render tests. |
| 9 | `A09-bed-dial-tap-target` | `a1b499da-7a3b-11f1-a26f-525400aeeeef` | accepted | A08-thermostat-hero-dial-clipping | Bedroom bed thermostat dials should let users tap on dials to move temperature target; right now it just asks if user wants to turn bed off | Separate dial target selection from bed power/off affordances, add accessible tap-to-temperature behavior that calls the correct HA service, and preserve drag, keyboard, disabled, and unavailable semantics. | Accepted only with a state-to-service interaction matrix, tap positions mapping to bounded targets, no accidental off confirmation from dial taps, optimistic UI through the shared hook, focused tests, and mobile interaction verification. |
| 10 | `A10-bed-temperature-scope-prompt` | `bc105512-7a3b-11f1-a26f-525400aeeeef` | hard_blocked | A09-bed-dial-tap-target | When changing temperature on bed, if in range of bedtime/asleep/dawn, native popup asking if set to all nights or just tonight | Detect the active SleepyPod schedule phase from HA, show a shared native-feeling ModalSheet choice only in bedtime/asleep/dawn windows, and route Tonight versus All Nights to HA-owned commands with cancel-safe behavior. | Accepted only with explicit phase and choice service matrices, no prompt outside the defined phases, HA-owned persistent schedule changes, optimistic current-night feedback, close animation compliance, unit tests, and mobile modal comparison. |
| 11 | `A11-contact-sensors-aqara-exposure` | `cb7bfdc6-7a3b-11f1-a26f-525400aeeeef` | superseded | A10-bed-temperature-scope-prompt | Make sure contact sensors are exposed to Aqara | Operator-skipped on 2026-07-12; retain the HA todo mapping but exclude this item from autonomous execution. | No autonomous acceptance gate; this phase is superseded by operator direction and the HA todo remains open for future manual reconsideration. |
| 12 | `A12-bed-physical-feedback-loss` | `e7ea668c-7a3b-11f1-a26f-525400aeeeef` | hard_blocked | A11-contact-sensors-aqara-exposure | Sometimes I hold one button on bed, get buzz, no controls on bed give physical feedback after | Reproduce or instrument the long-hold sequence, correlate HA/MQTT/SleepyPod events and device state, identify whether feedback is latched, disconnected, or command-suppressed, and implement the smallest safe recovery or diagnostic path. | Accepted only with timestamped evidence identifying the failure mode, a tested recovery that does not reset valid sleep state or spam commands, and repeat trials showing physical feedback remains available; otherwise hard-block with the exact hardware/access evidence still required. |
| 13 | `A13-vacation-home-away` | `6dda6d4a-7ba5-11f1-a26f-525400aeeeef` | hard_blocked | A12-bed-physical-feedback-loss | Thermostat page needs to reflect home/away while on vacation | Define the source-of-truth relationship among Vacation Mode, household presence, Ecobee/TCS away behavior, and guest overrides; make the thermostat page render the effective home/away state and reason without duplicating HA logic. | Accepted only with a documented state matrix, correct live labels for vacation and non-vacation transitions, no conflict with guest safeguards, focused tests, and mobile HASS-versus-React verification. |
<!-- autonomous-queue:end -->

## Phase 1 - Predictive Cooling heat-bearing device audit

1. Inventory Predictive Comfort/Cooling automations, scripts, helpers, sensors, and React consumers.
2. Enumerate heat-bearing devices and the signal that proves heat production, including unavailable/stale behavior.
3. Classify each source as included, excluded, or needing a derived HA helper, with timing and cooldown rationale.
4. Correct HA-owned aggregation and update React status only if the source dashboard exposes it.
5. Validate state changes, restarts, duplicate triggers, and no-lookahead use of current device state.

## Phase 2 - Guest-stay protection for presence reset

1. Trace all three guest-stay toggles and the nightly auto re-enable automation paths.
2. Build active/inactive matrices for guest room, music room, theater room, and shared presence reset behavior.
3. Add or reuse one HA-owned guard path so startup and toggle changes remain consistent.
4. Confirm clearing all guest toggles restores normal auto-reset eligibility without forcing an immediate light-state change.
5. Cover each guest-capable room and restart reconciliation with focused evidence.

## Phase 3 - Kitchen page keyboard viewport recovery

1. Reproduce on an iPhone-sized viewport: open a keyboard-producing control, leave/reopen the kitchen page, and capture layout metrics.
2. Inspect VisualViewport listeners, fixed page height, safe-area padding, modal unmount timing, and scroll locks.
3. Fix the shared owner of stale viewport height rather than adding a kitchen-only timeout.
4. Verify keyboard open, keyboard close, route away/back, modal close animation, orientation, and non-keyboard pages.
5. Add Playwright coverage for the failing sequence.

## Phase 4 - Vacuum information icon matrix

1. Capture source vacuum cards/modals and all live state values from HA.
2. Define icons and tones for docked, idle, cleaning, paused, returning, error, unavailable, consumable warning, and maintenance states.
3. Centralize mapping in the reusable vacuum surface.
4. Confirm labels, accessible names, map/stream content, and controls remain stable through live updates.
5. Compare source and React mobile screenshots for representative states.

## Phase 5 - Predictive Comfort Pre-Cool copy

1. Search React, tests, HA dashboard/config, scripts, and accessibility labels for the old copy.
2. Select one canonical constant or source-derived formatter.
3. Update focused tests and snapshots.
4. Confirm no service/entity names are renamed accidentally.
5. Verify the live user-visible text.

## Phase 6 - UX consistency pass

1. Inventory every button, card, chip, tile, and row that opens a modal, including its current trailing icon, accessible name, state styling, and click target.
2. Make a right chevron the default navigation affordance for modal openers; document any source-backed exception instead of silently diverging.
3. Create or extend shared reusable modal-opener components and CSS so chevron alignment, spacing, typography, glass treatment, touch target, focus behavior, and disabled/unavailable states are consistent.
4. Migrate affected pages away from duplicated page-local opener markup while preserving each opener's icon, label, subtitle, state-derived tone, and modal behavior.
5. Audit adjacent shared styles and primitives exposed by the migration, including section spacing, stable dimensions, mobile focus treatment, modal surfaces, and scroll boundaries.
6. Add focused component/page tests and capture representative mobile HASS-versus-React comparisons for the shared opener families before acceptance.

## Phase 7 - HA-owned room access ranking

1. Inventory room buttons and modal data sources.
2. Select HA helpers and one script/service command for durable per-room increments.
3. Define exactly-once behavior for tap, keyboard activation, navigation retry, preload, and back navigation.
4. Sort by descending access count with stable configured-order tie-breaking.
5. Cover missing counters, new rooms, unavailable HA, and live count updates without layout jumps.

## Phase 8 - Thermostat hero dial clipping

1. Reproduce at minimum/maximum targets and when heat/cool markers occupy the top arc.
2. Measure SVG/canvas bounds, overflow ancestors, hero padding, transforms, and safe-area effects.
3. Fix geometry at the reusable dial/modal level.
4. Verify all thermostat variants, viewport widths, modal scrolling, and close animation.
5. Add focused rendering/geometry tests and mobile screenshots.

## Phase 9 - Bed dial tap-to-target

1. Map dial body, power button, target marker, drag, tap, and accessibility actions.
2. Determine the exact SleepyPod/HA entity or command for target updates.
3. Convert dial tap coordinates to bounded target values with stable rounding.
4. Use shared optimistic state while HA confirms; do not shadow bed power state.
5. Prove dial taps never invoke the off confirmation path.

## Phase 10 - Tonight versus All Nights prompt

1. Identify HA states representing bedtime, asleep, dawn, and outside-window operation.
2. Define Tonight and All Nights command targets and cancellation semantics.
3. Use the shared dark ModalSheet and preserve close animation for every dismiss path.
4. Keep schedule persistence and side effects in HA.
5. Test all phases, both choices, cancel/backdrop/swipe, stale HA confirmation, and mobile layout.

## Phase 11 - Aqara contact-sensor exposure

Superseded by operator direction on 2026-07-12. Do not execute this phase automatically. Keep the Home Assistant todo item open unless the operator separately asks to complete or remove it.

## Phase 12 - Bed control physical-feedback loss

1. Capture the exact button, hold duration, buzz, subsequent controls, and timestamps.
2. Correlate physical events with MQTT, SleepyPod, HA logbook, service calls, and connectivity state.
3. Determine whether the problem is device firmware, integration state, a latched mode, command flood, or automation logic.
4. Add bounded diagnostics or recovery only when it preserves valid sleep/temperature state.
5. Repeat the sequence enough times to distinguish a fix from an intermittent non-reproduction.

## Phase 13 - Vacation-aware thermostat home/away display

1. Trace Vacation Mode, people/presence, TCS away behavior, Ecobee mode, and guest-stay overrides.
2. Define effective display state and explanatory reason for every meaningful combination.
3. Derive the display from HA state without recreating away logic in React.
4. Keep dimensions stable and labels accessible through live transitions.
5. Verify vacation start/end, manual presence changes, guest stays, and normal home/away behavior in tests and mobile comparison.
