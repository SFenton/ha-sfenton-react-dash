# Current UX Validation Matrix

Validation protects the single current dashboard experience and its shared
Home Assistant behavior. No step here authorizes deployment or Home Assistant
mutation.

## Executable application of this matrix

[Layouts](layouts.md) is the generated entry point for the validation-owned
registry. Before UX work, resolve source provenance and classify the change.
Explicit owners select affected scenarios; shared or unnarrowed sources use a
conservative known-mock fallback. New obligations without bindings block
acceptance. Unchanged scopes are not silently claimed as freshly tested.

`layout:run` owns no-proxy builds/servers and collection-backed selection.
`layout:verify` externally reconciles exact runtime checkpoints and actual
manual-review records. All eight canonical contexts below remain meaningful,
but are not a mandatory full Cartesian product with every backend state.
Declared journeys and scoped applicability determine execution; native fine-
pointer evidence cannot be inferred from a project name or resized phone.

Use normal elapsed clocks for transition readiness. Missing selected panels,
outgoing content, merely reachable servers, empty route filters and screenshots
that were never viewed must not produce acceptance. Artifacts must be reachable
from the reviewer's permitted scope; inaccessible evidence is explicitly blocked.

| Gate | Current UX requirement | Evidence |
| --- | --- | --- |
| Architecture | One React tree, visual system, route meaning, entity subscription path, optimistic state path, and service callback. | Source review and focused behavior tests. |
| Interaction semantics | Every interactive surface has the correct `ControlSemantics`; only modal and navigation actions use chevrons. | Primitive/component tests and design checker. |
| HA behavior | State/service matrices cover every displayed-state branch without duplicating HA-owned side effects. | Focused mocked HAKit tests; no live service call. |
| Visual system | Established materials, density, type, state treatment, safe areas, scrolling, and stable dimensions remain intact. | Same-viewport screenshots and computed-style/DOM evidence. |
| Interaction feedback | No press-only visual `:active` feedback; persistent dragging and state feedback remain. | Design checker, unit coverage, and touch/keyboard browser pass. |
| Dial markers | Target/current meanings, one-slider ownership, read-only versus disabled state, marker ordering, zero/range behavior, and same-scale live data remain consistent. | Primitive tests plus real-HAKit mobile DOM/focus and screenshot evidence. |
| Accessibility | Names, roles, focus order, target size, checked/selected state, keyboard behavior, and unavailable state remain valid. | Unit/accessibility assertions plus browser pass. |
| Copy/i18n | Static visible copy stays catalog-backed with no stale keys. | `npm run i18n:check` and focused i18n tests when copy changes. |
| Static design rules | Baseline debt does not increase for raw colors, direct safe-area `env()` use, undefined `--rd-*`, direct disclosure imports, or visual `:active` rules. | `npm run design:check` and `npm run test:design`. |
| Unit tests | Changed primitives, semantics, service behavior, and modal lifecycle pass. | Smallest relevant Vitest selection, then repository checks when required. |
| E2E | Affected routes, modal opener families, navigation, and action exceptions retain behavior across the canonical responsive matrix. | Smallest relevant Playwright selection, then the complete release matrix. |
| Centered modal geometry | All landscape dialogs share the safe-area rectangle; all tablet/desktop dialogs share the clamped 1100x760px frame. Reading measures may differ, outer frames may not. | Enumerated modal-state matrix, cross-family frame comparisons, `modal-geometry-stability.spec.ts`, `modal-rotation-regressions.spec.ts`, literal portrait metrics, and screenshots. |
| Release boundary | Validation performs no deployment, HA mutation, commit, or push without separate authorization. | Completion report states what was not performed. |

## Design baseline policy

`npm run design:sync` is prune-only: it may remove resolved debt but must reject
new or increased violations. `npm run design:refresh-baseline` is reserved for
an intentional scanner-rule or reviewed migration change. Review the complete
baseline diff; never use either command to hide a regression.

