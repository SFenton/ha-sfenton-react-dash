/**
 * Per-area entity configuration extracted from the at-a-glance dashboard.
 * Each area defines the entities available for display in that room's detail view.
 */
import type { AreaRoute } from './routes';

interface LightEntry { entityId: string; name: string; readonly?: boolean }
interface SensorEntry { entityId: string; name: string; colorEntity?: string }
interface ContactEntry { entityId: string; name: string }
interface VentEntry { entityId: string; name: string }
interface AqiEntry { entityId: string; name: string; pm25Entity?: string }

export interface AreaConfig {
  groupLight?: string;
  lights: LightEntry[];
  climate: SensorEntry[];
  occupancy: SensorEntry[];
  doors: ContactEntry[];
  windows: ContactEntry[];
  vents: VentEntry[];
  aqi: AqiEntry[];
}

export const AREA_ENTITIES: Record<AreaRoute, AreaConfig> = {
  'living-room': {
    groupLight: 'light.living_room',
    lights: [
      { entityId: 'light.living_room_front_left_light', name: 'Front Left' },
      { entityId: 'light.living_room_front_right_light', name: 'Front Right' },
      { entityId: 'light.living_room_back_left_light', name: 'Back Left' },
      { entityId: 'light.living_room_back_right_light', name: 'Back Right' },
    ],
    climate: [
      { entityId: 'sensor.living_room_back_wall_presence_sensor_temperature', name: 'Back Wall', colorEntity: 'input_text.living_room_back_wall_climate_color' },
      { entityId: 'sensor.living_room_bar_presence_sensor_temperature', name: 'Bar', colorEntity: 'input_text.living_room_bar_climate_color' },
      { entityId: 'sensor.living_room_kitchen_wall_presence_sensor_temperature', name: 'Kitchen Wall', colorEntity: 'input_text.living_room_kitchen_wall_climate_color' },
      { entityId: 'sensor.living_room_fireplace_presence_sensor_temperature', name: 'Fireplace', colorEntity: 'input_text.living_room_fireplace_climate_color' },
      { entityId: 'sensor.living_room_temperature', name: 'Ecobee', colorEntity: 'input_text.living_room_ecobee_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.living_room_back_wall_presence_sensor_presence', name: 'Back Wall' },
      { entityId: 'binary_sensor.living_room_bar_presence_sensor_presence', name: 'Bar' },
      { entityId: 'binary_sensor.living_room_kitchen_wall_presence_sensor_presence', name: 'Kitchen Wall' },
      { entityId: 'binary_sensor.living_room_fireplace_presence_sensor_presence', name: 'Fireplace' },
    ],
    doors: [],
    windows: [
      { entityId: 'binary_sensor.living_room_window_contact_sensor_contact', name: 'Window' },
    ],
    vents: [
      { entityId: 'cover.living_room_vents', name: 'Living Room Vents' },
    ],
    aqi: [
      { entityId: 'sensor.living_room_air_purifier_air_quality_index', name: 'Living Room', pm25Entity: 'sensor.living_room_air_purifier_pm2_5' },
    ],
  },

  kitchen: {
    groupLight: 'light.kitchen',
    lights: [
      { entityId: 'light.kitchen_table_light', name: 'Table Light' },
      { entityId: 'light.kitchen_door_light', name: 'Door Light' },
      { entityId: 'light.kitchen_counter_light', name: 'Counter Light' },
      { entityId: 'light.kitchen_sink_light', name: 'Sink Light' },
    ],
    climate: [
      { entityId: 'sensor.kitchen_wall_presence_sensor_temperature', name: 'Kitchen', colorEntity: 'input_text.kitchen_presence_climate_color' },
      { entityId: 'sensor.kitchen_temperature', name: 'Ecobee', colorEntity: 'input_text.kitchen_ecobee_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.kitchen_wall_presence_sensor_presence', name: 'Kitchen' },
    ],
    doors: [
      { entityId: 'binary_sensor.kitchen_door_contact_sensor_contact', name: 'Kitchen Door' },
    ],
    windows: [],
    vents: [
      { entityId: 'cover.kitchen_vent_vent', name: 'Kitchen Vent' },
    ],
    aqi: [],
  },

  'master-bedroom': {
    groupLight: 'light.master_bedroom',
    lights: [
      { entityId: 'light.master_bedroom_window_light', name: 'Window Light' },
      { entityId: 'light.master_bedroom_bathroom_light', name: 'Bathroom Light' },
      { entityId: 'light.master_bedroom_door_light', name: 'Door Light' },
      { entityId: 'light.stephen_nightstand_light', name: 'Stephen Nightstand' },
      { entityId: 'light.steph_nightstand_light', name: 'Steph Nightstand' },
      { entityId: 'light.master_bedroom_closet_light', name: 'Closet Light' },
    ],
    climate: [
      { entityId: 'sensor.master_bedroom_street_window_contact_sensor_device_temperature', name: 'Window', colorEntity: 'input_text.master_bedroom_window_climate_color' },
      { entityId: 'sensor.bedroom_temperature', name: 'Ecobee', colorEntity: 'input_text.master_bedroom_ecobee_climate_color' },
      { entityId: 'sensor.master_bedroom_bathroom_presence_sensor_temperature', name: 'Bathroom', colorEntity: 'input_text.master_bedroom_bathroom_climate_color' },
      { entityId: 'sensor.master_bedroom_closet_presence_sensor_temperature', name: 'Closet', colorEntity: 'input_text.master_bedroom_closet_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.master_bedroom_window_presence_sensor_presence', name: 'Window' },
      { entityId: 'binary_sensor.master_bedroom_bathroom_presence_sensor_presence', name: 'Bathroom' },
      { entityId: 'binary_sensor.master_bedroom_closet_presence_sensor_presence', name: 'Closet' },
    ],
    doors: [],
    windows: [
      { entityId: 'binary_sensor.master_bedroom_street_window_contact_sensor_contact', name: 'Street Window' },
    ],
    vents: [
      { entityId: 'cover.master_bedroom_vents', name: 'Bedroom Vents' },
    ],
    aqi: [
      { entityId: 'sensor.master_bedroom_air_purifier_air_quality_index', name: 'Bedroom', pm25Entity: 'sensor.master_bedroom_air_purifier_pm2_5' },
    ],
  },

  'guest-room': {
    groupLight: 'light.guest_room',
    lights: [
      { entityId: 'light.guest_room_tv_light', name: 'TV Light' },
      { entityId: 'light.guest_room_bed_light', name: 'Bed Light' },
    ],
    climate: [
      { entityId: 'sensor.guest_room_presence_sensor_temperature', name: 'Guest Room', colorEntity: 'input_text.guest_room_presence_climate_color' },
      { entityId: 'sensor.guest_room_temperature', name: 'Ecobee', colorEntity: 'input_text.guest_room_ecobee_climate_color' },
      { entityId: 'sensor.guest_room_closet_facing_presence_sensor_temperature', name: 'Closet', colorEntity: 'input_text.guest_room_closet_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.guest_room_presence_sensor_presence', name: 'Guest Room' },
      { entityId: 'binary_sensor.guest_room_closet_facing_presence_sensor_presence', name: 'Closet' },
    ],
    doors: [],
    windows: [
      { entityId: 'binary_sensor.guest_room_window_contact_sensor_contact', name: 'Window' },
    ],
    vents: [
      { entityId: 'cover.guest_room_vent_vent', name: 'Guest Room Vent' },
    ],
    aqi: [
      { entityId: 'sensor.guest_room_air_purifier_air_quality_index', name: 'Guest Room', pm25Entity: 'sensor.guest_room_air_purifier_pm2_5' },
    ],
  },

  office: {
    lights: [
      { entityId: 'light.office_light', name: 'Office Light', readonly: true },
    ],
    climate: [
      { entityId: 'sensor.office_presence_sensor_temperature', name: 'Office', colorEntity: 'input_text.office_presence_climate_color' },
      { entityId: 'sensor.office_temperature', name: 'Ecobee', colorEntity: 'input_text.office_ecobee_climate_color' },
      { entityId: 'sensor.office_closet_presence_sensor_temperature', name: 'Closet', colorEntity: 'input_text.office_closet_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.office_presence_sensor_presence', name: 'Office' },
      { entityId: 'binary_sensor.office_closet_presence_sensor_presence', name: 'Closet' },
    ],
    doors: [],
    windows: [
      { entityId: 'binary_sensor.office_pc_window_sensor_contact', name: 'PC Window' },
      { entityId: 'binary_sensor.office_window_contact_sensor_contact', name: 'Office Window' },
    ],
    vents: [
      { entityId: 'cover.office_vent_vent', name: 'Office Vent' },
    ],
    aqi: [
      { entityId: 'sensor.office_air_purifier_air_quality_index', name: 'Office', pm25Entity: 'sensor.office_air_purifier_pm2_5' },
    ],
  },

  gym: {
    lights: [
      { entityId: 'light.gym_light', name: 'Gym Light' },
    ],
    climate: [
      { entityId: 'sensor.gym_presence_sensor_temperature', name: 'Gym', colorEntity: 'input_text.gym_climate_color' },
      { entityId: 'sensor.gym_temperature', name: 'Ecobee', colorEntity: 'input_text.gym_ecobee_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.gym_presence_sensor_presence', name: 'Gym' },
    ],
    doors: [],
    windows: [
      { entityId: 'binary_sensor.gym_window_contact_sensor_contact', name: 'Gym Window' },
    ],
    vents: [
      { entityId: 'cover.gym_vent_vent', name: 'Gym Vent' },
    ],
    aqi: [],
  },

  hallway: {
    groupLight: 'light.hallway',
    lights: [
      { entityId: 'light.hallway_entry_light', name: 'Entry Light', readonly: true },
      { entityId: 'light.hallway_gym_light', name: 'Gym Light', readonly: true },
      { entityId: 'light.hallway_guest_room_light', name: 'Guest Room Light', readonly: true },
      { entityId: 'light.hallway_office_light', name: 'Office Light', readonly: true },
    ],
    climate: [
      { entityId: 'sensor.home_current_temperature', name: 'Ecobee', colorEntity: 'input_text.hallway_ecobee_climate_color' },
    ],
    occupancy: [],
    doors: [],
    windows: [],
    vents: [],
    aqi: [],
  },

  'music-room': {
    groupLight: 'light.music_room',
    lights: [
      { entityId: 'light.hue_color_downlight_2', name: 'Fireplace' },
      { entityId: 'light.hue_color_downlight_4', name: 'Window' },
      { entityId: 'light.hue_color_downlight_1', name: 'Entry' },
      { entityId: 'light.hue_color_downlight_3', name: 'Drums' },
      { entityId: 'light.hue_color_downlight_5', name: 'Bathroom' },
      { entityId: 'light.hue_color_downlight_6', name: 'Couch' },
      { entityId: 'light.hue_color_downlight_8', name: 'Server' },
      { entityId: 'light.hue_color_downlight_7', name: 'TV' },
      { entityId: 'light.hue_play_2', name: 'TV Left' },
      { entityId: 'light.hue_play_1', name: 'TV Right' },
    ],
    climate: [
      { entityId: 'sensor.music_room_temperature', name: 'Ecobee', colorEntity: 'input_text.music_room_ecobee_climate_color' },
      { entityId: 'sensor.music_room_north_wall_presence_sensor_temperature', name: 'North Wall', colorEntity: 'input_text.music_room_north_wall_climate_color' },
      { entityId: 'sensor.music_room_kitchenette_presence_sensor_temperature', name: 'Kitchenette', colorEntity: 'input_text.music_room_kitchenette_climate_color' },
      { entityId: 'sensor.music_room_door_presence_sensor_temperature', name: 'Door', colorEntity: 'input_text.music_room_door_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.music_room_north_wall_presence_sensor_presence', name: 'North Wall' },
      { entityId: 'binary_sensor.music_room_kitchenette_presence_sensor_presence', name: 'Kitchenette' },
      { entityId: 'binary_sensor.music_room_door_presence_sensor_presence', name: 'Door' },
    ],
    doors: [
      { entityId: 'binary_sensor.music_room_door_contact_sensor_contact', name: 'Music Room Door' },
    ],
    windows: [],
    vents: [
      { entityId: 'cover.music_room_vent_vent', name: 'Music Room Vent' },
    ],
    aqi: [
      { entityId: 'sensor.air_purifier_air_quality_index', name: 'Music Room', pm25Entity: 'sensor.air_purifier_pm2_5' },
    ],
  },

  garage: {
    lights: [],
    climate: [],
    occupancy: [],
    doors: [],
    windows: [],
    vents: [],
    aqi: [],
  },

  'theater-room': {
    groupLight: 'light.theater_room',
    lights: [
      { entityId: 'light.theater_room_front_screen_light', name: 'Front Screen' },
      { entityId: 'light.theater_room_front_right_light', name: 'Front Right' },
      { entityId: 'light.theater_room_front_rear_light', name: 'Front Rear' },
      { entityId: 'light.theater_room_rear_front_light', name: 'Rear Front' },
      { entityId: 'light.theater_room_rear_back_light', name: 'Rear Back' },
      { entityId: 'light.theater_room_rear_right_light', name: 'Rear Right' },
    ],
    climate: [
      { entityId: 'sensor.theater_room_temperature', name: 'Ecobee', colorEntity: 'input_text.theater_room_ecobee_climate_color' },
      { entityId: 'sensor.theater_room_presence_sensor_temperature', name: 'Theater', colorEntity: 'input_text.theater_room_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.theater_room_presence_sensor_presence', name: 'Theater Room' },
    ],
    doors: [
      { entityId: 'binary_sensor.theater_room_door_contact_sensor_contact', name: 'Theater Door' },
    ],
    windows: [],
    vents: [
      { entityId: 'cover.theater_room_vents', name: 'Theater Vents' },
    ],
    aqi: [
      { entityId: 'sensor.theater_room_air_purifier_air_quality_index', name: 'Theater', pm25Entity: 'sensor.theater_room_air_purifier_pm2_5' },
    ],
  },

  'back-deck': {
    groupLight: 'light.back_deck',
    lights: [
      { entityId: 'light.grill_light', name: 'Grill Light' },
      { entityId: 'light.couch_light', name: 'Couches' },
    ],
    climate: [],
    occupancy: [],
    doors: [],
    windows: [],
    vents: [],
    aqi: [],
  },

  'downstairs-hallway': {
    lights: [
      { entityId: 'light.downstairs_hallway_light', name: 'Hallway Light' },
    ],
    climate: [
      { entityId: 'sensor.downstairs_hallway_presence_sensor_temperature', name: 'Hallway', colorEntity: 'input_text.downstairs_hallway_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.downstairs_hallway_presence_sensor_presence', name: 'Hallway' },
    ],
    doors: [],
    windows: [],
    vents: [],
    aqi: [],
  },

  'guest-bathroom': {
    lights: [
      { entityId: 'light.guest_bathroom_dimmer_switch', name: 'Bathroom Light' },
    ],
    climate: [
      { entityId: 'sensor.guest_bathroom_presence_sensor_temperature', name: 'Bathroom', colorEntity: 'input_text.guest_bathroom_presence_climate_color' },
      { entityId: 'sensor.guest_bathroom_temperature', name: 'Ecobee', colorEntity: 'input_text.guest_bathroom_ecobee_climate_color' },
      { entityId: 'sensor.guest_bathroom_entry_presence_sensor_temperature', name: 'Entry', colorEntity: 'input_text.guest_bathroom_entry_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.guest_bathroom_presence_sensor_presence', name: 'Bathroom' },
      { entityId: 'binary_sensor.guest_bathroom_entry_presence_sensor_presence', name: 'Entry' },
    ],
    doors: [],
    windows: [],
    vents: [
      { entityId: 'cover.guest_bathroom_vent_vent', name: 'Bathroom Vent' },
    ],
    aqi: [],
  },

  'master-bathroom': {
    lights: [
      { entityId: 'light.master_bathroom_dimmer_switch', name: 'Bathroom Light' },
    ],
    climate: [
      { entityId: 'sensor.master_bathroom_presence_sensor_temperature', name: 'Bathroom', colorEntity: 'input_text.master_bathroom_presence_climate_color' },
      { entityId: 'sensor.master_bathroom_temperature', name: 'Ecobee', colorEntity: 'input_text.master_bathroom_ecobee_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.master_bathroom_presence_sensor_presence', name: 'Bathroom' },
    ],
    doors: [],
    windows: [],
    vents: [
      { entityId: 'cover.master_bathroom_vent_vent', name: 'Bathroom Vent' },
    ],
    aqi: [],
  },

  'dining-room': {
    lights: [
      { entityId: 'light.dining_room_dimmer_switch', name: 'Dining Room Light', readonly: true },
    ],
    climate: [
      { entityId: 'sensor.dining_room_presence_sensor_temperature', name: 'Dining Room', colorEntity: 'input_text.dining_room_presence_climate_color' },
      { entityId: 'sensor.dining_room_temperature', name: 'Ecobee', colorEntity: 'input_text.dining_room_ecobee_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.dining_room_presence_sensor_presence', name: 'Dining Room' },
    ],
    doors: [
      { entityId: 'binary_sensor.dining_room_door_contact_sensor_contact', name: 'Dining Room Door' },
    ],
    windows: [],
    vents: [
      { entityId: 'cover.dining_room_vent_vent', name: 'Dining Room Vent' },
    ],
    aqi: [],
  },

  entryway: {
    lights: [],
    climate: [
      { entityId: 'sensor.front_door_presence_sensor_temperature', name: 'Front Door', colorEntity: 'input_text.front_door_climate_color' },
      { entityId: 'sensor.entryway_presence_sensor_temperature', name: 'Entryway', colorEntity: 'input_text.entryway_climate_color' },
    ],
    occupancy: [
      { entityId: 'binary_sensor.entryway_presence_sensor_presence', name: 'Entryway' },
      { entityId: 'binary_sensor.front_door_presence_sensor_presence', name: 'Front Door' },
    ],
    doors: [],
    windows: [],
    vents: [],
    aqi: [],
  },
};
