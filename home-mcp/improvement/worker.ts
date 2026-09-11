import { spawn } from 'node:child_process'
import { access, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadRuntimeEnvironment } from '../../scripts/lib/runtimeEnv'
import { analyzeImprovementJob, implementImprovement, reviewImprovement, type CopilotImprovementOptions } from './copilot'
import { publishHomeMcp } from './publish'
import { fixtureFromAnalysis, validateRegressionFixture, writeRegressionFixture } from './regressions'
import { recordImprovementRelease } from './release'
import { ConversationImprovementStore } from './store'
import type { ImprovementAnalysis, ImprovementJob, ImprovementWorkerStatus } from './types'

const MARKER_SUFFIX = '.home-mcp-improver'
const REPOSITORY = 'SFenton/ha-sfenton-react-dash'
const MODEL_DEFAULT = 'gpt-5.6-sol'
const REQUIRED_PR_CHECK = 'Home MCP regression gates'
export const AUTOMATIC_VALIDATION_COMMANDS = [
  ['npm', ['run', 'test:change-policy']],
  ['npm', ['run', 'home-mcp:check']],
  ['npm', ['run', 'test:run', '--',
    'home-mcp/light-skill.test.ts',
    'home-mcp/app.test.ts',
    'home-mcp/corpus/generate-lights.test.ts',
    'home-mcp/hass-auth.test.ts',
    'home-mcp/improvement/copilot.test.ts',
    'home-mcp/improvement/install.test.ts',
    'home-mcp/improvement/publish.test.ts',
    'home-mcp/improvement/regressions.test.ts',
    'home-mcp/improvement/release.test.ts',
    'home-mcp/improvement/scope.test.ts',
    'home-mcp/improvement/store.test.ts',
    'home-mcp/improvement/worker.test.ts',
  ]],
  ['npm', ['run', 'home-mcp:regressions:validate']],
  ['npm', ['run', 'home-mcp:corpus:lights:validate', '--', '--utterances-per-family', '10000']],
] as const
export const AUTOMATIC_EDIT_PATHS = new Set([
  'home-mcp/light-skill.ts',
])

interface CommandResult {
  stdout: string
  stderr: string
}

interface WorkerOptions {
  autoPublish: boolean
  cliPath?: string
  dataDir: string
  deployRoot: string
  model: string
  repoRoot: string
}

class MergedCommitRevertedError extends Error {}

function run(command: string, args: readonly string[], cwd: string, inherit = false) {
  return new Promise<CommandResult>((resolvePromise, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    if (!inherit) {
      child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
      child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    }
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolvePromise({ stdout, stderr })
      : reject(new Error(`${command} ${args.join(' ')} exited ${code}${stderr ? `: ${stderr.slice(-2_000)}` : ''}`)))
  })
}

async function exists(path: string) {
  return access(path).then(() => true, () => false)
}

async function requireManagedRepository(repoRoot: string) {
  const marker = `${resolve(repoRoot)}${MARKER_SUFFIX}`
  if (!(await exists(marker))) throw new Error(`Missing ${marker}; refusing to reset an unmanaged repository`)
  if ((await readFile(marker, 'utf8')).trim() !== REPOSITORY) throw new Error(`Unexpected ${marker} owner`)
  const root = (await run('git', ['rev-parse', '--show-toplevel'], repoRoot)).stdout.trim()
  if (resolve(root) !== resolve(repoRoot)) throw new Error('Improvement repository root does not match its marker')
  const remote = (await run('git', ['remote', 'get-url', 'origin'], repoRoot)).stdout.trim()
  if (!remote.includes('SFenton/ha-sfenton-react-dash')) throw new Error('Unexpected improvement repository origin')
}

async function synchronizeRepository(repoRoot: string) {
  await requireManagedRepository(repoRoot)
  const status = (await run('git', ['status', '--porcelain'], repoRoot)).stdout.trim()
  if (status) throw new Error('Improvement repository is not clean')
  await run('git', ['fetch', 'origin', 'master'], repoRoot)
  await run('git', ['switch', 'master'], repoRoot)
  await run('git', ['reset', '--hard', 'origin/master'], repoRoot)
}

