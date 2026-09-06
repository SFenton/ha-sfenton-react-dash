import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createConnection, createLongLivedTokenAuth, type Connection } from 'home-assistant-js-websocket'
import { FRONT_DOOR as F, frontDoorUnsecuredHelpers, type HaRecord, type ManagedHelper } from './lib/frontDoorUnsecuredConfig'
import { configFingerprint } from './lib/frontDoorCoordinatorTransform'
import {
  activateFrontDoor, frontDoorPlan, rollbackFrontDoor, stageFrontDoor, verifyFrontDoor,
  type FrontDoorClient, type FrontDoorSnapshot,
} from './lib/frontDoorUnsecuredSync'

export class FrontDoorApiClient implements FrontDoorClient {
  private connection?: Connection
  constructor(private readonly url: string, private readonly token: string) {}

  private async request(path: string, method = 'GET', body?: unknown, missing = false) {
    const response = await fetch(new URL(path, this.url), {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    })
    if (missing && response.status === 404) return null
    if (!response.ok) throw new Error(`HA ${method} ${path} returned HTTP ${response.status}.`)
    return await response.json() as unknown
  }

  private async ws(message: HaRecord) {
    this.connection ??= await createConnection({ auth: createLongLivedTokenAuth(this.url, this.token) })
    return await this.connection.sendMessagePromise(message)
  }

  async getAutomation(id: string) {
    return await this.request(`/api/config/automation/config/${encodeURIComponent(id)}`, 'GET', undefined, true) as HaRecord | null
  }

  async loadedAutomation(entity: string) {
    try {
      return (await this.ws({ type: 'automation/config', entity_id: entity }) as { config: HaRecord }).config
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: string }).code === 'not_found') return null
      throw error
    }
  }

  async setAutomation(id: string, config: HaRecord) {
    await this.request(`/api/config/automation/config/${encodeURIComponent(id)}`, 'POST', config)
  }

  async listHelpers(domain: string) {
    return await this.ws({ type: `${domain}/list` }) as HaRecord[]
  }

  async createHelper(helper: ManagedHelper) {
    const result = await this.ws({ type: `${helper.domain}/create`, ...helper.config }) as { id: string }
    return result.id
  }

  async initializeHelper(helper: ManagedHelper) {
    const expected = frontDoorUnsecuredHelpers.find((item) => item.domain === helper.domain && item.id === helper.id)
    if (!expected) throw new Error('Only newly staged lifecycle helpers can be initialized.')
    const defaults: Record<ManagedHelper['domain'], { service: string; data: HaRecord }> = {
      input_text: { service: 'set_value', data: { value: '' } },
      input_number: { service: 'set_value', data: { value: expected.config.min } },
      input_datetime: { service: 'set_datetime', data: { timestamp: 0 } },
      input_select: { service: 'select_option', data: { option: (expected.config.options as string[] | undefined)?.[0] } },
      input_boolean: { service: 'turn_off', data: {} },
    }
    const value = defaults[expected.domain]
    await this.request(`/api/services/${expected.domain}/${value.service}`, 'POST', { entity_id: `${expected.domain}.${expected.id}`, ...value.data })
  }

  async persistStates() {
    await this.request('/api/services/homeassistant/save_persistent_states', 'POST', {})
  }

  async validateAutomation(config: HaRecord) {
    const result = await this.ws({ type: 'validate_config', triggers: config.triggers, conditions: config.conditions, actions: config.actions }) as Record<string, { valid: boolean }>
    if (['triggers', 'conditions', 'actions'].some((key) => result[key]?.valid !== true)) {
      throw new Error(`Home Assistant rejected the native configuration for ${String(config.id)}.`)
    }
  }

  async state(entity: string, allowMissing = false) {
    return (await this.request(`/api/states/${encodeURIComponent(entity)}`, 'GET', undefined, allowMissing)
      ?? { state: 'unavailable', attributes: {} }) as { state: string; attributes: HaRecord }
  }

  async automation(service: 'turn_on' | 'turn_off' | 'trigger', entity: string) {
    const allowed: readonly string[] = [F.controller, F.reconciler, F.coordinator]
    if (!allowed.includes(entity)) throw new Error('Unexpected automation target.')
    if (service === 'trigger' && entity !== F.controller) throw new Error('Only reconciliation of the new controller is permitted.')
    await this.request(`/api/services/automation/${service}`, 'POST', {
      entity_id: entity,
      ...(service === 'turn_off' ? { stop_actions: true } : {}),
      ...(service === 'trigger' ? { skip_condition: false } : {}),
    })
  }

  async validate() {
    const result = await this.request('/api/config/core/check_config', 'POST') as { result: string }
    if (result.result !== 'valid') throw new Error('Home Assistant configuration check failed.')
  }

  close() {
    this.connection?.close()
  }
}

