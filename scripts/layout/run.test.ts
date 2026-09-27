// @covers scripts/layout/plan.ts
// @covers scripts/layout/review.ts
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { requireScenarios, SURFACE_CONTRACTS } from '../../e2e/layout/contracts'
import { hash, stableHash } from './shared'
import {
  DEFAULT_EXECUTION_SHARD_SIZE,
  executionBatches,
  executionShards,
  executionWorkerCount,
  isBaselineBuildInput,
  layoutShardSize,
  layoutWorkerCount,
  manualReviewMessage,
  mergeExecutionLedgers,
  playwrightExecutionArgs,
  stopOwnedProcess,
  verifyServedBuild,
} from './run'
import type { ChildProcess } from 'node:child_process'
import type { CollectedTest, ExecutionLedger, RunIdentity } from '../../e2e/layout/types'

describe('owned build verification', () => {
  it('rejects retired chat layout review while retaining direct Quick Links coverage', () => {
    expect(requireScenarios(['quick-links'])).toEqual(['quick-links'])
    expect(() => requireScenarios(['chat'])).toThrow('Unknown layout scenario: chat')
    expect(SURFACE_CONTRACTS['quick-links'].tabs).toBeUndefined()
    expect(readFileSync('scripts/layout/review.ts', 'utf8')).not.toContain('openChatState')
  })

  it('uses two layout workers by default and accepts an explicit positive override', () => {
    expect(layoutWorkerCount(undefined)).toBe(2)
    expect(layoutWorkerCount('1')).toBe(1)
    expect(() => layoutWorkerCount('0')).toThrow(/positive integer/)
    expect(() => layoutWorkerCount('two')).toThrow(/positive integer/)
  })
  it('exports every referenced root TypeScript configuration without including environment files', () => {
    const config = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as { references: { path: string }[] }
    expect(config.references.length).toBeGreaterThan(0)
    for (const reference of config.references) expect(isBaselineBuildInput(reference.path.replace(/^\.\//, ''))).toBe(true)
    expect(isBaselineBuildInput('tsconfig.validation.json')).toBe(true)
    expect(isBaselineBuildInput('.env.development')).toBe(false)
    expect(isBaselineBuildInput('artifacts/tsconfig.validation.json')).toBe(false)
    expect(isBaselineBuildInput('.env')).toBe(false)
    expect(isBaselineBuildInput('scripts/deploy.ts')).toBe(false)
  })
  it('does not hang or signal an already signalled/exited owned child', async () => {
    const kill = vi.fn()
    await stopOwnedProcess({ exitCode: null, signalCode: 'SIGTERM', kill } as unknown as ChildProcess)
    expect(kill).not.toHaveBeenCalled()
  })
  it('keeps WPE WebKit serial without serializing non-WebKit evidence', () => {
    expect(executionWorkerCount(['touch-chromium', 'fine-chromium', 'touch-webkit'])).toBe(1)
    expect(executionWorkerCount(['touch-chromium', 'fine-chromium'])).toBe(2)
    const selection: CollectedTest[] = [
      { id: 'mobile', project: 'mobile', file: 'mobile.spec.ts', titlePath: ['mobile'] },
      { id: 'desktop', project: 'desktop', file: 'desktop.spec.ts', titlePath: ['desktop'] },
      { id: 'webkit', project: 'webkit', file: 'webkit.spec.ts', titlePath: ['webkit'] },
    ]
    expect(executionBatches(selection, 4).map((batch) => ({
      id: batch.id,
      tests: batch.tests.map((test) => test.id),
      workers: batch.workers,
    }))).toEqual([
      { id: 'non-webkit', tests: ['mobile', 'desktop'], workers: 2 },
      { id: 'webkit', tests: ['webkit'], workers: 1 },
    ])
    expect(executionBatches(selection.slice(0, 2), 1)).toMatchObject([
      { id: 'non-webkit', workers: 1 },
    ])
    expect(executionBatches(selection.slice(2), 4)).toMatchObject([
      { id: 'webkit', workers: 1 },
    ])
    expect(() => executionBatches([])).toThrow(/No required tests selected/)
  })
  it('splits each engine selection into deterministic bounded process shards without splitting spec files', () => {
    const tests = (project: string, groupSizes: number[]) => groupSizes.flatMap((count, group) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${project}-${group}-${index}`,
        project,
        file: `${project}-${group}.spec.ts`,
        titlePath: [`${project} ${group} ${index}`],
      })))
    const batches = executionBatches([
      ...tests('mobile', [80, 46, 86, 70, 57, 75, 50, 65, 56, 60, 41]),
      ...tests('webkit', [70, 53, 12]),
    ])
    const nonWebkit = executionShards(batches[0])
    const webkit = executionShards(batches[1])

    expect(DEFAULT_EXECUTION_SHARD_SIZE).toBe(128)
    expect(layoutShardSize(undefined)).toBe(128)
    expect(layoutShardSize('32')).toBe(32)
    expect(() => layoutShardSize('0')).toThrow(/1 to 128/)
    expect(() => layoutShardSize('1.5')).toThrow(/1 to 128/)
    expect(() => layoutShardSize('many')).toThrow(/1 to 128/)
    expect(() => layoutShardSize('129')).toThrow(/1 to 128/)
    expect(nonWebkit.map((shard) => ({ id: shard.id, tests: shard.tests.length, workers: shard.workers }))).toEqual([
      { id: 'non-webkit-1-of-6', tests: 126, workers: 2 },
      { id: 'non-webkit-2-of-6', tests: 86, workers: 2 },
      { id: 'non-webkit-3-of-6', tests: 127, workers: 2 },
      { id: 'non-webkit-4-of-6', tests: 125, workers: 2 },
      { id: 'non-webkit-5-of-6', tests: 121, workers: 2 },
      { id: 'non-webkit-6-of-6', tests: 101, workers: 2 },
    ])
    expect(webkit.map((shard) => ({ id: shard.id, tests: shard.tests.length, workers: shard.workers }))).toEqual([
      { id: 'webkit-1-of-3', tests: 70, workers: 1 },
      { id: 'webkit-2-of-3', tests: 53, workers: 1 },
      { id: 'webkit-3-of-3', tests: 12, workers: 1 },
    ])
    expect(webkit.every((shard) =>
      new Set(shard.tests.map((test) => `${test.project}/${test.file}`)).size === 1)).toBe(true)
    expect(nonWebkit.flatMap((shard) => shard.tests)).toEqual(batches[0].tests)
    expect(webkit.flatMap((shard) => shard.tests)).toEqual(batches[1].tests)
    for (const shardSet of [nonWebkit, webkit]) {
      const shardByFile = new Map<string, string>()
      for (const shard of shardSet) {
        for (const test of shard.tests) {
          const key = `${test.project}/${test.file}`
          expect(shardByFile.get(key) ?? shard.id).toBe(shard.id)
          shardByFile.set(key, shard.id)
        }
      }
    }
    expect(() => executionShards(batches[0], 0)).toThrow(/1 to 128/)
    expect(() => executionShards({ id: 'webkit', tests: [], workers: 1 })).toThrow(/empty/)
    expect(() => executionShards({ id: 'webkit', workers: 1, tests: tests('webkit', [3]) }, 2)).toThrow(/exceeds/)
    const repeated = tests('mobile', [1, 1])
    expect(() => executionShards({
      id: 'non-webkit', workers: 2,
      tests: [repeated[0], repeated[1], { ...repeated[0], id: 'mobile-return' }],
    }, 3)).toThrow(/not contiguous/)
  })
  it('keeps each shard fail-closed without retries or worker drift', () => {
    expect(playwrightExecutionArgs('/tmp/selection.txt', 2, '/tmp/output')).toEqual([
      'test', '--test-list', '/tmp/selection.txt', '--forbid-only',
      '--workers=2', '--retries=0', '--reporter=./e2e/layout/reporter.ts,list', '--output', '/tmp/output',
    ])
    expect(() => playwrightExecutionArgs('/tmp/selection.txt', 0, '/tmp/output')).toThrow(/positive integer/)
  })
  it('merges shard ledgers back into the unchanged engine-level evidence shape', () => {
    const source = { base: 'base', head: 'head', files: {}, digest: 'source' }
    const run = { runId: 'run', planId: 'plan', source } as Pick<RunIdentity, 'runId' | 'planId' | 'source'>
    const selection: CollectedTest[] = Array.from({ length: 5 }, (_, index) => ({
      id: `mobile-${index}`,
      project: 'mobile',
      file: `mobile-${Math.floor(index / 2)}.spec.ts`,
      titlePath: [`mobile ${index}`],
    }))
    const batch = executionBatches(selection)[0]
    const shards = executionShards(batch, 2)
    const results = shards.map((shard) => ({
      batch: shard,
      ledger: {
        version: 1 as const,
        runId: run.runId,
        planId: run.planId,
        sourceDigest: source.digest,
        selected: shard.tests,
        attempts: shard.tests.map((test, workerIndex) => ({
          testId: test.id,
          expectedStatus: 'passed',
          status: 'passed',
          retry: 0,
          workerIndex,
          annotations: [],
          checkpoints: [],
        })),
        errors: [],
        status: 'passed',
        complete: true,
      },
    }))

    const aggregate = mergeExecutionLedgers(run, batch.tests, results)
    expect(aggregate.selected).toEqual(batch.tests)
    expect(aggregate.attempts.map((attempt) => attempt.testId)).toEqual(selection.map((test) => test.id))
    expect(aggregate).toMatchObject({ complete: true, errors: [], status: 'passed' })
  })
  it('merges disjoint batch ledgers without weakening identity or failure evidence', () => {
    const source = { base: 'base', head: 'head', files: {}, digest: 'source' }
    const run = { runId: 'run', planId: 'plan', source } as Pick<RunIdentity, 'runId' | 'planId' | 'source'>
    const selection: CollectedTest[] = [
      { id: 'mobile', project: 'mobile', file: 'mobile.spec.ts', titlePath: ['mobile'] },
      { id: 'webkit', project: 'webkit', file: 'webkit.spec.ts', titlePath: ['webkit'] },
    ]
    const batches = executionBatches(selection)
    const ledger = (test: CollectedTest): ExecutionLedger => ({
      version: 1,
      runId: run.runId,
      planId: run.planId,
      sourceDigest: source.digest,
      selected: [test],
      attempts: [{
        testId: test.id,
        expectedStatus: 'passed',
        status: 'passed',
        retry: 0,
        workerIndex: 0,
        annotations: [],
        checkpoints: [],
      }],
      errors: [],
      status: 'passed',
      complete: true,
    })
    const results = batches.map((batch) => ({ batch, ledger: ledger(batch.tests[0]) }))
    const merged = mergeExecutionLedgers(run, selection, results)
    expect(merged.selected).toEqual(selection)
    expect(merged.attempts.map((attempt) => attempt.testId)).toEqual(['mobile', 'webkit'])
    expect(merged).toMatchObject({ complete: true, errors: [], status: 'passed' })
    expect(() => mergeExecutionLedgers(run, selection, results.slice(0, 1))).toThrow(/missing/)
    expect(() => mergeExecutionLedgers(run, selection, [results[0], ...results])).toThrow(/Duplicate/)

    results[1].ledger.complete = false
    expect(mergeExecutionLedgers(run, selection, results)).toMatchObject({ complete: false, status: 'passed' })
    results[1].ledger.complete = true
    results[1].ledger.attempts[0].testId = 'mobile'
    expect(() => mergeExecutionLedgers(run, selection, results)).toThrow(/unselected attempt/)
    results[1].ledger.attempts[0].testId = 'webkit'
    results[1].ledger.status = 'failed'
    results[1].ledger.errors = ['browser closed']
    expect(mergeExecutionLedgers(run, selection, results)).toMatchObject({
      complete: true,
      errors: ['webkit: browser closed'],
      status: 'failed',
    })
    results[1].ledger.runId = 'foreign-run'
    expect(() => mergeExecutionLedgers(run, selection, results)).toThrow(/identity mismatch/)
  })
  it('does not request manual review when the plan has no review worklist', () => {
    expect(manualReviewMessage(0, '/tmp/layout')).toBe(
      'No manual layout review is required for this classification.',
    )
    expect(manualReviewMessage(1, '/tmp/layout')).toContain(
      '/tmp/layout/manual-worklist.json',
    )
  })
  it('rejects a merely reachable identical build when the owned server nonce is wrong', async () => {
    const body = '<!doctype html><title>Controlled local fixture</title>'
    const server = createServer((_request, response) => {
      response.setHeader('X-Layout-Server', 'owned-server')
      response.end(body)
    })
    await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
    const assets = { 'index.html': hash(body) }
    const identity = {
      source: 'source', root: 'unused', origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      digest: stableHash(assets), assets, fixtureDigest: 'fixture', serverNonce: 'owned-server', pid: process.pid,
    }
    try {
      await expect(verifyServedBuild(identity)).resolves.toBeUndefined()
      await expect(verifyServedBuild({ ...identity, serverNonce: 'unowned-or-stale' })).rejects.toThrow(/ownership mismatch/)
      await expect(verifyServedBuild({ ...identity, origin: 'https://example.invalid' })).rejects.toThrow(/owned loopback/)
    } finally { await new Promise<void>((done) => server.close(() => done())) }
  })
})
