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
  productionStateHash,
  rollbackProduction,
  verifyProduction,
  verifyProductionRollback,
  type ProductionAdapter,
  type ProductionFile,
  type ProductionMetadata,
  type ProductionSnapshot,
} from './release-machine/production'
import { HomeAssistantProductionAdapter } from './release-machine/productionHomeAssistant'
import {
  legacyCardResourceUrl,
  legacyDashboardUrl,
} from './lib/dashboardDeployment'

const execFileAsync = promisify(execFile)

export const DASHBOARD_REPOSITORY = 'SFenton/ha-sfenton-react-dash'
export const DASHBOARD_REPOSITORY_URL =
  `https://github.com/${DASHBOARD_REPOSITORY}.git`
export const DASHBOARD_PUBLIC_ROOT = '/local/ha-sfenton-react-dash'
export const PANEL_BRIDGE_PATH = 'sfenton-react-panel.js'
export const DEPLOYMENT_RECORD_PATH = 'deployment.json'
export const CONTROLLER_AUTHORIZATION_PATH =
  '/run/ha-dashboard/authorization.json'
const DEPLOYMENT_RECORD_VERSION = 2 as const

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
  version: 2
  status: 'success' | 'failed' | 'rejected'
  disposition?:
    | 'forward'
    | 'already-current'
    | 'superseded'
    | 'full-rerun-required'
  sourceSha: string
  previousSha?: string
  deployedSha?: string
  runId: string
  runAttempt: number
  manifestHash?: string
  deploymentHash?: string
  deployedAt?: string
  verifiedPaths?: string[]
  panelRegistered?: boolean
  leaseReleased: boolean
  mutationState: 'none' | 'attempted' | 'rolled-back' | 'deployed'
  rollback: 'not-required' | 'verified' | 'failed'
  error?: string
}

export type DeploymentRecordV1 = {
  version: 1
  repository: typeof DASHBOARD_REPOSITORY
  sourceSha: string
  runId: string
  runAttempt: number
  buildFlags: BuildFlags
}

export type DeploymentRecordV2 = {
  version: typeof DEPLOYMENT_RECORD_VERSION
  repository: typeof DASHBOARD_REPOSITORY
  sourceSha: string
  runId: string
  runAttempt: number
  manifestHash: string
  buildFlags: BuildFlags
  deployedAt: string
  hosts: {
    legacyWrapperUrl: string
    legacyCardResourceUrl: string
    panelRegistered: true
  }
  files: Array<{
    path: string
    size: number
    sha256: string
  }>
  deploymentHash: string
}

export type DeploymentLineage = {
  masterSha: string
  deployedSha: string
  candidateSha: string
  candidateIsMasterAncestor: boolean
  deployedIsMasterAncestor: boolean
  deployedIsCandidateAncestor: boolean
  candidateIsDeployedAncestor: boolean
  pathsFromDeployedToCandidate: string[]
}

type DeploymentAuthorization = {
  mode: 'production' | 'smoke'
  runId: string
  runAttempt: number
  runnerId: number
  runnerName: string
  decision: 'allow' | 'reject'
  disposition?: 'full-rerun-required'
  reason?: string
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
  sourceSha: string
  files: readonly ProductionFile[]
  root: string
}

type AutomaticDeploymentAdapter = ProductionAdapter & {
  acquireLease(): Promise<void>
  reconcileAssets(): Promise<void>
  finalizeRelease(): Promise<void>
}

