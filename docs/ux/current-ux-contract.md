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

- Page headers show either Back or the primary navigation menu, never both.
  Do not render a second hamburger beside the profile on a back-navigation
  page at any viewport. Short-landscape sub-pages return through Back;
  top-level pages retain their menu and wide layouts retain the navigation rail.
- Preserve the established current dashboard materials, density, typography,
  state colors, responsive layout, and mobile-first information hierarchy.
- Do not add visual press-only feedback through `:active` transforms, opacity,
  background, filter, or border changes. Persistent dragging, selected,
  checked, on/off, disabled, unavailable, and HA-derived state remain visible.
- Coarse-pointer taps must not leave a focus ring solely because of touch, but
  do not globally erase component border colors or keyboard focus treatment.
- Keep card, control, modal, slider, and navigation dimensions stable while
  live entity values update.
- Square room/admin overview tiles are presentation-specific. Portrait `sheet` uses the
  accepted fluid two-column standard cards; phone `landscape-dialog` uses
  equal-width square tracks with a 132px minimum; tablet/desktop `dialog`
  retains 168px square tiles. Landscape capacity is
  `floor((available-width + 10) / 142)`, after the grid's own padding.
  Distribute the remaining width equally across that many tracks. Incomplete
  rows start at the first track at the same width; do not center or stretch a one-item state
  group into a giant tile or impose a four-column ceiling on wider screens.
  Never let centered-presentation sizing leak into portrait.
- Quick Links uses the shared content-aware `DynamicGrid`, not the square-tile
  sizing helper. Phone portrait matches production: standard 120px tiles,
  16px padding, 32px corners and 24px glyphs, arranged from the top of the body
  using two base tracks and text-required spans. Portrait rows fill as in
  production; do not force every card to half width or vertically center the grid.
- Centered Quick Links uses compact 88px tiles and responsive base tracks up
  to 200px wide. Labels determine minimum spans. `fillRows="except-last"`
  fills non-final rows by assigning spare tracks to the narrowest tiles first,
  without shrinking their text-required spans or changing order. Ties go to
  the later item. The final row retains its required spans and aligns left.
  On a four-track layout the ordinary six-link example is `2+2`, `2+1+1`, `2`.
- Daily Summary uses the shared centered frame and retains its 670px desktop
  reading measure, documented 16px title and compact row typography. It reflows chore
  and expired-food rows to two columns only at standard and wide modal-body
  tiers. Compact and fields tiers remain single-column.
- Set `text-size-adjust: 100%` and `-webkit-text-size-adjust: 100%` on the
  document root. Responsive type must not be inflated by native orientation
  heuristics or require a tab remount to become correct. Do not disable user
  zoom in the viewport meta tag.
- Incomplete modal tile and option rows align left. Quick Links is explicitly
  text-aware: preserve production's filled phone-portrait rows and use its
  non-final-row fill policy only in centered presentations.
- Use shared primitives before adding page-local variants. Static visible copy
  belongs in the i18n facade and catalogs.

## Safe-area contract

- `src/styles/tokens.css` is the only runtime source allowed to read
  `env(safe-area-inset-*)`. Product CSS consumes `--rd-safe-top`,
  `--rd-safe-right`, `--rd-safe-bottom`, and `--rd-safe-left`.
- The tokens resolve Home Assistant's injected `--safe-area-inset-*` values
  first, companion-app `--app-safe-area-inset-*` values second, browser
  `env()` values third, and `0px` last.
- Essential edge content uses each physical edge independently. Combine normal
  gutters with `max(base, inset)` so rectangular phones, tablets, and desktops
  retain their established spacing. Do not infer, persist, or hard-code a
  Dynamic Island, notch, punch-hole, or rotation side.
- A surface whose own box is flush to a viewport edge adds its ordinary gutter
  to that edge's safe inset. Portrait bottom sheets therefore use
  `base + safe-bottom`; inset dialogs continue to use `max()` or viewport
  padding because their box is already inside the safe rectangle.
- Backgrounds, scrims, backdrops, and decorative media may remain full-bleed.
  Headers, page content, fixed actions, navigation, drawers, dialog controls,
  and other tappable content must remain inside the reported safe rectangle.
- Both iframe hosts forward resolved safe-area variables into the inner React
  document. Do not remove that second-hop bridge while either host remains
  supported.
- Playwright device names do not emulate physical cutout masks or rounded
  glass. Synthetic profiles validate layout response to explicit insets;
  physical-mask and platform-edge behavior remains a real-device gate.

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
Switching a modal tab resets the active body or pane scroll owner to the top.

`ModalSheet` has one typed presentation result:

- `sheet` for narrow portrait phones, with the existing drag handle and swipe
  dismissal;
- `landscape-dialog` for short wide viewports, with safe-area-aware inset
  geometry, all-corner rounding, backdrop and close dismissal, and no drag
  handle;
- `dialog` for normal tablet and desktop space.

Presentation is based on available inline and block size, not device names.
The last open presentation remains frozen during `open={false}` so a resize or
rotation cannot change the exit animation.

Every production `ModalSheet` declares a typed `centeredGeometry` with a stable
intent id and family reading measure. Both centered presentations own their
outer frame; a declared family size must never make Quick Links, Summary,
Climate, a picker, or a multi-step editor a different-sized dialog.
`--modal-desktop-*` variables remain forbidden in product code. Existing
preferred block declarations are retained for source compatibility, not as
outer-frame overrides.

