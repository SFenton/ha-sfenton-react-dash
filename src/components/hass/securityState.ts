import type { CardColor } from '../core/Card'

type SecurityModeState = 'armed_away' | 'armed_home' | 'armed_night' | 'disarmed' | 'triggered'

const UNKNOWN_SECURITY_COLOR: CardColor = { r: 84, g: 110, b: 122 }

const SECURITY_STATE_META = {
  armed_away: { color: { r: 229, g: 57, b: 53 }, icon: 'mdi:shield' },
  armed_home: { color: { r: 30, g: 136, b: 229 }, icon: 'mdi:shield-home' },
  armed_night: { color: { r: 142, g: 36, b: 170 }, icon: 'mdi:shield-moon' },
  disarmed: { color: { r: 67, g: 160, b: 71 }, icon: 'mdi:shield-off' },
  triggered: { color: { r: 229, g: 57, b: 53 }, icon: 'mdi:shield-alert' },
} satisfies Record<SecurityModeState, { color: CardColor; icon: string }>

function securityStateMeta(state?: string) {
  return state && state in SECURITY_STATE_META ? SECURITY_STATE_META[state as SecurityModeState] : { color: UNKNOWN_SECURITY_COLOR, icon: 'mdi:shield-outline' }
}

export function securityStateColor(state?: string): CardColor {
  return securityStateMeta(state).color
}

export function securityStateCssColor(state?: string, alpha = 0.46) {
  const color = securityStateColor(state)
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

export function securityStateIconName(state?: string) {
  return securityStateMeta(state).icon
}