import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repositoryRoot = resolve(skillRoot, '../../..')

export const CONTEXT_CLASSES = [
  'button',
  'action',
  'destructive-action',
  'chip',
  'status',
  'tab',
  'section-title',
  'card-title',
  'page-title',
  'modal-title',
  'modal-description',
  'modal-action',
  'description',
  'help',
  'empty-title',
  'empty-body',
  'error',
  'loading',
  'success',
  'form-label',
  'form-placeholder',
  'form-hint',
  'form-validation',
  'a11y',
  'confirmation',
  'separator',
  'compound-metric',
  'notification-title',
  'notification-body',
  'notification-action',
]

export const REQUEST_MODES = ['create', 'rewrite', 'audit', 'variants']
export const OWNERSHIPS = ['react', 'home-assistant-reference']
export const RESPONSE_STATUSES = ['ok', 'needs-context', 'refused']
const REFUSAL_CODES = ['proper-noun', 'react-notification', 'privacy', 'injection', 'unsafe']
export const RESPONSE_CHECKS = [
  'maxCharacters',
  'maxWords',
  'placeholders',
  'forbiddenTerms',
  'ownership',
  'style',
  'retrieval',
]

const SHORT_TITLE_CONTEXTS = new Set([
  'button',
  'action',
  'destructive-action',
  'chip',
  'status',
  'tab',
  'section-title',
  'card-title',
  'page-title',
  'modal-title',
  'modal-action',
  'empty-title',
  'form-label',
  'form-placeholder',
  'a11y',
  'notification-title',
  'notification-action',
])

const PROSE_CONTEXTS = new Set([
  'modal-description',
  'description',
  'help',
  'empty-body',
  'error',
  'success',
  'form-hint',
  'form-validation',
  'confirmation',
  'notification-body',
])

const ACTION_CONTEXTS = new Set([
  'button',
  'action',
  'destructive-action',
  'modal-action',
  'notification-action',
])

const VERBS = new Set([
  'add',
  'apply',
  'arm',
  'back',
  'cancel',
  'clean',
  'clear',
  'close',
  'confirm',
  'continue',
  'create',
  'delete',
  'disarm',
  'dismiss',
  'dock',
  'draw',
  'dry',
  'edit',
  'empty',
  'filter',
  'finish',
  'load',
  'open',
  'pause',
  'remove',
  'reset',
  'resume',
  'retry',
  'review',
  'save',
  'scan',
  'search',
  'select',
  'set',
  'start',
  'stop',
  'turn',
  'update',
  'view',
])

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'before',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'with',
  'your',
])

const VISIBLE_FIELDS = new Set([
  'label',
  'title',
  'description',
  'subtitle',
  'heading',
  'text',
  'message',
  'placeholder',
  'ariaLabel',
  'ariaDescription',
  'alt',
  'emptyTitle',
  'emptyDescription',
  'emptyLabel',
  'emptyMessage',
  'loadingTitle',
  'loadingDescription',
  'loadingLabel',
  'loadingMessage',
  'errorTitle',
  'errorDescription',
  'errorLabel',
  'errorMessage',
  'closeLabel',
  'backLabel',
  'cancelLabel',
  'confirmLabel',
  'submitLabel',
  'saveLabel',
  'clearLabel',
  'actionLabel',
  'buttonLabel',
  'unitLabel',
  'stateLabel',
  'stateLabels',
  'trueLabel',
  'falseLabel',
  'statusLabel',
  'sectionTitle',
  'tabLabel',
  'helperText',
  'caption',
  'summary',
  'modalTitle',
  'zoneDescription',
  'displayName',
  'valueLabel',
  'secondary',
  'aria-roledescription',
  'aria-label',
  'aria-description',
  'aria-valuetext',
])

const TECHNICAL_VALUE = /^(?:[a-z0-9_-]+(?:\.[a-z0-9_.-]+)+|[./#?&=:@][^ ]*|https?:|mdi:|rgb\(|hsl\(|#[0-9a-f]{3,8}|-?\d+(?:\.\d+)?(?:px|rem|em|ms|s|vh|vw|%)|[A-Z0-9_]{3,}|data-|aria-|application\/|image\/|video\/|audio\/)/
const HA_DOMAIN_PATTERN = 'alarm_control_panel|assist_satellite|automation|binary_sensor|button|calendar|camera|climate|conversation|counter|cover|date|datetime|device_tracker|event|fan|geo_location|group|humidifier|image|input_boolean|input_button|input_datetime|input_number|input_select|input_text|lawn_mower|light|lock|mailbox|media_player|notify|number|person|plant|proximity|remote|scene|schedule|script|select|sensor|siren|stt|sun|switch|tag|text|time|timer|todo|tts|update|vacuum|valve|wake_word|water_heater|weather|zone'
const BACKEND_ID = new RegExp(`\\b(?:${HA_DOMAIN_PATTERN})\\.[a-z0-9_]+\\b`, 'i')
const BACKEND_EXEMPLAR_ID = new RegExp(`(?:^|[:=/\\s])(?:${HA_DOMAIN_PATTERN})\\.[a-z0-9_]+(?:$|\\s)`, 'i')
const BACKEND_DOMAIN_SEGMENT = new RegExp(`^(?:${HA_DOMAIN_PATTERN})$`)
const BARE_ACCESS_TOKEN = /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/
const GITHUB_ACCESS_TOKEN = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/
const SENSITIVE_OUTPUT = new RegExp(`(?:\\b(?:VITE_HA_TOKEN|HASS_PORTING_HA_PASSWORD)\\b|Bearer\\s+[A-Za-z0-9._~+/-]+=*|\\b(?:api[_ -]?key|password|secret[_ -]?(?:key|token))\\s*[:=]\\s*\\S+|\\.env(?:\\.development)?|${BARE_ACCESS_TOKEN.source}|${GITHUB_ACCESS_TOKEN.source})`, 'i')
const SENSITIVE_REQUEST = new RegExp(`(?:\\b(?:VITE_HA_TOKEN|HASS_PORTING_HA_PASSWORD)\\b|Bearer\\s+\\S+|\\b(?:api[_ -]?key|password|secret|token)\\b|\\.env(?:\\.development)?|\\*{6,}|${BARE_ACCESS_TOKEN.source}|${GITHUB_ACCESS_TOKEN.source})`, 'i')
const PLACEHOLDER = /{{[^{}]+}}/g
const PROTECTED_NAME = /\b(?:Apple TV|Back Deck|Back Yard|Cookidoo|Dining Room|Disney\+|Downstairs Bathroom|Downstairs Hallway|Entryway|EverShelf|Freezer|Fridge|Front Door|Front Yard|Garage|Guest Bathroom|Guest Room|Gym|Hallway|Home Assistant|Kitchen|Left Door|Living Room|Lower Deck|Mach-E|Main Floor|Master Bathroom|Master Bedroom|Music Room|Netflix|Office|Pantry|Paramount\+|Plex|Prime Video|Right Door|SHIELD|SleepyPod|Spice Rack|Steph|Stephen|Theater Room|Upper Deck|Valetudo|Whole Home|YouTube)\b/i

export function valueHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
  }
  return value
}

