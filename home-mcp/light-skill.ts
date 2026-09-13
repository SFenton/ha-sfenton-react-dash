import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS, findLightRoom, type HouseLightRoom } from './lights-config'

export const HOME_CHAT_USER_LIMIT = 180

export type LightAction = 'on' | 'off' | 'set' | 'up' | 'down' | 'color' | 'state' | 'count' | 'list' | 'rooms-on' | 'lights-on' | 'color-state' | 'brightness-state' | 'history' | 'reason' | 'pbl' | 'pbl-rules'

export interface LightContext {
  domain: 'lights'
  roomId: string | null
  entityIds: string[]
  lightNames: string[]
  lastAction?: LightAction
  lastState?: 'on' | 'off' | 'mixed' | 'unavailable'
  targetState?: 'on' | 'off'
  historyBefore?: string
}

export type ChatControl =
  | { id: string; kind: 'room-picker'; options: Array<{ label: string; value: string; message: string }> }
  | { id: string; kind: 'color-picker'; room: string; rooms: string[]; palette: string[]; supportsCustomRgb: boolean; colorMode: 'rgb' | 'temperature'; entityIds: string[]; subject?: string; currentRgb?: [number, number, number]; currentTemperatureKelvin?: number; minTemperatureKelvin: number; maxTemperatureKelvin: number }
  | { id: string; kind: 'brightness-slider'; room: string; value: number; min: 0; max: 100; step: 1; subject?: string }
  | { id: string; kind: 'suggestions'; options: Array<{ label: string; message: string }> }

export interface LightOperation {
  action: LightAction
  room: HouseLightRoom
  entityIds: string[]
  lightNames: string[]
  brightnessPct: number | number[] | null
  rgbColor: [number, number, number] | null
  colorName: string | null
  colorTemperatureKelvin: number | null
  historyBefore: string | null
  targetState: 'on' | 'off' | null
}

export interface LightSkillResponse {
  status: 'ready' | 'success' | 'answer' | 'clarify' | 'unsupported' | 'failed' | 'partial'
  text: string
  response: string
  controls: ChatControl[]
  context: LightContext | null
  operations?: LightOperation[]
  data?: Record<string, unknown>
}

export interface LightToolRequest {
  action?: unknown
  room?: unknown
  rooms?: unknown
  entity_ids?: unknown
  light_names?: unknown
  brightness_pct?: unknown
  color_name?: unknown
  rgb_color?: unknown
  color_temperature_kelvin?: unknown
  history_before?: unknown
  target_state?: unknown
  operations?: unknown
}

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
const pct = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const entityId = (value: unknown): value is string => typeof value === 'string' && /^(light|switch)\.[a-z0-9_]+$/.test(value)
const WORD_CHARACTER = /[a-z0-9]/
const ROOM_ALIAS_MATCHES = HOUSE_LIGHT_ROOMS.flatMap((room) => room.aliases.map((alias) => ({
  room,
  phrase: normalize(alias),
})))
const FIXTURE_MATCHES = HOUSE_LIGHT_ROOMS.flatMap((room) => room.lights.flatMap((light) =>
  [light.name, ...(light.aliases ?? [])].map((name) => ({
    room,
    light,
    phrase: normalize(name),
  }))))
const MAX_COMPOUND_LIGHT_OPERATIONS = 12
const MAX_LIGHT_PLAN_OPERATIONS = Math.max(MAX_COMPOUND_LIGHT_OPERATIONS, HOUSE_LIGHT_ROOMS.length)
export const SINGLE_ROOM_DETAIL_RESPONSE = 'Detailed light queries support one room. Ask about one room at a time.'
const MULTI_ROOM_FIXTURE_RESPONSE = 'Unable to change selected lights across multiple rooms at once. Choose one room and try again.'
const SUPPORTED_LIGHT_ACTIONS = new Set<LightAction>([
  'on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'lights-on',
  'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules',
])
const WHOLE_HOME_READ_ACTIONS = new Set<LightAction>(['rooms-on', 'lights-on'])
const RAW_OPERATION_FIELDS = new Set([
  'action', 'room', 'entity_ids', 'light_names', 'brightness_pct', 'color_name',
  'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state',
])
const LIGHT_TOOL_FIELDS = new Set([...RAW_OPERATION_FIELDS, 'operations'])
const WRITE_ACTION_LANGUAGE = /\b(?:turn|switch|put|set|change|adjust|dim|dimmer|brighten|brighter|raise|lower|enable|disable|shut|kill|make|color|colour)\b|\blight up\b/
const NEGATION_LANGUAGE = /\b(?:dont|do not|never|not|shouldnt|couldnt|wouldnt|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|doesnt|didnt)\b/
const META_ACTION_LANGUAGE = /\b(?:ask|remind|reminder|schedule|scheduled|timer|alarm|automation|notification)\b/
const NON_LIGHT_TARGET_LANGUAGE = /\b(?:fan|garage door|door lock|lock|thermostat|vacuum|robot|speaker|television|media player)\b/g
const DIRECT_WRITE_REQUEST = /^(?:(?:(?:please|hey|quickly|for me|when you can)\s*,?\s*)|(?:(?:i need you|i want|id like)\s+to)\s+|(?:(?:can|could|would)\s+you\s+(?:please\s+)?))*(?:turn|switch|put|set|change|adjust|dim|brighten|raise|lower|enable|disable|shut|kill|make|color|colour|light up)\b/
const READ_ONLY_REQUEST = /^(?:(?:(?:please|hey|quickly|for me|when you can)\s*,?\s*)|(?:i need you to)\s+|(?:(?:can|could|would)\s+you\s+))*(?:what|which|who|where|why|how|when(?!\s+you can\b)|is|are|was|were|did|does|do|has|have)\b/
const imperativeClause = (value: string) => value.split(/\b(?:until|while|before|after|if|unless|when|because|since)\b/, 1)[0]

export function parseRgbColor(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((part) => typeof part === 'number' && Number.isFinite(part))) return null
  return value.map((part) => Math.max(0, Math.min(255, Math.round(part)))) as [number, number, number]
}

export function formatNames(names: readonly string[]) {
  if (names.length === 0) return 'lights'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
}

export function roomPickerResponse(action: LightAction = 'state', details: {
  brightnessPct?: number | number[]
  colorName?: string
  colorTemperatureKelvin?: number
  historyBefore?: string
  lightNames?: string[]
  rgbColor?: [number, number, number]
  roomIds?: string[]
  roomLightNames?: Record<string, string[]>
  targetState?: 'on' | 'off'
} = {}): LightSkillResponse {
  const text = 'Which room?'
  const message = (room: HouseLightRoom) => {
    const selectedNames = details.roomLightNames?.[room.id] ?? details.lightNames ?? []
    const target = selectedNames.length
      ? `${formatNames(selectedNames)} in the ${room.name}`
      : `${room.name} lights`
    if (action === 'on') return `Turn on the ${target}.`
    if (action === 'off') return `Turn off the ${target}.`
    if (action === 'up' || action === 'down') {
      const values = Array.isArray(details.brightnessPct) ? details.brightnessPct : [details.brightnessPct]
      if (values.length > 1 && selectedNames.length === values.length) {
        return `Turn the ${formatNames(selectedNames)} in the ${room.name} ${action} by ${formatNames(values.map((value) => `${value}%`))} respectively.`
      }
      const delta = values[0]
      return delta === undefined
        ? `Turn ${action} the ${target}.`
        : `Turn the ${target} ${action} by ${delta}%.`
    }
    if (action === 'set' && Array.isArray(details.brightnessPct) && selectedNames.length === details.brightnessPct.length) {
      return `Turn the ${formatNames(selectedNames)} in the ${room.name} to ${details.brightnessPct.join('% and ')}% respectively.`
    }
    if (action === 'set' && typeof details.brightnessPct === 'number') return `Turn the ${target} to ${details.brightnessPct}%.`
    if (action === 'count') return `How many ${target} are on?`
    if (action === 'list') return `Which ${target} are on?`
    if (action === 'lights-on') return 'Which configured lights are on?'
    if (action === 'color-state') return `What color are the ${target}?`
    if (action === 'brightness-state') return `What is the brightness of the ${target}?`
    if (action === 'history') return `When did the ${target} turn ${details.targetState ?? 'off'}?`
    if (action === 'reason') return `Why did the ${target} turn ${details.targetState ?? 'on'}?`
    if (action === 'pbl' || action === 'pbl-rules') return `Is Presence-Based Lighting active in the ${room.name}?`
    if (action === 'color') {
      if (details.rgbColor) return `Turn the ${target} to rgb(${details.rgbColor.join(', ')}).`
      if (details.colorTemperatureKelvin) return `Turn the ${target} to ${details.colorTemperatureKelvin}K.`
      if (details.colorName) return `Turn the ${target} to ${details.colorName}.`
      return `Change the color of the ${target}.`
    }
    return `Are the ${target} ${details.targetState ?? 'on'}?`
  }
  const options = HOUSE_LIGHT_ROOMS
    .filter((room) => {
      if (details.roomIds?.length && !details.roomIds.includes(room.id)) return false
      const selectedNames = details.roomLightNames?.[room.id] ?? details.lightNames ?? []
      if (selectedNames.length && !selectedNames.every((name) => room.lights.some((light) => light.name === name))) return false
      if (action !== 'color') return true
      if (room.color === 'none') return false
      if (details.colorName && details.colorName in WHITE_COLORS) return true
      if (details.rgbColor || (details.colorName && details.colorName in RGB_COLORS)) return room.color === 'rgb'
      if (details.colorName) return false
      return true
    })
    .flatMap((room) => {
      const optionMessage = message(room)
      return optionMessage.length <= HOME_CHAT_USER_LIMIT
        ? [{ label: room.name, value: room.name, message: optionMessage }]
        : []
    })
  if (!options.length) {
    const response = details.lightNames?.length || details.roomLightNames
      ? MULTI_ROOM_FIXTURE_RESPONSE
      : 'That color is not supported by any configured room.'
    return {
      status: 'unsupported',
      text: response,
      response,
      controls: [],
      context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [], lastAction: action },
    }
  }
  return {
    status: 'clarify', text, response: text,
    controls: [{
      id: `lights-room-picker-${action}`, kind: 'room-picker',
      options,
    }],
    context: {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      lastAction: action,
      ...(details.targetState ? { targetState: details.targetState } : {}),
      ...(details.historyBefore ? { historyBefore: details.historyBefore } : {}),
    },
  }
}

