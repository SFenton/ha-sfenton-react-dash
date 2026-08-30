export { copy, copyRef, resolveCopy, type CopyKey, type CopyRef, type CopyText, type CopyValues } from './copy'
export { APP_LANGUAGE, APP_LOCALE, formatDate, formatList, formatNumber } from './formatters'
export { copyNamespaces, resources, type CopyNamespace, type CopyResources } from './resources'
export { useCopy } from './useCopy'

export const COMMON_COPY_NAMESPACE = 'common' as const
export const CORE_COPY_NAMESPACE = 'core' as const
export const CUSTOM_LIGHTS_COPY_NAMESPACE = 'pageCustomLights' as const
export const BATHROOM_FAN_COPY_NAMESPACE = 'modalBathroomFan' as const
export const HUMIDIFIER_COPY_NAMESPACE = 'modalHumidifier' as const
export const VACUUM_COPY_NAMESPACE = 'modalVacuum' as const
export const WEATHER_COPY_NAMESPACE = 'modalWeather' as const
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

export const HUMIDIFIER_COPY_KEYS = {
  dial: {
    humiditySummary: 'dial.humiditySummary',
    mistSummary: 'dial.mistSummary',
    outputSummary: 'dial.outputSummary',
    targetHumiditySummary: 'dial.targetHumiditySummary',
  },
  states: {
    unavailable: 'states.unavailable',
  },
} as const

export const WEATHER_COPY_KEYS = {
  aqi: {
    ariaLabel: 'aqi.ariaLabel',
    categories: {
      good: 'aqi.categories.good',
      hazardous: 'aqi.categories.hazardous',
      moderate: 'aqi.categories.moderate',
      sensitive: 'aqi.categories.sensitive',
      unhealthy: 'aqi.categories.unhealthy',
      veryUnhealthy: 'aqi.categories.veryUnhealthy',
    },
    guidance: {
      good: 'aqi.guidance.good',
      hazardous: 'aqi.guidance.hazardous',
      moderate: 'aqi.guidance.moderate',
      sensitive: 'aqi.guidance.sensitive',
      unhealthy: 'aqi.guidance.unhealthy',
      veryUnhealthy: 'aqi.guidance.veryUnhealthy',
    },
    title: 'aqi.title',
    unavailableAriaLabel: 'aqi.unavailableAriaLabel',
  },
  details: {
    ariaLabel: 'details.ariaLabel',
    sun: {
      sunrise: 'details.sun.sunrise',
      sunset: 'details.sun.sunset',
    },
    uv: {
      categories: {
        extreme: 'details.uv.categories.extreme',
        high: 'details.uv.categories.high',
        low: 'details.uv.categories.low',
        moderate: 'details.uv.categories.moderate',
        veryHigh: 'details.uv.categories.veryHigh',
      },
    },
    wind: {
      ariaLabel: 'details.wind.ariaLabel',
      bearingDegrees: 'details.wind.bearingDegrees',
      calm: 'details.wind.calm',
      direction: 'details.wind.direction',
      from: 'details.wind.from',
      gusts: 'details.wind.gusts',
      speed: 'details.wind.speed',
      todaysGust: 'details.wind.todaysGust',
    },
  },
  headline: {
    aqi: 'headline.aqi',
    label: 'headline.label',
    weather: 'headline.weather',
  },
  hero: {
    high: 'hero.high',
    highLow: 'hero.highLow',
    low: 'hero.low',
  },
  hourlyMetrics: {
    ariaLabel: 'hourlyMetrics.ariaLabel',
    cloudCover: 'hourlyMetrics.cloudCover',
    humidity: 'hourlyMetrics.humidity',
    table: {
      time: 'hourlyMetrics.table.time',
    },
    tableCaption: 'hourlyMetrics.tableCaption',
  },
  precipitation: {
    chanceChartAriaLabel: 'precipitation.chanceChartAriaLabel',
    cumulativeChartAriaLabel: 'precipitation.cumulativeChartAriaLabel',
    cumulativeHeading: 'precipitation.cumulativeHeading',
    now: 'precipitation.now',
    table: {
      amount: 'precipitation.table.amount',
      chance: 'precipitation.table.chance',
      cumulative: 'precipitation.table.cumulative',
      time: 'precipitation.table.time',
    },
    tableCaption: 'precipitation.tableCaption',
    title: 'precipitation.title',
  },
  subtitle: 'subtitle',
  unavailable: 'unavailable',
} as const

export const CORE_COPY_KEYS = {
  groups: {
    controls: 'groups.controls',
  },
  modal: {
    dailyReportSections: 'modal.dailyReportSections',
    humidifierSections: 'modal.humidifierSections',
    sectionNavigation: 'modal.sectionNavigation',
    tabItemCount: 'modal.tabItemCount',
  },
} as const

export const CUSTOM_LIGHTS_COPY_KEYS = {
  frontYard: 'frontYard',
  lightingMode: 'lightingMode',
} as const
