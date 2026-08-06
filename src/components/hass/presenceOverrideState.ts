export const PRESENCE_OVERRIDE_STATES = ['on', 'off', 'paused', 'quieted', 'active'] as const

export type PresenceOverrideState = (typeof PRESENCE_OVERRIDE_STATES)[number]
export type PresenceOverrideDisplayState = PresenceOverrideState | 'unavailable'

interface PresenceEntityState {
  attributes: Record<string, unknown>
  state: string
}

const ACTIVE_AUTOMATION_STATES = new Set(['occupied', 'clearing', 'waiting_for_clear', 'settling_on', 'settling_off', 'pending_activation'])

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
  if (ACTIVE_AUTOMATION_STATES.has(automationState)) return 'active'
  if (switchState === 'on') return 'on'
  return 'unavailable'
}

export function isPresenceOverrideState(value: string): value is PresenceOverrideState {
  return (PRESENCE_OVERRIDE_STATES as readonly string[]).includes(value)
}
