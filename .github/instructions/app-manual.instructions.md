---
description: "Use when changing user-visible app behavior, Home Assistant-backed behavior, routes, controls, schedules, automations, scripts, integrations, or App Manual content."
applyTo: "src/**/*.ts,src/**/*.tsx,src/**/*.module.css,e2e/**/*.ts,scripts/**/*.ts,.github/agents/**/*.md,.github/skills/**/*.md,.github/instructions/**/*.md"
---
# App Manual maintenance

The App Manual is a release contract, not optional documentation.

When a change affects user-visible behavior, a route, a control, a state-to-service mapping, a device family, an automation, a script, a helper, a schedule, an integration, or a known limitation:

1. Update or add the owning capability/article in `src/manual/`.
2. Register every new user-nameable route, page section, status chip, floating action, modal, tab, detail page, wizard step, or stateful control in the manual surface graph with exactly one canonical owner.
3. Keep generated facts in generated inventories; do not duplicate entity IDs, service names, room lists, or route lists in household prose.
4. Keep the surface census semantic: distinguish source/config-derived records from explicitly declared semantic/behavior records, model openers separately from destinations, and never use a hash as a surface's unique ID.
5. Update task questions, aliases, visible labels, parent/child links, state matrices, status, and simple-English explanation.
6. Run `npm run manual:sync:app` to refresh both app and surface inventories.
7. If app-referenced entity IDs changed, run `npm run manual:sync:mocks` and review the generated synthetic entries.
8. If Home Assistant changed, run `npm run manual:sync:ha` and review every new or changed catalog entry.
9. Recapture every affected screenshot with `npm run manual:capture`.
10. Run `npm run manual:capture:check` for the complete phone and desktop library.
11. Run `npm run manual:screenshots:review`, open the generated index under `artifacts/manual-screenshot-review/contact-sheets/`, and visually inspect every labeled page for stale text, clipping, loading/unavailable states, privacy leaks, and unreadable content.
12. Only after that visual review, run `npm run manual:screenshots:approve`. The command records an already completed review; it does not capture or inspect screenshots.
13. Run `npm run manual:check` and `npm run manual:check:ha`.

Rules:

- `App Manual` must remain the first Settings item with the exact requested description.
- Every dashboard route, generated room reference, and modal-opener family must remain covered.
- Every route `manualVisibleSectionNames` entry must have a derived page-section surface, and every rendered shared `<SectionHeader />` marker must be declared by the route guide.
- The derived surface inventory has a permanent zero-uncovered contract for every kind. Do not add modal or screenshot migration allowlists, `coverage: 'planned'`, or a temporary positive budget.
- `screenshotPolicy: 'none'` requires a specific reason. Tabs, floating actions, option pickers, stateful controls, modal/detail surfaces, and wizard steps require evidence by default.
- Canonical modal destinations, modal tabs, nested detail pages, wizard steps, floating actions, option pickers, and native prompts must come from typed semantic definitions with exact implementation references. A hash may be a routing hint but never a unique surface identity.
- Collector extension points may remain only for genuinely dynamic runtime rows, such as Home Assistant todo items. Do not leave a user-nameable static surface as future collector work.
- Use the structured `surface-guide` kind when a destination family needs focused instructions. It must explain how to open, contents, every owned tab/detail/step, close/back/cancel behavior, Home Assistant ownership, state and disabled behavior, safety or limitations, at least three troubleshooting checks, screenshots, and related guides.
- Use the structured `task-guide` kind for complete user workflows. Keep the required workflow set in `src/manual/taskWorkflows.ts`; every registry entry must resolve to exactly one task guide with no migration allowlist or positive backlog budget.
- A task guide must have one unique canonical natural-language question, prerequisites, at least three numbered steps, success confirmation, Back/Cancel/close behavior, failure and recovery, automatic side effects, safety or limitations, screenshots, exact existing `MANUAL_SURFACES` bindings, and related guides. Require at least 150 authored words and no raw backend IDs in household prose.
- Task-guide surface bindings must be registered and unique across task guides. They describe where the workflow is performed and do not replace the canonical owner recorded by the surface graph.
- Visual task guides must reference an accurate existing screenshot. Keep a specific image-phase gap in the typed payload when a dedicated capture is still missing. Pure navigation or troubleshooting may omit images only with an explicit nonvisual reason.
- Prefer a task guide over an overview or page guide in Common Tasks when the question asks the user to perform that workflow. Display the task guide's canonical question verbatim and never link an article to itself.
- Household navigation is page/task first. Backend brands belong in aliases, troubleshooting, technical-reference articles, or an explicitly titled Behind the scenes block.
- Generated room cards must say whether they open controls, change state, navigate, or are status-only, and link the canonical guide.
- Screenshot metadata must name the article, surface, role, scenario, privacy class, required visible targets, and the question answered.
- A screenshot may cover additional semantic surfaces only through registered, unique `coveredSurfaceIds` with per-surface target evidence drawn from that screenshot's required visible targets. Never credit a generic crop for a surface that is absent from the image.
- Focused crops must be allowed for compact controls; required targets must be fully contained and unobscured.
- Recipes and vacuum area cleaning stay `in-development` while their expected backend services/scripts are missing. When those dependencies appear, the manual check must fail until status and content are reviewed.
- Phone and desktop screenshot variants are both required. Tablet must resolve to desktop artwork.
- Screenshot capture must prove the intended subject with text, role, visibility, and geometry assertions before writing an image.
- Any change to visible source, screenshot metadata, mock fixtures, or the capture harness invalidates screenshot approval. Capture-check the full library, regenerate and inspect every contact-sheet page, then explicitly approve it.
- `manual:check`, normal builds, and release builds must fail when the private manifest at `scripts/manual/generated/screenshotReviewManifest.json` is missing or stale, any PNG hash or byte size changes, the configured image set changes, or a source/metadata/harness fingerprint changes.
- Keep the per-file and total-library screenshot byte caps strict and ratchetable. Do not raise them merely to accommodate an unexplained regression.
- Contact sheets are review artifacts outside `public/`; generation is deterministic and never constitutes visual approval.
- Generated mock fixtures must remain deterministic, privacy-sanitized, and limited to app-referenced IDs absent from explicit mocks. Explicit mocks always override generated defaults.
- Never put live task text, person or friendly names, free-form household text, URLs, media payloads, tokens, credentials, household timestamps, coordinates, product contents, schedules, or device identifier/VIN values copied from live states or attributes in generated fixtures.
- Manual preload renders must contain no images, service calls, timers, network requests, observers, or lazy article imports.
- Do not put live camera images, credentials, personal task contents, or other volatile household data into committed screenshots.
- Do not use permanent skip flags. Exceptions must be scoped, owned, issue-linked, and expire within 14 days.
- Do not call a user-visible or Home Assistant behavior change complete while any manual gate is stale or failing.
- Run `npm run test:manual` and `npm run test:e2e:manual` with the manual gates. Run `npm run build:release` from a LAN-capable machine before deployment because hosted CI cannot verify live Home Assistant drift.
