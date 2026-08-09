import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

export interface ManualAppInventory {
  entities: string[]
  routes: string[]
  services: string[]
}

const ENTITY_ID_PATTERN = /^(?:alarm_control_panel|automation|binary_sensor|button|calendar|camera|climate|counter|cover|device_tracker|event|fan|humidifier|image|input_boolean|input_button|input_datetime|input_number|input_select|input_text|light|lock|media_player|number|person|remote|scene|schedule|script|select|sensor|siren|switch|text|time|timer|todo|update|vacuum|valve|weather|zone)\.[a-z0-9_]+$/
const IGNORED_ENTITY_IDS = new Set([
  'sensor.react_dash_optional_entity_not_configured',
])

export function isManualAppInventoryEntityId(value: string) {
  return ENTITY_ID_PATTERN.test(value) && !IGNORED_ENTITY_IDS.has(value)
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const output: string[] = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue
      output.push(...await sourceFiles(path))
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    if (entry.name.includes('.test.')) continue
    output.push(path)
  }
  return output
}

function propertyName(property: ts.ObjectLiteralElementLike) {
  if (!('name' in property) || !property.name) return undefined
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text
  return undefined
}

function literalValue(property: ts.ObjectLiteralElementLike) {
  if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) return undefined
  return property.initializer.text
}

export async function collectManualAppInventory(root = process.cwd()): Promise<ManualAppInventory> {
  const files = await sourceFiles(resolve(root, 'src'))
  const entities = new Set<string>()
  const services = new Set<string>()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) && isManualAppInventoryEntityId(node.text)) entities.add(node.text)
      if (ts.isObjectLiteralExpression(node)) {
        const domainProperty = node.properties.find((property) => propertyName(property) === 'domain')
        const serviceProperty = node.properties.find((property) => propertyName(property) === 'service')
        const domain = domainProperty ? literalValue(domainProperty) : undefined
        const service = serviceProperty ? literalValue(serviceProperty) : undefined
        if (domain && service) services.add(`${domain}.${service}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }

  const routesModule = await import('../../src/constants/routes.ts')
  return {
    entities: [...entities].sort(),
    routes: routesModule.DASHBOARD_ROUTES.map((route: { path: string }) => route.path).sort(),
    services: [...services].sort(),
  }
}
