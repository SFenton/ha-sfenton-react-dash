import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type MigratedSensor = {
  label: string
  old: {
    occupancy?: string
    pir?: string
    temperature?: string
    rlcOccupancy?: string
    rlcPir?: string
  }
  new: {
    occupancy?: string
    temperature?: string
    rlcOccupancy?: string
  }
}

type RealLastChangedCreate = {
  sourceEntity: string
  name: string
}

type MigrationManifest = {
  name: string
  entitySwaps: Record<string, string>
  removeEntities: string[]
  realLastChanged: {
    deleteSources: string[]
    create: RealLastChangedCreate[]
  }
  haTargets: {
    helperGroups: string[]
    presenceBasedLighting: { title: string }[]
    thermostatContactSensors: { title: string; areas: string[] }[]
    areaOccupancy: { title: string; areas: string[] }[]
  }
  dashboards: { urlPath: string }[]
  automations: string[]
  react?: {
    repo: string
    files: string[]
    wrapperDashboard?: string
    wrapperVersion?: string
  }
}

type ConfigEntrySummary = {
  domain: string
  title: string
  entry_id: string
  data?: {
    source_entity?: unknown
    source_entities?: unknown
  }
}

type FlowField = {
  name: string
  type?: string
  required?: boolean
  optional?: boolean
  default?: JsonValue
  description?: { suggested_value?: JsonValue }
  schema?: FlowField[]
  expanded?: boolean
  selector?: {
    entity?: { include_entities?: string[]; multiple?: boolean; domain?: string | string[]; device_class?: string | string[] }
    [key: string]: unknown
  }
}

type FlowResult = {
  type: string
  flow_id: string
  step_id?: string
  data_schema?: FlowField[]
  errors?: Record<string, string> | null
  description_placeholders?: Record<string, string> | null
  result?: unknown
  last_step?: boolean | null
}

type TransformStats = {
  replacements: Record<string, number>
  removals: Record<string, number>
}

type PhaseReport = {
  phase: string
  target?: string
  changed?: boolean
  actions?: string[]
  payloads?: unknown[]
  stats?: TransformStats
  warnings?: string[]
  errors?: string[]
}

type RunMode = 'dry-run' | 'apply-ha-config' | 'apply-react'

const CURRENT_MIGRATION: MigrationManifest = {
  name: 'aqara-w200-fp300-hallway',
  entitySwaps: {
    'binary_sensor.entryway_presence_sensor_presence':
      'binary_sensor.hallway_entryway_living_room_presence_sensor_occupancy',
    'binary_sensor.hallway_guest_room_presence_sensor_presence':
      'binary_sensor.hallway_guest_bath_gym_presence_sensor_occupancy',
    'binary_sensor.hallway_office_presence_sensor_presence':
      'binary_sensor.hallway_office_bedroom_presence_sensor_occupancy',
    'sensor.entryway_presence_sensor_temperature':
      'sensor.hallway_entryway_living_room_presence_sensor_temperature',
    'sensor.hallway_guest_room_presence_sensor_temperature':
      'sensor.hallway_guest_bath_gym_presence_sensor_temperature',
    'sensor.hallway_office_presence_sensor_temperature':
      'sensor.hallway_office_bedroom_presence_sensor_temperature',
    'sensor.entryway_presence_sensor_occupancy':
      'sensor.hallway_entryway_living_room_presence_sensor_occupancy',
    'sensor.hallway_guest_room_presence_sensor_occupancy':
      'sensor.hallway_guest_bath_gym_presence_sensor_occupancy',
  },
  removeEntities: [
    'binary_sensor.entryway_presence_sensor_pir_detection',
    'binary_sensor.hallway_guest_room_presence_sensor_pir_detection',
    'binary_sensor.hallway_office_presence_sensor_pir_detection',
    'sensor.entryway_presence_sensor_pir',
    'sensor.hallway_guest_room_presence_sensor_pir',
    'sensor.hallway_office_presence_sensor_pir',
  ],
  realLastChanged: {
    deleteSources: [
      'binary_sensor.entryway_presence_sensor_presence',
      'binary_sensor.entryway_presence_sensor_pir_detection',
      'binary_sensor.hallway_guest_room_presence_sensor_presence',
      'binary_sensor.hallway_guest_room_presence_sensor_pir_detection',
      'binary_sensor.hallway_office_presence_sensor_presence',
      'binary_sensor.hallway_office_presence_sensor_pir_detection',
    ],
    create: [
      {
        sourceEntity: 'binary_sensor.hallway_entryway_living_room_presence_sensor_occupancy',
        name: 'Hallway/Entryway/Living Room Presence Sensor Occupancy',
      },
      {
        sourceEntity: 'binary_sensor.hallway_guest_bath_gym_presence_sensor_occupancy',
        name: 'Hallway (Guest/Bath/Gym) Presence Sensor Occupancy',
      },
      {
        sourceEntity: 'binary_sensor.hallway_office_bedroom_presence_sensor_occupancy',
        name: 'Hallway (Office/Bedroom) Presence Sensor Occupancy',
      },
    ],
  },
  haTargets: {
    helperGroups: ['Hallway Occupancy Sensors', 'Entryway Presence Sensors'],
    presenceBasedLighting: [{ title: 'Hallway' }],
    thermostatContactSensors: [{ title: 'Thermostat Contact Sensors', areas: ['area_hallway', 'area_entryway'] }],
    areaOccupancy: [
      {
        title: 'Area Occupancy Detection',
        areas: ['area_hallway', 'area_office', 'area_master_bedroom', 'area_kitchen'],
      },
    ],
  },
  dashboards: [{ urlPath: 'at-a-glance' }],
  automations: ['automation.climate_range_calculation'],
  react: {
    repo: 'C:\\Users\\sfent\\source\\repos\\homeassistant\\ha-sfenton-react-dash',
    files: ['src/constants/atAGlance.ts'],
    wrapperDashboard: 'sfenton-react-dash',
    wrapperVersion: '20260523-aqara',
  },
}

