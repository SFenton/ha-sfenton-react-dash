export type IconKey =
  | 'air'
  | 'bath'
  | 'bed'
  | 'camera'
  | 'car'
  | 'checklist'
  | 'contact'
  | 'deck'
  | 'door'
  | 'door-open'
  | 'dumbbell'
  | 'garage'
  | 'grill'
  | 'home'
  | 'kitchen'
  | 'light'
  | 'media'
  | 'music'
  | 'office'
  | 'presence'
  | 'security'
  | 'settings'
  | 'sofa'
  | 'sparkles'
  | 'stairs'
  | 'theater'
  | 'thermostat'
  | 'utensils'
  | 'vacuum'
  | 'weather'

export interface StatusChipConfig {
  title: string
  icon: IconKey
  entityId: string
  hash: string
  tone: 'light' | 'security' | 'climate' | 'presence' | 'contact' | 'air'
  secondaryEntityId?: string
  width?: number
}

export interface QuickAccessConfig {
  title: string
  icon: IconKey
  hash?: string
  route?: string
  entityId?: string
  status?: 'climate_power' | 'entity_state'
  tone: 'security' | 'climate' | 'neutral' | 'light' | 'vacuum' | 'media'
}

export interface AreaConfig {
  title: string
  route: string
  icon: IconKey
  color: {
    r: number
    g: number
    b: number
  }
}

export interface EntityButtonConfig {
  title: string
  entityId: string
  tone?: 'light' | 'climate' | 'security' | 'presence' | 'contact' | 'neutral'
}

export interface EntityGroupConfig {
  title: string
  toggleEntityId?: string
  items: EntityButtonConfig[]
}

export interface CameraConfig {
  title: string
  hash: string
  entityId: `camera.${string}`
  streamId: string
  popupCardId: string
  recordingEntityId?: string
  recordingScriptEntityId?: string
}

export const OVERVIEW_STATUS_CHIPS: StatusChipConfig[] = [
  {
    title: 'Lights',
    icon: 'light',
    entityId: 'light.lights',
    hash: '#lights-overview',
    tone: 'light',
    width: 126,
  },
  {
    title: 'Security',
    icon: 'security',
    entityId: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2',
    hash: '#security-system',
    tone: 'security',
    width: 158,
  },
  {
    title: 'Climate',
    icon: 'thermostat',
    entityId: 'input_text.all_climate_range',
    hash: '#climate-overview',
    tone: 'climate',
    width: 178,
  },
  {
    title: 'Occupancy',
    icon: 'presence',
    entityId: 'binary_sensor.occupancy_sensors',
    hash: '#occupancy-overview',
    tone: 'presence',
    width: 162,
  },
  {
    title: 'Contact Sensors',
    icon: 'contact',
    entityId: 'binary_sensor.contact_sensors',
    hash: '#contact-sensors-overview',
    tone: 'contact',
    width: 190,
  },
  {
    title: 'Air Quality',
    icon: 'air',
    entityId: 'input_text.all_aqi_range',
    secondaryEntityId: 'input_text.all_pm25_range',
    hash: '#aqi-overview',
    tone: 'air',
    width: 184,
  },
]

export const QUICK_ACCESS_ITEMS: QuickAccessConfig[] = [
  {
    title: 'Security System',
    icon: 'security',
    entityId: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2',
    hash: '#security-system',
    status: 'entity_state',
    tone: 'security',
  },
  {
    title: 'Ecobee',
    icon: 'thermostat',
    entityId: 'climate.home',
    route: '/at-a-glance/ecobee',
    status: 'climate_power',
    tone: 'climate',
  },
  {
    title: 'Vacuums',
    icon: 'vacuum',
    route: '/at-a-glance/vacuums',
    tone: 'vacuum',
  },
  {
    title: 'Media',
    icon: 'media',
    route: '/at-a-glance/media',
    tone: 'media',
  },
  {
    title: 'Custom Lights',
    icon: 'sparkles',
    route: '/at-a-glance/custom-lights',
    tone: 'light',
  },
]

