# Dashboard implementation contract

Read this complete contract for dashboard implementation, HA integrations,
ports, runtime lifecycle, or release work. The root instructions retain the
unconditional safety and routing rules. This contract preserves the detailed
default-branch requirements rather than replacing them with a lossy summary.

## Project Goal

Recreate the Home Assistant `at-a-glance` dashboard as a React app using `ha-component-kit`/HAKit. The React app should mirror the Home Assistant dashboard page by page, starting with `at-a-glance`, while improving maintainability through reusable local components, tests, and responsive shell patterns.

Primary target is mobile, but tablet and desktop are first-class release
targets. Mobile-first defines implementation order, not validation scope.
Every UX change must satisfy the canonical viewport, resize, state, modal,
fine-pointer desktop, preload-I/O, and mobile-baseline gates in
`docs/ux/validation-matrix.md`.

Start with `docs/ux/layouts.md` and the executable layout plan. Before the first
repository code edit for each task, create a new branch-backed Git worktree from
`master` and perform implementation, tests, and review there. Never substitute
the primary checkout, a stale/dirty checkout, an unrelated existing worktree,
or an already-running unowned server. The post-merge `master` workflow runs
`layout:check`, `layout:plan`, `layout:run`, and automated-only
`layout:verify` as documented. Pull requests retain quality and full Playwright
checks, while automated layout is intentionally skipped until after merge. Do
not duplicate that broad automated corpus as a local pre-push gate. The plan
selects affected scenarios or a conservative
full-known-mock fallback; it does not require every test for every non-layout
change. Changed copy is layout-sensitive even when its character/word counts
are unchanged.

Worktree cleanup is part of release completion. After successful deployment and
production verification, remove the task's implementation worktree and every
release-only temporary worktree unless the user explicitly asks to keep the
implementation worktree. Do not force-remove a worktree that contains
uncommitted changes, and do not delete its branch without separate
authorization; report blocked cleanup explicitly.

Post-merge layout automation is asynchronous regression detection. Do not wait
for its completion or artifact before building, deploying, or completing a
release. A failed run automatically files one deduplicated investigation issue
for the merged commit; the run, artifact, and any manual review are follow-up
evidence, not release gates.

When layout review is separately performed or its plan items are claimed
complete, use the exact run's `layout-automation` artifact and an owned preview
of the matching head. Captured files, tags, registration counts and filled
review schemas are not visual judgment. Record missing or inaccessible evidence
as blocked; never bypass access restrictions. Local validation is mock-only,
no-proxy and provenance-bound, and grants no HA or deployment authority.

## Current Stack

- React 19 + TypeScript + Vite
- HAKit packages: `@hakit/core`, `@hakit/components`
- Home Assistant backend at `VITE_HA_URL`
- Local dev auth via `VITE_HA_TOKEN` in `.env.development`

## Development Commands

```bash
npm run dev -- --host 127.0.0.1
npm run build
npm run lint
npm run sync
npm run deploy  # SSH fallback only; prefer SMB deployment below
npm run deploy:both  # Build + SSH deploy + synchronize both HA dashboard hosts
npm run deploy:sync  # Synchronize dashboard metadata after an SMB copy
```

When running terminal commands, explicitly set the working directory to this repo or use `npm --prefix "C:\\Users\\sfent\\source\\repos\\homeassistant\\ha-sfenton-react-dash" ...`; terminals may reuse another workspace folder.

## Hosting and LAN access

Use the `host-web-app` skill for local LAN hosting, server bootstrap, or port
selection work in this repository. It defines the exact runtime contract for
binding the app on `0.0.0.0`, choosing an available port, and verifying the
live backend connection without exposing secrets. The default LAN host is the
Vite development server with HMR/React Fast Refresh; use production preview
only when explicitly requested.
Treat ordinary requests to start, run, serve, host, open, or preview the app as
`host-web-app` requests even when the operator does not mention LAN access,
`0.0.0.0`, or a port. Before handing off user-visible dashboard or UX work that
the operator would reasonably review on a browser, phone, or tablet, start or
verify a compliant runtime unless the operator opts out. Do not substitute a
bare `npm run dev` or a loopback-only listener.
When operating the host, launch from the requested worktree path explicitly
and verify both process cwd and a non-HTML feature-module response from that
worktree, not just `index.html`, before calling the runtime valid.

## Deployment To Home Assistant

