import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadRuntimeEnvironment } from '../lib/runtimeEnv'
import { MANUAL_ARTICLES } from '../../src/manual/catalog'
import type { ManualHaCatalogItem, ManualHaCategorySummary, ManualHaInventory, ManualHaSummary, ManualIntegrationCatalogItem } from '../../src/manual/types'
import {
  buildBehaviorOwnershipAudit,
  normalizedBehaviorOwnershipAudit,
  type ManualBehaviorOwnershipAudit,
} from './behaviorOwnership'
import { manualHaSummaryGeneratedAt } from './haSummary'

interface HassState {
  entity_id: string
  attributes?: {
    friendly_name?: string
  }
}

interface HassConfigEntry {
  domain: string
}

interface HassServiceRegistry {
  [domain: string]: Record<string, unknown>
}

function categoryFor(value: string) {
  const text = value.toLowerCase()
  if (/presence|light|illumin|relay/.test(text)) return 'Lighting & Presence'
  if (/thermostat|climate|humid|air purifier|aqi|fan|temperature|vent/.test(text)) return 'Climate & Air'
  if (/alarm|security|lock|camera|frigate|doorbell|garage/.test(text)) return 'Security & Access'
  if (/food|recipe|grocery|dishwasher|chore|task|donetick|todo/.test(text)) return 'Food, Chores & Tasks'
  if (/vacuum|valetudo|roborock|mop/.test(text)) return 'Cleaning & Vacuums'
  if (/sleep|bed|wake|alarm/.test(text)) return 'Sleep & Wake'
  if (/media|tv|shield|apple|sonos|projector|avr|xbox|nintendo|pc/.test(text)) return 'Media & Computers'
  if (/vacation|guest|away/.test(text)) return 'Guest & Vacation'
  if (/washer|dryer|grill|mach|ford|sprinkler/.test(text)) return 'Appliances & Vehicle'
  return 'Reliability & Internal'
}

function integrationCategory(domain: string) {
  if (['adaptive_lighting', 'hue', 'matter', 'mqtt', 'presence_based_lighting', 'zha'].includes(domain)) return 'Lighting & Presence'
  if (['ecobee', 'esphome', 'flair', 'thermostat_contact_sensors', 'vesync'].includes(domain)) return 'Climate & Air'
  if (['donetick', 'evershelf', 'local_todo', 'shopping_list'].includes(domain)) return 'Food, Chores & Tasks'
  if (['roborock', 'valetudo'].includes(domain)) return 'Cleaning & Vacuums'
  if (['frigate', 'go2rtc', 'homekit_controller', 'reolink', 'webrtc'].includes(domain)) return 'Security & Cameras'
  if (['androidtv', 'androidtv_remote', 'apple_tv', 'sonos', 'sony_projector_adcp', 'webostv', 'yamaha_musiccast'].includes(domain)) return 'Media & Entertainment'
  if (['fordpass', 'home_connect', 'traeger'].includes(domain)) return 'Appliances & Vehicle'
  if (['met', 'pirateweather'].includes(domain)) return 'Weather'
  return 'Home Assistant & Infrastructure'
}

function classificationFor(id: string, name: string, sourceCorpus: string, kind: 'automation' | 'script'): ManualHaCatalogItem['classification'] {
  const objectId = id.split('.')[1] ?? ''
  if (sourceCorpus.includes(id) || sourceCorpus.includes(`'${objectId}'`) || sourceCorpus.includes(`"${objectId}"`)) return 'app-facing'
  if (kind === 'automation') return 'background-user-facing'
  return /worker|mapping|sync|navigate|summary[_\s-]*unused/i.test(`${id} ${name}`) ? 'internal' : 'background-user-facing'
}

function normalizedInventory(inventory: ManualHaInventory) {
  return { ...inventory, generatedAt: '' }
}

function categorySummaries(items: { category: string }[]): ManualHaCategorySummary[] {
  return [...new Set(items.map((item) => item.category))].sort().map((category) => ({
    category,
    count: items.filter((item) => item.category === category).length,
  }))
}

