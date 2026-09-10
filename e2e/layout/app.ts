import { expect, type Frame, type Locator, type Page } from '@playwright/test'
import { MUSIC_ROOM_CONTROL_ENTITY_ID, MUSIC_ROOM_REMOTE_HASH } from '../../src/constants/mediaRemotes'
import { layoutProfile } from '../responsive-acceptance-data'
import type { ScenarioId } from './contracts'
import { applyProfile, waitForModalReady, waitForRoute } from './evidence'
import { openQuickLinksTab } from '../quick-links'
import { enterWakeState, isWakeScenario } from './wakeLight'

export async function openSurface(page: Page, scenario: ScenarioId): Promise<Locator> {
  const route = isWakeScenario(scenario) ? 'master-bedroom' : scenario === 'filters' ? 'recipes' : scenario === 'form' ? 'to-do' : scenario === 'remote' ? 'music-room' : scenario === 'vacuum' ? 'vacuums' : 'overview'
  await page.goto(`/index.html?path=${route}${scenario === 'summary' ? '&user=stephen#daily-report' : ''}`)
  await waitForRoute(page, route, scenario === 'summary')
  if (isWakeScenario(scenario)) await page.getByRole('button', { name: /Wake-Light Alarms/ }).click()
  if (scenario === 'quick-links') await openQuickLinksTab(page)
  if (scenario === 'weather') await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
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
  if (scenario === 'vacuum') await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog, undefined, scenario === 'vacuum' ? 'vacuum-tabs' : undefined)
  await dialog.evaluate((element) => { element.setAttribute('data-layout-mounted', 'original') })
  return dialog
}

export async function enterState(dialog: Locator, scenario: ScenarioId, state: string) {
  if (isWakeScenario(scenario)) {
    await enterWakeState(dialog, scenario, state)
    return
  }
  if (scenario === 'quick-links' && (state === 'rooms' || state === 'back')) {
    await dialog.getByRole('button', { name: 'Rooms', exact: true }).click()
    if (state === 'back') await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  }
  if (scenario === 'summary') await dialog.getByRole('tab', {
    name: state === 'overdue' ? /^Overdue Chores/ : state === 'upcoming' ? 'Upcoming Chores' : /^Expired Food/,
  }).click()
  if (scenario === 'weather') {
    const page = dialog.page()
    await page.evaluate((nextState) => {
      const api = window.__mockHass!
      api.setCallServiceOutcome('weather', 'get_forecasts', 'resolve')
      if (nextState === 'forecast-empty' || nextState === 'forecast-error-empty') api.clearWeatherForecasts()
      api.setEntityAttribute('weather.pirate_weather', 'pressure', nextState === 'pressure-unavailable' ? null : nextState === 'pressure-long' ? 101325.25 : 29.92)
      api.setEntityAttribute('weather.pirate_weather', 'pressure_unit', nextState === 'pressure-long' ? 'Pa' : 'inHg')
    }, state)
    const rows = dialog.locator('[class*="forecastRow"]')
    if (state === 'forecast-empty' || state === 'forecast-error-empty') {
      await expect(dialog.getByText('No forecast data returned by Pirate Weather.', { exact: true })).toBeVisible()
      await expect(rows).toHaveCount(0)
    } else {
      await expect(rows).toHaveCount(7)
    }
    if (state.startsWith('forecast-error')) {
      await page.evaluate(() => {
        window.__mockHass!.setCallServiceOutcome('weather', 'get_forecasts', 'reject')
        window.__mockHass!.setEntityAttribute('weather.pirate_weather', 'forecast_revision', Date.now())
      })
      await expect(dialog.getByText('Mock service rejection', { exact: true })).toHaveCount(2)
    }
    const label = state === 'wind' ? 'Wind conditions' : state === 'precipitation' ? 'Precipitation conditions' : 'Conditions conditions'
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await expect(dialog.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => dialog.locator('[data-transition]').evaluateAll((elements) => (
      elements.every((element) => element.getAttribute('data-transition') === 'idle')
    ))).toBe(true)
    await dialog.locator('[data-modal-sheet-body]').evaluate((element) => { element.scrollTop = 0 })
  }
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