function argument(args: string[], key: string) {
  return args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3)
}

export function assertSnapshotSafe(snapshot: FrontDoorSnapshot, forbidden: string[]) {
  const serialized = JSON.stringify(snapshot)
  if (forbidden.some((secret) => secret && serialized.includes(secret))
    || /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|gh[pousr]_[A-Za-z0-9]{20,}/.test(serialized)) {
    throw new Error('Snapshot contains a credential or restricted identifier; no snapshot was written.')
  }
}

async function main(args: string[]) {
  loadEnv({ path: '.env.development', quiet: true })
  loadEnv({ path: '.env', quiet: true })
  const mode = argument(args, 'mode') ?? 'plan'
  if (!['plan', 'stage', 'activate', 'verify', 'rollback'].includes(mode)) throw new Error('Unknown mode.')
  const mutation = ['stage', 'activate', 'rollback'].includes(mode)
  if (mutation && !args.includes('--apply')) throw new Error('Live writes require --apply.')
  const url = argument(args, 'ha-url') ?? process.env.HASS_ADMIN_API_URL ?? process.env.VITE_HA_URL
  const token = process.env.VITE_HA_TOKEN
  if (!url || !token) throw new Error('Configure HA URL and token through the local environment.')
  const client = new FrontDoorApiClient(url, token)
  let lockPath: string | undefined
  let ownsLock = false
  try {
    const owner = (await client.state(F.person)).attributes.user_id
    if (typeof owner !== 'string' || !owner) throw new Error('The intended recipient has no configured HA user.')
    const snapshotDirectory = argument(args, 'snapshot-dir')
    if (mutation) {
      if (!snapshotDirectory || !/^artifacts\/front-door-unsecured\/[a-zA-Z0-9_-]+$/.test(snapshotDirectory)) {
        throw new Error('Use an ignored project-relative artifacts/front-door-unsecured/<release> snapshot directory.')
      }
      await mkdir(resolve(snapshotDirectory), { recursive: true, mode: 0o700 })
      lockPath = resolve('artifacts/front-door-unsecured/migration.lock')
      const lock = await open(lockPath, 'wx', 0o600)
      ownsLock = true
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
      await lock.close()
    }
    const saveSnapshot = async (snapshot: FrontDoorSnapshot) => {
      assertSnapshotSafe(snapshot, [token, owner])
      const body = JSON.stringify(snapshot, null, 2) + '\n'
      try {
        await writeFile(resolve(snapshotDirectory!, `before-${mode}.json`), body, { flag: 'wx', mode: 0o600 })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '')
        await writeFile(resolve(snapshotDirectory!, `checkpoint-${mode}-${timestamp}.json`), body, { flag: 'wx', mode: 0o600 })
      }
    }
    if (mode === 'rollback') {
      const expected = argument(args, 'expect-coordinator')
      if (!expected) throw new Error('Rollback requires the freshly read --expect-coordinator fingerprint.')
      const original = JSON.parse(await readFile(resolve(snapshotDirectory!, 'before-stage.json'), 'utf8')) as FrontDoorSnapshot
      await rollbackFrontDoor(client, original, expected)
      console.info('Rolled back to passive, non-actionable coordinator fallback; managed helpers retained for recovery.')
      return
    }
    const expected = argument(args, 'expect')
    if (mutation && !expected) throw new Error('Live writes require the latest plan --expect fingerprint.')
    const plan = mode === 'stage'
      ? await stageFrontDoor(client, expected!, saveSnapshot)
      : mode === 'activate'
        ? await activateFrontDoor(client, expected!, saveSnapshot)
        : mode === 'verify'
          ? await verifyFrontDoor(client)
          : await frontDoorPlan(client)
    console.info(JSON.stringify({
      mode, fingerprint: plan.fingerprint, ready: plan.ready,
      coordinatorFingerprint: configFingerprint(plan.snapshot.coordinator),
      managedFingerprints: Object.fromEntries(Object.entries(plan.snapshot.managed).map(([id, config]) => [id, config ? configFingerprint(config) : null])),
      changes: plan.changes,
      recipientBindingConfigured: true,
    }, null, 2))
  } finally {
    client.close()
    if (ownsLock && lockPath) await unlink(lockPath)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Front-door synchronization failed.')
    process.exitCode = 1
  })
}
