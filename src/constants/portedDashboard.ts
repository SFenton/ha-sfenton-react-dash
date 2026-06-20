import type { CardColor } from '../components/core/Card'

export type EntityBasicAction =
  | { type: 'navigate'; path: string }
  | { type: 'toggle' }
  | { type: 'service'; domain: string; service: string; target?: string | null; serviceData?: Record<string, unknown> }

export interface EntityStateAction<TAction extends EntityBasicAction = EntityBasicAction> {
  type: 'state'
  cases: { action: TAction; states: string[] }[]
  defaultAction?: TAction
  entityId?: string
}

export type EntityAction = EntityBasicAction | EntityStateAction

export interface EntityStateLabelConfig {
  attribute: string
  falseLabel: string
  includeState?: boolean
  trueLabel: string
}

export interface EntityTileConfig {
  title: string
  entityId: string
  icon?: string
  color?: CardColor
  action?: EntityAction
  disabledWhenUnavailable?: boolean
  showSubtitle?: boolean
  stateLabel?: EntityStateLabelConfig
}

export interface EntitySectionConfig {
  title: string
  items: EntityTileConfig[]
}

export interface SettingsLinkConfig {
  title: string
  subtitle: string
  icon: string
  externalPath?: string
  path?: string
}

export interface TodoListConfig {
  title: string
  entityId: string
  hideCompleted?: boolean
  hideWhenNoOpenItems?: boolean
  userIds?: string[]
}

export interface TodoPageConfig {
  title: string
  lists: TodoListConfig[]
  emptyTitle?: string
  emptyDescription?: string
}

export interface ChoreQuickLinkConfig {
  title: string
  path: string
  icon: string
  color: CardColor
  countType?: 'groceries' | 'tasks'
}

export interface VacuumConfig {
  title: string
  entityId: string
  batteryEntityId: string
  cleanScript: string
  consumables: VacuumConsumableConfig[]
  coordinatorSessionEntityId?: string
  dockButtonEntityId?: string
  errorEntityId: string
  errorMessageEntityId: string
  fanEntityId?: string
  hash: string
  mapRotationDegrees?: number
  mapScale: number
  modeEntityId?: string
  modeTextEntityId?: string
  passesEntityId: string
  statusFlagEntityId: string
  vacuumMapId: string
  waterEntityId?: string
  zoneDescription?: string[]
  zones: VacuumZoneConfig[]
}

export interface VacuumConsumableConfig {
  title: string
  entityId: string
  icon: string
  valueKind: 'duration' | 'status'
}

export interface VacuumZoneConfig {
  entityId: string
  icon: string
  title: string
}

export interface ThermostatRoomConfig {
  title: string
  climateEntityId: string
  ventEntityIds: string[]
}

export const NEUTRAL_COLOR: CardColor = { r: 84, g: 110, b: 122 }
export const SECURITY_COLOR: CardColor = { r: 30, g: 136, b: 229 }
export const CLIMATE_COLOR: CardColor = { r: 25, g: 84, b: 130 }
export const VACUUM_COLOR: CardColor = { r: 67, g: 160, b: 71 }
export const MEDIA_COLOR: CardColor = { r: 218, g: 88, b: 132 }
export const CONTROL_COLOR: CardColor = { r: 75, g: 126, b: 210 }
export const UNAVAILABLE_COLOR: CardColor = { r: 255, g: 255, b: 255 }
export const SWITCH_ACTIVE_COLOR: CardColor = { r: 67, g: 160, b: 71 }
export const CHORE_BLUE: CardColor = { r: 0, g: 154, b: 199 }

export const CHORE_USER_IDS = {
  stephen: '64089b5683944c39b4f944c8f76830b0',
  steph: '43cb71bbd1cb4860b2a7de4c829020f0',
} as const

export const CHORE_QUICK_LINKS: ChoreQuickLinkConfig[] = [
  { title: 'Groceries', path: 'groceries', icon: 'mdi:clipboard-list', color: { r: 155, g: 67, b: 72 }, countType: 'groceries' },
  { title: "Stephen's Tasks", path: 'stephens-chores', icon: 'mdi:clipboard-list', color: { r: 0, g: 96, b: 120 } },
  { title: "Steph's Tasks", path: 'stephs-chores', icon: 'mdi:clipboard-list', color: { r: 212, g: 108, b: 0 } },
  { title: 'Unassigned Tasks', path: 'unassigned-chores', icon: 'mdi:clipboard-list', color: { r: 81, g: 58, b: 126 } },
  { title: 'Home Tasks', path: 'home-improvement-chores', icon: 'mdi:clipboard-list', color: { r: 64, g: 143, b: 154 } },
]

