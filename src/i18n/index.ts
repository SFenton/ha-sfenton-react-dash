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
  tile: {
    subtitleWithBattery: 'tile.subtitleWithBattery',
  },
  status: {
    conditions: {
      dockingMayBeIncomplete: 'status.conditions.dockingMayBeIncomplete',
      resumePending: 'status.conditions.resumePending',
      vacuumingOnly: 'status.conditions.vacuumingOnly',
    },
    currentIssue: 'status.currentIssue',
    errorSourceUnavailable: 'status.errorSourceUnavailable',
    errorSourceUnavailableHelp: 'status.errorSourceUnavailableHelp',
    homeAssistantCondition: 'status.homeAssistantCondition',
    loadingCurrentMap: 'status.loadingCurrentMap',
    loadingLastMapPosition: 'status.loadingLastMapPosition',
    lastReportedMap: 'status.lastReportedMap',
    lastReportedMapHelp: 'status.lastReportedMapHelp',
    lastReportedPosition: 'status.lastReportedPosition',
    mapUnavailable: 'status.mapUnavailable',
    mapUnavailableHelp: 'status.mapUnavailableHelp',
    previousIssue: 'status.previousIssue',
    previousIssueObserved: 'status.previousIssueObserved',
    queuedCleaningCanceled: 'status.queuedCleaningCanceled',
    unavailableLiveStatus: 'status.unavailableLiveStatus',
    unavailableHelp: 'status.unavailableHelp',
  },
  outcomes: {
    attempts: 'outcomes.attempts',
    backToControls: 'outcomes.backToControls',
    detailTitle: 'outcomes.detailTitle',
    groups: {
      done: 'outcomes.groups.done',
      interrupted: 'outcomes.groups.interrupted',
      needsAttention: 'outcomes.groups.needsAttention',
      stillDue: 'outcomes.groups.stillDue',
    },
    history: {
      diagnosticsTitle: 'outcomes.history.diagnosticsTitle',
      hide: 'outcomes.history.hide',
      hideDiagnostics: 'outcomes.history.hideDiagnostics',
      show: 'outcomes.history.show',
      showDiagnostics: 'outcomes.history.showDiagnostics',
      title: 'outcomes.history.title',
    },
    openDetail: 'outcomes.openDetail',
    outstanding: {
      mop: 'outcomes.outstanding.mop',
      vacuum: 'outcomes.outstanding.vacuum',
      vacuumMop: 'outcomes.outstanding.vacuumMop',
    },
    errorProgress: {
      vacuumCompleteMoppingRemaining: 'outcomes.errorProgress.vacuumCompleteMoppingRemaining',
      vacuumingAndMoppingRemaining: 'outcomes.errorProgress.vacuumingAndMoppingRemaining',
    },
    primary: {
      completed: {
        fallbackVacuum: 'outcomes.primary.completed.fallbackVacuum',
        vacuum: 'outcomes.primary.completed.vacuum',
        vacuumMop: 'outcomes.primary.completed.vacuumMop',
      },
      deferred: {
        mop: 'outcomes.primary.deferred.mop',
        vacuum: 'outcomes.primary.deferred.vacuum',
        vacuumMop: 'outcomes.primary.deferred.vacuumMop',
      },
      failed: {
        fallbackVacuum: 'outcomes.primary.failed.fallbackVacuum',
        vacuum: 'outcomes.primary.failed.vacuum',
        vacuumMop: 'outcomes.primary.failed.vacuumMop',
      },
      interrupted: {
        fallbackVacuum: 'outcomes.primary.interrupted.fallbackVacuum',
        vacuum: 'outcomes.primary.interrupted.vacuum',
        vacuumMop: 'outcomes.primary.interrupted.vacuumMop',
      },
      partialCredit: 'outcomes.primary.partialCredit',
    },
    reasonLabels: {
      attempt: 'outcomes.reasonLabels.attempt',
      outstanding: 'outcomes.reasonLabels.outstanding',
    },
    reasons: {
      autoEmptyBlocked: 'outcomes.reasons.autoEmptyBlocked',
      cleaningLiquidUnavailable: 'outcomes.reasons.cleaningLiquidUnavailable',
      cleaningNotStarted: 'outcomes.reasons.cleaningNotStarted',
      cleanWaterEmpty: 'outcomes.reasons.cleanWaterEmpty',
      dirtyWaterUnavailable: 'outcomes.reasons.dirtyWaterUnavailable',
      dispatchFailed: 'outcomes.reasons.dispatchFailed',
      dispatchTimeout: 'outcomes.reasons.dispatchTimeout',
      dispatchTimeoutWithoutDuration: 'outcomes.reasons.dispatchTimeoutWithoutDuration',
      dockUnreachable: 'outcomes.reasons.dockUnreachable',
      durationBelowMinimum: 'outcomes.reasons.durationBelowMinimum',
      durationBelowMinimumWithoutValues: 'outcomes.reasons.durationBelowMinimumWithoutValues',
      areaBelowMinimumWithoutValues: 'outcomes.reasons.areaBelowMinimumWithoutValues',
      estimatedRoomTimeBelowMinimum: 'outcomes.reasons.estimatedRoomTimeBelowMinimum',
      estimatedRoomTimeBelowMinimumWithoutValues: 'outcomes.reasons.estimatedRoomTimeBelowMinimumWithoutValues',
      freshWaterMissing: 'outcomes.reasons.freshWaterMissing',
      freshWaterUnavailable: 'outcomes.reasons.freshWaterUnavailable',
      freshWaterUnknown: 'outcomes.reasons.freshWaterUnknown',
      lowBattery: 'outcomes.reasons.lowBattery',
      mopAttachmentMissing: 'outcomes.reasons.mopAttachmentMissing',
      mopHardwareUnavailable: 'outcomes.reasons.mopHardwareUnavailable',
      resumeTimeout: 'outcomes.reasons.resumeTimeout',
      resumeTimeoutWithoutDuration: 'outcomes.reasons.resumeTimeoutWithoutDuration',
      roomRunCancelled: 'outcomes.reasons.roomRunCancelled',
      roomUnreachable: 'outcomes.reasons.roomUnreachable',
      segmentNotReported: 'outcomes.reasons.segmentNotReported',
      someoneReturned: 'outcomes.reasons.someoneReturned',
      stuck: 'outcomes.reasons.stuck',
      unknown: 'outcomes.reasons.unknown',
      wrongRoom: 'outcomes.reasons.wrongRoom',
      wrongRoomWithoutNames: 'outcomes.reasons.wrongRoomWithoutNames',
    },
    sectionTitle: 'outcomes.sectionTitle',
    statuses: {
      completed: 'outcomes.statuses.completed',
      deferred: 'outcomes.statuses.deferred',
      failed: 'outcomes.statuses.failed',
      interrupted: 'outcomes.statuses.interrupted',
      partial: 'outcomes.statuses.partial',
    },
    summary: {
      completedRooms: 'outcomes.summary.completedRooms',
      errors: 'outcomes.summary.errors',
      roomsNeedAttention: 'outcomes.summary.roomsNeedAttention',
    },
  },
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
      direction: 'details.wind.direction',
      gusts: 'details.wind.gusts',
      speed: 'details.wind.speed',
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
