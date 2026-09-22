import { expect, test, type Page } from './layout/fixture'
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
  await page.route(`**${path.split('#', 1)[0]}`, async (route) => {
    await route.fulfill({
      body: `<!doctype html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
            <title>Lifecycle host</title>
          </head>
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

async function currentReactDashboardFrame(page: Page) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => (
      candidate.url().includes('/index.html')
    ))
    if (frame) return frame
    await page.waitForTimeout(100)
  }
  throw new Error('React dashboard iframe was not created.')
}

const notificationHosts = [
  { name: 'legacy', path: '/sfenton-react-dash/home', module: '/sfenton-react-app-card.js', tag: SFENTON_REACT_APP_CARD_TAG },
  { name: 'panel', path: '/sfenton-react-panel', module: '/sfenton-react-panel.js', tag: SFENTON_REACT_PANEL_TAG },
] as const

async function mountNotificationHost(page: Page, host: typeof notificationHosts[number], route: string) {
  await openLifecycleHost(page, `${host.path}?path=${route}`, host.module)
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), host.tag)
  await page.evaluate(({ tag, name }) => {
    const element = document.createElement(tag) as HTMLElement & {
      setConfig?: (value: { url: string }) => void
      panel?: { config: { app_url: string }; title: string }
    }
    if (name === 'legacy') element.setConfig!({ url: '/index.html' })
    else element.panel = { config: { app_url: '/index.html' }, title: 'React Dash Panel' }
    document.body.append(element)
  }, host)
  return currentReactDashboardFrame(page)
}

for (const host of notificationHosts) {
  test(`${host.name} notification landing opens Security without a camera modal`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    const frame = await mountNotificationHost(page, host, 'security')
    await expect(frame.getByRole('heading', { name: 'Security', exact: true }).first()).toBeVisible()
    await expect(frame.getByRole('dialog')).toHaveCount(0)
    await page.setViewportSize({ width: 852, height: 393 })
    await expect(frame.getByRole('heading', { name: 'Security', exact: true }).first()).toBeVisible()
    await expect(frame.getByRole('dialog')).toHaveCount(0)
  })

  test(`${host.name} warm notification landing handles the HA navigation event`, async ({ page }) => {
    const frame = await mountNotificationHost(page, host, 'overview#camera-front-door')
    await expect(frame.getByRole('dialog')).toBeVisible()
    const timeOrigin = await frame.evaluate(() => performance.timeOrigin)
    await page.evaluate((path) => {
      window.history.pushState({}, '', `${path}?path=security`)
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }))
    }, host.path)
    await expect(frame.getByRole('heading', { name: 'Security', exact: true }).first()).toBeVisible()
    await expect(frame.getByRole('dialog')).toHaveCount(0)
    expect(await frame.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
    expect(await frame.evaluate(() => (
      (window as unknown as { __mockHass: { calls: { domain: string }[] } }).__mockHass.calls
        .filter((call) => call.domain === 'lock').length
    ))).toBe(0)
  })
}

test('notification landing remains correct on tablet and fine-pointer desktop', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, isMobile: false, hasTouch: false })
  const page = await context.newPage()
  try {
    for (const viewport of [
      { width: 820, height: 1180 }, { width: 1180, height: 820 },
      { width: 1440, height: 900 }, { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport)
      for (const host of notificationHosts) {
        const frame = await mountNotificationHost(page, host, 'security')
        await expect(frame.getByRole('heading', { name: 'Security', exact: true }).first()).toBeVisible()
        await expect(frame.getByRole('dialog')).toHaveCount(0)
        expect(await frame.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true)
      }
    }
  } finally {
    await context.close()
  }
})

test('legacy wrapper preserves one lifecycle across reconnect replacements', async ({ page }) => {
  await openLifecycleHost(
    page,
    '/sfenton-react-dash/home',
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
  }

  expect(instanceIds.size).toBe(1)
  expect(timeOrigins.size).toBe(1)
  await page.waitForTimeout(5_100)
  await expectDisposed(page)
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as LifecycleHostWindow).__lifecycleHostAudit.supersededReason
  ))).toBe('superseded-by-new-instance')

  const history = await page.evaluate(({ historyProperty }) => JSON.parse(
    (window as unknown as LifecycleHostWindow)[historyProperty] ?? '[]',
  ), { historyProperty: REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY })
  expect(history.filter((entry: { event: string }) => entry.event === 'mounted')).toHaveLength(1)
  const disposals = history.filter((entry: { event: string }) => entry.event === 'disposed')
  expect(disposals).toHaveLength(1)
  expect(disposals[0].reason).toBe('legacy-card-disconnected')
})

test('custom panel preserves one lifecycle across outer-frame replacements', async ({ page }) => {
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
  }

  await page.waitForTimeout(5_100)
  await expectDisposed(page)
  const history = await page.evaluate(({ historyProperty }) => JSON.parse(
    (window as unknown as LifecycleHostWindow)[historyProperty] ?? '[]',
  ), { historyProperty: REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY })
  expect(history.filter((entry: { event: string }) => entry.event === 'mounted')).toHaveLength(1)
  const disposals = history.filter((entry: { event: string }) => entry.event === 'disposed')
  expect(disposals).toHaveLength(1)
  expect(disposals[0].reason).toBe('panel-host-disconnected')
})

test('custom panel keeps its persistent iframe inside the native panel viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLifecycleHost(
    page,
    '/sfenton-react-panel?path=settings',
    '/sfenton-react-panel.js',
  )
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), SFENTON_REACT_PANEL_TAG)
  await page.evaluate(({ tag }) => {
    const panel = document.createElement(tag) as HTMLElement & {
      panel: {
        config: { app_url: string }
        title: string
      }
    }
    panel.dataset.lifecycleHost = 'true'
    panel.style.left = '256px'
    panel.style.width = 'calc(100vw - 256px)'
    panel.panel = {
      config: { app_url: '/index.html' },
      title: 'Lifecycle panel',
    }
    document.body.append(panel)
  }, { tag: SFENTON_REACT_PANEL_TAG })

  const iframe = page.locator('iframe[data-sfenton-react-panel-frame="true"]')
  await expect(iframe).toHaveCSS('left', '256px')
  await expect(iframe).toHaveCSS('width', '1184px')
  await expect(iframe).toHaveCSS('height', '900px')
  const mounted = await waitForMountedApp(page)

  await page.setViewportSize({ width: 852, height: 393 })
  await page.locator('[data-lifecycle-host="true"]').evaluate((element) => {
    const panel = element as HTMLElement
    panel.style.left = '0'
    panel.style.width = '100vw'
  })

  await expect(iframe).toHaveCSS('left', '0px')
  await expect(iframe).toHaveCSS('width', '852px')
  await expect(iframe).toHaveCSS('height', '393px')
  expect((await waitForMountedApp(page)).timeOrigin).toBe(mounted.timeOrigin)
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

test('a recreated non-Home legacy frame navigates Home without another loader', async ({ page }) => {
  await openLifecycleHost(
    page,
    '/sfenton-react-dash/settings',
    '/sfenton-react-app-card.js',
  )
  await page.waitForFunction((tag) => Boolean(customElements.get(tag)), SFENTON_REACT_APP_CARD_TAG)

  const mountCard = async () => {
    await page.evaluate(({ tag }) => {
      const card = document.createElement(tag) as HTMLElement & {
        setConfig: (config: { url: string }) => void
      }
      card.dataset.lifecycleHost = 'true'
      card.setConfig({ url: '/index.html' })
      document.body.append(card)
    }, { tag: SFENTON_REACT_APP_CARD_TAG })
    const frame = await currentReactDashboardFrame(page)
    await frame.getByRole('heading', { name: 'Settings', exact: true }).waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    return frame
  }

  await mountCard()
  await page.locator('[data-lifecycle-host="true"]').evaluate((element) => element.remove())
  await expectDisposed(page)
  const frame = await mountCard()
  const initialTimeOrigin = await frame.evaluate(() => performance.timeOrigin)
  const initialLifecycleId = await page.evaluate(({ lifecycleProperty }) => (
    (window as unknown as LifecycleHostWindow)[lifecycleProperty]?.instanceId
  ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })
  const requests: string[] = []
  page.on('request', (request) => {
    if (/\/(?:index\.html|assets\/app-[^/]+\.js)(?:\?|$)/.test(request.url())) {
      requests.push(request.url())
    }
  })
  await frame.evaluate(() => {
    const audit = { headerMissing: false, loaderSeen: false, running: true }
    ;(window as unknown as { __recreatedHomeAudit: typeof audit }).__recreatedHomeAudit = audit
    const sample = () => {
      audit.headerMissing ||= !document.querySelector('[data-page-header="true"]')
      audit.loaderSeen ||= Boolean(document.querySelector(
        '[role="status"][aria-label="Loading Home dashboard content"]',
      ))
      if (audit.running) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  await frame.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', {
    name: 'Home',
    exact: true,
  }).click()
  await frame.getByRole('heading', { name: 'Home', exact: true }).waitFor({
    state: 'visible',
    timeout: 1_000,
  })
  const audit = await frame.evaluate(() => {
    const current = (window as unknown as {
      __recreatedHomeAudit: {
        headerMissing: boolean
        loaderSeen: boolean
        running: boolean
      }
    }).__recreatedHomeAudit
    current.running = false
    return current
  })

  expect(audit).toMatchObject({
    headerMissing: false,
    loaderSeen: false,
  })
  expect(await frame.evaluate(() => performance.timeOrigin)).toBe(initialTimeOrigin)
  expect(await page.evaluate(({ lifecycleProperty }) => (
    (window as unknown as LifecycleHostWindow)[lifecycleProperty]?.instanceId
  ), { lifecycleProperty: REACT_DASHBOARD_LIFECYCLE_PROPERTY })).toBe(initialLifecycleId)
  expect(requests).toEqual([])
})
