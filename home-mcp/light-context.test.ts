import { canonicalizeLightContext } from './light-context'

describe('canonical light context', () => {
  it('resolves configured fixture names and rejects mismatched or private fields', () => {
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: 'living-room',
      entityIds: [],
      lightNames: ['Front Left'],
      lastAction: 'state',
    })).toMatchObject({
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Front Left'],
    })
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: 'living-room',
      entityIds: ['light.living_room_front_left_light'],
      lightNames: ['Back Right'],
    })).toBeNull()
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: 'living-room',
      entityIds: [],
      lightNames: ['password=SecretValue123456789'],
    })).toBeNull()
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      historyBefore: 'private medical appointment',
    })).toBeNull()
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      lastAction: 'off',
    })).toMatchObject({ roomId: null, lightNames: [], lastAction: 'off' })
  })

  it('normalizes the retained legacy brightness action', () => {
    expect(canonicalizeLightContext({
      domain: 'lights',
      roomId: 'living-room',
      entityIds: [],
      lightNames: [],
      lastAction: 'brightness',
    })).toMatchObject({
      roomId: 'living-room',
      lastAction: 'brightness-state',
    })
  })
})
