# Weather atmosphere contract

`WeatherAtmosphere` is decorative, pointer-transparent, and mounted by the existing
Weather modal lifecycle. Weather normally follows live Home Assistant conditions.
There is no background selector. Development/test diagnostics can explicitly use
`?weatherSceneDebug=1&weatherScene=snow`; the override is read when Weather opens.
Existing condition aliases such as `weatherScene=rainy` still map to Rain only
with that debug flag. Old dropdown URLs without the flag, invalid scenes and
production builds use live conditions. Removing `weatherScene` restores live
conditions on the next open. No URL listener, timer or service is added.
Weather data, forecast services, carousel controls and modal/backdrop ownership
remain unchanged.

## Scene budgets

| Scene | Rendering contract |
| --- | --- |
| Rain | The accepted 34 original drops plus the original 28-second light animation. Preserve descriptors, inline/computed styles, logical keyframes, timings, phase layout and lifecycle. |
| Storm | 44 existing descriptors; Storm-only length ×1.2 and duration ×0.90. Two bounded cloud planes and one localized illumination element. |
| Snow | 34 deterministic SVG descriptors, 28 active below a 700px scene-container width. Three sizes (5/8/12px), varied crystalline geometry, independent precomputed sway/rotation paths and depth-related descent. One transform animation per flake; no full-height wrappers. Readability shading protects the header, hero and labels. |
| Fog | Two animated planes **total**, reusing `.light` and `.motion`, at 37/53 seconds. Their combined geometric area is below 2.6 atmosphere areas, with scene-local readability shading. |
| Wind | Four bounded, asymmetric SVG wisps with tapered strokes and soft halos. Independent transform/opacity cycles finish and restart while invisible; no repeating background texture. Two static wisps remain under reduced motion. |
| Night | Naturally distributed fixed-opacity stars move together on one very slow plane over a restrained static glow. No tiled star texture, independent twinkling or falling-star effect. |
| Sunny / Clouds | Existing visual language and motion with scene-local readability shading. |
| Exceptional / Neutral | Existing artwork and static behavior unchanged. |

Storm illumination has isolated peaks at 9/28/54 seconds in a 61-second cycle,
with approximately 0.9-second rise and 1.3-second decay. There is no negative
lightning delay, secondary pulse, red flash, or whole-screen white overlay.
Its TSX element exists only for Storm, not for the broader Rain/Storm branch.
The strengthened single-event peaks are 0.24/0.30/0.26; rendered local luminance
and glyph contrast, not opacity values alone, gate that intensity.

Snow geometry and deterministic descriptors live in `weatherAtmosphereModel.ts`.
Negative delays distribute initial phases without timers or runtime randomness.
Its container supplies `cqh` travel distances without layout observers.
Each flake's sway and rotation samples are computed once from deterministic
descriptors, rather than driving React or JavaScript on animation frames.

## Lifecycle and accessibility

- All animated atmospheric elements pause during the mounted close transition.
- Reduced motion removes atmospheric animations. Snow retains 12 scattered,
  static flakes with their individual orientations; Rain retains its existing
  hidden-field behavior.
- Forced colors hides the decorative atmosphere.
- Scene-local shading corrects observed contrast failures without modifying the
  shared shade used by Rain or the shared `ModalSheet` implementation.
- Contrast validation must inspect actual text/icon ink at adverse phases,
  including particles crossing Snow's temperature and labels. A low sample in
  empty space inside an SVG bounding rectangle is not automatically an icon failure.

Snow's stronger protection intentionally extends through its hero and labels.
These occupy most of a short landscape sheet; the lower fade is not assumed to
be header-only. Keep visibility and glyph contrast checks together when tuning it.

## Regression evidence

The Rain descriptor fingerprint in `WeatherAtmosphere.test.tsx` was captured from
the user-approved preview before these changes; it is not generated from the
candidate renderer. Generated CSS-module identifiers are not stable references.
The existing build can serialize a zero-Z `translate3d` as `translate`; the
portable browser guard checks exact resolved transform values.

`e2e/weather-atmosphere-scenes.spec.ts` is explicitly selected by mobile, genuine
desktop, and optional WebKit projects. Existing scene-selection, rendering,
backdrop and preload tests remain guards. Particle boundaries use
`delay + n * duration`, not `duration` alone. Keep non-target clocks fixed for
reset comparisons and inspect naturally running motion separately. Use fresh,
CSS-owned animations for close tests: imperative `Animation.play()` can override
CSS play-state ownership.

Transform/opacity motion, bounded element counts, and painting rectangles are
strategies, not energy results. Use warm paint/raster/frame observations for
regressions. Chromium or Linux WebKit observations do not establish physical
iPhone thermal behavior or Safari rendered-pixel parity; retain the independent
blur-positive-control limitation documented in `validation-matrix.md`.
