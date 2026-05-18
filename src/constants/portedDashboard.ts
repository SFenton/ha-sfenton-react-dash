import type { CardColor } from '../components/core/Card'

export type EntityAction =
  | { type: 'navigate'; path: string }
  | { type: 'toggle' }
  | { type: 'service'; domain: string; service: string; target?: string; serviceData?: Record<string, unknown> }

export interface EntityTileConfig {
  title: string
  entityId: string
  icon?: string
  color?: CardColor
  action?: EntityAction
  disabledWhenUnavailable?: boolean
  manualReview?: boolean
  showSubtitle?: boolean
}

export interface EntitySectionConfig {
  title: string
  items: EntityTileConfig[]
}

export interface TodoListConfig {
  title: string
  entityId: string
}

export interface TodoPageConfig {
  title: string
  lists: TodoListConfig[]
}

export interface VacuumConfig {
  title: string
  entityId: string
  batteryEntityId: string
  cleanScript: string
  dockButtonEntityId?: string
  errorEntityId: string
  errorMessageEntityId: string
  fanEntityId?: string
  hash: string
  mapScale: number
  modeEntityId?: string
  modeTextEntityId?: string
  passesEntityId: string
  statusFlagEntityId: string
  vacuumMapId: string
  waterEntityId?: string
  zones: VacuumZoneConfig[]
}

