import { Buffer } from 'node:buffer'

const mocks = vi.hoisted(() => ({
  assertDashboardResourceAvailable: vi.fn(),
  close: vi.fn(),
  createConnection: vi.fn(),
  createLongLivedTokenAuth: vi.fn(() => ({ type: 'test-auth' })),
  sendMessagePromise: vi.fn(),
}))

vi.mock('home-assistant-js-websocket', () => ({
  createConnection: mocks.createConnection,
  createLongLivedTokenAuth: mocks.createLongLivedTokenAuth,
}))

vi.mock('./lib/dashboardDeployment', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lib/dashboardDeployment')>(),
  assertDashboardResourceAvailable: mocks.assertDashboardResourceAvailable,
}))

import {
  isSyncDashboardDeploymentEntry,
  syncDashboardDeployment,
} from './sync-dashboard-deployment'

const inlineCardSource = "customElements.define('sfenton-react-app-card', class extends HTMLElement {})"
const inlineCardUrl = `https://resources.example/${Buffer.from(inlineCardSource).toString('base64')}?type=module`

function dashboardConfig() {
  return {
    views: [{
      cards: [{
        type: 'custom:sfenton-react-app-card',
        url: '/local/ha-sfenton-react-dash/index.html?v=old',
      }],
    }],
  }
}

function panels() {
  return {
    'sfenton-react-panel': {
      component_name: 'custom',
      config: {
        _panel_custom: {
          embed_iframe: true,
          name: 'sfenton-react-panel',
        },
      },
    },
  }
}

function resources() {
  return [{
    id: 'legacy-resource',
    type: 'module',
    url: inlineCardUrl,
  }]
}

describe('dashboard deployment synchronization', () => {
  it('does not execute the synchronization CLI when bundled into another entrypoint', () => {
    expect(
      isSyncDashboardDeploymentEntry(
        'file:///opt/ha-dashboard/bin/deploy-dashboard-ci.mjs',
        '/opt/ha-dashboard/bin/deploy-dashboard-ci.mjs',
      ),
    ).toBe(false)
    expect(
      isSyncDashboardDeploymentEntry(
        'file:///repo/scripts/sync-dashboard-deployment.ts',
        '/repo/scripts/sync-dashboard-deployment.ts',
      ),
    ).toBe(true)
  })

  beforeEach(() => {
    mocks.assertDashboardResourceAvailable.mockResolvedValue(undefined)
    mocks.close.mockReset()
    mocks.createConnection.mockReset()
    mocks.createConnection.mockResolvedValue({
      close: mocks.close,
      sendMessagePromise: mocks.sendMessagePromise,
    })
    mocks.createLongLivedTokenAuth.mockClear()
    mocks.sendMessagePromise.mockReset()
  })

  it('preflights and migrates the wrapper resource before saving the dashboard URL', async () => {
    mocks.sendMessagePromise.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'lovelace/config') return dashboardConfig()
      if (message.type === 'lovelace/resources') return resources()
      if (message.type === 'get_panels') return panels()
      return undefined
    })

    const result = await syncDashboardDeployment({
      haToken: 'test-token',
      haUrl: 'https://ha.example',
      version: 'abc123',
    })

    expect(mocks.assertDashboardResourceAvailable).toHaveBeenCalledWith(
      'https://ha.example',
      '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=abc123',
      'test-token',
    )
    const mutations = mocks.sendMessagePromise.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type.endsWith('/update') || message.type.endsWith('/save'))
    expect(mutations).toEqual([
      {
        res_type: 'module',
        resource_id: 'legacy-resource',
        type: 'lovelace/resources/update',
        url: '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=abc123',
      },
      {
        config: expect.any(Object),
        type: 'lovelace/config/save',
        url_path: 'sfenton-react-dash',
      },
    ])
    expect(result).toMatchObject({
      legacyResourceUpdated: true,
      legacyUpdated: true,
      panelRegistered: true,
    })
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('rolls the card resource back when saving the dashboard config fails', async () => {
    const saveError = new Error('dashboard save failed')
    let resourceUpdates = 0
    mocks.sendMessagePromise.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'lovelace/config') return dashboardConfig()
      if (message.type === 'lovelace/resources') return resources()
      if (message.type === 'get_panels') return panels()
      if (message.type === 'lovelace/resources/update') {
        resourceUpdates += 1
        return undefined
      }
      if (message.type === 'lovelace/config/save') throw saveError
      return undefined
    })

    await expect(syncDashboardDeployment({
      haToken: 'test-token',
      haUrl: 'https://ha.example',
      version: 'abc123',
    })).rejects.toBe(saveError)

    const updateCalls = mocks.sendMessagePromise.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'lovelace/resources/update')
    expect(resourceUpdates).toBe(2)
    expect(updateCalls.at(-1)).toEqual({
      res_type: 'module',
      resource_id: 'legacy-resource',
      type: 'lovelace/resources/update',
      url: inlineCardUrl,
    })
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('performs no mutation when the deployed card module fails preflight', async () => {
    mocks.assertDashboardResourceAvailable.mockRejectedValue(
      new Error('resource unavailable'),
    )
    mocks.sendMessagePromise.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'lovelace/config') return dashboardConfig()
      if (message.type === 'lovelace/resources') return resources()
      if (message.type === 'get_panels') return panels()
      throw new Error(`Unexpected mutation: ${message.type}`)
    })

    await expect(syncDashboardDeployment({
      haToken: 'test-token',
      haUrl: 'https://ha.example',
      version: 'abc123',
    })).rejects.toThrow('resource unavailable')
    expect(mocks.sendMessagePromise).toHaveBeenCalledTimes(3)
    expect(mocks.close).toHaveBeenCalledOnce()
  })
})
