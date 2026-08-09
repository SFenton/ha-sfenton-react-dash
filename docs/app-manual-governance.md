# App Manual Governance

The App Manual combines:

- generated facts from React configuration, source/config-derived surfaces, explicitly declared semantic/behavior surfaces, and sanitized Home Assistant inventory;
- household-facing explanation in simple technical English;
- deterministic Playwright screenshots;
- machine checks that block stale production builds.

## Required change workflow

1. Identify the affected manual capability and article.
2. Update behavior, options, tasks, status, related links, and troubleshooting text.
3. Run `npm run manual:sync:app`.
4. Run `npm run manual:sync:mocks` whenever app-referenced entity IDs change.
5. Run `npm run manual:sync:ha` after Home Assistant changes.
6. Run `npm run manual:capture` when the visible subject changes.
7. Run the complete screenshot comparison and create its receipt:

```bash
npm run manual:capture:check
```

8. Generate deterministic labeled contact sheets and inspect every phone and desktop page:

```bash
npm run manual:screenshots:review
```

The review index is written outside the app bundle at
`artifacts/manual-screenshot-review/contact-sheets/index.html`. Check the
complete library for stale wording, clipping, loading or unavailable states,
private content, and unreadable controls.

9. Only after capture check and visual inspection, record the completed review:

```bash
npm run manual:screenshots:approve
```

Approval does not capture screenshots or perform visual review. It writes the
private, non-bundled manifest at
`scripts/manual/generated/screenshotReviewManifest.json`.

10. Run:

```bash
npm run manual:check
npm run manual:check:ha
```

`npm run build` includes the offline manual and screenshot-approval gates.
`npm run build:release` also compares the committed inventory with live Home
Assistant. Neither build may proceed when screenshot approval is stale.

Pull-request CI also runs the focused manual unit suite and App Manual browser
suite. Live Home Assistant drift still requires `npm run build:release` from a
LAN-capable machine immediately before deployment.

## Screenshot freshness and size contract

The screenshot review manifest records:

- schema version and review timestamp;
- configured subject and phone/desktop variant counts;
- every PNG's SHA-256, byte size, and dimensions;
- a conservative visual-source fingerprint;
- separate screenshot-metadata and capture-harness fingerprints;
- current total-library and maximum-file byte metrics.

The visual-source scope includes non-test application source and assets under
`src/`, non-manual public assets, root package/Vite configuration, and the
manual mock fixture sources. It excludes environment files, credentials,
generated manual PNGs, private Home Assistant inventories, and build output.
The capture-harness fingerprint covers the Playwright screenshot scenario,
Playwright configuration, and review/contact-sheet implementation.

The gate compares the exact configured image set, hashes, sizes, source,
metadata, and harness. Any visible source or fixture change therefore requires
the full capture check, complete contact-sheet review, and explicit approval
again. The per-file and total-library byte constants live in
`scripts/manual/screenshotReview.ts`; keep them close to the optimized library
and ratchet them downward when safe rather than raising them for unexplained
growth.

`npm run manual:sync:app` refreshes both `appInventory.json` and
`surfaceInventory.json`. The surface inventory derives semantic records from
typed route and dashboard configuration exports. Opener identity is separate
from destination identity; a hash can be recorded as a destination hint but
must never be the surface's unique ID.

`manual:check` reports source/config-derived and manually declared
semantic/behavior counts separately. Every route `manualVisibleSectionNames`
entry must have a derived page-section surface. Browser tests compare every
rendered shared `<SectionHeader />` marker with its route guide.

`npm run manual:sync:mocks` reads the current app inventory, checks missing
explicit mocks against live Home Assistant, and rewrites the generated
synthetic fixture. The generated file is committed, deterministic, and used by
the normal offline manual/build gate; live Home Assistant is not required by
`manual:check`.

