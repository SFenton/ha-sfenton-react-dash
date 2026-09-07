import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const usePrebuiltMock = process.env.PLAYWRIGHT_PREBUILT_MOCK === '1'
const useRealHakit = process.env.PLAYWRIGHT_REAL_HAKIT === '1'
const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 5174)
const serverUrl = `http://127.0.0.1:${serverPort}`
const webkitExecutablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
const enableWebkit = process.env.PLAYWRIGHT_WEBKIT === '1' || Boolean(webkitExecutablePath)
const adaptiveNavigationSpec = /adaptive-navigation\.spec\.ts/
const managedRun = process.env.LAYOUT_RUN_DIR
const managedOrigin = managedRun
  ? (JSON.parse(readFileSync(resolve(managedRun, 'run.json'), 'utf8')) as { candidate: { origin: string } }).candidate.origin
  : undefined

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: managedOrigin ?? serverUrl,
    trace: 'on-first-retry',
    ...(managedRun ? {
      locale: 'en-US', timezoneId: 'America/Los_Angeles',
      screenshot: 'only-on-failure' as const, trace: 'retain-on-failure' as const,
    } : {}),
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /(?:adaptive-navigation|desktop-responsive|home-route-hydration-desktop|modal-sheet-webkit)\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'phone-navigation',
      testMatch: adaptiveNavigationSpec,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        screen: { height: 852, width: 393 },
        viewport: { height: 852, width: 393 },
      },
    },
    {
      name: 'passport-foldable',
      testMatch: adaptiveNavigationSpec,
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true,
        screen: { height: 741, width: 1152 },
        viewport: { height: 741, width: 1152 },
      },
    },
    {
      name: 'square-foldable',
      testMatch: adaptiveNavigationSpec,
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true,
        screen: { height: 836, width: 842 },
        viewport: { height: 836, width: 842 },
      },
    },
    {
      name: 'tablet',
      testMatch: adaptiveNavigationSpec,
      use: {
        ...devices['iPad Pro 11 landscape'],
        browserName: 'chromium',
      },
    },
    {
      name: 'desktop',
      testMatch: /(?:adaptive-navigation|desktop-responsive|home-route-hydration-desktop|modal-backdrop-bands|modal-rotation-regressions|weather-(?:scenes|atmosphere-scenes)|layout-acceptance)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        viewport: { height: 900, width: 1440 },
      },
    },
    ...(enableWebkit
      ? [{
          name: 'webkit',
          testMatch: /(?:iframe-lifecycle|weather-(?:data|scenes|atmosphere-scenes)|modal-(?:backdrop-bands|rotation-regressions|sheet-(?:lifecycle|performance|webkit))|layout-acceptance)\.spec\.ts/,
          use: {
            ...devices['iPhone 13'],
            browserName: 'webkit' as const,
            launchOptions: webkitExecutablePath ? { executablePath: webkitExecutablePath } : undefined,
          },
        }]
      : []),
  ],
  webServer: managedRun ? undefined : {
    command: useRealHakit
      ? `node node_modules/vite/bin/vite.js --force --host 127.0.0.1 --port ${serverPort} --strictPort`
      : usePrebuiltMock
      ? `node node_modules/vite/bin/vite.js preview --config e2e/mock-preview.config.ts --configLoader native --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`
      : `node node_modules/vite/bin/vite.js build --mode test --configLoader native --outDir .playwright-dist && node node_modules/vite/bin/vite.js preview --config e2e/mock-preview.config.ts --configLoader native --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`,
    reuseExistingServer: false,
    url: serverUrl,
  },
})