export function textHash(value, length = 16) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, length)
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function readJsonLines(path) {
  const content = await readFile(path, 'utf8')
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
}

export function parseCliArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    result[key] = next && !next.startsWith('--') ? argv[++index] : true
  }
  return result
}

export function words(value) {
  return String(value).match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g) ?? []
}

export function placeholders(value) {
  return [...new Set(String(value).match(PLACEHOLDER) ?? [])].sort()
}

export function measureBand(value) {
  const text = String(value)
  const count = words(text).length
  if (text.length <= 20 && count <= 3) return 'micro'
  if (text.length <= 60 && count <= 10) return 'short'
  return 'long'
}

export function requestBand(request) {
  if (request.maxCharacters !== null && request.maxCharacters !== undefined) {
    if (request.maxCharacters <= 20 && (request.maxWords === null || request.maxWords === undefined || request.maxWords <= 3)) return 'micro'
    if (request.maxCharacters <= 60 && (request.maxWords === null || request.maxWords === undefined || request.maxWords <= 10)) return 'short'
    return 'long'
  }
  if (request.maxWords !== null && request.maxWords !== undefined) {
    if (request.maxWords <= 3) return 'micro'
    if (request.maxWords <= 10) return 'short'
    return 'long'
  }
  return measureBand(request.sourceText ?? request.intent)
}

export function intentTags(value) {
  return [...new Set(words(value)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word)))]
    .slice(0, 10)
}

export function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function titleLike(value) {
  const significant = words(value).filter((word) => !['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to'].includes(word.toLowerCase()))
  return significant.every((word) => /^[A-Z0-9]/.test(word) || /^[A-Z]{2,}$/.test(word))
}

function terminalPunctuation(value) {
  return /[.!?]$/.test(value.trim())
}

function startsWithVerb(value) {
  const first = words(value)[0]?.toLowerCase()
  return Boolean(first && VERBS.has(first))
}

function isVisibleField(name) {
  return VISIBLE_FIELDS.has(name) || /(?:Label|Title|Description|Message|Placeholder|Caption|Summary)$/.test(name)
}

function sourceExcluded(path) {
  return (
    !/\.(?:ts|tsx)$/.test(path)
    || /\.test\.(?:ts|tsx)$/.test(path)
    || path.includes('/src/i18n/')
    || path.includes('/src/test/')
  )
}

function inventoryContextToSkillContext(context) {
  return {
    accessibility: 'a11y',
    'button-action': 'button',
    'catalog-copy': 'description',
    description: 'description',
    'loading-label': 'loading',
    'modal-copy': 'modal-description',
    navigation: 'tab',
    placeholder: 'form-placeholder',
    'status-value': 'status',
    title: 'card-title',
  }[context] ?? 'description'
}

function inventoryNamespace(file) {
  const normalized = String(file)
    .replace(/^src\/i18n\/locales\/en\/?/, '')
    .replace(/\.json$/, '')
  return normalized === 'src/i18n/locales/en' || normalized === ''
    ? 'common'
    : normalized.replaceAll('/', '.')
}

async function scanCatalogCorpus(root = repositoryRoot) {
  const inventoryPath = resolve(root, 'scripts/i18n/generated/copy-inventory.json')
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'))
  if (inventory?.version !== 1 || !Array.isArray(inventory.records)) {
    throw new Error('Copy inventory is missing or malformed.')
  }
  const inventoryModule = await import(pathToFileURL(resolve(root, 'scripts/i18n/inventory.ts')).href)
  const currentInventory = inventoryModule.buildCopyInventory(root)
  if (valueHash(inventory) !== valueHash(currentInventory)) {
    throw new Error('Copy inventory is stale. Run npm run i18n:sync.')
  }
  return inventory.records
    .filter((record) => record.origin === 'catalog')
    .map((record) => {
      const contextClass = inventoryContextToSkillContext(record.context)
      const provenance = `${record.file}#catalog`
      const corpusRecord = {
        id: `catalog.${record.id}`,
        text: record.value,
        contextClass,
        band: measureBand(record.value),
        ownership: 'react',
        quality: 'current',
        placeholders: record.placeholders,
        intentTags: intentTags(`${record.context} ${record.value}`),
        namespace: inventoryNamespace(record.file),
        surface: record.file.split('/').pop()?.replace(/\.json$/, '') || 'catalog',
        provenance,
      }
      if (!sourceRestyleAllowed(record.value)) corpusRecord.restyle = false
      return corpusRecord
    })
}

async function walkFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walkFiles(path))
    else if (entry.isFile()) result.push(path)
  }
  return result
}

