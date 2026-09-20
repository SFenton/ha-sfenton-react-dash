import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { HOUSE_LIGHT_ROOMS, RGB_COLORS, WHITE_COLORS } from '../lights-config'

export interface CorpusTurn { role: 'user' | 'assistant'; text: string }
export interface CorpusExample {
  id: string
  family: string
  language: 'en'
  targetModel: 'gemini'
  turns: CorpusTurn[]
  expected: Record<string, unknown>
}

const openers = ['', 'Please ', 'Can you ', 'Could you ', 'Would you ', 'Hey, ', 'Quickly, ', 'For me, ', 'When you can, ', 'I need you to ']
const endings = ['', '.', ' please.', ' for me.', ' right now.', ' when you can.', ' thanks.', ' if you can.']
const setVerbs = ['turn', 'set', 'put', 'change', 'adjust']
const roomReferences = (room: (typeof HOUSE_LIGHT_ROOMS)[number]) => [...new Set([room.name, ...room.aliases])]
const lightReferences = (light: (typeof HOUSE_LIGHT_ROOMS)[number]['lights'][number]) => [...new Set([light.name, ...(light.aliases ?? [])])]

function actionBodies(action: 'on' | 'off', target: string) {
  return action === 'on'
    ? [`turn on ${target}`, `turn ${target} on`, `switch on ${target}`, `switch ${target} on`, `put ${target} on`]
    : [`turn off ${target}`, `turn ${target} off`, `switch off ${target}`, `switch ${target} off`, `shut off ${target}`, `shut ${target} off`]
}
const levels = Array.from({ length: 101 }, (_, value) => value)
const commandContexts = ['', ' for now', ' for this evening', ' before dinner', ' while we are home', ' until I change them', ' as the next step', ' for this scene', ' before we leave', ' for the next hour', ' while I finish this', ' for everyone', ' just this once', ' as requested', ' without a transition']
const queryContexts = ['', ' right now', ' at the moment', ' as a quick check', ' before I change anything', ' based on Home Assistant', ' from the latest state', ' for this room']
const rgbNames = Object.keys(RGB_COLORS)
const whiteNames = Object.keys(WHITE_COLORS)

const spokenLightName = (name: string) => /light$/i.test(name) ? name : `${name} light`
const roomScope = (room: (typeof HOUSE_LIGHT_ROOMS)[number], roomName: string) => `${room.id === 'back-deck' ? 'on' : 'in'} the ${roomName}`
const normalizedName = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim()

function namedTarget(room: (typeof HOUSE_LIGHT_ROOMS)[number], lightName: string, roomName: string) {
  const spoken = spokenLightName(lightName)
  const alreadyScoped = roomReferences(room).some((reference) => normalizedName(spoken).includes(normalizedName(reference)))
  return `the ${spoken}${alreadyScoped ? '' : ` ${roomScope(room, roomName)}`}`
}

function phrase(opener: string, body: string, ending: string) {
  const temporalBody = /\b(for now|for this evening|for the next hour|in a moment|before dinner|before we leave|when you can)$/i.test(body)
  const repeatedFor = /\bfor now$/i.test(body) && /^\s+for me/i.test(ending)
  const repeatedWhen = /\bwhen you can$/i.test(body) && /^\s+when you can/i.test(ending)
  const conflictingEnding = (temporalBody && /^\s+(right now|when you can|for me)/i.test(ending)) || repeatedFor || repeatedWhen
  const safeEnding = conflictingEnding ? ending.match(/[.!?]$/)?.[0] ?? '' : ending
  const composed = `${opener}${body}${safeEnding}`.replace(/\s+/g, ' ').trim()
  return composed.charAt(0).toUpperCase() + composed.slice(1)
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

function example(family: string, turns: CorpusTurn[], expected: Record<string, unknown>): CorpusExample {
  return { id: `${family}-${hash({ turns, expected })}`, family, language: 'en', targetModel: 'gemini', turns, expected }
}

function* singleRoom(action: 'on' | 'off') {
  for (const opener of openers) for (const context of commandContexts) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS) for (const roomName of roomReferences(room)) {
    for (const generatedBody of actionBodies(action, `the ${roomName} lights`)) {
      const body = generatedBody.replace(/^light up the (.+) lights$/i, 'light up the $1')
      yield example(`single-room-${action}`, [{ role: 'user', text: phrase(opener, `${body}${context}`, ending) }], { tool: 'home_lights', operations: [{ action, room: room.name }] })
    }
  }
}

