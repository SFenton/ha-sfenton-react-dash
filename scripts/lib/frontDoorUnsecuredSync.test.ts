import { coordinatorFixture } from '../fixtures/front-door-unsecured/coordinator'
import { configFingerprint } from './frontDoorCoordinatorTransform'
import { FRONT_DOOR as F, UNSECURED_HELPERS as H, type HaRecord, type ManagedHelper } from './frontDoorUnsecuredConfig'
import { activateFrontDoor, frontDoorPlan, PROTECTED_AUTOMATIONS, rollbackFrontDoor, stageFrontDoor, verifyFrontDoor, waitForLoadedAutomation, type FrontDoorClient, type FrontDoorSnapshot } from './frontDoorUnsecuredSync'
import { assertSnapshotSafe } from '../sync-front-door-unsecured'

class FakeClient implements FrontDoorClient {
  configs = new Map<string, HaRecord>([
    [F.coordinatorId, coordinatorFixture()],
    ...Object.values(PROTECTED_AUTOMATIONS).map((id): [string, HaRecord] => [id, { id, alias: 'Protected unchanged object' }]),
  ])
  helpers = new Map<string, HaRecord[]>()
  loaded = new Map([...this.configs].map(([id, config]) => [id, structuredClone(config)]))
  pendingLoads = new Map<string, { config: HaRecord; reads: number }>()
  reloadReads = 0
  loadedReads = 0
  states = new Map<string, string>([[F.coordinator, 'on']])
  persistedEnabled = new Map(this.states)
  writes: string[] = []
  rejectValidation = false
  rejectCandidate = false
  beforeGet?: (id: string) => void
  beforeWrite?: (id: string) => void

  async getAutomation(id: string) {
    this.beforeGet?.(id)
    return structuredClone(this.configs.get(id) ?? null)
  }
  async loadedAutomation(entity: string) {
    this.loadedReads += 1
    const id = entity === F.controller ? F.controllerId : entity === F.reconciler ? F.reconcilerId : F.coordinatorId
    const pending = this.pendingLoads.get(id)
    if (pending) {
      if (pending.reads-- <= 0) {
        this.loaded.set(id, structuredClone(pending.config))
        this.pendingLoads.delete(id)
      }
    }
    return structuredClone(this.loaded.get(id) ?? null)
  }
  async setAutomation(id: string, config: HaRecord) {
    this.beforeWrite?.(id)
    this.writes.push(`config:${id}`)
    this.configs.set(id, structuredClone(config))
    if (this.reloadReads) this.pendingLoads.set(id, { config: structuredClone(config), reads: this.reloadReads })
    else this.loaded.set(id, structuredClone(config))
    const entity = id === F.controllerId ? F.controller : id === F.reconcilerId ? F.reconciler : F.coordinator
    if (!this.states.has(entity) || config.initial_state === false) this.states.set(entity, 'off')
  }
  async listHelpers(domain: string) { return structuredClone(this.helpers.get(domain) ?? []) }
  async createHelper(helper: ManagedHelper) {
    this.writes.push(`create:${helper.id}`)
    this.helpers.set(helper.domain, [...(this.helpers.get(helper.domain) ?? []), { id: helper.id, ...helper.config }])
    this.states.set(`${helper.domain}.${helper.id}`, helper.domain === 'input_text' ? 'unknown' : helper.domain === 'input_select' ? 'idle' : 'off')
    return helper.id
  }
  async initializeHelper(helper: ManagedHelper) {
    this.writes.push(`initialize:${helper.id}`)
    this.states.set(`${helper.domain}.${helper.id}`, '')
  }
  async persistStates() {
    this.writes.push('persist')
    this.persistedEnabled = new Map(this.states)
  }
  async validateAutomation() { if (this.rejectCandidate) throw new Error('Candidate rejected') }
  async state(entity: string) { return { state: this.states.get(entity) ?? 'off', attributes: {} } }
  async automation(service: 'turn_on' | 'turn_off' | 'trigger', entity: string) {
    const id = entity === F.controller ? F.controllerId : entity === F.reconciler ? F.reconcilerId : F.coordinatorId
    if (service === 'turn_on' && configFingerprint(this.loaded.get(id)) !== configFingerprint(this.configs.get(id))) {
      throw new Error('Attempted enablement before the saved configuration was loaded')
    }
    this.writes.push(`${service}:${entity}`)
    if (service !== 'trigger') this.states.set(entity, service === 'turn_on' ? 'on' : 'off')
  }
  async validate() { if (this.rejectValidation) throw new Error('Configuration rejected') }
}

