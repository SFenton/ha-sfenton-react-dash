import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { remote, type Browser } from 'webdriverio'
import { EMULATOR_CONFIG, type FoldState } from './config'

export const APPIUM_PORT = EMULATOR_CONFIG.appiumPort
export const ANDROID_HOME = EMULATOR_CONFIG.androidHome
export const ADB = EMULATOR_CONFIG.adbBin ?? path.join(ANDROID_HOME, 'platform-tools/adb')
export const HOME_ASSISTANT_PACKAGE = EMULATOR_CONFIG.homeAssistantPackage
export const HOME_ASSISTANT_ACTIVITY = EMULATOR_CONFIG.homeAssistantActivity
export const HOME_ASSISTANT_DASHBOARD_PATH = EMULATOR_CONFIG.dashboardPath

process.env.ANDROID_HOME = process.env.ANDROID_HOME || ANDROID_HOME
process.env.ANDROID_SDK_ROOT = process.env.ANDROID_SDK_ROOT || ANDROID_HOME

const STATE_IDS = EMULATOR_CONFIG.foldStateIds

let appiumProcess: ChildProcess | undefined

function appiumBinary() {
  if (EMULATOR_CONFIG.appiumBin) return EMULATOR_CONFIG.appiumBin
  const prefix = execFileSync('npm', ['prefix', '--global'], { encoding: 'utf8' }).trim()
  return path.join(prefix, 'bin/appium')
}

export const FOLD_PHYSICAL_SIZES = EMULATOR_CONFIG.foldSizes

export function adb(...args: string[]) {
  const deviceArgs = EMULATOR_CONFIG.adbDevice ? ['-s', EMULATOR_CONFIG.adbDevice] : []
  return execFileSync(ADB, [...deviceArgs, ...args], { encoding: 'utf8' }).trim()
}

export function physicalSize() {
  const output = adb('shell', 'wm', 'size')
  const match = output.match(/Physical size: (\d+)x(\d+)/)
  if (!match) throw new Error(`Unable to read emulator size from: ${output}`)
  return { height: Number(match[2]), width: Number(match[1]) }
}

export function setFoldState(state: FoldState) {
  adb('shell', 'cmd', 'device_state', 'state', String(STATE_IDS[state]))
}

async function waitForAppium() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${EMULATOR_CONFIG.appiumHost}:${APPIUM_PORT}/status`)
      if (response.ok) return
    } catch {
      // Appium is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Appium did not become ready on port ${APPIUM_PORT}`)
}

export async function startAppium() {
  if (EMULATOR_CONFIG.appiumExternal) return
  appiumProcess = spawn(appiumBinary(), [
    '--address', EMULATOR_CONFIG.appiumHost,
    '--port', String(APPIUM_PORT),
    '--log-level', 'error',
  ], {
    env: {
      ...process.env,
      ANDROID_HOME,
      ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || ANDROID_HOME,
    },
    stdio: 'ignore',
  })
  await waitForAppium()
}

export function stopAppium() {
  appiumProcess?.kill('SIGTERM')
  appiumProcess = undefined
}

export async function createHomeAssistantSession() {
  return remote({
    hostname: EMULATOR_CONFIG.appiumHost,
    port: APPIUM_PORT,
    path: '/',
    logLevel: 'error',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': EMULATOR_CONFIG.deviceName,
      ...(EMULATOR_CONFIG.deviceUdid ? { 'appium:udid': EMULATOR_CONFIG.deviceUdid } : {}),
      'appium:appPackage': HOME_ASSISTANT_PACKAGE,
      'appium:appActivity': HOME_ASSISTANT_ACTIVITY,
      'appium:autoGrantPermissions': true,
      'appium:dontStopAppOnReset': true,
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
    },
  }) as Promise<Browser<'async'>>
}