function* relative(action: 'up' | 'down') {
  const verbs = action === 'up' ? ['turn up', 'raise', 'brighten', 'make brighter'] : ['turn down', 'lower', 'dim', 'make dimmer']
  for (const verb of verbs) for (const opener of openers) for (const context of commandContexts) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS.filter((candidate) => candidate.dimmable !== false)) for (const roomName of roomReferences(room)) {
    yield example(`relative-${action}`, [{ role: 'user', text: phrase(opener, `${verb} the ${roomName} lights${context}`, ending) }], { tool: 'home_lights', operations: [{ action, room: room.name, delta: 10, clamp: [0, 100] }] })
  }
}

function* brightness() {
  for (const level of levels) for (const verb of setVerbs) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS.filter((candidate) => candidate.dimmable !== false)) for (const roomName of roomReferences(room)) {
    yield example('room-brightness', [{ role: 'user', text: phrase('', `${verb} the ${roomName} lights to ${level}%`, ending) }], { tool: 'home_lights', operations: [{ action: 'set', room: room.name, brightness_pct: level }] })
  }
}

function* unsupportedBrightness() {
  for (const room of HOUSE_LIGHT_ROOMS.filter((candidate) => candidate.dimmable === false)) for (const roomName of roomReferences(room)) {
    for (const action of ['up', 'down'] as const) {
      const verbs = action === 'up' ? ['turn up', 'raise', 'brighten', 'make brighter'] : ['turn down', 'lower', 'dim', 'make dimmer']
      for (const verb of verbs) for (const opener of openers) for (const context of commandContexts) for (const ending of endings) {
        yield example('unsupported-brightness', [{ role: 'user', text: phrase(opener, `${verb} the ${roomName} lights${context}`, ending) }], { status: 'unsupported', text: `The ${room.name} light does not support brightness control.`, room: room.name })
      }

    }
    for (const level of levels) for (const verb of setVerbs) for (const ending of endings) {
      yield example('unsupported-brightness', [{ role: 'user', text: phrase('', `${verb} the ${roomName} lights to ${level}%`, ending) }], { status: 'unsupported', text: `The ${room.name} light does not support brightness control.`, room: room.name })
    }
  }

}

function* negatedCommands() {
  const negations = ["don't", 'do not', 'never']
  const actions = [
    ['turn on', 'on'],
    ['turn off', 'off'],
    ['dim', 'down'],
    ['brighten', 'up'],
    ['set', 'set'],
  ] as const
  for (const negation of negations) for (const [verb, action] of actions) for (const opener of ['', 'Please ', 'Hey, ', 'For me, ']) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS) for (const roomName of roomReferences(room)) {
    const value = action === 'set' ? ' to 30%' : ''
    yield example('negated-command', [{
      role: 'user',
      text: phrase(opener, `${negation} ${verb} the ${roomName} lights${value}`, ending),
    }], {
      status: 'unsupported',
      text: 'I did not change the lights because that request was phrased as something not to do.',
      room: room.name,
    })
  }
}

