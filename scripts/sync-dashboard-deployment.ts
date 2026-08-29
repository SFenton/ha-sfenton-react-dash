import chalk from 'chalk'
import { createConnection, createLongLivedTokenAuth } from 'home-assistant-js-websocket'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { LEGACY_REACT_DASHBOARD_HOST } from '../src/constants/dashboardHosts'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'
import {
  assertDashboardResourceAvailable,
  resolveDeploymentVersion,
  updateLegacyCardResource,
  updateLegacyDashboardConfig,
  validatePanelRegistration,
} from './lib/dashboardDeployment'

interface SyncDashboardDeploymentOptions {
  haToken: string
  haUrl: string
  requirePanel?: boolean
  version: string
}

export async function syncDashboardDeployment({
  haToken,
  haUrl,
  requirePanel = true,
  version,
}: SyncDashboardDeploymentOptions) {
  const auth = createLongLivedTokenAuth(haUrl, haToken)
  const connection = await createConnection({ auth })

  try {
    const [currentConfig, resources, panels] = await Promise.all([
      connection.sendMessagePromise({
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
    const wrapper = updateLegacyDashboardConfig(currentConfig, version)
    const legacyCardResource = updateLegacyCardResource(resources, version)
    if (requirePanel) validatePanelRegistration(panels)
    await assertDashboardResourceAvailable(haUrl, legacyCardResource.url, haToken)

    let legacyResourceUpdated = false
    try {
      if (legacyCardResource.changed) {
        legacyResourceUpdated = true
        await connection.sendMessagePromise({
          type: 'lovelace/resources/update',
          resource_id: legacyCardResource.resourceId,
          res_type: 'module',
          url: legacyCardResource.url,
        })
      }
      if (wrapper.changed) {
        await connection.sendMessagePromise({
          type: 'lovelace/config/save',
          url_path: LEGACY_REACT_DASHBOARD_HOST,
          config: wrapper.config,
        })
      }
    } catch (error) {
      if (legacyResourceUpdated) {
        try {
          await connection.sendMessagePromise({
            type: 'lovelace/resources/update',
            resource_id: legacyCardResource.resourceId,
            res_type: 'module',
            url: legacyCardResource.previousUrl,
          })
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'Dashboard synchronization failed and the legacy card resource rollback also failed.',
            { cause: rollbackError },
          )
        }
      }
      throw error
    }

    return {
      legacyCardResourceUrl: legacyCardResource.url,
      legacyDashboardUrl: wrapper.url,
      legacyResourceUpdated,
      legacyUpdated: wrapper.changed,
      panelRegistered: Boolean(panels['sfenton-react-panel']),
      version,
    }
  } finally {
    connection.close()
  }
}

function argumentValue(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
  loadRuntimeEnvironment()
  const haUrl = process.env.VITE_HA_URL
  const haToken = process.env.VITE_HA_TOKEN
  if (!haUrl) throw new Error('Missing VITE_HA_URL in .env or .env.development.')
  if (!haToken) throw new Error('Missing VITE_HA_TOKEN in .env or .env.development.')

  const version = argumentValue('version') || await resolveDeploymentVersion()
  const result = await syncDashboardDeployment({ haToken, haUrl, version })
  console.info(chalk.green('Dashboard deployment metadata synchronized.'))
  console.info(chalk.blue(`${LEGACY_REACT_DASHBOARD_HOST}: ${result.legacyDashboardUrl}`))
  console.info(chalk.blue(`sfenton-react-app-card: ${result.legacyCardResourceUrl}`))
  console.info(chalk.blue('sfenton-react-panel: registered embedded custom panel'))
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  })
}
