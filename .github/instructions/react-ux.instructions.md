---
description: "Use when editing React UX code, dashboard pages, reusable components, or CSS modules. Covers shared description text and UX primitive conventions."
applyTo: "src/pages/**/*.tsx,src/components/**/*.tsx,src/pages/**/*.module.css,src/components/**/*.module.css"
---
# React UX Instructions

- All changed dashboard surfaces must honor the single-experience
  [Current UX Contract](../../docs/ux/current-ux-contract.md). Preserve one
  React tree, one established visual system, and one Home Assistant
  state/service path; do not add switchable experience modes or root
  mode-specific selectors.
- Interactive surfaces must use the explicit typed semantics and shared
  accessory path defined in
  [Interaction Semantics](interaction-semantics.instructions.md). Use
  `ControlSemantics` and `SurfaceAccessory`; reserve chevrons for modal and
  in-app navigation disclosure.
- Use the shared `<Description />` control from `src/components/core/Description.tsx` for descriptive UX copy in React components and page files.
- Do not add page-local paragraph wrappers or ad hoc description CSS when `<Description />` can represent the copy.
- Keep descriptive text close to the source configuration or page constants when it is source-derived, but render it through `<Description />`.
- Dashboard pages must use the shared `<Page />` shell for headers and vertical scrolling. Do not render page-local `<main>` scrollers or direct `<AppHeader />` instances inside route content; page-level chips/status rails belong in `Page.headerQuickLinks` so they stay in the sticky header dock.
- A back-navigation page must not render a header hamburger beside the
  profile, even in short landscape. Back replaces the header menu; root
  pages retain their normal menu and wide layouts retain the navigation rail.
- Consume safe areas only through `--rd-safe-top`, `--rd-safe-right`,
  `--rd-safe-bottom`, and `--rd-safe-left`. Do not add direct
  `env(safe-area-inset-*)` use outside `src/styles/tokens.css`, infer a
  Dynamic Island/notch side, or add device-specific inset constants to runtime
  CSS. Essential controls use independent physical edges; decorative layers
  may remain full-bleed.
- For Home Assistant-backed controls, Home Assistant owns data updates and side effects. React components should signal HA with services/scripts/helpers/automations and use `useOptimisticState` from `src/hooks/useOptimisticState.ts` for immediate UI feedback while HA catches up; do not duplicate multi-entity HA business logic in React state.
- For ported Home Assistant room pages, page body/source section cards should use the same standard `<GlassTile />` treatment as the Home page Quick Links by default. Reserve compact cards for header/status rails, dense modal internals, and explicit row-style controls where the source YAML is also compact.
- Do not add visual press/click feedback to dashboard cards, glass tiles, modal cards, dropdown options, toggles, or entity controls. Avoid `:active` scale transforms, press animations, transient background flashes, opacity changes, or similar interaction-only visual effects. Persistent state indicators such as selected, checked, active, on/off, disabled, unavailable, or HA state-derived colors are still expected.
- Do not rely on browser-default blue focus outlines for inputs, textareas, selects, or custom picker shells. Use an app-native neutral/glass focus treatment such as subtle white border/outline or component-specific non-blue focus styling.
- On mobile/touch dashboard controls, do not leave persistent white focus or selected borders after a tap. Native dropdown/select wrappers, GlassTiles, buttons, chips, toggles, and modal controls should not retain a visible focus ring solely because they were tapped.
- Use the shared `<ModalSheet />` primitive for dashboard modals unless there is a documented reason to diverge. Closing by X, backdrop, swipe, route/hash clear, or state change must all flow through the same `open={false}` render so the shared slide-out animation runs; do not immediately unmount, re-key, or swap modal components on close.
- When a modal overview/list/grid opens an item-specific page, keep a **single mounted `<ModalSheet />`** and navigate inside it instead of opening a nested sheet or picker dialog. Swap the sheet title/body/footer, expose `onBack`/`backLabel`, set `scrollResetKey`, and use `useModalDetailPageScroll` with `bodyElementRef` so detail pages start at the top and Back restores the overview scroll/focus position. Mark overview buttons with `data-modal-detail-trigger` and the first detail control with `data-modal-detail-autofocus`. Preserve the current detail page while rendering `open={false}` so every close path keeps the exit animation stable; reset to the overview only when explicitly reopening or navigating Back.
- Use the darker HA-style modal surface app-wide: shared modals and picker dialogs should use the near-black `hass-popup` treatment, not translucent blue/glass backgrounds, unless a divergence is explicitly requested and documented.
- Keep modal content stable and native-feeling: content should appear together without staggered entrance animations, modal controls should not show browser-default focus rings, and fixed modal footers/bottom nav bars must stay anchored to the sheet footer while respecting safe-area insets.
- Preserve the shared typed modal presentations: portrait phone `sheet`, short
  wide `landscape-dialog`, and normal tablet/desktop `dialog`. Landscape
  dialogs are inset, all-corner, backdrop-dismissible, and non-draggable.
  Presentation must remain frozen during the mounted close render.