function* namedLightBrightness() {
  const targets = HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable !== false).flatMap((room) => room.lights.flatMap((light) => lightReferences(light).flatMap((lightName) => roomReferences(room).map((roomName) => ({ room, light, lightName, roomName })))))
  for (const level of levels) for (const verb of setVerbs) for (const ending of endings) for (const { room, light, lightName, roomName } of targets) {
    yield example('named-light-brightness', [{ role: 'user', text: phrase('', `${verb} ${namedTarget(room, lightName, roomName)} to ${level}%`, ending) }], { tool: 'home_lights', operations: [{ action: 'set', room: room.name, light_names: [light.name], brightness_pct: level }] })
  }
}

function* namedLightAction(action: 'on' | 'off') {
  const targets = HOUSE_LIGHT_ROOMS.flatMap((room) => room.lights.flatMap((light) => lightReferences(light).flatMap((lightName) => roomReferences(room).map((roomName) => ({ room, light, lightName, roomName })))))
  for (const opener of openers) for (const ending of endings) for (const { room, light, lightName, roomName } of targets) for (const body of actionBodies(action, namedTarget(room, lightName, roomName)).filter((candidate) => !candidate.startsWith('light up '))) {
    yield example(`named-light-${action}`, [{ role: 'user', text: phrase(opener, body, ending) }], { tool: 'home_lights', operations: [{ action, room: room.name, light_names: [light.name] }] })
  }
}

function lightPairs() {
  return HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable !== false && room.lights.length > 1).flatMap((room) => {
    const pairs: Array<{ room: (typeof HOUSE_LIGHT_ROOMS)[number]; names: [string, string]; roomName: string }> = []
    for (let first = 0; first < room.lights.length; first += 1) for (let second = first + 1; second < room.lights.length; second += 1) {
      for (const roomName of roomReferences(room)) pairs.push({ room, names: [room.lights[first].name, room.lights[second].name], roomName })
    }
    return pairs
  })
}

function* multiLight(family: 'multi-light-same-brightness' | 'multi-light-respectively') {
  const pairs = lightPairs()
  if (family === 'multi-light-same-brightness') {
    for (const level of levels) for (const ending of endings) for (const { room, names, roomName } of pairs) {
      yield example(family, [{ role: 'user', text: phrase('', `turn the ${spokenLightName(names[0])} and ${spokenLightName(names[1])} ${roomScope(room, roomName)} to ${level}%`, ending) }], { tool: 'home_lights', operations: [{ action: 'set', room: room.name, light_names: names, brightness_pct: level }] })
    }
    return
  }
  for (const firstLevel of levels) for (const secondLevel of levels.slice().reverse()) for (const { room, names, roomName } of pairs) {
    yield example(family, [{ role: 'user', text: `Turn the ${spokenLightName(names[0])} and ${spokenLightName(names[1])} ${roomScope(room, roomName)} to ${firstLevel}% and ${secondLevel}% respectively.` }], { tool: 'home_lights', operations: [{ action: 'set', room: room.name, light_names: names, brightness_pct: [firstLevel, secondLevel] }] })
  }
}

function* colors(family: 'supported-color' | 'unsupported-color') {
  if (family === 'supported-color') {
    const supported = HOUSE_LIGHT_ROOMS.filter((room) => room.color !== 'none').flatMap((room) => roomReferences(room).map((roomName) => ({ room, roomName })))
    for (const verb of setVerbs) for (const opener of openers) for (const ending of endings) for (const color of [...rgbNames, ...whiteNames]) for (const { room, roomName } of supported) {
      if (room.color !== 'rgb' && !whiteNames.includes(color)) continue
      yield example(family, [{ role: 'user', text: phrase(opener, `${verb} the ${roomName} lights to ${color}`, ending) }], {
        tool: 'home_lights',
        operations: [{
          action: 'color',
          room: room.name,
          color_name: color,
          rgb_color: !(color in WHITE_COLORS) && color in RGB_COLORS && room.color === 'rgb' ? RGB_COLORS[color] : null,
          color_temperature_kelvin: color in WHITE_COLORS ? WHITE_COLORS[color] : null,
        }],
      })
    }
    return
  }
  const unsupported = HOUSE_LIGHT_ROOMS.filter((room) => room.color !== 'rgb').flatMap((room) => roomReferences(room).map((roomName) => ({ room, roomName })))
  for (const color of [...new Set([...rgbNames.filter((name) => !whiteNames.includes(name)), ...whiteNames])]) for (const opener of openers) for (const context of commandContexts) for (const ending of endings) for (const { room, roomName } of unsupported) {
    if (room.color === 'temperature' && whiteNames.includes(color)) continue
    yield example(family, [{ role: 'user', text: phrase(opener, `turn the ${roomName} lights ${color}${context}`, ending) }], { status: 'unsupported', text: `That color is unsupported in the ${room.name}.`, room: room.name })
  }
}

