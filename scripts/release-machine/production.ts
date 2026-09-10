import { createHash, verify as verifySignature } from 'node:crypto'
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type ProductionFile = {
  path: string
  size: number
  sha256: string
}

export type ProductionMetadata = {
  legacyWrapperUrl: string
  legacyCardResourceUrl: string
  panelRegistered: boolean
  restoreState?: {
    legacyDashboardConfig: unknown
    legacyCardResourceId: string
    configurationFiles?: Array<{
      path: string
      existed: boolean
      contentBase64?: string
    }>
  }
}

export type ProductionSnapshot = {
  version: 1
  files: ProductionFile[]
  metadata: ProductionMetadata
  snapshotHash: string
}

export type ProductionDeployment = {
  version: 1
  releaseVersion: string
  files: ProductionFile[]
  metadata: ProductionMetadata
  deploymentHash: string
}

export type ManualProductionAttestation = {
  version: 1
  releaseVersion: string
  bundleManifestHash: string
  hosts: {
    rawApp: true
    legacyWrapper: true
    customPanel: true
  }
  responsiveReview: true
  realPhoneReview: true
  reviewedBy: 'operator'
  reviewedAt: string
  workflowId: string
  authorizationHash: string
}

export interface ProductionAdapter {
  acquireLease?(): Promise<void>
  assertLease?(): Promise<void>
  releaseLease?(): Promise<void>
  reconcileAssets?(): Promise<void>
  captureAssets(destination: string): Promise<void>
  readMetadata(): Promise<ProductionMetadata>
  deployAssets(source: string): Promise<void>
  deployConfiguration?(sourceRoot: string, scopePaths: string[]): Promise<void>
  writeReleaseMetadata(releaseVersion: string): Promise<void>
  restoreAssets(source: string): Promise<void>
  restoreMetadata(metadata: ProductionMetadata): Promise<void>
  currentAssetsDirectory(): Promise<string>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), childPrefix)))
    } else if (entry.isFile()) {
      files.push(childPrefix)
    }
  }
  return files
}

export async function productionManifest(directory: string) {
  const files = []
  for (const path of await listFiles(directory)) {
    const content = await readFile(join(directory, path))
    files.push({
      path,
      size: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    })
  }
  return files
}

function snapshotHash(
  files: ProductionFile[],
  metadata: ProductionMetadata,
) {
  return createHash('sha256')
    .update(JSON.stringify({ files, metadata }))
    .digest('hex')
}

export async function captureProduction(
  adapter: ProductionAdapter,
  backupDirectory: string,
) {
  await rm(backupDirectory, { recursive: true, force: true })
  await mkdir(backupDirectory, { recursive: true })
  const assetsDirectory = join(backupDirectory, 'assets')
  await adapter.captureAssets(assetsDirectory)
  const [files, metadata] = await Promise.all([
    productionManifest(assetsDirectory),
    adapter.readMetadata(),
  ])
  const snapshot: ProductionSnapshot = {
    version: 1,
    files,
    metadata,
    snapshotHash: snapshotHash(files, metadata),
  }
  await writeFile(
    join(backupDirectory, 'snapshot.json'),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  )
  return snapshot
}

export async function deployProduction(
  adapter: ProductionAdapter,
  buildDirectory: string,
  releaseVersion: string,
  scopePaths: string[] = [],
  expectedSnapshot?: ProductionSnapshot,
) {
  if (expectedSnapshot) {
    const [currentFiles, currentMetadata] = await Promise.all([
      adapter.currentAssetsDirectory().then(productionManifest),
      adapter.readMetadata(),
    ])
    assert(
      snapshotHash(currentFiles, currentMetadata) ===
        expectedSnapshot.snapshotHash,
      'Production changed after capture; deployment is unsafe',
    )
  }
  const expectedFiles = await productionManifest(buildDirectory)
  assert(
    expectedFiles.some((file) => file.path === 'index.html'),
    'Production build is missing index.html',
  )
  await adapter.deployAssets(buildDirectory)
  await adapter.deployConfiguration?.(dirname(buildDirectory), scopePaths)
  await adapter.writeReleaseMetadata(releaseVersion)
  const metadata = await adapter.readMetadata()
  const deployment: ProductionDeployment = {
    version: 1,
    releaseVersion,
    files: expectedFiles,
    metadata,
    deploymentHash: snapshotHash(expectedFiles, metadata),
  }
  return deployment
}

export async function verifyProduction(
  adapter: ProductionAdapter,
  deployment: ProductionDeployment,
) {
  const [files, metadata] = await Promise.all([
    adapter.currentAssetsDirectory().then(productionManifest),
    adapter.readMetadata(),
  ])
  assert(metadata.panelRegistered, 'Custom panel is not registered')
  assert(
    snapshotHash(files, metadata) === deployment.deploymentHash,
    'Production state does not match the deployed release',
  )
  assert(
    metadata.legacyWrapperUrl.includes(
      encodeURIComponent(deployment.releaseVersion),
    ),
    'Legacy wrapper does not reference the release version',
  )
  return { files, metadata, verified: true as const }
}