Within one geometry intent, the declared geometry and opening `size` are frozen
for the open epoch. Tabs, Back/detail pages, loading/ready transitions,
navigation, footer, density, and scroll mode must not change the outer box. A
new `centeredGeometry.id` updates the reading measure even if a shared
physical node remains mounted. It does not resize either centered frame.
Direct and transitioned entries must resolve identically.

Geometry intent is not a pixel snapshot. While open, core still reclamps the
preferred size when presentation, viewport, orientation, safe area, or visual
viewport changes; portrait sheets ignore centered geometry. Final presentation,
body tier, and geometry remain frozen only during the mounted close frame.

The phone-landscape rectangle is exactly the viewport content box left by
`safe-left + 12px`, `safe-right + 12px`, `safe-top + 8px`, and
`safe-bottom + 8px`. Every modal must match that outer width and height within
1 CSS pixel. Normal tablet/desktop dialogs use one 1100x760px preferred frame,
clamped to the viewport after `max(32px, safe-edge)` padding on each edge.
These values reuse the established media width and workspace height rather
than making compact text or forms span that entire width.

Centered viewport height comes directly from `100dvh` minus the existing
keyboard overlay inset, not from a stale JS height captured before rotation.
Do not apply the page's 320px minimum height to a keyboard-reduced dialog.
Compact/form content stays centered inside the shared readable-measure
wrapper by default. `contentWidth="full"` explicitly opts control collections
out of that reading cap without changing the outer frame or portrait sizing.
In body-scrolling modes, the measure wrapper must grow to its intrinsic content
height so descendant overflow cannot consume the body's bottom padding.
Pane-scrolling presentations retain their bounded wrapper height.
Security System uses it on Home, Security and Quick Links; Guest Presence
Security uses it for its responsive section grid. Security mode choices keep
their 74px height and use 160px-minimum auto-fit tracks.
Desktop readable inner width retains the declared family width less 50px of
chrome; landscape retains the compact/form/standard measure caps. The modal
body is the sole landscape vertical scroll owner, including 568px and 667px
windows. Body tiers are measured from the capped content, not the outer frame.

`content-fit` is reserved for classified single-view surfaces whose rendered
structure does not change while open. Tabbed, async, hash-driven, multi-step,
or same-sheet detail flows use `fixed` preferred block geometry and delegate
overflow to the documented body or pane owner.

Non-grid modals use compact block-axis chrome in `landscape-dialog`; square
room/admin tile grids explicitly retain regular density so their shared sizing
math stays stable. `ModalSheet` measures the centered body content wrapper and
publishes `data-modal-body-tier="compact|fields|standard|wide"` at
480/620/680px. Portrait sheets always resolve to `compact`, and the last open
tier remains frozen during close.

Landscape side-by-side layouts must key from the measured body tier, not
viewport width. They reuse the existing DOM, keep named panes
`overflow-y: visible`, and leave the modal body as the sole vertical scroll
owner. Normal desktop dialogs retain their existing pane scroll owners.
Container queries are allowed on isolated wrappers such as modal navigation,
but not on the shared modal body.

Presentation is a synchronous viewport subscription. Remeasure the body in
the layout phase when presentation or density changes; do not depend on a
later tab click, a remount, or ResizeObserver ordering to correct the layout.
Fluid flex tiles derive their square height from the card's aspect ratio,
not a `height: 100%` child inside an auto-height flex cell, which produces
different intrinsic heights in WebKit.

Media remotes split from the fields tier upward. Their complete 3x3
direction pad must fit above the fixed navigation at the initial body scroll
position, with at least 44px targets; terminal reachability after scrolling
does not make a partially hidden direction pad usable. Cap the pad from
`--modal-body-content-height`, retain the sole body scroller, and preserve
portrait and normal-desktop pad dimensions.

Centered RadioRow titles and explanations wrap instead of hard-clipping.
Checking only a filter's column count is insufficient: measure the actual
text scroll bounds at the narrower per-column reading width.

Tabbed landscape dialogs reveal labels only when the navigation container has
enough width for the tab count. Portrait remains icon-only. Landscape form,
option, media, and hero adaptations must be opt-in through the shared density
and tier attributes; do not add alternate modal trees.

## Validation and release boundary

Apply these product invariants through the source-bound executable workflow in
[Layouts](layouts.md). Its registry and plan drive automated selection/checkpoints
and the agent's actual manual Playwright/image inspection. Preserve independent
expected geometry and source-inventory oracles. Neither a generated plan, a
registered test, an image file nor a filled review schema alone proves acceptance.

Use the design-system checker to ratchet raw colors, direct safe-area `env()`
use outside the token file, undefined `--rd-*` variables, direct
`ModalDisclosureIcon` imports, missing centered modal geometry, legacy modal
geometry variables, and visual `:active` rules.
Mobile-first is sequencing, not an exemption for wider layouts. Validate with
focused unit tests and Playwright at the same route, state, scroll position,
and viewport, then complete the canonical viewport, resize, inventory,
fine-pointer desktop, preload-I/O, and mobile-baseline gates in
[Validation Matrix](validation-matrix.md).

Authoring or review does not authorize deployment, Home Assistant mutation,
service calls against live devices, wrapper updates, commits, or pushes. Those
actions require separate explicit authorization.

### Browser evidence boundary

[Apple's text-size guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html)
and [MDN's text-size-adjust reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-size-adjust)
explain native text inflation. Linux Playwright WebKit/WPE does not implement
the iOS text autosizing property, even with an iPhone device descriptor.
Chromium and WPE rotation screenshots prove layout and mounted-state behavior,
not the native iOS inflation path. Keep that real-device gate explicit.
