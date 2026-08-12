import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

export const RULE_IDS = [
  'raw-color-literal',
  'undefined-rd-variable',
  'modal-disclosure-import',
  'visual-active-rule',
] as const

export type RuleId = (typeof RULE_IDS)[number]

export interface Violation {
  file: string
  line: number
  rule: RuleId
  subject: string
}

export interface AggregatedViolation {
  file: string
  id: string
  lines: number[]
  occurrences: number
  rule: RuleId
  subject: string
}

interface BaselineViolation {
  file: string
  id: string
  maxOccurrences: number
  rule: RuleId
  subject: string
}

export interface DesignSystemBaseline {
  rules: RuleId[]
  scanner: 'scripts/design-system/check.ts'
  version: 1
  violations: BaselineViolation[]
}

export interface Regression {
  allowedOccurrences: number
  current: AggregatedViolation
  kind: 'increased' | 'new'
}

interface CssBlock {
  bodyEnd: number
  bodyStart: number
  children: CssBlock[]
  prelude: string
  preludeStart: number
}

interface CssFrame {
  block?: CssBlock
  children: CssBlock[]
  nextPreludeStart: number
}

interface VariableUse {
  file: string
  line: number
  name: string
}

const BASELINE_VERSION = 1
const BASELINE_PATH = 'scripts/design-system/baseline.json'
const SURFACE_ACCESSORY_PATH = 'src/components/core/SurfaceAccessory.tsx'
const RD_VARIABLE_PATTERN = '--rd-[A-Za-z0-9_-]+'
const RAW_COLOR_DEFINITION_FILES = new Set([
  'src/styles/tokens.css',
])
const RULE_ORDER = new Map<RuleId, number>(RULE_IDS.map((rule, index) => [rule, index]))

function normalizePath(path: string) {
  return path.replaceAll('\\', '/')
}

function lineNumber(source: string, index: number) {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1
  }
  return line
}

function maskRange(source: string) {
  return source.replace(/[^\n]/g, ' ')
}

function maskCssComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, maskRange)
}

function maskTypeScriptComments(source: string) {
  const characters = source.split('')
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    source,
  )

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia
      && token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue
    }
    for (let index = scanner.getTokenPos(); index < scanner.getTextPos(); index += 1) {
      if (characters[index] !== '\n') characters[index] = ' '
    }
  }

  return characters.join('')
}

function runtimeSourceFile(file: string) {
  const normalized = normalizePath(file)
  const extension = extname(normalized)
  if (!['.css', '.ts', '.tsx'].includes(extension)) return false
  if (normalized.includes('/src/test/') || normalized.includes('/__tests__/')) return false
  return !/\.(?:spec|stories|test)\.(?:ts|tsx)$/.test(normalized)
}

function walkRuntimeSource(root: string) {
  const sourceRoot = resolve(root, 'src')
  if (!existsSync(sourceRoot)) return []

  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return walk(path)
      return entry.isFile() && runtimeSourceFile(path) ? [path] : []
    })

  return walk(sourceRoot)
}

function cssBlocks(source: string) {
  const blocks: CssBlock[] = []
  const rootFrame: CssFrame = {
    children: blocks,
    nextPreludeStart: 0,
  }
  const stack = [rootFrame]
  let quote: '"' | "'" | undefined
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = undefined
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    const frame = stack.at(-1)!
    if (character === ';') {
      frame.nextPreludeStart = index + 1
      continue
    }
    if (character === '{') {
      const block: CssBlock = {
        bodyEnd: source.length,
        bodyStart: index + 1,
        children: [],
        prelude: source.slice(frame.nextPreludeStart, index).trim(),
        preludeStart: frame.nextPreludeStart,
      }
      frame.children.push(block)
      stack.push({
        block,
        children: block.children,
        nextPreludeStart: index + 1,
      })
      continue
    }
    if (character === '}' && stack.length > 1) {
      const completed = stack.pop()!
      if (completed.block) completed.block.bodyEnd = index
      stack.at(-1)!.nextPreludeStart = index + 1
    }
  }

  return blocks
}

function flattenBlocks(blocks: CssBlock[]): CssBlock[] {
  return blocks.flatMap((block) => [block, ...flattenBlocks(block.children)])
}

function directBlockBody(source: string, block: CssBlock) {
  const body = [...source.slice(block.bodyStart, block.bodyEnd)]
  for (const child of block.children) {
    const start = Math.max(0, child.preludeStart - block.bodyStart)
    const end = Math.min(body.length, child.bodyEnd + 1 - block.bodyStart)
    for (let index = start; index < end; index += 1) {
      if (body[index] !== '\n') body[index] = ' '
    }
  }
  return body.join('')
}

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/g, ' ').trim()
}

