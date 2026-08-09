import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectDerivedSurfaceInventory, serializeDerivedSurfaceInventory } from '../../src/manual/surfaceInventory'
import { collectManualAppInventory } from './appInventory'

const appInventoryPath = resolve(process.cwd(), 'src/manual/generated/appInventory.json')
const surfaceInventoryPath = resolve(process.cwd(), 'src/manual/generated/surfaceInventory.json')
const appInventory = await collectManualAppInventory()
const surfaceInventory = collectDerivedSurfaceInventory()

await Promise.all([
  writeFile(appInventoryPath, `${JSON.stringify(appInventory, null, 2)}\n`),
  writeFile(surfaceInventoryPath, serializeDerivedSurfaceInventory(surfaceInventory)),
])

console.log(`Wrote App Manual app inventory with ${appInventory.routes.length} routes, ${appInventory.entities.length} entities, and ${appInventory.services.length} service pairs.`)
console.log(`Wrote App Manual surface inventory with ${surfaceInventory.counts.total} derived surfaces.`)
