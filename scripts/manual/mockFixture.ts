export interface LiveHassState {
  attributes?: Record<string, unknown>
  entity_id: string
  state: string
}

export interface SyntheticMockEntity {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

export type SyntheticMockEntityMap = Record<string, SyntheticMockEntity>

const GENERATED_HEADER = [
  '// GENERATED FILE. Run `npm run manual:sync:mocks`; do not edit by hand.',
  '// Privacy-sanitized synthetic defaults only; no live household state or sensitive attributes are retained.',
].join('\n')

const SAFE_ATTRIBUTE_KEYS = new Set([
  'assumed_state',
  'battery_level',
  'brightness',
  'color_mode',
  'current_humidity',
  'current_position',
  'current_temperature',
  'current_tilt_position',
  'device_class',
  'duration',
  'editable',
  'effect',
  'effect_list',
  'fan_mode',
  'fan_modes',
  'fan_speed',
  'fan_speed_list',
  'has_date',
  'has_time',
  'humidity',
  'hvac_action',
  'hvac_modes',
  'max',
  'max_humidity',
  'max_temp',
  'min',
  'min_humidity',
  'min_temp',
  'mode',
  'options',
  'percentage',
  'percentage_step',
  'preset_mode',
  'preset_modes',
  'remaining',
  'rgb_color',
  'source',
  'source_list',
  'state_class',
  'step',
  'supported_color_modes',
  'supported_features',
  'swing_mode',
  'swing_modes',
  'target_humidity',
  'target_temp_high',
  'target_temp_low',
  'target_temp_step',
  'temperature',
  'temperature_unit',
  'unit_of_measurement',
  'volume_level',
])

const SAFE_DEVICE_CLASSES = new Set([
  'apparent_power',
  'aqi',
  'atmospheric_pressure',
  'awning',
  'battery',
  'battery_charging',
  'blind',
  'carbon_dioxide',
  'carbon_monoxide',
  'cold',
  'connectivity',
  'current',
  'curtain',
  'damper',
  'data_rate',
  'data_size',
  'date',
  'distance',
  'door',
  'duration',
  'energy',
  'energy_distance',
  'energy_storage',
  'enum',
  'frequency',
  'garage',
  'garage_door',
  'gas',
  'gate',
  'heat',
  'humidity',
  'illuminance',
  'irradiance',
  'light',
  'lock',
  'moisture',
  'monetary',
  'motion',
  'moving',
  'nitrogen_dioxide',
  'nitrogen_monoxide',
  'nitrous_oxide',
  'occupancy',
  'opening',
  'ozone',
  'ph',
  'plug',
  'pm1',
  'pm10',
  'pm25',
  'power',
  'power_factor',
  'precipitation',
  'precipitation_intensity',
  'presence',
  'pressure',
  'problem',
  'reactive_energy',
  'reactive_power',
  'running',
  'safety',
  'shade',
  'shutter',
  'signal_strength',
  'smoke',
  'sound',
  'sound_pressure',
  'speed',
  'sulphur_dioxide',
  'tamper',
  'temperature',
  'timestamp',
  'update',
  'vibration',
  'volatile_organic_compounds',
  'volatile_organic_compounds_parts',
  'voltage',
  'volume',
  'volume_flow_rate',
  'volume_storage',
  'water',
  'weight',
  'wind_direction',
  'wind_speed',
  'window',
])

const SAFE_STATE_CLASSES = new Set(['measurement', 'total', 'total_increasing'])
const SAFE_MODES = new Set(['auto', 'box', 'slider', 'text'])
const SAFE_COLOR_MODES = new Set(['brightness', 'color_temp', 'hs', 'onoff', 'rgb', 'rgbw', 'rgbww', 'white', 'xy'])
const SAFE_UNITS = new Set([
  '%',
  'A',
  'AQI',
  'B',
  'C',
  'F',
  'GB',
  'GHz',
  'Hz',
  'KB',
  'L',
  'MB',
  'MHz',
  'Pa',
  'V',
  'VA',
  'VAR',
  'W',
  'Wh',
  'd',
  'dB',
  'ft',
  'ft/s',
  'g',
  'gal',
  'h',
  'hPa',
  'in',
  'items',
  'kB',
  'kW',
  'kWh',
  'kg',
  'km',
  'km/h',
  'lb',
  'lx',
  'm',
  'm/s',
  'mA',
  'mV',
  'mg/m3',
  'mi',
  'min',
  'mm',
  'mm/h',
  'mph',
  'ms',
  'ppm',
  'ppb',
  'psi',
  's',
  'ug/m3',
  '\u00b0',
  '\u00b0C',
  '\u00b0F',
])

const SAFE_ENUM_VALUES = new Map<string, string>([
  ['active', 'active'],
  ['armed_away', 'armed_away'],
  ['armed_home', 'armed_home'],
  ['armed_night', 'armed_night'],
  ['armed_vacation', 'armed_vacation'],
  ['arming', 'arming'],
  ['auto', 'auto'],
  ['automatic', 'automatic'],
  ['away', 'away'],
  ['balanced', 'balanced'],
  ['cleaning', 'cleaning'],
  ['closed', 'closed'],
  ['closing', 'closing'],
  ['cool', 'cool'],
  ['cooling', 'cooling'],
  ['default', 'Default'],
  ['disarmed', 'disarmed'],
  ['docked', 'docked'],
  ['dry', 'dry'],
  ['eco', 'eco'],
  ['error', 'error'],
  ['fan_only', 'fan_only'],
  ['heat', 'heat'],
  ['heat_cool', 'heat_cool'],
  ['heating', 'heating'],
  ['high', 'high'],
  ['home', 'home'],
  ['idle', 'idle'],
  ['inactive', 'inactive'],
  ['locked', 'locked'],
  ['low', 'low'],
  ['manual', 'Manual'],
  ['max', 'max'],
  ['medium', 'medium'],
  ['min', 'min'],
  ['mop', 'mop'],
  ['normal', 'normal'],
  ['off', 'off'],
  ['on', 'on'],
  ['open', 'open'],
  ['opening', 'opening'],
  ['paused', 'paused'],
  ['pending', 'pending'],
  ['playing', 'playing'],
  ['quiet', 'quiet'],
  ['ready', 'ready'],
  ['returning', 'returning'],
  ['sleep', 'sleep'],
  ['standby', 'standby'],
  ['triggered', 'triggered'],
  ['turbo', 'turbo'],
  ['unlocked', 'unlocked'],
  ['vacuum', 'vacuum'],
  ['vacuum_and_mop', 'vacuum_and_mop'],
  ['vacuum_then_mop', 'vacuum_then_mop'],
])

const ENUM_LIST_PREFIX: Record<string, string> = {
  effect_list: 'Effect',
  fan_modes: 'Mode',
  fan_speed_list: 'Speed',
  hvac_modes: 'Mode',
  options: 'Option',
  preset_modes: 'Preset',
  source_list: 'Source',
  swing_modes: 'Mode',
}

const FORBIDDEN_ATTRIBUTE_KEY_PATTERN = /(?:friendly_name|entity_picture|url|uri|token|secret|password|credential|latitude|longitude|coordinate|gps|device_id|unique_id|serial|mac|vin|product|content|schedule|task|todo|person|description|summary|message|media|image|picture|thumbnail|timestamp|last_|next_)/
const FORBIDDEN_VALUE_PATTERN = /(?:https?:\/\/|rtsp:\/\/|data:|blob:|bearer\s|access[_ -]?token|api[_ -]?key|password|secret|credential|eyJ[A-Za-z0-9_-]{8,}\.|[A-Fa-f0-9]{32,})/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareAscii(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizedEnumToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, '_')
}

