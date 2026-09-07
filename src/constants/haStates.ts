// Configuration must stay importable without initializing HAKit's browser-only store.
export const OFF = 'off'
export const ON = 'on'
export const UNAVAILABLE = 'unavailable'
export const UNAVAILABLE_STATES = [UNAVAILABLE, 'unknown'] as const
