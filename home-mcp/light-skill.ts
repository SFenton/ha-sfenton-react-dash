import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS, findLightRoom, type HouseLightRoom } from './lights-config'

export const HOME_CHAT_USER_LIMIT = 180

export type LightAction = 'on' | 'off' | 'set' | 'up' | 'down' | 'color' | 'state' | 'count' | 'list' | 'rooms-on' | 'lights-on' | 'color-state' | 'brightness-state' | 'history' | 'reason' | 'pbl' | 'pbl-rules'

export interface LightContext {
  domain: 'lights'
  roomId: string | null
  entityIds: string[]
  lightNames: string[]
  roomIds?: string[]
  roomLightNames?: Record<string, string[]>
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
const ROOM_DETAIL_REQUIRED_RESPONSE = 'Choose a room to see which lights are on before changing them.'
const RAW_OPERATION_FIELDS = new Set([
  'action', 'room', 'entity_ids', 'light_names', 'brightness_pct', 'color_name',
  'rgb_color', 'color_temperature_kelvin', 'history_before', 'target_state',
])
const LIGHT_TOOL_FIELDS = new Set([...RAW_OPERATION_FIELDS, 'operations'])
const WRITE_ACTION_LANGUAGE = /\b(?:turn|switch|put|set|change|adjust|dim|dimmer|brighten|brighter|raise|lower|enable|disable|shut|kill|make|color|colour)\b|\blight up\b/
const NEGATION_LANGUAGE = /\b(?:dont|do not|never|not|shouldnt|couldnt|wouldnt|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|doesnt|didnt)\b/
const META_ACTION_LANGUAGE = /\b(?:ask|remind|reminder|schedule|scheduled|timer|alarm|automation|notification)\b/
const NON_LIGHT_TARGET_LANGUAGE = /\b(?:fan|garage door|door lock|lock|thermostat|vacuum|robot|speaker|television|media player)\b/g
const STATE_RELATIVE_LIGHT_TARGET = /\b(?:any|whichever|whatever)\b.*\blights?\b.*\b(?:on|off)\b|\bremaining\b.*\blights?\b|\b(?:still|currently)\s+(?:on|off)\b.*\blights?\b|\blights?\s+(?:on|off)\s+(?:in|inside|of|on|at|to)\b|\blights?\s+(?:(?:that|which)\s+(?:are|were|remain|remained|stay|stayed)\s+(?:(?:currently|still)\s+)*(?:on|off)|(?:currently|still)(?:\s+(?:currently|still))*\s+(?:on|off)|(?:left|remaining)\s+(?:on|off))\b/
const DIRECT_WRITE_REQUEST = /^(?:(?:(?:please|hey|quickly|for me|when you can)\s*,?\s*)|(?:(?:i need you|i want|id like)\s+to)\s+|(?:(?:can|could|would)\s+you\s+(?:please\s+)?))*(?:turn|switch|put|set|change|adjust|dim|brighten|raise|lower|enable|disable|shut|kill|make|color|colour|light up)\b/
const READ_ONLY_REQUEST = /^(?:(?:(?:please|hey|quickly|for me|when you can)\s*,?\s*)|(?:i need you to)\s+|(?:(?:can|could|would)\s+you\s+))*(?:what|which|who|where|why|how|when(?!\s+you can\b)|is|are|was|were|did|does|do|has|have)\b/
const imperativeClause = (value: string) => value.split(/\b(?:until|while|before|after|if|unless|when|because|since|so)\b/, 1)[0]

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
    if (action === 'count') return selectedNames.length
      ? `How many selected ${room.name} lights are on?`
      : `How many ${target} are on?`
    if (action === 'list') return selectedNames.length
      ? `Which selected ${room.name} lights are on?`
      : `Which ${target} are on?`
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
  const compactMessage = (room: HouseLightRoom) => {
    const selectedNames = details.roomLightNames?.[room.id] ?? details.lightNames ?? []
    const target = `selected ${room.name} lights`
    if (action === 'on') return `Turn on the ${target}.`
    if (action === 'off') return `Turn off the ${target}.`
    if (action === 'up' || action === 'down') {
      const values = Array.isArray(details.brightnessPct) ? details.brightnessPct : [details.brightnessPct]
      if (values.length > 1 && selectedNames.length === values.length) {
        return `Turn the ${target} ${action} by ${formatNames(values.map((value) => `${value}%`))} respectively.`
      }
      return values[0] === undefined
        ? `Turn ${action} the ${target}.`
        : `Turn the ${target} ${action} by ${values[0]}%.`
    }
    if (action === 'set' && Array.isArray(details.brightnessPct) && selectedNames.length === details.brightnessPct.length) {
      return `Turn the ${target} to ${details.brightnessPct.join('% and ')}% respectively.`
    }
    if (action === 'set' && typeof details.brightnessPct === 'number') {
      return `Turn the ${target} to ${details.brightnessPct}%.`
    }
    if (action === 'count') return `How many ${target} are on?`
    if (action === 'list') return `Which ${target} are on?`
    if (action === 'state') return `Are the ${target} ${details.targetState ?? 'on'}?`
    if (action === 'color-state') return `What color are the ${target}?`
    if (action === 'brightness-state') return `What is the brightness of the ${target}?`
    if (action === 'history') return `When did the ${target} turn ${details.targetState ?? 'off'}?`
    if (action === 'reason') return `Why did the ${target} turn ${details.targetState ?? 'on'}?`
    if (action === 'color') {
      if (details.rgbColor) return `Turn the ${target} to rgb(${details.rgbColor.join(', ')}).`
      if (details.colorTemperatureKelvin) return `Turn the ${target} to ${details.colorTemperatureKelvin}K.`
      if (details.colorName) return `Turn the ${target} to ${details.colorName}.`
      return `Change the color of the ${target}.`
    }
    return message(room)
  }
  const options = HOUSE_LIGHT_ROOMS
    .filter((room) => {
      if (details.roomIds?.length && !details.roomIds.includes(room.id)) return false
      if (details.roomLightNames && !Object.hasOwn(details.roomLightNames, room.id)) return false
      const selectedNames = details.roomLightNames?.[room.id] ?? details.lightNames ?? []
      if (selectedNames.length && !selectedNames.every((name) => room.lights.some((light) => light.name === name))) return false
      if (['set', 'up', 'down'].includes(action) && room.dimmable === false) return false
      if (Array.isArray(details.brightnessPct) && details.brightnessPct.length > 1
        && ['set', 'up', 'down'].includes(action) && selectedNames.length !== details.brightnessPct.length) return false
      if (action !== 'color') return true
      if (room.color === 'none') return false
      if (details.colorName && details.colorName in WHITE_COLORS) return true
      if (details.rgbColor || (details.colorName && details.colorName in RGB_COLORS)) return room.color === 'rgb'
      if (details.colorName) return false
      return true
    })
    .flatMap((room) => {
      const exactMessage = message(room)
      const optionMessage = exactMessage.length <= HOME_CHAT_USER_LIMIT ? exactMessage : compactMessage(room)
      return optionMessage.length <= HOME_CHAT_USER_LIMIT
        ? [{ label: room.name, value: room.name, message: optionMessage }]
        : []
    })
  if (!options.length) {
    const response = details.roomIds?.length && ['set', 'up', 'down'].includes(action)
      ? 'Brightness control is not supported by the selected lights.'
      : details.roomIds?.length && (details.colorName || details.rgbColor || details.colorTemperatureKelvin)
      ? 'That color is not supported by the selected lights.'
      : action === 'color' && details.roomIds?.length
        ? 'Color control is not supported by the selected lights.'
      : details.lightNames?.length || details.roomLightNames
        ? MULTI_ROOM_FIXTURE_RESPONSE
      : 'That color is not supported by any configured room.'
    return {
      status: 'unsupported',
      text: response,
      response,
      controls: [],
      context: {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        ...(details.roomIds?.length ? { roomIds: details.roomIds } : {}),
        ...(details.roomLightNames ? { roomLightNames: details.roomLightNames } : {}),
        lastAction: action,
      },
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
      ...(details.roomIds?.length ? { roomIds: details.roomIds } : {}),
      ...(details.roomLightNames ? { roomLightNames: details.roomLightNames } : {}),
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
  const context: LightContext = rooms.length === 1
    ? { domain: 'lights', roomId: room.id, entityIds: targets.entityIds, lightNames: targets.lightNames, lastAction: 'color' }
    : {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: rooms.map((candidate) => candidate.id),
        roomLightNames: Object.fromEntries(rooms.map((candidate) => [
          candidate.id,
          candidate.lights.map((light) => light.name),
        ])),
        lastAction: 'color',
      }
  if (rooms.some((candidate) => candidate.color === 'none')) {
    const plural = rooms.length > 1 || targets.lightNames.length !== 1
    const text = `${selected} ${plural ? 'do' : 'does'} not support color control.`
    return {
      status: 'unsupported',
      text,
      response: text,
      controls: [],
      context,
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
  const controlSubject = rooms.length === 1 && selected.length > 80 ? `selected ${room.name} lights` : selected
  if (`Turn the ${controlSubject} to rgb(255, 255, 255).`.length > HOME_CHAT_USER_LIMIT) {
    return {
      status: 'unsupported',
      text: SINGLE_ROOM_DETAIL_RESPONSE,
      response: SINGLE_ROOM_DETAIL_RESPONSE,
      controls: [],
      context: null,
    }
  }
  return {
    status: 'clarify', text, response: text,
    controls: [{
      id: `lights-color-${rooms.map((candidate) => candidate.id).join('-')}`, kind: 'color-picker', room: room.name,
      rooms: rooms.map((candidate) => candidate.name), palette: [...new Set(palette)], supportsCustomRgb,
      colorMode: supportsCustomRgb ? 'rgb' : 'temperature', entityIds,
      subject: targets.lightNames.length || rooms.length > 1 ? controlSubject : undefined,
      minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
    }],
    context,
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

function roomsInText(text: string, context?: LightContext | null) {
  const normalized = normalize(text)
  const fixtureSpans = fixtureSpansInText(normalized)
  const rawMatches = ROOM_ALIAS_MATCHES.flatMap(({ room, phrase }) =>
    phrasePositions(normalized, phrase).map((position) => ({ room, alias: phrase, position })))
  const matches = rawMatches
    .filter((match) => {
      const containing = fixtureSpans.filter((span) =>
        match.position >= span.start && match.position + match.alias.length <= span.end)
      if (!containing.length) return true
      const candidateRooms = new Set(containing.map((span) => span.room.id))
      if (candidateRooms.size > 1) {
        const spanStart = Math.min(...containing.map((span) => span.start))
        const spanEnd = Math.max(...containing.map((span) => span.end))
        const hasSeparateRoomScope = rawMatches.some((other) =>
          other.position < spanStart || other.position + other.alias.length > spanEnd)
        const contextualRooms = [...candidateRooms].filter((roomId) =>
          context?.roomId === roomId || Boolean(context?.roomLightNames?.[roomId]?.some((name) =>
            containing.some((span) => span.room.id === roomId && span.light.name === name))))
        if (contextualRooms.length > 1) return false
        return contextualRooms.length === 1
          ? match.room.id === contextualRooms[0]
          : !hasSeparateRoomScope && candidateRooms.has(match.room.id)
      }
      return candidateRooms.size === 1 && candidateRooms.has(match.room.id)
    })
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

function roomSelectionOnly(text: string, rooms: HouseLightRoom[]) {
  const normalized = normalize(text)
  if (/^(?:i|we)\s+(?:like|love|prefer)\b/.test(normalized)) return false
  let remainder = normalized.replace(/[?!.:,]+/g, ' ')
  const matches = rooms.flatMap((room) => room.aliases.flatMap((alias) => {
    const phrase = normalize(alias)
    return phrasePositions(remainder, phrase).map((start) => ({ start, end: start + phrase.length }))
  })).sort((left, right) => left.start - right.start || right.end - left.end)
  const spans: typeof matches = []
  for (const match of matches) {
    if (!spans.some((selected) => match.start < selected.end && match.end > selected.start)) spans.push(match)
  }
  for (const span of spans.sort((left, right) => right.start - left.start)) {
    remainder = `${remainder.slice(0, span.start)} ${remainder.slice(span.end)}`
  }
  const allowed = new Set([
    'and', 'or', 'the', 'please', 'tell', 'me', 'about', 'show', 'details', 'detail',
    'for', 'how', 'what', 'i', 'id', 'would', 'like', 'more', 'those', 'these', 'room', 'rooms', 'light', 'lights',
    'both', 'plus', 'as', 'well', 'now', 'yes', 'sure', 'okay', 'ok', 'can', 'could', 'you', 'thank', 'thanks',
  ])
  return remainder.split(/\s+/).filter(Boolean).every((word) => allowed.has(word))
}

function multiRoomContext(context?: LightContext | null) {
  if (!context?.roomIds?.length) return null
  const rooms = context.roomIds.flatMap((id) => HOUSE_LIGHT_ROOMS.find((room) => room.id === id) ?? [])
  if (rooms.length !== context.roomIds.length) return null
  return {
    rooms,
    roomIds: rooms.map((room) => room.id),
    roomLightNames: context.roomLightNames,
    hasExactTargets: Boolean(context.roomLightNames && Object.keys(context.roomLightNames).length),
  }
}

function singleRoomContextPlan(
  action: LightAction,
  multi: NonNullable<ReturnType<typeof multiRoomContext>>,
  details: { targetState?: 'on' | 'off'; historyBefore?: string } = {},
) {
  if (multi.rooms.length !== 1 || !multi.hasExactTargets) return null
  const room = multi.rooms[0]
  return buildLightPlan({
    action,
    room: room.name,
    light_names: multi.roomLightNames?.[room.id],
    target_state: details.targetState,
    history_before: details.historyBefore,
  })
}

function contextAfterWrite(context: LightContext, action: LightAction): LightContext {
  const next = { ...context, lastAction: action }
  delete next.targetState
  return next
}

function roomDetailResponse(rooms: HouseLightRoom[]) {
  const plan = buildLightPlan({
    operations: rooms.map((room) => ({ action: 'list', room: room.name })),
  })
  if (plan.status !== 'ready') return plan
  return {
    ...plan,
    context: {
      domain: 'lights' as const,
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: rooms.map((room) => room.id),
      lastAction: 'list' as const,
    },
    data: { queryMode: 'lights-on-detail' },
  }
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
  const named = resolveNamedTargets(room, [
    ...context.lightNames,
    ...(context.roomLightNames?.[room.id] ?? []),
  ])
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
  const explicitRooms = roomsInText(semanticText, context)
  const aggregateRoomContext = Boolean(context?.domain === 'lights'
    && (context.lastAction === 'lights-on' || context.lastAction === 'rooms-on'))
  const aggregateRoomMention = Boolean(explicitRooms.length && aggregateRoomContext)
  const aggregateRoomFollowUp = Boolean(aggregateRoomMention && roomSelectionOnly(semanticText, explicitRooms))
  const aggregateAffirmative = Boolean(aggregateRoomContext && context?.roomIds?.length === 1
    && /^(?:yes(?:,? please)?|sure|okay|ok|tell me more|show me that room|tell me about that room|(?:can|could|would) you (?:show me|tell me) (?:more|that room|more about that room))[.!?]?$/.test(normalized))
  const firstRoomPosition = Math.min(...explicitRooms.flatMap((room) => room.aliases
    .flatMap((alias) => phrasePositions(semanticText, normalize(alias)))), Number.POSITIVE_INFINITY)
  const aggregateSelectionPrefix = normalized.slice(0, firstRoomPosition).trim()
  const aggregateSelectionWrapperWords = new Set([
    'the', 'both', 'please', 'tell', 'me', 'about', 'show', 'how', 'what',
    'i', 'would', 'like', 'details', 'for', 'can', 'could', 'you',
  ])
  const aggregateSelectionWrapper = aggregateSelectionPrefix.split(/\s+/).filter(Boolean)
    .every((word) => aggregateSelectionWrapperWords.has(word))
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
  const boundedThatReference = DIRECT_WRITE_REQUEST.test(normalized) && /\bthat\b/.test(semanticText)
    || /\bwhy\b.*\bthat\b.*\b(?:on|off)\b/.test(normalized)
  const contextualReference = /\b(it|its|them|their|they|those|these|same|that one|that room|which ones|what about|how about now|and now|before that|why|how come|those rules|the rules)\b/.test(normalized)
    || boundedThatReference
  const contextualTargetReference = /\b(it|its|them|their|they|those|these|same|that(?: one)?)\b/.test(semanticText)
  const stateQualifiedTargetReference = STATE_RELATIVE_LIGHT_TARGET.test(semanticText)
  const contextualSelectionReference = contextualTargetReference || /\bselected\b/.test(semanticText)
  const selectedTargetReference = contextualSelectionReference || /\b(?:which ones|that light)\b/.test(semanticText)
  const aggregateSelectionCandidate = aggregateRoomMention && (
    roomSelectionOnly(semanticText, explicitRooms)
    || aggregateSelectionWrapper
  )
  if (!lightLanguage && !fixtureLanguage && !implicitLightAlias
    && !(contextualReference && context?.domain === 'lights')
    && !aggregateRoomFollowUp && !aggregateAffirmative && !aggregateSelectionCandidate) return null
  const unqualifiedToggle = (/\b(?:turn|switch)\b/.test(semanticText)
    && !/\b(?:any|whichever|whatever|remaining|left|still|currently|that|which)\b/.test(semanticText))
  if (DIRECT_WRITE_REQUEST.test(normalized) && stateQualifiedTargetReference && !unqualifiedToggle) {
    const response = 'State-qualified light changes require a fresh explicit target. Ask which lights are on, then use that exact result.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  if (unknownLeadingLocation || unknownTrailingLocation || unsafeUnscopedFixtureContinuation) {
    const response = 'That location is not configured for this light.'
    return { status: 'unsupported', text: response, response, controls: [], context: null }
  }
  if (/^(?:can|could|would|should)\b(?!\s+you\b)/.test(normalized)) {
    return potentiallyWrites ? indirectWriteResponse() : null
  }
  const informationalRequest = /^(?:(?:please\s+)?(?:explain|tell me|show me|describe|help me understand)|(?:can|could|would)\s+you\s+(?:explain|tell me|show me|describe|help me understand))\b/.test(normalized)
  const reasonPrefix = '(?:(?:please\\s+)?(?:tell me|explain)\\s+|(?:can|could|would)\\s+you\\s+(?:please\\s+)?tell me\\s+)?'
  const reasonQuestion = new RegExp(`^${reasonPrefix}why\\b`).test(normalized)
  if (informationalRequest && (
    /\bhow\s+(?:to\b|(?:i|we|you|they|he|she|it)\s+(?:can|could|would|should|might|may)\b)/.test(normalized)
    || /\bwhether\s+to\b/.test(normalized)
    || /\b(?:whether|if)\s+(?:i|we|they|he|she|it)\s+(?:should|would|could|can)\b/.test(normalized)
  )) return indirectWriteResponse()
  if (/^(?:i\s+(?:wonder|wondered|am wondering)|we\s+(?:wonder|wondered|are wondering))\b.*\b(?:if|whether)\b/.test(normalized)) {
    return potentiallyWrites ? indirectWriteResponse() : null
  }
  if (!reasonQuestion && NEGATION_LANGUAGE.test(normalized) && (
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
  if (!reasonQuestion && (/\b(?:except|excluding|but not|other than|besides|with the exception of|rather than|instead of|apart from|not|but)\b/.test(normalized)
    || /\bwithout\b(?!\s+(?:a\s+)?transition\b)/.test(normalized))) {
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
  if (!rooms.length && context?.roomLightNames) {
    const contextualFixtureRooms = fixtureRooms.filter((room) =>
      context.roomLightNames?.[room.id]?.some((name) =>
        fixtureMatches.some((match) => match.room.id === room.id && match.light.name === name)))
    if (contextualFixtureRooms.length === 1) rooms = contextualFixtureRooms
  }
  if (!rooms.length && context?.roomId) {
    const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
    if (contextual) rooms = [contextual]
  }
  const contextualRoom = rooms[0]
  const contextualTargets = contextualRoom
    ? (() => {
        const explicit = targetsInText(contextualRoom, text)
        if (explicit.entityIds.length) return explicit
        const singleRoomContext = !fixtureMatches.length && context?.roomId === contextualRoom.id
          && (!explicitRooms.length || (explicitRooms.length === 1 && selectedTargetReference))
        const multiRoomContext = !fixtureMatches.length
          && selectedTargetReference
          && Boolean(context?.roomIds?.includes(contextualRoom.id) && context.roomLightNames?.[contextualRoom.id]?.length)
        return singleRoomContext || multiRoomContext ? targetsFromContext(contextualRoom, context!) : explicit
      })()
    : { entityIds: [], lightNames: [] }
  const hasWholeRoomContext = (room: HouseLightRoom) => context?.roomId === room.id
    && context.entityIds.length === 0 && context.lightNames.length === 0
  const readTargetsForRoom = (room: HouseLightRoom) => {
    const explicit = targetsInText(room, text)
    if (explicit.entityIds.length || !selectedTargetReference) return { targets: explicit, resolved: true }
    const targets = context ? targetsFromContext(room, context) : explicit
    return { targets, resolved: targets.entityIds.length > 0 || hasWholeRoomContext(room) }
  }
  const unresolvedReadResponse = (): LightSkillResponse => {
    const response = 'I could not match the earlier light target in that query.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const explicitWholeRoomColorTarget = explicitRooms.some((room) => room.aliases.some((alias) => {
    const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`\\b(?:the\\s+)?${escaped}\\s+lights?\\b`).exec(normalized)
    if (!match || match.index === undefined) return false
    const throughSubject = normalized.slice(0, match.index + match[0].length)
    return !/\b(?:selected|it|them|their|they|these|those|same|that)\b/.test(throughSubject)
  }))
  const invalidContextTargets = Boolean(!explicitRooms.length && !fixtureMatches.length
    && contextualRoom && context?.roomId === contextualRoom.id
    && (context.entityIds.length || context.lightNames.length)
    && !contextualTargets.entityIds.length)
  const fixtureCandidatesBySpan = new Map<string, typeof fixtureMatches>()
  for (const match of fixtureMatches) {
    const key = `${match.start}:${match.end}`
    const candidates = fixtureCandidatesBySpan.get(key) ?? []
    candidates.push(match)
    fixtureCandidatesBySpan.set(key, candidates)
  }
  const scopedFixtureMismatch = [...fixtureCandidatesBySpan.entries()].some(([key, candidates]) => {
    const [start, end] = key.split(':').map(Number)
    const suffix = normalized.slice(end).trimStart()
    const scopedRoom = HOUSE_LIGHT_ROOMS.find((room) => room.aliases.some((alias) => {
      const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`^(?:in|inside|of|on)\\s+(?:the\\s+)?${escaped}\\b`).test(suffix)
    }))
    const fixturePhrase = normalized.slice(start, end).replace(/\blights?\b/g, '').trim()
    const matchesRoom = (room: HouseLightRoom) => candidates.some((candidate) => candidate.room.id === room.id)
      || FIXTURE_MATCHES.some((match) =>
        match.room.id === room.id && match.phrase.replace(/\blights?\b/g, '').trim() === fixturePhrase)
    return scopedRoom
      ? !matchesRoom(scopedRoom)
      : explicitRooms.length > 0 && !explicitRooms.some(matchesRoom)
  })
  if (explicitRooms.length && scopedFixtureMismatch) {
    const roomScope = explicitRooms.length === 1
      ? `the ${explicitRooms[0].name}`
      : formatNames(explicitRooms.map((room) => room.name))
    const response = `That light is not configured in ${roomScope}.`
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const contextualScopePosition = /\b(?:selected|it|them|their|they|those|these|same|that)\b/.exec(semanticText)?.index ?? -1
  const lightSubjectCount = semanticText.match(/\blights?\b/g)?.length ?? 0
  if (explicitRooms.length > 1 && contextualScopePosition >= 0
    && (contextualScopePosition > firstRoomPosition || lightSubjectCount > 1 || /\b(?:all|every)\b/.test(semanticText))) {
    const response = 'Mixing whole-room and selected targets across rooms is not supported.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const colorClarificationIntent = /\b(change|pick|choose)\b.*\b(?:colors?|lights?)\b/.test(normalized)
    && !/\d{1,3}\s*%/.test(normalized) && !namedColorInText(normalized) && !/rgb\s*\(/i.test(text)
  if (colorClarificationIntent && fixtureMatches.length && contextualSelectionReference) {
    const response = 'Please name every light in that color request instead of mixing a pronoun with another fixture.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const preliminarySegments = actionSegments(text)
  if (contextualSelectionReference && fixtureMatches.length
    && (!preliminarySegments || preliminarySegments.length === 1)) {
    const response = 'Please name every light in that request instead of mixing a pronoun with another fixture.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const contextualTargetSpans = [...semanticText.matchAll(/\b(?:selected|it|them|those|these|same|that(?: one)?)\b/g)]
    .flatMap((match) => match.index === undefined ? [] : [{ start: match.index, end: match.index + match[0].length }])
  const explicitRoomSubjects = explicitRooms.flatMap((room) => room.aliases.flatMap((alias) => {
    const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...semanticText.matchAll(new RegExp(`\\b(?:(?:the\\s+)?${escaped}\\s+lights?|lights?\\s+(?:in|inside|of|on|at)\\s+(?:the\\s+)?${escaped})\\b`, 'g'))]
      .flatMap((match) => match.index === undefined ? [] : [{ start: match.index, end: match.index + match[0].length }])
  }))
  const contextualDeterminesRoomSubject = contextualTargetSpans.every((target) =>
    explicitRoomSubjects.some((subject) =>
      target.end <= subject.start && !semanticText.slice(target.end, subject.start).trim()))
  const contextualDeterminesCoordinatedRooms = lightSubjectCount === 1
    && contextualTargetSpans.some((target) =>
      target.end <= firstRoomPosition && !semanticText.slice(target.end, firstRoomPosition).trim())
  const coordinatedContextAndRoom = contextualTargetSpans.length > 0
    && explicitRoomSubjects.length > 0
    && !contextualDeterminesRoomSubject
    && !contextualDeterminesCoordinatedRooms
    && (!preliminarySegments || preliminarySegments.length === 1)
  if (coordinatedContextAndRoom) {
    const response = 'Mixing contextual and explicit room targets is not supported.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  if (reasonQuestion && (
    /\b(?:instead of|rather than|except|excluding|but)\b/.test(normalized)
    || /\b(?:did|does|do|could|would|will|has|have)\b.*\bnot\s+(?:turn|switch)\b.*\blights?\b/.test(normalized)
    || /\b(?:didnt|doesnt|wont|couldnt|wouldnt|hasnt|havent)\b.*\b(?:turn|switch)\b.*\blights?\b/.test(normalized)
    || /\b(?:on|off)\s*,?\s+not\s+(?:on|off)\b/.test(normalized)
  )) {
    const response = 'That reason question compares or negates multiple actions. Ask why the lights turned on or off.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }
  const wholeHomeRoomsOnIntent = wholeHomeQueryIntent(
    text, WHOLE_HOME_ROOMS_ON_PATTERNS, WHOLE_HOME_ROOMS_ON_CANDIDATES, explicitRooms,
    WHOLE_HOME_ROOMS_ON_SCOPED_PATTERNS,
  )
  const wholeHomeLightsOnIntent = wholeHomeQueryIntent(
    text, WHOLE_HOME_LIGHTS_ON_PATTERNS, WHOLE_HOME_LIGHTS_ON_CANDIDATES, explicitRooms,
    WHOLE_HOME_LIGHTS_ON_SCOPED_PATTERNS,
  )

  if (aggregateRoomFollowUp && context?.roomIds?.length
    && explicitRooms.some((room) => !context.roomIds!.includes(room.id))) {
    const response = 'Choose one or more rooms from the earlier list.'
    return { status: 'unsupported', text: response, response, controls: [], context }
  }
  if (aggregateAffirmative) {
    const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === context?.roomIds?.[0])
    if (room) return roomDetailResponse([room])
  }
  if (aggregateRoomFollowUp) return roomDetailResponse(explicitRooms)
  if (aggregateRoomContext && /^(?:i|we)\s+(?:like|love|prefer)\b/.test(normalized)) return null
  if (aggregateRoomContext && explicitRooms.length
    && aggregateSelectionWrapper
    && !roomSelectionOnly(semanticText, explicitRooms)) {
    const response = 'Choose one or more rooms from the earlier list.'
    return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
  }

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
    let unresolvedReference = false
    const operations = explicitRooms.map((room) => {
      const explicit = targetsInText(room, text)
      const targets = !explicit.entityIds.length && selectedTargetReference && context
        ? targetsFromContext(room, context)
        : explicit
      if (selectedTargetReference && !targets.entityIds.length && !hasWholeRoomContext(room)) unresolvedReference = true
      return {
        action,
        room: room.name,
        ...entityTarget(targets.entityIds),
        target_state: action === 'state' ? 'on' : undefined,
      }
    })
    if (unresolvedReference) {
      const response = 'I could not match the earlier light target in that query.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    return buildLightPlan({ operations })
  }
  if (/\bhow many\b.*\blights?\b.*\bon\b/.test(normalized)) {
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      return multi
        ? singleRoomContextPlan('count', multi)
          ?? roomPickerResponse('count', { roomIds: multi.roomIds, roomLightNames: multi.roomLightNames })
        : roomPickerResponse('count')
    }
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const selection = readTargetsForRoom(rooms[0])
    return selection.resolved
      ? buildLightPlan({ action: 'count', room: rooms[0].name, ...entityTarget(selection.targets.entityIds) })
      : unresolvedReadResponse()
  }
  if (/\b(what(?:s| is| are)? (?:their|its|the)?\s*brightness|how bright)\b/.test(normalized)) {
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      return multi
        ? singleRoomContextPlan('brightness-state', multi)
          ?? roomPickerResponse('brightness-state', { roomIds: multi.roomIds, roomLightNames: multi.roomLightNames })
        : roomPickerResponse('brightness-state')
    }
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const selection = readTargetsForRoom(rooms[0])
    return selection.resolved
      ? buildLightPlan({ action: 'brightness-state', room: rooms[0].name, ...entityTarget(selection.targets.entityIds) })
      : unresolvedReadResponse()
  }
  if (/\b(what color|which color|what colour|which colour)\b/.test(normalized)) {
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      return multi
        ? singleRoomContextPlan('color-state', multi)
          ?? roomPickerResponse('color-state', { roomIds: multi.roomIds, roomLightNames: multi.roomLightNames })
        : roomPickerResponse('color-state')
    }
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const selection = readTargetsForRoom(rooms[0])
    return selection.resolved
      ? buildLightPlan({ action: 'color-state', room: rooms[0].name, ...entityTarget(selection.targets.entityIds) })
      : unresolvedReadResponse()
  }
  if (/\b(each lights? status|status of each light|which ones?)\b/.test(normalized)
    || (/^which ones\??$/.test(normalized) && context?.lastAction === 'count')) {
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      return multi
        ? singleRoomContextPlan('list', multi)
          ?? roomPickerResponse('list', { roomIds: multi.roomIds, roomLightNames: multi.roomLightNames })
        : roomPickerResponse('list')
    }
    const selections = rooms.map((room) => ({ room, selection: readTargetsForRoom(room) }))
    if (selections.some(({ selection }) => !selection.resolved)) return unresolvedReadResponse()
    return buildLightPlan({ operations: selections.map(({ room, selection }) => ({
      action: 'list',
      room: room.name,
      ...entityTarget(selection.targets.entityIds),
    })) })
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized)
    && (context?.lastAction === 'rooms-on' || context?.lastAction === 'lights-on')) {
    return wholeHomeReadResponse(context.lastAction)
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized) && context?.lastAction && !rooms.length) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction)
      ? context.lastAction
      : 'state'
    const multi = multiRoomContext(context)
    const targetState = context.lastState === 'on' || context.lastState === 'off'
      ? context.lastState
      : context.targetState
    return multi
      ? singleRoomContextPlan(action, multi, { targetState })
        ?? roomPickerResponse(action, {
          roomIds: multi.roomIds,
          ...(multi.hasExactTargets ? { roomLightNames: multi.roomLightNames } : {}),
          ...(targetState ? { targetState } : {}),
          })
      : roomPickerResponse(action)
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized) && context?.lastAction && rooms.length) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction) ? context.lastAction : 'state'
    const targetState = context.lastState === 'on' || context.lastState === 'off'
      ? context.lastState
      : context.targetState
    return buildLightPlan({ action, room: rooms[0].name, ...entityTarget(contextualTargets.entityIds), target_state: targetState })
  }
  if (/^(what about before that|before that|and before that)\??$/.test(normalized) && context?.lastAction === 'history' && rooms.length) {
    if (contextualTargets.entityIds.length > 1) {
      const response = 'Earlier history follow-ups support one light at a time.'
      return { status: 'unsupported', text: response, response, controls: [], context }
    }
    return buildLightPlan({
      action: 'history',
      room: rooms[0].name,
      ...entityTarget(contextualTargets.entityIds),
      history_before: context.historyBefore,
      target_state: context.targetState,
    })
  }
  if (/^(why|why is that|how come)\??$/.test(normalized) && context?.lastAction) {
    const targetState = context.lastState === 'on' || context.lastState === 'off'
      ? context.lastState
      : context.lastState === undefined
        ? context.targetState ?? null
        : null
    const multi = multiRoomContext(context)
    if (multi && targetState) {
      if (!multi.hasExactTargets) {
        return {
          status: 'unsupported',
          text: ROOM_DETAIL_REQUIRED_RESPONSE,
          response: ROOM_DETAIL_REQUIRED_RESPONSE,
          controls: [],
          context: context ?? null,
        }
      }
      if (multi.rooms.length === 1) {
        const room = multi.rooms[0]
        return buildLightPlan({
          action: 'reason',
          room: room.name,
          light_names: multi.roomLightNames?.[room.id],
          target_state: targetState,
        })
      }
      return singleRoomContextPlan('reason', multi, { targetState })
        ?? roomPickerResponse('reason', {
          roomIds: multi.roomIds,
          roomLightNames: multi.roomLightNames,
          targetState,
        })
    }
    if (rooms.length && targetState) {
      return buildLightPlan({
        action: 'reason',
        room: rooms[0].name,
        ...entityTarget(contextualTargets.entityIds),
        target_state: targetState,
      })
    }
    const response = 'I need a confirmed on or off state before I can explain why.'
    return { status: 'unsupported', text: response, response, controls: [], context }
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
    const multi = multiRoomContext(context)
    if (!rooms.length && multi) {
      if (!multi.hasExactTargets) {
        return {
          status: 'unsupported',
          text: ROOM_DETAIL_REQUIRED_RESPONSE,
          response: ROOM_DETAIL_REQUIRED_RESPONSE,
          controls: [],
          context: context ?? null,
        }
      }
      return singleRoomContextPlan('history', multi, { targetState })
        ?? roomPickerResponse('history', {
        roomIds: multi.roomIds,
        roomLightNames: multi.roomLightNames,
        targetState,
        })
    }
    if (!rooms.length) return roomPickerResponse('history', { targetState })
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const selection = readTargetsForRoom(rooms[0])
    return selection.resolved
      ? buildLightPlan({
          action: 'history',
          room: rooms[0].name,
          ...entityTarget(selection.targets.entityIds),
          target_state: targetState,
          history_before: context?.roomId === null && context.lastAction === 'history' ? context.historyBefore : undefined,
        })
      : unresolvedReadResponse()
  }
  const reasonTurn = /\bwhy\b.*?\b(turn|turned|switch|switched)\s+(on|off)\b/.exec(normalized)
  if (reasonTurn) {
    const requestedState = reasonTurn[2] as 'on' | 'off'
    const negativeAuxiliary = /\b(?:didnt|doesnt|dont|wont|cant|couldnt|wouldnt|shouldnt|hasnt|havent|did not|does not|do not|will not|can not|could not|would not|should not|has not|have not|never)\b/.exec(reasonTurn[0])
    const auxiliaryScope = negativeAuxiliary
      ? reasonTurn[0].slice(negativeAuxiliary.index + negativeAuxiliary[0].length)
      : ''
    const matrixVerb = /\b(?:expect|think|believe|report|say|tell|want|ask|know|realize|notice|remember|mean|intend|hope)\b|\bto\s*$/.test(auxiliaryScope)
    const subjectNegation = /\b(?:the\s+)?(?:[a-z0-9]+\s+){0,6}[a-z0-9]+\s+(?:didnt|doesnt|dont|wont|cant|couldnt|wouldnt|shouldnt|hasnt|havent|did not|does not|do not|will not|can not|could not|would not|should not|has not|have not|not|never)\s+(?:turn|turned|switch|switched)\s+(?:on|off)\b/.test(reasonTurn[0])
    const copularNegation = requestedState === 'on'
      ? /\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?on\b/.test(reasonTurn[0])
      : /\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?off\b/.test(reasonTurn[0])
    const negatedPredicate = Boolean(negativeAuxiliary && !matrixVerb) || subjectNegation || copularNegation
    const targetState = negatedPredicate
      ? requestedState === 'on' ? 'off' : 'on'
      : requestedState
    const multi = multiRoomContext(context)
    if (!rooms.length && multi) {
      if (!multi.hasExactTargets) {
        return {
          status: 'unsupported',
          text: ROOM_DETAIL_REQUIRED_RESPONSE,
          response: ROOM_DETAIL_REQUIRED_RESPONSE,
          controls: [],
          context: context ?? null,
        }
      }
      return singleRoomContextPlan('reason', multi, { targetState })
        ?? roomPickerResponse('reason', {
          roomIds: multi.roomIds,
          roomLightNames: multi.roomLightNames,
          targetState,
        })
    }
    if (!rooms.length) return roomPickerResponse('reason', { targetState })
    if (rooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: null }
    }
    const selection = readTargetsForRoom(rooms[0])
    return selection.resolved
      ? buildLightPlan({
          action: 'reason',
          room: rooms[0].name,
          ...entityTarget(selection.targets.entityIds),
          target_state: targetState,
          history_before: context?.roomId === null && context.lastAction === 'reason' ? context.historyBefore : undefined,
        })
      : unresolvedReadResponse()
  }
  const contextualReason = new RegExp(`^${reasonPrefix}why\\b.*\\b(?:it|they|these|those|that|lights?)\\b.*\\b(on|off)\\b`).exec(normalized)
  if (contextualReason) {
    const negatedOn = /\b(?:isnt|arent|wasnt|werent)\b.*\bon\b|\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?on\b/.test(normalized)
    const negatedOff = /\b(?:isnt|arent|wasnt|werent)\b.*\boff\b|\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?off\b/.test(normalized)
    const targetState = negatedOn ? 'off' : negatedOff ? 'on' : contextualReason[1] as 'on' | 'off'
    if (explicitRooms.length > 1) {
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    if (explicitRooms.length === 1) {
      const selection = readTargetsForRoom(explicitRooms[0])
      return selection.resolved
        ? buildLightPlan({
            action: 'reason',
            room: explicitRooms[0].name,
            ...entityTarget(selection.targets.entityIds),
            target_state: targetState,
          })
        : unresolvedReadResponse()
    }
    const multi = multiRoomContext(context)
    if (multi) {
      if (!multi.hasExactTargets) {
        return {
          status: 'unsupported',
          text: ROOM_DETAIL_REQUIRED_RESPONSE,
          response: ROOM_DETAIL_REQUIRED_RESPONSE,
          controls: [],
          context: context ?? null,
        }
      }
      return singleRoomContextPlan('reason', multi, { targetState })
        ?? roomPickerResponse('reason', {
          roomIds: multi.roomIds,
          roomLightNames: multi.roomLightNames,
          targetState,
        })
    }
    if (rooms.length === 1) {
      return buildLightPlan({
        action: 'reason',
        room: rooms[0].name,
        ...entityTarget(contextualTargets.entityIds),
        target_state: targetState,
      })
    }
    return roomPickerResponse('reason', { targetState })
  }
  const namedReason = reasonQuestion && (fixtureMatches.length > 0 || explicitRooms.length > 0)
  if (namedReason) {
    const stateMatch = /\b(?:is|are)\b.*\b(on|off)\b/.exec(normalized)
      ?? /\b(on|off)\b.*\b(?:is|are)\b/.exec(normalized)
    const negatedOn = /\b(?:isnt|arent|wasnt|werent)\b.*\bon\b|\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?on\b/.test(normalized)
    const negatedOff = /\b(?:isnt|arent|wasnt|werent)\b.*\boff\b|\b(?:not(?:\s+(?:currently|still|yet|right now|at the moment|at present))?|no longer)\s+(?:switched\s+)?off\b/.test(normalized)
    const targetState = negatedOn
      ? 'off'
      : negatedOff
        ? 'on'
        : stateMatch?.[1] as 'on' | 'off' | undefined
    if (targetState && rooms.length === 1) {
      const selection = readTargetsForRoom(rooms[0])
      return selection.resolved
        ? buildLightPlan({
            action: 'reason',
            room: rooms[0].name,
            ...entityTarget(selection.targets.entityIds),
            target_state: targetState,
          })
        : unresolvedReadResponse()
    }
  }
  if (wholeHomeLightsOnIntent === 'scoped') {
    if (selectedTargetReference && rooms.length === 1
      && (contextualTargets.entityIds.length || hasWholeRoomContext(rooms[0]))) {
      return buildLightPlan({ action: 'list', room: rooms[0].name, ...entityTarget(contextualTargets.entityIds) })
    }
    const multi = multiRoomContext(context)
    if (selectedTargetReference && multi?.hasExactTargets) {
      return roomPickerResponse('list', { roomIds: multi.roomIds, roomLightNames: multi.roomLightNames })
    }
    if (selectedTargetReference) {
      const response = 'I could not match the earlier light target in that query.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    return roomPickerResponse('list')
  }
  if (READ_ONLY_REQUEST.test(normalized) && /\b(are|is)\b.*\b(on|off)\b/.test(normalized)) {
    const targetState = /\boff\b/.test(normalized) ? 'off' : 'on'
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      return multi
        ? singleRoomContextPlan('state', multi, { targetState })
          ?? roomPickerResponse('state', {
            roomIds: multi.roomIds,
            roomLightNames: multi.roomLightNames,
            targetState,
          })
        : roomPickerResponse('state', { targetState })
    }
    let unresolvedReference = false
    const operations = rooms.map((room) => {
      const explicit = targetsInText(room, text)
      const targets = !explicit.entityIds.length && selectedTargetReference && context
        ? targetsFromContext(room, context)
        : explicit
      if (selectedTargetReference && !targets.entityIds.length && !hasWholeRoomContext(room)) unresolvedReference = true
      return {
        action: 'state',
        room: room.name,
        ...entityTarget(targets.entityIds),
        target_state: targetState,
      }
    })
    if (unresolvedReference) {
      const response = 'I could not match the earlier light target in that query.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    return buildLightPlan({ operations })
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
  if (colorClarificationIntent) {
    if (selectedTargetReference && explicitRooms.length && !explicitWholeRoomColorTarget) {
      const selections = explicitRooms.map((room) => ({ room, targets: context ? targetsFromContext(room, context) : { entityIds: [], lightNames: [] } }))
      if (selections.some((selection) => !selection.targets.entityIds.length && !hasWholeRoomContext(selection.room))) {
        const response = 'I could not match the earlier light target in that color request.'
        return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
      }
      if (selections.length > 1) {
        return roomPickerResponse('color', {
          roomIds: selections.map((selection) => selection.room.id),
          roomLightNames: Object.fromEntries(selections.map((selection) => [
            selection.room.id,
            selection.targets.lightNames,
          ])),
        })
      }
      return colorPickerResponse(selections[0].room, selections[0].targets)
    }
    if (!rooms.length) {
      const multi = multiRoomContext(context)
      if (multi) {
        if (!multi.hasExactTargets) {
          return {
            status: 'unsupported',
            text: ROOM_DETAIL_REQUIRED_RESPONSE,
            response: ROOM_DETAIL_REQUIRED_RESPONSE,
            controls: [],
            context: context ?? null,
          }
        }
        return roomPickerResponse('color', {
          roomIds: multi.roomIds,
          roomLightNames: multi.roomLightNames,
        })
      }
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
    return colorPickerResponse(rooms, explicitWholeRoomColorTarget
      ? { entityIds: [], lightNames: [] }
      : contextualTargets)
  }
  if (explicitRooms.length && context?.lastAction && !/\b(turn|switch|put|enable|shut|disable|kill|set|dim|brighten|raise|lower|change|adjust|make|light up|are|is|when|why|what|which|how)\b/.test(normalized)) {
    if (explicitRooms.length > 1) {
      if (aggregateRoomContext && roomSelectionOnly(semanticText, explicitRooms)
        && explicitRooms.every((room) => context.roomIds?.includes(room.id))) {
        return roomDetailResponse(explicitRooms)
      }
      if (aggregateRoomContext) {
        const response = 'Choose one or more rooms from the earlier list.'
        return { status: 'unsupported', text: response, response, controls: [], context }
      }
      const response = SINGLE_ROOM_DETAIL_RESPONSE
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction) ? context.lastAction : 'state'
    return buildLightPlan({ action, room: explicitRooms[0].name })
  }
  const contextualAction = actionForSegment(text)
  const multi = multiRoomContext(context)
  if (multi && contextualTargetReference && !explicitRooms.length
    && (contextualAction === 'on' || contextualAction === 'off')
    && /^(?:(?:please\s+)?(?:turn|switch)\s+(?:it|that(?: light)?|them|these lights|those lights)\s+(?:on|off)|(?:please\s+)?(?:turn|switch)\s+(?:on|off)\s+(?:it|that(?: light)?|them|these lights|those lights))[.!]?$/.test(normalized)) {
    const operations = multi.rooms.flatMap((room) => {
      const names = multi.roomLightNames?.[room.id] ?? []
      return names.length ? [{
        action: contextualAction,
        room: room.name,
        light_names: names,
      }] : []
    })
    if (operations.length) {
      const plan = buildLightPlan({ operations })
      return plan.status === 'ready' ? { ...plan, context: contextAfterWrite(context!, contextualAction) } : plan
    }
    return {
      status: 'unsupported',
      text: ROOM_DETAIL_REQUIRED_RESPONSE,
      response: ROOM_DETAIL_REQUIRED_RESPONSE,
      controls: [],
      context: context ?? null,
    }
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
    const explicitSegmentRooms = roomsInText(segmentCommandClause, context)
    const segmentFixtures = fixtureSpansInText(segmentCommandClause)
    if (hasNonLightTarget(segmentCommandClause, segmentFixtures)) {
      const response = 'I could not match the light target in one of those action clauses.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    const segmentLightSubject = /\blights?\b|\blighting\b/.test(segmentCommandClause)
      || /\bexterior\b/.test(segmentCommandClause)
      || explicitSegmentRooms.length > 0 && /\blight up\b/.test(segmentCommandClause)
    const contextualLightDeterminer = /\b(?:those|these|same|that)\b/.test(segmentCommandClause)
    const explicitWholeRoomTarget = explicitSegmentRooms.length > 0
      && !segmentFixtures.length
      && segmentLightSubject
      && !contextualLightDeterminer
    const segmentPronoun = !explicitWholeRoomTarget
      && /\b(?:it|them|those|these|same|that(?: one| light)?|the same one|the same lights?)\b/.test(segmentCommandClause)
    const segmentContextTargetReference = segmentPronoun || /\bselected\b/.test(segmentCommandClause)
    if (segmentPronoun && segmentFixtures.length) {
      const response = 'Please name every light in that action instead of mixing a pronoun with another fixture.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    if (raw.length && segmentPronoun && !previousSegmentTarget) {
      const response = 'I could not match that pronoun to one current light target.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
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
    if (!segmentRooms.length && segments.length === 1 && rooms.length === 1) {
      segmentRooms = rooms
    }
    if (!segmentRooms.length && segments.length === 1 && context?.roomId) {
      const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
      if (contextual) segmentRooms = [contextual]
    }
    if (segmentPronoun && previousSegmentTarget && explicitSegmentRooms.length
      && (explicitSegmentRooms.length !== 1 || explicitSegmentRooms[0].id !== previousSegmentTarget.roomId)) {
      const response = 'I could not match the current light target to that room.'
      return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
    }
    if (!segmentRooms.length) {
      if (raw.length && segmentPronoun) {
        const response = 'I could not match that pronoun to one current light target.'
        return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
      }
      const contextualMulti = multiRoomContext(context)
      if (contextualMulti && selectedTargetReference) {
        if (segments.length > 1) {
          const response = 'Please split that multi-room follow-up into separate light requests.'
          return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
        }
        if (!contextualMulti.hasExactTargets) {
          return {
            status: 'unsupported',
            text: ROOM_DETAIL_REQUIRED_RESPONSE,
            response: ROOM_DETAIL_REQUIRED_RESPONSE,
            controls: [],
            context: context ?? null,
          }
        }
        return roomPickerResponse(action, {
          roomIds: contextualMulti.roomIds,
          roomLightNames: contextualMulti.roomLightNames,
          ...(brightness.length ? { brightnessPct: brightness.length === 1 ? brightness[0] : brightness } : {}),
          ...(typeof color.color_name === 'string' ? { colorName: color.color_name } : {}),
          ...(typeof color.color_temperature_kelvin === 'number' ? { colorTemperatureKelvin: color.color_temperature_kelvin } : {}),
          ...(Array.isArray(color.rgb_color) ? { rgbColor: color.rgb_color as [number, number, number] } : {}),
        })
      }
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
      const usesMultiContext = !targets.entityIds.length
        && segmentContextTargetReference
        && Boolean(context?.roomIds?.includes(room.id) && context.roomLightNames?.[room.id]?.length)
      const usesSingleSelectedContext = !targets.entityIds.length
        && segmentContextTargetReference
        && context?.roomId === room.id
        && Boolean(context.entityIds.length || context.lightNames.length)
      const usesSingleWholeRoomContext = !targets.entityIds.length
        && segmentContextTargetReference
        && hasWholeRoomContext(room)
      if (segmentContextTargetReference && !targets.entityIds.length && !inheritsPrevious
        && !usesContext && !usesMultiContext && !usesSingleSelectedContext && !usesSingleWholeRoomContext) {
        const response = 'I could not match the earlier light target in that action clause.'
        return { status: 'unsupported', text: response, response, controls: [], context: context ?? null }
      }
      const contextualIds = usesContext || usesMultiContext || usesSingleSelectedContext
        ? targetsFromContext(room, context!).entityIds : []
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
  const plan = buildLightPlan({ operations: raw })
  const contextualMulti = multiRoomContext(context)
  const selectedRoomIds = contextualMulti?.roomLightNames ? Object.keys(contextualMulti.roomLightNames) : []
  const preservesMultiContext = plan.status === 'ready' && contextualMulti
    && contextualMulti.roomLightNames
    && plan.operations?.length === selectedRoomIds.length
    && plan.operations.every((operation) => {
      const selectedNames = contextualMulti.roomLightNames?.[operation.room.id]
      const actualNames = operation.lightNames.length
        ? operation.lightNames
        : operation.room.lights.map((light) => light.name)
      return selectedNames && selectedNames.length === actualNames.length
        && selectedNames.every((name) => actualNames.includes(name))
    })
    && selectedRoomIds.every((roomId) => plan.operations?.some((operation) => operation.room.id === roomId))
  return preservesMultiContext
    ? { ...plan, context: contextAfterWrite(context!, plan.operations!.at(-1)!.action) }
    : plan
}