function* queries(family: string) {
  const variant = [
    ['state-query', 'Are the {room} lights on?', 'state'],
    ['count-query', 'How many lights are on in the {room}?', 'count'],
    ['list-query', 'Tell me each light status in the {room}.', 'list'],
    ['brightness-query', 'What is the brightness of the {room} lights?', 'brightness-state'],
    ['color-state-query', 'What color are the {room} lights?', 'color-state'],
    ['history-query', 'When did the {room} lights turn off?', 'history'],
    ['reason-query', 'Why did the {room} lights turn on?', 'reason'],
    ['pbl-query', 'Is Presence-Based Lighting active in the {room}?', 'pbl'],
  ].find(([name]) => name === family)
  if (!variant) return
  const [, template, action] = variant
  const targetState = family === 'state-query' || family === 'reason-query'
    ? 'on'
    : family === 'history-query'
      ? 'off'
      : undefined
  for (const opener of openers) for (const context of queryContexts) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS) for (const roomName of roomReferences(room)) {
    const rendered = template.replace('{room}', roomName).replace(`in the ${roomName}`, roomScope(room, roomName))
    yield example(family, [{ role: 'user', text: phrase(opener, `${rendered.replace(/[?.]$/, '')}${context}`, ending || '?') }], {
      tool: 'home_lights',
      operations: [{ action, room: room.name, ...(targetState ? { target_state: targetState } : {}) }],
    })
  }
}

function* wholeHomeLightsOn() {
  const wrappers = [
    '', 'Please tell me ', 'Can you tell me ', 'Could you tell me ', 'Would you tell me ',
    'Hey, tell me ', 'Quickly tell me ', 'For me, tell me ', 'When you can, tell me ',
    'I need to know ', 'I want to know ', 'Let me know ', 'Check and tell me ', 'Take a look and tell me ',
  ]
  const bodies = [
    'what lights are on',
    'which lights are on',
    'what configured lights are on',
    'which configured lights are on',
    'what lights are currently on',
    'which lights are currently on',
    'what lights have been left on',
    'which lights have been left on',
    'what lights are switched on',
    'which lights are switched on',
  ]
  const yesNoBodies = [
    { direct: 'are any lights on', indirect: 'whether any lights are on' },
    { direct: 'do we have any lights on', indirect: 'whether we have any lights on' },
  ]
  const contexts = [
    '', ' right now', ' at the moment', ' in the house', ' throughout the house', ' across the home',
    ' before I change anything', ' based on the latest state', ' according to Home Assistant',
    ' while I am checking', ' as a quick status check', ' at present', ' currently',
    ' before we leave', ' while we are home', ' for a quick overview',
  ]
  const operations = HOUSE_LIGHT_ROOMS.map((room) => ({ action: 'lights-on', room: room.name }))
  for (const wrapper of wrappers) {
    const requests = [
      ...bodies.map((body) => `${wrapper}${body}`),
      ...yesNoBodies.map((body) => wrapper ? `${wrapper}${body.indirect}` : body.direct),
    ]
    for (const request of requests) for (const context of contexts) for (const ending of endings) {
      const candidate = `${request}${context}${ending}`.toLowerCase()
      const temporalMarkers = ['currently', 'right now', 'at the moment', 'at present']
        .reduce((count, marker) => count + candidate.split(marker).length - 1, 0)
      if ((candidate.match(/\bplease\b/g)?.length ?? 0) > 1
        || (candidate.match(/\bwhen you can\b/g)?.length ?? 0) > 1
        || (candidate.match(/\bfor me\b/g)?.length ?? 0) > 1
        || temporalMarkers > 1) continue
      yield example('whole-home-lights-on', [{ role: 'user', text: phrase('', `${request}${context}`, ending || '?') }], {
        tool: 'home_lights',
        operations,
      })
    }
  }
}

