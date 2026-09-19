import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import {
  captureProduction,
  deployProduction,
  productionManifest,
  rollbackProduction,
  verifyProduction,
  verifyProductionRollback,
  type ProductionFile,
  type ProductionSnapshot,
} from './release-machine/production'
import { HomeAssistantProductionAdapter } from './release-machine/productionHomeAssistant'

const execFileAsync = promisify(execFile)

export const DASHBOARD_REPOSITORY = 'SFenton/ha-sfenton-react-dash'
export const DASHBOARD_REPOSITORY_URL =
  `https://github.com/${DASHBOARD_REPOSITORY}.git`
export const DASHBOARD_PUBLIC_ROOT = '/local/ha-sfenton-react-dash'
export const PANEL_BRIDGE_PATH = 'sfenton-react-panel.js'
export const DEPLOYMENT_RECORD_PATH = 'deployment.json'
export const CONTROLLER_AUTHORIZATION_PATH =
  '/run/ha-dashboard/authorization.json'

const BLOCKED_AUTOMATIC_PATH_PREFIXES = [
  'home-assistant/',
  'home-mcp/',
] as const

type BuildFlags = {
  homeMcpEnabled: false
}

export type DeploymentArtifactManifest = {
  version: 1
  repository: typeof DASHBOARD_REPOSITORY
  sourceSha: string
  runId: string
  runAttempt: number
  buildFlags: BuildFlags
  files: ProductionFile[]
  manifestHash: string
}

export type DeploymentReceipt = {
  version: 1
  status: 'success' | 'failed'
  sourceSha: string
  previousSha?: string
  runId: string
  runAttempt: number
  manifestHash: string
  deployedAt?: string
  verifiedPaths?: string[]
  panelRegistered?: boolean
  rollback: 'not-required' | 'verified' | 'failed'
  error?: string
}

type DeploymentAuthorization = {
  mode: 'production' | 'smoke'
  runId: string
  runAttempt: number
  runnerId: number
  runnerName: string
}

type PrepareArtifactOptions = {
  distDirectory: string
  manifestPath: string
  sourceSha: string
  runId: string
  runAttempt: number
}

type VerifyHttpOptions = {
  fetchImpl?: typeof fetch
  haUrl: string
  manifest: DeploymentArtifactManifest
  root: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function manifestPayload(
  manifest: Omit<DeploymentArtifactManifest, 'manifestHash'>,
) {
  return JSON.stringify(manifest)
}

function normalizedPath(path: string) {
  return path.split(sep).join('/')
}

async function assertRegularTree(root: string, directory = root) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await assertRegularTree(root, path)
      continue
    }
    assert(
      entry.isFile(),
      `Deployment artifact contains a non-regular entry: ${normalizedPath(relative(root, path))}`,
    )
    const stats = await lstat(path)
    assert(
      stats.isFile() && !stats.isSymbolicLink(),
      `Deployment artifact contains an unsupported entry: ${normalizedPath(relative(root, path))}`,
    )
  }
}

function validateSha(value: string, name: string) {
  assert(/^[a-f0-9]{40}$/.test(value), `${name} must be a full commit SHA`)
}

export function artifactManifestHash(
  manifest: Omit<DeploymentArtifactManifest, 'manifestHash'>,
) {
  return sha256(manifestPayload(manifest))
}

