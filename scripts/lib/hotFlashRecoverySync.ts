import { createHash } from 'node:crypto'
import {
  HOT_FLASH,
  HOT_FLASH_TARGET_WRAPPERS,
  hotFlashHelpers,
  hotFlashRecoveryConfig,
  type HaRecord,
  type HotFlashRequestedBy,
  type ManagedHelper,
} from './hotFlashRecoveryConfig'

export const HOT_FLASH_ORIGINALS = [
  'automation.eight_sleep_stephen_hot_flash_mode',
  'automation.eight_sleep_steph_hot_flash_mode',
  'automation.sleepypod_bed_stage_schedules_to_mqtt',
  ...HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => `script.${wrapper.id}`),
] as const

export const HOT_FLASH_NEW_IDS = [
  HOT_FLASH.broker,
  'automation.sleepypod_hot_flash_state_reconciler',
  'automation.sleepypod_hot_flash_startup_followup',
] as const

export const HOT_FLASH_RETIRED_IDS = [
  'script.sleepypod_temperature_feedback',
] as const

export const HOT_FLASH_MANAGED_AUTOMATIONS = [
  'automation.sleepypod_hot_flash_state_reconciler',
  'automation.sleepypod_hot_flash_startup_followup',
  'automation.eight_sleep_stephen_hot_flash_mode',
  'automation.eight_sleep_steph_hot_flash_mode',
] as const

const HOT_FLASH_STAGE_IDS = new Set<string>(HOT_FLASH_NEW_IDS)
const HOT_FLASH_PROTECTED_CONSUMERS = ['script.household_away_command'] as const
const HOT_FLASH_ALLOWED_CONSUMERS = new Set<string>([
  ...HOT_FLASH_ORIGINALS,
  ...HOT_FLASH_NEW_IDS,
  ...HOT_FLASH_PROTECTED_CONSUMERS,
])
const LEGACY_LIFECYCLE_ENTITIES = [
  HOT_FLASH.legacy.leftActive,
  HOT_FLASH.legacy.rightActive,
  'timer.eight_sleep_stephen_hot_flash',
  'timer.eight_sleep_steph_hot_flash',
] as const
const MANAGED_LIFECYCLE_ENTITIES = [
  HOT_FLASH.helpers.leftPhase,
  HOT_FLASH.helpers.rightPhase,
  HOT_FLASH.helpers.sharedPhase,
] as const
const REQUIRED_DEVICE_ENTITIES = Object.values(HOT_FLASH.sides).flatMap((entry) => [entry.climate, entry.target])

export interface HotFlashState {
  attributes: HaRecord
  state: string
}

export interface HotFlashSyncClient {
  getObject(entityId: string): Promise<HaRecord | null>
  getEnabled(entityId: string): Promise<boolean>
  setObject(entityId: string, config: HaRecord): Promise<void>
  removeObject(entityId: string): Promise<void>
  setEnabled(entityId: string, enabled: boolean): Promise<void>
  listHelpers(domain: ManagedHelper['domain']): Promise<HaRecord[]>
  createHelper(helper: ManagedHelper): Promise<string>
  updateHelper(helper: ManagedHelper): Promise<void>
  initializeHelper(helper: ManagedHelper): Promise<void>
  restoreHelperState(helper: ManagedHelper, state: HotFlashState): Promise<void>
  removeHelper(helper: ManagedHelper): Promise<void>
  validateObject(entityId: string, config: HaRecord): Promise<void>
  loaded(entityId: string): Promise<HaRecord | null>
  reload(): Promise<void>
  reconcile(): Promise<void>
  persistStates(): Promise<void>
  validateCore(): Promise<void>
  getState(entityId: string, allowMissing?: boolean): Promise<HotFlashState | null>
  findConsumers(needles: readonly string[]): Promise<Record<string, string[]>>
}