export async function rollbackProduction(
  adapter: ProductionAdapter,
  backupDirectory: string,
  guard?: {
    deployment?: ProductionDeployment
    releaseVersion?: string
    expectedFiles?: ProductionFile[]
  },
) {
  await adapter.reconcileAssets?.()
  const snapshot = JSON.parse(
    await readFile(join(backupDirectory, 'snapshot.json'), 'utf8'),
  ) as ProductionSnapshot
  if (guard?.deployment) {
    const [files, metadata] = await Promise.all([
      adapter.currentAssetsDirectory().then(productionManifest),
      adapter.readMetadata(),
    ])
    assert(
      snapshotHash(files, metadata) === guard.deployment.deploymentHash,
      'Production changed after this release; automatic rollback is unsafe',
    )
  } else if (guard?.releaseVersion) {
    const [files, metadata] = await Promise.all([
      adapter.currentAssetsDirectory().then(productionManifest),
      adapter.readMetadata(),
    ])
    const metadataIsCaptured =
      snapshotHash([], metadata) === snapshotHash([], snapshot.metadata)
    const metadataIsThisRelease =
      metadata.legacyWrapperUrl.includes(
        encodeURIComponent(guard.releaseVersion),
      ) &&
      metadata.legacyCardResourceUrl.includes(
        encodeURIComponent(guard.releaseVersion),
      )
    assert(
      metadataIsCaptured || metadataIsThisRelease,
      'Production metadata changed after this release attempt; automatic rollback is unsafe',
    )
    if (guard.expectedFiles) {
      const captured = new Map(
        snapshot.files.map((file) => [file.path, file.sha256]),
      )
      const attempted = new Map(
        guard.expectedFiles.map((file) => [file.path, file.sha256]),
      )
      assert(
        files.length === snapshot.files.length &&
          files.every((file) => {
            const capturedHash = captured.get(file.path)
            const attemptedHash = attempted.get(file.path)
            return (
              file.sha256 === capturedHash ||
              file.sha256 === attemptedHash
            )
          }),
        'Production assets changed outside this release attempt; automatic rollback is unsafe',
      )
    }
  }
  await adapter.restoreAssets(join(backupDirectory, 'assets'))
  await adapter.restoreMetadata(snapshot.metadata)
  return snapshot
}

export async function verifyProductionRollback(
  adapter: ProductionAdapter,
  snapshot: ProductionSnapshot,
) {
  await adapter.reconcileAssets?.()
  const [files, metadata] = await Promise.all([
    adapter.currentAssetsDirectory().then(productionManifest),
    adapter.readMetadata(),
  ])
  assert(
    snapshotHash(files, metadata) === snapshot.snapshotHash,
    'Production rollback did not restore the captured state',
  )
  return { files, metadata, verified: true as const }
}

export function verifyManualProductionAttestation(
  content: Buffer,
  expectedHash: string,
  deployment: ProductionDeployment,
  bundleManifestHash: string,
  publicKey: Buffer,
  signature: string,
  workflowId: string,
  authorizationHash: string,
) {
  const contentHash = createHash('sha256').update(content).digest('hex')
  assert(contentHash === expectedHash, 'Manual attestation hash mismatch')
  assert(
    verifySignature(
      null,
      content,
      publicKey,
      Buffer.from(signature, 'base64'),
    ),
    'Manual attestation signature is invalid',
  )
  const attestation = JSON.parse(
    content.toString('utf8'),
  ) as ManualProductionAttestation
  assert(attestation.version === 1, 'Manual attestation version is invalid')
  assert(
    attestation.releaseVersion === deployment.releaseVersion,
    'Manual attestation release version does not match',
  )
  assert(
    attestation.bundleManifestHash === bundleManifestHash,
    'Manual attestation bundle hash does not match',
  )
  assert(
    attestation.workflowId === workflowId &&
      attestation.authorizationHash === authorizationHash,
    'Manual attestation authorization binding does not match',
  )
  assert(
    attestation.hosts?.rawApp === true &&
      attestation.hosts.legacyWrapper === true &&
      attestation.hosts.customPanel === true &&
      attestation.responsiveReview === true &&
      attestation.realPhoneReview === true &&
      attestation.reviewedBy === 'operator' &&
      Number.isFinite(Date.parse(attestation.reviewedAt)),
    'Manual production review is incomplete',
  )
  return contentHash
}

export class LocalProductionAdapter implements ProductionAdapter {
  constructor(private readonly root: string) {}

  private assets() {
    return join(this.root, 'assets')
  }

  private metadataPath() {
    return join(this.root, 'metadata.json')
  }

  async captureAssets(destination: string) {
    await cp(this.assets(), destination, { recursive: true })
  }

  async readMetadata() {
    return JSON.parse(
      await readFile(this.metadataPath(), 'utf8'),
    ) as ProductionMetadata
  }

  async deployAssets(source: string) {
    await rm(this.assets(), { recursive: true, force: true })
    await cp(source, this.assets(), { recursive: true })
  }

  async writeReleaseMetadata(releaseVersion: string) {
    const metadata = await this.readMetadata()
    await writeFile(
      this.metadataPath(),
      `${JSON.stringify(
        {
          ...metadata,
          legacyWrapperUrl: `/local/ha-sfenton-react-dash/index.html?v=${encodeURIComponent(releaseVersion)}`,
          legacyCardResourceUrl: `/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=${encodeURIComponent(releaseVersion)}`,
        },
        null,
        2,
      )}\n`,
    )
  }

  async restoreAssets(source: string) {
    await this.deployAssets(source)
  }

  async restoreMetadata(metadata: ProductionMetadata) {
    await writeFile(
      this.metadataPath(),
      `${JSON.stringify(metadata, null, 2)}\n`,
    )
  }

  async currentAssetsDirectory() {
    return this.assets()
  }
}
