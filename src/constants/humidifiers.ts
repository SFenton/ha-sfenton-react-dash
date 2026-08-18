export type HumidifierMode = 'Manual' | 'Target Humidity' | 'Sleep'

export interface HumidifierConfig {
  applyProfileScriptService: string
  currentHumidityEntityId: string
  currentTemperatureEntityId: string
  displayEntityId: string
  humidifyingEntityId: string
  id: string
  mistLevelEntityId: string
  modeEntityId: string
  powerEntityId: string
  scheduleEnabledEntityId: string
  scheduleEntityId: string
  scheduleId: string
  setLevelScriptService: string
  tankRemovedEntityId: string
  targetHumidityEntityId: string
  timerMinutesEntityId: string
  timerRemainingEntityId: string
  title: string
  vacationModeEntityId: string
  warmLevelEntityId: string
  waterLowEntityId: string
}

export const HUMIDIFIER_MODES: { icon: string; label: string; value: HumidifierMode }[] = [
  { icon: 'mdi:water', label: 'Manual', value: 'Manual' },
  { icon: 'mdi:fan-auto', label: 'Auto Humidity', value: 'Target Humidity' },
  { icon: 'mdi:weather-night', label: 'Sleep', value: 'Sleep' },
]

export const HUMIDIFIER_MIST_PRESETS = [
  { icon: 'mdi:fan-speed-1', label: 'Low', value: 2 },
  { icon: 'mdi:fan-speed-2', label: 'Medium', value: 5 },
  { icon: 'mdi:fan-speed-3', label: 'High', value: 8 },
  { icon: 'mdi:fan', label: 'Max', value: 9 },
] as const

export const HUMIDIFIER_WARM_LEVELS = [
  { icon: 'mdi:power', label: 'Off', value: 0 },
  { icon: 'mdi:fire', label: 'Low', value: 1 },
  { icon: 'mdi:fire', label: 'Medium', value: 2 },
  { icon: 'mdi:fire', label: 'High', value: 3 },
] as const

export const MASTER_BEDROOM_HUMIDIFIER: HumidifierConfig = {
  applyProfileScriptService: 'master_bedroom_humidifier_apply_profile',
  currentHumidityEntityId: 'sensor.lv600s_humidifier_current_humidity',
  currentTemperatureEntityId: 'sensor.lv600s_humidifier_current_temperature',
  displayEntityId: 'switch.lv600s_humidifier_display',
  humidifyingEntityId: 'binary_sensor.lv600s_humidifier_humidifying',
  id: 'master-bedroom-lv600s',
  mistLevelEntityId: 'number.lv600s_humidifier_mist_level',
  modeEntityId: 'select.lv600s_humidifier_mode',
  powerEntityId: 'switch.lv600s_humidifier_power',
  scheduleEnabledEntityId: 'input_boolean.master_bedroom_humidifier_schedule_enabled',
  scheduleEntityId: 'schedule.master_bedroom_humidifier',
  scheduleId: 'master_bedroom_humidifier',
  setLevelScriptService: 'master_bedroom_humidifier_set_level',
  tankRemovedEntityId: 'binary_sensor.lv600s_humidifier_tank_removed',
  targetHumidityEntityId: 'number.lv600s_humidifier_target_humidity',
  timerMinutesEntityId: 'number.lv600s_humidifier_timer_minutes',
  timerRemainingEntityId: 'sensor.lv600s_humidifier_timer_remaining',
  title: 'Master Bedroom Humidifier',
  vacationModeEntityId: 'input_boolean.vacation_mode',
  warmLevelEntityId: 'number.lv600s_humidifier_warm_level',
  waterLowEntityId: 'binary_sensor.lv600s_humidifier_water_low',
}

export const HUMIDIFIERS = [MASTER_BEDROOM_HUMIDIFIER] as const

export function humidifierForPowerEntity(entityId: string) {
  return HUMIDIFIERS.find((humidifier) => humidifier.powerEntityId === entityId)
}