export interface HotFlashSnapshot {
  version: 4
  originals: Record<string, HaRecord>
  originalEnabled: Record<string, boolean>
  managedBefore: Record<string, HaRecord | null>
  managedEnabledBefore: Record<string, boolean>
  retiredBefore: Record<string, HaRecord | null>
  retiredConsumersBefore: Record<string, string[]>
  helpersBefore: Record<string, HaRecord | null>
  helperStatesBefore: Record<string, HotFlashState | null>
  lifecycleBefore: Record<string, HotFlashState | null>
  consumersBefore: Record<string, string[]>
  protectedConsumers: Record<string, HaRecord>
  managedAfter: Record<string, HaRecord>
  helperDefinitions: ManagedHelper[]
}

export interface HotFlashPlan {
  fingerprint: string
  requesterBindingConfigured: true
  ready: boolean
  changes: string[]
  snapshot: HotFlashSnapshot
  generated: ReturnType<typeof hotFlashRecoveryConfig>
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonical(item)]))
}

export const fingerprint = (value: unknown) => createHash('sha256')
  .update(JSON.stringify(canonical(value ?? null)))
  .digest('hex')

function staged(config: HaRecord) {
  return { ...config, initial_state: false }
}

function isAutomation(id: string) {
  return id.startsWith('automation.')
}

function helperEntity(helper: ManagedHelper) {
  return `${helper.domain}.${helper.id}`
}

function timerDurationSeconds(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parts = value.split(':').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

function helperMatches(actual: HaRecord | null, helper: ManagedHelper) {
  if (!actual) return false
  return Object.entries(helper.config).every(([key, value]) => {
    if (helper.domain === 'timer' && key === 'duration') {
      return timerDurationSeconds(actual[key]) === timerDurationSeconds(value)
    }
    return fingerprint(actual[key]) === fingerprint(value)
  })
}

function findValue(value: unknown, predicate: (record: HaRecord) => string | null): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, predicate)
      if (found !== null) return found
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as HaRecord
  const direct = predicate(record)
  if (direct !== null) return direct
  for (const item of Object.values(record)) {
    const found = findValue(item, predicate)
    if (found !== null) return found
  }
  return null
}

function requesterFromAutomation(config: HaRecord, sideName: 'left' | 'right') {
  const requestedByEntity = sideName === 'left' ? HOT_FLASH.legacy.leftRequestedBy : HOT_FLASH.legacy.rightRequestedBy
  const legacy = findValue(config, (record) => {
    if (record.action !== 'input_text.set_value') return null
    const target = record.target as HaRecord | undefined
    if (target?.entity_id !== requestedByEntity) return null
    const data = record.data as HaRecord | undefined
    return typeof data?.value === 'string' && data.value ? data.value : null
  })
  if (legacy) return legacy
  const managed = findValue(config, (record) => {
    if (record.action !== HOT_FLASH.broker) return null
    const data = record.data as HaRecord | undefined
    if (data?.side !== sideName) return null
    return typeof data.requested_by === 'string' && data.requested_by ? data.requested_by : null
  })
  if (!managed) throw new Error(`Fresh ${sideName} requester provenance is missing from the live owner automation.`)
  return managed
}

function requesterBindings(originals: Record<string, HaRecord>): HotFlashRequestedBy {
  return {
    left: requesterFromAutomation(originals['automation.eight_sleep_stephen_hot_flash_mode'], 'left'),
    right: requesterFromAutomation(originals['automation.eight_sleep_steph_hot_flash_mode'], 'right'),
  }
}

function generatedObjects(generated: ReturnType<typeof hotFlashRecoveryConfig>) {
  return {
    [HOT_FLASH.broker]: generated.broker,
    ...Object.fromEntries(Object.entries(generated.scripts).map(([id, config]) => [`script.${id}`, config])),
    ...Object.fromEntries(generated.automations.map((config, index) => [HOT_FLASH_MANAGED_AUTOMATIONS[index], config])),
  }
}

function assertOwnedRetiredObjects(retiredBefore: Record<string, HaRecord | null>) {
  for (const id of HOT_FLASH_RETIRED_IDS) {
    const current = retiredBefore[id]
    if (!current) continue
    const serialized = JSON.stringify(current)
    if (current.alias !== 'SleepyPod temperature command feedback'
      || current.mode !== 'queued'
      || !serialized.includes('sleepypod/eight-pod/cmd/set-alarm')
      || !serialized.includes('vibrationPattern')
      || !serialized.includes('duration')) {
      throw new Error(`Retired managed object ${id} has unexpected configuration drift.`)
    }
  }
}

