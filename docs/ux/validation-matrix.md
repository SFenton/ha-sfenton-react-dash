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
- `820x1180` tablet portrait
- `1180x820` tablet landscape
- `1440x900` desktop
- `1920x1080` wide desktop

Responsive shell, page, grid, modal, or navigation changes must additionally
pass these mounted resize sequences:

- phone portrait -> desktop -> phone portrait
- desktop -> phone portrait -> desktop
- tablet portrait -> tablet landscape -> tablet portrait

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

Use the existing authorized review environment; do not deploy or mutate
external systems unless the task separately permits it. An unexplained
failure, skipped affected surface, unavailable required browser engine, or
missing baseline comparison blocks release.

## Existing failures

A pre-existing failure may be reported only with the exact command, test title,
project, failure signature, and evidence that the changed files cannot affect
it. Do not weaken assertions, delete coverage, refresh evidence blindly, or
broaden an allowlist to manufacture a pass.
