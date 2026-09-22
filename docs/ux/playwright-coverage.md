# Playwright Coverage Corpus

Current governance is documented in [Executable Layouts](layouts.md).
`e2e/layout/contracts.ts` owns validation metadata; `e2e/playwright-coverage.ts`
is its compatibility projection. Current runs persist actual registered,
selected, attempted and checkpoint/manual outcomes. The numeric release tables
below are the historical `c1e625b` corpus, not automatically updated current
totals. Layout governance adds checkpoint-certified representative scenarios
and guard tests without claiming exhaustive backend-state discovery.

### Strict intrinsic-inset finding in the released baseline

The new body-measure guard exposes a pre-existing Linux WPE end-inset problem
in Rooms and the recipe filter. A guarded, same-fixture comparison of immutable
`c1e625b` and the tooling candidate at `393x852` produced identical results:
Rooms declared 58px body padding, but its bounded measure stopped early and its
last card reached the viewport edge; the filter declared 12px while its measure
also stopped before overflowing descendants. The computed wrapper gaps were
620px and 66px respectively, not the declared insets.

These are failed product assertions, not allowed negative-test fixtures. The
governance work does not change production geometry to hide them. Keep the WPE
checks enabled and report the actual failed checkpoints; neither a named device
descriptor nor a raised tolerance resolves the defect. Physical iOS behavior
remains a separate question. Fixture images/camera resources are local substitutes,
so this comparison is layout evidence, not live-media or photographic fidelity.

The file/ownership inventory is `e2e/playwright-coverage.ts`.
`npm run test:e2e:coverage` rejects missing, stale or duplicate files,
unexplained exclusions, unknown/cyclic ownership, ownership that does not
resolve to direct coverage on the same axis, and test declarations hidden
inside another test or browser callback. This is an inventory guard, not a
substitute for executed assertions.

The `c1e625b` release default registration was **446 tests in 32 active spec files**:
369 in mobile, 57 in desktop, and 5 each in phone-navigation,
passport-foldable, square-foldable and tablet. Enabling WebKit adds
55 registrations, for **501 across all 33 spec files**. These are collected
test cases, not a claim that every conditional integration test ran or that
every application state is covered.

That release's unit suite contained **1,359 tests in 126 files**. Use the commands below
to refresh counts after adding scenarios rather than copying an older total:

```bash
npx playwright test --list
PLAYWRIGHT_WEBKIT=1 npx playwright test --list
npx vitest list --json
```

## Browser projects

| Project | Purpose |
| --- | --- |
| `mobile` | Canonical `393x852` Chromium touch context for the functional suite and data-driven responsive profiles. |
| `phone-navigation` | Native phone context for navigation modes, keyboard focus and mounted rotation. |
| `passport-foldable` | `1152x741` coarse-pointer foldable context, including portrait return and compact-wide navigation. |
| `square-foldable` | `842x836` coarse-pointer square context and rotation. |
| `tablet` | Native tablet context, portrait/landscape mode changes and navigation focus. |
| `desktop` | Real fine-pointer Chromium at `1440x900`; wider and short-window geometry is exercised inside its specs. |
| `webkit` | Opt-in WebKit for modal rotation, configured openers/tabs, typography bounds, lifecycle, and iframe behavior. |

Playwright device descriptors emulate viewport, screen, user agent, scale, and
touch behavior. They do not emulate a Dynamic Island, notch, punch-hole,
rounded glass, or nonzero safe-area values. Linux WPE also does not implement
native iOS text autosizing: both text-size-adjust support queries return false.
An iPhone descriptor does not change that engine limitation. The profile data in
`e2e/responsive-acceptance-data.ts` injects explicit geometry for layout
testing and is never presented as a physical-device screenshot.

## Released spec inventory (`c1e625b`)

Default counts include all six Chromium projects. WebKit counts are additional,
opt-in registrations. An owner designation is listed in the machine-readable
inventory; it does not mean that every functional/error branch was rotated.

