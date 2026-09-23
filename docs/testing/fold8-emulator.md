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

## Isolated RTC pilot

Production Home and the maintained React panel keep Home Assistant HLS. To
prepare a reproducible RTC candidate locally from the current dashboard
worktree:

```bash
npm run build -- --mode rtc-pilot
npx vite build --mode fold-bridge --config vite.fold-bridge.config.ts
npx tsx scripts/prepare-fold-test-dashboard.ts <absolute-SFenton-WebRTC-fork-path>
```

Verify that the dashboard entry bundle contains `webrtc-camera-sfenton` but
not `camera/stream`. The second build emits one self-contained,
`sfenton-react-fold-app-card.js` module with its own custom element tag; it
must not import hashed chunks or replace the production bridge. The preparer
stages the dashboard, Fold card, and the pinned v3.10.3 fork frontend with
three relative JavaScript dependencies in
`.deploy/fold-rtc-dashboard/www/ha-sfenton-react-dash-fold-test/`. The preparer
rejects a default HLS build and records file digests in the stage root's
`rtc-pilot-frontend.json`. A second staging attempt must use a fresh output
directory so the first candidate remains auditable. Do **not** use
`npm run prepare:ios-test-dashboard`: that rebuilds the existing iOS test
app as HLS and does not stage the Fold candidate.

The SFenton/WebRTC integration must be enabled before real RTC playback can
work. On the initial Fold pilot this was enabled and registered the existing
**global v3.10.1 Lovelace resource**. This is a historical observation, not
permission to repeat the live change. The candidate v3.10.3
frontend lives only under the admin-only Fold test dashboard
asset folder and uses the integration's unchanged HA-signed backend. Home,
panel, iOS-test and Duo-test assets must remain intact. Register only the new
Fold card resource from the staged deployment plan. Lovelace resources are
instance-wide, so this extra module loads on other Lovelace pages but defines
a distinct custom element; leave the existing production card registration
unchanged. Each future deployment, integration change, resource update or
restart requires explicit approval with a recorded previous state and rollback.
The older iOS-test dashboard carries dirty-labeled RTC assets; fingerprint
its actual served files for historical comparisons. The current
camera entity IDs belong to `src/constants/atAGlance.ts`; the pilot stream
names there were corroborated against the existing RTC test host, though the
front-door feed yielded audio samples but no decoded video frames in Chromium
on 2026-09-22. Do not call a connected peer without advancing frames Live.

For visual fill, compare the RTC card host **and its shadow video** with the
tile frame. Both heights must match within one CSS pixel while loading, live,
or unavailable. Preserve tile `object-fit: cover` and modal `contain`; a
full-height `<video>` nested inside an intrinsically short custom element
still leaves a blank band. The initial Fold pilot showed a 134.88px phone
tile frame but only 52.05px of Driveway video and 97.59px of Deck video; the
Fold-only tile-height fix restored all three to the frame height in Chromium
at 393px and 1280px. Linux WebKit showed a second intrinsic-height issue:
the Driveway fill-modal card/video was 179.5px tall inside a 107.69px frame.
The Fold-only fill-modal rule made the card, inner player and video match the
frame without changing `contain`. Mocked Chromium and WebKit geometry
checks cover tile loading/live/unavailable states and modal phone, landscape
and wide geometries; deployed WebKit and Chromium checks cover real card
structure, though WebKit/WPE could not decode the live camera stream.
Physical iOS paint still needs inspection.

For a warm-return trace, navigate to `/sfenton-react-fold-test/home` **once**
in the authenticated Companion app, then background and foreground the
existing activity without using `openHomeAssistantRoute`: that helper can
force-stop the app. Record its process and activity identity, the exact host
and served asset hashes, and a screenshot before and after. A deep link is a
cold navigation control, not a warm-resume test. The official release WebView
exposes only `NATIVE_APP`, so use a separately identified browser trace for
the outer/inner `performance.timeOrigin`, iframe and lifecycle IDs, HA versus
fork signaling sockets, peer/ICE identity, decoded or presented frame counts,
received audio and mute state. Neither a retained Android process nor a
`connected` card label proves that the document, video or sound survived.

Compare matched cameras and network/device conditions against production
HLS, recording distributions of foreground-to-first **new** frame and
failed-stream recovery before deciding whether RTC is materially better.
Test a short warm background, a controlled HA websocket interruption,
visibility around the fork's 30-second last-subscriber and 60-second
hidden-retention windows, then a separate OS-discard case. Confirm an
audio-bearing camera has a received track, advancing audio data and audible
output after a gesture; autoplay policy may mute again. Establish the
acceptance threshold from that baseline, not an assumed number. Mocked RTC
tests and browser-only asset interception certify local state transitions,
not deployed parity. The first real Fold host browser trial retained the
inner `performance.timeOrigin` while video frames and received Opus samples
advanced across separate camera-signaling and HA WebSocket reconnects; the
Driveway control remained unmuted. The Fold 8 emulator retained the Driveway
modal and Audio state across short, 75-second, and six-minute warm returns,
but its official release WebView does not expose DOM tracing or verify audible
speaker output. In this emulator Upper and Lower Deck kept loading and
logged video NACK/keyframe warnings during one long-lived run, but later
rendered after an intentional route departure and re-entry; desktop Chromium
decoded both consistently. Front Door offered Opus but no video codec in
the inspected stream. On 2026-09-22 its HA Frigate entity had been
unavailable since 18:27 PDT and HA logs reported RTSP first-packet/read
timeouts, before the RTC integration was enabled for this pilot. Treat the
device/source cause and the operator's exact iOS tile-versus-picture symptom
as open evidence gaps, not four-camera or audible parity.