function assertRetiredObjectsUnreferenced(managedAfter: Record<string, HaRecord>) {
  for (const retiredId of HOT_FLASH_RETIRED_IDS) {
    const consumers = Object.entries(managedAfter)
      .filter(([, config]) => JSON.stringify(config).includes(retiredId))
      .map(([id]) => id)
    if (consumers.length) {
      throw new Error(`Retired managed object ${retiredId} is still referenced by ${consumers.join(', ')}.`)
    }
  }
}

async function readHelpers(client: HotFlashSyncClient) {
  const domains = new Map<ManagedHelper['domain'], HaRecord[]>()
  for (const helper of hotFlashHelpers) {
    if (!domains.has(helper.domain)) domains.set(helper.domain, await client.listHelpers(helper.domain))
  }
  return Object.fromEntries(hotFlashHelpers.map((helper) => {
    const current = domains.get(helper.domain)?.find((entry) => entry.id === helper.id) ?? null
    return [helperEntity(helper), current]
  }))
}

async function readStates(client: HotFlashSyncClient, entities: readonly string[], includeAttributes = true) {
  return Object.fromEntries(await Promise.all(entities.map(async (entity) => [
    entity,
    await client.getState(entity, true).then((current) => current && ({
      state: current.state,
      attributes: includeAttributes ? current.attributes : {},
    })),
  ])))
}

function assertConsumers(consumers: Record<string, string[]>) {
  const unknown = Object.keys(consumers).filter((entity) => !HOT_FLASH_ALLOWED_CONSUMERS.has(entity))
  if (unknown.length) throw new Error(`Unknown SleepyPod target/HVAC consumers block cutover: ${unknown.join(', ')}.`)
}

function isRetiredFeedbackCall(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as HaRecord
  const data = record.data as HaRecord | undefined
  return record.action === HOT_FLASH_RETIRED_IDS[0]
    && Object.keys(record).sort().join(',') === 'action,data'
    && data !== undefined
    && Object.keys(data).join(',') === 'side'
    && (data.side === 'left' || data.side === 'right')
}

function withoutRetiredFeedbackCalls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isRetiredFeedbackCall(item))
      .map(withoutRetiredFeedbackCalls)
  }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as HaRecord)
    .map(([key, item]) => [key, withoutRetiredFeedbackCalls(item)]))
}

function assertOwnedNewObjects(managedBefore: Record<string, HaRecord | null>, managedAfter: Record<string, HaRecord>) {
  for (const id of HOT_FLASH_NEW_IDS) {
    const current = managedBefore[id]
    if (!current) continue
    const desired = managedAfter[id]
    const allowed = new Set([
      fingerprint(desired),
      ...(isAutomation(id) ? [fingerprint(staged(desired))] : []),
    ])
    if (!allowed.has(fingerprint(current))
      && !allowed.has(fingerprint(withoutRetiredFeedbackCalls(current)))) {
      throw new Error(`Managed object ${id} has unexpected configuration drift.`)
    }
  }
}

function assertRetiredConsumersOwned(
  consumers: Record<string, string[]>,
  managedAfter: Record<string, HaRecord>,
) {
  const unexpected = Object.keys(consumers).filter((id) => !Object.hasOwn(managedAfter, id))
  if (unexpected.length) {
    throw new Error(`Retired SleepyPod feedback still has unmanaged consumers: ${unexpected.join(', ')}.`)
  }
}

async function validateGenerated(client: HotFlashSyncClient, managedAfter: Record<string, HaRecord>) {
  for (const [id, config] of Object.entries(managedAfter)) await client.validateObject(id, config)
}

async function readProtectedConsumers(client: HotFlashSyncClient) {
  return Object.fromEntries(await Promise.all(HOT_FLASH_PROTECTED_CONSUMERS.map(async (id) => {
    const config = await client.getObject(id) ?? await client.loaded(id)
    if (!config) throw new Error(`Protected SleepyPod consumer ${id} is missing.`)
    return [id, config]
  })))
}

