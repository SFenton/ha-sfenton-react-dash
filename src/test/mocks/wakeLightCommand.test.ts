import { beforeEach, describe, expect, it } from 'vitest'
import { applyMockWakeCommand, resetMockWakeCommands } from './wakeLightCommand'

describe('revision-faithful wake mock contract', () => {
  beforeEach(resetMockWakeCommands)
  const entity = () => ({
    state: 'idle',
    attributes: {
      profile_id: 'room',
      revision: 2,
      alarms: [],
      defaults: { post_wake_hold_minutes: 5, ramp_minutes: 30 },
    } as Record<string, unknown>,
  })
  const command = {
    profile_id: 'room',
    expected_revision: 2,
    request_id: 'request',
    operation: 'update_defaults',
    defaults: { post_wake_hold_minutes: 5, ramp_minutes: 15 },
  }

  it('rejects stale configuration without changing the entity', () => {
    const target = entity()
    const before = structuredClone(target)
    expect(applyMockWakeCommand(target, { ...command, expected_revision: 1 }).outcome).toBe('revision_conflict')
    expect(target).toEqual(before)
  })

  it('replays the recorded result without applying a second mutation', () => {
    const target = entity()
    expect(applyMockWakeCommand(target, command)).toMatchObject({ outcome: 'accepted', revision: 3 })
    expect(applyMockWakeCommand(target, command)).toMatchObject({ outcome: 'accepted', revision: 3, idempotent: true })
    expect(target.attributes.revision).toBe(3)
    expect(applyMockWakeCommand(target, {
      ...command,
      defaults: { post_wake_hold_minutes: 5, ramp_minutes: 10 },
    }).outcome).toBe('request_id_conflict')
  })

  it('does not fake acceptance of a source-owned edit', () => {
    const target = entity()
    expect(applyMockWakeCommand(target, { ...command, operation: 'upsert_alarm', alarm: { source: 'sleepypod' } }).outcome).toBe('read_only_source')
    expect(target.attributes.revision).toBe(2)
  })
})