Generated fixtures may retain only the entity ID plus safe control structure
such as sanitized options, numeric bounds, units, device classes, and supported
modes/features. States and free-form values must be synthetic. Never commit
live task text, names, friendly names, URLs, media payloads, credentials,
tokens, household timestamps, coordinates, product contents, schedules, or
device identifier/VIN values copied from live states or attributes.

## Truth ownership

| Information | Owner |
| --- | --- |
| Routes, configured cards, room controls, service mappings | React source and generated app/surface inventories |
| Real device behavior and multi-entity side effects | Home Assistant |
| Automation, script, service, helper, and integration existence | Sanitized HA inventory |
| Household explanation | Manual articles |
| Visual instructions | Playwright screenshot scenarios |

Generated facts must not be copied into prose. Cross-cutting behavior has one canonical article and other pages link to it.

## User-visible surface ownership

The manual tracks what a household user can name or open:

- routes and page sections;
- status chips and floating actions;
- component families;
- modals, tabs, nested detail pages, and wizard steps;
- stateful controls whose available action changes.

Each surface has exactly one canonical owner article. Rendering primitives such as grids, separators, generic cards, and icon wrappers remain contextual and do not receive standalone articles.

Every surface with `screenshotPolicy: 'none'` requires a specific reason.
Tabs, floating actions, option pickers, stateful controls, modal destinations,
detail pages, and wizard steps require visual evidence by default.

Manual Home is organized by user-facing domains. Integrations, automations, scripts, entities, and protocol names are secondary technical reference unless they are required to troubleshoot a known limitation.

`page-guide` is the canonical article kind for a completed dashboard route.
Its structured payload owns one exact route path and renders the page
orientation, visible sections, available actions, automatic behavior,
first-look cues, safety or limitations, troubleshooting checks, screenshots,
and related guides. Simple page guides require at least 250 authored words;
explicitly complex guides require at least 350.

Route guides have a strict zero-backlog release contract. Every dashboard route
must bind one unique `DASHBOARD_ROUTES.manualArticleId` to a page-guide article
whose `pageGuide.routePath` exactly equals that route path. The committed
remaining-route budget is permanently zero, and the check fails if any route
loses its exact binding or if one page guide is reused for another route. Route
manual surfaces are derived from these bindings rather than maintained as a
second route list.

`family-guide` is the canonical article kind for a recurring configured card
family. Its structured payload owns one semantic family source, explains where
the family appears, action branches, persistent states, unavailable behavior,
optimistic confirmation, safety, troubleshooting, screenshots, and related
guides. Family guides require at least 200 authored words and three
natural-language task questions.

Room-card instances are derived from `ROOM_PAGE_CONFIGS` and bind to
`room-card-kind:<kind>` rather than being hand-listed. Completed route guides
provide a lower-priority `route:<path>` fallback for configured cards and page
sections. Stable IDs, direct source IDs, and specific family sources always
take precedence over that route fallback.

The derived census has a permanent zero-uncovered release contract across every
surface kind. `manual:check` reports coverage by kind and fails if any current
route, opener family, destination, tab, detail page, wizard step, floating
action, option picker, native prompt, configured card, or stateful control
lacks exactly one canonical owner.

Modal and screenshot migration allowlists are prohibited. Manual surfaces may
not use `coverage: 'planned'`, and the numeric uncovered budget must remain
zero. Collector extension points may describe only genuinely dynamic runtime
rows whose identities do not exist in source configuration; they may not defer
a user-nameable static surface.

Screenshot-policy coverage counts both the screenshot's primary `surfaceId`
and any explicitly declared `coveredSurfaceIds`. A covered surface is valid
only when the same screenshot records nonempty `surfaceTargetEvidence` that
points to exact entries in `requiredTargets`. Covered IDs must be registered,
unique, different from the primary surface, and tied to the canonical owner as
a declared screenshot consumer. This permits one real crop to prove several
visible semantic surfaces without treating a generic page image as evidence
for controls that are absent from the crop.

