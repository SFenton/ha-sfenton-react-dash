import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generatedMockEntities } from '../../src/test/mocks/generated/appEntities'
import {
  explicitMockEntities,
  mergeMockEntityMaps,
  mockEntities,
  type MockEntity,
} from '../../src/test/mocks/hakitCoreState'
import {
  buildSyntheticMockEntities,
  sanitizeLiveHassState,
  serializeSyntheticMockFixture,
  syntheticMockAuditErrors,
  type LiveHassState,
  type SyntheticMockEntityMap,
} from './mockFixture'
import type { ManualAppInventory } from './appInventory'

const generatedEntities = generatedMockEntities as SyntheticMockEntityMap

async function appInventory() {
  const source = await readFile(resolve(process.cwd(), 'src/manual/generated/appInventory.json'), 'utf8')
  return JSON.parse(source) as ManualAppInventory
}

describe('App Manual generated mock fixtures', () => {
  it('sanitizes hostile live values into deterministic synthetic entities', () => {
    const liveStates: LiveHassState[] = [
      {
        entity_id: 'select.synthetic_private_mode',
        state: 'Resident Name',
        attributes: {
          access_token: 'eyJhbGciOiJIUzI1NiJ9.synthetic.signature',
          friendly_name: 'Resident Private Mode',
          options: ['Resident Name', 'https://camera.example.test/live', 'auto'],
          schedule: [{ start: '2026-08-07T22:00:00Z' }],
        },
      },
      {
        entity_id: 'sensor.synthetic_temperature',
        state: '93.7',
        attributes: {
          device_class: 'temperature',
          entity_picture: 'data:image/jpeg;base64,AAAA',
          friendly_name: 'Private Room Temperature',
          latitude: 47.123,
          longitude: -122.456,
          serial_number: '0123456789abcdef0123456789abcdef',
          state_class: 'measurement',
          unit_of_measurement: '\u00b0F',
          vin: '1M8GDM9AXKP042788',
        },
      },
    ]

    const first = buildSyntheticMockEntities(
      ['sensor.synthetic_temperature', 'select.synthetic_private_mode'],
      new Set(),
      liveStates,
    )
    const second = buildSyntheticMockEntities(
      ['select.synthetic_private_mode', 'sensor.synthetic_temperature'],
      new Set(),
      [...liveStates].reverse(),
    )

    expect(first.staleEntityIds).toEqual([])
    expect(serializeSyntheticMockFixture(first.entities)).toBe(serializeSyntheticMockFixture(second.entities))
    expect(first.entities['sensor.synthetic_temperature']).toEqual({
      attributes: {
        device_class: 'temperature',
        state_class: 'measurement',
        unit_of_measurement: '\u00b0F',
      },
      entity_id: 'sensor.synthetic_temperature',
      state: '70',
    })
    expect(first.entities['select.synthetic_private_mode']).toEqual({
      attributes: { options: ['Option 1', 'Option 2', 'auto'] },
      entity_id: 'select.synthetic_private_mode',
      state: 'Option 1',
    })
    expect(syntheticMockAuditErrors(first.entities)).toEqual([])
  })

  it('uses safe domain and device-class defaults instead of unavailable states', () => {
    expect(sanitizeLiveHassState({
      entity_id: 'lock.synthetic_front_door',
      state: 'jammed',
      attributes: { friendly_name: 'Private Front Door' },
    })).toEqual({
      attributes: {},
      entity_id: 'lock.synthetic_front_door',
      state: 'locked',
    })
    expect(sanitizeLiveHassState({
      entity_id: 'vacuum.synthetic_cleaner',
      state: 'cleaning',
      attributes: { battery_level: 13, map_url: 'https://example.test/map' },
    })).toEqual({
      attributes: { battery_level: 80 },
      entity_id: 'vacuum.synthetic_cleaner',
      state: 'docked',
    })
    expect(sanitizeLiveHassState({
      entity_id: 'todo.synthetic_list',
      state: '0',
      attributes: {},
    })).toEqual({
      attributes: {},
      entity_id: 'todo.synthetic_list',
      state: 'unknown',
    })
  })

  it('keeps the committed generated source deterministic, sorted, typed, and ASCII', async () => {
    const path = resolve(process.cwd(), 'src/test/mocks/generated/appEntities.ts')
    const source = await readFile(path)
    expect(source.every((byte) => byte < 128)).toBe(true)
    expect(source.toString('utf8')).toBe(serializeSyntheticMockFixture(generatedEntities))
    expect(Object.keys(generatedEntities)).toEqual([...Object.keys(generatedEntities)].sort())
  })

  it('contains no forbidden attributes, friendly names, URLs, blobs, or token-like values', () => {
    expect(syntheticMockAuditErrors(generatedEntities)).toEqual([])
    const payloadStrings: string[] = []
    for (const mockEntity of Object.values(generatedEntities)) {
      expect(mockEntity.attributes).not.toHaveProperty('friendly_name')
      for (const [key, value] of Object.entries(mockEntity.attributes)) {
        expect(key).not.toMatch(/(?:name|url|uri|token|secret|password|latitude|longitude|device_id|unique_id|serial|vin|product|content|schedule|task|timestamp)/i)
        if (typeof value === 'string') payloadStrings.push(value)
        if (Array.isArray(value)) payloadStrings.push(...value.filter((item): item is string => typeof item === 'string'))
      }
      payloadStrings.push(mockEntity.state)
    }
    expect(payloadStrings.join('\n')).not.toMatch(/(?:https?:\/\/|rtsp:\/\/|data:|blob:|bearer\s|eyJ[A-Za-z0-9_-]{8,}\.|[A-Fa-f0-9]{32,})/i)
  })

  it('generates only app-referenced IDs that are absent from explicit mocks', async () => {
    const inventory = await appInventory()
    const referencedIds = new Set(inventory.entities)
    for (const entityId of Object.keys(generatedEntities)) {
      expect(referencedIds.has(entityId)).toBe(true)
      expect(explicitMockEntities).not.toHaveProperty(entityId)
    }
  })

  it('lets explicit mocks override generated defaults', () => {
    const generated: Record<string, MockEntity> = {
      'sensor.synthetic_collision': {
        attributes: { unit_of_measurement: '%' },
        entity_id: 'sensor.synthetic_collision',
        state: '0',
      },
    }
    const explicit: Record<string, MockEntity> = {
      'sensor.synthetic_collision': {
        attributes: { unit_of_measurement: '%' },
        entity_id: 'sensor.synthetic_collision',
        state: '73',
      },
    }
    expect(mergeMockEntityMaps(generated, explicit)['sensor.synthetic_collision']).toBe(explicit['sensor.synthetic_collision'])
  })

  it('covers every app inventory entity in the merged mock map', async () => {
    const inventory = await appInventory()
    const missing = inventory.entities.filter((entityId) => !mockEntities[entityId])
    expect(missing).toEqual([])
    expect(inventory.entities.filter((entityId) => explicitMockEntities[entityId]).length
      + inventory.entities.filter((entityId) => generatedMockEntities[entityId] && !explicitMockEntities[entityId]).length)
      .toBe(inventory.entities.length)
  })
})
