import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import type { BuildIdentity, CollectedTest, ExecutionLedger, LayoutPlan, ManualLedger, RunIdentity } from '../../e2e/layout/types'
import { CONTEXTS, SURFACE_CONTRACTS } from '../../e2e/layout/contracts'
import { assertCurrentPlan, checkContracts } from './plan'
import { assertExactSelection, selectTests, testList, verifyEvidence } from './verify'
import { artifactPath, assertOptions, fingerprintDirectory, git, hash, isEntry, option, readJson, snapshot, stableHash, writeJson } from './shared'

const require = createRequire(import.meta.url)
const playwrightCli = require.resolve('@playwright/test/cli')
const viteCli = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')

export function safeEnvironment(root: string, directory: string): NodeJS.ProcessEnv {
  const scratch = resolve(directory, 'scratch')
  mkdirSync(scratch, { recursive: true })
  return {
    PATH: process.env.PATH, HOME: process.env.HOME,
    LANG: 'en_US.UTF-8', TZ: 'America/Los_Angeles',
    TMPDIR: scratch, TMP: scratch, TEMP: scratch,
    NODE_COMPILE_CACHE: resolve(root, '.cache/node'),
    ...(process.platform === 'linux' ? { XDG_CACHE_HOME: resolve(root, '.cache/xdg') } : {}),
    VITE_HA_URL: 'http://mock-hass.local', VITE_HA_TOKEN: '',
    PLAYWRIGHT_WEBKIT_EXECUTABLE: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH
      ?? (process.platform === 'linux' ? resolve(process.env.XDG_CACHE_HOME ?? resolve(homedir(), '.cache'), 'ms-playwright') : undefined),
  }
}

async function command(root: string, args: string[], env: NodeJS.ProcessEnv, log: string, mirror = false) {
  const output = createWriteStream(log)
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout!.pipe(output, { end: false })
  child.stderr!.pipe(output, { end: false })
  if (mirror) {
    child.stdout!.pipe(process.stdout, { end: false })
    child.stderr!.pipe(process.stderr, { end: false })
  }
  const code = await new Promise<number>((resolveCode, reject) => {
    child.once('error', reject)
    child.once('close', (status, signal) => signal ? reject(new Error(`Command interrupted by ${signal}`)) : resolveCode(status ?? 1))
  })
  await new Promise<void>((done) => output.end(done))
  if (code !== 0) throw new Error(`Command failed (${code}); inspect ${log}`)
}

async function availablePort() {
  const server = createServer()
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveReady)
  })
  const port = (server.address() as { port: number }).port
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
  return port
}