- Every production `<ModalSheet />` must declare typed `centeredGeometry`.
  It supplies identity and a reading measure, not a family-specific outer
  frame. Every phone `landscape-dialog` fills the shared padded safe rectangle;
  normal dialogs share the 1100x760px frame, clamped to safe viewport padding.
  Use dynamic viewport units and the shared keyboard inset so rotation never
  depends on stale JS dimensions. Do not set legacy `--modal-desktop-*`
  variables in product code.
- Within one intent, a mounted modal must not change outer size across tabs,
  loading/ready states, Back/detail pages, or navigation/footer changes. A new
  intent id re-resolves the inner measure; both centered outer frames remain
  presentation-owned. Compact/form content uses the shared centered
  readable-measure wrapper, never a second landscape scroller. Use typed
  `contentWidth="full"` for control collections that must fill the padded
  body, as Security System and Guest Presence Security do.
- Square room/admin tile density is presentation-specific: portrait sheets keep fluid
  two-column standard cards, phone landscape uses 132px-minimum equal-width
  tracks that fill each complete row, and tablet/desktop retains 168px
  squares. Left-align incomplete rows at the same track width; do not
  cap landscape at four columns or grow sparse state groups to giant cards.
  Tests use literal accepted portrait metrics
  and measured row-width utilization, not imported sizing constants.
- Quick Links must use content-aware `DynamicGrid`. Match production's
  standard 120px tiles and top-aligned, filled rows in phone portrait.
  Centered layouts use compact 88px tiles and `fillRows="except-last"`:
  honor minimum text spans, distribute spare tracks to narrower tiles on
  non-final rows, and leave the final row at its natural spans, left-aligned.
  Never substitute fixed equal-width square-grid tracks for this behavior.
- Preserve root `text-size-adjust: 100%` and its WebKit prefix, without
  disabling browser zoom. Remeasure modal body tiers on presentation/density
  changes before paint. Test an already-open Summary tab through rotation
  before switching tabs; fresh landscape opens cannot cover stale typography.
- Non-grid `landscape-dialog` surfaces use the shared compact density and
  measured `data-modal-body-tier` thresholds from `ModalSheet`. Reuse desktop
  splits only through those tiers, keep named panes visible, and retain the
  modal body as the sole landscape scroll owner. Do not put
  `container-type` on the shared modal body or add page-local viewport
  breakpoints for modal structure. Square room/admin tile flows retain regular
  density.
- In body-scrolling modes, measure wrappers must grow to their intrinsic
  content height. A fixed `height: 100%` wrapper alone can lose the body's end
  padding when descendants overflow. Keep pane-scrolling wrappers bounded,
  and measure actual bottom clearance after scrolling, not just CSS padding.
- When a modal has internal tabs or pages, persistent header/hero content should remain in the modal's main scroll flow unless intentionally documented otherwise. Switching tabs should reset the modal body scroll to the top of the newly selected content.
- Before marking UX work complete, update the affected route, modal, tab,
  detail, and state inventory and run the canonical responsive release matrix
  in `docs/ux/validation-matrix.md`. A resized mobile-emulation project does
  not replace fine-pointer desktop coverage, and an unexplained skip or
  failure blocks completion. Shell, grid, fixed-control, or modal changes must
  include phone portrait, both mirrored landscape inset profiles, and a
  zero-inset rectangular-phone profile. Never describe a named Playwright
  device as physical cutout emulation.
