// @covers src/constants/rtcPilot.ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FOLD_TEST_REACT_DASHBOARD_HOST } from '../src/constants/dashboardHosts'
import {
  FOLD_TEST_ASSET_FOLDER,
  FOLD_TEST_CARD_RESOURCE_PATH,
  FOLD_TEST_CARD_TAG,
  RTC_PILOT_RESOURCE_PATH,
} from '../src/constants/rtcPilot'
import {
  FOLD_TEST_DASHBOARD_TITLE,
  foldTestDashboardConfig,
  foldTestDashboardMetadata,
  prepareFoldTestDashboard,
} from './prepare-fold-test-dashboard'

describe('Fold RTC test dashboard staging', () => {
  it('defines a distinct hidden, admin-only dashboard that leaves Home and other test paths alone', () => {
    expect(foldTestDashboardMetadata()).toMatchObject({
      mode: 'storage',
      require_admin: true,
      show_in_sidebar: false,
      title: FOLD_TEST_DASHBOARD_TITLE,
      url_path: 'sfenton-react-fold-test',
    })
    expect(FOLD_TEST_REACT_DASHBOARD_HOST).toBe('sfenton-react-fold-test')
    expect(foldTestDashboardConfig('sha 123')).toMatchObject({
      views: [{
        path: 'home',
        type: 'panel',
        cards: [{
          type: 'custom:sfenton-react-fold-app-card',
          url: '/local/ha-sfenton-react-dash-fold-test/index.html?v=sha%20123',
        }],
      }],
    })
    expect(RTC_PILOT_RESOURCE_PATH).toBe(
      '/local/ha-sfenton-react-dash-fold-test/rtc/webrtc-camera.js?v=v3.10.3',
    )
  })

  it('stages one verified candidate build with fork JS and an isolated HA plan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ha-fold-rtc-test-'))
    const distDirectory = join(root, 'dist')
    const forkDirectory = join(root, 'fork')
    const foldBridgeDirectory = join(root, 'bridge')
    const stageRoot = join(root, 'stage')
    try {
      await mkdir(distDirectory)
      await mkdir(foldBridgeDirectory)
      await mkdir(join(forkDirectory, 'custom_components/webrtc/www'), { recursive: true })
      await Promise.all([
        mkdir(join(distDirectory, 'assets')),
        writeFile(join(distDirectory, 'index.html'), '<html><script src="./assets/app-pilot.js"></script>pilot</html>'),
        writeFile(join(distDirectory, 'sfenton-react-app-card.js'), 'sfenton-react-fold-test/home'),
        writeFile(join(foldBridgeDirectory, `${FOLD_TEST_CARD_TAG}.js`),
          'customElements.define("sfenton-react-fold-app-card", class {}); // sfenton-react-fold-test/home'),
        writeFile(join(forkDirectory, 'custom_components/webrtc/manifest.json'), '{"version":"v3.10.3"}'),
        writeFile(join(forkDirectory, 'custom_components/webrtc/www/webrtc-camera.js'),
          "const WEBRTC_VERSION = '3.10.3'; import {streamManager} from './stream-manager.js?v=1.3.0';"),
        ...['stream-manager.js', 'video-rtc.js', 'digital-ptz.js'].map((file) =>
          writeFile(join(forkDirectory, 'custom_components/webrtc/www', file), `pilot ${file}`)),
      ])
      await writeFile(join(distDirectory, 'assets/app-pilot.js'),
        `webrtc-camera-sfenton ${RTC_PILOT_RESOURCE_PATH}`)
      const result = await prepareFoldTestDashboard({
        distDirectory, foldBridgeDirectory, forkDirectory, stageRoot, version: 'sha-123',
      })
      const plan = JSON.parse(await readFile(result.planPath, 'utf8'))
      expect(plan).toMatchObject({
        dashboardUrl: '/sfenton-react-fold-test/home',
        cardResource: {
          resource_type: 'module',
          url: `${FOLD_TEST_CARD_RESOURCE_PATH}?v=sha-123`,
        },
        assets: {
          localDirectory: `www/${FOLD_TEST_ASSET_FOLDER}`,
          remoteDirectory: `/config/www/${FOLD_TEST_ASSET_FOLDER}`,
        },
        websocket: {
          createDashboard: { require_admin: true, show_in_sidebar: false },
          saveConfig: { url_path: FOLD_TEST_REACT_DASHBOARD_HOST },
        },
      })
      expect(await readFile(join(result.assetDirectory, 'index.html'), 'utf8'))
        .toBe('<html><script src="./assets/app-pilot.js"></script>pilot</html>')
      expect(await readFile(join(result.assetDirectory, `${FOLD_TEST_CARD_TAG}.js`), 'utf8'))
        .toContain('customElements.define("sfenton-react-fold-app-card"')
      expect(await readFile(join(result.assetDirectory, 'rtc/stream-manager.js'), 'utf8')).toBe('pilot stream-manager.js')
      await expect(prepareFoldTestDashboard({
        distDirectory, foldBridgeDirectory, forkDirectory, stageRoot, version: 'again',
      })).rejects.toThrow('staging already exists')

      await writeFile(join(foldBridgeDirectory, `${FOLD_TEST_CARD_TAG}.js`),
        'const foldTag = "sfenton-react-fold-app-card"; customElements.define("sfenton-react-app-card", class {}); // sfenton-react-fold-test/home')
      await expect(prepareFoldTestDashboard({
        distDirectory, foldBridgeDirectory, forkDirectory, stageRoot: join(root, 'wrong-tag'),
        version: 'wrong-tag',
      })).rejects.toThrow('register only its own custom element tag')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a default HLS build before staging a misleading RTC dashboard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ha-fold-rtc-hls-'))
    const distDirectory = join(root, 'dist')
    const foldBridgeDirectory = join(root, 'bridge')
    try {
      await mkdir(join(distDirectory, 'assets'), { recursive: true })
      await mkdir(foldBridgeDirectory)
      await writeFile(join(distDirectory, 'index.html'), '<script src="./assets/app-hls.js"></script>')
      await writeFile(join(distDirectory, 'sfenton-react-app-card.js'), 'sfenton-react-fold-test/home')
      await writeFile(join(distDirectory, 'assets/app-hls.js'), 'camera/stream')
      await writeFile(join(foldBridgeDirectory, `${FOLD_TEST_CARD_TAG}.js`),
        'customElements.define("sfenton-react-fold-app-card", class {}); // sfenton-react-fold-test/home')
      await expect(prepareFoldTestDashboard({
        distDirectory, foldBridgeDirectory, forkDirectory: root, stageRoot: join(root, 'stage'), version: 'bad',
      })).rejects.toThrow('requires a Vite rtc-pilot build')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
