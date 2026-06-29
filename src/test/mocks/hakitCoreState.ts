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
    callService: (params: Record<string, unknown>) => unknown
    joinHassUrl: (path: string) => string
  }
  services: Record<string, unknown>
  user: { id: string; name: string } | null
}

export function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): MockEntity {
  return { attributes, entity_id: entityId, state }
}

const freeSleepLevelAttributes = { icon: 'mdi:thermometer-lines', max: 10, min: -10, step: 1, unit_of_measurement: '°' }

export const mockCallServiceCalls: Record<string, unknown>[] = []
export const mockTodoUpdateMessages: Record<string, unknown>[] = []
export const mockTodoItemsByEntity: Record<string, MockTodoItem[] | undefined> = {}

const mockDailyWeatherForecast = [
  { datetime: '2026-06-10T07:00:00+00:00', condition: 'sunny', temperature: 65, templow: 48, precipitation_probability: 0, precipitation: 0, humidity: 74, dew_point: 48, cloud_coverage: 57, wind_speed: 3.56, wind_gust_speed: 7.97, wind_bearing: 185, uv_index: 6.7 },
  { datetime: '2026-06-11T07:00:00+00:00', condition: 'sunny', temperature: 71, templow: 50, precipitation_probability: 0, precipitation: 0, humidity: 68, dew_point: 48, cloud_coverage: 14, wind_speed: 2.31, wind_gust_speed: 5.18, wind_bearing: 169, uv_index: 7.44 },
  { datetime: '2026-06-12T07:00:00+00:00', condition: 'partlycloudy', temperature: 72, templow: 51, precipitation_probability: 0, precipitation: 0, humidity: 66, dew_point: 49, cloud_coverage: 17, wind_speed: 3.18, wind_gust_speed: 6.94, wind_bearing: 212, uv_index: 7.09 },
  { datetime: '2026-06-13T07:00:00+00:00', condition: 'sunny', temperature: 78, templow: 57, precipitation_probability: 0, precipitation: 0, humidity: 65, dew_point: 53, cloud_coverage: 5, wind_speed: 4.58, wind_gust_speed: 9.06, wind_bearing: 183, uv_index: 7.37 },
  { datetime: '2026-06-14T07:00:00+00:00', condition: 'sunny', temperature: 86, templow: 60, precipitation_probability: 0, precipitation: 0, humidity: 58, dew_point: 55, cloud_coverage: 8, wind_speed: 4.08, wind_gust_speed: 8.01, wind_bearing: 187, uv_index: 7.45 },
  { datetime: '2026-06-15T07:00:00+00:00', condition: 'sunny', temperature: 90, templow: 63, precipitation_probability: 0, precipitation: 0, humidity: 55, dew_point: 57, cloud_coverage: 32, wind_speed: 2.31, wind_gust_speed: 5.09, wind_bearing: 149, uv_index: 6.69 },
  { datetime: '2026-06-16T07:00:00+00:00', condition: 'rainy', temperature: 84, templow: 59, precipitation_probability: 7, precipitation: 0, humidity: 55, dew_point: 56, cloud_coverage: 24, wind_speed: 3.96, wind_gust_speed: 7.89, wind_bearing: 157, uv_index: 7.36 },
]

const hourlyTemperatures = [57, 58, 60, 61, 63, 64, 65, 64, 62, 60, 58, 56, 55, 54, 53, 52, 51, 50, 49, 49, 50, 52, 55, 58]

const mockHourlyWeatherForecast = Array.from({ length: 24 }, (_, index) => {
  const forecastDate = new Date('2026-06-10T12:00:00-07:00')
  forecastDate.setHours(forecastDate.getHours() + index)
  return {
    datetime: forecastDate.toISOString(),
    condition: index < 3 ? 'cloudy' : index < 8 ? 'partlycloudy' : 'sunny',
    precipitation_probability: index < 6 ? 0 : 4,
    temperature: hourlyTemperatures[index],
    wind_bearing: 185,
    wind_gust_speed: 5 + (index % 5),
    wind_speed: 3 + (index % 4),
  }
})

function mockDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

const freeSleepAlarmOwners = ['stephen', 'steph'] as const
const freeSleepAlarmDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const freeSleepScheduleSetTopic = 'free-sleep/NightCanvasRestful/schedules/set'
const sleepypodScheduleSetTopic = 'sleepypod/eight-pod/cmd/set-schedules'

