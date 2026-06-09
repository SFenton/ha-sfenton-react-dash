export interface MockEntity {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

export interface MockHassState {
  config: Record<string, unknown>
  connection: {
    sendMessagePromise: <T>(message: Record<string, unknown>) => Promise<T>
  }
  entities: Record<string, MockEntity>
  hassUrl: string
  helpers: {
    callService: (params: Record<string, unknown>) => void
    joinHassUrl: (path: string) => string
  }
  services: Record<string, unknown>
  user: { id: string; name: string } | null
}

export function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): MockEntity {
  return { attributes, entity_id: entityId, state }
}

export const mockCallServiceCalls: Record<string, unknown>[] = []
export const mockTodoUpdateMessages: Record<string, unknown>[] = []
export const mockTodoItemsByEntity: Record<string, MockTodoItem[] | undefined> = {}

interface MockTodoItem {
  description?: string
  due?: string
  status: string
  summary: string
  uid: string
}

const adminPresenceSwitchEntityIds = [
  'switch.living_room_presence_living_room_lights_presence_allowed',
  'switch.kitchen_presence_kitchen_lights_presence_allowed',
  'switch.hallway_presence_hallway_lights_presence_allowed',
  'switch.gym_presence_gym_light_presence_allowed',
  'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed',
  'switch.guest_room_presence_guest_room_presence_allowed',
  'switch.office_presence_office_light_presence_allowed',
  'switch.master_bedroom_presence_master_bedroom_presence_allowed',
  'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed',
  'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed',
  'switch.theater_room_presence_theater_room_presence_allowed',
  'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed',
  'switch.music_room_presence_music_room_lights_presence_allowed',
  'switch.upper_deck_presence_back_deck_lights_presence_allowed',
] as const

const adminAutoReEnableSwitchEntityIds = [
  'switch.living_room_auto_re_enable_presence_lighting',
  'switch.kitchen_auto_re_enable_presence_lighting',
  'switch.hallway_auto_re_enable_presence_lighting',
  'switch.gym_auto_re_enable_presence_lighting',
  'switch.guest_bathroom_auto_re_enable_presence_lighting',
  'switch.guest_room_auto_re_enable_presence_lighting',
  'switch.office_auto_re_enable_presence_lighting',
  'switch.master_bedroom_auto_re_enable_presence_lighting',
  'switch.master_bathroom_auto_re_enable_presence_lighting',
  'switch.dining_room_auto_re_enable_presence_lighting',
  'switch.theater_room_auto_re_enable_presence_lighting',
  'switch.downstairs_hallway_auto_re_enable_presence_lighting',
  'switch.music_room_auto_re_enable_presence_lighting',
  'switch.upper_deck_auto_re_enable_presence_lighting',
] as const

function mockSwitchEntities(entityIds: readonly string[], attributes: Record<string, unknown> = {}) {
  return Object.fromEntries(entityIds.map((entityId) => [entityId, entity(entityId, 'on', attributes)]))
}

