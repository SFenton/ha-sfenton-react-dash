import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const INVENTORY_VERSION = 1
const BASELINE_VERSION = 2
const ROOT = process.cwd()
const INVENTORY_PATH = 'scripts/i18n/generated/copy-inventory.json'
const BASELINE_PATH = 'scripts/i18n/generated/legacy-copy-baseline.json'

const EXCLUDED_FILE_PARTS = [
  '/src/i18n/',
] as const

const EXCLUDED_PROPERTY_NAMES = new Set([
  'behavior',
  'className',
  'domain',
  'entityId',
  'exceptionReason',
  'externalPath',
  'hash',
  'icon',
  'id',
  'implementation',
  'kind',
  'path',
  'route',
  'routePath',
  'selector',
  'service',
  'sourceReference',
  'state',
  'states',
  'target',
  'tone',
  'type',
  'value',
])

const VISIBLE_NAMES = new Set([
  'accessibleLabel',
  'actionText',
  'activeTitle',
  'alt',
  'aria-description',
  'aria-label',
  'aria-valuetext',
  'ariaDescription',
  'ariaLabel',
  'ariaValueText',
  'backLabel',
  'buttonLabel',
  'caption',
  'closedLabel',
  'decrementLabel',
  'description',
  'emptyDescription',
  'emptyLabel',
  'emptyText',
  'emptyTitle',
  'error',
  'errorText',
  'fallback',
  'gridLabel',
  'handleAriaLabel',
  'heading',
  'helperText',
  'hint',
  'inactiveTitle',
  'incrementLabel',
  'itemsTitle',
  'label',
  'loadingText',
  'message',
  'modalTitle',
  'noResultsText',
  'note',
  'notice',
  'openLabel',
  'panelLabel',
  'placeholder',
  'primaryText',
  'question',
  'readOnlyText',
  'remoteTitle',
  'roomTitle',
  'secondaryText',
  'sectionTitle',
  'stateText',
  'statusLabel',
  'subject',
  'subtitle',
  'summary',
  'summaryLabel',
  'text',
  'title',
  'tooltip',
  'unavailableLabel',
  'volumeTitle',
])

const MICRO_COPY = new Set([
  'Add',
  'Apply',
  'Audio',
  'Away',
  'Back',
  'Cancel',
  'Clear',
  'Close',
  'Days',
  'Delete',
  'Done',
  'Edit',
  'Home',
  'Muted',
  'Next',
  'Off',
  'On',
  'Previous',
  'Profile',
  'Record',
  'Recording',
  'Reset',
  'Save',
  'Search',
  'Security',
  'Settings',
  'Snapshot',
])

