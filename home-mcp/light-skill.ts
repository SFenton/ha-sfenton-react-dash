import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS, findLightRoom, type HouseLightRoom } from './lights-config'

export const MAX_LIGHT_CONTROL_MESSAGE_LENGTH = 180

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

export type LightControl =
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
  controls: LightControl[]
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
      return optionMessage.length <= MAX_LIGHT_CONTROL_MESSAGE_LENGTH
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