## Browser policy

Mobile-first defines implementation order, not release scope. Every UX change
must enumerate its affected routes, modal surfaces, internal tabs or detail
pages, and relevant loading, empty, error, unavailable, active, and inactive
states.

The canonical viewport matrix is:

- `393x852` phone portrait
- `852x393` phone landscape
- `1152x741` passport-foldable landscape
- `842x836` square-foldable landscape
- `820x1180` tablet portrait
- `1180x820` tablet landscape
- `1440x900` desktop
- `1920x1080` wide desktop

Non-room modal work must additionally validate short-wide phone stress widths:

- `568x320`
- `667x375`
- `734x343`
- `852x393`

Responsive shell, page, grid, modal, or navigation changes must additionally
pass these mounted resize sequences:

- phone portrait -> phone landscape -> phone portrait
- phone landscape -> phone portrait -> phone landscape
- phone portrait -> desktop -> phone portrait
- desktop -> phone portrait -> desktop
- tablet portrait -> tablet landscape -> tablet portrait
- passport-foldable portrait -> passport-foldable landscape -> passport-foldable portrait
- tablet landscape -> passport-foldable landscape -> tablet landscape

Navigation changes additionally run focused Playwright projects with native
phone, passport-foldable, square-foldable, tablet, and non-mobile fine-pointer
desktop contexts. The expensive all-route sweep includes one representative
wide compact viewport; the focused suite owns the complete boundary and input
semantics matrix.

When replacing a breakpoint, test immediately below, at, and above every
changed boundary. Keep independent width concerns such as card tracks separate
from height concerns such as centered-versus-full-bleed modal presentation;
do not combine them into one media query unless both dimensions are required
for the same behavior.

### Mobile geometry and safe-area profiles

Named Playwright devices provide viewport, screen, user agent, device scale,
and touch characteristics. They do not emulate a physical Dynamic Island,
notch, punch-hole, rounded display mask, or nonzero safe-area environment
variables. The committed geometry profiles are stress fixtures, not hardware
measurements:

| Profile | Viewport | Insets top/right/bottom/left | Purpose |
| --- | --- | --- | --- |
| `island-phone-portrait` | `393x852` | `59/0/34/0` | Dynamic-Island-class portrait stress. |
| `island-phone-landscape-left` | `852x393` | `0/44/21/59` | Asymmetric landscape, larger left inset. |
| `island-phone-landscape-right` | `852x393` | `0/59/21/44` | Mirrored landscape, larger right inset. |
| `notched-phone-portrait` | `390x844` | `47/0/34/0` | Notched-phone portrait stress. |
| `notched-phone-landscape` | `844x390` | `0/44/21/44` | Symmetric notched landscape stress. |
| `rectangular-phone-portrait` | `375x667` | `0/0/0/0` | iPhone SE-class zero-inset portrait. |
| `rectangular-phone-landscape` | `667x375` | `0/0/0/0` | iPhone SE-class zero-inset landscape. |
| `small-rectangular-landscape` | `568x320` | `0/0/0/0` | Minimum-width landscape reflow. |
| `android-punch-portrait` | `412x915` | `24/0/24/0` | Android WebView/system-bar stress. |
| `android-punch-landscape-left` | `915x412` | `0/0/24/48` | Android left-cutout stress. |
| `android-punch-landscape-right` | `915x412` | `0/48/24/0` | Mirrored Android cutout stress. |
| `tablet-inset-portrait` | `820x1180` | `40/44/34/44` | Centered-dialog tablet inset stress. |

The browser supplies four unsafe distances, not a semantic "Island side."
Consume left and right independently and run both mirrored profiles. A
rectangular device naturally resolves all four values to zero, while an
otherwise rectangular Android device may still report a real system-bar or
gesture-area inset that must be honored.

