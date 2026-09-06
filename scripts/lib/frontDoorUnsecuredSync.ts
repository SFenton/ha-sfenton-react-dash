import { FRONT_DOOR as F, UNSECURED_HELPERS as H, UNSECURED_PHASES, frontDoorUnsecuredController, frontDoorUnsecuredHelpers, frontDoorUnsecuredReconciler, type HaRecord, type ManagedHelper } from './frontDoorUnsecuredConfig'
import { configFingerprint, passiveCoordinatorFallback, removeCoordinatorUnsecuredOwner } from './frontDoorCoordinatorTransform'

export const PROTECTED_AUTOMATIONS = {
  autoLock: '1760719119261',
  awayRoutine: '1760812881431',
  alarmNotice: '1760978648617',
  alarmAction: '1760979010661',
  lockStatus: '1760851729227',
} as const

export interface FrontDoorClient {
  getAutomation(id: string): Promise<HaRecord | null>
  loadedAutomation(entity: string): Promise<HaRecord | null>
  setAutomation(id: string, config: HaRecord): Promise<void>
  listHelpers(domain: string): Promise<HaRecord[]>
  createHelper(helper: ManagedHelper): Promise<string>
  initializeHelper(helper: ManagedHelper): Promise<void>
  persistStates(): Promise<void>
  validateAutomation(config: HaRecord): Promise<void>
  state(entity: string, allowMissing?: boolean): Promise<{ state: string; attributes: HaRecord }>
  automation(service: 'turn_on' | 'turn_off' | 'trigger', entity: string): Promise<void>
  validate(): Promise<void>
}

export interface FrontDoorSnapshot {
  version: 1
  coordinator: HaRecord
  coordinatorEnabled: boolean
  managed: Record<string, HaRecord | null>
  helpers: Record<string, HaRecord | null>
  protected: Record<string, string>
}

export interface FrontDoorPlan {
  fingerprint: string
  snapshot: FrontDoorSnapshot
  coordinatorAfter: HaRecord
  ready: boolean
  changes: string[]
}

const managed = () => ({
  [F.controllerId]: frontDoorUnsecuredController(),
  [F.reconcilerId]: frontDoorUnsecuredReconciler(),
})
const staged = (config: HaRecord) => ({ ...config, initial_state: false })

function automationEntity(id: string) {
  const entities: Record<string, string> = {
    [F.coordinatorId]: F.coordinator, [F.controllerId]: F.controller, [F.reconcilerId]: F.reconciler,
  }
  const entity = entities[id]
  if (!entity) throw new Error('Unexpected automation identity.')
  return entity
}

export async function waitForLoadedAutomation(
  client: FrontDoorClient, id: string, desired: HaRecord,
  { enabled, timeoutMs = 60000, intervalMs = 100 }: { enabled?: boolean; timeoutMs?: number; intervalMs?: number } = {},
) {
  const entity = automationEntity(id)
  const expected = configFingerprint(desired)
  const deadline = Date.now() + timeoutMs
  do {
    const loaded = await client.loadedAutomation(entity)
    const state = (await client.state(entity, true)).state
    if (configFingerprint(loaded) === expected && ['on', 'off'].includes(state)
      && (enabled === undefined || state === (enabled ? 'on' : 'off'))) return
    if (Date.now() >= deadline) break
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  } while (Date.now() <= deadline)
  throw new Error(`Runtime configuration/enablement for ${entity} did not reach the verified target.`)
}

function helperMatches(actual: HaRecord, expected: ManagedHelper) {
  if ('initial' in actual && actual.initial !== null) return false
  return Object.entries(expected.config).every(([key, value]) => configFingerprint(actual[key]) === configFingerprint(value))
}

function assertOwnedManaged(actual: HaRecord | null, expected: HaRecord) {
  if (actual === null) return
  const hash = configFingerprint(actual)
  if (hash !== configFingerprint(expected) && hash !== configFingerprint(staged(expected))) {
    throw new Error(`Managed automation ${String(expected.id)} has unexpected configuration drift.`)
  }
}