export const CAMERA_ITEMS: CameraConfig[] = [
  {
    title: 'Front Door',
    hash: '#camera-front-door',
    entityId: 'camera.doorbell_camera',
    streamId: 'front_door',
    popupCardId: 'front-door-popup-home',
    recordingEntityId: 'input_boolean.is_front_door_recording',
    recordingScriptEntityId: 'script.front_door_manual_recording',
  },
  {
    title: 'Driveway',
    hash: '#camera-driveway',
    entityId: 'camera.garage_camera',
    streamId: 'garage_camera',
    popupCardId: 'driveway-popup-home',
    recordingEntityId: 'input_boolean.is_driveway_recording',
    recordingScriptEntityId: 'script.driveway_manual_recording',
  },
  {
    title: 'Upper Deck',
    hash: '#camera-upper-deck',
    entityId: 'camera.upper_deck_camera_2',
    streamId: 'upper_deck',
    popupCardId: 'upper-deck-popup-home',
    recordingEntityId: 'input_boolean.is_upper_deck_recording',
    recordingScriptEntityId: 'script.upper_deck_manual_recording',
  },
  {
    title: 'Lower Deck',
    hash: '#camera-lower-deck',
    entityId: 'camera.lower_deck_camera',
    streamId: 'lower_deck',
    popupCardId: 'lower-deck-popup-home',
    recordingEntityId: 'input_boolean.is_lower_deck_recording',
    recordingScriptEntityId: 'script.lower_deck_manual_recording',
  },
]

export const AREA_ITEMS: AreaConfig[] = [
  { title: 'Living Room', route: '/at-a-glance/living-room', icon: 'sofa', color: { r: 218, g: 206, b: 164 } },
  { title: 'Guest Room', route: '/at-a-glance/guest-room', icon: 'bed', color: { r: 51, g: 193, b: 146 } },
  { title: 'Gym', route: '/at-a-glance/gym', icon: 'dumbbell', color: { r: 213, g: 117, b: 26 } },
  { title: 'Master Bedroom', route: '/at-a-glance/master-bedroom', icon: 'bed', color: { r: 20, g: 33, b: 215 } },
  { title: 'Office', route: '/at-a-glance/office', icon: 'office', color: { r: 20, g: 219, b: 206 } },
  { title: 'Hallway', route: '/at-a-glance/hallway', icon: 'door-open', color: { r: 65, g: 49, b: 31 } },
  { title: 'Kitchen', route: '/at-a-glance/kitchen', icon: 'kitchen', color: { r: 177, g: 200, b: 60 } },
  { title: 'Music Room', route: '/at-a-glance/music-room', icon: 'music', color: { r: 183, g: 18, b: 186 } },
  { title: 'Garage', route: '/at-a-glance/garage', icon: 'garage', color: { r: 223, g: 12, b: 12 } },
  { title: 'Theater Room', route: '/at-a-glance/theater-room', icon: 'theater', color: { r: 0, g: 0, b: 1 } },
  { title: 'Back Deck', route: '/at-a-glance/back-deck', icon: 'grill', color: { r: 5, g: 77, b: 6 } },
  { title: 'Downstairs Hallway', route: '/at-a-glance/downstairs-hallway', icon: 'stairs', color: { r: 234, g: 236, b: 203 } },
  { title: 'Guest Bathroom', route: '/at-a-glance/guest-bathroom', icon: 'bath', color: { r: 43, g: 227, b: 224 } },
  { title: 'Master Bathroom', route: '/at-a-glance/master-bathroom', icon: 'bath', color: { r: 95, g: 93, b: 93 } },
  { title: 'Dining Room', route: '/at-a-glance/dining-room', icon: 'utensils', color: { r: 217, g: 179, b: 115 } },
  { title: 'Entryway', route: '/at-a-glance/entryway', icon: 'door', color: { r: 250, g: 217, b: 0 } },
]

