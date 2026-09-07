import { coordinatorFixture } from '../fixtures/front-door-unsecured/coordinator'
import { configFingerprint, passiveCoordinatorFallback, removeCoordinatorUnsecuredOwner, COORDINATOR_DELEGATION } from './frontDoorCoordinatorTransform'
import type { HaRecord } from './frontDoorUnsecuredConfig'

describe('coordinator ownership migration', () => {
  it('removes both routine classifiers and dead references without editing unrelated actions', () => {
    const original = coordinatorFixture()
    const before = structuredClone(original)
    const updated = removeCoordinatorUnsecuredOwner(original)
    expect(original).toEqual(before)
    expect(JSON.stringify(updated)).not.toMatch(/unsecured_while_away|unsecured_away_35s/)
    expect(updated.triggers).toEqual((before.triggers as HaRecord[]).slice(1))
    expect(updated.conditions).toEqual(before.conditions)
    expect(updated.mode).toBe('restart')
    expect(updated.trace).toEqual(before.trace)
    const oldActions = before.actions as HaRecord[]
    const newActions = updated.actions as HaRecord[]
    for (const index of [2, 3, 5]) expect(newActions[index]).toEqual(oldActions[index])
    for (const index of [1, 4]) {
      const variables = newActions[index].variables as Record<string, string>
      expect(variables.classification).toContain('unsafe_lock_jammed')
      expect(variables.classification).toContain('lock_failed_to_secure')
      expect(variables.push_level).toContain("['unsafe_lock_jammed', 'door_left_open', 'lock_failed_to_secure'] %}time-sensitive")
      expect(variables.unrelated).toBe((oldActions[index].variables as HaRecord).unrelated)
    }
    expect(updated.description).toContain(COORDINATOR_DELEGATION)
    expect(removeCoordinatorUnsecuredOwner(updated)).toEqual(updated)
  })

  it.each(['classifier', 'pass', 'reference', 'identity'])('aborts unexpected %s drift', (kind) => {
    const original = coordinatorFixture()
    if (kind === 'classifier') {
      const variables = (original.actions as HaRecord[])[1].variables as Record<string, string>
      variables.classification = variables.classification.replace('>= 35', '>= 15')
    }
    if (kind === 'pass') (original.actions as HaRecord[]).splice(4, 1)
    if (kind === 'reference') original.unknown = 'unsecured_while_away'
    if (kind === 'identity') original.id = 'different-object'
    expect(() => removeCoordinatorUnsecuredOwner(original)).toThrow()
  })

  it('provides an idempotent passive non-actionable fallback that can be migrated again', () => {
    const original = coordinatorFixture()
    const fallback = passiveCoordinatorFallback(original)
    expect(JSON.stringify(fallback)).not.toContain('%}critical')
    expect(JSON.stringify(fallback)).not.toContain('FRONT_DOOR_LOCK_')
    const variables = (fallback.actions as HaRecord[])[1].variables as Record<string, string>
    expect(variables.classification).toContain("is_state('lock.aqara_smart_lock_u400', 'unlocked')")
    expect(variables.plain_summary).not.toContain('nobody')
    expect(variables.notification_url).toContain("unsecured_while_away' %}/sfenton-react-dash/home?path=security{% else %}")
    expect(passiveCoordinatorFallback(fallback)).toEqual(fallback)
    expect(JSON.stringify(removeCoordinatorUnsecuredOwner(fallback))).not.toContain('unsecured_while_away')
    expect(original).toEqual(coordinatorFixture())
  })

  it('fingerprints structural equality and distinguishes missing values', () => {
    expect(configFingerprint({ b: 2, a: 1 })).toBe(configFingerprint({ a: 1, b: 2 }))
    expect(configFingerprint(undefined)).not.toBe(configFingerprint(null))
  })
})