The deployed Home Assistant version should be a production Vite build, not the dev server.

Prefer SMB deployment over the SSH deploy script. Use `npm run deploy` only as a fallback when the SMB share is unavailable and the required SSH env vars are configured.

Use:

```bash
npm --prefix "C:\\Users\\sfent\\source\\repos\\homeassistant\\ha-sfenton-react-dash" run build
```

Deploy the contents of `dist/` to:

```text
\\192.168.1.22\config\www\ha-sfenton-react-dash
```

PowerShell SMB deployment example:

```powershell
Remove-Item "\\192.168.1.22\config\www\ha-sfenton-react-dash\*" -Recurse -Force
Copy-Item "C:\Users\sfent\source\repos\homeassistant\ha-sfenton-react-dash\dist\*" -Destination "\\192.168.1.22\config\www\ha-sfenton-react-dash" -Recurse -Force
```

The same production build is exposed through two Home Assistant hosts until the user explicitly retires one:

| Host | URL | Ownership |
| --- | --- | --- |
| Legacy Lovelace wrapper | `/sfenton-react-dash/home` | Storage-mode dashboard using `custom:sfenton-react-app-card` |
| Embedded custom panel | `/sfenton-react-panel` | YAML `panel_custom` package with `embed_iframe: true` |

Do not delete, rename, or stop updating either host without explicit approval.

After every production deployment, bump the legacy wrapper card URL query string so it reloads `index.html` instead of a cached copy. Use a unique value such as the commit SHA or `YYYYMMDD-HHMM`:

```text
/local/ha-sfenton-react-dash/index.html?v=<unique-deploy-version>
```

Use Home Assistant MCP to update the storage-mode dashboard:

1. Read the current wrapper config with `ha_config_get_dashboard(url_path="sfenton-react-dash", force_reload=True)`.
2. Update the custom card URL with `ha_config_set_dashboard(url_path="sfenton-react-dash", config_hash=<hash>, python_transform="config['views'][0]['cards'][0]['url'] = '/local/ha-sfenton-react-dash/index.html?v=<unique-deploy-version>'")`.
3. Re-open or reload `/sfenton-react-dash/home` and verify it loads the same deployed version.

The custom-panel host is registered by:

```text
home-assistant/packages/sfenton_react_panel.yaml
```

Deploy that file to:

```text
\\192.168.1.22\config\packages\sfenton_react_panel.yaml
```

Its stable `sfenton-react-panel.js` bridge adds a fresh cache-busting query to the inner app whenever the panel document mounts, so normal React app deployments do not require a Home Assistant restart. If the bridge itself changes, bump its `module_url` query in the package, run a Home Assistant configuration check, deploy the package, and restart Home Assistant.

During this parallel-host experiment, the custom panel intentionally retains Home Assistant's native desktop sidebar because `panel_custom` has no supported per-panel kiosk option. Mobile uses HA's narrow layout and fills the viewport. Do not inject top-window CSS or persist global kiosk-mode preferences to hide the desktop sidebar; keep that temporary divergence explicit until the user chooses the final host architecture.

For an SSH deployment, `npm run deploy:both` builds the app and compares the panel, chat-history, and authenticated Home MCP proxy files first. Changed HA package/component files are backed up, staged, and configuration-checked before any React asset is replaced. When those files changed, the command stops after staging with exit status 2; restart Home Assistant with separate approval, verify the proxy and chat package, then rerun to upload `dist/` and synchronize the legacy wrapper URL. Failed staging/validation attempts to restore the prior configuration files. It supports the configured password or `VITE_SSH_PRIVATE_KEY`; on this workstation it defaults to `~/.ssh/ha-sfenton-react-dash-deploy`.

For the preferred SMB flow:

1. Run `npm run build`.
2. Copy `dist/` to `\\192.168.1.22\config\www\ha-sfenton-react-dash`.
3. Copy `home-assistant/packages/sfenton_react_panel.yaml` to `\\192.168.1.22\config\packages\sfenton_react_panel.yaml` if it changed.
4. Back up and copy changed `home-assistant/custom_components/sfenton_react_chat/` files and `home-assistant/packages/sfenton_react_chat.yaml`, plus `home-assistant/custom_components/sfenton_home_mcp_proxy/` and `home-assistant/packages/sfenton_home_mcp_proxy.yaml`.
5. Configuration-check HA after staging package/component changes. On failure, restore prior files and remove only newly introduced files; do not restart invalid configuration.
6. Restart Home Assistant only with explicit approval when the panel package/bridge, chat history, or Home MCP proxy changed.
7. Verify the prior daily chat purge automation is absent, and verify authenticated `/api/sfenton_home_mcp` requests reach the pinned-TLS MCP container. The manual purge service may remain registered, but never invoke it during release verification without explicit deletion authorization.
8. Build with `VITE_HOME_MCP_ENABLED=true` only after that proxy check passes, copy `dist/`, then run `npm run deploy:sync`.