const TECHNICAL_PATTERNS = [
  /^(?:mdi|http|https|app|entityId|settings):/,
  /^(?:camera|light|sensor|binary_sensor|switch|input_|automation|script|climate|cover|lock|fan|vacuum|media_player|todo|button|select|number|person|group|weather|device_tracker|alarm_control_panel|counter|timer|image)\./,
  /^#[a-z0-9-]+$/i,
  /^\/?(?:api|assets|at-a-glance|config|hacsfiles|local|lovelace|sfenton-react-dash|webrtc)(?:\/|$)/,
  /^(?:--|rgba?\(|#[0-9a-f]{3,8}$|\d+(?:\.\d+)?(?:ms|px|rem|s|vh|vw|%)?)$/i,
  /^[A-Z0-9_]+$/,
  /^[a-z0-9]+(?:[._/-][a-z0-9]+)+$/,
] as const

type CopyOrigin = 'catalog' | 'document' | 'legacy'

export interface CopyInventoryRecord {
  characters: number
  context: string
  file: string
  id: string
  lines: number[]
  occurrences: number
  origin: CopyOrigin
  placeholders: string[]
  value: string
  words: number
}

interface CopyInventory {
  exclusions: {
    dynamicBackendText: true
    tests: true
  }
  records: CopyInventoryRecord[]
  summary: {
    catalogRecords: number
    documentRecords: number
    legacyOccurrences: number
    legacyRecords: number
    totalRecords: number
  }
  version: number
}

interface LegacyBaseline {
  allowedIds: string[]
  maxOccurrencesById: Record<string, number>
  maxOccurrences: number
  version: number
}

function normalizePath(path: string) {
  return path.replaceAll('\\', '/')
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

function excludedSourceFile(path: string) {
  const normalized = normalizePath(path)
  return path.endsWith('.test.ts')
    || path.endsWith('.test.tsx')
    || EXCLUDED_FILE_PARTS.some((part) => normalized.includes(part))
}

function resolveRelativeImport(sourcePath: string, specifier: string) {
  if (!specifier.startsWith('.')) return undefined
  const base = resolve(dirname(sourcePath), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
}

function reachableRuntimeFiles(root: string) {
  const entry = resolve(root, 'src/main.tsx')
  const reachable = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const path = queue.pop()
    if (!path || reachable.has(path) || excludedSourceFile(path) || !existsSync(path)) continue
    reachable.add(path)
    if (!['.ts', '.tsx'].includes(extname(path))) continue

    const source = readFileSync(path, 'utf8')
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    for (const statement of sourceFile.statements) {
      if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      const imported = resolveRelativeImport(path, statement.moduleSpecifier.text)
      if (imported) queue.push(imported)
    }
  }

  return reachable
}

function propertyName(node: ts.PropertyName | ts.BindingName | undefined) {
  if (!node) return ''
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return node.getText()
}

function ancestor<T extends ts.Node>(node: ts.Node, predicate: (candidate: ts.Node) => candidate is T) {
  let candidate = node.parent
  while (candidate) {
    if (predicate(candidate)) return candidate
    candidate = candidate.parent
  }
  return undefined
}

function functionName(node: ts.Node) {
  const fn = ancestor(node, (candidate): candidate is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(candidate)
      || ts.isFunctionExpression(candidate)
      || ts.isArrowFunction(candidate)
      || ts.isMethodDeclaration(candidate))
  if (!fn) return ''
  if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) return propertyName(fn.name)
  return ts.isVariableDeclaration(fn.parent) ? propertyName(fn.parent.name) : ''
}

function jsxTagName(attribute: ts.JsxAttribute) {
  const attributes = attribute.parent
  const opening = attributes.parent
  if (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening)) return opening.tagName.getText()
  return ''
}

function jsxTextTagName(node: ts.JsxText) {
  const element = ancestor(node, ts.isJsxElement)
  return element?.openingElement.tagName.getText() ?? ''
}

function normalizeTemplate(node: ts.StringLiteralLike | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return node.head.text + node.templateSpans.map((span) => `{{${span.expression.getText()}}}${span.literal.text}`).join('')
}

function humanReadable(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length < 2 || !/[A-Za-z]/.test(normalized)) return false
  if (MICRO_COPY.has(normalized)) return true
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(normalized))) return false
  return true
}

function contextForString(node: ts.Node, sourceFile: ts.SourceFile) {
  const property = ancestor(node, ts.isPropertyAssignment)
  const inheritedPropertyName = propertyName(property?.name)
  if (inheritedPropertyName && EXCLUDED_PROPERTY_NAMES.has(inheritedPropertyName)) return undefined

  if (property?.initializer && property.initializer.pos <= node.pos && node.end <= property.initializer.end) {
    const name = propertyName(property.name)
    if (VISIBLE_NAMES.has(name)) {
      if (name.includes('Description') || name === 'description' || name === 'message' || name === 'note' || name === 'hint' || name === 'summary') return 'description'
      if (name.includes('Title') || name === 'title') return 'title'
      if (name.includes('Label') || name === 'label') return 'label'
      return name
    }
  }

  const attribute = ancestor(node, ts.isJsxAttribute)
  if (attribute) {
    const name = attribute.name.getText(sourceFile)
    if (name.startsWith('data-')) return undefined
    if (!VISIBLE_NAMES.has(name)) return undefined
    const tag = jsxTagName(attribute)
    if (name.startsWith('aria') || name === 'accessibleLabel') return 'accessibility'
    if (name === 'placeholder') return 'placeholder'
    if (name === 'description' || name.endsWith('Description')) return 'description'
    if (name === 'title' || name.endsWith('Title')) {
      if (tag === 'ModalSheet') return 'modal-title'
      if (tag === 'Page') return 'page-title'
      if (tag === 'SectionHeader') return 'section-title'
      return 'title'
    }
    if (name === 'label' && /(?:Action|Button|Pill|Toggle)/.test(tag)) return 'button-action'
    return name === 'label' ? 'label' : `accessibility-${name}`
  }

  const jsxExpression = ancestor(node, ts.isJsxExpression)
  if (jsxExpression) {
    const element = ancestor(jsxExpression, ts.isJsxElement)
    return element?.openingElement.tagName.getText() === 'button' ? 'button-action' : 'body-copy'
  }

  const bindingElement = ancestor(node, ts.isBindingElement)
  if (bindingElement?.initializer && bindingElement.initializer.pos <= node.pos && node.end <= bindingElement.initializer.end) {
    const name = propertyName(bindingElement.name)
    if (VISIBLE_NAMES.has(name)) return name.includes('Label') ? 'label' : name
  }

  const parameter = ancestor(node, ts.isParameter)
  if (parameter?.initializer && parameter.initializer.pos <= node.pos && node.end <= parameter.initializer.end) {
    const name = propertyName(parameter.name)
    if (VISIBLE_NAMES.has(name)) return name.includes('Label') ? 'label' : name
  }

  const variable = ancestor(node, ts.isVariableDeclaration)
  if (variable?.initializer && variable.initializer.pos <= node.pos && node.end <= variable.initializer.end) {
    const name = propertyName(variable.name)
    if (/(?:copy|description|error|hint|label|message|placeholder|status|subtitle|text|title)$/i.test(name)) return `variable-${name}`
  }

  const ownerFunction = functionName(node)
  if (ownerFunction && /(?:copy|description|error|format|label|message|state|status|subtitle|summary|text|title)$/i.test(ownerFunction)) {
    return `function-${ownerFunction}`
  }

  return undefined
}