async function createWorktree(options: WorkerOptions, job: ImprovementJob) {
  await synchronizeRepository(options.repoRoot)
  const worktreesRoot = resolve(options.dataDir, 'worktrees')
  await mkdir(worktreesRoot, { recursive: true })
  const worktree = resolve(worktreesRoot, job.id)
  if (relative(worktreesRoot, worktree).startsWith('..')) throw new Error('Unsafe worktree path')
  await run('git', ['worktree', 'remove', '--force', worktree], options.repoRoot).catch(() => undefined)
  if (await exists(worktree)) await rm(worktree, { recursive: true })
  const branch = `auto/home-mcp-improvement-${job.id.slice(0, 12)}`
  await run('git', ['branch', '-D', branch], options.repoRoot).catch(() => undefined)
  await run('git', ['worktree', 'add', '-b', branch, worktree, 'origin/master'], options.repoRoot)
  const sharedModules = resolve(options.repoRoot, 'node_modules')
  if (!(await exists(sharedModules))) throw new Error('Run npm ci in the improvement repository before processing')
  await symlink(sharedModules, join(worktree, 'node_modules'), 'dir')
  return { branch, worktree }
}

async function removeWorktree(repoRoot: string, worktree: string, branch: string) {
  await run('git', ['worktree', 'remove', '--force', worktree], repoRoot).catch(() => undefined)
  await run('git', ['branch', '-D', branch], repoRoot).catch(() => undefined)
}

async function fileDigest(path: string) {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function changedPaths(worktree: string) {
  const result = await run('git', ['status', '--porcelain', '--untracked-files=all'], worktree)
  return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3).trim())
}