export const ADMIN_DESCRIPTIONS = {
  autoLock: 'Disables automatic locking of the front door. Useful for when contractors are over, or we have people frequently entering/leaving the home.',
  livingRoomPowerRecovery:
    'If the living room switch loses power and comes back with the relay off, run this to temporarily couple the top paddle, unlock the relay, turn power back on, relock it, and return the paddle to decoupled mode.',
  presenceOverrides: 'Enable or disable presence-based lighting in specific rooms. Useful for when we have company, or need to quickly keep lights on or off without using the voice commands.',
  showSpecific: "Shows the outdoor faucets in our Home Assistant pages. Useful to disable during the winter, when we aren't using them.",
  autoReset:
    "Sometimes, we disable automatic presence-based lighting in rooms that we'd otherwise want to wake up and have that presence-based lighting active.\n\nIf a toggle here is enabled, it means that in the morning, before we usually wake up, if the room has been cleared for a sufficient amount of time during the night, we'll re-enable presence-based lighting in that room.",
} as const

export const ADMIN_SECURITY_CONTROLS: EntityTileConfig[] = [
  { title: 'Front Door Auto-Lock', entityId: 'input_boolean.is_front_door_auto_lock_enabled', icon: 'mdi:lock-clock', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
]

export const ADMIN_SHOW_SPECIFIC_CONTROLS: EntityTileConfig[] = [
  { title: 'Outdoor Faucets', entityId: 'input_boolean.show_outdoor_faucets', icon: 'mdi:water', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
  { title: 'Christmas Lights', entityId: 'input_boolean.show_christmas_lights', icon: 'mdi:string-lights', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
]

const ADMIN_PRESENCE_ICON = 'mdi:lightbulb-auto'
const ADMIN_AUTO_REENABLE_ICON = 'mdi:autorenew'
const PRESENCE_STATE_LABEL: EntityStateLabelConfig = { attribute: 'automation_paused', falseLabel: 'Active', includeState: true, trueLabel: 'Paused' }

function presenceOverride(title: string, entityId: string): EntityTileConfig {
  return {
    title,
    entityId,
    icon: ADMIN_PRESENCE_ICON,
    color: SWITCH_ACTIVE_COLOR,
    action: { type: 'service', domain: 'script', service: 'toggle_presence_lighting_override', target: null, serviceData: { presence_switch: entityId } },
    stateLabel: PRESENCE_STATE_LABEL,
  }
}

function autoReenable(title: string, entityId: string): EntityTileConfig {
  return { title, entityId, icon: ADMIN_AUTO_REENABLE_ICON, color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true }
}

export const ADMIN_PRESENCE_OVERRIDE_ITEMS: EntityTileConfig[] = [
  presenceOverride('Living Room', 'switch.living_room_presence_living_room_lights_presence_allowed'),
  presenceOverride('Kitchen', 'switch.kitchen_presence_kitchen_lights_presence_allowed'),
  presenceOverride('Hallway', 'switch.hallway_presence_hallway_lights_presence_allowed'),
  presenceOverride('Gym', 'switch.gym_presence_gym_light_presence_allowed'),
  presenceOverride('Guest Bathroom', 'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed'),
  presenceOverride('Guest Room', 'switch.guest_room_presence_guest_room_lights_presence_allowed'),
  presenceOverride('Office', 'switch.office_presence_office_light_presence_allowed'),
  presenceOverride('Master Bedroom', 'switch.master_bedroom_presence_master_bedroom_lights_presence_allowed'),
  presenceOverride('Master Bathroom', 'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed'),
  presenceOverride('Dining Room', 'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed'),
  presenceOverride('Theater Room', 'switch.theater_room_presence_theater_room_lights_presence_allowed'),
  presenceOverride('Downstairs Hallway', 'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed'),
  presenceOverride('Music Room', 'switch.music_room_presence_music_room_lights_presence_allowed'),
  presenceOverride('Upper Deck', 'switch.upper_deck_presence_back_deck_lights_presence_allowed'),
]

export const ADMIN_AUTO_REENABLE_ITEMS: EntityTileConfig[] = [
  autoReenable('Living Room', 'switch.living_room_auto_re_enable_presence_lighting'),
  autoReenable('Kitchen', 'switch.kitchen_auto_re_enable_presence_lighting'),
  autoReenable('Hallway', 'switch.hallway_auto_re_enable_presence_lighting'),
  autoReenable('Gym', 'switch.gym_auto_re_enable_presence_lighting'),
  autoReenable('Guest Bathroom', 'switch.guest_bathroom_auto_re_enable_presence_lighting'),
  autoReenable('Guest Room', 'switch.guest_room_auto_re_enable_presence_lighting'),
  autoReenable('Office', 'switch.office_auto_re_enable_presence_lighting'),
  autoReenable('Master Bedroom', 'switch.master_bedroom_auto_re_enable_presence_lighting'),
  autoReenable('Master Bathroom', 'switch.master_bathroom_auto_re_enable_presence_lighting'),
  autoReenable('Dining Room', 'switch.dining_room_auto_re_enable_presence_lighting'),
  autoReenable('Theater Room', 'switch.theater_room_auto_re_enable_presence_lighting'),
  autoReenable('Downstairs Hallway', 'switch.downstairs_hallway_auto_re_enable_presence_lighting'),
  autoReenable('Music Room', 'switch.music_room_auto_re_enable_presence_lighting'),
  autoReenable('Upper Deck', 'switch.upper_deck_auto_re_enable_presence_lighting'),
]

export const SETTINGS_PAGE_ITEMS: SettingsLinkConfig[] = [
  {
    title: 'Admin Controls',
    subtitle: 'Presence-Based Toggles, Automation Overrides, and More',
    icon: 'mdi:shield-account',
    path: 'admin',
  },
  {
    title: 'Guest Controls',
    subtitle: 'Toggle automations when guests stay over.',
    icon: 'mdi:account-multiple',
    path: 'guests-staying-over',
  },
  {
    title: 'Vacation',
    subtitle: 'Set away dates and prepare the house for vacation.',
    icon: 'mdi:airplane',
    path: 'vacation',
  },
  {
    title: 'To-Do',
    subtitle: 'An admin panel for to-do tasks.',
    icon: 'mdi:clipboard-list',
    path: 'to-do',
  },
  {
    title: 'Mach-E',
    subtitle: 'Controls for the Mustang Mach-E.',
    icon: 'mdi:car-estate',
    path: 'mach-e',
  },
  {
    title: 'Home Assistant Settings',
    subtitle: 'Access more in-depth Home Assistant details and settings.',
    icon: 'mdi:cog',
    externalPath: '/config',
  },
]

export const GUEST_CONTROLS_DESCRIPTION = "When guests stay over, toggle these controls on based on the rooms they're staying in to disable automations (like automatic vacuuming in the music room) and ensure that rooms are tracked for temperature monitoring and vent control."

const VALETUDO_CONSUMABLES: (Omit<VacuumConsumableConfig, 'entityId'> & { entitySuffix: string })[] = [
  { title: 'Main Brush', entitySuffix: 'main_brush', icon: 'mdi:brush', valueKind: 'duration' },
  { title: 'Side Brush', entitySuffix: 'right_brush', icon: 'mdi:brush-variant', valueKind: 'duration' },
  { title: 'Main Filter', entitySuffix: 'main_filter', icon: 'mdi:air-filter', valueKind: 'duration' },
  { title: 'Sensors', entitySuffix: 'sensor_cleaning', icon: 'mdi:radar', valueKind: 'duration' },
  { title: 'Wheels', entitySuffix: 'wheel_cleaning', icon: 'mdi:tire', valueKind: 'duration' },
  { title: 'Dustbag', entitySuffix: 'dustbag_dock_component', icon: 'mdi:delete', valueKind: 'status' },
  { title: 'Fresh Water', entitySuffix: 'freshwater_dock_component', icon: 'mdi:water', valueKind: 'status' },
  { title: 'Waste Water', entitySuffix: 'wastewater_dock_component', icon: 'mdi:water-off', valueKind: 'status' },
  { title: 'Detergent', entitySuffix: 'detergent_dock_component', icon: 'mdi:bottle-tonic', valueKind: 'status' },
]

function valetudoConsumables(vacuumMapId: string): VacuumConsumableConfig[] {
  return VALETUDO_CONSUMABLES.map(({ entitySuffix, ...consumable }) => ({
    ...consumable,
    entityId: `sensor.${vacuumMapId}_${entitySuffix}`,
  }))
}

export const GUEST_CONTROL_ITEMS: EntityTileConfig[] = [
  { title: 'Guest Room', entityId: 'input_boolean.guests_staying_in_guest_room', icon: 'mdi:bed', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
  { title: 'Music Room', entityId: 'input_boolean.guests_staying_in_music_room', icon: 'mdi:guitar-electric', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
  { title: 'Theater Room', entityId: 'input_boolean.guests_staying_in_theater_room', icon: 'mdi:projector', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
]

export const VACATION_MODE_DESCRIPTION = 'Enable or disable vacation mode for the house'
export const VACATION_DATES_DESCRIPTION = 'Set the start and end time for your vacation. Vacation mode will automatically be turned off at the set end date and time.'
export const VACATION_DATE_RANGE_ERROR = 'Start date and time must be before end date and time. Vacation mode is disabled until the dates are fixed.'

export const VACATION_MODE_ENTITY_ID = 'input_boolean.vacation_mode'
export const VACATION_INVALID_DATES_PENDING_ENTITY_ID = 'input_boolean.vacation_mode_invalid_dates_pending'
export const VACATION_START_ENTITY_ID = 'input_datetime.vacation_start'
export const VACATION_END_ENTITY_ID = 'input_datetime.vacation_end'

export const VACATION_MODE_ITEMS: EntityTileConfig[] = [
  { title: 'Vacation Mode', entityId: VACATION_MODE_ENTITY_ID, icon: 'mdi:airplane', color: SWITCH_ACTIVE_COLOR, action: { type: 'toggle' }, showSubtitle: true },
]

export const TODO_PAGES: Record<string, TodoPageConfig> = {
  chores: {
    title: 'Chores',
    lists: [
      { title: 'Past Due', entityId: 'todo.stephen_s_past_due_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Evening Tasks', entityId: 'todo.stephen_s_evening_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Afternoon Tasks', entityId: 'todo.stephen_s_afternoon_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Morning Tasks', entityId: 'todo.stephen_s_morning_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Due Any Time Today', entityId: 'todo.stephen_s_all_day_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'No Due Date', entityId: 'todo.stephen_s_no_due_date_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Evening Tasks', entityId: 'todo.steph_s_evening_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
      { title: 'Afternoon Tasks', entityId: 'todo.steph_s_afternoon_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
      { title: 'Morning Tasks', entityId: 'todo.steph_s_morning_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
      { title: 'Due Any Time Today', entityId: 'todo.steph_s_all_day_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
      { title: 'No Due Date', entityId: 'todo.steph_s_no_due_date_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
      { title: 'Upcoming', entityId: 'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.stephen] },
      { title: 'Upcoming', entityId: 'todo.steph_s_upcoming_today_by_time_and_future_with_unassigned', hideCompleted: true, hideWhenNoOpenItems: true, userIds: [CHORE_USER_IDS.steph] },
    ],
  },
  'to-do': {
    title: 'To-Do',
    lists: [{ title: 'Groceries', entityId: 'todo.groceries' }],
  },
  groceries: {
    title: 'Groceries',
    emptyTitle: 'No groceries listed',
    emptyDescription: 'Add some groceries via the YAML app for now to see them appear here.',
    lists: [{ title: 'Grocery List', entityId: 'todo.shopping_list' }],
  },
  'stephens-chores': {
    title: "Stephen's Chores",
    lists: [
      { title: 'Past Due', entityId: 'todo.stephen_s_past_due' },
      { title: 'Due Today', entityId: 'todo.stephen_s_due_today' },
      { title: 'Upcoming', entityId: 'todo.stephen_s_upcoming' },
      { title: 'No Due Date', entityId: 'todo.stephen_s_no_due_date' },
    ],
  },
  'stephs-chores': {
    title: "Steph's Chores",
    lists: [
      { title: 'Past Due', entityId: 'todo.steph_s_past_due' },
      { title: 'Due Today', entityId: 'todo.steph_s_due_today' },
      { title: 'Upcoming', entityId: 'todo.steph_s_upcoming' },
      { title: 'No Due Date', entityId: 'todo.steph_s_no_due_date' },
    ],
  },
  'unassigned-chores': {
    title: 'Unassigned Chores',
    lists: [
      { title: 'Past Due', entityId: 'todo.unassigned_past_due' },
      { title: 'Due Today', entityId: 'todo.unassigned_due_today' },
      { title: 'Upcoming', entityId: 'todo.unassigned_upcoming' },
      { title: 'No Due Date', entityId: 'todo.unassigned_no_due_date' },
    ],
  },
  'home-improvement-chores': {
    title: 'Home Improvement Tasks',
    lists: [
      { title: 'Past Due', entityId: 'todo.home_improvement_s_past_due' },
      { title: 'Due Today', entityId: 'todo.home_improvement_s_due_today' },
      { title: 'Upcoming', entityId: 'todo.home_improvement_s_upcoming' },
      { title: 'No Due Date', entityId: 'todo.home_improvement_s_no_due_date' },
    ],
  },
}

export const VACUUMS: VacuumConfig[] = [
  {
    title: 'Music Room',
    entityId: 'vacuum.valetudo_elatedusedram',
    batteryEntityId: 'sensor.valetudo_elatedusedram_battery_level',
    cleanScript: 'script.music_room_vacuum_clean_selected_segments',
    consumables: valetudoConsumables('valetudo_elatedusedram'),
    dockButtonEntityId: 'button.valetudo_elatedusedram_trigger_auto_empty_dock',
    errorEntityId: 'sensor.valetudo_elatedusedram_error',
    errorMessageEntityId: 'input_text.music_room_vacuum_error_message',
    fanEntityId: 'select.valetudo_elatedusedram_fan',
    hash: 'music-room-robot-vacuum',
    mapScale: 2.4,
    modeEntityId: 'select.valetudo_elatedusedram_mode',
    modeTextEntityId: 'input_text.music_room_vacuum_mode',
    passesEntityId: 'input_select.music_room_vacuum_cleaning_passes',
    statusFlagEntityId: 'sensor.valetudo_elatedusedram_status_flag',
    vacuumMapId: 'valetudo_elatedusedram',
    waterEntityId: 'select.valetudo_elatedusedram_water',
    zoneDescription: [
      'Select any zones to focus cleaning in those areas. If you press clean and no zones are selected, we will clean all zones in the Music Room.',
      'Zones are not selectable or changeable while cleaning is ongoing.',
    ],
    zones: [
      { title: 'Clean Music Room', entityId: 'input_boolean.clean_music_room', icon: 'mdi:guitar-electric' },
      { title: 'Clean Downstairs Hallway', entityId: 'input_boolean.clean_downstairs_hallway', icon: 'mdi:wardrobe' },
      { title: 'Clean Downstairs Bathroom', entityId: 'input_boolean.clean_downstairs_bathroom', icon: 'mdi:shower-head' },
    ],
  },
  {
    title: 'Theater Room',
    entityId: 'vacuum.valetudo_politefatherlykingfisher',
    batteryEntityId: 'sensor.valetudo_politefatherlykingfisher_battery_level',
    cleanScript: 'script.theater_room_vacuum_clean_selected_segments',
    consumables: valetudoConsumables('valetudo_politefatherlykingfisher'),
    dockButtonEntityId: 'button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock',
    errorEntityId: 'sensor.valetudo_politefatherlykingfisher_error',
    errorMessageEntityId: 'input_text.theater_room_vacuum_error_message',
    fanEntityId: 'select.valetudo_politefatherlykingfisher_fan',
    hash: 'theater-room-robot-vacuum',
    mapScale: 2.4,
    modeEntityId: 'select.valetudo_politefatherlykingfisher_mode',
    passesEntityId: 'input_select.theater_room_vacuum_cleaning_passes',
    statusFlagEntityId: 'sensor.valetudo_politefatherlykingfisher_status_flag',
    vacuumMapId: 'valetudo_politefatherlykingfisher',
    waterEntityId: 'select.valetudo_politefatherlykingfisher_water',
    zones: [],
  },
  {
    title: 'Main Floor',
    entityId: 'vacuum.valetudo_exaltedsneakydeer',
    batteryEntityId: 'sensor.valetudo_exaltedsneakydeer_battery_level',
    cleanScript: 'script.main_floor_vacuum_clean_selected_segments',
    consumables: valetudoConsumables('valetudo_exaltedsneakydeer'),
    coordinatorSessionEntityId: 'sensor.main_floor_vacuum_coordinator_session_state',
    dockButtonEntityId: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock',
    errorEntityId: 'sensor.valetudo_exaltedsneakydeer_error',
    errorMessageEntityId: 'input_text.main_floor_vacuum_error_message',
    fanEntityId: 'select.valetudo_exaltedsneakydeer_fan',
    hash: 'main-floor-robot-vacuum',
    mapRotationDegrees: 180,
    mapScale: 1.2,
    modeEntityId: 'select.valetudo_exaltedsneakydeer_mode',
    modeTextEntityId: 'input_text.main_floor_vacuum_mode',
    passesEntityId: 'input_select.main_floor_vacuum_cleaning_passes',
    statusFlagEntityId: 'sensor.valetudo_exaltedsneakydeer_status_flag',
    vacuumMapId: 'valetudo_exaltedsneakydeer',
    waterEntityId: 'select.valetudo_exaltedsneakydeer_water',
    zoneDescription: [
      'Select any zones to focus cleaning in those areas. If you press clean and no zones are selected, we will clean all zones on the Main Floor.',
      'Zones are not selectable or changeable while cleaning is ongoing.',
    ],
    zones: [
      { title: 'Living Room', entityId: 'input_boolean.roborock_living_room_toggle', icon: 'mdi:sofa' },
      { title: 'Master Bedroom', entityId: 'input_boolean.roborock_master_bedroom_toggle', icon: 'mdi:bed-double' },
      { title: 'Kitchen', entityId: 'input_boolean.roborock_kitchen_toggle', icon: 'mdi:fridge' },
      { title: 'Office', entityId: 'input_boolean.roborock_office_toggle', icon: 'mdi:laptop' },
      { title: 'Hallway', entityId: 'input_boolean.roborock_hallway_toggle', icon: 'mdi:wardrobe' },
      { title: 'Guest Room', entityId: 'input_boolean.roborock_guest_room_toggle', icon: 'mdi:bed' },
      { title: 'Master Bathroom', entityId: 'input_boolean.roborock_master_bathroom_toggle', icon: 'mdi:shower' },
      { title: 'Guest Bathroom', entityId: 'input_boolean.roborock_guest_bathroom_toggle', icon: 'mdi:shower' },
      { title: 'Gym', entityId: 'input_boolean.roborock_gym_toggle', icon: 'mdi:weight-lifter' },
      { title: 'Closet', entityId: 'input_boolean.roborock_master_bedroom_closet_toggle', icon: 'mdi:wardrobe' },
      { title: 'Dining Room', entityId: 'input_boolean.roborock_dining_room_toggle', icon: 'mdi:silverware-fork-knife' },
    ],
  },
]

export const THERMOSTAT_ROOMS: ThermostatRoomConfig[] = [
  { title: 'Living Room', climateEntityId: 'climate.thermostat_contact_sensors_living_room_virtual_thermostat', ventEntityIds: ['cover.living_room_vent_1_vent', 'cover.living_room_vent_2_vent'] },
  { title: 'Office', climateEntityId: 'climate.thermostat_contact_sensors_office_virtual_thermostat', ventEntityIds: ['cover.office_vent_vent'] },
  { title: 'Master Bedroom', climateEntityId: 'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat', ventEntityIds: ['cover.master_bedroom_vent_2_vent', 'cover.master_bedroom_vent_3_vent'] },
  { title: 'Master Bathroom', climateEntityId: 'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat', ventEntityIds: ['cover.master_bathroom_vent_vent'] },
  { title: 'Kitchen', climateEntityId: 'climate.thermostat_contact_sensors_kitchen_virtual_thermostat', ventEntityIds: ['cover.kitchen_vent_vent'] },
  { title: 'Guest Room', climateEntityId: 'climate.thermostat_contact_sensors_guest_room_virtual_thermostat', ventEntityIds: ['cover.guest_room_vent_vent'] },
  { title: 'Dining Room', climateEntityId: 'climate.thermostat_contact_sensors_dining_room_virtual_thermostat', ventEntityIds: ['cover.dining_room_vent_vent'] },
  { title: 'Gym', climateEntityId: 'climate.thermostat_contact_sensors_gym_virtual_thermostat', ventEntityIds: ['cover.gym_vent_vent'] },
  { title: 'Guest Bathroom', climateEntityId: 'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat', ventEntityIds: ['cover.guest_bathroom_vent_vent'] },
  { title: 'Music Room', climateEntityId: 'climate.thermostat_contact_sensors_music_room_virtual_thermostat', ventEntityIds: ['cover.music_room_vent_vent'] },
  { title: 'Theater Room', climateEntityId: 'climate.thermostat_contact_sensors_theater_room_virtual_thermostat', ventEntityIds: ['cover.theater_room_vent_1_vent', 'cover.theater_room_vent_2_vent'] },
]

export const SECURITY_SECTIONS: EntitySectionConfig[] = [
  {
    title: 'Security',
    items: [
      { title: 'Alarm', entityId: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2', icon: 'mdi:shield', color: SECURITY_COLOR },
      { title: 'Front Door Lock', entityId: 'lock.aqara_smart_lock_u400', icon: 'mdi:lock', color: SECURITY_COLOR },
      { title: 'Left Garage Door', entityId: 'cover.left_door', icon: 'mdi:garage', color: SECURITY_COLOR, action: { type: 'toggle' }, showSubtitle: true },
      { title: 'Right Garage Door', entityId: 'cover.right_door', icon: 'mdi:garage', color: SECURITY_COLOR, action: { type: 'toggle' }, showSubtitle: true },
    ],
  },
  {
    title: 'Cameras',
    items: [
      { title: 'Front Door Recording', entityId: 'input_boolean.is_front_door_recording', icon: 'mdi:record-circle', color: SECURITY_COLOR },
      { title: 'Driveway Recording', entityId: 'input_boolean.is_driveway_recording', icon: 'mdi:record-circle', color: SECURITY_COLOR },
      { title: 'Upper Deck Recording', entityId: 'input_boolean.is_upper_deck_recording', icon: 'mdi:record-circle', color: SECURITY_COLOR },
      { title: 'Lower Deck Recording', entityId: 'input_boolean.is_lower_deck_recording', icon: 'mdi:record-circle', color: SECURITY_COLOR },
    ],
  },
]

export const CONTROL_PAGES: Record<string, { title: string; sections: EntitySectionConfig[] }> = {
  'custom-lights': {
    title: 'Custom Lights',
    sections: [
      {
        title: 'Front Yard',
        items: [
          { title: 'Manual Front Yard', entityId: 'input_boolean.manually_control_front_yard_lights', icon: 'mdi:lightbulb-group', color: CONTROL_COLOR, action: { type: 'toggle' } },
          { title: 'Exterior Left', entityId: 'light.front_door_exterior_left_light', icon: 'mdi:lightbulb', color: CONTROL_COLOR },
          { title: 'Exterior Right', entityId: 'light.front_door_exterior_light_v2', icon: 'mdi:lightbulb', color: CONTROL_COLOR },
        ],
      },
    ],
  },
  'mach-e': {
    title: 'Mach-E',
    sections: [
      {
        title: 'Charge Status',
        items: [
          { title: 'Charge Status', entityId: 'sensor.fordpass_3fmtk3su5mma09266_elvehcharging', icon: 'mdi:ev-station', color: CONTROL_COLOR },
          { title: 'Doors', entityId: 'lock.fordpass_3fmtk3su5mma09266_doorlock', icon: 'mdi:car-door-lock', color: CONTROL_COLOR, showSubtitle: true },
          { title: "Driver's Seat", entityId: 'select.fordpass_3fmtk3su5mma09266_rccseatfrontleft', icon: 'mdi:car-seat', color: CONTROL_COLOR, showSubtitle: true },
          { title: 'Passenger Seat', entityId: 'select.fordpass_3fmtk3su5mma09266_rccseatfrontright', icon: 'mdi:car-seat', color: CONTROL_COLOR, showSubtitle: true },
          { title: 'Climate', entityId: 'number.fordpass_3fmtk3su5mma09266_rcctemperature', icon: 'mdi:car-defrost-front', color: CONTROL_COLOR, showSubtitle: true },
        ],
      },
    ],
  },
}

export const ROOM_EXTRA_SECTIONS: Record<string, EntitySectionConfig[]> = {
  'living-room': [
    {
      title: 'Devices',
      items: [
        { title: 'Air Purifier', entityId: 'fan.living_room_air_purifier_levoit_purifier', icon: 'mdi:air-purifier', color: CLIMATE_COLOR },
        { title: 'Air Purifier Mode', entityId: 'select.living_room_air_purifier_fan_mode', icon: 'mdi:fan', color: CLIMATE_COLOR, showSubtitle: true },
        { title: 'Vacuum', entityId: 'vacuum.valetudo_exaltedsneakydeer', icon: 'mdi:robot-vacuum', color: VACUUM_COLOR, action: { type: 'navigate', path: 'vacuums' }, disabledWhenUnavailable: true },
      ],
    },
    {
      title: 'Media',
      items: [
        { title: 'SHIELD', entityId: 'media_player.living_room_shield', icon: 'mdi:remote', color: MEDIA_COLOR, action: { type: 'navigate', path: 'media' } },
        { title: 'Sonos', entityId: 'media_player.sonos', icon: 'mdi:speaker', color: MEDIA_COLOR },
      ],
    },
  ],
  'master-bedroom': [
    {
      title: 'Bedroom Climate',
      items: [
        { title: 'Humidifier', entityId: 'humidifier.master_bedroom_humidifier', icon: 'mdi:air-humidifier', color: CLIMATE_COLOR, showSubtitle: true },
        { title: "Stephen's Bed", entityId: 'number.nightcanvasrestful_left_target_temperature', icon: 'mdi:bed', color: CLIMATE_COLOR, showSubtitle: true },
        { title: "Steph's Bed", entityId: 'number.nightcanvasrestful_right_target_temperature', icon: 'mdi:bed', color: CLIMATE_COLOR, showSubtitle: true },
      ],
    },
    {
      title: 'Media',
      items: [{ title: 'Apple TV', entityId: 'media_player.master_bedroom_apple_tv', icon: 'mdi:apple', color: MEDIA_COLOR, action: { type: 'navigate', path: 'media' } }],
    },
  ],
  office: [
    {
      title: 'Office PCs',
      items: [
        { title: "Stephen's PC", entityId: 'input_boolean.stephen_s_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, showSubtitle: true },
        { title: "Steph's PC", entityId: 'input_boolean.steph_s_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, showSubtitle: true },
      ],
    },
  ],
  kitchen: [
    {
      title: 'Appliances',
      items: [
        { title: 'Dishwasher Program', entityId: 'select.dishwasher_selected_program', icon: 'mdi:dishwasher', color: CONTROL_COLOR },
        { title: 'Dishwasher Progress', entityId: 'sensor.dishwasher_program_progress', icon: 'mdi:progress-clock', color: CONTROL_COLOR },
      ],
    },
  ],
  'back-deck': [
    {
      title: 'Grill',
      items: [
        { title: 'Grill State', entityId: 'sensor.d8478fa2ad0a_grill_state', icon: 'mdi:grill', color: CONTROL_COLOR },
        { title: 'Pellet Level', entityId: 'sensor.d8478fa2ad0a_pellet_level', icon: 'mdi:percent', color: CONTROL_COLOR },
        { title: 'Keep Warm', entityId: 'switch.d8478fa2ad0a_keep_warm_enabled', icon: 'mdi:fire', color: CONTROL_COLOR, action: { type: 'toggle' }, showSubtitle: true },
        { title: 'Super Smoke', entityId: 'switch.d8478fa2ad0a_super_smoke_enabled', icon: 'mdi:smoke', color: CONTROL_COLOR, action: { type: 'toggle' }, showSubtitle: true },
      ],
    },
  ],
  'music-room': [
    {
      title: 'Devices',
      items: [
        { title: 'Air Purifier', entityId: 'fan.air_purifier_levoit_purifier', icon: 'mdi:air-purifier', color: CLIMATE_COLOR },
        { title: 'Vacuum', entityId: 'vacuum.valetudo_elatedusedram', icon: 'mdi:robot-vacuum', color: VACUUM_COLOR, action: { type: 'navigate', path: 'vacuums' }, disabledWhenUnavailable: true },
      ],
    },
  ],
  'theater-room': [
    {
      title: 'Media Controls',
      items: [
        { title: 'Theater SHIELD', entityId: 'media_player.theater_room_shield', icon: 'mdi:remote', color: MEDIA_COLOR, action: { type: 'navigate', path: 'media' } },
        { title: 'Projector', entityId: 'media_player.sony_projector', icon: 'mdi:projector', color: MEDIA_COLOR, showSubtitle: true },
        { title: 'Theater PC', entityId: 'input_boolean.theater_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, showSubtitle: true },
        { title: 'Vacuum', entityId: 'vacuum.valetudo_politefatherlykingfisher', icon: 'mdi:robot-vacuum', color: VACUUM_COLOR, action: { type: 'navigate', path: 'vacuums' }, disabledWhenUnavailable: true },
      ],
    },
  ],
  garage: [
    {
      title: 'Garage',
      items: [
        { title: 'Washing Machine', entityId: 'input_boolean.washer_started_helper', icon: 'mdi:washing-machine', color: CONTROL_COLOR },
        { title: 'Dryer', entityId: 'input_boolean.dryer_started_helper', icon: 'mdi:tumble-dryer', color: CONTROL_COLOR },
        { title: 'Left Door', entityId: 'cover.left_door', icon: 'mdi:garage', color: SECURITY_COLOR, action: { type: 'toggle' }, showSubtitle: true },
        { title: 'Right Door', entityId: 'cover.right_door', icon: 'mdi:garage', color: SECURITY_COLOR, action: { type: 'toggle' }, showSubtitle: true },
      ],
    },
  ],
}

export const MEDIA_SECTIONS: EntitySectionConfig[] = [
  {
    title: 'Living Room',
    items: [
      { title: 'Living Room SHIELD', entityId: 'media_player.living_room_shield', icon: 'mdi:remote', color: MEDIA_COLOR },
    ],
  },
  {
    title: 'Theater Room',
    items: [
      { title: 'Theater Room', entityId: 'media_player.sony_projector', icon: 'mdi:projector', color: MEDIA_COLOR },
      { title: 'Nintendo Switch', entityId: 'input_boolean.is_nintendo_switch_active', icon: 'mdi:nintendo-switch', color: MEDIA_COLOR, action: { type: 'service', domain: 'script', service: 'theater_room_nintendo_switch', target: null } },
      { title: 'Theater SHIELD', entityId: 'input_boolean.is_theater_shield_active', icon: 'mdi:television', color: MEDIA_COLOR, action: { type: 'service', domain: 'script', service: 'theater_room_tv_movie', target: null } },
    ],
  },
]