function publicSummary(inventory: ManualHaInventory): ManualHaSummary {
  return {
    generatedAt: manualHaSummaryGeneratedAt(inventory.generatedAt),
    counts: {
      automations: inventory.counts.automations,
      integrationDomains: inventory.counts.integrationDomains,
      integrationInstances: inventory.counts.integrationInstances,
      scripts: inventory.counts.scripts,
      todoLists: inventory.counts.todoLists,
    },
    automationCategories: categorySummaries(inventory.automations),
    integrationCategories: [...new Set(inventory.integrations.map((item) => item.category))].sort().map((category) => {
      const items = inventory.integrations.filter((item) => item.category === category)
      return {
        category,
        count: items.length,
        instances: items.reduce((total, item) => total + item.instances, 0),
      }
    }),
    scriptCategories: categorySummaries(inventory.scripts),
    expectedDependencies: {
      recipeDetail: inventory.services.includes('evershelf.recipe_detail'),
      recipeGroceryAdd: inventory.services.includes('evershelf.recipe_grocery_add'),
      recipeHydration: inventory.services.includes('evershelf.recipe_hydration'),
      recipeQuery: inventory.services.includes('evershelf.recipe_query'),
      vacuumAreaScripts: [
        'script.main_floor_vacuum_clean_zone',
        'script.music_room_vacuum_clean_zone',
        'script.theater_room_vacuum_clean_zone',
      ].every((id) => inventory.scripts.some((script) => script.id === id)),
    },
  }
}

async function sourceCorpus(directory = resolve(process.cwd(), 'src')): Promise<string> {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(directory, { withFileTypes: true })
  const chunks: string[] = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue
      chunks.push(await sourceCorpus(path))
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    chunks.push(await readFile(path, 'utf8'))
  }
  return chunks.join('\n')
}

