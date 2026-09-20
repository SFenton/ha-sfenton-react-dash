import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  artifactManifestHash,
  assertAutomaticDeploymentPaths,
  assertPanelBridgeUnchanged,
  createPublishDirectory,
  deploymentVersionFromWrapper,
  prepareDeploymentArtifact,
  readAndVerifyDeploymentArtifact,
  resolveDeploymentRange,
  verifyPublishedDashboardAssets,
  waitForControllerAuthorization,
} from './deploy-dashboard-ci'

const execFileAsync = promisify(execFile)

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-ci-test-'))
  const dist = join(root, 'dist')
  await mkdir(join(dist, 'assets'), { recursive: true })
  await writeFile(join(dist, 'index.html'), '<script src="./assets/app-1.js"></script>')
  await writeFile(join(dist, 'assets/app-1.js'), 'app')
  await writeFile(join(dist, 'sfenton-react-app-card.js'), 'card')
  await writeFile(join(dist, 'sfenton-react-panel.js'), 'panel')
  return { dist, manifest: join(root, 'manifest.json'), root }
}

describe('dashboard CI deployment', () => {
  it('creates and revalidates a deterministic secret-free artifact manifest', async () => {
    const { dist, manifest, root } = await fixture()
    const previousToken = process.env.VITE_HA_TOKEN
    delete process.env.VITE_HA_TOKEN
    try {
      const prepared = await prepareDeploymentArtifact({
        distDirectory: dist,
        manifestPath: manifest,
        sourceSha: 'a'.repeat(40),
        runId: '123',
        runAttempt: 2,
      })
      expect(prepared.files.map((file) => file.path)).toContain('deployment.json')
      expect(prepared.manifestHash).toBe(
        artifactManifestHash({
          version: prepared.version,
          repository: prepared.repository,
          sourceSha: prepared.sourceSha,
          runId: prepared.runId,
          runAttempt: prepared.runAttempt,
          buildFlags: prepared.buildFlags,
          files: prepared.files,
        }),
      )
      await expect(
        readAndVerifyDeploymentArtifact(dist, manifest),
      ).resolves.toEqual(prepared)
      const deployment = JSON.parse(
        await readFile(join(dist, 'deployment.json'), 'utf8'),
      )
      expect(deployment).toMatchObject({
        sourceSha: 'a'.repeat(40),
        buildFlags: { homeMcpEnabled: false },
      })
    } finally {
      if (previousToken === undefined) delete process.env.VITE_HA_TOKEN
      else process.env.VITE_HA_TOKEN = previousToken
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a client token and non-regular artifact entries', async () => {
    const first = await fixture()
    const previousToken = process.env.VITE_HA_TOKEN
    process.env.VITE_HA_TOKEN = 'secret'
    try {
      await expect(
        prepareDeploymentArtifact({
          distDirectory: first.dist,
          manifestPath: first.manifest,
          sourceSha: 'a'.repeat(40),
          runId: '123',
          runAttempt: 1,
        }),
      ).rejects.toThrow('must not be present')
    } finally {
      if (previousToken === undefined) delete process.env.VITE_HA_TOKEN
      else process.env.VITE_HA_TOKEN = previousToken
      await rm(first.root, { recursive: true, force: true })
    }

    const second = await fixture()
    try {
      await symlink('/tmp', join(second.dist, 'unsafe-link'))
      await expect(
        prepareDeploymentArtifact({
          distDirectory: second.dist,
          manifestPath: second.manifest,
          sourceSha: 'a'.repeat(40),
          runId: '123',
          runAttempt: 1,
        }),
      ).rejects.toThrow('non-regular entry')
    } finally {
      await rm(second.root, { recursive: true, force: true })
    }
  })

  it('blocks cumulative Home Assistant runtime changes', () => {
    expect(() =>
      assertAutomaticDeploymentPaths([
        'src/App.tsx',
        'home-assistant/packages/example.yaml',
        'home-mcp/server.ts',
      ]),
    ).toThrow(
      'home-assistant/packages/example.yaml, home-mcp/server.ts',
    )
    expect(() =>
      assertAutomaticDeploymentPaths(['src/App.tsx', 'docs/deployment.md']),
    ).not.toThrow()
  })

  it('accepts an older queued master commit while master advances', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dashboard-range-test-'))
    const remote = join(root, 'remote.git')
    const checkout = join(root, 'checkout')
    const git = (...args: string[]) =>
      execFileAsync('git', args, { cwd: checkout, encoding: 'utf8' })
    try {
      await execFileAsync('git', ['init', '--bare', remote])
      await execFileAsync('git', ['init', checkout])
      await git('config', 'user.name', 'Dashboard CI Test')
      await git('config', 'user.email', 'dashboard-ci@example.invalid')
      await writeFile(join(checkout, 'base.txt'), 'base')
      await git('add', 'base.txt')
      await git('commit', '-m', 'base')
      await git('branch', '-M', 'master')
      const base = (await git('rev-parse', 'HEAD')).stdout.trim()
      await writeFile(join(checkout, 'queued.txt'), 'queued')
      await git('add', 'queued.txt')
      await git('commit', '-m', 'queued')
      const queued = (await git('rev-parse', 'HEAD')).stdout.trim()
      await writeFile(join(checkout, 'current.txt'), 'current')
      await git('add', 'current.txt')
      await git('commit', '-m', 'current')
      await git('remote', 'add', 'origin', remote)
      await git('push', 'origin', 'master')

      await expect(
        resolveDeploymentRange(base, queued, remote),
      ).resolves.toEqual({
        candidateSha: queued,
        deployedSha: base,
        paths: ['queued.txt'],
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('requires the deployed custom-panel bridge to remain unchanged', () => {
    const current = [{
      path: 'sfenton-react-panel.js',
      size: 5,
      sha256: 'a'.repeat(64),
    }]
    expect(() => assertPanelBridgeUnchanged(current, current)).not.toThrow()
    expect(() =>
      assertPanelBridgeUnchanged(current, [{
        ...current[0],
        sha256: 'b'.repeat(64),
      }]),
    ).toThrow('manual restart-aware release')
  })

  it('retains prior hashed assets while replacing stable build files', async () => {
    const { dist, root } = await fixture()
    const captured = join(root, 'captured')
    const publish = join(root, 'publish')
    await mkdir(join(captured, 'assets'), { recursive: true })
    await writeFile(join(captured, 'assets/app-old.js'), 'old')
    await writeFile(join(captured, 'obsolete.txt'), 'obsolete')
    const candidate = await prepareDeploymentArtifact({
      distDirectory: dist,
      manifestPath: join(root, 'manifest.json'),
      sourceSha: 'a'.repeat(40),
      runId: '123',
      runAttempt: 1,
    })
    try {
      const files = await createPublishDirectory(
        captured,
        dist,
        candidate.files,
        publish,
      )
      expect(files.map((file) => file.path)).toContain('assets/app-old.js')
      expect(files.map((file) => file.path)).not.toContain('obsolete.txt')
      expect(await readFile(join(publish, 'index.html'), 'utf8')).toContain('app-1')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('verifies every published file by exact bytes', async () => {
    const { dist, manifest, root } = await fixture()
    try {
      const prepared = await prepareDeploymentArtifact({
        distDirectory: dist,
        manifestPath: manifest,
        sourceSha: 'a'.repeat(40),
        runId: '123',
        runAttempt: 1,
      })
      const fetchImpl = vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input))
        const path = decodeURIComponent(
          url.pathname.replace('/local/ha-sfenton-react-dash/', ''),
        )
        return new Response(await readFile(join(dist, path)))
      })
      await expect(
        verifyPublishedDashboardAssets({
          fetchImpl,
          haUrl: 'http://ha-api-proxy:8123',
          manifest: prepared,
          root: dist,
        }),
      ).resolves.toHaveLength(prepared.files.length)
      expect(fetchImpl).toHaveBeenCalledTimes(prepared.files.length)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('parses only commit-based wrapper versions', () => {
    expect(
      deploymentVersionFromWrapper(
        `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
      ),
    ).toBe('a'.repeat(40))
    expect(() =>
      deploymentVersionFromWrapper(
        '/local/ha-sfenton-react-dash/index.html?v=dirty-build',
      ),
    ).toThrow('not a commit SHA')
  })

  it('accepts only the controller authorization for the current run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dashboard-auth-test-'))
    const path = join(root, 'authorization.json')
    try {
      await writeFile(path, JSON.stringify({
        mode: 'production',
        runId: '123',
        runAttempt: 2,
        runnerId: 42,
        runnerName: 'runner-42',
      }))
      await expect(
        waitForControllerAuthorization('production', {
          authorizationPath: path,
          runId: '123',
          runAttempt: 2,
          timeoutMs: 20,
        }),
      ).resolves.toMatchObject({ runnerId: 42 })
      await expect(
        waitForControllerAuthorization('smoke', {
          authorizationPath: path,
          runId: '123',
          runAttempt: 2,
          timeoutMs: 20,
        }),
      ).rejects.toThrow('mode mismatch')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
