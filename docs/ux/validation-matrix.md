# Current UX Validation Matrix

Validation protects the single current dashboard experience and its shared
Home Assistant behavior. No step here authorizes deployment or Home Assistant
mutation.

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
| Static design rules | Baseline debt does not increase for raw colors, undefined `--rd-*`, direct disclosure imports, or visual `:active` rules. | `npm run design:check` and `npm run test:design`. |
| Unit tests | Changed primitives, semantics, service behavior, and modal lifecycle pass. | Smallest relevant Vitest selection, then repository checks when required. |
| E2E | Affected routes, modal opener families, navigation, and action exceptions retain behavior across the canonical responsive matrix. | Smallest relevant Playwright selection, then the complete release matrix. |
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

Responsive shell, page, grid, modal, or navigation changes must additionally
pass these mounted resize sequences:

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

For each affected surface, assert the expected route and heading, horizontal
containment, terminal-content reachability, active scroll owner, tab/detail
scroll reset, focus state, fixed-control overlap, stable dimensions, and no
pointer or touch leakage. A close gesture may shield its originating event,
but the page must become intentionally hit-testable within `700ms`.

Desktop validation must use a non-mobile, fine-pointer browser context.
Resizing an iPhone-emulated project to desktop dimensions is supplemental
geometry coverage, not desktop interaction coverage.

Changes to an existing narrow layout require a runtime screenshot and geometry
comparison at `393x852` against clean `origin/master`. Differences require a
documented intentional bug-fix rationale. Keep route, state, scroll position,
authentication, and mock data equivalent.

Run required mobile parity with explicit reachable servers:

```bash
npm run test:e2e:mobile-parity -- \
  --baseline http://127.0.0.1:5188 \
  --candidate http://127.0.0.1:5187
```

The command and parity spec must fail, rather than skip, when required URLs are
missing or unreachable.

`DASHBOARD_ROUTES` is the route inventory source of truth. Modal acceptance
must reconcile the exact physical `ModalSheet` callsite set and every
production consumer, then exercise each listed tab, detail kind, and
layout-changing state. Source or AST checks detect inventory drift but never
replace runtime assertions.

Preload validation must prove that hidden preload subtrees perform no Home
Assistant service calls, image or network loads, timers, polling, event
listeners, `ResizeObserver`, `MutationObserver`, or other runtime I/O.

Typed `ModalSheet` sizes are the default geometry contract. A CSS custom
property override must be named, documented by the owning surface, and covered
by runtime width, height, containment, and scroll-owner assertions.

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
