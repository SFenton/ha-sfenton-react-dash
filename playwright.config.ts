import { defineConfig, devices } from '@playwright/test'

const usePrebuiltMock = process.env.PLAYWRIGHT_PREBUILT_MOCK === '1'
const useRealHakit = process.env.PLAYWRIGHT_REAL_HAKIT === '1'
const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 5174)
const serverUrl = `http://127.0.0.1:${serverPort}`
const webkitExecutablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
const enableWebkit = process.env.PLAYWRIGHT_WEBKIT === '1' || Boolean(webkitExecutablePath)

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /(?:desktop-responsive|modal-sheet-webkit)\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'desktop',
      testMatch: /desktop-responsive\.spec\.ts/,
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
          testMatch: /(?:iframe-lifecycle|modal-sheet-(?:lifecycle|performance|webkit))\.spec\.ts/,
          use: {
            ...devices['iPhone 13'],
            browserName: 'webkit' as const,
            launchOptions: webkitExecutablePath ? { executablePath: webkitExecutablePath } : undefined,
          },
        }]
      : []),
  ],
  webServer: {
    command: useRealHakit
      ? `node node_modules/vite/bin/vite.js --force --host 127.0.0.1 --port ${serverPort} --strictPort`
      : usePrebuiltMock
      ? `node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`
      : `node node_modules/vite/bin/vite.js build --mode test --outDir .playwright-dist && node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`,
    reuseExistingServer: false,
    url: serverUrl,
  },
})