export async function waitForHomeAssistantApp(browser: Browser<'async'>) {
  await browser.waitUntil(async () => {
    const packageName = await browser.getCurrentPackage()
    const activity = await browser.getCurrentActivity()
    return packageName === HOME_ASSISTANT_PACKAGE && activity === HOME_ASSISTANT_ACTIVITY
  }, { timeout: 30_000, interval: 250, timeoutMsg: 'Home Assistant WebViewActivity did not become active' })
}

export async function waitForFoldState(browser: Browser<'async'>, state: FoldState) {
  const expected = FOLD_PHYSICAL_SIZES[state]
  await browser.waitUntil(async () => {
    const actual = physicalSize()
    if (actual.height !== expected.height || actual.width !== expected.width) return false
    const windowRect = await browser.getWindowRect()
    return windowRect.width === expected.width && windowRect.height === expected.height
  }, { timeout: 20_000, interval: 150, timeoutMsg: `${state} Home Assistant app geometry did not settle` })
  await browser.pause(500)
}

export async function applyFoldState(browser: Browser<'async'>, state: FoldState) {
  setFoldState(state)
  await waitForFoldState(browser, state)
  await waitForHomeAssistantApp(browser)
}

function xmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export async function waitForNativeText(browser: Browser<'async'>, text: string) {
  const expected = `text="${xmlAttribute(text)}"`
  await browser.waitUntil(async () => (await browser.getPageSource()).includes(expected), {
    timeout: 45_000,
    interval: 300,
    timeoutMsg: `Home Assistant dashboard title did not render: ${text}`,
  })
}

export function homeAssistantDeepLink(route: string, hash = '') {
  return `homeassistant://navigate/${HOME_ASSISTANT_DASHBOARD_PATH}?path=${encodeURIComponent(route)}${hash}`
}

export async function openHomeAssistantRoute(browser: Browser<'async'>, route: string, expectedTitle: string, hash = '') {
  const source = await browser.getPageSource()
  if (!source.includes('class="android.widget.TextView"')) {
    adb('shell', 'am', 'force-stop', HOME_ASSISTANT_PACKAGE)
  }
  adb(
    'shell', 'am', 'start', '-W',
    '-a', 'android.intent.action.VIEW',
    '-d', homeAssistantDeepLink(route, hash),
    HOME_ASSISTANT_PACKAGE,
  )
  await waitForHomeAssistantApp(browser)
  if (hash) {
    await waitForNativeDialog(browser)
  } else {
    await waitForNativeText(browser, expectedTitle)
  }
}

export interface NativeBounds {
  bottom: number
  left: number
  right: number
  top: number
}

export function boundsFromSource(source: string, className?: string) {
  const nodes = source.match(/<[^>]+>/g) ?? []
  return nodes.flatMap((node): NativeBounds[] => {
    if (className && !node.includes(`class="${className}"`)) return []
    const match = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!match) return []
    return [{ left: Number(match[1]), top: Number(match[2]), right: Number(match[3]), bottom: Number(match[4]) }]
  })
}

export async function waitForNativeDialog(browser: Browser<'async'>) {
  await browser.waitUntil(async () => {
    const source = await browser.getPageSource()
    const bounds = [
      ...boundsFromSource(source, 'android.app.AlertDialog'),
      ...boundsFromSource(source, 'android.app.Dialog'),
    ]
    return bounds.some((dialog) => dialog.right - dialog.left > 100 && dialog.bottom - dialog.top > 100)
  }, {
    timeout: 30_000,
    interval: 250,
    timeoutMsg: 'Home Assistant app did not expose a measurable dashboard modal as a native accessibility dialog',
  })
}

export function descriptionSelector(description: string) {
  const escaped = description.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `android=new UiSelector().description("${escaped}")`
}

export function descriptionStartsWithSelector(description: string) {
  const escaped = description.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `android=new UiSelector().descriptionStartsWith("${escaped}")`
}

export function descriptionContainsSelector(description: string) {
  const escaped = description.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `android=new UiSelector().descriptionContains("${escaped}")`
}

export function textSelector(text: string) {
  const escaped = text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `android=new UiSelector().text("${escaped}")`
}
