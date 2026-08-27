import { FOOD_CARD_BACKGROUND_COLOR } from './everShelfFood'
import { copy } from '../i18n'
import { HOME_FOOD_ROUTE_PATH, HOME_SPRINKLERS_ROUTE_PATH } from './routes'
import { SHOW_OUTDOOR_FAUCETS_ENTITY_ID } from './sprinklers'

const sprinklersQuickAccessName = copy('pageSprinklers', 'title')
const roomsQuickAccessName = copy('shell', 'quickLinks.rooms')

export type IconKey =
  | 'air'
  | 'bath'
  | 'bed'
  | 'camera'
  | 'car'
  | 'checklist'
  | 'contact'
  | 'contact-open'
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
  | 'presence-off'
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

export type DashboardIcon = IconKey | `mdi:${string}`

export interface StatusChipConfig {
  title: string
  icon: DashboardIcon
  entityId: string
  hash: string
  tone: 'light' | 'security' | 'climate' | 'presence' | 'contact' | 'air'
  colorEntityId?: string
  secondaryEntityId?: string
  width?: number
}

export type QuickAccessModalPage = 'rooms' | 'security-system'

export type QuickAccessAction =
  | { kind: 'modal'; page: QuickAccessModalPage }
  | { kind: 'navigate'; path: string }

export interface QuickAccessConfig {
  action: QuickAccessAction
  title: string
  id: string
  icon: DashboardIcon
  backgroundColor?: string
  entityId?: string
  status?: 'all_food' | 'entity_state'
  tone: 'security' | 'climate' | 'neutral' | 'light' | 'vacuum' | 'media'
  visibilityEntityId?: string
}

export interface AreaConfig {
  title: string
  route: string
  icon: DashboardIcon
  color: {
    r: number
    g: number
    b: number
  }
}

export interface RoomNavigationConfig extends AreaConfig {
  accessCounterEntityId: `counter.${string}`
  accessKey: string
}

export const ROOM_ACCESS_INCREMENT_SCRIPT_ENTITY_ID = 'script.increment_room_access'

export interface EntityButtonConfig {
  title: string
  entityId: string
  colorEntityId?: string
  contactCount?: number
  tone?: 'light' | 'climate' | 'security' | 'presence' | 'contact' | 'neutral'
}

export interface EntityGroupConfig {
  title: string
  colorEntityId?: string
  rangeEntityId?: string
  toggleEntityId?: string
  items: EntityButtonConfig[]
}

export interface AirQualityRoomConfig {
  title: string
  aqiEntityId: string
  colorEntityId: string
  pm25EntityId: string
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
    icon: 'mdi:lightbulb-group',
    entityId: 'light.lights',
    hash: '#lights-overview',
    tone: 'light',
    width: 126,
  },
  {
    title: 'Security',
    icon: 'mdi:shield-outline',
    entityId: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2',
    hash: '#security-system',
    tone: 'security',
    width: 158,
  },
  {
    title: 'Climate',
    icon: 'mdi:thermometer',
    entityId: 'input_text.all_climate_range',
    hash: '#climate-overview',
    tone: 'climate',
    width: 178,
  },
  {
    title: 'Occupancy',
    icon: 'mdi:motion-sensor',
    entityId: 'binary_sensor.occupancy_sensors',
    hash: '#occupancy-overview',
    tone: 'presence',
    width: 162,
  },
  {
    title: 'Contact Sensors',
    icon: 'mdi:door',
    entityId: 'binary_sensor.contact_sensors',
    hash: '#contact-sensors-overview',
    tone: 'contact',
    width: 190,
  },
  {
    title: 'Air Quality',
    icon: 'mdi:blur',
    entityId: 'input_text.all_aqi_range',
    colorEntityId: 'input_text.all_aqi_color',
    secondaryEntityId: 'input_text.all_pm25_range',
    hash: '#aqi-overview',
    tone: 'air',
    width: 236,
  },
]

