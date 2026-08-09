export interface ModalTabDefinition<T extends string> {
  description: string
  icon: string
  label: string
  tab: T
}

export type WeatherHourlyMode = 'condition' | 'precipitation' | 'wind'

export const WEATHER_HOURLY_MODES: readonly ModalTabDefinition<WeatherHourlyMode>[] = [
  {
    description: 'Shows the hourly condition glyph and compact forecast wording for each period.',
    icon: 'mdi:cloud',
    label: 'Conditions',
    tab: 'condition',
  },
  {
    description: 'Changes the hourly row to precipitation chance and expected accumulation where available.',
    icon: 'mdi:water',
    label: 'Precipitation',
    tab: 'precipitation',
  },
  {
    description: 'Changes the hourly row to wind speed, direction, and gust information supplied by the forecast.',
    icon: 'mdi:weather-windy',
    label: 'Wind',
    tab: 'wind',
  },
]

export type MediaRemoteModalTab = 'controls' | 'apps' | 'devices'

export const BASE_MEDIA_REMOTE_MODAL_TABS: readonly ModalTabDefinition<MediaRemoteModalTab>[] = [
  {
    description: 'Keeps power and the directional pad visible, then adds volume, navigation, keyboard, and playback controls.',
    icon: 'mdi:remote',
    label: 'Controls',
    tab: 'controls',
  },
  {
    description: 'Shows direct launch tiles for the configured streaming services and sends the selected Home Assistant script.',
    icon: 'mdi:play-box',
    label: 'Apps',
    tab: 'apps',
  },
]

export const DEVICES_MEDIA_REMOTE_MODAL_TAB: ModalTabDefinition<MediaRemoteModalTab> = {
  description: 'Shows the Theater projector, receiver, SHIELD, and state-dependent computer power controls.',
  icon: 'mdi:projector',
  label: 'Devices',
  tab: 'devices',
}

export const MEDIA_REMOTE_MODAL_TABS: readonly ModalTabDefinition<MediaRemoteModalTab>[] = [
  ...BASE_MEDIA_REMOTE_MODAL_TABS,
  DEVICES_MEDIA_REMOTE_MODAL_TAB,
]

export function mediaRemoteModalTabs(showDevices: boolean) {
  return showDevices ? MEDIA_REMOTE_MODAL_TABS : BASE_MEDIA_REMOTE_MODAL_TABS
}

export const MEDIA_PAGE_REMOTE_HASH_BY_ENTITY_ID: Readonly<Record<string, string>> = {
  'media_player.living_room_shield': '#living-room-shield',
  'media_player.living_room_shield_2': '#living-room-shield',
  'media_player.sony_projector': '#theater-room-shield',
  'media_player.theater_room_shield': '#theater-room-shield',
}

export type VacuumModalTab = 'controls' | 'zones' | 'autoClean' | 'more' | 'info'

export const VACUUM_MODAL_TABS: readonly ModalTabDefinition<VacuumModalTab>[] = [
  {
    description: 'Chooses Rooms or Area, cleaning passes, and the supported mode, fan, and water settings before a run.',
    icon: 'mdi:robot-vacuum',
    label: 'Controls',
    tab: 'controls',
  },
  {
    description: 'Selects mapped rooms in cleaning order; the tab is omitted on robots without configured room zones.',
    icon: 'mdi:floor-plan',
    label: 'Zones',
    tab: 'zones',
  },
  {
    description: 'Marks rooms that the Main Floor away-clean coordinator should skip without changing manual zone cleaning.',
    icon: 'mdi:robot-vacuum-off',
    label: 'Auto-Clean',
    tab: 'autoClean',
  },
  {
    description: 'Provides supported dock actions such as emptying the bin, washing or draining the tray, and drying mops.',
    icon: 'mdi:flash',
    label: 'Actions',
    tab: 'more',
  },
  {
    description: 'Lists available consumables and dock-component information; it is omitted when no consumables are configured.',
    icon: 'mdi:information-outline',
    label: 'Info',
    tab: 'info',
  },
]

export type HumidifierModalTab = 'controls' | 'schedules' | 'info'

export const HUMIDIFIER_MODAL_TABS: readonly ModalTabDefinition<HumidifierModalTab>[] = [
  {
    description: 'Controls power, operating mode, target humidity, mist, warmth, display state, and the one-shot timer.',
    icon: 'mdi:air-humidifier',
    label: 'Controls',
    tab: 'controls',
  },
  {
    description: 'Lists recurring activities and opens the same-sheet editor for adding or changing a scheduled profile.',
    icon: 'mdi:calendar',
    label: 'Schedules',
    tab: 'schedules',
  },
  {
    description: 'Reports current temperature, humidity, water or tank faults, and other device status supplied by Home Assistant.',
    icon: 'mdi:information-outline',
    label: 'Info',
    tab: 'info',
  },
]

