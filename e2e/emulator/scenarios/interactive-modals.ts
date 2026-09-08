import { runButtonModalFoldCycles, scenarioCounts, type EmulatorScenario } from '../fold8-suite'

export const interactiveModalsScenario: EmulatorScenario = {
  id: 'button-modal-fold-cycle',
  run: runButtonModalFoldCycles,
  successMessage: () => `${scenarioCounts.buttonModals} Home Assistant interactive modals passed posture checks`,
}
