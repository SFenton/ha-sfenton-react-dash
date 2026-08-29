import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { height: 852, name: 'phone portrait', width: 393 },
  { height: 393, name: 'phone landscape', width: 852 },
  { height: 1180, name: 'tablet portrait', width: 820 },
  { height: 900, name: 'desktop', width: 1440 },
]

const RESIZE_SEQUENCES = [
  [{ height: 852, width: 393 }, { height: 900, width: 1440 }, { height: 852, width: 393 }],
  [{ height: 900, width: 1440 }, { height: 852, width: 393 }, { height: 900, width: 1440 }],
  [{ height: 1180, width: 820 }, { height: 820, width: 1180 }, { height: 1180, width: 820 }],
]

interface HomeRouteAudit {
  adaptiveNavigationMissing: boolean
  appShellMissing: boolean
  headerMissing: boolean
  loaderSeen: boolean
  running: boolean
  samples: number
  shell: Element | null
}

type HomeRouteAuditWindow = Window & {
  __homeRouteAudit?: HomeRouteAudit
  __sfentonReactDashboardLifecycle?: {
    instanceId: string
  }
}

async function waitForSettings(page: Page) {
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

async function navigateHome(page: Page) {
  const adaptiveNavigation = page.locator('[data-adaptive-navigation]:visible')
  if (await adaptiveNavigation.count()) {
    const startedAt = Date.now()
    await adaptiveNavigation.getByRole('button', { name: 'Home', exact: true }).click()
    return startedAt
  }

  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  const startedAt = Date.now()
  await page.locator('aside[data-state="open"]').getByRole('menuitem', {
    name: 'Home',
    exact: true,
  }).click()
  return startedAt
}

async function startHomeRouteAudit(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && element.getBoundingClientRect().width > 0
        && element.getBoundingClientRect().height > 0
    }
    const visibleAdaptiveNavigation = () => (
      [...document.querySelectorAll('[data-adaptive-navigation]')].some(visible)
    )
    const adaptiveNavigationExpected = visibleAdaptiveNavigation()
    const audit: HomeRouteAudit = {
      adaptiveNavigationMissing: false,
      appShellMissing: false,
      headerMissing: false,
      loaderSeen: false,
      running: true,
      samples: 0,
      shell: document.querySelector('[data-app-shell="true"]'),
    }
    ;(window as HomeRouteAuditWindow).__homeRouteAudit = audit

    const sample = () => {
      audit.samples += 1
      audit.loaderSeen ||= Boolean(document.querySelector(
        '[role="status"][aria-label="Loading Home dashboard content"]',
      ))
      audit.appShellMissing ||= !document.querySelector('[data-app-shell="true"]')
      audit.headerMissing ||= !document.querySelector('[data-page-header="true"]')
      if (adaptiveNavigationExpected) {
        audit.adaptiveNavigationMissing ||= !visibleAdaptiveNavigation()
      }
      if (audit.running) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)

    return {
      lifecycleId: (window as HomeRouteAuditWindow).__sfentonReactDashboardLifecycle?.instanceId,
      timeOrigin: performance.timeOrigin,
    }
  })
}

async function expectWarmHomeNavigation(
  page: Page,
  requests: string[],
  initial: { lifecycleId?: string, timeOrigin: number },
) {
  const startedAt = await navigateHome(page)
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible({
    timeout: 1_000,
  })
  await expect(page.getByRole('heading', { name: 'Cameras', exact: true })).toBeVisible()
  await page.waitForTimeout(250)

  const result = await page.evaluate(() => {
    const audit = (window as HomeRouteAuditWindow).__homeRouteAudit
    if (!audit) throw new Error('Home route audit was not installed.')
    audit.running = false
    return {
      adaptiveNavigationMissing: audit.adaptiveNavigationMissing,
      appShellMissing: audit.appShellMissing,
      headerMissing: audit.headerMissing,
      lifecycleId: (window as HomeRouteAuditWindow).__sfentonReactDashboardLifecycle?.instanceId,
      loaderSeen: audit.loaderSeen,
      sameShell: audit.shell === document.querySelector('[data-app-shell="true"]'),
      samples: audit.samples,
      timeOrigin: performance.timeOrigin,
    }
  })

  expect(Date.now() - startedAt).toBeLessThan(1_000)
  expect(requests).toEqual([])
  expect(result).toMatchObject({
    adaptiveNavigationMissing: false,
    appShellMissing: false,
    headerMissing: false,
    lifecycleId: initial.lifecycleId,
    loaderSeen: false,
    sameShell: true,
    timeOrigin: initial.timeOrigin,
  })
  expect(result.samples).toBeGreaterThan(0)
}

test('fresh non-Home routes navigate Home without a second loader across form factors', async ({ page }) => {
  const appRequests: string[] = []
  page.on('request', (request) => {
    if (/\/(?:index\.html|assets\/app-[^/]+\.js)(?:\?|$)/.test(request.url())) {
      appRequests.push(request.url())
    }
  })

  for (const viewport of VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport)
      await page.goto('/index.html?path=settings')
      await waitForSettings(page)
      appRequests.length = 0
      const initial = await startHomeRouteAudit(page)
      await expectWarmHomeNavigation(page, appRequests, initial)
    })
  }
})

test('fresh non-Home routes stay warm through the canonical resize sequences', async ({ page }) => {
  const appRequests: string[] = []
  page.on('request', (request) => {
    if (/\/(?:index\.html|assets\/app-[^/]+\.js)(?:\?|$)/.test(request.url())) {
      appRequests.push(request.url())
    }
  })

  for (const sequence of RESIZE_SEQUENCES) {
    await page.setViewportSize(sequence[0])
    await page.goto('/index.html?path=settings')
    await waitForSettings(page)

    for (const viewport of sequence.slice(1)) {
      await page.setViewportSize(viewport)
      await waitForSettings(page)
    }

    appRequests.length = 0
    const initial = await startHomeRouteAudit(page)
    await expectWarmHomeNavigation(page, appRequests, initial)
  }
})