export async function verifyServedBuild(identity: BuildIdentity) {
  const origin = new URL(identity.origin)
  if (!['127.0.0.1', '[::1]'].includes(origin.hostname) || origin.protocol !== 'http:' || origin.username || origin.password
    || origin.origin !== identity.origin || !identity.serverNonce) throw new Error('Build verification requires an owned loopback origin and server nonce')
  for (const [file, digest] of Object.entries(identity.assets)) {
    if (file.startsWith('/') || file.split('/').includes('..') || /[?#\\]/.test(file)) throw new Error('Invalid built asset path')
    const response = await fetch(`${identity.origin}/${file}?layout=${digest.slice(0, 16)}`, {
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok || response.headers.get('x-layout-server') !== identity.serverNonce
      || hash(Buffer.from(await response.arrayBuffer())) !== digest) throw new Error(`Served asset/ownership mismatch: ${file}; reachable is not candidate provenance`)
  }
}

async function preview(root: string, directory: string, dist: string, source: string, env: NodeJS.ProcessEnv, name: string, fixtureDigest: string) {
  const port = await availablePort()
  const origin = `http://127.0.0.1:${port}`
  const serverNonce = randomUUID()
  const output = createWriteStream(resolve(directory, `${name}-server.log`))
  const child = spawn(process.execPath, [
    viteCli, 'preview', '--config', resolve(root, 'e2e/mock-preview.config.ts'), '--configLoader', 'native',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--outDir', dist,
  ], { cwd: root, env: { ...env, LAYOUT_SERVER_NONCE: serverNonce }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout!.pipe(output, { end: false })
  child.stderr!.pipe(output, { end: false })
  child.once('exit', () => output.end())
  const assets = fingerprintDirectory(dist)
  const identity: BuildIdentity = { source, root: dist, assets, digest: stableHash(assets), origin, pid: child.pid!, fixtureDigest, serverNonce }
  let ready = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Owned preview failed; inspect ${name}-server.log`)
    try {
      const response = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(200), redirect: 'error' })
      if (response.ok && hash(Buffer.from(await response.arrayBuffer())) === assets['index.html']) { ready = true; break }
    } catch { /* Wait only for this newly owned strict-port server. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  if (!ready) { child.kill('SIGTERM'); throw new Error('Owned preview did not become ready with matching index content') }
  try { await verifyServedBuild(identity) } catch (error) {
    await stopOwnedProcess(child)
    throw error
  }
  return { child, identity }
}

export async function stopOwnedProcess(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((done) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      done()
    }, 5_000)
    child.once('close', () => { clearTimeout(timeout); done() })
    child.kill('SIGTERM')
  })
}

function extractBaseline(root: string, directory: string, base: string) {
  const destination = resolve(directory, 'baseline-source')
  if (existsSync(destination)) throw new Error('Baseline extraction already exists; use a new run directory')
  mkdirSync(destination)
  const files = git(root, ['ls-tree', '-r', '--name-only', base]).split('\n').filter(isBaselineBuildInput)
  const archive = spawnSync('git', ['archive', '--format=tar', base, '--', ...files], { cwd: root, maxBuffer: 128 * 1024 * 1024 })
  if (archive.status !== 0) throw new Error('Cannot export the immutable baseline build inputs')
  const unpack = spawnSync('tar', ['-xf', '-', '-C', destination], { cwd: root, input: archive.stdout })
  if (unpack.status !== 0) throw new Error('Cannot extract baseline build inputs')
  symlinkSync(resolve(root, 'node_modules'), resolve(destination, 'node_modules'), 'dir')
  // Keep baseline production code immutable while using the same test-only backend transport/data.
  const mocks = artifactPath(root, resolve(destination, 'src/test/mocks'))
  rmSync(mocks, { recursive: true, force: true })
  cpSync(resolve(root, 'src/test/mocks'), mocks, { recursive: true })
  writeJson(resolve(directory, 'baseline-fixture-overlay.json'), {
    productionSource: base,
    scope: 'Only src/test/mocks is overlaid; baseline production code remains from the pinned commit',
    files: fingerprintDirectory(resolve(root, 'src/test/mocks')),
  })
  return destination
}

export function layoutWorkerCount(value = process.env.LAYOUT_WORKERS) {
  if (value === undefined) return 2
  if (!/^[1-9]\d*$/.test(value)) throw new Error('LAYOUT_WORKERS must be a positive integer')
  return Number(value)
}

export function isBaselineBuildInput(file: string) {
  return file.startsWith('src/')
    || file.startsWith('public/')
    || ['index.html', 'vite.config.ts', 'package.json'].includes(file)
    || /^tsconfig(?:\.[a-zA-Z0-9_-]+)*\.json$/.test(file)
}

export function executionWorkerCount(contexts: LayoutPlan['contexts']) {
  return contexts.includes('touch-webkit') ? 1 : 2
}

export interface ExecutionBatch {
  id: 'non-webkit' | 'webkit'
  tests: CollectedTest[]
  workers: number
}

export function executionBatches(selection: CollectedTest[], workerLimit = layoutWorkerCount()): ExecutionBatch[] {
  const webkitProject = CONTEXTS['touch-webkit'].project
  const nonWebkit = selection.filter((test) => test.project !== webkitProject)
  const webkit = selection.filter((test) => test.project === webkitProject)
  const batches: ExecutionBatch[] = []
  if (nonWebkit.length) batches.push({
    id: 'non-webkit',
    tests: nonWebkit,
    workers: Math.min(workerLimit, executionWorkerCount(['touch-chromium', 'fine-chromium'])),
  })
  if (webkit.length) batches.push({
    id: 'webkit',
    tests: webkit,
    workers: executionWorkerCount(['touch-webkit']),
  })

  assertExactSelection(selection, batches.flatMap((batch) => batch.tests))
  return batches
}

export function mergeExecutionLedgers(
  run: Pick<RunIdentity, 'runId' | 'planId' | 'source'>,
  selection: CollectedTest[],
  results: Array<{ batch: ExecutionBatch; ledger: ExecutionLedger }>,
): ExecutionLedger {
  if (!results.length) throw new Error('No execution batch evidence to merge')
  assertExactSelection(selection, results.flatMap(({ ledger }) => ledger.selected))

  for (const { batch, ledger } of results) {
    assertExactSelection(batch.tests, ledger.selected)
    if (ledger.version !== 1 || ledger.runId !== run.runId || ledger.planId !== run.planId
      || ledger.sourceDigest !== run.source.digest) throw new Error(`Execution batch identity mismatch: ${batch.id}`)
    const selectedIds = new Set(batch.tests.map((test) => test.id))
    if (ledger.attempts.some((attempt) => !selectedIds.has(attempt.testId))) {
      throw new Error(`Execution batch contains an unselected attempt: ${batch.id}`)
    }
  }

  const failedStatus = results.map(({ ledger }) => ledger.status).find((status) => status !== 'passed')
  return {
    version: 1,
    runId: run.runId,
    planId: run.planId,
    sourceDigest: run.source.digest,
    selected: selection,
    attempts: results.flatMap(({ ledger }) => ledger.attempts),
    errors: results.flatMap(({ batch, ledger }) => ledger.errors.map((error) => `${batch.id}: ${error}`)),
    status: failedStatus ?? 'passed',
    complete: results.every(({ ledger }) => ledger.complete),
  }
}

async function build(root: string, sourceRoot: string, directory: string, name: string, env: NodeJS.ProcessEnv) {
  const dist = resolve(directory, `${name}-dist`)
  const options = { mode: 'test', configLoader: 'native', cacheDir: resolve(directory, `${name}-cache`), build: { outDir: dist, emptyOutDir: true } }
  await command(sourceRoot, ['--input-type=module', '-e', `import('vite').then(({build})=>build(${JSON.stringify(options)}))`], env, resolve(directory, `${name}-build.log`))
  if (!existsSync(resolve(root, 'node_modules'))) throw new Error('Installed dependencies disappeared')
  return dist
}

export function manualWorklist(plan: LayoutPlan, run: RunIdentity, ledger: ExecutionLedger) {
  const checkpoints = ledger.attempts.flatMap((attempt) => attempt.checkpoints)
  return plan.obligations.filter((obligation) => obligation.review).map((obligation) => ({
    ...obligation,
    question: SURFACE_CONTRACTS[obligation.scenario].question,
    replay: `Run layout:run -- --plan ${resolve(run.artifactRoot, 'plan.json')} --review; use the same isolated fixture, scenario/state and journey before viewing the image.`,
    evidence: checkpoints.find((entry) => entry.id === obligation.id) ?? null,
    access: 'not-yet-verified-by-reviewer',
  }))
}

export function manualReviewMessage(count: number, directory: string) {
  return count
    ? `Manual inspection is still required: ${directory}/manual-worklist.json`
    : 'No manual layout review is required for this classification.'
}

export async function runPlan(root: string, input: string, review = false) {
  const planPath = artifactPath(root, input, true)
  const directory = dirname(planPath)
  const plan = readJson<LayoutPlan>(planPath)
  if (planPath !== resolve(directory, 'plan.json')) throw new Error('The run plan must be named plan.json inside its declared run root')
  checkContracts(root)
  assertCurrentPlan(root, plan)
  if (plan.root !== root || plan.id !== stableHash({ ...plan, id: '' }) || snapshot(root, plan.source.base).digest !== plan.source.digest) throw new Error('Stale or altered plan/source; regenerate before building or replaying')
  if (plan.blockers.length) throw new Error(plan.blockers.join('\n'))
  if (plan.mode === 'non-layout') {
    writeJson(resolve(directory, 'assessment.json'), { accepted: true, scope: 'Non-layout classification only; no UI, test execution, or visual acceptance claimed', sourceDigest: plan.source.digest })
    console.log('Non-layout classification only. Run applicable non-layout checks; no browser evidence claimed.')
    return
  }
  const env = safeEnvironment(root, directory)
  if (review) {
    const run = readJson<RunIdentity>(resolve(directory, 'run.json'))
    if (run.source.digest !== plan.source.digest || stableHash(fingerprintDirectory(run.candidate.root)) !== run.candidate.digest) throw new Error('Review candidate changed')
    const server = await preview(root, directory, run.candidate.root, plan.source.digest, env, 'review', run.candidate.fixtureDigest)
    writeJson(resolve(directory, 'review-server.json'), { ...server.identity, runId: run.runId, fixtureDigest: run.fixtureDigest })
    console.log(`Owned no-proxy review server: ${server.identity.origin}; PID ${server.child.pid}; run ${run.runId}`)
    const close = async () => { await stopOwnedProcess(server.child); process.exit(0) }
    process.once('SIGTERM', () => { void close() })
    process.once('SIGINT', () => { void close() })
    await new Promise<void>((resolveExit) => server.child.once('exit', () => resolveExit()))
    return
  }
  if (existsSync(resolve(directory, 'run.json'))) throw new Error('Run evidence is append-only; choose a new run directory rather than overwriting a run')
  await command(root, [require.resolve('typescript/bin/tsc'), '-b', 'tsconfig.validation.json', '--pretty', 'false'], env, resolve(directory, 'typecheck.log'))
  const unitLog = resolve(directory, 'unit-validation.log')
  await command(root, [resolve(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--allowOnly=false', ...plan.unitGates], env, unitLog)
  const baselineSource = extractBaseline(root, directory, plan.source.base)
  const baselineDist = await build(root, baselineSource, directory, 'baseline', env)
  const candidateDist = await build(root, root, directory, 'candidate', env)
  const backendFixtureDigest = stableHash(fingerprintDirectory(resolve(root, 'src/test/mocks')))
  if (snapshot(root, plan.source.base).digest !== plan.source.digest) throw new Error('Source changed during build')
  const servers: ChildProcess[] = []
  try {
    const baseline = await preview(root, directory, baselineDist, plan.source.base, env, 'baseline', backendFixtureDigest)
    servers.push(baseline.child)
    const candidate = await preview(root, directory, candidateDist, plan.source.digest, env, 'candidate', backendFixtureDigest)
    servers.push(candidate.child)
    const fixtureDigest = stableHash(Object.entries(plan.source.files).filter(([file]) => file.startsWith('src/test/') || file.startsWith('e2e/layout/') || file === 'playwright.config.ts' || file === 'e2e/mock-preview.config.ts'))
    const run: RunIdentity = {
      version: 1, runId: randomUUID(), root, artifactRoot: directory, planId: plan.id, source: plan.source,
      candidate: candidate.identity, baseline: baseline.identity, fixtureDigest, startedAt: new Date().toISOString(),
      unitEvidence: { log: unitLog, digest: hash(readFileSync(unitLog)), gates: plan.unitGates },
      environment: { node: process.version, platform: process.platform, locale: 'en-US', timezone: 'America/Los_Angeles' },
    }
    writeJson(resolve(directory, 'run.json'), run)
    const childEnv = {
      ...env, LAYOUT_RUN_DIR: directory, PLAYWRIGHT_PORT: new URL(candidate.identity.origin).port,
      PLAYWRIGHT_WEBKIT: plan.contexts.includes('touch-webkit') ? '1' : '0',
      RESPONSIVE_BASELINE_URL: baseline.identity.origin, RESPONSIVE_CANDIDATE_URL: candidate.identity.origin,
      RESPONSIVE_PARITY_REQUIRED: plan.legacySpecs.includes('mobile-parity-all-routes.spec.ts') ? '1' : '0',
      RESPONSIVE_ARTIFACT_DIR: resolve(directory, 'legacy-artifacts'),
    }
    await command(root, [playwrightCli, 'test', '--list', '--reporter=./e2e/layout/reporter.ts'], { ...childEnv, LAYOUT_COLLECTION_ONLY: '1' }, resolve(directory, 'collection.log'))
    const registered = readJson<CollectedTest[]>(resolve(directory, 'registered.json'))
    const selection = selectTests(plan, registered)
    run.collectionDigest = stableHash(registered)
    run.selectionDigest = stableHash(selection)
    writeJson(resolve(directory, 'run.json'), run)
    writeJson(resolve(directory, 'selection.json'), selection)
    writeFileSync(resolve(directory, 'selected-tests.txt'), testList(selection))
    const batches = executionBatches(selection)
    writeJson(resolve(directory, 'execution-batches.json'), batches.map((batch) => ({
      id: batch.id,
      tests: batch.tests.length,
      workers: batch.workers,
      testList: `selected-tests-${batch.id}.txt`,
      ledger: `execution-${batch.id}.json`,
      log: `execution-${batch.id}.log`,
      output: `playwright/${batch.id}`,
    })))
    const results: Array<{ batch: ExecutionBatch; ledger: ExecutionLedger }> = []
    const executionErrors: string[] = []
    for (const batch of batches) {
      const selectedTests = resolve(directory, `selected-tests-${batch.id}.txt`)
      const executionLog = resolve(directory, `execution-${batch.id}.log`)
      const currentLedger = resolve(directory, 'execution.json')
      writeFileSync(selectedTests, testList(batch.tests))
      rmSync(currentLedger, { force: true })
      console.log(`Running ${batch.id} layout evidence: ${batch.tests.length} test${batch.tests.length === 1 ? '' : 's'} with ${batch.workers} worker${batch.workers === 1 ? '' : 's'}.`)
      try {
        await command(root, [playwrightCli, 'test', '--test-list', selectedTests, '--forbid-only',
          `--workers=${batch.workers}`, '--retries=0', '--reporter=./e2e/layout/reporter.ts,list', '--output', resolve(directory, 'playwright', batch.id)],
        childEnv, executionLog, true)
      } catch (error) { executionErrors.push(`${batch.id}: ${String(error)}`) }
      if (!existsSync(currentLedger)) throw new Error(`Execution batch produced no ledger: ${batch.id}; inspect ${executionLog}`)
      const ledger = readJson<ExecutionLedger>(currentLedger)
      assertExactSelection(batch.tests, ledger.selected)
      writeJson(resolve(directory, `execution-${batch.id}.json`), ledger)
      results.push({ batch, ledger })
      console.log(`Recorded ${batch.id} layout evidence: ${ledger.attempts.length} attempts, status ${ledger.status}.`)
    }
    const ledger = mergeExecutionLedgers(run, selection, results)
    writeJson(resolve(directory, 'execution.json'), ledger)
    writeFileSync(resolve(directory, 'execution.log'), batches.map((batch) => {
      const log = resolve(directory, `execution-${batch.id}.log`)
      return `===== ${batch.id} (${batch.tests.length} tests, ${batch.workers} worker${batch.workers === 1 ? '' : 's'}) =====\n${readFileSync(log, 'utf8')}`
    }).join('\n'))
    assertExactSelection(selection, ledger.selected)
    const { accepted: automatedPassed, ...automated } = verifyEvidence(
      plan, run, selection, ledger, null, (file) => readFileSync(artifactPath(root, file, true)), false,
    )
    writeJson(resolve(directory, 'automated-assessment.json'), { ...automated, automatedPassed, fullAcceptance: false })
    const worklist = manualWorklist(plan, run, ledger)
    writeJson(resolve(directory, 'manual-worklist.json'), worklist)
    const manual: ManualLedger = { version: 1, runId: run.runId, planId: plan.id, reviewer: '', reviews: [] }
    writeJson(resolve(directory, 'manual.json'), manual)
    await verifyServedBuild(run.candidate)
    if (snapshot(root, plan.source.base).digest !== plan.source.digest) throw new Error('Source changed during execution; evidence is historical, not current')
    if (executionErrors.length) throw new Error(`Execution batches failed:\n${executionErrors.join('\n')}`)
    if (!automatedPassed) throw new Error(`Runtime evidence assessment failed; inspect ${directory}/automated-assessment.json before manual review`)
    console.log(`Selected ${selection.length} tests; recorded ${ledger.attempts.length} attempts (${ledger.attempts.filter((attempt) => attempt.status === 'passed').length} passed, ${ledger.attempts.filter((attempt) => attempt.status === 'skipped').length} skipped). ${manualReviewMessage(worklist.length, directory)}`)
  } finally {
    await Promise.all(servers.map(stopOwnedProcess))
  }
}

if (isEntry(import.meta.url)) {
  const args = process.argv.slice(2)
  void (async () => {
    assertOptions(args, ['--plan'], ['--review'])
    const plan = option(args, '--plan')
    if (!plan) throw new Error('Usage: layout:run -- --plan artifacts/layout/<run-id>/plan.json [--review]')
    await runPlan(process.cwd(), plan, args.includes('--review'))
  })().catch((error: unknown) => { console.error(String(error)); process.exitCode = 1 })
}
