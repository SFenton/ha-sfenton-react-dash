import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createHash,
  generateKeyPairSync,
  sign,
} from 'node:crypto'
import {
  LocalProductionAdapter,
  captureProduction,
  deployProduction,
  productionStateHash,
  rollbackProduction,
  verifyProduction,
  verifyManualProductionAttestation,
  verifyProductionRollback,
} from './production'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'release-production-'))
  const host = join(root, 'host')
  const assets = join(host, 'assets')
  const build = join(root, 'build')
  const backup = join(root, 'backup')
  await mkdir(assets, { recursive: true })
  await mkdir(build, { recursive: true })
  await writeFile(join(assets, 'index.html'), '<h1>before</h1>')
  await writeFile(join(assets, 'assets.js'), 'before')
  await writeFile(join(build, 'index.html'), '<h1>after</h1>')
  await writeFile(join(build, 'assets.js'), 'after')
  await writeFile(
    join(host, 'metadata.json'),
    JSON.stringify({
      legacyWrapperUrl:
        '/local/ha-sfenton-react-dash/index.html?v=before',
      legacyCardResourceUrl:
        '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=before',
      panelRegistered: true,
    }),
  )
  return {
    adapter: new LocalProductionAdapter(host),
    assets,
    backup,
    build,
  }
}

describe('transactional production release', () => {
  it('captures, deploys, verifies, restores, and verifies exact prior state', async () => {
    const { adapter, assets, backup, build } = await fixture()
    const snapshot = await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')
    await expect(verifyProduction(adapter, deployment)).resolves.toMatchObject({
      verified: true,
    })
    expect(await readFile(join(assets, 'index.html'), 'utf8')).toContain('after')

    await rollbackProduction(adapter, backup, { deployment })
    await expect(
      verifyProductionRollback(adapter, snapshot),
    ).resolves.toMatchObject({ verified: true })
    expect(await readFile(join(assets, 'index.html'), 'utf8')).toContain('before')
  })

  it('detects incomplete deployment and incomplete rollback', async () => {
    const { adapter, assets, backup, build } = await fixture()
    const snapshot = await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')
    await writeFile(join(assets, 'assets.js'), 'corrupt')
    await expect(verifyProduction(adapter, deployment)).rejects.toThrow(
      'does not match',
    )

    await rollbackProduction(adapter, backup)
    await writeFile(join(assets, 'index.html'), 'rollback-corrupt')
    await expect(
      verifyProductionRollback(adapter, snapshot),
    ).rejects.toThrow('did not restore')
  })

  it('fails closed when the custom panel is absent', async () => {
    const { adapter, backup, build } = await fixture()
    await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')
    await adapter.restoreMetadata({
      ...deployment.metadata,
      panelRegistered: false,
    })
    await expect(verifyProduction(adapter, deployment)).rejects.toThrow(
      'Custom panel',
    )
  })

  it('uses one canonical production-state hash for captures and deployments', async () => {
    const { adapter, backup, build } = await fixture()
    const snapshot = await captureProduction(adapter, backup)
    expect(
      productionStateHash(snapshot.files, snapshot.metadata),
    ).toBe(snapshot.snapshotHash)

    const deployment = await deployProduction(adapter, build, 'abc123')
    expect(
      productionStateHash(deployment.files, deployment.metadata),
    ).toBe(deployment.deploymentHash)
  })

  it('refuses to overwrite production that changed after deployment', async () => {
    const { adapter, assets, backup, build } = await fixture()
    await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')
    await writeFile(join(assets, 'assets.js'), 'newer-release')
    await expect(
      rollbackProduction(adapter, backup, { deployment }),
    ).rejects.toThrow('automatic rollback is unsafe')
  })

  it('rolls back an attempted release that added new hashed assets', async () => {
    const { adapter, assets, backup, build } = await fixture()
    await writeFile(join(build, 'new-hash.js'), 'new asset')
    const snapshot = await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')

    await rollbackProduction(adapter, backup, {
      releaseVersion: 'abc123',
      expectedFiles: deployment.files,
    })

    await expect(
      verifyProductionRollback(adapter, snapshot),
    ).resolves.toMatchObject({ verified: true })
    await expect(readFile(join(assets, 'new-hash.js'), 'utf8'))
      .rejects.toThrow()
  })

  it('refuses deployment when production changed after capture', async () => {
    const { adapter, assets, backup, build } = await fixture()
    const snapshot = await captureProduction(adapter, backup)
    await writeFile(join(assets, 'assets.js'), 'concurrent-release')
    await expect(
      deployProduction(
        adapter,
        build,
        'abc123',
        [],
        snapshot,
      ),
    ).rejects.toThrow('deployment is unsafe')
  })

  it('binds complete human review to the exact release and bundle', async () => {
    const { adapter, backup, build } = await fixture()
    await captureProduction(adapter, backup)
    const deployment = await deployProduction(adapter, build, 'abc123')
    const content = Buffer.from(
      JSON.stringify({
        version: 1,
        releaseVersion: 'abc123',
        bundleManifestHash: 'f'.repeat(64),
        hosts: {
          rawApp: true,
          legacyWrapper: true,
          customPanel: true,
        },
        responsiveReview: true,
        realPhoneReview: true,
        reviewedBy: 'operator',
        reviewedAt: '2026-09-09T21:00:00.000Z',
        workflowId: 'release-workflow',
        authorizationHash: 'a'.repeat(64),
      }),
    )
    const hash = createHash('sha256').update(content).digest('hex')
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const publicKeyPem = Buffer.from(
      publicKey.export({ type: 'spki', format: 'pem' }),
    )
    const signature = sign(null, content, privateKey).toString('base64')
    expect(
      verifyManualProductionAttestation(
        content,
        hash,
        deployment,
        'f'.repeat(64),
        publicKeyPem,
        signature,
        'release-workflow',
        'a'.repeat(64),
      ),
    ).toBe(hash)
    expect(() =>
      verifyManualProductionAttestation(
        content,
        hash,
        deployment,
        'e'.repeat(64),
        publicKeyPem,
        signature,
        'release-workflow',
        'a'.repeat(64),
      ),
    ).toThrow('bundle hash')
    expect(() =>
      verifyManualProductionAttestation(
        content,
        hash,
        deployment,
        'f'.repeat(64),
        publicKeyPem,
        Buffer.from('invalid').toString('base64'),
        'release-workflow',
        'a'.repeat(64),
      ),
    ).toThrow('signature')
  })
})
