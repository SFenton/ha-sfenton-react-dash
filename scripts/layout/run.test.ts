// @covers scripts/layout/plan.ts
// @covers scripts/layout/review.ts
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { hash, stableHash } from './shared'
import { executionWorkerCount, isBaselineBuildInput, layoutWorkerCount, manualReviewMessage, stopOwnedProcess, verifyServedBuild } from './run'
import type { ChildProcess } from 'node:child_process'

describe('owned build verification', () => {
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
  it('serializes evidence runs that require the WPE WebKit context', () => {
    expect(executionWorkerCount(['touch-chromium', 'fine-chromium', 'touch-webkit'])).toBe(1)
    expect(executionWorkerCount(['touch-chromium', 'fine-chromium'])).toBe(2)
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
