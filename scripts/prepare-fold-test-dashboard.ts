import { access, constants, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { FOLD_TEST_REACT_DASHBOARD_HOST } from '../src/constants/dashboardHosts'
import {
  FOLD_TEST_ASSET_FOLDER,
  FOLD_TEST_CARD_BUNDLE_DIRECTORY,
  FOLD_TEST_CARD_RESOURCE_PATH,
  FOLD_TEST_CARD_TAG,
  RTC_PILOT_RESOURCE_PATH,
  RTC_PILOT_STAGE_DIRECTORY,
} from '../src/constants/rtcPilot'
import { resolveDeploymentVersion } from './lib/dashboardDeployment'
import { prepareRtcPilotDashboard } from './prepare-rtc-pilot-dashboard'

export const FOLD_TEST_DASHBOARD_TITLE = 'React Dash Fold Test'
export const FOLD_TEST_PUBLIC_PATH = `/local/${FOLD_TEST_ASSET_FOLDER}/index.html`
export const DEFAULT_FOLD_TEST_STAGE_ROOT = resolve(RTC_PILOT_STAGE_DIRECTORY)

interface PrepareFoldTestDashboardOptions {
  distDirectory?: string
  foldBridgeDirectory?: string
  forkDirectory: string
  stageRoot?: string
  version?: string
}

export function foldTestDashboardMetadata() {
  return {
    icon: 'mdi:cellphone-screenshot',
    mode: 'storage' as const,
    require_admin: true,
    show_in_sidebar: false,
    title: FOLD_TEST_DASHBOARD_TITLE,
    url_path: FOLD_TEST_REACT_DASHBOARD_HOST,
  }
}

export function foldTestDashboardConfig(version: string) {
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
        title: FOLD_TEST_DASHBOARD_TITLE,
        type: `custom:${FOLD_TEST_CARD_TAG}`,
        url: `${FOLD_TEST_PUBLIC_PATH}?v=${encodeURIComponent(version)}`,
      }],
      path: 'home',
      title: 'Home',
      type: 'panel',
    }],
  }
}

export function foldTestDeploymentPlan(version: string) {
  const dashboard = foldTestDashboardMetadata()
  return {
    assets: {
      localDirectory: `www/${FOLD_TEST_ASSET_FOLDER}`,
      publicUrl: FOLD_TEST_PUBLIC_PATH,
      remoteDirectory: `/config/www/${FOLD_TEST_ASSET_FOLDER}`,
    },
    dashboardUrl: `/${FOLD_TEST_REACT_DASHBOARD_HOST}/home`,
    cardResource: {
      resource_type: 'module',
      url: `${FOLD_TEST_CARD_RESOURCE_PATH}?v=${encodeURIComponent(version)}`,
    },
    version,
    websocket: {
      createDashboard: {
        type: 'lovelace/dashboards/create',
        ...dashboard,
      },
      saveConfig: {
        config: foldTestDashboardConfig(version),
        type: 'lovelace/config/save',
        url_path: FOLD_TEST_REACT_DASHBOARD_HOST,
      },
    },
  }
}

export async function prepareFoldTestDashboard({
  distDirectory = resolve('dist'),
  foldBridgeDirectory = resolve(FOLD_TEST_CARD_BUNDLE_DIRECTORY),
  forkDirectory,
  stageRoot = DEFAULT_FOLD_TEST_STAGE_ROOT,
  version,
}: PrepareFoldTestDashboardOptions) {
  if (!forkDirectory?.trim()) throw new Error('A specific RTC fork directory is required for the Fold pilot.')
  if (existsSync(stageRoot)) {
    throw new Error(`Fold pilot staging already exists: ${stageRoot}. Choose a fresh stageRoot to retain provenance.`)
  }
  await Promise.all([
    access(join(distDirectory, 'index.html'), constants.R_OK),
    access(join(distDirectory, 'sfenton-react-app-card.js'), constants.R_OK),
    access(join(foldBridgeDirectory, `${FOLD_TEST_CARD_TAG}.js`), constants.R_OK),
  ])
  const appFiles = (await readdir(join(distDirectory, 'assets')))
    .filter((file) => /^app-[a-zA-Z0-9_-]+\.js$/.test(file))
  if (appFiles.length !== 1) throw new Error('The Fold pilot build must contain one app JavaScript entry.')
  const [indexHtml, app, bridge, foldBridge] = await Promise.all([
    readFile(join(distDirectory, 'index.html'), 'utf8'),
    readFile(join(distDirectory, 'assets', appFiles[0]), 'utf8'),
    readFile(join(distDirectory, 'sfenton-react-app-card.js'), 'utf8'),
    readFile(join(foldBridgeDirectory, `${FOLD_TEST_CARD_TAG}.js`), 'utf8'),
  ])
  if (!indexHtml.includes(`./assets/${appFiles[0]}`)
    || !app.includes(RTC_PILOT_RESOURCE_PATH)
    || !app.includes('webrtc-camera-sfenton')
    || app.includes('camera/stream')) {
    throw new Error('The Fold pilot requires a Vite rtc-pilot build, not the production HLS build.')
  }
  if (!bridge.includes(`${FOLD_TEST_REACT_DASHBOARD_HOST}/home`)) {
    throw new Error('The Fold pilot bridge does not recognize its dashboard host.')
  }
  if (!foldBridge.includes(FOLD_TEST_CARD_TAG)
    || !foldBridge.includes(`${FOLD_TEST_REACT_DASHBOARD_HOST}/home`)
    || /^\s*import\b/m.test(foldBridge)) {
    throw new Error('The Fold card module is not a self-contained Fold-specific bridge.')
  }
  const registered: string[] = []
  runInNewContext(foldBridge, {
    document: { title: '' },
    window: { customCards: [] },
    HTMLElement: class {},
    customElements: {
      get: () => undefined,
      define: (tag: string) => { registered.push(tag) },
    },
  }, { timeout: 1_000 })
  if (registered.length !== 1 || registered[0] !== FOLD_TEST_CARD_TAG) {
    throw new Error('The Fold card module must register only its own custom element tag.')
  }
  const resolvedVersion = version || await resolveDeploymentVersion()
  const assetDirectory = join(stageRoot, 'www', FOLD_TEST_ASSET_FOLDER)
  await mkdir(dirname(assetDirectory), { recursive: true })
  await cp(distDirectory, assetDirectory, { recursive: true })
  await writeFile(join(assetDirectory, `${FOLD_TEST_CARD_TAG}.js`), foldBridge)
  await prepareRtcPilotDashboard({ forkDirectory, stageRoot })
  const plan = foldTestDeploymentPlan(resolvedVersion)
  const planPath = join(stageRoot, 'deployment-plan.json')
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`)

  return {
    assetDirectory,
    dashboardUrl: plan.dashboardUrl,
    planPath,
    stageRoot,
    version: resolvedVersion,
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const forkDirectory = process.argv[2] ?? ''
  const stageRoot = process.argv[3] ? resolve(process.argv[3]) : DEFAULT_FOLD_TEST_STAGE_ROOT
  prepareFoldTestDashboard({ forkDirectory, stageRoot }).then((result) => {
    console.info(`Prepared Fold RTC dashboard ${result.version}.`)
    console.info(`Staging root: ${result.stageRoot}`)
    console.info(`Dashboard URL: ${result.dashboardUrl}`)
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
