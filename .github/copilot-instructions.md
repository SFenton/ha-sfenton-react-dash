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
npm run deploy
```

When running terminal commands, explicitly set the working directory to this repo or use `npm --prefix "C:\\Users\\sfent\\source\\repos\\homeassistant\\ha-sfenton-react-dash" ...`; terminals may reuse another workspace folder.

## Architecture Direction

Model the structure after `FortniteFestivalWeb`, but do not copy code between projects.

Preferred layout:

| Path | Purpose |
| --- | --- |
| `src/pages/` | Page-level views such as `AtAGlancePage`, `SecurityPage`, room pages, chores pages |
| `src/pages/Page.tsx` | Shared page shell: scroll container, scroll restoration, stagger/rush behavior, loading/error spacing |
| `src/components/core/` | Reusable dashboard primitives: cards, buttons, headers, modals, sliders, section headers |
| `src/components/hass/` | HA entity-aware controls: light sliders, climate cards, alarm controls, todo controls, camera/WebRTC cards |
| `src/components/shell/` | App shell, mobile header, bottom navigation, route chrome |
| `src/constants/` | Reused route, entity, area, section, icon, timing, and animation constants |
| `src/hooks/` | Reusable UI and Home Assistant hooks |
| `src/styles/` | Shared CSS modules for effects, animations, layout tokens, stagger utilities |
| `src/test/` or colocated `*.test.tsx` | Unit tests for components, hooks, and page behavior |
| `e2e/` | Playwright tests added as behavior is implemented |

Keep page files declarative. Move repeated behavior into local reusable components or hooks once it is used by multiple pages or clearly represents a reusable HA dashboard pattern.

## Home Assistant Recreation Workflow

Before implementing each Home Assistant page:

1. Pull the matching Lovelace dashboard config through Home Assistant MCP before or alongside browser inspection. For the main dashboard, use `ha_config_get_dashboard(url_path="at-a-glance", force_reload=True)`; use search mode to find specific entities, card types, headings, popup hashes, and navigation targets when the full config is too large.
2. Treat the MCP dashboard config as the structural baseline for entity IDs, view paths, popup hashes, card groupings, navigation actions, and custom-card behavior. Treat Playwright/browser inspection as the source of truth for runtime layout, scrolling, modal behavior, visual details, and interaction feel.
3. Inspect the matching page in the live Home Assistant browser tab.
4. Scroll vertically and horizontally inside the page and inside nested containers. Record what scrolls, what stays fixed, and which direction each container scrolls.
5. Click visible controls and cards on the page.
6. If a click navigates to another page, note the target and immediately navigate back.
7. If a click opens a modal, inspect and recreate the modal content, layout, controls, dismiss behavior, and any internal scrolling.
8. Resize both the live Home Assistant tab and local React tab to a mobile viewport first, preferably iPhone-sized such as `393x852`, and capture/compare the mobile layout before desktop or tablet refinements.
9. Capture screenshots when visual fidelity matters; use accessibility snapshots for structure and text.
10. Implement the React page against the real Home Assistant backend, not mock data, unless writing tests.
11. Validate in the local React tab and compare against the Home Assistant tab at the same viewport size.

Do not recreate the Home Assistant sidebar or top bar for now. Focus on the dashboard content, page headers, tab/bottom navigation, sections, buttons, modals, and entity controls.

## UI Expectations

- Match the Home Assistant dashboard headers, buttons, section headers, content grouping, card density, and modal behavior closely.
- Design toward a fluid native iOS Home app feel: blurred material layers, clear safe-area handling, springy touch feedback, fast transitions, large tactile tiles, and restrained text density.
- Primary layout is mobile-first with comfortable touch targets and no text overlap.
- Bottom navigation should be modeled after the FortniteFestivalWeb mobile bottom nav pattern: a route-aware fixed/frosted nav surface with icon+label buttons and clear active state.
- Use reusable primitives for recurring patterns such as section headers, quick access buttons, entity rows, chip buttons, modal sheets, light sliders, and camera cards.
- Prefer lightweight packages when they materially speed up native-feeling interactions or accessibility, but keep them focused and document why they are worth adding before installing.
- Use CSS Modules for components with meaningful styling; use inline styles only for tiny one-off cases.
- Use stagger/rush-stagger behavior for list/card entrance animations where it improves perceived responsiveness.
- Keep dimensions stable for controls, cards, sliders, button groups, modals, and nav items so live entity updates do not cause layout jumps.

## Home Assistant Integration

- Use HAKit and `@hakit/core` for Home Assistant state, services, and connection management.
- Controls must call real Home Assistant services.
- Entity-aware components should be reusable and typed narrowly enough to prevent invalid service calls where practical.
- Avoid hard-coded UI state if the corresponding Home Assistant entity state is available.
- Keep entity IDs and route/page configuration in constants rather than scattering strings across components.

## WebRTC And Cameras

Camera implementation must support real WebRTC behavior, not static placeholders.

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

- The repo was reset from an older dashboard; many old files may appear deleted in git. Do not restore old files unless explicitly requested.
- Do not print `VITE_HA_TOKEN` or other secrets.
- Do not commit changes unless explicitly requested.
- Keep changes focused on the current dashboard page or shared component needed for that page.