function splitSelectorList(selector: string) {
  const selectors: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]
    if (character === '(' || character === '[') depth += 1
    else if (character === ')' || character === ']') depth = Math.max(0, depth - 1)
    else if (character === ',' && depth === 0) {
      selectors.push(normalizeSelector(selector.slice(start, index)))
      start = index + 1
    }
  }
  selectors.push(normalizeSelector(selector.slice(start)))
  return selectors.filter(Boolean)
}

function visualActiveProperty(property: string) {
  const normalized = property
    .toLowerCase()
    .replace(/^-(?:moz|ms|o|webkit)-/, '')
  return normalized === 'transform'
    || normalized === 'opacity'
    || normalized === 'filter'
    || normalized === 'backdrop-filter'
    || normalized === 'background'
    || normalized.startsWith('background-')
    || normalized === 'border'
    || normalized.startsWith('border-')
}

function scanCss(
  source: string,
  file: string,
  definitions: Set<string>,
  variableUses: VariableUse[],
  violations: Violation[],
) {
  const masked = maskCssComments(source)
  if (!RAW_COLOR_DEFINITION_FILES.has(file)) {
    const colorPattern = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(?<![-\w])(?:black|transparent|white)(?![-\w])/gi
    for (const match of masked.matchAll(colorPattern)) {
      violations.push({
        file,
        line: lineNumber(source, match.index!),
        rule: 'raw-color-literal',
        subject: match[0].replace(/\s+/g, ' ').trim().toLowerCase(),
      })
    }
  }
  const definitionPattern = new RegExp(`(?:^|[;{])\\s*(${RD_VARIABLE_PATTERN})\\s*:`, 'gm')
  for (const match of masked.matchAll(definitionPattern)) {
    definitions.add(match[1])
  }
  const propertyRegistrationPattern = new RegExp(`@property\\s+(${RD_VARIABLE_PATTERN})\\b`, 'g')
  for (const match of masked.matchAll(propertyRegistrationPattern)) {
    definitions.add(match[1])
  }

  const usePattern = new RegExp(`var\\(\\s*(${RD_VARIABLE_PATTERN})\\b`, 'g')
  for (const match of masked.matchAll(usePattern)) {
    variableUses.push({
      file,
      line: lineNumber(source, match.index!),
      name: match[1],
    })
  }

  for (const block of flattenBlocks(cssBlocks(masked))) {
    const selector = normalizeSelector(block.prelude)
    if (selector.startsWith('@')) continue
    const activeSelectors = splitSelectorList(selector).filter((candidate) => candidate.includes(':active'))
    if (activeSelectors.length === 0) continue

    const body = directBlockBody(masked, block)
    const declarationPattern = /(?:^|;)\s*([-\w]+)\s*:/g
    for (const match of body.matchAll(declarationPattern)) {
      const property = match[1].toLowerCase()
      if (!visualActiveProperty(property)) continue
      const propertyOffset = match.index! + match[0].indexOf(match[1])
      for (const activeSelector of activeSelectors) {
        violations.push({
          file,
          line: lineNumber(source, block.bodyStart + propertyOffset),
          rule: 'visual-active-rule',
          subject: `${activeSelector} :: ${property}`,
        })
      }
    }
  }
}

function staticPropertyName(name: ts.PropertyName | undefined) {
  if (!name) return undefined
  if (
    ts.isIdentifier(name)
    || ts.isStringLiteral(name)
    || ts.isNoSubstitutionTemplateLiteral(name)
    || ts.isNumericLiteral(name)
  ) {
    return name.text
  }
  return undefined
}

function moduleSpecifierText(node: ts.ImportDeclaration | ts.ExportDeclaration) {
  return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
    ? node.moduleSpecifier.text
    : undefined
}

function importsModalDisclosure(node: ts.ImportDeclaration, specifier: string) {
  if (modalDisclosureModule(specifier)) return true

  const clause = node.importClause
  if (clause?.name?.text === 'ModalDisclosureIcon') return true
  if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false
  return clause.namedBindings.elements.some((element) =>
    (element.propertyName?.text ?? element.name.text) === 'ModalDisclosureIcon'
    || element.name.text === 'ModalDisclosureIcon')
}

function modalDisclosureModule(specifier: string) {
  const normalizedSpecifier = normalizePath(specifier).replace(/\.(?:js|jsx|ts|tsx)$/, '')
  return normalizedSpecifier.endsWith('/ModalDisclosureIcon')
    || normalizedSpecifier === 'ModalDisclosureIcon'
}