function buildManifestFromSensors(name: string, sensors: MigratedSensor[]): MigrationManifest {
  const entitySwaps: Record<string, string> = {}
  const removeEntities: string[] = []
  const deleteSources: string[] = []
  const create: RealLastChangedCreate[] = []

  for (const sensor of sensors) {
    if (sensor.old.occupancy && sensor.new.occupancy) entitySwaps[sensor.old.occupancy] = sensor.new.occupancy
    if (sensor.old.temperature && sensor.new.temperature) entitySwaps[sensor.old.temperature] = sensor.new.temperature
    if (sensor.old.rlcOccupancy && sensor.new.rlcOccupancy) entitySwaps[sensor.old.rlcOccupancy] = sensor.new.rlcOccupancy
    if (sensor.old.pir) removeEntities.push(sensor.old.pir)
    if (sensor.old.rlcPir) removeEntities.push(sensor.old.rlcPir)
    if (sensor.old.occupancy) deleteSources.push(sensor.old.occupancy)
    if (sensor.old.pir) deleteSources.push(sensor.old.pir)
    if (sensor.new.occupancy) create.push({ sourceEntity: sensor.new.occupancy, name: `${sensor.label} Occupancy` })
  }

  return {
    ...CURRENT_MIGRATION,
    name,
    entitySwaps,
    removeEntities,
    realLastChanged: { deleteSources, create },
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const valueOf = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }

  const applyHaConfig = args.includes('--apply-ha-config')
  const applyReact = args.includes('--apply-react')
  const legacyApply = args.includes('--apply')
  const preApply = args.includes('--pre-apply')

  let mode: RunMode = 'dry-run'
  if (applyHaConfig) mode = 'apply-ha-config'
  else if (applyReact) mode = 'apply-react'
  else if (legacyApply) throw new Error('--apply is no longer supported. Use --apply-ha-config or --apply-react.')
  else if (preApply) mode = 'dry-run'

  return {
    mode,
    preApply,
    manifestPath: valueOf('--manifest'),
    haUrl: valueOf('--ha-url'),
    haToken: valueOf('--ha-token'),
    backupDir: valueOf('--backup-dir') ?? 'migration-backups',
  }
}

