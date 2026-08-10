import type { RoomSourceCardAction, RoomSourceCardConfig } from '../constants/roomPages'

function configuredCommandDescription(action: Exclude<RoomSourceCardAction, { type: 'state' }>, title: string) {
  if (action.type === 'toggle') {
    return 'Immediate direct action — toggles this physical control without opening a detail sheet or confirmation.'
  }
  if (action.domain === 'script' && action.service === 'launch_app_on_media_player') {
    return `Immediate direct action — launches ${title} through the configured media script; no detail sheet opens.`
  }
  if (action.domain === 'script') {
    return `Immediate direct action — runs the configured ${title} command; no detail sheet opens.`
  }
  if (action.domain === 'input_button' && action.service === 'press') {
    return 'Immediate direct action — presses the configured command button; no detail sheet opens.'
  }
  return `Immediate direct action — sends the configured ${action.domain} ${action.service.replaceAll('_', ' ')} command; no detail sheet opens.`
}

export function roomReferenceInteractionDescription(card: RoomSourceCardConfig) {
  if (card.action?.type === 'state') {
    return 'State-dependent direct action — when the displayed power helper is On, it presses the configured Off command; in every other state it presses the configured On command. No detail sheet opens.'
  }
  if (card.action) return configuredCommandDescription(card.action, card.title)
  if (card.hash && card.disabledStates?.length) {
    const states = card.disabledStates.map((state) => state[0]?.toUpperCase() + state.slice(1)).join(', ')
    return `Conditional detail opener — opens its focused sheet only while active. ${states} leave the card muted and status-only.`
  }
  if (card.hash) {
    return 'Detail opener — opens a focused sheet; the card itself does not send the commands available inside that sheet.'
  }
  return 'Status only — reports live state and does not open a sheet or send a command.'
}
