import { access, constants, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IOS_TEST_REACT_DASHBOARD_HOST } from '../src/constants/dashboardHosts'
import { resolveDeploymentVersion } from './lib/dashboardDeployment'

export const IOS_TEST_ASSET_FOLDER = 'ha-sfenton-react-dash-ios-test'
export const IOS_TEST_DASHBOARD_TITLE = 'React Dash iOS Test'
export const IOS_TEST_PUBLIC_PATH = `/local/${IOS_TEST_ASSET_FOLDER}/index.html`
export const DEFAULT_IOS_TEST_STAGE_ROOT = resolve('.deploy/ios-simulator-dashboard')

interface PrepareIosTestDashboardOptions {
  distDirectory?: string
  stageRoot?: string
  version?: string
}

export function iosTestDashboardMetadata() {
  return {
    icon: 'mdi:cellphone-cog',
    mode: 'storage' as const,
    require_admin: true,
    show_in_sidebar: false,
    title: IOS_TEST_DASHBOARD_TITLE,
    url_path: IOS_TEST_REACT_DASHBOARD_HOST,
  }
}

export function iosTestDashboardConfig(version: string) {
  const appUrl = `${IOS_TEST_PUBLIC_PATH}?v=${encodeURIComponent(version)}`
  return {
    kiosk_mode: {
      hide_header: true,
      hide_sidebar: true,
      mobile_settings: {
        hide_header: true,
        hide_sidebar: true,
      },
    },
    views: [{
      cards: [{
        title: IOS_TEST_DASHBOARD_TITLE,
        type: 'custom:sfenton-react-app-card',
        url: appUrl,
      }],
      path: 'home',
      title: 'Home',
      type: 'panel',
    }],
  }
}

export function iosTestDeploymentPlan(version: string) {
  const dashboard = iosTestDashboardMetadata()
  const config = iosTestDashboardConfig(version)
  return {
    assets: {
      localDirectory: `www/${IOS_TEST_ASSET_FOLDER}`,
      publicUrl: IOS_TEST_PUBLIC_PATH,
      remoteDirectory: `/config/www/${IOS_TEST_ASSET_FOLDER}`,
    },
    dashboardUrl: `/${IOS_TEST_REACT_DASHBOARD_HOST}/home`,
    version,
    websocket: {
      createDashboard: {
        type: 'lovelace/dashboards/create',
        ...dashboard,
      },
      listDashboards: {
        type: 'lovelace/dashboards/list',
      },
      saveConfig: {
        config,
        type: 'lovelace/config/save',
        url_path: IOS_TEST_REACT_DASHBOARD_HOST,
      },
    },
  }
}

async function assertBuildArtifact(path: string) {
  await access(path, constants.R_OK)
  if (!(await readFile(path)).length) {
    throw new Error(`Build artifact is empty: ${path}`)
  }
}

export async function prepareIosTestDashboard({
  distDirectory = resolve('dist'),
  stageRoot = DEFAULT_IOS_TEST_STAGE_ROOT,
  version,
}: PrepareIosTestDashboardOptions = {}) {
  await Promise.all([
    assertBuildArtifact(join(distDirectory, 'index.html')),
    assertBuildArtifact(join(distDirectory, 'sfenton-react-app-card.js')),
  ])

  const resolvedVersion = version || await resolveDeploymentVersion()
  const assetDirectory = join(stageRoot, 'www', IOS_TEST_ASSET_FOLDER)
  const plan = iosTestDeploymentPlan(resolvedVersion)

  await rm(stageRoot, { force: true, recursive: true })
  await mkdir(dirname(assetDirectory), { recursive: true })
  await cp(distDirectory, assetDirectory, { recursive: true })
  await writeFile(
    join(stageRoot, 'deployment-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
  )

  return {
    assetDirectory,
    dashboardUrl: plan.dashboardUrl,
    planPath: join(stageRoot, 'deployment-plan.json'),
    stageRoot,
    version: resolvedVersion,
  }
}

async function main() {
  const result = await prepareIosTestDashboard()
  console.info(`Prepared iOS simulator dashboard ${result.version}.`)
  console.info(`Staging root: ${result.stageRoot}`)
  console.info(`Dashboard URL: ${result.dashboardUrl}`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
