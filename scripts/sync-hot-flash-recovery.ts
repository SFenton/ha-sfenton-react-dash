import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createConnection, createLongLivedTokenAuth, type Connection } from 'home-assistant-js-websocket'
import {
  hotFlashActivate,
  hotFlashPlan,
  hotFlashRollback,
  hotFlashStage,
  hotFlashVerify,
  type HotFlashSnapshot,
  type HotFlashState,
  type HotFlashSyncClient,
} from './lib/hotFlashRecoverySync'
import type { HaRecord, ManagedHelper } from './lib/hotFlashRecoveryConfig'

function argument(args: string[], key: string) {
  return args.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3)
}

function objectParts(entityId: string) {
  const [domain, objectId] = entityId.split('.', 2)
  if (!domain || !objectId || !['automation', 'script'].includes(domain)) {
    throw new Error(`Unsupported Hot Flash object ${entityId}.`)
  }
  return { domain, objectId }
}

function parseDurationSeconds(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value))
  if (typeof value !== 'string') return null
  const parts = value.split(':').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
  return Math.max(1, Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]))
}

export class HotFlashApiClient implements HotFlashSyncClient {
  private connection?: Connection

  constructor(private readonly url: string, private readonly token: string) {}

  private async request(path: string, method = 'GET', body?: unknown, missing = false, timeoutMs = 120_000) {
    let response: Response
    try {
      response = await fetch(new URL(path, this.url), {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new Error(
        `HA ${method} ${path} failed: ${error instanceof Error ? error.message : 'request failed'}.`,
        { cause: error },
      )
    }
    if (missing && response.status === 404) return null
    if (!response.ok) throw new Error(`HA ${method} ${path} returned HTTP ${response.status}.`)
    return response.status === 204 ? null : await response.json() as unknown
  }

  private async ws(message: HaRecord) {
    this.connection ??= await createConnection({
      auth: createLongLivedTokenAuth(this.url, this.token),
    })
    return await this.connection.sendMessagePromise(message) as unknown
  }

  private async objectPath(entityId: string, config?: HaRecord) {
    const { domain, objectId } = objectParts(entityId)
    if (domain === 'script') return `/api/config/script/config/${encodeURIComponent(objectId)}`
    const runtime = await this.getState(entityId, true)
    const configId = typeof config?.id === 'string'
      ? config.id
      : typeof runtime?.attributes.id === 'string'
        ? runtime.attributes.id
        : objectId
    return `/api/config/automation/config/${encodeURIComponent(configId)}`
  }

  async getObject(entityId: string) {
    return await this.request(await this.objectPath(entityId), 'GET', undefined, true) as HaRecord | null
  }

  async getEnabled(entityId: string) {
    if (!entityId.startsWith('automation.')) return true
    const current = await this.getState(entityId, true)
    return current?.state === 'on'
  }

  async setObject(entityId: string, config: HaRecord) {
    await this.request(await this.objectPath(entityId, config), 'POST', config)
  }

  async removeObject(entityId: string) {
    if (!await this.getObject(entityId)) return
    await this.request(await this.objectPath(entityId), 'DELETE', undefined, true)
  }

  async setEnabled(entityId: string, enabled: boolean) {
    if (!entityId.startsWith('automation.')) return
    await this.request(`/api/services/automation/${enabled ? 'turn_on' : 'turn_off'}`, 'POST', {
      entity_id: entityId,
      ...(enabled ? {} : { stop_actions: true }),
    })
  }

  async listHelpers(domain: ManagedHelper['domain']) {
    return await this.ws({ type: `${domain}/list` }) as HaRecord[]
  }

  async createHelper(helper: ManagedHelper) {
    const result = await this.ws({ type: `${helper.domain}/create`, ...helper.config }) as { id?: string }
    if (!result.id) throw new Error(`Home Assistant did not return an ID for ${helper.domain}.`)
    return result.id
  }

  async updateHelper(helper: ManagedHelper) {
    await this.ws({
      type: `${helper.domain}/update`,
      [`${helper.domain}_id`]: helper.id,
      ...helper.config,
    })
  }

  async initializeHelper(helper: ManagedHelper) {
    const selectOptions = helper.config.options
    if (helper.domain === 'input_select' && (!Array.isArray(selectOptions) || selectOptions.length === 0)) {
      throw new Error(`Hot Flash helper ${helper.domain}.${helper.id} has no initialization option.`)
    }
    const action = helper.domain === 'input_datetime'
      ? { service: 'set_datetime', data: { timestamp: 0 } }
      : helper.domain === 'input_number'
        ? { service: 'set_value', data: { value: 0 } }
        : helper.domain === 'input_select'
          ? { service: 'select_option', data: { option: (selectOptions as string[])[0] } }
          : { service: 'cancel', data: {} }
    await this.request(`/api/services/${helper.domain}/${action.service}`, 'POST', {
      entity_id: `${helper.domain}.${helper.id}`,
      ...action.data,
    })
  }

  async restoreHelperState(helper: ManagedHelper, state: HotFlashState) {
    if (helper.domain === 'input_select') {
      await this.request('/api/services/input_select/select_option', 'POST', {
        entity_id: `input_select.${helper.id}`,
        option: state.state,
      })
      return
    }
    if (helper.domain === 'input_number') {
      await this.request('/api/services/input_number/set_value', 'POST', {
        entity_id: `input_number.${helper.id}`,
        value: Number(state.state),
      })
      return
    }
    if (helper.domain === 'input_datetime') {
      const timestamp = Number(state.attributes.timestamp)
      if (!Number.isFinite(timestamp)) throw new Error(`Cannot restore input_datetime.${helper.id} without a timestamp.`)
      await this.request('/api/services/input_datetime/set_datetime', 'POST', {
        entity_id: `input_datetime.${helper.id}`,
        timestamp,
      })
      return
    }
    if (state.state !== 'active') {
      await this.request('/api/services/timer/cancel', 'POST', { entity_id: `timer.${helper.id}` })
      return
    }
    const duration = parseDurationSeconds(state.attributes.remaining ?? state.attributes.duration)
    if (duration === null) throw new Error(`Cannot restore active timer.${helper.id} without remaining duration.`)
    await this.request('/api/services/timer/start', 'POST', {
      entity_id: `timer.${helper.id}`,
      duration,
    })
  }

  async removeHelper(helper: ManagedHelper) {
    await this.ws({
      type: `${helper.domain}/delete`,
      [`${helper.domain}_id`]: helper.id,
    })
  }

  async validateObject(entityId: string, config: HaRecord) {
    const automation = entityId.startsWith('automation.')
    const result = await this.ws({
      type: 'validate_config',
      triggers: automation ? config.triggers ?? [] : [],
      conditions: automation ? config.conditions ?? [] : [],
      actions: automation ? config.actions ?? [] : config.sequence ?? [],
    }) as Record<string, { valid?: boolean }>
    for (const section of ['triggers', 'conditions', 'actions']) {
      if (result[section]?.valid !== true) {
        throw new Error(`Home Assistant rejected ${section} for ${entityId}.`)
      }
    }
  }

  async loaded(entityId: string) {
    const [domain] = entityId.split('.', 1)
    try {
      const result = await this.ws({ type: `${domain}/config`, entity_id: entityId }) as HaRecord
      return (result.config as HaRecord | undefined) ?? result
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: string }).code === 'not_found') return null
      throw error
    }
  }

  async reload() {
    await this.request('/api/services/script/reload', 'POST', {})
    await this.request('/api/services/automation/reload', 'POST', {})
  }

  async reconcile() {
    await this.request('/api/services/script/sleepypod_hot_flash_broker', 'POST', {
      action: 'reconcile',
      side: 'shared',
      report_kind: 'watchdog',
    })
  }

  async persistStates() {
    await this.request('/api/services/homeassistant/save_persistent_states', 'POST', {})
  }

  async validateCore() {
    const result = await this.request('/api/config/core/check_config', 'POST') as { result?: string }
    if (result.result !== 'valid') throw new Error('Home Assistant core configuration check failed.')
  }

  async getState(entityId: string, allowMissing = false) {
    const current = await this.request(
      `/api/states/${encodeURIComponent(entityId)}`,
      'GET',
      undefined,
      allowMissing,
    ) as { attributes?: HaRecord; state?: string } | null
    if (!current || typeof current.state !== 'string') return null
    return {
      state: current.state,
      attributes: current.attributes ?? {},
    }
  }

  async findConsumers(needles: readonly string[]) {
    const consumers = new Map<string, string[]>()
    for (const needle of needles) {
      const related = await this.ws({
        type: 'search/related',
        item_type: 'entity',
        item_id: needle,
      }) as { automation?: string[]; script?: string[] }
      for (const entityId of [...related.automation ?? [], ...related.script ?? []]) {
        consumers.set(entityId, [...consumers.get(entityId) ?? [], needle])
      }
    }
    return Object.fromEntries(consumers)
  }

  close() {
    this.connection?.close()
  }
}

