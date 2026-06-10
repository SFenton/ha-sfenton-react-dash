# FP300 Matter to Zigbee2MQTT Reference

Generated from live Home Assistant device/entity registry and Zigbee2MQTT bridge devices. Matter serials map directly to expected Zigbee IEEE addresses with a `0x` prefix.

## Master Bedroom / Bathroom Prep

| Area | Current Matter device | Expected Z2M IEEE | Occupancy | RLC occupancy | Temperature | Humidity | Illuminance | In Z2M now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Master Bathroom | Master Bathroom Presense Sensor | `0x54ef44100146f64c` | `binary_sensor.master_bathroom_presence_occupancy` | `sensor.master_bathroom_presence_sensor_occupancy` | `sensor.master_bathroom_presence_temperature` | `sensor.master_bathroom_presence_humidity` | `sensor.master_bathroom_presence_illuminance` | yes |
| Master Bedroom | Master Bedroom Bathroom Presence Sensor | `0x54ef4410014ae9cb` | `binary_sensor.master_bedroom_bathroom_presence_occupancy` | `sensor.master_bedroom_bathroom_presence_sensor_occupancy` | `sensor.master_bedroom_bathroom_presence_temperature` | `sensor.master_bedroom_bathroom_presence_humidity` | `sensor.master_bedroom_bathroom_presence_illuminance` | yes |
| Master Bedroom | Master Bedroom Closet Presence Sensor | `0x54ef44100146eb59` | `binary_sensor.master_bedroom_closet_presence_occupancy` | `sensor.master_bedroom_closet_presence_sensor_occupancy` | `sensor.master_bedroom_closet_presence_temperature` | `sensor.master_bedroom_closet_presence_humidity` | `sensor.master_bedroom_closet_presence_illuminance` | yes |
| Master Bedroom | Master Bedroom Window Presence Sensor | `0x54ef44100146f191` | `binary_sensor.master_bedroom_window_presence_occupancy` | `sensor.master_bedroom_window_presence_sensor_occupancy` | `sensor.master_bedroom_window_presence_temperature` | `sensor.master_bedroom_window_presence_humidity` | `sensor.master_bedroom_window_presence_illuminance` | yes |

## Guest Room / Gym / Kitchen / Guest Bathroom Prep

| Area | Current Matter device | Expected Z2M IEEE | Occupancy | RLC occupancy | Temperature | Humidity | Illuminance | In Z2M now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest Room | Guest Room Presence Sensor | `0x54ef44100146e2e2` | `binary_sensor.guest_room_presence_occupancy` | `sensor.guest_room_presence_sensor_occupancy` | `sensor.guest_room_presence_temperature` | `sensor.guest_room_presence_humidity` | `sensor.guest_room_presence_illuminance` | yes |
| Guest Room | Guest Room Closet Facing Presence Sensor | `0x54ef441001497be3` | `binary_sensor.guest_room_closet_facing_presence_occupancy` | `sensor.guest_room_closet_facing_presence_sensor_occupancy` | `sensor.guest_room_closet_facing_presence_temperature` | `sensor.guest_room_closet_facing_presence_humidity` | `sensor.guest_room_closet_facing_presence_illuminance` | yes |
| Gym | Gym Presence Sensor | `0x54ef44100146b48d` | `binary_sensor.gym_presence_occupancy` | `sensor.gym_presence_sensor_occupancy` | `sensor.gym_presence_temperature` | `sensor.gym_presence_humidity` | `sensor.gym_presence_illuminance` | yes |
| Kitchen | Kitchen Presence Sensor | `0x54ef44100146f067` | `binary_sensor.kitchen_wall_presence_occupancy` | `sensor.kitchen_presence_sensor_occupancy` | `sensor.kitchen_wall_presence_temperature` | `sensor.kitchen_wall_presence_humidity` | `sensor.kitchen_wall_presence_illuminance` | yes |
| Guest Bathroom | Guest Bathroom Presence Sensor | `0x54ef44100146f0dd` | `binary_sensor.guest_bathroom_presence_occupancy` | `sensor.guest_bathroom_presence_sensor_occupancy` | `sensor.guest_bathroom_presence_temperature` | `sensor.guest_bathroom_presence_humidity` | `sensor.guest_bathroom_presence_illuminance` | yes |
| Guest Bathroom | Guest Bathroom Entry Presence Sensor | `0x54ef4410014aea57` | `binary_sensor.guest_bathroom_entry_presence_occupancy` | `sensor.guest_bathroom_entry_presence_sensor_occupancy` | `sensor.guest_bathroom_entry_presence_temperature` | `sensor.guest_bathroom_entry_presence_humidity` | `sensor.guest_bathroom_entry_presence_illuminance` | yes |

