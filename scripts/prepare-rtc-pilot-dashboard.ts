import { createHash } from 'node:crypto'
import { access, constants, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  FOLD_TEST_ASSET_FOLDER,
  RTC_PILOT_FRONTEND_VERSION,
  RTC_PILOT_RESOURCE_PATH,
  RTC_PILOT_STAGE_DIRECTORY,
} from '../src/constants/rtcPilot'

const FRONTEND_FILES = ['webrtc-camera.js', 'stream-manager.js', 'video-rtc.js', 'digital-ptz.js'] as const

interface PrepareRtcPilotDashboardOptions {
  forkDirectory: string
  stageRoot?: string
}

export async function prepareRtcPilotDashboard({
  forkDirectory,
  stageRoot = resolve(RTC_PILOT_STAGE_DIRECTORY),
}: PrepareRtcPilotDashboardOptions) {
  if (!forkDirectory?.trim()) throw new Error('The RTC pilot requires an explicit fork directory.')
  const componentRoot = resolve(forkDirectory, 'custom_components/webrtc')
  const assetRoot = resolve(stageRoot, 'www', FOLD_TEST_ASSET_FOLDER)
  const destination = join(assetRoot, 'rtc')
  const index = join(assetRoot, 'index.html')

  await access(index, constants.R_OK)
  if (!(await stat(index)).size) throw new Error(`The Fold test build is empty: ${index}`)
  if (existsSync(destination)) {
    throw new Error(`The RTC pilot frontend is already staged: ${destination}. Prepare the test dashboard again first.`)
  }

  const [manifestSource, frontendSources] = await Promise.all([
    readFile(join(componentRoot, 'manifest.json'), 'utf8'),
    Promise.all(FRONTEND_FILES.map((file) => readFile(join(componentRoot, 'www', file)))),
  ])
  const manifest = JSON.parse(manifestSource) as { version?: unknown }
  if (manifest.version !== RTC_PILOT_FRONTEND_VERSION) {
    throw new Error(`Expected the RTC fork manifest at ${RTC_PILOT_FRONTEND_VERSION}; found ${String(manifest.version)}.`)
  }
  const card = frontendSources[0].toString('utf8')
  if (!card.includes(`const WEBRTC_VERSION = '${RTC_PILOT_FRONTEND_VERSION.slice(1)}'`)
    || !card.includes("from './stream-manager.js?v=1.3.0'")) {
    throw new Error('The RTC card does not import the matching upgraded shared manager.')
  }
  if (!RTC_PILOT_RESOURCE_PATH.startsWith(`/local/${FOLD_TEST_ASSET_FOLDER}/rtc/`)) {
    throw new Error('The RTC frontend resource escaped the admin-only test asset folder.')
  }
  if (!RTC_PILOT_RESOURCE_PATH.endsWith(`?v=${RTC_PILOT_FRONTEND_VERSION}`)) {
    throw new Error('The RTC frontend resource version does not match the fork manifest.')
  }

  await mkdir(destination)
  const files: Record<string, string> = {}
  for (const [index, file] of FRONTEND_FILES.entries()) {
    const source = frontendSources[index]
    await writeFile(join(destination, file), source)
    files[file] = createHash('sha256').update(source).digest('hex')
  }
  const manifestPath = join(stageRoot, 'rtc-pilot-frontend.json')
  await writeFile(manifestPath, `${JSON.stringify({
    version: RTC_PILOT_FRONTEND_VERSION,
    resource: RTC_PILOT_RESOURCE_PATH,
    files,
  }, null, 2)}\n`)

  return { destination, files, manifestPath, resource: RTC_PILOT_RESOURCE_PATH }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const forkDirectory = process.argv[2] ?? ''
  prepareRtcPilotDashboard({ forkDirectory }).then((result) => {
    console.info(`Staged RTC pilot frontend ${RTC_PILOT_FRONTEND_VERSION} at ${result.destination}.`)
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
