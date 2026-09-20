import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  acquireProductionLease,
  assertProductionLease,
  captureReleaseConfiguration,
  ciProductionOptionsFromEnvironment,
  readHomeAssistantProductionMetadata,
  reconcileAssetSwap,
  RELEASE_CONFIGURATION_PATHS,
  restoreReleaseConfiguration,
  restoreHomeAssistantProductionMetadata,
  releaseProductionLease,
  stageReleaseConfiguration,
} from './productionHomeAssistant'

function panel() {
  return {
    'sfenton-react-panel': {
      component_name: 'custom',
      config: {
        _panel_custom: {
          name: 'sfenton-react-panel',
          embed_iframe: true,
        },
      },
    },
  }
}

function connection() {
  const legacyDashboardConfig = {
    views: [
      {
        cards: [
          {
            type: 'custom:sfenton-react-app-card',
            url: '/local/ha-sfenton-react-dash/index.html?v=before',
          },
        ],
      },
    ],
  }
  const sendMessagePromise = vi.fn(async (message: { type: string }) => {
    if (message.type === 'lovelace/config') return legacyDashboardConfig
    if (message.type === 'lovelace/resources') {
      return [
        {
          id: 'resource-id',
          type: 'module',
          url: '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=before',
        },
      ]
    }
    if (message.type === 'get_panels') return panel()
    return undefined
  })
  return { sendMessagePromise, legacyDashboardConfig }
}

function scp(initialFiles: Record<string, string> = {}) {
  const directories = new Set<string>()
  const files = new Map(
    Object.entries(initialFiles).map(([path, content]) => [
      path,
      Buffer.from(content),
    ]),
  )
  return {
    files,
    directories,
    exists: vi.fn(async (path: string) =>
      files.has(path) || directories.has(path),
    ),
    mkdir: vi.fn(async (path: string) => {
      if (directories.has(path) && path.includes('.release-lock')) {
        throw new Error(`Directory exists: ${path}`)
      }
      directories.add(path)
    }),
    readFile: vi.fn(async (path: string) => {
      const content = files.get(path)
      if (!content) throw new Error(`Missing fake SCP file ${path}`)
      return content
    }),
    unlink: vi.fn(async (path: string) => {
      files.delete(path)
    }),
    rmdir: vi.fn(async (path: string) => {
      directories.delete(path)
    }),
    rename: vi.fn(async (source: string, destination: string) => {
      directories.delete(source)
      directories.add(destination)
    }),
    writeFile: vi.fn(async (path: string, content: string | Buffer) => {
      files.set(path, Buffer.from(content))
    }),
  }
}