export const AIR_QUALITY_ROOMS: AirQualityRoomConfig[] = [
  {
    title: 'Living Room',
    aqiEntityId: 'sensor.living_room_air_purifier_air_quality_index',
    colorEntityId: 'input_text.living_room_aqi_color',
    pm25EntityId: 'sensor.living_room_air_purifier_pm2_5',
  },
  {
    title: 'Guest Room',
    aqiEntityId: 'sensor.guest_room_air_purifier_air_quality_index',
    colorEntityId: 'input_text.guest_room_aqi_color',
    pm25EntityId: 'sensor.guest_room_air_purifier_pm2_5',
  },
  {
    title: 'Office',
    aqiEntityId: 'sensor.office_air_purifier_air_quality_index',
    colorEntityId: 'input_text.office_aqi_color',
    pm25EntityId: 'sensor.office_air_purifier_pm2_5',
  },
  {
    title: 'Master Bedroom',
    aqiEntityId: 'sensor.master_bedroom_air_purifier_air_quality_index',
    colorEntityId: 'input_text.master_bedroom_aqi_color',
    pm25EntityId: 'sensor.master_bedroom_air_purifier_pm2_5',
  },
  {
    title: 'Music Room',
    aqiEntityId: 'sensor.air_purifier_air_quality_index',
    colorEntityId: 'input_text.music_room_aqi_color',
    pm25EntityId: 'sensor.air_purifier_pm2_5',
  },
  {
    title: 'Theater Room',
    aqiEntityId: 'sensor.theater_room_air_purifier_air_quality_index',
    colorEntityId: 'input_text.theater_room_aqi_color',
    pm25EntityId: 'sensor.theater_room_air_purifier_pm2_5',
  },
]

export const SECURITY_QUICK_ACCESS_ITEM = {
  action: { kind: 'modal', page: 'security-system' },
  id: 'security-system',
  title: 'Security System',
  icon: 'mdi:shield-outline',
  entityId: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2',
  status: 'entity_state',
  tone: 'security',
} satisfies QuickAccessConfig

export const ROOMS_QUICK_ACCESS_ITEM = {
  action: { kind: 'modal', page: 'rooms' },
  id: 'rooms',
  title: roomsQuickAccessName,
  icon: 'mdi:floor-plan',
  tone: 'climate',
} satisfies QuickAccessConfig