async function assertProtectedConsumers(client: HotFlashSyncClient, snapshot: HotFlashSnapshot) {
  for (const [id, expected] of Object.entries(snapshot.protectedConsumers)) {
    const current = await client.getObject(id) ?? await client.loaded(id)
    if (fingerprint(current) !== fingerprint(expected)) throw new Error(`Protected SleepyPod consumer ${id} changed during cutover.`)
  }
}

export async function hotFlashPlan(client: HotFlashSyncClient): Promise<HotFlashPlan> {
  const originalEntries = await Promise.all(HOT_FLASH_ORIGINALS.map(async (id) => [id, await client.getObject(id)] as const))
  const missing = originalEntries.filter(([, config]) => config === null).map(([id]) => id)
  if (missing.length) throw new Error(`Required live SleepyPod owners are missing: ${missing.join(', ')}.`)
  const originals = Object.fromEntries(originalEntries) as Record<string, HaRecord>
  const generated = hotFlashRecoveryConfig(requesterBindings(originals), originals)
  const managedAfter = generatedObjects(generated)
  const managedBefore = Object.fromEntries(await Promise.all(Object.keys(managedAfter).map(async (id) => [
    id,
    await client.getObject(id),
  ]))) as Record<string, HaRecord | null>
  const retiredBefore = Object.fromEntries(await Promise.all(HOT_FLASH_RETIRED_IDS.map(async (id) => [
    id,
    await client.getObject(id),
  ]))) as Record<string, HaRecord | null>
  assertOwnedNewObjects(managedBefore, managedAfter)
  assertOwnedRetiredObjects(retiredBefore)
  assertRetiredObjectsUnreferenced(managedAfter)
  await validateGenerated(client, managedAfter)
  const retiredConsumersBefore = await client.findConsumers(HOT_FLASH_RETIRED_IDS)
  assertRetiredConsumersOwned(retiredConsumersBefore, managedAfter)
  const originalEnabled = Object.fromEntries(await Promise.all(HOT_FLASH_ORIGINALS
    .filter(isAutomation)
    .map(async (id) => [id, await client.getEnabled(id)]))) as Record<string, boolean>
  const managedEnabledBefore = Object.fromEntries(await Promise.all(Object.keys(managedAfter)
    .filter(isAutomation)
    .map(async (id) => [id, await client.getEnabled(id)]))) as Record<string, boolean>
  const helpersBefore = await readHelpers(client)
  for (const helper of hotFlashHelpers) {
    const current = helpersBefore[helperEntity(helper)]
    if (current && !helperMatches(current, helper)) throw new Error(`Helper ${helperEntity(helper)} has unexpected configuration drift.`)
  }
  const helperStatesBefore = await readStates(client, hotFlashHelpers.map(helperEntity))
  const lifecycleBefore = await readStates(client, [
    ...LEGACY_LIFECYCLE_ENTITIES,
    ...MANAGED_LIFECYCLE_ENTITIES,
    ...REQUIRED_DEVICE_ENTITIES,
  ], false)
  const consumersBefore = await client.findConsumers([
    ...Object.values(HOT_FLASH.sides).flatMap((entry) => [entry.climate, entry.target]),
  ])
  assertConsumers(consumersBefore)
  const protectedConsumers = await readProtectedConsumers(client)
  const changes = [
    ...Object.entries(managedAfter)
      .filter(([id, desired]) => fingerprint(managedBefore[id]) !== fingerprint(desired))
      .map(([id]) => `${managedBefore[id] ? 'Update' : 'Create'} ${id}`),
    ...HOT_FLASH_RETIRED_IDS
      .filter((id) => retiredBefore[id] !== null)
      .map((id) => `Remove ${id}`),
    ...hotFlashHelpers
      .filter((helper) => !helpersBefore[helperEntity(helper)])
      .map((helper) => `Create ${helperEntity(helper)}`),
    ...HOT_FLASH_MANAGED_AUTOMATIONS
      .filter((id) => managedEnabledBefore[id] !== true)
      .map((id) => `Enable ${id}`),
  ]
  const snapshot: HotFlashSnapshot = {
    version: 4,
    originals,
    originalEnabled,
    managedBefore,
    managedEnabledBefore,
    retiredBefore,
    retiredConsumersBefore,
    helpersBefore,
    helperStatesBefore,
    lifecycleBefore,
    consumersBefore,
    protectedConsumers,
    managedAfter,
    helperDefinitions: hotFlashHelpers,
  }
  return {
    fingerprint: fingerprint({ snapshot, changes }),
    requesterBindingConfigured: true,
    ready: changes.length === 0,
    changes,
    snapshot,
    generated,
  }
}

