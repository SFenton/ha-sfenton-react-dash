import {
  finalizeIosTestAssets,
  rollbackIosTestAssets,
  swapIosTestAssets,
  syncIosTestDashboard,
} from './deploy-ios-test-dashboard'

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    icon: 'mdi:cellphone-cog',
    id: 'test-dashboard-id',
    mode: 'storage',
    require_admin: true,
    show_in_sidebar: false,
    title: 'React Dash iOS Test',
    url_path: 'sfenton-react-ios-test',
    ...overrides,
  }
}

function expectedConfig(version = 'abc123') {
  return expect.objectContaining({
    views: [expect.objectContaining({
      cards: [expect.objectContaining({
        url: `/local/ha-sfenton-react-dash-ios-test/index.html?v=${version}`,
      })],
    })],
  })
}

describe('iOS test dashboard deployment', () => {
  it('creates and verifies the hidden dashboard', async () => {
    let savedConfig: unknown
    let dashboards: unknown[] = []
    const sendMessagePromise = vi.fn(async (message: Record<string, unknown>) => {
      if (message.type === 'lovelace/dashboards/list') return dashboards
      if (message.type === 'lovelace/dashboards/create') {
        const created = dashboard()
        dashboards = [created]
        return created
      }
      if (message.type === 'lovelace/config/save') {
        savedConfig = message.config
        return undefined
      }
      if (message.type === 'lovelace/config') return savedConfig
      throw new Error(`Unexpected message: ${String(message.type)}`)
    })

    await expect(syncIosTestDashboard({ sendMessagePromise }, 'abc123')).resolves.toMatchObject({
      show_in_sidebar: false,
      url_path: 'sfenton-react-ios-test',
    })
    expect(savedConfig).toEqual(expectedConfig())
  })

  it('refuses to take over a dashboard it does not own', async () => {
    const sendMessagePromise = vi.fn(async () => [dashboard({ title: 'Someone Else' })])

    await expect(syncIosTestDashboard({ sendMessagePromise }, 'abc123')).rejects.toThrow(
      'Refusing to take ownership',
    )
    expect(sendMessagePromise).toHaveBeenCalledOnce()
  })

  it('deletes a newly created dashboard when saving its config fails', async () => {
    const messages: Record<string, unknown>[] = []
    const sendMessagePromise = vi.fn(async (message: Record<string, unknown>) => {
      messages.push(message)
      if (message.type === 'lovelace/dashboards/list') return []
      if (message.type === 'lovelace/dashboards/create') return dashboard()
      if (message.type === 'lovelace/config/save') throw new Error('save failed')
      if (message.type === 'lovelace/dashboards/delete') return undefined
      throw new Error(`Unexpected message: ${String(message.type)}`)
    })

    await expect(syncIosTestDashboard({ sendMessagePromise }, 'abc123')).rejects.toThrow('save failed')
    expect(messages.at(-1)).toEqual({
      dashboard_id: 'test-dashboard-id',
      type: 'lovelace/dashboards/delete',
    })
  })

  it('atomically swaps, finalizes, and rolls back isolated assets', async () => {
    const paths = new Set(['/config/www/ha-sfenton-react-dash-ios-test'])
    const client = {
      exists: vi.fn(async (path: string) => paths.has(path)),
      rename: vi.fn(async (source: string, destination: string) => {
        paths.delete(source)
        paths.add(destination)
      }),
      rmdir: vi.fn(async (path: string) => {
        paths.delete(path)
      }),
      uploadDir: vi.fn(async (_source: string, destination: string) => {
        paths.add(destination)
      }),
    }

    const firstSwap = await swapIosTestAssets(
      client,
      '/local/assets',
      '/config/www/ha-sfenton-react-dash-ios-test',
      'abc123',
    )
    expect(paths.has(firstSwap.remote)).toBe(true)
    expect(paths.has(firstSwap.previous)).toBe(true)
    await finalizeIosTestAssets(client, firstSwap)
    expect(paths.has(firstSwap.previous)).toBe(false)

    const secondSwap = await swapIosTestAssets(
      client,
      '/local/assets',
      '/config/www/ha-sfenton-react-dash-ios-test',
      'def456',
    )
    await rollbackIosTestAssets(client, secondSwap)
    expect(paths.has(secondSwap.remote)).toBe(true)
    expect(paths.has(secondSwap.previous)).toBe(false)
  })
})
