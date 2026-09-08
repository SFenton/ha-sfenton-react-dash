import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export type FoldState = 'closed' | 'half' | 'open' | 'rear'

export interface FoldSize {
  height: number
  width: number
}

function sizeFromEnv(name: string, fallback: FoldSize): FoldSize {
  const value = process.env[name]
  if (!value) return fallback
  const match = value.match(/^(\d+)x(\d+)$/)
  if (!match) throw new Error(`${name} must use WIDTHxHEIGHT, received ${value}`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

const defaultSizes: Record<FoldState, FoldSize> = {
  closed: { width: 1248, height: 1972 },
  half: { width: 2448, height: 1848 },
  open: { width: 2448, height: 1848 },
  rear: { width: 1248, height: 1972 },
}

export const EMULATOR_CONFIG = {
  androidHome: process.env.ANDROID_HOME ?? path.join(os.homedir(), 'Android/Sdk'),
  adbBin: process.env.ADB_BIN,
  adbDevice: process.env.EMULATOR_ADB_DEVICE,
  appiumHost: process.env.EMULATOR_APPIUM_HOST ?? '127.0.0.1',
  appiumPort: Number(process.env.EMULATOR_APPIUM_PORT ?? 4723),
  appiumExternal: process.env.EMULATOR_APPIUM_EXTERNAL === '1',
  appiumBin: process.env.APPIUM_BIN,
  deviceName: process.env.EMULATOR_DEVICE_NAME ?? 'Galaxy_Z_Fold_8',
  deviceUdid: process.env.EMULATOR_UDID,
  dashboardPath: process.env.EMULATOR_HA_DASHBOARD_PATH ?? 'sfenton-react-dash/home',
  homeAssistantPackage: process.env.EMULATOR_HA_PACKAGE ?? 'io.homeassistant.companion.android',
  homeAssistantActivity: process.env.EMULATOR_HA_ACTIVITY ?? '.webview.WebViewActivity',
  foldStateIds: {
    closed: Number(process.env.EMULATOR_STATE_CLOSED ?? 0),
    half: Number(process.env.EMULATOR_STATE_HALF ?? 1),
    open: Number(process.env.EMULATOR_STATE_OPEN ?? 2),
    rear: Number(process.env.EMULATOR_STATE_REAR ?? 3),
  } satisfies Record<FoldState, number>,
  foldSizes: {
    closed: sizeFromEnv('EMULATOR_SIZE_CLOSED', defaultSizes.closed),
    half: sizeFromEnv('EMULATOR_SIZE_HALF', defaultSizes.half),
    open: sizeFromEnv('EMULATOR_SIZE_OPEN', defaultSizes.open),
    rear: sizeFromEnv('EMULATOR_SIZE_REAR', defaultSizes.rear),
  } satisfies Record<FoldState, FoldSize>,
} as const