function placeholders(value: string) {
  return [...new Set([...value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g)].map((match) => match[1]))].sort()
}

function inventoryId(origin: CopyOrigin, file: string, context: string, value: string) {
  return createHash('sha256').update([origin, file, context, value].join('\0')).digest('hex').slice(0, 16)
}

function recordKey(record: Pick<CopyInventoryRecord, 'context' | 'file' | 'origin' | 'value'>) {
  return [record.origin, record.file, record.context, record.value].join('\0')
}

function groupedRecords(records: CopyInventoryRecord[]) {
  const groups = new Map<string, CopyInventoryRecord>()
  for (const record of records) {
    const key = recordKey(record)
    const current = groups.get(key)
    if (current) {
      current.lines = [...new Set([...current.lines, ...record.lines])].sort((a, b) => a - b)
      current.occurrences += record.occurrences
    } else {
      groups.set(key, { ...record })
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.origin.localeCompare(b.origin)
      || a.context.localeCompare(b.context)
      || a.value.localeCompare(b.value)
      || a.file.localeCompare(b.file))
}

function sourceRecords(root: string) {
  const records: CopyInventoryRecord[] = []
  const paths = [...reachableRuntimeFiles(root)].filter((candidate) => ['.ts', '.tsx'].includes(extname(candidate))).sort()
  const program = ts.createProgram({
    rootNames: paths,
    options: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      target: ts.ScriptTarget.Latest,
    },
  })
  const checker = program.getTypeChecker()
  for (const path of paths) {
    const sourceFile = program.getSourceFile(path)
    if (!sourceFile) continue
    const file = normalizePath(relative(root, path))

    const add = (node: ts.Node, context: string, rawValue: string) => {
      const value = rawValue.replace(/\s+/g, ' ').trim()
      if (!humanReadable(value)) return
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      records.push({
        characters: value.length,
        context,
        file,
        id: inventoryId('legacy', file, context, value),
        lines: [line],
        occurrences: 1,
        origin: 'legacy',
        placeholders: placeholders(value),
        value,
        words: value.split(/\s+/).length,
      })
    }

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const value = node.getText(sourceFile).replace(/\s+/g, ' ').trim()
        if (value) add(node, jsxTextTagName(node) === 'button' ? 'button-action' : 'body-copy', value)
      } else if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        const context = contextForString(node, sourceFile)
        if (context) add(node, context, normalizeTemplate(node))
      } else if (ts.isIdentifier(node)) {
        let symbol = checker.getSymbolAtLocation(node)
        if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol)
        const declaration = symbol?.declarations?.find(ts.isVariableDeclaration)
        const initializer = declaration?.initializer
        const localLiteral = declaration?.getSourceFile() === sourceFile
          && initializer
          && (ts.isStringLiteralLike(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer) || ts.isTemplateExpression(initializer))
          ? initializer
          : undefined
        const context = localLiteral ? contextForString(node, sourceFile) : undefined
        if (localLiteral && context) add(localLiteral, context, normalizeTemplate(localLiteral))
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return groupedRecords(records)
}