export async function frontDoorPlan(client: FrontDoorClient): Promise<FrontDoorPlan> {
  const coordinator = await client.getAutomation(F.coordinatorId)
  if (!coordinator) throw new Error('The existing front-entry coordinator is missing.')
  const coordinatorAfter = removeCoordinatorUnsecuredOwner(coordinator)
  const managedConfigs: Record<string, HaRecord | null> = {}
  const helperConfigs: Record<string, HaRecord | null> = {}
  const protectedConfigs: Record<string, string> = {}
  const changes: string[] = []
  for (const [id, desired] of Object.entries(managed())) {
    await client.validateAutomation(desired)
    const current = await client.getAutomation(id)
    assertOwnedManaged(current, desired)
    managedConfigs[id] = current
    if (configFingerprint(current) !== configFingerprint(desired)) changes.push(`Install ${id}`)
  }
  const domains = new Map<string, HaRecord[]>()
  for (const helper of frontDoorUnsecuredHelpers) {
    if (!domains.has(helper.domain)) domains.set(helper.domain, await client.listHelpers(helper.domain))
    const current = domains.get(helper.domain)!.find((item) => item.id === helper.id) ?? null
    if (current && !helperMatches(current, helper)) throw new Error(`Helper ${helper.id} has unexpected configuration drift.`)
    helperConfigs[`${helper.domain}.${helper.id}`] = current
    if (!current) changes.push(`Create ${helper.domain}.${helper.id}`)
  }
  for (const [name, id] of Object.entries(PROTECTED_AUTOMATIONS)) {
    const config = await client.getAutomation(id)
    if (!config) throw new Error(`Protected automation ${name} is missing.`)
    protectedConfigs[id] = configFingerprint(config)
  }
  if (configFingerprint(coordinator) !== configFingerprint(coordinatorAfter)) changes.push('Delegate routine unsecured notifications from both coordinator passes')
  const snapshot: FrontDoorSnapshot = {
    version: 1,
    coordinator,
    coordinatorEnabled: (await client.state(F.coordinator)).state === 'on',
    managed: managedConfigs,
    helpers: helperConfigs,
    protected: protectedConfigs,
  }
  const fingerprint = configFingerprint({ snapshot, desired: managed(), helperDefinitions: frontDoorUnsecuredHelpers, coordinatorAfter })
  return { fingerprint, snapshot, coordinatorAfter, ready: changes.length === 0, changes }
}

async function requireFreshPlan(client: FrontDoorClient, expected: string) {
  const plan = await frontDoorPlan(client)
  if (plan.fingerprint !== expected) throw new Error('Live configuration changed after planning; no mutation performed.')
  return plan
}

async function setChecked(client: FrontDoorClient, id: string, before: HaRecord | null, after: HaRecord) {
  if (configFingerprint(await client.getAutomation(id)) !== configFingerprint(before)) {
    throw new Error(`Automation ${id} changed immediately before its write.`)
  }
  if (configFingerprint(before) !== configFingerprint(after)) {
    await client.setAutomation(id, after)
    if (configFingerprint(await client.getAutomation(id)) !== configFingerprint(after)) {
      throw new Error(`Automation ${id} did not round-trip after its write.`)
    }
  }
  await waitForLoadedAutomation(client, id, after, { enabled: false })
}

async function assertProtected(client: FrontDoorClient, snapshot: FrontDoorSnapshot) {
  for (const [id, fingerprint] of Object.entries(snapshot.protected)) {
    if (configFingerprint(await client.getAutomation(id)) !== fingerprint) throw new Error(`Protected automation ${id} changed; refusing to overwrite it.`)
  }
}

async function setEnabled(client: FrontDoorClient, entity: string, enabled: boolean) {
  const current = (await client.state(entity)).state
  if (!['on', 'off'].includes(current)) throw new Error(`Automation ${entity} is not available for a safe state change.`)
  if (current !== (enabled ? 'on' : 'off')) await client.automation(enabled ? 'turn_on' : 'turn_off', entity)
}

async function durablyDisableManaged(client: FrontDoorClient) {
  for (const entity of [F.controller, F.reconciler]) {
    if ((await client.state(entity, true)).state === 'on') await client.automation('turn_off', entity)
  }
  await client.persistStates()
  for (const id of [F.controllerId, F.reconcilerId]) {
    const current = await client.getAutomation(id)
    if (!current) continue
    if (current.id !== id) throw new Error('Refusing to replace an unrelated automation during disablement.')
    await setChecked(client, id, current, staged(current))
  }
  await client.persistStates()
}

export async function stageFrontDoor(
  client: FrontDoorClient, expected: string,
  saveSnapshot: (snapshot: FrontDoorSnapshot) => Promise<void>,
) {
  const plan = await requireFreshPlan(client, expected)
  if (plan.ready) return plan
  if (plan.snapshot.managed[F.controllerId] && (await client.state(F.controller)).state !== 'off') {
    throw new Error('The partially staged controller must be disabled before staging metadata.')
  }
  await saveSnapshot(plan.snapshot)
  for (const helper of frontDoorUnsecuredHelpers) {
    if (!plan.snapshot.helpers[`${helper.domain}.${helper.id}`]) {
      const current = await client.listHelpers(helper.domain)
      if (current.some((entry) => entry.id === helper.id)) throw new Error(`Helper ${helper.id} appeared after planning.`)
      if (await client.createHelper(helper) !== helper.id) throw new Error(`Unexpected generated helper ID for ${helper.id}.`)
    }
    const actual = (await client.listHelpers(helper.domain)).find((entry) => entry.id === helper.id)
    if (!actual || !helperMatches(actual, helper)) throw new Error(`Helper ${helper.id} failed verification.`)
    if ((await client.state(`${helper.domain}.${helper.id}`)).state === 'unknown') {
      const controller = plan.snapshot.managed[F.controllerId]
      if (controller && controller.initial_state !== false) throw new Error('Do not initialize unknown metadata in a live controller.')
      await client.initializeHelper(helper)
    }
  }
  await client.persistStates()
  for (const [id, desired] of Object.entries(managed())) {
    const current = plan.snapshot.managed[id]
    if (current) continue
    await setChecked(client, id, null, staged(desired))
  }
  await client.validate()
  await assertProtected(client, plan.snapshot)
  const result = await frontDoorPlan(client)
  if (configFingerprint(result.snapshot.coordinator) !== configFingerprint(plan.snapshot.coordinator)) throw new Error('Coordinator changed while staging.')
  return result
}

