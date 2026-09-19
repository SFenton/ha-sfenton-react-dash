import { describe, expect, it, vi } from 'vitest'
import {
  HOT_FLASH,
  HOT_FLASH_TARGET_WRAPPERS,
  hotFlashRecoveryConfig,
  type HaRecord,
} from './hotFlashRecoveryConfig'
import {
  HOT_FLASH_MANAGED_AUTOMATIONS,
  HOT_FLASH_NEW_IDS,
  HOT_FLASH_ORIGINALS,
  HOT_FLASH_RETIRED_IDS,
  hotFlashActivate,
  hotFlashPlan,
  hotFlashRollback,
  hotFlashStage,
  type HotFlashState,
  type HotFlashSyncClient,
} from './hotFlashRecoverySync'
import { HotFlashApiClient } from '../sync-hot-flash-recovery'

// @covers scripts/sync-hot-flash-recovery.ts
const REQUESTERS = { left: 'sanitized-left-requester', right: 'sanitized-right-requester' }
const RETIRED_FEEDBACK = HOT_FLASH_RETIRED_IDS[0]

function retiredFeedbackObject(): HaRecord {
  return {
    alias: 'SleepyPod temperature command feedback',
    mode: 'queued',
    sequence: [{
      action: 'mqtt.publish',
      data: {
        topic: 'sleepypod/eight-pod/cmd/set-alarm',
        payload: '{"side":"left","vibrationPattern":"double","duration":10}',
      },
    }],
  }
}

function brokerWithRetiredFeedback(): HaRecord {
  const broker = structuredClone(hotFlashRecoveryConfig(REQUESTERS).broker)
  let inserted = 0
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index]
        if (item && typeof item === 'object') {
          const record = item as HaRecord
          const target = record.target as HaRecord | undefined
          const data = record.data as HaRecord | undefined
          if (record.action === 'number.set_value'
            && data?.value === '{{ requested_level }}'
            && (target?.entity_id === HOT_FLASH.sides.left.target || target?.entity_id === HOT_FLASH.sides.right.target)) {
            value.splice(index + 1, 0, {
              action: RETIRED_FEEDBACK,
              data: { side: target.entity_id === HOT_FLASH.sides.left.target ? 'left' : 'right' },
            })
            inserted += 1
            index += 1
          }
        }
        visit(item)
      }
      return
    }
    if (!value || typeof value !== 'object') return
    for (const item of Object.values(value as HaRecord)) visit(item)
  }
  visit(broker)
  if (inserted !== 2) throw new Error(`Expected two retired feedback calls, inserted ${inserted}.`)
  return broker
}

function originalWrapper(id: string): HaRecord {
  const wrapper = HOT_FLASH_TARGET_WRAPPERS.find((candidate) => candidate.id === id)
  if (!wrapper) throw new Error(`Unknown wrapper ${id}`)
  const schedule = HOT_FLASH.sides[wrapper.side].schedulePhase
  const guard = wrapper.phase === 'tonight'
    ? { condition: 'state', entity_id: schedule, state: ['bedtime', 'asleep', 'dawn'] }
    : wrapper.phase === 'outside_schedule'
      ? { condition: 'state', entity_id: schedule, state: 'outside' }
      : { condition: 'state', entity_id: schedule, state: wrapper.phase }
  const recurring = wrapper.phase === 'tonight' || wrapper.phase === 'outside_schedule'
    ? []
    : [{
        action: 'input_number.set_value',
        target: { entity_id: `input_number.eight_sleep_${wrapper.owner}_${wrapper.phase}_level` },
        data: { value: '{{ level }}' },
      }]
  return {
    alias: `Legacy ${id}`,
    mode: 'restart',
    fields: { level: { required: true } },
    sequence: [
      guard,
      ...recurring,
      {
        action: 'number.set_value',
        target: { entity_id: HOT_FLASH.sides[wrapper.side].target },
        data: { value: '{{ level }}' },
      },
    ],
  }
}

function originalObjects() {
  const generated = hotFlashRecoveryConfig(REQUESTERS)
  const owners = Object.fromEntries(generated.automations
    .filter((automation) => String(automation.id).startsWith('eight_sleep_'))
    .map((automation) => [`automation.${String(automation.id)}`, { ...automation, description: 'Legacy owner' }]))
  return {
    ...owners,
    'automation.sleepypod_bed_stage_schedules_to_mqtt': {
      id: 'sleepypod_bed_stage_schedules_to_mqtt',
      alias: 'Protected schedule publisher',
      triggers: [],
      conditions: [],
      actions: [],
    },
    'script.household_away_command': {
      alias: 'Protected household away command',
      mode: 'queued',
      sequence: [],
    },
    [RETIRED_FEEDBACK]: retiredFeedbackObject(),
    ...Object.fromEntries(HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => [
      `script.${wrapper.id}`,
      originalWrapper(wrapper.id),
    ])),
  } as Record<string, HaRecord>
}

