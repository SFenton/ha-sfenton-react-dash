import { access, constants, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { config as loadDotEnv } from 'dotenv'
import {
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
} from 'home-assistant-js-websocket'
import { Client, type ScpClient } from 'node-scp'
import { IOS_TEST_REACT_DASHBOARD_HOST } from '../src/constants/dashboardHosts'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'
import {
  DEFAULT_IOS_TEST_STAGE_ROOT,
  IOS_TEST_ASSET_FOLDER,
  IOS_TEST_DASHBOARD_TITLE,
  iosTestDashboardConfig,
  iosTestDashboardMetadata,
} from './prepare-ios-test-dashboard'

type DashboardConnection = Pick<Connection, 'sendMessagePromise'>
type TestAssetClient = Pick<ScpClient, 'exists' | 'rename' | 'rmdir' | 'uploadDir'>

interface LovelaceDashboard {
  icon?: string
  id: string
  mode: string
  require_admin: boolean
  show_in_sidebar: boolean
  title: string
  url_path: string
}

interface AssetSwap {
  hadPrevious: boolean
  incoming: string
  previous: string
  remote: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function matchingDashboard(dashboards: unknown) {
  assert(Array.isArray(dashboards), 'Home Assistant returned an invalid dashboard list.')
  const matches = dashboards.filter((dashboard): dashboard is LovelaceDashboard => (
    Boolean(dashboard)
    && typeof dashboard === 'object'
    && (dashboard as LovelaceDashboard).url_path === IOS_TEST_REACT_DASHBOARD_HOST
  ))
  assert(matches.length <= 1, `Found multiple dashboards at ${IOS_TEST_REACT_DASHBOARD_HOST}.`)
  return matches[0]
}

function mutableDashboardMetadata(dashboard: LovelaceDashboard) {
  return {
    icon: dashboard.icon,
    require_admin: dashboard.require_admin,
    show_in_sidebar: dashboard.show_in_sidebar,
    title: dashboard.title,
  }
}

function expectedMutableDashboardMetadata() {
  const { icon, require_admin, show_in_sidebar, title } = iosTestDashboardMetadata()
  return { icon, require_admin, show_in_sidebar, title }
}

async function verifyIosTestDashboard(
  connection: DashboardConnection,
  expectedConfig: ReturnType<typeof iosTestDashboardConfig>,
) {
  const dashboard = matchingDashboard(await connection.sendMessagePromise({
    type: 'lovelace/dashboards/list',
  }))
  assert(dashboard, `Dashboard ${IOS_TEST_REACT_DASHBOARD_HOST} was not registered.`)
  assert(dashboard.mode === 'storage', 'The iOS test dashboard is not storage mode.')
  assert(
    isDeepStrictEqual(mutableDashboardMetadata(dashboard), expectedMutableDashboardMetadata()),
    'The iOS test dashboard metadata does not match the prepared definition.',
  )

  const config = await connection.sendMessagePromise({
    force: true,
    type: 'lovelace/config',
    url_path: IOS_TEST_REACT_DASHBOARD_HOST,
  })
  assert(
    isDeepStrictEqual(config, expectedConfig),
    'The iOS test dashboard config does not match the prepared definition.',
  )
  return dashboard
}

export async function syncIosTestDashboard(
  connection: DashboardConnection,
  version: string,
) {
  const dashboardDefinition = iosTestDashboardMetadata()
  const config = iosTestDashboardConfig(version)
  const existing = matchingDashboard(await connection.sendMessagePromise({
    type: 'lovelace/dashboards/list',
  }))
  if (existing) {
    assert(
      existing.title === IOS_TEST_DASHBOARD_TITLE && existing.mode === 'storage',
      `Refusing to take ownership of existing dashboard ${IOS_TEST_REACT_DASHBOARD_HOST}.`,
    )
  }

  const previousConfig = existing
    ? await connection.sendMessagePromise({
        force: true,
        type: 'lovelace/config',
        url_path: IOS_TEST_REACT_DASHBOARD_HOST,
      })
    : undefined
  const previousMetadata = existing ? mutableDashboardMetadata(existing) : undefined
  let dashboard = existing
  let metadataChanged = false

  try {
    if (dashboard) {
      const expectedMetadata = expectedMutableDashboardMetadata()
      if (!isDeepStrictEqual(previousMetadata, expectedMetadata)) {
        await connection.sendMessagePromise({
          dashboard_id: dashboard.id,
          type: 'lovelace/dashboards/update',
          ...expectedMetadata,
        })
        metadataChanged = true
      }
    } else {
      dashboard = await connection.sendMessagePromise<LovelaceDashboard>({
        type: 'lovelace/dashboards/create',
        ...dashboardDefinition,
      })
      assert(
        dashboard?.id && dashboard.url_path === IOS_TEST_REACT_DASHBOARD_HOST,
        'Home Assistant did not return the created iOS test dashboard.',
      )
    }

    await connection.sendMessagePromise({
      config,
      type: 'lovelace/config/save',
      url_path: IOS_TEST_REACT_DASHBOARD_HOST,
    })
    return await verifyIosTestDashboard(connection, config)
  } catch (error) {
    const rollbackErrors: unknown[] = []
    if (!existing && dashboard?.id) {
      try {
        await connection.sendMessagePromise({
          dashboard_id: dashboard.id,
          type: 'lovelace/dashboards/delete',
        })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    } else if (existing) {
      if (previousConfig !== undefined) {
        try {
          await connection.sendMessagePromise({
            config: previousConfig,
            type: 'lovelace/config/save',
            url_path: IOS_TEST_REACT_DASHBOARD_HOST,
          })
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (metadataChanged && previousMetadata) {
        try {
          await connection.sendMessagePromise({
            dashboard_id: existing.id,
            type: 'lovelace/dashboards/update',
            ...previousMetadata,
          })
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'The iOS test dashboard deployment failed and rollback was incomplete.',
        { cause: error },
      )
    }
    throw error
  }
}

export async function swapIosTestAssets(
  client: TestAssetClient,
  localDirectory: string,
  remote: string,
  version: string,
) {
  const transaction = version.replace(/[^a-zA-Z0-9-]/g, '-')
  const swap: AssetSwap = {
    hadPrevious: Boolean(await client.exists(remote)),
    incoming: `${remote}.incoming-${transaction}`,
    previous: `${remote}.previous-${transaction}`,
    remote,
  }
  assert(!(await client.exists(swap.incoming)), `Stale incoming asset directory: ${swap.incoming}`)
  assert(!(await client.exists(swap.previous)), `Stale previous asset directory: ${swap.previous}`)

  try {
    await client.uploadDir(localDirectory, swap.incoming)
    if (swap.hadPrevious) await client.rename(swap.remote, swap.previous)
    await client.rename(swap.incoming, swap.remote)
    return swap
  } catch (error) {
    if (await client.exists(swap.incoming)) await client.rmdir(swap.incoming)
    if (!(await client.exists(swap.remote)) && await client.exists(swap.previous)) {
      await client.rename(swap.previous, swap.remote)
    }
    throw error
  }
}

export async function rollbackIosTestAssets(client: TestAssetClient, swap: AssetSwap) {
  if (await client.exists(swap.remote)) await client.rmdir(swap.remote)
  if (swap.hadPrevious && await client.exists(swap.previous)) {
    await client.rename(swap.previous, swap.remote)
  }
  if (await client.exists(swap.incoming)) await client.rmdir(swap.incoming)
}

export async function finalizeIosTestAssets(client: TestAssetClient, swap: AssetSwap) {
  if (await client.exists(swap.previous)) await client.rmdir(swap.previous)
  if (await client.exists(swap.incoming)) await client.rmdir(swap.incoming)
}

async function findConfigRoot(client: Pick<ScpClient, 'exists'>) {
  for (const directory of ['/config', '/homeassistant']) {
    if (await client.exists(directory)) return directory
  }
  throw new Error('Could not find a config/homeassistant directory in the Home Assistant installation root.')
}

async function assertUploadedIndex(
  haUrl: string,
  haToken: string,
  expectedIndexPath: string,
  version: string,
) {
  const response = await fetch(
    new URL(`/local/${IOS_TEST_ASSET_FOLDER}/index.html?v=${encodeURIComponent(version)}`, haUrl),
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${haToken}`,
      },
    },
  )
  assert(response.ok, `The staged iOS test dashboard returned HTTP ${response.status}.`)
  const [actual, expected] = await Promise.all([
    response.text(),
    readFile(expectedIndexPath, 'utf8'),
  ])
  assert(actual === expected, 'The uploaded iOS test dashboard index does not match the staged build.')
}

async function main() {
  assert(process.argv.includes('--yes'), 'Pass --yes to confirm the authorized live test-dashboard deployment.')
  loadDotEnv({ path: resolve('.env.ios-test.local'), quiet: true })
  loadRuntimeEnvironment()

  const haUrl = process.env.VITE_HA_URL
  const haToken = process.env.VITE_HA_TOKEN
  const host = process.env.VITE_SSH_HOSTNAME || '192.168.1.22'
  const username = process.env.VITE_SSH_USERNAME || 'root'
  const password = process.env.VITE_SSH_PASSWORD
  const privateKeyPath = resolve(
    process.env.VITE_SSH_PRIVATE_KEY || join(homedir(), '.ssh/ha-sfenton-react-dash-deploy'),
  )
  const port = Number(process.env.VITE_SSH_PORT || 22)
  assert(haUrl, 'Add VITE_HA_URL to .env.')
  assert(haToken, 'Add VITE_HA_TOKEN to .env.ios-test.local.')
  assert(
    password || await access(privateKeyPath, constants.R_OK).then(() => true, () => false),
    'Configure VITE_SSH_PASSWORD or VITE_SSH_PRIVATE_KEY for SSH deployment.',
  )

  const plan = JSON.parse(
    await readFile(join(DEFAULT_IOS_TEST_STAGE_ROOT, 'deployment-plan.json'), 'utf8'),
  ) as { version?: unknown }
  assert(typeof plan.version === 'string' && plan.version, 'The staged deployment plan has no version.')
  const version = plan.version
  const localAssets = join(DEFAULT_IOS_TEST_STAGE_ROOT, 'www', IOS_TEST_ASSET_FOLDER)
  const expectedIndex = join(localAssets, 'index.html')
  await access(expectedIndex, constants.R_OK)

  const client = await Client({
    host,
    password,
    port,
    privateKey: password ? undefined : await readFile(privateKeyPath),
    username,
  })
  let swap: AssetSwap | undefined
  try {
    const configRoot = await findConfigRoot(client)
    swap = await swapIosTestAssets(
      client,
      localAssets,
      `${configRoot}/www/${IOS_TEST_ASSET_FOLDER}`,
      version,
    )
    await assertUploadedIndex(haUrl, haToken, expectedIndex, version)

    const auth = createLongLivedTokenAuth(haUrl, haToken)
    const connection = await createConnection({ auth })
    try {
      await syncIosTestDashboard(connection, version)
    } finally {
      connection.close()
    }
    await finalizeIosTestAssets(client, swap)
    console.info(`Deployed ${new URL(`/${IOS_TEST_REACT_DASHBOARD_HOST}/home`, haUrl).href}`)
  } catch (error) {
    if (swap) {
      try {
        await rollbackIosTestAssets(client, swap)
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'The iOS test dashboard deployment failed and asset rollback was incomplete.',
          { cause: rollbackError },
        )
      }
    }
    throw error
  } finally {
    client.close()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