export async function activateFrontDoor(
  client: FrontDoorClient, expected: string,
  saveSnapshot: (snapshot: FrontDoorSnapshot) => Promise<void>,
) {
  const plan = await requireFreshPlan(client, expected)
  if (Object.values(plan.snapshot.helpers).some((helper) => helper === null)
    || Object.values(plan.snapshot.managed).some((config) => config === null)) throw new Error('Stage and verify all managed objects before activation.')
  if (plan.ready && (await client.state(F.controller)).state === 'on' && (await client.state(F.reconciler)).state === 'on') {
    return verifyFrontDoor(client)
  }
  await saveSnapshot(plan.snapshot)
  const coordinatorEnabled = plan.snapshot.coordinatorEnabled
  try {
    await setEnabled(client, F.reconciler, false)
    await setEnabled(client, F.controller, false)
    await setEnabled(client, F.coordinator, false)
    await client.persistStates()
    for (const [id, desired] of Object.entries(managed())) {
      await setChecked(client, id, plan.snapshot.managed[id], desired)
    }
    await setChecked(client, F.coordinatorId, plan.snapshot.coordinator, plan.coordinatorAfter)
    await client.validate()
    await assertProtected(client, plan.snapshot)
    if (coordinatorEnabled) await setEnabled(client, F.coordinator, true)
    await setEnabled(client, F.controller, true)
    await setEnabled(client, F.reconciler, true)
    await client.persistStates()
    await client.automation('trigger', F.controller)
    return await verifyFrontDoor(client)
  } catch (error) {
    const cleanupErrors: unknown[] = []
    try {
      await durablyDisableManaged(client)
    } catch (cleanup) {
      cleanupErrors.push(cleanup)
    }
    try {
      const current = await client.getAutomation(F.coordinatorId)
      if (configFingerprint(current) === configFingerprint(plan.coordinatorAfter)
        || configFingerprint(current) === configFingerprint(plan.snapshot.coordinator)) {
        if (JSON.stringify(plan.snapshot.coordinator).includes('unsecured_while_away')) {
          await setEnabled(client, F.coordinator, false)
          await setChecked(client, F.coordinatorId, current, passiveCoordinatorFallback(plan.snapshot.coordinator))
        }
      }
      if (coordinatorEnabled) await setEnabled(client, F.coordinator, true)
      await client.persistStates()
    } catch (cleanup) {
      cleanupErrors.push(cleanup)
    }
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'Activation failed and object-level rollback needs attention.', { cause: error })
    throw error
  }
}

export async function verifyFrontDoor(client: FrontDoorClient) {
  const plan = await frontDoorPlan(client)
  if (!plan.ready) throw new Error('Managed configuration is not fully active.')
  for (const entity of [F.controller, F.reconciler]) {
    if ((await client.state(entity)).state !== 'on') throw new Error(`${entity} is not enabled.`)
  }
  await waitForLoadedAutomation(client, F.controllerId, managed()[F.controllerId], { enabled: true })
  await waitForLoadedAutomation(client, F.reconcilerId, managed()[F.reconcilerId], { enabled: true })
  await waitForLoadedAutomation(client, F.coordinatorId, plan.snapshot.coordinator)
  for (const entity of Object.values(H)) {
    if (['unknown', 'unavailable'].includes((await client.state(entity)).state)) throw new Error(`Lifecycle storage ${entity} is unavailable.`)
  }
  const phase = (await client.state(H.phase)).state
  if (!(UNSECURED_PHASES as readonly string[]).includes(phase)) throw new Error('The lifecycle phase is invalid.')
  const opened = Number((await client.state(H.opened)).state)
  if (phase !== 'idle' && (!(await client.state(H.incident)).state || !Number.isFinite(opened) || opened <= 0)) {
    throw new Error('The active lifecycle metadata is incomplete.')
  }
  return plan
}

export async function rollbackFrontDoor(client: FrontDoorClient, original: FrontDoorSnapshot, expectedCoordinator: string) {
  if (original.version !== 1) throw new Error('Unsupported rollback snapshot.')
  await durablyDisableManaged(client)
  const current = await client.getAutomation(F.coordinatorId)
  if (!current || configFingerprint(current) !== expectedCoordinator) throw new Error('Coordinator drift blocks rollback.')
  await assertProtected(client, original)
  await setEnabled(client, F.coordinator, false)
  await client.persistStates()
  await setChecked(client, F.coordinatorId, current, passiveCoordinatorFallback(original.coordinator))
  await client.validate()
  if (original.coordinatorEnabled) await setEnabled(client, F.coordinator, true)
  await client.persistStates()
}