function stateValue(snapshot: Record<string, HotFlashState | null>, entity: string) {
  return snapshot[entity]?.state ?? 'missing'
}

function assertQuiescent(plan: HotFlashPlan) {
  const lifecycle = plan.snapshot.lifecycleBefore
  for (const entity of [HOT_FLASH.legacy.leftActive, HOT_FLASH.legacy.rightActive]) {
    if (stateValue(lifecycle, entity) !== 'off') throw new Error(`Hot Flash cutover blocked: ${entity} is active.`)
  }
  for (const entity of ['timer.eight_sleep_stephen_hot_flash', 'timer.eight_sleep_steph_hot_flash']) {
    if (stateValue(lifecycle, entity) !== 'idle') throw new Error(`Hot Flash cutover blocked: ${entity} is not idle.`)
  }
  for (const entity of MANAGED_LIFECYCLE_ENTITIES) {
    const value = stateValue(lifecycle, entity)
    if (!['missing', 'unavailable', 'idle'].includes(value)) {
      throw new Error(`Hot Flash cutover blocked: ${entity} contains unresolved managed state ${value}.`)
    }
  }
  for (const entity of REQUIRED_DEVICE_ENTITIES) {
    const value = stateValue(lifecycle, entity)
    if (['missing', 'unknown', 'unavailable'].includes(value)) {
      throw new Error(`Hot Flash cutover blocked: required entity ${entity} is unavailable.`)
    }
  }
  const leftMode = stateValue(lifecycle, HOT_FLASH.sides.left.climate)
  const rightMode = stateValue(lifecycle, HOT_FLASH.sides.right.climate)
  if (leftMode !== rightMode || !['heat', 'off'].includes(leftMode)) {
    throw new Error('Hot Flash cutover blocked: bed-wide climate state is not coherent heat or off.')
  }
}

async function requireFreshPlan(client: HotFlashSyncClient, expected: string) {
  const plan = await hotFlashPlan(client)
  if (plan.fingerprint !== expected) throw new Error('Hot Flash live configuration, state, or consumers changed after planning.')
  assertQuiescent(plan)
  return plan
}

async function waitForLoaded(
  client: HotFlashSyncClient,
  id: string,
  desired: HaRecord,
  enabled?: boolean,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs
  do {
    const loaded = await client.loaded(id)
    const enabledMatches = !isAutomation(id) || enabled === undefined || await client.getEnabled(id) === enabled
    if (fingerprint(loaded) === fingerprint(desired) && enabledMatches) return
    if (Date.now() >= deadline) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  } while (Date.now() <= deadline)
  throw new Error(`Loaded runtime ${id} did not reach the verified target.`)
}

async function setChecked(
  client: HotFlashSyncClient,
  id: string,
  before: HaRecord | null,
  after: HaRecord,
  enabled?: boolean,
) {
  if (fingerprint(await client.getObject(id)) !== fingerprint(before)) {
    throw new Error(`Hot Flash object ${id} changed immediately before its write.`)
  }
  if (fingerprint(before) !== fingerprint(after)) await client.setObject(id, after)
  if (isAutomation(id) && enabled !== undefined) await client.setEnabled(id, enabled)
  if (fingerprint(await client.getObject(id)) !== fingerprint(after)) throw new Error(`Hot Flash object ${id} did not round-trip after write.`)
}

async function verifyHelpers(client: HotFlashSyncClient) {
  const current = await readHelpers(client)
  for (const helper of hotFlashHelpers) {
    if (!helperMatches(current[helperEntity(helper)], helper)) throw new Error(`Hot Flash helper ${helperEntity(helper)} failed verification.`)
  }
}

async function waitForHelperEntity(client: HotFlashSyncClient, entity: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  do {
    if (await client.getState(entity, true)) return
    if (Date.now() >= deadline) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  } while (Date.now() <= deadline)
  throw new Error(`Hot Flash helper entity ${entity} did not become available after creation.`)
}