function sanitizeDeviceClass(value: unknown) {
  if (typeof value !== 'string') return undefined
  const normalized = normalizedEnumToken(value)
  return SAFE_DEVICE_CLASSES.has(normalized) ? normalized : undefined
}

function sanitizeUnit(value: unknown) {
  if (typeof value !== 'string') return undefined
  const normalized = value
    .trim()
    .replaceAll('\u00b5', 'u')
    .replaceAll('\u00b3', '3')
    .replaceAll('\u00b2', '2')
  return SAFE_UNITS.has(normalized) ? normalized : undefined
}

function sanitizeNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000) return undefined
  return value
}

function sanitizeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function sanitizedEnumValue(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  return SAFE_ENUM_VALUES.get(normalizedEnumToken(value)) ?? fallback
}

function sanitizeEnumList(value: unknown, key: string) {
  if (!Array.isArray(value)) return undefined
  const prefix = ENUM_LIST_PREFIX[key] ?? 'Option'
  const values: string[] = []
  for (const [index, item] of value.slice(0, 16).entries()) {
    const sanitized = key === 'supported_color_modes' && typeof item === 'string' && SAFE_COLOR_MODES.has(item)
      ? item
      : sanitizedEnumValue(item, `${prefix} ${index + 1}`)
    let unique = sanitized
    let suffix = 2
    while (values.includes(unique)) {
      unique = `${sanitized} ${suffix}`
      suffix += 1
    }
    values.push(unique)
  }
  return values.length > 0 ? values : undefined
}

