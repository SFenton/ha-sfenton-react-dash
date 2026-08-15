import { defineConfig, devices } from '@playwright/test'

const usePrebuiltMock = process.env.PLAYWRIGHT_PREBUILT_MOCK === '1'
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
      testIgnore: /modal-sheet-webkit\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    ...(enableWebkit
      ? [{
          name: 'webkit',
          testMatch: /modal-sheet-webkit\.spec\.ts/,
          use: {
            ...devices['iPhone 13'],
            browserName: 'webkit' as const,
            launchOptions: webkitExecutablePath ? { executablePath: webkitExecutablePath } : undefined,
          },
        }]
      : []),
  ],
  webServer: {
    command: usePrebuiltMock
      ? `node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`
      : `node node_modules/vite/bin/vite.js build --mode test --outDir .playwright-dist && node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`,
    reuseExistingServer: false,
    url: serverUrl,
  },
})