async function installHelpers(client: HotFlashSyncClient, snapshot: HotFlashSnapshot) {
  for (const helper of hotFlashHelpers) {
    const entity = helperEntity(helper)
    if (!snapshot.helpersBefore[entity]) {
      if ((await client.listHelpers(helper.domain)).some((entry) => entry.id === helper.id)) {
        throw new Error(`Hot Flash helper ${entity} appeared after planning.`)
      }
      const createdId = await client.createHelper(helper)
      if (createdId !== helper.id) {
        await client.removeHelper({ ...helper, id: createdId })
        throw new Error(`Home Assistant generated ${helper.domain}.${createdId} instead of ${entity}.`)
      }
      await waitForHelperEntity(client, entity)
      await client.initializeHelper(helper)
      await waitForHelperEntity(client, entity)
    }
  }
  await client.persistStates()
  await verifyHelpers(client)
}

async function verifyConsumers(client: HotFlashSyncClient) {
  const consumers = await client.findConsumers(Object.values(HOT_FLASH.sides).flatMap((entry) => [entry.climate, entry.target]))
  assertConsumers(consumers)
}

function allowedRollbackFingerprints(snapshot: HotFlashSnapshot, id: string) {
  const desired = snapshot.managedAfter[id]
  return new Set([
    fingerprint(snapshot.managedBefore[id]),
    fingerprint(desired),
    ...(desired && isAutomation(id) ? [fingerprint(staged(desired))] : []),
  ])
}

async function assertRollbackOwned(client: HotFlashSyncClient, snapshot: HotFlashSnapshot) {
  for (const id of Object.keys(snapshot.managedAfter)) {
    const actual = fingerprint(await client.getObject(id))
    if (!allowedRollbackFingerprints(snapshot, id).has(actual)) {
      throw new Error(`Hot Flash rollback drift check failed for ${id}.`)
    }
  }
  for (const id of HOT_FLASH_RETIRED_IDS) {
    const actual = fingerprint(await client.getObject(id))
    const allowed = new Set([
      fingerprint(snapshot.retiredBefore[id]),
      fingerprint(null),
    ])
    if (!allowed.has(actual)) throw new Error(`Hot Flash rollback drift check failed for ${id}.`)
  }
  const helpers = await readHelpers(client)
  for (const helper of hotFlashHelpers) {
    const entity = helperEntity(helper)
    const actual = helpers[entity]
    const before = snapshot.helpersBefore[entity]
    if (fingerprint(actual) !== fingerprint(before) && !helperMatches(actual, helper)) {
      throw new Error(`Hot Flash rollback drift check failed for ${entity}.`)
    }
  }
}

async function retireManagedObjects(client: HotFlashSyncClient, snapshot: HotFlashSnapshot) {
  const consumers = await client.findConsumers(HOT_FLASH_RETIRED_IDS)
  if (Object.keys(consumers).length) {
    throw new Error(`Retired SleepyPod feedback is still referenced by ${Object.keys(consumers).join(', ')}.`)
  }
  let removed = false
  for (const id of HOT_FLASH_RETIRED_IDS) {
    const before = snapshot.retiredBefore[id]
    if (!before) continue
    if (fingerprint(await client.getObject(id)) !== fingerprint(before)) {
      throw new Error(`Retired managed object ${id} changed immediately before deletion.`)
    }
    await client.removeObject(id)
    removed = true
  }
  return removed
}

async function verifyRetiredObjectsAbsent(client: HotFlashSyncClient) {
  for (const id of HOT_FLASH_RETIRED_IDS) {
    if (await client.getObject(id)) throw new Error(`Retired managed object ${id} still exists in stored configuration.`)
    if (await client.loaded(id)) throw new Error(`Retired managed object ${id} is still loaded.`)
  }
  const consumers = await client.findConsumers(HOT_FLASH_RETIRED_IDS)
  if (Object.keys(consumers).length) {
    throw new Error(`Retired SleepyPod feedback still has consumers: ${Object.keys(consumers).join(', ')}.`)
  }
}

