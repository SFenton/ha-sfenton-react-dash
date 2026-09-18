---
description: "Use for any ModalSheet consumer, modal content, modal CSS, keyboard-aware fixed action, or modal acceptance test."
applyTo: "src/components/core/ModalSheet.*,src/components/**/*Modal*.tsx,src/components/**/*Modal*.module.css,src/components/**/*Sheet*.tsx,src/components/**/*Sheet*.module.css,src/pages/**/*Modal*.tsx,src/pages/**/*Modal*.module.css,e2e/*modal*.spec.ts,e2e/responsive-modal-inventory.spec.ts"
---
# Modal layout contract

Every production modal owns three deliberate content layouts:

1. phone portrait `sheet`;
2. phone `landscape-dialog`; and
3. short `landscape-dialog` at 568x320, 667x375, and 734x343.

Normal tablet/desktop `dialog` remains required in addition to those three.
Using the shared single-column stack is a valid deliberate layout only when the
content is simple, reaches its terminal control in every profile, and is
declared as shared-generic in `docs/ux/modal-layout-inventory.md`.

- Add every physical `ModalSheet` callsite and every distinct stateful consumer
  to `e2e/responsive-modal-inventory.spec.ts`. Include tabs, same-sheet detail
  pages, loading/ready/error states, and every step that changes structure.
- Specialized landscape content must key from `data-modal-presentation`,
  `data-modal-body-tier`, or a named `data-modal-landscape-layout`; do not add
  viewport-width-only modal forks or a second modal tree.
- Validate direct portrait open, mounted portrait -> landscape -> portrait,
  both mirrored 852x393 safe-area profiles, all three short-landscape profiles,
  tablet/desktop, terminal reachability, and exactly one scroll owner.
- A modal with editable controls must also validate native-keyboard focus and
  close. The popup surface stays anchored to the layout viewport and continues
  behind the iOS keyboard; only `ModalSheet`'s internal content layout lifts by
  `--modal-keyboard-inset`. Do not shrink or translate the popup itself.
- Do not add modal-local keyboard offsets, visual-viewport listeners, guessed
  keyboard heights, or focus-scroll workarounds. `useDashboardViewport` and
  `ModalSheet` own prediction, embedded outer-window pan correction, internal
  lift, and frozen close geometry.
- Keyboard dismissal must preserve the captured lift until the popup exit
  completes. Close, backdrop, swipe, route/hash clear, and submit success still
  render `open={false}` through the same mounted exit.
- Fixed search/actions outside modals stay at rest until keyboard opening
  begins, then use the shared keyboard inset and curve. Do not pre-jump to the
  cached predicted inset or hide the control to conceal the jump.
- Keyboard-open modal navigation/footer content and fixed search/actions share
  the 8px React-side gap. Do not retain the device safe-bottom inset above an
  open keyboard or add a consumer-specific replacement.
- If a touched modal is listed as a dedicated-content gap, either add and test
  its missing portrait/landscape/short-landscape adaptation or update the
  inventory with runtime evidence that the shared-generic layout is sufficient.
