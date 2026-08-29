import { expect, test, type Page } from '@playwright/test'
import {
  REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY,
  REACT_DASHBOARD_LIFECYCLE_PROPERTY,
} from '../src/lifecycle/reactDashboardLifecycle'

const SFENTON_REACT_APP_CARD_TAG = 'sfenton-react-app-card'
const SFENTON_REACT_PANEL_TAG = 'sfenton-react-panel'

interface LifecycleHostAudit {
  activeRouteListeners: Set<EventListenerOrEventListenerObject>
  supersededReason?: string
}

type LifecycleHostWindow = Window & {
  __lifecycleHostAudit: LifecycleHostAudit
  [REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY]?: string
  [REACT_DASHBOARD_LIFECYCLE_PROPERTY]?: {
    instanceId: string
    timeOrigin: number
  }
}

async function openLifecycleHost(page: Page, path: string, entryModule?: string) {
  await page.route(`**${path}`, async (route) => {
    await route.fulfill({
      body: `<!doctype html>
        <html>
          <head><title>Lifecycle host</title></head>
          <body>
            ${entryModule ? `<script type="module" src="${entryModule}"></script>` : ''}
          </body>
        </html>`,
      contentType: 'text/html',
      status: 200,
    })
  })
  await page.goto(path)
  await page.evaluate(({ lifecycleProperty }) => {
    const hostWindow = window as unknown as LifecycleHostWindow
    const activeRouteListeners = new Set<EventListenerOrEventListenerObject>()
    const addEventListener = window.addEventListener.bind(window)
    const removeEventListener = window.removeEventListener.bind(window)
    hostWindow.__lifecycleHostAudit = { activeRouteListeners }

    window.addEventListener = ((type, listener, options) => {
      if (type === 'dashboard-route-change' && listener) {
        activeRouteListeners.add(listener)
      }
      addEventListener(type, listener, options)
    }) as typeof window.addEventListener
    window.removeEventListener = ((type, listener, options) => {
      if (type === 'dashboard-route-change' && listener) {
        activeRouteListeners.delete(listener)
      }
      removeEventListener(type, listener, options)
    }) as typeof window.removeEventListener

    ;(hostWindow as unknown as Record<string, unknown>)[lifecycleProperty] = {
      dispose(reason?: string) {
        hostWindow.__lifecycleHostAudit.supersededReason = reason
        return true
      },
      instanceId: 'stale-instance',
      mountedAt: 0,
      timeOrigin: 0,
    }
  }, { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })
}

async function waitForMountedApp(page: Page) {
  await expect.poll(() => page.evaluate(({ lifecycleProperty }) => {
    const hostWindow = window as unknown as LifecycleHostWindow
    return {
      instanceId: hostWindow[lifecycleProperty]?.instanceId,
      listenerCount: hostWindow.__lifecycleHostAudit.activeRouteListeners.size,
      timeOrigin: hostWindow[lifecycleProperty]?.timeOrigin,
    }
  }, { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toMatchObject({
    instanceId: expect.any(String),
    listenerCount: expect.any(Number),
    timeOrigin: expect.any(Number),
  })
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as LifecycleHostWindow).__lifecycleHostAudit.activeRouteListeners.size
  ))).toBeGreaterThan(0)

  const snapshot = await page.evaluate(({ lifecycleProperty }) => {
    const hostWindow = window as unknown as LifecycleHostWindow
    return {
      instanceId: hostWindow[lifecycleProperty]?.instanceId ?? '',
      listenerCount: hostWindow.__lifecycleHostAudit.activeRouteListeners.size,
      timeOrigin: hostWindow[lifecycleProperty]?.timeOrigin ?? 0,
    }
  }, { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })
  expect(snapshot.listenerCount).toBeGreaterThan(0)
  return snapshot
}

async function expectDisposed(page: Page) {
  await expect.poll(() => page.evaluate(({ lifecycleProperty }) => {
    const hostWindow = window as unknown as LifecycleHostWindow
    return {
      hasRegistration: Boolean(hostWindow[lifecycleProperty]),
      listenerCount: hostWindow.__lifecycleHostAudit.activeRouteListeners.size,
    }
  }, { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toEqual({
    hasRegistration: false,
    listenerCount: 0,
  })
}

test('legacy wrapper disposal prevents lifecycle accumulation across replacements', async ({ page }) => {
  await openLifecycleHost(
    page,
    '/sfenton-react-dash/settings',
    '/sfenton-react-app-card.js',
  )
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), SFENTON_REACT_APP_CARD_TAG)

  const instanceIds = new Set<string>()
  const timeOrigins = new Set<number>()
  let mountedListenerCount = 0

  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.evaluate(({ tag }) => {
      const card = document.createElement(tag) as HTMLElement & {
        setConfig: (config: { url: string }) => void
      }
      card.dataset.lifecycleHost = 'true'
      card.setConfig({ url: '/index.html' })
      document.body.append(card)
    }, { tag: SFENTON_REACT_APP_CARD_TAG })

    const mounted = await waitForMountedApp(page)
    instanceIds.add(mounted.instanceId)
    timeOrigins.add(mounted.timeOrigin)
    mountedListenerCount ||= mounted.listenerCount
    expect(mounted.listenerCount).toBe(mountedListenerCount)

    await page.locator('[data-lifecycle-host="true"]').evaluate((element) => element.remove())
    await expectDisposed(page)
  }

  expect(instanceIds.size).toBe(5)
  expect(timeOrigins.size).toBe(5)
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as LifecycleHostWindow).__lifecycleHostAudit.supersededReason
  ))).toBe('superseded-by-new-instance')

  const history = await page.evaluate(({ historyProperty }) => JSON.parse(
    (window as unknown as LifecycleHostWindow)[historyProperty] ?? '[]',
  ), { historyProperty: REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY })
  expect(history.filter((entry: { event: string }) => entry.event === 'mounted')).toHaveLength(5)
  const disposals = history.filter((entry: { event: string }) => entry.event === 'disposed')
  expect(disposals).toHaveLength(5)
  for (const disposal of disposals) {
    expect(disposal.reason).toBe('pagehide')
  }
})

