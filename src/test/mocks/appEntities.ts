// Privacy-sanitized synthetic defaults only; no live household state or sensitive attributes are retained.

import type { MockEntity } from './hakitCoreState'

export const mockEntitiesFixture = {
  "automation.attempt_to_turn_power_back_on_in_living_room": {
    "attributes": {},
    "entity_id": "automation.attempt_to_turn_power_back_on_in_living_room",
    "state": "off"
  },
  "binary_sensor.back_deck_doors": {
    "attributes": {},
    "entity_id": "binary_sensor.back_deck_doors",
    "state": "off"
  },
  "binary_sensor.dining_room_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.dining_room_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.downstairs_hallway_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.downstairs_hallway_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.entryway_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.entryway_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.entryway_presence_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.entryway_presence_sensors",
    "state": "off"
  },
  "binary_sensor.front_door_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.front_door_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.garage_doors": {
    "attributes": {},
    "entity_id": "binary_sensor.garage_doors",
    "state": "off"
  },
  "binary_sensor.guest_bathroom_entry_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.guest_bathroom_entry_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.guest_bathroom_occupancy_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.guest_bathroom_occupancy_sensors",
    "state": "off"
  },
  "binary_sensor.guest_bathroom_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.guest_bathroom_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.gym_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.gym_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.hallway_guest_bath_gym_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.hallway_guest_bath_gym_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.hallway_occupancy_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.hallway_occupancy_sensors",
    "state": "off"
  },
  "binary_sensor.hallway_office_bedroom_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.hallway_office_bedroom_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.kitchen_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.kitchen_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.master_bathroom_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.master_bathroom_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.master_bedroom_bathroom_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.master_bedroom_bathroom_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.master_bedroom_bed_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.master_bedroom_bed_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.master_bedroom_occupancy_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.master_bedroom_occupancy_sensors",
    "state": "off"
  },
  "binary_sensor.master_bedroom_window_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.master_bedroom_window_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.music_room_door_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.music_room_door_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.music_room_kitchenette_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.music_room_kitchenette_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.music_room_north_wall_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.music_room_north_wall_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.music_room_occupancy_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.music_room_occupancy_sensors",
    "state": "off"
  },
  "binary_sensor.office_closet_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.office_closet_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.office_occupancy_sensors": {
    "attributes": {},
    "entity_id": "binary_sensor.office_occupancy_sensors",
    "state": "off"
  },
  "binary_sensor.office_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.office_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.office_windows": {
    "attributes": {},
    "entity_id": "binary_sensor.office_windows",
    "state": "off"
  },
  "binary_sensor.sleepypod_eight_pod_left_pump_clog_detected": {
    "attributes": {
      "device_class": "problem"
    },
    "entity_id": "binary_sensor.sleepypod_eight_pod_left_pump_clog_detected",
    "state": "off"
  },
  "binary_sensor.sleepypod_eight_pod_left_pump_stall": {
    "attributes": {
      "device_class": "problem"
    },
    "entity_id": "binary_sensor.sleepypod_eight_pod_left_pump_stall",
    "state": "off"
  },
  "binary_sensor.sleepypod_eight_pod_right_pump_clog_detected": {
    "attributes": {
      "device_class": "problem"
    },
    "entity_id": "binary_sensor.sleepypod_eight_pod_right_pump_clog_detected",
    "state": "off"
  },
  "binary_sensor.sleepypod_eight_pod_right_pump_stall": {
    "attributes": {
      "device_class": "problem"
    },
    "entity_id": "binary_sensor.sleepypod_eight_pod_right_pump_stall",
    "state": "off"
  },
  "binary_sensor.theater_room_presence_sensor_presence": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.theater_room_presence_sensor_presence",
    "state": "off"
  },
  "binary_sensor.upper_deck_camera_person_occupancy": {
    "attributes": {
      "device_class": "occupancy"
    },
    "entity_id": "binary_sensor.upper_deck_camera_person_occupancy",
    "state": "off"
  },
  "counter.room_access_back_deck": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_back_deck",
    "state": "0"
  },
  "counter.room_access_dining_room": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_dining_room",
    "state": "0"
  },
  "counter.room_access_downstairs_hallway": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_downstairs_hallway",
    "state": "0"
  },
  "counter.room_access_entryway": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_entryway",
    "state": "0"
  },
  "counter.room_access_garage": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_garage",
    "state": "0"
  },
  "counter.room_access_guest_bathroom": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_guest_bathroom",
    "state": "0"
  },
  "counter.room_access_guest_room": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_guest_room",
    "state": "0"
  },
  "counter.room_access_gym": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_gym",
    "state": "0"
  },
  "counter.room_access_hallway": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_hallway",
    "state": "0"
  },
  "counter.room_access_kitchen": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_kitchen",
    "state": "0"
  },
  "counter.room_access_living_room": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_living_room",
    "state": "0"
  },
  "counter.room_access_master_bathroom": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_master_bathroom",
    "state": "0"
  },
  "counter.room_access_master_bedroom": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_master_bedroom",
    "state": "0"
  },
  "counter.room_access_music_room": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_music_room",
    "state": "0"
  },
  "counter.room_access_office": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_office",
    "state": "0"
  },
  "counter.room_access_theater_room": {
    "attributes": {
      "editable": true,
      "step": 1
    },
    "entity_id": "counter.room_access_theater_room",
    "state": "0"
  },
  "cover.master_bedroom_vents": {
    "attributes": {
      "current_position": 0,
      "current_tilt_position": 0,
      "supported_features": 176
    },
    "entity_id": "cover.master_bedroom_vents",
    "state": "closed"
  },
  "cover.theater_room_vents": {
    "attributes": {
      "current_position": 0,
      "current_tilt_position": 0,
      "supported_features": 176
    },
    "entity_id": "cover.theater_room_vents",
    "state": "closed"
  },
  "input_boolean.dryer_started_helper": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_boolean.dryer_started_helper",
    "state": "off"
  },
  "input_boolean.washer_started_helper": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_boolean.washer_started_helper",
    "state": "off"
  },
  "input_button.steph_s_pc_off": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.steph_s_pc_off",
    "state": "idle"
  },
  "input_button.steph_s_pc_on": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.steph_s_pc_on",
    "state": "idle"
  },
  "input_button.stephen_s_pc_off": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.stephen_s_pc_off",
    "state": "idle"
  },
  "input_button.stephen_s_pc_on": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.stephen_s_pc_on",
    "state": "idle"
  },
  "input_button.theater_pc_off": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.theater_pc_off",
    "state": "idle"
  },
  "input_button.theater_pc_on": {
    "attributes": {
      "editable": true
    },
    "entity_id": "input_button.theater_pc_on",
    "state": "idle"
  },
  "input_text.dining_room_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.dining_room_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.dining_room_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.dining_room_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.dining_room_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.dining_room_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.downstairs_hallway_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.downstairs_hallway_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.downstairs_hallway_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.downstairs_hallway_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.entryway_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.entryway_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.front_door_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.front_door_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.front_door_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.front_door_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.guest_bathroom_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.guest_bathroom_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.guest_bathroom_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.guest_bathroom_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.guest_bathroom_entry_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.guest_bathroom_entry_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.guest_bathroom_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.guest_bathroom_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.gym_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.gym_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.gym_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.gym_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.gym_door_guest_bath_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.gym_door_guest_bath_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.gym_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.gym_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.hallway_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.hallway_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.hallway_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.hallway_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.kitchen_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.kitchen_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.kitchen_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.kitchen_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.kitchen_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.kitchen_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.living_room_back_wall_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.living_room_back_wall_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.living_room_bar_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.living_room_bar_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.living_room_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.living_room_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.living_room_fireplace_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.living_room_fireplace_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.living_room_kitchen_wall_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.living_room_kitchen_wall_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bathroom_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bathroom_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bathroom_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bathroom_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.master_bathroom_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bathroom_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bedroom_bathroom_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_bathroom_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bedroom_bed_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_bed_climate_color",
    "state": "rgba(220, 213, 17, 1)"
  },
  "input_text.master_bedroom_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bedroom_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.master_bedroom_closet_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_closet_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.master_bedroom_window_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.master_bedroom_window_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.music_room_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.music_room_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.music_room_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.music_room_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.music_room_door_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.music_room_door_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.music_room_kitchenette_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.music_room_kitchenette_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.music_room_north_wall_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.music_room_north_wall_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.office_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.office_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.office_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.office_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.office_closet_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.office_closet_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.office_door_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.office_door_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.office_presence_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.office_presence_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.theater_room_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.theater_room_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "input_text.theater_room_climate_range": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.theater_room_climate_range",
    "state": "68 F - 72 F"
  },
  "input_text.theater_room_presence_sensor_climate_color": {
    "attributes": {
      "editable": true,
      "max": 100,
      "min": 0,
      "mode": "text"
    },
    "entity_id": "input_text.theater_room_presence_sensor_climate_color",
    "state": "rgba(0, 128, 128, 1)"
  },
  "light.back_deck": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.back_deck",
    "state": "off"
  },
  "light.couch_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.couch_light",
    "state": "off"
  },
  "light.dining_room_dimmer_switch": {
    "attributes": {
      "brightness": 0,
      "color_mode": "brightness",
      "supported_color_modes": [
        "brightness"
      ],
      "supported_features": 40
    },
    "entity_id": "light.dining_room_dimmer_switch",
    "state": "off"
  },
  "light.downstairs_hallway_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.downstairs_hallway_light",
    "state": "off"
  },
  "light.front_yard_lights": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.front_yard_lights",
    "state": "off"
  },
  "light.garage_camera_floodlight": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 0
    },
    "entity_id": "light.garage_camera_floodlight",
    "state": "off"
  },
  "light.grill_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.grill_light",
    "state": "off"
  },
  "light.guest_bathroom_dimmer_switch": {
    "attributes": {
      "brightness": 0,
      "color_mode": "brightness",
      "supported_color_modes": [
        "brightness"
      ],
      "supported_features": 40
    },
    "entity_id": "light.guest_bathroom_dimmer_switch",
    "state": "off"
  },
  "light.gym_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.gym_light",
    "state": "off"
  },
  "light.hallway_entry_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hallway_entry_light",
    "state": "off"
  },
  "light.hallway_guest_room_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hallway_guest_room_light",
    "state": "off"
  },
  "light.hallway_gym_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hallway_gym_light",
    "state": "off"
  },
  "light.hallway_lights": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hallway_lights",
    "state": "off"
  },
  "light.hallway_office_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hallway_office_light",
    "state": "off"
  },
  "light.hue_color_downlight_1": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_1",
    "state": "off"
  },
  "light.hue_color_downlight_3": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_3",
    "state": "off"
  },
  "light.hue_color_downlight_4": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_4",
    "state": "off"
  },
  "light.hue_color_downlight_5": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_5",
    "state": "off"
  },
  "light.hue_color_downlight_6": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_6",
    "state": "off"
  },
  "light.hue_color_downlight_7": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_7",
    "state": "off"
  },
  "light.hue_color_downlight_8": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_color_downlight_8",
    "state": "off"
  },
  "light.hue_play_1": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_play_1",
    "state": "off"
  },
  "light.hue_play_2": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "off",
      "effect_list": [
        "off",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13"
      ],
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 44
    },
    "entity_id": "light.hue_play_2",
    "state": "off"
  },
  "light.kitchen": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.kitchen",
    "state": "off"
  },
  "light.kitchen_counter_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.kitchen_counter_light",
    "state": "off"
  },
  "light.kitchen_door_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.kitchen_door_light",
    "state": "off"
  },
  "light.kitchen_sink_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.kitchen_sink_light",
    "state": "off"
  },
  "light.kitchen_table_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.kitchen_table_light",
    "state": "off"
  },
  "light.master_bathroom_dimmer_switch": {
    "attributes": {
      "brightness": 0,
      "color_mode": "brightness",
      "supported_color_modes": [
        "brightness"
      ],
      "supported_features": 40
    },
    "entity_id": "light.master_bathroom_dimmer_switch",
    "state": "off"
  },
  "light.master_bedroom": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.master_bedroom",
    "state": "off"
  },
  "light.master_bedroom_bathroom_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.master_bedroom_bathroom_light",
    "state": "off"
  },
  "light.master_bedroom_door_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.master_bedroom_door_light",
    "state": "off"
  },
  "light.master_bedroom_window_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.master_bedroom_window_light",
    "state": "off"
  },
  "light.music_room": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "supported_color_modes": [
        "color_temp",
        "xy"
      ],
      "supported_features": 40
    },
    "entity_id": "light.music_room",
    "state": "off"
  },
  "light.music_room_fireplace_light_2": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "supported_color_modes": [
        "color_temp",
        "hs",
        "xy"
      ],
      "supported_features": 32
    },
    "entity_id": "light.music_room_fireplace_light_2",
    "state": "off"
  },
  "light.office_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.office_light",
    "state": "off"
  },
  "light.steph_nightstand_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.steph_nightstand_light",
    "state": "off"
  },
  "light.stephen_nightstand_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.stephen_nightstand_light",
    "state": "off"
  },
  "light.theater_room": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room",
    "state": "off"
  },
  "light.theater_room_front_rear_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_front_rear_light",
    "state": "off"
  },
  "light.theater_room_front_right_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_front_right_light",
    "state": "off"
  },
  "light.theater_room_front_screen_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_front_screen_light",
    "state": "off"
  },
  "light.theater_room_rear_back_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_rear_back_light",
    "state": "off"
  },
  "light.theater_room_rear_front_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_rear_front_light",
    "state": "off"
  },
  "light.theater_room_rear_right_light": {
    "attributes": {
      "brightness": 0,
      "color_mode": "color_temp",
      "effect": "Effect 1",
      "effect_list": [
        "Effect 1",
        "Effect 2",
        "Effect 3",
        "Effect 4",
        "Effect 5",
        "Effect 6",
        "Effect 7",
        "Effect 8",
        "Effect 9",
        "Effect 10",
        "Effect 11",
        "Effect 12",
        "Effect 13",
        "Effect 14",
        "Effect 15",
        "Effect 16"
      ],
      "supported_color_modes": [
        "color_temp"
      ],
      "supported_features": 44
    },
    "entity_id": "light.theater_room_rear_right_light",
    "state": "off"
  },
  "number.fordpass_3fmtk3su5mma09266_rcctemperature": {
    "attributes": {
      "device_class": "temperature",
      "max": 87,
      "min": 60,
      "mode": "box",
      "step": 1,
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "number.fordpass_3fmtk3su5mma09266_rcctemperature",
    "state": "70"
  },
  "script.complete_admin_todo_item": {
    "attributes": {
      "max": 10
    },
    "entity_id": "script.complete_admin_todo_item",
    "state": "off"
  },
  "script.driveway_manual_recording": {
    "attributes": {
      "max": 10
    },
    "entity_id": "script.driveway_manual_recording",
    "state": "off"
  },
  "script.front_door_manual_recording": {
    "attributes": {
      "max": 10
    },
    "entity_id": "script.front_door_manual_recording",
    "state": "off"
  },
  "script.increment_room_access": {
    "attributes": {
      "max": 100
    },
    "entity_id": "script.increment_room_access",
    "state": "off"
  },
  "script.lower_deck_manual_recording": {
    "attributes": {
      "max": 10
    },
    "entity_id": "script.lower_deck_manual_recording",
    "state": "off"
  },
  "script.main_floor_vacuum_clean_selected_segments": {
    "attributes": {},
    "entity_id": "script.main_floor_vacuum_clean_selected_segments",
    "state": "off"
  },
  "script.main_floor_vacuum_clean_zone": {
    "attributes": {},
    "entity_id": "script.main_floor_vacuum_clean_zone",
    "state": "off"
  },
  "script.main_floor_vacuum_mop_dock_clean": {
    "attributes": {},
    "entity_id": "script.main_floor_vacuum_mop_dock_clean",
    "state": "off"
  },
  "script.main_floor_vacuum_mop_dock_dry": {
    "attributes": {},
    "entity_id": "script.main_floor_vacuum_mop_dock_dry",
    "state": "off"
  },
  "script.music_room_vacuum_clean_selected_segments": {
    "attributes": {},
    "entity_id": "script.music_room_vacuum_clean_selected_segments",
    "state": "off"
  },
  "script.music_room_vacuum_clean_zone": {
    "attributes": {},
    "entity_id": "script.music_room_vacuum_clean_zone",
    "state": "off"
  },
  "script.music_room_vacuum_mop_dock_clean": {
    "attributes": {},
    "entity_id": "script.music_room_vacuum_mop_dock_clean",
    "state": "off"
  },
  "script.music_room_vacuum_mop_dock_dry": {
    "attributes": {},
    "entity_id": "script.music_room_vacuum_mop_dock_dry",
    "state": "off"
  },
  "script.theater_room_vacuum_clean_selected_segments": {
    "attributes": {},
    "entity_id": "script.theater_room_vacuum_clean_selected_segments",
    "state": "off"
  },
  "script.theater_room_vacuum_clean_zone": {
    "attributes": {},
    "entity_id": "script.theater_room_vacuum_clean_zone",
    "state": "off"
  },
  "script.theater_room_vacuum_mop_dock_clean": {
    "attributes": {},
    "entity_id": "script.theater_room_vacuum_mop_dock_clean",
    "state": "off"
  },
  "script.theater_room_vacuum_mop_dock_dry": {
    "attributes": {},
    "entity_id": "script.theater_room_vacuum_mop_dock_dry",
    "state": "off"
  },
  "script.upper_deck_manual_recording": {
    "attributes": {
      "max": 10
    },
    "entity_id": "script.upper_deck_manual_recording",
    "state": "off"
  },
  "select.fordpass_3fmtk3su5mma09266_rccseatfrontleft": {
    "attributes": {
      "options": [
        "off",
        "Option 2",
        "Option 3",
        "Option 4"
      ]
    },
    "entity_id": "select.fordpass_3fmtk3su5mma09266_rccseatfrontleft",
    "state": "Option 3"
  },
  "select.fordpass_3fmtk3su5mma09266_rccseatfrontright": {
    "attributes": {
      "options": [
        "off",
        "Option 2",
        "Option 3",
        "Option 4"
      ]
    },
    "entity_id": "select.fordpass_3fmtk3su5mma09266_rccseatfrontright",
    "state": "Option 3"
  },
  "sensor.dining_room_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.dining_room_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.downstairs_hallway_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.downstairs_hallway_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.entryway_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.entryway_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.fordpass_3fmtk3su5mma09266_elvehcharging": {
    "attributes": {},
    "entity_id": "sensor.fordpass_3fmtk3su5mma09266_elvehcharging",
    "state": "idle"
  },
  "sensor.front_door_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.front_door_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.guest_bathroom_entry_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.guest_bathroom_entry_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.guest_bathroom_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.guest_bathroom_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.gym_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.gym_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.hallway_guest_bath_gym_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.hallway_guest_bath_gym_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.hallway_office_bedroom_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.hallway_office_bedroom_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.kitchen_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.kitchen_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.main_floor_vacuum_coordinator_session_state": {
    "attributes": {},
    "entity_id": "sensor.main_floor_vacuum_coordinator_session_state",
    "state": "idle"
  },
  "sensor.master_bathroom_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.master_bathroom_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.master_bedroom_bathroom_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.master_bedroom_bathroom_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.master_bedroom_bed_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.master_bedroom_bed_presence_sensor_temperature",
    "state": "73.1"
  },
  "sensor.master_bedroom_closet_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.master_bedroom_closet_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.master_bedroom_sleepypod_eight_pod_schedules": {
    "attributes": {},
    "entity_id": "sensor.master_bedroom_sleepypod_eight_pod_schedules",
    "state": "idle"
  },
  "sensor.master_bedroom_window_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.master_bedroom_window_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.music_room_door_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.music_room_door_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.music_room_kitchenette_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.music_room_kitchenette_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.music_room_north_wall_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.music_room_north_wall_presence_sensor_temperature_2",
    "state": "70"
  },
  "sensor.office_closet_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.office_closet_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.office_presence_sensor_temperature": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.office_presence_sensor_temperature",
    "state": "70"
  },
  "sensor.sleepypod_eight_pod_left_breathing_rate": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_left_breathing_rate",
    "state": "idle"
  },
  "sensor.sleepypod_eight_pod_left_heart_rate": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_left_heart_rate",
    "state": "idle"
  },
  "sensor.sleepypod_eight_pod_left_hrv": {
    "attributes": {
      "state_class": "measurement",
      "unit_of_measurement": "ms"
    },
    "entity_id": "sensor.sleepypod_eight_pod_left_hrv",
    "state": "0"
  },
  "sensor.sleepypod_eight_pod_left_pump_loop_temp": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.sleepypod_eight_pod_left_pump_loop_temp",
    "state": "70"
  },
  "sensor.sleepypod_eight_pod_left_pump_rpm": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_left_pump_rpm",
    "state": "idle"
  },
  "sensor.sleepypod_eight_pod_right_breathing_rate": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_right_breathing_rate",
    "state": "idle"
  },
  "sensor.sleepypod_eight_pod_right_heart_rate": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_right_heart_rate",
    "state": "idle"
  },
  "sensor.sleepypod_eight_pod_right_hrv": {
    "attributes": {
      "state_class": "measurement",
      "unit_of_measurement": "ms"
    },
    "entity_id": "sensor.sleepypod_eight_pod_right_hrv",
    "state": "0"
  },
  "sensor.sleepypod_eight_pod_right_pump_loop_temp": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.sleepypod_eight_pod_right_pump_loop_temp",
    "state": "70"
  },
  "sensor.sleepypod_eight_pod_right_pump_rpm": {
    "attributes": {
      "state_class": "measurement"
    },
    "entity_id": "sensor.sleepypod_eight_pod_right_pump_rpm",
    "state": "idle"
  },
  "sensor.theater_room_presence_sensor_temperature_2": {
    "attributes": {
      "device_class": "temperature",
      "state_class": "measurement",
      "unit_of_measurement": "\u00b0F"
    },
    "entity_id": "sensor.theater_room_presence_sensor_temperature_2",
    "state": "70"
  },
  "switch.upper_entryway_light_switch_top": {
    "attributes": {},
    "entity_id": "switch.upper_entryway_light_switch_top",
    "state": "off"
  },
  "todo.home_improvement_s_due_today": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.home_improvement_s_due_today",
    "state": "unknown"
  },
  "todo.home_improvement_s_no_due_date": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.home_improvement_s_no_due_date",
    "state": "unknown"
  },
  "todo.home_improvement_s_past_due": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.home_improvement_s_past_due",
    "state": "unknown"
  },
  "todo.home_improvement_s_upcoming": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.home_improvement_s_upcoming",
    "state": "unknown"
  },
  "todo.steph_s_due_today": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.steph_s_due_today",
    "state": "unknown"
  },
  "todo.steph_s_no_due_date": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.steph_s_no_due_date",
    "state": "unknown"
  },
  "todo.steph_s_past_due": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.steph_s_past_due",
    "state": "unknown"
  },
  "todo.steph_s_upcoming": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.steph_s_upcoming",
    "state": "unknown"
  },
  "todo.stephen_s_due_today": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.stephen_s_due_today",
    "state": "unknown"
  },
  "todo.stephen_s_no_due_date": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.stephen_s_no_due_date",
    "state": "unknown"
  },
  "todo.stephen_s_past_due": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.stephen_s_past_due",
    "state": "unknown"
  },
  "todo.stephen_s_upcoming": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.stephen_s_upcoming",
    "state": "unknown"
  },
  "todo.unassigned_due_today": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.unassigned_due_today",
    "state": "unknown"
  },
  "todo.unassigned_past_due": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.unassigned_past_due",
    "state": "unknown"
  },
  "todo.unassigned_upcoming": {
    "attributes": {
      "supported_features": 119
    },
    "entity_id": "todo.unassigned_upcoming",
    "state": "unknown"
  }
} satisfies Record<string, MockEntity>