Primary CI coverage injects `--safe-area-inset-*` on the React document root,
matching Home Assistant's iframe contract. A focused Chromium CDP arm verifies
the raw-browser `env()` fallback. CDP inset overrides may propagate into
same-origin child frames and must never be cited as proof of real iframe or
physical-cutout behavior.

Every route must pass horizontal containment, fixed-control containment,
minimum target size, scrolling, and zero document overflow in the route
profile subset from `e2e/responsive-acceptance-data.ts`. Representative compact,
form, and workspace modals must additionally pass mirrored landscape insets,
backdrop and close dismissal, internal scroll reachability, and mounted
portrait/landscape rotation.

For each affected surface, assert the expected route and heading, horizontal
containment, terminal-content reachability, active scroll owner, tab/detail
scroll reset, focus state, fixed-control overlap, stable dimensions, and no
pointer or touch leakage. A close gesture may shield its originating event,
but the page must become intentionally hit-testable within `700ms`.
After scrolling a body-owned modal to its end, verify actual bottom clearance
matches the declared inset. A computed `padding-bottom` value does not prove
that a fixed-height measure wrapper preserved that space around its overflow.

Opening directly in landscape is not rotation coverage. For each active
Summary tab, open in portrait, preserve the same row node, rotate to both
landscape sides, and measure font size, glyph bounds, columns, and the outer
box before any tab interaction. Switching away and back must not change those
measurements. Exercise normal- and short-height windows, repeated rotations,
and reopen on the same document. Compare Quick Links, Summary, Climate,
forms, and media against one another, not merely against themselves.

Before capturing a tab state, wait for its incoming content to finish the
transition and match the selected tab. A settled outer dialog and updated
`aria-selected` flag can still contain the fading outgoing panel.

Landscape square room/admin tile gates assert `floor((usable-width + 10) / 142)` capacity,
equal-width tracks, complete-row utilization within 1px, left-aligned incomplete
rows, square card aspect ratio, readable text, and terminal-card reachability.
Sparse Occupancy state groups must use the same tracks as full rows. Assert exactly one
landscape vertical scroll owner at 568px and 667px as well as larger widths.
Quick Links has a separate text-aware contract: compare phone portrait with
actual production, including 120px card height, 32px corners, 16px padding,
24px glyphs, body-start alignment and mixed-width spans. Centered cards stay
88px tall and resize horizontally when text changes. Fill non-final rows by
balancing spare tracks toward narrower cards; retain the final row's required
spans and left alignment. Assert the four-track `2+2`, `2+1+1`, `2` example,
conditional destinations, unclipped labels and mounted portrait restoration.
For active media remotes, all five direction/select buttons must be visible
at scrollTop zero, at least 44px square, and operable without Playwright
scrolling them into view. Derive every remote from the current configuration,
including Music Room, rather than maintaining a fixed three-remote list. For centered
recipe/inventory filters, assert titles and descriptions have no clipped
scroll bounds; preserve the phone-portrait wrapping policy.

Desktop validation must use a non-mobile, fine-pointer browser context.
Resizing an iPhone-emulated project to desktop dimensions is supplemental
geometry coverage, not desktop interaction coverage.

Back-navigation headers must contain no hamburger at any viewport, including
short landscape. Assert its absence from the DOM, not just CSS visibility,
and exercise Back and profile actions. Back is valid route navigation on
short-landscape sub-pages; only top-level pages expose the header menu.

Changes to an existing phone layout require runtime screenshot and geometry
comparison at both `393x852` and `852x393` against clean `origin/master`.
Differences require a documented intentional bug-fix rationale. Keep route,
state, scroll position, authentication, and mock data equivalent.

Run required mobile parity with explicit reachable servers:

```bash
npm run test:e2e:mobile-parity -- \
  --run artifacts/layout/<run-id> \
  --baseline http://127.0.0.1:5188 \
  --candidate http://127.0.0.1:5187
```