## Living Room / Front Door / Dining Room Prep

| Area | Current Matter device | Expected Z2M IEEE | Occupancy | RLC occupancy | Temperature | Humidity | Illuminance | In Z2M now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Living Room | Living Room Bar Presence Sensor | `0x54ef44100149ab20` | `binary_sensor.living_room_bar_presence_occupancy` | `sensor.living_room_bar_presence_sensor_occupancy` | `sensor.living_room_bar_presence_temperature` | `sensor.living_room_bar_presence_humidity` | `sensor.living_room_bar_presence_illuminance` | yes |
| Living Room | Living Room Fireplace Presence Sensor | `0x54ef4410014ae496` | `binary_sensor.living_room_fireplace_presence_occupancy` | `sensor.living_room_fireplace_presence_sensor_occupancy` | `sensor.living_room_fireplace_presence_temperature` | `sensor.living_room_fireplace_presence_humidity` | `sensor.living_room_fireplace_presence_illuminance` | yes |
| Living Room | Living Room Kitchen Wall Presence Sensor | `0x54ef441001497be5` | `binary_sensor.living_room_kitchen_wall_presence_occupancy` | `sensor.living_room_kitchen_wall_presence_sensor_occupancy` | `sensor.living_room_kitchen_wall_presence_temperature` | `sensor.living_room_kitchen_wall_presence_humidity` | `sensor.living_room_kitchen_wall_presence_illuminance` | yes |
| Living Room | Living Room Presence Sensor | `0x54ef44100146b39a` | `binary_sensor.living_room_back_wall_presence_occupancy` | `sensor.living_room_back_wall_presence_sensor_occupancy` | `sensor.living_room_back_wall_presence_temperature` | `sensor.living_room_back_wall_presence_humidity` | `sensor.living_room_back_wall_presence_illuminance` | yes |
| Entryway | Front Door Presence Sensor | `0x54ef4410014ae274` | `binary_sensor.front_door_presence_occupancy` | `sensor.front_door_presence_sensor_occupancy` | `sensor.front_door_presence_temperature` | `sensor.front_door_presence_humidity` | `sensor.front_door_presence_illuminance` | yes |
| Dining Room | Dining Room Presence Sensor | `0x54ef44100146ca70` | `binary_sensor.dining_room_presence_occupancy` | `sensor.dining_room_presence_sensor_occupancy` | `sensor.dining_room_presence_temperature` | `sensor.dining_room_presence_humidity` | `sensor.dining_room_presence_illuminance` | yes |

## All Remaining Matter FP300 Sensors