describe('Home Assistant production metadata adapter', () => {
  it('builds CI deployment options only from non-Vite deployment variables', () => {
    const options = ciProductionOptionsFromEnvironment(
      {
        HA_DEPLOY_FOLDER_NAME: 'ha-sfenton-react-dash',
        HA_DEPLOY_SSH_HOST: 'ha-ssh-proxy',
        HA_DEPLOY_SSH_HOST_KEY_SHA256: 'a'.repeat(64),
        HA_DEPLOY_SSH_PORT: '2222',
        HA_DEPLOY_SSH_PRIVATE_KEY: 'private-key',
        HA_DEPLOY_SSH_USERNAME: 'root',
        HA_DEPLOY_TOKEN: 'token',
        HA_DEPLOY_URL: 'http://ha-api-proxy:8123',
        VITE_HA_TOKEN: 'must-not-be-used',
      },
      '/tmp/verify',
      'run-1',
      'b'.repeat(64),
    )

    expect(options).toMatchObject({
      authorizationHash: 'b'.repeat(64),
      haToken: 'token',
      haUrl: 'http://ha-api-proxy:8123',
      host: 'ha-ssh-proxy',
      port: 2222,
      remoteFolderName: 'ha-sfenton-react-dash',
      scopePaths: [],
      username: 'root',
      verificationDirectory: '/tmp/verify',
      workflowId: 'run-1',
    })
    expect(options.privateKey?.toString()).toBe('private-key')
  })

  it('rejects an unpinned CI SSH connection', () => {
    expect(() =>
      ciProductionOptionsFromEnvironment(
        {
          HA_DEPLOY_SSH_PRIVATE_KEY: 'private-key',
          HA_DEPLOY_TOKEN: 'token',
          HA_DEPLOY_URL: 'http://ha-api-proxy:8123',
        },
        '/tmp/verify',
        'run-1',
        'b'.repeat(64),
      ),
    ).toThrow('HA_DEPLOY_SSH_HOST_KEY_SHA256')
  })

  it('captures the exact wrapper, card resource, panel, and restore payload', async () => {
    const fake = connection()
    await expect(
      readHomeAssistantProductionMetadata(fake),
    ).resolves.toEqual({
      legacyWrapperUrl:
        '/local/ha-sfenton-react-dash/index.html?v=before',
      legacyCardResourceUrl:
        '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=before',
      panelRegistered: true,
      restoreState: {
        legacyDashboardConfig: fake.legacyDashboardConfig,
        legacyCardResourceId: 'resource-id',
      },
    })
  })

  it('captures, stages only authorized paths, and restores exact configuration files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'release-ha-config-'))
    const existingPath = RELEASE_CONFIGURATION_PATHS[0]
    const newPath = RELEASE_CONFIGURATION_PATHS[1]
    const remoteExisting = `/config/${existingPath}`
    const remoteNew = `/config/${newPath}`
    const fake = scp({ [remoteExisting]: 'before' })
    try {
      const capture = await captureReleaseConfiguration(fake, '/config')
      expect(
        capture.find((file) => file.path === existingPath),
      ).toMatchObject({
        existed: true,
        contentBase64: Buffer.from('before').toString('base64'),
      })
      expect(capture.find((file) => file.path === newPath)).toMatchObject({
        existed: false,
      })

      await mkdir(join(root, 'home-assistant', 'packages'), {
        recursive: true,
      })
      await writeFile(
        join(root, 'home-assistant', existingPath),
        'after-existing',
      )
      await writeFile(join(root, 'home-assistant', newPath), 'after-new')
      await expect(
        stageReleaseConfiguration(fake, '/config', root, [
          `home-assistant/${newPath}`,
        ]),
      ).resolves.toBe(1)
      expect(fake.files.get(remoteExisting)?.toString()).toBe('before')
      expect(fake.files.get(remoteNew)?.toString()).toBe('after-new')

      await restoreReleaseConfiguration(fake, '/config', capture)
      expect(fake.files.get(remoteExisting)?.toString()).toBe('before')
      expect(fake.files.has(remoteNew)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('restores the exact resource and dashboard configuration before verifying', async () => {
    const fake = connection()
    const metadata = await readHomeAssistantProductionMetadata(fake)
    fake.sendMessagePromise.mockClear()
    await restoreHomeAssistantProductionMetadata(fake, metadata)
    expect(fake.sendMessagePromise).toHaveBeenCalledWith({
      type: 'lovelace/resources/update',
      resource_id: 'resource-id',
      res_type: 'module',
      url: metadata.legacyCardResourceUrl,
    })
    expect(fake.sendMessagePromise).toHaveBeenCalledWith({
      type: 'lovelace/config/save',
      url_path: 'sfenton-react-dash',
      config: fake.legacyDashboardConfig,
    })
  })

  it('serializes production workflows with an expiring durable lease', async () => {
    const fake = scp()
    const first = {
      workflowId: 'release-first',
      authorizationHash: 'a'.repeat(64),
    }
    const second = {
      workflowId: 'release-second',
      authorizationHash: 'b'.repeat(64),
    }
    const now = Date.parse('2026-09-10T12:00:00.000Z')
    await acquireProductionLease(fake, '/config', first, now)
    await expect(
      assertProductionLease(fake, '/config', first, now),
    ).resolves.toBeUndefined()
    await expect(
      acquireProductionLease(fake, '/config', second, now),
    ).rejects.toThrow('held by workflow release-first')

    await releaseProductionLease(fake, '/config', first, now)
    await expect(
      acquireProductionLease(fake, '/config', second, now),
    ).resolves.toBeUndefined()
  })

  it('blocks automatic takeover of an expired foreign production lease', async () => {
    const fake = scp()
    const holder = {
      workflowId: 'release-holder',
      authorizationHash: 'c'.repeat(64),
    }
    const contender = {
      workflowId: 'release-contender',
      authorizationHash: 'd'.repeat(64),
    }
    const now = Date.parse('2026-09-10T12:00:00.000Z')
    await acquireProductionLease(fake, '/config', holder, now)
    const ownerPath =
      '/config/www/.ha-sfenton-react-dash.release-lock/owner.json'
    fake.files.set(
      ownerPath,
      Buffer.from(
        JSON.stringify({
          version: 1,
          workflowId: holder.workflowId,
          authorizationHash: holder.authorizationHash,
          expiresAt: new Date(now - 60_000).toISOString(),
        }),
      ),
    )
    await expect(
      acquireProductionLease(fake, '/config', contender, now),
    ).rejects.toThrow('expired under foreign workflow')
  })

  it('restores the prior asset directory after an interrupted swap', async () => {
    const fake = scp()
    const paths = {
      remote: '/config/www/ha-sfenton-react-dash',
      incoming:
        '/config/www/ha-sfenton-react-dash.release-incoming-workflow',
      previous:
        '/config/www/ha-sfenton-react-dash.release-previous-workflow',
      completed:
        '/config/www/ha-sfenton-react-dash.release-completed-workflow.json',
    }
    fake.directories.add(paths.previous)
    fake.directories.add(paths.incoming)
    await reconcileAssetSwap(fake, paths)
    expect(fake.directories.has(paths.remote)).toBe(true)
    expect(fake.directories.has(paths.previous)).toBe(false)
    expect(fake.directories.has(paths.incoming)).toBe(false)
  })

  it('keeps a completed asset swap intact for verification and finalization', async () => {
    const paths = {
      remote: '/config/www/ha-sfenton-react-dash',
      incoming:
        '/config/www/ha-sfenton-react-dash.release-incoming-workflow',
      previous:
        '/config/www/ha-sfenton-react-dash.release-previous-workflow',
      completed:
        '/config/www/ha-sfenton-react-dash.release-completed-workflow.json',
    }
    const fake = scp({ [paths.completed]: '{}' })
    fake.directories.add(paths.remote)
    fake.directories.add(paths.previous)
    await expect(reconcileAssetSwap(fake, paths)).resolves.toBe(true)
    expect(fake.directories.has(paths.remote)).toBe(true)
    expect(fake.directories.has(paths.previous)).toBe(true)
    expect(fake.files.has(paths.completed)).toBe(true)
  })
})