| Spec | Default | WebKit extra | Main coverage |
| --- | ---: | ---: | --- |
| `adaptive-navigation.spec.ts` | 25 | 0 | Native phone/foldable/tablet/desktop modes, boundaries, focus, Back and mounted rotation |
| `admin-relay-warning.spec.ts` | 1 | 0 | Admin relay warning and modal copy |
| `bathroom-fans.spec.ts` | 5 | 0 | Fan cards, timer controls and services |
| `battery-title-desktop-responsive.spec.ts` | 1 | 0 | Fine-pointer Chores title wrapping |
| `desktop-responsive.spec.ts` | 11 | 0 | Fine-pointer routes, focus, Food, Summary, Music Room and vacuums |
| `feedback-regressions.spec.ts` | 20 | 0 | Cross-page layout, Chores, Security, media and intrinsic modal end-padding regressions |
| `garage-doors.spec.ts` | 5 | 0 | Optimistic state and service rejection |
| `home-route-hydration-desktop.spec.ts` | 1 | 0 | Fine-pointer warm Home navigation without a second loader or lost chrome |
| `home-route-hydration.spec.ts` | 2 | 0 | Home hydration across form factors and mounted resize sequences |
| `iframe-lifecycle-real-hakit.spec.ts` | 1 | 0 | Opt-in real HAKit subscription lifecycle |
| `iframe-lifecycle.spec.ts` | 5 | 5 | Wrapper/panel iframe disposal and recreated-frame Home hydration |
| `landscape-modal-adaptation.spec.ts` | 9 | 0 | Measured tiers, split panes, chrome, media and portrait restoration |
| `mobile-device-smoke.spec.ts` | 8 | 0 | Named iPhone/Android descriptors with synthetic insets |
| `mobile-parity-all-routes.spec.ts` | 3 | 0 | All 46 routes against an explicit baseline at both phone orientations |
| `modal-geometry-stability.spec.ts` | 7 | 0 | Same-sheet tabs, details, loading, editors, identities and resize |
| `modal-rotation-regressions.spec.ts` | 78 | 39 | Mounted typography, left-aligned growing tiles, full-width Security, common frames, configured room openers/tabs, keyboard geometry, filters, active remotes, recipe detail pages and Weather modes |
| `modal-sheet-gestures.spec.ts` | 19 | 0 | Native scrolling, drag ownership, cancellation and dismissal |
| `modal-sheet-lifecycle.spec.ts` | 6 | 6 | Mounted open/close/hash/reopen behavior |
| `modal-sheet-performance.spec.ts` | 3 | 3 | Animation timing and blur cost |
| `modal-sheet-webkit.spec.ts` | 0 | 2 | WebKit scrolling and landscape presentation |
| `preload-inert.spec.ts` | 1 | 0 | Hidden preload service/network/observer/timer invariants |
| `react-dash.spec.ts` | 112 | 0 | Broad routing, controls, service payloads, Music Room source state and functional flows |
| `real-hakit-dials.spec.ts` | 1 | 0 | Opt-in live HAKit dial semantics |
| `recipe-keyboard-focus.spec.ts` | 3 | 0 | Recipe keyboard/touch focus and tab ownership |
| `responsive-layout.spec.ts` | 8 | 0 | Shell/navigation boundaries, mutually exclusive Back/menu and resize |
| `responsive-modal-inventory.spec.ts` | 39 | 0 | Physical callsites, rendered-tab rotation cycles, 51 listed opener/kind rows and literal portrait metrics |
| `responsive-modals.spec.ts` | 21 | 0 | Reading measures, grids, scrolling, workspaces, Music Room and resize |
| `responsive-pages-all.spec.ts` | 13 | 0 | All routes at canonical sizes, compact-wide foldables and mounted resize |
| `safe-area-responsive.spec.ts` | 10 | 0 | Four-edge route/modal containment, mirrored cutouts and browser env fallback |
| `sprinklers.spec.ts` | 1 | 0 | Sprinkler cards and schedule details |
| `vacuum-outcomes.spec.ts` | 6 | 0 | Reports, expanded History/Diagnostics, legacy data and true fine-pointer detail rotation |
| `vacuum-status.spec.ts` | 18 | 0 | Status truthfulness, maps and responsive states |
| `weather-carousel.spec.ts` | 3 | 0 | Complete centered carousel pages, native touch, mouse and keyboard controls |

The three wide-window outcome cases explicitly use a fine-pointer,
non-mobile context even though their registration belongs to `mobile`.
Conditional real-HAKit and external-baseline cases need their documented
environment. Chromium-CDP-only and unsupported constructed-touch arms have
explicit engine restrictions; do not count them as executed WebKit gestures.

## What the modal counts actually mean

| Inventory | Count | Meaning |
| --- | ---: | --- |
| Physical `ModalSheet` JSX nodes | 29 | In 20 production files, across 28 enclosing component identities |
| Physical review rows | 32 | Includes two real sheet-mode OptionPicker consumers and the current Music Room remote |
| Listed landscape opener/kind rows | 51 | Multiple opener rows share geometry IDs; these are not 51 unique intents |
| Root/tab states in the physical review cycle | 52 | Each selected state is rotated before switching away, with 724 viewport/state audits |
| Configured room route/hash openings | 87 | Deduplicated from 93 card declarations across 16 current-master room configurations |
| Configured room root/tab states | 113 | Runtime-enumerated independently in mobile Chromium, fine-pointer Chrome and WebKit, including the current Music Room remote |
| Literal portrait tile families | 9 | Rooms, Home families, Security Contacts and both Admin grids |

