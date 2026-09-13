import { HOUSE_LIGHT_ROOMS } from '../lights-config'
import { parseLightUtterance, type LightContext, type LightOperation } from '../light-skill'
import { CORPUS_FAMILIES, generateFamily, type CorpusExample } from './generate-lights'

interface ValidationSummary {
  families: Record<string, { examples: number; utterances: number; rooms: string[] }>
  totalExamples: number
  totalUtterances: number
  uniqueIds: number
}

const comparable = (value: unknown) => JSON.stringify(value)

function fail(example: CorpusExample, message: string): never {
  const lastUser = example.turns.filter((turn) => turn.role === 'user').at(-1)?.text ?? ''
  throw new Error(`${example.family}/${example.id}: ${message}\nUtterance: ${lastUser}`)
}

function expectedRooms(family: string) {
  if (family === 'unsupported-brightness') return HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable === false)
  if (['relative-up', 'relative-down', 'room-brightness', 'named-light-brightness', 'long-context-reference'].includes(family)) return HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable !== false)
  if (family.startsWith('multi-light-')) return HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable !== false && room.lights.length > 1)
  if (family === 'supported-color' || family === 'clarify-color' || family === 'fixture-color-clarify') return HOUSE_LIGHT_ROOMS.filter((room) => room.color !== 'none')
  if (family === 'unsupported-color') return HOUSE_LIGHT_ROOMS.filter((room) => room.color !== 'rgb')
  if (family === 'clarify-room') return []
  return HOUSE_LIGHT_ROOMS
}

function validateOperation(example: CorpusExample, actual: LightOperation, expected: Record<string, unknown>) {
  if (actual.action !== expected.action) fail(example, `expected action ${String(expected.action)}, received ${actual.action}`)
  if (actual.room.name !== expected.room) fail(example, `expected room ${String(expected.room)}, received ${actual.room.name}`)
  const expectedRoom = HOUSE_LIGHT_ROOMS.find((room) => room.name === expected.room)
  const expectedLightNames = Array.isArray(expected.light_names) ? expected.light_names.map(String) : []
  const expectedEntityIds = expectedLightNames.map((name) => expectedRoom?.lights.find((light) => light.name === name)?.entityId)
  if (expectedEntityIds.some((id) => !id) || comparable(actual.entityIds) !== comparable(expectedEntityIds)) {
    fail(example, `expected entity targets ${comparable(expectedEntityIds)}, received ${comparable(actual.entityIds)}`)
  }
  const expectedShape = {
    lightNames: expectedLightNames,
    brightnessPct: expected.brightness_pct ?? null,
    colorName: expected.color_name ?? null,
    rgbColor: expected.rgb_color ?? null,
    colorTemperatureKelvin: expected.color_temperature_kelvin ?? null,
    historyBefore: expected.history_before ?? null,
    targetState: expected.target_state ?? null,
  }
  const actualShape = {
    lightNames: actual.lightNames,
    brightnessPct: actual.brightnessPct,
    colorName: actual.colorName,
    rgbColor: actual.rgbColor,
    colorTemperatureKelvin: actual.colorTemperatureKelvin,
    historyBefore: actual.historyBefore,
    targetState: actual.targetState,
  }
  if (comparable(actualShape) !== comparable(expectedShape)) {
    fail(example, `expected operation shape ${comparable(expectedShape)}, received ${comparable(actualShape)}`)
  }
}

