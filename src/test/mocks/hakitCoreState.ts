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
}

export function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): MockEntity {
  return { attributes, entity_id: entityId, state }
}

export const mockCallServiceCalls: Record<string, unknown>[] = []

export const mockEntities: Record<string, MockEntity> = {
  'alarm_control_panel.aqara_hub_m3_0056_security_system_2': entity('alarm_control_panel.aqara_hub_m3_0056_security_system_2', 'armed_home'),
  'binary_sensor.contact_sensors': entity('binary_sensor.contact_sensors', 'off'),
  'binary_sensor.occupancy_sensors': entity('binary_sensor.occupancy_sensors', 'on'),
  'climate.thermostat_contact_sensors_global_virtual_thermostat': entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.thermostat_hub_w200': entity('climate.thermostat_hub_w200', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'input_text.all_aqi_range': entity('input_text.all_aqi_range', '1'),
  'input_text.all_climate_range': entity('input_text.all_climate_range', '68°F - 72°F'),
  'input_text.all_pm25_range': entity('input_text.all_pm25_range', '0μg/m³ - 1μg/m³'),
  'input_text.living_room_climate_range': entity('input_text.living_room_climate_range', '69°F - 72°F'),
  'input_text.stephen_s_pc_power_state': entity('input_text.stephen_s_pc_power_state', 'Off'),
  'input_text.steph_s_pc_power_state': entity('input_text.steph_s_pc_power_state', 'Off'),
  'input_text.theater_pc_power_state': entity('input_text.theater_pc_power_state', 'Off'),
  'input_boolean.stephen_s_pc_power': entity('input_boolean.stephen_s_pc_power', 'off'),
  'input_boolean.steph_s_pc_power': entity('input_boolean.steph_s_pc_power', 'off'),
  'input_boolean.theater_pc_power': entity('input_boolean.theater_pc_power', 'off'),
  'light.lights': entity('light.lights', 'on'),
  'light.living_room': entity('light.living_room', 'on'),
  'light.living_room_front_left_light': entity('light.living_room_front_left_light', 'on'),
  'light.living_room_front_right_light': entity('light.living_room_front_right_light', 'off'),
  'light.living_room_back_left_light': entity('light.living_room_back_left_light', 'off'),
  'light.living_room_back_right_light': entity('light.living_room_back_right_light', 'on'),
  'sensor.living_room_back_wall_presence_sensor_temperature': entity('sensor.living_room_back_wall_presence_sensor_temperature', '70.1', { unit_of_measurement: '°F' }),
  'sensor.living_room_bar_presence_sensor_temperature': entity('sensor.living_room_bar_presence_sensor_temperature', '70.4', { unit_of_measurement: '°F' }),
  'sensor.living_room_kitchen_wall_presence_sensor_temperature': entity('sensor.living_room_kitchen_wall_presence_sensor_temperature', '69.8', { unit_of_measurement: '°F' }),
  'sensor.living_room_fireplace_presence_sensor_temperature': entity('sensor.living_room_fireplace_presence_sensor_temperature', '71.2', { unit_of_measurement: '°F' }),
  'cover.living_room_vents': entity('cover.living_room_vents', 'open'),
  'cover.kitchen_vent_vent': entity('cover.kitchen_vent_vent', 'open'),
  'binary_sensor.living_room_back_wall_presence_sensor_presence': entity('binary_sensor.living_room_back_wall_presence_sensor_presence', 'on'),
  'binary_sensor.living_room_bar_presence_sensor_presence': entity('binary_sensor.living_room_bar_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_kitchen_wall_presence_sensor_presence': entity('binary_sensor.living_room_kitchen_wall_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_fireplace_presence_sensor_presence': entity('binary_sensor.living_room_fireplace_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_occupancy_sensors': entity('binary_sensor.living_room_occupancy_sensors', 'on'),
  'binary_sensor.living_room_window_contact_sensor_contact': entity('binary_sensor.living_room_window_contact_sensor_contact', 'off'),
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
  'sensor.living_room_air_purifier_pm2_5': entity('sensor.living_room_air_purifier_pm2_5', '2'),
  'sensor.air_purifier_air_quality_index': entity('sensor.air_purifier_air_quality_index', '1'),
  'sensor.air_purifier_pm2_5': entity('sensor.air_purifier_pm2_5', '2'),
  'sensor.guest_room_air_purifier_air_quality_index': entity('sensor.guest_room_air_purifier_air_quality_index', '1'),
  'sensor.guest_room_air_purifier_pm2_5': entity('sensor.guest_room_air_purifier_pm2_5', '2'),
  'sensor.master_bedroom_air_purifier_air_quality_index': entity('sensor.master_bedroom_air_purifier_air_quality_index', '1'),
  'sensor.master_bedroom_air_purifier_pm2_5': entity('sensor.master_bedroom_air_purifier_pm2_5', '2'),
  'sensor.office_air_purifier_air_quality_index': entity('sensor.office_air_purifier_air_quality_index', '1'),
  'sensor.office_air_purifier_pm2_5': entity('sensor.office_air_purifier_pm2_5', '2'),
  'sensor.theater_room_air_purifier_air_quality_index': entity('sensor.theater_room_air_purifier_air_quality_index', '1'),
  'sensor.theater_room_air_purifier_pm2_5': entity('sensor.theater_room_air_purifier_pm2_5', '2'),
  'switch.d8478fa2ad0a_keep_warm_enabled': entity('switch.d8478fa2ad0a_keep_warm_enabled', 'off'),
  'switch.d8478fa2ad0a_super_smoke_enabled': entity('switch.d8478fa2ad0a_super_smoke_enabled', 'off'),
  'todo.shopping_list': entity('todo.shopping_list', '2'),
  'todo.groceries': entity('todo.groceries', '1'),
  'todo.stephen_s_past_due_with_unassigned': entity('todo.stephen_s_past_due_with_unassigned', '1'),
  'vacuum.valetudo_elatedusedram': entity('vacuum.valetudo_elatedusedram', 'unavailable'),
  'sensor.valetudo_elatedusedram_battery_level': entity('sensor.valetudo_elatedusedram_battery_level', 'unknown'),
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
  'sensor.valetudo_politefatherlykingfisher_battery_level': entity('sensor.valetudo_politefatherlykingfisher_battery_level', '99'),
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
  'sensor.valetudo_exaltedsneakydeer_battery_level': entity('sensor.valetudo_exaltedsneakydeer_battery_level', '99'),
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
  'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock': entity('button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock', 'unknown'),
  'camera.valetudo_exaltedsneakydeer_map_data': entity('camera.valetudo_exaltedsneakydeer_map_data', 'idle'),
  'weather.pirate_weather': entity('weather.pirate_weather', 'partlycloudy', { temperature: 45, temperature_unit: '°F' }),
}

function todoItems(entityId: unknown) {
  return {
    items: [
      { uid: `${String(entityId)}-1`, summary: 'Mock task one', status: 'needs_action' },
      { uid: `${String(entityId)}-2`, summary: 'Mock task two', status: 'needs_action' },
    ],
  }
}

export function resetMockHass() {
  mockCallServiceCalls.length = 0
}

export const mockState: MockHassState = {
  config: {},
  connection: {
    sendMessagePromise: async <T,>(message: Record<string, unknown>) => {
      if (message.type === 'todo/item/list') return todoItems(message.entity_id) as T
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
}
