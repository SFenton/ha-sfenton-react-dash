import type { BathroomFanConfig } from '../../constants/bathroomFans'

export const BATHROOM_FAN_TIMER_MINUTES = [5, 10, 15, 20, 30, 60] as const
export const BATHROOM_FAN_DEFAULT_TIMER_MINUTES = 30

export type BathroomFanCommand =
  | { type: 'lock'; locked: boolean }
  | { type: 'power'; targetPower: 'off' | 'on' }
  | { type: 'timer-auto-unlock'; enabled: boolean }
  | { type: 'timer-cancel' }
  | { type: 'timer-start'; autoUnlock: boolean; minutes: number }

export function normalizeBathroomFanTimerMinutes(minutes: number) {
  return BATHROOM_FAN_TIMER_MINUTES.reduce((closest, candidate) =>
    Math.abs(candidate - minutes) < Math.abs(closest - minutes) ? candidate : closest,
  BATHROOM_FAN_DEFAULT_TIMER_MINUTES)
}

export function bathroomFanServiceCall(config: BathroomFanConfig, command: BathroomFanCommand): Record<string, unknown> {
  if (command.type === 'power') {
    return {
      domain: 'script',
      service: config.scriptService,
      serviceData: {
        command: 'power',
        target_power: command.targetPower,
      },
    }
  }

  if (command.type === 'lock') {
    return {
      domain: 'script',
      service: config.scriptService,
      serviceData: {
        command: 'lock',
        locked: command.locked,
      },
    }
  }

  if (command.type === 'timer-start') {
    return {
      domain: 'script',
      service: config.scriptService,
      serviceData: {
        auto_unlock: command.autoUnlock,
        command: 'timer_start',
        minutes: normalizeBathroomFanTimerMinutes(command.minutes),
      },
    }
  }

  if (command.type === 'timer-cancel') {
    return {
      domain: 'script',
      service: config.scriptService,
      serviceData: { command: 'timer_cancel' },
    }
  }

  return {
    domain: 'script',
    service: config.scriptService,
    serviceData: {
      command: 'timer_auto_unlock',
      enabled: command.enabled,
    },
  }
}