function defaultStates(): Record<string, HotFlashState> {
  const state = (value: string, attributes: HaRecord = {}): HotFlashState => ({ state: value, attributes })
  return {
    [HOT_FLASH.legacy.leftActive]: state('off'),
    [HOT_FLASH.legacy.rightActive]: state('off'),
    'timer.eight_sleep_stephen_hot_flash': state('idle'),
    'timer.eight_sleep_steph_hot_flash': state('idle'),
    [HOT_FLASH.sides.left.climate]: state('heat'),
    [HOT_FLASH.sides.right.climate]: state('heat'),
    [HOT_FLASH.sides.left.target]: state('2'),
    [HOT_FLASH.sides.right.target]: state('1'),
  }
}

interface TestClient extends HotFlashSyncClient {
  enabled: Map<string, boolean>
  helperStore: Map<string, HaRecord>
  objects: Map<string, HaRecord | null>
  states: Map<string, HotFlashState>
  writes: string[]
  failInitializeHelperId?: string
  failRemoveHelperId?: string
  failRemoveObjectId?: string
  failSetObjectId?: string
  failValidateCore?: boolean
  generatedHelperId?: string
  helperRegistrationDelayId?: string
  helperRegistrationDelayReads?: number
}

function client(options: {
  consumers?: Record<string, string[]>
  objects?: Record<string, HaRecord>
  states?: Record<string, HotFlashState>
} = {}): TestClient {
  const objects = new Map<string, HaRecord | null>(Object.entries(options.objects ?? originalObjects()))
  const helperStore = new Map<string, HaRecord>()
  const states = new Map<string, HotFlashState>(Object.entries({ ...defaultStates(), ...(options.states ?? {}) }))
  const enabled = new Map<string, boolean>()
  const pendingHelperStates = new Map<string, number>()
  for (const id of HOT_FLASH_ORIGINALS) if (id.startsWith('automation.')) enabled.set(id, true)
  const writes: string[] = []
  const consumers = options.consumers ?? Object.fromEntries([
    ...HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => [`script.${wrapper.id}`, [HOT_FLASH.sides[wrapper.side].target]]),
    ['automation.eight_sleep_stephen_hot_flash_mode', [HOT_FLASH.sides.left.target, HOT_FLASH.sides.left.climate]],
    ['automation.eight_sleep_steph_hot_flash_mode', [HOT_FLASH.sides.right.target, HOT_FLASH.sides.right.climate]],
  ])
  const api: TestClient = {
    objects,
    helperStore,
    states,
    enabled,
    writes,
    async getObject(id) { return objects.get(id) ?? null },
    async getEnabled(id) { return enabled.get(id) ?? false },
    async setObject(id, config) {
      writes.push(`set:${id}`)
      if (api.failSetObjectId === id) {
        api.failSetObjectId = undefined
        throw new Error(`Injected set failure for ${id}`)
      }
      objects.set(id, structuredClone(config))
    },
    async removeObject(id) {
      writes.push(`remove:${id}`)
      if (api.failRemoveObjectId === id) {
        api.failRemoveObjectId = undefined
        throw new Error(`Injected remove failure for ${id}`)
      }
      objects.delete(id)
      enabled.delete(id)
    },
    async setEnabled(id, value) {
      writes.push(`enabled:${id}:${value}`)
      enabled.set(id, value)
    },
    async listHelpers(domain) {
      return [...helperStore.entries()]
        .filter(([id]) => id.startsWith(`${domain}.`))
        .map(([, config]) => structuredClone(config))
    },
    async createHelper(helper) {
      const id = api.generatedHelperId ?? helper.id
      writes.push(`create-helper:${helper.domain}.${id}`)
      const config = structuredClone(helper.config)
      if (helper.domain === 'timer' && config.duration === '00:15:00') config.duration = '0:15:00'
      const entity = `${helper.domain}.${id}`
      helperStore.set(entity, { id, ...config })
      if (api.helperRegistrationDelayId === entity) {
        pendingHelperStates.set(entity, api.helperRegistrationDelayReads ?? 1)
      } else {
        states.set(entity, { state: 'unknown', attributes: {} })
      }
      return id
    },
    async updateHelper(helper) {
      writes.push(`update-helper:${helper.domain}.${helper.id}`)
      helperStore.set(`${helper.domain}.${helper.id}`, { id: helper.id, ...structuredClone(helper.config) })
    },
    async initializeHelper(helper) {
      const entity = `${helper.domain}.${helper.id}`
      writes.push(`initialize:${entity}`)
      if (api.failInitializeHelperId === entity) {
        api.failInitializeHelperId = undefined
        throw new Error(`Injected initialization failure for ${entity}`)
      }
      const value = helper.domain === 'input_select'
        ? String((helper.config.options as string[])[0])
        : helper.domain === 'timer'
          ? 'idle'
          : helper.domain === 'input_datetime'
            ? '1970-01-01 00:00:00'
            : '0'
      states.set(entity, { state: value, attributes: helper.domain === 'input_datetime' ? { timestamp: 0 } : {} })
    },
    async restoreHelperState(helper, helperState) {
      writes.push(`restore-state:${helper.domain}.${helper.id}`)
      states.set(`${helper.domain}.${helper.id}`, structuredClone(helperState))
    },
    async removeHelper(helper) {
      const entity = `${helper.domain}.${helper.id}`
      writes.push(`remove-helper:${entity}`)
      if (api.failRemoveHelperId === entity) {
        api.failRemoveHelperId = undefined
        throw new Error(`Injected helper removal failure for ${entity}`)
      }
      helperStore.delete(entity)
      states.delete(entity)
    },
    async validateObject(id) { writes.push(`validate:${id}`) },
    async loaded(id) { return objects.get(id) ?? null },
    async reload() { writes.push('reload') },
    async reconcile() { writes.push('reconcile') },
    async persistStates() { writes.push('persist') },
    async validateCore() {
      writes.push('validate-core')
      if (api.failValidateCore) {
        api.failValidateCore = false
        throw new Error('Injected core validation failure')
      }
    },
    async getState(id, allowMissing = false) {
      const pendingReads = pendingHelperStates.get(id)
      if (pendingReads !== undefined) {
        if (pendingReads <= 1) {
          pendingHelperStates.delete(id)
          states.set(id, { state: 'unknown', attributes: {} })
        } else {
          pendingHelperStates.set(id, pendingReads - 1)
          return allowMissing ? null : { state: 'unavailable', attributes: {} }
        }
      }
      const current = states.get(id)
      if (current) return structuredClone(current)
      return allowMissing ? null : { state: 'unavailable', attributes: {} }
    },
    async findConsumers(needles) {
      if (needles.some((needle) => HOT_FLASH_RETIRED_IDS.includes(needle as typeof RETIRED_FEEDBACK))) {
        return Object.fromEntries([...objects.entries()]
          .filter(([, config]) => config && needles.some((needle) => JSON.stringify(config).includes(needle)))
          .map(([id]) => [id, [...needles]]))
      }
      return structuredClone(consumers)
    },
  }
  return api
}

