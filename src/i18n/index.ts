export { copy, copyRef, resolveCopy, type CopyKey, type CopyRef, type CopyText, type CopyValues } from './copy'
export { APP_LANGUAGE, APP_LOCALE, formatDate, formatList, formatNumber } from './formatters'
export { copyNamespaces, resources, type CopyNamespace, type CopyResources } from './resources'
export { useCopy } from './useCopy'

export const COMMON_COPY_NAMESPACE = 'common' as const
export const BATHROOM_FAN_COPY_NAMESPACE = 'modalBathroomFan' as const
export const VACUUM_COPY_NAMESPACE = 'modalVacuum' as const
export const GARAGE_DOOR_COPY_KEYS = {
  sendingClose: 'garageDoor.sendingClose',
  sendingOpen: 'garageDoor.sendingOpen',
} as const

export const BATHROOM_FAN_COPY_KEYS = {
  autoDisableLock: 'autoDisableLock',
  clear: 'clear',
  durations: {
    fiveMinutes: 'durations.fiveMinutes',
    fifteenMinutes: 'durations.fifteenMinutes',
    oneHour: 'durations.oneHour',
    tenMinutes: 'durations.tenMinutes',
    thirtyMinutes: 'durations.thirtyMinutes',
    twentyMinutes: 'durations.twentyMinutes',
  },
  fan: 'fan',
  humidity: 'humidity',
  hintBody: 'hintBody',
  hintOff: 'hintOff',
  hintOn: 'hintOn',
  hintTitle: 'hintTitle',
  lock: 'lock',
  power: 'power',
  roomOccupancy: 'roomOccupancy',
  roomTemperatureRange: 'roomTemperatureRange',
  set: 'set',
  states: {
    clear: 'states.clear',
    locked: 'states.locked',
    occupied: 'states.occupied',
    off: 'states.off',
    on: 'states.on',
    unavailable: 'states.unavailable',
    unlocked: 'states.unlocked',
  },
  timerRowLabel: 'timerRowLabel',
  title: 'title',
  timer: 'timer',
} as const

export const VACUUM_COPY_KEYS = {
  cleaned: 'cleaned',
  issues: 'issues',
  selectedRooms: 'selectedRooms',
} as const