export function colorPickerResponse(roomOrRooms: HouseLightRoom | HouseLightRoom[], targets: { entityIds: string[]; lightNames: string[] } = { entityIds: [], lightNames: [] }): LightSkillResponse {
  const rooms = Array.isArray(roomOrRooms) ? roomOrRooms : [roomOrRooms]
  const room = rooms[0]
  const selected = targets.lightNames.length
    ? `${formatNames(targets.lightNames)} in the ${room.name}`
    : formatNames(rooms.map((candidate) => `${candidate.name} lights`))
  if (rooms.some((candidate) => candidate.color === 'none')) {
    const plural = rooms.length > 1 || targets.lightNames.length !== 1
    const text = `${selected} ${plural ? 'do' : 'does'} not support color control.`
    return {
      status: 'unsupported',
      text,
      response: text,
      controls: [],
      context: {
        domain: 'lights',
        roomId: rooms.length === 1 ? room.id : null,
        entityIds: targets.entityIds,
        lightNames: targets.lightNames,
        lastAction: 'color',
      },
    }
  }
  const text = `What color would you like to change the ${selected} to?`
  const supportsCustomRgb = rooms.every((candidate) => candidate.color === 'rgb')
  const palette = supportsCustomRgb
    ? [...Object.keys(WHITE_COLORS), ...Object.keys(RGB_COLORS)]
    : Object.keys(WHITE_COLORS)
  const entityIds = targets.entityIds.length
    ? targets.entityIds
    : rooms.flatMap((candidate) => candidate.lights.map((light) => light.entityId))
  return {
    status: 'clarify', text, response: text,
    controls: [{
      id: `lights-color-${rooms.map((candidate) => candidate.id).join('-')}`, kind: 'color-picker', room: room.name,
      rooms: rooms.map((candidate) => candidate.name), palette: [...new Set(palette)], supportsCustomRgb,
      colorMode: supportsCustomRgb ? 'rgb' : 'temperature', entityIds,
      subject: targets.lightNames.length || rooms.length > 1 ? selected : undefined,
      minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
    }],
    context: { domain: 'lights', roomId: rooms.length === 1 ? room.id : null, entityIds: targets.entityIds, lightNames: targets.lightNames, lastAction: 'color' },
  }
}

function resolveNamedTargets(room: HouseLightRoom, values: unknown): { entityIds: string[]; lightNames: string[] } {
  const requested = Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
  const found = requested.flatMap((request) => {
    const key = normalize(request)
    return room.lights.filter((light) => [light.name, ...(light.aliases ?? [])].some((name) => normalize(name) === key))
  })
  const unique = [...new Map(found.map((light) => [light.entityId, light])).values()]
  return { entityIds: unique.map((light) => light.entityId), lightNames: unique.map((light) => light.name) }
}

function requestedTargetNames(values: unknown) {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
}

function entityTarget(entityIds: string[]) {
  return entityIds.length ? { entity_ids: entityIds } : {}
}

function namedTargetExists(room: HouseLightRoom, requested: string) {
  const key = normalize(requested)
  return room.lights.some((light) => [light.name, ...(light.aliases ?? [])].some((name) => normalize(name) === key))
}

function parseColor(colorName: unknown, rgbColor: unknown, colorTemperatureKelvin: unknown, room: HouseLightRoom) {
  if (room.color === 'none') return null
  const rgb = parseRgbColor(rgbColor)
  const kelvin = typeof colorTemperatureKelvin === 'number' && Number.isFinite(colorTemperatureKelvin) ? Math.round(colorTemperatureKelvin) : null
  const name = typeof colorName === 'string' ? normalize(colorName) : null
  if (kelvin !== null) return kelvin >= 2000 && kelvin <= 6500
    ? { rgbColor: null, colorName: `${kelvin}K`, colorTemperatureKelvin: kelvin }
    : null
  if (rgb) return room.color === 'rgb'
    ? { rgbColor: rgb, colorName: `rgb(${rgb.join(', ')})`, colorTemperatureKelvin: null }
    : null
  if (!name) return { rgbColor: null, colorName: null, colorTemperatureKelvin: null }
  if (name in WHITE_COLORS) return { rgbColor: null, colorName: name, colorTemperatureKelvin: WHITE_COLORS[name] }
  if (name in RGB_COLORS && room.color === 'rgb') return { rgbColor: RGB_COLORS[name], colorName: name, colorTemperatureKelvin: null }
  return null
}

function toOperation(input: Record<string, unknown>): LightOperation | LightSkillResponse {
  const action = typeof input.action === 'string' ? input.action.toLowerCase() as LightAction : null
  if (!action || !SUPPORTED_LIGHT_ACTIONS.has(action)) {
    const text = 'I need a supported light action.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  const brightnessRaw = input.brightness_pct
  const brightnessPct = Array.isArray(brightnessRaw)
    ? brightnessRaw.map((value) => pct(value as number))
    : typeof brightnessRaw === 'number' ? pct(brightnessRaw) : null
  const pickerBrightness = Array.isArray(brightnessPct) && brightnessPct.length === 1
    ? brightnessPct[0]
    : brightnessPct
  const pickerRgb = input.rgb_color === undefined ? undefined : parseRgbColor(input.rgb_color) ?? undefined
  const pickerKelvin = typeof input.color_temperature_kelvin === 'number'
    ? Math.round(input.color_temperature_kelvin)
    : undefined
  const pickerColorName = typeof input.color_name === 'string' ? normalize(input.color_name) : undefined
  const targetState = input.target_state === 'on' || input.target_state === 'off' ? input.target_state : null
  const historyBefore = typeof input.history_before === 'string' ? input.history_before : null
  const room = findLightRoom(input.room)
  if (!room) {
    if ((Array.isArray(input.entity_ids) && input.entity_ids.length)
      || (Array.isArray(input.light_names) && input.light_names.length)
      || (Array.isArray(pickerBrightness) && pickerBrightness.length > 1)) {
      const text = 'Choose a configured room before selecting fixtures or room-specific values.'
      return { status: 'failed', text, response: text, controls: [], context: null }
    }
    return roomPickerResponse(action, {
      ...(typeof pickerBrightness === 'number' ? { brightnessPct: pickerBrightness } : {}),
      ...(pickerColorName ? { colorName: pickerColorName } : {}),
      ...(pickerRgb ? { rgbColor: pickerRgb } : {}),
      ...(pickerKelvin !== undefined ? { colorTemperatureKelvin: pickerKelvin } : {}),
      ...(targetState ? { targetState } : {}),
      ...(historyBefore ? { historyBefore } : {}),
    })
  }
  const requestedIds = Array.isArray(input.entity_ids) ? input.entity_ids : []
  const explicitIds = requestedIds.filter(entityId)
  const allowedIds = new Set(room.lights.map((light) => light.entityId))
  if (requestedIds.length !== explicitIds.length || explicitIds.some((id) => !allowedIds.has(id))) {
    const text = `Those targets are not configured as ${room.name} lights.`
    return { status: 'unsupported', text, response: text, controls: [], context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] } }
  }
  const requestedNames = requestedTargetNames(input.light_names)
  const missingNames = requestedNames.filter((name) => !namedTargetExists(room, name))
  if (missingNames.length) {
    const text = `I could not find ${formatNames(missingNames)} in the ${room.name} light configuration.`
    return { status: 'unsupported', text, response: text, controls: [], context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] } }
  }
  const named = resolveNamedTargets(room, input.light_names)
  if (explicitIds.length && requestedNames.length && (
    explicitIds.length !== named.entityIds.length || explicitIds.some((id, index) => id !== named.entityIds[index])
  )) {
    const text = 'The entity and light-name selectors do not identify the same configured targets.'
    return { status: 'unsupported', text, response: text, controls: [], context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] } }
  }
  const entityIds = explicitIds.length ? explicitIds : named.entityIds
  const lights = entityIds.flatMap((id) => room.lights.find((light) => light.entityId === id) ?? [])
  const lightNames = lights.map((light) => light.name)
  if (room.dimmable === false && ['set', 'up', 'down'].includes(action)) {
    const text = `The ${room.name} light does not support brightness control.`
    return { status: 'unsupported', text, response: text, controls: [], context: { domain: 'lights', roomId: room.id, entityIds, lightNames } }
  }
  const color = parseColor(input.color_name, input.rgb_color, input.color_temperature_kelvin, room)
  if ((action === 'color' || input.color_name !== undefined || input.rgb_color !== undefined || input.color_temperature_kelvin !== undefined) && !color) {
    const text = `That color is unsupported in the ${room.name}.`
    return { status: 'unsupported', text, response: text, controls: [], context: { domain: 'lights', roomId: room.id, entityIds, lightNames } }
  }
  if (action === 'color' && color && !color.colorName) return colorPickerResponse(room, { entityIds, lightNames })
  return {
    action, room, entityIds, lightNames, brightnessPct,
    rgbColor: color?.rgbColor ?? null,
    colorName: color?.colorName ?? null,
    colorTemperatureKelvin: color?.colorTemperatureKelvin ?? null,
    historyBefore, targetState,
  }
}

