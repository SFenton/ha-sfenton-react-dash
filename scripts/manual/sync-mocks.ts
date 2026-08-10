import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { explicitMockEntities } from '../../src/test/mocks/hakitCoreState'
import { loadRuntimeEnvironment } from '../lib/runtimeEnv'
import {
  buildSyntheticMockEntities,
  formatEntityDomainCounts,
  serializeSyntheticMockFixture,
  syntheticMockAuditErrors,
  type LiveHassState,
} from './mockFixture'
import type { ManualAppInventory } from './appInventory'

const appInventoryPath = resolve(process.cwd(), 'src/manual/generated/appInventory.json')
const generatedFixturePath = resolve(process.cwd(), 'src/test/mocks/generated/appEntities.ts')

async function fetchLiveStates(baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/states`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Home Assistant state request failed with status ${response.status}.`)
  const states = await response.json()
  if (!Array.isArray(states)) throw new Error('Home Assistant state request returned an unexpected response.')
  return states as LiveHassState[]
}

loadRuntimeEnvironment()
const baseUrl = process.env.VITE_HA_URL?.trim()
const token = process.env.VITE_HA_TOKEN?.trim()
if (!baseUrl || !token) throw new Error('VITE_HA_URL and VITE_HA_TOKEN are required for App Manual mock sync.')

const appInventory = JSON.parse(await readFile(appInventoryPath, 'utf8')) as ManualAppInventory
const explicitEntityIds = new Set(Object.keys(explicitMockEntities))
const liveStates = await fetchLiveStates(baseUrl, token)
const { entities, staleEntityIds } = buildSyntheticMockEntities(appInventory.entities, explicitEntityIds, liveStates)

if (staleEntityIds.length > 0) {
  throw new Error([
    `Live Home Assistant is missing ${staleEntityIds.length} app-referenced entity IDs:`,
    ...staleEntityIds.map((entityId) => `- ${entityId}`),
  ].join('\n'))
}

const auditErrors = syntheticMockAuditErrors(entities)
if (auditErrors.length > 0) throw new Error(`Generated mock sanitization failed:\n- ${auditErrors.join('\n- ')}`)

await writeFile(generatedFixturePath, serializeSyntheticMockFixture(entities))

const generatedCount = Object.keys(entities).length
const explicitCount = explicitEntityIds.size
console.log(`Wrote ${generatedCount} privacy-sanitized generated mock entities for ${appInventory.entities.length} app references.`)
console.log(`Mock entity maps: ${explicitCount} explicit, ${generatedCount} generated, ${explicitCount + generatedCount} merged; 0 stale live IDs.`)
console.log(`Generated counts by domain: ${formatEntityDomainCounts(Object.keys(entities))}.`)