function* wholeHomeRoomDetailFollowUp() {
  const byCardinality: Array<Array<Array<(typeof HOUSE_LIGHT_ROOMS)[number]>>> = [
    HOUSE_LIGHT_ROOMS.map((room) => [room]),
    [],
    [],
  ]
  for (let first = 0; first < HOUSE_LIGHT_ROOMS.length; first += 1) {
    for (let second = first + 1; second < HOUSE_LIGHT_ROOMS.length; second += 1) {
      const pair = [HOUSE_LIGHT_ROOMS[first], HOUSE_LIGHT_ROOMS[second]]
      byCardinality[1].push(pair)
      for (let third = second + 1; third < HOUSE_LIGHT_ROOMS.length; third += 1) {
        const triple = [HOUSE_LIGHT_ROOMS[first], HOUSE_LIGHT_ROOMS[second], HOUSE_LIGHT_ROOMS[third]]
        byCardinality[2].push(triple)
      }
    }
  }
  const balanced = (items: Array<Array<(typeof HOUSE_LIGHT_ROOMS)[number]>>) => {
    const remaining = items.map((rooms, index) => ({ rooms, index }))
    const counts = new Map(HOUSE_LIGHT_ROOMS.map((room) => [room.id, 0]))
    const ordered: typeof items = []
    while (remaining.length) {
      remaining.sort((left, right) => {
        const leftCounts = left.rooms.map((room) => counts.get(room.id) ?? 0)
        const rightCounts = right.rooms.map((room) => counts.get(room.id) ?? 0)
        return Math.max(...leftCounts) - Math.max(...rightCounts)
          || leftCounts.reduce((sum, count) => sum + count, 0) - rightCounts.reduce((sum, count) => sum + count, 0)
          || left.index - right.index
      })
      const next = remaining.shift()!
      ordered.push(next.rooms)
      next.rooms.forEach((room) => counts.set(room.id, (counts.get(room.id) ?? 0) + 1))
    }
    return ordered
  }
  const balancedByCardinality = byCardinality.map(balanced)
  const wrappers = [
    '', 'Tell me about ', 'Show me ', 'How about ', 'What about ', 'I would like details for ',
    'Please show me ', 'Can you show me ', 'Could you show me ', 'Would you show me ',
    'Tell me more about ', 'Can you tell me about ', 'Could you tell me about ',
    'Would you tell me about ', 'Show me more about ', 'I would like more details for ',
  ]
  const selectionEndings = [
    '', '.', ' please.', '?', ', please.', ', thanks.', ' thanks.', ', thank you.',
    ' now.', ' please?', ' now?', ', please?', ', thanks?', ' thank you?',
  ]
  function* examplesFor(selections: Array<Array<(typeof HOUSE_LIGHT_ROOMS)[number]>>) {
    for (let wrapperIndex = 0; wrapperIndex < wrappers.length; wrapperIndex += 1) {
      for (const ending of selectionEndings) {
        for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex += 1) {
          const rooms = selections[selectionIndex]
          const names = rooms.map((room, roomIndex) => {
            const references = roomReferences(room)
            return references[(wrapperIndex + selectionIndex + roomIndex) % references.length]
          })
          const joined = names.length === 1
            ? names[0]
            : names.length === 2
              ? `${names[0]} and ${names[1]}`
              : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
          yield example('followup-whole-home-room-detail', [
            { role: 'user', text: 'What lights are on?' },
            { role: 'assistant', text: 'I found the rooms with lights on.' },
            { role: 'user', text: phrase('', `${wrappers[wrapperIndex]}${joined}`, ending) },
          ], {
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: rooms.map((room) => room.id),
              lastAction: 'lights-on',
            },
            tool: 'home_lights',
            operations: rooms.map((room) => ({ action: 'list', room: room.name })),
          })
        }
      }
    }
  }
  const iterators = balancedByCardinality.map((selections) => examplesFor(selections))
  while (true) {
    let emitted = false
    for (const iterator of iterators) {
      const next = iterator.next()
      if (next.done) continue
      emitted = true
      yield next.value
    }
    if (!emitted) break
  }
}