async function stagedClient() {
  const client = new FakeClient()
  let original!: FrontDoorSnapshot
  const before = await frontDoorPlan(client)
  const staged = await stageFrontDoor(client, before.fingerprint, async (snapshot) => { original = snapshot })
  return { client, original, staged }
}

describe('front-door synchronization boundary', () => {
  it('plans and validates candidates without any live writes', async () => {
    const client = new FakeClient()
    const first = await frontDoorPlan(client)
    const second = await frontDoorPlan(client)
    expect(first.fingerprint).toBe(second.fingerprint)
    expect(first.ready).toBe(false)
    expect(first.changes).toHaveLength(10)
    expect(client.writes).toEqual([])
  })

  it('rejects invalid candidate configurations before staging', async () => {
    const client = new FakeClient()
    client.rejectCandidate = true
    await expect(frontDoorPlan(client)).rejects.toThrow('Candidate rejected')
    expect(client.writes).toEqual([])
  })

  it('rejects fresh fingerprint drift and reset-on-restart helper configuration', async () => {
    const client = new FakeClient()
    const before = await frontDoorPlan(client)
    client.configs.get(F.coordinatorId)!.description = 'Human changed description'
    await expect(stageFrontDoor(client, before.fingerprint, async () => {})).rejects.toThrow('changed after planning')
    expect(client.writes).toEqual([])
    client.helpers.set('input_text', [{ id: H.incident.split('.')[1], name: 'Front Door Unsecured Incident ID', min: 0, max: 100, mode: 'text', initial: '' }])
    await expect(frontDoorPlan(client)).rejects.toThrow('unexpected configuration drift')
  })

  it('captures rollback before writes and initializes only new text storage while disabled', async () => {
    const client = new FakeClient()
    const before = await frontDoorPlan(client)
    let snapshot!: FrontDoorSnapshot
    const staged = await stageFrontDoor(client, before.fingerprint, async (value) => {
      expect(client.writes).toEqual([])
      snapshot = value
    })
    expect(snapshot.coordinator).toEqual(coordinatorFixture())
    expect(client.configs.get(F.controllerId)?.initial_state).toBe(false)
    expect(client.configs.get(F.reconcilerId)?.initial_state).toBe(false)
    expect(client.writes.filter((write) => write.startsWith('initialize:'))).toHaveLength(3)
    expect(client.states.get(F.coordinator)).toBe('on')
    expect(client.states.get(H.incident)).toBe('')
    expect(staged.ready).toBe(false)
    expect(client.writes).not.toContain(`config:${F.coordinatorId}`)
    expect(client.writes.some((write) => write.includes('lock.lock'))).toBe(false)
  })

  it('performs a bounded cutover and leaves unrelated objects unchanged', async () => {
    const { client, original, staged } = await stagedClient()
    client.writes = []
    let captured = false
    const active = await activateFrontDoor(client, staged.fingerprint, async () => { captured = true })
    expect(captured).toBe(true)
    expect(active.ready).toBe(true)
    expect(client.writes.indexOf(`turn_off:${F.coordinator}`)).toBeLessThan(client.writes.indexOf(`config:${F.coordinatorId}`))
    expect(client.writes.indexOf(`config:${F.coordinatorId}`)).toBeLessThan(client.writes.indexOf(`turn_on:${F.controller}`))
    expect(client.writes.filter((write) => write.startsWith('trigger:'))).toEqual([`trigger:${F.controller}`])
    expect(client.states.get(F.coordinator)).toBe('on')
    for (const [id, hash] of Object.entries(original.protected)) expect(configFingerprint(client.configs.get(id))).toBe(hash)
    const writes = client.writes.length
    await activateFrontDoor(client, active.fingerprint, async () => { throw new Error('Idempotent activation must not overwrite rollback snapshot') })
    expect(client.writes).toHaveLength(writes)
    await verifyFrontDoor(client)
  })

  it('preserves a previously disabled coordinator during cutover', async () => {
    const { client, staged } = await stagedClient()
    client.states.set(F.coordinator, 'off')
    const current = await frontDoorPlan(client)
    expect(current.fingerprint).not.toBe(staged.fingerprint)
    await activateFrontDoor(client, current.fingerprint, async () => {})
    expect(client.states.get(F.coordinator)).toBe('off')
  })

  it('does not initialize partially staged metadata while its controller is running', async () => {
    const { client, staged } = await stagedClient()
    client.states.set(F.controller, 'on')
    client.writes = []
    await expect(stageFrontDoor(client, staged.fingerprint, async () => {})).rejects.toThrow('must be disabled')
    expect(client.writes).toEqual([])
  })

  it('fails safe to passive visibility if activation validation fails', async () => {
    const { client, staged } = await stagedClient()
    client.rejectValidation = true
    await expect(activateFrontDoor(client, staged.fingerprint, async () => {})).rejects.toThrow('Configuration rejected')
    expect(client.states.get(F.controller)).toBe('off')
    expect(client.states.get(F.reconciler)).toBe('off')
    expect(client.configs.get(F.controllerId)?.initial_state).toBe(false)
    expect(client.configs.get(F.reconcilerId)?.initial_state).toBe(false)
    expect(client.states.get(F.coordinator)).toBe('on')
    expect(JSON.stringify(client.configs.get(F.coordinatorId))).not.toContain('%}critical')
  })

  it('rolls back only owned objects without deleting forensic helpers', async () => {
    const { client, original, staged } = await stagedClient()
    const active = await activateFrontDoor(client, staged.fingerprint, async () => {})
    const helpers = structuredClone([...client.helpers])
    await rollbackFrontDoor(client, original, configFingerprint(active.snapshot.coordinator))
    expect(client.states.get(F.controller)).toBe('off')
    expect(client.states.get(F.reconciler)).toBe('off')
    expect([...client.helpers]).toEqual(helpers)
    expect(JSON.stringify(client.configs.get(F.coordinatorId))).not.toContain('%}critical')
    expect(client.states.get(F.coordinator)).toBe('on')
  })

  it('refuses rollback over concurrent coordinator edits', async () => {
    const { client, original, staged } = await stagedClient()
    const active = await activateFrontDoor(client, staged.fingerprint, async () => {})
    client.configs.get(F.coordinatorId)!.description = 'Human edit'
    client.writes = []
    await expect(rollbackFrontDoor(client, original, configFingerprint(active.snapshot.coordinator))).rejects.toThrow('drift blocks rollback')
    expect(client.writes.slice(0, 2)).toEqual([`turn_off:${F.controller}`, `turn_off:${F.reconciler}`])
    expect(client.writes).not.toContain(`config:${F.coordinatorId}`)
    expect(client.states.get(F.coordinator)).toBe('on')
  })

  it('rejects credential-bearing snapshots without exposing their values', async () => {
    const { original } = await stagedClient()
    expect(() => assertSnapshotSafe(original, ['not-present'])).not.toThrow()
    original.coordinator.private = 'synthetic-sensitive-value'
    expect(() => assertSnapshotSafe(original, ['synthetic-sensitive-value'])).toThrow('restricted identifier')
  })

  it('waits for delayed runtime reload before enabling either owner', async () => {
    const { client, staged } = await stagedClient()
    client.reloadReads = 2
    await activateFrontDoor(client, staged.fingerprint, async () => {})
    expect(client.pendingLoads.size).toBe(0)
    expect(client.loadedReads).toBeGreaterThan(8)
    expect(client.persistedEnabled.get(F.controller)).toBe('on')
    expect(client.persistedEnabled.get(F.reconciler)).toBe('on')
  })

  it('rejects a saved/runtime mismatch rather than accepting YAML readback as activation', async () => {
    const { client, original } = await stagedClient()
    client.loaded.set(F.coordinatorId, { ...original.coordinator, description: 'Older loaded configuration' })
    await expect(waitForLoadedAutomation(client, F.coordinatorId, original.coordinator, { timeoutMs: 0 })).rejects.toThrow('Runtime configuration')
  })

  it('persists rollback disablement even if restored enabled-state data is stale', async () => {
    const { client, original, staged } = await stagedClient()
    const active = await activateFrontDoor(client, staged.fingerprint, async () => {})
    await rollbackFrontDoor(client, original, configFingerprint(active.snapshot.coordinator))
    for (const [id, entity] of [[F.controllerId, F.controller], [F.reconcilerId, F.reconciler]]) {
      client.persistedEnabled.set(entity, 'on')
      const restored = client.configs.get(id)?.initial_state === false ? 'off' : client.persistedEnabled.get(entity)
      expect(restored).toBe('off')
    }
  })
})
