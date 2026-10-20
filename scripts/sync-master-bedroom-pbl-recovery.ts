import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createConnection, createLongLivedTokenAuth, type Connection } from 'home-assistant-js-websocket'
import {
  ELIGIBILITY_STATE_TEMPLATE, MASTER_BEDROOM_PBL as M, bedPauseEvidenceAutomation, bedPauseHelper,
  eligibilityOptions, patchDaytimeRecovery, sameConfig as same, type HaRecord,
} from './lib/masterBedroomPblRecoveryConfig'

export type EligibilityOptions = { state: string; availability?: string }

export interface PblRecoveryClient {
  getAutomation(id: string): Promise<HaRecord | null>
  setAutomation(id: string, config: HaRecord): Promise<void>
  deleteAutomation(id: string): Promise<void>
  hasInputText(id: string): Promise<boolean>
  createInputText(config: HaRecord): Promise<string>
  getEligibility(): Promise<EligibilityOptions>
  setEligibility(options: EligibilityOptions): Promise<void>
}

export type PblRecoverySnapshot = {
  recovery: HaRecord
  evidence: HaRecord | null
  eligibility: EligibilityOptions
  helperExists: boolean
}

const withoutTrace = (config: HaRecord) => Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'trace'))

export async function readSnapshot(client: PblRecoveryClient): Promise<PblRecoverySnapshot> {
  const recovery = await client.getAutomation(M.recoveryAutomationId)
  if (!recovery) throw new Error('Daytime Recovery automation is missing.')
  return {
    recovery,
    evidence: await client.getAutomation(M.evidenceAutomationId),
    eligibility: await client.getEligibility(),
    helperExists: await client.hasInputText(M.bedPauseHelperId),
  }
}

export function planChanges(snapshot: PblRecoverySnapshot) {
  const recovery = patchDaytimeRecovery(snapshot.recovery)
  const eligibility = eligibilityOptions({ template_type: 'binary_sensor', ...snapshot.eligibility }).state as string
  const evidence = bedPauseEvidenceAutomation()
  const changes = [
    ...(snapshot.helperExists ? [] : ['create input_text bed-pause helper']),
    ...(snapshot.evidence && same(withoutTrace(snapshot.evidence), evidence) ? [] : ['write bed-pause evidence automation']),
    ...(eligibility === snapshot.eligibility.state ? [] : ['extend overnight recovery eligibility']),
    ...(same(withoutTrace(recovery), withoutTrace(snapshot.recovery)) ? [] : ['patch Daytime Recovery gates']),
  ]
  return { changes, recovery, eligibility, evidence }
}

/** Applies helper, evidence, eligibility, then recovery so recovery never references a missing helper. */
export async function applyChanges(client: PblRecoveryClient, snapshot: PblRecoverySnapshot) {
  const plan = planChanges(snapshot)
  if (!snapshot.helperExists && await client.createInputText(bedPauseHelper.config) !== M.bedPauseHelperId) {
    throw new Error('Unexpected generated bed-pause helper id.')
  }
  if (plan.changes.includes('write bed-pause evidence automation')) await client.setAutomation(M.evidenceAutomationId, plan.evidence)
  if (plan.eligibility !== snapshot.eligibility.state) await client.setEligibility({ ...snapshot.eligibility, state: plan.eligibility })
  if (plan.changes.includes('patch Daytime Recovery gates')) await client.setAutomation(M.recoveryAutomationId, plan.recovery)
  const after = planChanges(await readSnapshot(client))
  if (after.changes.length) throw new Error(`Post-apply verification still differs: ${after.changes.join(', ')}.`)
  return plan.changes
}

export async function rollbackChanges(client: PblRecoveryClient, original: PblRecoverySnapshot) {
  await client.setAutomation(M.recoveryAutomationId, original.recovery)
  await client.setEligibility(original.eligibility)
  if (original.evidence) await client.setAutomation(M.evidenceAutomationId, original.evidence)
  else if (await client.getAutomation(M.evidenceAutomationId)) await client.deleteAutomation(M.evidenceAutomationId)
}

class HaApiClient implements PblRecoveryClient {
  private connection?: Connection
  constructor(private readonly url: string, private readonly token: string) {}

  private async request(path: string, method = 'GET', body?: unknown, missing = false) {
    const response = await fetch(new URL(path, this.url), {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    })
    if (missing && (response.status === 404 || response.status === 400)) return null
    if (!response.ok) throw new Error(`HA ${method} ${path} returned HTTP ${response.status}.`)
    return await response.json() as unknown
  }