React assets, `deploy:sync`, and HMR do not remove a previously loaded purge automation or activate a newly installed proxy. Do not enable production Home MCP routing until the pinned-TLS container and authenticated HA proxy are both healthy. See `docs/chat.md`, `home-mcp/README.md`, and the chat component README for the complete rollout and rollback contracts.

The app is served by Home Assistant at:

```text
/local/ha-sfenton-react-dash/index.html
```

`vite.config.ts` must keep `base: './'` so assets resolve correctly from the `/local/ha-sfenton-react-dash/` subpath.

Do not embed production Home Assistant tokens. In the Home Assistant dashboard context, HAKit can inherit the existing HA session via `window.top.hassConnection`.

## Architecture Direction

Model the structure after `FortniteFestivalWeb`, but do not copy code between projects.

Preferred layout:

| Path | Purpose |
| --- | --- |
| `src/pages/` | Page-level views such as `AtAGlancePage`, `SecurityPage`, room pages, chores pages |
| `src/pages/Page.tsx` | Shared page shell: scroll container, scroll restoration, loading/error spacing |
| `src/components/core/` | Reusable dashboard primitives: cards, buttons, headers, modals, sliders, section headers |
| `src/components/hass/` | HA entity-aware controls: light sliders, climate cards, alarm controls, todo controls, camera/WebRTC cards |
| `src/components/shell/` | App shell, mobile header, bottom navigation, route chrome |
| `src/constants/` | Reused route, entity, area, section, icon, timing, and animation constants |
| `src/hooks/` | Reusable UI and Home Assistant hooks |
| `src/styles/` | Shared CSS modules for effects, animations, and layout tokens |
| `src/test/` or colocated `*.test.tsx` | Unit tests for components, hooks, and page behavior |
| `e2e/` | Playwright tests added as behavior is implemented |

Keep page files declarative. Move repeated behavior into local reusable components or hooks once it is used by multiple pages or clearly represents a reusable HA dashboard pattern.

## Home Assistant Recreation Workflow

Before implementing each Home Assistant page:

1. Pull the matching Lovelace dashboard config through Home Assistant MCP before or alongside browser inspection. For the main dashboard, use `ha_config_get_dashboard(url_path="at-a-glance", force_reload=True)`; use search mode to find specific entities, card types, headings, popup hashes, and navigation targets when the full config is too large.
2. Treat the MCP dashboard config as the structural baseline for entity IDs, view paths, popup hashes, card groupings, navigation actions, and custom-card behavior. Treat Playwright/browser inspection as the source of truth for runtime layout, scrolling, modal behavior, visual details, and interaction feel.
	For every clickable card/control, build a state-to-service action matrix before implementing. Include `tap_action`, `button_action`, `icon_action`, hold/double actions, sub-buttons, scripts, helper input buttons, and any automation/helper entities that branch on the displayed entity state. Do not assume active and inactive states call the same service just because the visible Lovelace card has one generic action.
3. Inspect the matching page in the live Home Assistant browser tab.
4. Scroll vertically and horizontally inside the page and inside nested containers. Record what scrolls, what stays fixed, and which direction each container scrolls.
5. Click visible controls and cards on the page.
6. If a click navigates to another page, note the target and immediately navigate back.
7. If a click opens a modal, inspect and recreate the modal content, layout, controls, dismiss behavior, and any internal scrolling.
8. Resize both the live Home Assistant tab and local React tab to a mobile viewport first, preferably iPhone-sized such as `393x852`, then complete the canonical responsive matrix in `docs/ux/validation-matrix.md`.
9. Capture screenshots when visual fidelity matters; use accessibility snapshots for structure and text.
10. Implement the React page against the real Home Assistant backend, not mock data, unless writing tests.
11. Validate in the local React tab and compare against the Home Assistant tab at the same viewport size.