test('custom panel disposal prevents lifecycle accumulation across outer-frame replacements', async ({ page }) => {
  await openLifecycleHost(
    page,
    '/sfenton-react-panel?path=settings',
    '/sfenton-react-panel.js',
  )
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), SFENTON_REACT_PANEL_TAG)

  let mountedListenerCount = 0
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.evaluate(({ tag }) => {
      const panel = document.createElement(tag) as HTMLElement & {
        panel: {
          config: { app_url: string }
          title: string
        }
      }
      panel.dataset.lifecycleHost = 'true'
      panel.panel = {
        config: { app_url: '/index.html' },
        title: 'Lifecycle panel',
      }
      document.body.append(panel)
    }, { tag: SFENTON_REACT_PANEL_TAG })

    const mounted = await waitForMountedApp(page)
    mountedListenerCount ||= mounted.listenerCount
    expect(mounted.listenerCount).toBe(mountedListenerCount)

    await page.locator('[data-lifecycle-host="true"]').evaluate((element) => element.remove())
    await expectDisposed(page)
  }

  const history = await page.evaluate(({ historyProperty }) => JSON.parse(
    (window as unknown as LifecycleHostWindow)[historyProperty] ?? '[]',
  ), { historyProperty: REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY })
  expect(history.filter((entry: { event: string }) => entry.event === 'mounted')).toHaveLength(5)
  const disposals = history.filter((entry: { event: string }) => entry.event === 'disposed')
  expect(disposals).toHaveLength(5)
  for (const disposal of disposals) {
    expect(disposal.reason).toBe('pagehide')
  }
})

test('legacy replacements keep post-GC heap bounded', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'CDP heap measurements require Chromium.')
  await openLifecycleHost(
    page,
    '/sfenton-react-dash/settings',
    '/sfenton-react-app-card.js',
  )
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), SFENTON_REACT_APP_CARD_TAG)
  const cdp = await page.context().newCDPSession(page)

  const replaceApp = async () => {
    await page.evaluate(({ tag }) => {
      const card = document.createElement(tag) as HTMLElement & {
        setConfig: (config: { url: string }) => void
      }
      card.dataset.lifecycleHost = 'true'
      card.setConfig({ url: '/index.html' })
      document.body.append(card)
    }, { tag: SFENTON_REACT_APP_CARD_TAG })
    await waitForMountedApp(page)
    await page.locator('[data-lifecycle-host="true"]').evaluate((element) => element.remove())
    await expectDisposed(page)
  }

  await replaceApp()
  await replaceApp()
  await cdp.send('HeapProfiler.collectGarbage')
  const baseline = await cdp.send('Runtime.getHeapUsage')

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await replaceApp()
  }

  await cdp.send('HeapProfiler.collectGarbage')
  const final = await cdp.send('Runtime.getHeapUsage')
  expect(final.usedSize - baseline.usedSize).toBeLessThan(12 * 1024 * 1024)
})

test('a new frame disposes a detached prior generation when pagehide is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const addEventListener = window.addEventListener.bind(window)
    window.addEventListener = ((type, listener, options) => {
      if (window.top !== window && type === 'pagehide') return
      addEventListener(type, listener, options)
    }) as typeof window.addEventListener
  })
  await openLifecycleHost(page, '/sfenton-react-dash/settings')

  const mountRawApp = async (previousInstanceId?: string) => {
    await page.evaluate(() => {
      const iframe = document.createElement('iframe')
      iframe.dataset.lifecycleRawFrame = 'true'
      iframe.src = '/index.html'
      document.body.append(iframe)
    })
    if (previousInstanceId) {
      await expect.poll(() => page.evaluate(({ lifecycleProperty }) => (
        (window as unknown as LifecycleHostWindow)[lifecycleProperty]?.instanceId
      ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).not.toBe(previousInstanceId)
    }
    return waitForMountedApp(page)
  }

  const first = await mountRawApp()
  await page.locator('[data-lifecycle-raw-frame="true"]').evaluate((iframe) => iframe.remove())
  await expect.poll(() => page.evaluate(({ lifecycleProperty }) => Boolean(
    (window as unknown as LifecycleHostWindow)[lifecycleProperty],
  ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toBe(true)

  const second = await mountRawApp(first.instanceId)
  expect(second.instanceId).not.toBe(first.instanceId)
  expect(second.listenerCount).toBe(first.listenerCount)

  await page.locator('[data-lifecycle-raw-frame="true"]').evaluate((iframe) => iframe.remove())
  await page.evaluate(({ lifecycleProperty }) => {
    const registration = (window as unknown as LifecycleHostWindow)[lifecycleProperty] as {
      dispose: (reason?: string) => boolean
    }
    registration.dispose('test-final-cleanup')
  }, { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })
  await expectDisposed(page)

  const history = await page.evaluate(({ historyProperty }) => JSON.parse(
    (window as unknown as LifecycleHostWindow)[historyProperty] ?? '[]',
  ), { historyProperty: REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY })
  expect(history).toContainEqual(expect.objectContaining({
    event: 'disposed',
    instanceId: first.instanceId,
    reason: 'superseded-by-new-instance',
  }))
  expect(history).toContainEqual(expect.objectContaining({
    event: 'disposed',
    instanceId: second.instanceId,
    reason: 'test-final-cleanup',
  }))
})