`surface-guide` is the structured article kind for focused destination and
interaction families. It requires at least 180 authored words, two natural
task questions, how-to-open instructions, contents, meaningful explanations
for every owned tab/detail/wizard step, close/back/cancel behavior, Home
Assistant ownership, state and disabled behavior, safety or limitations, at
least three troubleshooting checks, screenshots, and related guides. Existing
page or family guides may remain the canonical owner when they already provide
the complete semantics; thin duplicate articles are not acceptable.

`task-guide` is the canonical article kind for a complete household workflow.
The current workflow registry lives in `src/manual/taskWorkflows.ts`; it is the
required set, not a migration list or backlog budget. Every registry entry must
resolve to exactly one task-guide article, and every task guide must cover at
least one registered workflow. Adding a registry entry without documenting it
fails `manual:check`.

Each task guide has one unique canonical natural-language question and a typed
payload containing prerequisites, at least three numbered steps, expected
success or confirmation, Back/Cancel/close behavior, failure and recovery,
automatic behavior or side effects, safety or limitations, screenshot
evidence, exact owning app-surface IDs, and related guides. Task guides require
at least 150 authored words and may not put raw backend IDs in household prose.
Their owning app-surface bindings must already exist in `MANUAL_SURFACES` and
must not be duplicated by another task guide. These workflow bindings do not
replace the separate one-canonical-owner surface graph.

Visual workflows must reuse at least one accurate registered screenshot.
When the available image provides only route or surrounding context, the task
payload must keep a specific dedicated-image gap visible for the later image
phase. A purely navigational or troubleshooting workflow may omit screenshots
only with an explicit nonvisual reason. Common Tasks and grouped guide lists
should link to the task guide instead of a page overview whenever the user is
trying to perform that workflow, and must display the canonical question
verbatim.

`behavior-guide` is the canonical article kind for cross-cutting automatic
household behavior. Each guide requires at least 220 authored words and
structured explanations of capability, triggers, preconditions, household
effects, visible signs, guest/Vacation/Away interactions, override or recovery,
notifications, safety, at least three troubleshooting checks, affected routes,
screenshots, and related guides. Generated automation or script names never
count toward authored depth.

Each behavior guide owns one derived `automatic-behavior` surface. The private
registry in `scripts/manual/behaviorOwnership.ts` maps every non-internal live
automation and script to exactly one behavior guide. Internal workers require
an explicit internal review and no user-facing owner unless a separate
exception review is recorded. The expanded private audit is generated at
`scripts/manual/generated/behaviorOwnershipAudit.json`; neither file is part of
the Vite bundle.

`manual:sync:ha` validates ownership before writing inventory files. Its
reviewed fingerprint covers IDs, names, categories, and classifications, so an
addition, removal, rename, category move, or classification change fails until
the registry and fingerprint are deliberately reviewed together.

## Home Assistant drift

Repository drift cannot pass the normal build. Governed HA changes must refresh the manual inventory before completion. Direct Home Assistant UI changes cannot be detected instantaneously by this repository; they are detected by the next successful scheduled audit and block the next release.

Run the HA comparison at least daily from a LAN-capable workstation or self-hosted runner. If no scheduled runner exists, `npm run build:release` is mandatory immediately before deployment.

## Exceptions

Add only narrowly scoped entries to `src/manual/exceptions.ts`.

Every exception requires:

- capability ID;
- owner;
- reason;
- issue;
- expiration date no more than 14 days away.

Expired exceptions fail the build. No more than three exceptions may be active. There is no permanent `skip manual` mechanism.

## Current in-development capabilities

- Recipes: the React browse and detail experience exists, but live
  `evershelf.recipe_query`, `evershelf.recipe_hydration`,
  `evershelf.recipe_detail`, and `evershelf.recipe_grocery_add` services are not
  installed.

Vacuum Area Cleaning graduated during the initial manual implementation after all three live clean-zone scripts became available. It remains a temporary rectangular selection, not freeform room or polygon drawing.

The manual check inverts these dependencies: when a missing backend appears, the build fails until the article and screenshots are promoted.