function mappedEnumSelection(rawState: string, rawOptions: unknown, sanitizedOptions: unknown) {
  if (!Array.isArray(rawOptions) || !Array.isArray(sanitizedOptions)) return undefined
  const selectedIndex = rawOptions.findIndex((option) => option === rawState)
  const selected = sanitizedOptions[selectedIndex]
  return typeof selected === 'string' ? selected : undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function numericDefault(entityId: string, attributes: Record<string, unknown>) {
  const min = typeof attributes.min === 'number' ? attributes.min : 0
  const max = typeof attributes.max === 'number' ? attributes.max : 100
  if (/humidity/.test(entityId)) return clamp(45, min, max)
  if (/battery|charge|level/.test(entityId)) return clamp(80, min, max)
  if (/temperature|target_temp/.test(entityId)) return clamp(temperatureDefault(attributes), min, max)
  if (/volume/.test(entityId)) return clamp(25, min, max)
  return clamp(0, min, max)
}

function numberState(value: number) {
  return String(Number(value.toFixed(3)))
}

function temperatureDefault(attributes: Record<string, unknown>) {
  return attributes.temperature_unit === '\u00b0F' || attributes.unit_of_measurement === '\u00b0F' ? 70 : 21
}

function humidityDefault(attributes: Record<string, unknown>) {
  const min = typeof attributes.min_humidity === 'number' ? attributes.min_humidity : 0
  const max = typeof attributes.max_humidity === 'number' ? attributes.max_humidity : 100
  return clamp(45, min, max)
}

function syntheticTextState(entityId: string) {
  if (/color/.test(entityId)) return 'rgba(0, 128, 128, 1)'
  if (/climate_range/.test(entityId)) return '68 F - 72 F'
  if (/range/.test(entityId)) return '0 - 1'
  if (/power_state/.test(entityId)) return 'Off'
  if (/error_message/.test(entityId)) return ''
  if (/mode/.test(entityId)) return 'Default'
  return 'Synthetic value'
}

function syntheticSensorState(entityId: string, attributes: Record<string, unknown>, rawState: LiveHassState) {
  const deviceClass = attributes.device_class
  if (deviceClass === 'timestamp') return '2000-01-01T00:00:00+00:00'
  if (deviceClass === 'date') return '2000-01-01'
  if (deviceClass === 'enum') {
    return mappedEnumSelection(rawState.state, rawState.attributes?.options, attributes.options)
      ?? (Array.isArray(attributes.options) && typeof attributes.options[0] === 'string' ? attributes.options[0] : 'Option 1')
  }
  if (deviceClass === 'temperature' || /temperature|_temp(?:erature)?(?:_|$)/.test(entityId)) return numberState(temperatureDefault(attributes))
  if (deviceClass === 'humidity' || /humidity/.test(entityId)) return '45'
  if (deviceClass === 'battery' || /battery|charge_level/.test(entityId)) return '80'
  if (deviceClass === 'aqi' || /air_quality_index|(?:^|_)aqi(?:_|$)/.test(entityId)) return '1'
  if (deviceClass === 'carbon_dioxide' || /co2|carbon_dioxide/.test(entityId)) return '450'
  if (deviceClass === 'pm1' || deviceClass === 'pm10' || deviceClass === 'pm25' || /pm2?_?5|particulate/.test(entityId)) return '5'
  if (deviceClass === 'signal_strength' || /rssi|signal_strength/.test(entityId)) return '-50'
  if (/door/.test(entityId)) return 'closed'
  if (/lock/.test(entityId)) return 'locked'
  if (/dock_status/.test(entityId)) return 'docked'
  if (/error/.test(entityId)) return 'No error'
  if (/presence|occupancy/.test(entityId)) return 'inactive'
  if (/status|state|phase|action|mode|reason/.test(entityId)) return 'idle'
  if (/count|total|items|progress|remaining|duration|seconds|minutes|hours|days|due|expired|expiring/.test(entityId)) return '0'
  if (typeof attributes.unit_of_measurement === 'string') return '0'
  return 'idle'
}

function syntheticState(liveState: LiveHassState, attributes: Record<string, unknown>) {
  const entityId = liveState.entity_id
  const [domain] = entityId.split('.', 1)
  switch (domain) {
    case 'alarm_control_panel':
      return 'disarmed'
    case 'automation':
    case 'calendar':
    case 'fan':
    case 'humidifier':
    case 'input_boolean':
    case 'light':
    case 'remote':
    case 'schedule':
    case 'scene':
    case 'script':
    case 'siren':
    case 'switch':
    case 'update':
      return 'off'
    case 'binary_sensor':
      return 'off'
    case 'button':
    case 'event':
    case 'image':
    case 'input_button':
      return 'idle'
    case 'camera':
      return 'idle'
    case 'climate': {
      const modes = Array.isArray(attributes.hvac_modes) ? attributes.hvac_modes : []
      return modes.includes('off') ? 'off' : typeof modes[0] === 'string' ? modes[0] : 'off'
    }
    case 'counter':
    case 'zone':
      return '0'
    case 'todo':
      return 'unknown'
    case 'cover':
    case 'valve':
      return 'closed'
    case 'device_tracker':
    case 'person':
      return 'not_home'
    case 'input_datetime':
      if (attributes.has_date && attributes.has_time) return '2000-01-01 00:00:00'
      if (attributes.has_date) return '2000-01-01'
      return '00:00:00'
    case 'input_number':
    case 'number':
      return numberState(numericDefault(entityId, attributes))
    case 'input_select':
    case 'select':
      return mappedEnumSelection(liveState.state, liveState.attributes?.options, attributes.options)
        ?? (Array.isArray(attributes.options) && typeof attributes.options[0] === 'string' ? attributes.options[0] : 'Option 1')
    case 'input_text':
    case 'text':
      return syntheticTextState(entityId)
    case 'lock':
      return 'locked'
    case 'media_player':
      return 'off'
    case 'sensor':
      return syntheticSensorState(entityId, attributes, liveState)
    case 'time':
      return '00:00:00'
    case 'timer':
      return 'idle'
    case 'vacuum':
      return 'docked'
    case 'weather':
      return 'partlycloudy'
    default:
      return 'idle'
  }
}

function syntheticAttributes(liveState: LiveHassState) {
  const entityId = liveState.entity_id
  const [domain] = entityId.split('.', 1)
  const raw = isRecord(liveState.attributes) ? liveState.attributes : {}
  const attributes: Record<string, unknown> = {}

  const deviceClass = sanitizeDeviceClass(raw.device_class)
  if (deviceClass) attributes.device_class = deviceClass
  const unit = sanitizeUnit(raw.unit_of_measurement)
  if (unit) attributes.unit_of_measurement = unit
  const temperatureUnit = sanitizeUnit(raw.temperature_unit)
  if (temperatureUnit) attributes.temperature_unit = temperatureUnit
  if (typeof raw.state_class === 'string' && SAFE_STATE_CLASSES.has(raw.state_class)) attributes.state_class = raw.state_class
  if (typeof raw.mode === 'string') {
    const mode = normalizedEnumToken(raw.mode) === 'password' ? 'text' : normalizedEnumToken(raw.mode)
    if (SAFE_MODES.has(mode)) attributes.mode = mode
  }

  for (const key of [
    'max',
    'max_humidity',
    'max_temp',
    'min',
    'min_humidity',
    'min_temp',
    'percentage_step',
    'step',
    'supported_features',
    'target_temp_step',
  ]) {
    const value = sanitizeNumber(raw[key])
    if (value !== undefined) attributes[key] = value
  }
  for (const key of ['assumed_state', 'editable', 'has_date', 'has_time']) {
    const value = sanitizeBoolean(raw[key])
    if (value !== undefined) attributes[key] = value
  }
  for (const key of ['effect_list', 'fan_modes', 'fan_speed_list', 'hvac_modes', 'options', 'preset_modes', 'source_list', 'supported_color_modes', 'swing_modes']) {
    const values = sanitizeEnumList(raw[key], key)
    if (values) attributes[key] = values
  }

  if (domain === 'climate') {
    attributes.hvac_modes ??= ['off', 'heat', 'cool']
    attributes.hvac_action = 'idle'
    attributes.current_temperature = temperatureDefault(attributes)
    attributes.temperature = temperatureDefault(attributes)
    attributes.target_temp_low = temperatureDefault(attributes) - 2
    attributes.target_temp_high = temperatureDefault(attributes) + 2
  } else if (domain === 'cover' || domain === 'valve') {
    attributes.current_position = 0
    if ('current_tilt_position' in raw) attributes.current_tilt_position = 0
  } else if (domain === 'fan') {
    attributes.percentage = 0
    attributes.percentage_step ??= 1
    if (Array.isArray(attributes.preset_modes)) attributes.preset_mode = attributes.preset_modes[0]
  } else if (domain === 'humidifier') {
    attributes.current_humidity = 45
    attributes.target_humidity = humidityDefault(attributes)
  } else if (domain === 'input_number' || domain === 'number') {
    attributes.min ??= 0
    attributes.max ??= 100
    attributes.step ??= 1
  } else if (domain === 'input_select' || domain === 'select') {
    attributes.options ??= ['Option 1', 'Option 2']
  } else if (domain === 'input_text' || domain === 'text') {
    attributes.mode = 'text'
  } else if (domain === 'light') {
    attributes.supported_color_modes ??= ['brightness']
    attributes.color_mode = Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes[0] : 'brightness'
    attributes.brightness = 0
  } else if (domain === 'media_player') {
    attributes.volume_level = 0.25
    if (Array.isArray(attributes.source_list)) attributes.source = attributes.source_list[0]
  } else if (domain === 'timer') {
    attributes.duration = '0:05:00'
    attributes.remaining = '0:05:00'
  } else if (domain === 'vacuum') {
    attributes.battery_level = 80
    if (Array.isArray(attributes.fan_speed_list)) {
      attributes.fan_speed = attributes.fan_speed_list.includes('balanced') ? 'balanced' : attributes.fan_speed_list[0]
    }
  } else if (domain === 'weather') {
    attributes.temperature_unit ??= '\u00b0F'
    attributes.temperature = temperatureDefault(attributes)
    attributes.humidity = 45
  }

  if (Array.isArray(attributes.effect_list)) attributes.effect = attributes.effect_list[0]
  if (Array.isArray(attributes.fan_modes)) attributes.fan_mode = attributes.fan_modes[0]
  if (Array.isArray(attributes.swing_modes)) attributes.swing_mode = attributes.swing_modes[0]

  return sortedRecord(attributes)
}

export function sanitizeLiveHassState(liveState: LiveHassState): SyntheticMockEntity {
  const attributes = syntheticAttributes(liveState)
  return {
    attributes,
    entity_id: liveState.entity_id,
    state: syntheticState(liveState, attributes),
  }
}

export function buildSyntheticMockEntities(
  appEntityIds: readonly string[],
  explicitEntityIds: ReadonlySet<string>,
  liveStates: readonly LiveHassState[],
) {
  const liveStatesById = new Map(liveStates.map((state) => [state.entity_id, state]))
  const entities: SyntheticMockEntityMap = {}
  const staleEntityIds: string[] = []

  for (const entityId of [...new Set(appEntityIds)].sort()) {
    if (explicitEntityIds.has(entityId)) continue
    const liveState = liveStatesById.get(entityId)
    if (!liveState) {
      staleEntityIds.push(entityId)
      continue
    }
    entities[entityId] = sanitizeLiveHassState(liveState)
  }

  return {
    entities: sortedRecord(entities) as SyntheticMockEntityMap,
    staleEntityIds,
  }
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue)
  if (!isRecord(value)) return value
  return sortedRecord(value)
}