The command and parity spec must fail, rather than skip, when required URLs are
missing or unreachable.
The run manifest must attest both active owned endpoints and matching assets.
For routine work use `layout:run`; it owns the endpoints and includes required
phone parity for runtime changes. A manually supplied reachable URL is not proof
of clean-master/candidate provenance.

Run the machine-readable coverage and responsive release corpus with:

```bash
npm run test:e2e:coverage
npm run test:e2e:responsive
```

`e2e/playwright-coverage.ts` must contain every `*.spec.ts` file and explicitly
state whether landscape and safe-area behavior is exercised directly, owned by
another geometry spec, or not applicable with a reason.

`DASHBOARD_ROUTES` is the route inventory source of truth. Modal acceptance
must reconcile the exact physical `ModalSheet` callsite set and every
production consumer, then exercise each listed tab, detail kind, and
layout-changing state. Source or AST checks detect inventory drift but never
replace runtime assertions.

Preload validation must prove that hidden preload subtrees perform no Home
Assistant service calls, image or network loads, timers, polling, event
listeners, `ResizeObserver`, `MutationObserver`, or other runtime I/O.

`ModalSheet` presentations own centered outer geometry. Typed family sizes
retain readable inner measures; they are not outer-frame exceptions.
Short wide viewports use `data-modal-presentation="landscape-dialog"` rather
than a full-height draggable sheet. Every modal must occupy the same exact
rectangle: `x=safe-left+12`, `y=safe-top+8`,
`width=viewport-safe-left-safe-right-24`, and
`height=visible-height-safe-top-safe-bottom-16`, within 1 CSS pixel.
Normal dialogs use `width=min(1100, viewport-left-padding-right-padding)`
and `height=min(760, visible-height-top-padding-bottom-padding)`, centered in
the remaining box; each padding is `max(32, safe-edge)`.
Compact/form inner content remains centered at its typed readable measure by
default. Full-width control collections opt into `contentWidth="full"` and
must match the actual padded body width rather than an old reading cap.
Neither policy may introduce another scroll owner. Exercise Security System
through Home, Security and Quick Links, plus Guest Presence Security through
both routes, and retain their portrait card dimensions.

The centered frame consumes live `100dvh` minus the shared keyboard overlay
inset. Test a synthetic keyboard contraction below 320px; the page's minimum
height must not push close or footer controls below the visible viewport.
Keep synthetic viewport/capability fixtures explicitly labeled as such.

For non-grid modals, assert compact landscape chrome, the measured
`data-modal-body-tier`, expected stacked/split structure, visible named panes,
and exactly one vertical body owner. Validate media/hero caps, tab-label
containment, fixed navigation/footer position, terminal content, mirrored safe
areas, paired form/option layouts, and exact portrait geometry after mounted
portrait -> landscape -> portrait rotation. Square-grid flows remain on regular
landscape density and must retain their separate exact geometry assertions.

Every runtime `ModalSheet` must publish nonempty
`data-modal-geometry-intent` and `data-modal-block-policy`. Exhaustively open
every production geometry intent at `568x320`, `667x375`, `734x343`, and both
mirrored `852x393` profiles; compare every outer box to the exact formula,
never only to a source-derived cap. Within an intent, walk every reachable tab,
async loading/ready state, detail page, Back path, editor, and result and assert
no more than 1 CSS pixel drift. When an intent id changes on tablet/desktop,
assert transitioned geometry equals direct-entry geometry and the common
cross-family frame, while the reading measure adopts the new identity.

Portrait tile regressions use literal accepted measurements rather than source
constants: at `393x852`, Rooms/Home/Security standard cards are
174.5x147.875px on a full-width two-column track, while Admin cards are
175.5x120px. Landscape has a 132px minimum track, not a fixed 132px square; dialog squares
remain 168px. At the 852x393 left/right island fixtures, regular square grids
have four 158.25px tracks after their normal padding.