export const LIGHT_GROUPS: EntityGroupConfig[] = [
  {
    title: 'Living Room Lights',
    toggleEntityId: 'light.living_room',
    items: [
      { title: 'Front Left', entityId: 'light.living_room_front_left_light', tone: 'light' },
      { title: 'Front Right', entityId: 'light.living_room_front_right_light', tone: 'light' },
      { title: 'Back Left', entityId: 'light.living_room_back_left_light', tone: 'light' },
      { title: 'Back Right', entityId: 'light.living_room_back_right_light', tone: 'light' },
    ],
  },
  {
    title: 'Guest Room Lights',
    toggleEntityId: 'light.guest_room',
    items: [
      { title: 'TV Light', entityId: 'light.guest_room_tv_light', tone: 'light' },
      { title: 'Bed Light', entityId: 'light.guest_room_bed_light', tone: 'light' },
    ],
  },
  {
    title: 'Master Bedroom Lights',
    toggleEntityId: 'light.master_bedroom',
    items: [
      { title: 'Window Light', entityId: 'light.master_bedroom_window_light', tone: 'light' },
      { title: 'Bathroom Light', entityId: 'light.master_bedroom_bathroom_light', tone: 'light' },
      { title: 'Door Light', entityId: 'light.master_bedroom_door_light', tone: 'light' },
      { title: 'Stephen Nightstand', entityId: 'light.stephen_nightstand_light', tone: 'light' },
      { title: 'Steph Nightstand', entityId: 'light.steph_nightstand_light', tone: 'light' },
      { title: 'Closet Light', entityId: 'light.master_bedroom_closet_light', tone: 'light' },
    ],
  },
  {
    title: 'Gym Light',
    toggleEntityId: 'light.gym_light',
    items: [{ title: 'Gym Light', entityId: 'light.gym_light', tone: 'light' }],
  },
  {
    title: 'Hallway Lights',
    toggleEntityId: 'light.hallway',
    items: [
      { title: 'Entry Light', entityId: 'light.hallway_entry_light', tone: 'light' },
      { title: 'Gym Light', entityId: 'light.hallway_gym_light', tone: 'light' },
      { title: 'Guest Room Light', entityId: 'light.hallway_guest_room_light', tone: 'light' },
      { title: 'Office Light', entityId: 'light.hallway_office_light', tone: 'light' },
    ],
  },
  {
    title: 'Office Light',
    toggleEntityId: 'light.office_light',
    items: [{ title: 'Office Light', entityId: 'light.office_light', tone: 'light' }],
  },
  {
    title: 'Kitchen Lights',
    toggleEntityId: 'light.kitchen',
    items: [
      { title: 'Table Light', entityId: 'light.kitchen_table_light', tone: 'light' },
      { title: 'Door Light', entityId: 'light.kitchen_door_light', tone: 'light' },
      { title: 'Counter Light', entityId: 'light.kitchen_counter_light', tone: 'light' },
      { title: 'Sink Light', entityId: 'light.kitchen_sink_light', tone: 'light' },
    ],
  },
  {
    title: 'Dining Room Light',
    toggleEntityId: 'light.dining_room_dimmer_switch',
    items: [{ title: 'Dining Room Light', entityId: 'light.dining_room_dimmer_switch', tone: 'light' }],
  },
  {
    title: 'Back Deck Lights',
    toggleEntityId: 'light.back_deck',
    items: [
      { title: 'Grill Light', entityId: 'light.grill_light', tone: 'light' },
      { title: 'Couches Light', entityId: 'light.couch_light', tone: 'light' },
    ],
  },
  {
    title: 'Music Room Lights',
    toggleEntityId: 'light.music_room',
    items: [
      { title: 'Fireplace Light', entityId: 'light.hue_color_downlight_2', tone: 'light' },
      { title: 'Window Light', entityId: 'light.hue_color_downlight_4', tone: 'light' },
      { title: 'Entry Light', entityId: 'light.hue_color_downlight_1', tone: 'light' },
      { title: 'Drums Light', entityId: 'light.hue_color_downlight_3', tone: 'light' },
      { title: 'Bathroom Light', entityId: 'light.hue_color_downlight_5', tone: 'light' },
      { title: 'Couch Light', entityId: 'light.hue_color_downlight_6', tone: 'light' },
      { title: 'Server Light', entityId: 'light.hue_color_downlight_8', tone: 'light' },
      { title: 'TV Light', entityId: 'light.hue_color_downlight_7', tone: 'light' },
      { title: 'TV Left Light', entityId: 'light.hue_play_2', tone: 'light' },
      { title: 'TV Right Light', entityId: 'light.hue_play_1', tone: 'light' },
    ],
  },
  {
    title: 'Theater Room Lights',
    toggleEntityId: 'light.theater_room',
    items: [
      { title: 'Front Screen', entityId: 'light.theater_room_front_screen_light', tone: 'light' },
      { title: 'Front Right', entityId: 'light.theater_room_front_right_light', tone: 'light' },
      { title: 'Front Back', entityId: 'light.theater_room_front_rear_light', tone: 'light' },
      { title: 'Rear Front', entityId: 'light.theater_room_rear_front_light', tone: 'light' },
      { title: 'Rear Back', entityId: 'light.theater_room_rear_back_light', tone: 'light' },
      { title: 'Rear Right', entityId: 'light.theater_room_rear_right_light', tone: 'light' },
    ],
  },
  {
    title: 'Downstairs Hallway Light',
    toggleEntityId: 'light.downstairs_hallway_light',
    items: [{ title: 'Downstairs Hallway Light', entityId: 'light.downstairs_hallway_light', tone: 'light' }],
  },
  {
    title: 'Guest Bathroom Light',
    toggleEntityId: 'light.guest_bathroom_dimmer_switch',
    items: [{ title: 'Guest Bathroom Light', entityId: 'light.guest_bathroom_dimmer_switch', tone: 'light' }],
  },
  {
    title: 'Master Bathroom Light',
    toggleEntityId: 'light.master_bathroom_dimmer_switch',
    items: [{ title: 'Master Bathroom Light', entityId: 'light.master_bathroom_dimmer_switch', tone: 'light' }],
  },
  {
    title: 'Entryway Light',
    toggleEntityId: 'switch.upper_entryway_light_switch_top',
    items: [{ title: 'Entryway Light', entityId: 'switch.upper_entryway_light_switch_top', tone: 'light' }],
  },
  {
    title: 'Driveway Light',
    toggleEntityId: 'light.garage_camera_floodlight',
    items: [{ title: 'Floodlight', entityId: 'light.garage_camera_floodlight', tone: 'light' }],
  },
]