describe('SleepyPod Hot Flash sync lifecycle', () => {
  it('initializes an input number without evaluating input-select-only configuration', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await new HotFlashApiClient('http://homeassistant.local', 'test-token').initializeHelper({
        domain: 'input_number',
        id: 'sleepypod_hot_flash_left_target_payload',
        config: { min: -10, max: 10 },
      })
    } finally {
      vi.unstubAllGlobals()
    }
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      entity_id: 'input_number.sleepypod_hot_flash_left_target_payload',
      value: 0,
    })
  })

  it('treats an already absent managed script as an idempotent removal', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await new HotFlashApiClient('http://homeassistant.local', 'test-token')
        .removeObject('script.sleepypod_hot_flash_broker')
    } finally {
      vi.unstubAllGlobals()
    }
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET')
  })

  it('plans all fresh owners, transforms ten wrappers, validates every destination, and performs no mutations', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    expect(HOT_FLASH_ORIGINALS).toHaveLength(13)
    expect(Object.keys(plan.snapshot.originals)).toHaveLength(13)
    expect(plan.generated.helpers).toHaveLength(11)
    expect(plan.requesterBindingConfigured).toBe(true)
    expect(plan.snapshot.version).toBe(4)
    expect(Object.keys(plan.snapshot.managedAfter)).toEqual(expect.arrayContaining([
      HOT_FLASH.broker,
      'automation.sleepypod_hot_flash_state_reconciler',
      'automation.sleepypod_hot_flash_startup_followup',
      'automation.eight_sleep_stephen_hot_flash_mode',
      'automation.eight_sleep_steph_hot_flash_mode',
    ]))
    expect(plan.snapshot.managedAfter).not.toHaveProperty(RETIRED_FEEDBACK)
    expect(plan.snapshot.retiredBefore[RETIRED_FEEDBACK]).toEqual(retiredFeedbackObject())
    expect(plan.snapshot.retiredConsumersBefore).toEqual({})
    expect(plan.changes).toContain(`Remove ${RETIRED_FEEDBACK}`)
    expect(api.writes.filter((write) => write.startsWith('validate:'))).toHaveLength(Object.keys(plan.snapshot.managedAfter).length)
    expect(api.writes.some((write) => /^(set|remove|enabled|create-helper|initialize):/.test(write))).toBe(false)
  })

  it('blocks an unknown target or HVAC consumer before any mutation', async () => {
    const api = client({
      consumers: {
        'automation.unknown_sleepypod_writer': [HOT_FLASH.sides.left.target],
      },
    })
    await expect(hotFlashPlan(api)).rejects.toThrow(/Unknown SleepyPod target\/HVAC consumers/)
    expect(api.writes.some((write) => write.startsWith('set:'))).toBe(false)
  })

  it('stages only new owners, creates and initializes exactly eleven helpers, and keeps legacy owners live', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    let saved = false
    const stagedPlan = await hotFlashStage(api, plan.fingerprint, async () => { saved = true })

    expect(saved).toBe(true)
    expect(api.writes.filter((write) => write.startsWith('create-helper:'))).toHaveLength(11)
    expect(api.writes.filter((write) => write.startsWith('initialize:'))).toHaveLength(11)
    expect(api.writes.filter((write) => write.startsWith('set:')).map((write) => write.slice(4)).sort()).toEqual([...HOT_FLASH_NEW_IDS].sort())
    expect(api.writes).not.toContain(`remove:${RETIRED_FEEDBACK}`)
    expect(api.objects.get(RETIRED_FEEDBACK)).toEqual(retiredFeedbackObject())
    expect(api.writes).not.toContain('set:automation.eight_sleep_stephen_hot_flash_mode')
    expect(api.enabled.get('automation.eight_sleep_stephen_hot_flash_mode')).toBe(true)
    expect(api.enabled.get('automation.sleepypod_hot_flash_state_reconciler')).toBe(false)
    expect(stagedPlan.ready).toBe(false)
  })

  it('accepts the known feedback-only broker revision and defers its update until activation', async () => {
    const objects = originalObjects()
    objects[HOT_FLASH.broker] = brokerWithRetiredFeedback()
    const api = client({ objects })
    const before = await hotFlashPlan(api)

    expect(before.changes).toEqual(expect.arrayContaining([
      `Update ${HOT_FLASH.broker}`,
      `Remove ${RETIRED_FEEDBACK}`,
    ]))
    expect(before.snapshot.retiredConsumersBefore).toEqual({
      [HOT_FLASH.broker]: [RETIRED_FEEDBACK],
    })

    const stagedPlan = await hotFlashStage(api, before.fingerprint, async () => undefined)
    expect(api.writes).not.toContain(`set:${HOT_FLASH.broker}`)
    expect(api.objects.get(HOT_FLASH.broker)).toEqual(before.snapshot.managedBefore[HOT_FLASH.broker])

    await hotFlashActivate(api, stagedPlan.fingerprint, before.snapshot)
    expect(api.objects.get(HOT_FLASH.broker)).toEqual(before.snapshot.managedAfter[HOT_FLASH.broker])
    expect(api.objects.get(RETIRED_FEEDBACK) ?? null).toBeNull()
  })

  it('rejects unrelated drift in a broker that still contains the retired feedback call', async () => {
    const objects = originalObjects()
    objects[HOT_FLASH.broker] = {
      ...brokerWithRetiredFeedback(),
      description: 'Unexpected local edit',
    }
    const api = client({ objects })

    await expect(hotFlashPlan(api)).rejects.toThrow(/Managed object .* unexpected configuration drift/)
  })

  it('blocks retirement while an unmanaged object still calls the feedback script', async () => {
    const objects = originalObjects()
    objects['script.unmanaged_feedback_caller'] = {
      alias: 'Unmanaged feedback caller',
      sequence: [{ action: RETIRED_FEEDBACK, data: { side: 'left' } }],
    }
    const api = client({ objects })

    await expect(hotFlashPlan(api)).rejects.toThrow(/feedback still has unmanaged consumers/)
    expect(api.writes.some((write) => /^(set|remove):/.test(write))).toBe(false)
  })

  it('activates from a staged fingerprint, verifies loaded runtime, and reconciles once', async () => {
    const api = client()
    const before = await hotFlashPlan(api)
    let rollbackSnapshot = before.snapshot
    const stagedPlan = await hotFlashStage(api, before.fingerprint, async (snapshot) => { rollbackSnapshot = snapshot })
    const active = await hotFlashActivate(api, stagedPlan.fingerprint, rollbackSnapshot)

    expect(active.ready).toBe(true)
    expect(api.writes).toContain('reconcile')
    for (const id of HOT_FLASH_MANAGED_AUTOMATIONS) expect(api.enabled.get(id)).toBe(true)
    for (const wrapper of HOT_FLASH_TARGET_WRAPPERS) {
      const config = api.objects.get(`script.${wrapper.id}`)
      expect(JSON.stringify(config)).toContain(HOT_FLASH.broker)
    }
    expect(api.objects.get(RETIRED_FEEDBACK) ?? null).toBeNull()
    const removeIndex = api.writes.indexOf(`remove:${RETIRED_FEEDBACK}`)
    const wrapperSetIndex = api.writes.findLastIndex((write) => write === 'set:script.sleepypod_stephen_temperature_tonight')
    const reloadBeforeRemoval = api.writes.findLastIndex((write, index) => write === 'reload' && index < removeIndex)
    const reloadAfterRemoval = api.writes.findIndex((write, index) => write === 'reload' && index > removeIndex)
    expect(wrapperSetIndex).toBeGreaterThanOrEqual(0)
    expect(reloadBeforeRemoval).toBeGreaterThan(wrapperSetIndex)
    expect(removeIndex).toBeGreaterThan(reloadBeforeRemoval)
    expect(reloadAfterRemoval).toBeGreaterThan(removeIndex)
    expect(api.writes).toContain('validate-core')
  })

  it('blocks active legacy state before helper or object writes', async () => {
    const api = client({
      states: {
        [HOT_FLASH.legacy.leftActive]: { state: 'on', attributes: {} },
      },
    })
    const plan = await hotFlashPlan(api)
    await expect(hotFlashStage(api, plan.fingerprint, async () => undefined)).rejects.toThrow(/is active/)
    expect(api.writes.some((write) => write.startsWith('create-helper:'))).toBe(false)
  })

  it('rolls back a partial staging failure and removes only objects and helpers created by the transaction', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    api.failSetObjectId = HOT_FLASH_NEW_IDS[1]
    await expect(hotFlashStage(api, plan.fingerprint, async () => undefined)).rejects.toThrow(/Injected set failure/)

    expect(api.objects.get(HOT_FLASH.broker) ?? null).toBeNull()
    expect(api.objects.get(RETIRED_FEEDBACK)).toEqual(retiredFeedbackObject())
    expect(api.helperStore.size).toBe(0)
    expect(api.objects.get('automation.eight_sleep_stephen_hot_flash_mode')).toEqual(plan.snapshot.managedBefore['automation.eight_sleep_stephen_hot_flash_mode'])
  })

  it('waits for a newly created helper entity before initializing it', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    api.helperRegistrationDelayId = HOT_FLASH.helpers.leftPhase
    api.helperRegistrationDelayReads = 3

    await hotFlashStage(api, plan.fingerprint, async () => undefined)

    expect(api.writes).toContain(`initialize:${HOT_FLASH.helpers.leftPhase}`)
    expect(api.states.get(HOT_FLASH.helpers.leftPhase)?.state).toBe('idle')
  })

  it('rolls back every created helper after an initialization failure', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    api.failInitializeHelperId = HOT_FLASH.helpers.leftTargetPayload

    await expect(hotFlashStage(api, plan.fingerprint, async () => undefined))
      .rejects.toThrow(/Injected initialization failure/)

    expect(api.helperStore.size).toBe(0)
    expect(api.enabled.get('automation.eight_sleep_stephen_hot_flash_mode')).toBe(true)
    expect(api.enabled.get('automation.eight_sleep_steph_hot_flash_mode')).toBe(true)
  })

  it('rolls back an activation failure to exact pre-stage owners and enablement', async () => {
    const api = client()
    const before = await hotFlashPlan(api)
    const originalLeft = structuredClone(before.snapshot.managedBefore['automation.eight_sleep_stephen_hot_flash_mode'])
    const stagedPlan = await hotFlashStage(api, before.fingerprint, async () => undefined)
    api.failSetObjectId = 'script.sleepypod_stephen_temperature_tonight'

    await expect(hotFlashActivate(api, stagedPlan.fingerprint, before.snapshot)).rejects.toThrow(/Injected set failure/)

    expect(api.objects.get('automation.eight_sleep_stephen_hot_flash_mode')).toEqual(originalLeft)
    expect(api.enabled.get('automation.eight_sleep_stephen_hot_flash_mode')).toBe(true)
    expect(api.objects.get(HOT_FLASH.broker) ?? null).toBeNull()
    expect(api.helperStore.size).toBe(0)
  })

  it('restores the retired feedback script when activation fails after deleting it', async () => {
    const api = client()
    const before = await hotFlashPlan(api)
    const stagedPlan = await hotFlashStage(api, before.fingerprint, async () => undefined)
    api.failValidateCore = true

    await expect(hotFlashActivate(api, stagedPlan.fingerprint, before.snapshot))
      .rejects.toThrow(/Injected core validation failure/)

    expect(api.writes).toContain(`remove:${RETIRED_FEEDBACK}`)
    expect(api.objects.get(RETIRED_FEEDBACK)).toEqual(before.snapshot.retiredBefore[RETIRED_FEEDBACK])
    expect(api.objects.get('script.sleepypod_stephen_temperature_tonight'))
      .toEqual(before.snapshot.managedBefore['script.sleepypod_stephen_temperature_tonight'])
  })

  it('continues rollback after multiple cleanup failures and still restores legacy owner enablement', async () => {
    const api = client()
    const before = await hotFlashPlan(api)
    await hotFlashStage(api, before.fingerprint, async () => undefined)
    api.failRemoveObjectId = HOT_FLASH.broker
    api.failRemoveHelperId = HOT_FLASH.helpers.leftPhase

    await expect(hotFlashRollback(api, before.snapshot)).rejects.toThrow(/rollback completed with failures/)

    expect(api.objects.get(HOT_FLASH.broker)).toBeDefined()
    expect(api.objects.get(RETIRED_FEEDBACK)).toEqual(retiredFeedbackObject())
    expect(api.helperStore.has(HOT_FLASH.helpers.leftPhase)).toBe(true)
    expect(api.helperStore.has(HOT_FLASH.helpers.rightPhase)).toBe(false)
    expect(api.enabled.get('automation.eight_sleep_stephen_hot_flash_mode')).toBe(true)
    expect(api.enabled.get('automation.eight_sleep_steph_hot_flash_mode')).toBe(true)
    expect(api.writes).toContain('validate-core')
  })

  it('refuses rollback after an unowned object drift', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    api.objects.set(HOT_FLASH.broker, { unexpected: true })
    await expect(hotFlashRollback(api, plan.snapshot)).rejects.toThrow(/rollback drift check failed/)
  })

  it('refuses to retire a feedback script whose live configuration drifted', async () => {
    const objects = originalObjects()
    objects[RETIRED_FEEDBACK] = {
      alias: 'Unowned feedback script',
      mode: 'queued',
      sequence: [],
    }
    const api = client({ objects })

    await expect(hotFlashPlan(api)).rejects.toThrow(/Retired managed object .* unexpected configuration drift/)
    expect(api.writes.some((write) => /^(set|remove):/.test(write))).toBe(false)
  })

  it('treats an already absent retired feedback script as converged', async () => {
    const objects = originalObjects()
    delete objects[RETIRED_FEEDBACK]
    const api = client({ objects })
    const plan = await hotFlashPlan(api)

    expect(plan.snapshot.retiredBefore[RETIRED_FEEDBACK]).toBeNull()
    expect(plan.changes).not.toContain(`Remove ${RETIRED_FEEDBACK}`)
  })

  it('rejects an unexpected Home Assistant-generated helper ID and verifies cleanup', async () => {
    const api = client()
    const plan = await hotFlashPlan(api)
    api.generatedHelperId = 'unexpected_helper_id'
    await expect(hotFlashStage(api, plan.fingerprint, async () => undefined)).rejects.toThrow(/generated .* instead/)
    expect(api.helperStore.size).toBe(0)
    expect(api.objects.get(HOT_FLASH.broker) ?? null).toBeNull()
  })
})
