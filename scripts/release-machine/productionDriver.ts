import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  loadReleaseContext,
  sha256,
  verifyAuthorizedReleaseContext,
} from './contracts'
import {
  captureProduction,
  deployProduction,
  rollbackProduction,
  verifyProduction,
  verifyManualProductionAttestation,
  productionManifest,
  verifyProductionRollback,
  type ProductionDeployment,
  type ProductionFile,
  type ProductionSnapshot,
} from './production'
import { HomeAssistantProductionAdapter } from './productionHomeAssistant'
import { RELEASE_CONFIGURATION_PATHS } from './productionHomeAssistant'
import { executeDriver } from './driver'
import { finalizeProductionRelease } from './productionFinalization'

type ProductionAction =
  | 'capture'
  | 'deploy'
  | 'verify'
  | 'rollback'
  | 'verify-rollback'
  | 'finalize'

type ProductionState = {
  version: 1
  snapshot?: ProductionSnapshot
  deployment?: ProductionDeployment
  deploymentAttempt?: {
    releaseVersion: string
    files: ProductionFile[]
  }
  attestationHash?: string
  rollbackVerified?: boolean
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function productionStatePath(evidenceDirectory: string) {
  return join(evidenceDirectory, 'production-state.json')
}

async function readState(evidenceDirectory: string): Promise<ProductionState> {
  try {
    return JSON.parse(
      await readFile(productionStatePath(evidenceDirectory), 'utf8'),
    ) as ProductionState
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 }
    throw error
  }
}

async function writeState(
  evidenceDirectory: string,
  state: ProductionState,
) {
  await writeFile(
    productionStatePath(evidenceDirectory),
    `${JSON.stringify(state, null, 2)}\n`,
  )
  return state
}

const action = process.argv[2] as ProductionAction | undefined
const contextPath = process.env.DASHBOARD_RELEASE_CONTEXT
assert(action, 'Production driver action is required')
assert(contextPath, 'DASHBOARD_RELEASE_CONTEXT is required')
const context = await loadReleaseContext(contextPath)
await verifyAuthorizedReleaseContext(context)
assert(
  context.variant === 'dashboard-production',
  'Production driver requires dashboard-production context',
)
assert(context.buildWorktree, 'Production driver requires a build worktree')
const supportedConfigurationPaths = new Set(
  RELEASE_CONFIGURATION_PATHS.map((path) => `home-assistant/${path}`),
)
assert(
  context.scopePaths
    .filter((path) => path.startsWith('home-assistant/'))
    .every((path) => supportedConfigurationPaths.has(path)),
  'Release scope contains an unsupported Home Assistant configuration path',
)
assert(
  !context.scopePaths.some((path) => path.startsWith('home-assistant/')),
  'Home Assistant configuration changes require a separately authorized restart driver',
)
const driverState = JSON.parse(
  await readFile(join(context.evidenceDirectory, 'driver-state.json'), 'utf8'),
) as {
  mergedRevision?: string
  buildManifestHash?: string
}
assert(
  driverState.mergedRevision && driverState.buildManifestHash,
  'Merged build evidence is required before production actions',
)
const backupDirectory = join(context.evidenceDirectory, 'production-backup')
const verificationDirectory = join(
  context.evidenceDirectory,
  'production-current',
)
const state = await readState(context.evidenceDirectory)
if (action === 'finalize') {
  await finalizeProductionRelease(
    async () => {
      const adapter = await HomeAssistantProductionAdapter.fromEnvironment(
        verificationDirectory,
        context.scopePaths,
      )
      await adapter.finalizeRelease()
    },
    async () => executeDriver('cleanup', context).then(() => undefined),
  )
} else {
  const adapter = await HomeAssistantProductionAdapter.fromEnvironment(
    verificationDirectory,
    context.scopePaths,
  )
  if (action !== 'capture') await adapter.assertLease()

  if (action === 'capture') {
    await adapter.acquireLease()
    try {
      state.snapshot = await captureProduction(adapter, backupDirectory)
    } catch (error) {
      await adapter.releaseLease()
      throw error
    }
  } else if (action === 'deploy') {
    assert(state.snapshot, 'Production capture is required before deployment')
    const releaseVersion = driverState.mergedRevision.slice(0, 12)
    state.deploymentAttempt = {
      releaseVersion,
      files: await productionManifest(join(context.buildWorktree, 'dist')),
    }
    await writeState(context.evidenceDirectory, state)
    state.deployment = await deployProduction(
      adapter,
      join(context.buildWorktree, 'dist'),
      releaseVersion,
      context.scopePaths,
      state.snapshot,
    )
  } else if (action === 'verify') {
    assert(state.deployment, 'Production deployment evidence is required')
    await verifyProduction(adapter, state.deployment)
    const attestationPath = process.env.DASHBOARD_RELEASE_ATTESTATION
    const attestationHash = process.env.DASHBOARD_RELEASE_ATTESTATION_SHA256
    const attestationPublicKey =
      process.env.DASHBOARD_RELEASE_ATTESTATION_PUBLIC_KEY
    const attestationSignature =
      process.env.DASHBOARD_RELEASE_ATTESTATION_SIGNATURE
    assert(
      attestationPath &&
        attestationHash &&
        attestationPublicKey &&
        attestationSignature,
      'Signed manual attestation path, hash, public key, and signature are required',
    )
    const publicKey = await readFile(attestationPublicKey)
    assert(
      sha256(publicKey) === context.attestationPublicKeySha256,
      'Manual attestation public key does not match the authorized context',
    )
    state.attestationHash = verifyManualProductionAttestation(
      await readFile(attestationPath),
      attestationHash,
      state.deployment,
      driverState.buildManifestHash,
      publicKey,
      attestationSignature,
      process.env.RELEASE_AUTHORIZED_WORKFLOW_ID!,
      process.env.RELEASE_AUTHORIZATION_HASH!,
    )
  } else if (action === 'rollback') {
    assert(state.snapshot, 'Production capture is required for rollback')
    await rollbackProduction(adapter, backupDirectory, {
      deployment: state.deployment,
      releaseVersion: state.deploymentAttempt?.releaseVersion,
      expectedFiles: state.deploymentAttempt?.files,
    })
  } else {
    assert(state.snapshot, 'Production capture is required for rollback verification')
    await verifyProductionRollback(adapter, state.snapshot)
    state.rollbackVerified = true
  }
}

await writeState(context.evidenceDirectory, state)
console.log(JSON.stringify({ status: 'accepted', action }))