function sortedRecord<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareAscii(left, right))
      .map(([key, item]) => [key, sortedValue(item)]),
  )
}

function asciiJson(value: unknown) {
  return JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

export function serializeSyntheticMockFixture(entities: SyntheticMockEntityMap) {
  const normalized = Object.fromEntries(
    Object.entries(entities)
      .sort(([left], [right]) => compareAscii(left, right))
      .map(([entityId, mockEntity]) => [
        entityId,
        {
          attributes: sortedRecord(mockEntity.attributes),
          entity_id: mockEntity.entity_id,
          state: mockEntity.state,
        },
      ]),
  )
  return `${GENERATED_HEADER}\n\nimport type { MockEntity } from '../hakitCoreState'\n\nexport const generatedMockEntities = ${asciiJson(normalized)} satisfies Record<string, MockEntity>\n`
}

export function syntheticMockAuditErrors(entities: SyntheticMockEntityMap) {
  const errors: string[] = []
  for (const [entityId, mockEntity] of Object.entries(entities)) {
    if (mockEntity.entity_id !== entityId) errors.push(`${entityId}: entity_id does not match its map key`)
    if (mockEntity.state === 'unavailable' || (mockEntity.state === 'unknown' && !entityId.startsWith('todo.'))) errors.push(`${entityId}: state is ${mockEntity.state}`)
    if (FORBIDDEN_VALUE_PATTERN.test(mockEntity.state) && mockEntity.state !== '2000-01-01T00:00:00+00:00') {
      errors.push(`${entityId}: state contains a forbidden value`)
    }
    for (const [key, value] of Object.entries(mockEntity.attributes)) {
      if (!SAFE_ATTRIBUTE_KEYS.has(key) || FORBIDDEN_ATTRIBUTE_KEY_PATTERN.test(key)) {
        errors.push(`${entityId}: forbidden attribute key ${key}`)
      }
      const strings = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? [value] : []
      if (strings.some((item) => FORBIDDEN_VALUE_PATTERN.test(item))) errors.push(`${entityId}: attribute ${key} contains a forbidden value`)
    }
  }
  return errors
}

export function formatEntityDomainCounts(entityIds: readonly string[]) {
  const counts = new Map<string, number>()
  for (const entityId of entityIds) {
    const domain = entityId.split('.', 1)[0] ?? 'unknown'
    counts.set(domain, (counts.get(domain) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => compareAscii(left, right))
    .map(([domain, count]) => `${domain}=${count}`)
    .join(', ')
}
