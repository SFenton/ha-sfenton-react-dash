export interface SprinklerZoneConfig {
  historyEntityId: string
  programEntityId: string
  valveEntityId: string
}

export interface SprinklerControllerConfig {
  batteryEntityId: string
  faultEntityId: string
  hubConnectedEntityId: string
  id: 'backyard' | 'frontYard'
  modalHash: string
  modeEntityId: string
  nextWateringEntityId: string
  rainDelayEntityId: string
  smartWateringEntityId: string
  stateEntityId: string
  zones: readonly SprinklerZoneConfig[]
}

export const SHOW_OUTDOOR_FAUCETS_ENTITY_ID = 'input_boolean.show_outdoor_faucets'
export const FRONT_YARD_SPRINKLER_MODAL_HASH = '#sprinkler-front-yard'
export const BACKYARD_SPRINKLER_MODAL_HASH = '#sprinkler-backyard'
export const SPRINKLER_LOW_BATTERY_PERCENT = 20
export const SPRINKLER_MANUAL_RUNTIME_MINUTES = {
  default: 15,
  max: 60,
  min: 1,
} as const

export const FRONT_YARD_SPRINKLER: SprinklerControllerConfig = {
  batteryEntityId: 'sensor.front_yard_battery_level',
  faultEntityId: 'binary_sensor.front_yard_fault',
  hubConnectedEntityId: 'binary_sensor.front_yard_hub_connected',
  id: 'frontYard',
  modalHash: FRONT_YARD_SPRINKLER_MODAL_HASH,
  modeEntityId: 'select.front_yard_device_mode',
  nextWateringEntityId: 'sensor.front_yard_next_watering',
  rainDelayEntityId: 'switch.front_yard_rain_delay',
  smartWateringEntityId: 'switch.front_yard_smart_watering',
  stateEntityId: 'sensor.front_yard_state',
  zones: [{
    historyEntityId: 'sensor.front_yard_zone_history',
    programEntityId: 'switch.front_yard_front_yard_program',
    valveEntityId: 'valve.front_yard_zone',
  }],
}

export const BACKYARD_SPRINKLER: SprinklerControllerConfig = {
  batteryEntityId: 'sensor.backyard_faucet_battery_level',
  faultEntityId: 'binary_sensor.backyard_faucet_fault',
  hubConnectedEntityId: 'binary_sensor.wi_fi_hub_connected',
  id: 'backyard',
  modalHash: BACKYARD_SPRINKLER_MODAL_HASH,
  modeEntityId: 'select.backyard_faucet_device_mode',
  nextWateringEntityId: 'sensor.backyard_faucet_next_watering',
  rainDelayEntityId: 'switch.backyard_faucet_rain_delay',
  smartWateringEntityId: 'switch.backyard_faucet_bushes_smart_watering',
  stateEntityId: 'sensor.backyard_faucet_state',
  zones: [
    {
      historyEntityId: 'sensor.bushes_zone_history',
      programEntityId: 'switch.backyard_faucet_bushes_program',
      valveEntityId: 'valve.backyard_faucet_bushes_zone',
    },
    {
      historyEntityId: 'sensor.house_zone_history',
      programEntityId: 'switch.backyard_faucet_house_program',
      valveEntityId: 'valve.backyard_faucet_house_zone',
    },
    {
      historyEntityId: 'sensor.backyard_zone_history',
      programEntityId: 'switch.backyard_faucet_backyard_program',
      valveEntityId: 'valve.backyard_faucet_backyard_zone',
    },
    {
      historyEntityId: 'sensor.sidewalk_zone_history',
      programEntityId: 'switch.backyard_faucet_sidewalk_program',
      valveEntityId: 'valve.backyard_faucet_sidewalk_zone',
    },
  ],
}
