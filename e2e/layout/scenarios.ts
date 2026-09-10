import { LAYOUT_JOURNEYS, RESPONSIVE_ROUTES } from '../responsive-acceptance-data'
import { ROOM_PAGE_CONFIGS } from '../../src/constants/roomPages'
import { CONTEXTS, INTENTIONAL_ROUTE_ADDITIONS, SCENARIO_IDS, SURFACE_CONTRACTS, type ContextId, type ScenarioId } from './contracts'
import type { Obligation } from './types'

export const SOURCE_ROUTES = RESPONSIVE_ROUTES
export const SOURCE_ROOM_OPENERS = Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => {
  const cards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
  return [...new Set(cards.flatMap((card) => card.hash ? [card.hash] : []))]
    .map((hash) => ({ route: room.path, hash }))
})

export function journey(scenario: ScenarioId, context: ContextId = 'touch-chromium'): readonly string[] {
  if (scenario === 'preload') return ['phone-portrait']
  if (scenario === 'wake-source') {
    const source = context === 'fine-chromium'
      ? ['desktop', 'island-phone-portrait', 'island-phone-landscape-left', 'wide-desktop', 'desktop']
      : context === 'touch-webkit'
        ? ['island-phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right', 'rectangular-phone-landscape', 'island-phone-portrait']
        : [...LAYOUT_JOURNEYS.modal]
    return [...source.slice(0, -1), 'dialog-block-798', 'dialog-block-799', 'dialog-block-800', source.at(-1)!]
  }
  if (scenario === 'wake-editor') {
    // Pending saves have a real ten-second response limit; preserve normal clocks.
    return context === 'fine-chromium'
      ? ['desktop', 'island-phone-portrait', 'desktop']
      : ['island-phone-portrait', 'island-phone-landscape-left', 'island-phone-portrait']
  }
  if (scenario === 'host') return ['desktop', 'island-phone-landscape-left', 'island-phone-landscape-right', 'desktop']
  if (context === 'fine-chromium') return scenario === 'navigation' || scenario === 'wake-room'
    ? ['desktop', 'rail-below', 'rail-at', 'wide-desktop', 'desktop']
    : ['desktop', 'island-phone-portrait', 'island-phone-landscape-left', 'wide-desktop', 'desktop']
  if (context === 'touch-webkit') return ['island-phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right', 'rectangular-phone-landscape', 'island-phone-portrait']
  return scenario === 'navigation' || scenario === 'wake-room' ? LAYOUT_JOURNEYS.navigation : LAYOUT_JOURNEYS.modal
}

export function obligationsFor(scenarios: readonly ScenarioId[], contexts: readonly ContextId[]): Obligation[] {
  return scenarios.flatMap((scenario) => contexts.flatMap((context) => SURFACE_CONTRACTS[scenario].states.flatMap((state) =>
    journey(scenario, context).map((profile, step, profiles) => {
      const review = context === 'touch-chromium'
        ? (scenario === 'preload' || (scenario === 'wake-source' && profile === 'dialog-block-799') || (scenario === 'host' && profile === 'island-phone-landscape-right') || (scenario === 'navigation' || scenario === 'wake-room'
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
    for (const [state, selector] of Object.entries(surface.readOnlyTerminals ?? {})) {
      if (!surface.states.includes(state) || !selector.trim()) throw new Error(`Unbound read-only terminal: ${id}/${state}`)
    }
  }
  if (Object.keys(CONTEXTS).length !== 3) throw new Error('Unexpected context inventory')
  for (const [route, addition] of Object.entries(INTENTIONAL_ROUTE_ADDITIONS)) {
    if (!SOURCE_ROUTES.includes(route as typeof SOURCE_ROUTES[number]) || !SCENARIO_IDS.includes(addition.owner)
      || !addition.section || !addition.inherited.length || new Set(addition.inherited).size !== addition.inherited.length) {
      throw new Error(`Unbound intentional route addition: ${route}`)
    }
    for (const [profile, expected] of Object.entries(addition.viewports)) {
      if (!['phone-portrait', 'phone-landscape'].includes(profile)
        || [expected.height, expected.width, expected.tileWidth].some(value => !Number.isFinite(value) || value <= 0)
        || Object.keys(expected.shifts).sort().join('\n') !== [...addition.inherited].sort().join('\n')
        || Object.values(expected.shifts).some(shift => !Number.isFinite(shift.x) || !Number.isFinite(shift.y))) {
        throw new Error(`Invalid route-addition oracle: ${route}/${profile}`)
      }
    }
  }
}
