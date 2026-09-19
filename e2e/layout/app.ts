import { expect, type Frame, type Locator, type Page } from '@playwright/test'
import { MUSIC_ROOM_CONTROL_ENTITY_ID, MUSIC_ROOM_REMOTE_HASH } from '../../src/constants/mediaRemotes'
import { layoutProfile } from '../responsive-acceptance-data'
import type { ScenarioId } from './contracts'
import { applyProfile, waitForModalReady, waitForRoute } from './evidence'
import { openQuickLinksTab } from '../quick-links'
import { enterWakeState, isWakeScenario } from './wakeLight'
import { HOUSEHOLD_RESIDENTS } from '../../src/constants/householdResidents'

const HOUSEHOLD_AWAY_STATUS_ENTITY_ID = 'sensor.household_away_status'

async function seedSoloTripState(page: Page, state: string, viewer: 'steph' | 'stephen' | 'unknown' = 'stephen') {
  await page.evaluate(({ state, statusEntityId, user }) => {
    const api = window.__mockHass
    if (!api) throw new Error('Mock preflight failed')
    api.setUser(user)
    const engaged = ['scheduled', 'activating', 'active', 'degraded', 'ending', 'restore-required'].includes(state)
    const residentState = state === 'restore-required' ? 'restore_required' : state === 'unavailable' ? 'unavailable' : engaged ? state : 'idle'
    api.setEntityState(statusEntityId, residentState)
    api.setEntityAttribute(statusEntityId, 'command_available', state !== 'unavailable')
    api.setEntityAttribute(statusEntityId, 'mode', engaged ? 'solo_trip' : 'none')
    api.setEntityAttribute(statusEntityId, 'traveler', engaged ? 'stephen' : 'none')
    api.setEntityAttribute(statusEntityId, 'home_resident', engaged ? 'steph' : 'none')
    api.setEntityAttribute(statusEntityId, 'starts_at', engaged ? '2099-01-01T09:00:00' : null)
    api.setEntityAttribute(statusEntityId, 'ends_at', engaged ? '2099-01-03T17:00:00' : null)
    api.setEntityAttribute(statusEntityId, 'effects', {
      sleepypod_live_follow: state === 'active',
      sleepypod_schedule: state === 'active',
      wake_light_source: state === 'active',
    })
    api.setEntityAttribute(statusEntityId, 'blockers', state === 'restore-required' ? ['sleepypod_schedule_diverged'] : [])
  }, {
    state,
    statusEntityId: HOUSEHOLD_AWAY_STATUS_ENTITY_ID,
    user: viewer === 'unknown'
      ? { id: 'unknown-user', name: 'Unknown' }
      : { id: HOUSEHOLD_RESIDENTS[viewer].haUserId, name: HOUSEHOLD_RESIDENTS[viewer].name },
  })
}

async function seedSoloTripBed(page: Page, viewer: 'steph' | 'stephen' = 'stephen') {
  await seedSoloTripState(page, 'active', viewer)
  await page.evaluate(() => {
    const api = window.__mockHass
    if (!api) throw new Error('Mock preflight failed')
    for (const side of ['left', 'right']) {
      api.setEntityState(`climate.sleepypod_eight_pod_${side}_side`, 'heat')
      api.setEntityAttribute(`climate.sleepypod_eight_pod_${side}_side`, 'current_temperature', side === 'left' ? 81 : 77)
      api.setEntityAttribute(`climate.sleepypod_eight_pod_${side}_side`, 'temperature', 77)
      api.setEntityAttribute(`climate.sleepypod_eight_pod_${side}_side`, 'min_temp', 55)
      api.setEntityAttribute(`climate.sleepypod_eight_pod_${side}_side`, 'max_temp', 110)
      api.setEntityAttribute(`climate.sleepypod_eight_pod_${side}_side`, 'target_temp_step', 1)
    }
    api.setEntityState('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2')
    api.setEntityState('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0')
  })
}

