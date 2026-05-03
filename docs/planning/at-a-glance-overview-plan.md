# At-A-Glance Overview Plan

## Planning Inputs

- Home Assistant MCP baseline: `ha_config_get_dashboard(url_path="at-a-glance", force_reload=True)`.
- Live Home Assistant browser page: `/at-a-glance/overview`.
- Local React browser page: `/`.
- Mobile comparison viewport used first: `393x852`.
- FNF reference app: `FortniteFestivalWeb`, especially page shell, bottom nav, modal, frosted effects, and stagger helpers.

Use the MCP dashboard config as the structural source of truth for entity IDs, view paths, popup hashes, and navigation actions. Use Playwright inspection and screenshots as the source of truth for runtime layout, scroll behavior, modal behavior, motion, and visual feel.

## Home Assistant Structure

The dashboard registry exposes the storage dashboard as:

- Dashboard URL path: `at-a-glance`
- Main view path: `overview`
- View type: `sections`

The overview page content is organized as:

- Page header: home icon and `Home` title.
- Horizontal status chip rail:
  - `light.lights` -> `#lights-overview`
  - `alarm_control_panel.aqara_hub_m3_0056_security_system_2` -> `#security-system`
  - `input_text.all_climate_range` with `input_text.all_climate_color` -> `#climate-overview`
  - `binary_sensor.occupancy_sensors` -> `#occupancy-overview`
  - `binary_sensor.contact_sensors` -> `#contact-sensors-overview`
  - AQI summary from `input_text.all_aqi_color`, `input_text.all_aqi_range`, `input_text.all_pm25_range` -> `#aqi-overview`
- `Weather` section with a large clock/weather card and forecast bars.
- `Quick Access` section with large two-column tiles:
  - Security System -> `#security-system`
  - Ecobee -> `/at-a-glance/ecobee`
  - Vacuums -> `/at-a-glance/vacuums`
  - Media -> `/at-a-glance/media`
  - Custom Lights -> `/at-a-glance/custom-lights`
- `Cameras` section:
  - Front Door -> `#camera-front-door`
  - Driveway -> `#camera-driveway`
  - Upper Deck -> `#camera-upper-deck`
  - Lower Deck -> `#camera-lower-deck`
- `Areas` section with two-column room tiles and route navigation.

Important popup hashes discovered from MCP include:

- Overview popups: `#lights-overview`, `#security-system`, `#climate-overview`, `#occupancy-overview`, `#contact-sensors-overview`, `#aqi-overview`.
- Camera popups: `#camera-front-door`, `#camera-driveway`, `#camera-upper-deck`, `#camera-lower-deck`.
- Room popups: `#lights-living-room`, `#climate-living-room`, `#living-room-occupancy`, plus equivalent light/climate/occupancy/contact/window/vent hashes for other rooms.
- Admin/settings popups: `#presence-based-overrides`, `#presence-based-overrides-auto`.

Primary route targets include:

- `/at-a-glance/living-room`, `/guest-room`, `/master-bedroom`, `/gym`, `/hallway`, `/office`, `/kitchen`, `/dining-room`, `/back-deck`, `/music-room`, `/theater-room`, `/downstairs-hallway`, `/garage`, `/guest-bathroom`, `/master-bathroom`, `/entryway`.
- `/at-a-glance/security`, `/chores`, `/ecobee`, `/vacuums`, `/media`, `/custom-lights`, `/admin`, `/settings`, `/to-do`, `/groceries`, and chore subpages.

## Mobile Findings

At `393x852`, Home Assistant renders the overview as the real design target:

- A blurred/photo-like full-page backdrop is always visible behind content.
- Top dashboard tabs become a horizontal icon rail, separate from the content. We should not recreate Home Assistant's own top browser chrome, but our route chrome should preserve the fast icon-first navigation feel.
- The first viewport shows the header, status chip rail, weather heading, weather card, start of quick access, and fixed bottom nav.
- The status chip rail scrolls horizontally. Only a subset is visible in the first viewport.
- Section headings use a white title plus a long translucent horizontal rule.
- Weather card is a large rounded glass panel, about one full mobile width, with oversized current time and forecast bars.
- Quick access and areas use two-column, rounded, tactile tiles with saturated state colors and frosted edges.
- Bottom nav is fixed/frosted, respects safe area, and overlays the page content.
- Page scrolling is vertical; nested horizontal scrolling is used for the top dashboard rail and status chips.

