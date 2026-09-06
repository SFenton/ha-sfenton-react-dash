import { expect, type Frame, type Locator, type Page } from '@playwright/test'
import { MUSIC_ROOM_CONTROL_ENTITY_ID, MUSIC_ROOM_REMOTE_HASH } from '../../src/constants/mediaRemotes'
import { layoutProfile } from '../responsive-acceptance-data'
import type { ScenarioId } from './contracts'
import { applyProfile, waitForModalReady, waitForRoute } from './evidence'

export async function openSurface(page: Page, scenario: ScenarioId): Promise<Locator> {
  const route = scenario === 'filters' ? 'recipes' : scenario === 'form' ? 'to-do' : scenario === 'remote' ? 'music-room' : 'overview'
  await page.goto(`/index.html?path=${route}${scenario === 'summary' ? '&user=stephen#daily-report' : ''}`)
  await waitForRoute(page, route, scenario === 'summary')
  if (scenario === 'quick-links') await page.getByRole('button', { name: 'Quick Links', exact: true }).click()
  if (scenario === 'filters') await page.locator('[data-floating-action-dock]').getByRole('button', { name: 'Filter', exact: true }).click()
  if (scenario === 'form') {
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    await page.getByRole('textbox', { name: 'Task', exact: true }).fill('Layout validation draft')
    await page.getByRole('textbox', { name: 'Task', exact: true }).blur()
  }
  if (scenario === 'remote') await page.evaluate(({ entity, hash }) => {
    if (!window.__mockHass) throw new Error('Mock preflight failed')
    window.__mockHass.setEntityState(entity, 'idle')
    window.location.hash = hash
  }, { entity: MUSIC_ROOM_CONTROL_ENTITY_ID, hash: MUSIC_ROOM_REMOTE_HASH })
  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog)
  await dialog.evaluate((element) => { element.setAttribute('data-layout-mounted', 'original') })
  return dialog
}

export async function enterState(dialog: Locator, scenario: ScenarioId, state: string) {
  if (scenario === 'quick-links' && (state === 'rooms' || state === 'back')) {
    await dialog.getByRole('button', { name: 'Rooms', exact: true }).click()
    if (state === 'back') await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  }
  if (scenario === 'summary') await dialog.getByRole('tab', {
    name: state === 'overdue' ? /^Overdue Chores/ : state === 'upcoming' ? 'Upcoming Chores' : /^Expired Food/,
  }).click()
  await waitForModalReady(dialog)
}

export async function openHost(page: Page, state: string) {
  const tag = state === 'legacy' ? 'sfenton-react-app-card' : 'sfenton-react-panel'
  const script = state === 'legacy' ? 'sfenton-react-app-card.js' : 'sfenton-react-panel.js'
  await page.route(`**/layout-host-${state}.html`, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0"><script type="module" src="/${script}"></script></body></html>`,
  }))
  await page.goto(`/layout-host-${state}.html`)
  await page.waitForFunction((name) => Boolean(customElements.get(name)), tag)
  await page.evaluate(({ tag, state }) => {
    const host = document.createElement(tag) as HTMLElement & {
      setConfig?: (value: { url: string }) => void
      panel?: { config: { app_url: string }; title: string }
    }
    host.dataset.layoutHost = state
    if (state === 'legacy') host.setConfig!({ url: '/index.html?path=overview' })
    else host.panel = { config: { app_url: '/index.html?path=overview' }, title: 'Synthetic custom-panel host' }
    document.body.append(host)
  }, { tag, state })
  await expect.poll(() => page.frames().filter((frame) => frame.url().includes('/index.html')).length).toBe(1)
  const frame = page.frames().find((candidate) => candidate.url().includes('/index.html')) as Frame
  await waitForRoute(frame, 'overview')
  return frame
}

export async function applyHostProfile(page: Page, frame: Frame, state: string, profile: string) {
  await applyProfile(page, profile)
  await page.locator(`[data-layout-host="${state}"]`).evaluate((element, narrow) => {
    const host = element as HTMLElement
    host.style.width = narrow ? 'calc(100vw - 256px)' : '100vw'
    host.style.left = narrow ? '256px' : '0'
  }, state === 'panel' && profile === 'desktop')
  await expect.poll(() => frame.evaluate(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].map((edge) => [
    edge, Number.parseFloat(document.documentElement.style.getPropertyValue(`--safe-area-inset-${edge}`)) || 0,
  ])))).toEqual(layoutProfile(profile).insets)
}
