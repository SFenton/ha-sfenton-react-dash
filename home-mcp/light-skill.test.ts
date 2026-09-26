import { buildLightPlan } from './light-skill'
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
    }
    const colorRoomPicker = buildLightPlan({ action: 'color' })
    expect(colorRoomPicker).toMatchObject({ status: 'clarify' })
    expect(colorRoomPicker?.controls[0]).toMatchObject({
      kind: 'room-picker',
      options: expect.not.arrayContaining([
        expect.objectContaining({ label: 'Dining Room' }),
        expect.objectContaining({ label: 'Guest Bathroom' }),
        expect.objectContaining({ label: 'Master Bathroom' }),
      ]),
    })
    expect(buildLightPlan({ action: 'pbl', room: 'Master Bathroom' }).operations?.[0].room.pblEntityId)
      .toBe('switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed')
  })

  it('rejects brightness control for the non-dimmable Entryway switch', () => {
    expect(buildLightPlan({ action: 'set', room: 'Entryway', brightness_pct: 30 })).toMatchObject({
      status: 'unsupported', text: 'The Entryway light does not support brightness control.',
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
    const historyPicker = buildLightPlan({
      action: 'history',
      history_before: '2026-09-08T12:00:00Z',
      target_state: 'off',
    })
    expect(historyPicker.context).toMatchObject({
      roomId: null,
      lastAction: 'history',
      historyBefore: '2026-09-08T12:00:00Z',
      targetState: 'off',
    })
    expect(buildLightPlan({
      action: 'history',
      room: 'Living Room',
      history_before: '2026-09-08T12:00:00Z',
      target_state: 'off',
    }).operations?.[0]).toMatchObject({
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
})