Use `content-fit` only for an explicitly audited single-view modal. A surface
with navigation, `onBack`, loading/ready structure, multiple hashes, dynamic
footer/navigation, or multiple steps must use fixed preferred geometry.
Product code must not set `--modal-desktop-width`, `--modal-desktop-height`, or
their max variants; core centered geometry owns those concerns.

Real-device validation remains required for physical display masks, platform
edge gestures, companion-app/WebView inset delivery, and the complete
Home Assistant outer-frame -> bridge-frame -> React-frame variable chain.
It is also required for native iOS text inflation: Linux WebKit/WPE reports
both text-size-adjust properties unsupported, even with an iPhone descriptor.
The Chromium property contract and WPE mounted-layout checks complement, but
do not replace, opening Summary in portrait and rotating on the phone itself.

`ModalSheet` backdrop-band optimization defaults to `backdropPolicy="auto"`.
Band geometry must be resolved by the inert CSS proxy that shares the popup's
`--modal-mobile-height` and `--modal-mobile-max-height` declarations; JavaScript
may decide eligibility but must not write band dimensions. Automatic mode must
retain the full-screen solid scrim and fail closed to the original full-overlay
blur for centered, stacked, transitioning, interacting, forced-colors,
unsupported-filter, translucent/custom-surface, unsupported-geometry, or greater-than-25%
band-area states. Every change to this contract must prove zero incomplete
active frames through phone/foldable rotation, the `760x560` boundary, focused
form viewport recovery, and stale dashboard-width simulation in Chromium and
WebKit. `backdropPolicy="full"` must remain a tested deterministic opt-out.

Standard sheets use an opaque backing in the same near-black color in both
automatic and full modes. This intentionally removes the old 3% background
transmission at the sheet surface, not from nested material tokens, because
translucency exposes the difference between filtered and unfiltered content.
Weather supplies its own opaque backing under the unchanged atmosphere.
The full scrim must paint above the band filters, preserving blur-then-dim
composition. The 25% area ceiling includes real filter-sampling margins
(64px at the top, 32px at the bottom), replacing the earlier geometry-only
20% budget. Small sheets still fail closed.

Built CSS must retain the standard `backdrop-filter` property alongside any
prefixed fallback. A screenshot comparison is valid only after full blur
differs from an explicitly filter-free positive control. The Linux WPE and
GTK WebKit builds in the review environment do not pass that control, so their
geometry/lifecycle results are not Safari rendered-pixel proof. The real-pixel
test runs on Chromium and supported Safari/WebKit renderers; this limitation
blocks a production visual-parity claim, not investigation in the isolated
preview. Compare actual `auto` and `full` policies for performance, including
trusted input, and do not substitute nested-card-blur measurements for it.
Trusted-input uptime must distinguish held-pointer time from resting time:
bands remain disabled throughout a press and should be active for at least
90% of resting frames. Gross uptime reflects input duty cycle, not energy savings.

Weather freshness tests must install the browser clock before mounting the
app, cross the five-minute TTL, and assert both service counts and changed
daily/hourly UI values. Source updates, hidden-page resume, concurrent
consumers, and in-flight refreshes must not duplicate requests or discard a
successful pending response. Deferred/preload consumers must create no
scheduler or listeners. Unknown precipitation is not zero, an incomplete
accumulation is unavailable, and every rail endpoint must satisfy
`0 <= start`, `0 <= size`, and `start + size <= 100`.

Use the existing authorized review environment; do not deploy or mutate
external systems unless the task separately permits it. An unexplained
failure, skipped affected surface, unavailable required browser engine, or
missing baseline comparison blocks release.

## Existing failures

A pre-existing failure may be reported only with the exact command, test title,
project, failure signature, and evidence that the changed files cannot affect
it. Do not weaken assertions, delete coverage, refresh evidence blindly, or
broaden an allowlist to manufacture a pass.