export async function hashSkillFiles(root = skillRoot) {
  const included = []
  for (const path of (await walkFiles(root)).sort()) {
    const relativePath = relative(root, path).replaceAll('\\', '/')
    if (['evals/latest-results.json', 'evals/model-pin.json'].includes(relativePath)) continue
    included.push([relativePath, textHash(await readFile(path))])
  }
  return valueHash(included)
}

function sourceValue(node, sourceFile) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isJsxText(node)) return node.getText(sourceFile)
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans
      .map((span) => `{{${placeholderName(span.expression.getText(sourceFile))}}}${span.literal.text}`)
      .join('')
  }
  return null
}

function placeholderName(expression) {
  const cleaned = String(expression)
    .replace(/\?.*/g, '')
    .replace(/[^A-Za-z0-9_.]+/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.split('.')
    .pop()
  return cleaned || 'value'
}

function ownerName(node, sourceFile) {
  let current = node.parent
  while (current) {
    if (ts.isJsxElement(current)) return current.openingElement.tagName.getText(sourceFile)
    if (ts.isJsxSelfClosingElement(current)) return current.tagName.getText(sourceFile)
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
    current = current.parent
  }
  return ''
}

function inferContext({ field, file, owner, value }) {
  if (/^(?:aria-|aria[A-Z]|accessible|handleAria|gridLabel|alt$)/.test(field)) return 'a11y'
  if (/^(?:emptyTitle|emptyLabel)$/.test(field)) return 'empty-title'
  if (/^(?:emptyDescription|emptyMessage)$/.test(field)) return 'empty-body'
  if (/^(?:error|errorTitle|errorDescription|errorLabel|errorMessage)$/.test(field)) return 'error'
  if (/^(?:loading|loadingTitle|loadingDescription|loadingLabel|loadingMessage)$/.test(field)) return 'loading'
  if (/description|subtitle|helperText|caption|secondary|zoneDescription/.test(field)) {
    return /Modal|Sheet|Dialog/.test(owner) || /Modal|Sheet/.test(file) ? 'modal-description' : 'description'
  }
  if (field === 'placeholder') return 'form-placeholder'
  if (/validation|invalid|required/i.test(owner) || /must|required|invalid/i.test(value)) return 'form-validation'
  if (/NativePicker|NativeSelect|ScheduleEditor|TaskForm|ScanItem/.test(owner) && field === 'label') return 'form-label'
  if (/state|status|valueLabel|trueLabel|falseLabel|onLabel|offLabel/.test(field)) return 'status'
  if (/tab/i.test(field) || /Tab/.test(owner)) return 'tab'
  if (/SectionHeader/.test(owner) || field === 'sectionTitle') return 'section-title'
  if (/Page/.test(owner) && field === 'title') return 'page-title'
  if (/ModalSheet|OptionPickerDialog|Dialog/.test(owner) && field === 'title') return 'modal-title'
  if (/ModalActionFooter/.test(owner)) return 'modal-action'
  if (/ActionButton|ActionPill|FloatingAction|button/.test(owner)) {
    return /delete|remove|cancel|stop/i.test(value) ? 'destructive-action' : 'action'
  }
  if (/StatusPill/.test(owner)) return 'chip'
  if (/Card|Tile/.test(owner) && field === 'title') return 'card-title'
  if (field === 'title') return /routes|Route/.test(file) ? 'page-title' : 'card-title'
  if (field === 'label') return 'button'
  if (field === 'message') return 'error'
  return value.length <= 32 ? 'status' : 'description'
}

function inferNamespace(path) {
  const lower = path.toLowerCase()
  const rules = [
    ['recipe', 'recipes'],
    ['food', 'food'],
    ['inventory', 'food'],
    ['vacuum', 'vacuum'],
    ['humidifier', 'humidifier'],
    ['sleepypod', 'sleepypod'],
    ['eightSleep'.toLowerCase(), 'sleepypod'],
    ['security', 'security'],
    ['camera', 'camera'],
    ['weather', 'weather'],
    ['media', 'media'],
    ['task', 'tasks'],
    ['todo', 'tasks'],
    ['chore', 'chores'],
    ['room', 'rooms'],
    ['climate', 'climate'],
    ['thermostat', 'climate'],
    ['admin', 'admin'],
    ['vacation', 'vacation'],
    ['setting', 'settings'],
    ['shell', 'shell'],
    ['header', 'shell'],
    ['nav', 'shell'],
  ]
  return rules.find(([needle]) => lower.includes(needle))?.[1] ?? 'common'
}

function usableSourceText(value) {
  if (!value || value.length < 1 || TECHNICAL_VALUE.test(value) || BACKEND_ID.test(value)) return false
  if (/^[a-z_$][\w$]*$/.test(value)) return false
  return /[A-Za-z]/.test(value) || /^[·•–]$/.test(value)
}

function sourceRestyleAllowed(value) {
  return !(
    /(?:['’]s)\b/.test(value)
    || PROTECTED_NAME.test(value)
  )
}

export async function scanSourceCorpus(root = repositoryRoot) {
  const srcRoot = resolve(root, 'src')
  const records = new Map()
  for (const file of (await walkFiles(srcRoot)).filter((path) => !sourceExcluded(path))) {
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const add = (node, rawValue, field) => {
      const value = normalizeText(rawValue)
      if (!usableSourceText(value)) return
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const relativePath = relative(root, file).replaceAll('\\', '/')
      const owner = ownerName(node, sourceFile)
      const contextClass = inferContext({ field, file: relativePath, owner, value })
      const provenance = `${relativePath}:${position.line + 1}`
      const id = `source.${textHash(`${provenance}:${field}:${value}`)}`
      const record = {
        id,
        text: value,
        contextClass,
        band: measureBand(value),
        ownership: 'react',
        quality: 'current',
        placeholders: placeholders(value),
        intentTags: intentTags(`${owner} ${value}`),
        namespace: inferNamespace(relativePath),
        surface: owner || relativePath.split('/').pop()?.replace(/\.(?:ts|tsx)$/, '') || 'source',
        provenance,
      }
      if (!sourceRestyleAllowed(value)) record.restyle = false
      records.set(id, record)
    }
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const value = sourceValue(node, sourceFile)
        if (value) add(node, value, 'children')
      } else if (ts.isJsxAttribute(node)) {
        const field = node.name.getText(sourceFile)
        if (isVisibleField(field) && node.initializer) {
          const target = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
          const value = target ? sourceValue(target, sourceFile) : null
          if (value) add(target, value, field)
        }
      } else if (ts.isPropertyAssignment(node)) {
        const field = node.name.getText(sourceFile).replace(/^['"]|['"]$/g, '')
        if (isVisibleField(field)) {
          const value = sourceValue(node.initializer, sourceFile)
          if (value) add(node.initializer, value, field)
          if (field === 'stateLabels' && ts.isObjectLiteralExpression(node.initializer)) {
            for (const property of node.initializer.properties) {
              if (!ts.isPropertyAssignment(property)) continue
              const nested = sourceValue(property.initializer, sourceFile)
              if (nested) add(property.initializer, nested, 'stateLabel')
            }
          }
        }
      } else if (ts.isBindingElement(node) && node.initializer && ts.isIdentifier(node.name)) {
        const field = node.name.text
        if (isVisibleField(field)) {
          const value = sourceValue(node.initializer, sourceFile)
          if (value) add(node.initializer, value, field)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return [...records.values()].sort((left, right) => left.id.localeCompare(right.id))
}

export function validateCorpusRecord(record) {
  const errors = []
  const required = [
    'id',
    'text',
    'contextClass',
    'band',
    'ownership',
    'quality',
    'placeholders',
    'intentTags',
    'namespace',
    'surface',
    'provenance',
  ]
  for (const field of required) {
    if (!(field in record)) errors.push(`Missing corpus field ${field}.`)
  }
  if (!CONTEXT_CLASSES.includes(record.contextClass)) errors.push(`Invalid context ${record.contextClass}.`)
  if (!['micro', 'short', 'long'].includes(record.band)) errors.push(`Invalid band ${record.band}.`)
  if (!OWNERSHIPS.includes(record.ownership)) errors.push(`Invalid ownership ${record.ownership}.`)
  if (!['canonical', 'current', 'avoid'].includes(record.quality)) errors.push(`Invalid quality ${record.quality}.`)
  if (!Array.isArray(record.placeholders)) errors.push('Corpus placeholders must be an array.')
  if (!Array.isArray(record.intentTags)) errors.push('Corpus intentTags must be an array.')
  if (record.text && record.band !== measureBand(record.text)) errors.push('Corpus band does not match measured text.')
  return errors
}

export async function buildCorpus(root = repositoryRoot) {
  const curated = await readJsonLines(resolve(skillRoot, 'assets/corpus/curated.jsonl'))
  const notifications = await readJsonLines(resolve(skillRoot, 'assets/corpus/notification-reference.jsonl'))
  const catalogs = await scanCatalogCorpus(root)
  const source = await scanSourceCorpus(root)
  const records = new Map()
  for (const sourceRecord of [...curated, ...notifications, ...catalogs, ...source]) {
    const record = sourceRestyleAllowed(sourceRecord.text)
      ? sourceRecord
      : { ...sourceRecord, restyle: false }
    const errors = validateCorpusRecord(record)
    if (errors.length) throw new Error(`${record.id ?? '<unknown>'}: ${errors.join(' ')}`)
    if (records.has(record.id)) throw new Error(`Duplicate corpus id ${record.id}.`)
    records.set(record.id, record)
  }
  return [...records.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function siblingContexts(contextClass) {
  const groups = [
    ['button', 'action', 'destructive-action', 'modal-action', 'notification-action'],
    ['chip', 'status', 'tab', 'section-title', 'card-title', 'page-title', 'modal-title', 'empty-title', 'form-label', 'form-placeholder', 'a11y'],
    ['modal-description', 'description', 'help', 'empty-body', 'error', 'success', 'form-hint', 'form-validation', 'confirmation'],
    ['separator', 'compound-metric'],
  ]
  return groups.find((group) => group.includes(contextClass)) ?? [contextClass]
}

function placeholderShape(recordPlaceholders, requestPlaceholders) {
  return JSON.stringify([...recordPlaceholders].sort()) === JSON.stringify([...requestPlaceholders].sort())
}

function rankRecord(record, request) {
  let score = 0
  if (record.quality === 'canonical') score += 20
  if (record.contextClass === request.contextClass) score += 60
  if (record.band === request.band) score += 15
  if (request.namespace && record.namespace === request.namespace) score += 8
  if (request.surface && record.surface.toLowerCase() === request.surface.toLowerCase()) score += 7
  const requestTags = new Set(request.intentTags)
  score += Math.min(5, record.intentTags.filter((tag) => requestTags.has(tag)).length)
  if (placeholderShape(record.placeholders, request.requiredPlaceholders)) score += 5
  return score
}

export function retrieveExamples(corpus, request, { positiveLimit = 5, negativeLimit = 2 } = {}) {
  request = {
    ...request,
    band: request.band ?? requestBand(request),
    targetLength: request.targetLength ?? String(request.sourceText ?? request.intent).length,
    namespace: request.namespace ?? '',
    intentTags: request.intentTags ?? intentTags(`${request.surface} ${request.intent}`),
  }
  const notification = request.contextClass.startsWith('notification-')
  const exact = corpus.filter((record) => record.contextClass === request.contextClass)
  const allowedContexts = exact.some((record) => ['canonical', 'current'].includes(record.quality))
    ? [request.contextClass]
    : notification
      ? [request.contextClass]
      : siblingContexts(request.contextClass)

  const contextEligible = corpus.filter((record) => {
    if (/app manual/i.test(`${record.text} ${record.surface} ${record.provenance}`)) return false
    if (!allowedContexts.includes(record.contextClass)) return false
    if (record.ownership !== request.ownership) return false
    if (notification && record.contextClass !== request.contextClass) return false
    if (!notification && record.contextClass.startsWith('notification-')) return false
    if (record.restyle === false) return false
    if (request.band === 'micro' && record.band === 'long') return false
    if (request.band === 'long' && record.band === 'micro') return false
    return true
  })
  const ranked = contextEligible
    .map((record) => ({
      record,
      score: rankRecord(record, request),
      lengthDelta: Math.abs(record.text.length - (request.targetLength ?? record.text.length)),
    }))
    .sort((left, right) => (
      right.score - left.score
      || (left.record.quality === right.record.quality ? 0 : left.record.quality === 'canonical' ? -1 : 1)
      || left.lengthDelta - right.lengthDelta
      || left.record.id.localeCompare(right.record.id)
    ))

  const select = (qualities, limit) => {
    const seen = new Set()
    const result = []
    for (const item of ranked) {
      if (!qualities.includes(item.record.quality) || seen.has(item.record.text)) continue
      seen.add(item.record.text)
      result.push({ ...item.record, retrievalScore: item.score })
      if (result.length >= limit) break
    }
    return result
  }

  return {
    positives: select(['canonical', 'current'], positiveLimit),
    negatives: select(['avoid'], negativeLimit),
  }
}

function nullableLimit(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : Number.NaN
}

export function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {}
  const contextClass = String(input.contextClass ?? '').trim()
  const intent = String(input.intent ?? '').trim()
  const surface = String(input.surface ?? '').trim()
  const maxCharacters = nullableLimit(input.maxCharacters)
  const maxWords = nullableLimit(input.maxWords)
  const requiredPlaceholders = Array.isArray(input.requiredPlaceholders)
    ? [...new Set(input.requiredPlaceholders.map(String))].sort()
    : input.requiredPlaceholders ?? []
  const forbiddenTerms = Array.isArray(input.forbiddenTerms)
    ? [...new Set(input.forbiddenTerms.map(String))].sort()
    : input.forbiddenTerms ?? []
  return {
    mode: String(input.mode ?? 'create'),
    contextClass,
    surface,
    intent,
    ownership: String(input.ownership ?? (contextClass.startsWith('notification-') ? 'home-assistant-reference' : 'react')),
    maxCharacters,
    maxWords,
    requiredPlaceholders,
    forbiddenTerms,
    stateMatrix: input.stateMatrix ?? [],
    outputCount: Number(input.outputCount ?? (input.mode === 'variants' ? 3 : 1)),
  }
}

export function normalizeRequests(input) {
  return normalizeRequestEntries(input).map((entry) => entry.request)
}

export function normalizeRequestEntries(input) {
  const rawInputs = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray(input.requests)
      ? input.requests
      : [input]
  return rawInputs.map((rawInput) => ({
    rawInput,
    request: normalizeRequest(rawInput),
  }))
}

export function detectRefusal(request, rawInput = '') {
  const combinedRaw = `${rawInput} ${request.surface} ${request.intent}`
  const combined = combinedRaw.toLowerCase()
  if (/(?:restyle|rename|rewrite).*(?:household name|proper noun|friendly name|person name|device name)/.test(combined)) {
    return { code: 'proper-noun', reason: 'Household and HA-mirrored proper nouns are preserved, not restyled.' }
  }
  if (
    ['rewrite', 'variants'].includes(request.mode)
    && (
      PROTECTED_NAME.test(combinedRaw)
      || /household name|proper noun|friendly name|live entity name|person name|device name/.test(combined)
    )
  ) {
    return { code: 'proper-noun', reason: 'Household and HA-mirrored proper nouns are preserved, not restyled.' }
  }
  if (/(?:restyle|rename|rewrite)/.test(combined) && /\b[A-Z][a-z]+(?:['’]s)\b/.test(combinedRaw)) {
    return { code: 'proper-noun', reason: 'Household and HA-mirrored proper nouns are preserved, not restyled.' }
  }
  if (request.contextClass.startsWith('notification-') && request.ownership === 'react') {
    return { code: 'react-notification', reason: 'Home Assistant owns notification delivery; React notification requests are refused.' }
  }
  if (
    request.ownership === 'react'
    && (
      /\b(?:send|deliver|push|post|trigger)\b.{0,48}\b(?:notification|alert)\b/.test(combined)
      || /\b(?:notification|alert)\b.{0,48}\b(?:from|through|using|via)\s+react\b/.test(combined)
      || /\bnotify\b.{0,48}\b(?:device|me|mobile|phone|us|user)\b/.test(combined)
      || /\b(?:send|deliver|push)\b.{0,48}\bpush message\b/.test(combined)
    )
  ) {
    return { code: 'react-notification', reason: 'Home Assistant owns notification delivery; React notification requests are refused.' }
  }
  if (/private task text|live task text|task content|live recipe text|recipe content|camera data|camera image|personal attributes?|person attributes?|private data/.test(combined)) {
    return { code: 'privacy', reason: 'Private household or credential content is outside this skill.' }
  }
  if (
    /(?:ignore|disregard|forget|override) (?:all |any |the )?(?:earlier |previous |prior )?(?:rules|contract|instructions|prompt)|system prompt/.test(combined)
    || SENSITIVE_REQUEST.test(combinedRaw)
  ) {
    return SENSITIVE_REQUEST.test(combinedRaw)
      ? { code: 'privacy', reason: 'Private household or credential content is outside this skill.' }
      : { code: 'injection', reason: 'Embedded instructions cannot override this skill contract.' }
  }
  return null
}

export function normalizedRequestForResponse(request, rawInput = '') {
  const rawText = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput)
  const refusal = detectRefusal(request, rawText)
  if (refusal?.code !== 'privacy') {
    return request
  }
  return {
    ...request,
    surface: 'Private content request',
    intent: 'Private or sensitive content request',
    requiredPlaceholders: [],
    forbiddenTerms: [],
    stateMatrix: [],
    outputCount: 1,
  }
}

export function validateRequest(request) {
  const errors = []
  if (!REQUEST_MODES.includes(request.mode)) errors.push(`Invalid mode ${request.mode}.`)
  if (!CONTEXT_CLASSES.includes(request.contextClass)) errors.push(`Invalid contextClass ${request.contextClass}.`)
  if (!request.surface) errors.push('surface is required.')
  if (!request.intent) errors.push('intent is required.')
  if (!OWNERSHIPS.includes(request.ownership)) errors.push(`Invalid ownership ${request.ownership}.`)
  if (!(request.maxCharacters === null || Number.isInteger(request.maxCharacters) && request.maxCharacters > 0)) errors.push('maxCharacters must be null or a positive integer.')
  if (!(request.maxWords === null || Number.isInteger(request.maxWords) && request.maxWords > 0)) errors.push('maxWords must be null or a positive integer.')
  if (!Array.isArray(request.requiredPlaceholders)) errors.push('requiredPlaceholders must be an array.')
  if (!Array.isArray(request.forbiddenTerms)) errors.push('forbiddenTerms must be an array.')
  if (!Array.isArray(request.stateMatrix)) errors.push('stateMatrix must be an array.')
  if (!Number.isInteger(request.outputCount) || request.outputCount < 1 || request.outputCount > 5) errors.push('outputCount must be between 1 and 5.')
  if (Array.isArray(request.requiredPlaceholders)) {
    for (const placeholder of request.requiredPlaceholders) {
      if (!/^{{[^{}]+}}$/.test(placeholder)) errors.push(`Invalid placeholder ${placeholder}.`)
    }
  }
  if (Array.isArray(request.stateMatrix) && request.stateMatrix.length) {
    const identifierFields = request.stateMatrix.map((entry) =>
      ['variant', 'state', 'id'].filter((field) => typeof entry?.[field] === 'string' && entry[field].trim()))
    if (identifierFields.some((fields) => fields.length !== 1)) {
      errors.push('Every stateMatrix entry requires exactly one nonempty variant, state, or id.')
    }
    const variantIds = request.stateMatrix.map((entry) => entry?.variant ?? entry?.state ?? entry?.id)
    if (variantIds.some((value) => typeof value !== 'string' || !value.trim())) {
      errors.push('Every stateMatrix entry requires a nonempty variant, state, or id.')
    } else if (new Set(variantIds).size !== variantIds.length) {
      errors.push('stateMatrix variant ids must be unique.')
    }
    if (request.outputCount !== request.stateMatrix.length) {
      errors.push('outputCount must match the stateMatrix variant family size.')
    }
  }
  if (
    request.contextClass === 'success'
    && (
      !Array.isArray(request.stateMatrix)
      || !request.stateMatrix.some((entry) => (entry?.variant ?? entry?.state ?? entry?.id) === 'confirmed')
    )
  ) {
    errors.push('Success copy requires an explicit confirmed stateMatrix entry.')
  }
  return errors
}

function styleErrors(text, request) {
  const errors = []
  const trimmed = text.trim()
  if (SHORT_TITLE_CONTEXTS.has(request.contextClass)) {
    if (/[.]$/.test(trimmed)) errors.push('Short copy must not end with a period.')
    if (!['a11y', 'notification-title'].includes(request.contextClass) && !titleLike(trimmed.replaceAll(PLACEHOLDER, 'Value'))) {
      errors.push('Short label/title copy must use Title Case.')
    }
  }
  if (PROSE_CONTEXTS.has(request.contextClass) && !terminalPunctuation(trimmed)) {
    errors.push('Prose must end with terminal punctuation.')
  }
  if (ACTION_CONTEXTS.has(request.contextClass) && !startsWithVerb(trimmed.replaceAll(PLACEHOLDER, 'Value'))) {
    errors.push('Action copy must be verb-first.')
  }
  if (request.contextClass === 'destructive-action' && words(trimmed).length < 2) {
    errors.push('Destructive actions must name an explicit object.')
  }
  if (request.contextClass === 'loading') {
    if (!trimmed.endsWith('…')) errors.push('Loading copy must end with a Unicode ellipsis.')
    if (trimmed.includes('...')) errors.push('Loading copy must not use three periods.')
  }
  if (request.contextClass === 'notification-title') {
    if (!trimmed.includes(' · ')) errors.push('Notification titles must use the topic/state middle-dot pattern.')
    if (terminalPunctuation(trimmed)) errors.push('Notification titles must not end with sentence punctuation.')
  }
  if (request.contextClass === 'a11y' && /\b(?:button|link|dialog|tab)$/i.test(trimmed)) {
    errors.push('Accessible names must not append the role name.')
  }
  if (/\u2014/.test(trimmed)) errors.push('Compact house-style copy must avoid em dashes.')
  if (BACKEND_ID.test(trimmed)) errors.push('Raw backend IDs are forbidden.')
  return errors
}

export function validateCandidate(text, request) {
  const errors = []
  if (typeof text !== 'string' || !text.trim()) return ['Candidate text is required.']
  if (request.maxCharacters !== null && text.length > request.maxCharacters) errors.push(`Candidate exceeds maxCharacters ${request.maxCharacters}.`)
  if (request.maxWords !== null && words(text).length > request.maxWords) errors.push(`Candidate exceeds maxWords ${request.maxWords}.`)
  const requiredPlaceholders = Array.isArray(request.requiredPlaceholders) ? request.requiredPlaceholders : []
  const actualPlaceholderTokens = String(text).match(PLACEHOLDER) ?? []
  if (JSON.stringify([...actualPlaceholderTokens].sort()) !== JSON.stringify([...requiredPlaceholders].sort())) {
    errors.push('Candidate placeholders do not exactly match requiredPlaceholders.')
  }
  if (/[{}]/.test(String(text).replace(PLACEHOLDER, ''))) errors.push('Candidate contains malformed placeholder braces.')
  for (const forbidden of Array.isArray(request.forbiddenTerms) ? request.forbiddenTerms : []) {
    if (forbidden && text.toLowerCase().includes(forbidden.toLowerCase())) errors.push(`Candidate contains forbidden term ${forbidden}.`)
  }
  errors.push(...styleErrors(text, request))
  return errors
}

export function validateResponse(response, request, rawInput = '') {
  const errors = []
  const allowedTopLevel = [
    'status',
    'normalizedRequest',
    'proposedKey',
    'rankedCandidates',
    'exemplarsUsed',
    'checks',
    'warnings',
    'refusal',
    'confidence',
  ]
  if (!response || typeof response !== 'object' || Array.isArray(response)) return ['Response must be an object.']
  for (const field of allowedTopLevel) {
    if (!(field in response)) errors.push(`Missing response field ${field}.`)
  }

  for (const field of Object.keys(response)) {
    if (!allowedTopLevel.includes(field)) errors.push(`Unexpected response field ${field}.`)
  }
  if (!RESPONSE_STATUSES.includes(response.status)) errors.push(`Invalid response status ${response.status}.`)
  if (!['high', 'medium', 'low'].includes(response.confidence)) errors.push('confidence must be high, medium, or low.')
  if (!Array.isArray(response.rankedCandidates)) errors.push('rankedCandidates must be an array.')
  if (!Array.isArray(response.exemplarsUsed)) errors.push('exemplarsUsed must be an array.')
  if (!Array.isArray(response.warnings)) errors.push('warnings must be an array.')
  if (!response.checks || typeof response.checks !== 'object') errors.push('checks must be an object.')
  if (!response.normalizedRequest || typeof response.normalizedRequest !== 'object' || Array.isArray(response.normalizedRequest)) {
    errors.push('normalizedRequest must be an object.')
  }
  for (const check of RESPONSE_CHECKS) {
    if (response.checks?.[check] !== true) errors.push(`Response check ${check} must be true.`)
  }
  const requestFields = [
    'mode',
    'contextClass',
    'surface',
    'intent',
    'ownership',
    'maxCharacters',
    'maxWords',
    'requiredPlaceholders',
    'forbiddenTerms',
    'stateMatrix',
    'outputCount',
  ]
  const mandatoryRefusal = detectRefusal(request, typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput))
  const expectedNormalizedRequest = normalizedRequestForResponse(request, rawInput)
  for (const field of Object.keys(response.normalizedRequest ?? {})) {
    if (!requestFields.includes(field)) errors.push(`Unexpected normalizedRequest field ${field}.`)
  }
  for (const field of Object.keys(response.checks ?? {})) {
    if (!RESPONSE_CHECKS.includes(field)) errors.push(`Unexpected response check ${field}.`)
  }
  for (const field of requestFields) {
    if (JSON.stringify(canonicalValue(response.normalizedRequest?.[field])) !== JSON.stringify(canonicalValue(expectedNormalizedRequest[field]))) {
      errors.push(`normalizedRequest.${field} does not match the normalized input.`)
    }
  }
  const rankedCandidates = Array.isArray(response.rankedCandidates) ? response.rankedCandidates : []
  if (mandatoryRefusal) {
    if (response.status !== 'refused') errors.push(`Mandatory refusal ${mandatoryRefusal.code} was not returned.`)
    if (response.refusal?.code !== mandatoryRefusal.code) errors.push(`Mandatory refusal code must be ${mandatoryRefusal.code}.`)
    if (response.refusal?.reason !== mandatoryRefusal.reason) errors.push(`Mandatory refusal reason must be ${JSON.stringify(mandatoryRefusal.reason)}.`)
  }
  if (response.status === 'ok') {
    if (response.refusal !== null) errors.push('Successful responses must use refusal: null.')
    if (typeof response.proposedKey !== 'string' || !/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/.test(response.proposedKey)) {
      errors.push('proposedKey must be a semantic dotted key.')
    }
    if (rankedCandidates.length !== request.outputCount) errors.push(`Expected ${request.outputCount} ranked candidates.`)
    const seenRanks = new Set()
    const seenTexts = new Set()
    const seenVariants = new Set()
    const expectedVariants = (Array.isArray(request.stateMatrix) ? request.stateMatrix : [])
      .map((entry) => entry?.variant ?? entry?.state ?? entry?.id)
      .filter((value) => typeof value === 'string')
      .sort()
    for (const candidate of rankedCandidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push('Each ranked candidate must be an object.')
        continue
      }
      for (const field of Object.keys(candidate)) {
        if (!['rank', 'text', 'rationale', 'variant'].includes(field)) errors.push(`Unexpected ranked candidate field ${field}.`)
      }
      if (!Number.isInteger(candidate.rank) || candidate.rank < 1 || candidate.rank > request.outputCount) errors.push('Candidate rank is invalid.')
      if (seenRanks.has(candidate.rank)) errors.push('Candidate ranks must be unique.')
      seenRanks.add(candidate.rank)
      if (seenTexts.has(candidate.text)) errors.push('Candidate texts must be unique.')
      seenTexts.add(candidate.text)
      if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) errors.push('Candidate rationale is required.')
      if (expectedVariants.length) {
        if (typeof candidate.variant !== 'string' || !candidate.variant) errors.push('State/plural candidates require a variant id.')
        else if (seenVariants.has(candidate.variant)) errors.push('Candidate variant ids must be unique.')
        else seenVariants.add(candidate.variant)
      }
      errors.push(...validateCandidate(candidate.text, request).map((error) => `Rank ${candidate.rank}: ${error}`))
    }
    if (expectedVariants.length && JSON.stringify([...seenVariants].sort()) !== JSON.stringify(expectedVariants)) {
      errors.push('Candidate variant ids do not match the requested stateMatrix.')
    }
  } else {
    if (rankedCandidates.length !== 0) errors.push(`${response.status} responses must not contain candidates.`)
    if (response.proposedKey !== null) errors.push(`${response.status} responses must use proposedKey: null.`)
    if (!response.refusal || typeof response.refusal.code !== 'string' || typeof response.refusal.reason !== 'string') {
      errors.push(`${response.status} responses require a structured refusal.`)
    } else {
      for (const field of Object.keys(response.refusal)) {
        if (!['code', 'reason'].includes(field)) errors.push(`Unexpected refusal field ${field}.`)
      }
      if (!REFUSAL_CODES.includes(response.refusal.code)) errors.push(`Invalid refusal code ${response.refusal.code}.`)
    }
  }
  if (Array.isArray(response.exemplarsUsed) && response.exemplarsUsed.some((value) => typeof value !== 'string')) {
    errors.push('exemplarsUsed entries must be strings.')
  }
  if (Array.isArray(response.warnings) && response.warnings.some((value) => typeof value !== 'string')) {
    errors.push('warnings entries must be strings.')
  }
  const untrustedOutput = [
    ...rankedCandidates.flatMap((candidate) => candidate && typeof candidate === 'object'
      ? [candidate.text, candidate.rationale, candidate.variant]
      : []),
    ...(Array.isArray(response.warnings) ? response.warnings : []),
    response.refusal?.reason,
  ].filter((value) => typeof value === 'string').join('\n')
  const exemplarOutput = (Array.isArray(response.exemplarsUsed) ? response.exemplarsUsed : [])
    .filter((value) => typeof value === 'string')
    .join('\n')
  if (BACKEND_ID.test(untrustedOutput)) errors.push('Raw backend IDs are forbidden outside normalizedRequest.')
  if (SENSITIVE_OUTPUT.test(`${untrustedOutput}\n${exemplarOutput}\n${typeof response.proposedKey === 'string' ? response.proposedKey : ''}`)) {
    errors.push('Sensitive output is forbidden.')
  }
  if (BACKEND_EXEMPLAR_ID.test(exemplarOutput)) {
    errors.push('Raw backend IDs are forbidden in exemplarsUsed.')
  }
  if (
    typeof response.proposedKey === 'string'
    && response.proposedKey.split('.').slice(1).some((segment) => BACKEND_DOMAIN_SEGMENT.test(segment))
  ) {
    errors.push('proposedKey must not embed a raw backend domain.')
  }
  return errors
}

export function validateResponseSet(response, requests, rawInputs = requests) {
  if (!requests.length) return ['At least one request is required.']
  if (requests.length === 1) {
    if (Array.isArray(response)) return ['Single string requests require one response object, not an array.']
    return validateResponse(response, requests[0], rawInputs[0])
  }
  if (!Array.isArray(response)) return ['Multiple string requests require a JSON array of strict response objects.']
  if (response.length !== requests.length) return [`Expected ${requests.length} response objects, received ${response.length}.`]
  return response.flatMap((entry, index) => validateResponse(entry, requests[index], rawInputs[index]).map((error) => `Response ${index + 1}: ${error}`))
}

export function deterministicShuffle(items, seed) {
  const result = [...items]
  let state = Number.parseInt(textHash(seed, 8), 16) || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function batchesForCases(cases, plan, profileId, repeat) {
  const selectedIds = plan.caseIds ? new Set(plan.caseIds) : null
  const selected = cases.filter((evalCase) => !selectedIds || selectedIds.has(evalCase.id))
  const singletonIds = new Set(plan.singletonCaseIds ?? [])
  const singletonCases = selected.filter((evalCase) => singletonIds.has(evalCase.id))
  const groupedCases = selected.filter((evalCase) => !singletonIds.has(evalCase.id))
  const grouped = new Map()
  for (const evalCase of groupedCases) {
    const context = evalCase.expectedRequest.contextClass
    const bucket = grouped.get(context) ?? []
    bucket.push(evalCase)
    grouped.set(context, bucket)
  }
  const batches = singletonCases.map((evalCase) => ({
    contextClass: evalCase.expectedRequest.contextClass,
    cases: [evalCase],
    singleton: true,
  }))
  for (const [contextClass, contextCases] of grouped) {
    const ordered = plan.shuffle
      ? deterministicShuffle(contextCases, `${plan.name}:${profileId}:${repeat}:${contextClass}`)
      : contextCases
    for (let index = 0; index < ordered.length; index += plan.batchSize) {
      const chunk = ordered.slice(index, index + plan.batchSize)
      batches.push({
        contextClass,
        cases: chunk,
        singleton: plan.batchSize === 1 && chunk.length === 1,
      })
    }
  }
  return plan.shuffle
    ? deterministicShuffle(batches, `${plan.name}:${profileId}:${repeat}:batches`)
    : batches
}

export function packedLaunchUnits(batches, maxCases) {
  const units = []
  let current = []
  let currentCases = 0
  const flush = () => {
    if (!current.length) return
    units.push({
      contextClass: current.length === 1 ? current[0].contextClass : 'packed',
      logicalBatches: current,
      singleton: false,
    })
    current = []
    currentCases = 0
  }

  for (const batch of batches) {
    if (batch.singleton) {
      flush()
      units.push({
        contextClass: batch.contextClass,
        logicalBatches: [batch],
        singleton: true,
      })
      continue
    }
    if (currentCases + batch.cases.length > maxCases) flush()
    current.push(batch)
    currentCases += batch.cases.length
  }
  flush()
  return units
}
