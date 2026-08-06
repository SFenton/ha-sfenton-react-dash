export const PRESENCE_OVERRIDE_STATES = ['enabled', 'off', 'paused', 'quieted'] as const

export type PresenceOverrideState = (typeof PRESENCE_OVERRIDE_STATES)[number]
export type PresenceOverrideDisplayState = PresenceOverrideState | 'unavailable'

interface PresenceEntityState {
  attributes: Record<string, unknown>
  state: string
}

function normalizedString(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function attributeIsTrue(value: unknown) {
  const normalized = normalizedString(value)
  return value === true || normalized === 'true' || normalized === 'on'
}

export function presenceOverrideDisplayState(entity: PresenceEntityState | null | undefined): PresenceOverrideDisplayState {
  if (!entity) return 'unavailable'
  const switchState = normalizedString(entity.state)
  if (switchState === 'off') return 'off'
  if (switchState === 'unavailable' || switchState === 'unknown') return 'unavailable'
  const automationState = normalizedString(entity.attributes.automation_state)
  if (automationState === 'paused' || attributeIsTrue(entity.attributes.automation_paused)) return 'paused'
  if (automationState === 'quieted' || attributeIsTrue(entity.attributes.automation_quieted)) return 'quieted'
  if (switchState === 'on') return 'enabled'
  return 'unavailable'
}

export function presenceOverrideServiceState(state: PresenceOverrideState) {
  return state === 'enabled' ? 'active' : state
}
