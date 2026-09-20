import { access, constants, readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
} from 'home-assistant-js-websocket'
import { Client, type ScpClient } from 'node-scp'
import { LEGACY_REACT_DASHBOARD_HOST } from '../../src/constants/dashboardHosts'
import { loadRuntimeEnvironment } from '../lib/runtimeEnv'
import {
  updateLegacyCardResource,
  validatePanelRegistration,
} from '../lib/dashboardDeployment'
import { syncDashboardDeployment } from '../sync-dashboard-deployment'
import type {
  ProductionAdapter,
  ProductionMetadata,
} from './production'

export type HomeAssistantProductionOptions = {
  haUrl: string
  haToken: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: Buffer
  sshHostKeySha256: string
  remoteFolderName: string
  verificationDirectory: string
  scopePaths: string[]
  workflowId: string
  authorizationHash: string
}

type LegacyDashboardConfig = {
  views?: Array<{
    cards?: Array<{
      url?: unknown
    }>
  }>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function ciProductionOptionsFromEnvironment(
  environment: NodeJS.ProcessEnv,
  verificationDirectory: string,
  workflowId: string,
  authorizationHash: string,
): HomeAssistantProductionOptions {
  const haUrl = environment.HA_DEPLOY_URL
  const haToken = environment.HA_DEPLOY_TOKEN
  const privateKey = environment.HA_DEPLOY_SSH_PRIVATE_KEY
  const sshHostKeySha256 =
    environment.HA_DEPLOY_SSH_HOST_KEY_SHA256
  const remoteFolderName =
    environment.HA_DEPLOY_FOLDER_NAME || RELEASE_REMOTE_FOLDER
  assert(haUrl, 'Missing HA_DEPLOY_URL')
  assert(haToken, 'Missing HA_DEPLOY_TOKEN')
  assert(privateKey, 'Missing HA_DEPLOY_SSH_PRIVATE_KEY')
  assert(
    remoteFolderName === RELEASE_REMOTE_FOLDER,
    `HA_DEPLOY_FOLDER_NAME must be exactly ${RELEASE_REMOTE_FOLDER}`,
  )
  assert(
    typeof sshHostKeySha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(sshHostKeySha256),
    'HA_DEPLOY_SSH_HOST_KEY_SHA256 must be the pinned SHA-256 host-key digest',
  )
  return {
    haUrl,
    haToken,
    host: environment.HA_DEPLOY_SSH_HOST || 'ha-ssh-proxy',
    port: Number(environment.HA_DEPLOY_SSH_PORT || 2222),
    username: environment.HA_DEPLOY_SSH_USERNAME || 'root',
    privateKey: Buffer.from(privateKey),
    sshHostKeySha256,
    remoteFolderName,
    verificationDirectory,
    scopePaths: [],
    workflowId,
    authorizationHash,
  }
}

type DashboardConnection = Pick<Connection, 'sendMessagePromise'>

export async function readHomeAssistantProductionMetadata(
  connection: DashboardConnection,
): Promise<ProductionMetadata> {
  const [legacyDashboardConfig, resources, panels] = await Promise.all([
    connection.sendMessagePromise<LegacyDashboardConfig>({
      type: 'lovelace/config',
      url_path: LEGACY_REACT_DASHBOARD_HOST,
      force: true,
    }),
    connection.sendMessagePromise({
      type: 'lovelace/resources',
    }),
    connection.sendMessagePromise<Record<string, unknown>>({
      type: 'get_panels',
    }),
  ])
  const legacyWrapperUrl =
    legacyDashboardConfig.views?.[0]?.cards?.[0]?.url
  assert(
    typeof legacyWrapperUrl === 'string' && legacyWrapperUrl.length > 0,
    'Legacy dashboard wrapper URL is unavailable',
  )
  const legacyCardResource = updateLegacyCardResource(
    resources,
    'release-capture',
  )
  validatePanelRegistration(panels)
  return {
    legacyWrapperUrl,
    legacyCardResourceUrl: legacyCardResource.previousUrl,
    panelRegistered: true,
    restoreState: {
      legacyDashboardConfig,
      legacyCardResourceId: legacyCardResource.resourceId,
    },
  }
}

export async function restoreHomeAssistantProductionMetadata(
  connection: DashboardConnection,
  metadata: ProductionMetadata,
) {
  assert(metadata.restoreState, 'Production metadata restore state is missing')
  await connection.sendMessagePromise({
    type: 'lovelace/resources/update',
    resource_id: metadata.restoreState.legacyCardResourceId,
    res_type: 'module',
    url: metadata.legacyCardResourceUrl,
  })
  await connection.sendMessagePromise({
    type: 'lovelace/config/save',
    url_path: LEGACY_REACT_DASHBOARD_HOST,
    config: metadata.restoreState.legacyDashboardConfig,
  })
  const restored = await readHomeAssistantProductionMetadata(connection)
  assert(
    restored.legacyWrapperUrl === metadata.legacyWrapperUrl &&
      restored.legacyCardResourceUrl === metadata.legacyCardResourceUrl,
    'Home Assistant dashboard metadata rollback did not restore the capture',
  )
}

export const RELEASE_CONFIGURATION_PATHS = [
  'packages/sfenton_react_panel.yaml',
  'packages/sfenton_react_chat.yaml',
  'custom_components/sfenton_react_chat/__init__.py',
  'custom_components/sfenton_react_chat/manifest.json',
  'custom_components/sfenton_react_chat/services.yaml',
  'custom_components/sfenton_react_chat/retention.py',
  'custom_components/sfenton_react_chat/README.md',
] as const
export const RELEASE_REMOTE_FOLDER = 'ha-sfenton-react-dash'

type ConfigurationScpClient = Pick<
  ScpClient,
  'exists' | 'mkdir' | 'readFile' | 'rmdir' | 'unlink' | 'writeFile'
>
type AssetSwapScpClient = Pick<
  ScpClient,
  'exists' | 'rename' | 'rmdir' | 'unlink'
>

export async function reconcileAssetSwap(
  client: AssetSwapScpClient,
  paths: {
    remote: string
    incoming: string
    previous: string
    completed: string
  },
) {
  const completed = await client.exists(paths.completed)
  let restored = false
  if (!(await client.exists(paths.remote)) && await client.exists(paths.previous)) {
    await client.rename(paths.previous, paths.remote)
    restored = true
  } else if (
    await client.exists(paths.remote) &&
    await client.exists(paths.previous) &&
    !completed
  ) {
    await client.rmdir(paths.remote)
    await client.rename(paths.previous, paths.remote)
    restored = true
  }
  if (await client.exists(paths.incoming)) {
    await client.rmdir(paths.incoming)
  }
  if (restored && completed) await client.unlink(paths.completed)
  return completed && !restored
}

type ProductionLeaseIdentity = {
  workflowId: string
  authorizationHash: string
}

function productionLeasePaths(configRoot: string) {
  const directory =
    `${configRoot}/www/.${RELEASE_REMOTE_FOLDER}.release-lock`
  return { directory, owner: `${directory}/owner.json` }
}

function productionLeaseRecord(
  identity: ProductionLeaseIdentity,
  now: number,
) {
  return {
    version: 1,
    ...identity,
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
  }
}

export async function assertProductionLease(
  client: ConfigurationScpClient,
  configRoot: string,
  identity: ProductionLeaseIdentity,
  now = Date.now(),
) {
  const paths = productionLeasePaths(configRoot)
  assert(await client.exists(paths.owner), 'Production lease is missing')
  const current = JSON.parse(
    (await client.readFile(paths.owner)).toString('utf8'),
  ) as ReturnType<typeof productionLeaseRecord>
  assert(
    current.workflowId === identity.workflowId &&
      current.authorizationHash === identity.authorizationHash &&
      Date.parse(current.expiresAt) > now,
    'Production lease does not match this authorized workflow',
  )
}

export async function acquireProductionLease(
  client: ConfigurationScpClient,
  configRoot: string,
  identity: ProductionLeaseIdentity,
  now = Date.now(),
) {
  const paths = productionLeasePaths(configRoot)
  if (await client.exists(paths.directory)) {
    assert(
      await client.exists(paths.owner),
      'Production lease initialization is incomplete; operator cleanup is required',
    )
    const current = JSON.parse(
      (await client.readFile(paths.owner)).toString('utf8'),
    ) as ReturnType<typeof productionLeaseRecord>
    if (
      current.workflowId === identity.workflowId &&
      current.authorizationHash === identity.authorizationHash &&
      Date.parse(current.expiresAt) > now
    ) {
      return
    }
    assert(
      Date.parse(current.expiresAt) <= now,
      `Production lease is held by workflow ${current.workflowId}`,
    )
    if (await client.exists(paths.owner)) await client.unlink(paths.owner)
    await client.rmdir(paths.directory)
  }
  try {
    await client.mkdir(paths.directory)
  } catch {
    throw new Error('Production lease was acquired by another workflow')
  }
  await client.writeFile(
    paths.owner,
    `${JSON.stringify(productionLeaseRecord(identity, now))}\n`,
  )
  await assertProductionLease(client, configRoot, identity, now)
}

export async function releaseProductionLease(
  client: ConfigurationScpClient,
  configRoot: string,
  identity: ProductionLeaseIdentity,
  now = Date.now(),
) {
  await assertProductionLease(client, configRoot, identity, now)
  const paths = productionLeasePaths(configRoot)
  await client.unlink(paths.owner)
  await client.rmdir(paths.directory)
}

export async function captureReleaseConfiguration(
  client: ConfigurationScpClient,
  configRoot: string,
  selectedPaths: readonly string[] = RELEASE_CONFIGURATION_PATHS,
) {
  const configurationFiles = []
  for (const path of selectedPaths) {
    const remotePath = `${configRoot}/${path}`
    const existed = Boolean(await client.exists(remotePath))
    configurationFiles.push({
      path,
      existed,
      ...(existed
        ? {
            contentBase64: (
              await client.readFile(remotePath)
            ).toString('base64'),
          }
        : {}),
    })
  }
  return configurationFiles
}

export async function stageReleaseConfiguration(
  client: ConfigurationScpClient,
  configRoot: string,
  sourceRoot: string,
  scopePaths: string[],
) {
  const selectedPaths = RELEASE_CONFIGURATION_PATHS.filter((path) =>
    scopePaths.includes(`home-assistant/${path}`),
  )
  for (const path of selectedPaths) {
    const source = resolve(sourceRoot, 'home-assistant', path)
    await access(source, constants.R_OK)
    const remotePath = `${configRoot}/${path}`
    const remoteDirectory = remotePath.slice(0, remotePath.lastIndexOf('/'))
    await client.mkdir(remoteDirectory, undefined, { recursive: true })
    await client.writeFile(remotePath, await readFile(source))
  }
  return selectedPaths.length
}

export async function restoreReleaseConfiguration(
  client: ConfigurationScpClient,
  configRoot: string,
  configurationFiles: NonNullable<
    NonNullable<ProductionMetadata['restoreState']>['configurationFiles']
  >,
) {
  for (const file of configurationFiles) {
    const remotePath = `${configRoot}/${file.path}`
    if (file.existed) {
      assert(file.contentBase64, `Missing captured content for ${file.path}`)
      const remoteDirectory = remotePath.slice(0, remotePath.lastIndexOf('/'))
      await client.mkdir(remoteDirectory, undefined, { recursive: true })
      await client.writeFile(
        remotePath,
        Buffer.from(file.contentBase64, 'base64'),
      )
    } else if (await client.exists(remotePath)) {
      await client.unlink(remotePath)
    }
  }
}

export class HomeAssistantProductionAdapter implements ProductionAdapter {
  constructor(private readonly options: HomeAssistantProductionOptions) {}

  static fromCiEnvironment(
    verificationDirectory: string,
    workflowId: string,
    authorizationHash: string,
  ) {
    return new HomeAssistantProductionAdapter(
      ciProductionOptionsFromEnvironment(
        process.env,
        verificationDirectory,
        workflowId,
        authorizationHash,
      ),
    )
  }

  static async fromEnvironment(
    verificationDirectory: string,
    scopePaths: string[],
  ) {
    loadRuntimeEnvironment()
    const haUrl = process.env.VITE_HA_URL
    const haToken = process.env.VITE_HA_TOKEN
    const remoteFolderName = process.env.VITE_FOLDER_NAME
    const sshHostKeySha256 = process.env.VITE_SSH_HOST_KEY_SHA256
    const password = process.env.VITE_SSH_PASSWORD
    const privateKeyPath = resolve(
      process.env.VITE_SSH_PRIVATE_KEY ||
        join(homedir(), '.ssh/ha-sfenton-react-dash-deploy'),
    )
    assert(haUrl, 'Missing VITE_HA_URL')
    assert(haToken, 'Missing VITE_HA_TOKEN')
    assert(
      remoteFolderName === RELEASE_REMOTE_FOLDER,
      `VITE_FOLDER_NAME must be exactly ${RELEASE_REMOTE_FOLDER}`,
    )
    assert(
      typeof sshHostKeySha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(sshHostKeySha256),
      'VITE_SSH_HOST_KEY_SHA256 must be the pinned SHA-256 host-key digest',
    )
    let privateKey: Buffer | undefined
    if (!password) {
      await access(privateKeyPath, constants.R_OK)
      privateKey = await readFile(privateKeyPath)
    }
    return new HomeAssistantProductionAdapter({
      haUrl,
      haToken,
      host: process.env.VITE_SSH_HOSTNAME || '192.168.1.22',
      port: Number(process.env.VITE_SSH_PORT || 22),
      username: process.env.VITE_SSH_USERNAME || 'root',
      password,
      privateKey,
      sshHostKeySha256,
      remoteFolderName,
      verificationDirectory,
      scopePaths,
      workflowId: process.env.RELEASE_AUTHORIZED_WORKFLOW_ID!,
      authorizationHash: process.env.RELEASE_AUTHORIZATION_HASH!,
    })
  }

  private async scp() {
    return Client({
      host: this.options.host,
      port: this.options.port,
      username: this.options.username,
      password: this.options.password,
      privateKey: this.options.privateKey,
      hostHash: 'sha256',
      hostVerifier: (hash) => hash === this.options.sshHostKeySha256,
    })
  }

  private async connection() {
    return createConnection({
      auth: createLongLivedTokenAuth(
        this.options.haUrl,
        this.options.haToken,
      ),
    })
  }

  private async configRoot(client: ScpClient) {
    for (const directory of ['/config', '/homeassistant']) {
      if (await client.exists(directory)) return directory
    }
    throw new Error(
      'Could not find a config/homeassistant directory in Home Assistant',
    )
  }

  private async remoteAssets(client: ScpClient) {
    return `${await this.configRoot(client)}/www/${this.options.remoteFolderName}`
  }

  private async assetTransactionPaths(client: ScpClient) {
    const remote = await this.remoteAssets(client)
    const transaction = createHash('sha256')
      .update(this.options.workflowId)
      .digest('hex')
      .slice(0, 16)
    return {
      remote,
      incoming: `${remote}.release-incoming-${transaction}`,
      previous: `${remote}.release-previous-${transaction}`,
      completed: `${remote}.release-completed-${transaction}.json`,
    }
  }

  private leaseIdentity() {
    return {
      workflowId: this.options.workflowId,
      authorizationHash: this.options.authorizationHash,
    }
  }

  private async assertLeaseWithClient(client: ScpClient) {
    await assertProductionLease(
      client,
      await this.configRoot(client),
      this.leaseIdentity(),
    )
  }

  async reconcileAssets() {
    const client = await this.scp()
    try {
      await this.assertLeaseWithClient(client)
      await reconcileAssetSwap(
        client,
        await this.assetTransactionPaths(client),
      )
    } finally {
      client.close()
    }
  }

  async acquireLease() {
    const client = await this.scp()
    try {
      await acquireProductionLease(
        client,
        await this.configRoot(client),
        this.leaseIdentity(),
      )
    } finally {
      client.close()
    }
  }

  async assertLease() {
    const client = await this.scp()
    try {
      await this.assertLeaseWithClient(client)
    } finally {
      client.close()
    }
  }

  async releaseLease() {
    const client = await this.scp()
    try {
      await releaseProductionLease(
        client,
        await this.configRoot(client),
        this.leaseIdentity(),
      )
    } finally {
      client.close()
    }
  }

  async captureAssets(destination: string) {
    const client = await this.scp()
    try {
      await client.downloadDir(await this.remoteAssets(client), destination)
    } finally {
      client.close()
    }
  }

  async readMetadata() {
    const connection = await this.connection()
    let client: ScpClient | undefined
    try {
      client = await this.scp()
      const metadata = await readHomeAssistantProductionMetadata(connection)
      const configRoot = await this.configRoot(client)
      const configurationFiles = await captureReleaseConfiguration(
        client,
        configRoot,
        RELEASE_CONFIGURATION_PATHS.filter((path) =>
          this.options.scopePaths.includes(`home-assistant/${path}`),
        ),
      )
      return {
        ...metadata,
        restoreState: {
          ...metadata.restoreState!,
          configurationFiles,
        },
      }
    } finally {
      connection.close()
      client?.close()
    }
  }

  async deployAssets(source: string) {
    const client = await this.scp()
    try {
      await this.assertLeaseWithClient(client)
      const paths = await this.assetTransactionPaths(client)
      const { remote, incoming, previous, completed } = paths
      if (await reconcileAssetSwap(client, paths)) return
      await client.uploadDir(source, incoming)
      const hadPrevious = Boolean(await client.exists(remote))
      if (hadPrevious) await client.rename(remote, previous)
      try {
        await client.rename(incoming, remote)
      } catch (error) {
        if (hadPrevious && await client.exists(previous)) {
          await client.rename(previous, remote)
        }
        throw error
      }
      await client.writeFile(
        completed,
        `${JSON.stringify(this.leaseIdentity())}\n`,
      )
    } finally {
      client.close()
    }
  }

  async finalizeRelease() {
    const client = await this.scp()
    try {
      const lease = productionLeasePaths(await this.configRoot(client))
      if (!(await client.exists(lease.directory))) return
      await this.assertLeaseWithClient(client)
      const paths = await this.assetTransactionPaths(client)
      await reconcileAssetSwap(client, paths)
      const { remote, incoming, previous, completed } = paths
      assert(
        await client.exists(remote),
        'Production assets are missing during finalization',
      )
      if (await client.exists(incoming)) await client.rmdir(incoming)
      if (await client.exists(previous)) await client.rmdir(previous)
      if (await client.exists(completed)) await client.unlink(completed)
      await releaseProductionLease(
        client,
        await this.configRoot(client),
        this.leaseIdentity(),
      )
    } finally {
      client.close()
    }
  }

  async deployConfiguration(sourceRoot: string, scopePaths: string[]) {
    const client = await this.scp()
    try {
      await this.assertLeaseWithClient(client)
      const configRoot = await this.configRoot(client)
      const staged = await stageReleaseConfiguration(
        client,
        configRoot,
        sourceRoot,
        scopePaths,
      )
      if (staged > 0) await this.validateConfiguration()
    } finally {
      client.close()
    }
  }

  async writeReleaseMetadata(releaseVersion: string) {
    await this.assertLease()
    await syncDashboardDeployment({
      haToken: this.options.haToken,
      haUrl: this.options.haUrl,
      requirePanel: true,
      version: releaseVersion,
    })
  }

  async restoreAssets(source: string) {
    const client = await this.scp()
    try {
      await this.assertLeaseWithClient(client)
      const { completed } = await this.assetTransactionPaths(client)
      if (await client.exists(completed)) await client.unlink(completed)
    } finally {
      client.close()
    }
    await this.deployAssets(source)
  }

  async restoreMetadata(metadata: ProductionMetadata) {
    assert(metadata.restoreState, 'Production metadata restore state is missing')
    const connection = await this.connection()
    let client: ScpClient | undefined
    try {
      client = await this.scp()
      await this.assertLeaseWithClient(client)
      const configRoot = await this.configRoot(client)
      const configurationFiles =
        metadata.restoreState.configurationFiles ?? []
      await restoreReleaseConfiguration(
        client,
        configRoot,
        configurationFiles,
      )
      if (configurationFiles.length > 0) await this.validateConfiguration()
      await restoreHomeAssistantProductionMetadata(connection, metadata)
    } finally {
      connection.close()
      client?.close()
    }
  }

  async currentAssetsDirectory() {
    await rm(this.options.verificationDirectory, {
      recursive: true,
      force: true,
    })
    await this.captureAssets(this.options.verificationDirectory)
    return this.options.verificationDirectory
  }

  private async validateConfiguration() {
    const response = await fetch(
      new URL('/api/config/core/check_config', this.options.haUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.haToken}`,
          'Content-Type': 'application/json',
        },
      },
    )
    if (!response.ok) {
      throw new Error(
        `Home Assistant config validation failed with HTTP ${response.status}`,
      )
    }
    const result = (await response.json()) as {
      errors?: unknown
      result?: unknown
    }
    if (result.result !== 'valid') {
      throw new Error(
        `Home Assistant rejected the staged configuration: ${String(result.errors || 'unknown validation error')}`,
      )
    }
  }
}