type DeployDashboardOptions = {
  adapter?: AutomaticDeploymentAdapter
  authorizationPath?: string
  fetchImpl?: typeof fetch
  now?: () => Date
  resolveLineage?: (
    deployedVersion: string,
    candidateSha: string,
  ) => Promise<DeploymentLineage>
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

function deploymentRecordV2Hash(
  record: Omit<DeploymentRecordV2, 'deploymentHash'>,
) {
  return sha256(JSON.stringify(record))
}

function canonicalDeploymentRecordFiles(files: readonly ProductionFile[]) {
  return files
    .filter((file) => file.path !== DEPLOYMENT_RECORD_PATH)
    .map((file) => ({ path: file.path, size: file.size, sha256: file.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function expectedDeploymentHosts(sourceSha: string) {
  return {
    legacyWrapperUrl: legacyDashboardUrl(sourceSha),
    legacyCardResourceUrl: legacyCardResourceUrl(sourceSha),
    panelRegistered: true as const,
  }
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

export async function resolveDeploymentLineage(
  deployedVersion: string,
  candidateSha: string,
  repositoryUrl = DASHBOARD_REPOSITORY_URL,
): Promise<DeploymentLineage> {
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
    const deployedSha = await git([
      '-C',
      repository,
      'rev-parse',
      `${deployedVersion}^{commit}`,
    ])
    const isAncestor = async (ancestor: string, descendant: string) => {
      try {
        await git([
          '-C',
          repository,
          'merge-base',
          '--is-ancestor',
          ancestor,
          descendant,
        ])
        return true
      } catch {
        return false
      }
    }
    const output = await git([
      '-C',
      repository,
      'diff',
      '--name-only',
      `${deployedSha}..${candidateSha}`,
    ])
    return {
      masterSha,
      candidateSha,
      deployedSha,
      candidateIsMasterAncestor: await isAncestor(candidateSha, masterSha),
      deployedIsMasterAncestor: await isAncestor(deployedSha, masterSha),
      deployedIsCandidateAncestor: await isAncestor(deployedSha, candidateSha),
      candidateIsDeployedAncestor: await isAncestor(candidateSha, deployedSha),
      pathsFromDeployedToCandidate: output ? output.split('\n').filter(Boolean) : [],
    }
  } finally {
    await rm(repository, { recursive: true, force: true })
  }
}

export function readDeploymentRecordCandidate(content: string) {
  const parsed = JSON.parse(content) as Record<string, unknown>
  if (parsed.version === 1) return parsed as unknown as DeploymentRecordV1
  if (parsed.version === DEPLOYMENT_RECORD_VERSION) {
    return parsed as unknown as DeploymentRecordV2
  }
  throw new Error('Unsupported deployment.json version')
}

async function readDeploymentRecordIfPresent(root: string) {
  try {
    return readDeploymentRecordCandidate(
      await readFile(resolve(root, DEPLOYMENT_RECORD_PATH), 'utf8'),
    )
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export function classifyDeploymentDisposition(lineage: DeploymentLineage) {
  assert(
    lineage.candidateIsMasterAncestor,
    `Candidate ${lineage.candidateSha} is not on current master ${lineage.masterSha}`,
  )
  if (lineage.candidateSha === lineage.deployedSha) {
    return 'already-current' as const
  }
  if (lineage.deployedIsCandidateAncestor) {
    return 'forward' as const
  }
  if (lineage.candidateIsDeployedAncestor && lineage.deployedIsMasterAncestor) {
    return 'superseded' as const
  }
  throw new Error(
    `Candidate ${lineage.candidateSha} diverges from deployed ${lineage.deployedSha}; refusing non-monotonic deployment`,
  )
}

export function planDeploymentAction(
  lineage: DeploymentLineage,
  currentRecord?: DeploymentRecordV1 | DeploymentRecordV2,
) {
  const disposition = classifyDeploymentDisposition(lineage)
  if (!currentRecord || currentRecord.version === 1) {
    if (disposition === 'superseded') {
      throw new Error(
        'Superseded no-op is blocked because production still uses deployment.json v1 or is missing deployment.json; deploy a forward v2 record first',
      )
    }
    return { disposition, requiresForwardDeployment: true }
  }
  return {
    disposition,
    requiresForwardDeployment: disposition === 'forward',
  }
}

export function createDeploymentRecordV2(input: {
  sourceSha: string
  runId: string
  runAttempt: number
  manifestHash: string
  files: readonly ProductionFile[]
  deployedAt: string
}) {
  validateSha(input.sourceSha, 'deployment record sourceSha')
  assert(input.runId.length > 0, 'Deployment record runId is invalid')
  assert(
    Number.isInteger(input.runAttempt) && input.runAttempt > 0,
    'Deployment record runAttempt is invalid',
  )
  assert(
    /^[a-f0-9]{64}$/.test(input.manifestHash),
    'Deployment record manifest hash is invalid',
  )
  assert(
    Number.isFinite(Date.parse(input.deployedAt)),
    'Deployment record deployedAt is invalid',
  )
  const base: Omit<DeploymentRecordV2, 'deploymentHash'> = {
    version: DEPLOYMENT_RECORD_VERSION,
    repository: DASHBOARD_REPOSITORY,
    sourceSha: input.sourceSha,
    runId: input.runId,
    runAttempt: input.runAttempt,
    manifestHash: input.manifestHash,
    buildFlags: { homeMcpEnabled: false },
    deployedAt: input.deployedAt,
    hosts: expectedDeploymentHosts(input.sourceSha),
    files: canonicalDeploymentRecordFiles(input.files),
  }
  const deploymentHash = deploymentRecordV2Hash(base)
  return { ...base, deploymentHash }
}

export function verifyDeploymentRecordV2(
  record: DeploymentRecordV2,
  files: readonly ProductionFile[],
  metadata: ProductionMetadata,
) {
  assert(
    record.version === DEPLOYMENT_RECORD_VERSION,
    'Deployment record version is invalid',
  )
  validateSha(record.sourceSha, 'deployment record sourceSha')
  assert(
    typeof record.runId === 'string' && record.runId.length > 0,
    'Deployment record runId is invalid',
  )
  assert(
    Number.isInteger(record.runAttempt) && record.runAttempt > 0,
    'Deployment record runAttempt is invalid',
  )
  assert(
    typeof record.deployedAt === 'string' &&
      Number.isFinite(Date.parse(record.deployedAt)),
    'Deployment record deployedAt is invalid',
  )
  assert(
    record.repository === DASHBOARD_REPOSITORY,
    'Deployment record repository is invalid',
  )
  assert(
    /^[a-f0-9]{64}$/.test(record.manifestHash),
    'Deployment record manifest hash is invalid',
  )
  assert(
    record.buildFlags?.homeMcpEnabled === false,
    'Deployment record build flags are invalid',
  )
  assert(
    /^[a-f0-9]{64}$/.test(record.deploymentHash),
    'Deployment record hash is invalid',
  )
  const { deploymentHash, ...payload } = record
  assert(
    deploymentHash === deploymentRecordV2Hash(payload),
    'Deployment record hash is invalid',
  )
  const expectedFiles = canonicalDeploymentRecordFiles(files)
  assert(
    JSON.stringify(expectedFiles) === JSON.stringify(record.files),
    'Deployment record files do not match current published bytes',
  )
  const expectedHosts = expectedDeploymentHosts(record.sourceSha)
  assert(
    JSON.stringify(record.hosts) === JSON.stringify(expectedHosts),
    'Deployment record host metadata is invalid',
  )
  assert(
    deploymentVersionFromWrapper(metadata.legacyWrapperUrl) === record.sourceSha,
    'Deployment record source SHA does not match the deployed wrapper version',
  )
  assert(
    metadata.legacyWrapperUrl === expectedHosts.legacyWrapperUrl &&
      metadata.legacyCardResourceUrl === expectedHosts.legacyCardResourceUrl &&
      metadata.panelRegistered === true,
    'Deployment record host metadata does not match current production metadata',
  )
}

export function verifyCurrentDeploymentRecord(
  record: DeploymentRecordV1 | DeploymentRecordV2 | undefined,
  files: readonly ProductionFile[],
  metadata: ProductionMetadata,
) {
  if (record?.version === DEPLOYMENT_RECORD_VERSION) {
    verifyDeploymentRecordV2(record, files, metadata)
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
  sourceSha,
  files,
  root,
}: VerifyHttpOptions) {
  for (const file of files) {
    const response = await fetchImpl(
      publicAssetUrl(haUrl, file.path, sourceSha),
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
  return files.map((file) => file.path)
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
      assert(
        authorization.decision === 'allow' ||
          authorization.decision === 'reject',
        'Controller authorization decision is invalid',
      )
      if (authorization.decision === 'reject') {
        assert(
          authorization.disposition === 'full-rerun-required' &&
            typeof authorization.reason === 'string' &&
            authorization.reason.length > 0,
          'Controller rejection authorization is invalid',
        )
      }
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

export async function admitAuthorizedWorkflow(
  mode: DeploymentAuthorization['mode'],
  options: {
    authorizationPath?: string
    receiptPath: string
    runAttempt: number
    runId: string
    sourceSha: string
    timeoutMs?: number
  },
) {
  validateSha(options.sourceSha, 'workflow sourceSha')
  assert(options.runId.length > 0, 'Workflow run ID is required')
  assert(
    Number.isInteger(options.runAttempt) && options.runAttempt > 0,
    'Workflow run attempt is invalid',
  )
  const authorization = await waitForControllerAuthorization(mode, options)
  if (authorization.decision === 'allow') return authorization
  const receipt: DeploymentReceipt = {
    version: 2,
    status: 'rejected',
    disposition: authorization.disposition ?? 'full-rerun-required',
    sourceSha: options.sourceSha,
    runId: options.runId,
    runAttempt: options.runAttempt,
    leaseReleased: true,
    mutationState: 'none',
    rollback: 'not-required',
    error: authorization.reason ?? 'Deployment admission was rejected',
  }
  await writeReceipt(options.receiptPath, receipt)
  throw new Error(receipt.error)
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
  options: DeployDashboardOptions = {},
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
  const authorization = await waitForControllerAuthorization('production', {
    authorizationPath: options.authorizationPath,
    runId,
    runAttempt,
  })
  assert(
    authorization.decision === 'allow',
    authorization.reason ?? 'Deployment admission was rejected before deploy',
  )

  const working = await mkdtemp(join(tmpdir(), 'dashboard-ci-deploy-'))
  const backup = join(working, 'backup')
  const verification = join(working, 'verification')
  const publish = join(working, 'publish')
  const adapter =
    options.adapter ??
    HomeAssistantProductionAdapter.fromCiEnvironment(
      verification,
      `${runId}-${runAttempt}`,
      manifest.manifestHash,
    )
  let snapshot: ProductionSnapshot | undefined
  let deploymentStarted = false
  let publishFiles: ProductionFile[] = []
  let previousSha: string | undefined
  let deployedSha: string | undefined
  let rollback: DeploymentReceipt['rollback'] = 'not-required'
  let disposition: DeploymentReceipt['disposition']
  let leaseAcquired = false
  let leaseReleased = false
  let mutationState: DeploymentReceipt['mutationState'] = 'none'
  try {
    await adapter.acquireLease()
    leaseAcquired = true
    await adapter.reconcileAssets()
    snapshot = await captureProduction(adapter, backup)
    const currentRecord = await readDeploymentRecordIfPresent(
      join(backup, 'assets'),
    )
    verifyCurrentDeploymentRecord(
      currentRecord,
      snapshot.files,
      snapshot.metadata,
    )
    const lineage = await (
      options.resolveLineage ?? resolveDeploymentLineage
    )(
      deploymentVersionFromWrapper(snapshot.metadata.legacyWrapperUrl),
      manifest.sourceSha,
    )
    previousSha = lineage.deployedSha
    deployedSha = lineage.deployedSha

    const action = planDeploymentAction(lineage, currentRecord)
    disposition = action.disposition

    if (!action.requiresForwardDeployment) {
      assert(
        currentRecord?.version === DEPLOYMENT_RECORD_VERSION,
        'No-op verification requires deployment.json v2',
      )
      const deploymentRecord = currentRecord
      const verified = await verifyProduction(adapter, {
        version: 1,
        releaseVersion: deploymentRecord.sourceSha,
        files: snapshot.files,
        metadata: snapshot.metadata,
        deploymentHash: productionStateHash(snapshot.files, snapshot.metadata),
      })
      const verifiedPaths = await verifyPublishedDashboardAssets({
        fetchImpl: options.fetchImpl,
        haUrl: process.env.HA_DEPLOY_URL!,
        sourceSha: deploymentRecord.sourceSha,
        files: snapshot.files,
        root: join(backup, 'assets'),
      })
      await adapter.finalizeRelease()
      leaseReleased = true
      const receipt: DeploymentReceipt = {
        version: 2,
        status: 'success',
        disposition,
        sourceSha: manifest.sourceSha,
        previousSha,
        deployedSha: deploymentRecord.sourceSha,
        runId,
        runAttempt,
        manifestHash: manifest.manifestHash,
        deploymentHash: deploymentRecord.deploymentHash,
        deployedAt: deploymentRecord.deployedAt,
        verifiedPaths,
        panelRegistered: verified.metadata.panelRegistered,
        leaseReleased,
        mutationState,
        rollback,
      }
      await writeReceipt(receiptPath, receipt)
      return receipt
    }

    assertPanelBridgeUnchanged(snapshot.files, manifest.files)
    assertAutomaticDeploymentPaths(lineage.pathsFromDeployedToCandidate)
    publishFiles = await createPublishDirectory(
      join(backup, 'assets'),
      resolve(artifactRoot),
      manifest.files,
      publish,
    )
    const deployedAt = (options.now?.() ?? new Date()).toISOString()
    const record = createDeploymentRecordV2({
      sourceSha: manifest.sourceSha,
      runId,
      runAttempt,
      manifestHash: manifest.manifestHash,
      files: publishFiles,
      deployedAt,
    })
    await writeFile(
      join(publish, DEPLOYMENT_RECORD_PATH),
      `${JSON.stringify(record, null, 2)}\n`,
    )
    publishFiles = await productionManifest(publish)
    deploymentStarted = true
    mutationState = 'attempted'
    const deployment = await deployProduction(
      adapter,
      publish,
      manifest.sourceSha,
      [],
      snapshot,
    )
    const verified = await verifyProduction(adapter, deployment)
    verifyDeploymentRecordV2(record, verified.files, verified.metadata)
    const reverified = await verifyProduction(adapter, {
      version: 1,
      releaseVersion: record.sourceSha,
      files: publishFiles,
      metadata: verified.metadata,
      deploymentHash: productionStateHash(publishFiles, verified.metadata),
    })
    const verifiedPaths = await verifyPublishedDashboardAssets({
      fetchImpl: options.fetchImpl,
      haUrl: process.env.HA_DEPLOY_URL!,
      sourceSha: manifest.sourceSha,
      files: publishFiles,
      root: publish,
    })
    mutationState = 'deployed'
    await adapter.finalizeRelease()
    leaseReleased = true
    const receipt: DeploymentReceipt = {
      version: 2,
      status: 'success',
      disposition,
      sourceSha: manifest.sourceSha,
      previousSha,
      deployedSha: manifest.sourceSha,
      runId,
      runAttempt,
      manifestHash: manifest.manifestHash,
      deploymentHash: record.deploymentHash,
      deployedAt: record.deployedAt,
      verifiedPaths,
      panelRegistered: reverified.metadata.panelRegistered,
      leaseReleased,
      mutationState,
      rollback,
    }
    await writeReceipt(receiptPath, receipt)
    return receipt
  } catch (error) {
    if (snapshot && deploymentStarted && !leaseReleased) {
      try {
        await rollbackProduction(adapter, backup, {
          releaseVersion: manifest.sourceSha,
          expectedFiles: publishFiles,
        })
        await verifyProductionRollback(adapter, snapshot)
        rollback = 'verified'
        mutationState = 'rolled-back'
        await adapter.finalizeRelease()
        leaseReleased = true
      } catch (rollbackError) {
        rollback = 'failed'
        mutationState = 'attempted'
        await writeReceipt(receiptPath, {
          version: 2,
          status: 'failed',
          sourceSha: manifest.sourceSha,
          previousSha,
          deployedSha,
          runId,
          runAttempt,
          manifestHash: manifest.manifestHash,
          leaseReleased,
          mutationState,
          rollback,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new AggregateError(
          [error, rollbackError],
          'Dashboard deployment failed and rollback was incomplete',
          { cause: rollbackError },
        )
      }
    } else if (leaseAcquired && !leaseReleased) {
      try {
        await adapter.finalizeRelease()
        leaseReleased = true
      } catch (finalizationError) {
        await writeReceipt(receiptPath, {
          version: 2,
          status: 'failed',
          sourceSha: manifest.sourceSha,
          previousSha,
          deployedSha,
          runId,
          runAttempt,
          manifestHash: manifest.manifestHash,
          disposition,
          leaseReleased,
          mutationState,
          rollback,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new AggregateError(
          [error, finalizationError],
          'Dashboard deployment failed during lease finalization',
          { cause: finalizationError },
        )
      }
    }
    await writeReceipt(receiptPath, {
      version: 2,
      status: 'failed',
      sourceSha: manifest.sourceSha,
      previousSha,
      deployedSha,
      runId,
      runAttempt,
      manifestHash: manifest.manifestHash,
      disposition,
      leaseReleased,
      mutationState,
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
  if (command === 'admit') {
    const mode = argument('mode')
    assert(mode === 'production' || mode === 'smoke', 'Authorization mode is invalid')
    await admitAuthorizedWorkflow(mode, {
      receiptPath: argument('receipt') || 'deployment-receipt.json',
      runId: process.env.GITHUB_RUN_ID || '',
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
      sourceSha: process.env.GITHUB_SHA || '',
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
