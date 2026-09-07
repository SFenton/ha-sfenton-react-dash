import { test as base, expect, type BrowserContext, type BrowserContextOptions } from '@playwright/test'
import { resolve } from 'node:path'
import { readJson } from '../../scripts/layout/shared'
import type { RunIdentity } from './types'

export { expect, devices } from '@playwright/test'
export type { Browser, BrowserContext, CDPSession, Frame, FrameLocator, Locator, Page, TestInfo } from '@playwright/test'

const guardedContexts = new WeakSet<BrowserContext>()

export function assertGuardedContext(context: BrowserContext) {
  if (!guardedContexts.has(context)) throw new Error('Layout isolation was not installed on the actual Playwright context')
}

export function networkDecision(raw: string, method: string, origins: readonly string[]) {
  try {
    const url = new URL(raw)
    let pathname = url.pathname
    for (let pass = 0; pass < 3; pass += 1) pathname = decodeURIComponent(pathname)
    if (url.username || url.password || !['GET', 'HEAD'].includes(method)) return 'deny'
    // Reserved mock origin never goes onto the network; unavailable media is an explicit fixture.
    if (url.hostname === 'mock-hass.local' && ['http:', 'https:'].includes(url.protocol)) return 'mock'
    if (!origins.includes(url.origin) || !['http:', 'https:'].includes(url.protocol)) return 'deny'
    if (/^\/(?:api|local|webrtc|hacsfiles|__evershelf)(?:\/|$)|^\/assets\/valetudo(?:\/|$)/i.test(pathname)) return 'deny'
    return 'allow'
  } catch { return 'deny' }
}

export async function guardContext(context: BrowserContext, origins: string[], violations: string[]) {
  await context.route('**/*', async (route) => {
    const request = route.request()
    const requestedUrl = new URL(request.url())
    const decision = networkDecision(request.url(), request.method(), origins)
    if (origins.includes(requestedUrl.origin) && request.method() === 'GET' && requestedUrl.pathname === '/webrtc/webrtc-camera.js') {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `if (!customElements.get('webrtc-camera-sfenton')) {
          customElements.define('webrtc-camera-sfenton', class extends HTMLElement {
            setConfig() {}
            connectedCallback() { this.dataset.layoutMockCamera = 'true'; this.style.cssText = 'display:block;width:100%;height:100%'; }
          });
        }`,
      })
      return
    }
    if (request.resourceType() === 'image' && decision !== 'allow') {
      // Layout fixtures substitute images locally; they never certify photographic/media fidelity.
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g"><stop stop-color="#182332"/><stop offset="1" stop-color="#394d54"/></linearGradient></defs><path fill="url(#g)" d="M0 0h600v400H0z"/></svg>',
      })
      return
    }
    if (decision === 'allow') return route.continue()
    if (decision === 'mock') return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Mock media unavailable; no upstream request' })
    const url = new URL(request.url())
    violations.push(`HTTP blocked: ${request.method()} ${url.origin}${url.pathname}`)
    await route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', (socket) => {
    const url = new URL(socket.url())
    if (url.hostname !== 'mock-hass.local') violations.push(`WebSocket blocked: ${url.origin}${url.pathname}`)
    socket.close()
  })
  await context.exposeBinding('__layoutWorkerAttempt', (_source, kind?: string) => {
    violations.push(kind === 'service-worker' ? 'ServiceWorker registration blocked' : 'Worker/SharedWorker construction blocked')
  })
  await context.addInitScript(() => {
    const globals = window as unknown as {
      __layoutWorkerAttempt: (kind?: string) => Promise<void>
      Worker: typeof Worker
      SharedWorker: typeof SharedWorker
    }
    const blocked = class {
      constructor() {
        void globals.__layoutWorkerAttempt()
        throw new Error('Workers are disabled in the isolated layout fixture')
      }
    }
    globals.Worker = blocked as unknown as typeof Worker
    globals.SharedWorker = blocked as unknown as typeof SharedWorker
    if (typeof ServiceWorkerContainer !== 'undefined') {
      ServiceWorkerContainer.prototype.register = () => {
        void globals.__layoutWorkerAttempt('service-worker')
        return Promise.reject(new Error('Service workers are disabled in the isolated layout fixture'))
      }
    }
  })
  guardedContexts.add(context)
}

type WorkerFixtures = { layoutNetworkAudit: string[] }
type TestFixtures = { layoutSafety: void }

export const test = base.extend<TestFixtures, WorkerFixtures>({
  layoutNetworkAudit: [async ({ browserName }, provide) => {
    if (!['chromium', 'webkit', 'firefox'].includes(browserName)) throw new Error('Unknown browser')
    await provide([])
  }, { scope: 'worker' }],
  browser: [async ({ browser, layoutNetworkAudit }, provide) => {
    const run = process.env.LAYOUT_RUN_DIR
      ? readJson<RunIdentity>(resolve(process.env.LAYOUT_RUN_DIR, 'run.json'))
      : null
    const origins = run ? [run.candidate.origin, run.baseline.origin] : [`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 5174}`]
    const original = browser.newContext.bind(browser)
    browser.newContext = async (options?: BrowserContextOptions) => {
      const context = await original({ ...options, serviceWorkers: 'block' })
      await guardContext(context, origins, layoutNetworkAudit)
      return context
    }
    try { await provide(browser) } finally { browser.newContext = original }
  }, { scope: 'worker' }],
  layoutSafety: [async ({ context, layoutNetworkAudit, browserName }, provide, testInfo) => {
    assertGuardedContext(context)
    testInfo.annotations.push({ type: 'layout-effective-browser', description: browserName })
    const start = layoutNetworkAudit.length
    await provide()
    expect(layoutNetworkAudit.slice(start), 'Managed contexts must perform no prohibited network/worker I/O').toEqual([])
  }, { auto: true }],
})
