import { defineConfig, devices } from '@playwright/test'

const usePrebuiltMock = process.env.PLAYWRIGHT_PREBUILT_MOCK === '1'
const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 5174)
const serverUrl = `http://127.0.0.1:${serverPort}`

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/../public/manual/{projectName}/{arg}{ext}',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /manual-screenshots\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'manual-content-desktop',
      testMatch: /app-manual\.spec\.ts/,
      use: {
        browserName: 'chromium',
        hasTouch: false,
        isMobile: false,
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'manual-mobile',
      testMatch: /manual-screenshots\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 393, height: 852 },
      },
    },
    {
      name: 'manual-desktop',
      testMatch: /manual-screenshots\.spec\.ts/,
      use: {
        browserName: 'chromium',
        hasTouch: false,
        isMobile: false,
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: usePrebuiltMock
      ? `node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`
      : `node node_modules/vite/bin/vite.js build --mode test --outDir .playwright-dist && node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`,
    reuseExistingServer: false,
    url: serverUrl,
  },
})