export type RecipeDetailTab = 'general' | 'ingredients' | 'instructions'

export const RECIPE_DETAIL_TABS: readonly ModalTabDefinition<RecipeDetailTab>[] = [
  {
    description: 'Shows factual recipe metadata, source freshness, equipment, and the canonical source link when available.',
    icon: 'mdi:information-outline',
    label: 'General',
    tab: 'general',
  },
  {
    description: 'Shows ingredient inventory state and the guarded action that submits eligible missing ingredients to groceries.',
    icon: 'mdi:format-list-checkbox',
    label: 'Ingredients',
    tab: 'ingredients',
  },
  {
    description: 'Shows authorized local steps or an attributed external Cookidoo link without copying protected instructions.',
    icon: 'mdi:chef-hat',
    label: 'Instructions',
    tab: 'instructions',
  },
]

export type ThermostatModalTab = 'rooms' | 'automation' | 'tracking'

export const THERMOSTAT_MODAL_TABS: readonly ModalTabDefinition<ThermostatModalTab>[] = [
  {
    description: 'Lists every room thermostat and opens the selected room dial, vent status, and effective away notice.',
    icon: 'mdi:home-thermometer',
    label: 'Rooms',
    tab: 'rooms',
  },
  {
    description: 'Contains the master automatic thermostat control, Eco policy, and Predictive Comfort settings and explanation.',
    icon: 'mdi:cog',
    label: 'Automation',
    tab: 'automation',
  },
  {
    description: 'Configures selected-room participation, critical protection, and occupancy-only room tracking.',
    icon: 'mdi:motion-sensor',
    label: 'Tracking',
    tab: 'tracking',
  },
]

export type EightSleepModalTab = 'schedule' | 'modes' | 'alarms' | 'status' | 'settings'

export const EIGHT_SLEEP_MODAL_TABS: readonly ModalTabDefinition<EightSleepModalTab>[] = [
  {
    description: 'Shows the recurring Bedtime, Asleep, and Dawn schedule stages for a legacy-compatible side.',
    icon: 'mdi:thermostat',
    label: 'Sleep Schedule',
    tab: 'schedule',
  },
  {
    description: 'Provides temporary thermal behaviors such as Hot Flash Mode without rewriting the normal schedule.',
    icon: 'mdi:snowflake',
    label: 'Special Modes',
    tab: 'modes',
  },
  {
    description: 'Lists wake alarms by day and opens day or editor detail pages in the same sheet.',
    icon: 'mdi:alarm',
    label: 'Alarms',
    tab: 'alarms',
  },
  {
    description: 'Reports side availability, temperatures, schedule phase, sleep metrics, and active alarm state.',
    icon: 'mdi:information-outline',
    label: 'Status',
    tab: 'status',
  },
  {
    description: 'Contains legacy-compatible side settings that are not exposed by the climate-adapter presentation.',
    icon: 'mdi:cog',
    label: 'Settings',
    tab: 'settings',
  },
]

export const SLEEPYPOD_MODAL_TABS: readonly ModalTabDefinition<EightSleepModalTab>[] = [
  {
    description: 'Shows the current Pod target and the active Bedtime, Asleep, or Dawn stage for the selected side.',
    icon: 'mdi:thermostat',
    label: 'Temperature',
    tab: 'schedule',
  },
  {
    description: 'Provides temporary thermal behaviors such as Hot Flash Mode without changing the recurring stage schedule.',
    icon: 'mdi:snowflake',
    label: 'Special Modes',
    tab: 'modes',
  },
  {
    description: 'Lists wake alarms by day and opens day or editor detail pages in the same sheet.',
    icon: 'mdi:alarm',
    label: 'Alarms',
    tab: 'alarms',
  },
  {
    description: 'Reports side availability, temperatures, schedule phase, sleep metrics, and active alarm state.',
    icon: 'mdi:information-outline',
    label: 'Status',
    tab: 'status',
  },
]

export type ScanItemStep = 'barcode' | 'expiry' | 'review' | 'adding'

export interface ScanItemStepDefinition {
  description: string
  label: string
  step: ScanItemStep
}

export const SCAN_ITEM_STEPS: readonly ScanItemStepDefinition[] = [
  {
    description: 'Scans a barcode, resolves known product data, or accepts a manually entered product name before continuing.',
    label: 'Barcode',
    step: 'barcode',
  },
  {
    description: 'Reads a printed expiration label, accepts a native date entry, or allows the date to be skipped.',
    label: 'Expiration',
    step: 'expiry',
  },
  {
    description: 'Confirms name, quantity, storage location, expiration, and prepared-food state before any inventory command.',
    label: 'Review',
    step: 'review',
  },
  {
    description: 'Shows the Home Assistant submission in progress and the final added state before Done closes the sheet.',
    label: 'Adding',
    step: 'adding',
  },
]
