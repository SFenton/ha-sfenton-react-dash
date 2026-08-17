import { describe, expect, it } from 'vitest'
import { garageDoorCommandForState } from './garageDoorState'

describe('garageDoorCommandForState', () => {
  it.each([
    ['closed', true, 'open_cover', 'opening'],
    ['closing', true, 'open_cover', 'opening'],
    ['open', false, 'close_cover', 'closing'],
    ['opening', false, 'close_cover', 'closing'],
  ] as const)('maps %s to an explicit command', (liveState, opens, service, state) => {
    expect(garageDoorCommandForState(liveState)).toEqual({ opens, service, state })
  })

  it.each([undefined, 'unavailable', 'unknown', 'stopped'])('does not expose a command for %s', (state) => {
    expect(garageDoorCommandForState(state)).toBeNull()
  })
})
