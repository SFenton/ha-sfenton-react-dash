import { expect, test } from '@playwright/test'
import { REACT_DASHBOARD_LIFECYCLE_PROPERTY } from '../src/lifecycle/reactDashboardLifecycle'

interface FakeConnectionAudit {
  activeSubscriptions: number
  addedSubscriptions: number
  readyListeners: number
  removedSubscriptions: number
}

type FakeConnectionHostWindow = Window & {
  __fakeConnectionAudit: () => FakeConnectionAudit
  [REACT_DASHBOARD_LIFECYCLE_PROPERTY]?: {
    instanceId: string
  }
}

test('real HAKit subscriptions remain balanced across iframe replacement', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_REAL_HAKIT !== '1', 'Requires the real HAKit Vite server.')

  const hostPath = '/sfenton-react-dash/settings'
  await page.route(`**${hostPath}`, async (route) => {
    await route.fulfill({
      body: '<!doctype html><html><head><title>HAKit lifecycle host</title></head><body></body></html>',
      contentType: 'text/html',
      status: 200,
    })
  })
  await page.goto(hostPath)
  await page.evaluate(() => {
    let nextSubscriptionId = 0
    let addedSubscriptions = 0
    let removedSubscriptions = 0
    const activeSubscriptions = new Map<number, string>()
    const connectionListeners = new Map<string, Set<(...args: unknown[]) => void>>()

    const responseFor = (message: { type?: string }) => {
      switch (message.type) {
        case 'auth/current_user':
          return {
            credentials: [],
            id: 'test-user',
            is_active: true,
            is_admin: true,
            is_owner: true,
            mfa_modules: [],
            name: 'Test User',
            system_generated: false,
          }
        case 'config/area_registry/list':
        case 'config/auth/list':
        case 'config/device_registry/list':
        case 'config/floor_registry/list':
          return []
        case 'config/entity_registry/list_for_display':
          return { entities: [], entity_categories: {} }
        case 'get_config':
          return {
            allowlist_external_dirs: [],
            allowlist_external_urls: [],
            components: [],
            config_dir: '/config',
            country: 'US',
            currency: 'USD',
            elevation: 0,
            internal_url: null,
            language: 'en',
            latitude: 0,
            location_name: 'Test Home',
            longitude: 0,
            safe_mode: false,
            state: 'RUNNING',
            time_zone: 'UTC',
            unit_system: {
              accumulated_precipitation: 'in',
              length: 'mi',
              mass: 'lb',
              pressure: 'psi',
              temperature: '°F',
              volume: 'gal',
              wind_speed: 'mph',
            },
            version: '2026.8.2',
          }
        case 'get_services':
          return {}
        case 'sensor/numeric_device_classes':
          return { numeric_device_classes: [] }
        default:
          return []
      }
    }

    const subscribe = (
      callback: (value: unknown) => void,
      type: string,
      initialValue?: unknown,
    ) => {
      const id = ++nextSubscriptionId
      addedSubscriptions += 1
      activeSubscriptions.set(id, type)
      if (initialValue !== undefined) {
        queueMicrotask(() => {
          if (activeSubscriptions.has(id)) callback(initialValue)
        })
      }
      return Promise.resolve(() => {
        if (activeSubscriptions.delete(id)) removedSubscriptions += 1
      })
    }

    const connection = {
      addEventListener(type: string, callback: (...args: unknown[]) => void) {
        const callbacks = connectionListeners.get(type) ?? new Set()
        callbacks.add(callback)
        connectionListeners.set(type, callbacks)
      },
      connected: true,
      eventListeners: connectionListeners,
      haVersion: '2026.8.2',
      removeEventListener(type: string, callback: (...args: unknown[]) => void) {
        connectionListeners.get(type)?.delete(callback)
      },
      sendMessage() {
        return undefined
      },
      sendMessagePromise(message: { type?: string }) {
        return Promise.resolve(responseFor(message))
      },
      subscribeEvents(callback: (value: unknown) => void, eventType?: string) {
        return subscribe(callback, `event:${eventType ?? '*'}`)
      },
      subscribeMessage(callback: (value: unknown) => void, message: { type?: string }) {
        const initialValue = message.type === 'subscribe_entities'
          ? { a: {} }
          : message.type === 'frontend/subscribe_user_data'
            ? { value: undefined }
            : undefined
        return subscribe(callback, message.type ?? 'message', initialValue)
      },
    }

    ;(window as unknown as {
      hassConnection: Promise<{ auth: Record<string, never>; conn: typeof connection }>
    }).hassConnection = Promise.resolve({ auth: {}, conn: connection })
    ;(window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit = () => ({
      activeSubscriptions: activeSubscriptions.size,
      addedSubscriptions,
      readyListeners: connectionListeners.get('ready')?.size ?? 0,
      removedSubscriptions,
    })
  })

  const mountApp = async () => {
    await page.evaluate(() => {
      const iframe = document.createElement('iframe')
      iframe.dataset.realHakitLifecycle = 'true'
      iframe.src = '/index.html'
      document.body.append(iframe)
    })
    await expect.poll(() => page.evaluate(({ lifecycleProperty }) => Boolean(
      (window as unknown as FakeConnectionHostWindow)[lifecycleProperty],
    ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toBe(true)
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit()
    ))).toMatchObject({
      activeSubscriptions: expect.any(Number),
    })
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit().activeSubscriptions
    ))).toBeGreaterThan(5)
    return page.evaluate(() => (
      (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit()
    ))
  }

  const first = await mountApp()
  const mountedSubscriptionCount = first.activeSubscriptions
  const mountedReadyListenerCount = first.readyListeners

  for (let cycle = 0; cycle < 4; cycle += 1) {
    await page.locator('[data-real-hakit-lifecycle="true"]').evaluate((iframe) => iframe.remove())
    await expect.poll(() => page.evaluate(({ lifecycleProperty }) => Boolean(
      (window as unknown as FakeConnectionHostWindow)[lifecycleProperty],
    ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toBe(false)

    await mountApp()
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit().activeSubscriptions
    ))).toBe(mountedSubscriptionCount)
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit().readyListeners
    ))).toBe(mountedReadyListenerCount)
  }

  await page.locator('[data-real-hakit-lifecycle="true"]').evaluate((iframe) => iframe.remove())
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit().activeSubscriptions
  )), { timeout: 8_000 }).toBe(0)
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit().readyListeners
  )), { timeout: 8_000 }).toBe(0)

  const finalAudit = await page.evaluate(() => (
    (window as unknown as FakeConnectionHostWindow).__fakeConnectionAudit()
  ))
  expect(finalAudit.removedSubscriptions).toBe(finalAudit.addedSubscriptions)
})