Completion gate for Home Assistant ports:

- Do not call a port or port update complete until both the code/config comparison and Playwright visual comparison have been completed, or until the blocker is explicitly reported.
- Code/config comparison is required: compare the Lovelace/MCP config, expanded templates, entity IDs, service actions, state-dependent service branches, state/color branches, and visible text/state matrix against the React implementation and focused tests.
- Playwright visual comparison is required: open the live Home Assistant source page and the local or deployed React page side by side at the same viewport, mobile first, and compare screenshots/DOM/accessibility/style evidence for layout, spacing, text, scroll behavior, modal behavior, colors, and interactive states.
- Unit tests, API/WebSocket checks, build/lint success, manual code review, and user feedback do not replace the Playwright comparison. If browser comparison cannot run, say so before finalizing and mark visual parity as unverified.

When doing Home Assistant visual comparisons, use the repo env files to authenticate instead of relying on an already-logged-in browser tab. Read `VITE_HA_URL` from `.env` and `VITE_HA_TOKEN` from `.env.development` or `.env`; never print the token. Use those values for Home Assistant API/WebSocket reads and for browser setup before opening `/at-a-glance/...` or `/sfenton-react-dash/...`. If a fresh browser page lands on the Home Assistant login screen, stop and authenticate from the env-backed flow rather than comparing against the login page.

Do not recreate the Home Assistant sidebar or top bar for now. Focus on the dashboard content, page headers, tab/bottom navigation, sections, buttons, modals, and entity controls.

## UI Expectations

- Match the Home Assistant dashboard headers, buttons, section headers, content grouping, card density, and modal behavior closely.
- Design toward a fluid native iOS Home app feel: blurred material layers, clear safe-area handling, fast transitions, large tactile tiles, and restrained text density.
- Primary layout is mobile-first with comfortable touch targets and no text overlap.
- Bottom navigation should be modeled after the FortniteFestivalWeb mobile bottom nav pattern: a route-aware fixed/frosted nav surface with icon+label buttons and clear active state.
- Use reusable primitives for recurring patterns such as section headers, quick access buttons, entity rows, chip buttons, modal sheets, light sliders, and camera cards.
- Do not add visual press/click feedback to dashboard cards, glass tiles, modal cards, dropdown options, toggles, or entity controls. Avoid `:active` scale transforms, press animations, transient background flashes, opacity changes, or similar interaction-only visual effects. Persistent state indicators such as selected, checked, active, on/off, disabled, unavailable, or HA state-derived colors are still expected.
- On coarse- or fine-pointer dashboard controls, do not leave persistent white focus borders, outlines, or shadows solely after a click or tap. Text inputs and textareas can match `:focus-visible` after pointer focus; it is not a keyboard-modality test. Preserve identifiable keyboard focus (including the native text caret/selection) and state-derived/error borders rather than clearing focus styles app-wide. Follow the focused pointer/Tab/overflow browser gate in `.github/instructions/react-ux.instructions.md`.
- Textareas must remain editable and scrollable with the caret visible for long multiline or unbroken text, without scrollbar chrome or changing stable composer geometry. Hide the actual control's cross-browser scrollbar; never trap overflow with `overflow: hidden`.
- Modals should use the shared `<ModalSheet />` behavior and must remain mounted for the `open={false}` render on close so the slide-out animation runs. Do not immediately unmount, re-key, or swap sheets when X/backdrop/swipe/hash close is requested.
- `ModalSheet` uses `backdropPolicy="auto"` by default to restrict expensive backdrop blur to CSS-derived exposed bands on eligible mobile sheets. Keep mobile geometry in the shared `--modal-mobile-height` and `--modal-mobile-max-height` properties so the inert backdrop proxy resolves in the same layout pass. Automatic mode requires genuinely opaque sheet backing and paints the full scrim above the blur bands; near-opaque paint is not equivalent. Direct geometry, translucent or unaudited custom surfaces, centered layouts, stacked sheets, interaction/lifecycle transitions, unsupported filters, forced colors, and sampling-band area above 25% must fail closed. Use `backdropPolicy="full"` for an opt-out. Require Chromium and WebKit frame-level coverage, and accept pixel parity only after the renderer passes a blur-positive control.
- Put `-webkit-backdrop-filter` before the standard `backdrop-filter` declaration. The CSS minifier can otherwise drop the standard property; build verification must inspect emitted CSS rather than assuming source declarations survive.
- Base UI drawer scroll arbitration does not discover a modal body when a touch begins on an `SVGElement`. Inside `ModalSheet` bodies, mark decorative SVGs or an owning wrapper `aria-hidden="true"` so shared modal CSS makes them pointer-transparent and the HTML owner receives the gesture. Interactive SVGs must remain hit-testable, be owned by an explicit `data-base-ui-swipe-ignore="true"` interaction surface, and have trusted-touch regression coverage. Do not apply blanket `pointer-events: none` to interactive modal graphics.
- Use the darker HA-style modal surface app-wide: shared modals and picker dialogs should use the near-black `hass-popup` treatment, not translucent blue/glass backgrounds, unless a divergence is explicitly requested and documented.
- Prefer lightweight packages when they materially speed up native-feeling interactions or accessibility, but keep them focused and document why they are worth adding before installing.
- Use CSS Modules for components with meaningful styling; use inline styles only for tiny one-off cases.
- Do not use staggered entrance animations on pages or inside modals; page and modal content should appear together without sequential delays.
- Keep dimensions stable for controls, cards, sliders, button groups, modals, and nav items so live entity updates do not cause layout jumps.