function validateExample(example: CorpusExample) {
  const userTurns = example.turns.filter((turn) => turn.role === 'user')
  if (!userTurns.length) fail(example, 'contains no user utterance')
  for (const turn of userTurns) if (turn.text.length > 180) fail(example, `user utterance is ${turn.text.length} characters`)
  const expected = example.expected
  const context = expected.context as LightContext | undefined
  const result = parseLightUtterance(userTurns.at(-1)!.text, context)
  if (!result) fail(example, 'was not recognized as a light request')

  if (typeof expected.status === 'string') {
    if (result.status !== expected.status) fail(example, `expected status ${expected.status}, received ${result.status}`)
    if (typeof expected.text === 'string' && result.text !== expected.text) fail(example, `expected text ${expected.text}, received ${result.text}`)
    if (typeof expected.control === 'string' && !result.controls.some((control) => control.kind === expected.control)) {
      fail(example, `expected ${expected.control} control`)
    }
    if (typeof expected.room === 'string' && result.context?.roomId !== HOUSE_LIGHT_ROOMS.find((room) => room.name === expected.room)?.id) {
      fail(example, `expected clarification context for ${expected.room}`)
    }
    return
  }

  if (expected.tool === 'home_lights') {
    if (result.status !== 'ready') fail(example, `expected ready tool plan, received ${result.status}: ${result.text}`)
    const operations = Array.isArray(expected.operations) ? expected.operations as Record<string, unknown>[] : []
    if (operations.length) {
      if (result.operations?.length !== operations.length) fail(example, `expected ${operations.length} operations, received ${result.operations?.length ?? 0}`)
      operations.forEach((operation, index) => validateOperation(example, result.operations![index], operation))
    }
    if (context) {
      if (result.context?.roomId !== context.roomId || comparable(result.context?.entityIds) !== comparable(context.entityIds)) {
        fail(example, `context target was not retained: ${comparable(result.context)}`)
      }
    }
    return
  }

  fail(example, 'has an unsupported expected contract')
}

export function validateCorpus(targetUtterances = 10_000): ValidationSummary {
  const ids = new Set<string>()
  const families: ValidationSummary['families'] = {}
  let totalExamples = 0
  let totalUtterances = 0

  for (const [family] of CORPUS_FAMILIES) {
    const generated = generateFamily(family, targetUtterances)
    const rooms = new Set<string>()
    let postfix = 0
    for (const item of generated.examples) {
      if (ids.has(item.id)) fail(item, 'duplicates an id from another family')
      ids.add(item.id)
      validateExample(item)
      for (const operation of Array.isArray(item.expected.operations) ? item.expected.operations as Record<string, unknown>[] : []) {
        if (typeof operation.room === 'string') rooms.add(operation.room)
      }
      if (typeof item.expected.room === 'string') rooms.add(item.expected.room)
      const expectedContext = item.expected.context as LightContext | undefined
      const contextRoom = expectedContext?.roomId ? HOUSE_LIGHT_ROOMS.find((room) => room.id === expectedContext.roomId) : undefined
      if (contextRoom) rooms.add(contextRoom.name)
      const lastUser = item.turns.filter((turn) => turn.role === 'user').at(-1)?.text.toLowerCase() ?? ''
      if (/\blights?\b.*\b(on|off)\b/.test(lastUser)) postfix += 1
    }
    const missing = expectedRooms(family).map((room) => room.name).filter((room) => !rooms.has(room))
    if (targetUtterances >= 10_000 && missing.length) throw new Error(`${family} does not cover rooms: ${missing.join(', ')}`)
    if (['single-room-on', 'single-room-off', 'named-light-on', 'named-light-off'].includes(family) && postfix === 0) {
      throw new Error(`${family} contains no postfix on/off phrasing`)
    }
    families[family] = { examples: generated.examples.length, utterances: generated.utterances, rooms: [...rooms].sort() }
    totalExamples += generated.examples.length
    totalUtterances += generated.utterances
  }

  return { families, totalExamples, totalUtterances, uniqueIds: ids.size }
}

if (process.argv[1]?.endsWith('validate-lights.ts')) {
  const args = process.argv.slice(2)
  const target = Number(args[args.indexOf('--utterances-per-family') + 1] ?? 10_000)
  if (!Number.isInteger(target) || target < 1) throw new Error('Usage: validate-lights [--utterances-per-family 10000]')
  process.stdout.write(`${JSON.stringify(validateCorpus(target), null, 2)}\n`)
}
