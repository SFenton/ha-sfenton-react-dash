import process from 'node:process'
import { runEmulatorScenarios } from './fold8-suite'
import { contextScenario } from './scenarios/context'
import { geometryScenario } from './scenarios/geometry'
import { hashModalsScenario } from './scenarios/hash-modals'
import { interactiveModalsScenario } from './scenarios/interactive-modals'
import { keyboardScenario } from './scenarios/keyboard'
import { routesScenario } from './scenarios/routes'
import { touchScenario } from './scenarios/touch'

const scenarios = [
  contextScenario,
  geometryScenario,
  routesScenario,
  hashModalsScenario,
  interactiveModalsScenario,
  touchScenario,
  keyboardScenario,
] as const

const aliases = new Map(scenarios.flatMap((scenario) => {
  const shortName = scenario.id
    .replace('-fold-cycle', '')
    .replace('home-assistant-app-', '')
    .replace('physical-display-', '')
    .replace('touch-swipe-dismissal', 'touch')
    .replace('hardware-keyboard', 'keyboard')
    .replace('all-routes', 'routes')
    .replace('button-modal', 'interactive-modals')
    .replace('hash-modal', 'hash-modals')
  return [[scenario.id, scenario], [shortName, scenario]] as const
}))

const requestedNames = process.argv.slice(2).flatMap((value) => value.split(',')).filter(Boolean)

if (requestedNames.includes('--list')) {
  for (const scenario of scenarios) console.log(scenario.id)
  process.exit(0)
}

const selectedScenarios = requestedNames.length === 0
  ? [...scenarios]
  : requestedNames.map((name) => {
      const scenario = aliases.get(name)
      if (!scenario) {
        throw new Error(`Unknown emulator scenario "${name}". Run npm run test:emulator:list to see available scenarios.`)
      }
      return scenario
    }).filter((scenario, index, selected) => selected.indexOf(scenario) === index)

await runEmulatorScenarios(selectedScenarios, scenarios.map((scenario) => scenario.id))