function mockFreeSleepAlarmHelpers() {
  const entries: [string, MockEntity][] = []
  for (const owner of freeSleepAlarmOwners) {
    entries.push([`input_boolean.${owner}_alarms_enabled`, entity(`input_boolean.${owner}_alarms_enabled`, 'off')])
    for (const day of freeSleepAlarmDays) {
      entries.push([`input_boolean.${owner}_${day}_alarm_configured`, entity(`input_boolean.${owner}_${day}_alarm_configured`, 'off')])
      entries.push([`input_boolean.${owner}_${day}_alarm_enabled`, entity(`input_boolean.${owner}_${day}_alarm_enabled`, 'off')])
      entries.push([`input_datetime.${owner}_${day}_alarm_time`, entity(`input_datetime.${owner}_${day}_alarm_time`, '07:00:00', { has_date: false, has_time: true })])
    }
  }
  return Object.fromEntries(entries)
}

function mockAlarm(time: string, enabled = true) {
  return {
    alarmTemperature: 82,
    duration: 300,
    enabled,
    time,
    vibrationIntensity: 100,
    vibrationPattern: 'rise',
  }
}

function mockFreeSleepDailySchedule(on: string, off = '09:00', alarms: ReturnType<typeof mockAlarm>[] = []) {
  return {
    alarm: alarms[0],
    alarms,
    power: {
      off,
      on,
    },
  }
}

