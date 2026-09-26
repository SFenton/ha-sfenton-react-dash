export interface BathroomFanConfig {
  autoUnlockEntityId: string
  deadlineEntityId: string
  hash: string
  id: 'guest' | 'master'
  lockEntityId: string
  pendingEntityId: string
  powerEntityId: string
  scriptService: string
  timerEntityId: string
}

export const BATHROOM_FANS = {
  guest: {
    autoUnlockEntityId: 'input_boolean.guest_bathroom_fan_timer_auto_unlock',
    deadlineEntityId: 'input_datetime.guest_bathroom_fan_timer_ends_at',
    hash: '#fan-guest-bathroom',
    id: 'guest',
    lockEntityId: 'input_boolean.guest_bathroom_fan_automation_lock',
    pendingEntityId: 'input_boolean.guest_bathroom_fan_timer_pending',
    powerEntityId: 'switch.guest_bathroom_fan_switch_top',
    scriptService: 'guest_bathroom_fan_command',
    timerEntityId: 'timer.guest_bathroom_fan_off_timer',
  },
  master: {
    autoUnlockEntityId: 'input_boolean.master_bathroom_fan_timer_auto_unlock',
    deadlineEntityId: 'input_datetime.master_bathroom_fan_timer_ends_at',
    hash: '#fan-master-bathroom',
    id: 'master',
    lockEntityId: 'input_boolean.master_bathroom_fan_automation_lock',
    pendingEntityId: 'input_boolean.master_bathroom_fan_timer_pending',
    powerEntityId: 'switch.master_bathroom_fan_switch_top',
    scriptService: 'master_bathroom_fan_command',
    timerEntityId: 'timer.master_bathroom_fan_off_timer',
  },
} as const satisfies Record<BathroomFanConfig['id'], BathroomFanConfig>

export const BATHROOM_FAN_CONFIGS = Object.values(BATHROOM_FANS)

export function bathroomFanForPowerEntity(entityId: string) {
  return BATHROOM_FAN_CONFIGS.find((config) => config.powerEntityId === entityId)
}

export function bathroomFanForHash(hash: string | undefined) {
  return BATHROOM_FAN_CONFIGS.find((config) => config.hash === hash)
}
