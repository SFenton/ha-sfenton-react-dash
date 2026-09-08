export type EmulatorPortStatus = 'ported' | 'retained-browser-only'

export interface EmulatorPortDisposition {
  coverage: string[]
  reason?: string
  spec: string
  status: EmulatorPortStatus
}

export const EMULATOR_PORT_DISPOSITIONS = [
  { spec: 'adaptive-navigation.spec.ts', status: 'ported', coverage: ['physical-display-geometry', 'all-routes-fold-cycle'] },
  { spec: 'admin-relay-warning.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'State and copy semantics do not depend on physical fold geometry.' },
  { spec: 'bathroom-fans.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'battery-title-desktop-responsive.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Fine-pointer desktop geometry is outside the Fold 8 hardware envelope.' },
  { spec: 'chat-ux.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Mock chat transport, account storage isolation, DOM geometry, and synthetic keyboard instrumentation require the controlled browser runner.' },
  { spec: 'desktop-responsive.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Desktop rail and fine-pointer behavior require a desktop viewport.' },
  { spec: 'feedback-regressions.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'hash-modal-fold-cycle'] },
  { spec: 'garage-doors.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'home-route-hydration-desktop.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Desktop hydration geometry requires a desktop browser viewport.' },
  { spec: 'home-route-hydration.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'iframe-lifecycle-real-hakit.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Host iframe replacement requires browser instrumentation unavailable through the release app accessibility tree.' },
  { spec: 'iframe-lifecycle.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Host iframe disposal requires browser instrumentation unavailable through the release app accessibility tree.' },
  { spec: 'landscape-modal-adaptation.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'layout-acceptance.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'hash-modal-fold-cycle'] },
  { spec: 'layout-guards.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Static CSS and source guards are not runtime device behavior.' },
  { spec: 'mobile-device-smoke.spec.ts', status: 'ported', coverage: ['home-assistant-app-context', 'physical-display-geometry', 'all-routes-fold-cycle'] },
  { spec: 'mobile-parity-all-routes.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'modal-backdrop-bands.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle'] },
  { spec: 'modal-geometry-stability.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'modal-rotation-regressions.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'modal-sheet-gestures.spec.ts', status: 'ported', coverage: ['touch-swipe-dismissal'] },
  { spec: 'modal-sheet-lifecycle.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'modal-sheet-performance.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Deterministic frame timing and trace assertions require the controlled browser runner.' },
  { spec: 'modal-sheet-webkit.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'WebKit-specific behavior cannot run in the Android Home Assistant app.' },
  { spec: 'preload-inert.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Preload instrumentation uses browser startup hooks and is independent of fold hardware.' },
  { spec: 'react-dash.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'hash-modal-fold-cycle', 'button-modal-fold-cycle', 'hardware-keyboard'] },
  { spec: 'real-hakit-dials.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Detailed live HAKit dial semantics require DOM-level browser instrumentation.' },
  { spec: 'recipe-keyboard-focus.spec.ts', status: 'ported', coverage: ['hardware-keyboard'] },
  { spec: 'responsive-layout.spec.ts', status: 'ported', coverage: ['physical-display-geometry', 'all-routes-fold-cycle'] },
  { spec: 'responsive-modal-inventory.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'responsive-modals.spec.ts', status: 'ported', coverage: ['hash-modal-fold-cycle', 'button-modal-fold-cycle', 'touch-swipe-dismissal'] },
  { spec: 'responsive-pages-all.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'safe-area-responsive.spec.ts', status: 'ported', coverage: ['home-assistant-app-context', 'physical-display-geometry', 'all-routes-fold-cycle'], reason: 'The emulator validates real Android app system bars; synthetic iOS cutouts remain browser-only.' },
  { spec: 'sprinklers.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'vacuum-outcomes.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'vacuum-status.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle', 'button-modal-fold-cycle'] },
  { spec: 'weather-atmosphere-scenes.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Deterministic canvas and atmosphere rendering assertions require browser-level controls.' },
  { spec: 'weather-carousel.spec.ts', status: 'ported', coverage: ['all-routes-fold-cycle'] },
  { spec: 'weather-data.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Weather data transformation semantics are geometry-independent.' },
  { spec: 'weather-modal-rendering.spec.ts', status: 'ported', coverage: ['button-modal-fold-cycle'] },
  { spec: 'weather-motion.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Motion-frame instrumentation requires the controlled browser runner.' },
  { spec: 'weather-scenes.spec.ts', status: 'retained-browser-only', coverage: [], reason: 'Deterministic scene rendering assertions require browser-level controls.' },
] as const satisfies readonly EmulatorPortDisposition[]

export const EMULATOR_SCENARIOS = new Set(EMULATOR_PORT_DISPOSITIONS.flatMap((entry) => entry.coverage))
