import type { TileTone } from '../core/GlassTile'

export const VACUUM_CONSUMABLE_WARNING_MINUTES = 600

export type VacuumVisualTone = 'active' | 'danger' | 'neutral' | 'ok' | 'returning' | 'unavailable' | 'warning'

export interface VacuumVisualState {
  backgroundColor?: string
  icon: string
  iconColor?: string
  tileTone: TileTone
  tone: VacuumVisualTone
}

interface VacuumConsumableVisual {
  icon: string
  tone: VacuumVisualTone
}

const UNAVAILABLE_VISUAL: VacuumVisualState = {
  backgroundColor: undefined,
  icon: 'mdi:robot-vacuum-off',
  iconColor: 'rgba(255, 255, 255, 0.56)',
  tileTone: 'neutral',
  tone: 'unavailable',
}

const UNKNOWN_STATE_VISUAL: VacuumVisualState = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  icon: 'mdi:robot-vacuum',
  tileTone: 'neutral',
  tone: 'neutral',
}

const VACUUM_STATE_VISUALS: Record<string, VacuumVisualState> = {
  cleaning: {
    backgroundColor: 'rgba(0, 150, 136, 0.58)',
    icon: 'mdi:broom',
    tileTone: 'vacuum',
    tone: 'active',
  },
  docked: {
    backgroundColor: 'rgba(67, 160, 71, 0.48)',
    icon: 'mdi:home',
    tileTone: 'vacuum',
    tone: 'ok',
  },
  error: {
    backgroundColor: 'rgba(229, 57, 53, 0.5)',
    icon: 'mdi:alert-circle',
    tileTone: 'danger',
    tone: 'danger',
  },
  idle: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    icon: 'mdi:robot-vacuum',
    tileTone: 'neutral',
    tone: 'neutral',
  },
  paused: {
    backgroundColor: 'rgba(251, 140, 0, 0.5)',
    icon: 'mdi:pause-circle',
    tileTone: 'warning',
    tone: 'warning',
  },
  returning: {
    backgroundColor: 'rgba(30, 136, 229, 0.5)',
    icon: 'mdi:home-import-outline',
    tileTone: 'vacuum',
    tone: 'returning',
  },
}

function normalizedState(state: string | undefined) {
  return state?.trim().toLowerCase() ?? ''
}

export function isUnavailableVacuumState(state: string | undefined) {
  const normalized = normalizedState(state)
  return normalized === '' || normalized === 'unavailable' || normalized === 'unknown'
}

export function vacuumStateVisual(state: string | undefined): VacuumVisualState {
  if (isUnavailableVacuumState(state)) return UNAVAILABLE_VISUAL
  return VACUUM_STATE_VISUALS[normalizedState(state)] ?? UNKNOWN_STATE_VISUAL
}

export function vacuumConsumableVisual(configuredIcon: string, valueKind: 'duration' | 'status', state: string | undefined): VacuumConsumableVisual {
  if (isUnavailableVacuumState(state)) {
    return { icon: 'mdi:help-circle-outline', tone: 'unavailable' }
  }

  if (valueKind === 'status') {
    return normalizedState(state) === 'ok'
      ? { icon: configuredIcon, tone: 'ok' }
      : { icon: 'mdi:alert-circle', tone: 'warning' }
  }

  const minutes = Number(state)
  if (!Number.isFinite(minutes)) return { icon: configuredIcon, tone: 'neutral' }
  if (minutes <= 0) return { icon: 'mdi:wrench-clock', tone: 'danger' }
  if (minutes <= VACUUM_CONSUMABLE_WARNING_MINUTES) return { icon: 'mdi:timer-alert-outline', tone: 'warning' }
  return { icon: configuredIcon, tone: 'neutral' }
}