function assertSnapshotSafe(snapshot: HotFlashSnapshot, token: string) {
  const serialized = JSON.stringify(snapshot)
  if (serialized.includes(token)
    || /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|gh[pousr]_[A-Za-z0-9]{20,}/.test(serialized)) {
    throw new Error('Hot Flash rollback snapshot contains a credential-like value.')
  }
}

async function writeJson(path: string, value: unknown, exclusive = false) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true, mode: 0o700 })
  await writeFile(target, JSON.stringify(value, null, 2) + '\n', {
    ...(exclusive ? { flag: 'wx' as const } : {}),
    mode: 0o600,
  })
}

async function main(args: string[]) {
  loadEnv({ path: '.env.development', quiet: true })
  loadEnv({ path: '.env', quiet: true })
  const mode = argument(args, 'mode') ?? 'plan'
  if (!['plan', 'stage', 'activate', 'verify', 'rollback'].includes(mode)) throw new Error('Unknown Hot Flash sync mode.')
  const mutation = ['stage', 'activate', 'rollback'].includes(mode)
  if (mutation && !args.includes('--apply')) throw new Error('Hot Flash live writes require --apply.')
  const url = argument(args, 'ha-url') ?? process.env.HASS_ADMIN_API_URL ?? process.env.VITE_HA_URL
  const token = process.env.VITE_HA_TOKEN
  if (!url || !token) throw new Error('Configure the local Home Assistant URL and token.')
  const snapshotDirectory = argument(args, 'snapshot-dir')
  if (mutation && (!snapshotDirectory || !/^artifacts\/hot-flash-recovery\/[a-zA-Z0-9_-]+$/.test(snapshotDirectory))) {
    throw new Error('Use an ignored project-relative artifacts/hot-flash-recovery/<run> snapshot directory.')
  }
  const expected = argument(args, 'expect')
  if (mutation && mode !== 'rollback' && !expected) throw new Error('Stage and activate require the latest --expect fingerprint.')
  const snapshotPath = argument(args, 'snapshot')
  if (['activate', 'rollback'].includes(mode) && !snapshotPath) throw new Error(`${mode} requires --snapshot=<pre-stage snapshot>.`)
  const outputPath = argument(args, 'out')
  const client = new HotFlashApiClient(url, token)
  let lockPath: string | undefined
  let ownsLock = false
  try {
    if (mutation) {
      await mkdir(resolve(snapshotDirectory!), { recursive: true, mode: 0o700 })
      lockPath = resolve('artifacts/hot-flash-recovery/migration.lock')
      const lock = await open(lockPath, 'wx', 0o600)
      ownsLock = true
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
      await lock.close()
    }
    if (mode === 'rollback') {
      const snapshot = JSON.parse(await readFile(resolve(snapshotPath!), 'utf8')) as HotFlashSnapshot
      assertSnapshotSafe(snapshot, token)
      await hotFlashRollback(client, snapshot)
      console.info(JSON.stringify({ mode, rolledBack: true }, null, 2))
      return
    }
    const saveSnapshot = async (snapshot: HotFlashSnapshot) => {
      assertSnapshotSafe(snapshot, token)
      await writeJson(`${snapshotDirectory}/before-stage.json`, snapshot, true)
    }
    const plan = mode === 'stage'
      ? await hotFlashStage(client, expected!, saveSnapshot)
      : mode === 'activate'
        ? await hotFlashActivate(
            client,
            expected!,
            JSON.parse(await readFile(resolve(snapshotPath!), 'utf8')) as HotFlashSnapshot,
          )
        : mode === 'verify'
          ? await hotFlashVerify(client)
          : await hotFlashPlan(client)
    const output = {
      mode,
      fingerprint: plan.fingerprint,
      ready: plan.ready,
      changes: plan.changes,
      helperCount: plan.generated.helpers.length,
      managedObjectCount: Object.keys(plan.snapshot.managedAfter).length,
      consumerCount: Object.keys(plan.snapshot.consumersBefore).length,
      requesterBindingConfigured: plan.requesterBindingConfigured,
    }
    if (outputPath) await writeJson(outputPath, output)
    console.info(JSON.stringify(output, null, 2))
  } finally {
    client.close()
    if (ownsLock && lockPath) await unlink(lockPath)
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map(errorMessage)].join(' | ')
  }
  return error instanceof Error ? error.message : 'Hot Flash synchronization failed.'
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(errorMessage(error))
    process.exitCode = 1
  })
}