function scanTypeScript(
  source: string,
  file: string,
  definitions: Set<string>,
  variableUses: VariableUse[],
  violations: Violation[],
) {
  const masked = maskTypeScriptComments(source)
  const usePattern = new RegExp(`var\\(\\s*(${RD_VARIABLE_PATTERN})\\b`, 'g')
  for (const match of masked.matchAll(usePattern)) {
    variableUses.push({
      file,
      line: lineNumber(source, match.index!),
      name: match[1],
    })
  }

  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const lineFor = (node: ts.Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  const addModalImportViolation = (node: ts.Node, specifier: string) => {
    if (file === SURFACE_ACCESSORY_PATH || !modalDisclosureModule(specifier)) return
    violations.push({
      file,
      line: lineFor(node),
      rule: 'modal-disclosure-import',
      subject: `module ${specifier}`,
    })
  }

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = staticPropertyName(node.name)
      if (name?.startsWith('--rd-')) definitions.add(name)
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'setProperty'
      && node.arguments[0]
      && ts.isStringLiteralLike(node.arguments[0])
      && node.arguments[0].text.startsWith('--rd-')
    ) {
      definitions.add(node.arguments[0].text)
    }

    if (ts.isImportDeclaration(node)) {
      const specifier = moduleSpecifierText(node)
      if (specifier) {
        if (file !== SURFACE_ACCESSORY_PATH && importsModalDisclosure(node, specifier)) {
          violations.push({
            file,
            line: lineFor(node),
            rule: 'modal-disclosure-import',
            subject: `module ${specifier}`,
          })
        }
      }
    } else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynamicImport || isRequire) {
        addModalImportViolation(node, node.arguments[0].text)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function violationId(violation: Pick<Violation, 'file' | 'rule' | 'subject'>) {
  return createHash('sha256')
    .update([violation.rule, violation.file, violation.subject].join('\0'))
    .digest('hex')
    .slice(0, 16)
}

function compareViolations(
  left: Pick<AggregatedViolation, 'file' | 'rule' | 'subject'>,
  right: Pick<AggregatedViolation, 'file' | 'rule' | 'subject'>,
) {
  return (RULE_ORDER.get(left.rule)! - RULE_ORDER.get(right.rule)!)
    || left.file.localeCompare(right.file)
    || left.subject.localeCompare(right.subject)
}

export function aggregateViolations(violations: Violation[]) {
  const grouped = new Map<string, AggregatedViolation>()
  for (const violation of violations) {
    const id = violationId(violation)
    const current = grouped.get(id)
    if (current) {
      current.occurrences += 1
      current.lines = [...new Set([...current.lines, violation.line])].sort((left, right) => left - right)
    } else {
      grouped.set(id, {
        ...violation,
        id,
        lines: [violation.line],
        occurrences: 1,
      })
    }
  }
  return [...grouped.values()].sort(compareViolations)
}

export function scanRepository(root = process.cwd()) {
  const definitions = new Set<string>()
  const variableUses: VariableUse[] = []
  const violations: Violation[] = []

  for (const absolutePath of walkRuntimeSource(root)) {
    const file = normalizePath(relative(root, absolutePath))
    const source = readFileSync(absolutePath, 'utf8')
    if (file.endsWith('.css')) {
      scanCss(source, file, definitions, variableUses, violations)
    } else {
      scanTypeScript(source, file, definitions, variableUses, violations)
    }
  }

  for (const use of variableUses) {
    if (definitions.has(use.name)) continue
    violations.push({
      file: use.file,
      line: use.line,
      rule: 'undefined-rd-variable',
      subject: use.name,
    })
  }

  return violations.sort((left, right) =>
    compareViolations(left, right) || left.line - right.line)
}

export function createBaseline(violations: Violation[]): DesignSystemBaseline {
  return {
    rules: [...RULE_IDS],
    scanner: 'scripts/design-system/check.ts',
    version: BASELINE_VERSION,
    violations: aggregateViolations(violations).map((violation) => ({
      file: violation.file,
      id: violation.id,
      maxOccurrences: violation.occurrences,
      rule: violation.rule,
      subject: violation.subject,
    })),
  }
}

function validateBaseline(value: unknown): asserts value is DesignSystemBaseline {
  if (!value || typeof value !== 'object') {
    throw new Error('Design-system baseline must be a JSON object.')
  }
  const baseline = value as Partial<DesignSystemBaseline>
  if (
    baseline.version !== BASELINE_VERSION
    || baseline.scanner !== 'scripts/design-system/check.ts'
    || !Array.isArray(baseline.violations)
  ) {
    throw new Error('Design-system baseline version is unsupported. Review and regenerate it intentionally.')
  }
  if (
    !Array.isArray(baseline.rules)
    || baseline.rules.length !== RULE_IDS.length
    || RULE_IDS.some((rule, index) => baseline.rules![index] !== rule)
  ) {
    throw new Error('Design-system baseline does not declare every scanner rule.')
  }

  const ids = new Set<string>()
  for (const entry of baseline.violations) {
    if (
      !entry
      || !RULE_IDS.includes(entry.rule)
      || typeof entry.file !== 'string'
      || typeof entry.subject !== 'string'
      || !Number.isInteger(entry.maxOccurrences)
      || entry.maxOccurrences < 1
      || entry.id !== violationId(entry)
      || ids.has(entry.id)
    ) {
      throw new Error('Design-system baseline contains an invalid or duplicate violation entry.')
    }
    ids.add(entry.id)
  }
}

export function findRegressions(
  violations: Violation[],
  baseline: DesignSystemBaseline,
) {
  validateBaseline(baseline)
  const allowed = new Map(baseline.violations.map((entry) => [entry.id, entry]))
  const regressions: Regression[] = []

  for (const current of aggregateViolations(violations)) {
    const baselineEntry = allowed.get(current.id)
    if (!baselineEntry) {
      regressions.push({
        allowedOccurrences: 0,
        current,
        kind: 'new',
      })
    } else if (current.occurrences > baselineEntry.maxOccurrences) {
      regressions.push({
        allowedOccurrences: baselineEntry.maxOccurrences,
        current,
        kind: 'increased',
      })
    }
  }

  return regressions
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function baselineFile(root: string) {
  return resolve(root, BASELINE_PATH)
}

function writeBaseline(root: string, baseline: DesignSystemBaseline) {
  const path = baselineFile(root)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableJson(baseline))
}

function readBaseline(root: string) {
  const path = baselineFile(root)
  if (!existsSync(path)) {
    throw new Error(`Missing ${BASELINE_PATH}. Create and review it with --write.`)
  }
  const baseline = JSON.parse(readFileSync(path, 'utf8')) as unknown
  validateBaseline(baseline)
  return baseline
}

function formatRegression(regression: Regression) {
  const { current } = regression
  const lines = current.lines.join(',')
  const allowance = regression.kind === 'new'
    ? 'new'
    : `${current.occurrences} occurrences; baseline allows ${regression.allowedOccurrences}`
  return `${current.rule} ${current.file}:${lines} ${current.subject} (${allowance})`
}

export function runCli(argv = process.argv.slice(2), root = process.cwd()) {
  const unknown = argv.filter((argument) => argument !== '--check' && argument !== '--write' && argument !== '--refresh-baseline')
  const write = argv.includes('--write')
  const check = argv.includes('--check')
  const refresh = argv.includes('--refresh-baseline')
  if (unknown.length > 0 || [write, check, refresh].filter(Boolean).length > 1) {
    throw new Error('Usage: tsx scripts/design-system/check.ts [--check | --write | --refresh-baseline]')
  }

  const violations = scanRepository(root)
  if (refresh) {
    const baseline = createBaseline(violations)
    writeBaseline(root, baseline)
    console.log(`Refreshed ${BASELINE_PATH} with ${baseline.violations.length} reviewed violation record(s).`)
    return
  }

  const baseline = readBaseline(root)
  const regressions = findRegressions(violations, baseline)
  if (write) {
    if (regressions.length > 0) {
      throw new Error([
        'Design-system baseline cannot absorb new or increased violations:',
        ...regressions.map((regression) => `- ${formatRegression(regression)}`),
        'Fix the source. Use --refresh-baseline only for an explicit, reviewed scanner or migration change.',
      ].join('\n'))
    }
    const nextBaseline = createBaseline(violations)
    writeBaseline(root, nextBaseline)
    console.log(`Pruned ${BASELINE_PATH} to ${nextBaseline.violations.length} allowlisted violation record(s).`)
    return
  }

  if (regressions.length > 0) {
    throw new Error([
      'Design-system check found new or increased violations:',
      ...regressions.map((regression) => `- ${formatRegression(regression)}`),
      'Fix the source. --write may only prune resolved debt.',
    ].join('\n'))
  }

  const occurrences = aggregateViolations(violations)
    .reduce((total, violation) => total + violation.occurrences, 0)
  console.log(`Design-system check passed with ${occurrences} existing allowlisted occurrence(s).`)
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (entryPath === import.meta.url) {
  try {
    runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