export async function prepareDeploymentArtifact({
  distDirectory,
  manifestPath,
  sourceSha,
  runId,
  runAttempt,
}: PrepareArtifactOptions): Promise<DeploymentArtifactManifest> {
  validateSha(sourceSha, 'sourceSha')
  assert(runId.length > 0, 'runId is required')
  assert(Number.isInteger(runAttempt) && runAttempt > 0, 'runAttempt is invalid')
  assert(
    !process.env.VITE_HA_TOKEN,
    'VITE_HA_TOKEN must not be present in the hosted build job',
  )

  const resolvedDist = resolve(distDirectory)
  await assertRegularTree(resolvedDist)
  await writeFile(
    join(resolvedDist, DEPLOYMENT_RECORD_PATH),
    `${JSON.stringify({
      version: 1,
      repository: DASHBOARD_REPOSITORY,
      sourceSha,
      runId,
      runAttempt,
      buildFlags: { homeMcpEnabled: false },
    }, null, 2)}\n`,
  )
  const base = {
    version: 1 as const,
    repository: DASHBOARD_REPOSITORY,
    sourceSha,
    runId,
    runAttempt,
    buildFlags: { homeMcpEnabled: false } as const,
    files: await productionManifest(resolvedDist),
  }
  const manifest = {
    ...base,
    manifestHash: artifactManifestHash(base),
  }
  await mkdir(dirname(resolve(manifestPath)), { recursive: true })
  await writeFile(resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function readAndVerifyDeploymentArtifact(
  root: string,
  manifestPath: string,
) {
  const manifest = JSON.parse(
    await readFile(resolve(manifestPath), 'utf8'),
  ) as DeploymentArtifactManifest
  assert(manifest.version === 1, 'Deployment manifest version is invalid')
  assert(
    manifest.repository === DASHBOARD_REPOSITORY,
    'Deployment manifest repository is invalid',
  )
  validateSha(manifest.sourceSha, 'manifest sourceSha')
  const { manifestHash, ...payload } = manifest
  assert(
    manifestHash === artifactManifestHash(payload),
    'Deployment manifest hash is invalid',
  )
  await assertRegularTree(resolve(root))
  const actualFiles = await productionManifest(resolve(root))
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(manifest.files),
    'Deployment artifact files do not match the manifest',
  )
  const deploymentRecord = JSON.parse(
    await readFile(resolve(root, DEPLOYMENT_RECORD_PATH), 'utf8'),
  ) as {
    repository?: unknown
    runAttempt?: unknown
    runId?: unknown
    sourceSha?: unknown
  }
  assert(
    deploymentRecord.repository === manifest.repository &&
      deploymentRecord.sourceSha === manifest.sourceSha &&
      deploymentRecord.runId === manifest.runId &&
      deploymentRecord.runAttempt === manifest.runAttempt,
    'Deployment record does not match the manifest',
  )
  return manifest
}

export function assertAutomaticDeploymentPaths(paths: readonly string[]) {
  const blocked = paths.filter((path) =>
    BLOCKED_AUTOMATIC_PATH_PREFIXES.some((prefix) =>
      normalizedPath(path).startsWith(prefix),
    ),
  )
  assert(
    blocked.length === 0,
    `Automatic deployment is blocked by Home Assistant runtime changes: ${blocked.join(', ')}`,
  )
}

export function deploymentVersionFromWrapper(url: string) {
  const version = new URL(url, 'https://home-assistant.invalid')
    .searchParams.get('v')
  assert(version, 'Legacy wrapper URL has no deployment version')
  assert(/^[a-f0-9]{7,40}$/.test(version), 'Legacy wrapper version is not a commit SHA')
  return version
}

function fileHash(files: readonly ProductionFile[], path: string) {
  const file = files.find((candidate) => candidate.path === path)
  assert(file, `Deployment is missing ${path}`)
  return file.sha256
}

export function assertPanelBridgeUnchanged(
  currentFiles: readonly ProductionFile[],
  candidateFiles: readonly ProductionFile[],
) {
  assert(
    fileHash(currentFiles, PANEL_BRIDGE_PATH) ===
      fileHash(candidateFiles, PANEL_BRIDGE_PATH),
    'Automatic deployment cannot publish a changed custom-panel bridge; use the manual restart-aware release',
  )
}

async function git(
  args: string[],
  options: { cwd?: string } = {},
) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
  })
  return stdout.trim()
}

export async function resolveDeploymentRange(
  deployedVersion: string,
  candidateSha: string,
  repositoryUrl = DASHBOARD_REPOSITORY_URL,
) {
  validateSha(candidateSha, 'candidateSha')
  const repository = await mkdtemp(join(tmpdir(), 'dashboard-deploy-git-'))
  try {
    await git(['init', repository])
    await git(['-C', repository, 'remote', 'add', 'origin', repositoryUrl])
    await git([
      '-C',
      repository,
      'fetch',
      '--quiet',
      '--filter=blob:none',
      'origin',
      'refs/heads/master:refs/remotes/origin/master',
    ])
    const masterSha = await git([
      '-C',
      repository,
      'rev-parse',
      'refs/remotes/origin/master',
    ])
    await git([
      '-C',
      repository,
      'merge-base',
      '--is-ancestor',
      candidateSha,
      masterSha,
    ]).catch(() => {
      throw new Error(
        `Deployment ${candidateSha} is not an ancestor of master ${masterSha}`,
      )
    })
    const deployedSha = await git([
      '-C',
      repository,
      'rev-parse',
      `${deployedVersion}^{commit}`,
    ])
    await git([
      '-C',
      repository,
      'merge-base',
      '--is-ancestor',
      deployedSha,
      candidateSha,
    ]).catch(() => {
      throw new Error(
        `Deployed revision ${deployedSha} is not an ancestor of ${candidateSha}`,
      )
    })
    const output = await git([
      '-C',
      repository,
      'diff',
      '--name-only',
      `${deployedSha}..${candidateSha}`,
    ])
    return {
      candidateSha,
      deployedSha,
      paths: output ? output.split('\n').filter(Boolean) : [],
    }
  } finally {
    await rm(repository, { recursive: true, force: true })
  }
}