function* clarification(family: 'clarify-room' | 'clarify-color') {
  if (family === 'clarify-room') {
    for (const action of ['on', 'off'] as const) for (const body of actionBodies(action, 'the lights')) for (const opener of openers) for (const context of commandContexts) for (const ending of endings) {
      yield example(family, [{ role: 'user', text: phrase(opener, `${body}${context}`, ending) }], { status: 'clarify', control: 'room-picker' })
    }
    return
  }
  for (const opener of openers) for (const context of commandContexts) for (const ending of endings) for (const room of HOUSE_LIGHT_ROOMS.filter((candidate) => candidate.color !== 'none')) for (const roomName of roomReferences(room)) {
    yield example(family, [{ role: 'user', text: phrase(opener, `change the color of the ${roomName} lights${context}`, ending) }], { status: 'clarify', control: 'color-picker', room: room.name })
  }
}

function* compound() {
  const pairs = HOUSE_LIGHT_ROOMS.flatMap((first) => HOUSE_LIGHT_ROOMS.filter((second) => first !== second && second.dimmable !== false).map((second) => ({ first, second })))
  for (const level of levels) for (const ending of endings) for (const { first, second } of pairs) {
    yield example('compound-multi-room', [{ role: 'user', text: phrase('', `turn on the ${first.name} lights and turn the ${second.name} lights to ${level}%`, ending) }], { tool: 'home_lights', operations: [{ action: 'on', room: first.name }, { action: 'set', room: second.name, brightness_pct: level }] })
  }
}

