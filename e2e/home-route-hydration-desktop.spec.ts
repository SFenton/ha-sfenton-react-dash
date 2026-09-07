import { expect, test } from './layout/fixture'

type DesktopHomeRouteWindow = Window & {
  __sfentonReactDashboardLifecycle?: {
    instanceId: string
  }
}

test('fresh desktop Settings navigates Home without a second loader or chrome loss', async ({ page }) => {
  const appRequests: string[] = []
  page.on('request', (request) => {
    if (/\/(?:index\.html|assets\/app-[^/]+\.js)(?:\?|$)/.test(request.url())) {
      appRequests.push(request.url())
    }
  })

  await page.goto('/index.html?path=settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
    timeout: 15_000,
  })
  appRequests.length = 0
  const initial = await page.evaluate(() => {
    const audit = {
      headerMissing: false,
      loaderSeen: false,
      railMissing: false,
      running: true,
      shell: document.querySelector('[data-app-shell="true"]'),
    }
    ;(window as unknown as { __desktopHomeRouteAudit: typeof audit }).__desktopHomeRouteAudit = audit
    const sample = () => {
      audit.headerMissing ||= !document.querySelector('[data-page-header="true"]')
      audit.loaderSeen ||= Boolean(document.querySelector(
        '[role="status"][aria-label="Loading Home dashboard content"]',
      ))
      audit.railMissing ||= !document.querySelector('[data-adaptive-navigation="rail"]')
      if (audit.running) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return {
      lifecycleId: (window as DesktopHomeRouteWindow).__sfentonReactDashboardLifecycle?.instanceId,
      timeOrigin: performance.timeOrigin,
    }
  })

  const startedAt = Date.now()
  await page.locator('[data-adaptive-navigation="rail"]').getByRole('button', {
    name: 'Home',
    exact: true,
  }).click()
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible({
    timeout: 1_000,
  })
  await expect(page.getByRole('heading', { name: 'Cameras', exact: true })).toBeVisible()
  await page.waitForTimeout(250)

  const result = await page.evaluate(() => {
    const audit = (window as unknown as {
      __desktopHomeRouteAudit: {
        headerMissing: boolean
        loaderSeen: boolean
        railMissing: boolean
        running: boolean
        shell: Element | null
      }
    }).__desktopHomeRouteAudit
    audit.running = false
    return {
      headerMissing: audit.headerMissing,
      lifecycleId: (window as DesktopHomeRouteWindow).__sfentonReactDashboardLifecycle?.instanceId,
      loaderSeen: audit.loaderSeen,
      railMissing: audit.railMissing,
      sameShell: audit.shell === document.querySelector('[data-app-shell="true"]'),
      timeOrigin: performance.timeOrigin,
    }
  })

  expect(Date.now() - startedAt).toBeLessThan(1_000)
  expect(appRequests).toEqual([])
  expect(result).toEqual({
    headerMissing: false,
    lifecycleId: initial.lifecycleId,
    loaderSeen: false,
    railMissing: false,
    sameShell: true,
    timeOrigin: initial.timeOrigin,
  })
})
