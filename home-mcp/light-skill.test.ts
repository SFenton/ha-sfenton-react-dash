import { buildLightPlan, parseLightUtterance } from './light-skill'
import { HOUSE_LIGHT_ROOMS } from './lights-config'

// @covers home-mcp/lights-config.ts
describe('house light semantics', () => {
  it('keeps the canonical light capability map immutable at runtime', () => {
    expect(Object.isFrozen(HOUSE_LIGHT_ROOMS)).toBe(true)
    expect(Object.isFrozen(HOUSE_LIGHT_ROOMS[0])).toBe(true)
    expect(Object.isFrozen(HOUSE_LIGHT_ROOMS[0].lights)).toBe(true)
    expect(() => {
      HOUSE_LIGHT_ROOMS[0].groupEntityId = 'switch.unrelated_target'
    }).toThrow()
  })

  it('asks for a room when the target is ambiguous', () => {
    const response = parseLightUtterance('Turn on the lights')
    expect(response).toMatchObject({ status: 'clarify', text: 'Which room?' })
    expect(response?.controls[0]).toMatchObject({ kind: 'room-picker' })
  })

  it('supports both prefix and postfix on/off phrasing', () => {
    expect(parseLightUtterance('Turn the living room lights on')?.operations?.[0]).toMatchObject({
      action: 'on', room: expect.objectContaining({ id: 'living-room' }), entityIds: [],
    })
    expect(parseLightUtterance('Turn the front left living room light on')?.operations?.[0]).toMatchObject({
      action: 'on', entityIds: ['light.living_room_front_left_light'], lightNames: ['Front Left'],
    })
  })

  it('supports casual action synonyms and room aliases', () => {
    expect(parseLightUtterance('Enable the cinema lights')?.operations?.[0]).toMatchObject({
      action: 'on', room: expect.objectContaining({ id: 'theater-room' }),
    })
    expect(parseLightUtterance('Kill the upper deck lights')?.operations?.[0]).toMatchObject({
      action: 'off', room: expect.objectContaining({ id: 'back-deck' }),
    })
    expect(parseLightUtterance('Brighten the main bedroom lights')?.operations?.[0]).toMatchObject({
      action: 'up', room: expect.objectContaining({ id: 'master-bedroom' }),
    })
  })

  it('does not mistake a fixture name or trailing phrase for another target', () => {
    expect(parseLightUtterance('Turn the Gym Light in the Hallway to 30%')?.operations).toEqual([
      expect.objectContaining({ room: expect.objectContaining({ id: 'hallway' }), lightNames: ['Gym Light'] }),
    ])
    expect(parseLightUtterance('Turn on the Bollard 1 in the exterior right now')?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'front-yard' }), lightNames: ['Bollard 1'],
    })
    expect(parseLightUtterance('Turn on the exterior right now.')?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'front-yard' }),
      entityIds: [],
      lightNames: [],
    })
    expect(parseLightUtterance('Turn on the Living Room TV.')).toBeNull()
    expect(parseLightUtterance('Turn off the Hallway Office Light.')?.operations).toEqual([
      expect.objectContaining({
        room: expect.objectContaining({ id: 'hallway' }),
        entityIds: ['light.hallway_office_light'],
        lightNames: ['Office Light'],
      }),
    ])
    expect(parseLightUtterance('Turn on Bollard 12 in the front yard.')).toBeNull()
    const mismatched = parseLightUtterance('Turn off the Office Light in the Kitchen.')
    expect(mismatched).toMatchObject({
      status: 'unsupported',
      text: 'That light is not configured in the Kitchen.',
    })
    expect(mismatched?.operations).toBeUndefined()
  })

  it('resolves living room positional subsets', () => {
    const response = parseLightUtterance('Turn off the front two lights in the living room')
    expect(response?.status).toBe('ready')
    expect(response?.operations?.[0].entityIds).toEqual([
      'light.living_room_front_left_light',
      'light.living_room_front_right_light',
    ])
  })

  it('keeps respectively ordered brightness values', () => {
    const response = parseLightUtterance('Turn the back right and front left lights in the living room to 18% and 33% respectively')
    expect(response?.operations?.[0]).toMatchObject({
      entityIds: ['light.living_room_back_right_light', 'light.living_room_front_left_light'],
      lightNames: ['Back Right', 'Front Left'],
      brightnessPct: [18, 33],
    })
  })

  it('matches named colors as complete words rather than substrings', () => {
    const response = parseLightUtterance('Set the Music Room lights to one hundred percent')
    expect(response?.operations?.[0]).not.toMatchObject({ action: 'color', colorName: 'red' })
  })

  it('expands compound multi-room commands', () => {
    const response = parseLightUtterance('Turn on the master bedroom and guest bathroom lights and turn off the downstairs hallway lights')
    expect(response?.operations?.map((operation) => [operation.action, operation.room.id])).toEqual([
      ['on', 'master-bedroom'],
      ['on', 'guest-bathroom'],
      ['off', 'downstairs-hallway'],
    ])
    const ordered = parseLightUtterance('Turn off the Kitchen lights and turn on the Living Room lights')
    expect(ordered?.context).toMatchObject({ roomId: 'living-room', lastAction: 'on' })
    expect(parseLightUtterance('Turn them off', ordered?.context)?.operations?.[0].room.id).toBe('living-room')
  })

  it('asks for a color when a room-specific change omits the value', () => {
    expect(parseLightUtterance('Change the Music Room lights.')).toMatchObject({
      status: 'clarify',
      text: 'What color would you like to change the Music Room lights to?',
      controls: [expect.objectContaining({ kind: 'color-picker', room: 'Music Room' })],
    })
  })

  it('intersects custom color capability across every requested room', () => {
    expect(parseLightUtterance('Change the Living Room and Music Room light colors.')).toMatchObject({
      status: 'clarify',
      controls: [expect.objectContaining({ colorMode: 'temperature', supportsCustomRgb: false, rooms: ['Living Room', 'Music Room'] })],
    })
    expect(parseLightUtterance('Change the Front Yard and Music Room light colors.')).toMatchObject({
      status: 'clarify',
      controls: [expect.objectContaining({ colorMode: 'rgb', supportsCustomRgb: true, rooms: ['Front Yard', 'Music Room'] })],
    })
  })

  it('accepts bounded custom Kelvin values for temperature and RGB lights', () => {
    expect(parseLightUtterance('Turn the Living Room and Music Room lights to 4250K')?.operations?.map((operation) => operation.colorTemperatureKelvin)).toEqual([4250, 4250])
    expect(parseLightUtterance('Turn the Living Room lights to 7000K')).toMatchObject({ status: 'unsupported' })
  })

  it('supports RGB only in configured rooms', () => {
    expect(buildLightPlan({ action: 'color', room: 'Music Room', color_name: 'purple' }).status).toBe('ready')
    expect(buildLightPlan({ action: 'color', room: 'Living Room', color_name: 'purple' })).toMatchObject({
      status: 'unsupported',
      text: 'That color is unsupported in the Living Room.',
    })
    expect(buildLightPlan({ action: 'color', room: 'Living Room', color_name: 'warm white' }).status).toBe('ready')
    expect(buildLightPlan({ action: 'color', room: 'Garage', color_name: 'warm white' }).status).toBe('ready')
    expect(buildLightPlan({ action: 'color', room: 'Garage', color_name: 'purple' })).toMatchObject({
      status: 'unsupported', text: 'That color is unsupported in the Garage.',
    })
    expect(buildLightPlan({ action: 'color', room: 'Entryway', color_name: 'white' })).toMatchObject({
      status: 'unsupported', text: 'That color is unsupported in the Entryway.',
    })
    for (const room of ['Dining Room', 'Guest Bathroom', 'Master Bathroom']) {
      expect(buildLightPlan({ action: 'color', room, color_name: 'warm white' })).toMatchObject({
        status: 'unsupported', text: `That color is unsupported in the ${room}.`,
      })
      expect(parseLightUtterance(`Change the ${room} light color.`)).toMatchObject({
        status: 'unsupported',
        controls: [],
      })
    }
    const colorRoomPicker = parseLightUtterance('Change the light color.')
    expect(colorRoomPicker).toMatchObject({ status: 'clarify' })
    expect(colorRoomPicker?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.not.arrayContaining([
        expect.objectContaining({ label: 'Dining Room' }),
        expect.objectContaining({ label: 'Guest Bathroom' }),
        expect.objectContaining({ label: 'Master Bathroom' }),
      ]),
    })
    expect(parseLightUtterance('Change the Master Bathroom and Music Room light colors.')).toMatchObject({
      status: 'unsupported',
      controls: [],
    })
    expect(buildLightPlan({ action: 'pbl', room: 'Master Bathroom' }).operations?.[0].room.pblEntityId)
      .toBe('switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed')
  })

  it('carries an explicit room across long conversations', () => {
    const context = { domain: 'lights' as const, roomId: 'living-room', entityIds: [], lightNames: [] }
    let response = parseLightUtterance('Turn them down', context)
    for (let index = 0; index < 100; index += 1) {
      response = parseLightUtterance('Are they on?', response?.context ?? context)
    }
    expect(response?.operations?.[0].room.id).toBe('living-room')
  })

  it('preserves the requested action in room-picker continuations', () => {
    const response = parseLightUtterance('Turn off the lights')
    expect(response?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Kitchen', message: 'Turn off the Kitchen lights.' }),
      ]),
    })
    expect(parseLightUtterance('Set the lights to 30%')?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Kitchen', message: 'Turn the Kitchen lights to 30%.' }),
      ]),
    })
  })

  it('reuses contextual fixtures for pronouns but lets an explicit room override them', () => {
    const context = {
      domain: 'lights' as const, roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'], lightNames: ['Front Left'],
    }
    expect(parseLightUtterance('Turn it off', context)?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'living-room' }),
      entityIds: ['light.living_room_front_left_light'],
    })
    expect(parseLightUtterance('Are the kitchen lights on?', context)?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'kitchen' }), entityIds: [],
    })
    expect(parseLightUtterance('Turn on the TV', context)).toBeNull()
  })

  it('explains Presence-Based Lighting without repeating the status query', () => {
    expect(parseLightUtterance('What does Presence-Based Lighting mean in the Living Room?')).toMatchObject({
      status: 'answer',
      text: expect.stringContaining('allowed to manage the Living Room lights from presence'),
    })
  })

  it('rejects brightness control for the non-dimmable Entryway switch', () => {
    expect(buildLightPlan({ action: 'set', room: 'Entryway', brightness_pct: 30 })).toMatchObject({
      status: 'unsupported', text: 'The Entryway light does not support brightness control.',
    })
  })

  it('rejects negated commands without creating an operation', () => {
    expect(parseLightUtterance("Don't turn on the Living Room lights.")).toMatchObject({
      status: 'unsupported',
      text: expect.stringContaining('did not change'),
    })
  })

  it('rejects arbitrary entity IDs, unknown fixture names, and oversized operation lists', () => {
    expect(buildLightPlan({
      action: 'on',
      room: 'Living Room',
      entity_ids: ['switch.garage_door'],
    })).toMatchObject({ status: 'unsupported', text: expect.stringContaining('not configured') })
    expect(buildLightPlan({
      action: 'off',
      room: 'Living Room',
      light_names: ['Imaginary Lamp'],
    })).toMatchObject({ status: 'unsupported', text: expect.stringContaining('could not find') })
    expect(buildLightPlan({
      operations: Array.from({ length: 13 }, () => ({ action: 'on', room: 'Living Room' })),
    })).toMatchObject({ status: 'failed', text: expect.stringContaining('between 1 and 12') })
  })

  it('handles persisted overnight query continuations deterministically', () => {
    const room = { domain: 'lights' as const, roomId: 'living-room', entityIds: [], lightNames: [] }
    expect(parseLightUtterance('How many lights are on in the Living Room?')?.operations?.[0].action).toBe('count')
    expect(parseLightUtterance('Which ones?', { ...room, lastAction: 'count' })?.operations?.[0].action).toBe('list')
    expect(parseLightUtterance("What's their brightness?", { ...room, lastAction: 'list' })?.operations?.[0].action).toBe('brightness-state')
    expect(parseLightUtterance('What about now?', { ...room, lastAction: 'count' })?.operations?.[0].action).toBe('count')
    expect(parseLightUtterance('What about before that?', { ...room, lastAction: 'history', historyBefore: '2026-09-08T12:00:00Z' })?.operations?.[0]).toMatchObject({
      action: 'history', historyBefore: '2026-09-08T12:00:00Z',
    })
    expect(parseLightUtterance('why?', { ...room, lastAction: 'state', lastState: 'off' })?.operations?.[0]).toMatchObject({ action: 'reason', targetState: 'off' })
    expect(parseLightUtterance('And what are those rules?', { ...room, lastAction: 'pbl' })?.operations?.[0].action).toBe('pbl-rules')
    expect(parseLightUtterance('Which rooms have lights on?')?.operations?.every((operation) => operation.action === 'rooms-on')).toBe(true)
  })

  it('preserves fixture targets and polarity for state, history, and reason queries', () => {
    const state = parseLightUtterance('Is the Front Left light in the Living Room off?')
    expect(state?.operations?.[0]).toMatchObject({
      action: 'state',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
      targetState: 'off',
    })
    expect(state?.context).toMatchObject({ targetState: 'off' })
    expect(parseLightUtterance('What about now?', state?.context)?.operations?.[0]).toMatchObject({
      action: 'state',
      targetState: 'off',
    })
    const history = parseLightUtterance('When did the Front Left light in the Living Room turn on?')
    expect(history?.operations?.[0]).toMatchObject({
      action: 'history',
      entityIds: ['light.living_room_front_left_light'],
      targetState: 'on',
    })
    expect(parseLightUtterance('What about before that?', {
      ...history!.context!,
      historyBefore: '2026-09-08T12:00:00Z',
    })?.operations?.[0]).toMatchObject({
      action: 'history',
      entityIds: ['light.living_room_front_left_light'],
      targetState: 'on',
    })
    expect(parseLightUtterance('Why did the Front Left light in the Living Room turn off?')?.operations?.[0]).toMatchObject({
      action: 'reason',
      entityIds: ['light.living_room_front_left_light'],
      targetState: 'off',
    })
  })

  it('keeps coordinated room scope after one shared preposition', () => {
    expect(parseLightUtterance('Turn on the lights in the Kitchen and Living Room.')?.operations?.map((operation) => operation.room.id))
      .toEqual(['kitchen', 'living-room'])
    expect(parseLightUtterance('Are the lights in the Kitchen, Living Room, and Music Room on?')?.operations?.map((operation) => operation.room.id))
      .toEqual(['kitchen', 'living-room', 'music-room'])
  })

  it('does not actuate negated or informational action phrases', () => {
    const negated = parseLightUtterance("Don't enable the Kitchen lights.")
    expect(negated).toMatchObject({ status: 'unsupported' })
    expect(negated?.operations).toBeUndefined()
    expect(parseLightUtterance('When did the Living Room lights turn on?')?.operations?.[0]).toMatchObject({
      action: 'history',
      targetState: 'on',
    })
    expect(parseLightUtterance('Who turned on the Living Room lights?')).toBeNull()
    expect(parseLightUtterance('Could you not turn on the Living Room lights?')).toMatchObject({ status: 'unsupported' })
    expect(parseLightUtterance('Should I turn on the Kitchen lights?')).toBeNull()
    expect(parseLightUtterance("Shouldn't I turn on the Kitchen lights?")).toMatchObject({ status: 'unsupported' })
    expect(parseLightUtterance('Would it be okay if I turn on the Kitchen lights?')).toBeNull()
  })

  it('parses compact mixed-polarity compound commands by clause', () => {
    expect(parseLightUtterance('Turn the Kitchen lights on and the Living Room lights off.')?.operations?.map((operation) => [
      operation.room.id,
      operation.action,
    ])).toEqual([
      ['kitchen', 'on'],
      ['living-room', 'off'],
    ])
    expect(parseLightUtterance('Turn the Kitchen lights on and the Living Room lights off and the Hallway lights on.')?.operations?.map((operation) => [
      operation.room.id,
      operation.action,
    ])).toEqual([
      ['kitchen', 'on'],
      ['living-room', 'off'],
      ['hallway', 'on'],
    ])
  })

  it('preserves fixture targets in color clarification controls', () => {
    const context = { domain: 'lights' as const, roomId: 'living-room', entityIds: ['light.living_room_front_left_light'], lightNames: ['Front Left'] }
    expect(parseLightUtterance('I want to change its color', context)).toMatchObject({
      status: 'clarify',
      controls: [expect.objectContaining({ kind: 'color-picker', subject: 'Front Left in the Living Room' })],
      context: expect.objectContaining(context),
    })
  })

  it('does not widen a spoofed contextual fixture into the whole room', () => {
    const context = {
      domain: 'lights' as const,
      roomId: 'living-room',
      entityIds: ['switch.garage_door'],
      lightNames: ['Imaginary Lamp'],
    }
    expect(parseLightUtterance('I want to change its color', context)).toMatchObject({
      status: 'unsupported',
      controls: [],
      text: expect.stringContaining('could not match'),
    })
  })

  it('does not guess an undefined default', () => {
    expect(parseLightUtterance('Set them back to default', { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [] })).toMatchObject({
      status: 'clarify', text: expect.stringContaining('defined default'),
    })
  })

  it('keeps every room in a multi-room state query', () => {
    expect(parseLightUtterance('Are the Hallway or Guest Bathroom lights on?')?.operations?.map((operation) => operation.room.id)).toEqual(['hallway', 'guest-bathroom'])
  })

  it('enforces the 180 character user-message boundary', () => {
    expect(parseLightUtterance(`Turn on the living room lights ${'x'.repeat(150)}`)).toMatchObject({
      status: 'failed',
      text: 'Messages can contain at most 180 characters.',
    })
  })
})
