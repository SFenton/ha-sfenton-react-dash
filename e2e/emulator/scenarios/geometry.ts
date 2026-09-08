import { runGeometryScenario, type EmulatorScenario } from '../fold8-suite'

export const geometryScenario: EmulatorScenario = {
  id: 'physical-display-geometry',
  run: runGeometryScenario,
  successMessage: 'Home Assistant passed cover, tabletop, and inner display states',
}