function rawOperationError(input: Record<string, unknown>, requireRoom: boolean) {
  const unknownField = Object.keys(input).find((field) => !RAW_OPERATION_FIELDS.has(field))
  if (unknownField) return `unknown field ${unknownField}`
  if (input.action !== undefined && (typeof input.action !== 'string'
    || !SUPPORTED_LIGHT_ACTIONS.has(input.action.toLowerCase() as LightAction))) return 'unsupported action'
  if (requireRoom && typeof input.room !== 'string') return 'room must be a string'
  if (input.room !== undefined && typeof input.room !== 'string') return 'room must be a string'
  if (input.entity_ids !== undefined && (
    !Array.isArray(input.entity_ids) || input.entity_ids.length < 1 || !input.entity_ids.every(entityId)
  )) return 'entity_ids must be a non-empty configured-entity array'
  if (input.light_names !== undefined && (
    !Array.isArray(input.light_names) || input.light_names.length < 1
    || !input.light_names.every((name) => typeof name === 'string' && name.trim())
  )) return 'light_names must be a non-empty string array'
  const brightness = input.brightness_pct
  if (brightness !== undefined && !(
    typeof brightness === 'number' && Number.isFinite(brightness) && brightness >= 0 && brightness <= 100
    || Array.isArray(brightness) && brightness.length >= 1 && brightness.length <= MAX_COMPOUND_LIGHT_OPERATIONS
      && brightness.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
  )) return 'brightness_pct must contain only values from 0 to 100'
  if (input.rgb_color !== undefined && (
    !Array.isArray(input.rgb_color) || input.rgb_color.length !== 3
    || !input.rgb_color.every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255)
  )) return 'rgb_color must contain exactly three integer channels from 0 to 255'
  if (input.color_name !== undefined && (typeof input.color_name !== 'string' || !input.color_name.trim())) {
    return 'color_name must be a non-empty string'
  }
  if (input.color_temperature_kelvin !== undefined && (
    typeof input.color_temperature_kelvin !== 'number' || !Number.isFinite(input.color_temperature_kelvin)
    || input.color_temperature_kelvin < 2000 || input.color_temperature_kelvin > 6500
  )) return 'color_temperature_kelvin must be from 2000 to 6500'
  if (input.history_before !== undefined && (
    typeof input.history_before !== 'string' || Number.isNaN(Date.parse(input.history_before))
  )) return 'history_before must be a valid timestamp'
  if (input.target_state !== undefined && input.target_state !== 'on' && input.target_state !== 'off') {
    return 'target_state must be on or off'
  }
  if (typeof input.action === 'string' && SUPPORTED_LIGHT_ACTIONS.has(input.action.toLowerCase() as LightAction)) {
    const action = input.action.toLowerCase() as LightAction
    const allowed = new Set<string>(['action', 'room'])
    if (!['rooms-on', 'lights-on', 'pbl', 'pbl-rules'].includes(action)) {
      allowed.add('entity_ids')
      allowed.add('light_names')
    }
    if (['set', 'up', 'down'].includes(action)) allowed.add('brightness_pct')
    if (action === 'color') {
      allowed.add('color_name')
      allowed.add('rgb_color')
      allowed.add('color_temperature_kelvin')
    }
    if (['state', 'history', 'reason'].includes(action)) allowed.add('target_state')
    if (['history', 'reason'].includes(action)) allowed.add('history_before')
    const incompatible = Object.keys(input)
      .find((field) => input[field] !== undefined && RAW_OPERATION_FIELDS.has(field) && !allowed.has(field))
    if (incompatible) return `${incompatible} is not supported for ${action}`
    if (action === 'set' && input.brightness_pct === undefined) return 'set requires brightness_pct'
    if (action === 'color' && [input.color_name, input.rgb_color, input.color_temperature_kelvin]
      .filter((value) => value !== undefined).length > 1) return 'color accepts only one color representation'
  }
  return null
}

function isCompleteWholeHomeRead(operations: readonly LightOperation[]) {
  const action = operations[0]?.action
  return Boolean(action && WHOLE_HOME_READ_ACTIONS.has(action)
    && operations.length === HOUSE_LIGHT_ROOMS.length
    && operations.every((operation, index) => operation.action === action
      && operation.room.id === HOUSE_LIGHT_ROOMS[index].id
      && operation.entityIds.length === 0
      && operation.lightNames.length === 0
      && operation.brightnessPct === null
      && operation.rgbColor === null
      && operation.colorName === null
      && operation.colorTemperatureKelvin === null
      && operation.historyBefore === null
      && operation.targetState === null))
}