export const QUICK_ACCESS_ITEMS: QuickAccessConfig[] = [
  ROOMS_QUICK_ACCESS_ITEM,
  SECURITY_QUICK_ACCESS_ITEM,
  {
    action: { kind: 'navigate', path: HOME_FOOD_ROUTE_PATH },
    id: 'food',
    title: 'Food & Recipes',
    icon: 'mdi:food-fork-drink',
    backgroundColor: FOOD_CARD_BACKGROUND_COLOR,
    status: 'all_food',
    tone: 'neutral',
  },
  {
    action: { kind: 'navigate', path: 'vacuums' },
    id: 'vacuums',
    title: 'Vacuums',
    icon: 'mdi:robot-vacuum',
    tone: 'vacuum',
  },
  {
    action: { kind: 'navigate', path: 'media' },
    id: 'media',
    title: 'Media',
    icon: 'mdi:remote',
    tone: 'media',
  },
  {
    action: { kind: 'navigate', path: 'custom-lights' },
    id: 'custom-lights',
    title: 'Custom Lights',
    icon: 'mdi:lightbulb-group',
    tone: 'light',
  },
  {
    action: { kind: 'navigate', path: HOME_SPRINKLERS_ROUTE_PATH },
    id: 'sprinklers',
    title: sprinklersQuickAccessName,
    icon: 'mdi:sprinkler-variant',
    tone: 'neutral',
    visibilityEntityId: SHOW_OUTDOOR_FAUCETS_ENTITY_ID,
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

export const AREA_ITEMS: RoomNavigationConfig[] = [
  { title: 'Living Room', route: '/at-a-glance/living-room', icon: 'mdi:sofa', color: { r: 218, g: 206, b: 164 }, accessKey: 'living-room', accessCounterEntityId: 'counter.room_access_living_room' },
  { title: 'Guest Room', route: '/at-a-glance/guest-room', icon: 'mdi:bed', color: { r: 51, g: 193, b: 146 }, accessKey: 'guest-room', accessCounterEntityId: 'counter.room_access_guest_room' },
  { title: 'Gym', route: '/at-a-glance/gym', icon: 'mdi:dumbbell', color: { r: 213, g: 117, b: 26 }, accessKey: 'gym', accessCounterEntityId: 'counter.room_access_gym' },
  { title: 'Master Bedroom', route: '/at-a-glance/master-bedroom', icon: 'mdi:bed-king', color: { r: 20, g: 33, b: 215 }, accessKey: 'master-bedroom', accessCounterEntityId: 'counter.room_access_master_bedroom' },
  { title: 'Office', route: '/at-a-glance/office', icon: 'mdi:desktop-tower', color: { r: 20, g: 219, b: 206 }, accessKey: 'office', accessCounterEntityId: 'counter.room_access_office' },
  { title: 'Hallway', route: '/at-a-glance/hallway', icon: 'mdi:door-open', color: { r: 65, g: 49, b: 31 }, accessKey: 'hallway', accessCounterEntityId: 'counter.room_access_hallway' },
  { title: 'Kitchen', route: '/at-a-glance/kitchen', icon: 'mdi:stove', color: { r: 177, g: 200, b: 60 }, accessKey: 'kitchen', accessCounterEntityId: 'counter.room_access_kitchen' },
  { title: 'Music Room', route: '/at-a-glance/music-room', icon: 'mdi:music', color: { r: 183, g: 18, b: 186 }, accessKey: 'music-room', accessCounterEntityId: 'counter.room_access_music_room' },
  { title: 'Garage', route: '/at-a-glance/garage', icon: 'mdi:garage', color: { r: 223, g: 12, b: 12 }, accessKey: 'garage', accessCounterEntityId: 'counter.room_access_garage' },
  { title: 'Theater Room', route: '/at-a-glance/theater-room', icon: 'mdi:movie-open', color: { r: 0, g: 0, b: 1 }, accessKey: 'theater-room', accessCounterEntityId: 'counter.room_access_theater_room' },
  { title: 'Back Deck', route: '/at-a-glance/back-deck', icon: 'mdi:grill', color: { r: 5, g: 77, b: 6 }, accessKey: 'back-deck', accessCounterEntityId: 'counter.room_access_back_deck' },
  { title: 'Downstairs Hallway', route: '/at-a-glance/downstairs-hallway', icon: 'mdi:stairs', color: { r: 234, g: 236, b: 203 }, accessKey: 'downstairs-hallway', accessCounterEntityId: 'counter.room_access_downstairs_hallway' },
  { title: 'Guest Bathroom', route: '/at-a-glance/guest-bathroom', icon: 'mdi:shower', color: { r: 43, g: 227, b: 224 }, accessKey: 'guest-bathroom', accessCounterEntityId: 'counter.room_access_guest_bathroom' },
  { title: 'Master Bathroom', route: '/at-a-glance/master-bathroom', icon: 'mdi:bathtub', color: { r: 95, g: 93, b: 93 }, accessKey: 'master-bathroom', accessCounterEntityId: 'counter.room_access_master_bathroom' },
  { title: 'Dining Room', route: '/at-a-glance/dining-room', icon: 'mdi:silverware-fork-knife', color: { r: 217, g: 179, b: 115 }, accessKey: 'dining-room', accessCounterEntityId: 'counter.room_access_dining_room' },
  { title: 'Entryway', route: '/at-a-glance/entryway', icon: 'mdi:door', color: { r: 250, g: 217, b: 0 }, accessKey: 'entryway', accessCounterEntityId: 'counter.room_access_entryway' },
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
    title: 'Master Bedroom Closet Light',
    toggleEntityId: 'light.master_bedroom_closet_light',
    items: [{ title: 'Closet Light', entityId: 'light.master_bedroom_closet_light', tone: 'light' }],
  },
  {
    title: 'Gym Light',
    toggleEntityId: 'light.gym_light',
    items: [{ title: 'Gym Light', entityId: 'light.gym_light', tone: 'light' }],
  },
  {
    title: 'Hallway Lights',
    toggleEntityId: 'light.hallway_lights',
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
      { title: 'Fireplace Light', entityId: 'light.music_room_fireplace_light_2', tone: 'light' },
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
    rangeEntityId: 'input_text.living_room_climate_range',
    colorEntityId: 'input_text.living_room_climate_color',
    items: [
      { title: 'Back Wall', entityId: 'sensor.living_room_presence_sensor_temperature', colorEntityId: 'input_text.living_room_back_wall_climate_color', tone: 'climate' },
      { title: 'Bar', entityId: 'sensor.living_room_bar_presence_sensor_temperature_2', colorEntityId: 'input_text.living_room_bar_climate_color', tone: 'climate' },
      { title: 'Kitchen Wall', entityId: 'sensor.living_room_kitchen_wall_presence_sensor_temperature_2', colorEntityId: 'input_text.living_room_kitchen_wall_climate_color', tone: 'climate' },
      { title: 'Fireplace', entityId: 'sensor.living_room_fireplace_presence_sensor_temperature_2', colorEntityId: 'input_text.living_room_fireplace_climate_color', tone: 'climate' },
      { title: 'Vents', entityId: 'cover.living_room_vents', tone: 'neutral' },
    ],
  },
  {
    title: 'Guest Room Climate',
    rangeEntityId: 'input_text.guest_room_climate_range',
    colorEntityId: 'input_text.guest_room_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.guest_room_presence_sensor_temperature_2', colorEntityId: 'input_text.guest_room_presence_climate_color', tone: 'climate' },
      { title: 'Closet', entityId: 'sensor.guest_room_closet_facing_presence_sensor_temperature_2', colorEntityId: 'input_text.guest_room_closet_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.guest_room_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Master Bedroom Climate',
    rangeEntityId: 'input_text.master_bedroom_climate_range',
    colorEntityId: 'input_text.master_bedroom_climate_color',
    items: [
      { title: 'Window', entityId: 'sensor.master_bedroom_window_presence_sensor_temperature', colorEntityId: 'input_text.master_bedroom_window_climate_color', tone: 'climate' },
      { title: 'Bathroom', entityId: 'sensor.master_bedroom_bathroom_presence_sensor_temperature', colorEntityId: 'input_text.master_bedroom_bathroom_climate_color', tone: 'climate' },
      { title: 'Closet', entityId: 'sensor.master_bedroom_closet_presence_sensor_temperature', colorEntityId: 'input_text.master_bedroom_closet_climate_color', tone: 'climate' },
      { title: 'Vents', entityId: 'cover.master_bedroom_vents', tone: 'neutral' },
    ],
  },
  {
    title: 'Gym Climate',
    rangeEntityId: 'input_text.gym_climate_range',
    colorEntityId: 'input_text.gym_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.gym_presence_sensor_temperature_2', colorEntityId: 'input_text.gym_presence_climate_color', tone: 'climate' },
      { title: 'Door', entityId: 'sensor.hallway_guest_bath_gym_presence_sensor_temperature', colorEntityId: 'input_text.gym_door_guest_bath_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.gym_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Hallway Climate',
    rangeEntityId: 'input_text.hallway_climate_range',
    colorEntityId: 'input_text.hallway_climate_color',
    items: [
      { title: 'Entry', entityId: 'sensor.entryway_presence_sensor_temperature', colorEntityId: 'input_text.entryway_climate_color', tone: 'climate' },
      { title: 'Guest Room', entityId: 'sensor.hallway_guest_bath_gym_presence_sensor_temperature', colorEntityId: 'input_text.gym_door_guest_bath_climate_color', tone: 'climate' },
      { title: 'Office', entityId: 'sensor.hallway_office_bedroom_presence_sensor_temperature', colorEntityId: 'input_text.office_door_climate_color', tone: 'climate' },
    ],
  },
  {
    title: 'Office Climate',
    rangeEntityId: 'input_text.office_climate_range',
    colorEntityId: 'input_text.office_climate_color',
    items: [
      { title: 'Door', entityId: 'sensor.hallway_office_bedroom_presence_sensor_temperature', colorEntityId: 'input_text.office_door_climate_color', tone: 'climate' },
      { title: 'Presence', entityId: 'sensor.office_presence_sensor_temperature', colorEntityId: 'input_text.office_presence_climate_color', tone: 'climate' },
      { title: 'Closet', entityId: 'sensor.office_closet_presence_sensor_temperature', colorEntityId: 'input_text.office_closet_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.office_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Kitchen Climate',
    rangeEntityId: 'input_text.kitchen_climate_range',
    colorEntityId: 'input_text.kitchen_climate_color',
    items: [
      { title: 'Kitchen', entityId: 'sensor.kitchen_presence_sensor_temperature_2', colorEntityId: 'input_text.kitchen_presence_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.kitchen_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Dining Room Climate',
    rangeEntityId: 'input_text.dining_room_climate_range',
    colorEntityId: 'input_text.dining_room_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.dining_room_presence_sensor_temperature_2', colorEntityId: 'input_text.dining_room_presence_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.dining_room_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Music Room Climate',
    rangeEntityId: 'input_text.music_room_climate_range',
    colorEntityId: 'input_text.music_room_climate_color',
    items: [
      { title: 'Kitchenette', entityId: 'sensor.music_room_kitchenette_presence_sensor_temperature_2', colorEntityId: 'input_text.music_room_kitchenette_climate_color', tone: 'climate' },
      { title: 'North Wall', entityId: 'sensor.music_room_north_wall_presence_sensor_temperature_2', colorEntityId: 'input_text.music_room_north_wall_climate_color', tone: 'climate' },
      { title: 'Door', entityId: 'sensor.music_room_door_presence_sensor_temperature_2', colorEntityId: 'input_text.music_room_door_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.music_room_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Theater Room Climate',
    rangeEntityId: 'input_text.theater_room_climate_range',
    colorEntityId: 'input_text.theater_room_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.theater_room_presence_sensor_temperature_2', colorEntityId: 'input_text.theater_room_presence_sensor_climate_color', tone: 'climate' },
      { title: 'Vents', entityId: 'cover.theater_room_vents', tone: 'neutral' },
    ],
  },
  {
    title: 'Downstairs Hallway Climate',
    rangeEntityId: 'input_text.downstairs_hallway_climate_range',
    colorEntityId: 'input_text.downstairs_hallway_climate_color',
    items: [{ title: 'Presence', entityId: 'sensor.downstairs_hallway_presence_sensor_temperature_2', colorEntityId: 'input_text.downstairs_hallway_climate_color', tone: 'climate' }],
  },
  {
    title: 'Guest Bathroom Climate',
    rangeEntityId: 'input_text.guest_bathroom_climate_range',
    colorEntityId: 'input_text.guest_bathroom_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.guest_bathroom_presence_sensor_temperature_2', colorEntityId: 'input_text.guest_bathroom_presence_climate_color', tone: 'climate' },
      { title: 'Entry', entityId: 'sensor.guest_bathroom_entry_presence_sensor_temperature_2', colorEntityId: 'input_text.guest_bathroom_entry_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.guest_bathroom_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Master Bathroom Climate',
    rangeEntityId: 'input_text.master_bathroom_climate_range',
    colorEntityId: 'input_text.master_bathroom_climate_color',
    items: [
      { title: 'Presence', entityId: 'sensor.master_bathroom_presence_sensor_temperature', colorEntityId: 'input_text.master_bathroom_presence_climate_color', tone: 'climate' },
      { title: 'Vent', entityId: 'cover.master_bathroom_vent_vent', tone: 'neutral' },
    ],
  },
  {
    title: 'Entryway Climate',
    rangeEntityId: 'input_text.front_door_climate_range',
    colorEntityId: 'input_text.front_door_climate_color',
    items: [{ title: 'Front Door', entityId: 'sensor.front_door_presence_sensor_temperature_2', colorEntityId: 'input_text.entryway_climate_color', tone: 'climate' }],
  },
]

export const OCCUPANCY_GROUPS: EntityGroupConfig[] = [
  {
    title: 'Living Room Occupancy',
    items: [
      { title: 'Back Wall', entityId: 'binary_sensor.living_room_presence_sensor_presence', tone: 'presence' },
      { title: 'Bar', entityId: 'binary_sensor.living_room_bar_presence_sensor_presence', tone: 'presence' },
      { title: 'Kitchen Wall', entityId: 'binary_sensor.living_room_kitchen_wall_presence_sensor_presence', tone: 'presence' },
      { title: 'Fireplace', entityId: 'binary_sensor.living_room_fireplace_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Hallway Occupancy',
    items: [
      { title: 'Entryway', entityId: 'binary_sensor.entryway_presence_sensor_presence', tone: 'presence' },
      { title: 'Bathroom', entityId: 'binary_sensor.hallway_guest_bath_gym_presence_sensor_presence', tone: 'presence' },
      { title: 'Office', entityId: 'binary_sensor.hallway_office_bedroom_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Kitchen Occupancy',
    items: [{ title: 'Kitchen', entityId: 'binary_sensor.kitchen_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Guest Room Occupancy',
    items: [
      { title: 'Guest Room', entityId: 'binary_sensor.guest_room_presence_sensor_presence', tone: 'presence' },
      { title: 'Closet', entityId: 'binary_sensor.guest_room_closet_facing_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Gym Occupancy',
    items: [{ title: 'Gym', entityId: 'binary_sensor.gym_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Office Occupancy',
    items: [
      { title: 'Office', entityId: 'binary_sensor.office_presence_sensor_presence', tone: 'presence' },
      { title: 'Closet', entityId: 'binary_sensor.office_closet_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Master Bedroom Occupancy',
    items: [
      { title: 'Master Bedroom', entityId: 'binary_sensor.master_bedroom_window_presence_sensor_presence', tone: 'presence' },
      { title: 'Bathroom', entityId: 'binary_sensor.master_bedroom_bathroom_presence_sensor_presence', tone: 'presence' },
      { title: 'Closet', entityId: 'binary_sensor.master_bedroom_closet_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Master Bedroom Closet Occupancy',
    items: [{ title: 'Closet', entityId: 'binary_sensor.master_bedroom_closet_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Guest Bathroom Occupancy',
    items: [
      { title: 'Guest Bathroom', entityId: 'binary_sensor.guest_bathroom_presence_sensor_presence', tone: 'presence' },
      { title: 'Entry', entityId: 'binary_sensor.guest_bathroom_entry_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Master Bathroom Occupancy',
    items: [{ title: 'Master Bathroom', entityId: 'binary_sensor.master_bathroom_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Music Room Occupancy',
    items: [
      { title: 'North Wall', entityId: 'binary_sensor.music_room_north_wall_presence_sensor_presence', tone: 'presence' },
      { title: 'Kitchenette', entityId: 'binary_sensor.music_room_kitchenette_presence_sensor_presence', tone: 'presence' },
      { title: 'Door', entityId: 'binary_sensor.music_room_door_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Dining Room Occupancy',
    items: [{ title: 'Dining Room', entityId: 'binary_sensor.dining_room_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Theater Room Occupancy',
    items: [{ title: 'Theater Room', entityId: 'binary_sensor.theater_room_presence_sensor_presence', tone: 'presence' }],
  },
  {
    title: 'Entryway Occupancy',
    items: [
      { title: 'Entryway Occupancy', entityId: 'binary_sensor.entryway_presence_sensor_presence', tone: 'presence' },
      { title: 'Front Door', entityId: 'binary_sensor.front_door_presence_sensor_presence', tone: 'presence' },
    ],
  },
  {
    title: 'Downstairs Hallway Occupancy',
    items: [{ title: 'Downstairs Hallway', entityId: 'binary_sensor.downstairs_hallway_presence_sensor_presence', tone: 'presence' }],
  },
]

export const CONTACT_GROUPS: EntityGroupConfig[] = [
  {
    title: 'Entryway Contact Sensors',
    items: [{ title: 'Front Door', entityId: 'binary_sensor.front_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Office Contact Sensors',
    items: [
      { title: 'PC Window', entityId: 'binary_sensor.office_pc_window_sensor_contact', tone: 'contact' },
      { title: 'Window', entityId: 'binary_sensor.office_window_contact_sensor_contact', tone: 'contact' },
    ],
  },
  {
    title: 'Living Room Contact Sensors',
    items: [{ title: 'Window', entityId: 'binary_sensor.living_room_window_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Garage Contact Sensors',
    items: [{ title: 'Garage Door', entityId: 'binary_sensor.garage_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Master Bedroom Contact Sensors',
    items: [{ title: 'Street Windows', entityId: 'binary_sensor.master_bedroom_street_window_contact_sensor_contact', contactCount: 2, tone: 'contact' }],
  },
  {
    title: 'Dining Room Contact Sensors',
    items: [{ title: 'Dining Room Door', entityId: 'binary_sensor.dining_room_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Kitchen Contact Sensors',
    items: [{ title: 'Kitchen Door', entityId: 'binary_sensor.kitchen_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Music Room Contact Sensors',
    items: [{ title: 'Music Room Door', entityId: 'binary_sensor.music_room_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Theater Room Contact Sensors',
    items: [{ title: 'Theater Room Door', entityId: 'binary_sensor.theater_room_door_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Guest Room Contact Sensors',
    items: [{ title: 'Window', entityId: 'binary_sensor.guest_room_window_contact_sensor_contact', tone: 'contact' }],
  },
  {
    title: 'Gym Contact Sensors',
    items: [{ title: 'Window', entityId: 'binary_sensor.gym_window_contact_sensor_contact', tone: 'contact' }],
  },
]

export const SECURITY_ENTITY = 'alarm_control_panel.aqara_hub_m3_0056_security_system_2'

export const SECURITY_ACTIONS = [
  { title: 'Home', service: 'alarm_arm_home', icon: 'mdi:shield-home' },
  { title: 'Away', service: 'alarm_arm_away', icon: 'mdi:shield' },
  { title: 'Night', service: 'alarm_arm_night', icon: 'mdi:shield-moon' },
  { title: 'Disarmed', service: 'alarm_disarm', icon: 'mdi:shield-off' },
] as const

export const WEATHER_ENTITY = 'weather.pirate_weather'
export const WEATHER_AQI_ENTITY = 'sensor.pirate_weather_air_quality_index'
export const SUN_ENTITY = 'sun.sun'