export interface VacuumZoneConfig {
  entityId: string
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

export const TODO_PAGES: Record<string, TodoPageConfig> = {
  chores: {
    title: 'Chores',
    lists: [
      { title: 'Past Due', entityId: 'todo.stephen_s_past_due_with_unassigned' },
      { title: 'Stephen Evening', entityId: 'todo.stephen_s_evening_with_unassigned' },
      { title: 'Stephen Afternoon', entityId: 'todo.stephen_s_afternoon_with_unassigned' },
      { title: 'Stephen Morning', entityId: 'todo.stephen_s_morning_with_unassigned' },
      { title: 'Stephen All Day', entityId: 'todo.stephen_s_all_day_with_unassigned' },
      { title: 'Stephen No Due Date', entityId: 'todo.stephen_s_no_due_date_with_unassigned' },
      { title: 'Steph Evening', entityId: 'todo.steph_s_evening_with_unassigned' },
      { title: 'Steph Afternoon', entityId: 'todo.steph_s_afternoon_with_unassigned' },
      { title: 'Steph Morning', entityId: 'todo.steph_s_morning_with_unassigned' },
      { title: 'Steph All Day', entityId: 'todo.steph_s_all_day_with_unassigned' },
      { title: 'Steph No Due Date', entityId: 'todo.steph_s_no_due_date_with_unassigned' },
      { title: 'Stephen Upcoming', entityId: 'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned' },
      { title: 'Steph Upcoming', entityId: 'todo.steph_s_upcoming_today_by_time_and_future_with_unassigned' },
    ],
  },
  'to-do': {
    title: 'To-Do',
    lists: [{ title: 'Groceries', entityId: 'todo.groceries' }],
  },
  groceries: {
    title: 'Groceries',
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
    zones: [
      { title: 'Clean Music Room', entityId: 'input_boolean.clean_music_room' },
      { title: 'Clean Downstairs Hallway', entityId: 'input_boolean.clean_downstairs_hallway' },
      { title: 'Clean Downstairs Bathroom', entityId: 'input_boolean.clean_downstairs_bathroom' },
    ],
  },
  {
    title: 'Theater Room',
    entityId: 'vacuum.valetudo_politefatherlykingfisher',
    batteryEntityId: 'sensor.valetudo_politefatherlykingfisher_battery_level',
    cleanScript: 'script.theater_room_vacuum_clean_selected_segments',
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
    dockButtonEntityId: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock',
    errorEntityId: 'sensor.valetudo_exaltedsneakydeer_error',
    errorMessageEntityId: 'input_text.main_floor_vacuum_error_message',
    fanEntityId: 'select.valetudo_exaltedsneakydeer_fan',
    hash: 'main-floor-robot-vacuum',
    mapScale: 1.2,
    modeEntityId: 'select.valetudo_exaltedsneakydeer_mode',
    modeTextEntityId: 'input_text.main_floor_vacuum_mode',
    passesEntityId: 'input_select.main_floor_vacuum_cleaning_passes',
    statusFlagEntityId: 'sensor.valetudo_exaltedsneakydeer_status_flag',
    vacuumMapId: 'valetudo_exaltedsneakydeer',
    waterEntityId: 'select.valetudo_exaltedsneakydeer_water',
    zones: [
      { title: 'Living Room', entityId: 'input_boolean.roborock_living_room_toggle' },
      { title: 'Master Bedroom', entityId: 'input_boolean.roborock_master_bedroom_toggle' },
      { title: 'Kitchen', entityId: 'input_boolean.roborock_kitchen_toggle' },
      { title: 'Office', entityId: 'input_boolean.roborock_office_toggle' },
      { title: 'Hallway', entityId: 'input_boolean.roborock_hallway_toggle' },
      { title: 'Guest Room', entityId: 'input_boolean.roborock_guest_room_toggle' },
      { title: 'Master Bathroom', entityId: 'input_boolean.roborock_master_bathroom_toggle' },
      { title: 'Guest Bathroom', entityId: 'input_boolean.roborock_guest_bathroom_toggle' },
      { title: 'Gym', entityId: 'input_boolean.roborock_gym_toggle' },
      { title: 'Closet', entityId: 'input_boolean.roborock_master_bedroom_closet_toggle' },
      { title: 'Dining Room', entityId: 'input_boolean.roborock_dining_room_toggle' },
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
      { title: 'Front Door Lock', entityId: 'lock.aqara_smart_lock_u400', icon: 'mdi:lock', color: SECURITY_COLOR, manualReview: true },
      { title: 'Left Garage Door', entityId: 'cover.left_door', icon: 'mdi:garage', color: SECURITY_COLOR, manualReview: true },
      { title: 'Right Garage Door', entityId: 'cover.right_door', icon: 'mdi:garage', color: SECURITY_COLOR, manualReview: true },
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
  settings: {
    title: 'Settings',
    sections: [
      {
        title: 'Pages',
        items: [
          { title: 'Admin', entityId: 'sensor.unavailable', icon: 'mdi:home-assistant', color: CONTROL_COLOR, action: { type: 'navigate', path: 'admin' } },
          { title: 'Guests Staying Over', entityId: 'sensor.unavailable', icon: 'mdi:account-group', color: CONTROL_COLOR, action: { type: 'navigate', path: 'guests-staying-over' } },
          { title: 'Groceries', entityId: 'sensor.unavailable', icon: 'mdi:cart', color: CONTROL_COLOR, action: { type: 'navigate', path: 'groceries' } },
          { title: 'Custom Lights', entityId: 'sensor.unavailable', icon: 'mdi:lightbulb-group', color: CONTROL_COLOR, action: { type: 'navigate', path: 'custom-lights' } },
          { title: 'Mach-E', entityId: 'sensor.unavailable', icon: 'mdi:car-electric', color: CONTROL_COLOR, action: { type: 'navigate', path: 'mach-e' } },
        ],
      },
    ],
  },
  admin: {
    title: 'Admin',
    sections: [
      {
        title: 'Security Controls',
        items: [{ title: 'Front Door Auto-Lock', entityId: 'input_boolean.is_front_door_auto_lock_enabled', icon: 'mdi:lock-clock', color: SECURITY_COLOR, action: { type: 'toggle' } }],
      },
      {
        title: 'Show Specific Controls',
        items: [
          { title: 'Outdoor Faucets', entityId: 'input_boolean.show_outdoor_faucets', icon: 'mdi:water', color: CONTROL_COLOR, action: { type: 'toggle' } },
          { title: 'Christmas Lights', entityId: 'input_boolean.show_christmas_lights', icon: 'mdi:string-lights', color: CONTROL_COLOR, action: { type: 'toggle' } },
        ],
      },
      {
        title: 'Presence-Based Lighting',
        items: [
          { title: 'Presence Overrides', entityId: 'sensor.unavailable', icon: 'mdi:account-cog', color: CONTROL_COLOR, manualReview: true },
          { title: 'Auto-Reset Configuration', entityId: 'sensor.unavailable', icon: 'mdi:timer-cog', color: CONTROL_COLOR, manualReview: true },
        ],
      },
    ],
  },
  'guests-staying-over': {
    title: 'Guests Staying Over',
    sections: [
      {
        title: 'Guest Controls',
        items: [
          { title: 'Guest Room', entityId: 'input_boolean.guests_staying_in_guest_room', icon: 'mdi:bed-single', color: CONTROL_COLOR, action: { type: 'toggle' } },
          { title: 'Music Room', entityId: 'input_boolean.guests_staying_in_music_room', icon: 'mdi:guitar-electric', color: CONTROL_COLOR, action: { type: 'toggle' } },
          { title: 'Theater Room', entityId: 'input_boolean.guests_staying_in_theater_room', icon: 'mdi:projector', color: CONTROL_COLOR, action: { type: 'toggle' } },
        ],
      },
    ],
  },
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
          { title: 'Doors', entityId: 'lock.fordpass_3fmtk3su5mma09266_doorlock', icon: 'mdi:car-door-lock', color: CONTROL_COLOR, manualReview: true },
          { title: "Driver's Seat", entityId: 'select.fordpass_3fmtk3su5mma09266_rccseatfrontleft', icon: 'mdi:car-seat', color: CONTROL_COLOR, manualReview: true },
          { title: 'Passenger Seat', entityId: 'select.fordpass_3fmtk3su5mma09266_rccseatfrontright', icon: 'mdi:car-seat', color: CONTROL_COLOR, manualReview: true },
          { title: 'Climate', entityId: 'number.fordpass_3fmtk3su5mma09266_rcctemperature', icon: 'mdi:car-defrost-front', color: CONTROL_COLOR, manualReview: true },
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
        { title: 'Air Purifier Mode', entityId: 'select.living_room_air_purifier_fan_mode', icon: 'mdi:fan', color: CLIMATE_COLOR, manualReview: true },
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
        { title: 'Humidifier', entityId: 'humidifier.master_bedroom_humidifier', icon: 'mdi:air-humidifier', color: CLIMATE_COLOR, manualReview: true },
        { title: "Stephen's Bed", entityId: 'climate.stephen_s_eight_sleep_side_climate', icon: 'mdi:bed', color: CLIMATE_COLOR, manualReview: true },
        { title: "Steph's Bed", entityId: 'climate.steph_s_eight_sleep_side_climate', icon: 'mdi:bed', color: CLIMATE_COLOR, manualReview: true },
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
        { title: "Stephen's PC", entityId: 'input_boolean.stephen_s_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, manualReview: true },
        { title: "Steph's PC", entityId: 'input_boolean.steph_s_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, manualReview: true },
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
        { title: 'Keep Warm', entityId: 'switch.d8478fa2ad0a_keep_warm_enabled', icon: 'mdi:fire', color: CONTROL_COLOR, manualReview: true },
        { title: 'Super Smoke', entityId: 'switch.d8478fa2ad0a_super_smoke_enabled', icon: 'mdi:smoke', color: CONTROL_COLOR, manualReview: true },
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
        { title: 'Projector', entityId: 'media_player.sony_projector', icon: 'mdi:projector', color: MEDIA_COLOR, manualReview: true },
        { title: 'Theater PC', entityId: 'input_boolean.theater_pc_power', icon: 'mdi:desktop-tower', color: CONTROL_COLOR, manualReview: true },
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
        { title: 'Left Door', entityId: 'cover.left_door', icon: 'mdi:garage', color: SECURITY_COLOR, manualReview: true },
        { title: 'Right Door', entityId: 'cover.right_door', icon: 'mdi:garage', color: SECURITY_COLOR, manualReview: true },
      ],
    },
  ],
}

export const MEDIA_SECTIONS: EntitySectionConfig[] = [
  {
    title: 'Living Room',
    items: [
      { title: 'SHIELD', entityId: 'media_player.living_room_shield', icon: 'mdi:remote', color: MEDIA_COLOR, manualReview: true },
      { title: 'Living Room SHIELD 2', entityId: 'media_player.living_room_shield_2', icon: 'mdi:remote', color: MEDIA_COLOR, manualReview: true },
      { title: 'Sonos', entityId: 'media_player.sonos', icon: 'mdi:speaker', color: MEDIA_COLOR },
    ],
  },
  {
    title: 'Theater Room',
    items: [
      { title: 'Theater SHIELD', entityId: 'media_player.theater_room_shield', icon: 'mdi:remote', color: MEDIA_COLOR, manualReview: true },
      { title: 'Theater', entityId: 'media_player.theater', icon: 'mdi:speaker-multiple', color: MEDIA_COLOR },
      { title: 'Projector', entityId: 'media_player.sony_projector', icon: 'mdi:projector', color: MEDIA_COLOR, manualReview: true },
      { title: 'Nintendo Switch', entityId: 'input_boolean.is_nintendo_switch_active', icon: 'mdi:nintendo-switch', color: MEDIA_COLOR, action: { type: 'toggle' } },
      { title: 'Theater SHIELD Active', entityId: 'input_boolean.is_theater_shield_active', icon: 'mdi:television-play', color: MEDIA_COLOR, action: { type: 'toggle' } },
    ],
  },
]