export function mockFreeSleepScheduleAttributes() {
  return {
    left: Object.fromEntries(freeSleepAlarmDays.map((day) => [day, mockFreeSleepDailySchedule('21:30')])) as Record<string, unknown>,
    right: Object.fromEntries(freeSleepAlarmDays.map((day) => [
      day,
      day === 'saturday'
        ? mockFreeSleepDailySchedule('22:00', '09:00', [mockAlarm('06:30'), mockAlarm('07:15')])
        : mockFreeSleepDailySchedule('22:00'),
    ])) as Record<string, unknown>,
  }
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function applySchedulePayload(entityId: string, payload: unknown) {
  if (!isRecord(payload)) return
  const schedulesEntity = mockEntities[entityId]
  if (!schedulesEntity) return
  const nextAttributes = cloneRecord(schedulesEntity.attributes)
  for (const side of ['left', 'right'] as const) {
    const sidePayload = payload[side]
    if (!isRecord(sidePayload)) continue
    const sideAttributes = isRecord(nextAttributes[side]) ? cloneRecord(nextAttributes[side]) : {}
    for (const day of freeSleepAlarmDays) {
      const dayPayload = sidePayload[day]
      if (!isRecord(dayPayload)) continue
      const dayAttributes = isRecord(sideAttributes[day]) ? cloneRecord(sideAttributes[day]) : {}
      if (isRecord(dayPayload.power)) {
        dayAttributes.power = { ...(isRecord(dayAttributes.power) ? dayAttributes.power : {}), ...dayPayload.power }
      }
      if (isRecord(dayPayload.temperatures)) {
        dayAttributes.temperatures = { ...(isRecord(dayAttributes.temperatures) ? dayAttributes.temperatures : {}), ...dayPayload.temperatures }
      }
      const alarms = Array.isArray(dayPayload.alarms) ? cloneRecord(dayPayload.alarms) : []
      if (Array.isArray(dayPayload.alarms)) {
        dayAttributes.alarms = alarms
        if (alarms.length > 0) dayAttributes.alarm = alarms[0]
        else delete dayAttributes.alarm
      }
      sideAttributes[day] = dayAttributes
    }
    nextAttributes[side] = sideAttributes
  }
  schedulesEntity.attributes = nextAttributes
}

function applyFreeSleepSchedulePayload(payload: unknown) {
  applySchedulePayload('sensor.nightcanvasrestful_schedules', payload)
}

function applyMockCallServiceSideEffects(params: Record<string, unknown>) {
  if (params.domain === 'switch' && typeof params.target === 'string' && (params.service === 'turn_on' || params.service === 'turn_off')) {
    const switchEntity = mockEntities[params.target]
    if (switchEntity) switchEntity.state = params.service === 'turn_on' ? 'on' : 'off'
  }

  if (params.domain === 'number' && params.service === 'set_value' && typeof params.target === 'string') {
    const numberEntity = mockEntities[params.target]
    const value = isRecord(params.serviceData) ? params.serviceData.value : undefined
    if (numberEntity && value !== undefined) numberEntity.state = String(value)
  }

  if (params.domain === 'text' && params.service === 'set_value' && typeof params.target === 'string') {
    const textEntity = mockEntities[params.target]
    const value = isRecord(params.serviceData) ? params.serviceData.value : undefined
    if (textEntity && value !== undefined) textEntity.state = String(value)
  }

  if (params.domain === 'button' && params.service === 'press' && params.target === 'button.nightcanvasrestful_clear_alarm') {
    mockEntities['binary_sensor.nightcanvasrestful_left_alarm_vibrating'].state = 'off'
    mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state = 'off'
  }

  if (params.domain !== 'mqtt' || params.service !== 'publish') return
  const serviceData = isRecord(params.serviceData) ? params.serviceData : {}
  if (typeof serviceData.payload !== 'string') return
  if (serviceData.topic === freeSleepScheduleSetTopic) {
    applyFreeSleepSchedulePayload(JSON.parse(serviceData.payload))
    return
  }
  if (serviceData.topic === sleepypodScheduleSetTopic) {
    applySchedulePayload('sensor.master_bedroom_sleepypod_eight_pod_schedules', JSON.parse(serviceData.payload))
    return
  }
  for (const side of ['left', 'right'] as const) {
    if (serviceData.topic !== `free-sleep/NightCanvasRestful/${side}/schedule/bedtime/set`) continue
    mockEntities[`text.master_bedroom_eight_sleep_pod_5_${side}_bedtime`].state = serviceData.payload
    applyFreeSleepSchedulePayload({
      [side]: Object.fromEntries(freeSleepAlarmDays.map((day) => [day, { power: { on: serviceData.payload } }])),
    })
  }
}

type MockHassDebugApi = {
  calls: Record<string, unknown>[]
  freeSleepSchedules: () => Record<string, unknown>
  reset: () => void
}

function exposeMockHassDebugApi() {
  if (typeof window === 'undefined') return
  ;(window as unknown as { __mockHass?: MockHassDebugApi }).__mockHass = {
    calls: mockCallServiceCalls,
    freeSleepSchedules: () => cloneRecord(mockEntities['sensor.nightcanvasrestful_schedules'].attributes),
    reset: resetMockHass,
  }
}

const thermostatRoomMockData = [
  { key: 'living_room', title: 'Living Room', temperature: '70.2', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_living_room_virtual_thermostat', vents: [['cover.living_room_vent_1_vent', 'open'], ['cover.living_room_vent_2_vent', 'open']] },
  { key: 'office', title: 'Office', temperature: '71.6', occupancy: 'active', track: 'off', force: 'off', climate: 'climate.thermostat_contact_sensors_office_virtual_thermostat', vents: [['cover.office_vent_vent', 'closed']] },
  { key: 'master_bedroom', title: 'Master Bedroom', temperature: '71.0', occupancy: 'active', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat', vents: [['cover.master_bedroom_vent_2_vent', 'closed'], ['cover.master_bedroom_vent_3_vent', 'closed']] },
  { key: 'master_bathroom', title: 'Master Bathroom', temperature: '74.9', occupancy: 'inactive', track: 'on', force: 'off', trackOnlyWhenOccupied: 'on', climate: 'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat', vents: [['cover.master_bathroom_vent_vent', 'closed']] },
  { key: 'kitchen', title: 'Kitchen', temperature: '71.1', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_kitchen_virtual_thermostat', vents: [['cover.kitchen_vent_vent', 'closed']] },
  { key: 'guest_room', title: 'Guest Room', temperature: '70.9', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_guest_room_virtual_thermostat', vents: [['cover.guest_room_vent_vent', 'closed']] },
  { key: 'dining_room', title: 'Dining Room', temperature: '69.7', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_dining_room_virtual_thermostat', vents: [['cover.dining_room_vent_vent', 'open']] },
  { key: 'gym', title: 'Gym', temperature: '70.6', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_gym_virtual_thermostat', vents: [['cover.gym_vent_vent', 'closed']] },
  { key: 'guest_bathroom', title: 'Guest Bathroom', temperature: '76.9', occupancy: 'inactive', track: 'on', force: 'off', trackOnlyWhenOccupied: 'on', climate: 'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat', vents: [['cover.guest_bathroom_vent_vent', 'closed']] },
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
    ['switch.thermostat_contact_sensors_predictive_comfort_mode', entity('switch.thermostat_contact_sensors_predictive_comfort_mode', 'off')],
    ['switch.thermostat_contact_sensors_predictive_auto_adjust', entity('switch.thermostat_contact_sensors_predictive_auto_adjust', 'off')],
    ['switch.thermostat_contact_sensors_predictive_hvac_mode_changes', entity('switch.thermostat_contact_sensors_predictive_hvac_mode_changes', 'off')],
    ['switch.thermostat_contact_sensors_predictive_allow_away', entity('switch.thermostat_contact_sensors_predictive_allow_away', 'off')],
    [
      'sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode',
      entity('sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode', 'idle', {
        active_activity_entities: ['switch.office_pc'],
        adjustment_status: 'auto_adjust_disabled',
        comfort_high: 74,
        comfort_low: 71,
        forecast_high: 83,
        forecast_low: 68,
        indoor_temperature: 72.4,
        predicted_temperature: 74.8,
        reason: 'Forecast and current indoor conditions are inside the comfort band',
        weather_entity: 'weather.pirate_weather',
      }),
    ],
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
    entries.push([`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`, entity(`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`, 'trackOnlyWhenOccupied' in room ? room.trackOnlyWhenOccupied : 'off')])
    entries.push([room.climate, entity(room.climate, 'off', { current_temperature: Number(room.temperature), hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' })])
    for (const [ventEntityId, ventState] of room.vents) {
      if (ventEntityId === 'cover.guest_room_vent_vent' || ventEntityId === 'cover.kitchen_vent_vent') continue
      entries.push([ventEntityId, entity(ventEntityId, ventState)])
    }
  }

  return Object.fromEntries(entries)
}

function valetudoConsumableMockEntities(vacuumMapId: string, values: Partial<Record<string, string>> = {}) {
  const durationAttributes = { device_class: 'duration', icon: 'mdi:progress-wrench', state_class: 'measurement', unit_of_measurement: 'min' }
  const durationDefaults = {
    main_brush: '12240',
    main_filter: '3240',
    right_brush: '6240',
    sensor_cleaning: '120',
    wheel_cleaning: '120',
  }
  const statusDefaults = {
    detergent_dock_component: 'ok',
    dustbag_dock_component: 'ok',
    freshwater_dock_component: 'ok',
    wastewater_dock_component: 'ok',
  }

  return Object.fromEntries([
    ...Object.entries(durationDefaults).map(([suffix, defaultState]) => [
      `sensor.${vacuumMapId}_${suffix}`,
      entity(`sensor.${vacuumMapId}_${suffix}`, values[suffix] ?? defaultState, durationAttributes),
    ]),
    ...Object.entries(statusDefaults).map(([suffix, defaultState]) => [
      `sensor.${vacuumMapId}_${suffix}`,
      entity(`sensor.${vacuumMapId}_${suffix}`, values[suffix] ?? defaultState),
    ]),
  ])
}

const mainFloorAutoCleanDisabledRoomIds = [
  'living_room',
  'master_bedroom',
  'kitchen',
  'office',
  'hallway',
  'guest_room',
  'master_bathroom',
  'guest_bathroom',
  'gym',
  'master_bedroom_closet',
  'dining_room',
] as const

function mainFloorAutoCleanDisabledEntityId(roomId: string) {
  return `switch.main_floor_vacuum_coordinator_${roomId}_auto_clean_disabled`
}

function mainFloorAutoCleanDisabledMockEntities() {
  return Object.fromEntries(mainFloorAutoCleanDisabledRoomIds.map((roomId) => {
    const entityId = mainFloorAutoCleanDisabledEntityId(roomId)
    return [entityId, entity(entityId, 'off')]
  }))
}

export const mockEntities: Record<string, MockEntity> = {
  'alarm_control_panel.aqara_hub_m3_0056_security_system_2': entity('alarm_control_panel.aqara_hub_m3_0056_security_system_2', 'armed_home'),
  'binary_sensor.all_contact_sensors': entity('binary_sensor.all_contact_sensors', 'off'),
  'binary_sensor.contact_sensors': entity('binary_sensor.contact_sensors', 'off'),
  'binary_sensor.occupancy_sensors': entity('binary_sensor.occupancy_sensors', 'on'),
  'button.theater_pc_theaterroom_pc_shutdown': entity('button.theater_pc_theaterroom_pc_shutdown', 'unavailable'),
  'button.nightcanvasrestful_clear_alarm': entity('button.nightcanvasrestful_clear_alarm', 'unknown'),
  'button.stephen_s_eight_sleep_side_alarm_snooze': entity('button.stephen_s_eight_sleep_side_alarm_snooze', 'unknown'),
  'button.steph_s_eight_sleep_side_alarm_snooze': entity('button.steph_s_eight_sleep_side_alarm_snooze', 'unknown'),
  'camera.doorbell_camera': entity('camera.doorbell_camera', 'idle'),
  'camera.garage_camera': entity('camera.garage_camera', 'recording'),
  'camera.lower_deck_camera': entity('camera.lower_deck_camera', 'recording'),
  'camera.upper_deck_camera_2': entity('camera.upper_deck_camera_2', 'recording'),
  'climate.thermostat_contact_sensors_global_virtual_thermostat': entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.thermostat_hub_w200': entity('climate.thermostat_hub_w200', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.stephen_s_eight_sleep_side_climate': entity('climate.stephen_s_eight_sleep_side_climate', 'heat_cool', { current_temperature: 86, temperature: 86, hvac_action: 'heating' }),
  'climate.steph_s_eight_sleep_side_climate': entity('climate.steph_s_eight_sleep_side_climate', 'off', { current_temperature: 72, temperature: 79, hvac_action: 'off' }),
  'number.nightcanvasrestful_left_target_temperature': entity('number.nightcanvasrestful_left_target_temperature', '-1', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_target_temperature': entity('number.nightcanvasrestful_right_target_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_bedtime_temperature': entity('number.nightcanvasrestful_left_bedtime_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_asleep_temperature': entity('number.nightcanvasrestful_left_asleep_temperature', '-1', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_dawn_temperature': entity('number.nightcanvasrestful_left_dawn_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_bedtime_temperature': entity('number.nightcanvasrestful_right_bedtime_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_asleep_temperature': entity('number.nightcanvasrestful_right_asleep_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_dawn_temperature': entity('number.nightcanvasrestful_right_dawn_temperature', '0', { ...freeSleepLevelAttributes }),
  'text.master_bedroom_eight_sleep_pod_5_left_bedtime': entity('text.master_bedroom_eight_sleep_pod_5_left_bedtime', '21:30', { icon: 'mdi:bed-clock', mode: 'text' }),
  'text.master_bedroom_eight_sleep_pod_5_right_bedtime': entity('text.master_bedroom_eight_sleep_pod_5_right_bedtime', '22:00', { icon: 'mdi:bed-clock', mode: 'text' }),
  'number.stephen_s_eight_sleep_side_alarm_snooze_minutes': entity('number.stephen_s_eight_sleep_side_alarm_snooze_minutes', '9', { max: 30, min: 5, step: 1, unit_of_measurement: 'min' }),
  'number.steph_s_eight_sleep_side_alarm_snooze_minutes': entity('number.steph_s_eight_sleep_side_alarm_snooze_minutes', '9', { max: 30, min: 5, step: 1, unit_of_measurement: 'min' }),
  'sensor.nightcanvasrestful_left_current_temperature': entity('sensor.nightcanvasrestful_left_current_temperature', '86', { unit_of_measurement: '°F', device_class: 'temperature' }),
  'sensor.nightcanvasrestful_right_current_temperature': entity('sensor.nightcanvasrestful_right_current_temperature', '72', { unit_of_measurement: '°F', device_class: 'temperature' }),
  'sensor.nightcanvasrestful_left_seconds_remaining': entity('sensor.nightcanvasrestful_left_seconds_remaining', '7200', { unit_of_measurement: 's' }),
  'sensor.nightcanvasrestful_right_seconds_remaining': entity('sensor.nightcanvasrestful_right_seconds_remaining', '0', { unit_of_measurement: 's' }),
  'sensor.nightcanvasrestful_schedules': entity('sensor.nightcanvasrestful_schedules', 'ready', mockFreeSleepScheduleAttributes()),
  'switch.nightcanvasrestful_left_power': entity('switch.nightcanvasrestful_left_power', 'on'),
  'switch.nightcanvasrestful_right_power': entity('switch.nightcanvasrestful_right_power', 'off'),
  'switch.nightcanvasrestful_left_away_mode': entity('switch.nightcanvasrestful_left_away_mode', 'off'),
  'switch.nightcanvasrestful_right_away_mode': entity('switch.nightcanvasrestful_right_away_mode', 'off'),
  'switch.nightcanvasrestful_left_alarms_enabled': entity('switch.nightcanvasrestful_left_alarms_enabled', 'off'),
  'switch.nightcanvasrestful_right_alarms_enabled': entity('switch.nightcanvasrestful_right_alarms_enabled', 'off'),
  'sensor.stephen_s_eight_sleep_side_active_level': entity('sensor.stephen_s_eight_sleep_side_active_level', '1', { raw_value: 9, api_field: 'leftTargetHeatingLevel', source: 'target_heating_level', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_asleep_level': entity('sensor.stephen_s_eight_sleep_side_asleep_level', '2', { raw_value: 17, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_bedtime_level': entity('sensor.stephen_s_eight_sleep_side_bedtime_level', '-1', { raw_value: -13, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_dawn_level': entity('sensor.stephen_s_eight_sleep_side_dawn_level', '2', { raw_value: 22, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_now_level': entity('sensor.stephen_s_eight_sleep_side_now_level', 'unknown', { raw_value: null, api_field: 'overrideLevels.bedtime', has_override: false, source: 'overrideLevels', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_active_level': entity('sensor.steph_s_eight_sleep_side_active_level', '0', { raw_value: 0, api_field: 'rightTargetHeatingLevel', source: 'target_heating_level', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_asleep_level': entity('sensor.steph_s_eight_sleep_side_asleep_level', '1', { raw_value: 10, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_bedtime_level': entity('sensor.steph_s_eight_sleep_side_bedtime_level', '-5', { raw_value: -50, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_dawn_level': entity('sensor.steph_s_eight_sleep_side_dawn_level', '2', { raw_value: 20, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_now_level': entity('sensor.steph_s_eight_sleep_side_now_level', 'unknown', { raw_value: null, api_field: 'overrideLevels.bedtime', has_override: false, source: 'overrideLevels', unit_of_measurement: '°' }),
  'input_boolean.eight_sleep_stephen_hot_flash_active': entity('input_boolean.eight_sleep_stephen_hot_flash_active', 'off'),
  'input_boolean.eight_sleep_steph_hot_flash_active': entity('input_boolean.eight_sleep_steph_hot_flash_active', 'off'),
  'input_button.eight_sleep_stephen_cancel_hot_flash': entity('input_button.eight_sleep_stephen_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_stephen_hot_flash': entity('input_button.eight_sleep_stephen_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_button.eight_sleep_steph_cancel_hot_flash': entity('input_button.eight_sleep_steph_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_steph_hot_flash': entity('input_button.eight_sleep_steph_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_datetime.eight_sleep_stephen_hot_flash_restore_at': entity('input_datetime.eight_sleep_stephen_hot_flash_restore_at', '2026-06-07 00:00:00', { timestamp: 1780815600 }),
  'input_datetime.eight_sleep_steph_hot_flash_restore_at': entity('input_datetime.eight_sleep_steph_hot_flash_restore_at', '2026-06-07 00:00:00', { timestamp: 1780815600 }),
  'input_number.eight_sleep_stephen_asleep_level': entity('input_number.eight_sleep_stephen_asleep_level', '1'),
  'input_number.eight_sleep_stephen_bedtime_level': entity('input_number.eight_sleep_stephen_bedtime_level', '-5'),
  'input_number.eight_sleep_stephen_dawn_level': entity('input_number.eight_sleep_stephen_dawn_level', '2'),
  'input_number.eight_sleep_steph_asleep_level': entity('input_number.eight_sleep_steph_asleep_level', '1'),
  'input_number.eight_sleep_steph_bedtime_level': entity('input_number.eight_sleep_steph_bedtime_level', '-5'),
  'input_number.eight_sleep_steph_dawn_level': entity('input_number.eight_sleep_steph_dawn_level', '2'),
  ...mockFreeSleepAlarmHelpers(),
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
  'input_boolean.vacation_mode': entity('input_boolean.vacation_mode', 'off'),
  'input_boolean.vacation_mode_invalid_dates_pending': entity('input_boolean.vacation_mode_invalid_dates_pending', 'off'),
  'input_boolean.vacation_disable_home_tasks': entity('input_boolean.vacation_disable_home_tasks', 'off'),
  'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers': entity('input_boolean.vacation_checklist_turn_off_outdoor_sprinklers', 'off'),
  'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain': entity('input_boolean.vacation_checklist_pour_boiling_water_down_the_drain', 'off'),
  'input_boolean.vacation_checklist_make_the_bed': entity('input_boolean.vacation_checklist_make_the_bed', 'off'),
  'input_boolean.vacation_checklist_unload_and_check_dishwasher': entity('input_boolean.vacation_checklist_unload_and_check_dishwasher', 'off'),
  'input_boolean.vacation_checklist_trash_and_recycles_taken_out': entity('input_boolean.vacation_checklist_trash_and_recycles_taken_out', 'off'),
  'input_datetime.vacation_start': entity('input_datetime.vacation_start', '2026-06-14 10:01:00', { has_date: true, has_time: true }),
  'input_datetime.vacation_end': entity('input_datetime.vacation_end', '2026-06-15 10:01:00', { has_date: true, has_time: true }),
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
  'light.master_bedroom_closet_light': entity('light.master_bedroom_closet_light', 'off'),
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
  'binary_sensor.master_bedroom_closet_presence_occupancy': entity('binary_sensor.master_bedroom_closet_presence_occupancy', 'off'),
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
  'binary_sensor.nightcanvasrestful_left_alarm_vibrating': entity('binary_sensor.nightcanvasrestful_left_alarm_vibrating', 'off'),
  'binary_sensor.nightcanvasrestful_left_presence': entity('binary_sensor.nightcanvasrestful_left_presence', 'on'),
  'binary_sensor.nightcanvasrestful_right_alarm_vibrating': entity('binary_sensor.nightcanvasrestful_right_alarm_vibrating', 'off'),
  'binary_sensor.nightcanvasrestful_right_presence': entity('binary_sensor.nightcanvasrestful_right_presence', 'off'),
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
  'humidifier.master_bedroom_humidifier': entity('humidifier.master_bedroom_humidifier', 'on', { available_modes: ['auto', 'normal'], current_humidity: 41, humidity: 45, max_humidity: 80, min_humidity: 30, mode: 'auto' }),
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
  ...valetudoConsumableMockEntities('valetudo_elatedusedram'),
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
  ...valetudoConsumableMockEntities('valetudo_politefatherlykingfisher', {
    main_brush: '14700',
    main_filter: '5700',
    right_brush: '8700',
  }),
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
  ...valetudoConsumableMockEntities('valetudo_exaltedsneakydeer'),
  'input_text.main_floor_vacuum_error_message': entity('input_text.main_floor_vacuum_error_message', ''),
  'input_text.main_floor_vacuum_mode': entity('input_text.main_floor_vacuum_mode', 'Vacuum'),
  'select.valetudo_exaltedsneakydeer_mode': entity('select.valetudo_exaltedsneakydeer_mode', 'vacuum', { options: ['vacuum_and_mop', 'mop', 'vacuum', 'vacuum_then_mop'] }),
  'select.valetudo_exaltedsneakydeer_fan': entity('select.valetudo_exaltedsneakydeer_fan', 'balanced', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_exaltedsneakydeer_water': entity('select.valetudo_exaltedsneakydeer_water', 'medium', { options: ['low', 'medium', 'high'] }),
  'input_select.main_floor_vacuum_cleaning_passes': entity('input_select.main_floor_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'sensor.evershelf_items_in_pantry': entity('sensor.evershelf_items_in_pantry', '12', { unit_of_measurement: 'items' }),
  'sensor.evershelf_items_in_fridge': entity('sensor.evershelf_items_in_fridge', '8', { unit_of_measurement: 'items' }),
  'sensor.evershelf_items_in_freezer': entity('sensor.evershelf_items_in_freezer', '5', { unit_of_measurement: 'items' }),
  'sensor.kitchen_evershelf_items_in_spice_rack': entity('sensor.kitchen_evershelf_items_in_spice_rack', '6', { unit_of_measurement: 'items' }),
  'sensor.kitchen_evershelf_items_in_cabinet': entity('sensor.kitchen_evershelf_items_in_cabinet', '4', { unit_of_measurement: 'items' }),
  'sensor.evershelf_total_items': entity('sensor.evershelf_total_items', '35', { unit_of_measurement: 'items' }),
  'sensor.evershelf_expiring_soon': entity('sensor.evershelf_expiring_soon', '6', {
    expiring_list: [
      { days_remaining: 2, expiry_date: '2026-06-27', location: 'dispensa', name: 'Rice' },
      { days_remaining: 7, expiry_date: '2026-07-02', location: 'frigo', name: 'Milk' },
      { days_remaining: 8, expiry_date: '2026-07-03', location: 'frigo', name: 'Yogurt' },
      { days_remaining: 5, expiry_date: '2026-06-30', location: 'freezer', name: 'Waffles' },
      { days_remaining: 4, expiry_date: '2026-06-29', location: 'spice_rack', name: 'Paprika' },
      { days_remaining: 6, expiry_date: '2026-07-01', location: 'cabinet', name: 'Tea Bags' },
    ],
    unit_of_measurement: 'items',
  }),
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
  ...mainFloorAutoCleanDisabledMockEntities(),
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
  mockEntities['sensor.nightcanvasrestful_schedules'].attributes = mockFreeSleepScheduleAttributes()
  mockEntities['switch.nightcanvasrestful_left_alarms_enabled'].state = 'off'
  mockEntities['switch.nightcanvasrestful_right_alarms_enabled'].state = 'off'
  mockEntities['binary_sensor.nightcanvasrestful_left_alarm_vibrating'].state = 'off'
  mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state = 'off'
  mockEntities['number.stephen_s_eight_sleep_side_alarm_snooze_minutes'].state = '9'
  mockEntities['number.steph_s_eight_sleep_side_alarm_snooze_minutes'].state = '9'
  for (const room of thermostatRoomMockData) {
    mockEntities[`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`].state = 'trackOnlyWhenOccupied' in room ? room.trackOnlyWhenOccupied : 'off'
  }
  for (const roomId of mainFloorAutoCleanDisabledRoomIds) {
    mockEntities[mainFloorAutoCleanDisabledEntityId(roomId)].state = 'off'
  }
  mockEntities['humidifier.master_bedroom_humidifier'].state = 'on'
  mockEntities['humidifier.master_bedroom_humidifier'].attributes = { available_modes: ['auto', 'normal'], current_humidity: 41, humidity: 45, max_humidity: 80, min_humidity: 30, mode: 'auto' }
  exposeMockHassDebugApi()
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
      if (message.type === 'call_service' && message.domain === 'weather' && message.service === 'get_forecasts') {
        return { service_response: { 'weather.pirate_weather': { forecast: mockDailyWeatherForecast } } } as T
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
      applyMockCallServiceSideEffects(params)
      if (params.domain === 'weather' && params.service === 'get_forecasts' && params.returnResponse === true) {
        const forecast = (params.serviceData as { type?: string } | undefined)?.type === 'hourly' ? mockHourlyWeatherForecast : mockDailyWeatherForecast
        return Promise.resolve({ response: { 'weather.pirate_weather': { forecast } } })
      }
      if (params.domain === 'evershelf' && params.service === 'resolve_barcode' && params.returnResponse === true) {
        const barcode = (params.serviceData as { barcode?: string } | undefined)?.barcode
        return Promise.resolve({
          response: {
            barcode,
            found: true,
            product: { brand: 'Ferrero', image_url: 'https://example.test/nutella.jpg', name: 'Nutella' },
            source: 'mock',
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'read_expiry_image' && params.returnResponse === true) {
        return Promise.resolve({
          response: {
            expiry_date: '2026-06-30',
            raw_text: 'EXP 06/30/2026',
            source: 'mock_ocr',
            success: true,
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && params.returnResponse === true) {
        const location = (params.serviceData as { location?: string } | undefined)?.location
        const fridgeInventory = [
          { expiry_date: mockDateOffset(370), id: 204, location: 'frigo', name: 'Salsa' },
          { expiry_date: mockDateOffset(-400), id: 205, location: 'frigo', name: 'Milk' },
          { expiry_date: mockDateOffset(5), id: 203, location: 'frigo', name: 'Greek Yogurt', quantity: 2 },
        ]
        const freezerInventory = [
          { expiry_date: mockDateOffset(190), id: 304, location: 'freezer', name: 'Waffles' },
          { expiry_date: mockDateOffset(20), id: 303, location: 'freezer', name: 'Frozen Peas' },
        ]
        const spiceRackInventory = [
          { expiry_date: mockDateOffset(400), id: 404, location: 'spice_rack', name: 'Cumin' },
          { expiry_date: mockDateOffset(4), id: 403, location: 'spice_rack', name: 'Paprika' },
        ]
        const cabinetInventory = [
          { expiry_date: mockDateOffset(6), id: 503, location: 'cabinet', name: 'Tea Bags' },
          { expiry_date: mockDateOffset(80), id: 504, location: 'cabinet', name: 'Paper Plates' },
        ]
        const pantryInventory = [
          { expiry_date: mockDateOffset(40), id: 103, location: 'dispensa', name: 'Ziti' },
          { expiry_date: mockDateOffset(3), id: 102, location: 'dispensa', name: 'Canned Beans', quantity: 1 },
          { expiry_date: mockDateOffset(3), id: 106, location: 'dispensa', name: 'Canned Beans', quantity: 1 },
          { expiry_date: mockDateOffset(-10), id: 101, location: 'dispensa', name: 'Almond Flour' },
        ]
        const inventory = location === 'frigo'
          ? fridgeInventory
          : location === 'freezer'
            ? freezerInventory
            : location === 'spice_rack'
              ? spiceRackInventory
              : location === 'cabinet'
                ? cabinetInventory
                : location
                  ? pantryInventory
                  : [...pantryInventory, ...fridgeInventory, ...freezerInventory, ...spiceRackInventory, ...cabinetInventory]
        return Promise.resolve({ response: { inventory } })
      }
      if (params.domain === 'evershelf' && params.service === 'add_scanned_item' && params.returnResponse === true) {
        const serviceData = params.serviceData as { name?: string } | undefined
        if (serviceData?.name === 'Fail Item') {
          return Promise.resolve({
            response: {
              message: 'Mock add failure',
              success: false,
            },
          })
        }
        return Promise.resolve({
          response: {
            inventory: {
              new_qty: 1,
              total_qty: 1,
              unit: 'pz',
            },
            product_id: 123,
            success: true,
          },
        })
      }
    },
    joinHassUrl: (path) => `http://mock-hass.local${path}`,
  },
  services: {},
  user: { id: '64089b5683944c39b4f944c8f76830b0', name: 'Stephen' },
}

exposeMockHassDebugApi()