async function getJson<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Home Assistant request failed for ${path}: ${response.status}`)
  return response.json() as Promise<T>
}

function configEntries(baseUrl: string, token: string): Promise<HassConfigEntry[]> {
  return new Promise((resolvePromise, reject) => {
    const socketUrl = `${baseUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/api/websocket`
    const socket = new WebSocket(socketUrl)
    const timeout = setTimeout(() => {
      socket.close()
      reject(new Error('Home Assistant config-entry request timed out'))
    }, 15000)
    let requestId = 1

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { type: string; success?: boolean; result?: HassConfigEntry[] }
      if (message.type === 'auth_required') {
        socket.send(JSON.stringify({ type: 'auth', access_token: token }))
        return
      }
      if (message.type === 'auth_invalid') {
        clearTimeout(timeout)
        socket.close()
        reject(new Error('Home Assistant authentication failed'))
        return
      }
      if (message.type === 'auth_ok') {
        socket.send(JSON.stringify({ id: requestId, type: 'config_entries/get' }))
        requestId += 1
        return
      }
      if (message.type === 'result') {
        clearTimeout(timeout)
        socket.close()
        if (!message.success || !Array.isArray(message.result)) reject(new Error('Home Assistant config-entry inventory failed'))
        else resolvePromise(message.result)
      }
    }
    socket.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Home Assistant websocket connection failed'))
    }
  })
}

async function buildInventory(): Promise<ManualHaInventory> {
  loadRuntimeEnvironment()
  const baseUrl = process.env.VITE_HA_URL
  const token = process.env.VITE_HA_TOKEN
  if (!baseUrl || !token) throw new Error('VITE_HA_URL and VITE_HA_TOKEN are required for the App Manual HA inventory.')

  const [config, states, services, entries, corpus] = await Promise.all([
    getJson<{ version: string }>(baseUrl, token, '/api/config'),
    getJson<HassState[]>(baseUrl, token, '/api/states'),
    getJson<HassServiceRegistry>(baseUrl, token, '/api/services'),
    configEntries(baseUrl, token),
    sourceCorpus(),
  ])

  const automationStates = states.filter((state) => state.entity_id.startsWith('automation.'))
  const scriptStates = states.filter((state) => state.entity_id.startsWith('script.'))
  const todoStates = states.filter((state) => state.entity_id.startsWith('todo.'))
  const integrationCounts = new Map<string, number>()
  for (const entry of entries) integrationCounts.set(entry.domain, (integrationCounts.get(entry.domain) ?? 0) + 1)
  const integrations: ManualIntegrationCatalogItem[] = [...integrationCounts.entries()]
    .map(([domain, instances]) => ({ category: integrationCategory(domain), domain, instances }))
    .sort((left, right) => left.category.localeCompare(right.category) || left.domain.localeCompare(right.domain))
  const catalog = (items: HassState[], kind: 'automation' | 'script'): ManualHaCatalogItem[] => items.map((item) => {
    const name = item.attributes?.friendly_name?.trim() || item.entity_id
    return {
      category: categoryFor(`${item.entity_id} ${name}`),
      classification: classificationFor(item.entity_id, name, corpus, kind),
      id: item.entity_id,
      name,
    }
  }).sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name))
  const flattenedServices = Object.entries(services).flatMap(([domain, domainServices]) => Object.keys(domainServices).map((service) => `${domain}.${service}`)).sort()

  return {
    generatedAt: new Date().toISOString(),
    homeAssistantVersion: config.version,
    counts: {
      automations: automationStates.length,
      entities: states.length,
      integrationDomains: integrationCounts.size,
      integrationInstances: entries.length,
      scripts: scriptStates.length,
      todoLists: todoStates.length,
    },
    automations: catalog(automationStates, 'automation'),
    integrations,
    scripts: catalog(scriptStates, 'script'),
    services: flattenedServices,
  }
}

function summarySource(summary: ManualHaSummary) {
  return `import type { ManualHaSummary } from '../types'\n\nexport const MANUAL_HA_SUMMARY = ${JSON.stringify(summary, null, 2)} satisfies ManualHaSummary\n`
}

const auditDirectory = resolve(process.cwd(), 'scripts/manual/generated')
const auditPath = resolve(auditDirectory, 'haInventory.json')
const behaviorAuditPath = resolve(auditDirectory, 'behaviorOwnershipAudit.json')
const summaryPath = resolve(process.cwd(), 'src/manual/generated/haInventory.ts')
const check = process.argv.includes('--check')
const inventory = await buildInventory()
const summary = publicSummary(inventory)
const behaviorOwnership = buildBehaviorOwnershipAudit(inventory, MANUAL_ARTICLES)

if (behaviorOwnership.errors.length > 0) {
  throw new Error(`Home Assistant behavior ownership review failed:\n- ${behaviorOwnership.errors.join('\n- ')}`)
}

if (check) {
  const current = JSON.parse(await readFile(auditPath, 'utf8')) as ManualHaInventory
  const currentBehaviorAudit = JSON.parse(await readFile(behaviorAuditPath, 'utf8')) as ManualBehaviorOwnershipAudit
  const currentSummaryModule = await import(`../../src/manual/generated/haInventory.ts?manual-check=${Date.now()}`)
  const currentSummary = currentSummaryModule.MANUAL_HA_SUMMARY as ManualHaSummary
  const ageMs = Date.now() - new Date(current.generatedAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('The committed App Manual HA inventory is older than seven days. Run npm run manual:sync:ha.')
  }
  if (JSON.stringify(normalizedInventory(current)) !== JSON.stringify(normalizedInventory(inventory))) {
    throw new Error('The live Home Assistant inventory differs from the committed App Manual snapshot. Run npm run manual:sync:ha and review the manual impact.')
  }
  if (JSON.stringify(currentSummary) !== JSON.stringify(publicSummary(current))) {
    throw new Error('The deployed App Manual HA summary does not match the private release audit. Run npm run manual:sync:ha.')
  }
  if (JSON.stringify(normalizedBehaviorOwnershipAudit(currentBehaviorAudit)) !== JSON.stringify(normalizedBehaviorOwnershipAudit(behaviorOwnership.audit))) {
    throw new Error('The private Home Assistant behavior ownership audit is stale. Run npm run manual:sync:ha after reviewing ownership.')
  }
  console.log(`App Manual HA inventory matches live Home Assistant ${inventory.homeAssistantVersion}.`)
  console.log(`Behavior ownership covers ${behaviorOwnership.audit.counts.mappedUserFacing}/${behaviorOwnership.audit.counts.userFacing} user-facing items and explicitly reviews ${behaviorOwnership.audit.counts.reviewedInternal}/${behaviorOwnership.audit.counts.internal} internal items.`)
} else {
  await mkdir(auditDirectory, { recursive: true })
  await writeFile(auditPath, `${JSON.stringify(inventory, null, 2)}\n`)
  await writeFile(behaviorAuditPath, `${JSON.stringify(behaviorOwnership.audit, null, 2)}\n`)
  await writeFile(summaryPath, summarySource(summary))
  console.log(`Wrote App Manual HA inventory with ${inventory.counts.automations} automations, ${inventory.counts.scripts} scripts, and ${inventory.counts.integrationInstances} integration instances.`)
  console.log(`Wrote private behavior ownership audit for ${behaviorOwnership.audit.counts.mappedUserFacing} user-facing and ${behaviorOwnership.audit.counts.reviewedInternal} internal Home Assistant items.`)
}
