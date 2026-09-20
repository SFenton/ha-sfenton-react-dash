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
  admitAuthorizedWorkflow,
  artifactManifestHash,
  assertAutomaticDeploymentPaths,
  assertPanelBridgeUnchanged,
  classifyDeploymentDisposition,
  createDeploymentRecordV2,
  createPublishDirectory,
  deployDashboardArtifact,
  deploymentVersionFromWrapper,
  planDeploymentAction,
  prepareDeploymentArtifact,
  readAndVerifyDeploymentArtifact,
  resolveDeploymentLineage,
  verifyCurrentDeploymentRecord,
  verifyDeploymentRecordV2,
  verifyPublishedDashboardAssets,
  waitForControllerAuthorization,
} from './deploy-dashboard-ci'
import { LocalProductionAdapter } from './release-machine/production'

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

  it('tracks deployment lineage while master advances', async () => {
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
        resolveDeploymentLineage(base, queued, remote),
      ).resolves.toMatchObject({
        candidateSha: queued,
        deployedSha: base,
        candidateIsMasterAncestor: true,
        deployedIsMasterAncestor: true,
        deployedIsCandidateAncestor: true,
        candidateIsDeployedAncestor: false,
        pathsFromDeployedToCandidate: ['queued.txt'],
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
          sourceSha: prepared.sourceSha,
          files: prepared.files,
          root: dist,
        }),
      ).resolves.toHaveLength(prepared.files.length)
      expect(fetchImpl).toHaveBeenCalledTimes(prepared.files.length)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rolls back the production transaction when published HTTP bytes fail verification', async () => {
    const candidate = await fixture()
    const production = join(candidate.root, 'production')
    const assets = join(production, 'assets')
    const authorizationPath = join(candidate.root, 'authorization.json')
    const receiptPath = join(candidate.root, 'receipt.json')
    const baseSha = 'a'.repeat(40)
    const candidateSha = 'b'.repeat(40)
    await mkdir(join(assets, 'assets'), { recursive: true })
    await writeFile(join(assets, 'index.html'), 'prior dashboard')
    await writeFile(join(assets, 'assets/app-old.js'), 'prior app')
    await writeFile(join(assets, 'sfenton-react-app-card.js'), 'card')
    await writeFile(join(assets, 'sfenton-react-panel.js'), 'panel')
    await writeFile(
      join(assets, 'deployment.json'),
      `${JSON.stringify({
        version: 1,
        repository: 'SFenton/ha-sfenton-react-dash',
        sourceSha: baseSha,
        runId: '100',
        runAttempt: 1,
        buildFlags: { homeMcpEnabled: false },
      })}\n`,
    )
    await writeFile(
      join(production, 'metadata.json'),
      `${JSON.stringify({
        legacyWrapperUrl:
          `/local/ha-sfenton-react-dash/index.html?v=${baseSha}`,
        legacyCardResourceUrl:
          `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${baseSha}`,
        panelRegistered: true,
      })}\n`,
    )
    const manifest = await prepareDeploymentArtifact({
      distDirectory: candidate.dist,
      manifestPath: candidate.manifest,
      sourceSha: candidateSha,
      runId: '123',
      runAttempt: 2,
    })
    await writeFile(authorizationPath, JSON.stringify({
      mode: 'production',
      runId: '123',
      runAttempt: 2,
      runnerId: 42,
      runnerName: 'runner-42',
      decision: 'allow',
    }))
    const local = new LocalProductionAdapter(production)
    let leaseHeld = false
    const adapter = Object.assign(local, {
      async acquireLease() {
        leaseHeld = true
      },
      async reconcileAssets() {},
      async finalizeRelease() {
        leaseHeld = false
      },
    })
    const previousRunId = process.env.GITHUB_RUN_ID
    const previousRunAttempt = process.env.GITHUB_RUN_ATTEMPT
    const previousHaUrl = process.env.HA_DEPLOY_URL
    process.env.GITHUB_RUN_ID = '123'
    process.env.GITHUB_RUN_ATTEMPT = '2'
    process.env.HA_DEPLOY_URL = 'http://ha-api-proxy:8123'
    try {
      await expect(
        deployDashboardArtifact(
          candidate.dist,
          candidate.manifest,
          receiptPath,
          {
            adapter,
            authorizationPath,
            fetchImpl: vi.fn<typeof fetch>(async () =>
              new Response('stale', { status: 503 })),
            now: () => new Date('2026-09-19T21:00:00.000Z'),
            resolveLineage: async () => ({
              masterSha: candidateSha,
              deployedSha: baseSha,
              candidateSha,
              candidateIsMasterAncestor: true,
              deployedIsMasterAncestor: true,
              deployedIsCandidateAncestor: true,
              candidateIsDeployedAncestor: false,
              pathsFromDeployedToCandidate: ['src/App.tsx'],
            }),
          },
        ),
      ).rejects.toThrow('returned HTTP 503')
      expect(await readFile(join(assets, 'index.html'), 'utf8'))
        .toBe('prior dashboard')
      expect(
        JSON.parse(await readFile(join(production, 'metadata.json'), 'utf8')),
      ).toMatchObject({
        legacyWrapperUrl:
          `/local/ha-sfenton-react-dash/index.html?v=${baseSha}`,
      })
      expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toMatchObject({
        status: 'failed',
        sourceSha: manifest.sourceSha,
        disposition: 'forward',
        leaseReleased: true,
        mutationState: 'rolled-back',
        rollback: 'verified',
      })
      expect(leaseHeld).toBe(false)
    } finally {
      if (previousRunId === undefined) delete process.env.GITHUB_RUN_ID
      else process.env.GITHUB_RUN_ID = previousRunId
      if (previousRunAttempt === undefined) delete process.env.GITHUB_RUN_ATTEMPT
      else process.env.GITHUB_RUN_ATTEMPT = previousRunAttempt
      if (previousHaUrl === undefined) delete process.env.HA_DEPLOY_URL
      else process.env.HA_DEPLOY_URL = previousHaUrl
      await rm(candidate.root, { recursive: true, force: true })
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
        decision: 'allow',
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

  it('writes a sanitized rejection receipt during workflow admission', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dashboard-admit-test-'))
    const authorizationPath = join(root, 'authorization.json')
    const receiptPath = join(root, 'receipt.json')
    try {
      await writeFile(authorizationPath, JSON.stringify({
        mode: 'production',
        runId: '123',
        runAttempt: 2,
        runnerId: 42,
        runnerName: 'runner-42',
        decision: 'reject',
        disposition: 'full-rerun-required',
        reason: 'rerun all jobs',
      }))
      await expect(
        admitAuthorizedWorkflow('production', {
          authorizationPath,
          receiptPath,
          runId: '123',
          runAttempt: 2,
          sourceSha: 'a'.repeat(40),
          timeoutMs: 20,
        }),
      ).rejects.toThrow('rerun all jobs')
      expect(
        JSON.parse(await readFile(receiptPath, 'utf8')),
      ).toMatchObject({
        status: 'rejected',
        disposition: 'full-rerun-required',
        sourceSha: 'a'.repeat(40),
        leaseReleased: true,
        mutationState: 'none',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates and verifies a v2 deployment record with canonical host metadata', () => {
    const files = [
      { path: 'index.html', size: 1, sha256: 'a'.repeat(64) },
      { path: 'deployment.json', size: 2, sha256: 'b'.repeat(64) },
    ]
    const record = createDeploymentRecordV2({
      sourceSha: 'a'.repeat(40),
      runId: '123',
      runAttempt: 2,
      manifestHash: 'c'.repeat(64),
      files,
      deployedAt: '2026-09-19T21:00:00.000Z',
    })
    expect(record.hosts).toEqual({
      legacyWrapperUrl:
        `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
      legacyCardResourceUrl:
        `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
      panelRegistered: true,
    })
    expect(() =>
      verifyDeploymentRecordV2(record, files, {
        legacyWrapperUrl:
          `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
        legacyCardResourceUrl:
          `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
        panelRegistered: true,
      }),
    ).not.toThrow()
    expect(() =>
      verifyDeploymentRecordV2(
        { ...record, deploymentHash: 'd'.repeat(64) },
        files,
        {
          legacyWrapperUrl:
            `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
          legacyCardResourceUrl:
            `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
          panelRegistered: true,
        },
      ),
    ).toThrow('Deployment record hash is invalid')
    expect(() =>
      verifyDeploymentRecordV2(
        {
          ...record,
          manifestHash: 'invalid',
          deploymentHash: record.deploymentHash,
        },
        files,
        {
          legacyWrapperUrl:
            `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
          legacyCardResourceUrl:
            `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
          panelRegistered: true,
        },
      ),
    ).toThrow('manifest hash is invalid')
    expect(() =>
      verifyDeploymentRecordV2(
        record,
        files,
        {
          legacyWrapperUrl:
            `/local/ha-sfenton-react-dash/index.html?v=${'b'.repeat(40)}`,
          legacyCardResourceUrl:
            `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
          panelRegistered: true,
        },
      ),
    ).toThrow('source SHA')
    expect(() =>
      verifyDeploymentRecordV2(
        record,
        files,
        {
          legacyWrapperUrl:
            `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
          legacyCardResourceUrl: '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=other',
          panelRegistered: true,
        },
      ),
    ).toThrow('host metadata')
    expect(() =>
      verifyCurrentDeploymentRecord(
        record,
        [
          { path: 'index.html', size: 1, sha256: 'd'.repeat(64) },
          files[1],
        ],
        {
          legacyWrapperUrl:
            `/local/ha-sfenton-react-dash/index.html?v=${'a'.repeat(40)}`,
          legacyCardResourceUrl:
            `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${'a'.repeat(40)}`,
          panelRegistered: true,
        },
      ),
    ).toThrow('do not match current published bytes')
  })

  it('classifies lineage dispositions and migration-only behavior', () => {
    const base = {
      masterSha: 'm'.repeat(40),
      deployedSha: 'd'.repeat(40),
      candidateSha: 'c'.repeat(40),
      candidateIsMasterAncestor: true,
      deployedIsMasterAncestor: true,
      deployedIsCandidateAncestor: false,
      candidateIsDeployedAncestor: false,
      pathsFromDeployedToCandidate: [],
    }
    expect(
      classifyDeploymentDisposition({
        ...base,
        candidateSha: base.deployedSha,
      }),
    ).toBe('already-current')
    expect(
      classifyDeploymentDisposition({
        ...base,
        deployedIsCandidateAncestor: true,
      }),
    ).toBe('forward')
    expect(
      classifyDeploymentDisposition({
        ...base,
        candidateIsDeployedAncestor: true,
      }),
    ).toBe('superseded')
    expect(() =>
      classifyDeploymentDisposition({
        ...base,
        candidateIsMasterAncestor: false,
      }),
    ).toThrow('not on current master')

    expect(
      planDeploymentAction(
        {
          ...base,
          candidateSha: base.deployedSha,
        },
        undefined,
      ),
    ).toEqual({
      disposition: 'already-current',
      requiresForwardDeployment: true,
    })
    expect(
      planDeploymentAction(
        {
          ...base,
          deployedIsCandidateAncestor: true,
          pathsFromDeployedToCandidate: ['src/App.tsx'],
        },
        {
          version: 2,
          repository: 'SFenton/ha-sfenton-react-dash',
          sourceSha: base.deployedSha,
          runId: '1',
          runAttempt: 1,
          manifestHash: 'f'.repeat(64),
          buildFlags: { homeMcpEnabled: false },
          deployedAt: '2026-09-19T21:00:00.000Z',
          hosts: {
            legacyWrapperUrl:
              `/local/ha-sfenton-react-dash/index.html?v=${base.deployedSha}`,
            legacyCardResourceUrl:
              `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${base.deployedSha}`,
            panelRegistered: true,
          },
          files: [],
          deploymentHash: 'e'.repeat(64),
        },
      ),
    ).toEqual({
      disposition: 'forward',
      requiresForwardDeployment: true,
    })
    expect(
      planDeploymentAction(
        {
          ...base,
          candidateSha: base.deployedSha,
        },
        {
          version: 2,
          repository: 'SFenton/ha-sfenton-react-dash',
          sourceSha: base.deployedSha,
          runId: '1',
          runAttempt: 1,
          manifestHash: 'f'.repeat(64),
          buildFlags: { homeMcpEnabled: false },
          deployedAt: '2026-09-19T21:00:00.000Z',
          hosts: {
            legacyWrapperUrl:
              `/local/ha-sfenton-react-dash/index.html?v=${base.deployedSha}`,
            legacyCardResourceUrl:
              `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${base.deployedSha}`,
            panelRegistered: true,
          },
          files: [],
          deploymentHash: 'e'.repeat(64),
        },
      ),
    ).toEqual({
      disposition: 'already-current',
      requiresForwardDeployment: false,
    })
    expect(() =>
      planDeploymentAction(
        {
          ...base,
          candidateIsDeployedAncestor: true,
        },
        undefined,
      ),
    ).toThrow('deploy a forward v2 record first')
  })
})