## Home Assistant Integration

- Use HAKit and `@hakit/core` for Home Assistant state, services, and connection management.
- EverShelf access must go through Home Assistant's `ha-evershelf` integration and its `evershelf.*` services; React must not call EverShelf storage, providers, or catalog APIs directly.
- The server owns recipe catalog ranking, filtering, deduplication, mixing, and pagination. React sends criteria, preserves returned order, and only deduplicates repeated response items by the server-provided key.
- Dashboard preload renders must perform no service calls, network/image loads, timers, polling, observers, or other runtime I/O. Pass an explicit preload mode through route content and render inert geometry only.
- Controls must call real Home Assistant services.
- Home Assistant must own actual data updates and cascading side effects. React Dash should only signal Home Assistant through services, scripts, helpers, or automations; do not duplicate Home Assistant-owned business logic or multi-entity side effects in React.
- React Dash controls should optimistically display the user's intended state while Home Assistant catches up. Use the shared `useOptimisticState` hook from `src/hooks/useOptimisticState.ts` for entity-backed optimistic UI instead of ad hoc local state. The optimistic value should clear when the live HA state changes or confirms the value, and it should revert to real HA state if HA never confirms.
- When one user action implies multiple Home Assistant changes, prefer one Home Assistant-owned script/automation/helper/service as the command target and have React optimistically update only the local UI for the expected HA result. Keep the source of truth in HA so non-dashboard changes, automations, and manual HA UI actions stay consistent.
- Controls whose click behavior changes by entity state must encode and test that state-to-service mapping explicitly, such as on/off helpers that press different input buttons or scripts for startup versus shutdown.
- Entity-aware components should be reusable and typed narrowly enough to prevent invalid service calls where practical.
- Avoid hard-coded UI state if the corresponding Home Assistant entity state is available.
- Keep entity IDs and route/page configuration in constants rather than scattering strings across components.
- For SleepyPod capability or protocol decisions, read the Pod's `/api/system/version`
  endpoint and inspect that exact revision in the deployed fork. Public upstream
  is comparison evidence only and must not be treated as the deployed capability
  surface.

## Home Assistant Sidebar Wrapper

Expose the React app through a non-default Home Assistant dashboard:

- URL path: `sfenton-react-dash`
- Title: `React Dash`
- Show in sidebar: true
- Do not make it the default dashboard

Use the custom Lovelace card `custom:sfenton-react-app-card` for the wrapper. Avoid the built-in iframe card for the final experience because it leaves HA card chrome, spacing, aspect-ratio behavior, and background/border artifacts that are especially noticeable on iOS.

The wrapper should fill the viewport and remove Home Assistant dashboard chrome. Use kiosk mode:

```json
{
	"hide_header": true,
	"hide_sidebar": true,
	"mobile_settings": {
		"hide_header": true,
		"hide_sidebar": true
	}
}
```

When validating deployment, check both:

- Raw app: `/local/ha-sfenton-react-dash/index.html`
- Legacy sidebar dashboard: `/sfenton-react-dash/home`
- Embedded custom panel: `/sfenton-react-panel`