These inventories overlap and must not be added together as a count of
distinct modals. They do not exhaust every editor, entity-state combination,
loading/error branch or backend outcome.

The physical inventory no longer clicks through tabs and audits only the last
one. Each available tab gets its own portrait-to-landscape cycle, mirrored
and rectangular stress widths, desktop transition, return to portrait and
mounted-node check. The configured-opener suite derives route/hash coverage
from `ROOM_PAGE_CONFIGS` and persists the actual state paths it executed.
Screenshots wait for incoming tab content to be idle and match the selected
tab; a changed `aria-selected` flag alone can still show the outgoing panel.

## Responsive release corpus

`npm run test:e2e:responsive` runs the shared shell, all-route, physical modal
inventory, modal behavior, safe-area, Chores/layout regression, and mounted
resize gates. The full functional suite is selected with
`npm run test:e2e`; service rejection and state-transition branches are not
duplicated under every geometry when their route or modal surface has an
explicit responsive owner. An `owned` classification means that another spec
validates the scenario's route or modal geometry; it does not claim that every
functional branch itself is re-executed after rotation.

The modal regression file participates in mobile and desktop Chromium and opt-in
WebKit. Dedicated desktop, lifecycle, gesture, performance and preload specs
remain separate gates; an explicit file selection is not the full functional
suite. Regenerate `--list` output and distinguish registered, selected,
executed, skipped and passed counts.
The runner supports `PLAYWRIGHT_WEBKIT_EXECUTABLE` for a provisioned local
runtime. Missing WebKit dependencies must be fixed or reported, not silently
converted into successful browser coverage.

## Corrections made after the earlier audits

- Landscape tracks now fill each complete row, with left-aligned equal-width
  partial rows for square room/admin collections; 132px is a minimum rather than a fixed size.
- Quick Links was subsequently compared with the actual deployed wrapper at
  `45bf38e2e0b4`. Its phone portrait is restored to production's 120px standard
  tiles and top-aligned text-aware grid, rather than 88px uniform half-width
  tiles. Centered layouts stay compact but use text spans and balanced
  non-final-row filling; the final row is not forced full-width.
- Security System and Guest Presence Security opt out of readable-width caps,
  fill the padded modal body, and retain their portrait sizing. Mode choices
  use compact auto-fit tracks rather than an artificially narrow two-column
  island in the middle of the modal.
- Both centered presentations own one shared outer frame. Family preferences
  retain readable inner measures rather than different modal rectangles.
- Root text-size adjustment is 100%, without disabling zoom. Presentation and
  body tiers update without waiting for a tab click.
- WebKit exposed an intrinsic percentage-height/flex-cell sizing cycle; square
  card height now comes from its own aspect ratio.
- Small landscape Home modals no longer retain the old nested scroll owner
  behind a 760px-only guard.
- Visual review caught oversized remote direction pads and clipped filter
  explanations despite passing outer-geometry checks. The entire active pad
  now fits above navigation with 44px-minimum targets; centered filter copy
  wraps without changing phone portrait.
- The supposed desktop vacuum-outcome cases now actually enter the report,
  expand History and Diagnostics, rotate, and return to Controls.
- Recipe planner/ingredient search and all Weather condition modes have
  mounted-rotation checks, not merely root-tab coverage.
- Back-navigation headers no longer render a second hamburger beside the
  profile. Root menus remain available; shared-header unit tests and all-route
  responsive audits cover the mutually exclusive Back/menu behavior.
- Release integration caught a measure-wrapper overflow bug that consumed
  bottom padding. Body-scrolling wrappers now grow intrinsically; the Lights
  terminal gap returns from 15px to the accepted 41px, and a dedicated
  portrait/landscape/desktop regression checks actual end padding.
- Older functional tests still asserted different 500-940px outer modal
  widths. They now assert the exact common frame and retain independent
  tile, reading-measure, control and service assertions. The exit fixture
  accelerates both app-owned closing and Base UI ending styles, rather than
  accidentally leaving a 500ms transition in its supposedly 40ms scenario.

Read-only live-backend inspection found Quick Links, Rooms, Master Bedroom
Climate and Summary at the same 725x356px rectangle in the 852x393 asymmetric
fixture. Live Summary chore titles remained 13.12px before and after a tab
refresh. This is live HA data in Chromium, not physical iOS evidence.

### Portrait baseline provenance

The earlier working-copy pass matched all 45 routes against the immutable
pre-Astra build. Comparing that older workspace with production `45bf38e`
also exposed already-shipped changes absent from the workspace: Weather
carousel spacing, the Music Room Remote section and the Media Music Room
section. Those omissions are not part of the approved release.