function readEnvFile(path: string) {
  if (!existsSync(path)) return {}
  const text = readFileSync(path, 'utf8')
  const env: Record<string, string> = {}

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    env[key.trim()] = rawValue.trim().replace(/^['"]|['"]$/g, '')
  }

  return env
}

async function loadManifest(path?: string) {
  if (!path) return CURRENT_MIGRATION
  const raw = await readFile(resolve(path), 'utf8')
  return JSON.parse(raw) as MigrationManifest
}

function makeStats(): TransformStats {
  return { replacements: {}, removals: {} }
}

function countStats(stats: TransformStats) {
  return {
    replacements: Object.values(stats.replacements).reduce((total, count) => total + count, 0),
    removals: Object.values(stats.removals).reduce((total, count) => total + count, 0),
  }
}

function addCount(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1
}

function transformJson(value: JsonValue, manifest: MigrationManifest, stats: TransformStats): JsonValue | undefined {
  if (typeof value === 'string') {
    if (manifest.removeEntities.includes(value)) {
      addCount(stats.removals, value)
      return undefined
    }
    const replacement = manifest.entitySwaps[value]
    if (replacement) {
      addCount(stats.replacements, `${value} -> ${replacement}`)
      return replacement
    }
    return value
  }

  if (Array.isArray(value)) {
    const next: JsonValue[] = []
    for (const item of value) {
      const transformed = transformJson(item, manifest, stats)
      if (transformed !== undefined) next.push(transformed)
    }
    return next
  }

  if (value && typeof value === 'object') {
    const next: Record<string, JsonValue> = {}
    for (const [key, child] of Object.entries(value)) {
      const transformed = transformJson(child, manifest, stats)
      if (transformed !== undefined) next[key] = transformed
    }
    return next
  }

  return value
}

function transformText(text: string, manifest: MigrationManifest, stats: TransformStats) {
  let next = text

  for (const [oldEntity, newEntity] of Object.entries(manifest.entitySwaps)) {
    const pattern = new RegExp(`${escapeRegExp(oldEntity)}(?![A-Za-z0-9_])`, 'g')
    const count = next.match(pattern)?.length ?? 0
    if (count > 0) {
      stats.replacements[`${oldEntity} -> ${newEntity}`] = (stats.replacements[`${oldEntity} -> ${newEntity}`] ?? 0) + count
      next = next.replace(pattern, newEntity)
    }
  }

  for (const entity of manifest.removeEntities) {
    const pattern = new RegExp(`${escapeRegExp(entity)}(?![A-Za-z0-9_])`, 'g')
    const count = next.match(pattern)?.length ?? 0
    if (count > 0) stats.removals[entity] = (stats.removals[entity] ?? 0) + count
  }

  return next
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function schemaPayload(schema: FlowField[] | undefined, manifest: MigrationManifest, stats: TransformStats, warnings?: string[]) {
  const payload: Record<string, JsonValue> = {}

  for (const field of schema ?? []) {
    // Handle section-style fields (e.g. type=expandable) which expect a nested dict.
    if (field.type === 'expandable' || (Array.isArray(field.schema) && field.schema.length > 0)) {
      const nested = schemaPayload(field.schema, manifest, stats, warnings)
      payload[field.name] = nested
      continue
    }

    let value: JsonValue | undefined
    let hasValue = false

    if (field.description && 'suggested_value' in field.description) {
      value = field.description.suggested_value
      hasValue = true
    } else if ('default' in field) {
      value = field.default
      hasValue = true
    }

    if (!hasValue) {
      // Required fields with no current value cannot be safely auto-populated.
      // Skip them to surface the issue via HA's validation rather than guessing.
      continue
    }

    let transformed = transformJson(value as JsonValue, manifest, stats)

    // Filter list values against schema include_entities: HA's validator rejects values not in
    // the allow-list, which can happen when the user's prior config has drifted (renamed entities,
    // removed integrations, etc.). Dropping invalid values is safer than failing the whole flow.
    const includeList = field.selector?.entity?.include_entities
    if (Array.isArray(includeList) && Array.isArray(transformed)) {
      const allowed = new Set(includeList)
      const dropped: string[] = []
      const filtered = (transformed as JsonValue[]).filter((item) => {
        if (typeof item !== 'string') return true
        if (allowed.has(item)) return true
        dropped.push(item)
        return false
      })
      if (dropped.length > 0 && warnings) {
        warnings.push(
          `Field ${field.name}: dropped ${dropped.length} value(s) not in schema include_entities: ${dropped.join(', ')}`,
        )
      }
      transformed = filtered
    }

    if (transformed !== undefined) payload[field.name] = transformed
  }

  return payload
}

class HomeAssistantClient {
  #baseUrl: string
  #token: string
  #socket?: WebSocket
  #messageId = 1
  #pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

  constructor(baseUrl: string, token: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, '')
    this.#token = token
  }

  async api<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.#baseUrl}/api/${path.replace(/^\//, '')}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.#token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const text = await response.text()
    if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`)
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }

  async ws<T>(message: Record<string, unknown>): Promise<T> {
    await this.#connectWs()
    const id = this.#messageId++
    const socket = this.#socket
    if (!socket) throw new Error('WebSocket not connected')

    return await new Promise<T>((resolveResult, rejectResult) => {
      this.#pending.set(id, { resolve: (value) => resolveResult(value as T), reject: rejectResult })
      socket.send(JSON.stringify({ id, ...message }))
    })
  }

  close() {
    this.#socket?.close()
  }

  async #connectWs() {
    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) return

    const wsUrl = this.#baseUrl.replace(/^http/, 'ws') + '/api/websocket'
    const socket = new WebSocket(wsUrl)
    this.#socket = socket

    await new Promise<void>((resolveConnect, rejectConnect) => {
      const timeout = setTimeout(() => rejectConnect(new Error('Timed out connecting Home Assistant WebSocket')), 10000)

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as {
          type: string
          id?: number
          success?: boolean
          result?: unknown
          error?: { message?: string }
        }

        if (message.type === 'auth_required') {
          socket.send(JSON.stringify({ type: 'auth', access_token: this.#token }))
          return
        }

        if (message.type === 'auth_ok') {
          clearTimeout(timeout)
          resolveConnect()
          return
        }

        if (message.type === 'auth_invalid') {
          clearTimeout(timeout)
          rejectConnect(new Error(message.error?.message ?? 'Home Assistant WebSocket auth failed'))
          return
        }

        if (message.id !== undefined) {
          const pending = this.#pending.get(message.id)
          if (!pending) return
          this.#pending.delete(message.id)
          if (message.success === false) {
            pending.reject(new Error(message.error?.message ?? 'Home Assistant WebSocket command failed'))
          } else {
            pending.resolve(message.result)
          }
        }
      })

      socket.addEventListener('error', () => rejectConnect(new Error('Home Assistant WebSocket error')))
    })
  }
}

async function getEntries(client: HomeAssistantClient) {
  return await client.ws<ConfigEntrySummary[]>({ type: 'config_entries/get' })
}

function findEntry(entries: ConfigEntrySummary[], domain: string, title: string) {
  const entry = entries.find((candidate) => candidate.domain === domain && candidate.title === title)
  if (!entry) throw new Error(`Could not find config entry ${domain} / ${title}`)
  return entry
}

async function startOptions(client: HomeAssistantClient, entryId: string) {
  return await client.api<FlowResult>('POST', 'config/config_entries/options/flow', {
    handler: entryId,
    show_advanced_options: false,
  })
}

async function postOptions(client: HomeAssistantClient, flowId: string, payload: Record<string, JsonValue>) {
  return await client.api<FlowResult>('POST', `config/config_entries/options/flow/${flowId}`, payload)
}

async function cancelOptions(client: HomeAssistantClient, flowId: string) {
  try {
    await client.api('DELETE', `config/config_entries/options/flow/${flowId}`)
  } catch {
    // Flow may already have completed.
  }
}

async function entityExists(client: HomeAssistantClient, entityId: string) {
  try {
    await client.api<unknown>('GET', `states/${encodeURIComponent(entityId)}`)
    return true
  } catch (err) {
    if (err instanceof Error && /404/.test(err.message)) return false
    throw err
  }
}

async function preflightValidateEntities(client: HomeAssistantClient, manifest: MigrationManifest) {
  const errors: string[] = []
  const warnings: string[] = []
  const newEntities = Object.values(manifest.entitySwaps)
  const checked = new Set<string>()

  // Entities scheduled to be created by this migration: skip "must exist" check for them,
  // but flag if they ALREADY exist (idempotency / conflict).
  const willBeCreatedRlc = new Set<string>()
  for (const item of manifest.realLastChanged.create) {
    // RLC creates an entity whose entity_id mirrors the unique_id (e.g. sensor.<unique_id>).
    // We can't fully predict the entity_id without the unique_id, but the convention in this
    // codebase is sensor.<source-without-domain-prefix> with "_presence"->"_occupancy" already applied.
    // Simpler: treat any entitySwap target that points at a sensor whose source binary is in the
    // RLC create list as "will be created".
    // Map source binary -> expected RLC sensor entity_id by replacing "binary_sensor." with "sensor."
    // and stripping the "_occupancy" suffix variations is not deterministic. Instead, the migration
    // author specifies them via entitySwaps; we accept missing-but-pending if the target sensor's
    // base name matches the source binary base name.
    const base = item.sourceEntity.replace(/^binary_sensor\./, '')
    willBeCreatedRlc.add(`sensor.${base}`)
  }

  for (const entityId of newEntities) {
    if (checked.has(entityId)) continue
    checked.add(entityId)
    const exists = await entityExists(client, entityId)
    if (!exists) {
      if (willBeCreatedRlc.has(entityId)) {
        warnings.push(`Pending RLC create will produce ${entityId} (skipping existence check)`)
      } else {
        errors.push(`New entity not found in HA: ${entityId}`)
      }
    }
  }

  for (const entityId of manifest.removeEntities) {
    const exists = await entityExists(client, entityId)
    if (!exists) warnings.push(`Removal target already absent (will skip): ${entityId}`)
  }

  for (const item of manifest.realLastChanged.create) {
    const exists = await entityExists(client, item.sourceEntity)
    if (!exists) errors.push(`RLC source entity not found in HA: ${item.sourceEntity}`)
  }

  return { errors, warnings }
}

function findRlcEntries(entries: ConfigEntrySummary[]) {
  return entries.filter((candidate) => candidate.domain === 'real_last_changed')
}

async function getRlcSourceEntities(client: HomeAssistantClient, entries: ConfigEntrySummary[]) {
  const map = new Map<string, ConfigEntrySummary>()
  for (const entry of findRlcEntries(entries)) {
    if (typeof entry.data?.source_entity === 'string') {
      map.set(entry.data.source_entity, entry)
    }

    if (Array.isArray(entry.data?.source_entities)) {
      for (const source of entry.data.source_entities) {
        if (typeof source === 'string') map.set(source, entry)
      }
    }

    const match = entry.title.match(/^Real Last Changed: (.+)$/)
    if (match) map.set(match[1], entry)
  }
  void client
  return map
}

async function planRealLastChanged(
  client: HomeAssistantClient,
  entries: ConfigEntrySummary[],
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
) {
  const actions: string[] = []
  const warnings: string[] = []
  const sourceMap = await getRlcSourceEntities(client, entries)
  const existingRlcTitles = new Set(findRlcEntries(entries).map((entry) => entry.title))
  const rlcCreateExists = (item: RealLastChangedCreate) => sourceMap.has(item.sourceEntity) || existingRlcTitles.has(item.name)

  const intendedActions = {
    delete: [] as Array<{ source: string; entry_id: string }>,
    create: manifest.realLastChanged.create.filter((item) => !rlcCreateExists(item)),
    skippedCreate: manifest.realLastChanged.create.filter((item) => rlcCreateExists(item)),
    missingDelete: [] as string[],
  }

  for (const source of new Set(manifest.realLastChanged.deleteSources)) {
    const entry = sourceMap.get(source)
    if (entry) {
      intendedActions.delete.push({ source, entry_id: entry.entry_id })
      actions.push(`${dryRun ? 'would delete' : 'delete'} RLC entry for ${source}`)
      if (!dryRun) await client.api('DELETE', `config/config_entries/entry/${entry.entry_id}`)
    } else {
      intendedActions.missingDelete.push(source)
      warnings.push(`RLC delete target absent (skipping): ${source}`)
    }
  }

  for (const item of manifest.realLastChanged.create) {
    if (rlcCreateExists(item)) {
      warnings.push(`RLC create target already exists (skipping): ${item.sourceEntity}`)
      continue
    }
    actions.push(`${dryRun ? 'would create' : 'create'} RLC entry for ${item.sourceEntity}`)
    if (!dryRun) {
      let flow = await client.api<FlowResult>('POST', 'config/config_entries/flow', {
        handler: 'real_last_changed',
        show_advanced_options: false,
      })
      flow = await client.api<FlowResult>('POST', `config/config_entries/flow/${flow.flow_id}`, { next_step_id: 'single' })
      await client.api('POST', `config/config_entries/flow/${flow.flow_id}`, {
        source_entity: item.sourceEntity,
        name: item.name,
      })
    }
  }

  const artifactPath = await backupSnapshot(backupRoot, 'rlc-plan', 'all', intendedActions)
  actions.push(`plan saved: ${artifactPath}`)

  return {
    phase: 'real-last-changed',
    changed: actions.length > 0,
    actions,
    warnings,
  } satisfies PhaseReport
}

const FLOW_END_TYPES = new Set(['create_entry', 'abort'])
const FLOW_MENU_TYPES = new Set(['menu'])
const FLOW_FORM_TYPES = new Set(['form'])

async function walkOptionsFlow(
  client: HomeAssistantClient,
  entries: ConfigEntrySummary[],
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
  config: {
    domain: string
    title: string
    target: string
    navigation?: Record<string, JsonValue>[]
    /** When true, walk through all forms automatically, transforming defaults. Otherwise, only transform the first form. */
    walkAllForms?: boolean
    /** Maximum forms to walk (safety). */
    maxForms?: number
  },
): Promise<PhaseReport> {
  const entry = findEntry(entries, config.domain, config.title)
  const flow = await startOptions(client, entry.entry_id)
  let current = flow
  const actions: string[] = [`start options flow ${current.step_id ?? current.type}`]
  const payloads: Record<string, JsonValue>[] = []
  const stats = makeStats()
  const warnings: string[] = []
  const errors: string[] = []
  const maxForms = config.maxForms ?? 10

  try {
    for (const payload of config.navigation ?? []) {
      current = await postOptions(client, current.flow_id, payload)
      actions.push(`navigate to ${current.step_id ?? current.type}`)
      if (FLOW_END_TYPES.has(current.type)) {
        warnings.push(`Flow ended unexpectedly during navigation at ${current.step_id ?? current.type}`)
        return { phase: 'config-flow-options', target: config.target, changed: false, actions, payloads, stats, warnings, errors }
      }
    }

    let formsProcessed = 0
    let changedAny = false

    while (FLOW_FORM_TYPES.has(current.type) && formsProcessed < maxForms) {
      const formStats = makeStats()
      const beforeSchema = current.data_schema
      const payload = schemaPayload(beforeSchema, manifest, formStats, warnings)
      const totals = countStats(formStats)
      const formChanged = totals.replacements > 0 || totals.removals > 0
      changedAny = changedAny || formChanged

      // Sanity: run the transform a second time on the produced payload; result should
      // be identical (no further swaps possible because new IDs are not in entitySwaps keys).
      const recheckStats = makeStats()
      const recheck = transformJson(JSON.parse(JSON.stringify(payload)) as JsonValue, manifest, recheckStats)
      const recheckTotals = countStats(recheckStats)
      if (recheckTotals.replacements > 0 || recheckTotals.removals > 0) {
        warnings.push(
          `Reproducibility check failed on form ${current.step_id ?? '?'}: re-applying transform produced more changes (replacements=${recheckTotals.replacements}, removals=${recheckTotals.removals}). Migration is not idempotent for this form.`,
        )
      }
      if (JSON.stringify(recheck) !== JSON.stringify(payload)) {
        warnings.push(
          `Reproducibility check produced different payload on form ${current.step_id ?? '?'}.`,
        )
      }

      // Save the form payload + schema snapshot for inspection.
      const formArtifact = await backupSnapshot(backupRoot, 'form-payload', `${config.target}-${current.step_id ?? formsProcessed}`, {
        step_id: current.step_id,
        schema: beforeSchema,
        payload,
        replacements: formStats.replacements,
        removals: formStats.removals,
      })
      actions.push(`form artifact: ${formArtifact}`)

      // Merge form stats into overall stats
      for (const [k, v] of Object.entries(formStats.replacements)) {
        stats.replacements[k] = (stats.replacements[k] ?? 0) + v
      }
      for (const [k, v] of Object.entries(formStats.removals)) {
        stats.removals[k] = (stats.removals[k] ?? 0) + v
      }

      payloads.push(payload)
      actions.push(`form ${current.step_id ?? '?'}: ${totals.replacements} replacements, ${totals.removals} removals`)

      if (dryRun) {
        // SAFETY: dry-run must never POST a form payload. Posting a form that turns out to be
        // the last step (or that auto-commits) will mutate HA state, and DELETE after
        // create_entry is a no-op. So we probe one form per call only and stop.
        actions.push('dry-run probe: not submitting (multi-form flows: apply mode walks all forms)')
        break
      }

      // Apply mode: advance through the flow.
      if (!config.walkAllForms) {
        // Single-form mode: submit once if changed, otherwise stop without submitting.
        if (formChanged) {
          current = await postOptions(client, current.flow_id, payload)
          actions.push(`submitted ${current.step_id ?? current.type}`)
        }
        break
      }

      current = await postOptions(client, current.flow_id, payload)
      actions.push(`submitted -> ${current.step_id ?? current.type}`)

      formsProcessed += 1

      if (FLOW_END_TYPES.has(current.type)) break
      if (FLOW_MENU_TYPES.has(current.type)) {
        warnings.push(`Unexpected menu after form at ${current.step_id ?? current.type}; stopping walk.`)
        break
      }
    }

    if (formsProcessed >= maxForms) {
      warnings.push(`Reached form walk limit (${maxForms}); flow may not have completed.`)
    }

    if (!dryRun && config.walkAllForms && !FLOW_END_TYPES.has(current.type)) {
      warnings.push(`Flow ended in state ${current.type}/${current.step_id ?? ''} without create_entry; review.`)
    }

    return {
      phase: 'config-flow-options',
      target: config.target,
      changed: changedAny,
      actions: [
        ...actions,
        dryRun
          ? config.walkAllForms
            ? 'dry-run probed first form only (multi-form: apply mode walks all forms)'
            : 'dry-run probed first form (cancelled)'
          : changedAny
            ? `applied flow (final state ${current.type}/${current.step_id ?? ''})`
            : 'no submit needed',
      ],
      payloads,
      stats,
      warnings,
      errors,
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
    return { phase: 'config-flow-options', target: config.target, changed: false, actions, payloads, stats, warnings, errors }
  } finally {
    if (dryRun) await cancelOptions(client, flow.flow_id)
  }
}

async function planThermostatContactSensors(
  client: HomeAssistantClient,
  entries: ConfigEntrySummary[],
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
) {
  const reports: PhaseReport[] = []
  for (const target of manifest.haTargets.thermostatContactSensors) {
    for (const area of target.areas) {
      reports.push(
        await walkOptionsFlow(client, entries, manifest, dryRun, backupRoot, {
          domain: 'thermostat_contact_sensors',
          title: target.title,
          target: `thermostat_contact_sensors / ${target.title} / ${area}`,
          navigation: [{ next_step_id: 'configure_area_sensors' }, { next_step_id: area }],
          walkAllForms: false,
        }),
      )
    }
  }
  return reports
}

async function planAreaOccupancy(
  client: HomeAssistantClient,
  entries: ConfigEntrySummary[],
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
) {
  const reports: PhaseReport[] = []
  for (const target of manifest.haTargets.areaOccupancy) {
    for (const area of target.areas) {
      reports.push(
        await walkOptionsFlow(client, entries, manifest, dryRun, backupRoot, {
          domain: 'area_occupancy',
          title: target.title,
          target: `area_occupancy / ${target.title} / ${area}`,
          navigation: [{ next_step_id: 'manage_areas' }, { selected_option: area }, { next_step_id: 'edit_area' }],
          walkAllForms: true,
          maxForms: 20,
        }),
      )
    }
  }
  return reports
}

async function backupSnapshot(backupRoot: string, kind: string, target: string, data: unknown) {
  await mkdir(backupRoot, { recursive: true })
  const safeTarget = target.replace(/[^\w.-]+/g, '_')
  const file = resolve(backupRoot, `${kind}-${safeTarget}.json`)
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}

async function planDashboards(
  client: HomeAssistantClient,
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
) {
  const reports: PhaseReport[] = []

  for (const dashboard of manifest.dashboards) {
    const config = await client.ws<JsonValue>({ type: 'lovelace/config', url_path: dashboard.urlPath, force: true })
    const backupFile = await backupSnapshot(backupRoot, 'dashboard-before', dashboard.urlPath, config)
    const stats = makeStats()
    const transformed = transformJson(config, manifest, stats) as JsonValue
    const transformedFile = await backupSnapshot(backupRoot, 'dashboard-after', dashboard.urlPath, transformed)
    const changed = JSON.stringify(config) !== JSON.stringify(transformed)
    const warnings: string[] = []
    const errors: string[] = []

    // Reproducibility check.
    const recheckStats = makeStats()
    const recheck = transformJson(JSON.parse(JSON.stringify(transformed)) as JsonValue, manifest, recheckStats) as JsonValue
    if (countStats(recheckStats).replacements > 0 || countStats(recheckStats).removals > 0 || JSON.stringify(recheck) !== JSON.stringify(transformed)) {
      warnings.push(`Dashboard ${dashboard.urlPath} transform is not idempotent.`)
    }

    // Shape validation: top-level keys + view count.
    const beforeKeys = config && typeof config === 'object' && !Array.isArray(config) ? Object.keys(config).sort() : []
    const afterKeys = transformed && typeof transformed === 'object' && !Array.isArray(transformed) ? Object.keys(transformed).sort() : []
    if (beforeKeys.join(',') !== afterKeys.join(',')) {
      errors.push(`Top-level keys changed: before=${beforeKeys.join(',')} after=${afterKeys.join(',')}`)
    }

    const beforeViews = (config as any)?.views?.length
    const afterViews = (transformed as any)?.views?.length
    if (beforeViews !== afterViews) {
      errors.push(`View count changed: before=${beforeViews} after=${afterViews}`)
    }

    if (!dryRun && changed && errors.length === 0) {
      await client.ws({ type: 'lovelace/config/save', url_path: dashboard.urlPath, config: transformed })
    }

    reports.push({
      phase: 'dashboard',
      target: dashboard.urlPath,
      changed,
      actions: [
        `backup saved: ${backupFile}`,
        `transformed saved: ${transformedFile}`,
        dryRun
          ? 'would save transformed Lovelace config'
          : errors.length > 0
            ? 'skipped save due to shape validation errors'
            : changed
              ? 'saved transformed Lovelace config'
              : 'no save needed',
      ],
      stats,
      warnings,
      errors,
    })
  }

  return reports
}

async function planAutomations(
  client: HomeAssistantClient,
  manifest: MigrationManifest,
  dryRun: boolean,
  backupRoot: string,
) {
  const reports: PhaseReport[] = []

  for (const entityId of manifest.automations) {
    const result = await client.ws<{ config: JsonValue }>({ type: 'automation/config', entity_id: entityId })
    const config = result.config as Record<string, JsonValue>
    const backupFile = await backupSnapshot(backupRoot, 'automation-before', entityId, config)
    const stats = makeStats()
    const transformed = transformJson(config, manifest, stats) as Record<string, JsonValue>
    const transformedFile = await backupSnapshot(backupRoot, 'automation-after', entityId, transformed)
    const changed = JSON.stringify(config) !== JSON.stringify(transformed)
    const errors: string[] = []
    const warnings: string[] = []

    const recheckStats = makeStats()
    const recheck = transformJson(JSON.parse(JSON.stringify(transformed)) as JsonValue, manifest, recheckStats) as Record<string, JsonValue>
    if (countStats(recheckStats).replacements > 0 || countStats(recheckStats).removals > 0 || JSON.stringify(recheck) !== JSON.stringify(transformed)) {
      warnings.push(`Automation ${entityId} transform is not idempotent.`)
    }

    const id = transformed.id
    if (typeof id !== 'string') {
      errors.push(`Automation ${entityId} config does not include string id`)
    }

    if (!dryRun && changed && errors.length === 0 && typeof id === 'string') {
      await client.api('POST', `config/automation/config/${id}`, transformed)
    }

    reports.push({
      phase: 'automation',
      target: entityId,
      changed,
      actions: [
        `backup saved: ${backupFile}`,
        `transformed saved: ${transformedFile}`,
        dryRun
          ? 'would save transformed automation config'
          : errors.length > 0
            ? 'skipped save due to errors'
            : changed
              ? 'saved transformed automation config'
              : 'no save needed',
      ],
      stats,
      warnings,
      errors,
    })
  }

  return reports
}

async function planReact(manifest: MigrationManifest, dryRun: boolean, backupRoot: string) {
  if (!manifest.react) return []

  const reports: PhaseReport[] = []
  const repo = resolve(manifest.react.repo)

  for (const file of manifest.react.files) {
    const path = resolve(repo, file)
    const text = await readFile(path, 'utf8')
    const backupFile = await backupSnapshot(backupRoot, 'react-before', file, text)
    const stats = makeStats()
    const transformed = transformText(text, manifest, stats)
    const transformedFile = await backupSnapshot(backupRoot, 'react-after', file, transformed)
    const changed = text !== transformed

    if (!dryRun && changed) await writeFile(path, transformed, 'utf8')

    const warnings =
      Object.keys(stats.removals).length > 0
        ? ['Removed entity IDs were found in React source; review manually before applying removals.']
        : []

    reports.push({
      phase: 'react-source',
      target: file,
      changed,
      actions: [
        `backup saved: ${backupFile}`,
        `transformed saved: ${transformedFile}`,
        dryRun ? 'would rewrite source file' : changed ? 'rewrote source file' : 'no rewrite needed',
      ],
      stats,
      warnings,
    })
  }

  if (manifest.react.wrapperDashboard && manifest.react.wrapperVersion) {
    reports.push({
      phase: 'react-deploy',
      target: manifest.react.wrapperDashboard,
      changed: true,
      actions: [
        'NOTE: build + SMB deploy + wrapper URL bump are NOT performed by this script.',
        'Run separately: npm run build, then SMB copy dist/, then bump wrapper card URL.',
        `target wrapper URL: /local/ha-sfenton-react-dash/index.html?v=${manifest.react.wrapperVersion}`,
      ],
    })
  }

  return reports
}

async function verifyNoOldReferences(
  client: HomeAssistantClient,
  manifest: MigrationManifest,
): Promise<PhaseReport> {
  const errors: string[] = []
  const oldIds = new Set([...Object.keys(manifest.entitySwaps), ...manifest.removeEntities])

  for (const dashboard of manifest.dashboards) {
    const config = await client.ws<JsonValue>({ type: 'lovelace/config', url_path: dashboard.urlPath, force: true })
    const json = JSON.stringify(config)
    for (const id of oldIds) {
      if (json.includes(`"${id}"`)) errors.push(`Dashboard ${dashboard.urlPath} still references ${id}`)
    }
  }

  for (const entityId of manifest.automations) {
    // Brief retry: automation reads can briefly return cached config right after save.
    let stale: string[] = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await client.ws<{ config: JsonValue }>({ type: 'automation/config', entity_id: entityId })
      const json = JSON.stringify(result.config)
      stale = [...oldIds].filter((id) => json.includes(`"${id}"`))
      if (stale.length === 0) break
      await new Promise((r) => setTimeout(r, 500))
    }
    for (const id of stale) errors.push(`Automation ${entityId} still references ${id}`)
  }

  return {
    phase: 'verify',
    changed: false,
    actions: [errors.length === 0 ? 'no stale references found in dashboards/automations' : 'STALE REFERENCES DETECTED'],
    errors,
  }
}

function printReport(manifest: MigrationManifest, mode: RunMode, reports: PhaseReport[]) {
  console.info(`MODE: ${mode}  MIGRATION: ${manifest.name}`)

  let totalErrors = 0
  let totalWarnings = 0

  for (const report of reports) {
    console.info(`\n[${report.phase}]${report.target ? ` ${report.target}` : ''}`)
    if (typeof report.changed === 'boolean') console.info(`changed: ${report.changed}`)
    for (const action of report.actions ?? []) console.info(`- ${action}`)
    if (report.stats) {
      const totals = countStats(report.stats)
      console.info(`replacements: ${totals.replacements}, removals: ${totals.removals}`)
      for (const [key, count] of Object.entries(report.stats.replacements)) console.info(`  replace ${key}: ${count}`)
      for (const [key, count] of Object.entries(report.stats.removals)) console.info(`  remove ${key}: ${count}`)
    }
    for (const warning of report.warnings ?? []) {
      console.info(`WARNING: ${warning}`)
      totalWarnings += 1
    }
    for (const error of report.errors ?? []) {
      console.info(`ERROR: ${error}`)
      totalErrors += 1
    }
  }

  console.info(`\nTotals: ${totalErrors} errors, ${totalWarnings} warnings`)
  return { totalErrors, totalWarnings }
}

async function main() {
  const args = parseArgs()
  const fileEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.development') }
  const haUrl = args.haUrl ?? process.env.VITE_HA_URL ?? fileEnv.VITE_HA_URL
  const haToken = args.haToken ?? process.env.VITE_HA_TOKEN ?? fileEnv.VITE_HA_TOKEN
  if (!haUrl) throw new Error('Missing Home Assistant URL. Set VITE_HA_URL or pass --ha-url.')
  if (!haToken) throw new Error('Missing Home Assistant token. Set VITE_HA_TOKEN or pass --ha-token.')

  const manifest = await loadManifest(args.manifestPath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupRoot = resolve(args.backupDir, manifest.name, timestamp)

  const dryRun = args.mode === 'dry-run'
  const applyHaConfig = args.mode === 'apply-ha-config'
  const applyReact = args.mode === 'apply-react'

  const client = new HomeAssistantClient(haUrl, haToken)
  const reports: PhaseReport[] = []

  try {
    console.info(`Backup root: ${backupRoot}`)
    if (args.preApply) {
      console.info('Mode: PRE-APPLY (dry-run with full artifact dump for review)')
    }

    // Preflight: validate new entities exist.
    const preflight = await preflightValidateEntities(client, manifest)
    reports.push({
      phase: 'preflight',
      changed: false,
      actions: [`validated ${Object.keys(manifest.entitySwaps).length} swaps, ${manifest.removeEntities.length} removals, ${manifest.realLastChanged.create.length} RLC creates`],
      warnings: preflight.warnings,
      errors: preflight.errors,
    })

    if (preflight.errors.length > 0) {
      console.info('\nPreflight errors detected; aborting before any mutations.')
      printReport(manifest, args.mode, reports)
      client.close()
      process.exitCode = 1
      return
    }

    if (dryRun || applyHaConfig) {
      const entries = await getEntries(client)

      reports.push(await planRealLastChanged(client, entries, manifest, dryRun, backupRoot))

      for (const title of manifest.haTargets.helperGroups) {
        reports.push(
          await walkOptionsFlow(client, entries, manifest, dryRun, backupRoot, {
            domain: 'group',
            title,
            target: `group / ${title}`,
            walkAllForms: false,
          }),
        )
      }

      for (const target of manifest.haTargets.presenceBasedLighting) {
        reports.push(
          await walkOptionsFlow(client, entries, manifest, dryRun, backupRoot, {
            domain: 'presence_based_lighting',
            title: target.title,
            target: `presence_based_lighting / ${target.title}`,
            walkAllForms: true,
            maxForms: 8,
          }),
        )
      }

      reports.push(...(await planThermostatContactSensors(client, entries, manifest, dryRun, backupRoot)))
      reports.push(...(await planAreaOccupancy(client, entries, manifest, dryRun, backupRoot)))
      reports.push(...(await planDashboards(client, manifest, dryRun, backupRoot)))
      reports.push(...(await planAutomations(client, manifest, dryRun, backupRoot)))

      if (applyHaConfig) {
        reports.push(await verifyNoOldReferences(client, manifest))
      }
    }

    if (dryRun || applyReact) {
      reports.push(...(await planReact(manifest, dryRun, backupRoot)))
    }

    const { totalErrors } = printReport(manifest, args.mode, reports)
    if (args.preApply) {
      console.info('\n=== PRE-APPLY ARTIFACT SUMMARY ===')
      console.info(`Inspect everything in: ${backupRoot}`)
      console.info('  *-before.json: current HA state, saved as a rollback reference')
      console.info('  *-after.json: what we would write')
      console.info('  form-payload-*.json: per-form HA option flow payload + schema')
      console.info('  rlc-plan-all.json: RLC create/delete plan')
      console.info('Diff *-before.json vs *-after.json to verify changes before --apply-ha-config.')
    }
    if (totalErrors > 0) process.exitCode = 1
  } finally {
    client.close()
  }
}

await main()

export { buildManifestFromSensors, CURRENT_MIGRATION }
