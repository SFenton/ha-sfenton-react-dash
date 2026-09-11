import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS, findLightRoom, type HouseLightRoom } from './lights-config'

export const HOME_CHAT_USER_LIMIT = 180

export type LightAction = 'on' | 'off' | 'set' | 'up' | 'down' | 'color' | 'state' | 'count' | 'list' | 'rooms-on' | 'color-state' | 'brightness-state' | 'history' | 'reason' | 'pbl' | 'pbl-rules'

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
  rgbColor?: [number, number, number]
  targetState?: 'on' | 'off'
} = {}): LightSkillResponse {
  const text = 'Which room?'
  const message = (room: HouseLightRoom) => {
    if (action === 'on') return `Turn on the ${room.name} lights.`
    if (action === 'off') return `Turn off the ${room.name} lights.`
    if (action === 'up') return `Turn up the ${room.name} lights.`
    if (action === 'down') return `Turn down the ${room.name} lights.`
    if (action === 'set' && typeof details.brightnessPct === 'number') return `Turn the ${room.name} lights to ${details.brightnessPct}%.`
    if (action === 'count') return `How many lights are on in the ${room.name}?`
    if (action === 'list') return `Which lights are on in the ${room.name}?`
    if (action === 'color-state') return `What color are the ${room.name} lights?`
    if (action === 'brightness-state') return `What is the brightness of the ${room.name} lights?`
    if (action === 'history') return `When did the ${room.name} lights turn ${details.targetState ?? 'off'}?`
    if (action === 'reason') return `Why did the ${room.name} lights turn ${details.targetState ?? 'on'}?`
    if (action === 'pbl' || action === 'pbl-rules') return `Is Presence-Based Lighting active in the ${room.name}?`
    if (action === 'color') {
      if (details.rgbColor) return `Turn the ${room.name} lights to rgb(${details.rgbColor.join(', ')}).`
      if (details.colorTemperatureKelvin) return `Turn the ${room.name} lights to ${details.colorTemperatureKelvin}K.`
      if (details.colorName) return `Turn the ${room.name} lights to ${details.colorName}.`
      return `Change the color of the ${room.name} lights.`
    }
    return `Are the ${room.name} lights ${details.targetState ?? 'on'}?`
  }
  return {
    status: 'clarify', text, response: text,
    controls: [{
      id: `lights-room-picker-${action}`, kind: 'room-picker',
      options: HOUSE_LIGHT_ROOMS
        .filter((room) => action !== 'color' || room.color !== 'none')
        .map((room) => ({ label: room.name, value: room.name, message: message(room) })),
    }],
    context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
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
  if (!action || !['on', 'off', 'set', 'up', 'down', 'color', 'state', 'count', 'list', 'rooms-on', 'color-state', 'brightness-state', 'history', 'reason', 'pbl', 'pbl-rules'].includes(action)) {
    const text = 'I need a supported light action.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  const room = findLightRoom(input.room)
  if (!room) return roomPickerResponse(action)
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
  const entityIds = [...new Set([...explicitIds, ...named.entityIds])]
  const lights = entityIds.flatMap((id) => room.lights.find((light) => light.entityId === id) ?? [])
  const lightNames = lights.map((light) => light.name)
  const brightnessRaw = input.brightness_pct
  const brightnessPct = Array.isArray(brightnessRaw)
    ? brightnessRaw.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).map(pct)
    : typeof brightnessRaw === 'number' && Number.isFinite(brightnessRaw) ? pct(brightnessRaw) : null
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
  const historyBefore = typeof input.history_before === 'string' && !Number.isNaN(Date.parse(input.history_before)) ? input.history_before : null
  const targetState = input.target_state === 'on' || input.target_state === 'off' ? input.target_state : null
  return {
    action, room, entityIds, lightNames, brightnessPct,
    rgbColor: color?.rgbColor ?? null,
    colorName: color?.colorName ?? null,
    colorTemperatureKelvin: color?.colorTemperatureKelvin ?? null,
    historyBefore, targetState,
  }
}

export function buildLightPlan(args: LightToolRequest): LightSkillResponse {
  if (Array.isArray(args.operations) && (args.operations.length < 1 || args.operations.length > 12)) {
    const text = 'A light request can contain between 1 and 12 operations.'
    return { status: 'failed', text, response: text, controls: [], context: null }
  }
  const rawOperations = Array.isArray(args.operations)
    ? args.operations.filter((operation): operation is Record<string, unknown> => Boolean(operation) && typeof operation === 'object' && !Array.isArray(operation))
    : [{
        action: args.action, room: args.room, entity_ids: args.entity_ids, light_names: args.light_names,
        brightness_pct: args.brightness_pct, color_name: args.color_name, rgb_color: args.rgb_color,
        color_temperature_kelvin: args.color_temperature_kelvin, history_before: args.history_before, target_state: args.target_state,
      }]
  const operations: LightOperation[] = []
  for (const raw of rawOperations) {
    const result = toOperation(raw)
    if ('status' in result) return result
    operations.push(result)
  }
  if (!operations.length) return roomPickerResponse()
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
  return FIXTURE_MATCHES.flatMap(({ room, phrase }) => phrasePositions(normalized, phrase)
    .filter((position) => !(phrase.endsWith('right') && normalized.slice(position, position + phrase.length + 4) === `${phrase} now`))
    .map((position) => ({ room, start: position, end: position + phrase.length })))
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
  const scopePositions = room.aliases.flatMap((alias) => {
    const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`\\b(?:in|inside|of)\\s+(?:the\\s+)?${escaped}\\b`).exec(normalized)
    return match?.index === undefined ? [] : [match.index]
  })
  const targetText = scopePositions.length ? normalized.slice(0, Math.min(...scopePositions)) : normalized
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

function actionSegments(text: string) {
  const explicit = text.split(/\s+and\s+(?=(?:turn|switch|put|enable|shut|disable|kill|set|dim|brighten|raise|lower|change|adjust|make|light\s+up)\b)/gi)
  if (explicit.length > 1) return explicit
  const compact = text.split(/\s+and\s+(?=(?:the\s+)?[^.?!]*?\b(?:lights?|lighting)\s+(?:on|off)(?:\s+and\s+|[.?!]*$))/gi)
  return compact.length > 1 ? compact.map((segment, index) => index === 0 ? segment : `turn ${segment}`) : explicit
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

function namedColorInText(text: string) {
  const normalized = normalize(text)
  return Object.keys({ ...WHITE_COLORS, ...RGB_COLORS })
    .sort((a, b) => b.length - a.length)
    .find((color) => {
      const escaped = normalize(color).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|\\s)${escaped}(?=$|\\s|[?.!,])`).test(normalized)
    })
}

export function parseLightUtterance(text: string, context?: LightContext | null): LightSkillResponse | null {
  if (text.length > HOME_CHAT_USER_LIMIT) {
    const response = `Messages can contain at most ${HOME_CHAT_USER_LIMIT} characters.`
    return { status: 'failed', text: response, response, controls: [], context: context ?? null }
  }
  const normalized = normalize(text)
  const lightLanguage = /\blights?\b|\blighting\b|\bpbl\b|\bpresence based\b/.test(normalized)
  const fixtureLanguage = fixtureSpansInText(normalized).length > 0
  const implicitLightAlias = /\bexterior\b/.test(normalized)
  const explicitRooms = roomsInText(text)
  const contextualReference = /\b(it|its|them|their|they|those|these|same|that one|that room|which ones|what about|before that|why|how come|those rules|the rules)\b/.test(normalized)
  if (!lightLanguage && !fixtureLanguage && !implicitLightAlias && !(context?.roomId && contextualReference)) return null
  if (/\b(?:dont|do not|never|not|shouldnt|couldnt|wouldnt|cant|wont)\b.{0,40}\b(?:turn|switch|put|set|change|adjust|dim|brighten|raise|lower|light up|enable|disable|shut|kill|make)\b/.test(normalized)) {
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
  let rooms = explicitRooms
  if (!rooms.length && context?.roomId) {
    const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
    if (contextual) rooms = [contextual]
  }
  const contextualRoom = rooms[0]
  const contextualTargets = contextualRoom
    ? (() => {
        const explicit = targetsInText(contextualRoom, text)
        return explicit.entityIds.length ? explicit : context?.roomId === contextualRoom.id
          ? targetsFromContext(contextualRoom, context)
          : explicit
      })()
    : { entityIds: [], lightNames: [] }
  const invalidContextTargets = Boolean(contextualRoom && context?.roomId === contextualRoom.id
    && (context.entityIds.length || context.lightNames.length)
    && !contextualTargets.entityIds.length)

  if (/\bwhich rooms?\b.*\blights?\b.*\bon\b/.test(normalized)) {
    const operations = HOUSE_LIGHT_ROOMS.map((room) => ({
      action: 'rooms-on' as const, room, entityIds: [], lightNames: [], brightnessPct: null,
      rgbColor: null, colorName: null, colorTemperatureKelvin: null, historyBefore: null, targetState: null,
    }))
    const response = 'I’ll check which rooms have lights on.'
    return { status: 'ready', text: response, response, controls: [], operations, context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [], lastAction: 'rooms-on' }, data: { queryMode: 'rooms-on' } }
  }
  if (/\bhow many\b.*\blights?\b.*\bon\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('count')
    return buildLightPlan({ action: 'count', room: rooms[0].name, entity_ids: contextualTargets.entityIds })
  }
  if (/\b(what(?:s| is| are)? (?:their|its|the)?\s*brightness|how bright)\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('brightness-state')
    return buildLightPlan({ action: 'brightness-state', room: rooms[0].name, entity_ids: contextualTargets.entityIds })
  }
  if (/\b(what color|which color|what colour|which colour)\b/.test(normalized)) {
    if (!rooms.length) return roomPickerResponse('color-state')
    return buildLightPlan({ action: 'color-state', room: rooms[0].name, entity_ids: contextualTargets.entityIds })
  }
  if (/\b(each lights? status|status of each light|which ones?)\b/.test(normalized)
    || (/^which ones\??$/.test(normalized) && context?.lastAction === 'count')) {
    if (!rooms.length) return roomPickerResponse('list')
    return buildLightPlan({ action: 'list', room: rooms[0].name })
  }
  if (/^(what about now|and now|how about now)\??$/.test(normalized) && context?.lastAction && rooms.length) {
    const action = ['state', 'count', 'list', 'color-state', 'brightness-state', 'pbl'].includes(context.lastAction) ? context.lastAction : 'state'
    return buildLightPlan({ action, room: rooms[0].name, entity_ids: contextualTargets.entityIds, target_state: context.targetState })
  }
  if (/^(what about before that|before that|and before that)\??$/.test(normalized) && context?.lastAction === 'history' && rooms.length) {
    return buildLightPlan({
      action: 'history',
      room: rooms[0].name,
      entity_ids: contextualTargets.entityIds,
      history_before: context.historyBefore,
      target_state: context.targetState,
    })
  }
  if (/^(why|why is that|how come)\??$/.test(normalized) && context?.lastAction && rooms.length) {
    return buildLightPlan({ action: 'reason', room: rooms[0].name, entity_ids: contextualTargets.entityIds, target_state: context.lastState })
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
    return buildLightPlan({ action: 'pbl', room: rooms[0].name })
  }
  const historyQuery = /\bwhen\b.*\b(?:turn|turned|switch|switched)\s+(on|off)\b/.exec(normalized)
  if (historyQuery) {
    const targetState = historyQuery[1] as 'on' | 'off'
    if (!rooms.length) return roomPickerResponse('history', { targetState })
    return buildLightPlan({ action: 'history', room: rooms[0].name, entity_ids: contextualTargets.entityIds, target_state: targetState })
  }
  if (/\bwhy\b.*\b(turn|turned|switch|switched)\s+(on|off)\b/.test(normalized)) {
    const targetState = /\b(turn|turned|switch|switched)\s+off\b/.test(normalized) ? 'off' : 'on'
    if (!rooms.length) return roomPickerResponse('reason', { targetState })
    return buildLightPlan({ action: 'reason', room: rooms[0].name, entity_ids: contextualTargets.entityIds, target_state: targetState })
  }
  if (/\b(are|is)\b.*\b(on|off)\b/.test(normalized)) {
    const targetState = /\boff\b/.test(normalized) ? 'off' : 'on'
    if (!rooms.length) return roomPickerResponse('state', { targetState })
    return buildLightPlan({ operations: rooms.map((room) => ({
      action: 'state',
      room: room.name,
      entity_ids: targetsInText(room, text).entityIds,
      target_state: targetState,
    })) })
  }
  if (/\b(change|pick|choose)\b.*\b(?:colors?|lights?)\b/.test(normalized) && !/\d{1,3}\s*%/.test(normalized) && !namedColorInText(normalized) && !/rgb\s*\(/i.test(text)) {
    if (!rooms.length) return roomPickerResponse('color')
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
  if (segments.length === 1 && explicitRooms.length > 1 && /\bon\b/.test(normalized) && /\boff\b/.test(normalized)) {
    const response = 'Please split that mixed on and off request into separate light commands.'
    return { status: 'unsupported', text: response, response, controls: [], context: null }
  }
  const raw: Array<Record<string, unknown>> = []
  for (const segment of segments) {
    const action = actionForSegment(segment)
    if (!action) continue
    const brightness = [...segment.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]))
    const color = colorInText(segment)
    let segmentRooms = roomsInText(segment)
    if (!segmentRooms.length && rooms.length === 1) segmentRooms = rooms
    if (!segmentRooms.length && context?.roomId) {
      const contextual = HOUSE_LIGHT_ROOMS.find((room) => room.id === context.roomId)
      if (contextual) segmentRooms = [contextual]
    }
    if (!segmentRooms.length) return roomPickerResponse(action, {
      ...(brightness.length === 1 ? { brightnessPct: brightness[0] } : {}),
      ...(typeof color.color_name === 'string' ? { colorName: color.color_name } : {}),
      ...(typeof color.color_temperature_kelvin === 'number' ? { colorTemperatureKelvin: color.color_temperature_kelvin } : {}),
      ...(Array.isArray(color.rgb_color) ? { rgbColor: color.rgb_color as [number, number, number] } : {}),
    })
    for (const room of segmentRooms) {
      const targets = targetsInText(room, segment)
      if (fixtureSpansInText(segment).length && !targets.entityIds.length) {
        const response = `That light is not configured in the ${room.name}.`
        return {
          status: 'unsupported',
          text: response,
          response,
          controls: [],
          context: { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] },
        }
      }
      const contextualIds = !targets.entityIds.length && context?.roomId === room.id && !roomsInText(segment).length
        ? targetsFromContext(room, context).entityIds : []
      raw.push({
        action, room: room.name, entity_ids: contextualIds.length ? contextualIds : targets.entityIds,
        brightness_pct: brightness.length > 1 ? brightness : brightness[0],
        ...color,
      })
    }
  }
  if (!raw.length) return lightLanguage && /\b(turn|switch|put|enable|shut|disable|kill|set|dim|brighten|raise|lower|change|adjust|make|light up)\b/.test(normalized)
    ? roomPickerResponse() : null
  return buildLightPlan({ operations: raw })
}