function* replayConversations(family: string) {
  if (family === 'fixture-color-clarify') {
    for (const opener of openers) for (const ending of endings) for (const queryContext of queryContexts) for (const room of HOUSE_LIGHT_ROOMS.filter((candidate) => candidate.color !== 'none')) for (const light of room.lights) {
      const context = { domain: 'lights', roomId: room.id, entityIds: [light.entityId], lightNames: [light.name] }
      yield example(family, [
        { role: 'user', text: phrase(opener, `I want to change its color${queryContext}`, ending) },
      ], { context, status: 'clarify', control: 'color-picker', room: room.name })
    }
    return
  }

  const contexts = HOUSE_LIGHT_ROOMS.flatMap((room) => roomReferences(room).map((roomName) => ({ room, roomName })))
  for (const opener of openers) for (const ending of endings) for (const queryContext of queryContexts) for (const { room, roomName } of contexts) {
    const base = { domain: 'lights', roomId: room.id, entityIds: [], lightNames: [] }
    if (family === 'followup-which-ones') yield example(family, [
      { role: 'user', text: phrase(opener, `how many lights are on ${roomScope(room, roomName)}${queryContext}`, ending || '?') },
      { role: 'assistant', text: `I checked the ${room.name} lights.` }, { role: 'user', text: 'Which ones?' },
    ], { context: { ...base, lastAction: 'count' }, tool: 'home_lights', operations: [{ action: 'list', room: room.name }] })
    else if (family === 'followup-repeat-now') yield example(family, [
      { role: 'user', text: phrase(opener, `are the ${roomName} lights on${queryContext}`, ending || '?') },
      { role: 'assistant', text: `I checked the ${room.name} lights.` }, { role: 'user', text: 'What about now?' },
    ], { context: { ...base, lastAction: 'state' }, tool: 'home_lights', operations: [{ action: 'state', room: room.name }] })
    else if (family === 'followup-history-before') yield example(family, [
      { role: 'user', text: phrase(opener, `when did the ${roomName} lights turn off${queryContext}`, ending || '?') },
      { role: 'assistant', text: `I found the latest event.` }, { role: 'user', text: 'What about before that?' },
    ], { context: { ...base, lastAction: 'history', historyBefore: '2026-09-08T12:00:00Z' }, tool: 'home_lights', operations: [{ action: 'history', room: room.name, history_before: '2026-09-08T12:00:00Z' }] })
    else if (family === 'followup-bare-why') yield example(family, [
      { role: 'user', text: phrase(opener, `are the ${roomName} lights on${queryContext}`, ending || '?') },
      { role: 'assistant', text: `No, the ${room.name} lights are off.` }, { role: 'user', text: 'Why?' },
    ], { context: { ...base, lastAction: 'state', lastState: 'off' }, tool: 'home_lights', operations: [{ action: 'reason', room: room.name, target_state: 'off' }] })
    else if (family === 'followup-pbl-rules') yield example(family, [
      { role: 'user', text: phrase(opener, `is Presence-Based Lighting active ${roomScope(room, roomName)}${queryContext}`, ending || '?') },
      { role: 'assistant', text: `I checked Presence-Based Lighting in the ${room.name}.` }, { role: 'user', text: 'And what are those rules?' },
    ], { context: { ...base, lastAction: 'pbl' }, tool: 'home_lights', operations: [{ action: 'pbl-rules', room: room.name }] })
    else if (family === 'undefined-default') yield example(family, [
      { role: 'user', text: phrase(opener, `set the ${roomName} lights back to default${queryContext}`, ending) },
    ], { context: base, status: 'clarify', text: `I don’t have a defined default for the ${room.name} lights. Tell me the color or brightness you want instead.` })
  }
}

function* contextConversations() {
  const targets = HOUSE_LIGHT_ROOMS.filter((room) => room.dimmable !== false).flatMap((room) => room.lights.map((light) => ({ room, light })))
  for (let variant = 0; variant < 200; variant += 1) for (const { room, light } of targets) {
    const turns: CorpusTurn[] = [{ role: 'user', text: `Turn ${namedTarget(room, light.name, room.name)} to ${20 + variant % 70}%.` }, { role: 'assistant', text: `I turned the ${spokenLightName(light.name)} to ${20 + variant % 70}%.` }]
    for (let index = 0; index < 100; index += 1) {
      turns.push({ role: 'user', text: `Unrelated household question ${index + 1}?` }, { role: 'assistant', text: `Context-preserving answer ${index + 1}.` })
    }
    turns.push({ role: 'user', text: variant % 2 ? 'Turn it off.' : 'Set it to 40%.' })
    yield example('long-context-reference', turns, { context: { domain: 'lights', roomId: room.id, entityIds: [light.entityId], lightNames: [light.name] }, tool: 'home_lights' })
  }
}

