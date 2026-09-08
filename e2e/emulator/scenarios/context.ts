import { runContextScenario, type EmulatorScenario } from '../fold8-suite'

export const contextScenario: EmulatorScenario = {
  id: 'home-assistant-app-context',
  run: runContextScenario,
  successMessage: 'Appium is attached to the installed Home Assistant app, not Chrome',
}
