import { runSwipeDismissal, type EmulatorScenario } from '../fold8-suite'

export const touchScenario: EmulatorScenario = {
  id: 'touch-swipe-dismissal',
  run: runSwipeDismissal,
  successMessage: 'Native Appium touch swipe dismissed a Home Assistant-hosted sheet',
}
