import { createServer } from 'node:http'
import { hash, stableHash } from './shared'
import { stopOwnedProcess, verifyServedBuild } from './run'
import type { ChildProcess } from 'node:child_process'

describe('owned build verification', () => {
  it('does not hang or signal an already signalled/exited owned child', async () => {
    const kill = vi.fn()
    await stopOwnedProcess({ exitCode: null, signalCode: 'SIGTERM', kill } as unknown as ChildProcess)
    expect(kill).not.toHaveBeenCalled()
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