export async function createPublishDirectory(
  capturedAssets: string,
  candidateDist: string,
  candidateFiles: readonly ProductionFile[],
  destination: string,
) {
  await rm(destination, { recursive: true, force: true })
  await cp(capturedAssets, destination, { recursive: true })
  const candidatePaths = new Set(candidateFiles.map((file) => file.path))
  for (const current of await productionManifest(destination)) {
    if (!candidatePaths.has(current.path) && !current.path.startsWith('assets/')) {
      await rm(join(destination, current.path), { force: true })
    }
  }
  await cp(candidateDist, destination, { recursive: true, force: true })
  return productionManifest(destination)
}

function publicAssetUrl(haUrl: string, path: string, version: string) {
  const encoded = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const url = new URL(`${DASHBOARD_PUBLIC_ROOT}/${encoded}`, haUrl)
  url.searchParams.set('v', version)
  return url
}

export async function verifyPublishedDashboardAssets({
  fetchImpl = fetch,
  haUrl,
  manifest,
  root,
}: VerifyHttpOptions) {
  for (const file of manifest.files) {
    const response = await fetchImpl(
      publicAssetUrl(haUrl, file.path, manifest.sourceSha),
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      },
    )
    assert(
      response.ok,
      `Published dashboard asset ${file.path} returned HTTP ${response.status}`,
    )
    const actual = Buffer.from(await response.arrayBuffer())
    const expected = await readFile(join(root, file.path))
    assert(
      actual.length === expected.length &&
        sha256(actual) === file.sha256,
      `Published dashboard asset ${file.path} does not match the build`,
    )
  }
  return manifest.files.map((file) => file.path)
}

async function writeReceipt(path: string, receipt: DeploymentReceipt) {
  await mkdir(dirname(resolve(path)), { recursive: true })
  await writeFile(resolve(path), `${JSON.stringify(receipt, null, 2)}\n`)
}

export async function waitForControllerAuthorization(
  mode: DeploymentAuthorization['mode'],
  options: {
    authorizationPath?: string
    runAttempt: number
    runId: string
    timeoutMs?: number
  },
) {
  const authorizationPath =
    options.authorizationPath ?? CONTROLLER_AUTHORIZATION_PATH
  const deadline = Date.now() + (options.timeoutMs ?? 120_000)
  while (Date.now() < deadline) {
    try {
      const authorization = JSON.parse(
        await readFile(authorizationPath, 'utf8'),
      ) as DeploymentAuthorization
      assert(authorization.mode === mode, 'Controller authorization mode mismatch')
      assert(authorization.runId === options.runId, 'Controller authorization run mismatch')
      assert(
        authorization.runAttempt === options.runAttempt,
        'Controller authorization attempt mismatch',
      )
      assert(
        Number.isInteger(authorization.runnerId) &&
          authorization.runnerId > 0 &&
          authorization.runnerName.length > 0,
        'Controller authorization runner binding is invalid',
      )
      return authorization
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('ENOENT') &&
        !('code' in error && error.code === 'ENOENT')
      ) {
        throw error
      }
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }
  throw new Error('Timed out waiting for the host controller authorization')
}

