import { copy, WAKE_LIGHT_COPY_KEYS, WAKE_LIGHT_COPY_NAMESPACE } from '../i18n'

export type WakeLightSourceSide = 'left' | 'right'

export interface WakeLightSourceConfig {
  alarmLabel: string
  alarmsLabel: string
  editorHash: string
  id: string
  side: WakeLightSourceSide
}

export interface WakeLightConfig {
  hash: string
  id: string
  lightEntityId: string
  occupancyEntityId: string
  pblEntityId: string
  roomSectionTitle: string
  sleepypodScheduleEntityId: string
  sourceBindings: readonly WakeLightSourceConfig[]
  statusEntityId: string
  targetLightEntityIds: readonly string[]
  title: string
  vacationEntityId: string
}

export const MASTER_BEDROOM_WAKE_LIGHT: WakeLightConfig = {
  hash: '#wake-light-alarms-master-bedroom',
  id: 'master-bedroom',
  lightEntityId: 'light.master_bedroom',
  occupancyEntityId: 'binary_sensor.master_bedroom_occupancy_sensors',
  pblEntityId: 'switch.master_bedroom_presence_master_bedroom_presence_allowed',
  roomSectionTitle: copy(WAKE_LIGHT_COPY_NAMESPACE, WAKE_LIGHT_COPY_KEYS.roomSection),
  sleepypodScheduleEntityId: 'sensor.master_bedroom_sleepypod_eight_pod_schedules',
  sourceBindings: [
    {
      alarmLabel: "Stephen's Alarm",
      alarmsLabel: "Stephen's Alarms",
      editorHash: '#stephens-bed',
      id: 'sleepypod:left',
      side: 'left',
    },
    {
      alarmLabel: "Steph's Alarm",
      alarmsLabel: "Steph's Alarms",
      editorHash: '#stephs-bed',
      id: 'sleepypod:right',
      side: 'right',
    },
  ],
  statusEntityId: 'sensor.master_bedroom_wake_light',
  targetLightEntityIds: [
    'light.master_bedroom_window_light',
    'light.master_bedroom_door_light',
    'light.stephen_nightstand_light',
    'light.steph_nightstand_light',
  ],
  title: copy(WAKE_LIGHT_COPY_NAMESPACE, WAKE_LIGHT_COPY_KEYS.title),
  vacationEntityId: 'input_boolean.vacation_mode',
}

const WAKE_LIGHTS = [MASTER_BEDROOM_WAKE_LIGHT] as const

export function wakeLightForStatusEntity(entityId: string) {
  return WAKE_LIGHTS.find((config) => config.statusEntityId === entityId)
}

export function wakeLightSourceForSide(config: WakeLightConfig, side: WakeLightSourceSide) {
  return config.sourceBindings.find((source) => source.side === side)
}
