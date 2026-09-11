export type LightColorCapability = 'rgb' | 'temperature' | 'none'

export interface HouseLight {
  entityId: string
  name: string
  aliases?: string[]
}

export interface HouseLightRoom {
  id: string
  name: string
  aliases: string[]
  groupEntityId: string
  color: LightColorCapability
  dimmable?: boolean
  lights: HouseLight[]
  pblEntityId?: string
}

export const HOUSE_LIGHT_ROOMS: HouseLightRoom[] = [
  {
    id: 'living-room', name: 'Living Room', aliases: ['living room', 'lounge'], groupEntityId: 'light.living_room', color: 'temperature',
    pblEntityId: 'switch.living_room_presence_living_room_lights_presence_allowed',
    lights: [
      { entityId: 'light.living_room_front_left_light', name: 'Front Left', aliases: ['front left light'] },
      { entityId: 'light.living_room_front_right_light', name: 'Front Right', aliases: ['front right light'] },
      { entityId: 'light.living_room_back_left_light', name: 'Back Left', aliases: ['back left light', 'rear left'] },
      { entityId: 'light.living_room_back_right_light', name: 'Back Right', aliases: ['back right light', 'rear right'] },
    ],
  },
  {
    id: 'kitchen', name: 'Kitchen', aliases: ['kitchen'], groupEntityId: 'light.kitchen', color: 'temperature',
    pblEntityId: 'switch.kitchen_presence_kitchen_lights_presence_allowed',
    lights: [
      { entityId: 'light.kitchen_table_light', name: 'Table Light' },
      { entityId: 'light.kitchen_door_light', name: 'Door Light' },
      { entityId: 'light.kitchen_counter_light', name: 'Counter Light' },
      { entityId: 'light.kitchen_sink_light', name: 'Sink Light' },
    ],
  },
  {
    id: 'master-bedroom', name: 'Master Bedroom', aliases: ['master bedroom', 'main bedroom'], groupEntityId: 'light.master_bedroom', color: 'temperature',
    pblEntityId: 'switch.master_bedroom_presence_master_bedroom_presence_allowed',
    lights: [
      { entityId: 'light.master_bedroom_window_light', name: 'Window Light' },
      { entityId: 'light.master_bedroom_bathroom_light', name: 'Bathroom Light' },
      { entityId: 'light.master_bedroom_door_light', name: 'Door Light' },
      { entityId: 'light.stephen_nightstand_light', name: 'Stephen Nightstand Light', aliases: ["Stephen's nightstand"] },
      { entityId: 'light.steph_nightstand_light', name: 'Steph Nightstand Light', aliases: ["Steph's nightstand"] },
      { entityId: 'light.master_bedroom_closet_light', name: 'Closet Light' },
    ],
  },
  {
    id: 'guest-room', name: 'Guest Room', aliases: ['guest room', 'guest bedroom'], groupEntityId: 'light.guest_room', color: 'temperature',
    pblEntityId: 'switch.guest_room_presence_guest_room_presence_allowed',
    lights: [
      { entityId: 'light.guest_room_tv_light', name: 'TV Light' },
      { entityId: 'light.guest_room_bed_light', name: 'Bed Light' },
    ],
  },
  {
    id: 'hallway', name: 'Hallway', aliases: ['hallway', 'upstairs hallway'], groupEntityId: 'light.hallway_lights', color: 'temperature',
    pblEntityId: 'switch.hallway_presence_hallway_lights_presence_allowed',
    lights: [
      { entityId: 'light.hallway_entry_light', name: 'Entry Light' },
      { entityId: 'light.hallway_gym_light', name: 'Gym Light' },
      { entityId: 'light.hallway_guest_room_light', name: 'Guest Room Light' },
      { entityId: 'light.hallway_office_light', name: 'Office Light' },
    ],
  },
  { id: 'dining-room', name: 'Dining Room', aliases: ['dining room'], groupEntityId: 'light.dining_room_dimmer_switch', color: 'none', pblEntityId: 'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed', lights: [{ entityId: 'light.dining_room_dimmer_switch', name: 'Dining Room Light' }] },
  { id: 'downstairs-hallway', name: 'Downstairs Hallway', aliases: ['downstairs hallway', 'lower hallway'], groupEntityId: 'light.downstairs_hallway_light', color: 'temperature', pblEntityId: 'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed', lights: [{ entityId: 'light.downstairs_hallway_light', name: 'Downstairs Hallway Light' }] },
  { id: 'guest-bathroom', name: 'Guest Bathroom', aliases: ['guest bathroom'], groupEntityId: 'light.guest_bathroom_dimmer_switch', color: 'none', pblEntityId: 'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed', lights: [{ entityId: 'light.guest_bathroom_dimmer_switch', name: 'Guest Bathroom Light' }] },
  { id: 'master-bathroom', name: 'Master Bathroom', aliases: ['master bathroom', 'main bathroom'], groupEntityId: 'light.master_bathroom_dimmer_switch', color: 'none', pblEntityId: 'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed', lights: [{ entityId: 'light.master_bathroom_dimmer_switch', name: 'Master Bathroom Light' }] },
  { id: 'gym', name: 'Gym', aliases: ['gym'], groupEntityId: 'light.gym_light', color: 'temperature', pblEntityId: 'switch.gym_presence_gym_light_presence_allowed', lights: [{ entityId: 'light.gym_light', name: 'Gym Light' }] },
  { id: 'office', name: 'Office', aliases: ['office'], groupEntityId: 'light.office_light', color: 'temperature', pblEntityId: 'switch.office_presence_office_light_presence_allowed', lights: [{ entityId: 'light.office_light', name: 'Office Light' }] },
  { id: 'garage', name: 'Garage', aliases: ['garage', 'driveway'], groupEntityId: 'light.garage_camera_floodlight', color: 'temperature', lights: [{ entityId: 'light.garage_camera_floodlight', name: 'Floodlight', aliases: ['driveway light', 'garage floodlight'] }] },
  { id: 'entryway', name: 'Entryway', aliases: ['entryway', 'upper entryway'], groupEntityId: 'switch.upper_entryway_light_switch_top', color: 'none', dimmable: false, pblEntityId: 'switch.entryway_presence_top_presence_allowed', lights: [{ entityId: 'switch.upper_entryway_light_switch_top', name: 'Entryway Light' }] },
  {
    id: 'front-yard', name: 'Front Yard', aliases: ['front yard', 'front porch', 'front door', 'exterior'], groupEntityId: 'light.front_yard_lights', color: 'rgb',
    lights: [
      ...Array.from({ length: 6 }, (_, index) => ({ entityId: `light.front_door_bollard_${index + 1}`, name: `Bollard ${index + 1}` })),
      { entityId: 'light.front_door_exterior_left_light', name: 'Exterior Left Light' },
      { entityId: 'light.front_door_exterior_light_v2', name: 'Exterior Right Light', aliases: ['exterior light', 'exterior right'] },
    ],
  },
  {
    id: 'back-deck', name: 'Back Deck', aliases: ['back deck', 'upper deck', 'deck'], groupEntityId: 'light.back_deck', color: 'rgb',
    pblEntityId: 'switch.upper_deck_presence_back_deck_lights_presence_allowed',
    lights: [
      { entityId: 'light.grill_light', name: 'Grill Light' },
      { entityId: 'light.couch_light', name: 'Couch Light', aliases: ['couches light'] },
    ],
  },
  {
    id: 'music-room', name: 'Music Room', aliases: ['music room'], groupEntityId: 'light.music_room', color: 'rgb',
    pblEntityId: 'switch.music_room_presence_music_room_lights_presence_allowed',
    lights: [
      { entityId: 'light.hue_color_downlight_1_3', name: 'Fireplace Light' },
      { entityId: 'light.hue_color_downlight_4', name: 'Window Light' },
      { entityId: 'light.hue_color_downlight_1', name: 'Entry Light' },
      { entityId: 'light.hue_color_downlight_3', name: 'Drums Light' },
      { entityId: 'light.hue_color_downlight_5', name: 'Bathroom Light' },
      { entityId: 'light.hue_color_downlight_6', name: 'Couch Light' },
      { entityId: 'light.hue_color_downlight_8', name: 'Server Light' },
      { entityId: 'light.hue_color_downlight_7', name: 'TV Light' },
      { entityId: 'light.hue_play_2', name: 'TV Left Light' },
      { entityId: 'light.hue_play_1', name: 'TV Right Light' },
    ],
  },
  {
    id: 'theater-room', name: 'Theater Room', aliases: ['theater room', 'theater', 'cinema'], groupEntityId: 'light.theater_room', color: 'temperature',
    pblEntityId: 'switch.theater_room_presence_theater_room_presence_allowed',
    lights: [
      { entityId: 'light.theater_room_front_screen_light', name: 'Front Screen Light' },
      { entityId: 'light.theater_room_front_right_light', name: 'Front Right Light' },
      { entityId: 'light.theater_room_front_rear_light', name: 'Front Back Light' },
      { entityId: 'light.theater_room_rear_front_light', name: 'Rear Front Light' },
      { entityId: 'light.theater_room_rear_back_light', name: 'Rear Back Light' },
      { entityId: 'light.theater_room_rear_right_light', name: 'Rear Right Light' },
    ],
  },
]

