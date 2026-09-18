import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  IOS_TEST_ASSET_FOLDER,
  iosTestDashboardConfig,
  iosTestDashboardMetadata,
  prepareIosTestDashboard,
} from './prepare-ios-test-dashboard'

describe('iOS test dashboard preparation', () => {
  it('defines an admin-only storage dashboard that is hidden from the sidebar', () => {
    expect(iosTestDashboardMetadata()).toEqual({
      icon: 'mdi:cellphone-cog',
      mode: 'storage',
      require_admin: true,
      show_in_sidebar: false,
      title: 'React Dash iOS Test',
      url_path: 'sfenton-react-ios-test',
    })
  })

  it('uses the full-viewport wrapper with isolated cache-busted assets', () => {
    expect(iosTestDashboardConfig('abc 123')).toMatchObject({
      kiosk_mode: {
        hide_header: true,
        hide_sidebar: true,
      },
      views: [{
        cards: [{
          type: 'custom:sfenton-react-app-card',
          url: '/local/ha-sfenton-react-dash-ios-test/index.html?v=abc%20123',
        }],
        path: 'home',
        type: 'panel',
      }],
    })
  })

  it('copies the build and writes network-free deployment payloads', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'ha-ios-test-dashboard-'))
    const distDirectory = join(temporaryRoot, 'dist')
    const stageRoot = join(temporaryRoot, 'stage')

    try {
      await mkdir(distDirectory)
      await Promise.all([
        writeFile(join(distDirectory, 'index.html'), '<html></html>'),
        writeFile(join(distDirectory, 'sfenton-react-app-card.js'), 'customElements.define("test-card", class {})'),
      ])

      const result = await prepareIosTestDashboard({
        distDirectory,
        stageRoot,
        version: 'abc123',
      })
      const plan = JSON.parse(await readFile(result.planPath, 'utf8'))

      await expect(readFile(
        join(stageRoot, 'www', IOS_TEST_ASSET_FOLDER, 'index.html'),
        'utf8',
      )).resolves.toBe('<html></html>')
      expect(plan.websocket.createDashboard).toMatchObject({
        show_in_sidebar: false,
        type: 'lovelace/dashboards/create',
        url_path: 'sfenton-react-ios-test',
      })
      expect(plan.websocket.saveConfig).toMatchObject({
        type: 'lovelace/config/save',
        url_path: 'sfenton-react-ios-test',
      })
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true })
    }
  })
})
