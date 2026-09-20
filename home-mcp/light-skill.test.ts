import {
  buildLightPlan, colorPickerResponse, HOME_CHAT_USER_LIMIT, parseLightUtterance, roomPickerResponse,
} from './light-skill'
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
    expect(parseLightUtterance('Set the Guest Bathroom Light in the Master Bedroom to 30%.')).toMatchObject({
      status: 'unsupported',
      text: expect.stringContaining('not configured'),
    })
    expect(mismatched?.operations).toBeUndefined()
    for (const text of [
      'Turn on the Sink Light in the basement.',
      'Set the Fireplace Light in the basement to 30%.',
      'In the basement, turn on the Sink Light.',
      'Turn off the Sink Light, in the basement.',
      'Set the Fireplace Light (in the basement) to 30%.',
      'Turn off the Sink Light - in the basement.',
      'Turn off the Sink Light. It is in the basement.',
    ]) {
      const unknownLocation = parseLightUtterance(text)
      expect(unknownLocation).toMatchObject({
        status: 'unsupported',
        text: 'That location is not configured for this light.',
      })
      expect(unknownLocation?.operations).toBeUndefined()
    }
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
    expect(parseLightUtterance(
      'Turn off the Sink Light and the Window Light in the Master Bedroom and Music Room.',
    )).toMatchObject({
      status: 'unsupported',
      text: expect.stringContaining('not configured'),
    })
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
    expect(parseLightUtterance('Please tell me why they are not currently on.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'state',
      lastState: 'on',
    })?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ message: 'Why did the Sink Light in the Kitchen turn off?' }),
      ]),
    })
    expect(parseLightUtterance('Can you please tell me why they are on?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
      lastAction: 'state',
      lastState: 'on',
    })?.operations?.[0]).toMatchObject({
      action: 'reason',
      lightNames: ['Front Left'],
      targetState: 'on',
    })
    for (const query of [
      'Tell me why they are not currently switched on.',
      'Why are they no longer switched on?',
      "Why don't they turn on?",
      "Why can't they turn on?",
    ]) {
      expect(parseLightUtterance(query, {
        domain: 'lights',
        roomId: 'living-room',
        entityIds: ['light.living_room_front_left_light'],
        lightNames: ['Front Left'],
        lastAction: 'state',
        lastState: 'on',
      })?.operations?.[0]).toMatchObject({
        action: 'reason',
        targetState: 'off',
      })
    }
    expect(parseLightUtterance('Why is Front Left on?')?.operations?.[0]).toMatchObject({
      action: 'reason',
      room: expect.objectContaining({ id: 'living-room' }),
      lightNames: ['Front Left'],
      targetState: 'on',
    })
    expect(parseLightUtterance('Tell me why Front Left is on.')?.operations?.[0]).toMatchObject({
      action: 'reason',
      room: expect.objectContaining({ id: 'living-room' }),
      lightNames: ['Front Left'],
      targetState: 'on',
    })
    expect(parseLightUtterance('Why is Front Left not on?')?.operations?.[0]).toMatchObject({
      action: 'reason',
      lightNames: ['Front Left'],
      targetState: 'off',
    })
    expect(parseLightUtterance('Please tell me why the Living Room lights did not turn on.')?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'off' })
    for (const query of [
      'Why are the Living Room lights no longer on?',
      'Why are the Living Room lights not yet on?',
    ]) {
      expect(parseLightUtterance(query)?.operations?.[0]).toMatchObject({
        action: 'reason',
        targetState: 'off',
      })
    }
    expect(parseLightUtterance('Why are they not currently on?', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'state',
      lastState: 'on',
    })?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ message: 'Why did the Sink Light in the Kitchen turn off?' }),
      ]),
    })
    expect(parseLightUtterance('Tell me why Front Left is not on.')?.operations?.[0]).toMatchObject({
      action: 'reason',
      lightNames: ['Front Left'],
      targetState: 'off',
    })
    expect(parseLightUtterance("Why isn't Front Left on?")?.operations?.[0]).toMatchObject({
      action: 'reason',
      lightNames: ['Front Left'],
      targetState: 'off',
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
    expect(parseLightUtterance('How many lights are on in the Living Room?', context)?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'living-room' }), entityIds: [], lightNames: [],
    })
    expect(parseLightUtterance('Change the Living Room lights color.', context)?.controls[0]).toMatchObject({
      kind: 'color-picker',
      entityIds: expect.arrayContaining([
        'light.living_room_front_left_light',
        'light.living_room_front_right_light',
      ]),
    })
    expect(parseLightUtterance('Change its color in the Living Room.', context)?.controls[0]).toMatchObject({
      kind: 'color-picker',
      entityIds: ['light.living_room_front_left_light'],
      subject: 'Front Left in the Living Room',
    })
    expect(parseLightUtterance('Change its color because the Sink Light is too bright.', context)?.controls[0]).toMatchObject({
      kind: 'color-picker',
      entityIds: ['light.living_room_front_left_light'],
      subject: 'Front Left in the Living Room',
    })
    expect(parseLightUtterance('What is its brightness in the Living Room?', context)?.operations?.[0]).toMatchObject({
      action: 'brightness-state',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
    })
    expect(parseLightUtterance('Turn on the TV', context)).toBeNull()
  })

  it('preserves current-turn fixture scope before asking for a room', () => {
    expect(parseLightUtterance('Turn off the Sink Light.')).toMatchObject({
      status: 'clarify',
      controls: [expect.objectContaining({
        kind: 'room-picker',
        options: [expect.objectContaining({
          label: 'Kitchen',
          message: 'Turn off the Sink Light in the Kitchen.',
        })],
      })],
    })
    const ambiguous = parseLightUtterance('Turn off the TV Light.')
    expect(ambiguous).toMatchObject({ status: 'clarify' })
    expect(ambiguous?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Guest Room', message: 'Turn off the TV Light in the Guest Room.' }),
        expect.objectContaining({ label: 'Music Room', message: 'Turn off the TV Light in the Music Room.' }),
      ]),
    })
    expect(ambiguous?.context).toMatchObject({ roomId: null, entityIds: [], lightNames: [] })
    const option = ambiguous?.controls[0]?.kind === 'room-picker' ? ambiguous.controls[0].options[0] : null
    expect(parseLightUtterance(option!.message, ambiguous?.context)?.operations?.[0]).toMatchObject({
      action: 'off',
      room: expect.objectContaining({ id: 'guest-room' }),
      lightNames: ['TV Light'],
    })
    expect(parseLightUtterance('Turn off the Door Light and Window Light.')).toMatchObject({
      status: 'clarify',
      controls: [{
        kind: 'room-picker',
        options: [{
          label: 'Master Bedroom',
          message: 'Turn off the Door Light and Window Light in the Master Bedroom.',
        }],
      }],
    })
    expect(parseLightUtterance('Turn off the Front Right Light.')?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Living Room', message: 'Turn off the Front Right in the Living Room.' }),
        expect.objectContaining({ label: 'Theater Room', message: 'Turn off the Front Right Light in the Theater Room.' }),
      ]),
    })
    expect(parseLightUtterance('Turn the Window Light and Door Light to 20% and 30% respectively')?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [{
        label: 'Master Bedroom',
        message: 'Turn the Window Light and Door Light in the Master Bedroom to 20% and 30% respectively.',
      }],
    })
    expect(parseLightUtterance('Turn off the Office Light.', {
      domain: 'lights',
      roomId: 'hallway',
      entityIds: ['light.hallway_office_light'],
      lightNames: ['Office Light'],
      lastAction: 'list',
    })?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'hallway' }),
      entityIds: ['light.hallway_office_light'],
    })
    expect(parseLightUtterance('Turn off the Office Light.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['hallway', 'office'],
      roomLightNames: {
        hallway: ['Office Light'],
        office: ['Office Light'],
      },
      lastAction: 'list',
    })?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Hallway' }),
        expect.objectContaining({ label: 'Office' }),
      ],
    })
    expect(parseLightUtterance('Turn off the Office Light.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['hallway'],
      roomLightNames: { hallway: ['Office Light'] },
      lastAction: 'list',
    })?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'hallway' }),
      entityIds: ['light.hallway_office_light'],
    })
    expect(parseLightUtterance('Turn off the Guest Room Light.', {
      domain: 'lights',
      roomId: 'hallway',
      entityIds: ['light.hallway_guest_room_light'],
      lightNames: ['Guest Room Light'],
      lastAction: 'list',
    })?.operations?.[0]).toMatchObject({
      room: expect.objectContaining({ id: 'hallway' }),
      lightNames: ['Guest Room Light'],
    })
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
    const excluded = parseLightUtterance('Turn off all the lights except the Kitchen.')
    expect(excluded?.status).toBe('unsupported')
    expect(excluded?.operations).toBeUndefined()
    const contrasted = parseLightUtterance('Turn the Kitchen lights on, not off.')
    expect(contrasted?.status).toBe('unsupported')
    expect(contrasted?.operations).toBeUndefined()
    for (const text of [
      'Would the Kitchen lights turn off if nobody were home?',
      'Could you explain how to turn on the Sink Light?',
      'Can you tell me whether I should turn off the Sink Light?',
      'Please explain how to turn on the Kitchen lights.',
      'Tell me how I can turn on the Kitchen lights.',
      'Can you explain how I would dim the Kitchen lights?',
      'I wonder if I should turn off the Kitchen lights.',
      'Tell me how I can enable the Kitchen lights.',
      'Can you explain how I would disable the Kitchen lights?',
      'Please tell me whether I should turn off the Sink Light.',
      'Please tell me whether to turn off the Sink Light.',
      'Please advise whether to turn off the Kitchen lights.',
      'Maybe turn off the Kitchen lights.',
      'I wonder if I should enable the Kitchen lights.',
      'I wonder if the Music Room lights should be red.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    const negatedColor = parseLightUtterance("Don't color the Music Room lights red.")
    expect(negatedColor?.status).toBe('unsupported')
    expect(negatedColor?.operations).toBeUndefined()
    const excludedRoom = parseLightUtterance('Turn on the Kitchen lights, not the Living Room lights.')
    expect(excludedRoom?.status).toBe('unsupported')
    expect(excludedRoom?.operations).toBeUndefined()
    for (const text of [
      'Turn on the Kitchen lights without the Sink Light.',
      'Turn on all lights but the Kitchen lights.',
      'Turn off all lights apart from the Kitchen lights.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
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
    expect(buildLightPlan({
      operations: [{ action: 'lights-on', room: 'Living Room' }],
    })).toMatchObject({ status: 'failed', text: expect.stringContaining('every configured room') })
    expect(buildLightPlan({ action: 'lights-on' }).operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(buildLightPlan({ action: 'rooms-on' }).operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(buildLightPlan({ action: 'lights-on', room: 'Living Room' }))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('cannot be narrowed') })
    expect(buildLightPlan({
      action: 'lights-on',
      operations: [{ action: 'off', room: 'Kitchen' }],
    })).toMatchObject({ status: 'failed', text: expect.stringContaining('not both') })
    expect(buildLightPlan({
      room: 'Kitchen',
      operations: HOUSE_LIGHT_ROOMS.map((room) => ({ action: 'lights-on', room: room.name })),
    })).toMatchObject({ status: 'failed', text: expect.stringContaining('not both') })
    expect(buildLightPlan({
      operations: [{
        action: 'set',
        room: 'Living Room',
        light_names: ['Front Left', 'Back Right'],
        brightness_pct: [10, 'bad'],
      }],
    })).toMatchObject({ status: 'failed', text: expect.stringContaining('brightness_pct') })
    expect(buildLightPlan({
      action: 'color',
      room: 'Music Room',
      rgb_color: [300, -1, 0],
    })).toMatchObject({ status: 'unsupported', text: expect.stringContaining('rgb_color') })
    expect(buildLightPlan({ action: 'on', room: 'Kitchen', brightness_pct: 25 }))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('not supported for on') })
    expect(buildLightPlan({ action: 'color', room: 'Music Room', color_name: 'red', color_temperature_kelvin: 3000 }))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('one color representation') })
    expect(buildLightPlan({
      action: 'off',
      room: 'Living Room',
      entity_ids: ['light.living_room_front_left_light'],
      light_names: ['Back Right'],
    })).toMatchObject({ status: 'unsupported', text: expect.stringContaining('do not identify the same') })
    expect(buildLightPlan({ action: 'off', room: 'Kitchen', entity_ids: [] }))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('entity_ids') })
    expect(buildLightPlan({ action: 'off', room: 'Kitchen', light_names: [] }))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('light_names') })
    expect(buildLightPlan({ action: 'off', room: 'Kitchen', fixture_names: ['Sink Light'] } as never))
      .toMatchObject({ status: 'failed', text: expect.stringContaining('Unknown light request field') })
    expect(buildLightPlan({ action: 'set', brightness_pct: 30 }).controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([expect.objectContaining({ message: 'Turn the Living Room lights to 30%.' })]),
    })
    expect(buildLightPlan({ action: 'history', target_state: 'on' }).controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([expect.objectContaining({ message: 'When did the Living Room lights turn on?' })]),
    })
    const multiRelative = parseLightUtterance(
      'Turn up the Entry Light, Drums Light, Couch Light, and TV Light by 1%, 2%, 3%, and 4% respectively.',
    )
    const relativeOption = multiRelative?.controls[0]?.kind === 'room-picker'
      ? multiRelative.controls[0].options[0]
      : null
    expect(relativeOption?.message.length).toBeLessThanOrEqual(HOME_CHAT_USER_LIMIT)
    expect(parseLightUtterance(relativeOption!.message)?.operations?.[0]).toMatchObject({
      action: 'up',
      lightNames: ['Entry Light', 'Drums Light', 'Couch Light', 'TV Light'],
      brightnessPct: [1, 2, 3, 4],
    })
    expect(buildLightPlan({
      action: 'history',
      history_before: '2026-09-08T12:00:00Z',
      target_state: 'off',
    }).context).toMatchObject({
      roomId: null,
      lastAction: 'history',
      historyBefore: '2026-09-08T12:00:00Z',
      targetState: 'off',
    })
    const historyPicker = buildLightPlan({
      action: 'history',
      history_before: '2026-09-08T12:00:00Z',
      target_state: 'off',
    })
    expect(parseLightUtterance(
      'When did the Living Room lights turn off?',
      historyPicker.context,
    )?.operations?.[0]).toMatchObject({
      action: 'history',
      room: expect.objectContaining({ id: 'living-room' }),
      historyBefore: '2026-09-08T12:00:00Z',
      targetState: 'off',
    })
    const blueRooms = buildLightPlan({ action: 'color', color_name: 'blue' }).controls[0]
    expect(blueRooms).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([expect.objectContaining({ label: 'Music Room' })]),
    })
    if (blueRooms?.kind === 'room-picker') {
      expect(blueRooms.options).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Living Room' })]))
    }
    const whiteRooms = buildLightPlan({ action: 'color', color_name: 'white' }).controls[0]
    expect(whiteRooms).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([expect.objectContaining({ label: 'Living Room' })]),
    })
    expect(buildLightPlan({ action: 'color', color_name: 'ultraviolet' })).toMatchObject({
      status: 'unsupported',
      controls: [],
    })
    expect(buildLightPlan({
      operations: HOUSE_LIGHT_ROOMS.map((room) => ({ action: 'lights-on', room: room.name })),
    })).toMatchObject({
      status: 'ready',
      operations: expect.arrayContaining([expect.objectContaining({ action: 'lights-on' })]),
    })
    for (const invalid of [
      { brightness_pct: '50' },
      { entity_ids: 'light.kitchen_sink_light' },
      { light_names: 'Sink Light' },
    ]) {
      expect(buildLightPlan({
        operations: HOUSE_LIGHT_ROOMS.map((room, index) => ({
          action: 'lights-on',
          room: room.name,
          ...(index === 0 ? invalid : {}),
        })),
      })).toMatchObject({ status: 'failed', text: expect.stringContaining('without fixture targets or values') })
    }
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
    expect(parseLightUtterance('What about now?', {
      ...room,
      lastAction: 'off',
      lastState: 'off',
    })?.operations?.[0]).toMatchObject({ action: 'state', targetState: 'off' })
    expect(parseLightUtterance('And what are those rules?', { ...room, lastAction: 'pbl' })?.operations?.[0].action).toBe('pbl-rules')
    const selected = {
      ...room,
      entityIds: ['light.living_room_front_left_light', 'light.living_room_back_right_light'],
      lightNames: ['Front Left', 'Back Right'],
      lastAction: 'count' as const,
    }
    expect(parseLightUtterance('Which ones?', selected)?.operations?.[0]).toMatchObject({
      action: 'list',
      entityIds: selected.entityIds,
      lightNames: selected.lightNames,
    })
    const roomsOn = parseLightUtterance('Which rooms have lights on?')
    expect(roomsOn?.operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(roomsOn?.operations?.every((operation) => operation.action === 'rooms-on')).toBe(true)
    expect(parseLightUtterance('Which rooms have their lights switched on?')?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(parseLightUtterance('Show me which rooms have lights on.')?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)
    for (const wording of [
      "Which rooms' lights are on?",
      'Which rooms still have lights on?',
      'Which rooms in the house have lights on?',
    ]) {
      expect(parseLightUtterance(wording)?.operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    }
    const wholeHome = parseLightUtterance('What lights are on?')
    expect(wholeHome?.operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(wholeHome?.operations?.every((operation) => operation.action === 'lights-on')).toBe(true)
    expect(wholeHome?.context).toMatchObject({ roomId: null, lastAction: 'lights-on' })
    expect(parseLightUtterance('What about now?', wholeHome?.context)?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(parseLightUtterance('What about now?', roomsOn?.context)?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)

    const overviewContext = {
      domain: 'lights' as const,
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['living-room', 'kitchen'],
      lastAction: 'lights-on' as const,
    }
    const detail = parseLightUtterance('Living Room and Kitchen', overviewContext)
    expect(detail?.operations).toEqual([
      expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'living-room' }) }),
      expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'kitchen' }) }),
    ])
    expect(detail?.data).toMatchObject({ queryMode: 'lights-on-detail' })
    expect(parseLightUtterance('I would like details for Living Room', overviewContext)?.operations?.[0])
      .toMatchObject({ action: 'list', room: expect.objectContaining({ id: 'living-room' }) })
    for (const selection of [
      'Both Living Room and Kitchen lights',
      'Living Room plus Kitchen lights',
      'Living Room as well as Kitchen lights',
      'Living Room and Kitchen lights now',
      'Yes, the Living Room.',
      'Can you show me the Living Room?',
      'Could you show me the Living Room lights?',
    ]) {
      const expectedRooms = selection.includes('Kitchen') ? ['living-room', 'kitchen'] : ['living-room']
      const result = parseLightUtterance(selection, overviewContext)
      expect(result?.operations?.map((operation) => operation.room.id)).toEqual(expectedRooms)
      expect(result?.data).toMatchObject({ queryMode: 'lights-on-detail' })
    }
    expect(parseLightUtterance('Office', overviewContext)).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })
    expect(parseLightUtterance('Living Room and Kitchen lights', overviewContext)?.operations).toHaveLength(2)
    expect(parseLightUtterance('Office lights', overviewContext)).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })
    expect(parseLightUtterance('Living Room, Kitchen, and Basement lights', overviewContext)).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })
    for (const selection of [
      'Tell me about Living Room and Basement lights',
      'Show me Living Room and Basement lights',
      'I would like details for Living Room and Basement lights',
      'Could you show me the Living Room lights weather?',
      'Could you tell me about the Living Room lights and the thermostat.',
      'Tell me about the Living Room lights and the thermostat.',
    ]) {
      expect(parseLightUtterance(selection, overviewContext)).toMatchObject({
        status: 'unsupported',
        text: 'Choose one or more rooms from the earlier list.',
      })
    }
    expect(parseLightUtterance('Kitchen and Basement lights', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })
    expect(parseLightUtterance('Office and Basement lights', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })
    expect(parseLightUtterance('I left my tax documents in the Kitchen.', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toBeNull()
    for (const statement of [
      'I like the Kitchen lights.',
      'I like those Kitchen lights.',
    ]) {
      expect(parseLightUtterance(statement, {
        ...overviewContext,
        roomIds: ['kitchen'],
      })).toBeNull()
    }
    for (const statement of [
      'That was helpful.',
      'Thanks for that.',
      'Can you explain that?',
      'Tell me the weather in the Living Room.',
      'Can you show me the cameras in the Living Room?',
    ]) {
      expect(parseLightUtterance(statement, {
        ...overviewContext,
        roomIds: ['kitchen'],
      })).toBeNull()
    }
    expect(parseLightUtterance('Turn off the Office lights.', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })?.operations?.[0]).toMatchObject({
      action: 'off',
      room: expect.objectContaining({ id: 'office' }),
      entityIds: [],
    })
    expect(parseLightUtterance('Are the Office lights on?', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })?.operations?.[0]).toMatchObject({
      action: 'state',
      room: expect.objectContaining({ id: 'office' }),
    })
    expect(parseLightUtterance('Yes, please', {
      ...overviewContext,
      roomIds: ['living-room'],
    })?.operations?.[0]).toMatchObject({
      action: 'list',
      room: expect.objectContaining({ id: 'living-room' }),
    })
    for (const acceptance of [
      'Could you show me that room?',
      'Tell me more.',
      'Can you tell me more?',
    ]) {
      expect(parseLightUtterance(acceptance, {
        ...overviewContext,
        roomIds: ['living-room'],
      })?.data).toMatchObject({ queryMode: 'lights-on-detail' })
    }
    for (const selection of [
      'Living Room and Kitchen, thanks',
      'Tell me about Living Room, thanks',
    ]) {
      expect(parseLightUtterance(selection, overviewContext)?.data)
        .toMatchObject({ queryMode: 'lights-on-detail' })
    }
    expect(parseLightUtterance('Living Room and Basement', overviewContext)).toMatchObject({
      status: 'unsupported',
      text: 'Choose one or more rooms from the earlier list.',
    })

    const selectedRooms = {
      ...overviewContext,
      roomLightNames: {
        'living-room': ['Front Left', 'Back Right'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'list' as const,
      lastState: 'on' as const,
    }
    expect(parseLightUtterance('Turn them off.', selectedRooms)?.operations).toEqual([
      expect.objectContaining({ action: 'off', room: expect.objectContaining({ id: 'living-room' }), lightNames: ['Front Left', 'Back Right'] }),
      expect.objectContaining({ action: 'off', room: expect.objectContaining({ id: 'kitchen' }), lightNames: ['Sink Light'] }),
    ])
    const explicitSelectedRooms = parseLightUtterance(
      'Turn the selected Living Room and Kitchen lights off.',
      selectedRooms,
    )
    expect(explicitSelectedRooms?.status).toBe('ready')
    expect(explicitSelectedRooms?.context).toMatchObject({
      roomIds: selectedRooms.roomIds,
      roomLightNames: selectedRooms.roomLightNames,
    })
    expect(parseLightUtterance('Turn them on.', explicitSelectedRooms?.context)?.operations?.map((operation) => operation.room.id))
      .toEqual(['living-room', 'kitchen'])
    const reorderedSelection = parseLightUtterance(
      'Turn off the Back Right and Front Left in the Living Room and turn off the Sink Light in the Kitchen.',
      selectedRooms,
    )
    expect(reorderedSelection?.context).toMatchObject({
      roomIds: selectedRooms.roomIds,
      roomLightNames: selectedRooms.roomLightNames,
    })
    expect(parseLightUtterance('Turn them on.', reorderedSelection?.context)?.operations?.map((operation) => operation.room.id))
      .toEqual(['living-room', 'kitchen'])
    expect(parseLightUtterance('What about now?', explicitSelectedRooms?.context)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room', message: 'Are the Front Left and Back Right in the Living Room on?' }),
        expect.objectContaining({ label: 'Kitchen', message: 'Are the Sink Light in the Kitchen on?' }),
      ],
    })
    const partialSelection = {
      ...selectedRooms,
      roomLightNames: { 'living-room': ['Front Left'] },
    }
    expect(parseLightUtterance('Turn the selected Kitchen lights off.', partialSelection)).toMatchObject({
      status: 'unsupported',
      text: 'I could not match the earlier light target in that action clause.',
    })
    expect(parseLightUtterance('Change the selected Kitchen lights.', partialSelection)).toMatchObject({
      status: 'unsupported',
      text: 'I could not match the earlier light target in that color request.',
    })
    expect(parseLightUtterance('Change the Kitchen lights so they look better.', {
      domain: 'lights',
      roomId: 'kitchen',
      entityIds: ['light.kitchen_sink_light'],
      lightNames: ['Sink Light'],
    })?.controls[0]).toMatchObject({
      kind: 'color-picker',
      entityIds: HOUSE_LIGHT_ROOMS.find((room) => room.id === 'kitchen')!.lights.map((light) => light.entityId),
    })
    expect(parseLightUtterance('Turn the selected Living Room lights off.', partialSelection)?.operations?.[0])
      .toMatchObject({ room: expect.objectContaining({ id: 'living-room' }), lightNames: ['Front Left'] })
    expect(parseLightUtterance('Turn those Kitchen lights off.', selectedRooms)?.operations?.[0])
      .toMatchObject({ room: expect.objectContaining({ id: 'kitchen' }), lightNames: ['Sink Light'] })
    expect(parseLightUtterance(
      'Set those lights in the Living Room and Kitchen to 40%.',
      selectedRooms,
    )?.operations).toEqual([
      expect.objectContaining({ room: expect.objectContaining({ id: 'living-room' }), lightNames: ['Front Left', 'Back Right'] }),
      expect.objectContaining({ room: expect.objectContaining({ id: 'kitchen' }), lightNames: ['Sink Light'] }),
    ])
    expect(parseLightUtterance('Are they still on in the Living Room?', partialSelection)?.operations?.[0])
      .toMatchObject({ action: 'state', lightNames: ['Front Left'] })
    expect(parseLightUtterance('Which ones are on in the Living Room?', partialSelection)?.operations?.[0])
      .toMatchObject({ action: 'list', lightNames: ['Front Left'] })
    expect(parseLightUtterance(
      'Which ones are on in the Living Room and Kitchen?',
      selectedRooms,
    )?.operations).toEqual([
      expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'living-room' }), lightNames: ['Front Left', 'Back Right'] }),
      expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'kitchen' }), lightNames: ['Sink Light'] }),
    ])
    expect(parseLightUtterance('Is that light on in the Living Room?', partialSelection)?.operations?.[0])
      .toMatchObject({ action: 'state', lightNames: ['Front Left'] })
    expect(parseLightUtterance('Which of these lights are on?', partialSelection)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [expect.objectContaining({ label: 'Living Room' })],
    })
    for (const query of [
      'How many selected Kitchen lights are on?',
      'What is the brightness of the selected Kitchen lights?',
      'What color are the selected Kitchen lights?',
      'When did the selected Kitchen lights turn on?',
      'Why did those Kitchen lights turn on?',
    ]) {
      expect(parseLightUtterance(query, partialSelection)).toMatchObject({
        status: 'unsupported',
        text: 'I could not match the earlier light target in that query.',
      })
    }
    for (const query of [
      'Is the Front Left light in the Kitchen on?',
      'How many Front Left lights in the Kitchen are on?',
      'What color is the Front Left light in the Kitchen?',
      'When did the Front Left light in the Kitchen turn on?',
      'Why did the Front Left light in the Kitchen turn on?',
    ]) {
      expect(parseLightUtterance(query)).toMatchObject({
        status: 'unsupported',
        text: 'That light is not configured in the Kitchen.',
      })
    }
    expect(parseLightUtterance('Turn it off in the Living Room.', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
    })?.operations?.[0]).toMatchObject({ action: 'off', lightNames: ['Front Left'] })
    expect(parseLightUtterance('Turn them off in the Living Room.', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: [],
      lightNames: [],
    })?.operations?.[0]).toMatchObject({ action: 'off', entityIds: [], lightNames: [] })
    expect(parseLightUtterance('Turn them off in the Living Room.', partialSelection)?.operations?.[0])
      .toMatchObject({ action: 'off', lightNames: ['Front Left'] })
    expect(parseLightUtterance('Change their color.', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room', message: 'Change the color of the Front Left and Back Right in the Living Room.' }),
        expect.objectContaining({ label: 'Kitchen', message: 'Change the color of the Sink Light in the Kitchen.' }),
      ],
    })
    expect(parseLightUtterance(
      'Change the selected Living Room and Kitchen lights.',
      selectedRooms,
    )?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room', message: 'Change the color of the Front Left and Back Right in the Living Room.' }),
        expect.objectContaining({ label: 'Kitchen', message: 'Change the color of the Sink Light in the Kitchen.' }),
      ],
    })
    expect(parseLightUtterance(
      'Change all the Living Room lights and the selected Kitchen lights.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Set those Kitchen lights and the Living Room lights to 40%.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Change the color of the Living Room lights and those Kitchen lights.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Set the selected Living Room lights and all the Kitchen lights to 40%.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Make them in the Kitchen and all the Living Room lights warm white.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Change the color of them and the Door Light in the Kitchen.',
      selectedRooms,
    )).toMatchObject({
      status: 'unsupported',
      text: 'Please name every light in that color request instead of mixing a pronoun with another fixture.',
    })
    expect(parseLightUtterance('When did these lights last turn on?', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Living Room', message: 'When did the Front Left and Back Right in the Living Room turn on?' }),
      ]),
    })
    expect(parseLightUtterance('Why are they on?', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Kitchen', message: 'Why did the Sink Light in the Kitchen turn on?' }),
      ]),
    })
    expect(parseLightUtterance('Tell me why they are on.', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ message: 'Why did the Sink Light in the Kitchen turn on?' }),
      ]),
    })
    expect(parseLightUtterance('Why did they turn on?', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room', message: 'Why did the Front Left and Back Right in the Living Room turn on?' }),
        expect.objectContaining({ label: 'Kitchen', message: 'Why did the Sink Light in the Kitchen turn on?' }),
      ],
    })
    expect(parseLightUtterance('Why are they off?', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.arrayContaining([
        expect.objectContaining({ message: 'Why did the Sink Light in the Kitchen turn off?' }),
      ]),
    })
    expect(parseLightUtterance('Why are the Office lights on?', selectedRooms)?.operations?.[0])
      .toMatchObject({ action: 'reason', room: expect.objectContaining({ id: 'office' }), targetState: 'on' })
    expect(parseLightUtterance('Why is it on?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
      lastAction: 'state',
      lastState: 'on',
    })?.operations?.[0]).toMatchObject({ action: 'reason', targetState: 'on', lightNames: ['Front Left'] })
    expect(parseLightUtterance("Why aren't the Living Room lights on?")?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'off' })
    expect(parseLightUtterance("Why didn't the Living Room lights turn on?")?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'off' })
    expect(parseLightUtterance('Why are the Living Room lights not on?')?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'off' })
    expect(parseLightUtterance("Why did the Living Room lights turn on while the TV wasn't playing?")?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'on' })
    expect(parseLightUtterance("Why won't the Living Room lights turn on?")?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'off' })
    expect(parseLightUtterance('Why did I not expect the Kitchen lights to turn on?')?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'on' })
    expect(parseLightUtterance("Why didn't I expect the Kitchen lights to turn on?")?.operations?.[0])
      .toMatchObject({ action: 'reason', targetState: 'on' })
    for (const query of [
      'Why are the Kitchen lights on instead of off?',
      'Why did Home Assistant not turn the Kitchen lights on?',
      "Why didn't Home Assistant turn the Kitchen lights on?",
      'Why are the Kitchen lights on, not off?',
    ]) {
      expect(parseLightUtterance(query)).toMatchObject({
        status: 'unsupported',
        text: 'That reason question compares or negates multiple actions. Ask why the lights turned on or off.',
      })
    }
    expect(parseLightUtterance('Make them warm white.', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room', message: 'Turn the Front Left and Back Right in the Living Room to warm white.' }),
        expect.objectContaining({ label: 'Kitchen', message: 'Turn the Sink Light in the Kitchen to warm white.' }),
      ],
    })
    expect(parseLightUtterance('Turn off the Kitchen lights.', selectedRooms)?.operations?.[0]).toMatchObject({
      action: 'off',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: [],
      entityIds: [],
    })
    expect(parseLightUtterance('Turn off the Kitchen lights because they are too bright.', selectedRooms)?.operations?.[0]).toMatchObject({
      action: 'off',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: [],
      entityIds: [],
    })
    expect(parseLightUtterance('Set the Living Room lights to 30% so I can see them.', partialSelection)?.operations?.[0])
      .toMatchObject({ action: 'set', room: expect.objectContaining({ id: 'living-room' }), lightNames: [], entityIds: [] })
    expect(parseLightUtterance('Make the Kitchen lights warm white.', selectedRooms)?.operations?.[0]).toMatchObject({
      action: 'color',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: [],
      entityIds: [],
    })
    const rejectedBlue = parseLightUtterance('Make them blue.', selectedRooms)
    expect(rejectedBlue).toMatchObject({
      status: 'unsupported',
      text: 'That color is not supported by the selected lights.',
      context: expect.objectContaining({
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: selectedRooms.roomLightNames,
      }),
    })
    expect(parseLightUtterance('Make them warm white.', rejectedBlue?.context)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room' }),
        expect.objectContaining({ label: 'Kitchen' }),
      ],
    })
    expect(parseLightUtterance('Why?', selectedRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [
        expect.objectContaining({ label: 'Living Room' }),
        expect.objectContaining({ label: 'Kitchen' }),
      ],
    })
    expect(parseLightUtterance('Why?', {
      domain: 'lights',
      roomId: 'kitchen',
      entityIds: [],
      lightNames: [],
      lastAction: 'list',
      lastState: 'off',
    })?.operations?.[0]).toMatchObject({
      action: 'reason',
      room: expect.objectContaining({ id: 'kitchen' }),
      targetState: 'off',
    })
    expect(parseLightUtterance('Why?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
      lastAction: 'list',
      lastState: 'unavailable',
    })).toMatchObject({
      status: 'unsupported',
      text: 'I need a confirmed on or off state before I can explain why.',
    })
    expect(parseLightUtterance('Why?', {
      ...selectedRooms,
      lastAction: 'state',
      lastState: 'mixed',
      targetState: 'on',
    })).toMatchObject({
      status: 'unsupported',
      text: 'I need a confirmed on or off state before I can explain why.',
    })
    expect(parseLightUtterance('Why?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: [],
      lightNames: [],
      lastAction: 'state',
      lastState: 'mixed',
    })).toMatchObject({
      status: 'unsupported',
      text: 'I need a confirmed on or off state before I can explain why.',
    })
    expect(parseLightUtterance('Why?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
      lastAction: 'history',
      targetState: 'on',
    })?.operations?.[0]).toMatchObject({
      action: 'reason',
      lightNames: ['Front Left'],
      targetState: 'on',
    })
    expect(parseLightUtterance('Turn them off.', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'Choose a room to see which lights are on before changing them.',
    })
    expect(parseLightUtterance('Dim them.', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'Choose a room to see which lights are on before changing them.',
    })
    expect(parseLightUtterance('Change their color.', {
      ...selectedRooms,
      roomIds: ['dining-room'],
      roomLightNames: { 'dining-room': ['Dining Room Light'] },
    })).toMatchObject({
      status: 'unsupported',
      text: 'Color control is not supported by the selected lights.',
    })
    expect(parseLightUtterance('Set the lights that are on in the Kitchen to 20%.', {
      ...overviewContext,
      roomIds: ['kitchen'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'State-qualified light changes require a fresh explicit target. Ask which lights are on, then use that exact result.',
    })
    for (const request of [
      'Set the Kitchen lights that are still on to 20%.',
      'Set the Kitchen lights currently on to 20%.',
      'Set whichever Kitchen lights are on to 20%.',
      'Set the Kitchen lights left on to 20%.',
      'Set the remaining Kitchen lights to 20%.',
      'Set the still-on Kitchen lights to 20%.',
      'Set the Kitchen lights that are off to 20%.',
      'Dim any lights on in the Kitchen.',
      'Dim any Kitchen lights which remain on.',
      'Set any Kitchen lights on to 20%.',
    ]) {
      expect(parseLightUtterance(request, {
        ...overviewContext,
        roomIds: ['kitchen'],
      })).toMatchObject({
        status: 'unsupported',
        text: 'State-qualified light changes require a fresh explicit target. Ask which lights are on, then use that exact result.',
      })
      expect(parseLightUtterance(request, {
        ...selectedRooms,
        roomIds: ['kitchen'],
        roomLightNames: { kitchen: ['Sink Light'] },
      })).toMatchObject({
        status: 'unsupported',
        text: 'State-qualified light changes require a fresh explicit target. Ask which lights are on, then use that exact result.',
      })
    }
    expect(parseLightUtterance('Set that Kitchen light to 20%.', {
      ...selectedRooms,
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
    })?.operations?.[0]).toMatchObject({
      action: 'set',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: ['Sink Light'],
    })
    expect(parseLightUtterance('Turn that off.', {
      ...selectedRooms,
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
    })?.operations?.[0]).toMatchObject({
      action: 'off',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: ['Sink Light'],
    })
    expect(parseLightUtterance('Why is that on?', {
      ...selectedRooms,
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
      lastAction: 'state',
      lastState: 'on',
    })?.operations?.[0]).toMatchObject({
      action: 'reason',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: ['Sink Light'],
      targetState: 'on',
    })
    expect(parseLightUtterance('Turn that and the Kitchen lights off.', {
      ...selectedRooms,
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
    })).toMatchObject({
      status: 'unsupported',
      text: 'Mixing contextual and explicit room targets is not supported.',
    })
    expect(parseLightUtterance('What about now?', selectedRooms)).toMatchObject({
      status: 'clarify',
      context: expect.objectContaining({
        roomIds: selectedRooms.roomIds,
      }),
      controls: [expect.objectContaining({
        kind: 'room-picker',
        options: [
          expect.objectContaining({ label: 'Living Room', message: 'Which selected Living Room lights are on?' }),
          expect.objectContaining({ label: 'Kitchen', message: 'Which selected Kitchen lights are on?' }),
        ],
      })],
    })
    const scopedWhich = parseLightUtterance('Which ones?', {
      ...overviewContext,
      lastAction: 'state',
    })
    expect(scopedWhich).toMatchObject({
      status: 'clarify',
      context: expect.objectContaining({ roomIds: ['living-room', 'kitchen'] }),
      controls: [expect.objectContaining({
        kind: 'room-picker',
        options: [
          expect.objectContaining({ label: 'Living Room' }),
          expect.objectContaining({ label: 'Kitchen' }),
        ],
      })],
    })
    expect(scopedWhich?.context).not.toHaveProperty('roomLightNames')
    const oneRoomExact = {
      domain: 'lights' as const,
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
      lastAction: 'state' as const,
      lastState: 'on' as const,
    }
    expect(parseLightUtterance('What about now?', oneRoomExact)?.operations?.[0]).toMatchObject({
      action: 'state',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: ['Sink Light'],
    })
    expect(parseLightUtterance('Why did they turn on?', oneRoomExact)?.operations?.[0]).toMatchObject({
      action: 'reason',
      room: expect.objectContaining({ id: 'kitchen' }),
      lightNames: ['Sink Light'],
      targetState: 'on',
    })

    const musicRoom = HOUSE_LIGHT_ROOMS.find((room) => room.id === 'music-room')!
    const longSelection = {
      domain: 'lights' as const,
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['music-room'],
      roomLightNames: { 'music-room': musicRoom.lights.map((light) => light.name) },
      lastAction: 'list' as const,
    }
    const longColor = parseLightUtterance('Change their color.', longSelection)
    const longOption = longColor?.controls[0]?.kind === 'room-picker' ? longColor.controls[0].options[0] : null
    expect(longOption?.message.length).toBeLessThanOrEqual(HOME_CHAT_USER_LIMIT)
    expect(parseLightUtterance(longOption!.message, longColor?.context)?.controls[0]).toMatchObject({
      kind: 'color-picker',
      entityIds: musicRoom.lights.map((light) => light.entityId),
      subject: 'selected Music Room lights',
    })
    const subset = musicRoom.lights.slice(0, 5)
    const subsetColor = colorPickerResponse(musicRoom, {
      entityIds: subset.map((light) => light.entityId),
      lightNames: subset.map((light) => light.name),
    })
    const subsetControl = subsetColor.controls[0]
    expect(subsetControl).toMatchObject({ kind: 'color-picker', subject: 'selected Music Room lights' })
    if (subsetControl?.kind === 'color-picker') {
      expect(parseLightUtterance(
        `Turn the ${subsetControl.subject} to warm white.`,
        subsetColor.context,
      )?.operations?.[0]).toMatchObject({
        action: 'color',
        entityIds: subset.map((light) => light.entityId),
        lightNames: subset.map((light) => light.name),
      })
    }
    const values = musicRoom.lights.map((_, index) => index + 1)
    for (const action of ['up', 'set'] as const) {
      const picker = roomPickerResponse(action, {
        roomIds: ['music-room'],
        roomLightNames: { 'music-room': musicRoom.lights.map((light) => light.name) },
        brightnessPct: values,
      })
      const option = picker.controls[0]?.kind === 'room-picker' ? picker.controls[0].options[0] : null
      expect(option?.message.length).toBeLessThanOrEqual(HOME_CHAT_USER_LIMIT)
      expect(parseLightUtterance(option!.message, picker.context)?.operations?.[0]).toMatchObject({
        action,
        entityIds: musicRoom.lights.map((light) => light.entityId),
        lightNames: musicRoom.lights.map((light) => light.name),
        brightnessPct: values,
      })
    }
    const unevenSelection = {
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left', 'Back Right'],
        kitchen: ['Sink Light'],
      },
      brightnessPct: [20, 30],
    }
    for (const action of ['up', 'set'] as const) {
      const picker = roomPickerResponse(action, unevenSelection)
      expect(picker.controls[0]).toMatchObject({
        kind: 'room-picker',
        options: [expect.objectContaining({ label: 'Living Room' })],
      })
    }
    const brightnessRooms = {
      domain: 'lights' as const,
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['entryway', 'kitchen'],
      roomLightNames: {
        entryway: ['Entryway Light'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'list' as const,
      lastState: 'on' as const,
    }
    expect(parseLightUtterance('Dim them.', brightnessRooms)?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: [expect.objectContaining({ label: 'Kitchen' })],
    })
    expect(parseLightUtterance('Dim them.', {
      ...brightnessRooms,
      roomIds: ['entryway'],
      roomLightNames: { entryway: ['Entryway Light'] },
    })).toMatchObject({
      status: 'unsupported',
      text: 'Brightness control is not supported by the selected lights.',
    })
    for (const action of ['count', 'list'] as const) {
      const picker = roomPickerResponse(action, {
        roomIds: ['living-room'],
        roomLightNames: { 'living-room': ['Front Left', 'Back Right'] },
      })
      const option = picker.controls[0]?.kind === 'room-picker' ? picker.controls[0].options[0] : null
      expect(parseLightUtterance(option!.message, picker.context)?.operations?.[0]).toMatchObject({
        action,
        lightNames: ['Front Left', 'Back Right'],
      })
    }
    expect(parseLightUtterance('And now?', wholeHome?.context)?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)
    expect(parseLightUtterance('How about now?', roomsOn?.context)?.operations)
      .toHaveLength(HOUSE_LIGHT_ROOMS.length)
    for (const wording of [
      'Are any lights on?',
      'Do we have any lights on?',
      'Which lights have been left on?',
      'Which lights are switched on?',
      'Show me which lights are on.',
    ]) {
      expect(parseLightUtterance(wording)?.operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
    }
    for (const scoped of [
      'What lights are on in the nursery?',
      'In the nursery, what lights are on?',
      'Do we have any nursery lights on?',
      'Which rooms in the basement have lights on?',
      'Which rooms in the basement hallway have lights on?',
      'Which lights are on in the basement hallway?',
      'Are any lights in the basement hallway on?',
    ]) {
      const result = parseLightUtterance(scoped)
      expect(result?.status).toBe('clarify')
      expect(result?.operations).toBeUndefined()
    }
    expect(parseLightUtterance('Do we have any Living Room lights on?')?.operations?.[0])
      .toMatchObject({ action: 'state', room: { id: 'living-room' } })
    expect(parseLightUtterance('Which lights are on in the Living Room?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'living-room' } })
    expect(parseLightUtterance('Which lights in the Hallway are on?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'hallway' } })
    expect(parseLightUtterance('Are any lights in the Hallway on?')?.operations?.[0])
      .toMatchObject({ action: 'state', room: { id: 'hallway' } })
    expect(parseLightUtterance('Are any of the Kitchen lights on?')?.operations?.[0])
      .toMatchObject({ action: 'state', room: { id: 'kitchen' } })
    expect(parseLightUtterance('What lights are on at the front door?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'front-yard' } })
    expect(parseLightUtterance('What Theater Room lights are on?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'theater-room' } })
    expect(parseLightUtterance('Are any lights on in the Hallway or Guest Bathroom?')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'state', room: expect.objectContaining({ id: 'hallway' }) }),
        expect.objectContaining({ action: 'state', room: expect.objectContaining({ id: 'guest-bathroom' }) }),
      ])
    expect(parseLightUtterance('In the Hallway and Guest Bathroom, which lights are on?')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'hallway' }) }),
        expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'guest-bathroom' }) }),
      ])
    expect(parseLightUtterance('Which lights are on in the Hallway or Downstairs Hallway?')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'hallway' }) }),
        expect.objectContaining({ action: 'list', room: expect.objectContaining({ id: 'downstairs-hallway' }) }),
      ])
    expect(parseLightUtterance('Can you show me which lights in the Hallway are on?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'hallway' } })
    expect(parseLightUtterance('Show me which lights are on in the Hallway.')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'hallway' } })
    expect(parseLightUtterance('In the Living Room, can you tell me what lights are on?')?.operations?.[0])
      .toMatchObject({ action: 'list', room: { id: 'living-room' } })
    expect(parseLightUtterance('Are any lights on the Back Deck on?')?.operations?.[0])
      .toMatchObject({ action: 'state', room: { id: 'back-deck' } })
    expect(parseLightUtterance('What color are the lights on the Back Deck?')?.operations?.[0])
      .toMatchObject({ action: 'color-state', room: { id: 'back-deck' } })
    expect(parseLightUtterance('Show me how bright the lights on the Back Deck are.')?.operations?.[0])
      .toMatchObject({ action: 'brightness-state', room: { id: 'back-deck' } })
    expect(parseLightUtterance('Show me when the lights on the Back Deck turned on.')?.operations?.[0])
      .toMatchObject({ action: 'history', room: { id: 'back-deck' }, targetState: 'on' })
    for (const query of [
      'How many lights are on in the Kitchen and Living Room?',
      'What is the brightness of the Kitchen and Living Room lights?',
      'What color are the Kitchen and Living Room lights?',
      'When did the Kitchen and Living Room lights turn off?',
      'Why did the Kitchen and Living Room lights turn on?',
      'Is Presence-Based Lighting active in the Kitchen and Living Room?',
    ]) {
      expect(parseLightUtterance(query)).toMatchObject({
        status: 'unsupported',
        text: 'Detailed light queries support one room. Ask about one room at a time.',
      })
    }
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
    expect(parseLightUtterance('Before that?', {
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light', 'light.living_room_back_right_light'],
      lightNames: ['Front Left', 'Back Right'],
      lastAction: 'history',
      targetState: 'on',
    })).toMatchObject({
      status: 'unsupported',
      text: 'Earlier history follow-ups support one light at a time.',
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

  it('keeps fixture targets inside their explicit room clauses', () => {
    expect(parseLightUtterance('Turn off the TV Light in the Guest Room and the Fireplace Light in the Music Room.')?.operations)
      .toEqual([
        expect.objectContaining({
          room: expect.objectContaining({ id: 'guest-room' }),
          lightNames: ['TV Light'],
        }),
        expect.objectContaining({
          room: expect.objectContaining({ id: 'music-room' }),
          lightNames: ['Fireplace Light'],
        }),
      ])
    expect(parseLightUtterance('Turn off the Front Left in the Living Room and the Back Right in the Living Room.')?.operations)
      .toEqual([
        expect.objectContaining({
          room: expect.objectContaining({ id: 'living-room' }),
          lightNames: ['Front Left', 'Back Right'],
        }),
      ])
    expect(parseLightUtterance('Turn off the Door Light in the Kitchen and the Sink Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({
          room: expect.objectContaining({ id: 'kitchen' }),
          lightNames: ['Door Light', 'Sink Light'],
        }),
      ])
    expect(parseLightUtterance('Turn off the Front Left in the Living Room and the Table Light and Door Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({ lightNames: ['Front Left'] }),
        expect.objectContaining({ lightNames: ['Table Light', 'Door Light'] }),
      ])
    expect(parseLightUtterance('Turn off the Front Left in the Living Room, the Table Light and Door Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({ lightNames: ['Front Left'] }),
        expect.objectContaining({ lightNames: ['Table Light', 'Door Light'] }),
      ])
    expect(parseLightUtterance('Turn off the Sink Light in the Kitchen, the Master Bedroom Door Light, and the Table Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({ room: expect.objectContaining({ id: 'kitchen' }), lightNames: ['Sink Light', 'Table Light'] }),
        expect.objectContaining({ room: expect.objectContaining({ id: 'master-bedroom' }), lightNames: ['Door Light'] }),
      ])
    expect(parseLightUtterance('Turn off the Grill Light on the Back Deck and the Couch Light in the Music Room.')?.operations)
      .toEqual([
        expect.objectContaining({ room: expect.objectContaining({ id: 'back-deck' }), lightNames: ['Grill Light'] }),
        expect.objectContaining({ room: expect.objectContaining({ id: 'music-room' }), lightNames: ['Couch Light'] }),
      ])
    expect(parseLightUtterance('Turn off the Couch Light on the Back Deck and the TV Light on the Music Room.')?.operations)
      .toEqual([
        expect.objectContaining({ room: expect.objectContaining({ id: 'back-deck' }), lightNames: ['Couch Light'] }),
        expect.objectContaining({ room: expect.objectContaining({ id: 'music-room' }), lightNames: ['TV Light'] }),
      ])
    expect(parseLightUtterance('Turn off the Gym Light and Entry Light in the Hallway.')?.operations?.[0])
      .toMatchObject({ room: expect.objectContaining({ id: 'hallway' }), lightNames: ['Gym Light', 'Entry Light'] })
    expect(parseLightUtterance('Turn off the Exterior Left Light and Bollard 1 in the Front Yard.')?.operations?.[0])
      .toMatchObject({ room: expect.objectContaining({ id: 'front-yard' }), lightNames: ['Exterior Left Light', 'Bollard 1'] })
    expect(parseLightUtterance('Turn the Sink Light and Table Light off.')?.operations)
      .toBeUndefined()
    expect(parseLightUtterance('Turn the Sink Light and Table Light off.')).toMatchObject({
      status: 'clarify',
      controls: [expect.objectContaining({
        kind: 'room-picker',
        options: [expect.objectContaining({
          label: 'Kitchen',
          message: 'Turn off the Sink Light and Table Light in the Kitchen.',
        })],
      })],
    })
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
    for (const text of [
      'Please, how do I turn off the Sink Light?',
      'Please, what if you set the Sink Light to 30%?',
      'Hey, do I need to turn on the Sink Light?',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    expect(parseLightUtterance('Could you not turn on the Living Room lights?')).toMatchObject({ status: 'unsupported' })
    expect(parseLightUtterance('Should I turn on the Kitchen lights?')).toMatchObject({ status: 'unsupported' })
    expect(parseLightUtterance("Shouldn't I turn on the Kitchen lights?")).toMatchObject({ status: 'unsupported' })
    expect(parseLightUtterance('Would it be okay if I turn on the Kitchen lights?')).toMatchObject({ status: 'unsupported' })
    const incomplete = parseLightUtterance('Turn off the Kitchen lights and set the Living Room lights.')
    expect(incomplete?.status).toBe('unsupported')
    expect(incomplete?.operations).toBeUndefined()
    for (const text of [
      'Turn on the Sink Light if it gets dark.',
      'Turn off the Sink Light and Pantry Light.',
      'Turn off the Sink Light and Pantry Light in the Kitchen.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    const unknownLeadingRoom = parseLightUtterance('Turn on the basement Sink Light.')
    expect(unknownLeadingRoom?.status).toBe('clarify')
    expect(unknownLeadingRoom?.operations).toBeUndefined()
    expect(parseLightUtterance('Turn on the Sink Light in the Kitchen and then turn off the Table Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'on', lightNames: ['Sink Light'] }),
        expect.objectContaining({ action: 'off', lightNames: ['Table Light'] }),
      ])
    expect(parseLightUtterance('Turn the Sink Light in the Kitchen on and the Door Light in the Master Bedroom off.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'on', lightNames: ['Sink Light'] }),
        expect.objectContaining({ action: 'off', lightNames: ['Door Light'] }),
      ])
    expect(parseLightUtterance('Turn the Kitchen lights on: turn the Living Room lights off.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'on', room: expect.objectContaining({ id: 'kitchen' }) }),
        expect.objectContaining({ action: 'off', room: expect.objectContaining({ id: 'living-room' }) }),
      ])
    expect(parseLightUtterance('Turn on the Kitchen lights, then turn off the Living Room lights because the Office lights turned off.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'on', room: expect.objectContaining({ id: 'kitchen' }) }),
        expect.objectContaining({ action: 'off', room: expect.objectContaining({ id: 'living-room' }) }),
      ])
    const elliptical = parseLightUtterance('Turn the Kitchen lights on, then the Living Room lights off.')
    expect(elliptical?.status).toBe('unsupported')
    expect(elliptical?.operations).toBeUndefined()
    expect(parseLightUtterance('Turn the Sink Light in the Kitchen to 20%, then turn it up by 10%.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'set', lightNames: ['Sink Light'], brightnessPct: 20 }),
        expect.objectContaining({ action: 'up', lightNames: ['Sink Light'], brightnessPct: 10 }),
      ])
    expect(parseLightUtterance('Turn on the Sink Light in the Kitchen, then turn that one off.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'on', lightNames: ['Sink Light'] }),
        expect.objectContaining({ action: 'off', lightNames: ['Sink Light'] }),
      ])
    expect(parseLightUtterance(
      'Turn off the Door Light in the Kitchen, then turn it on in the Master Bedroom.',
      {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['kitchen', 'master-bedroom'],
        roomLightNames: {
          kitchen: ['Sink Light'],
          'master-bedroom': ['Window Light'],
        },
        lastAction: 'list',
      },
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance(
      'Turn off the Sink Light in the Kitchen, then turn it and the Door Light on.',
    )).toMatchObject({
      status: 'unsupported',
      text: 'Please name every light in that action instead of mixing a pronoun with another fixture.',
    })
    expect(parseLightUtterance('Turn them and the Office lights off.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'list',
    })).toMatchObject({
      status: 'unsupported',
      text: 'Mixing contextual and explicit room targets is not supported.',
    })
    for (const command of [
      'Turn them off, the Office lights too.',
      'Turn them off, including the Office lights.',
      'Turn them off along with the lights in the Office.',
      'Turn them off along with the lights on the Back Deck.',
    ]) {
      expect(parseLightUtterance(command, {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: {
          'living-room': ['Front Left'],
          kitchen: ['Sink Light'],
        },
        lastAction: 'list',
      })).toMatchObject({
        status: 'unsupported',
        text: 'Mixing contextual and explicit room targets is not supported.',
      })
    }
    expect(parseLightUtterance('Are both it and the Door Light in the Kitchen on?', {
      domain: 'lights',
      roomId: 'kitchen',
      entityIds: ['light.kitchen_sink_light'],
      lightNames: ['Sink Light'],
      lastAction: 'list',
    })).toMatchObject({
      status: 'unsupported',
      text: 'Please name every light in that request instead of mixing a pronoun with another fixture.',
    })
    for (const conjunction of ['along with', 'as well as', 'plus', 'together with', 'alongside']) {
      expect(parseLightUtterance(`Turn them off ${conjunction} the Office lights.`, {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: {
          'living-room': ['Front Left'],
          kitchen: ['Sink Light'],
        },
        lastAction: 'list',
      })).toMatchObject({
        status: 'unsupported',
        text: 'Mixing contextual and explicit room targets is not supported.',
      })
    }
    expect(parseLightUtterance(
      'Turn on the Kitchen and Office lights, then dim them.',
      {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: {
          'living-room': ['Front Left'],
          kitchen: ['Sink Light'],
        },
        lastAction: 'list',
      },
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    for (const [command, message] of [
      ['Turn them off and then turn them on.', 'Please split that multi-room follow-up into separate light requests.'],
      ['Turn them off and then turn on the Office lights.', 'Please split that multi-room follow-up into separate light requests.'],
    ]) {
      expect(parseLightUtterance(command, {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: {
          'living-room': ['Front Left'],
          kitchen: ['Sink Light'],
        },
        lastAction: 'list',
      })).toMatchObject({
        status: 'unsupported',
        text: message,
      })
    }
    expect(parseLightUtterance(
      'Turn on the Kitchen and Office lights, then turn them off in the Living Room.',
      {
        domain: 'lights',
        roomId: null,
        entityIds: [],
        lightNames: [],
        roomIds: ['living-room', 'kitchen'],
        roomLightNames: {
          'living-room': ['Front Left'],
          kitchen: ['Sink Light'],
        },
        lastAction: 'list',
      },
    )).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(parseLightUtterance('Turn it and the Door Light off.', {
      domain: 'lights',
      roomId: 'kitchen',
      entityIds: ['light.kitchen_sink_light'],
      lightNames: ['Sink Light'],
    })).toMatchObject({
      status: 'unsupported',
      text: 'Please name every light in that request instead of mixing a pronoun with another fixture.',
    })
    expect(parseLightUtterance('Turn off the selected Kitchen lights and the Door Light.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['kitchen'],
      roomLightNames: { kitchen: ['Sink Light'] },
      lastAction: 'list',
    })).toMatchObject({
      status: 'unsupported',
      text: 'Please name every light in that request instead of mixing a pronoun with another fixture.',
    })
    const unresolvedCompound = parseLightUtterance('Turn off the Kitchen lights and then turn on the TV in the Living Room.')
    expect(unresolvedCompound?.status).toBe('unsupported')
    expect(unresolvedCompound?.operations).toBeUndefined()
    const unknownFixture = parseLightUtterance('Turn off the Kitchen lights, then turn on the Chandelier Light in the Living Room.')
    expect(unknownFixture?.status).toBe('unsupported')
    expect(unknownFixture?.operations).toBeUndefined()
    const backwardScope = parseLightUtterance('Turn on the Door Light, then turn off the Sink Light in the Kitchen.')
    expect(backwardScope?.status).toBe('clarify')
    expect(backwardScope?.operations).toBeUndefined()
    const causalRoom = parseLightUtterance('Turn on the lights because the Guest Room Light is dark.')
    expect(causalRoom?.status).toBe('clarify')
    expect(causalRoom?.operations).toBeUndefined()
    const staleContextCompound = parseLightUtterance(
      'Turn on the Kitchen and Office lights, then turn them off.',
      {
        domain: 'lights',
        roomId: 'living-room',
        entityIds: ['light.living_room_front_left_light'],
        lightNames: ['Front Left'],
      },
    )
    expect(staleContextCompound).toMatchObject({
      status: 'unsupported',
      text: 'Mixing whole-room and selected targets across rooms is not supported.',
    })
    expect(staleContextCompound?.operations).toBeUndefined()
    const incompleteImperative = parseLightUtterance('Turn on the Kitchen lights, then turn the Office lights before they switch off.')
    expect(incompleteImperative?.status).toBe('unsupported')
    expect(incompleteImperative?.operations).toBeUndefined()
    for (const text of [
      'Turn on the Kitchen lights and then off the Office lights.',
      'Turn off the Kitchen lights and then on the Office lights.',
      'Turn on the Kitchen lights and check whether the Office lights are off.',
      'Turn on the Kitchen lights and then quickly off the Office lights.',
      "Turn the Kitchen lights on and the Office lights aren't off.",
      'Set the Kitchen lights to 20%, are the Office lights on?',
      'Turn off the Kitchen lights and the Office lights will be on.',
      'Turn on the Kitchen lights, the Office lights are off.',
      'Turn the Kitchen lights on, the Office lighting will be off.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    for (const text of [
      'Turn off the Sink Light in the Kitchen. Turn off the garage door.',
      'Turn off the Door Light in the Kitchen. Leave the Sink Light in the Kitchen alone.',
      'Turn off the Kitchen lights, then set a reminder to turn on the Living Room lights.',
      'Turn on the Kitchen lights, then turn off the fan beside the Office lights.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    expect(parseLightUtterance('Set the Sink Light in the Kitchen to 20% and turn on the Kitchen lights because it is dark.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'set', lightNames: ['Sink Light'] }),
        expect.objectContaining({ action: 'on', lightNames: [], entityIds: [] }),
      ])
    for (const text of [
      'Turn on the Kitchen lights. Should I turn off the Office lights?',
      'Turn the Kitchen lights on before the Office lights turn off.',
      'Turn on the Kitchen lights before turning off the Office lights.',
      'Turn on the Kitchen lights before switching off the Office lights.',
      'Turn on the Kitchen lights while the Office lights are going off.',
      'Turn on the Kitchen lights because the Office lights went off.',
    ]) {
      const result = parseLightUtterance(text)
      expect(result?.status).toBe('unsupported')
      expect(result?.operations).toBeUndefined()
    }
    for (const separator of [', ', '. ', ' - ']) {
      const unresolved = parseLightUtterance(`Turn off the Front Left in the Kitchen${separator}turn on the Sink Light in the Kitchen.`)
      expect(unresolved?.status).toBe('unsupported')
      expect(unresolved?.operations).toBeUndefined()
    }
    expect(parseLightUtterance('Turn off the Door Light in the Kitchen, turn on the Sink Light in the Kitchen.')?.operations)
      .toEqual([
        expect.objectContaining({ action: 'off', lightNames: ['Door Light'] }),
        expect.objectContaining({ action: 'on', lightNames: ['Sink Light'] }),
      ])
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
    expect(parseLightUtterance('Change the color of the Front Left light in the Living Room and the Sink Light in the Kitchen.')).toMatchObject({
      status: 'unsupported',
      text: 'Unable to change selected lights across multiple rooms at once. Choose one room and try again.',
      controls: [],
    })
    expect(parseLightUtterance('Change the color of the Front Left light in the Living Room and the Kitchen lights.')).toMatchObject({
      status: 'unsupported',
      text: 'Unable to change selected lights across multiple rooms at once. Choose one room and try again.',
      controls: [],
    })
    expect(parseLightUtterance('Change the color of the Kitchen lights and the Front Left light in the Living Room.')).toMatchObject({
      status: 'unsupported',
      text: 'Unable to change selected lights across multiple rooms at once. Choose one room and try again.',
      controls: [],
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