Popup behavior at mobile width:

- Hash popups render as full-height overlays over a dimmed and blurred page.
- App chrome remains faintly visible behind the overlay.
- Close button floats at top right as a circular glass control.
- Popup content scrolls independently.
- Popup cards are two-column capsule rows, not small desktop cards.
- Section headings inside popups use the same title plus long divider rule pattern.
- Lights popup: dense light capsules grouped by room, with orange/brown active state and gray inactive state.
- Climate popup: room climate groups, warm sensor capsules, and vent capsules.
- Security popup: one wide status card plus a two-column control grid for home, away, night, disarmed.

## Visual Direction

Target a native iOS Home app feel, not a generic dashboard:

- Use a real visual backdrop or captured/selected home image, blurred and dimmed. Avoid purely decorative gradients as the main background.
- Use layered materials: page backdrop, translucent content surfaces, dim modal scrim, frosted nav.
- Use large touch targets: status chips, quick tiles, area tiles, modal capsules.
- Use springy but short interactions: press scale, sheet open/close, nav active state, card entrance.
- Keep text density low in the page grid; move detailed controls into modal sheets.
- Use icon-first controls with short labels.
- Preserve clear mobile safe-area spacing at the bottom nav and popup close area.

Useful material values from the HA config:

- Popup/card material: `rgba(25, 36, 54, 0.55)` with `backdrop-filter: blur(20px)`.
- Popup/card border: `1px solid rgba(255, 255, 255, 0.18)`.
- Weather card radius from HA: `32px`.
- Navbar material from HA: `rgba(25, 36, 54, 0.55)`, blur `20px`, heavy dark shadow.

## Component Plan

Shell and routing:

- `src/components/shell/AppShell.tsx`: full-screen app frame, background layer, route chrome slots, bottom nav.
- `src/components/shell/BackgroundLayer.tsx`: image/backdrop blur, dim overlay, optional saturation.
- `src/components/shell/BottomNav.tsx`: FNF-inspired fixed/frosted bottom nav with Home, Security, Ecobee, Chores, Settings.
- `src/components/shell/TopViewRail.tsx`: optional horizontal icon rail for quick dashboard view switching.
- `src/routes.ts`: centralized route constants and route helpers modeled after FNF.

Page primitives:

- `src/pages/Page.tsx`: adapt FNF Page shell for scroll container, scroll restoration, scroll masks, load phase, and bottom spacing.
- `src/components/core/SectionHeader.tsx`: title plus divider rule.
- `src/components/core/GlassTile.tsx`: base Home-style tile surface with variants for neutral, active, warning, climate, area.
- `src/components/core/IconButton.tsx`: circular frosted icon button with tooltip where needed.
- `src/components/core/ModalSheet.tsx`: hash-driven full-screen mobile sheet and adaptive desktop panel.
- `src/components/core/StatusRail.tsx`: horizontal scrolling status chips.
- `src/components/core/TileGrid.tsx`: stable two-column mobile grid with responsive expansion later.

Home page components:

- `src/pages/AtAGlancePage.tsx`: declarative composition of overview sections.
- `src/components/hass/OverviewStatusChip.tsx`: entity-backed top rail chips.
- `src/components/hass/WeatherOverviewCard.tsx`: HASS weather/clock data mapped into the large mobile card.
- `src/components/hass/QuickAccessTile.tsx`: route/hash tile for security, ecobee, vacuums, media, custom lights.
- `src/components/hass/CameraTile.tsx`: live camera tile with modal open behavior.
- `src/components/hass/AreaTile.tsx`: route tile for rooms, with icon and optional state color.

Modal content components:

- `src/components/hass/LightOverviewSheet.tsx`: grouped light capsules; starts with important lights and all lights.
- `src/components/hass/ClimateOverviewSheet.tsx`: room climate groups and vent capsules.
- `src/components/hass/SecuritySheet.tsx`: alarm status card plus action capsules.
- `src/components/hass/OccupancySheet.tsx`: grouped occupancy sensors.
- `src/components/hass/ContactSensorsSheet.tsx`: grouped door/window sensors.
- `src/components/hass/AqiSheet.tsx`: AQI and PM2.5 cards.
- `src/components/hass/CameraSheet.tsx`: WebRTC-capable stream detail view.