async function canConnect(host: string, port: number) {
  return new Promise<boolean>((resolveConnection) => {
    const socket = net.createConnection({ host, port })
    const finish = (connected: boolean) => {
      socket.destroy()
      resolveConnection(connected)
    }
    socket.setTimeout(1_000, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

export async function runControllerSmoke(receiptPath: string) {
  for (const name of [
    'HA_DEPLOY_TOKEN',
    'HA_DEPLOY_SSH_PRIVATE_KEY',
    'VITE_HA_TOKEN',
  ]) {
    assert(!process.env[name], `${name} must not be available to the smoke job`)
  }
  const [sshReachable, apiReachable] = await Promise.all([
    canConnect('ha-ssh-proxy', 2222),
    canConnect('ha-api-proxy', 8123),
  ])
  assert(!sshReachable && !apiReachable, 'Smoke runner unexpectedly has Home Assistant network access')
  await writeFile(
    resolve(receiptPath),
    `${JSON.stringify({
      version: 1,
      status: 'success',
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      haNetworkReachable: false,
    }, null, 2)}\n`,
  )
}

export async function deployDashboardArtifact(
  artifactRoot: string,
  manifestPath: string,
  receiptPath: string,
) {
  const manifest = await readAndVerifyDeploymentArtifact(
    artifactRoot,
    manifestPath,
  )
  const runId = process.env.GITHUB_RUN_ID || manifest.runId
  const runAttempt = Number(
    process.env.GITHUB_RUN_ATTEMPT || manifest.runAttempt,
  )
  assert(runId === manifest.runId, 'Workflow run does not match the artifact')
  assert(runAttempt === manifest.runAttempt, 'Workflow attempt does not match the artifact')
  await waitForControllerAuthorization('production', { runId, runAttempt })

  const working = await mkdtemp(join(tmpdir(), 'dashboard-ci-deploy-'))
  const backup = join(working, 'backup')
  const verification = join(working, 'verification')
  const publish = join(working, 'publish')
  const adapter = HomeAssistantProductionAdapter.fromCiEnvironment(
    verification,
    `${runId}-${runAttempt}`,
    manifest.manifestHash,
  )
  let snapshot: ProductionSnapshot | undefined
  let deploymentStarted = false
  let publishFiles: ProductionFile[] = []
  let previousSha: string | undefined
  let rollback: DeploymentReceipt['rollback'] = 'not-required'
  try {
    const metadata = await adapter.readMetadata()
    const range = await resolveDeploymentRange(
      deploymentVersionFromWrapper(metadata.legacyWrapperUrl),
      manifest.sourceSha,
    )
    previousSha = range.deployedSha
    assertAutomaticDeploymentPaths(range.paths)

    await adapter.acquireLease()
    await adapter.reconcileAssets()
    snapshot = await captureProduction(adapter, backup)
    assertPanelBridgeUnchanged(snapshot.files, manifest.files)
    publishFiles = await createPublishDirectory(
      join(backup, 'assets'),
      resolve(artifactRoot),
      manifest.files,
      publish,
    )
    deploymentStarted = true
    const deployment = await deployProduction(
      adapter,
      publish,
      manifest.sourceSha,
      [],
      snapshot,
    )
    const verified = await verifyProduction(adapter, deployment)
    const verifiedPaths = await verifyPublishedDashboardAssets({
      haUrl: process.env.HA_DEPLOY_URL!,
      manifest,
      root: resolve(artifactRoot),
    })
    await adapter.finalizeRelease()
    const receipt: DeploymentReceipt = {
      version: 1,
      status: 'success',
      sourceSha: manifest.sourceSha,
      previousSha,
      runId,
      runAttempt,
      manifestHash: manifest.manifestHash,
      deployedAt: new Date().toISOString(),
      verifiedPaths,
      panelRegistered: verified.metadata.panelRegistered,
      rollback,
    }
    await writeReceipt(receiptPath, receipt)
    return receipt
  } catch (error) {
    if (snapshot && deploymentStarted) {
      try {
        await rollbackProduction(adapter, backup, {
          releaseVersion: manifest.sourceSha,
          expectedFiles: publishFiles,
        })
        await verifyProductionRollback(adapter, snapshot)
        rollback = 'verified'
        await adapter.finalizeRelease()
      } catch (rollbackError) {
        rollback = 'failed'
        await writeReceipt(receiptPath, {
          version: 1,
          status: 'failed',
          sourceSha: manifest.sourceSha,
          previousSha,
          runId,
          runAttempt,
          manifestHash: manifest.manifestHash,
          rollback,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new AggregateError(
          [error, rollbackError],
          'Dashboard deployment failed and rollback was incomplete',
          { cause: rollbackError },
        )
      }
    } else {
      await adapter.finalizeRelease().catch(() => undefined)
    }
    await writeReceipt(receiptPath, {
      version: 1,
      status: 'failed',
      sourceSha: manifest.sourceSha,
      previousSha,
      runId,
      runAttempt,
      manifestHash: manifest.manifestHash,
      rollback,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    await rm(working, { recursive: true, force: true })
  }
}

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const command = process.argv[2]
  if (command === 'prepare') {
    await prepareDeploymentArtifact({
      distDirectory: argument('dist') || 'dist',
      manifestPath: argument('manifest') || 'deployment-manifest.json',
      sourceSha: process.env.GITHUB_SHA || '',
      runId: process.env.GITHUB_RUN_ID || '',
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
    })
    return
  }
  if (command === 'wait-authorized') {
    const mode = argument('mode')
    assert(mode === 'production' || mode === 'smoke', 'Authorization mode is invalid')
    await waitForControllerAuthorization(mode, {
      runId: process.env.GITHUB_RUN_ID || '',
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
    })
    return
  }
  if (command === 'smoke') {
    await runControllerSmoke(
      argument('receipt') || 'controller-smoke-receipt.json',
    )
    return
  }
  if (command === 'deploy') {
    await deployDashboardArtifact(
      argument('dist') || 'dist',
      argument('manifest') || 'deployment-manifest.json',
      argument('receipt') || 'deployment-receipt.json',
    )
    return
  }
  throw new Error(`Unknown deploy-dashboard-ci command: ${String(command)}`)
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined
if (entryPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