export function buildLightPlan(args: LightToolRequest): LightSkillResponse {
  const argumentRecord = args as Record<string, unknown>
  const unknownField = Object.keys(argumentRecord)
    .find((field) => argumentRecord[field] !== undefined && !LIGHT_TOOL_FIELDS.has(field))
  if (unknownField) {
    const text = `Unknown light request field: ${unknownField}.`
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  if (args.operations !== undefined && !Array.isArray(args.operations)) {
    const text = 'Light operations must be an array.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  if (Array.isArray(args.operations) && [
    args.action, args.room, args.rooms, args.entity_ids, args.light_names, args.brightness_pct,
    args.color_name, args.rgb_color, args.color_temperature_kelvin, args.history_before, args.target_state,
  ].some((value) => value !== undefined)) {
    const text = 'Use either top-level light fields or operations, not both.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  const directAction = typeof args.action === 'string' ? args.action.toLowerCase() as LightAction : null
  if (!Array.isArray(args.operations) && directAction && WHOLE_HOME_READ_ACTIONS.has(directAction)) {
    const hasNarrowing = [
      args.room, args.rooms, args.entity_ids, args.light_names, args.brightness_pct,
      args.color_name, args.rgb_color, args.color_temperature_kelvin, args.history_before, args.target_state,
    ].some((value) => value !== undefined && value !== null)
    if (hasNarrowing) {
      const text = 'Whole-home light reads cannot be narrowed to a room, fixture, or value.'
      return { status: 'failed', text, response: text, controls: [], context: null }
    }
    return buildLightPlan({
      operations: HOUSE_LIGHT_ROOMS.map((room) => ({ action: directAction, room: room.name })),
    })
  }
  if (Array.isArray(args.operations) && (args.operations.length < 1 || args.operations.length > MAX_LIGHT_PLAN_OPERATIONS)) {
    const text = `A light request can contain between 1 and ${MAX_LIGHT_PLAN_OPERATIONS} operations.`
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  if (Array.isArray(args.operations) && !args.operations.every((operation) =>
    Boolean(operation) && typeof operation === 'object' && !Array.isArray(operation))) {
    const text = 'Each light operation must be an object.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  if (Array.isArray(args.operations)) {
    const rawOperations = args.operations as Record<string, unknown>[]
    const aggregateAction = typeof rawOperations[0]?.action === 'string'
      ? rawOperations[0].action.toLowerCase() as LightAction
      : null
    if (aggregateAction && WHOLE_HOME_READ_ACTIONS.has(aggregateAction)) {
      const valueFields = [
        'entity_ids', 'light_names', 'brightness_pct', 'color_name', 'rgb_color',
        'color_temperature_kelvin', 'history_before', 'target_state',
      ]
      const completeRawAggregate = rawOperations.length === HOUSE_LIGHT_ROOMS.length
        && rawOperations.every((operation, index) => {
          const action = typeof operation.action === 'string' ? operation.action.toLowerCase() : null
          const room = findLightRoom(operation.room)
          return action === aggregateAction && room?.id === HOUSE_LIGHT_ROOMS[index].id
            && valueFields.every((field) => !Object.hasOwn(operation, field))
        })
      if (!completeRawAggregate) {
        const text = 'Whole-home light reads must include every configured room exactly once without fixture targets or values.'
        return { status: 'failed', text, response: text, controls: [], context: null }
      }
    }
  }
  const rawOperations = Array.isArray(args.operations)
    ? args.operations as Record<string, unknown>[]
    : [{
        action: args.action, room: args.room, entity_ids: args.entity_ids, light_names: args.light_names,
        brightness_pct: args.brightness_pct, color_name: args.color_name, rgb_color: args.rgb_color,
        color_temperature_kelvin: args.color_temperature_kelvin, history_before: args.history_before, target_state: args.target_state,
      }]
  for (const raw of rawOperations) {
    const error = rawOperationError(raw, Array.isArray(args.operations))
    if (error) {
      const text = `Invalid light operation: ${error}.`
      const status = error.startsWith('rgb_color') || error.startsWith('color_temperature_kelvin')
        ? 'unsupported'
        : 'failed'
      return { status, text, response: text, controls: [], context: null }
    }
  }
  const operations: LightOperation[] = []
  for (const raw of rawOperations) {
    const result = toOperation(raw)
    if ('status' in result) return result
    operations.push(result)
  }
  if (!operations.length) return roomPickerResponse()
  const completeWholeHomeRead = isCompleteWholeHomeRead(operations)
  if (operations.some((operation) => WHOLE_HOME_READ_ACTIONS.has(operation.action)) && !completeWholeHomeRead) {
    const text = 'Whole-home light reads must include every configured room exactly once without fixture targets.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  if (operations.length > MAX_COMPOUND_LIGHT_OPERATIONS && !completeWholeHomeRead) {
    const text = `A light request can contain between 1 and ${MAX_COMPOUND_LIGHT_OPERATIONS} operations.`
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  const last = operations.at(-1)!
  const text = 'I’m ready to update those lights.'
  return {
    status: 'ready', text, response: text, controls: [], operations,
    context: {
      domain: 'lights',
      roomId: last.room.id,
      entityIds: last.entityIds,
      lightNames: last.lightNames,
      lastAction: last.action,
      ...(last.targetState ? { targetState: last.targetState } : {}),
    },
  }
}

function phrasePositions(text: string, phrase: string) {
  const positions: number[] = []
  let from = 0
  while (from <= text.length - phrase.length) {
    const position = text.indexOf(phrase, from)
    if (position < 0) break
    const before = position > 0 ? text[position - 1] : ''
    const after = position + phrase.length < text.length ? text[position + phrase.length] : ''
    if ((!before || !WORD_CHARACTER.test(before)) && (!after || !WORD_CHARACTER.test(after))) positions.push(position)
    from = position + Math.max(1, phrase.length)
  }
  return positions
}

function fixtureSpansInText(text: string) {
  const normalized = normalize(text)
  const matches = FIXTURE_MATCHES.flatMap(({ room, light, phrase }) => phrasePositions(normalized, phrase)
    .filter((position) => !(phrase.endsWith('right') && normalized.slice(position, position + phrase.length + 4) === `${phrase} now`))
    .map((position) => ({ room, light, phrase, start: position, end: position + phrase.length })))
  const selectedSpans: Array<{ start: number; end: number }> = []
  for (const match of [...matches].sort((left, right) => (right.end - right.start) - (left.end - left.start) || left.start - right.start)) {
    if (selectedSpans.some((span) => match.start < span.end && match.end > span.start)) continue
    selectedSpans.push({ start: match.start, end: match.end })
  }
  return matches.filter((match) => selectedSpans.some((span) => span.start === match.start && span.end === match.end))
    .sort((left, right) => left.start - right.start)
}

function fixturePickerDetails(text: string) {
  const matches = fixtureSpansInText(text)
  if (!matches.length) return null
  const requestedPhrases = [...new Set(matches.map((match) => match.phrase))]
  const candidateRooms = [...new Map(matches.map((match) => [match.room.id, match.room])).values()]
    .filter((room) => requestedPhrases.every((phrase) =>
      matches.some((match) => match.room.id === room.id && match.phrase === phrase)))
  return {
    roomIds: candidateRooms.map((room) => room.id),
    roomLightNames: Object.fromEntries(candidateRooms.map((room) => [
      room.id,
      requestedPhrases.flatMap((phrase) => {
        const match = matches.find((candidate) => candidate.room.id === room.id && candidate.phrase === phrase)
        return match ? [match.light.name] : []
      }),
    ])),
  }
}

function roomsInText(text: string) {
  const normalized = normalize(text)
  const fixtureSpans = fixtureSpansInText(normalized)
  const rawMatches = ROOM_ALIAS_MATCHES.flatMap(({ room, phrase }) =>
    phrasePositions(normalized, phrase).map((position) => ({ room, alias: phrase, position })))
  const matches = rawMatches
    .filter((match) => !fixtureSpans.some((span) => span.room.id !== match.room.id
      && match.position >= span.start && match.position + match.alias.length <= span.end
      && rawMatches.some((other) => other.room.id !== match.room.id
        && (other.position < span.start || other.position + other.alias.length > span.end))))
    .sort((left, right) => right.alias.length - left.alias.length || left.position - right.position)
  const occupied: Array<[number, number]> = []
  const rooms: HouseLightRoom[] = []
  for (const match of matches) {
    const span: [number, number] = [match.position, match.position + match.alias.length]
    if (occupied.some(([start, end]) => span[0] >= start && span[1] <= end)) continue
    occupied.push(span)
    if (!rooms.includes(match.room)) rooms.push(match.room)
  }
  const ordered = rooms.sort((left, right) => {
    const leftPosition = Math.min(...ROOM_ALIAS_MATCHES.filter((match) => match.room.id === left.id).flatMap((match) => phrasePositions(normalized, match.phrase)))
    const rightPosition = Math.min(...ROOM_ALIAS_MATCHES.filter((match) => match.room.id === right.id).flatMap((match) => phrasePositions(normalized, match.phrase)))
    return leftPosition - rightPosition
  })
  return ordered
}

function targetsInText(room: HouseLightRoom, text: string) {
  const normalized = normalize(text)
  const temporalRightNow = /\bright now\b/.test(normalized)
  const recognizedFixtureSpans = fixtureSpansInText(normalized)
  const findScopes = (phrases: string[]) => phrases.flatMap((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...normalized.matchAll(new RegExp(`\\b(?:in|inside|of|on)\\s+(?:the\\s+)?${escaped}\\b`, 'g'))]
      .flatMap((match) => {
        if (match.index === undefined) return []
        if (match[0].startsWith('on ') && !recognizedFixtureSpans.some((fixture) =>
          fixture.end <= match.index! && !normalized.slice(fixture.end, match.index).trim())) return []
        return [{ start: match.index, end: match.index + match[0].length }]
      })
  })
  const uniqueScopes = (scopes: Array<{ start: number; end: number }>) => scopes
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((scope, index, ordered) => !ordered.slice(0, index)
      .some((candidate) => candidate.start <= scope.start && candidate.end >= scope.end))
  const roomScopes = uniqueScopes(findScopes(room.aliases.map(normalize)))
  const allScopes = uniqueScopes(ROOM_ALIAS_MATCHES.flatMap(({ phrase }) =>
    phrasePositions(normalized, phrase)
      .map((start) => ({ start, end: start + phrase.length }))
      .filter((scope) => !recognizedFixtureSpans
        .some((fixture) => scope.start >= fixture.start && scope.end <= fixture.end))))
  const targetText = roomScopes.length
    ? roomScopes.map((currentScope) => {
        const previousScopeEnd = Math.max(-1, ...allScopes
          .filter((scope) => scope.end < currentScope.start)
          .map((scope) => scope.end))
        const separators = previousScopeEnd >= 0
          ? [
              { position: normalized.indexOf(',', previousScopeEnd), width: 1 },
              { position: normalized.indexOf(';', previousScopeEnd), width: 1 },
              { position: normalized.indexOf('.', previousScopeEnd), width: 1 },
              { position: normalized.indexOf(' and ', previousScopeEnd), width: 5 },
            ].filter((separator) => separator.position >= previousScopeEnd && separator.position < currentScope.start)
          : []
        const separator = separators.sort((left, right) => left.position - right.position)[0]
        const targetStart = separator ? separator.position + separator.width : 0
        return normalized.slice(targetStart, currentScope.start)
      }).join(' ')
    : normalized
  const positioned = new Map<string, { light: HouseLightRoom['lights'][number]; position: number; tie: number }>()
  const add = (light: HouseLightRoom['lights'][number], position: number, tie = 0) => {
    const existing = positioned.get(light.entityId)
    if (!existing || position < existing.position) positioned.set(light.entityId, { light, position, tie })
  }
  if (room.id === 'living-room') {
    const groups = [
      { phrases: ['front two', 'two front'], prefix: 'front ' },
      { phrases: ['back two', 'two back', 'rear two'], prefix: 'back ' },
    ]
    for (const group of groups) {
      const position = Math.min(...group.phrases.flatMap((phrase) => phrasePositions(targetText, phrase)), Number.POSITIVE_INFINITY)
      if (Number.isFinite(position)) room.lights.filter((light) => normalize(light.name).startsWith(group.prefix)).forEach((light, tie) => add(light, position, tie))
    }
  }
  for (const light of room.lights) {
    const positions = FIXTURE_MATCHES
      .filter((match) => match.room.id === room.id && match.light.entityId === light.entityId)
      .filter((match) => !(temporalRightNow && match.phrase.endsWith('right')
        && phrasePositions(targetText, `${match.phrase} now`).length > 0))
      .flatMap((match) => phrasePositions(targetText, match.phrase))
    if (positions.length) add(light, Math.min(...positions))
  }
  const lights = [...positioned.values()].sort((left, right) => left.position - right.position || left.tie - right.tie).map(({ light }) => light)
  return { entityIds: lights.map((light) => light.entityId), lightNames: lights.map((light) => light.name) }
}

function targetsFromContext(room: HouseLightRoom, context: LightContext) {
  const allowedIds = new Set(room.lights.map((light) => light.entityId))
  const named = resolveNamedTargets(room, context.lightNames)
  const entityIds = [...new Set([
    ...context.entityIds.filter((id) => allowedIds.has(id)),
    ...named.entityIds,
  ])]
  const lights = entityIds.flatMap((id) => room.lights.find((light) => light.entityId === id) ?? [])
  return { entityIds, lightNames: lights.map((light) => light.name) }
}

function hasUnknownNamedLightTarget(text: string, fixtureMatches: ReturnType<typeof fixtureSpansInText>) {
  const normalized = normalize(text)
  return [...normalized.matchAll(/\blights?\b/g)].some((match) => {
    if (match.index === undefined) return false
    const start = match.index
    const end = start + match[0].length
    const fixtureAdjacent = fixtureMatches.some((fixture) =>
      fixture.start <= start && fixture.end >= end
      || fixture.end <= start && !normalized.slice(fixture.end, start).trim())
    if (fixtureAdjacent) return false
    const roomAdjacent = ROOM_ALIAS_MATCHES.some(({ phrase }) =>
      phrasePositions(normalized, phrase).some((position) =>
        position + phrase.length <= start && !normalized.slice(position + phrase.length, start).trim()))
    if (roomAdjacent) return false
    const before = normalized.slice(0, start).trim()
    return !/\b(?:the|all|any|some|which|what|each|every|these|those|my|our|your|many|front two|two front|back two|two back|rear two)$/.test(before)
  })
}

function hasNonLightTarget(text: string, fixtureMatches: ReturnType<typeof fixtureSpansInText>) {
  return [...text.matchAll(NON_LIGHT_TARGET_LANGUAGE)].some((match) => {
    if (match.index === undefined) return false
    const end = match.index + match[0].length
    return !fixtureMatches.some((fixture) => match.index! >= fixture.start && end <= fixture.end)
  })
}

function isCompactLightTarget(text: string) {
  const normalized = normalize(text).replace(/[.?!]+$/, '').replace(/\b(?:on|off)$/, '').trim()
  const spans = [
    ...fixtureSpansInText(normalized).map(({ start, end }) => ({ start, end })),
    ...ROOM_ALIAS_MATCHES.flatMap(({ phrase }) =>
      phrasePositions(normalized, phrase).map((start) => ({ start, end: start + phrase.length }))),
  ].sort((left, right) => right.start - left.start || right.end - left.end)
  let remainder = normalized
  for (const span of spans) remainder = `${remainder.slice(0, span.start)} ${remainder.slice(span.end)}`
  remainder = remainder
    .replace(/\b(?:the|and|or|in|inside|of|on|lights?|lighting)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return remainder.length === 0
}

function actionSegments(text: string): string[] | null {
  const commandText = text.replace(/^(?:please|hey|quickly|for me|when you can)\s*,\s*/i, '')
  if (/(?:\band\s+(?:then\s+)?|\bthen\s+|[,;:]\s*)(?:(?:quickly|slowly|just|immediately|now|please)\s+)*(?:on|off)\b/i.test(commandText)) return null
  if (/(?:\band\s+|[,;:]\s+(?:and\s+)?)(?:are|is|was|were|will|may|might|should|could|would|can|do|does|did|has|have|remain|stay)\b/i.test(commandText)) return null
  if (/[,;:\u2013\u2014-]\s*(?:the\s+)?[^,;:.!?]*?\b(?:lights?|lighting)\s+(?:(?:is|are|was|were|will be)\s+|(?:remain|stay)\s+)(?:on|off)\b/i.test(commandText)) return null
  const sentences = commandText.split(/\s*[.;!?]\s*(?=\S)/)
  if (sentences.length > 1) return null
  const explicit = commandText.split(/(?:\s+and\s+(?:then\s+)?|\s+then\s+|\s*[,:\u2013\u2014-]\s*(?:then\s+)?)(?=(?:turn|switch|put|enable|shut|disable|kill|set|dim|brighten|raise|lower|change|adjust|make|light\s+up)\b)/gi)
  if (explicit.length > 1) return explicit.every((segment) => actionForSegment(segment)) ? explicit : null
  const compact = commandText.split(/\s+and\s+(?=(?:the\s+)?[^.?!,;]*?\b(?:on|off)(?:\s+and\s+|[.?!]*$))/gi)
  if (compact.length > 1 && compact.slice(1).some((segment) => {
    const value = normalize(segment)
    return !/\b(?:on|off)[.?!]*$/.test(value)
      || !isCompactLightTarget(value)
  })) return null
  const expanded = compact.map((segment, index) => index === 0 ? segment : `turn ${segment}`)
  return expanded.length > 1 && expanded.every((segment) => actionForSegment(segment)) ? expanded : [commandText]
}

function actionForSegment(segment: string): LightAction | null {
  const value = normalize(segment)
  if (/\b(turn|switch|shut)\b.*\boff\b|\b(disable|kill)\b/.test(value)) return 'off'
  if (/\bto\s+\d{1,3}\s*%/.test(value)) return 'set'
  if (/\b\d{4}\s*k(?:elvin)?\b/.test(value)) return 'color'
  if (/\b(turn|switch|put)\b.*\bon\b|\benable\b|\blight up\b/.test(value)) return 'on'
  if (/\b(color|colour|rgb)\b/.test(value) || namedColorInText(value)) return 'color'
  if (/\bturn\b.*\bup\b|\braise\b|\bbrighten\b|\bbrighter\b/.test(value)) return 'up'
  if (/\bturn\b.*\bdown\b|\blower\b|\bdim\b|\bdimmer\b/.test(value)) return 'down'
  return null
}

function colorInText(text: string) {
  const rgb = text.match(/rgb\s*\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)/i)
    ?? text.match(/\b(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\b/)
  if (rgb) return { rgb_color: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] }
  const kelvin = text.match(/\b(\d{4})\s*k(?:elvin)?\b/i)
  if (kelvin) return { color_temperature_kelvin: Number(kelvin[1]) }
  const normalized = normalize(text)
  const name = namedColorInText(normalized)
  return name ? { color_name: name } : {}
}

const WHOLE_HOME_QUERY_PREFIXES = new Set([
  '', 'please', 'tell me', 'please tell me', 'can you', 'could you', 'would you',
  'can you tell me', 'could you tell me', 'would you tell me', 'hey tell me',
  'quickly tell me', 'for me tell me', 'when you can tell me', 'i need to know',
  'i want to know', 'let me know', 'check and tell me', 'take a look and tell me',
  'please check', 'can you check', 'could you check', 'would you check', 'check',
  'show me', 'please show me', 'can you show me', 'could you show me', 'would you show me',
  'list', 'please list',
  'in the house', 'throughout the house', 'across the home',
])
const WHOLE_HOME_QUERY_CONTEXTS = new Set([
  '', 'right now', 'at the moment', 'in the house', 'in my house', 'throughout the house',
  'throughout the home', 'across the house', 'across the home', 'before i change anything',
  'based on the latest state', 'according to home assistant', 'while i am checking',
  'as a quick status check', 'at present', 'currently', 'before we leave',
  'while we are home', 'for a quick overview',
])
const WHOLE_HOME_QUERY_CLOSERS = new Set([
  '', 'please', 'for me', 'right now', 'when you can', 'thanks', 'if you can',
])
const CONFIGURED_ROOM_QUERY_SCOPES = new Set(HOUSE_LIGHT_ROOMS.flatMap((room) =>
  room.aliases.flatMap((alias) => {
    const roomName = normalize(alias)
    return ['in', 'inside', 'of', 'on', 'at'].flatMap((preposition) => [
      `${preposition} ${roomName}`,
      `${preposition} the ${roomName}`,
    ])
  })))
const WHOLE_HOME_LIGHTS_ON_PATTERNS = [
  /\b(?:what|which)\s+(?:configured\s+)?lights?\s+(?:are\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
  /\b(?:what|which)\s+(?:configured\s+)?lights?\s+(?:(?:have|had)\s+been\s+|were\s+)?left\s+on\b/,
  /\bare\s+any\s+(?:configured\s+)?lights?\s+(?:currently\s+)?on\b/,
  /\bdo\s+we\s+have\s+any\s+(?:configured\s+)?lights?\s+(?:currently\s+)?on\b/,
  /\b(?:whether|if)\s+(?:we\s+have\s+)?any\s+(?:configured\s+)?lights?\s+(?:are\s+)?(?:currently\s+)?on\b/,
  /\b(?:list|show)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:configured\s+)?lights?\s+(?:that\s+are\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
]
const WHOLE_HOME_LIGHTS_ON_CANDIDATES = [
  /\b(?:what|which)\s+(?:[a-z0-9]+\s+){0,4}lights?\s+(?:are\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
  /\b(?:what|which)\s+lights?\s+(?:in|inside|of|on)\s+(?:the\s+)?(?:[a-z0-9]+\s+){1,4}(?:are\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
  /\bare\s+any\s+(?:[a-z0-9]+\s+){0,4}lights?\s+(?:currently\s+)?on\b/,
  /\bdo\s+we\s+have\s+any\s+(?:[a-z0-9]+\s+){0,4}lights?\s+(?:currently\s+)?on\b/,
  /\b(?:whether|if)\s+(?:we\s+have\s+)?any\s+(?:[a-z0-9]+\s+){0,4}lights?\s+(?:are\s+)?(?:currently\s+)?on\b/,
  /\b(?:list|show)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:[a-z0-9]+\s+){0,4}lights?\s+(?:that\s+are\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
]
const WHOLE_HOME_LIGHTS_ON_SCOPED_PATTERNS = [
  /\b(?:what|which)\s+lights?\s+(?:in|inside|of|on)\s+(?:the\s+)?([a-z0-9]+(?:\s+[a-z0-9]+){0,4}?)\s+are\s+(?:currently\s+)?(?:on|switched\s+on)\b/,
  /\bare\s+any\s+lights?\s+(?:in|inside|of|on)\s+(?:the\s+)?([a-z0-9]+(?:\s+[a-z0-9]+){0,4}?)\s+(?:currently\s+)?on\b/,
]
const WHOLE_HOME_ROOMS_ON_PATTERNS = [
  /\b(?:what|which)\s+rooms?\s+(?:still\s+)?(?:currently\s+)?(?:have|has)\s+(?:any\s+|their\s+)?lights?\s+(?:still\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
  /\b(?:what|which)\s+rooms?\s+lights?\s+(?:are\s+)?(?:still\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
]
const WHOLE_HOME_ROOMS_ON_CANDIDATES = [
  /\b(?:what|which)\s+rooms?\b.*\blights?\b.*\bon\b/,
]
const WHOLE_HOME_ROOMS_ON_SCOPED_PATTERNS = [
  /\b(?:what|which)\s+rooms?\s+(?:in|inside|of|across|throughout)\s+(?:the\s+)?([a-z0-9]+(?:\s+[a-z0-9]+){0,4}?)\s+(?:still\s+)?(?:have|has)\s+(?:any\s+|their\s+)?lights?\s+(?:still\s+)?(?:currently\s+)?(?:on|switched\s+on)\b/,
]

function wholeHomeQueryIntent(
  text: string,
  patterns: readonly RegExp[],
  candidates: readonly RegExp[],
  explicitRooms: readonly HouseLightRoom[],
  scopedPatterns: readonly RegExp[] = [],
): 'whole-home' | 'configured-room' | 'scoped' | null {
  const query = normalize(text).replace(/[?!.:,]+/g, ' ').replace(/\s+/g, ' ').trim()
  const validSuffix = (suffix: string) => [...WHOLE_HOME_QUERY_CONTEXTS].some((context) =>
    [...WHOLE_HOME_QUERY_CLOSERS].some((closer) => [context, closer].filter(Boolean).join(' ') === suffix))
  const validPrefix = (prefix: string) => WHOLE_HOME_QUERY_PREFIXES.has(prefix)
    || ['in the house', 'throughout the house', 'throughout the home', 'across the house', 'across the home']
      .some((scope) => prefix.startsWith(`${scope} `) && WHOLE_HOME_QUERY_PREFIXES.has(prefix.slice(scope.length + 1)))
  const configuredPrefix = (prefix: string) => [...CONFIGURED_ROOM_QUERY_SCOPES].some((scope) =>
    prefix === scope || (prefix.startsWith(`${scope} `) && WHOLE_HOME_QUERY_PREFIXES.has(prefix.slice(scope.length + 1))))
  const configuredScopeExpression = (value: string) => {
    const suffixes = [...WHOLE_HOME_QUERY_CONTEXTS].flatMap((context) =>
      [...WHOLE_HOME_QUERY_CLOSERS].map((closer) => [context, closer].filter(Boolean).join(' ')))
      .sort((left, right) => right.length - left.length)
    for (const suffix of suffixes) {
      if (suffix && value !== suffix && !value.endsWith(` ${suffix}`)) continue
      let scope = suffix ? value.slice(0, -(suffix.length)).trim() : value
      const matches = explicitRooms.flatMap((room) => room.aliases.flatMap((alias) => {
        const phrase = normalize(alias)
        return phrasePositions(scope, phrase).map((start) => ({
          roomId: room.id,
          start,
          end: start + phrase.length,
        }))
      })).sort((left, right) => (right.end - right.start) - (left.end - left.start) || left.start - right.start)
      const selected: typeof matches = []
      for (const match of matches) {
        if (!selected.some((other) => match.start < other.end && match.end > other.start)) selected.push(match)
      }
      const matchedRooms = new Set(selected.map((match) => match.roomId))
      for (const match of [...selected].sort((left, right) => right.start - left.start)) {
        scope = `${scope.slice(0, match.start)} ${scope.slice(match.end)}`
      }
      const remainder = scope.replace(/\s+/g, ' ').trim()
      if (matchedRooms.size === explicitRooms.length && explicitRooms.length > 0
        && (!remainder || remainder.split(' ').every((word) => ['in', 'inside', 'of', 'on', 'at', 'the', 'and', 'or'].includes(word)))) {
        return true
      }
    }
    return false
  }
  const classifications: Array<'whole-home' | 'configured-room' | 'scoped'> = []
  for (const pattern of scopedPatterns) {
    const match = pattern.exec(query)
    if (!match) continue
    const prefix = query.slice(0, match.index).trim()
    const suffix = query.slice(match.index + match[0].length).trim()
    if (!validPrefix(prefix) || !validSuffix(suffix)) {
      classifications.push('scoped')
      continue
    }
    const scope = match[1]
    classifications.push(['home', 'house', 'whole home', 'whole house'].includes(scope)
      ? 'whole-home'
      : HOUSE_LIGHT_ROOMS.some((room) => room.aliases.some((alias) => normalize(alias) === scope))
        ? 'configured-room'
        : 'scoped')
  }
  const exactIntent = (value: string): 'whole-home' | 'configured-room' | 'scoped' | null => {
    let scoped = false
    for (const pattern of patterns) {
      const match = pattern.exec(value)
      if (!match) continue
      const prefix = value.slice(0, match.index).trim()
      const suffix = value.slice(match.index + match[0].length).trim()
      if (validPrefix(prefix) && validSuffix(suffix)) return 'whole-home'
      const configuredSuffix = [...CONFIGURED_ROOM_QUERY_SCOPES].some((scope) =>
        suffix === scope || (suffix.startsWith(`${scope} `) && validSuffix(suffix.slice(scope.length + 1))))
      if ((validPrefix(prefix) && (configuredSuffix || configuredScopeExpression(suffix)))
        || (!suffix && (configuredPrefix(prefix) || configuredScopeExpression(prefix)))) {
        return 'configured-room'
      }
      scoped = true
    }
    return scoped ? 'scoped' : null
  }
  const exact = exactIntent(query)
  if (exact) classifications.push(exact)
  if (classifications.includes('whole-home')) return 'whole-home'
  if (classifications.includes('configured-room')) return 'configured-room'
  for (const room of explicitRooms) {
    const phrase = [...room.aliases]
      .map(normalize)
      .sort((left, right) => right.length - left.length)
      .find((alias) => phrasePositions(query, alias).length)
    if (!phrase) continue
    for (const position of phrasePositions(query, phrase)) {
      const withoutRoom = `${query.slice(0, position)} ${query.slice(position + phrase.length)}`
        .replace(/\b(?:of|in|inside|on|at)(?:\s+the)?\s+(?=lights?\b)/g, ' ')
        .replace(/\s+/g, ' ').trim()
      if (exactIntent(withoutRoom) === 'whole-home') return 'configured-room'
    }
  }
  return classifications.includes('scoped') || candidates.some((pattern) => pattern.test(query))
    ? 'scoped'
    : null
}

function namedColorInText(text: string) {
  const normalized = normalize(text)
  return Object.keys({ ...WHITE_COLORS, ...RGB_COLORS })
    .sort((a, b) => b.length - a.length)
    .find((color) => {
      const escaped = normalize(color).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|\\s)${escaped}(?=$|\\s|[?.!,])`).test(normalized)
    })
}

function wholeHomeReadResponse(action: 'rooms-on' | 'lights-on'): LightSkillResponse {
  const plan = buildLightPlan({ action })
  if (plan.status !== 'ready') return plan
  const response = action === 'rooms-on'
    ? 'I’ll check which rooms have lights on.'
    : 'I’ll check which configured lights are on.'
  return {
    ...plan,
    text: response,
    response,
    context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [], lastAction: action },
    data: { queryMode: action },
  }
}

export function parseLightUtterance(text: string, context?: LightContext | null): LightSkillResponse | null {
  if (text.length > HOME_CHAT_USER_LIMIT) {
    const response = `Messages can contain at most ${HOME_CHAT_USER_LIMIT} characters.`
    return { status: 'failed', text: response, response, controls: [], context: context ?? null }
  }
  const normalized = normalize(text)
  const semanticText = DIRECT_WRITE_REQUEST.test(normalized) ? imperativeClause(normalized) : normalized
  const lightLanguage = /\blights?\b|\blighting\b|\bpbl\b|\bpresence based\b/.test(normalized)
  const fixtureMatches = fixtureSpansInText(semanticText)
  const fixtureLanguage = fixtureMatches.length > 0
  const implicitLightAlias = /\bexterior\b/.test(normalized)
  const explicitRooms = roomsInText(semanticText)
  const potentiallyWrites = WRITE_ACTION_LANGUAGE.test(normalized)
    || Boolean(namedColorInText(normalized))
    || /\b\d{1,3}\s*%|\b\d{4}\s*k(?:elvin)?\b/.test(normalized)
  const indirectWriteResponse = (): LightSkillResponse => {
    const response = 'I did not change the lights because that was not a direct light command.'
    const room = explicitRooms[0]
    return {
      status: 'unsupported',
      text: response,
      response,
      controls: [],
      context: room
        ? { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] }
        : context ?? null,
    }
  }
  const unknownLeadingLocation = !explicitRooms.length && fixtureMatches.length > 0
    && /^(?:in|inside|at|on)\b/.test(normalized)
    && !/^(?:in a moment|in \d|at the moment|at present|at \d|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(normalized)
  const unknownTrailingLocation = !explicitRooms.length && fixtureMatches.some((match) => {
    const suffix = normalized.slice(match.end)
    return /(?:^|[\s,;:()\-\u2013\u2014])(?:(?:in|inside)\s+(?:the\s+)?(?!(?:a\s+moment|next\s+(?:minute|hour)|\d))|at\s+(?:the\s+)?(?!(?:moment|present|\d))|on\s+the\s+)[a-z]/.test(suffix)
  })
  const unsafeUnscopedFixtureContinuation = !explicitRooms.length && fixtureMatches.length > 0
    && /[.!?]\s+\S/.test(normalized)
  const contextualReference = /\b(it|its|them|their|they|those|these|same|that one|that room|which ones|what about|how about now|and now|before that|why|how come|those rules|the rules)\b/.test(normalized)
  const contextualTargetReference = /\b(it|its|them|their|they|those|these|same|that one)\b/.test(normalized)
  if (!lightLanguage && !fixtureLanguage && !implicitLightAlias
    && !(contextualReference && context?.domain === 'lights')) return null
  if (unknownLeadingLocation || unknownTrailingLocation || unsafeUnscopedFixtureContinuation) {
    const response = 'That location is not configured for this light.'
    return { status: 'unsupported', text: response, response, controls: [], context: null }
  }
  if (/^(?:can|could|would|should)\b(?!\s+you\b)/.test(normalized)) {
    return potentiallyWrites ? indirectWriteResponse() : null
  }
  const informationalRequest = /^(?:(?:please\s+)?(?:explain|tell me|show me|describe|help me understand)|(?:can|could|would)\s+you\s+(?:explain|tell me|show me|describe|help me understand))\b/.test(normalized)
  if (informationalRequest && (
    /\bhow\s+(?:to\b|(?:i|we|you|they|he|she|it)\s+(?:can|could|would|should|might|may)\b)/.test(normalized)
    || /\bwhether\s+to\b/.test(normalized)
    || /\b(?:whether|if)\s+(?:i|we|they|he|she|it)\s+(?:should|would|could|can)\b/.test(normalized)
  )) return indirectWriteResponse()
  if (/^(?:i\s+(?:wonder|wondered|am wondering)|we\s+(?:wonder|wondered|are wondering))\b.*\b(?:if|whether)\b/.test(normalized)) {
    return potentiallyWrites ? indirectWriteResponse() : null
  }
  if (NEGATION_LANGUAGE.test(normalized) && (
    WRITE_ACTION_LANGUAGE.test(normalized)
    || Boolean(namedColorInText(normalized))
    || /\b\d{1,3}\s*%|\b\d{4}\s*k(?:elvin)?\b/.test(normalized)
  )) {
    const response = 'I did not change the lights because that request was phrased as something not to do.'
    const room = explicitRooms[0]
    return {
      status: 'unsupported',
      text: response,
      response,
      controls: [],
      context: room
        ? { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] }
        : context ?? null,
    }
  }
  if (/\b(?:except|excluding|but not|other than|besides|with the exception of|rather than|instead of|apart from|not|but)\b/.test(normalized)
    || /\bwithout\b(?!\s+(?:a\s+)?transition\b)/.test(normalized)) {
    const response = 'That light request uses an unsupported exclusion or contrast.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const conditionalText = normalized
    .replace(/^when you can,?\s+/, '')
    .replace(/\s+(?:when|if) you can[.?!]*$/, '')
  if (potentiallyWrites && !READ_ONLY_REQUEST.test(normalized)
    && /\b(?:if|unless|whenever|when)\b/.test(conditionalText)) return indirectWriteResponse()
  let rooms = explicitRooms
  const fixtureRooms = [...new Map(fixtureMatches.map((match) => [match.room.id, match.room])).values()]
  const safeUniqueFixtureInference = !potentiallyWrites || READ_ONLY_REQUEST.test(normalized)
  if (!rooms.length && fixtureRooms.length === 1 && safeUniqueFixtureInference) rooms = fixtureRooms
  if (!rooms.length && context?.roomId) {
    const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
    if (contextual) rooms = [contextual]
  }
  const contextualRoom = rooms[0]
  const contextualTargets = contextualRoom
    ? (() => {
        const explicit = targetsInText(contextualRoom, text)
        return explicit.entityIds.length ? explicit : !fixtureMatches.length && context?.roomId === contextualRoom.id
          && (!explicitRooms.length || (explicitRooms.length === 1 && contextualTargetReference))
          ? targetsFromContext(contextualRoom, context)
          : explicit
      })()
    : { entityIds: [], lightNames: [] }
  const invalidContextTargets = Boolean(!explicitRooms.length && !fixtureMatches.length
    && contextualRoom && context?.roomId === contextualRoom.id
    && (context.entityIds.length || context.lightNames.length)
    && !contextualTargets.entityIds.length)
  const wholeHomeRoomsOnIntent = wholeHomeQueryIntent(
    text, WHOLE_HOME_ROOMS_ON_PATTERNS, WHOLE_HOME_ROOMS_ON_CANDIDATES, explicitRooms,
    WHOLE_HOME_ROOMS_ON_SCOPED_PATTERNS,
  )
  const wholeHomeLightsOnIntent = wholeHomeQueryIntent(
    text, WHOLE_HOME_LIGHTS_ON_PATTERNS, WHOLE_HOME_LIGHTS_ON_CANDIDATES, explicitRooms,
    WHOLE_HOME_LIGHTS_ON_SCOPED_PATTERNS,
  )

  if (wholeHomeRoomsOnIntent === 'whole-home') {
    return wholeHomeReadResponse('rooms-on')
  }
  if (wholeHomeRoomsOnIntent === 'configured-room' || wholeHomeRoomsOnIntent === 'scoped') {
    return roomPickerResponse('state')
  }
  if (wholeHomeLightsOnIntent === 'whole-home') {
    return wholeHomeReadResponse('lights-on')
  }
  if (wholeHomeLightsOnIntent === 'configured-room') {
    const action = /\b(?:what|which|list|show)\b/.test(normalized) ? 'list' : 'state'
    return buildLightPlan({ operations: explicitRooms.map((room) => ({
      action,
      room: room.name,
      ...entityTarget(targetsInText(room, text).entityIds),
      target_state: action === 'state' ? 'on' : undefined,
    })) })
  }
  if (/\bhow many\b.*\blights?\b.*\bon\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('count')
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({ action: 'count', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds) })
  }
  if (/\b(what(?:s| is| are)? (?:their|its|the)?\s*brightness|how bright)\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('brightness-state')
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({ action: 'brightness-state', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds) })
  }
  if (/\b(what color|which color|what colour|which colour)\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('color-state')
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({ action: 'color-state', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds) })
  }
  if (/\b(each lights? status|status of each light|which ones?)\b/.test(normalized)
    || (/^which ones\??$/.test(normalized) && context?.lastAction === 'count')) {
    if (!rooms.length) return roomPickerResponse('list')
    return buildLightPlan({ action: 'list', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds) })
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized)
    && (context?.lastAction === 'rooms-on' || context?.lastAction === 'lights-on')) {
    return wholeHomeReadResponse(context.lastAction)
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized) && context?.lastAction && !rooms.length) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction)
      ? context.lastAction
      : 'state'
    return roomPickerResponse(action)
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized) && context?.lastAction && rooms.length) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction) ? context.lastAction : 'state'
    return buildLightPlan({ action, room: rooms[0].name, ...entityTarget(contextualTargets.entityIds), target_state: context.targetState })
  }
  if (/^(what about before that|before that|and before that)\??$/.test(normalized) && context?.lastAction === 'history' && rooms.length) {
    return buildLightPlan({
      action: 'history',
      room: rooms[0].name,
      ...entityTarget(contextualTargets.entityIds),
      history_before: context.historyBefore,
      target_state: context.targetState,
    })
  }
  if (/^(why|why is that|how come)\??$/.test(normalized) && context?.lastAction && rooms.length) {
    return buildLightPlan({ action: 'reason', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds), target_state: context.lastState })
  }
  if (/\bwhat (?:are|were) (?:those|the) rules\b|\bwhich rules\b/.test(normalized) && context?.lastAction && rooms.length) {
    return buildLightPlan({ action: 'pbl-rules', room: rooms[0].name })
  }
  if (/\bset\b.*\b(?:back to )?default\b/.test(normalized) && rooms.length) {
    const defaultTargets = explicitRooms.length ? { entityIds: [], lightNames: [] } : contextualTargets
    const selected = defaultTargets.lightNames.length ? formatNames(defaultTargets.lightNames) : `${rooms[0].name} lights`
    const response = `I don’t have a defined default for the ${selected}. Tell me the color or brightness you want instead.`
    return { status: 'clarify', text: response, response, controls: [], context: {
      domain: 'lights', roomId: rooms[0].id, entityIds: defaultTargets.entityIds, lightNames: defaultTargets.lightNames, lastAction: 'set',
    } }
  }
  if (/\b(what does|explain|what is)\b.*\b(presence based lighting|pbl)\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('pbl')
    const room = rooms[0]
    const response = `Presence-Based Lighting means Home Assistant is allowed to manage the ${room.name} lights from presence and the room’s configured lighting rules.`
    return { status: 'answer', text: response, response, controls: [], context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [], lastAction: 'pbl-rules' } }
  }
  if (/\bpresence based lighting\b|\bpbl\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('pbl')
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({ action: 'pbl', room: rooms[0].name })
  }
  const historyQuery = /\bwhen\b.*\b(?:turn|turned|switch|switched)\s+(on|off)\b/.exec(normalized)
  if (historyQuery) {
    const targetState = historyQuery[1] as 'on' | 'off'
    if (!rooms.length) return roomPickerResponse('history', { targetState })
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({
      action: 'history',
      room: rooms[0].name,
      ...entityTarget(contextualTargets.entityIds),
      target_state: targetState,
      history_before: context?.roomId === null && context.lastAction === 'history' ? context.historyBefore : undefined,
    })
  }
  if (/\bwhy\b.*\b(turn|turned|switch|switched)\s+(on|off)\b/.test(normalized)) {
    const targetState = /\b(turn|turned|switch|switched)\s+off\b/.test(normalized) ? 'off' : 'on'
    if (!rooms.length) return roomPickerResponse('reason', { targetState })
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    return buildLightPlan({
      action: 'reason',
      room: rooms[0].name,
      ...entityTarget(contextualTargets.entityIds),
      target_state: targetState,
      history_before: context?.roomId === null && context.lastAction === 'reason' ? context.historyBefore : undefined,
    })
  }
  if (wholeHomeLightsOnIntent === 'scoped') return roomPickerResponse('list')
  if (READ_ONLY_REQUEST.test(normalized) && /\b(are|is)\b.*\b(on|off)\b/.test(normalized)) {
    const targetState = /\boff\b/.test(normalized) ? 'off' : 'on'
    if (!rooms.length) return roomPickerResponse('state', { targetState })
    return buildLightPlan({ operations: rooms.map((room) => ({
      action: 'state',
      room: room.name,
      ...entityTarget(targetsInText(room, text).entityIds),
      target_state: targetState,
    })) })
  }
  if (potentiallyWrites && !READ_ONLY_REQUEST.test(normalized)
    && hasUnknownNamedLightTarget(semanticText, fixtureMatches)) {
    const response = 'I could not match every named light in that request.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  if (READ_ONLY_REQUEST.test(normalized)) return potentiallyWrites ? indirectWriteResponse() : null
  if (potentiallyWrites && !DIRECT_WRITE_REQUEST.test(normalized)) {
    return indirectWriteResponse()
  }
  if (/\b(change|pick|choose)\b.*\b(?:colors?|lights?)\b/.test(normalized) && !/\d{1,3}\s*%/.test(normalized) && !namedColorInText(normalized) && !/rgb\s*\(/i.test(text)) {
    const requestedPhrases = [...new Set(fixtureMatches.map((match) => match.phrase))]
    if (explicitRooms.length && requestedPhrases.some((phrase) =>
      !fixtureMatches.some((match) => explicitRooms.some((room) => room.id === match.room.id) && match.phrase === phrase))) {
      const response = `That light is not configured in ${formatNames(explicitRooms.map((room) => room.name))}.`
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    if (!rooms.length) {
      const fixtureDetails = fixturePickerDetails(text)
      if (fixtureDetails) {
        if (!fixtureDetails.roomIds.length) {
          return { status: 'unsupported', text: MULTI_ROOM_FIXTURE_RESPONSE, response: MULTI_ROOM_FIXTURE_RESPONSE, controls: [], context: null }
        }
        return roomPickerResponse('color', fixtureDetails)
      }
      return roomPickerResponse('color')
    }
    if (rooms.length > 1 && fixtureMatches.length) {
      return {
        status: 'unsupported',
        text: MULTI_ROOM_FIXTURE_RESPONSE,
        response: MULTI_ROOM_FIXTURE_RESPONSE,
        controls: [],
        context: null,
      }
    }
    if (invalidContextTargets) {
      const response = `I could not match the earlier light target in the ${rooms[0].name}. Name the light or room again.`
      return { status: 'unsupported', text: response, response, controls: [], context: { domain: 'lights', roomId: rooms[0].id, entityIds: [], lightNames: [], lastAction: 'color' } }
    }
    return colorPickerResponse(rooms, contextualTargets)
  }
  if (explicitRooms.length && context?.lastAction && !/\b(turn|switch|put|enable|shut|disable|kill|set|dim|brighten|raise|lower|change|adjust|make|light up|are|is|when|why|what|which|how)\b/.test(normalized)) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction) ? context.lastAction : 'state'
    return buildLightPlan({ action, room: explicitRooms[0].name })
  }
  if (/^(?:who|what|where|why|how|did|does|do|is|are|was|were|has|have)\b/.test(normalized)
    || (/^when\b/.test(normalized) && !/^when you can\b/.test(normalized))
    || /^(?:should|may|might)\b/.test(normalized)
    || /^(?:can|could|would)\s+(?:i|we|they|he|she|it|this|that)\b/.test(normalized)) return null
  const segments = actionSegments(text)
  if (!segments) {
    const response = 'Please give each light action a complete value or split the request into separate commands.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const raw: Array<Record<string, unknown>> = []
  let previousSegmentTarget: { roomId: string; entityIds: string[] } | null = null
  for (const segment of segments) {
    const segmentNormalized = normalize(segment)
    if (!DIRECT_WRITE_REQUEST.test(segmentNormalized) || META_ACTION_LANGUAGE.test(segmentNormalized)) {
      const response = 'Please use a direct light command for each action clause.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const hasOnAction = /\b(?:turn(?:ing|ed)?|switch(?:ing|ed)?|put(?:ting)?|go(?:ing|es)?|went)\s+on\b|\benabl(?:e|ing|ed)\b|\blight(?:ing|ed)? up\b|\b(?:lights?|lighting)\s+(?:(?:(?:is|are|was|were|will be)\s+|(?:remain|stay)\s+)?on)(?=$|[.?!,;]|\s+(?:and|then|before|after|while|until|because)\b)/.test(segmentNormalized)
    const hasOffAction = /\b(?:turn(?:ing|ed)?|switch(?:ing|ed)?|shut(?:ting)?|go(?:ing|es)?|went)\s+off\b|\b(?:disabl(?:e|ing|ed)|kill(?:ing|ed)?)\b|\b(?:lights?|lighting)\s+(?:(?:(?:is|are|was|were|will be)\s+|(?:remain|stay)\s+)?off)(?=$|[.?!,;]|\s+(?:and|then|before|after|while|until|because)\b)/.test(segmentNormalized)
    if (hasOnAction && hasOffAction) {
      const response = 'Please split that mixed on and off request into separate light commands.'
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const segmentCommandClause = imperativeClause(segmentNormalized)
    const action = actionForSegment(segmentCommandClause)
    if (!action) {
      const response = 'Please give each light action a complete value or split the request into separate commands.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const brightness = [...segmentCommandClause.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]))
    const color = colorInText(segmentCommandClause)
    const explicitSegmentRooms = roomsInText(segmentCommandClause)
    const segmentFixtures = fixtureSpansInText(segmentCommandClause)
    if (hasNonLightTarget(segmentCommandClause, segmentFixtures)) {
      const response = 'I could not match the light target in one of those action clauses.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const segmentLightSubject = /\blights?\b|\blighting\b/.test(segmentCommandClause)
      || /\bexterior\b/.test(segmentCommandClause)
      || explicitSegmentRooms.length > 0 && /\blight up\b/.test(segmentCommandClause)
    const explicitWholeRoomTarget = explicitSegmentRooms.length > 0
      && !segmentFixtures.length
      && segmentLightSubject
    const segmentPronoun = !explicitWholeRoomTarget
      && /\b(?:it|them|those|these|same|that one|that light|the same one|the same lights?)\b/.test(segmentCommandClause)
    if (!segmentFixtures.length && !segmentLightSubject && !segmentPronoun) {
      const response = 'I could not match the light target in one of those action clauses.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const scopedRoomWithoutLightSubject = explicitSegmentRooms.some((room) => room.aliases.some((alias) => {
      const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b(?:in|inside|of)\\s+(?:the\\s+)?${escaped}\\b`).test(segmentCommandClause)
    })) && !segmentFixtures.length && !segmentLightSubject && !segmentPronoun
    if (scopedRoomWithoutLightSubject) {
      const response = 'I could not match the light target in one of those action clauses.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    let segmentRooms = explicitSegmentRooms
    if (!segmentRooms.length && segmentPronoun && previousSegmentTarget) {
      const inheritedRoom = HOUSE_LIGHT_ROOMS.find((room) => room.id === previousSegmentTarget?.roomId)
      if (inheritedRoom) segmentRooms = [inheritedRoom]
    }
    if (!segmentRooms.length && segments.length === 1 && context?.roomId) {
      const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
      if (contextual) segmentRooms = [contextual]
    }
    if (!segmentRooms.length) {
      const fixtureDetails = fixturePickerDetails(segment)
      if (fixtureDetails && !fixtureDetails.roomIds.length) {
        return {
          status: 'unsupported',
          text: MULTI_ROOM_FIXTURE_RESPONSE,
          response: MULTI_ROOM_FIXTURE_RESPONSE,
          controls: [],
          context: null,
        }
      }
      return roomPickerResponse(action, {
        ...(brightness.length ? { brightnessPct: brightness.length === 1 ? brightness[0] : brightness } : {}),
        ...(typeof color.color_name === 'string' ? { colorName: color.color_name } : {}),
        ...(typeof color.color_temperature_kelvin === 'number' ? { colorTemperatureKelvin: color.color_temperature_kelvin } : {}),
        ...(Array.isArray(color.rgb_color) ? { rgbColor: color.rgb_color as [number, number, number] } : {}),
        ...(fixtureDetails ?? {}),
      })
    }
    const segmentSelections: Array<{ roomId: string; entityIds: string[] }> = []
    for (const room of segmentRooms) {
      const targets = targetsInText(room, segmentCommandClause)
      if (segmentFixtures.length && !targets.entityIds.length) {
        const response = `That light is not configured in the ${room.name}.`
        return {
          status: 'unsupported',
          text: response,
          response,
          controls: [],
          context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] },
        }
      }
      const inheritsPrevious = !targets.entityIds.length && segmentPronoun
        && previousSegmentTarget?.roomId === room.id
      const usesContext = segments.length === 1 && !targets.entityIds.length
        && context?.roomId === room.id && !explicitSegmentRooms.length
      if (segmentPronoun && !inheritsPrevious && !usesContext) {
        const response = 'I could not match the earlier light target in that action clause.'
        return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
      }
      const contextualIds = usesContext
        ? targetsFromContext(room, context).entityIds : []
      const inheritedIds = inheritsPrevious ? previousSegmentTarget?.entityIds ?? [] : []
      const selectedIds = targets.entityIds.length
        ? targets.entityIds
        : inheritsPrevious
          ? inheritedIds
          : contextualIds
      raw.push({
        action, room: room.name, ...entityTarget(selectedIds),
        brightness_pct: brightness.length > 1 ? brightness : brightness[0],
        ...color,
      })
      segmentSelections.push({ roomId: room.id, entityIds: selectedIds })
    }
    previousSegmentTarget = segmentSelections.length === 1 ? segmentSelections[0] : null
  }
  if (!raw.length) return lightLanguage && WRITE_ACTION_LANGUAGE.test(normalized)
    ? roomPickerResponse() : null
  return buildLightPlan({ operations: raw })
}
