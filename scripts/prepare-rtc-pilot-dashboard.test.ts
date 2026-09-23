import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FOLD_TEST_ASSET_FOLDER, RTC_PILOT_FRONTEND_VERSION, RTC_PILOT_RESOURCE_PATH } from '../src/constants/rtcPilot'
import { prepareRtcPilotDashboard } from './prepare-rtc-pilot-dashboard'

const files = ['webrtc-camera.js', 'stream-manager.js', 'video-rtc.js', 'digital-ptz.js']

describe('isolated RTC pilot frontend staging', () => {
  let root: string
  let forkDirectory: string
  let stageRoot: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rtc-pilot-staging-'))
    forkDirectory = join(root, 'fork')
    stageRoot = join(root, 'stage')
    await mkdir(join(forkDirectory, 'custom_components/webrtc/www'), { recursive: true })
    await mkdir(join(stageRoot, 'www', FOLD_TEST_ASSET_FOLDER), { recursive: true })
    await writeFile(join(stageRoot, 'www', FOLD_TEST_ASSET_FOLDER, 'index.html'), '<html>pilot</html>')
    await writeFile(join(forkDirectory, 'custom_components/webrtc/manifest.json'),
      JSON.stringify({ version: RTC_PILOT_FRONTEND_VERSION }))
    await Promise.all(files.map((file) => writeFile(
      join(forkDirectory, 'custom_components/webrtc/www', file),
      file === 'webrtc-camera.js'
        ? "const WEBRTC_VERSION = '3.10.3'; import {streamManager} from './stream-manager.js?v=1.3.0';"
        : `candidate ${file}`,
    )))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('copies only the matching frontend files into the test folder with an auditable digest', async () => {
    const result = await prepareRtcPilotDashboard({ forkDirectory, stageRoot })
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))
    expect(result.resource).toBe(`/local/${FOLD_TEST_ASSET_FOLDER}/rtc/webrtc-camera.js?v=v3.10.3`)
    expect(RTC_PILOT_RESOURCE_PATH).toBe(result.resource)
    expect(Object.keys(result.files)).toEqual(files)
    expect(manifest).toMatchObject({
      version: RTC_PILOT_FRONTEND_VERSION,
      resource: result.resource,
    })
    for (const file of files) {
      const content = await readFile(join(result.destination, file))
      expect(manifest.files[file]).toBe(createHash('sha256').update(content).digest('hex'))
    }
    await expect(prepareRtcPilotDashboard({ forkDirectory, stageRoot })).rejects.toThrow('already staged')
  })

  it('rejects a mismatched fork version before copying any files', async () => {
    await writeFile(join(forkDirectory, 'custom_components/webrtc/manifest.json'),
      JSON.stringify({ version: 'v3.10.1' }))
    await expect(prepareRtcPilotDashboard({ forkDirectory, stageRoot })).rejects.toThrow('Expected the RTC fork manifest')
    await expect(readFile(join(stageRoot, 'rtc-pilot-frontend.json'))).rejects.toThrow()
  })

  it('rejects a stale manager import before copying any files', async () => {
    await writeFile(join(forkDirectory, 'custom_components/webrtc/www/webrtc-camera.js'),
      "const WEBRTC_VERSION = '3.10.3'; import {streamManager} from './stream-manager.js?v=1.2.0';")
    await expect(prepareRtcPilotDashboard({ forkDirectory, stageRoot })).rejects.toThrow('matching upgraded shared manager')
  })
})
