import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { Browser } from 'webdriverio'
import { RESPONSIVE_ROUTES, RESPONSIVE_ROUTE_TITLES, type ResponsiveRoute } from '../responsive-acceptance-data'
import {
  adb,
  applyFoldState,
  boundsFromSource,
  createHomeAssistantSession,
  descriptionContainsSelector,
  descriptionStartsWithSelector,
  textSelector,
  FOLD_PHYSICAL_SIZES,
  HOME_ASSISTANT_ACTIVITY,
  HOME_ASSISTANT_PACKAGE,
  openHomeAssistantRoute,
  physicalSize,
  startAppium,
  stopAppium,
  waitForHomeAssistantApp,
  waitForNativeDialog,
  waitForNativeText,
  type FoldState,
} from './fold8-appium'
import { EMULATOR_PORT_DISPOSITIONS, EMULATOR_SCENARIOS } from './playwright-port-manifest'

let browser: Browser<'async'>

const HASH_MODAL_CASES = [
  { hash: '#lights-overview', id: 'home-lights', route: 'overview' },
  { hash: '#climate-overview', id: 'home-climate', route: 'overview' },
  { hash: '#occupancy-overview', id: 'home-occupancy', route: 'overview' },
  { hash: '#contact-sensors-overview', id: 'home-contact-sensors', route: 'overview' },
  { hash: '#aqi-overview', id: 'home-air-quality', route: 'overview' },
  { hash: '#security-system', id: 'home-security', route: 'overview' },
  { hash: '#guest-presence-security', id: 'home-guest-presence', route: 'overview' },
  { hash: '#chores-preview', id: 'home-chores', route: 'overview' },
  { hash: '#settings-preview', id: 'home-settings', route: 'overview' },
  { hash: '#camera-front-door', id: 'home-camera', route: 'overview' },
  { hash: '#presence-based-overrides', id: 'admin-presence', route: 'admin' },
  { hash: '#presence-based-overrides-auto', id: 'admin-presence-auto-reset', route: 'admin' },
  { hash: '#security-system', id: 'security-dashboard', route: 'security' },
  { hash: '#lights-master-bedroom', id: 'master-bedroom-lights', route: 'master-bedroom' },
  { hash: '#master-bedroom-occupancy', id: 'master-bedroom-occupancy', route: 'master-bedroom' },
  { hash: '#thermostat-controls', id: 'thermostat-controls', route: 'ecobee' },
] as const

const BUTTON_MODAL_CASES = [
  { id: 'quick-links', route: 'living-room', selector: descriptionContainsSelector('Quick Links') },
  { id: 'weather', route: 'overview', selector: descriptionStartsWithSelector('Open seven-day weather forecast') },
  { id: 'bathroom-fan', route: 'guest-bathroom', selector: descriptionStartsWithSelector('Fan ') },
  { id: 'create-chore', route: 'chores', selector: textSelector('Add Task') },
  { id: 'create-grocery', route: 'grocery-list', selector: textSelector('Add Groceries') },
  { id: 'create-todo', route: 'to-do', selector: textSelector('Add Task') },
  { id: 'humidifier', route: 'master-bedroom', selector: descriptionStartsWithSelector('Humidifier ') },
  { id: 'sprinkler', route: 'sprinklers', selector: descriptionStartsWithSelector('Front Yard ') },
  { id: 'vacuum', route: 'vacuums', selector: descriptionStartsWithSelector('Main Floor ') },
] as const