The release is therefore integrated in a separate worktree based on
`45bf38e`, preserving current-master Weather, Music Room, Home hydration,
optimistic command and adaptive/foldable navigation behavior. Its comparison
baseline is a fresh build of that same master commit, not the older workspace.
Removing the redundant back-page hamburger and changing centered modal
geometry are intentional differences; unrelated portrait changes are not.

The initial release comparison found exactly the removed hamburger on 40
short-landscape sub-pages and no other geometry/style differences. The parity
harness now hides only that obsolete baseline glyph without changing its
layout, asserts the candidate control is absent from the DOM, and records
the intentional difference. All other geometry and pixel thresholds remain
unchanged; the unnormalized comparison is retained in release artifacts.

## Evidence that remains device-only

- The physical mask and curved-glass appearance of a specific phone.
- Platform edge gestures and whether a control feels reachable next to them.
- Actual inset magnitudes for a device, browser, companion app, or WebView.
- Safe-area delivery through the deployed Home Assistant top document, outer
  custom-panel frame, local bridge frame, and inner React frame.
- Native iOS orientation text inflation and landscape virtual keyboards.
- Physical camera/barcode and expiration-label OCR behavior, including secure
  origin permissions.

These gaps cannot be closed honestly with a named Playwright device. They
require read-only real-device inspection of the raw app and both Home Assistant
hosts.

## Known automated-test gaps

### Unit tests

A reproducible filename inventory finds 227 `src/**/*.ts`/`tsx` modules after
excluding `src/test`, declaration files and test files: 106 have a colocated
same-basename test, 121 do not. This is **not statement/branch coverage** and
does not mean 121 features are untested.

Useful dedicated unit targets remain `ExpandingSearchAction`,
`FloatingActionButton`/`Slot`, `Stepper`, `NativePickerField`,
`RadioRow`, `useModalDetailPageScroll`, `useScheduleDetailPage`, `useScrollMask`,
`useDonetickTaskForm`, `useTodoOptimisticStatuses`, `useGarageDoorCommand`,
`SecurityControls`, `SprinklerController`, and `HlsCamera`/`CameraModalContent`.
Some already have substantial page-level or browser coverage.
`RangeField` already has dedicated unit coverage in the current master.

Do not describe Summary user/vacation/error handling, Weather mode switching,
Scan lookup/OCR/submission branches, recipe picker/planner/idempotency, or
SleepyPod alarm conflicts as having no unit tests. Existing component/page
tests cover those behaviors; their complete cross-engine rotation matrices
are the missing layer.

### Integration tests

Most tests use mocked HAKit and jsdom or a mock browser transport. Real HAKit
automation is opt-in and covers dials and iframe subscriptions, not the full
device-service matrices or cascading Home Assistant side effects. Read-only
live UI inspection supplements that evidence but does not prove mutating
service success, real HLS media, platform keyboard behavior, or deployed
three-frame inset inheritance.

### Remaining Playwright state gaps

| Area | Remaining coverage, not an absence of all tests |
| --- | --- |
| Summary | Unresolved-user picker, both users, empty/vacation states and delayed task/inventory failures under every rotation/profile |
| Thermostat | All six non-room detail types and every advanced room detail, including predictive loading/error states, through the full profile matrix |
| Schedules and alarms | All day/global editors, conflicts, pending saves, rejection and unavailable states after mounted rotation |
| Recipe details | Picker failure/rejection, planner submitted/error feedback and every grocery partial/retry/disabled outcome under each profile |
| Scan Item | Native barcode and expiration-label camera/OCR, permission changes, lookup/OCR pending/error, adding/added/error and location/prepared-state combinations on rotation |
| Vacuum outcomes | Every service-dependent outcome/recovery/live-update combination; the ordinary expanded report/history/diagnostics path is now exercised |
| Weather | Delayed/failed/empty forecast and changing live data across modes; the three condition-mode selections are now exercised |
| Platforms | Physical iOS/Android/WebView tests, native keyboard focus/edge gestures, secure-camera behavior and both deployed HA hosts |

The Scan image workflow is expiration-label OCR; the earlier generic
"product-photo success" wording did not accurately describe this UI.

## Review server and release boundary

The active LAN review server for this change is
`http://192.168.1.155:5179/index.html?path=overview`, bound to `0.0.0.0:5179`.
It uses the existing development Home Assistant connection. HTTP layout
review is not a substitute for secure-origin camera permission testing.
The original working directory and LAN review server are retained separately
from the clean release worktree. The operator subsequently approved a scoped
commit, push, merge to `master`, production build, deployment to both existing
Home Assistant hosts and the one restart required by panel bridge v3. That
authorization does not permit live-device actuation or deleting this workspace.