for (const room of HOUSE_LIGHT_ROOMS) {
  Object.freeze(room.aliases)
  for (const light of room.lights) {
    if (light.aliases) Object.freeze(light.aliases)
    Object.freeze(light)
  }
  Object.freeze(room.lights)
  Object.freeze(room)
}
Object.freeze(HOUSE_LIGHT_ROOMS)

export const RGB_COLORS: Record<string, [number, number, number]> = {
  red: [255, 0, 0], orange: [255, 128, 0], yellow: [255, 220, 0], green: [0, 180, 70],
  blue: [0, 90, 255], purple: [145, 65, 255], pink: [255, 70, 170], cyan: [0, 220, 220],
  magenta: [255, 0, 255], white: [255, 255, 255], amber: [255, 160, 35],
}

export const WHITE_COLORS: Record<string, number> = {
  'warm white': 2200,
  warm: 2200,
  'soft white': 2700,
  white: 3000,
  daylight: 5000,
  'cool white': 6000,
  cool: 6000,
}

for (const color of Object.values(RGB_COLORS)) Object.freeze(color)
Object.freeze(RGB_COLORS)
Object.freeze(WHITE_COLORS)

export function findLightRoom(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, ' ')
  if (!normalized) return null
  return HOUSE_LIGHT_ROOMS.find((room) => room.id.replace(/-/g, ' ') === normalized
    || room.name.toLowerCase() === normalized
    || room.aliases.some((alias) => alias === normalized)) ?? null
}