function verifyPortManifest(implementedScenarios: readonly string[]) {
  const actualSpecs = fs.readdirSync(path.resolve('e2e'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort()
  const inventoriedSpecs = EMULATOR_PORT_DISPOSITIONS.map((entry) => entry.spec).sort()
  assert.deepEqual(inventoriedSpecs, actualSpecs, 'every Playwright spec must have an emulator disposition')
  assert.deepEqual([...EMULATOR_SCENARIOS].sort(), [...implementedScenarios].sort(), 'every declared emulator scenario must be implemented')
}

function expectedTitle(route: ResponsiveRoute) {
  const title = RESPONSIVE_ROUTE_TITLES.get(route)
  if (!title) throw new Error(`Missing title for ${route}`)
  return title
}

function processId() {
  return adb('shell', 'pidof', HOME_ASSISTANT_PACKAGE)
}

async function assertHomeAssistantContext() {
  await waitForHomeAssistantApp(browser)
  assert.equal(await browser.getCurrentPackage(), HOME_ASSISTANT_PACKAGE, 'Appium remains attached to Home Assistant')
  assert.equal(await browser.getCurrentActivity(), HOME_ASSISTANT_ACTIVITY, 'Home Assistant WebViewActivity remains active')
  assert.equal(await browser.getContext(), 'NATIVE_APP', 'tests run through the Home Assistant native app context')
  const contexts = await browser.getContexts()
  assert.ok(contexts.some((context) => String(context) === 'NATIVE_APP'), 'Home Assistant exposes the native Appium context')
}

async function assertNativeFrame(state: FoldState, expectedRouteTitle?: string) {
  await assertHomeAssistantContext()
  const expected = FOLD_PHYSICAL_SIZES[state]
  assert.deepEqual(physicalSize(), expected, `${state} physical display geometry`)
  const windowRect = await browser.getWindowRect()
  assert.deepEqual({ height: windowRect.height, width: windowRect.width }, expected, `${state} native app window geometry`)

  const source = await browser.getPageSource()
  assert.ok(source.includes(`package="${HOME_ASSISTANT_PACKAGE}"`), `${state} hierarchy belongs to Home Assistant`)
  const webViews = boundsFromSource(source, 'android.webkit.WebView')
  assert.ok(webViews.length > 0, `${state} Home Assistant exposes a WebView accessibility surface`)
  for (const bounds of boundsFromSource(source)) {
    assert.ok(bounds.left >= 0 && bounds.top >= 0, `${state} accessibility node starts in the app window`)
    assert.ok(bounds.right <= expected.width && bounds.bottom <= expected.height, `${state} accessibility node stays in the app window`)
  }
  if (expectedRouteTitle && state === 'closed') await waitForNativeText(browser, expectedRouteTitle)

  const screenshotBytes = Buffer.from(await browser.takeScreenshot(), 'base64').byteLength
  assert.ok(screenshotBytes > 10_000, `${expectedRouteTitle ?? state} ${state} Home Assistant app rendered a non-empty frame`)
}

async function assertPhysicalState(state: FoldState) {
  await applyFoldState(browser, state)
  await assertNativeFrame(state)
}

async function assertRoute(route: ResponsiveRoute, state: 'closed' | 'open') {
  await assertNativeFrame(state, expectedTitle(route))
}

async function assertDialog(state: 'closed' | 'open', id: string) {
  await waitForNativeDialog(browser)
  const dialogBounds = boundsFromSource(await browser.getPageSource(), 'android.app.AlertDialog')
    .sort((left, right) => (right.right - right.left) * (right.bottom - right.top) - (left.right - left.left) * (left.bottom - left.top))[0]
  if (!dialogBounds) throw new Error(`${id} ${state} dialog had no measurable accessibility bounds`)
  const location = { x: dialogBounds.left, y: dialogBounds.top }
  const size = { width: dialogBounds.right - dialogBounds.left, height: dialogBounds.bottom - dialogBounds.top }
  const viewport = FOLD_PHYSICAL_SIZES[state]
  const alternateViewport = state === 'closed' ? FOLD_PHYSICAL_SIZES.open : FOLD_PHYSICAL_SIZES.closed
  assert.ok(size.width > 100, `${id} ${state} dialog has usable width (${size.width}px)`)
  assert.ok(size.height > 100, `${id} ${state} dialog has usable height (${size.height}px)`)
  const systemBarTolerance = 64
  const fitsViewport = (candidate: typeof viewport) =>
    location.x >= -systemBarTolerance && location.y >= -systemBarTolerance
      && location.x + size.width <= candidate.width + systemBarTolerance
      && location.y + size.height <= candidate.height + systemBarTolerance
  assert.ok(fitsViewport(viewport) || fitsViewport(alternateViewport), `${id} ${state} dialog stays within a Fold display (${JSON.stringify({ location, size, viewport })})`)
  return { location, size }
}

async function foldMountedDialog(id: string) {
  const pid = processId()
  await assertDialog('closed', id)
  await applyFoldState(browser, 'open')
  assert.equal(processId(), pid, `${id} keeps the Home Assistant process mounted while opening`)
  await assertDialog('open', id)
  await applyFoldState(browser, 'closed')
  assert.equal(processId(), pid, `${id} keeps the Home Assistant process mounted while closing`)
  await assertDialog('closed', id)
}

async function dragTouch(start: { x: number; y: number }, end: { x: number; y: number }) {
  const steps = Array.from({ length: 12 }, (_, index) => ({
    type: 'pointerMove' as const,
    duration: 45,
    x: Math.round(start.x + ((end.x - start.x) * (index + 1)) / 12),
    y: Math.round(start.y + ((end.y - start.y) * (index + 1)) / 12),
  }))
  await browser.performActions([{
    type: 'pointer',
    id: 'fold8-native-touch',
    parameters: { pointerType: 'touch' },
    actions: [
      { type: 'pointerMove', duration: 0, x: start.x, y: start.y },
      { type: 'pointerDown', button: 0 },
      { type: 'pause', duration: 100 },
      ...steps,
      { type: 'pointerUp', button: 0 },
    ],
  }])
  await browser.releaseActions()
}

async function scrollUp() {
  const viewport = FOLD_PHYSICAL_SIZES.closed
  await dragTouch(
    { x: Math.round(viewport.width / 2), y: Math.round(viewport.height * 0.72) },
    { x: Math.round(viewport.width / 2), y: Math.round(viewport.height * 0.3) },
  )
  await browser.pause(300)
}

async function tapVisible(selector: string, id: string) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const element = await browser.$(selector)
    if (await element.isExisting()) {
      const location = await element.getLocation()
      const size = await element.getSize()
      if (size.width > 0 && size.height > 0 && location.y < FOLD_PHYSICAL_SIZES.closed.height) {
        await element.click()
        return
      }
    }
    await scrollUp()
  }
  throw new Error(`${id} opener was not exposed by the Home Assistant accessibility tree`)
}

