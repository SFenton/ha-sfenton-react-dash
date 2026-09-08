import { runKeyboardTest, type EmulatorScenario } from '../fold8-suite'

export const keyboardScenario: EmulatorScenario = {
  id: 'hardware-keyboard',
  run: runKeyboardTest,
  successMessage: 'Hardware keyboard input passed through the Home Assistant app',
}
