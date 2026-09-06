import { LAYOUT_JOURNEYS, RESPONSIVE_ROUTES } from '../responsive-acceptance-data'
import { ROOM_PAGE_CONFIGS } from '../../src/constants/roomPages'
import { CONTEXTS, SCENARIO_IDS, SURFACE_CONTRACTS, type ContextId, type ScenarioId } from './contracts'
import type { Obligation } from './types'

export const SOURCE_ROUTES = RESPONSIVE_ROUTES
export const SOURCE_ROOM_OPENERS = Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => {
  const cards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
  return [...new Set(cards.flatMap((card) => card.hash ? [card.hash] : []))]
    .map((hash) => ({ route: room.path, hash }))
})

export function journey(scenario: ScenarioId, context: ContextId = 'touch-chromium'): readonly string[] {
  if (scenario === 'preload') return ['phone-portrait']
  if (scenario === 'host') return ['desktop', 'island-phone-landscape-left', 'island-phone-landscape-right', 'desktop']
  if (context === 'fine-chromium') return scenario === 'navigation'
    ? ['desktop', 'rail-below', 'rail-at', 'wide-desktop', 'desktop']
    : ['desktop', 'island-phone-portrait', 'island-phone-landscape-left', 'wide-desktop', 'desktop']
  if (context === 'touch-webkit') return ['island-phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right', 'rectangular-phone-landscape', 'island-phone-portrait']
  return scenario === 'navigation' ? LAYOUT_JOURNEYS.navigation : LAYOUT_JOURNEYS.modal
}

export function obligationsFor(scenarios: readonly ScenarioId[], contexts: readonly ContextId[]): Obligation[] {
  return scenarios.flatMap((scenario) => contexts.flatMap((context) => SURFACE_CONTRACTS[scenario].states.flatMap((state) =>
    journey(scenario, context).map((profile, step, profiles) => {
      const review = context === 'touch-chromium'
        ? (scenario === 'preload' || (scenario === 'host' && profile === 'island-phone-landscape-right') || (scenario === 'navigation'
            ? ['phone-portrait', 'phone-landscape', 'ipad-landscape', 'passport-foldable-landscape', 'square-foldable-landscape'].includes(profile) && profiles.indexOf(profile) === step
            : ['island-phone-portrait', 'island-phone-landscape-left'].includes(profile) && (state !== 'back' || step === profiles.length - 1)))
        : context === 'fine-chromium'
          ? profile === 'desktop' && profiles.indexOf(profile) === step
          : scenario === 'summary' && profile === 'island-phone-landscape-right'
      return { id: `${scenario}/${state}/${context}/${step}-${profile}`, scenario, state, context, profile, step, review }
    }),
  )))
}

export function validateRegistry() {
  if (!SOURCE_ROUTES.length || new Set(SOURCE_ROUTES).size !== SOURCE_ROUTES.length) throw new Error('Invalid source route inventory')
  if (!SOURCE_ROOM_OPENERS.length) throw new Error('Configured room opener inventory is empty')
  for (const id of SCENARIO_IDS) {
    const surface = SURFACE_CONTRACTS[id]
    if (!surface.owners.length || !surface.states.length || !surface.question.trim()) throw new Error(`Incomplete surface contract: ${id}`)
    if (new Set(surface.states).size !== surface.states.length) throw new Error(`Duplicate states: ${id}`)
  }
  if (Object.keys(CONTEXTS).length !== 3) throw new Error('Unexpected context inventory')
}