export async function runAllRouteFoldCycles() {
  await applyFoldState(browser, 'closed')
  for (const route of RESPONSIVE_ROUTES) {
    await openHomeAssistantRoute(browser, route, expectedTitle(route))
    const pid = processId()
    await assertRoute(route, 'closed')
    await applyFoldState(browser, 'open')
    assert.equal(processId(), pid, `${route} keeps the Home Assistant process mounted while opening`)
    await assertRoute(route, 'open')
    await applyFoldState(browser, 'closed')
    assert.equal(processId(), pid, `${route} keeps the Home Assistant process mounted while closing`)
    await waitForNativeText(browser, expectedTitle(route))
    await assertRoute(route, 'closed')
  }
}

export async function runHashModalFoldCycles() {
  for (const modalCase of HASH_MODAL_CASES) {
    await applyFoldState(browser, 'closed')
    adb('shell', 'am', 'force-stop', HOME_ASSISTANT_PACKAGE)
    await openHomeAssistantRoute(browser, modalCase.route, expectedTitle(modalCase.route), modalCase.hash)
    await foldMountedDialog(modalCase.id)
  }
}

export async function runButtonModalFoldCycles() {
  for (const modalCase of BUTTON_MODAL_CASES) {
    await applyFoldState(browser, 'closed')
    adb('shell', 'am', 'force-stop', HOME_ASSISTANT_PACKAGE)
    await openHomeAssistantRoute(browser, modalCase.route, expectedTitle(modalCase.route))
    await applyFoldState(browser, 'closed')
    console.log(`  · opening ${modalCase.id}`)
    await tapVisible(modalCase.selector, modalCase.id)
    await assertDialog('closed', modalCase.id)
    await applyFoldState(browser, 'open')
    await openHomeAssistantRoute(browser, modalCase.route, expectedTitle(modalCase.route))
    await applyFoldState(browser, 'open')
    await tapVisible(modalCase.selector, `${modalCase.id} open`)
    await assertDialog('open', `${modalCase.id} open`)
    await applyFoldState(browser, 'closed')
  }
}