  private async ws(message: HaRecord & { type: string }) {
    this.connection ??= await createConnection({ auth: createLongLivedTokenAuth(this.url, this.token) })
    return await this.connection.sendMessagePromise(message)
  }

  async getAutomation(id: string) {
    return await this.request(`/api/config/automation/config/${id}`, 'GET', undefined, true) as HaRecord | null
  }

  async setAutomation(id: string, config: HaRecord) {
    await this.request(`/api/config/automation/config/${id}`, 'POST', config)
  }

  async deleteAutomation(id: string) {
    await this.request(`/api/config/automation/config/${id}`, 'DELETE')
  }

  async hasInputText(id: string) {
    return (await this.ws({ type: 'input_text/list' }) as HaRecord[]).some((item) => item.id === id)
  }

  async createInputText(config: HaRecord) {
    return (await this.ws({ type: 'input_text/create', ...config }) as { id: string }).id
  }

  private async eligibilityFlow() {
    const flow = await this.request('/api/config/config_entries/options/flow', 'POST', { handler: M.eligibleEntryId }) as {
      flow_id: string
      data_schema: Array<{ name: string; type?: string; description?: { suggested_value?: string }; schema?: Array<{ name: string; description?: { suggested_value?: string } }> }>
    }
    const state = flow.data_schema.find((field) => field.name === 'state')?.description?.suggested_value
    const availability = flow.data_schema.find((field) => field.name === 'additional_options')?.schema
      ?.find((field) => field.name === 'availability')?.description?.suggested_value
    if (!state) throw new Error('Eligibility options flow did not expose the current state template.')
    return { flowId: flow.flow_id, options: { state, ...(availability ? { availability } : {}) } }
  }

  async getEligibility() {
    const { flowId, options } = await this.eligibilityFlow()
    await this.request(`/api/config/config_entries/options/flow/${flowId}`, 'DELETE')
    return options
  }

  async setEligibility(options: EligibilityOptions) {
    const { flowId } = await this.eligibilityFlow()
    const result = await this.request(`/api/config/config_entries/options/flow/${flowId}`, 'POST', {
      state: options.state,
      additional_options: options.availability ? { availability: options.availability } : {},
    }) as { type: string }
    if (result.type !== 'create_entry') throw new Error('Eligibility options flow did not complete.')
  }

  close() {
    this.connection?.close()
  }
}

const argument = (args: string[], key: string) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3)

async function main(args: string[]) {
  loadEnv({ path: '.env.development', quiet: true })
  loadEnv({ path: '.env', quiet: true })
  const mode = argument(args, 'mode') ?? 'plan'
  if (!['plan', 'apply', 'rollback'].includes(mode)) throw new Error('Unknown mode.')
  if (mode !== 'plan' && !args.includes('--apply')) throw new Error('Live writes require --apply.')
  const url = argument(args, 'ha-url') ?? process.env.HASS_ADMIN_API_URL ?? process.env.VITE_HA_URL
  const token = process.env.VITE_HA_TOKEN
  if (!url || !token) throw new Error('Configure HA URL and token through the local environment.')
  const client = new HaApiClient(url, token)
  try {
    if (mode === 'rollback') {
      const path = argument(args, 'snapshot')
      if (!path?.startsWith('artifacts/master-bedroom-pbl-recovery/')) throw new Error('Rollback requires --snapshot=artifacts/master-bedroom-pbl-recovery/<file>.json.')
      await rollbackChanges(client, JSON.parse(await readFile(resolve(path), 'utf8')) as PblRecoverySnapshot)
      console.info('Restored the Daytime Recovery automation, eligibility template, and evidence automation from the snapshot.')
      return
    }
    const snapshot = await readSnapshot(client)
    if (mode === 'plan') {
      console.info(JSON.stringify({ mode, changes: planChanges(snapshot).changes, eligibilityCurrent: snapshot.eligibility.state === ELIGIBILITY_STATE_TEMPLATE }, null, 2))
      return
    }
    const directory = resolve('artifacts/master-bedroom-pbl-recovery')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const file = resolve(directory, `before-${new Date().toISOString().replace(/[^0-9]/g, '')}.json`)
    await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    const changes = await applyChanges(client, snapshot)
    console.info(JSON.stringify({ mode, changes, snapshot: file }, null, 2))
  } finally {
    client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Master-bedroom PBL recovery synchronization failed.')
    process.exitCode = 1
  })
}