Always validate the raw app with a cache-busting query param, always bump the legacy wrapper card URL after copying `dist/`, and verify that both dashboard hosts render the same route. The custom wrapper iframe can keep loading cached `index.html` even after the SMB copy succeeds.

For authorized host lifecycle validation, record the exact event, host/bridge
version, inner frame identity and `performance.timeOrigin`. Distinguish a client
WebSocket interruption from HA layout-driven element disconnection/reconnection.
The recorded three-second interruption retained both hosts, including legacy v2;
the recorded layout rotation remounted both tested legacy bridge versions.
Do not infer that every legacy WebSocket reconnect recreates its iframe, or use
current corrected source to explain an older run without matching provenance.
Synthetic local host tests do not certify deployed Home Assistant behavior.

## WebRTC And Cameras

Camera implementation must support real WebRTC behavior, not static placeholders.

The custom `webrtc-camera-sfenton` card owns camera audio state. It exposes `window.__webrtcGetMuteState(cardId)`, emits `webrtc-audio-state`, and handles `webrtc-mute`, `webrtc-unmute`, `webrtc-toggle-mute`, and `webrtc-screenshot` events. React controls should dispatch these events and listen for `webrtc-audio-state`; do not shadow-click the card's internal `.volume` control or maintain a separate body-class-based mute source of truth.

When implementing camera sections or modals:

- Inspect the Home Assistant camera cards/modals first.
- Identify stream entities, controls, aspect ratios, loading states, unavailable states, and modal behavior.
- Use an appropriate WebRTC-capable implementation for the HA backend and document any dependency or Home Assistant integration requirement in code comments or project docs.
- Add Playwright coverage for opening camera views/modals and confirming a non-empty rendered stream container when feasible.

## Testing

Add tests as features are implemented.

- Every behavior-bearing implementation change must include a changed or added
  domain-appropriate test in the same change set. Application TypeScript may
  use a changed `src/**/*.test` or `e2e/**/*.spec.ts`; CSS behavior requires a
  changed Playwright spec; tooling requires a changed `scripts/**/*.test`; Home
  Assistant behavior requires a changed HA or scripts test. Documentation-only
  and test-only changes are exempt.
- Ownership must be explicit: use a same-stem test where one exists, otherwise
  add `@covers repository/relative/implementation-path` to the changed test.
  CSS coverage therefore uses an exact `@covers` declaration in the changed
  Playwright spec. Do not make a false ownership declaration.
- Run `npm run test:change-policy` before completion. The deterministic check
  evaluates the actual Git change set and rejects implementation-only patches.
  Do not touch an unrelated test solely to make the gate pass.
- Unit tests: component rendering, hooks, entity formatting, service-call behavior, modal open/close behavior, navigation state.
- Playwright tests: page routing, bottom nav behavior, expected visible sections, modal open/close, core entity controls, WebRTC/camera containers.
- UX completion requires the canonical responsive matrix in
  `docs/ux/validation-matrix.md`; mobile-only or resized-mobile desktop
  coverage is insufficient.
- Prefer focused tests added with each page or reusable component rather than one large late test pass.
- Do not rely on live Home Assistant for unit tests; mock HAKit/HA state and services there.
- Use the live Home Assistant browser tab for planning and manual verification.

## Implementation Order

1. Build shell, route structure, shared Page shell, mobile bottom nav, and shared styling tokens.
2. Recreate `at-a-glance/overview` content and its modals.
3. Add reusable entity controls as they appear: light slider, climate display, occupancy/contact status, alarm/security controls, todo list controls, camera/WebRTC cards.
4. Move page-by-page through the Home Assistant dashboard tabs, planning each page before implementing it.
5. Add Playwright tests alongside each completed page behavior.

## Git And Safety

- The project is backed by the private GitHub repo `https://github.com/SFenton/ha-sfenton-react-dash`.
- The default branch is `master`.
- If PowerShell does not pick up `gh` from PATH, use the direct GitHub CLI path: `& "C:\\Program Files\\GitHub CLI\\gh.exe" ...`.
- The repo was reset from an older dashboard; many old files may appear deleted in git. Do not restore old files unless explicitly requested.
- Do not print `VITE_HA_TOKEN` or other secrets.
- Do not commit changes unless explicitly requested.
- Keep changes focused on the current dashboard page or shared component needed for that page.
