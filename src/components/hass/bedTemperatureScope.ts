export type SleepypodSchedulePhase = 'bedtime' | 'asleep' | 'dawn'
export type SleepypodSide = 'left' | 'right'
export type SleepypodTemperatureScope = 'tonight' | 'all-nights'

const SLEEPYPOD_SCHEDULE_PHASES = new Set<SleepypodSchedulePhase>(['bedtime', 'asleep', 'dawn'])

export const SLEEPYPOD_SCHEDULE_PHASE_ENTITY_IDS: Record<SleepypodSide, string> = {
  left: 'sensor.sleepypod_stephen_schedule_phase',
  right: 'sensor.sleepypod_steph_schedule_phase',
}

const SLEEPYPOD_TONIGHT_SERVICES: Record<SleepypodSide, string> = {
  left: 'sleepypod_stephen_temperature_tonight',
  right: 'sleepypod_steph_temperature_tonight',
}

const SLEEPYPOD_OUTSIDE_SCHEDULE_SERVICES: Record<SleepypodSide, string> = {
  left: 'sleepypod_stephen_temperature_outside_schedule',
  right: 'sleepypod_steph_temperature_outside_schedule',
}

export function sleepypodSchedulePhase(state: unknown): SleepypodSchedulePhase | null {
  if (typeof state !== 'string') return null
  const normalized = state.trim().toLowerCase()
  return SLEEPYPOD_SCHEDULE_PHASES.has(normalized as SleepypodSchedulePhase)
    ? normalized as SleepypodSchedulePhase
    : null
}

export function sleepypodSchedulePhaseAvailable(state: unknown) {
  if (typeof state !== 'string') return false
  const normalized = state.trim().toLowerCase()
  return normalized === 'outside' || SLEEPYPOD_SCHEDULE_PHASES.has(normalized as SleepypodSchedulePhase)
}

export function sleepypodSchedulePhaseLabel(phase: SleepypodSchedulePhase) {
  if (phase === 'bedtime') return 'Bedtime'
  if (phase === 'asleep') return 'Asleep'
  return 'Dawn'
}

export function sleepypodTonightTemperatureService(side: SleepypodSide) {
  return SLEEPYPOD_TONIGHT_SERVICES[side]
}

export function sleepypodOutsideScheduleTemperatureService(side: SleepypodSide) {
  return SLEEPYPOD_OUTSIDE_SCHEDULE_SERVICES[side]
}