export const CORPUS_FAMILIES = [
  ['single-room-on', () => singleRoom('on')], ['single-room-off', () => singleRoom('off')],
  ['relative-up', () => relative('up')], ['relative-down', () => relative('down')],
  ['room-brightness', brightness], ['unsupported-brightness', unsupportedBrightness], ['named-light-brightness', namedLightBrightness],
  ['negated-command', negatedCommands],
  ['named-light-on', () => namedLightAction('on')], ['named-light-off', () => namedLightAction('off')],
  ['multi-light-same-brightness', () => multiLight('multi-light-same-brightness')], ['multi-light-respectively', () => multiLight('multi-light-respectively')],
  ['supported-color', () => colors('supported-color')], ['unsupported-color', () => colors('unsupported-color')],
  ['state-query', () => queries('state-query')], ['count-query', () => queries('count-query')], ['list-query', () => queries('list-query')],
  ['brightness-query', () => queries('brightness-query')], ['color-state-query', () => queries('color-state-query')],
  ['history-query', () => queries('history-query')], ['reason-query', () => queries('reason-query')], ['pbl-query', () => queries('pbl-query')],
  ['whole-home-lights-on', wholeHomeLightsOn],
  ['followup-whole-home-room-detail', wholeHomeRoomDetailFollowUp],
  ['clarify-room', () => clarification('clarify-room')], ['clarify-color', () => clarification('clarify-color')],
  ['fixture-color-clarify', () => replayConversations('fixture-color-clarify')],
  ['followup-which-ones', () => replayConversations('followup-which-ones')], ['followup-repeat-now', () => replayConversations('followup-repeat-now')],
  ['followup-history-before', () => replayConversations('followup-history-before')], ['followup-bare-why', () => replayConversations('followup-bare-why')],
  ['followup-pbl-rules', () => replayConversations('followup-pbl-rules')], ['undefined-default', () => replayConversations('undefined-default')],
  ['compound-multi-room', compound], ['long-context-reference', contextConversations],
] as const

export function generateFamily(family: string, targetUtterances: number) {
  const factory = CORPUS_FAMILIES.find(([name]) => name === family)?.[1]
  if (!factory) throw new Error(`Unknown corpus family: ${family}`)
  const seen = new Set<string>()
  const uniqueUserUtterances = new Set<string>()
  const output: CorpusExample[] = []
  let utterances = 0
  for (const item of factory()) {
    if (item.family !== family || seen.has(item.id)) continue
    seen.add(item.id)
    output.push(item)
    const userTurns = item.turns.filter((turn) => turn.role === 'user')
    utterances += userTurns.length
    if (family === 'followup-whole-home-room-detail') {
      const followUp = userTurns.at(-1)
      if (followUp) uniqueUserUtterances.add(followUp.text)
    } else {
      userTurns.forEach((turn) => uniqueUserUtterances.add(turn.text))
    }
    const coverage = family === 'followup-whole-home-room-detail' ? uniqueUserUtterances.size : utterances
    if (coverage >= targetUtterances) break
  }
  const coverage = family === 'followup-whole-home-room-detail' ? uniqueUserUtterances.size : utterances
  if (coverage < targetUtterances) throw new Error(`${family} produced only ${coverage} user utterances; expected ${targetUtterances}`)
  return { examples: output, utterances }
}

async function main() {
  const args = process.argv.slice(2)
  const outputPath = args[args.indexOf('--out') + 1]
  const target = Number(args[args.indexOf('--utterances-per-family') + 1] ?? 10_000)
  if (!outputPath || !Number.isInteger(target) || target < 1) throw new Error('Usage: generate-lights --out <jsonl> [--utterances-per-family 10000]')
  const stream = createWriteStream(outputPath)
  const manifest: Record<string, number> = {}
  for (const [family] of CORPUS_FAMILIES) {
    const generated = generateFamily(family, target)
    manifest[family] = generated.utterances
    for (const item of generated.examples) if (!stream.write(`${JSON.stringify(item)}\n`)) await once(stream, 'drain')
  }
  stream.end()
  await once(stream, 'finish')
  process.stdout.write(`${JSON.stringify({ outputPath, targetModel: 'gemini', language: 'en', families: manifest, totalUtterances: Object.values(manifest).reduce((sum, count) => sum + count, 0) }, null, 2)}\n`)
}

if (process.argv[1]?.endsWith('generate-lights.ts')) void main()