function catalogContext(key: string) {
  if (/(?:^|\.)(?:actions?|button)/i.test(key)) return 'button-action'
  if (/(?:^|\.)modal(?:\.|$)/i.test(key)) return 'modal-copy'
  if (/(?:^|\.)(?:description|subtitle|summary|hint|message)(?:\.|$)/i.test(key)) return 'description'
  if (/(?:^|\.)(?:loading)(?:\.|$)/i.test(key)) return 'loading-label'
  if (/(?:^|\.)(?:placeholder|search)(?:\.|$)/i.test(key)) return 'placeholder'
  if (/(?:^|\.)(?:states?|status)(?:\.|$)/i.test(key)) return 'status-value'
  if (/(?:^|\.)(?:sections?|title)(?:\.|$)/i.test(key)) return 'title'
  if (/(?:^|\.)(?:navigation|tabs?)(?:\.|$)/i.test(key)) return 'navigation'
  return 'catalog-copy'
}

function flattenCatalog(value: unknown, prefix = ''): Array<{ key: string; value: string }> {
  if (typeof value === 'string') return [{ key: prefix, value }]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) =>
    flattenCatalog(child, prefix ? `${prefix}.${key}` : key))
}

function namespaceForCatalog(path: string) {
  const normalized = normalizePath(path)
  if (normalized.endsWith('/locales/en.json')) return 'common'
  return normalized
    .replace(/^.*\/locales\/en\//, '')
    .replace(/\.json$/, '')
    .replaceAll('/', '.')
}

function catalogRecords(root: string) {
  const localeRoot = resolve(root, 'src/i18n/locales')
  if (!existsSync(localeRoot)) return []
  const records: CopyInventoryRecord[] = []
  for (const path of walkFiles(localeRoot).filter((candidate) => candidate.endsWith('.json')).sort()) {
    const file = normalizePath(relative(root, path))
    const namespace = namespaceForCatalog(path)
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    for (const entry of flattenCatalog(parsed)) {
      if (entry.value.trim() !== entry.value || entry.value === '') {
        throw new Error(`Invalid empty or padded catalog value: ${file}#${entry.key}`)
      }
      records.push({
        characters: entry.value.length,
        context: catalogContext(entry.key),
        file,
        id: inventoryId('catalog', file, entry.key, entry.value),
        lines: [],
        occurrences: 1,
        origin: 'catalog',
        placeholders: placeholders(entry.value),
        value: entry.value,
        words: entry.value.trim().split(/\s+/).length,
      })
    }
    validatePluralFamilies(namespace, file, flattenCatalog(parsed))
  }
  return groupedRecords(records)
}

function validatePluralFamilies(namespace: string, file: string, entries: Array<{ key: string; value: string }>) {
  const pluralEntries = entries.filter((entry) => /_(?:few|many|one|other|two|zero)$/.test(entry.key))
  const families = new Map<string, Array<{ key: string; value: string }>>()
  for (const entry of pluralEntries) {
    const base = entry.key.replace(/_(?:few|many|one|other|two|zero)$/, '')
    const family = families.get(base) ?? []
    family.push(entry)
    families.set(base, family)
  }
  for (const [base, family] of families) {
    const suffixes = new Set(family.map((entry) => entry.key.slice(base.length + 1)))
    if (!suffixes.has('one') || !suffixes.has('other')) {
      throw new Error(`Plural family must include _one and _other: ${namespace}:${base} (${file})`)
    }
    const placeholderSets = new Set(family.map((entry) => placeholders(entry.value).join(',')))
    if (placeholderSets.size !== 1) {
      throw new Error(`Plural placeholders do not match: ${namespace}:${base} (${file})`)
    }
  }
}

function documentRecords(root: string) {
  const path = resolve(root, 'index.html')
  const source = readFileSync(path, 'utf8')
  const title = source.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim()
  if (!title) return []
  const file = 'index.html'
  return [{
    characters: title.length,
    context: 'document-title',
    file,
    id: inventoryId('document', file, 'document-title', title),
    lines: [source.slice(0, source.indexOf('<title>')).split('\n').length],
    occurrences: 1,
    origin: 'document' as const,
    placeholders: [],
    value: title,
    words: title.split(/\s+/).length,
  }]
}

export function buildCopyInventory(root = ROOT): CopyInventory {
  const catalog = catalogRecords(root)
  const documents = documentRecords(root)
  const legacy = sourceRecords(root)
  const records = [...catalog, ...documents, ...legacy]
  return {
    exclusions: {
      dynamicBackendText: true,
      tests: true,
    },
    records,
    summary: {
      catalogRecords: catalog.length,
      documentRecords: documents.length,
      legacyOccurrences: legacy.reduce((total, record) => total + record.occurrences, 0),
      legacyRecords: legacy.length,
      totalRecords: records.length,
    },
    version: INVENTORY_VERSION,
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeGenerated(path: string, value: unknown) {
  const absolute = resolve(ROOT, path)
  const directory = dirname(absolute)
  if (!existsSync(directory)) {
    const parts = normalizePath(relative(ROOT, directory)).split('/')
    let current = ROOT
    for (const part of parts) {
      current = join(current, part)
      if (!existsSync(current)) {
        mkdirSync(current)
      }
    }
  }
  writeFileSync(absolute, stableJson(value))
}

export function currentBaseline(inventory: CopyInventory): LegacyBaseline {
  const legacy = inventory.records.filter((record) => record.origin === 'legacy')
  return {
    allowedIds: legacy.map((record) => record.id).sort(),
    maxOccurrencesById: Object.fromEntries(legacy
      .map((record) => [record.id, record.occurrences] as const)
      .sort(([left], [right]) => left.localeCompare(right))),
    maxOccurrences: inventory.summary.legacyOccurrences,
    version: BASELINE_VERSION,
  }
}

export function assertNoNewLegacy(inventory: CopyInventory, baseline: LegacyBaseline) {
  if (baseline.version !== BASELINE_VERSION || !baseline.maxOccurrencesById) {
    throw new Error('Legacy copy baseline predates per-record occurrence limits. Refresh the baseline after reviewing the scanner output.')
  }
  const allowed = new Set(baseline.allowedIds)
  const additions = inventory.records.filter((record) => record.origin === 'legacy' && !allowed.has(record.id))
  if (additions.length > 0) {
    const detail = additions.slice(0, 20).map((record) => `${record.file}:${record.lines[0]} ${JSON.stringify(record.value)}`).join('\n')
    throw new Error(`New un-catalogued user-visible copy detected (${additions.length}):\n${detail}`)
  }
  const increased = inventory.records.filter((record) =>
    record.origin === 'legacy'
      && record.occurrences > (baseline.maxOccurrencesById[record.id] ?? 0))
  if (increased.length > 0) {
    const detail = increased.slice(0, 20)
      .map((record) => `${record.file}:${record.lines[0]} ${JSON.stringify(record.value)} (${record.occurrences} > ${baseline.maxOccurrencesById[record.id]})`)
      .join('\n')
    throw new Error(`Legacy copy occurrence count increased for existing records (${increased.length}):\n${detail}`)
  }
  if (inventory.summary.legacyOccurrences > baseline.maxOccurrences) {
    throw new Error(`Legacy copy occurrence count increased: ${inventory.summary.legacyOccurrences} > ${baseline.maxOccurrences}`)
  }
}

function writeInventory(inventory: CopyInventory, refreshBaseline: boolean) {
  const baselinePath = resolve(ROOT, BASELINE_PATH)
  if (existsSync(baselinePath) && !refreshBaseline) {
    assertNoNewLegacy(inventory, readJson<LegacyBaseline>(baselinePath))
  }
  writeGenerated(BASELINE_PATH, currentBaseline(inventory))
  writeGenerated(INVENTORY_PATH, inventory)
}

function checkInventory(inventory: CopyInventory) {
  const baselinePath = resolve(ROOT, BASELINE_PATH)
  const inventoryPath = resolve(ROOT, INVENTORY_PATH)
  if (!existsSync(baselinePath) || !existsSync(inventoryPath)) {
    throw new Error('Run npm run i18n:sync to create the copy inventory and baseline.')
  }
  const baseline = readJson<LegacyBaseline>(baselinePath)
  assertNoNewLegacy(inventory, baseline)
  if (readFileSync(baselinePath, 'utf8') !== stableJson(currentBaseline(inventory))) {
    throw new Error('Legacy copy baseline is stale. Run npm run i18n:sync.')
  }
  const committed = readFileSync(inventoryPath, 'utf8')
  const expected = stableJson(inventory)
  if (committed !== expected) throw new Error('Copy inventory is stale. Run npm run i18n:sync.')
}

function cliArgs() {
  return new Set(process.argv.slice(2))
}

function runCli() {
  const args = cliArgs()
  const inventory = buildCopyInventory()
  if (args.has('--write') || args.has('--refresh-baseline')) {
    writeInventory(inventory, args.has('--refresh-baseline'))
  } else if (args.has('--check')) {
    checkInventory(inventory)
  } else {
    console.log(stableJson(inventory.summary))
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) runCli()

export { BASELINE_PATH, INVENTORY_PATH }