export async function hotFlashStage(
  client: HotFlashSyncClient,
  expected: string,
  saveSnapshot: (snapshot: HotFlashSnapshot) => Promise<void>,
) {
  const plan = await requireFreshPlan(client, expected)
  await saveSnapshot(plan.snapshot)
  try {
    await assertProtectedConsumers(client, plan.snapshot)
    await installHelpers(client, plan.snapshot)
    const stageIds = [...HOT_FLASH_STAGE_IDS].filter((id) => plan.snapshot.managedBefore[id] === null)
    for (const id of stageIds) {
      const desired = plan.snapshot.managedAfter[id]
      const stagedConfig = isAutomation(id) ? staged(desired) : desired
      await setChecked(client, id, plan.snapshot.managedBefore[id], stagedConfig, isAutomation(id) ? false : undefined)
    }
    await client.reload()
    for (const id of stageIds) {
      const desired = plan.snapshot.managedAfter[id]
      const stagedConfig = isAutomation(id) ? staged(desired) : desired
      await waitForLoaded(client, id, stagedConfig, isAutomation(id) ? false : undefined)
    }
    await client.validateCore()
    await assertProtectedConsumers(client, plan.snapshot)
    await verifyConsumers(client)
    return await hotFlashPlan(client)
  } catch (error) {
    try {
      await hotFlashRollback(client, plan.snapshot)
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Hot Flash staging failed and verified rollback also failed.', { cause: rollbackError })
    }
    throw error
  }
}

export async function hotFlashActivate(
  client: HotFlashSyncClient,
  expected: string,
  rollbackSnapshot: HotFlashSnapshot,
) {
  const plan = await requireFreshPlan(client, expected)
  if (rollbackSnapshot.version !== 4) throw new Error('Activation requires the version 4 pre-stage rollback snapshot.')
  try {
    await assertProtectedConsumers(client, plan.snapshot)
    for (const id of HOT_FLASH_MANAGED_AUTOMATIONS) await client.setEnabled(id, false)
    await client.persistStates()
    for (const [id, desired] of Object.entries(plan.snapshot.managedAfter)) {
      await setChecked(client, id, plan.snapshot.managedBefore[id], desired, isAutomation(id) ? false : undefined)
    }
    await client.reload()
    for (const [id, desired] of Object.entries(plan.snapshot.managedAfter)) {
      await waitForLoaded(client, id, desired, isAutomation(id) ? false : undefined)
    }
    if (await retireManagedObjects(client, plan.snapshot)) await client.reload()
    await verifyRetiredObjectsAbsent(client)
    await client.validateCore()
    await assertProtectedConsumers(client, plan.snapshot)
    await verifyConsumers(client)
    for (const id of HOT_FLASH_MANAGED_AUTOMATIONS) await client.setEnabled(id, true)
    await client.persistStates()
    for (const id of HOT_FLASH_MANAGED_AUTOMATIONS) {
      await waitForLoaded(client, id, plan.snapshot.managedAfter[id], true)
    }
    await client.reconcile()
    return await hotFlashVerify(client)
  } catch (error) {
    try {
      await hotFlashRollback(client, rollbackSnapshot)
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Hot Flash activation failed and verified rollback also failed.', { cause: rollbackError })
    }
    throw error
  }
}

export async function hotFlashVerify(client: HotFlashSyncClient) {
  const plan = await hotFlashPlan(client)
  if (!plan.ready) throw new Error('Hot Flash managed configuration is not fully active.')
  await verifyHelpers(client)
  await verifyConsumers(client)
  for (const [id, desired] of Object.entries(plan.snapshot.managedAfter)) {
    await waitForLoaded(client, id, desired, isAutomation(id) ? true : undefined)
  }
  await verifyRetiredObjectsAbsent(client)
  for (const entity of MANAGED_LIFECYCLE_ENTITIES) {
    const value = (await client.getState(entity))?.state
    if (value !== 'idle') throw new Error(`Hot Flash lifecycle ${entity} is not idle after verification.`)
  }
  return plan
}