export async function runSwipeDismissal() {
  await applyFoldState(browser, 'closed')
  adb('shell', 'am', 'force-stop', HOME_ASSISTANT_PACKAGE)
  await openHomeAssistantRoute(browser, 'living-room', 'Living Room')
  await tapVisible(descriptionContainsSelector('Quick Links'), 'quick-links-swipe')
  const dialog = await assertDialog('closed', 'quick-links-swipe')
  await browser.pause(650)
  const start = {
    x: Math.round(dialog.location.x + dialog.size.width / 2),
    y: Math.round(dialog.location.y + Math.min(120, dialog.size.height * 0.1)),
  }
  const end = {
    x: start.x,
    y: Math.min(FOLD_PHYSICAL_SIZES.closed.height - 80, Math.round(start.y + dialog.size.height * 0.62)),
  }
  await dragTouch(start, end)
  await browser.waitUntil(async () => !(await browser.getPageSource()).includes('class="android.app.AlertDialog"'), {
    timeout: 8_000,
    interval: 200,
    timeoutMsg: 'Quick Links sheet did not dismiss after a native Appium touch swipe',
  })
}

export async function runKeyboardTest() {
  assert.equal(adb('shell', 'settings', 'get', 'secure', 'show_ime_with_hard_keyboard'), '0', 'software keyboard remains hidden for hardware input')
  assert.match(adb('shell', 'dumpsys', 'input'), /qwerty2/i, 'hardware keyboard device is present')
  await applyFoldState(browser, 'closed')
  await openHomeAssistantRoute(browser, 'chores', 'Chores')
  await tapVisible(textSelector('Add Task'), 'create-chore-keyboard')
  await waitForNativeDialog(browser)
  const input = await browser.$('android=new UiSelector().className("android.widget.EditText")')
  await input.waitForDisplayed({ timeout: 15_000 })
  await input.click()
  await browser.keys(['Fold', ' ', '8'])
  assert.match(await input.getText(), /Fold 8/, 'hardware keyboard input reaches the dashboard form inside Home Assistant')
  await browser.back()
}

export async function runContextScenario() {
  await applyFoldState(browser, 'closed')
  await assertHomeAssistantContext()
}

export async function runGeometryScenario() {
  for (const state of ['closed', 'half', 'open'] as const) await assertPhysicalState(state)
}

export const scenarioCounts = {
  buttonModals: BUTTON_MODAL_CASES.length,
  hashModals: HASH_MODAL_CASES.length,
  routes: RESPONSIVE_ROUTES.length,
} as const

export interface EmulatorScenario {
  id: string
  run: () => Promise<void>
  successMessage: string | (() => string)
}

export async function runEmulatorScenarios(
  selectedScenarios: readonly EmulatorScenario[],
  implementedScenarioIds: readonly string[],
) {
  verifyPortManifest(implementedScenarioIds)
  console.log('✓ Emulator port manifest covers every Playwright spec')
  await startAppium()
  browser = await createHomeAssistantSession()

  try {
    await openHomeAssistantRoute(browser, 'overview', 'Home')
    for (const scenario of selectedScenarios) {
      await scenario.run()
      console.log(`✓ ${typeof scenario.successMessage === 'function' ? scenario.successMessage() : scenario.successMessage}`)
    }
  } finally {
    await browser.deleteSession()
    stopAppium()
  }
}
