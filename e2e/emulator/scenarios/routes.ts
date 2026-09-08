import { runAllRouteFoldCycles, scenarioCounts, type EmulatorScenario } from '../fold8-suite'

export const routesScenario: EmulatorScenario = {
  id: 'all-routes-fold-cycle',
  run: runAllRouteFoldCycles,
  successMessage: () => `${scenarioCounts.routes} live Home Assistant routes passed closed → open → closed cycles`,
}