Data/constants:

- `src/constants/atAGlance.ts`: static route/hash/entity inventory extracted from MCP.
- `src/constants/areas.ts`: room route metadata, icons, and popup hash conventions.
- `src/constants/entities.ts`: named entity constants for overview summaries.
- `src/hooks/useHashModal.ts`: maps `location.hash` to modal state and closes by clearing hash.
- `src/hooks/useHomeAssistantService.ts`: typed service helper wrappers where HAKit alone is too loose.

Styles:

- `src/styles/tokens.css`: CSS variables for materials, radius, spacing, durations, z-index, safe-area offsets.
- `src/styles/effects.module.css`: FNF-inspired frosted nav/header/card effects plus edge fades.
- `src/styles/animations.module.css`: fade/slide/spring keyframes and reduced-motion handling.

## FNF Patterns To Take

Take or adapt these patterns from `FortniteFestivalWeb`:

- `src/pages/Page.tsx`: adapt the page shell, scroll container, scroll restore, load phase slots, and bottom spacer behavior. Replace `@festival/theme` imports with local CSS variables and CSS modules.
- `src/hooks/ui/useStaggerStyle.ts`: take nearly wholesale. It is simple, framework-independent, and ideal for card/list entrance animations.
- `src/hooks/data/useLoadPhase.ts`: take the state machine idea. Replace `LoadPhase` enum imports with a local enum.
- `src/components/shell/mobile/BottomNav.tsx`: take the route-aware tab definition and frosted nav pattern, but swap icons and tokens.
- `src/styles/effects.module.css`: take the CSS-module pattern for `backdrop-filter`, edge fades, and frosted chrome.
- `src/hooks/ui/useModalState.ts`: take wholesale for non-hash modals and settings dialogs.
- `src/components/modals/Modal.tsx`: adapt the API if we do not use `vaul` for sheets.
- Test style from FNF page/modal tests: route visibility, nav active state, modal open/close, draft cancel/apply, scroll restoration, and animation cleanup.

Do not copy FNF's visual theme. Use the architecture and mechanics, then style for Home Assistant/iOS Home.

## Package Recommendations

Checked current npm metadata:

- `lucide-react` 1.14.0: recommended. Provides consistent React icons. Use before hand-rolled SVGs.
- `motion` 12.38.0: recommended for springy sheet/card/nav transitions if CSS keyframes feel too stiff.
- `vaul` 1.1.2: recommended to prototype modal sheets quickly. It maps well to the mobile popup behavior and can still be styled as Home material.
- `embla-carousel-react` 8.6.0: defer. Use CSS scroll snap first for the status rail; add Embla only if touch precision or momentum feels weak.
- `react-aria-components` 1.17.0: defer. Valuable for complex accessible controls, but probably heavier than needed for the first overview pass.

Initial install candidate once implementation begins:

```bash
npm install lucide-react motion vaul
```

## First Build Sequence

1. Add local tokens/effects/animations modules.
2. Port/adapt FNF `Page`, `BottomNav`, `useStaggerStyle`, `useLoadPhase`, and `useModalState` patterns.
3. Add `routes.ts`, `constants/atAGlance.ts`, `constants/areas.ts`, and `hooks/useHashModal.ts` using the MCP dashboard inventory.
4. Build `AppShell` with background layer and fixed bottom nav.
5. Build `AtAGlancePage` mobile-first: header, status rail, weather card, quick access, cameras, areas.
6. Implement hash modal shell and the first three sheets: lights, climate, security.
7. Compare live HA and React at `393x852` after each major section.
8. Add focused tests for route rendering, bottom nav active state, hash modal open/close, and overview section visibility.

## Follow-Up Questions For Implementation

- Identify the exact background image/source used by the HA dashboard, or choose a real home image asset for the React app.
- Decide whether the top dashboard icon rail belongs in the React app, or whether bottom nav plus page content should replace it.
- Decide whether `vaul` should be installed immediately or after a CSS-only `ModalSheet` prototype.
- Confirm camera entities and WebRTC strategy before implementing camera sheets.