export async function openSurface(page: Page, scenario: ScenarioId, state?: string): Promise<Locator> {
  const route = isWakeScenario(scenario) || (scenario === 'solo-trip-bed' && !state?.startsWith('editor'))
    ? 'master-bedroom'
    : scenario === 'solo-trip-settings' || (scenario === 'solo-trip-bed' && state?.startsWith('editor'))
      ? 'solo-trip'
      : scenario === 'filters' || scenario === 'recipe-grocery'
        ? 'recipes'
        : scenario === 'form'
          ? 'to-do'
          : scenario === 'remote'
            ? 'music-room'
            : scenario === 'vacuum'
              ? 'vacuums'
              : 'overview'
  const recipeDelay = scenario === 'recipe-grocery' ? `&__mockRecipeGroceryDelayMs=${state === 'loading' ? 60000 : 300}` : ''
  await page.goto(`/index.html?path=${route}${recipeDelay}${scenario === 'summary' ? '&user=stephen#daily-report' : ''}`)
  await waitForRoute(page, route, scenario === 'summary')
  if (scenario === 'solo-trip-settings') {
    const fixtureState = state === 'active-home-viewer' || state === 'active-unknown-viewer' ? 'active' : state ?? 'idle'
    const viewer = state === 'active-home-viewer' ? 'steph' : state === 'active-unknown-viewer' ? 'unknown' : 'stephen'
    await seedSoloTripState(page, fixtureState, viewer)
    const pageRoot = page.locator(`[data-route-path="${route}"]:not([aria-hidden="true"]) main`)
    await expect(pageRoot).toBeVisible()
    if (state === 'idle-selected' || state === 'modal') {
      await pageRoot.getByRole('button', { name: 'You', exact: true }).click()
    }
    if (state === 'modal') {
      await pageRoot.locator('button[role="switch"][aria-label^="Solo Trip"]').click()
      await expect(page.getByRole('dialog', { name: 'Schedule Solo Trip' })).toBeVisible()
    }
    return pageRoot
  }
  if (scenario === 'solo-trip-bed') {
    if (state?.startsWith('editor')) {
      if (state === 'editor-unavailable') await seedSoloTripState(page, 'unavailable')
      await page.getByRole('button', { name: 'Solo Trip', exact: true }).click()
    } else {
      const homeViewer = state?.startsWith('home-viewer-') ?? false
      await seedSoloTripBed(page, homeViewer ? 'steph' : 'stephen')
      const awaySide = state?.endsWith('away-side') ?? false
      await page.getByRole('button', {
        name: homeViewer
          ? awaySide ? /Stephen's Side Away · Read Only/ : /Your Side Whole Bed/
          : awaySide ? /Your Side Away · Read Only/ : /Steph's Side Whole Bed/,
      }).click()
    }
    const dialog = page.getByRole('dialog')
    await waitForModalReady(dialog)
    await dialog.evaluate((element) => { element.setAttribute('data-layout-mounted', 'original') })
    return dialog
  }
  if (isWakeScenario(scenario)) await page.getByRole('button', { name: /Wake-Light Alarms/ }).click()
  if (scenario === 'quick-links') await openQuickLinksTab(page)
  if (scenario === 'weather') await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  if (scenario === 'filters') await page.locator('[data-floating-action-dock]').getByRole('button', { name: 'Filter', exact: true }).click()
  if (scenario === 'recipe-grocery') {
    await page.getByRole('button', { name: 'Open Catalog Recipe 1 recipe details' }).click()
    await page.getByRole('dialog', { name: 'Catalog Recipe 1' }).getByRole('tab', { name: 'Ingredients' }).click()
  }
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
  if (scenario === 'recipe-grocery' && state !== 'ready') {
    await dialog.getByRole('button', { name: 'Add Missing Ingredients to Groceries' }).click()
    await expect(dialog.locator(`[data-recipe-grocery-phase="${state === 'loading' ? '1' : '3'}"]`)).toBeVisible()
  }
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
  if (scenario === 'vacuum') {
    const page = dialog.page()
    await page.evaluate((nextState) => {
      const mock = window.__mockHass
      if (!mock) throw new Error('Mock Home Assistant API is unavailable')
      const setMainFloorRuntime = (vacuumState: string, statusFlag: string, error: string) => {
        mock.setEntityState('vacuum.valetudo_exaltedsneakydeer', vacuumState)
        mock.setEntityState('sensor.valetudo_exaltedsneakydeer_status_flag', statusFlag)
        mock.setEntityState('sensor.valetudo_exaltedsneakydeer_error', error)
        mock.setEntityState('sensor.valetudo_exaltedsneakydeer_dock_status', 'idle')
      }
      if (nextState === 'cleaning') setMainFloorRuntime('cleaning', 'none', 'No error')
      else if (nextState === 'dock-cleaning') {
        setMainFloorRuntime('docked', 'none', 'No error')
        mock.setEntityState('sensor.valetudo_exaltedsneakydeer_dock_status', 'cleaning')
      }
      else if (nextState === 'resumable') setMainFloorRuntime('docked', 'resumable', 'No error')
      else if (nextState === 'low-battery') setMainFloorRuntime('error', 'none', 'Low battery')
      else setMainFloorRuntime('docked', 'none', 'No error')
      mock.calls.splice(0, mock.calls.length)
    }, state)
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