export const CLIMATE_GROUPS: EntityGroupConfig[] = [
  {
    title: 'Living Room Climate',
    items: [
      { title: 'Back Wall', entityId: 'sensor.living_room_back_wall_presence_sensor_temperature', tone: 'climate' },
      { title: 'Bar', entityId: 'sensor.living_room_bar_presence_sensor_temperature', tone: 'climate' },
      { title: 'Kitchen Wall', entityId: 'sensor.living_room_kitchen_wall_presence_sensor_temperature', tone: 'climate' },
      { title: 'Fireplace', entityId: 'sensor.living_room_fireplace_presence_sensor_temperature', tone: 'climate' },
      { title: 'Ecobee', entityId: 'sensor.living_room_temperature', tone: 'climate' },
      { title: 'Vents', entityId: 'cover.living_room_vents', tone: 'neutral' },
    ],
  },
  {
    title: 'Kitchen Climate',
    items: [
      { title: 'Kitchen', entityId: 'sensor.kitchen_wall_presence_sensor_temperature', tone: 'climate' },
      { title: 'Ecobee', entityId: 'sensor.kitchen_temperature', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.kitchen_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Master Bedroom Climate',
    items: [
      { title: 'Street Window', entityId: 'sensor.master_bedroom_street_window_contact_sensor_device_temperature', tone: 'climate' },
      { title: 'Ecobee', entityId: 'sensor.bedroom_temperature', tone: 'climate' },
      { title: 'Bathroom', entityId: 'sensor.master_bedroom_bathroom_presence_sensor_temperature', tone: 'climate' },
      { title: 'Closet', entityId: 'sensor.master_bedroom_closet_presence_sensor_temperature', tone: 'climate' },
      { title: 'Vents', entityId: 'cover.master_bedroom_vents', tone: 'neutral' },
    ],
  },
]

export const SECURITY_ENTITY = 'alarm_control_panel.aqara_hub_m3_0056_security_system_2'

export const SECURITY_ACTIONS = [
  { title: 'Home', service: 'alarm_arm_home', icon: 'home' },
  { title: 'Away', service: 'alarm_arm_away', icon: 'security' },
  { title: 'Night', service: 'alarm_arm_night', icon: 'weather' },
  { title: 'Disarmed', service: 'alarm_disarm', icon: 'contact' },
] as const

export const WEATHER_ENTITY = 'weather.pirate_weather'