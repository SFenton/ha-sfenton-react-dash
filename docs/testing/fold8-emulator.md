# Galaxy Z Fold 8 Home Assistant app tests

The Fold emulator suite runs through the installed official Home Assistant Companion app (`io.homeassistant.companion.android`). It does not launch Chrome and does not use a standalone Vite test server.

```bash
# Run every emulator scenario
npm run test:emulator

# List selectable scenarios
npm run test:emulator:list

# Run one scenario or any combination
npm run test:emulator -- geometry
npm run test:emulator -- routes keyboard
npm run test:emulator -- hash-modals,interactive-modals,touch
```

Each category is declared in a separate file under `e2e/emulator/scenarios/`. The shared runner starts one Appium session and executes the selected files in the requested order, so combinations do not repeatedly restart Home Assistant. Full scenario IDs printed by `test:emulator:list` are also accepted.

Appium launches Home Assistant's `.webview.WebViewActivity` in the `NATIVE_APP` context. Routes and hashes are opened with Home Assistant deep links such as:

```text
homeassistant://navigate/sfenton-react-dash/home?path=security
```

The Companion app must already be authenticated to Home Assistant, and the deployed React dashboard must be available at `/sfenton-react-dash/home`. Override the dashboard host path with `EMULATOR_HA_DASHBOARD_PATH` when needed.

## Physical profile

- Closed cover display: `1248x1972`
- Half-open/tabletop display: `2448x1848`
- Open inner display: `2448x1848`
- Rear-display mode is configured but excluded from the normal run because transferring display ownership terminates the active automation connection.

## Coverage

The suite verifies:

- Appium is attached to the Home Assistant package and WebView activity in `NATIVE_APP`, never a Chrome browser session.
- The Home Assistant process and activity survive physical closed → open → closed transitions.
- Every route in `RESPONSIVE_ROUTES` renders in the authenticated, deployed dashboard and survives a fold cycle.
- Native app/window dimensions, system-bar clipping, WebView coverage, accessibility bounds, and non-empty screenshots are valid in each posture.
- Hash-opened modals survive fold cycles; user-opened modals are reopened and validated independently in cover and inner-display postures.
- A real Appium touch-pointer gesture dismisses a Home Assistant-hosted sheet.
- Hardware-keyboard input reaches a dashboard form while Android's software keyboard remains suppressed.

The official release APK does not expose a debuggable `WEBVIEW_*` context. Appium therefore drives the Companion app through Android's native accessibility tree. DOM-level tracing, WebKit behavior, desktop fine-pointer layouts, preload instrumentation, deterministic animation timing, and iframe lifecycle assertions remain in Playwright. `e2e/emulator/playwright-port-manifest.ts` records the disposition of every top-level Playwright spec and the emulator suite fails when that inventory becomes incomplete.

## Local configuration

Machine-specific values are environment overrides rather than checked-in test logic. Copy `.env.emulator.example` to the ignored `.env.emulator`, adjust it for the host, then source it before running:

```bash
cp .env.emulator.example .env.emulator
set -a; . .env.emulator; set +a
npm run test:emulator -- geometry
```

The shared config in `e2e/emulator/config.ts` supplies portable defaults and reads:

- `ANDROID_HOME`, `ADB_BIN`, `APPIUM_BIN`
- `EMULATOR_ADB_DEVICE` for a specific ADB serial; omit it when only one device is connected
- `EMULATOR_APPIUM_HOST`, `EMULATOR_APPIUM_PORT`, `EMULATOR_APPIUM_EXTERNAL=1`
- `EMULATOR_UDID`, `EMULATOR_DEVICE_NAME`
- `EMULATOR_HA_PACKAGE`, `EMULATOR_HA_ACTIVITY`, `EMULATOR_HA_DASHBOARD_PATH`
- `EMULATOR_SIZE_*` and `EMULATOR_STATE_*` for alternate foldable profiles

The Galaxy Fold dimensions and state IDs remain documented defaults because they define the profile under test; they can be replaced without editing the harness.