const thermostatRoomMockData = [
  { key: 'living_room', title: 'Living Room', temperature: '70.2', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_living_room_virtual_thermostat', vents: [['cover.living_room_vent_1_vent', 'open'], ['cover.living_room_vent_2_vent', 'open']] },
  { key: 'office', title: 'Office', temperature: '71.6', occupancy: 'active', track: 'off', force: 'off', climate: 'climate.thermostat_contact_sensors_office_virtual_thermostat', vents: [['cover.office_vent_vent', 'closed']] },
  { key: 'master_bedroom', title: 'Master Bedroom', temperature: '71.0', occupancy: 'active', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat', vents: [['cover.master_bedroom_vent_2_vent', 'closed'], ['cover.master_bedroom_vent_3_vent', 'closed']] },
  { key: 'master_bathroom', title: 'Master Bathroom', temperature: '74.9', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat', vents: [['cover.master_bathroom_vent_vent', 'closed']] },
  { key: 'kitchen', title: 'Kitchen', temperature: '71.1', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_kitchen_virtual_thermostat', vents: [['cover.kitchen_vent_vent', 'closed']] },
  { key: 'guest_room', title: 'Guest Room', temperature: '70.9', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_guest_room_virtual_thermostat', vents: [['cover.guest_room_vent_vent', 'closed']] },
  { key: 'dining_room', title: 'Dining Room', temperature: '69.7', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_dining_room_virtual_thermostat', vents: [['cover.dining_room_vent_vent', 'open']] },
  { key: 'gym', title: 'Gym', temperature: '70.6', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_gym_virtual_thermostat', vents: [['cover.gym_vent_vent', 'closed']] },
  { key: 'guest_bathroom', title: 'Guest Bathroom', temperature: '76.9', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat', vents: [['cover.guest_bathroom_vent_vent', 'closed']] },
  { key: 'music_room', title: 'Music Room', temperature: '70.6', occupancy: 'inactive', track: 'off', force: 'on', climate: 'climate.thermostat_contact_sensors_music_room_virtual_thermostat', vents: [['cover.music_room_vent_vent', 'closed']] },
  { key: 'theater_room', title: 'Theater Room', temperature: '70.5', occupancy: 'inactive', track: 'off', force: 'on', climate: 'climate.thermostat_contact_sensors_theater_room_virtual_thermostat', vents: [['cover.theater_room_vent_1_vent', 'open'], ['cover.theater_room_vent_2_vent', 'open']] },
] as const

function thermostatMockEntities() {
  const entries: [string, MockEntity][] = [
    [
      'climate.thermostat_contact_sensors_global_virtual_thermostat',
      entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'off', { current_temperature: 71, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' }),
    ],
    ['climate.thermostat_hub_w200', entity('climate.thermostat_hub_w200', 'off', { current_temperature: 73.4, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' })],
    ['sensor.thermostat_hub_w200_temperature', entity('sensor.thermostat_hub_w200_temperature', '73.4', { unit_of_measurement: '°F' })],
    ['sensor.thermostat_hub_w200_humidity', entity('sensor.thermostat_hub_w200_humidity', '38.0', { unit_of_measurement: '%' })],
    ['switch.thermostat_contact_sensors_eco_mode', entity('switch.thermostat_contact_sensors_eco_mode', 'on')],
    ['switch.thermostat_contact_sensors_only_track_selected_rooms', entity('switch.thermostat_contact_sensors_only_track_selected_rooms', 'on')],
    ['input_boolean.enable_disable_thermostat_contact_sensors_integration', entity('input_boolean.enable_disable_thermostat_contact_sensors_integration', 'on')],
    ['binary_sensor.thermostat_contact_sensors_away_mode_active', entity('binary_sensor.thermostat_contact_sensors_away_mode_active', 'off')],
    ['select.thermostat_contact_sensors_eco_mode_critical_tracking', entity('select.thermostat_contact_sensors_eco_mode_critical_tracking', 'Track Select Critical', { options: ['Track Select Critical', 'Track Select Active', 'Ignore Critical'] })],
    ['select.thermostat_contact_sensors_eco_behavior_when_away', entity('select.thermostat_contact_sensors_eco_behavior_when_away', 'Keep Eco Active', { options: ['Keep Eco Active', 'Disable Eco Mode', 'Pause Integration'] })],
  ]

  for (const room of thermostatRoomMockData) {
    entries.push([`sensor.thermostat_contact_sensors_${room.key}_temperature`, entity(`sensor.thermostat_contact_sensors_${room.key}_temperature`, room.temperature, { unit_of_measurement: '°F' })])
    entries.push([`sensor.thermostat_contact_sensors_${room.key}_occupancy`, entity(`sensor.thermostat_contact_sensors_${room.key}_occupancy`, room.occupancy, { friendly_name: `${room.title} Occupancy` })])
    entries.push([`switch.thermostat_contact_sensors_track_${room.key}`, entity(`switch.thermostat_contact_sensors_track_${room.key}`, room.track)])
    entries.push([`switch.thermostat_contact_sensors_${room.key}_force_track_when_critical`, entity(`switch.thermostat_contact_sensors_${room.key}_force_track_when_critical`, room.force)])
    entries.push([room.climate, entity(room.climate, 'off', { current_temperature: Number(room.temperature), hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' })])
    for (const [ventEntityId, ventState] of room.vents) {
      if (ventEntityId === 'cover.guest_room_vent_vent' || ventEntityId === 'cover.kitchen_vent_vent') continue
      entries.push([ventEntityId, entity(ventEntityId, ventState)])
    }
  }

  return Object.fromEntries(entries)
}

export const mockEntities: Record<string, MockEntity> = {
  'alarm_control_panel.aqara_hub_m3_0056_security_system_2': entity('alarm_control_panel.aqara_hub_m3_0056_security_system_2', 'armed_home'),
  'binary_sensor.all_contact_sensors': entity('binary_sensor.all_contact_sensors', 'off'),
  'binary_sensor.contact_sensors': entity('binary_sensor.contact_sensors', 'off'),
  'binary_sensor.occupancy_sensors': entity('binary_sensor.occupancy_sensors', 'on'),
  'button.theater_pc_theaterroom_pc_shutdown': entity('button.theater_pc_theaterroom_pc_shutdown', 'unavailable'),
  'camera.doorbell_camera': entity('camera.doorbell_camera', 'idle'),
  'camera.garage_camera': entity('camera.garage_camera', 'recording'),
  'camera.lower_deck_camera': entity('camera.lower_deck_camera', 'recording'),
  'camera.upper_deck_camera_2': entity('camera.upper_deck_camera_2', 'recording'),
  'climate.thermostat_contact_sensors_global_virtual_thermostat': entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.thermostat_hub_w200': entity('climate.thermostat_hub_w200', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.stephen_s_eight_sleep_side_climate': entity('climate.stephen_s_eight_sleep_side_climate', 'heat_cool', { current_temperature: 86, temperature: 86, hvac_action: 'heating' }),
  'climate.steph_s_eight_sleep_side_climate': entity('climate.steph_s_eight_sleep_side_climate', 'off', { current_temperature: 72, temperature: 79, hvac_action: 'off' }),
  'sensor.stephen_s_eight_sleep_side_asleep_level': entity('sensor.stephen_s_eight_sleep_side_asleep_level', '2', { raw_value: 17, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_bedtime_level': entity('sensor.stephen_s_eight_sleep_side_bedtime_level', '-1', { raw_value: -13, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_dawn_level': entity('sensor.stephen_s_eight_sleep_side_dawn_level', '2', { raw_value: 22, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_now_level': entity('sensor.stephen_s_eight_sleep_side_now_level', '0', { raw_value: 0, api_field: 'overrideLevels.bedtime', source: 'overrideLevels', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_asleep_level': entity('sensor.steph_s_eight_sleep_side_asleep_level', '1', { raw_value: 10, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_bedtime_level': entity('sensor.steph_s_eight_sleep_side_bedtime_level', '-5', { raw_value: -50, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_dawn_level': entity('sensor.steph_s_eight_sleep_side_dawn_level', '2', { raw_value: 20, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_now_level': entity('sensor.steph_s_eight_sleep_side_now_level', '3', { raw_value: 33, api_field: 'overrideLevels.bedtime', source: 'target_heating_level', unit_of_measurement: '°' }),
  'input_boolean.eight_sleep_stephen_hot_flash_active': entity('input_boolean.eight_sleep_stephen_hot_flash_active', 'off'),
  'input_boolean.eight_sleep_steph_hot_flash_active': entity('input_boolean.eight_sleep_steph_hot_flash_active', 'on'),
  'input_button.eight_sleep_stephen_cancel_hot_flash': entity('input_button.eight_sleep_stephen_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_stephen_hot_flash': entity('input_button.eight_sleep_stephen_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_button.eight_sleep_steph_cancel_hot_flash': entity('input_button.eight_sleep_steph_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_steph_hot_flash': entity('input_button.eight_sleep_steph_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_number.eight_sleep_stephen_asleep_level': entity('input_number.eight_sleep_stephen_asleep_level', '1'),
  'input_number.eight_sleep_stephen_bedtime_level': entity('input_number.eight_sleep_stephen_bedtime_level', '-5'),
  'input_number.eight_sleep_stephen_dawn_level': entity('input_number.eight_sleep_stephen_dawn_level', '2'),
  'input_number.eight_sleep_steph_asleep_level': entity('input_number.eight_sleep_steph_asleep_level', '1'),
  'input_number.eight_sleep_steph_bedtime_level': entity('input_number.eight_sleep_steph_bedtime_level', '-5'),
  'input_number.eight_sleep_steph_dawn_level': entity('input_number.eight_sleep_steph_dawn_level', '2'),
  'timer.eight_sleep_stephen_hot_flash': entity('timer.eight_sleep_stephen_hot_flash', 'idle'),
  'timer.eight_sleep_steph_hot_flash': entity('timer.eight_sleep_steph_hot_flash', 'active', { remaining: '0:12:34' }),
  'input_text.all_aqi_color': entity('input_text.all_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.all_aqi_range': entity('input_text.all_aqi_range', '1'),
  'input_text.all_climate_range': entity('input_text.all_climate_range', '68°F - 72°F'),
  'input_text.all_pm25_range': entity('input_text.all_pm25_range', '0μg/m³ - 1μg/m³'),
  'input_text.guest_room_aqi_color': entity('input_text.guest_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.guest_room_climate_color': entity('input_text.guest_room_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.guest_room_climate_range': entity('input_text.guest_room_climate_range', '69°F - 71°F'),
  'input_text.guest_room_closet_climate_color': entity('input_text.guest_room_closet_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.guest_room_presence_climate_color': entity('input_text.guest_room_presence_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.living_room_aqi_color': entity('input_text.living_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.living_room_climate_range': entity('input_text.living_room_climate_range', '69°F - 72°F'),
  'input_text.master_bedroom_aqi_color': entity('input_text.master_bedroom_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.music_room_aqi_color': entity('input_text.music_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.office_aqi_color': entity('input_text.office_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.stephen_s_pc_power_state': entity('input_text.stephen_s_pc_power_state', 'Off'),
  'input_text.steph_s_pc_power_state': entity('input_text.steph_s_pc_power_state', 'Off'),
  'input_text.theater_room_aqi_color': entity('input_text.theater_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.theater_pc_power_state': entity('input_text.theater_pc_power_state', 'Off'),
  'input_boolean.stephen_s_pc_power': entity('input_boolean.stephen_s_pc_power', 'off'),
  'input_boolean.steph_s_pc_power': entity('input_boolean.steph_s_pc_power', 'off'),
  'input_boolean.theater_pc_power': entity('input_boolean.theater_pc_power', 'off'),
  'input_boolean.guests_staying_in_guest_room': entity('input_boolean.guests_staying_in_guest_room', 'off'),
  'input_boolean.guests_staying_in_music_room': entity('input_boolean.guests_staying_in_music_room', 'off'),
  'input_boolean.guests_staying_in_theater_room': entity('input_boolean.guests_staying_in_theater_room', 'off'),
  'input_boolean.is_front_door_auto_lock_enabled': entity('input_boolean.is_front_door_auto_lock_enabled', 'on'),
  'input_boolean.show_outdoor_faucets': entity('input_boolean.show_outdoor_faucets', 'off'),
  'input_boolean.show_christmas_lights': entity('input_boolean.show_christmas_lights', 'off'),
  'input_boolean.is_driveway_recording': entity('input_boolean.is_driveway_recording', 'on'),
  'input_boolean.is_front_door_recording': entity('input_boolean.is_front_door_recording', 'off'),
  'input_boolean.is_lower_deck_recording': entity('input_boolean.is_lower_deck_recording', 'on'),
  'input_boolean.is_nintendo_switch_active': entity('input_boolean.is_nintendo_switch_active', 'off'),
  'input_boolean.is_theater_shield_active': entity('input_boolean.is_theater_shield_active', 'off'),
  'input_boolean.is_upper_deck_recording': entity('input_boolean.is_upper_deck_recording', 'on'),
  'light.lights': entity('light.lights', 'on'),
  'light.living_room': entity('light.living_room', 'on'),
  'light.living_room_front_left_light': entity('light.living_room_front_left_light', 'on'),
  'light.living_room_front_right_light': entity('light.living_room_front_right_light', 'off'),
  'light.living_room_back_left_light': entity('light.living_room_back_left_light', 'off'),
  'light.living_room_back_right_light': entity('light.living_room_back_right_light', 'on'),
  'light.guest_room': entity('light.guest_room', 'on'),
  'light.guest_room_bed_light': entity('light.guest_room_bed_light', 'off'),
  'light.guest_room_tv_light': entity('light.guest_room_tv_light', 'on'),
  'media_player.living_room_shield': entity('media_player.living_room_shield', 'off'),
  'media_player.living_room_shield_2': entity('media_player.living_room_shield_2', 'off'),
  'media_player.master_bedroom_apple_tv': entity('media_player.master_bedroom_apple_tv', 'paused', { app_name: 'Apple TV' }),
  'media_player.primary_bedroom': entity('media_player.primary_bedroom', 'playing', { volume_level: 0.34 }),
  'media_player.sonos': entity('media_player.sonos', 'playing', { volume_level: 0.26 }),
  'media_player.sony_projector': entity('media_player.sony_projector', 'off'),
  'media_player.theater': entity('media_player.theater', 'off', { volume_level: 0.42 }),
  'media_player.theater_room_shield': entity('media_player.theater_room_shield', 'off'),
  'remote.living_room_shield': entity('remote.living_room_shield', 'on'),
  'remote.master_bedroom_apple_tv': entity('remote.master_bedroom_apple_tv', 'on'),
  'remote.theater_shield_remote': entity('remote.theater_shield_remote', 'on'),
  'lock.aqara_smart_lock_u400': entity('lock.aqara_smart_lock_u400', 'locked'),
  'lock.fordpass_3fmtk3su5mma09266_doorlock': entity('lock.fordpass_3fmtk3su5mma09266_doorlock', 'locked'),
  'sensor.living_room_back_wall_presence_temperature': entity('sensor.living_room_back_wall_presence_temperature', '70.1', { unit_of_measurement: '°F' }),
  'sensor.living_room_bar_presence_temperature': entity('sensor.living_room_bar_presence_temperature', '70.4', { unit_of_measurement: '°F' }),
  'sensor.living_room_kitchen_wall_presence_temperature': entity('sensor.living_room_kitchen_wall_presence_temperature', '69.8', { unit_of_measurement: '°F' }),
  'sensor.living_room_fireplace_presence_temperature': entity('sensor.living_room_fireplace_presence_temperature', '71.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_closet_facing_presence_temperature': entity('sensor.guest_room_closet_facing_presence_temperature', '70.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_closet_facing_presence_sensor_temperature': entity('sensor.guest_room_closet_facing_presence_sensor_temperature', '70.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_presence_temperature': entity('sensor.guest_room_presence_temperature', '69.5', { unit_of_measurement: '°F' }),
  'sensor.guest_room_presence_sensor_temperature': entity('sensor.guest_room_presence_sensor_temperature', '69.5', { unit_of_measurement: '°F' }),
  'cover.guest_room_vent_vent': entity('cover.guest_room_vent_vent', 'open'),
  'cover.living_room_vents': entity('cover.living_room_vents', 'open'),
  'cover.kitchen_vent_vent': entity('cover.kitchen_vent_vent', 'open'),
  'binary_sensor.guest_room_closet_facing_presence_occupancy': entity('binary_sensor.guest_room_closet_facing_presence_occupancy', 'off'),
  'binary_sensor.guest_room_closet_facing_presence_sensor_presence': entity('binary_sensor.guest_room_closet_facing_presence_sensor_presence', 'off'),
  'binary_sensor.guest_room_occupancy_sensors': entity('binary_sensor.guest_room_occupancy_sensors', 'on'),
  'binary_sensor.guest_room_presence_occupancy': entity('binary_sensor.guest_room_presence_occupancy', 'on'),
  'binary_sensor.guest_room_presence_sensor_presence': entity('binary_sensor.guest_room_presence_sensor_presence', 'on'),
  'binary_sensor.living_room_back_wall_presence_occupancy': entity('binary_sensor.living_room_back_wall_presence_occupancy', 'on'),
  'binary_sensor.living_room_bar_presence_occupancy': entity('binary_sensor.living_room_bar_presence_occupancy', 'off'),
  'binary_sensor.living_room_kitchen_wall_presence_occupancy': entity('binary_sensor.living_room_kitchen_wall_presence_occupancy', 'off'),
  'binary_sensor.living_room_fireplace_presence_occupancy': entity('binary_sensor.living_room_fireplace_presence_occupancy', 'off'),
  'binary_sensor.living_room_occupancy_sensors': entity('binary_sensor.living_room_occupancy_sensors', 'on'),
  'binary_sensor.dining_room_door_contact_sensor_contact': entity('binary_sensor.dining_room_door_contact_sensor_contact', 'off'),
  'binary_sensor.front_door_contact_sensor_contact': entity('binary_sensor.front_door_contact_sensor_contact', 'off'),
  'binary_sensor.garage_door_contact_sensor_contact': entity('binary_sensor.garage_door_contact_sensor_contact', 'off'),
  'binary_sensor.guest_room_window_contact_sensor_contact': entity('binary_sensor.guest_room_window_contact_sensor_contact', 'off'),
  'binary_sensor.gym_window_contact_sensor_contact': entity('binary_sensor.gym_window_contact_sensor_contact', 'off'),
  'binary_sensor.kitchen_door_contact_sensor_contact': entity('binary_sensor.kitchen_door_contact_sensor_contact', 'off'),
  'binary_sensor.living_room_window_contact_sensor_contact': entity('binary_sensor.living_room_window_contact_sensor_contact', 'off'),
  'binary_sensor.master_bedroom_street_window_contact_sensor_contact': entity('binary_sensor.master_bedroom_street_window_contact_sensor_contact', 'off'),
  'binary_sensor.music_room_door_contact_sensor_contact': entity('binary_sensor.music_room_door_contact_sensor_contact', 'off'),
  'binary_sensor.office_pc_window_sensor_contact': entity('binary_sensor.office_pc_window_sensor_contact', 'off'),
  'binary_sensor.office_window_contact_sensor_contact': entity('binary_sensor.office_window_contact_sensor_contact', 'off'),
  'binary_sensor.stephen_s_eight_sleep_side_bed_presence': entity('binary_sensor.stephen_s_eight_sleep_side_bed_presence', 'on'),
  'binary_sensor.steph_s_eight_sleep_side_bed_presence': entity('binary_sensor.steph_s_eight_sleep_side_bed_presence', 'off'),
  'binary_sensor.theater_room_door_contact_sensor_contact': entity('binary_sensor.theater_room_door_contact_sensor_contact', 'off'),
  'cover.left_door': entity('cover.left_door', 'closed'),
  'cover.right_door': entity('cover.right_door', 'closed'),
  'fan.air_purifier_levoit_purifier': entity('fan.air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.guest_room_air_purifier_levoit_purifier': entity('fan.guest_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.living_room_air_purifier_levoit_purifier': entity('fan.living_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.master_bedroom_air_purifier_levoit_purifier': entity('fan.master_bedroom_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.office_air_purifier_levoit_purifier': entity('fan.office_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.theater_room_air_purifier_levoit_purifier': entity('fan.theater_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'humidifier.master_bedroom_humidifier': entity('humidifier.master_bedroom_humidifier', 'on'),
  'select.air_purifier_auto_mode': entity('select.air_purifier_auto_mode', 'Default'),
  'select.air_purifier_fan_mode': entity('select.air_purifier_fan_mode', 'Auto'),
  'select.dishwasher_selected_program': entity('select.dishwasher_selected_program', 'Eco 50'),
  'select.guest_room_air_purifier_auto_mode': entity('select.guest_room_air_purifier_auto_mode', 'Default'),
  'select.guest_room_air_purifier_fan_mode': entity('select.guest_room_air_purifier_fan_mode', 'Auto'),
  'select.living_room_air_purifier_auto_mode': entity('select.living_room_air_purifier_auto_mode', 'Default'),
  'select.living_room_air_purifier_fan_mode': entity('select.living_room_air_purifier_fan_mode', 'Auto'),
  'select.master_bedroom_air_purifier_auto_mode': entity('select.master_bedroom_air_purifier_auto_mode', 'Default'),
  'select.master_bedroom_air_purifier_fan_mode': entity('select.master_bedroom_air_purifier_fan_mode', 'Auto'),
  'select.office_air_purifier_auto_mode': entity('select.office_air_purifier_auto_mode', 'Default'),
  'select.office_air_purifier_fan_mode': entity('select.office_air_purifier_fan_mode', 'Auto'),
  'select.theater_room_air_purifier_auto_mode': entity('select.theater_room_air_purifier_auto_mode', 'Default'),
  'select.theater_room_air_purifier_fan_mode': entity('select.theater_room_air_purifier_fan_mode', 'Auto'),
  'sensor.bear_grills_probe_probe0': entity('sensor.bear_grills_probe_probe0', 'unavailable'),
  'sensor.d8478fa2ad0a_grill_state': entity('sensor.d8478fa2ad0a_grill_state', 'off'),
  'sensor.d8478fa2ad0a_pellet_level': entity('sensor.d8478fa2ad0a_pellet_level', '78'),
  'sensor.dishwasher_door': entity('sensor.dishwasher_door', 'closed'),
  'sensor.dishwasher_operation_state': entity('sensor.dishwasher_operation_state', 'ready'),
  'sensor.dishwasher_program_progress': entity('sensor.dishwasher_program_progress', '0'),
  'sensor.living_room_air_purifier_air_quality_index': entity('sensor.living_room_air_purifier_air_quality_index', '1'),
  'sensor.living_room_air_purifier_pm2_5': entity('sensor.living_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.air_purifier_air_quality_index': entity('sensor.air_purifier_air_quality_index', '1'),
  'sensor.air_purifier_pm2_5': entity('sensor.air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.guest_room_air_purifier_air_quality_index': entity('sensor.guest_room_air_purifier_air_quality_index', '1'),
  'sensor.guest_room_air_purifier_pm2_5': entity('sensor.guest_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.master_bedroom_air_purifier_air_quality_index': entity('sensor.master_bedroom_air_purifier_air_quality_index', '1'),
  'sensor.master_bedroom_air_purifier_pm2_5': entity('sensor.master_bedroom_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.office_air_purifier_air_quality_index': entity('sensor.office_air_purifier_air_quality_index', '1'),
  'sensor.office_air_purifier_pm2_5': entity('sensor.office_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.theater_room_air_purifier_air_quality_index': entity('sensor.theater_room_air_purifier_air_quality_index', '1'),
  'sensor.theater_room_air_purifier_pm2_5': entity('sensor.theater_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'switch.d8478fa2ad0a_keep_warm_enabled': entity('switch.d8478fa2ad0a_keep_warm_enabled', 'off'),
  'switch.d8478fa2ad0a_super_smoke_enabled': entity('switch.d8478fa2ad0a_super_smoke_enabled', 'off'),
  'switch.guest_bathroom_fan_switch_top': entity('switch.guest_bathroom_fan_switch_top', 'off'),
  'switch.guest_bathroom_towel_rack_switch_top': entity('switch.guest_bathroom_towel_rack_switch_top', 'on'),
  'switch.master_bathroom_fan_switch_top': entity('switch.master_bathroom_fan_switch_top', 'off'),
  'switch.master_bathroom_towel_rack_switch_top': entity('switch.master_bathroom_towel_rack_switch_top', 'on'),
  ...mockSwitchEntities(adminPresenceSwitchEntityIds, { automation_paused: false }),
  ...mockSwitchEntities(adminAutoReEnableSwitchEntityIds),
  'todo.shopping_list': entity('todo.shopping_list', '2'),
  'todo.groceries': entity('todo.groceries', '1'),
  'todo.stephen_s_tasks': entity('todo.stephen_s_tasks', '0'),
  'todo.steph_s_tasks': entity('todo.steph_s_tasks', '0'),
  'todo.home_improvement_s_tasks': entity('todo.home_improvement_s_tasks', '3'),
  'todo.unassigned_no_due_date': entity('todo.unassigned_no_due_date', '17'),
  'todo.stephen_s_past_due_with_unassigned': entity('todo.stephen_s_past_due_with_unassigned', '1'),
  'todo.stephen_s_evening_with_unassigned': entity('todo.stephen_s_evening_with_unassigned', '1'),
  'todo.stephen_s_afternoon_with_unassigned': entity('todo.stephen_s_afternoon_with_unassigned', '0'),
  'todo.stephen_s_morning_with_unassigned': entity('todo.stephen_s_morning_with_unassigned', '0'),
  'todo.stephen_s_all_day_with_unassigned': entity('todo.stephen_s_all_day_with_unassigned', '0'),
  'todo.stephen_s_no_due_date_with_unassigned': entity('todo.stephen_s_no_due_date_with_unassigned', '1'),
  'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned': entity('todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned', '1'),
  'todo.steph_s_evening_with_unassigned': entity('todo.steph_s_evening_with_unassigned', '1'),
  'todo.steph_s_afternoon_with_unassigned': entity('todo.steph_s_afternoon_with_unassigned', '0'),
  'todo.steph_s_morning_with_unassigned': entity('todo.steph_s_morning_with_unassigned', '0'),
  'todo.steph_s_all_day_with_unassigned': entity('todo.steph_s_all_day_with_unassigned', '0'),
  'todo.steph_s_no_due_date_with_unassigned': entity('todo.steph_s_no_due_date_with_unassigned', '1'),
  'todo.steph_s_upcoming_today_by_time_and_future_with_unassigned': entity('todo.steph_s_upcoming_today_by_time_and_future_with_unassigned', '1'),
  'vacuum.valetudo_elatedusedram': entity('vacuum.valetudo_elatedusedram', 'unavailable'),
  'sensor.valetudo_elatedusedram_battery_level': entity('sensor.valetudo_elatedusedram_battery_level', 'unknown', { unit_of_measurement: '%' }),
  'sensor.valetudo_elatedusedram_status_flag': entity('sensor.valetudo_elatedusedram_status_flag', 'unknown'),
  'sensor.valetudo_elatedusedram_error': entity('sensor.valetudo_elatedusedram_error', 'unavailable'),
  'input_text.music_room_vacuum_error_message': entity('input_text.music_room_vacuum_error_message', ''),
  'input_text.music_room_vacuum_mode': entity('input_text.music_room_vacuum_mode', 'Vacuum'),
  'select.valetudo_elatedusedram_mode': entity('select.valetudo_elatedusedram_mode', 'unavailable', { options: ['vacuum', 'mop', 'vacuum_and_mop'] }),
  'select.valetudo_elatedusedram_fan': entity('select.valetudo_elatedusedram_fan', 'unavailable', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_elatedusedram_water': entity('select.valetudo_elatedusedram_water', 'unavailable', { options: ['low', 'medium', 'high'] }),
  'input_select.music_room_vacuum_cleaning_passes': entity('input_select.music_room_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'camera.valetudo_elatedusedram_map_data': entity('camera.valetudo_elatedusedram_map_data', 'idle'),
  'input_boolean.clean_music_room': entity('input_boolean.clean_music_room', 'off'),
  'input_boolean.clean_downstairs_hallway': entity('input_boolean.clean_downstairs_hallway', 'off'),
  'input_boolean.clean_downstairs_bathroom': entity('input_boolean.clean_downstairs_bathroom', 'off'),
  'button.valetudo_elatedusedram_trigger_auto_empty_dock': entity('button.valetudo_elatedusedram_trigger_auto_empty_dock', 'unknown'),
  'vacuum.valetudo_politefatherlykingfisher': entity('vacuum.valetudo_politefatherlykingfisher', 'docked'),
  'sensor.valetudo_politefatherlykingfisher_battery_level': entity('sensor.valetudo_politefatherlykingfisher_battery_level', '99', { unit_of_measurement: '%' }),
  'sensor.valetudo_politefatherlykingfisher_status_flag': entity('sensor.valetudo_politefatherlykingfisher_status_flag', 'ready'),
  'sensor.valetudo_politefatherlykingfisher_error': entity('sensor.valetudo_politefatherlykingfisher_error', 'No error'),
  'input_text.theater_room_vacuum_error_message': entity('input_text.theater_room_vacuum_error_message', ''),
  'select.valetudo_politefatherlykingfisher_mode': entity('select.valetudo_politefatherlykingfisher_mode', 'vacuum', { options: ['vacuum_and_mop', 'mop', 'vacuum', 'vacuum_then_mop'] }),
  'select.valetudo_politefatherlykingfisher_fan': entity('select.valetudo_politefatherlykingfisher_fan', 'balanced', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_politefatherlykingfisher_water': entity('select.valetudo_politefatherlykingfisher_water', 'medium', { options: ['min', 'low', 'medium', 'high', 'max'] }),
  'input_select.theater_room_vacuum_cleaning_passes': entity('input_select.theater_room_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock': entity('button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock', 'unknown'),
  'camera.valetudo_politefatherlykingfisher_map_data': entity('camera.valetudo_politefatherlykingfisher_map_data', 'idle'),
  'vacuum.valetudo_exaltedsneakydeer': entity('vacuum.valetudo_exaltedsneakydeer', 'docked'),
  'sensor.valetudo_exaltedsneakydeer_battery_level': entity('sensor.valetudo_exaltedsneakydeer_battery_level', '99', { unit_of_measurement: '%' }),
  'sensor.valetudo_exaltedsneakydeer_status_flag': entity('sensor.valetudo_exaltedsneakydeer_status_flag', 'ready'),
  'sensor.valetudo_exaltedsneakydeer_error': entity('sensor.valetudo_exaltedsneakydeer_error', 'No error'),
  'input_text.main_floor_vacuum_error_message': entity('input_text.main_floor_vacuum_error_message', ''),
  'input_text.main_floor_vacuum_mode': entity('input_text.main_floor_vacuum_mode', 'Vacuum'),
  'select.valetudo_exaltedsneakydeer_mode': entity('select.valetudo_exaltedsneakydeer_mode', 'vacuum', { options: ['vacuum', 'mop', 'vacuum_and_mop'] }),
  'select.valetudo_exaltedsneakydeer_fan': entity('select.valetudo_exaltedsneakydeer_fan', 'balanced', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_exaltedsneakydeer_water': entity('select.valetudo_exaltedsneakydeer_water', 'medium', { options: ['low', 'medium', 'high'] }),
  'input_select.main_floor_vacuum_cleaning_passes': entity('input_select.main_floor_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'input_boolean.roborock_living_room_toggle': entity('input_boolean.roborock_living_room_toggle', 'off'),
  'input_boolean.roborock_master_bedroom_toggle': entity('input_boolean.roborock_master_bedroom_toggle', 'off'),
  'input_boolean.roborock_kitchen_toggle': entity('input_boolean.roborock_kitchen_toggle', 'off'),
  'input_boolean.roborock_office_toggle': entity('input_boolean.roborock_office_toggle', 'off'),
  'input_boolean.roborock_hallway_toggle': entity('input_boolean.roborock_hallway_toggle', 'off'),
  'input_boolean.roborock_guest_room_toggle': entity('input_boolean.roborock_guest_room_toggle', 'off'),
  'input_boolean.roborock_master_bathroom_toggle': entity('input_boolean.roborock_master_bathroom_toggle', 'off'),
  'input_boolean.roborock_guest_bathroom_toggle': entity('input_boolean.roborock_guest_bathroom_toggle', 'off'),
  'input_boolean.roborock_gym_toggle': entity('input_boolean.roborock_gym_toggle', 'off'),
  'input_boolean.roborock_master_bedroom_closet_toggle': entity('input_boolean.roborock_master_bedroom_closet_toggle', 'off'),
  'input_boolean.roborock_dining_room_toggle': entity('input_boolean.roborock_dining_room_toggle', 'off'),
  ...thermostatMockEntities(),
  'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock': entity('button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock', 'unknown'),
  'camera.valetudo_exaltedsneakydeer_map_data': entity('camera.valetudo_exaltedsneakydeer_map_data', 'idle'),
  'input_boolean.manually_control_front_yard_lights': entity('input_boolean.manually_control_front_yard_lights', 'off', { icon: 'mdi:lightbulb' }),
  'input_select.front_yard_custom_lights': entity('input_select.front_yard_custom_lights', 'Default', { options: ['Default', 'Custom', 'Seahawks', "Valentine's Day"], icon: 'mdi:lightbulb-group' }),
  'light.front_door_exterior_left_light': entity('light.front_door_exterior_left_light', 'off', { brightness: null }),
  'light.front_door_exterior_light_v2': entity('light.front_door_exterior_light_v2', 'off', { brightness: null }),
  'light.front_door_bollard_1': entity('light.front_door_bollard_1', 'off', { brightness: null }),
  'light.front_door_bollard_2': entity('light.front_door_bollard_2', 'off', { brightness: null }),
  'light.front_door_bollard_3': entity('light.front_door_bollard_3', 'off', { brightness: null }),
  'light.front_door_bollard_4': entity('light.front_door_bollard_4', 'off', { brightness: null }),
  'light.front_door_bollard_5': entity('light.front_door_bollard_5', 'off', { brightness: null }),
  'light.front_door_bollard_6': entity('light.front_door_bollard_6', 'off', { brightness: null }),
  'weather.pirate_weather': entity('weather.pirate_weather', 'partlycloudy', { temperature: 45, temperature_unit: '°F' }),
}

function todoItems(entityId: unknown) {
  const entityKey = String(entityId)
  return {
    items: mockTodoItemsByEntity[entityKey] ?? [
      { uid: `${entityKey}-1`, summary: 'Mock task one', status: 'needs_action', due: '2026-06-04T17:30:00+00:00' },
      { uid: `${entityKey}-2`, summary: 'Mock task two', status: 'needs_action' },
    ],
  }
}

export function resetMockHass() {
  mockCallServiceCalls.length = 0
  mockTodoUpdateMessages.length = 0
  for (const entityId of Object.keys(mockTodoItemsByEntity)) delete mockTodoItemsByEntity[entityId]
  mockState.user = { id: '64089b5683944c39b4f944c8f76830b0', name: 'Stephen' }
}

export const mockState: MockHassState = {
  config: {},
  connection: {
    sendMessagePromise: async <T,>(message: Record<string, unknown>) => {
      if (message.type === 'todo/item/list') return todoItems(message.entity_id) as T
      if (message.type === 'todo/item/update') {
        mockTodoUpdateMessages.push(message)
        return {} as T
      }
      if (message.type === 'calendar/event/list') return { events: [] } as T
      return {} as T
    },
  },
  entities: mockEntities,
  hassUrl: 'http://mock-hass.local',
  helpers: {
    callService: (params) => {
      mockCallServiceCalls.push(params)
    },
    joinHassUrl: (path) => `http://mock-hass.local${path}`,
  },
  services: {},
  user: { id: '64089b5683944c39b4f944c8f76830b0', name: 'Stephen' },
}
