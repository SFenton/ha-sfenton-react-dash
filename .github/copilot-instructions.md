# ha-sfenton-react-dash - Copilot Instructions

## Project Goal

Recreate the Home Assistant `at-a-glance` dashboard as a React app using `ha-component-kit`/HAKit. The React app should mirror the Home Assistant dashboard page by page, starting with `at-a-glance`, while improving maintainability through reusable local components, tests, and responsive shell patterns.

Primary target is mobile. Build so tablet and desktop layouts are straightforward extensions, but do not let desktop concerns distort the mobile experience.

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
```

When running terminal commands, explicitly set the working directory to this repo or use `npm --prefix "C:\\Users\\sfent\\source\\repos\\homeassistant\\ha-sfenton-react-dash" ...`; terminals may reuse another workspace folder.

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

After every production deployment, bump the Home Assistant wrapper card URL query string so the sidebar dashboard reloads `index.html` instead of a cached copy. Use a unique value such as the commit SHA or `YYYYMMDD-HHMM`:

```text
/local/ha-sfenton-react-dash/index.html?v=<unique-deploy-version>
```

Use Home Assistant MCP to update the storage-mode dashboard:

1. Read the current wrapper config with `ha_config_get_dashboard(url_path="sfenton-react-dash", force_reload=True)`.
2. Update the custom card URL with `ha_config_set_dashboard(url_path="sfenton-react-dash", config_hash=<hash>, python_transform="config['views'][0]['cards'][0]['url'] = '/local/ha-sfenton-react-dash/index.html?v=<unique-deploy-version>'")`.
3. Re-open or reload `/sfenton-react-dash/home` and verify it loads the same deployed version.

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
8. Resize both the live Home Assistant tab and local React tab to a mobile viewport first, preferably iPhone-sized such as `393x852`, and capture/compare the mobile layout before desktop or tablet refinements.
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
- Modals should use the shared `<ModalSheet />` behavior and must remain mounted for the `open={false}` render on close so the slide-out animation runs. Do not immediately unmount, re-key, or swap sheets when X/backdrop/swipe/hash close is requested.
- Use the darker HA-style modal surface app-wide: shared modals and picker dialogs should use the near-black `hass-popup` treatment, not translucent blue/glass backgrounds, unless a divergence is explicitly requested and documented.
- Prefer lightweight packages when they materially speed up native-feeling interactions or accessibility, but keep them focused and document why they are worth adding before installing.
- Use CSS Modules for components with meaningful styling; use inline styles only for tiny one-off cases.
- Do not use staggered entrance animations on pages or inside modals; page and modal content should appear together without sequential delays.
- Keep dimensions stable for controls, cards, sliders, button groups, modals, and nav items so live entity updates do not cause layout jumps.

## Home Assistant Integration

- Use HAKit and `@hakit/core` for Home Assistant state, services, and connection management.
- Controls must call real Home Assistant services.
- Controls whose click behavior changes by entity state must encode and test that state-to-service mapping explicitly, such as on/off helpers that press different input buttons or scripts for startup versus shutdown.
- Entity-aware components should be reusable and typed narrowly enough to prevent invalid service calls where practical.
- Avoid hard-coded UI state if the corresponding Home Assistant entity state is available.
- Keep entity IDs and route/page configuration in constants rather than scattering strings across components.

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
- Sidebar dashboard: `/sfenton-react-dash/home`

Always validate the raw app with a cache-busting query param, and always bump the wrapper card URL after copying `dist/`. The custom wrapper iframe can keep loading cached `index.html` even after the SMB copy succeeds.

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

- Unit tests: component rendering, hooks, entity formatting, service-call behavior, modal open/close behavior, navigation state.
- Playwright tests: page routing, bottom nav behavior, expected visible sections, modal open/close, core entity controls, WebRTC/camera containers.
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