| Area | Current Matter device | Expected Z2M IEEE | Occupancy | RLC occupancy | Temperature | Humidity | Illuminance | In Z2M now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Unassigned | Music Room Door Presence Sensor | `0x54ef441001498c47` | `binary_sensor.music_room_door_presence_occupancy` | `sensor.music_room_door_presence_sensor_occupancy` | `sensor.music_room_door_presence_temperature` | `sensor.music_room_door_presence_humidity` | `sensor.music_room_door_presence_illuminance` | no |
| Unassigned | Music Room Kitchenette Presence Sensor | `0x54ef4410014ae1d0` | `binary_sensor.music_room_kitchenette_presence_occupancy` | `sensor.music_room_kitchenette_presence_sensor_occupancy` | `sensor.music_room_kitchenette_presence_temperature` | `sensor.music_room_kitchenette_presence_humidity` | `sensor.music_room_kitchenette_presence_illuminance` | no |
| Unassigned | Music Room North Wall Presence Sensor | `0x54ef441001498bde` | `binary_sensor.music_room_north_wall_presence_occupancy` | `sensor.music_room_north_wall_presence_sensor_occupancy` | `sensor.music_room_north_wall_presence_temperature` | `sensor.music_room_north_wall_presence_humidity` | `sensor.music_room_north_wall_presence_illuminance` | no |
| Unassigned | Theater Room Presence Sensor | `0x54ef441001498b37` | `binary_sensor.theater_room_presence_occupancy` | `sensor.theater_room_presence_sensor_occupancy` | `sensor.theater_room_presence_temperature` | `sensor.theater_room_presence_humidity` | `sensor.theater_room_presence_illuminance` | no |
| Downstairs Hallway | Downstairs Hallway Presence Sensor | `0x54ef441001498ab8` | `binary_sensor.downstairs_hallway_presence_occupancy` | `sensor.downstairs_hallway_presence_sensor_occupancy` | `sensor.downstairs_hallway_presence_temperature` | `sensor.downstairs_hallway_presence_humidity` | `sensor.downstairs_hallway_presence_illuminance` | no |

## Already Migrated Z2M FP300 Sensors

| Z2M friendly name | IEEE | Model | Converter version | Interview state | Supported |
| --- | --- | --- | --- | --- | --- |
| Dining Room Presence Sensor | `0x54ef44100146ca70` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Entryway Presence Sensor | `0x54ef44100146f60f` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Front Door Presence Sensor | `0x54ef4410014ae274` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Guest Bathroom Entry Presence Sensor | `0x54ef4410014aea57` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Guest Bathroom Presence Sensor | `0x54ef44100146f0dd` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Guest Room Closet Facing Presence Sensor | `0x54ef441001497be3` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Guest Room Presence Sensor | `0x54ef44100146e2e2` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Gym Presence Sensor | `0x54ef44100146b48d` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Hallway Guest Bath Gym Presence Sensor | `0x54ef44100146dc08` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Kitchen Presence Sensor | `0x54ef44100146f067` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Living Room Bar Presence Sensor | `0x54ef44100149ab20` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Living Room Fireplace Presence Sensor | `0x54ef4410014ae496` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Living Room Kitchen Wall Presence Sensor | `0x54ef441001497be5` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Living Room Presence Sensor | `0x54ef44100146b39a` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Hallway Office Bedroom Presence Sensor | `0x54ef44100146ca84` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Master Bathroom Presence Sensor | `0x54ef44100146f64c` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Master Bedroom Bathroom Presence Sensor | `0x54ef4410014ae9cb` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Master Bedroom Closet Presence Sensor | `0x54ef44100146eb59` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Master Bedroom Window Presence Sensor | `0x54ef44100146f191` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Office Closet Presence Sensor | `0x54ef441001498afb` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |
| Office Presence Sensor | `0x54ef44100146c90c` | PS-S04D | 0.0.1 | SUCCESSFUL | yes |

## Notes

- `Unassigned` means the Matter device registry entry has no area assigned, even if its entity IDs clearly belong to a room.
- For a newly paired Z2M FP300, expect raw discovery IDs like `binary_sensor.<ieee>_presence`, `binary_sensor.<ieee>_pir_detection`, `sensor.<ieee>_temperature`, `sensor.<ieee>_humidity`, and `sensor.<ieee>_illuminance` until they are renamed back to the preserved HA IDs above.
- After Zigbee2MQTT 2.12.0 reconfigure, verify `database.db` has `manuSpecificLumi` / cluster `64704` reporting for attrs `322` and `333` with manufacturer code `4447`.
- Fresh real-last-changed helpers start with `previous_valid_state: null` until the source changes once; do not wire fresh RLC sensors into PBL until initialized.