export async function hotFlashRollback(client: HotFlashSyncClient, snapshot: HotFlashSnapshot) {
  if (snapshot.version !== 4) throw new Error('Unsupported Hot Flash rollback snapshot.')
  await assertRollbackOwned(client, snapshot)
  await assertProtectedConsumers(client, snapshot)
  const errors: Error[] = []
  const attempt = async (label: string, action: () => Promise<void>) => {
    try {
      await action()
    } catch (error) {
      errors.push(new Error(`${label}: ${error instanceof Error ? error.message : 'operation failed'}`, { cause: error }))
    }
  }
  for (const id of HOT_FLASH_MANAGED_AUTOMATIONS) {
    await attempt(`Disable ${id}`, async () => {
      if (await client.getObject(id)) await client.setEnabled(id, false)
    })
  }
  await attempt('Persist disabled automation states', () => client.persistStates())
  for (const [id, before] of Object.entries(snapshot.managedBefore)) {
    await attempt(`Restore stored object ${id}`, async () => {
      if (before === null) await client.removeObject(id)
      else await client.setObject(id, before)
    })
  }
  for (const [id, before] of Object.entries(snapshot.retiredBefore)) {
    await attempt(`Restore retired object ${id}`, async () => {
      if (before === null) await client.removeObject(id)
      else await client.setObject(id, before)
    })
  }
  for (const helper of hotFlashHelpers) {
    const entity = helperEntity(helper)
    const before = snapshot.helpersBefore[entity]
    await attempt(`Restore helper ${entity}`, async () => {
      if (before === null) {
        if ((await client.listHelpers(helper.domain)).some((entry) => entry.id === helper.id)) await client.removeHelper(helper)
        return
      }
      await client.updateHelper({ ...helper, config: before })
      const stateBefore = snapshot.helperStatesBefore[entity]
      if (stateBefore) await client.restoreHelperState(helper, stateBefore)
    })
  }
  await attempt('Reload Home Assistant configuration', () => client.reload())
  for (const [id, before] of Object.entries(snapshot.managedBefore)) {
    await attempt(`Verify restored object ${id}`, async () => {
      if (before === null) {
        if (await client.getObject(id)) throw new Error(`Rollback failed to remove ${id}.`)
        return
      }
      if (fingerprint(await client.getObject(id)) !== fingerprint(before)) throw new Error(`Rollback failed to restore stored ${id}.`)
      await waitForLoaded(client, id, before)
    })
  }
  for (const [id, before] of Object.entries(snapshot.retiredBefore)) {
    await attempt(`Verify restored retired object ${id}`, async () => {
      if (before === null) {
        if (await client.getObject(id)) throw new Error(`Rollback failed to remove ${id}.`)
        if (await client.loaded(id)) throw new Error(`Rollback failed to unload ${id}.`)
        return
      }
      if (fingerprint(await client.getObject(id)) !== fingerprint(before)) {
        throw new Error(`Rollback failed to restore retired object ${id}.`)
      }
      await waitForLoaded(client, id, before)
    })
  }
  for (const [id, enabled] of Object.entries(snapshot.managedEnabledBefore)) {
    await attempt(`Restore automation enablement ${id}`, async () => {
      if (snapshot.managedBefore[id] && isAutomation(id)) await client.setEnabled(id, enabled)
    })
  }
  await attempt('Persist restored automation states', () => client.persistStates())
  for (const [id, enabled] of Object.entries(snapshot.managedEnabledBefore)) {
    await attempt(`Verify automation enablement ${id}`, async () => {
      if (snapshot.managedBefore[id] && isAutomation(id)) await waitForLoaded(client, id, snapshot.managedBefore[id]!, enabled)
    })
  }
  await attempt('Verify restored helper definitions', async () => {
    const helpers = await readHelpers(client)
    for (const helper of hotFlashHelpers) {
      const entity = helperEntity(helper)
      if (fingerprint(helpers[entity]) !== fingerprint(snapshot.helpersBefore[entity])) {
        throw new Error(`Rollback failed to restore helper definition ${entity}.`)
      }
    }
  })
  await attempt('Validate Home Assistant core configuration', () => client.validateCore())
  await attempt('Verify protected consumers', () => assertProtectedConsumers(client, snapshot))
  if (errors.length) throw new AggregateError(errors, 'Hot Flash rollback completed with failures.')
}