const FORBIDDEN_AUTOMATIC_CODE = /\b(?:process|global|globalThis|fetch|eval|Function|require|module|exports|console|WebSocket|XMLHttpRequest|Deno|Bun|document|window|navigator|Date|crypto|performance|setTimeout|setInterval|setImmediate|queueMicrotask|Atomics|SharedArrayBuffer|Proxy|Reflect|constructor|__proto__|prototype)\b|Math\.random\b|import\s*\(|while\s*\(|for\s*\(\s*;\s*;\s*\)|Object\.(?:defineProperty|setPrototypeOf)/u
const MUTATING_CAPABILITY_CONFIG = /\b(?:HOUSE_LIGHT_ROOMS|RGB_COLORS|WHITE_COLORS)\b[^\n]*(?:\[[^\]]+\]\s*=|\.(?:push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin)\s*\()/u
const AUTOMATIC_PARSER_FUNCTIONS = new Set([
  'roomsInText',
  'targetsInText',
  'actionSegments',
  'actionForSegment',
  'colorInText',
  'namedColorInText',
  'parseLightUtterance',
])
const FORBIDDEN_AUTOMATIC_IDENTIFIERS = new Set([
  'process', 'global', 'globalThis', 'fetch', 'eval', 'Function', 'require', 'module', 'exports',
  'console', 'WebSocket', 'XMLHttpRequest', 'Deno', 'Bun', 'document', 'window', 'navigator',
  'Date', 'crypto', 'performance', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask',
  'Atomics', 'SharedArrayBuffer', 'Proxy', 'Reflect',
])

function parserStructure(source: string) {
  const file = ts.createSourceFile('light-skill.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (diagnostics.length) throw new Error('Automatic parser candidate is not valid TypeScript syntax')
  return file.statements.map((statement) => {
    if (ts.isFunctionDeclaration(statement)) {
      if (!statement.name || !statement.body) throw new Error('Automatic parser functions must be named and implemented')
      return {
        kind: 'function',
        name: statement.name.text,
        signature: source.slice(statement.getStart(file), statement.body.getStart(file)).trim(),
      }
    }
    return {
      kind: ts.SyntaxKind[statement.kind],
      text: source.slice(statement.getFullStart(), statement.end).trim(),
    }
  })
}

function parserFunctions(source: string) {
  const file = ts.createSourceFile('light-skill.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return {
    file,
    functions: new Map(file.statements.flatMap((statement) => ts.isFunctionDeclaration(statement) && statement.name && statement.body
      ? [[statement.name.text, {
          body: source.slice(statement.body.getStart(file), statement.body.end),
          node: statement,
        }] as const]
      : [])),
  }
}

function changedParserFunctions(baseSource: string, candidateSource: string) {
  const base = parserFunctions(baseSource)
  const candidate = parserFunctions(candidateSource)
  return {
    base,
    candidate,
    names: [...candidate.functions].filter(([name, value]) => value.body !== base.functions.get(name)?.body).map(([name]) => name),
  }
}

function assertSafeParserAst(baseSource: string, candidateSource: string, changedFunctions: string[]) {
  const base = parserFunctions(baseSource)
  const candidate = parserFunctions(candidateSource)
  const baseExpressions = new Map([...base.functions].map(([name, value]) => {
    const elementAccess = new Set<string>()
    const mutations = new Set<string>()
    const collect = (node: ts.Node) => {
      if (ts.isElementAccessExpression(node)) elementAccess.add(baseSource.slice(node.getStart(base.file), node.end))
      if ((ts.isBinaryExpression(node)
          && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
          && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
        || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
          && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
        || ts.isDeleteExpression(node)
        || (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && ['assign', 'push', 'splice', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'fill', 'copyWithin']
            .includes(node.expression.name.text))) {
        mutations.add(baseSource.slice(node.getStart(base.file), node.end))
      }
      ts.forEachChild(node, collect)
    }
    collect(value.node.body!)
    return [name, { elementAccess, mutations }]
  }))
  const changed = new Set(changedFunctions)
  const visit = (node: ts.Node, functionName: string) => {
    if (ts.isIdentifier(node) && FORBIDDEN_AUTOMATIC_IDENTIFIERS.has(node.text)) {
      throw new Error(`Automatic parser change uses forbidden runtime identifier ${node.text}`)
    }
    if (node.kind === ts.SyntaxKind.ThisKeyword || ts.isMetaProperty(node)) {
      throw new Error('Automatic parser change uses unsafe runtime scope access')
    }
    if (ts.isElementAccessExpression(node)
      && node.argumentExpression
      && !ts.isIdentifier(node.argumentExpression)
      && !ts.isNumericLiteral(node.argumentExpression)) {
      throw new Error('Automatic parser change uses unsafe computed property access')
    }
    if (ts.isElementAccessExpression(node)
      && !ts.isNumericLiteral(node.argumentExpression)
      && !baseExpressions.get(functionName)?.elementAccess.has(candidateSource.slice(node.getStart(candidate.file), node.end))) {
      throw new Error('Automatic parser change adds unsafe computed property access')
    }
    if (ts.isPropertyAccessExpression(node)
      && ['constructor', 'getPrototypeOf', 'getOwnPropertyDescriptor', 'setPrototypeOf', 'defineProperty'].includes(node.name.text)) {
      throw new Error('Automatic parser change uses unsafe reflective property access')
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'Object' && node.name.text !== 'keys') {
      throw new Error('Automatic parser change uses an unsafe Object capability')
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken
      && (ts.isStringLiteralLike(node.left) || ts.isStringLiteralLike(node.right))) {
      throw new Error('Automatic parser change uses dynamic string construction')
    }
    const mutation = (ts.isBinaryExpression(node)
        && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
      || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
        && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
      || ts.isDeleteExpression(node)
      || (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ['assign', 'push', 'splice', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'fill', 'copyWithin']
          .includes(node.expression.name.text))
    if (mutation && !baseExpressions.get(functionName)?.mutations.has(candidateSource.slice(node.getStart(candidate.file), node.end))) {
      throw new Error('Automatic parser change adds an unsafe mutation')
    }
    ts.forEachChild(node, (child) => visit(child, functionName))
  }
  for (const [name, value] of candidate.functions) {
    if (changed.has(name)) visit(value.node.body!, name)
  }
}

export function validateAutomaticParserChange(baseSource: string, candidateSource: string, addedLines: string) {
  if (candidateSource.length - baseSource.length > 12_000) throw new Error('Automatic parser change is too large')
  if (addedLines.split('\n').filter(Boolean).length > 200) throw new Error('Automatic parser change adds too many lines')
  if (FORBIDDEN_AUTOMATIC_CODE.test(addedLines)) throw new Error('Automatic parser change contains forbidden runtime capabilities')
  if (MUTATING_CAPABILITY_CONFIG.test(addedLines)) throw new Error('Automatic parser change mutates canonical capability configuration')
  if (JSON.stringify(parserStructure(candidateSource)) !== JSON.stringify(parserStructure(baseSource))) {
    throw new Error('Automatic parser change modified imports, declarations, function signatures, or top-level structure')
  }
  const changed = changedParserFunctions(baseSource, candidateSource)
  const protectedChanges = changed.names.filter((name) => !AUTOMATIC_PARSER_FUNCTIONS.has(name))
  if (protectedChanges.length) throw new Error(`Automatic parser change modified protected functions: ${protectedChanges.join(', ')}`)
  assertSafeParserAst(baseSource, candidateSource, changed.names)
}

export function assertLearnedRegressionFailsBase(job: ImprovementJob, analysis: ImprovementAnalysis) {
  const failures = validateRegressionFixture(fixtureFromAnalysis(job, analysis))
  if (!failures.length) throw new Error('The proposed learned regression already passes on the base parser')
  return failures
}

async function validateCandidate(worktree: string, fixturePath: string, fixtureDigest: string) {
  const paths = await changedPaths(worktree)
  const fixtureRelative = relative(worktree, fixturePath).replaceAll('\\', '/')
  const allowed = new Set([...AUTOMATIC_EDIT_PATHS, fixtureRelative])
  const unexpected = paths.filter((path) => !allowed.has(path))
  if (unexpected.length) throw new Error(`Copilot changed files outside the light improvement scope: ${unexpected.join(', ')}`)
  if ((await fileDigest(fixturePath)) !== fixtureDigest) throw new Error('Copilot changed the frozen regression fixture')
  if (!paths.some((path) => AUTOMATIC_EDIT_PATHS.has(path))) throw new Error('Copilot did not change light capability behavior')
  const parserPath = 'home-mcp/light-skill.ts'
  const baseParser = (await run('git', ['show', `HEAD:${parserPath}`], worktree)).stdout
  const candidateParser = await readFile(resolve(worktree, parserPath), 'utf8')
  const parserDiff = (await run('git', ['diff', '--unified=0', '--', parserPath], worktree)).stdout
  const addedLines = parserDiff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n')
  validateAutomaticParserChange(baseParser, candidateParser, addedLines)
  await run('git', ['add', '-N', '--', relative(worktree, fixturePath)], worktree)
  await run('git', ['diff', '--check'], worktree)
  await runAutomaticValidation(worktree)
  return paths
}

async function runAutomaticValidation(worktree: string, baseRevision?: string) {
  for (const [command, args] of AUTOMATIC_VALIDATION_COMMANDS) {
    const effectiveArgs = baseRevision && args[1] === 'test:change-policy'
      ? [...args, '--', '--base', baseRevision]
      : args
    await run(command, effectiveArgs, worktree, true)
  }
}

async function candidateDiff(worktree: string, fixturePath: string) {
  await run('git', ['add', '-N', '--', relative(worktree, fixturePath)], worktree)
  return (await run('git', ['diff', '--no-ext-diff', '--unified=40'], worktree)).stdout
}

async function waitForPullRequestChecks(prUrl: string, worktree: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let checks: Array<{ name?: string }> = []
    try {
      const output = (await run('gh', ['pr', 'checks', prUrl, '--repo', REPOSITORY, '--json', 'name,state'], worktree)).stdout
      checks = JSON.parse(output) as Array<{ name?: string }>
    } catch {
      // GitHub may not have attached workflow checks immediately after PR creation.
    }
    if (checks.some((check) => check.name === REQUIRED_PR_CHECK)) {
      await run('gh', ['pr', 'checks', prUrl, '--repo', REPOSITORY, '--watch', '--fail-fast'], worktree, true)
      return
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10_000))
  }
  throw new Error('No pull-request checks appeared within ten minutes')
}

function improvementPullRequestBody(analysis: ImprovementAnalysis) {
  return [
    '## Improvement',
    '',
    ...analysis.summary.map((item) => `- ${item}`),
    '',
    '## Automated gates',
    '',
    '- Full deterministic light corpus',
    '- Learned multi-turn regression fixtures',
    '- Focused Home MCP unit and integration tests',
    '- TypeScript validation',
  ].join('\n')
}

async function commitImprovement(worktree: string, analysis: ImprovementAnalysis, version: string) {
  const title = `Improve Home MCP light conversations (${version})`
  await run('git', ['add', '--', 'home-mcp'], worktree)
  await run('git', ['diff', '--cached', '--check'], worktree)
  await run('git', ['commit', '-m', title, '-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'], worktree)
  const headCommit = (await run('git', ['rev-parse', 'HEAD'], worktree)).stdout.trim()
  return { headCommit, title }
}

async function ensureImprovementPullRequest(
  cwd: string,
  branch: string,
  headCommit: string,
  title: string,
  bodyPath: string,
) {
  const existing = JSON.parse((await run('gh', [
    'pr', 'list', '--repo', REPOSITORY, '--head', branch, '--state', 'all',
    '--limit', '1', '--json', 'number,state,url,headRefOid,mergeCommit',
  ], cwd)).stdout) as Array<{ number: number; state: string; url: string; headRefOid: string; mergeCommit?: { oid?: string } }>
  if (existing[0]?.state === 'CLOSED') {
    await run('gh', ['pr', 'reopen', String(existing[0].number), '--repo', REPOSITORY], cwd).catch(() => undefined)
    const reopened = JSON.parse((await run('gh', [
      'pr', 'view', String(existing[0].number), '--repo', REPOSITORY, '--json', 'number,state,url,headRefOid,mergeCommit',
    ], cwd)).stdout) as { number: number; state: string; url: string; headRefOid: string; mergeCommit?: { oid?: string } }
    if (reopened.state === 'OPEN' && reopened.headRefOid === headCommit) return reopened
    await run('git', ['push', '--set-upstream', 'origin', `${headCommit}:refs/heads/${branch}`], cwd)
    await run('gh', ['pr', 'reopen', String(existing[0].number), '--repo', REPOSITORY], cwd)
    return JSON.parse((await run('gh', [
      'pr', 'view', String(existing[0].number), '--repo', REPOSITORY, '--json', 'number,state,url,headRefOid,mergeCommit',
    ], cwd)).stdout) as { number: number; state: string; url: string; headRefOid: string; mergeCommit?: { oid?: string } }
  }
  if (existing[0]) {
    if (existing[0].headRefOid !== headCommit) throw new Error(`Automatic improvement PR ${existing[0].number} points at an unexpected commit`)
    return existing[0]
  }
  await run('git', ['push', '--set-upstream', 'origin', `${headCommit}:refs/heads/${branch}`], cwd)
  const url = (await run('gh', [
    'pr', 'create', '--repo', REPOSITORY, '--base', 'master', '--head', branch,
    '--title', title, '--body-file', bodyPath,
  ], cwd)).stdout.trim()
  return JSON.parse((await run('gh', [
    'pr', 'view', url, '--repo', REPOSITORY, '--json', 'number,state,url,headRefOid,mergeCommit',
  ], cwd)).stdout) as { number: number; state: string; url: string; headRefOid: string; mergeCommit?: { oid?: string } }
}

async function mergeImprovementPullRequest(
  cwd: string,
  pullRequest: { number: number; state: string; url: string; mergeCommit?: { oid?: string } },
) {
  if (pullRequest.state === 'MERGED' && pullRequest.mergeCommit?.oid) {
    return { pr: pullRequest.number, mergeCommit: pullRequest.mergeCommit.oid }
  }
  if (pullRequest.state !== 'OPEN') throw new Error(`Automatic improvement PR ${pullRequest.number} is not open or merged`)
  try {
    await waitForPullRequestChecks(pullRequest.url, cwd)
    await run('gh', ['pr', 'merge', pullRequest.url, '--repo', REPOSITORY, '--merge', '--delete-branch'], cwd)
  } catch (error) {
    await run('gh', ['pr', 'close', pullRequest.url, '--repo', REPOSITORY, '--delete-branch'], cwd).catch(() => undefined)
    throw error
  }
  const view = JSON.parse((await run('gh', [
    'pr', 'view', pullRequest.url, '--repo', REPOSITORY, '--json', 'number,state,mergeCommit',
  ], cwd)).stdout) as {
    number: number
    state: string
    mergeCommit?: { oid?: string }
  }
  if (view.state !== 'MERGED' || !view.mergeCommit?.oid) throw new Error(`Automatic improvement PR ${view.number} was not merged`)
  return { pr: view.number, mergeCommit: view.mergeCommit.oid }
}

async function prepareImprovementPullRequest(
  worktree: string,
  branch: string,
  analysis: ImprovementAnalysis,
  version: string,
  jobId: string,
) {
  const bodyPath = resolve(worktree, '..', `${jobId}.pr.md`)
  await writeFile(bodyPath, improvementPullRequestBody(analysis), 'utf8')
  const committed = await commitImprovement(worktree, analysis, version)
  return { ...committed, bodyPath }
}

async function openOrFindImprovementPullRequest(
  options: WorkerOptions,
  job: ImprovementJob,
) {
  if (!job.branch || !job.headCommit || !job.releaseVersion || !job.analysis) throw new Error('Submitted improvement job is missing its pull-request receipt')
  const bodyPath = resolve(options.dataDir, 'worktrees', `${job.id}.pr.md`)
  await writeFile(bodyPath, improvementPullRequestBody(job.analysis), 'utf8')
  return ensureImprovementPullRequest(
    options.repoRoot,
    job.branch,
    job.headCommit,
    `Improve Home MCP light conversations (${job.releaseVersion})`,
    bodyPath,
  )
}

async function publishMergedCommit(options: WorkerOptions, mergeCommit: string, jobId: string) {
  await run('git', ['fetch', 'origin', 'master'], options.repoRoot)
  const publishRoot = resolve(options.dataDir, 'publish', jobId)
  await mkdir(dirname(publishRoot), { recursive: true })
  if (await exists(publishRoot)) await rm(publishRoot, { recursive: true })
  await run('git', ['worktree', 'add', '--detach', publishRoot, mergeCommit], options.repoRoot)
  try {
    await symlink(resolve(options.repoRoot, 'node_modules'), join(publishRoot, 'node_modules'), 'dir')
    try {
      await runAutomaticValidation(publishRoot, `${mergeCommit}^1`)
    } catch (error) {
      const revert = await revertMergedImprovement(options, mergeCommit, jobId)
      throw new MergedCommitRevertedError(`Merged Home MCP validation failed; revert PR #${revert.pr} restored master`, { cause: error })
    }
    return await publishHomeMcp(publishRoot, options.deployRoot)
  } finally {
    await run('git', ['worktree', 'remove', '--force', publishRoot], options.repoRoot).catch(() => undefined)
  }
}

async function revertMergedImprovement(options: WorkerOptions, mergeCommit: string, jobId: string) {
  await run('git', ['fetch', 'origin', 'master'], options.repoRoot)
  const revertRoot = resolve(options.dataDir, 'revert', jobId)
  const branch = `auto/revert-home-mcp-${jobId.slice(0, 12)}`
  await mkdir(dirname(revertRoot), { recursive: true })
  await run('git', ['worktree', 'remove', '--force', revertRoot], options.repoRoot).catch(() => undefined)
  if (await exists(revertRoot)) await rm(revertRoot, { recursive: true })
  await run('git', ['branch', '-D', branch], options.repoRoot).catch(() => undefined)
  await run('git', ['worktree', 'add', '-b', branch, revertRoot, 'origin/master'], options.repoRoot)
  let prUrl: string | null = null
  try {
    await symlink(resolve(options.repoRoot, 'node_modules'), join(revertRoot, 'node_modules'), 'dir')
    await run('git', ['revert', '-m', '1', '--no-commit', mergeCommit], revertRoot)
    await run('git', ['commit', '-m', `Revert failed Home MCP improvement ${jobId.slice(0, 12)}`, '-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'], revertRoot)
    await runAutomaticValidation(revertRoot)
    await run('git', ['push', '--set-upstream', 'origin', branch], revertRoot)
    const title = `Revert failed Home MCP improvement ${jobId.slice(0, 12)}`
    prUrl = (await run('gh', ['pr', 'create', '--repo', REPOSITORY, '--base', 'master', '--head', branch, '--title', title, '--body', 'Automatic rollback after the exact merged Home MCP commit failed its deterministic validation gates.'], revertRoot)).stdout.trim()
    await waitForPullRequestChecks(prUrl, revertRoot)
    await run('gh', ['pr', 'merge', prUrl, '--repo', REPOSITORY, '--merge', '--delete-branch'], revertRoot)
    const view = JSON.parse((await run('gh', ['pr', 'view', prUrl, '--repo', REPOSITORY, '--json', 'number,state'], revertRoot)).stdout) as { number: number; state: string }
    if (view.state !== 'MERGED') throw new Error(`Rollback PR ${view.number} was not merged`)
    return { pr: view.number }
  } catch (error) {
    if (prUrl) await run('gh', ['pr', 'close', prUrl, '--repo', REPOSITORY, '--delete-branch'], revertRoot).catch(() => undefined)
    else await run('git', ['push', 'origin', '--delete', branch], revertRoot).catch(() => undefined)
    throw error
  } finally {
    await run('git', ['worktree', 'remove', '--force', revertRoot], options.repoRoot).catch(() => undefined)
    await run('git', ['branch', '-D', branch], options.repoRoot).catch(() => undefined)
  }
}

async function writeStatus(store: ConversationImprovementStore, state: ImprovementWorkerStatus['state'], jobId: string | null, message: string | null) {
  await store.writeWorkerStatus({ state, jobId, message, updatedAt: new Date().toISOString() })
}

export async function processImprovementJob(
  job: ImprovementJob,
  processingPath: string,
  store: ConversationImprovementStore,
  options: WorkerOptions,
) {
  await writeStatus(store, 'processing', job.id, null)
  const copilotOptions: CopilotImprovementOptions = {
    baseDirectory: resolve(options.dataDir, 'copilot'),
    cliPath: options.cliPath,
    model: options.model,
    reasoningEffort: 'medium',
  }
  let currentJob = job
  if (currentJob.stage === 'published') {
    if (!currentJob.releaseVersion || !currentJob.analysis || !currentJob.mergeCommit) throw new Error('Published improvement job is missing its release receipt')
    await store.completeJob(processingPath, {
      status: 'improved',
      processedAt: new Date().toISOString(),
      inferredIntent: currentJob.analysis.inferredIntent,
      version: currentJob.releaseVersion,
      summary: currentJob.analysis.summary,
      pr: currentJob.pr,
      mergeCommit: currentJob.mergeCommit,
      published: true,
    })
    await writeStatus(store, 'idle', null, null)
    return
  }
  if (currentJob.stage === 'pr-open') {
    const pullRequest = await openOrFindImprovementPullRequest(options, currentJob)
    if (currentJob.pr !== pullRequest.number) {
      currentJob = { ...currentJob, pr: pullRequest.number }
      await store.updateProcessingJob(processingPath, currentJob)
    }
    const merged = await mergeImprovementPullRequest(options.repoRoot, pullRequest)
    currentJob = {
      ...currentJob,
      stage: 'merged',
      pr: merged.pr,
      mergeCommit: merged.mergeCommit,
    }
    await store.updateProcessingJob(processingPath, currentJob)
    await removeWorktree(
      options.repoRoot,
      resolve(options.dataDir, 'worktrees', currentJob.id),
      currentJob.branch!,
    )
  }
  if (currentJob.stage === 'merged') {
    if (!currentJob.mergeCommit || !currentJob.releaseVersion || !currentJob.analysis) throw new Error('Merged improvement job is missing its release receipt')
    const mergedAnalysis = currentJob.analysis
    const releaseVersion = currentJob.releaseVersion
    const mergeCommit = currentJob.mergeCommit
    const published = options.autoPublish
      ? await publishMergedCommit(options, mergeCommit, currentJob.id)
      : null
    if (published) {
      currentJob = { ...currentJob, stage: 'published' }
      await store.updateProcessingJob(processingPath, currentJob)
    }
    await store.completeJob(processingPath, {
      status: 'improved',
      processedAt: new Date().toISOString(),
      inferredIntent: mergedAnalysis.inferredIntent,
      version: releaseVersion,
      summary: mergedAnalysis.summary,
      pr: currentJob.pr,
      mergeCommit,
      published: Boolean(published),
    })
    await writeStatus(store, 'idle', null, null)
    return
  }
  const analysis = currentJob.analysis ?? await analyzeImprovementJob(currentJob, copilotOptions)
  if (!currentJob.analysis) {
    currentJob = { ...currentJob, analysis, stage: 'analyzed' }
    await store.updateProcessingJob(processingPath, currentJob)
  }
  if (analysis.outcome === 'met-needs') {
    await store.completeJob(processingPath, {
      status: 'met-needs',
      processedAt: new Date().toISOString(),
      inferredIntent: analysis.inferredIntent,
    })
    await writeStatus(store, 'idle', null, null)
    return
  }

  const { branch, worktree } = await createWorktree(options, currentJob)
  try {
    assertLearnedRegressionFailsBase(currentJob, analysis)
    const fixturePath = await writeRegressionFixture(worktree, currentJob, analysis)
    const fixtureDigest = await fileDigest(fixturePath)
    await implementImprovement(currentJob, analysis, worktree, copilotOptions)
    await validateCandidate(worktree, fixturePath, fixtureDigest)
    const diff = await candidateDiff(worktree, fixturePath)
    const review = await reviewImprovement(diff, analysis, copilotOptions)
    if (!review.approved) throw new Error(`Copilot review rejected the candidate: ${review.concerns.join('; ')}`)
    const version = await recordImprovementRelease(worktree, analysis.summary)
    await run('git', ['diff', '--check'], worktree)
    await run('npm', ['run', 'home-mcp:check'], worktree, true)
    const submitted = await prepareImprovementPullRequest(worktree, branch, analysis, version, currentJob.id)
    currentJob = {
      ...currentJob,
      stage: 'pr-open',
      conversation: undefined,
      releaseVersion: version,
      branch,
      headCommit: submitted.headCommit,
    }
    await store.updateProcessingJob(processingPath, currentJob)
    const pullRequest = await openOrFindImprovementPullRequest(options, currentJob)
    currentJob = { ...currentJob, pr: pullRequest.number }
    await store.updateProcessingJob(processingPath, currentJob)
    const merged = await mergeImprovementPullRequest(options.repoRoot, pullRequest)
    currentJob = {
      ...currentJob,
      stage: 'merged',
      pr: merged.pr,
      mergeCommit: merged.mergeCommit,
    }
    await store.updateProcessingJob(processingPath, currentJob)
    const published = options.autoPublish
      ? await publishMergedCommit(options, merged.mergeCommit, currentJob.id)
      : null
    if (published) {
      currentJob = { ...currentJob, stage: 'published' }
      await store.updateProcessingJob(processingPath, currentJob)
    }
    await store.completeJob(processingPath, {
      status: 'improved',
      processedAt: new Date().toISOString(),
      inferredIntent: analysis.inferredIntent,
      version,
      summary: analysis.summary,
      pr: merged.pr,
      mergeCommit: merged.mergeCommit,
      published: Boolean(published),
    })
    await writeStatus(store, 'idle', null, null)
  } finally {
    if (currentJob.stage !== 'pr-open') await removeWorktree(options.repoRoot, worktree, branch)
  }
}

export async function runImprovementQueue(options: WorkerOptions) {
  const store = new ConversationImprovementStore({
    root: options.dataDir,
    enabled: true,
    autoPublish: options.autoPublish,
  })
  let hadError = false
  await store.compactTerminalJobs()
  await store.recoverStaleJobs()
  let claim = await store.claimNextJob()
  while (claim?.job) {
    try {
      await processImprovementJob(claim.job, claim.path, store, options)
    } catch (error) {
      hadError = true
      const message = error instanceof MergedCommitRevertedError
        ? 'merged-commit-reverted'
        : 'improvement-worker-failed'
      const latestJob = await store.readProcessingJob(claim.path)
      if (latestJob) {
        if (error instanceof MergedCommitRevertedError) {
          await store.failJob(claim.path, { status: 'failed', processedAt: new Date().toISOString(), stage: 'reverted', message })
        } else if (latestJob.attempts < 2) await store.retryJob(claim.path, latestJob, message)
        else await store.failJob(claim.path, { status: 'failed', processedAt: new Date().toISOString(), stage: latestJob.stage, message })
      }
      await writeStatus(store, 'error', latestJob?.id ?? claim.job.id, message)
    }
    claim = await store.claimNextJob()
  }
  if (!hadError) await writeStatus(store, 'idle', null, null)
}

function workerOptions(): WorkerOptions {
  const dataDir = process.env.HOME_MCP_IMPROVEMENT_DATA_DIR
  const repoRoot = process.env.HOME_MCP_IMPROVEMENT_REPO
  if (!dataDir || !repoRoot) throw new Error('HOME_MCP_IMPROVEMENT_DATA_DIR and HOME_MCP_IMPROVEMENT_REPO are required')
  return {
    autoPublish: process.env.HOME_MCP_AUTO_PUBLISH === 'true',
    cliPath: process.env.COPILOT_CLI_PATH,
    dataDir,
    deployRoot: process.env.HOME_MCP_DEPLOY_ROOT ?? '/home/sfenton/Docker/home-mcp',
    model: process.env.HOME_MCP_IMPROVEMENT_MODEL ?? MODEL_DEFAULT,
    repoRoot,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadRuntimeEnvironment()
  await runImprovementQueue(workerOptions())
}
